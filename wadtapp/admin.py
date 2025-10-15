from django.contrib import admin

# Register your models here.
from .models import Container, LogEntry

admin.site.register(Container)
admin.site.register(LogEntry)
