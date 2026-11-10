from django.urls import re_path
from . import consumers

websocket_urlpatterns=[
    re_path("ws/socket-server", consumers.ShipConsumer.as_asgi()),
    re_path("ws/chat/seabattle", consumers.ChatConsumer.as_asgi()),
]