from django.urls import path
from .views import PagesListView, SyncPagesView, TogglePageView

urlpatterns = [
    path('', PagesListView.as_view()),
    path('sync/', SyncPagesView.as_view()),
    path('<int:page_id>/toggle/', TogglePageView.as_view()),
]