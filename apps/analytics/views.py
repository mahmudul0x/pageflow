from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import requests
from apps.pages.models import FacebookPage


class AnalyticsView(APIView):
    """Page analytics Facebook Graph API থেকে নাও"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        page_id = request.query_params.get('page_id')
        date_range = request.query_params.get('date_range', '30')  # days

        if not page_id:
            return Response({"error": "page_id is required"}, status=400)

        try:
            page = FacebookPage.objects.get(id=page_id, user=request.user)
        except FacebookPage.DoesNotExist:
            return Response({"error": "Page not found"}, status=404)

        # Facebook Insights API
        metrics = "page_impressions,page_reach,page_fans,page_engaged_users"
        response = requests.get(
            f"https://graph.facebook.com/v18.0/{page.page_id}/insights",
            params={
                "metric": metrics,
                "period": "day",
                "access_token": page.access_token,
            }
        )

        if response.status_code != 200:
            # Fallback mock data (API error হলে)
            return Response({
                "page_name": page.name,
                "metrics": {
                    "total_reach": 0,
                    "impressions": 0,
                    "page_likes": page.followers_count,
                    "engagement_rate": 0,
                },
                "chart_data": [],
                "error": "Could not fetch live analytics"
            })

        insights = response.json().get('data', [])

        # Data process করো
        metrics_map = {}
        for item in insights:
            metrics_map[item['name']] = item.get('values', [])

        return Response({
            "page_name": page.name,
            "metrics": {
                "total_reach": sum(v['value'] for v in metrics_map.get('page_reach', [])),
                "impressions": sum(v['value'] for v in metrics_map.get('page_impressions', [])),
                "page_likes": page.followers_count,
                "engagement_rate": 0,
            },
            "chart_data": metrics_map.get('page_reach', []),
        })