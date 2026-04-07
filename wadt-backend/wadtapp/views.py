import json
import urllib.request
import urllib.error
import socket
import docker 
import time
import uuid
import os
import yaml
from python_on_whales import DockerClient
from docker.errors import DockerException, NotFound, ImageNotFound, APIError 
from django.middleware.csrf import get_token 
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse 
from django.contrib.auth.models import User 
from django.contrib.auth import authenticate, login, logout 
from django.views.decorators.http import require_http_methods 
from django.contrib.auth.decorators import login_required 
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie # REMOVE THIS LATER
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.core.paginator import Paginator
from datetime import timedelta
from decouple import config
from .models import Container, Organization, UserProfile, ActionLog
from .catalog import APP_CATALOG

# Where the YAML files are stored
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
YAML_DIR = os.path.join(CURRENT_DIR, "tmp")

# Ensure the directory exists when Django starts
if not os.path.exists(YAML_DIR):
    os.makedirs(YAML_DIR)

# Seconds to wait when checking if container HTTP service is up
CONTAINER_READINESS_TIMEOUT = 2

# Base URL to reach Traefik's HTTP entrypoint (no DNS required)
TRAEFIK_URL = config("TRAEFIK_URL", default="http://127.0.0.1")

MAX_CONTAINERS = 10
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
@csrf_exempt
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
# HACK: Modified this file to respond with role info.
def current_user(request):
    profile = getattr(request.user, 'profile', None)
    org_info = None
    if profile and profile.organization:
        org_info = {
            "name": profile.organization.name,
            "code": profile.organization.org_code
        }

    return JsonResponse({
        "username": request.user.username,
        "role": profile.role if profile else "STUDENT",
        "organization": org_info
    }) 

@require_http_methods(["GET"])
@login_required
def get_containers(request):
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    container_data = []
    max_runtime = timedelta(hours=24)
    max_runtime_seconds = int(max_runtime.total_seconds())

    try:
        # Loop through the Compose Projects the DB thinks are running
        db_containers = Container.objects.filter(user=request.user, status="RUN")
        
        for db_c in db_containers:
            project_name = db_c.docker_container_id
            
            # Compose names the primary service container: <project_name>-web-1
            web_container_name = f"{project_name}-web-1"
            
            try:
                c = client.containers.get(web_container_name)
            except docker.errors.NotFound:
                continue # Skip if the container died but the DB still says RUN
            
            image_tag = c.image.tags[0] if c.image.tags else 'unknown'
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

            # Construct the readable URL directly from the project name
            app_domain = config("APP_DOMAIN", default="localhost")
            protocol = "http" if app_domain == "localhost" else "https"

            # 2. State Machine Logic
            is_ready = True
            if db_c.status == "STARTING":
                # Quick probe to see if it finished starting while we weren't looking
                if _probe_traefik_host(f"{project_name}.{app_domain}") and _probe_traefik_host(f"terminal.{project_name}.{app_domain}"):
                    db_c.status = "RUN"
                    db_c.save()
                else:
                    is_ready = False

            # 3. Withhold URLs if not ready
            if is_ready:
                external_url = f"{protocol}://{project_name}.{app_domain}"
                terminal_url = f"{protocol}://terminal.{project_name}.{app_domain}"
                frontend_status = "running"
            else:
                external_url = None
                terminal_url = None
                frontend_status = "starting"

            container_data.append({
                "id": project_name,
                "name": db_c.name,
                "image": image_tag,
                "status": frontend_status, # Let React know it's starting
                "external_url": external_url,
                "terminal_url": terminal_url,
                "started_at": started_at_iso,
                "max_runtime_seconds": max_runtime_seconds,
                "uptime": uptime_str,
                "time_left": time_left_str
            })
            
        return JsonResponse(container_data, safe=False)
    except Exception as e:
        print(f"Error in get_containers: {e}")
        return JsonResponse({"error": "Failed to fetch containers"}, status=500)
    finally:
        client.close()

@require_http_methods(["POST"])
@login_required
def start_container(request):
    try:
        body = json.loads(request.body)
        
        # We now look up the app using the key from catalog.py (e.g., "pygoat")
        app_key = body.get('app_key') 

        if app_key not in APP_CATALOG:
            return JsonResponse({"error": "Unauthorized or unknown application requested."}, status=403)

        app_name = body.get('name', app_key) # Custom name from user, defaults to app_key
        user_id_str = str(request.user.id)
        app_info = APP_CATALOG[app_key]

        # 1. Database & Quota Check
        db_container, created = Container.objects.get_or_create(
            user=request.user,
            name=app_name,
            defaults={
                'description': f"Sandbox for {app_key}",
                'status': "CREAT",
                'docker_container_id': "" # This now stores the Compose Project Name
            }
        )

        other_containers_count = Container.objects.filter(user=request.user).exclude(name=app_name).count()
        if other_containers_count >= MAX_CONTAINERS:
             return JsonResponse({"error": "Quota exceeded."}, status=429)

        # 2. Generate Project Details
        # If it already has a project name, reuse it; otherwise, generate a new one
        existing_id = db_container.docker_container_id
        
        if existing_id and existing_id.startswith(f"wadt-user{request.user.id}-{app_key}"):
            project_name = existing_id
        else:
            unique_id = str(uuid.uuid4())[:6]
            project_name = f"wadt-user{request.user.id}-{app_key}-{unique_id}"
            db_container.docker_container_id = project_name

        file_path = os.path.join(YAML_DIR, f"{project_name}.yml")
        network_name = f"{project_name}_default"
        app_domain = config("APP_DOMAIN", default="localhost")

        # 3. Build the YAML Dictionary
        compose_dict = {"services": {}}
        
        # Build the vulnerable web app service
        app_port = app_info.get("port", "80")
        router_rule = f"Host(`{project_name}.{app_domain}`)"
        
        compose_dict["services"]["web"] = {
            "image": app_info["image"],
            "networks": ["default"],
            "labels": {
                "traefik.enable": "true",
                f"traefik.http.routers.{project_name}.rule": router_rule,
                f"traefik.http.routers.{project_name}.entrypoints": "web",
                f"traefik.http.services.{project_name}.loadbalancer.server.port": str(app_port),
                "traefik.docker.network": network_name,
                "wadt.user_id": user_id_str # Keep tracking the user
            }
        }

        # Add optional fields if they exist in the catalog
        if "environment" in app_info: compose_dict["services"]["web"]["environment"] = app_info["environment"]
        if "cap_add" in app_info: compose_dict["services"]["web"]["cap_add"] = app_info["cap_add"]

        # Build the Attacker Terminal service
        terminal_info = APP_CATALOG["attacker-terminal"]
        compose_dict["services"]["attacker"] = {
            "image": terminal_info["image"],
            "command": terminal_info["command"],
            "networks": ["default"],
            "labels": {
                "traefik.enable": "true",
                f"traefik.http.routers.{project_name}-terminal.rule": f"Host(`terminal.{project_name}.{app_domain}`)",
                f"traefik.http.routers.{project_name}-terminal.entrypoints": "web",
                f"traefik.http.services.{project_name}-terminal.loadbalancer.server.port": terminal_info["port"],
                "traefik.docker.network": network_name
            }
        }

        # 4. Save YAML to Disk
        with open(file_path, 'w') as f:
            yaml.dump(compose_dict, f)

        # 5. Execute Docker Compose
        custom_docker = DockerClient(compose_files=[file_path], compose_project_name=project_name)
        custom_docker.compose.up(detach=True)

        # 6. Bridge Traefik to the new isolated network
        os.system(f"docker network connect {network_name} web-app-deployment-tool-traefik-1 > /dev/null 2>&1")

        # 7. Update Database
        db_container.status = "STARTING"
        db_container.save()
        log_user_action(request.user, f"Deployed composed project '{db_container.name}'", db_container)

        return JsonResponse({"status": "success", "id": project_name}, status=201)
        
    except Exception as e:
        print(f"Deployment Error: {str(e)}")
        return JsonResponse({"error": "Failed to deploy application stack."}, status=500)

def _get_user_container(client, user, container_id):
    try:
        container = client.containers.get(container_id)
        
        if container.labels.get("wadt.user_id") != str(user.id):
            return None, JsonResponse({"error": "Unauthorized"}, status=403)
        return container, None
    except NotFound:
        return None, JsonResponse({"error": "Container not found"}, status=404)

def _get_user_container(client, user, container_id):
    try:
        container = client.containers.get(container_id)
        
        if container.labels.get("wadt.user_id") != str(user.id):
            return None, JsonResponse({"error": "Unauthorized"}, status=403)
        return container, None
    except NotFound:
        return None, JsonResponse({"error": "Container not found"}, status=404)

def _get_user_container(client, user, container_id):
    try:
        container = client.containers.get(container_id)
        
        if container.labels.get("wadt.user_id") != str(user.id):
            return None, JsonResponse({"error": "Unauthorized"}, status=403)
        return container, None
    except NotFound:
        return None, JsonResponse({"error": "Container not found"}, status=404)

def _get_user_container(client, user, container_id):
    try:
        container = client.containers.get(container_id)
        
        user_profile = getattr(user, 'profile', None)
        user_role = user_profile.role if user_profile else 'STUDENT'

        if user_role not in ['ADMIN', 'SUPER']:
            if container.labels.get("wadt.user_id") != str(user.id):
                return None, JsonResponse({"error": "Unauthorized"}, status=403)

        return container, None
    except NotFound:
        return None, JsonResponse({"error": "Container not found"}, status=404)

@require_http_methods(["POST"])
@login_required
def stop_container(request, container_id):
    # container_id is now our Compose Project Name (e.g., wadt-user2-grafana-69ba3a)
    try:
        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
    except Container.DoesNotExist:
        return JsonResponse({"error": "Container not found or unauthorized"}, status=404)

    project_name = db_container.docker_container_id
    file_path = os.path.join(YAML_DIR, f"{project_name}.yml")
    network_name = f"{project_name}_default"

    try:
        # 1. Evict Traefik (silent fail if already gone)
        os.system(f"docker network disconnect {network_name} web-app-deployment-tool-traefik-1 > /dev/null 2>&1")

        # 2. Docker Compose Down
        if os.path.exists(file_path):
            custom_docker = DockerClient(compose_files=[file_path], compose_project_name=project_name)
            # 'v' removes volumes, 'orphans' cleans up the attacker terminal
            custom_docker.compose.down(volumes=True, remove_orphans=True)
            os.remove(file_path) # Clean up the tmp YAML file

        # 3. Update DB
        db_container.status = "STOP"
        db_container.save()
        log_user_action(request.user, f"Stopped and removed composed project '{db_container.name}'", db_container)

        return JsonResponse({"status": "success", "message": f"Project {project_name} stopped."})
    except Exception as e:
        print(f"Error in stop_container: {str(e)}")
        return JsonResponse({"error": "An internal error occurred while stopping."}, status=500)
    
@require_http_methods(["POST"])
@login_required
def restart_container(request, container_id):
    try:
        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
    except Container.DoesNotExist:
        return JsonResponse({"error": "Container not found or unauthorized"}, status=404)

    project_name = db_container.docker_container_id
    file_path = os.path.join(YAML_DIR, f"{project_name}.yml")

    try:
        if os.path.exists(file_path):
            custom_docker = DockerClient(compose_files=[file_path], compose_project_name=project_name)
            custom_docker.compose.restart()
        else:
            return JsonResponse({"error": "YAML configuration missing. Cannot restart."}, status=404)

        db_container.status = "STARTING"
        db_container.save()
        log_user_action(request.user, f"Restarted composed project '{db_container.name}'", db_container)

        return JsonResponse({"status": "success", "message": f"Project {project_name} restarted."})
    except Exception as e:
        print(f"Error in restart_container: {str(e)}")
        return JsonResponse({"error": "An internal error occurred while restarting."}, status=500)

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
@csrf_exempt
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

'''
# Add to views.py or create a utils.py file
def check_user_role(request, allowed_roles):
    """Check if user has one of the allowed roles.
    
    Args:
        request: Django request object
        allowed_roles: List of allowed role strings ['ADMIN', 'SUPER']
    
    Returns:
        tuple: (is_authorized, user_role)
    """
    user_role = getattr(request.user.profile, 'role', 'STUDENT')
    is_authorized = user_role in allowed_roles
    return is_authorized, user_role

# Usage example:
is_authorized, user_role = check_user_role(request, ['ADMIN', 'SUPER'])
if not is_authorized:
    return JsonResponse({"error": "Unauthorized access."}, status=403)
'''


@require_http_methods(["GET"])
@login_required
def get_pending_teachers(request):
    # HACK: REPLACE THIS WITH PROPER ROLE CHECKING
    user_role = getattr(request.user.profile, 'role', 'STUDENT')
    if user_role not in ['SUPER', 'ADMIN',]:  # Allow ADMIN for testing
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

# HACK: Set target_user_id = 2 for testing, undo this when done
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
    if user_role not in ['ADMIN', 'SUPER', 'STUDENT']: # HACK: Allowing STUDENTS TO AS WELL FOR TESTING
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
    # container_id is now the Compose Project Name
    container_record = get_object_or_404(Container, docker_container_id=container_id)
    
    # ... (Keep all your existing authorization checks here) ...
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

    # 1. Fetch System/Action Logs
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
            # 2. Fetch Web App Logs
            try:
                web_container = client.containers.get(f"{container_id}-web-1")
                raw_logs = web_container.logs(stdout=True, stderr=True, timestamps=True, tail=100)
                
                noise_filters = ["Starting nginx", "waiting for connections", "DEBUG:", "npm notice"]
                for line in raw_logs.decode('utf-8').split('\n'):
                    if not line.strip() or any(noise in line for noise in noise_filters): continue
                    parts = line.split(' ', 1)
                    if len(parts) == 2:
                        unified_logs.append({"timestamp": parts[0], "source": "APP", "message": parts[1]})
            except docker.errors.NotFound:
                pass # Container might be dead, that's fine

            # 3. Fetch Terminal Logs
            try:
                term_container = client.containers.get(f"{container_id}-attacker-1")
                raw_logs = term_container.logs(stdout=True, stderr=True, timestamps=True, tail=50)
                
                for line in raw_logs.decode('utf-8').split('\n'):
                    if not line.strip() or "ttyd" in line: continue # Filter out ttyd noise
                    parts = line.split(' ', 1)
                    if len(parts) == 2:
                        unified_logs.append({"timestamp": parts[0], "source": "TERMINAL", "message": parts[1]})
            except docker.errors.NotFound:
                pass

        except Exception as e:
            print(f"Docker log error: {e}")
        finally:
            client.close()

    # Sort everything by timestamp so it flows perfectly chronologically
    unified_logs.sort(key=lambda x: x['timestamp'])

    return JsonResponse({"status": "success", "logs": unified_logs})

@require_http_methods(["GET"])
@login_required
@csrf_exempt
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
    try:
        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
    except Container.DoesNotExist:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    app_domain = config("APP_DOMAIN", default="localhost")
    hostname = f"{container_id}.{app_domain}"
    terminal_hostname = f"terminal.{hostname}" # Define the terminal hostname

    # 1. The Traefik Probes
    # Check BOTH the main app and the terminal
    app_is_ready = _probe_traefik_host(hostname)
    terminal_is_ready = _probe_traefik_host(terminal_hostname)

    # If EITHER of them is still throwing a 502 Bad Gateway, keep spinning!
    if not (app_is_ready and terminal_is_ready):
        return JsonResponse({"ready": False})

    # 2. Determine the specific landing page for the "Open App" button
    app_path = "/"
    for key, info in APP_CATALOG.items():
        if f"-{key}-" in container_id:
            app_path = info.get("path", "/")
            break

    # 3. Construct the final exact URLs
    protocol = "http" if app_domain == "localhost" else "https"
    final_url = f"{protocol}://{hostname}{app_path}"
    terminal_url = f"{protocol}://{terminal_hostname}" 

    db_container.status = "RUN"
    db_container.save()

    return JsonResponse({
        "ready": True,
        "url": final_url,
        "terminal_url": terminal_url
    })

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

