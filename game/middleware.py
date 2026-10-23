from django.core.cache import cache
from django.utils import timezone
from .models import UserProfile

class UpdateLastActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            # Записываем ID пользователя в кэш с таймаутом, например, 5 минут (300 секунд)
            cache_key = f"online-user-{request.user.id}"
            cache.set(cache_key, True, 300)
            
            # Записываем время в профиль пользователя:
            user = request.user
            print(user)
            profiles = UserProfile.objects.get_or_create(user=request.user)
            profiles[0].save()
            #request.user.last_activity = timezone.now()
            #request.user.save(update_fields=['last_activity'])

        response = self.get_response(request)
        return response