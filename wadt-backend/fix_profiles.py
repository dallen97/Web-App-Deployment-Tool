import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wadtproject.settings')
django.setup()

from django.contrib.auth.models import User
from wadtapp.models import UserProfile

for user in User.objects.all():
    profile, created = UserProfile.objects.get_or_create(user=user)
    print(f'{user.username}: {"created" if created else "already exists"}')