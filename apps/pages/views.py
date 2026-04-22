from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import requests
from .models import FacebookPage


class PagesListView(APIView):
    """User এর সব connected pages দেখাও"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pages = FacebookPage.objects.filter(user=request.user, is_active=True)
        data = [{
            "id": page.id,
            "page_id": page.page_id,
            "name": page.name,
            "picture": page.picture,
            "category": page.category,
            "followers_count": page.followers_count,
            "is_active": page.is_active,
        } for page in pages]
        return Response(data)


class SyncPagesView(APIView):
    """Facebook থেকে pages sync করো"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        access_token = user.facebook_access_token

        if not access_token:
            return Response({"error": "No Facebook token found"}, status=400)

        # Facebook Graph API থেকে pages নাও
        response = requests.get(
            "https://graph.facebook.com/v18.0/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,access_token,picture,category,followers_count"
            }
        )

        if response.status_code != 200:
            return Response({"error": "Failed to fetch pages from Facebook"}, status=400)

        fb_pages = response.json().get('data', [])
        synced = []

        for fb_page in fb_pages:
            page, created = FacebookPage.objects.update_or_create(
                user=user,
                page_id=fb_page['id'],
                defaults={
                    'name': fb_page.get('name', ''),
                    'access_token': fb_page.get('access_token', ''),
                    'picture': fb_page.get('picture', {}).get('data', {}).get('url', ''),
                    'category': fb_page.get('category', ''),
                    'followers_count': fb_page.get('followers_count', 0),
                }
            )
            synced.append({
                "id": page.id,
                "name": page.name,
                "page_id": page.page_id,
                "picture": page.picture,
            })

        return Response({
            "message": f"{len(synced)} pages synced successfully",
            "pages": synced
        })


class TogglePageView(APIView):
    """Page enable/disable করো"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, page_id):
        try:
            page = FacebookPage.objects.get(id=page_id, user=request.user)
            page.is_active = not page.is_active
            page.save()
            return Response({"is_active": page.is_active})
        except FacebookPage.DoesNotExist:
            return Response({"error": "Page not found"}, status=404)