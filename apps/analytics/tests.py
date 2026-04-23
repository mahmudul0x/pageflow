from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.pages.models import FacebookPage
from apps.posts.models import PagePostResult, Post


User = get_user_model()


class AnalyticsViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="analytics@example.com",
            email="analytics@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="page-1",
            name="Insights Page",
            access_token="page-token",
            followers_count=250,
        )
        self.post = Post.objects.create(
            user=self.user,
            content="A strong analytics post",
            media_url="https://cdn.example.com/post-image.jpg",
            media_type="image",
            status="published",
            published_at=timezone.now(),
        )
        self.result = PagePostResult.objects.create(
            post=self.post,
            page=self.page,
            fb_post_id="fb-post-1",
            success=True,
        )

    @patch("apps.analytics.views.requests.get")
    def test_analytics_uses_requested_date_range_and_computes_engagement(self, mock_get):
        metric_payloads = {
            "page_reach": [
                {
                    "name": "page_reach",
                    "values": [
                        {"value": 100, "end_time": "2026-04-22T07:00:00+0000"},
                        {"value": 50, "end_time": "2026-04-23T07:00:00+0000"},
                    ],
                }
            ],
            "page_media_view": [
                {
                    "name": "page_media_view",
                    "values": [
                        {"value": 140, "end_time": "2026-04-22T07:00:00+0000"},
                        {"value": 60, "end_time": "2026-04-23T07:00:00+0000"},
                    ],
                }
            ],
            "page_engaged_users": [
                {
                    "name": "page_engaged_users",
                    "values": [
                        {"value": 15, "end_time": "2026-04-22T07:00:00+0000"},
                        {"value": 15, "end_time": "2026-04-23T07:00:00+0000"},
                    ],
                }
            ],
            "page_follows": [
                {
                    "name": "page_follows",
                    "values": [
                        {"value": 240, "end_time": "2026-04-22T07:00:00+0000"},
                        {"value": 255, "end_time": "2026-04-23T07:00:00+0000"},
                    ],
                }
            ],
            "post_media_view": [{"name": "post_media_view", "values": [{"value": 90}]}],
            "post_engaged_users": [{"name": "post_engaged_users", "values": [{"value": 18}]}],
        }

        def mocked_get(*args, **kwargs):
            response = Mock()
            response.status_code = 200
            response.json.return_value = {
                "data": metric_payloads.get(kwargs["params"]["metric"], [])
            }
            return response

        mock_get.side_effect = mocked_get

        response = self.client.get("/api/analytics/", {"page_id": str(self.page.id), "date_range": "7"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["metrics"]["total_reach"], 150)
        self.assertEqual(response.data["metrics"]["impressions"], 200)
        self.assertEqual(response.data["metrics"]["page_likes"], 255)
        self.assertEqual(response.data["metrics"]["engagement_rate"], 20.0)
        self.assertEqual(len(response.data["chart_data"]), 2)
        self.assertEqual(response.data["chart_data"][0]["reach"], 100)
        self.assertEqual(response.data["chart_data"][0]["impressions"], 140)
        self.assertEqual(len(response.data["post_performance"]), 1)
        self.assertEqual(response.data["post_performance"][0]["reach"], 90)
        self.assertEqual(response.data["post_performance"][0]["engagement"], 18)
        self.assertEqual(len(response.data["individual_post_analytics"]), 1)
        self.assertEqual(response.data["individual_post_analytics"][0]["page"], "Insights Page")
        self.assertEqual(response.data["individual_post_analytics"][0]["engagement_rate"], 20.0)
        self.assertEqual(response.data["individual_post_analytics"][0]["media_url"], "https://cdn.example.com/post-image.jpg")
        self.assertEqual(response.data["individual_post_analytics"][0]["media_type"], "image")

        page_request_params = mock_get.call_args_list[0].kwargs["params"]
        self.assertEqual(page_request_params["access_token"], "page-token")
        self.assertEqual(page_request_params["period"], "day")
        self.assertIn("since", page_request_params)
        self.assertIn("until", page_request_params)
        self.assertEqual(
            [call.kwargs["params"]["metric"] for call in mock_get.call_args_list],
            [
                "page_reach",
                "page_media_view",
                "page_follows",
                "page_engaged_users",
                "post_media_view",
                "post_engaged_users",
            ],
        )
