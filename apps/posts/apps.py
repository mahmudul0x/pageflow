from django.apps import AppConfig
from django.db.models.signals import post_migrate


class PostsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.posts'

    def ready(self):
        from .scheduler import ensure_publish_scheduled_posts_task

        post_migrate.connect(
            ensure_publish_scheduled_posts_task,
            sender=self,
            dispatch_uid="apps.posts.ensure_publish_scheduled_posts_task",
        )
