from django.db import models # type: ignore
from django.conf import settings # type: ignore


class Container(models.Model):
    container_states = [
        ("CREAT", "created"),
        ("RUN", "running"),
        ("RESTR", "restarting"),
        ("STOP", "stopped"),
        ("ERR", "error"),
    ]
    name = models.CharField(max_length=30)
    description = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=30, choices=container_states)
    docker_container_id = models.CharField(max_length=64)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_user_container_name')
        ]

    def __str__(self):
        return f"{self.name} ({self.docker_container_id[:8]})"
    
class LogEntry(models.Model):
    contents = models.CharField(max_length=200)
    timestamp = models.DateTimeField(auto_now_add=True)
    container = models.ForeignKey(Container, on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="log_entry_user_id",
    )

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {self.contents[:50]}..."
