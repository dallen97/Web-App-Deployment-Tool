import json
import docker
from docker.errors import DockerException, NotFound, ImageNotFound, APIError
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Container

MAX_CONTAINERS = 4
CONTAINER_MEM_LIMIT = "512M"
CONTAINER_CPU_PERIOD = 100000
CONTAINER_CPU_QUOTA = 50000

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
            return JsonResponse({'error': 'Username unavailable'}, status=409)
        
        user = User.objects.create_user(username=username, password=password)

        return JsonResponse({'status': 'Success', 'message': 'User created successfully', 'user_id': user.id}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["Post"])
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
    
    user_id_str = str(request.user.id)
    try:
        user_containers = client.containers.list(all=True, filters={"label": f"wadt.user_id={user_id_str}"})
        container_data = []
        for c in user_containers:
            image_tag = c.image.tags[0] if c.image.tags else 'unknown'
            container_data.append({
                "id": c.short_id,
                "name": c.name,
                "image": image_tag,
                "status": c.status,
            })
        return JsonResponse(container_data, safe=False)
    except APIError:
         return JsonResponse({"error": "Failed to fetch containers"}, status=500)

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
        
        existing_containers = client.containers.list(all=True, filters={"label": f"wadt.user_id={user_id_str}"})
        if len(existing_containers) >= MAX_CONTAINERS:
             return JsonResponse({"error": f"Quota exceeded. Max {MAX_CONTAINERS} containers allowed."}, status=429)

        client.images.pull(image_name)
        new_container = client.containers.run(
            image_name, 
            detach=True, 
            labels={"wadt.user_id": user_id_str},
            mem_limit=CONTAINER_MEM_LIMIT,
            cpu_period=CONTAINER_CPU_PERIOD,
            cpu_quota=CONTAINER_CPU_QUOTA
        )
        
        return JsonResponse({
            "status": "success",
            "message": f"Container {new_container.name} started for user {user_id}",
            "id": new_container.short_id
        }, status=201)
    except APIError as e:
        return JsonResponse({"error": "Docker API Error: " + str(e)}, status=500)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def _get_user_container(user, container_id):
    """Helper to safely retrieve a container owned by the user"""
    try:
        container = client.containers.get(container_id)
        # Verify ownership
        if container.labels.get("wadt.user_id") != str(user.id):
            return None, JsonResponse({"error": "Unauthorized"}, status=403)
        return container, None
    except NotFound:
        return None, JsonResponse({"error": "Container not found"}, status=404)

@require_http_methods(["POST"])
@login_required
def stop_container(request, container_id):
    container, error_response = _get_user_container(request.user, container_id)
    if error_response: 
        return error_response

    try:
        container.stop()
        return JsonResponse({"status": "success", "message": f"Container {container_id} stopped."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@require_http_methods(["POST"])
@login_required
def restart_container(request, container_id):
    #used if somebody needs to refresh container to apply changes
    container, error_response = _get_user_container(request.user, container_id)
    if error_response: 
        return error_response

    try:
        container.restart()
        return JsonResponse({"status": "success", "message": f"Container {container_id} restarted."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
@login_required
def reset_container(request, container_id):
    #used if docker container breaks
    container, error_response = _get_user_container(request.user, container_id)
    if error_response: 
        return error_response

    try:
        if not container.image.tags:
             return JsonResponse({"error": "Cannot reset, original image tag not indentified"}, status=400)
        
        image_name = container.image.tags[0]
        user_id_str = str(request.user.id)

        container.stop()
        container.remove()

        # Re-apply resource limits on reset
        new_container = client.containers.run(
            image_name, 
            detach=True, 
            labels={"wadt.user_id": user_id_str},
            mem_limit=CONTAINER_MEM_LIMIT,
            cpu_period=CONTAINER_CPU_PERIOD,
            cpu_quota=CONTAINER_CPU_QUOTA
        )

        return JsonResponse({
            "status": "success",
            "message": f"Container reset successfully.",
            "new_id": new_container.short_id
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)