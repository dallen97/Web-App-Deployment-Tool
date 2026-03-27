from django.contrib import admin

# Register your models here.
from .models import Container, LogEntry, Organization, UserProfile

admin.site.register(Organization)
admin.site.register(UserProfile)
admin.site.register(Container)
admin.site.register(LogEntry)
