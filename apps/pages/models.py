from django.db import models
from apps.authentication.models import User


class FacebookPage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pages')
    page_id = models.CharField(max_length=200)
    name = models.CharField(max_length=300)
    access_token = models.TextField()  # Page-specific token
    picture = models.URLField(null=True, blank=True)
    category = models.CharField(max_length=200, null=True, blank=True)
    followers_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'page_id')

    def __str__(self):
        return f"{self.name} ({self.user.email})"