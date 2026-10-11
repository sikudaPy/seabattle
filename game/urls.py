from . import views
from django.urls import path

urlpatterns = [
    path('', views.index, name='home_page'),
    #path('gamestart', views.GamePrep.as_view(), name='gamPrep_page'),
    #path('playing', views.Playing.as_view(), name='playing_page'),
]