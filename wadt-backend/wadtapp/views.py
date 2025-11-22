from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_http_methods
import json

from .models import Container


def index(request):
    container_catalog = Container.objects.order_by("-name")
    context = {"container_catalog": container_catalog}
    return render(request, "wadtapp/index.html", context)


def workbench(request, container_id):
    container = get_object_or_404(Container, pk=container_id)
    context = {"container": container}
    return render(request, "wadtapp/workbench.html", context)

try:
    client = docker.from_env()
except DockerException:
    print("Error: Could not connect to Docker")
    client = None
    
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

@require_http_methods(["Post"])
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
def logout_user(request):
    #logs out user and removes session data for user
    logout(request)
    return JsonResponse({'status': 'Success', 'message': 'Logout successful.'})

@require_http_methods(["GET"])
def get_containers(request):
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    running_containers = client.containers.list(all=True)
    container_data = []
    for c in all_containers:
        #unknown only if ID is not found
        user_id = c.labels.get("wadt.user_id", "unknown")

        container_data.append({
            "id": c.short_id,
            "name": c.name,
            "image": c.image.tags[0] if c.image.tags else 'unknown',
            "status": c.status,
            "user_id": user_id 
        })
    return JsonResponse(container_data, safe=False)

@require_http_methods(["POST"])
def start_container(request):
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)      
    try:
        body = json.loads(request.body)
        image_name = body.get('imageName')
        user_id = body.get('userID')
        
        if not image_name:
            return JsonResponse({"error": "imageName is required"}, status=400)
        
        client.images.pull(image_name)
        new_container = client.containers.run(image_name, detach=True, labels={"wadt.user_id": str(user_id)})
        
        return JsonResponse({
            "status": "success",
            "message": f"Container {new_container.name} started for user {user_id}",
            "id": new_container.short_id
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
def stop_container(request, container_id):
    try:
        container = client.containers.get(container_id)
        container.stop()
        return JsonResponse({"status": "success", "message": f"Container {container_id} stopped."})
    except docker.errors.NotFound:
        return JsonResponse({"error": "Container not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@require_http_methods(["POST"])
def restart_container(request, container_id):
    #used if somebody needs to refresh container to apply changes
    try:
        container = client.containers.get(container_id)
        container.restart()
        return JsonResponse({"status": "success", "message": f"Container {container_id} restarted."})
    except docker.errors.NotFound:
        return JsonResponse({"error": "Container not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
def reset_container(request, container_id):
    #used if docker container breaks
    try:
        old_container = client.containers.get(container_id)
        image_name = old_container.image.tags[0]
        old_container.stop()
        old_container.remove()
        new_container = client.containers.run(image_name, detach=True)

        return JsonResponse({
            "status": "success",
            "message": f"Container reset successfully.",
            "new_id": new_container.short_id
        }, status=201)
    except docker.errors.NotFound:
        return JsonResponse({"error": "Container not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)