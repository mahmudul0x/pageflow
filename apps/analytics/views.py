from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.utils import timezone
import requests
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pages.models import FacebookPage
from apps.posts.models import PagePostResult


PAGE_INSIGHT_METRICS = {
    "reach": ["page_reach"],
    "impressions": ["page_media_view", "page_impressions"],
    "page_likes": ["page_follows", "page_fans"],
    "engaged_users": ["page_engaged_users"],
}

POST_INSIGHT_METRICS = {
    "reach": ["post_media_view", "post_impressions"],
    "engagement": ["post_engaged_users"],
}


def parse_date_range(raw_value):
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return 30
    return value if value > 0 else 30


def build_page_insights_params(page_access_token, date_range):
    now = timezone.now()
    since = (now - timezone.timedelta(days=date_range - 1)).date().isoformat()
    until = now.date().isoformat()
    return {
        "period": "day",
        "access_token": page_access_token,
        "since": since,
        "until": until,
    }


def map_insights(response_data):
    metrics_map = {}
    for item in response_data:
        metrics_map[item["name"]] = item.get("values", [])
    return metrics_map


def extract_graph_error(response):
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict) and error.get("message"):
            return error["message"]

    return f"Facebook insights request failed with status {response.status_code}."


def sum_metric(values):
    total = 0
    for item in values:
        value = item.get("value", 0)
        if isinstance(value, (int, float)):
            total += value
    return total


def latest_metric_value(values):
    if not values:
        return 0
    latest = values[-1].get("value", 0)
    return latest if isinstance(latest, (int, float)) else 0


def post_sort_key(item):
    published_at = item.get("published_at")
    if published_at is None:
        published_at = timezone.datetime(1970, 1, 1, tzinfo=timezone.utc)
    return (published_at, item["reach"])


def compute_engagement_rate(total_engaged_users, total_reach):
    if total_reach <= 0:
        return 0
    return round((total_engaged_users / total_reach) * 100, 2)


def merge_chart_points(store, values, field_name):
    for item in values:
        end_time = item.get("end_time")
        if not end_time:
            continue
        store[end_time][field_name] += item.get("value", 0)


def serialize_chart_points(store):
    return [
        {
            "end_time": end_time,
            "reach": values["reach"],
            "impressions": values["impressions"],
        }
        for end_time, values in sorted(store.items())
    ]


def truncate_post_label(content, max_length=48):
    compact = " ".join((content or "").split())
    if len(compact) <= max_length:
        return compact or "Untitled post"
    return f"{compact[: max_length - 3]}..."


def first_available_metric(metrics_map, candidates):
    for metric in candidates:
        if metric in metrics_map:
            return metrics_map.get(metric, [])
    return []


def fetch_insights_with_fallback(url, base_params, metric_groups):
    metrics_map = {}
    errors = []

    for label, candidates in metric_groups.items():
        metric_loaded = False
        last_error = None

        for metric in candidates:
            try:
                response = requests.get(
                    url,
                    params={**base_params, "metric": metric},
                    timeout=30,
                )
            except requests.RequestException as exc:
                last_error = str(exc)
                continue

            if response.status_code != 200:
                last_error = extract_graph_error(response)
                continue

            metrics_map.update(map_insights(response.json().get("data", [])))
            metric_loaded = True
            break

        if not metric_loaded and last_error:
            errors.append(f"{label}: {last_error}")

    if not metrics_map and errors:
        return None, "; ".join(errors)

    return metrics_map, "; ".join(errors) if errors else None


def fetch_post_performance(result):
    metrics_map, error = fetch_insights_with_fallback(
        f"https://graph.facebook.com/v18.0/{result.fb_post_id}/insights",
        {"access_token": result.page.access_token},
        POST_INSIGHT_METRICS,
    )
    if metrics_map is None:
        return None

    return {
        "reach": sum_metric(first_available_metric(metrics_map, POST_INSIGHT_METRICS["reach"])),
        "engagement": sum_metric(metrics_map.get("post_engaged_users", [])),
        "error": error,
    }


def fetch_page_insights(page, date_range):
    return fetch_insights_with_fallback(
        f"https://graph.facebook.com/v18.0/{page.page_id}/insights",
        build_page_insights_params(page.access_token, date_range),
        PAGE_INSIGHT_METRICS,
    )


def build_post_queryset(user, date_range, page=None):
    since = timezone.now() - timezone.timedelta(days=date_range - 1)
    results = (
        PagePostResult.objects.filter(
            post__user=user,
            post__status="published",
            success=True,
            post__published_at__gte=since,
        )
        .exclude(fb_post_id__isnull=True)
        .exclude(fb_post_id="")
        .select_related("post", "page")
    )

    if page is not None:
        results = results.filter(page=page)

    return results.order_by("-post__published_at")[:15]


def build_post_performance(user, date_range, page=None):
    results = list(build_post_queryset(user, date_range, page=page))

    performance = {}
    individual = []

    with ThreadPoolExecutor(max_workers=min(6, max(1, len(results)))) as executor:
        future_map = {executor.submit(fetch_post_performance, result): result for result in results}
        for future in as_completed(future_map):
            result = future_map[future]
            metrics = future.result()
            if not metrics:
                continue

            entry = performance.setdefault(
                result.post_id,
                {
                    "post_id": result.post_id,
                    "name": truncate_post_label(result.post.content),
                    "content": result.post.content,
                    "reach": 0,
                    "engagement": 0,
                    "pages": set(),
                    "published_at": result.post.published_at,
                },
            )
            entry["reach"] += metrics["reach"]
            entry["engagement"] += metrics["engagement"]
            entry["pages"].add(result.page.name)

            individual.append(
                {
                    "post_id": result.post_id,
                    "name": truncate_post_label(result.post.content),
                    "content": result.post.content,
                    "media_url": result.post.media_url,
                    "status": result.post.status,
                    "media_type": result.post.media_type or "text",
                    "page": result.page.name,
                    "page_id": result.page_id,
                    "fb_post_id": result.fb_post_id,
                    "published_at": result.post.published_at,
                    "reach": metrics["reach"],
                    "engagement": metrics["engagement"],
                    "engagement_rate": compute_engagement_rate(metrics["engagement"], metrics["reach"]),
                }
            )

    aggregated = [
        {
            **item,
            "pages": sorted(item["pages"]),
            "engagement_rate": compute_engagement_rate(item["engagement"], item["reach"]),
        }
        for item in performance.values()
    ]

    return {
        "top_posts": sorted(aggregated, key=lambda item: item["reach"], reverse=True)[:5],
        "individual_posts": sorted(
            individual,
            key=post_sort_key,
            reverse=True,
        ),
    }


class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        page_id = request.query_params.get("page_id")
        date_range = parse_date_range(request.query_params.get("date_range", "30"))

        if not page_id:
            return Response({"error": "page_id is required"}, status=400)

        if page_id == "all":
            pages = FacebookPage.objects.filter(user=request.user, is_active=True)
            if not pages:
                return Response({"error": "No pages found"}, status=404)

            total_reach = 0
            total_impressions = 0
            total_likes = 0
            total_engaged_users = 0
            chart_store = defaultdict(lambda: {"reach": 0, "impressions": 0})
            page_errors = []
            successful_pages = 0

            for page in pages:
                metrics_map, error = fetch_page_insights(page, date_range)
                if error:
                    page_errors.append(f"{page.name}: {error}")
                    if metrics_map is None:
                        continue
                successful_pages += 1
                reach_points = metrics_map.get("page_reach", [])
                impression_points = first_available_metric(metrics_map, PAGE_INSIGHT_METRICS["impressions"])

                total_reach += sum_metric(reach_points)
                total_impressions += sum_metric(impression_points)
                total_engaged_users += sum_metric(metrics_map.get("page_engaged_users", []))
                total_likes += latest_metric_value(first_available_metric(metrics_map, PAGE_INSIGHT_METRICS["page_likes"])) or page.followers_count

                merge_chart_points(chart_store, reach_points, "reach")
                merge_chart_points(chart_store, impression_points, "impressions")

            post_metrics = build_post_performance(request.user, date_range)

            payload = {
                "page_name": "All Pages",
                "metrics": {
                    "total_reach": total_reach,
                    "impressions": total_impressions,
                    "page_likes": total_likes,
                    "engagement_rate": compute_engagement_rate(total_engaged_users, total_reach),
                },
                "chart_data": serialize_chart_points(chart_store),
                "post_performance": post_metrics["top_posts"],
                "individual_post_analytics": post_metrics["individual_posts"],
            }

            if successful_pages == 0 and page_errors:
                payload["error"] = page_errors[0]
            elif page_errors:
                payload["warning"] = "; ".join(page_errors[:3])

            return Response(payload)

        try:
            page = FacebookPage.objects.get(id=page_id, user=request.user)
        except FacebookPage.DoesNotExist:
            return Response({"error": "Page not found"}, status=404)

        metrics_map, error = fetch_page_insights(page, date_range)

        if error and metrics_map is None:
            return Response(
                {
                    "page_name": page.name,
                    "metrics": {
                        "total_reach": 0,
                        "impressions": 0,
                        "page_likes": page.followers_count,
                        "engagement_rate": 0,
                    },
                    "chart_data": [],
                    "post_performance": [],
                    "individual_post_analytics": [],
                    "error": error,
                }
            )
        reach_points = metrics_map.get("page_reach", [])
        impression_points = first_available_metric(metrics_map, PAGE_INSIGHT_METRICS["impressions"])
        chart_store = defaultdict(lambda: {"reach": 0, "impressions": 0})
        merge_chart_points(chart_store, reach_points, "reach")
        merge_chart_points(chart_store, impression_points, "impressions")

        total_reach = sum_metric(reach_points)
        total_impressions = sum_metric(impression_points)
        total_engaged_users = sum_metric(metrics_map.get("page_engaged_users", []))
        total_likes = latest_metric_value(first_available_metric(metrics_map, PAGE_INSIGHT_METRICS["page_likes"])) or page.followers_count
        post_metrics = build_post_performance(request.user, date_range, page=page)

        payload = {
            "page_name": page.name,
            "metrics": {
                "total_reach": total_reach,
                "impressions": total_impressions,
                "page_likes": total_likes,
                "engagement_rate": compute_engagement_rate(total_engaged_users, total_reach),
            },
            "chart_data": serialize_chart_points(chart_store),
            "post_performance": post_metrics["top_posts"],
            "individual_post_analytics": post_metrics["individual_posts"],
        }
        if error:
            payload["warning"] = error
        return Response(payload)
