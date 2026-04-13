from django.urls import path
from . import views

from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('workbench/<str:container_id>/', views.workbench, name='workbench'),
    path('get_csrf_token/', views.get_csrf_token, name='get_csrf_token'),
    path('register_user/', views.register_user, name='register_user'),
    path('login_user/', views.login_user, name='login_user'),
    path('verify_mfa_login/', views.verify_mfa_login, name='verify_mfa_login'),
    path('setup_mfa/', views.setup_mfa, name='setup_mfa'),
    path('verify_mfa_setup/', views.verify_mfa_setup, name='verify_mfa_setup'),
    path('logout_user/', views.logout_user, name='logout_user'),
    path('current_user/', views.current_user, name='current_user'),
    path('request_teacher_status/', views.request_teacher_status, name='request_teacher_status'),
    path('get_pending_teachers/', views.get_pending_teachers, name='get_pending_teachers'),
    path('approve_teacher/<int:target_user_id>/', views.approve_teacher, name='approve_teacher'),
    path('create_organization/', views.create_organization, name='create_organization'),
    path('join_organization/', views.join_organization, name='join_organization'),
    path('leave_organization/', views.leave_organization, name='leave_organization'),
    path('get_containers/', views.get_containers, name='get_containers'),
    path('start_container/', views.start_container, name='start_container'),
    path('stop_container/<str:container_id>/', views.stop_container, name='stop_container'),
    path('restart_container/<str:container_id>/', views.restart_container, name='restart_container'),
    path('reset_container/<str:container_id>/', views.reset_container, name='reset_container'),
    path('check_container_ready/<str:container_id>/', views.check_container_ready, name='check_container_ready'),
    path('get_container_logs/<str:container_id>/', views.get_container_logs, name='get_container_logs'),
    path('get_all_containers_admin/', views.get_all_containers_admin, name='get_all_containers_admin'),
    path('organization_stats/', views.get_organization_stats, name='get_organization_stats'),
    path('delete_organization/<int:org_id>/', views.delete_organization, name='delete_organization'),
    path('remove_member/<int:target_user_id>/', views.remove_member, name='remove_member'),
]

