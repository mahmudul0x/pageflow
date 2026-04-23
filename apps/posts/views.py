import os
from pathlib import Path
from uuid import uuid4

import requests
from django.conf import settings
from django.core.files.storage import default_storage
from django.db import OperationalError, ProgrammingError
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from django.utils.text import get_valid_filename
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pages.models import FacebookPage
from .models import PagePostResult, Post, PublishSession


MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_VIDEO_UPLOAD_SIZE = 1500 * 1024 * 1024
VIDEO_UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024
DEFAULT_REQUEST_TIMEOUT = 60
VIDEO_REQUEST_TIMEOUT = 300


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def parse_scheduled_time_value(value):
    if not value:
        return None
    parsed = parse_datetime(str(value))
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def build_media_file_url(request, media_file):
    saved_path = save_uploaded_media(media_file)
    relative_url = f"{settings.MEDIA_URL}{saved_path.replace(os.sep, '/')}"
    return request.build_absolute_uri(relative_url)


def serialize_post(post):
    return {
        "id": post.id,
        "content": post.content[:100] + "..." if len(post.content) > 100 else post.content,
        "full_content": post.content,
        "media_url": post.media_url,
        "media_type": post.media_type,
        "status": post.status,
        "scheduled_time": post.scheduled_time,
        "published_at": post.published_at,
        "created_at": post.created_at,
        "hidden": post.hidden,
        "pages": [{"id": page.id, "name": page.name, "picture": page.picture} for page in post.pages.all()],
        "results": [
            {
                "page": result.page.name,
                "page_id": result.page.page_id,
                "success": result.success,
                "fb_post_id": result.fb_post_id,
                "error": result.error,
            }
            for result in post.results.select_related("page").all()
        ],
    }


def detect_media_family(file):
    content_type = getattr(file, "content_type", "") or ""
    if content_type.startswith("image/"):
        return "image"
    if content_type.startswith("video/"):
        return "video"
    return None


def validate_media_file(file, allowed_media_types=None):
    media_family = detect_media_family(file)
    if media_family is None:
        return None, "Unsupported file type. Please upload an image or video."

    if allowed_media_types and media_family not in allowed_media_types:
        allowed_label = " or ".join(sorted(allowed_media_types))
        return None, f"This upload only supports {allowed_label} files."

    max_size = MAX_IMAGE_UPLOAD_SIZE if media_family == "image" else MAX_VIDEO_UPLOAD_SIZE
    if file.size > max_size:
        size_label = "10MB" if media_family == "image" else "1.5GB"
        return None, f"{media_family.capitalize()} files must be {size_label} or smaller."

    return media_family, None


def build_upload_name(filename):
    base_name = get_valid_filename(Path(filename).stem or "upload")
    extension = Path(filename).suffix.lower()
    return os.path.join("uploads", f"{base_name}-{uuid4().hex}{extension}")


def save_uploaded_media(file):
    relative_path = build_upload_name(file.name)
    saved_path = default_storage.save(relative_path, file)
    return saved_path


def clamp_progress(progress):
    return max(0, min(100, int(progress)))


def get_publish_session(request):
    session_id = (request.data.get("publish_session_id") or "").strip()
    if not session_id:
        return None
    try:
        session, _ = PublishSession.objects.update_or_create(
            user=request.user,
            session_id=session_id,
            defaults={
                "progress": 0,
                "stage": "Preparing upload",
                "message": "Starting publish session.",
                "status": "pending",
            },
        )
        return session
    except (OperationalError, ProgrammingError):
        return None


def update_publish_session(session, *, progress=None, stage=None, message=None, status=None):
    if session is None:
        return

    touched = []
    if progress is not None:
        session.progress = clamp_progress(progress)
        touched.append("progress")
    if stage is not None:
        session.stage = stage
        touched.append("stage")
    if message is not None:
        session.message = message
        touched.append("message")
    if status is not None:
        session.status = status
        touched.append("status")

    if touched:
        try:
            session.save(update_fields=list(dict.fromkeys(touched + ["updated_at"])))
        except (OperationalError, ProgrammingError):
            return


def build_page_progress_callback(session, page_name, page_index, page_count):
    if session is None:
        return None

    def callback(page_progress, stage=None, message=None, status=None):
        page_span = 100 / max(page_count, 1)
        overall_progress = (page_index * page_span) + ((clamp_progress(page_progress) / 100) * page_span)
        update_publish_session(
            session,
            progress=overall_progress,
            stage=stage or "Publishing",
            message=message or f"Publishing to {page_name}.",
            status=status,
        )

    return callback


def extract_api_error(response):
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict) and error.get("message"):
            return error["message"], payload
    return f"Facebook API request failed with status {response.status_code}.", payload


def parse_success_payload(response):
    try:
        result = response.json()
    except ValueError:
        return {"success": False, "error": "Facebook returned an invalid JSON response."}

    if isinstance(result, dict):
        if result.get("id"):
            return {"success": True, "fb_post_id": result["id"]}
        if result.get("video_id"):
            return {"success": True, "fb_post_id": result["video_id"]}
        if result.get("post_id"):
            return {"success": True, "fb_post_id": result["post_id"]}
        if result.get("success") is True:
            return {"success": True, "fb_post_id": None}

    error_message, _ = extract_api_error(response)
    return {"success": False, "error": error_message}


def parse_delete_payload(response):
    try:
        result = response.json()
    except ValueError:
        return {"success": False, "error": "Facebook returned an invalid delete response."}

    if isinstance(result, dict) and result.get("success") is True:
        return {"success": True}

    error_message, _ = extract_api_error(response)
    return {"success": False, "error": error_message}


def delete_from_page(page, fb_post_id):
    try:
        response = requests.delete(
            f"https://graph.facebook.com/v18.0/{fb_post_id}",
            params={"access_token": page.access_token},
            timeout=DEFAULT_REQUEST_TIMEOUT,
        )
        return parse_delete_payload(response)
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def start_resumable_video_upload(page, media_file):
    response = requests.post(
        f"https://graph-video.facebook.com/v18.0/{page.page_id}/videos",
        data={
            "upload_phase": "start",
            "file_size": media_file.size,
            "access_token": page.access_token,
        },
        timeout=DEFAULT_REQUEST_TIMEOUT,
    )
    if response.status_code != 200:
        error_message, _ = extract_api_error(response)
        return None, error_message

    try:
        payload = response.json()
    except ValueError:
        return None, "Facebook returned an invalid upload session response."

    upload_session_id = payload.get("upload_session_id")
    start_offset = payload.get("start_offset")
    end_offset = payload.get("end_offset")

    if not upload_session_id or start_offset is None or end_offset is None:
        return None, "Facebook did not return a valid upload session."

    return {
        "upload_session_id": upload_session_id,
        "start_offset": str(start_offset),
        "end_offset": str(end_offset),
        "video_id": payload.get("video_id"),
    }, None


def transfer_video_chunk(page, upload_session_id, start_offset, chunk_bytes):
    response = requests.post(
        f"https://graph-video.facebook.com/v18.0/{page.page_id}/videos",
        data={
            "upload_phase": "transfer",
            "upload_session_id": upload_session_id,
            "start_offset": start_offset,
            "access_token": page.access_token,
        },
        files={
            "video_file_chunk": ("chunk.bin", chunk_bytes, "application/octet-stream"),
        },
        timeout=VIDEO_REQUEST_TIMEOUT,
    )
    if response.status_code != 200:
        error_message, _ = extract_api_error(response)
        return None, error_message

    try:
        payload = response.json()
    except ValueError:
        return None, "Facebook returned an invalid upload transfer response."

    next_start_offset = payload.get("start_offset")
    next_end_offset = payload.get("end_offset")
    if next_start_offset is None or next_end_offset is None:
        return None, "Facebook did not return the next upload offsets."

    return {
        "start_offset": str(next_start_offset),
        "end_offset": str(next_end_offset),
    }, None


def finish_resumable_video_upload(page, content, upload_session_id, fallback_post_id=None):
    response = requests.post(
        f"https://graph-video.facebook.com/v18.0/{page.page_id}/videos",
        data={
            "upload_phase": "finish",
            "upload_session_id": upload_session_id,
            "description": content,
            "access_token": page.access_token,
        },
        timeout=DEFAULT_REQUEST_TIMEOUT,
    )
    result = parse_success_payload(response)
    if result["success"] and not result.get("fb_post_id") and fallback_post_id:
        result["fb_post_id"] = fallback_post_id
    return result


def upload_video_file_resumable(page, content, media_file, progress_callback=None):
    session, error = start_resumable_video_upload(page, media_file)
    if error:
        return {"success": False, "error": error}

    upload_session_id = session["upload_session_id"]
    start_offset = session["start_offset"]
    end_offset = session["end_offset"]
    fallback_post_id = session.get("video_id")
    total_size = max(media_file.size, 1)

    media_file.open("rb")
    media_file.seek(0)
    if progress_callback:
        progress_callback(5, stage="Connecting", message=f"Connected to Facebook upload session for {page.name}.", status="in_progress")

    while int(start_offset) < int(end_offset):
        chunk_size = min(VIDEO_UPLOAD_CHUNK_SIZE, int(end_offset) - int(start_offset))
        chunk = media_file.read(chunk_size)
        if not chunk:
            return {"success": False, "error": "Video upload ended before all chunks were transferred."}

        offsets, error = transfer_video_chunk(page, upload_session_id, start_offset, chunk)
        if error:
            return {"success": False, "error": error}

        start_offset = offsets["start_offset"]
        end_offset = offsets["end_offset"]
        transferred = min(int(start_offset), total_size)
        if progress_callback:
            percent = 5 + int((transferred / total_size) * 85)
            progress_callback(
                percent,
                stage="Uploading video",
                message=f"Uploading video chunks to {page.name}: {transferred // (1024 * 1024)}MB / {total_size // (1024 * 1024)}MB",
                status="in_progress",
            )

    if progress_callback:
        progress_callback(95, stage="Finalizing", message=f"Finalizing video publish on {page.name}.", status="in_progress")
    return finish_resumable_video_upload(page, content, upload_session_id, fallback_post_id=fallback_post_id)


def upload_video_file(page, content, media_file, progress_callback=None):
    return upload_video_file_resumable(page, content, media_file, progress_callback=progress_callback)


def publish_to_page(page, content, media_url=None, media_file=None, media_type=None, progress_callback=None):
    try:
        if media_file and media_type == "image":
            if progress_callback:
                progress_callback(15, stage="Uploading image", message=f"Uploading image to {page.name}.", status="in_progress")
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
                timeout=DEFAULT_REQUEST_TIMEOUT,
            )
            if progress_callback:
                progress_callback(95, stage="Finalizing", message=f"Finalizing image post on {page.name}.", status="in_progress")
        elif media_file and media_type == "video":
            return upload_video_file(page, content, media_file, progress_callback=progress_callback)
        elif media_url and media_type == "image":
            if progress_callback:
                progress_callback(20, stage="Sending image", message=f"Sending image URL to {page.name}.", status="in_progress")
            response = requests.post(
                f"https://graph.facebook.com/v18.0/{page.page_id}/photos",
                data={
                    "url": media_url,
                    "caption": content,
                    "access_token": page.access_token,
                },
                timeout=DEFAULT_REQUEST_TIMEOUT,
            )
            if progress_callback:
                progress_callback(95, stage="Finalizing", message=f"Finalizing image post on {page.name}.", status="in_progress")
        elif media_url and media_type == "video":
            if progress_callback:
                progress_callback(20, stage="Sending video", message=f"Sending video URL to {page.name}.", status="in_progress")
            response = requests.post(
                f"https://graph-video.facebook.com/v18.0/{page.page_id}/videos",
                data={
                    "file_url": media_url,
                    "description": content,
                    "access_token": page.access_token,
                },
                timeout=VIDEO_REQUEST_TIMEOUT,
            )
            if progress_callback:
                progress_callback(95, stage="Finalizing", message=f"Finalizing video post on {page.name}.", status="in_progress")
        else:
            if progress_callback:
                progress_callback(25, stage="Publishing", message=f"Publishing text post to {page.name}.", status="in_progress")
            response = requests.post(
                f"https://graph.facebook.com/v18.0/{page.page_id}/feed",
                data={
                    "message": content,
                    "access_token": page.access_token,
                },
                timeout=DEFAULT_REQUEST_TIMEOUT,
            )
            if progress_callback:
                progress_callback(95, stage="Finalizing", message=f"Finalizing post on {page.name}.", status="in_progress")

        result = parse_success_payload(response)
        if progress_callback and result["success"]:
            progress_callback(100, stage="Completed", message=f"Published successfully to {page.name}.", status="in_progress")
        return result
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
        publish_session = get_publish_session(request)

        if not page_ids or not content:
            update_publish_session(publish_session, progress=0, stage="Failed", message="page_ids and content are required.", status="failed")
            return Response({"error": "page_ids and content are required"}, status=400)

        if media_file:
            detected_media_type, error = validate_media_file(media_file, allowed_media_types={"image", "video"})
            if error:
                update_publish_session(publish_session, progress=0, stage="Failed", message=error, status="failed")
                return Response({"error": error}, status=400)
            media_type = media_type or detected_media_type
            media_url = build_media_file_url(request, media_file)

        pages = FacebookPage.objects.filter(id__in=page_ids, user=request.user, is_active=True)
        if not pages.exists():
            update_publish_session(publish_session, progress=0, stage="Failed", message="Select at least one active page.", status="failed")
            return Response({"error": "Select at least one active page"}, status=400)

        update_publish_session(
            publish_session,
            progress=2,
            stage="Preparing",
            message=f"Preparing publish to {pages.count()} page{'s' if pages.count() != 1 else ''}.",
            status="in_progress",
        )

        post = Post.objects.create(
            user=request.user,
            content=content,
            media_url=media_url,
            media_type=media_type,
            status="published",
            published_at=timezone.now(),
        )
        post.pages.set(pages)

        results = []
        page_list = list(pages)
        for page_index, page in enumerate(page_list):
            result = publish_to_page(
                page,
                content,
                media_url=media_url,
                media_file=media_file,
                media_type=media_type,
                progress_callback=build_page_progress_callback(publish_session, page.name, page_index, len(page_list)),
            )
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
            update_publish_session(
                publish_session,
                progress=100,
                stage="Failed",
                message=post.error_message or "Publish failed for all selected pages.",
                status="failed",
            )
        else:
            update_publish_session(
                publish_session,
                progress=100,
                stage="Completed",
                message=f"Published successfully to {success_count}/{len(results)} page{'s' if len(results) != 1 else ''}.",
                status="completed",
            )

        return Response(
            {
                "message": f"Published to {success_count}/{len(results)} pages",
                "post_id": post.id,
                "success_count": success_count,
                "failed_count": len(results) - success_count,
                "results": results,
            }
        )


class DraftPostView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request):
        page_ids = request.data.get("page_ids") or []
        if not isinstance(page_ids, list):
            page_ids = [page_ids]

        content = (request.data.get("content") or "").strip()
        media_url = (request.data.get("media_url") or "").strip() or None
        media_type = request.data.get("media_type")

        if not content:
            return Response({"error": "content is required"}, status=400)

        post = Post.objects.create(
            user=request.user,
            content=content,
            media_url=media_url,
            media_type=media_type,
            status="draft",
        )

        if page_ids:
            pages = FacebookPage.objects.filter(id__in=page_ids, user=request.user, is_active=True)
            if not pages.exists():
                post.delete()
                return Response({"error": "Select at least one active page"}, status=400)
            post.pages.set(pages)

        post.refresh_from_db()
        return Response(
            {
                "message": "Draft saved successfully",
                "post": serialize_post(post),
            },
            status=201,
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
        parsed_scheduled_time = parse_scheduled_time_value(scheduled_time)
        if parsed_scheduled_time is None:
            return Response({"error": "scheduled_time must be a valid datetime"}, status=400)

        if media_file:
            return Response(
                {"error": "Scheduling image uploads is not supported yet. Please publish image posts immediately."},
                status=400,
            )

        pages = FacebookPage.objects.filter(id__in=page_ids, user=request.user, is_active=True)
        if not pages.exists():
            return Response({"error": "Select at least one active page"}, status=400)

        post = Post.objects.create(
            user=request.user,
            content=content,
            media_url=media_url,
            media_type=media_type,
            status="scheduled",
            scheduled_time=parsed_scheduled_time,
        )
        post.pages.set(pages)

        return Response(
            {
                "message": "Post scheduled successfully",
                "post_id": post.id,
                "scheduled_time": parsed_scheduled_time,
                "pages": [page.name for page in pages],
            }
        )


class DraftPostPublishView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, post_id):
        try:
            post = Post.objects.prefetch_related("pages", "results").get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({"error": "Post not found"}, status=404)

        if post.status == "published":
            return Response({"error": "This post is already published"}, status=400)

        pages = post.pages.filter(user=request.user, is_active=True)
        if not pages.exists():
            return Response({"error": "Select at least one active page"}, status=400)

        if not post.content.strip():
            return Response({"error": "content is required"}, status=400)

        post.results.all().delete()
        results = []
        for page in pages:
            result = publish_to_page(page, post.content, media_url=post.media_url, media_type=post.media_type)
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
            post.scheduled_time = None
        else:
            post.status = "published"
            post.published_at = timezone.now()
            post.scheduled_time = None
            post.error_message = "; ".join(filter(None, [item.get("error") for item in results])) or None
        post.save(update_fields=["status", "published_at", "scheduled_time", "error_message"])

        return Response(
            {
                "message": f"Published to {success_count}/{len(results)} pages",
                "post": serialize_post(post),
                "success_count": success_count,
                "failed_count": len(results) - success_count,
                "results": results,
            }
        )


class DraftPostScheduleView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, post_id):
        try:
            post = Post.objects.prefetch_related("pages").get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({"error": "Post not found"}, status=404)

        if post.status == "published":
            return Response({"error": "Published posts cannot be rescheduled from here."}, status=400)

        scheduled_time = request.data.get("scheduled_time")
        if not scheduled_time:
            return Response({"error": "scheduled_time is required"}, status=400)
        parsed_scheduled_time = parse_scheduled_time_value(scheduled_time)
        if parsed_scheduled_time is None:
            return Response({"error": "scheduled_time must be a valid datetime"}, status=400)

        pages = post.pages.filter(user=request.user, is_active=True)
        if not pages.exists():
            return Response({"error": "Select at least one active page"}, status=400)

        if not post.content.strip():
            return Response({"error": "content is required"}, status=400)

        post.status = "scheduled"
        post.scheduled_time = parsed_scheduled_time
        post.published_at = None
        post.error_message = None
        post.save(update_fields=["status", "scheduled_time", "published_at", "error_message"])
        post.refresh_from_db()

        return Response(
            {
                "message": "Post scheduled successfully",
                "post": serialize_post(post),
            }
        )


class PostsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get("status")
        page_id = request.query_params.get("page_id")
        raw_page_ids = request.query_params.getlist("page_ids") or []
        search = (request.query_params.get("search") or "").strip()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        include_hidden = parse_bool(request.query_params.get("include_hidden"), default=False)
        hidden = request.query_params.get("hidden")

        posts = (
            Post.objects.filter(user=request.user)
            .annotate(activity_date=Coalesce("scheduled_time", "published_at", "created_at"))
            .prefetch_related("pages", "results__page")
            .order_by("-activity_date", "-created_at")
        )

        if status_filter:
            posts = posts.filter(status=status_filter)

        page_ids = []
        if page_id:
            page_ids.append(page_id)
        for value in raw_page_ids:
            page_ids.extend([item.strip() for item in str(value).split(",") if item.strip()])

        if page_ids:
            posts = posts.filter(pages__id__in=page_ids)
        elif page_id:
            posts = posts.filter(pages__id=page_id)

        if search:
            posts = posts.filter(content__icontains=search)

        if date_from:
            posts = posts.filter(activity_date__date__gte=date_from)

        if date_to:
            posts = posts.filter(activity_date__date__lte=date_to)

        if hidden is not None:
            posts = posts.filter(hidden=parse_bool(hidden))
        elif not include_hidden:
            posts = posts.filter(hidden=False)

        data = [serialize_post(post) for post in posts.distinct()]
        return Response(data)


class PostDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def patch(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id, user=request.user)
        except Post.DoesNotExist:
            return Response({"error": "Post not found"}, status=404)

        data = request.data
        touched = []

        if "hidden" in data:
            post.hidden = parse_bool(data.get("hidden"))
            touched.append("hidden")

        editable_fields = {"content", "media_url", "scheduled_time", "page_ids"}
        wants_content_update = any(field in data for field in editable_fields)

        if wants_content_update and post.status == "published":
            return Response({"error": "Published posts can be hidden or deleted, but not edited from here."}, status=400)

        if "content" in data:
            content = (data.get("content") or "").strip()
            if not content:
                return Response({"error": "content is required"}, status=400)
            post.content = content
            touched.append("content")

        if "media_url" in data:
            post.media_url = (data.get("media_url") or "").strip() or None
            touched.append("media_url")

        if "scheduled_time" in data:
            scheduled_time = data.get("scheduled_time")
            if post.status == "scheduled" and not scheduled_time:
                return Response({"error": "scheduled_time is required for scheduled posts"}, status=400)
            parsed_scheduled_time = parse_scheduled_time_value(scheduled_time) if scheduled_time else None
            if scheduled_time and parsed_scheduled_time is None:
                return Response({"error": "scheduled_time must be a valid datetime"}, status=400)
            post.scheduled_time = parsed_scheduled_time
            touched.append("scheduled_time")

        if "page_ids" in data:
            raw_page_ids = data.get("page_ids") or []
            page_ids = raw_page_ids if isinstance(raw_page_ids, list) else [raw_page_ids]
            pages = FacebookPage.objects.filter(id__in=page_ids, user=request.user, is_active=True)
            if not pages.exists():
                return Response({"error": "Select at least one active page"}, status=400)
            post.save()
            post.pages.set(pages)

        if touched:
            post.save(update_fields=list(dict.fromkeys(touched)))
        else:
            post.save()

        post.refresh_from_db()
        return Response(serialize_post(post))

    def delete(self, request, post_id):
        try:
            post = Post.objects.prefetch_related("results__page").get(id=post_id, user=request.user)
            delete_failures = []

            published_results = post.results.select_related("page").filter(success=True).exclude(fb_post_id__isnull=True).exclude(fb_post_id="")
            for result in published_results:
                delete_result = delete_from_page(result.page, result.fb_post_id)
                if not delete_result["success"]:
                    delete_failures.append(f"{result.page.name}: {delete_result['error']}")

            if delete_failures:
                return Response(
                    {
                        "error": "Could not delete the post from Facebook.",
                        "details": delete_failures,
                    },
                    status=400,
                )

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

        _, error = validate_media_file(file, allowed_media_types={"image", "video"})
        if error:
            return Response({"error": error}, status=400)

        saved_path = save_uploaded_media(file)
        media_url = f"{request.scheme}://{request.get_host()}{settings.MEDIA_URL}{saved_path.replace(os.sep, '/')}"
        return Response({"url": media_url})


class PublishProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = PublishSession.objects.get(user=request.user, session_id=session_id)
        except PublishSession.DoesNotExist:
            return Response({"error": "Publish session not found"}, status=404)
        except (OperationalError, ProgrammingError):
            return Response({"error": "Publish session not found"}, status=404)

        return Response(
            {
                "session_id": session.session_id,
                "progress": session.progress,
                "stage": session.stage,
                "message": session.message,
                "status": session.status,
            }
        )
