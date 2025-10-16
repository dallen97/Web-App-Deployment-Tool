from django.db import models
from django.conf import settings


class Container(models.Model):
    def __str__(self):
        return self.description

    container_states = {
        "CREAT": "created",
        "RUN": "running",
        "RESTR": "restarting",
        "STOP": "stopped",
        "ERR": "error",
    }
    name = models.CharField(max_length=30)
    description = models.CharField(max_length=200)
    status = models.CharField(max_length=30, choices=container_states)
    docker_container_id = models.CharField(max_length=64)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)


class LogEntry(models.Model):
    def __str__(self):
        return self.contents

    contents = models.CharField(max_length=200)
    timestamp = models.DateField(auto_now_add=True)
    container = models.ForeignKey(Container, on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="log_entry_user_id",
    )
