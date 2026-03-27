from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

class Organization(models.Model):
    name = models.CharField(max_length=50)
    org_code = models.CharField(max_length=12, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.org_code:
            self.org_code = str(uuid.uuid4())[:8].upper()
        super().save(*args,**kwargs)

        def __str__(self):
            return f"{self.name} ({self.org_code})"

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('SUPER', 'Super-Admim'),
        ('ADMIN', 'Admin/Teacher'),
        ('STUDENT', 'Student')
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='STUDENT')

    organization = models.ForeignKey(
        Organization, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='members'
    )

    is_pending_teacher = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.role}"

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

    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

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

class ActionLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    container = models.ForeignKey(Container, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action}"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()