from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.utils import timezone
import requests
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pages.models import FacebookPage
from apps.posts.models import PagePostResult


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
        "metric": "page_impressions,page_reach,page_fans,page_engaged_users",
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


def fetch_post_performance(result):
    response = requests.get(
        f"https://graph.facebook.com/v18.0/{result.fb_post_id}/insights",
        params={
            "metric": "post_impressions,post_engaged_users",
            "access_token": result.page.access_token,
        },
        timeout=30,
    )

    if response.status_code != 200:
        return None

    metrics_map = map_insights(response.json().get("data", []))
    return {
        "reach": sum_metric(metrics_map.get("post_impressions", [])),
        "engagement": sum_metric(metrics_map.get("post_engaged_users", [])),
    }


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

            for page in pages:
                response = requests.get(
                    f"https://graph.facebook.com/v18.0/{page.page_id}/insights",
                    params=build_page_insights_params(page.access_token, date_range),
                    timeout=30,
                )

                if response.status_code != 200:
                    continue

                metrics_map = map_insights(response.json().get("data", []))
                reach_points = metrics_map.get("page_reach", [])
                impression_points = metrics_map.get("page_impressions", [])

                total_reach += sum_metric(reach_points)
                total_impressions += sum_metric(impression_points)
                total_engaged_users += sum_metric(metrics_map.get("page_engaged_users", []))
                total_likes += latest_metric_value(metrics_map.get("page_fans", [])) or page.followers_count

                merge_chart_points(chart_store, reach_points, "reach")
                merge_chart_points(chart_store, impression_points, "impressions")

            post_metrics = build_post_performance(request.user, date_range)

            return Response(
                {
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
            )

        try:
            page = FacebookPage.objects.get(id=page_id, user=request.user)
        except FacebookPage.DoesNotExist:
            return Response({"error": "Page not found"}, status=404)

        response = requests.get(
            f"https://graph.facebook.com/v18.0/{page.page_id}/insights",
            params=build_page_insights_params(page.access_token, date_range),
            timeout=30,
        )

        if response.status_code != 200:
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
                    "error": "Could not fetch live analytics",
                }
            )

        metrics_map = map_insights(response.json().get("data", []))
        reach_points = metrics_map.get("page_reach", [])
        impression_points = metrics_map.get("page_impressions", [])
        chart_store = defaultdict(lambda: {"reach": 0, "impressions": 0})
        merge_chart_points(chart_store, reach_points, "reach")
        merge_chart_points(chart_store, impression_points, "impressions")

        total_reach = sum_metric(reach_points)
        total_impressions = sum_metric(impression_points)
        total_engaged_users = sum_metric(metrics_map.get("page_engaged_users", []))
        total_likes = latest_metric_value(metrics_map.get("page_fans", [])) or page.followers_count
        post_metrics = build_post_performance(request.user, date_range, page=page)

        return Response(
            {
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
        )
