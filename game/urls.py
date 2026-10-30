from . import views
from django.urls import path

urlpatterns = [
    path('', views.index, name='home_page'),
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('seabattle_1C/', views.seabattle_1C, name='seabattle_1C'),
    #path('gamestart', views.GamePrep.as_view(), name='gamPrep_page'),
    #path('playing', views.Playing.as_view(), name='playing_page'),
]