import os

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pages.models import FacebookPage
from .models import PagePostResult, Post


def publish_to_page(page, content, media_url=None, media_file=None, media_type=None):
    try:
        if media_file and media_type == "image":
            media_file.open("rb")
            media_file.seek(0)
            response = requests.post(
                f"https://graph.facebook.com/v18.0/{page.page_id}/photos",
                data={
                    "caption": content,
                    "access_token": page.access_token,
                },
                files={
                    "source": (
                        media_file.name,
                        media_file,
                        getattr(media_file, "content_type", "application/octet-stream"),
                    ),
                },
                timeout=60,
            )
        elif media_url and media_type == "image":
            response = requests.post(
                f"https://graph.facebook.com/v18.0/{page.page_id}/photos",
                data={
                    "url": media_url,
                    "caption": content,
                    "access_token": page.access_token,
                },
                timeout=60,
            )
        else:
            response = requests.post(
                f"https://graph.facebook.com/v18.0/{page.page_id}/feed",
                data={
                    "message": content,
                    "access_token": page.access_token,
                },
                timeout=60,
            )

        result = response.json()
        if "id" in result:
            return {"success": True, "fb_post_id": result["id"]}
        return {"success": False, "error": result.get("error", {}).get("message", "Unknown error")}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


class PublishPostView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        raw_page_ids = request.data.getlist("page_ids") if hasattr(request.data, "getlist") else request.data.get("page_ids", [])
        page_ids = raw_page_ids if isinstance(raw_page_ids, list) else [raw_page_ids]
        content = request.data.get("content", "")
        media_url = request.data.get("media_url")
        media_type = request.data.get("media_type")
        media_file = request.FILES.get("file")

        if not page_ids or not content:
            return Response({"error": "page_ids and content are required"}, status=400)

        pages = FacebookPage.objects.filter(id__in=page_ids, user=request.user, is_active=True)

        post = Post.objects.create(
            user=request.user,
            content=content,
            media_url=media_url if not media_file else None,
            media_type=media_type,
            status="published",
            published_at=timezone.now(),
        )
        post.pages.set(pages)

        results = []
        for page in pages:
            result = publish_to_page(page, content, media_url=media_url, media_file=media_file, media_type=media_type)
            PagePostResult.objects.create(
                post=post,
                page=page,
                fb_post_id=result.get("fb_post_id"),
                success=result["success"],
                error=result.get("error"),
                published_at=timezone.now() if result["success"] else None,
            )
            results.append(
                {
                    "page": page.name,
                    "success": result["success"],
                    "fb_post_id": result.get("fb_post_id"),
                    "error": result.get("error"),
                }
            )

        success_count = sum(1 for item in results if item["success"])
        if success_count == 0:
            post.status = "failed"
            post.error_message = "; ".join(filter(None, [item.get("error") for item in results]))
            post.published_at = None
            post.save(update_fields=["status", "error_message", "published_at"])

        return Response(
            {
                "message": f"Published to {success_count}/{len(results)} pages",
                "post_id": post.id,
                "success_count": success_count,
                "failed_count": len(results) - success_count,
                "results": results,
            }
        )


class SchedulePostView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        raw_page_ids = request.data.getlist("page_ids") if hasattr(request.data, "getlist") else request.data.get("page_ids", [])
        page_ids = raw_page_ids if isinstance(raw_page_ids, list) else [raw_page_ids]
        content = request.data.get("content", "")
        media_url = request.data.get("media_url")
        media_type = request.data.get("media_type")
        scheduled_time = request.data.get("scheduled_time")
        media_file = request.FILES.get("file")

        if not all([page_ids, content, scheduled_time]):
            return Response({"error": "page_ids, content, and scheduled_time are required"}, status=400)

        if media_file:
            return Response(
                {"error": "Scheduling image uploads is not supported yet. Please publish image posts immediately."},
                status=400,
            )

        pages = FacebookPage.objects.filter(id__in=page_ids, user=request.user, is_active=True)

        post = Post.objects.create(
            user=request.user,
            content=content,
            media_url=media_url,
            media_type=media_type,
            status="scheduled",
            scheduled_time=scheduled_time,
        )
        post.pages.set(pages)

        return Response(
            {
                "message": "Post scheduled successfully",
                "post_id": post.id,
                "scheduled_time": scheduled_time,
                "pages": [page.name for page in pages],
            }
        )


class PostsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get("status")
        posts = Post.objects.filter(user=request.user).order_by("-created_at")

        if status_filter:
            posts = posts.filter(status=status_filter)

        data = []
        for post in posts:
            data.append(
                {
                    "id": post.id,
                    "content": post.content[:100] + "..." if len(post.content) > 100 else post.content,
                    "full_content": post.content,
                    "media_url": post.media_url,
                    "status": post.status,
                    "scheduled_time": post.scheduled_time,
                    "published_at": post.published_at,
                    "created_at": post.created_at,
                    "pages": [{"id": page.id, "name": page.name, "picture": page.picture} for page in post.pages.all()],
                    "results": [
                        {
                            "page": result.page.name,
                            "success": result.success,
                            "fb_post_id": result.fb_post_id,
                            "error": result.error,
                        }
                        for result in post.results.select_related("page").all()
                    ],
                }
            )
        return Response(data)


class DeletePostView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
            post.delete()
            return Response({"message": "Post deleted"})
        except Post.DoesNotExist:
            return Response({"error": "Post not found"}, status=404)


class MediaUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided"}, status=400)

        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads")
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, file.name)
        with open(file_path, "wb+") as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        media_url = f"{request.scheme}://{request.get_host()}{settings.MEDIA_URL}uploads/{file.name}"
        return Response({"url": media_url})
