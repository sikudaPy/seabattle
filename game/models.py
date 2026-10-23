from django.db import models
from django.contrib.auth.models import User

# class UserProfile(models.Model):
#     user = models.OneToOneField(User, on_delete=models.CASCADE)
#     last_activity = models.DateTimeField(auto_now=True)
#     # phone_number = models.CharField(max_length=15, blank=True, null=True)
#     # profile_picture = models.ImageField(upload_to='profile_pics', null=True, blank=True)
#     # bio = models.TextField(max_length=500, blank=True)
#     # birth_date = models.DateField(null=True, blank=True)

#     def __str__(self):
#         return f'Профиль пользователя {self.user.username}'

