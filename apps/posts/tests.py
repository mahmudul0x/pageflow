import shutil
import tempfile
from datetime import timedelta
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.pages.models import FacebookPage
from apps.posts.models import PagePostResult, Post, PublishSession
from apps.posts.views import VIDEO_UPLOAD_CHUNK_SIZE, publish_to_page
from config.celery import publish_scheduled_posts


User = get_user_model()


class PublishScheduledPostsTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="scheduler@example.com",
            email="scheduler@example.com",
            password="testpass123",
        )
        self.page_one = FacebookPage.objects.create(
            user=self.user,
            page_id="page-1",
            name="Page One",
            access_token="token-1",
        )
        self.page_two = FacebookPage.objects.create(
            user=self.user,
            page_id="page-2",
            name="Page Two",
            access_token="token-2",
        )

    def create_scheduled_post(self):
        post = Post.objects.create(
            user=self.user,
            content="Scheduled content",
            status="scheduled",
            scheduled_time=timezone.now() - timedelta(minutes=1),
        )
        post.pages.set([self.page_one, self.page_two])
        return post

    @patch("apps.posts.views.publish_to_page")
    def test_marks_post_failed_when_all_page_publishes_fail(self, mock_publish_to_page):
        mock_publish_to_page.side_effect = [
            {"success": False, "error": "Token expired"},
            {"success": False, "error": "Permission denied"},
        ]
        post = self.create_scheduled_post()

        publish_scheduled_posts()

        post.refresh_from_db()
        self.assertEqual(post.status, "failed")
        self.assertIsNone(post.published_at)
        self.assertEqual(post.error_message, "Token expired; Permission denied")
        self.assertEqual(PagePostResult.objects.filter(post=post).count(), 2)
        self.assertFalse(PagePostResult.objects.filter(post=post, success=True).exists())

    @patch("apps.posts.views.publish_to_page")
    def test_marks_post_published_when_any_page_publish_succeeds(self, mock_publish_to_page):
        mock_publish_to_page.side_effect = [
            {"success": True, "fb_post_id": "fb-123"},
            {"success": False, "error": "Permission denied"},
        ]
        post = self.create_scheduled_post()

        publish_scheduled_posts()

        post.refresh_from_db()
        self.assertEqual(post.status, "published")
        self.assertIsNotNone(post.published_at)
        self.assertEqual(post.error_message, "Permission denied")
        self.assertEqual(PagePostResult.objects.filter(post=post).count(), 2)
        self.assertTrue(PagePostResult.objects.filter(post=post, success=True).exists())


class DraftPostViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="drafts@example.com",
            email="drafts@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="page-1",
            name="Draft Page",
            access_token="token-1",
        )

    def test_creates_draft_post(self):
        response = self.client.post(
            "/api/posts/draft/",
            {
                "page_ids": [self.page.id],
                "content": "Draft post content",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Post.objects.count(), 1)
        post = Post.objects.get()
        self.assertEqual(post.status, "draft")
        self.assertEqual(post.content, "Draft post content")
        self.assertEqual(list(post.pages.values_list("id", flat=True)), [self.page.id])

    @patch("apps.posts.views.publish_to_page")
    def test_draft_can_be_published_from_existing_post(self, mock_publish_to_page):
        draft = Post.objects.create(user=self.user, content="Draft publish content", status="draft")
        draft.pages.set([self.page])
        mock_publish_to_page.return_value = {"success": True, "fb_post_id": "fb-999"}

        response = self.client.post(f"/api/posts/{draft.id}/publish/", format="json")

        self.assertEqual(response.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.status, "published")
        self.assertIsNotNone(draft.published_at)
        self.assertEqual(PagePostResult.objects.filter(post=draft, success=True).count(), 1)

    def test_draft_can_be_scheduled_from_existing_post(self):
        draft = Post.objects.create(user=self.user, content="Draft schedule content", status="draft")
        draft.pages.set([self.page])

        response = self.client.post(
            f"/api/posts/{draft.id}/schedule/",
            {"scheduled_time": "2026-05-01T10:30"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.status, "scheduled")
        self.assertIsNotNone(draft.scheduled_time)


class PostsApiFilteringTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="filters@example.com",
            email="filters@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="page-filter",
            name="Filter Page",
            access_token="token-filter",
        )

    def test_hidden_posts_are_excluded_by_default_and_can_be_requested(self):
        visible_post = Post.objects.create(user=self.user, content="Visible content", status="draft")
        visible_post.pages.set([self.page])
        hidden_post = Post.objects.create(user=self.user, content="Hidden content", status="draft", hidden=True)
        hidden_post.pages.set([self.page])

        default_response = self.client.get("/api/posts/")
        include_hidden_response = self.client.get("/api/posts/", {"include_hidden": "true"})

        self.assertEqual(default_response.status_code, 200)
        self.assertEqual(len(default_response.data), 1)
        self.assertEqual(default_response.data[0]["full_content"], "Visible content")

        self.assertEqual(include_hidden_response.status_code, 200)
        self.assertEqual(len(include_hidden_response.data), 2)


class MediaUploadValidationTests(TestCase):
    def setUp(self):
        self.temp_media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.temp_media_root)
        self.override.enable()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="media@example.com",
            email="media@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="page-media",
            name="Media Page",
            access_token="token-media",
        )

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.temp_media_root, ignore_errors=True)
        super().tearDown()

    def test_media_upload_rejects_unsupported_file_type(self):
        file = SimpleUploadedFile("notes.txt", b"hello world", content_type="text/plain")

        response = self.client.post("/api/posts/upload/", {"file": file})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Unsupported file type. Please upload an image or video.")

    def test_media_upload_saves_with_unique_filename(self):
        file = SimpleUploadedFile("cover.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")

        response = self.client.post("/api/posts/upload/", {"file": file})

        self.assertEqual(response.status_code, 200)
        self.assertIn("/media/uploads/", response.data["url"])
        self.assertNotIn("/media/uploads/cover.png", response.data["url"])

    @patch("apps.posts.views.requests.post")
    def test_publish_accepts_video_file_uploads(self, mock_post):
        file = SimpleUploadedFile("clip.mp4", b"fake-video", content_type="video/mp4")
        start_response = Mock(status_code=200)
        start_response.json.return_value = {
            "upload_session_id": "session-publish-1",
            "start_offset": "0",
            "end_offset": str(len(b"fake-video")),
        }
        transfer_response = Mock(status_code=200)
        transfer_response.json.return_value = {
            "start_offset": str(len(b"fake-video")),
            "end_offset": str(len(b"fake-video")),
        }
        finish_response = Mock(status_code=200)
        finish_response.json.return_value = {"id": "video-post-456"}
        mock_post.side_effect = [start_response, transfer_response, finish_response]

        response = self.client.post(
            "/api/posts/publish/",
            {
                "page_ids": [str(self.page.id)],
                "content": "Post with video file",
                "media_type": "video",
                "file": file,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["success_count"], 1)
        self.assertEqual(response.data["failed_count"], 0)
        self.assertEqual(response.data["results"][0]["fb_post_id"], "video-post-456")
        self.assertEqual(
            mock_post.call_args_list[0].args[0],
            "https://graph-video.facebook.com/v18.0/page-media/videos",
        )


class PublishToPageVideoTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="video@example.com",
            email="video@example.com",
            password="testpass123",
        )
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="video-page",
            name="Video Page",
            access_token="page-video-token",
        )

    @patch("apps.posts.views.requests.post")
    def test_video_url_posts_to_video_endpoint(self, mock_post):
        mock_post.return_value.json.return_value = {"id": "video-post-123"}

        result = publish_to_page(
            self.page,
            "Video caption",
            media_url="https://cdn.example.com/video.mp4",
            media_type="video",
        )

        self.assertEqual(result, {"success": True, "fb_post_id": "video-post-123"})
        mock_post.assert_called_once_with(
            "https://graph-video.facebook.com/v18.0/video-page/videos",
            data={
                "file_url": "https://cdn.example.com/video.mp4",
                "description": "Video caption",
                "access_token": "page-video-token",
            },
            timeout=300,
        )

    @patch("apps.posts.views.requests.post")
    def test_large_video_file_uses_resumable_upload(self, mock_post):
        start_response = Mock(status_code=200)
        start_response.json.return_value = {
            "upload_session_id": "session-123",
            "start_offset": "0",
            "end_offset": str(VIDEO_UPLOAD_CHUNK_SIZE),
            "video_id": "video-start-123",
        }
        transfer_response = Mock(status_code=200)
        transfer_response.json.return_value = {
            "start_offset": str(VIDEO_UPLOAD_CHUNK_SIZE),
            "end_offset": str(VIDEO_UPLOAD_CHUNK_SIZE + 1),
        }
        transfer_complete_response = Mock(status_code=200)
        transfer_complete_response.json.return_value = {
            "start_offset": str(VIDEO_UPLOAD_CHUNK_SIZE + 1),
            "end_offset": str(VIDEO_UPLOAD_CHUNK_SIZE + 1),
        }
        finish_response = Mock(status_code=200)
        finish_response.json.return_value = {"id": "video-post-large"}
        mock_post.side_effect = [start_response, transfer_response, transfer_complete_response, finish_response]

        media_file = Mock()
        media_file.size = VIDEO_UPLOAD_CHUNK_SIZE + 1
        media_file.name = "big-video.mp4"
        media_file.content_type = "video/mp4"
        media_file.read = Mock(side_effect=[b"a" * VIDEO_UPLOAD_CHUNK_SIZE, b"b"])
        media_file.open = Mock()
        media_file.seek = Mock()

        result = publish_to_page(
            self.page,
            "Large video caption",
            media_file=media_file,
            media_type="video",
        )

        self.assertEqual(result, {"success": True, "fb_post_id": "video-post-large"})
        self.assertEqual(mock_post.call_count, 4)

        start_call = mock_post.call_args_list[0]
        self.assertEqual(start_call.args[0], "https://graph-video.facebook.com/v18.0/video-page/videos")
        self.assertEqual(start_call.kwargs["data"]["upload_phase"], "start")
        self.assertEqual(start_call.kwargs["data"]["file_size"], VIDEO_UPLOAD_CHUNK_SIZE + 1)

        transfer_call = mock_post.call_args_list[1]
        self.assertEqual(transfer_call.kwargs["data"]["upload_phase"], "transfer")
        self.assertEqual(transfer_call.kwargs["data"]["upload_session_id"], "session-123")

        finish_call = mock_post.call_args_list[3]
        self.assertEqual(finish_call.kwargs["data"]["upload_phase"], "finish")
        self.assertEqual(finish_call.kwargs["data"]["description"], "Large video caption")

    @patch("apps.posts.views.requests.post")
    def test_resumable_video_uses_start_video_id_when_finish_has_no_id(self, mock_post):
        start_response = Mock(status_code=200)
        start_response.json.return_value = {
            "upload_session_id": "session-124",
            "start_offset": "0",
            "end_offset": str(VIDEO_UPLOAD_CHUNK_SIZE),
            "video_id": "video-live-link-999",
        }
        transfer_response = Mock(status_code=200)
        transfer_response.json.return_value = {
            "start_offset": str(VIDEO_UPLOAD_CHUNK_SIZE),
            "end_offset": str(VIDEO_UPLOAD_CHUNK_SIZE + 1),
        }
        transfer_complete_response = Mock(status_code=200)
        transfer_complete_response.json.return_value = {
            "start_offset": str(VIDEO_UPLOAD_CHUNK_SIZE + 1),
            "end_offset": str(VIDEO_UPLOAD_CHUNK_SIZE + 1),
        }
        finish_response = Mock(status_code=200)
        finish_response.json.return_value = {"success": True}
        mock_post.side_effect = [start_response, transfer_response, transfer_complete_response, finish_response]

        media_file = Mock()
        media_file.size = VIDEO_UPLOAD_CHUNK_SIZE + 1
        media_file.name = "big-video.mp4"
        media_file.content_type = "video/mp4"
        media_file.read = Mock(side_effect=[b"a" * VIDEO_UPLOAD_CHUNK_SIZE, b"b"])
        media_file.open = Mock()
        media_file.seek = Mock()

        result = publish_to_page(
            self.page,
            "Large video caption",
            media_file=media_file,
            media_type="video",
        )

        self.assertEqual(result, {"success": True, "fb_post_id": "video-live-link-999"})

    @patch("apps.posts.views.requests.post")
    def test_video_publish_treats_success_true_without_id_as_success(self, mock_post):
        mock_post.return_value.json.return_value = {"success": True}

        result = publish_to_page(
            self.page,
            "Video caption",
            media_url="https://cdn.example.com/video.mp4",
            media_type="video",
        )

        self.assertEqual(result, {"success": True, "fb_post_id": None})


class PublishProgressApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="progress@example.com",
            email="progress@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.session = PublishSession.objects.create(
            user=self.user,
            session_id="session-progress-1",
            progress=68,
            stage="Uploading video",
            message="Uploading chunks",
            status="in_progress",
        )

    def test_returns_publish_progress_for_authenticated_user(self):
        response = self.client.get(f"/api/posts/publish-progress/{self.session.session_id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["progress"], 68)
        self.assertEqual(response.data["stage"], "Uploading video")
        self.assertEqual(response.data["status"], "in_progress")


class DeletePostTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="delete-post@example.com",
            email="delete-post@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(self.user)
        self.page = FacebookPage.objects.create(
            user=self.user,
            page_id="page-delete",
            name="Delete Page",
            access_token="delete-token",
        )

    @patch("apps.posts.views.requests.delete")
    def test_delete_removes_remote_facebook_post_before_local_delete(self, mock_delete):
        mock_delete.return_value.json.return_value = {"success": True}

        post = Post.objects.create(
            user=self.user,
            content="Published content",
            status="published",
            published_at=timezone.now(),
        )
        post.pages.set([self.page])
        PagePostResult.objects.create(
            post=post,
            page=self.page,
            fb_post_id="123456789",
            success=True,
            published_at=timezone.now(),
        )

        response = self.client.delete(f"/api/posts/{post.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Post.objects.filter(id=post.id).exists())
        mock_delete.assert_called_once_with(
            "https://graph.facebook.com/v18.0/123456789",
            params={"access_token": "delete-token"},
            timeout=60,
        )

    @patch("apps.posts.views.requests.delete")
    def test_delete_keeps_local_post_when_remote_facebook_delete_fails(self, mock_delete):
        mock_delete.return_value.status_code = 400
        mock_delete.return_value.json.return_value = {
            "error": {"message": "Permissions error"},
        }

        post = Post.objects.create(
            user=self.user,
            content="Published content",
            status="published",
            published_at=timezone.now(),
        )
        post.pages.set([self.page])
        PagePostResult.objects.create(
            post=post,
            page=self.page,
            fb_post_id="123456789",
            success=True,
            published_at=timezone.now(),
        )

        response = self.client.delete(f"/api/posts/{post.id}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Post.objects.filter(id=post.id).exists())
        self.assertEqual(response.data["error"], "Could not delete the post from Facebook.")
        self.assertEqual(response.data["details"], ["Delete Page: Permissions error"])
