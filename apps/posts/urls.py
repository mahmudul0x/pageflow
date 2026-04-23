from django.urls import path
from .views import (
    DraftPostPublishView,
    DraftPostScheduleView,
    DraftPostView,
    PublishPostView,
    PublishProgressView,
    SchedulePostView,
    PostsListView,
    PostDetailView,
    MediaUploadView,
)

urlpatterns = [
    path('', PostsListView.as_view()),
    path('draft/', DraftPostView.as_view()),
    path('publish/', PublishPostView.as_view()),
    path('publish-progress/<str:session_id>/', PublishProgressView.as_view()),
    path('schedule/', SchedulePostView.as_view()),
    path('<int:post_id>/publish/', DraftPostPublishView.as_view()),
    path('<int:post_id>/schedule/', DraftPostScheduleView.as_view()),
    path('<int:post_id>/', PostDetailView.as_view()),
    path('upload/', MediaUploadView.as_view()),
]
