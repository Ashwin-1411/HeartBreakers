from django.urls import path

from . import views

urlpatterns = [
    path("analyze", views.analyze_dataset, name="analyze"),
    path("health", views.health_check, name="health"),
    path("chat", views.chat_agent, name="chat"),
]
