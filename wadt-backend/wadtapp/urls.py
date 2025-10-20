from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("<int:container_id>/", views.workbench, name="workbench"),
    path('auth/register/', views.register_user, name='register_user'),
    path('auth/register/', views.login_user, name='login_user'),
    path('auth/logout/', views.logout_user, name='logout_user'),
]
