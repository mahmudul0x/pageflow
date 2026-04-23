from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
import requests

from .models import User


def serialize_user(user):
    full_name = f"{user.first_name} {user.last_name}".strip()
    initials = "".join(part[0] for part in full_name.split()[:2] if part).upper() or user.username[:2].upper()
    return {
        "id": str(user.id),
        "name": full_name or user.username,
        "email": user.email,
        "picture": user.profile_picture,
        "avatar": initials,
        "facebook_id": user.facebook_id,
    }


def build_auth_response(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": serialize_user(user),
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""

        if not all([name, email, password]):
            return Response({"error": "name, email, and password are required"}, status=400)

        if User.objects.filter(email=email).exists():
            return Response({"error": "An account with this email already exists"}, status=400)

        name_parts = name.split()
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=name_parts[0] if name_parts else "",
            last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
        )
        return Response(build_auth_response(user), status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""

        if not all([email, password]):
            return Response({"error": "email and password are required"}, status=400)

        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({"error": "Invalid email or password"}, status=401)

        return Response(build_auth_response(user))


class FacebookAuthURLView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        app_id = settings.FACEBOOK_APP_ID
        redirect_uri = settings.FACEBOOK_REDIRECT_URI
        mode = request.query_params.get("mode", "pages")
        if mode == "posting":
            scope = "pages_show_list,pages_read_engagement,pages_manage_posts"
        else:
            scope = "pages_show_list,pages_read_engagement"  # Include for analytics

        auth_url = (
            f"https://www.facebook.com/v18.0/dialog/oauth"
            f"?client_id={app_id}"
            f"&redirect_uri={redirect_uri}"
            f"&scope={scope}"
            f"&response_type=code"
        )
        return Response({"auth_url": auth_url})


class FacebookCallbackView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"error": "Code is required"}, status=400)

        token_response = requests.get(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
                "code": code,
            },
            timeout=30,
        )

        if token_response.status_code != 200:
            return Response({"error": "Failed to get access token"}, status=400)

        access_token = token_response.json().get("access_token")
        user_info = requests.get(
            "https://graph.facebook.com/v18.0/me",
            params={
                "fields": "id,name,email,picture",
                "access_token": access_token,
            },
            timeout=30,
        ).json()

        facebook_id = user_info.get("id")
        if not facebook_id:
            return Response({"error": "Failed to get Facebook user info"}, status=400)

        name = user_info.get("name", "")
        email = user_info.get("email", f"{facebook_id}@facebook.com")
        picture = user_info.get("picture", {}).get("data", {}).get("url", "")

        if request.user.is_authenticated:
            user = request.user
            conflict = User.objects.filter(facebook_id=facebook_id).exclude(id=user.id).exists()
            if conflict:
                return Response({"error": "This Facebook account is already linked to another user"}, status=400)

            if not user.email:
                user.email = email
            if not user.first_name and name:
                user.first_name = name.split()[0]
            if not user.last_name and len(name.split()) > 1:
                user.last_name = " ".join(name.split()[1:])
        else:
            user, created = User.objects.get_or_create(
                facebook_id=facebook_id,
                defaults={
                    "username": email or facebook_id,
                    "email": email,
                    "first_name": name.split()[0] if name else "",
                    "last_name": " ".join(name.split()[1:]) if len(name.split()) > 1 else "",
                    "profile_picture": picture,
                },
            )
            if created:
                user.set_unusable_password()

        user.facebook_id = facebook_id
        user.facebook_access_token = access_token
        user.profile_picture = picture or user.profile_picture
        user.save()

        return Response(build_auth_response(user))


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(serialize_user(request.user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                RefreshToken(refresh_token).blacklist()
        except Exception:
            pass
        return Response({"message": "Logged out successfully"})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        request.user.delete()
        return Response({"message": "Account deleted successfully"})
