import json
import urllib.request
import urllib.error
import socket
import docker 
import time
import uuid
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
from django.core.paginator import Paginator
from datetime import timedelta
from decouple import config
from .models import Container, Organization, UserProfile, ActionLog

# Seconds to wait when checking if container HTTP service is up
CONTAINER_READINESS_TIMEOUT = 2

# Base URL to reach Traefik's HTTP entrypoint (no DNS required)
TRAEFIK_URL = config("TRAEFIK_URL", default="http://127.0.0.1")

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

def get_secure_container_config(user_id_str, container_name):
    app_domain = config("APP_DOMAIN", default="localhost")
    return {
        "detach": True, 
        "labels": {
            "wadt.user_id": user_id_str,
            "traefik.enable": "true",
            f"traefik.http.routers.{container_name}.rule": f"Host(`{container_name}.{app_domain}`)",
        },
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


def _probe_traefik_host(hostname: str) -> bool:
    """
    Try to GET the container app via Traefik, without relying on DNS.
    Sends a request to TRAEFIK_URL with Host header set to the
    container's hostname (e.g. wadt-user2-xxxx.localhost).
    Returns True when Traefik can reach the app (2xx–4xx),
    False on connection issues or 5xx errors.
    """
    if not hostname:
        return False
    try:
        req = urllib.request.Request(
            TRAEFIK_URL,
            method="GET",
            headers={"Host": hostname},
        )
        resp = urllib.request.urlopen(req, timeout=CONTAINER_READINESS_TIMEOUT)
        status = resp.getcode()
        return 200 <= status < 500
    except urllib.error.HTTPError as e:
        # Treat any non-5xx HTTP error as "reachable" (app is up but maybe unauthorized/404)
        return 200 <= e.code < 500
    except (urllib.error.URLError, socket.timeout, OSError):
        return False

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
        log_user_action(user, "Created a new account")

        return JsonResponse({'status': 'Success', 'message': 'User created successfully', 'user_id': user.id}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["POST"])
#@ensure_csrf_cookie
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
            log_user_action(user, "Logged in")
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
        max_runtime_seconds = int(max_runtime.total_seconds())
        for c in user_containers:
            image_tag = c.image.tags[0] if c.image.tags else 'unknown'
            db_container = Container.objects.filter(docker_container_id=c.short_id, user=request.user).first()
            custom_name = db_container.name if db_container else c.name
            uptime_str = None
            time_left_str = None
            started_at_iso = None
            if c.status == 'running':
                started_at_str = c.attrs['State']['StartedAt']
                started_at = parse_datetime(started_at_str)
                if started_at:
                    started_at_iso = started_at.isoformat()
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
                "started_at": started_at_iso,
                "max_runtime_seconds": max_runtime_seconds,
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

        if image_name not in ALLOWED_VULN_IMAGES:
            return JsonResponse({"error": "Unauthorized image requested."}, status=403)

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
        unique_id = str(uuid.uuid4())[:6] #generates the url-safe container name
        explicit_name = f"wadt-user{request.user.id}-{unique_id}"
        config = get_secure_container_config(user_id_str, explicit_name)
        new_container = client.containers.run(image_name, name=explicit_name, **config)
 
        db_container.docker_container_id = new_container.short_id
        db_container.status = "RUN"
        db_container.save()
        log_user_action(request.user, f"Started container '{db_container.name}'", db_container)

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

        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
        db_container.status = "STOP"
        db_container.save()
        log_user_action(request.user, f"Stopped container '{db_container.name}'", db_container)

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

        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
        db_container.status = "RUN"
        db_container.save()

        log_user_action(request.user, f"Refreshed container '{db_container.name}'", db_container)

        return JsonResponse({"status": "success", "message": f"Container {container_id} restarted."})
    except Exception as e:
        print(f"Error in restart_container: {str(e)}")
        return JsonResponse({"error": "An internal error occured."}, status=500)
    finally:
        client.close()

@require_http_methods(["POST"])
@login_required
def reset_container(request, container_id):
    client = docker.from_env()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    try:
        old_container, error_response = _get_user_container(client, request.user, container_id)
        if error_response:
            return error_response

        container_name = old_container.name
        image_name = old_container.image.tags[0] # FIX 2: Added the 's' to tags
        labels = old_container.labels

        old_container.stop(timeout=5)
        old_container.remove(force=True)

        time.sleep(2)

        new_container = client.containers.run(
            image_name,
            name=container_name,
            labels=labels,
            detach=True,
            network='wadt_sandbox_network'
        )

        db_record = Container.objects.get(docker_container_id=container_id, user=request.user)
        db_record.docker_container_id = new_container.short_id
        db_record.status = "RUN"
        db_record.save()

        log_user_action(request.user, f"Reset container '{db_record.name}'", db_record)

        return JsonResponse({
            'status': 'success', 
            'message': 'Container reset successfully.',
            'new_id': new_container.short_id
        })
        
    except docker.errors.NotFound:
        return JsonResponse({'error': 'Original container not found in Docker.'}, status=404)
    except Exception as e:
        print(f"Error in reset_container: {str(e)}")
        return JsonResponse({'error': "An internal error occurred."}, status=500)
    finally:
        client.close()

@require_http_methods(["POST"])
@login_required
def request_teacher_status(request):
    profile = request.user.profile
    if profile.role in ['ADMIN', 'SUPER']:
        return JsonResponse({"error": "You already have elevated privileges."}, status=400)
    
    if profile.is_pending_teacher:
        return JsonResponse({"message": "Your request is already pending review."}, status=200)

    profile.is_pending_teacher = True
    profile.save()
    log_user_action(request.user, "Requested Teacher/Admin privileges")
    return JsonResponse({
        "status": "success",
        "message": "Teacher status requested. Awaiting approval."
    })

@require_http_methods(["GET"])
@login_required
def get_pending_teachers(request):
    if getattr(request.user.profile, 'role', 'STUDENT') != 'SUPER':
        return JsonResponse({"error": "Unauthorized access."}, status=403)

    pending_profiles = UserProfile.objects.filter(is_pending_teacher=True).select_related('user')
    
    data = [{
        "user_id": p.user.id,
        "username": p.user.username,
        "date_joined": p.user.date_joined.strftime("%Y-%m-%d")
    } for p in pending_profiles]

    return JsonResponse({"pending_requests": data})

@require_http_methods(["POST"])
@login_required
def approve_teacher(request, target_user_id):
    if getattr(request.user.profile, 'role', 'STUDENT') != 'SUPER':
        return JsonResponse({"error": "Unauthorized access."}, status=403)

    try:
        target_user = User.objects.get(id=target_user_id)
        target_profile = target_user.profile

        if not target_profile.is_pending_teacher:
            return JsonResponse({"error": "This user does not have a pending request."}, status=400)
        
        target_profile.role = 'ADMIN'
        target_profile.is_pending_teacher = False
        target_profile.save()
        log_user_action(request.user, f"Approved Teacher privileges for user '{target_user.username}'")

        return JsonResponse({
            "status": "success", 
            "message": f"User {target_user.username} is now an Admin/Teacher."
        })

    except User.DoesNotExist:
        return JsonResponse({"error": "Target user not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
@login_required
def create_organization(request):
    user_role = getattr(request.user.profile, 'role', 'STUDENT')
    if user_role not in ['ADMIN', 'SUPER']:
        return JsonResponse({
            "error": "Unauthorized. Only approved Teachers and Admins can create organizations."
        }, status=403)

    try:
        data = json.loads(request.body)
        org_name = data.get('name', '').strip()

        if not org_name:
            return JsonResponse({"error": "Organization name is required."}, status=400)

        new_org = Organization.objects.create(name=org_name)

        profile = request.user.profile
        profile.organization = new_org
        profile.save()
        log_user_action(request.user, f"Created organization '{new_org.name}'")
        Container.objects.filter(user=request.user).update(organization=new_org)

        return JsonResponse({
            "status": "success",
            "message": f"Organization '{new_org.name}' created successfully.",
            "org_code": new_org.org_code,
            "organization_name": new_org.name
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format."}, status=400)
    except Exception as e:
        print(f"Error in create_organization: {str(e)}")
        return JsonResponse({"error": "An internal server error occurred."}, status=500)

@require_http_methods(["POST"])
@login_required
def join_organization(request):
    try:
        data = json.loads(request.body)
        org_code = data.get('org_code', '').strip().upper()

        if not org_code:
            return JsonResponse({"error": "Organization code is required."}, status=400)

        try:
            organization = Organization.objects.get(org_code=org_code)
        except Organization.DoesNotExist:
            return JsonResponse({"error": "Invalid organization code. Please check with your teacher."}, status=404)

        profile = request.user.profile
        profile.organization = organization
        profile.save()

        Container.objects.filter(user=request.user).update(organization=organization)
        log_user_action(request.user, f"Joined organization '{organization.name}'")
        return JsonResponse({
            "status": "success", 
            "message": f"Successfully joined {organization.name}.",
            "organization_name": organization.name
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON format."}, status=400)
    except Exception as e:
        print(f"Error in join_organization: {str(e)}")
        return JsonResponse({"error": "An internal server error occurred."}, status=500)

@require_http_methods(["POST"])
@login_required
def leave_organization(request):
    try:
        profile = request.user.profile

        if not profile.organization:
            return JsonResponse({"error": "You are not currently in an organization."}, status=400)
        
        org_name = profile.organization
        profile.organization = None
        profile.save()

        Container.objects.filter(user=request.user).update(organization=None)
        log_user_action(request.user, f"Left organization '{org_name}'")
        return JsonResponse({
            "status": "success",
            "message": f"Successfully left {org_name}."
        })

    except Exception as e:
        print(f"Error in leave_organization: {str(e)}")
        return JsonResponse({"error": "An internal server error occurred."}, status=500)

@require_http_methods(["GET"])
@login_required
def get_container_logs(request, container_id):
    container_record = get_object_or_404(Container, docker_container_id=container_id)
    user_profile = getattr(request.user, 'profile', None)
    user_role = user_profile.role if user_profile else 'STUDENT'

    is_authorized = False
    if user_role == 'SUPER':
        is_authorized = True 
    elif user_role == 'ADMIN' and user_profile.organization and container_record.organization == user_profile.organization:
        is_authorized = True
    elif container_record.user == request.user:
        is_authorized = True
            
    if not is_authorized:
        return JsonResponse({"error": "Unauthorized."}, status=403)

    unified_logs = []

    action_logs = ActionLog.objects.filter(container=container_record).order_by('-timestamp')[:50]
    for alog in action_logs:
        unified_logs.append({
            "timestamp": alog.timestamp.isoformat(), 
            "source": "SYSTEM",
            "message": f"User '{alog.user.username}' {alog.action}"
        })

    client = get_docker_client()
    if client:
        try:
            docker_container = client.containers.get(container_id)
            raw_logs = docker_container.logs(stdout=True, stderr=True, timestamps=True, tail=100)
            log_lines = raw_logs.decode('utf-8').split('\n')

            noise_filters = ["Starting nginx", "waiting for connections", "DEBUG:", "npm notice"]

            for line in log_lines:
                if not line.strip(): continue
                if any(noise in line for noise in noise_filters): continue

                parts = line.split(' ', 1)
                if len(parts) == 2:
                    unified_logs.append({
                        "timestamp": parts[0], 
                        "source": "CONTAINER",
                        "message": parts[1]    
                    })
        except Exception as e:
            print(f"Docker log error: {e}")
        finally:
            client.close()

    unified_logs.sort(key=lambda x: x['timestamp'])

    return JsonResponse({"status": "success", "logs": unified_logs})

@require_http_methods(["GET"])
@login_required
def get_all_containers_admin(request):
    user_profile = getattr(request.user, 'profile', None)
    if not user_profile:
        return JsonResponse({"error": "Profile not found."}, status=400)

    user_role = user_profile.role

    if user_role not in ['SUPER', 'ADMIN']:
        return JsonResponse({"error": "Unauthorized access."}, status=403)

    try:
        page_number = request.GET.get('page', 1)
        users_with_containers = User.objects.filter(container__isnull=False).distinct()

        if user_role == 'ADMIN':
            admin_org = user_profile.organization
            if not admin_org:
                users_with_containers = User.objects.none()
            else:
                users_with_containers = users_with_containers.filter(profile__organization=admin_org)

        users_with_containers = users_with_containers.order_by('username')
        paginator = Paginator(users_with_containers, 10)
        page_obj = paginator.get_page(page_number)
        users_on_page = page_obj.object_list

        if user_role == 'ADMIN':
            containers = Container.objects.filter(
                user__in=users_on_page, 
                organization=admin_org
            ).select_related('user')
        else:
            containers = Container.objects.filter(user__in=users_on_page).select_related('user')

        organized_data = {user.username: [] for user in users_on_page}
        for container in containers:
            organized_data[container.user.username].append({
                "container_id": container.docker_container_id,
                "name": container.name,
                "status": container.status,
                "created_at": container.created_at.isoformat() if hasattr(container, 'created_at') else None,
            })

        response_data = [
            {"username": user, "containers": c_list} 
            for user, c_list in organized_data.items()
        ]

        return JsonResponse({
            "data": response_data,
            "organization_scope": admin_org.name if user_role == 'ADMIN' and admin_org else "Global (Super-Admin)",
            "pagination": {
                "current_page": page_obj.number,
                "total_pages": paginator.num_pages,
                "total_users": paginator.count,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous()
            }
        })

    except Exception as e:
        print(f"Error in get_all_containers_admin: {str(e)}")
        return JsonResponse({"error": "An internal server error occurred."}, status=500)

@require_http_methods(["POST"])
@login_required
def check_container_ready(request, container_id):
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    try:
        docker_container, error_response = _get_user_container(client, request.user, container_id)
        if error_response:
            return error_response

        if docker_container.status != "running":
            return JsonResponse({"ready": False})

        app_domain = config("APP_DOMAIN", default="localhost")
        protocol = "http" if app_domain == "localhost" else "https"
        hostname = f"{docker_container.name}.{app_domain}"
        subdomain_url = f"{protocol}://{hostname}"

        # Backend readiness: only mark ready when Traefik can reach this host
        is_ready = _probe_traefik_host(hostname)

        return JsonResponse({
            "ready": is_ready,
            "url": subdomain_url if is_ready else None
        })
            
    finally:
        client.close()

def log_user_action(user, action_message, container=None):
    try:
        ActionLog.objects.create(
            user=user, 
            action=action_message, 
            container=container
        )
    except Exception as e:
        print(f"Failed to write audit log: {e}")

@require_http_methods(["GET"])
@ensure_csrf_cookie
def get_csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})