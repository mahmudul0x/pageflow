from django.urls import path
from .views import PublishPostView, SchedulePostView, PostsListView, DeletePostView, MediaUploadView

urlpatterns = [
    path('', PostsListView.as_view()),
    path('publish/', PublishPostView.as_view()),
    path('schedule/', SchedulePostView.as_view()),
    path('<int:post_id>/', DeletePostView.as_view()),
    path('upload/', MediaUploadView.as_view()),
]