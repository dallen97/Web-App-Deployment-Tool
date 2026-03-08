import json
import docker 
from docker.errors import DockerException, NotFound, ImageNotFound, APIError 
from django.middleware.csrf import get_token 
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse 
from django.contrib.auth.models import User 
from django.contrib.auth import authenticate, login, logout 
from django.views.decorators.http import require_http_methods 
from django.contrib.auth.decorators import login_required 
from django.views.decorators.csrf import ensure_csrf_cookie 
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta

from .models import Container

MAX_CONTAINERS = 4
CONTAINER_MEM_LIMIT = "512m"
CONTAINER_CPU_PERIOD = 100000
CONTAINER_CPU_QUOTA = 50000

ALLOWED_VULN_IMAGES = [
    "pygoat/pygoat",
    "bkimminich/juice-shop",
    "grafana/grafana:8.3.0",
    "vulnerables/web-dvwa"
]

def get_secure_container_config(user_id_str):
    return {
        "detach": True, 
        "publish_all_ports": True, #local dev, need to implement reverse proxy
        "labels": {"wadt.user_id": user_id_str},
        "mem_limit": CONTAINER_MEM_LIMIT,
        "memswap_limit": CONTAINER_MEM_LIMIT,
        "cpu_period": CONTAINER_CPU_PERIOD,
        "cpu_quota": CONTAINER_CPU_QUOTA,
        "cap_drop": ["ALL"],
        "security_opt": ["no-new-privileges:true"],
        "network": "wadt_sandbox_network"
    }

#initialize docker client
def get_docker_client():
    try:
        client = docker.from_env()
        client.ping()
        return client
    except Exception:
        return None

def get_container_url(request, container):
    try:
        container.reload()
        ports = container.attrs['NetworkSettings']['Ports']
        if ports:
            for port_key in ports:
                if ports[port_key]:
                    host_port = ports[port_key][0]['HostPort']
                    server_host = request.get_host().split(':')[0]
                    protocol = "https" if request.is_secure() else "http"

                    return f"{protocol}://{server_host}:{host_port}"
    except (KeyError, IndexError, AttributeError):
        pass
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


@login_required
def current_user(request):
    return JsonResponse({
        "username": request.user.username,
    }) 


@require_http_methods(["GET"])
@login_required
def get_containers(request):
    #now returns containers only relevant to the current user, will implement one for all containers later
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    user_id_str = str(request.user.id)

    try:
        user_containers = client.containers.list(all=True, filters={"label": f"wadt.user_id={user_id_str}", "status": "running"})
        container_data = []
        max_runtime = timedelta(hours=24)
        for c in user_containers:
            image_tag = c.image.tags[0] if c.image.tags else 'unknown'
            db_container = Container.objects.filter(docker_container_id=c.short_id, user=request.user).first()
            custom_name = db_container.name if db_container else c.name
            uptime_str = None
            time_left_str = None
            if c.status == 'running':
                started_at_str = c.attrs['State']['StartedAt']
                started_at = parse_datetime(started_at_str)
                if started_at:
                    uptime = timezone.now() - started_at
                    days = uptime.days
                    hours, remainder = divmod(uptime.seconds, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    uptime_str = f"{days}d {hours}h {minutes}m {seconds}s"
                    time_left = max_runtime - uptime
                    if time_left > timedelta(0):
                        days = time_left.days
                        hours, remainder = divmod(time_left.seconds, 3600)
                        minutes, seconds = divmod(remainder, 60)
                        time_left_str = f"{days}d {hours}h {minutes}m {seconds}s"
                    else:
                        time_left_str = "Expired"
            container_data.append({
                "id": c.short_id,
                "name": custom_name,
                "image": image_tag,
                "status": c.status,
                "external_url": get_container_url(request, c),
                "uptime": uptime_str,
                "time_left": time_left_str
            })
        return JsonResponse(container_data, safe=False)
    except APIError:
         return JsonResponse({"error": "Failed to fetch containers"}, status=500)
    finally:
        client.close()

@require_http_methods(["POST"])
@login_required
def start_container(request):
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)      
    try:
        body = json.loads(request.body)
        image_name = body.get('imageName')
        app_name = body.get('name')
        user_id_str = str(request.user.id)

        db_container, created = Container.objects.get_or_create(
            user=request.user,
            name=app_name,
            defaults={
                'description': f"Sandbox for {image_name}",
                'status': "CREAT",
                'docker_container_id': ""
            }
        )

        docker_container = None
        if db_container.docker_container_id:
            try:
                docker_container = client.containers.get(db_container.docker_container_id)
            except docker.errors.NotFound:
                docker_container = None

        if docker_container:
            if docker_container.status != "running":
                docker_container.restart()
            db_container.status = "RUN"
            db_container.save()
            return JsonResponse({"status": "success", "id": docker_container.short_id})

        other_containers_count = Container.objects.filter(user=request.user).exclude(name=app_name).count()
        if other_containers_count >= MAX_CONTAINERS:
             return JsonResponse({"error": "Quota exceeded."}, status=429)

        client.images.pull(image_name)
        config = get_secure_container_config(user_id_str)
        new_container = client.containers.run(image_name, **config)
 
        db_container.docker_container_id = new_container.short_id
        db_container.status = "RUN"
        db_container.save()
        
        return JsonResponse({"status": "success", "id": new_container.short_id}, status=201)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    finally:
        client.close()

def _get_user_container(client, user, container_id):
    try:
        container = client.containers.get(container_id)
        
        if container.labels.get("wadt.user_id") != str(user.id):
            return None, JsonResponse({"error": "Unauthorized"}, status=403)
        return container, None
    except NotFound:
        return None, JsonResponse({"error": "Container not found"}, status=404)

@require_http_methods(["POST"])
@login_required
def stop_container(request, container_id):
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    try:
        container, error_response = _get_user_container(client, request.user, container_id)
        if error_response: 
            return error_response

        container.stop()

        Container.objects.filter(docker_container_id = container_id, user = request.user).update(status="STOP")

        return JsonResponse({"status": "success", "message": f"Container {container_id} stopped."})
    except Exception as e:
        print(f"Error in stop_container: {str(e)}")
        return JsonResponse({"error": "An internal error occured."}, status=500)
    finally:
        client.close()
    
@require_http_methods(["POST"])
@login_required
def restart_container(request, container_id):
    #used if somebody needs to refresh container to apply changes
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    try:
        container, error_response = _get_user_container(client, request.user, container_id)
        if error_response: 
            return error_response

        container.restart()

        Container.objects.filter(docker_container_id=container_id, user=request.user).update(status="RUN")

        return JsonResponse({"status": "success", "message": f"Container {container_id} restarted."})
    except Exception as e:
        print(f"Error in restart_container: {str(e)}")
        return JsonResponse({"error": "An internal error occured."}, status=500)
    finally:
        client.close()

@require_http_methods(["POST"])
@login_required
def reset_container(request, container_id):
    #used if docker container breaks
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    try:
        container, error_response = _get_user_container(client, request.user, container_id)
        if error_response: 
            return error_response

        if not container.image.tags:
             return JsonResponse({"error": "Cannot reset, original image tag not indentified"}, status=400)
        
        image_name = container.image.tags[0]
        user_id_str = str(request.user.id)

        container.stop()
        container.remove()

        config = get_secure_container_config(user_id_str)
        new_container = client.containers.run(image_name, **config)

        Container.objects.filter(
            docker_container_id=container_id,
            user=request.user
        ).update(
            docker_container_id=new_container.short_id,
            name=new_container.name,
            status="RUN"
        )

        return JsonResponse({
            "status": "success",
            "message": f"Container reset successfully.",
            "new_id": new_container.short_id
        }, status=201)
    except Exception as e:
        print(f"Error in reset_container: {str(e)}")
        return JsonResponse({"error": "An internal error occurred."}, status=500)
    finally:
        client.close()

@require_http_methods(["POST"])
@login_required
def check_container_ready(request, container_id):
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)

    try:
        container, error_response = _get_user_container(client, request.user, container_id)
        if error_response: 
            return error_response

        container.reload()
        is_ready = container.status == "running"

        url = get_container_url(request, container) if is_ready else None

        return JsonResponse({
            "ready": is_ready,
            "status": container.status,
            "url": url
        })
        
    except Exception as e:
        print(f"Error in check_container_ready: {str(e)}")
        return JsonResponse({"error": "An internal error occurred."}, status=500)
    finally:
        client.close()

@require_http_methods(["GET"])
@ensure_csrf_cookie
def get_csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})