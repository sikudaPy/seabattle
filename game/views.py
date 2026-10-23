from django.shortcuts import redirect, render
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import login, authenticate
from django.utils import timezone
from datetime import timedelta
# from game.models import UserProfile
from django.core.cache import cache
from django.contrib.auth import get_user_model


# Create your views here.
def index(request):

    if request.user.is_authenticated:

        User = get_user_model()
        list_users = []
        allUsers = User.objects.all()  
        keys = []
        for user in allUsers:
            keys.append(f"online-user-{user.id}")
        onlineKeys = cache.get_many(keys)
        user_id_list = []
        for key in onlineKeys:
            user_id_list.append(key.removeprefix("online-user-"))
        for user in allUsers:
            if str(user.id) in user_id_list:
                list_users.append(user.username)    
        context = {
            'online_users': list_users    
        }
        return render(request, "game/index.html", context)
    else:
        return redirect('login/')

def signup_view(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()       # Сохраняем нового пользователя
            login(request, user)     # Выполняем вход
            return redirect('/')     # Перенаправляем на главную страницу
    else:
        form = UserCreationForm()
    return render(request, 'signup.html', {'form': form})

def login_view(request):
    form = AuthenticationForm(data=request.POST or None)
    if request.method == 'POST':
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(username=username, password=password) # Проверяем учетные данные
            if user is not None:
                login(request, user)     # Выполняем вход
                return redirect('/')  # Перенаправляем на главную страницу
    return render(request, 'login.html', {'form': form})
