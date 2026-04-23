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
    from apps.posts.models import Post, PagePostResult
    from apps.posts.views import publish_to_page

    now = timezone.now()
    due_posts = Post.objects.filter(
        status='scheduled',
        scheduled_time__lte=now,
    )

    for post in due_posts:
        results = []

        for page in post.pages.all():
            result = publish_to_page(page, post.content, post.media_url, None, post.media_type)
            PagePostResult.objects.create(
                post=post,
                page=page,
                fb_post_id=result.get("fb_post_id"),
                success=result["success"],
                error=result.get("error"),
                published_at=now if result["success"] else None,
            )
            results.append(result)

        success_count = sum(1 for result in results if result["success"])
        if success_count == 0:
            post.status = 'failed'
            post.published_at = None
            post.error_message = "; ".join(filter(None, [result.get("error") for result in results]))
        else:
            post.status = 'published'
            post.published_at = now
            post.error_message = "; ".join(filter(None, [result.get("error") for result in results])) or None
        post.save(update_fields=["status", "published_at", "error_message"])

    return f"Published {due_posts.count()} scheduled posts"
