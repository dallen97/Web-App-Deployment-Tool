import json
import docker
import socket
import urllib.request
from urllib.error import URLError, HTTPError
from docker.errors import DockerException, NotFound, ImageNotFound, APIError
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse

from .models import Container

MAX_CONTAINERS = 4
CONTAINER_MEM_LIMIT = "512M"
CONTAINER_CPU_PERIOD = 100000
CONTAINER_CPU_QUOTA = 50000

#initialize docker client
def get_docker_client():
    try:
        # Check if docker is responsive
        client = docker.from_env()
        client.ping() 
        return client
    except (DockerException, APIError):
        return None

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
    client = get_docker_client()

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
def start_container(request):
    # check if user is logged in
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    
    client = get_docker_client()

    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)      
    try:
        user_id_str = str(request.user.id)
        
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
            publish_all_ports=True, 
            #labels={"wadt.user_id": user_id_str},
            mem_limit=CONTAINER_MEM_LIMIT,
            cpu_period=CONTAINER_CPU_PERIOD,
            cpu_quota=CONTAINER_CPU_QUOTA
        )

        new_container.reload()

        # 4. Define the 'ports' variable here
        ports_dict = new_container.attrs['NetworkSettings']['Ports']
        external_url = "No exposed ports"
        
        # 5. Find the first valid port mapping
        if ports_dict:
            for internal_port, bindings in ports_dict.items():
                if bindings:
                    # bindings is a list like [{'HostIp': '0.0.0.0', 'HostPort': '55001'}]
                    host_port = bindings[0]['HostPort']
                    external_url = f"http://localhost:{host_port}"
                    break # Stop after finding the first one
        
        return JsonResponse({
            "status": "success",
            "message": f"Container {new_container.name} started for user {user_id}",
            "id": new_container.short_id,
            "external_url": external_url
        }, status=201)
    except APIError as e:
        return JsonResponse({"error": "Docker API Error: " + str(e)}, status=500)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def _get_user_container(user, container_id):
    """Helper to safely retrieve a container owned by the user"""
    client = get_docker_client()
    
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
    client = get_docker_client()

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
    
@require_http_methods(["POST", "GET"]) 
def check_container_ready(request, container_id):     
    if not request.user.is_authenticated:
        print("\n!!! 401 DETECTED !!!")
        print(f"Container ID: {container_id}")
        
        # 1. Did we get ANY cookies?
        raw_cookie = request.META.get('HTTP_COOKIE', 'No Cookie Header Found')
        print(f"1. Raw Cookie Header: {raw_cookie}")
        
        # 2. Did Django parse a sessionid?
        session_key = request.COOKIES.get('sessionid')
        print(f"2. Parsed Session ID: {session_key}")
        
        # 3. Check if this session actually exists in the DB
        if session_key:
            from django.contrib.sessions.models import Session
            try:
                s = Session.objects.get(session_key=session_key)
                print(f"3. DB Check: Session FOUND. Expire date: {s.expire_date}")
                print(f"4. Session Data: {s.get_decoded()}")
            except Session.DoesNotExist:
                print("3. DB Check: Session NOT FOUND in database (It may have expired or been deleted)")
        else:
            print("3. DB Check: Skipped (No session key provided)")
            
        print("!!! END DEBUG !!!\n")
        
        return JsonResponse({"error": "Unauthorized"}, status=401)

    try:        
        client = get_docker_client()
        if not client:
            return JsonResponse({"error": "Docker service unavailable"}, status=503)

        # use the ID from the URL
        try:
            container = client.containers.get(container_id)
        except Exception:
            return JsonResponse({"ready": False, "error": "Container not found"}, status=404)
        
        # 1. check status
        if container.status != 'running':
            return JsonResponse({"ready": False, "status": container.status})

        # 2. check socket 
        ports_dict = container.attrs['NetworkSettings']['Ports']
        host_port = None
        
        if ports_dict:
            for internal_port, bindings in ports_dict.items():
                if bindings:
                    host_port = bindings[0]['HostPort']
                    break
        
        if not host_port:
             return JsonResponse({"ready": False, "reason": "No ports exposed"})

        # --- THE NEW HTTP CHECK ---
        target_url = f"http://localhost:{host_port}"
        
        try:
            # try to actually open the URL. 
            # timeout=1 ensures we don't hang if the app is slow.
            with urllib.request.urlopen(target_url, timeout=1) as response:
                # If we get here, we got a 200 OK (or similar success)
                return JsonResponse({"ready": True, "url": target_url})
                
        except HTTPError as e:
            # IMPORTANT: A 401 (Unauthorized) or 403 (Forbidden) means the APP IS RUNNING!
            # It just means we need to log in. So this counts as "Ready".
            # Only 500 errors might suggest we should wait longer, but usually 
            # any HTTP response means the server is up.
            return JsonResponse({"ready": True, "url": target_url})
            
        except URLError as e:
            # This catches "Connection Refused" or "Server Not Found"
            # This means the app is NOT ready yet.
            return JsonResponse({"ready": False, "reason": "App starting..."})
        except Exception as e:
            # Any other crash means not ready
            return JsonResponse({"ready": False, "reason": str(e)})

    except Exception as e:
        return JsonResponse({"ready": False, "error": str(e)})
    
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    This view does nothing but ensure the CSRF cookie is sent 
    to the browser.
    """
    return JsonResponse({'message': 'CSRF cookie set'})