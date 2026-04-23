from django.db import ProgrammingError, OperationalError


def ensure_publish_scheduled_posts_task(**kwargs):
    """
    Ensure Celery Beat has a once-per-minute task for scheduled posts.
    Safe to call after migrations; exits quietly if tables are unavailable.
    """
    try:
        from django_celery_beat.models import IntervalSchedule, PeriodicTask

        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=1,
            period=IntervalSchedule.MINUTES,
        )
        PeriodicTask.objects.update_or_create(
            name="Publish scheduled posts every minute",
            defaults={
                "task": "config.celery.publish_scheduled_posts",
                "interval": schedule,
                "enabled": True,
            },
        )
    except (OperationalError, ProgrammingError):
        # Database tables may not exist yet during early startup or migrations.
        return
