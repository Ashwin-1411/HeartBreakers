from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.register_user, name="register"),
    path("auth/login/", views.login_user, name="login"),
    path("auth/logout/", views.logout_user, name="logout"),
    path("auth/session/", views.session_info, name="session-info"),
    path("analyze/", views.analyze_dataset, name="analyze"),
    path("history/", views.list_history, name="history"),
    path("history/<int:pk>/", views.history_detail, name="history-detail"),
    path("trend/", views.trend_view, name="trend"),
    path("health/", views.health_check, name="health"),
    path("chat/", views.chat_agent, name="chat"),
]
