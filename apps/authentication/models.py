from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    facebook_id = models.CharField(max_length=200, unique=True, null=True, blank=True)
    facebook_access_token = models.TextField(null=True, blank=True)
    profile_picture = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email or self.username