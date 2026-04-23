from django.db import models
from apps.authentication.models import User
from apps.pages.models import FacebookPage


class Post(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('published', 'Published'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    pages = models.ManyToManyField(FacebookPage, related_name='posts')
    content = models.TextField()
    media_url = models.URLField(null=True, blank=True)
    media_type = models.CharField(max_length=10, choices=[('image', 'Image'), ('video', 'Video')], null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_time = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(null=True, blank=True)
    hidden = models.BooleanField(default=False)

    def __str__(self):
        return f"Post by {self.user.email} - {self.status}"


class PagePostResult(models.Model):
    """প্রতিটা page এ post এর result track করে"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='results')
    page = models.ForeignKey(FacebookPage, on_delete=models.CASCADE)
    fb_post_id = models.CharField(max_length=200, null=True, blank=True)
    success = models.BooleanField(default=False)
    error = models.TextField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)


class PublishSession(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="publish_sessions")
    session_id = models.CharField(max_length=64, unique=True)
    progress = models.PositiveSmallIntegerField(default=0)
    stage = models.CharField(max_length=100, blank=True)
    message = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.session_id} ({self.status})"
