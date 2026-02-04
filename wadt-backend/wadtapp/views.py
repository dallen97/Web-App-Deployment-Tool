import json
import docker
from docker.errors import DockerException, NotFound
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Container

#initialize docker client
try:
    client = docker.from_env()
except DockerException:
    print("Error: Could not connect to Docker")
    client = None

def index(request):
    container_catalog = Container.objects.order_by("-name")
    context = {"container_catalog": container_catalog}
    return render(request, "wadtapp/index.html", context)

def workbench(request, container_id):
    container = get_object_or_404(Container, pk=container_id)
    context = {"container": container}
    return render(request, "wadtapp/workbench.html", context)
   
@require_http_methods(["POST"])
def register_user(request):
    #create user account
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        if not all([username, password]):
            return JsonResponse({'error': 'Username and Password Required'}, status=400)
        
        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': 'Username already taken'}, status=409)
        
        user = User.objects.create_user(username=username, password=password)

        return JsonResponse({'status': 'Success', 'message': 'User created successfully', 'user_id': user.id}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["POST"])
@ensure_csrf_cookie
def login_user(request):
    #logs in a user
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        if not all([username, password]):
            return JsonResponse({'error': 'Username and Password Required'}, status=400)
        
        user = authenticate(request, username=username, password=password)

        if user is not None:
            #creates session id, that's sent back to browser as a cookie
            login(request, user)
            return JsonResponse({'status': 'success', 'message': 'Login successful.', 'user_id': user.id, 'username': user.username})
        else:
            return JsonResponse({'error': 'Invalid credentials.'}, status=401)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["POST"])
@login_required
def logout_user(request):
    #logs out user and removes session data for user
    logout(request)
    return JsonResponse({'status': 'Success', 'message': 'Logout successful.'})

@require_http_methods(["GET"])
@login_required
def get_containers(request):
    #now returns containers only relevant to the current user, will implement one for all containers later
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    all_containers = client.containers.list(all=True)
    user_id_str = str(request.user.id)
    container_data = []
    for c in all_containers:
        if c.labels.get("wadt.user_id") == user_id_str:
            container_data.append({
                "id": c.short_id,
                "name": c.name,
                "image": c.image.tags[0] if c.image.tags else 'unknown',
                "status": c.status,
            })
    return JsonResponse(container_data, safe=False)

@require_http_methods(["POST"])
@login_required
def start_container(request):
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)      
    try:
        body = json.loads(request.body)
        image_name = body.get('imageName')
        user_id = str(request.user.id)
        
        if not image_name:
            return JsonResponse({"error": "imageName is required"}, status=400)
        
        client.images.pull(image_name)
        new_container = client.containers.run(image_name, detach=True, labels={"wadt.user_id": user_id})
        
        return JsonResponse({
            "status": "success",
            "message": f"Container {new_container.name} started for user {user_id}",
            "id": new_container.short_id
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
@login_required
def stop_container(request, container_id):
    try:
        container = client.containers.get(container_id)
        if container.labels.get("wadt.user_id") != str(request.user.id):
            return JsonResponse({"error": "Unauthorized"}, status = 403)
        container.stop()
        return JsonResponse({"status": "success", "message": f"Container {container_id} stopped."})
    except docker.errors.NotFound:
        return JsonResponse({"error": "Container not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@require_http_methods(["POST"])
@login_required
def restart_container(request, container_id):
    #used if somebody needs to refresh container to apply changes
    try:
        container = client.containers.get(container_id)
        if container.labels.get("wadt.user_id") != str(request.user.id):
            return JsonResponse({"error": "Unauthorized"}, status = 403)
        container.restart()
        return JsonResponse({"status": "success", "message": f"Container {container_id} restarted."})
    except docker.errors.NotFound:
        return JsonResponse({"error": "Container not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
@login_required
def reset_container(request, container_id):
    #used if docker container breaks
    try:
        old_container = client.containers.get(container_id)

        if old_container.labels.get("wadt.user_id") != str(request.user.id):
            return JsonResponse({"error": "Unauthorized"}, status = 403)
        
        image_name = old_container.image.tags[0]

        if not image_name:
            return JsonResponse({"error": "Cannot identify image"}, status = 400)

        old_container.stop()
        old_container.remove()
        new_container = client.containers.run(image_name, detach=True, labels={"wadt.user_id": str(request.user.id)})

        return JsonResponse({
            "status": "success",
            "message": f"Container reset successfully.",
            "new_id": new_container.short_id
        }, status=201)
    except docker.errors.NotFound:
        return JsonResponse({"error": "Container not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)