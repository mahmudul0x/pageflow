from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, LoginView, FacebookAuthURLView, FacebookCallbackView, MeView, LogoutView

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('facebook-url/', FacebookAuthURLView.as_view()),
    path('facebook-callback/', FacebookCallbackView.as_view()),
    path('me/', MeView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
]
