from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("<int:container_id>/", views.workbench, name="workbench"),
    path('auth/register/', views.register_user, name='register_user'),
    path('auth/login/', views.login_user, name='login_user'),
    path('auth/logout/', views.logout_user, name='logout_user'),
    path('containers/', views.get_containers, name='get_containers'),
    path('containers/start/', views.start_container, name='start_container'),
    path('containers/<str:container_id>/stop/', views.stop_container, name='stop_container'),
    path('containers/<str:container_id>/restart/', views.restart_container, name='restart_container'),
    path('containers/<str:container_id>/check-ready/', views.check_container_ready, name='check_container_ready'),
]