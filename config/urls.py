from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/auth/', include('apps.authentication.urls')),
    path('api/pages/', include('apps.pages.urls')),
    path('api/posts/', include('apps.posts.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
]