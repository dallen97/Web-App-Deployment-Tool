from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("<int:container_id>/", views.workbench, name="workbench"),
]
