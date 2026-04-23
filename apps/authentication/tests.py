from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


User = get_user_model()


class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_creates_user_and_returns_tokens(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "name": "Rahim Ahmed",
                "email": "rahim@example.com",
                "password": "strongpass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email="rahim@example.com").exists())
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "rahim@example.com")

    def test_login_returns_tokens_for_existing_user(self):
        User.objects.create_user(
            username="login@example.com",
            email="login@example.com",
            password="strongpass123",
            first_name="Login",
            last_name="User",
        )

        response = self.client.post(
            "/api/auth/login/",
            {
                "email": "login@example.com",
                "password": "strongpass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["name"], "Login User")

    def test_delete_account_removes_authenticated_user(self):
        user = User.objects.create_user(
            username="delete@example.com",
            email="delete@example.com",
            password="strongpass123",
        )
        self.client.force_authenticate(user)

        response = self.client.delete("/api/auth/delete-account/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(email="delete@example.com").exists())
