from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.pages.models import FacebookPage


User = get_user_model()


class PagesApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="pages@example.com",
            email="pages@example.com",
            password="strongpass123",
        )
        self.client.force_authenticate(self.user)
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="page-123",
            name="Toggle Page",
            access_token="token-123",
            is_active=True,
        )

    def test_toggle_page_persists_is_active_state(self):
        response = self.client.patch(f"/api/pages/{self.page.id}/toggle/")

        self.assertEqual(response.status_code, 200)
        self.page.refresh_from_db()
        self.assertFalse(self.page.is_active)
        self.assertEqual(response.data["is_active"], False)
