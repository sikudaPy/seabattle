from django.shortcuts import redirect, render
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import login, authenticate

# Create your views here.
def index(request):
    if request.user.is_authenticated:
        return render(request, "game/index.html")
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
