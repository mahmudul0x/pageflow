import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('pageflow')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.task
def publish_scheduled_posts():
    """প্রতি মিনিটে run হয়, scheduled posts publish করে"""
    from django.utils import timezone
    from apps.posts.models import Post
    from apps.posts.views import publish_to_page

    now = timezone.now()
    due_posts = Post.objects.filter(
        status='scheduled',
        scheduled_time__lte=now,
    )

    for post in due_posts:
        post.status = 'published'
        post.published_at = now
        post.save()

        for page in post.pages.all():
            publish_to_page(page, post.content, post.media_url, post.media_type)

    return f"Published {due_posts.count()} scheduled posts"