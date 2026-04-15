import json
import urllib.request
import urllib.error
import socket
import docker 
import time
import uuid
import os
import threading
import yaml
import subprocess
import boto3
from django.conf import settings
from .catalog import APP_CATALOG
from python_on_whales import DockerClient
from docker.errors import DockerException, NotFound, ImageNotFound, APIError 
from django.middleware.csrf import get_token 
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse 
from django.contrib.auth.models import User 
from django.contrib.auth import authenticate, login, logout 
from django.views.decorators.http import require_http_methods 
from django.contrib.auth.decorators import login_required, user_passes_test
from django.views.decorators.csrf import ensure_csrf_cookie 
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.core.paginator import Paginator
from django.db import close_old_connections
from datetime import timedelta
from decouple import config
from .models import Container, Organization, UserProfile, ActionLog

cognito = boto3.client('cognito-idp', region_name=config('AWS_DEFAULT_REGION'))
CLIENT_ID = config('COGNITO_CLIENT_ID')
USER_POOL_ID = config('COGNITO_USER_POOL_ID')

YAML_DIR = os.path.join(settings.BASE_DIR, 'media', 'compose_files')
os.makedirs(YAML_DIR, exist_ok=True)

# Seconds to wait when checking if container HTTP service is up
CONTAINER_READINESS_TIMEOUT = 2

# Base URL to reach Traefik's HTTP entrypoint (no DNS required)
TRAEFIK_URL = config("TRAEFIK_URL", default="http://127.0.0.1")


def _lab_url_scheme() -> str:
    """Scheme for Traefik-routed lab URLs. Default http unless USE_TLS is explicitly truthy.

    Avoid config(..., cast=bool): some env sources make bool coercion surprising.
    """
    raw = str(config("USE_TLS", default="false")).strip().lower()
    use_tls = raw in ("1", "true", "yes", "on")
    return "https" if use_tls else "http"

MAX_CONTAINERS = 10
CONTAINER_MEM_LIMIT = "512m"
CONTAINER_CPU_PERIOD = 100000
CONTAINER_CPU_QUOTA = 50000

ALLOWED_VULN_IMAGES = [
    "pygoat/pygoat",
    "bkimminich/juice-shop",
    "grafana/grafana:8.3.0",
    "vulnerables/web-dvwa",
    "tiredful-api",
    "shellshock",
    "apache-struts"
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


def _start_compose_project_async(
    user_id: int,
    container_id: int,
    project_name: str,
    container_name: str,
    file_path: str,
    network_name: str,
):
    """
    Run compose startup in a background thread so /api/start_container/ can
    return immediately and avoid proxy/client connection resets on long starts.
    """
    close_old_connections()
    try:
        custom_docker = DockerClient(compose_files=[file_path], compose_project_name=project_name)
        custom_docker.compose.up(detach=True)

        # Bridge Traefik to the new isolated network (ignore if already connected).
        os.system(f"docker network connect {network_name} web-app-deployment-tool-traefik-1 > /dev/null 2>&1")

        db_container = Container.objects.filter(id=container_id).first()
        user = User.objects.filter(id=user_id).first()
        if db_container and user:
            log_user_action(user, f"Deployed composed project '{container_name}'", db_container)
    except Exception as e:
        print(f"Async deployment error for {project_name}: {e}")
        db_container = Container.objects.filter(id=container_id).first()
        if db_container:
            db_container.status = "STOP"
            db_container.save(update_fields=["status"])
    finally:
        close_old_connections()


def _stop_compose_project_async(
    user_id: int,
    db_container_pk: int,
    project_name: str,
    container_name: str,
    file_path: str,
    network_name: str,
):
    """
    Run compose down / cleanup in a background thread so /api/stop_container/ can return quickly.
    """
    close_old_connections()
    try:
        os.system(
            f"docker network disconnect {network_name} web-app-deployment-tool-traefik-1 > /dev/null 2>&1"
        )
        if os.path.exists(file_path):
            custom_docker = DockerClient(
                compose_files=[file_path], compose_project_name=project_name
            )
            custom_docker.compose.down(volumes=True, remove_orphans=True)
            os.remove(file_path)

        db_container = Container.objects.filter(id=db_container_pk).first()
        user = User.objects.filter(id=user_id).first()
        if db_container:
            db_container.status = "STOP"
            db_container.save(update_fields=["status"])
        if db_container and user:
            log_user_action(
                user,
                f"Stopped and removed composed project '{container_name}'",
                db_container,
            )
    except Exception as e:
        print(f"Async stop error for {project_name}: {e}")
    finally:
        close_old_connections()


def _restart_compose_project_async(
    user_id: int,
    db_container_pk: int,
    project_name: str,
    container_name: str,
    file_path: str,
):
    """
    Run compose restart in a background thread so /api/restart_container/ can return quickly.
    """
    close_old_connections()
    try:
        if not os.path.exists(file_path):
            print(f"Async restart: YAML missing for {project_name}")
            return
        custom_docker = DockerClient(
            compose_files=[file_path], compose_project_name=project_name
        )
        custom_docker.compose.restart()

        db_container = Container.objects.filter(id=db_container_pk).first()
        user = User.objects.filter(id=user_id).first()
        if db_container:
            db_container.status = "STARTING"
            db_container.save(update_fields=["status"])
        if db_container and user:
            log_user_action(
                user,
                f"Restarted composed project '{container_name}'",
                db_container,
            )
    except Exception as e:
        print(f"Async restart error for {project_name}: {e}")
    finally:
        close_old_connections()


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
        
        user = User(username=username)
        user.set_unusable_password() 
        user.save()

        try:
            cognito.sign_up(
                ClientId=CLIENT_ID,
                Username=username,
                Password=password,
                UserAttributes=[{'Name': 'email', 'Value': f'{username}@placeholder.com'}]
            )
            cognito.admin_confirm_sign_up(
                UserPoolId=USER_POOL_ID,
                Username=username
            )
        except Exception as e:
            user.delete()
            return JsonResponse({'error': f'AWS Sync Error: {str(e)}'}, status=500)

        log_user_action(user, "Created a new account")
        return JsonResponse({'status': 'Success', 'message': 'User created successfully', 'user_id': user.id}, status=201)

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
        
        try:
            response = cognito.initiate_auth(
                ClientId=CLIENT_ID,
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={'USERNAME': username, 'PASSWORD': password}
            )

            if response.get('ChallengeName') == 'SOFTWARE_TOKEN_MFA':
                return JsonResponse({
                    "status": "MFA_REQUIRED",
                    "session": response['Session'],
                    "message": "Please enter your 6-digit authenticator code."
                })
            
            elif response.get('ChallengeName') == 'MFA_SETUP':
                request.session['cognito_setup_session'] = response['Session']
                return JsonResponse({
                    "status": "MFA_SETUP_REQUIRED",
                    "message": "You must configure Multi-Factor Authentication to continue."
                })

            user = get_object_or_404(User, username=username)
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            request.session['cognito_access_token'] = response['AuthenticationResult']['AccessToken']

            if user is not None:
                request.session['cognito_access_token'] = response['AuthenticationResult']['AccessToken']
                log_user_action(user, "Logged in")
                return JsonResponse({'status': 'success', 'message': 'Login successful.', 'user_id': user.id, 'username': user.username})
            else:
                return JsonResponse({'error': 'Credentials invalid.'}, status=401)

        except cognito.exceptions.NotAuthorizedException:
            return JsonResponse({'error': 'Invalid credentials.'}, status=401)
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["POST"])
def verify_mfa_login(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        mfa_code = data.get('mfaCode')
        session = data.get('session')

        response = cognito.respond_to_auth_challenge(
            ClientId=CLIENT_ID,
            ChallengeName='SOFTWARE_TOKEN_MFA',
            Session=session,
            ChallengeResponses={
                'USERNAME': username,
                'SOFTWARE_TOKEN_MFA_CODE': mfa_code
            }
        )

        user = get_object_or_404(User, username=username)
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.session['cognito_access_token'] = response['AuthenticationResult']['AccessToken']
        
        log_user_action(user, "Logged in with MFA")
        return JsonResponse({'status': 'success', 'message': 'Login successful.', 'user_id': user.id, 'username': user.username})

    except cognito.exceptions.CodeMismatchException:
        return JsonResponse({"error": "Invalid MFA code. Please try again."}, status=401)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["POST"])
def setup_mfa(request):
    access_token = request.session.get('cognito_access_token')
    setup_session = request.session.get('cognito_setup_session')
    data = json.loads(request.body) if request.body else {}
    username = request.user.username if request.user.is_authenticated else data.get('username')

    if not access_token and not setup_session:
        return JsonResponse({"error": "AWS Token missing. Please log out and back in."}, status=401)

    try:
        if access_token:
            response = cognito.associate_software_token(AccessToken=access_token)
        else:
            response = cognito.associate_software_token(Session=setup_session)
            request.session['cognito_setup_session'] = response['Session']

        secret_code = response['SecretCode']
        qr_uri = f"otpauth://totp/WADT_Deployment:{username}?secret={secret_code}&issuer=WADT_Deployment"

        return JsonResponse({"status": "SUCCESS", "secretCode": secret_code, "qrCodeUri": qr_uri})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["POST"])
def verify_mfa_setup(request):
    try:
        data = json.loads(request.body)
        mfa_code = data.get('mfaCode')
        username = data.get('username') 
        access_token = request.session.get('cognito_access_token')
        setup_session = request.session.get('cognito_setup_session')

        if access_token:
            cognito.verify_software_token(AccessToken=access_token, UserCode=mfa_code, FriendlyDeviceName='WADT_Authenticator')
            cognito.set_user_mfa_preference(AccessToken=access_token, SoftwareTokenMfaSettings={'Enabled': True, 'PreferredMfa': True})
            
            log_user_action(request.user, "Enabled Multi-Factor Authentication")
            return JsonResponse({"status": "SUCCESS", "message": "MFA successfully enabled."})

        elif setup_session:
            verify_response = cognito.verify_software_token(Session=setup_session, UserCode=mfa_code, FriendlyDeviceName='WADT_Authenticator')
        
            auth_response = cognito.respond_to_auth_challenge(
                ClientId=CLIENT_ID,
                ChallengeName='MFA_SETUP',
                Session=verify_response['Session'],
                ChallengeResponses={'USERNAME': username}
            )

            user = get_object_or_404(User, username=username)
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')

            request.session['cognito_access_token'] = auth_response['AuthenticationResult']['AccessToken']
            del request.session['cognito_setup_session']
            
            log_user_action(user, "Enabled MFA and Logged In")
            return JsonResponse({"status": "SUCCESS", "message": "MFA enabled and logged in.", "user_id": user.id})
            
        else:
             return JsonResponse({"error": "AWS Token missing."}, status=401)

    except cognito.exceptions.EnableSoftwareTokenMFAException:
        return JsonResponse({"error": "Invalid code provided for setup."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["POST"])
@login_required
def logout_user(request):
    #logs out user and removes session data for user
    request.session.flush()
    logout(request)
    return JsonResponse({'status': 'Success', 'message': 'Logout successful.'})

@login_required
def current_user(request):
    profile = getattr(request.user, 'profile', None)
    org = profile.organization if profile else None
    
    return JsonResponse({
        "username": request.user.username,
        "role": profile.role if profile else "STUDENT",
        "organization": {
            "id": org.id,
            "name": org.name,
            "org_code": org.org_code,
        } if org else None
    })

@require_http_methods(["GET"])
@login_required
def get_containers(request):
    #now returns containers only relevant to the current user, will implement one for all containers later
    client = get_docker_client()
    if not client:
        return JsonResponse({"error": "Docker client not available"}, status=503)
    
    container_data = []
    max_runtime = timedelta(hours=24)
    max_runtime_seconds = int(max_runtime.total_seconds())
    app_domain = config("APP_DOMAIN", default="localhost")
    protocol = "http" if app_domain == "localhost" else "https"

    try:
        db_containers = Container.objects.filter(user=request.user)
        
        for db_c in db_containers:
            project_name = db_c.docker_container_id
            containers = client.containers.list(
                all=True,
                filters={"label": [f"com.docker.compose.project={project_name}", "com.docker.compose.service=web"]}
            )
            
            if not containers:
                container_data.append({
                    "id": project_name,
                    "name": db_c.name,
                    "image": "unknown",
                    "status": "stopped",
                    "external_url": None,
                    "terminal_url": None,
                    "started_at": None,
                    "uptime": None,
                    "time_left": None
                })
                continue
            
            c = containers[0]
            image_tag = c.image.tags[0] if c.image.tags else 'unknown'
            custom_name = db_c.name
            uptime_str = None
            time_left_str = None
            started_at_iso = None    

            if c.status == 'running':
                started_at_str = c.attrs['State']['StartedAt']
                if '.' in started_at_str:
                    base, fraction = started_at_str.split('.')
                    started_at_str = f"{base}.{fraction[:6]}Z"
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
            protocol = _lab_url_scheme()

            # 2. State Machine Logic
            app_host = f"{project_name}.{app_domain}"
            terminal_host = f"terminal.{project_name}.{app_domain}"
            app_ready = _probe_traefik_host(app_host)
            terminal_ready = _probe_traefik_host(terminal_host)
            is_ready = app_ready and terminal_ready

            if db_c.status == "STARTING" and is_ready:
                # Promote to RUN once both routes are actually reachable.
                db_c.status = "RUN"
                db_c.save()

            # 3. Withhold URLs if not ready (same shape as check_container_ready, incl. catalog path)
            if is_ready:
                app_path = "/"
                for key, info in APP_CATALOG.items():
                    if f"-{key}-" in project_name:
                        app_path = info.get("path", "/")
                        break
                external_url = f"{protocol}://{project_name}.{app_domain}{app_path}"
                terminal_url = f"{protocol}://terminal.{project_name}.{app_domain}"
                frontend_status = "running"
            else:
                external_url = None
                terminal_url = None
                frontend_status = "starting"

            container_data.append({
                "id": project_name,
                "name": custom_name,
                "image": image_tag,
                "status": c.status,
                "external_url": external_url if c.status == 'running' else None,
                "terminal_url": terminal_url if c.status == 'running' else None,
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
    try:
        body = json.loads(request.body)
        print(f"INCOMING START REQUEST: {body}")
        
        image_name = body.get('imageName')

        if image_name not in ALLOWED_VULN_IMAGES:
            return JsonResponse({"error": "Unauthorized image requested."}, status=403)

        app_name = body.get('name')
        user_id_str = str(request.user.id)
        
        IMAGE_TO_KEY = {
            "pygoat/pygoat": "pygoat",
            "bkimminich/juice-shop": "juice-shop",
            "grafana/grafana:8.3.0": "grafana",
            "vulnerables/web-dvwa": "dvwa",
            "tiredful-api": "tiredful-api",
            "shellshock": "shellshock",
            "apache-struts": "apache-struts"
        }

        app_key = body.get('appKey') or body.get('app_key')
        if not app_key:
            app_key = IMAGE_TO_KEY.get(image_name)
        elif app_key not in APP_CATALOG:
            app_key = IMAGE_TO_KEY.get(app_key, app_key)

        app_info = APP_CATALOG.get(app_key)
        
        if not app_info:
            print(f"❌ FAILED TO FIND CATALOG INFO FOR KEY: '{app_key}'")
            return JsonResponse({"error": "Invalid application catalog key."}, status=400)
        
        user_org = getattr(request.user.profile, "organization", None)

        db_container = Container.objects.filter(
            user=request.user, 
            description=f"Sandbox for {app_key}"
        ).first()

        if not db_container:
            db_container = Container.objects.create(
                user=request.user,
                name=app_name,
                description=f"Sandbox for {app_key}",
                status="CREAT",
                docker_container_id="",
                organization=user_org,
            )
        else:
            # Keep container org aligned with user's current org for admin visibility.
            if db_container.organization != user_org:
                db_container.organization = user_org

        other_containers_count = Container.objects.filter(
            user=request.user
        ).exclude(id=db_container.id).count()

        if other_containers_count >= MAX_CONTAINERS:
             return JsonResponse({"error": "Quota exceeded. 10 containers are already owned by this account"}, status=429)

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

        compose_dict = {"services": {}}
        
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
                "wadt.user_id": user_id_str
            }
        }

        if "environment" in app_info: compose_dict["services"]["web"]["environment"] = app_info["environment"]
        if "cap_add" in app_info: compose_dict["services"]["web"]["cap_add"] = app_info["cap_add"]

        terminal_info = APP_CATALOG["attacker-terminal"]
        compose_dict["services"]["attacker"] = {
            "image": terminal_info["image"],
            "networks": ["default"],
            "labels": {
                "traefik.enable": "true",
                f"traefik.http.routers.{project_name}-terminal.rule": f"Host(`terminal.{project_name}.{app_domain}`)",
                f"traefik.http.routers.{project_name}-terminal.entrypoints": "web",
                f"traefik.http.services.{project_name}-terminal.loadbalancer.server.port": terminal_info["port"],
                "traefik.docker.network": network_name
            }
        }
        if "command" in terminal_info:
            compose_dict["services"]["attacker"]["command"] = terminal_info["command"]

        # Reuse existing compose file when present; otherwise generate it once.
        # Always use `up -d` so missing service containers are created.
        if not os.path.exists(file_path):
            with open(file_path, 'w') as f:
                yaml.dump(compose_dict, f)

        custom_docker = DockerClient(
            compose_files=[file_path],
            compose_project_name=project_name,
        )
        custom_docker.compose.up(detach=True)
        # 5. Mark as starting and run compose work asynchronously.
        db_container.status = "STARTING"
        db_container.save()

        threading.Thread(
            target=_start_compose_project_async,
            args=(
                request.user.id,
                db_container.id,
                project_name,
                db_container.name,
                file_path,
                network_name,
            ),
            daemon=True,
        ).start()

        return JsonResponse({"status": "accepted", "id": project_name}, status=202)
        
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

@require_http_methods(["POST"])
@login_required
def stop_container(request, container_id):
    # container_id is now our Compose Project Name (e.g., wadt-user2-grafana-69ba3a)
    try:
        db_container = Container.objects.select_related("user__profile").get(
            docker_container_id=container_id
        )
    except Container.DoesNotExist:
        return JsonResponse({"error": "Container not found"}, status=404)

    user_profile = getattr(request.user, "profile", None)
    user_role = user_profile.role if user_profile else "STUDENT"
    is_owner = db_container.user_id == request.user.id
    is_super = user_role == "SUPER"
    is_org_admin = (
        user_role in ["ADMIN", "COADMIN"]
        and user_profile.organization
        and getattr(db_container.user.profile, "organization", None) == user_profile.organization
    )

    if not (is_owner or is_super or is_org_admin):
        return JsonResponse({"error": "Container not found or unauthorized"}, status=404)

    project_name = db_container.docker_container_id
    file_path = os.path.join(YAML_DIR, f"{project_name}.yml")
    network_name = f"{project_name}_default"

    threading.Thread(
        target=_stop_compose_project_async,
        args=(
            request.user.id,
            db_container.id,
            project_name,
            db_container.name,
            file_path,
            network_name,
        ),
        daemon=True,
    ).start()

    return JsonResponse(
        {"status": "accepted", "message": f"Stop scheduled for project {project_name}."},
        status=202,
    )
    
@require_http_methods(["POST"])
@login_required
def restart_container(request, container_id):
    try:
        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
    except Container.DoesNotExist:
        return JsonResponse({"error": "Container not found or unauthorized"}, status=404)

    project_name = db_container.docker_container_id
    file_path = os.path.join(YAML_DIR, f"{project_name}.yml")

    if not os.path.exists(file_path):
        return JsonResponse(
            {"error": "YAML configuration missing. Cannot restart."}, status=404
        )

    threading.Thread(
        target=_restart_compose_project_async,
        args=(
            request.user.id,
            db_container.id,
            project_name,
            db_container.name,
            file_path,
        ),
        daemon=True,
    ).start()

    return JsonResponse(
        {
            "status": "accepted",
            "message": f"Restart scheduled for project {project_name}.",
        },
        status=202,
    )

@require_http_methods(["POST"])
@login_required
def reset_container(request, container_id):
    try:
        db_container = Container.objects.get(docker_container_id=container_id, user=request.user)
    except Container.DoesNotExist:
        return JsonResponse({"error": "Container not found or unauthorized"}, status=404)

    project_name = db_container.docker_container_id
    file_path = os.path.join(YAML_DIR, f"{project_name}.yml")

    try:
        if os.path.exists(file_path):
            custom_docker = DockerClient(compose_files=[file_path], compose_project_name=project_name)

            network_name = f"{project_name}_default"
            subprocess.run(
               ["docker", "network", "disconnect", network_name, "web-app-deployment-tool-traefik-1"],
               capture_output=True
            )

            custom_docker.compose.down(volumes=True, remove_orphans=True)
            time.sleep(2)
            custom_docker.compose.up(detach=True)

            subprocess.run(
               ["docker", "network", "connect", network_name, "web-app-deployment-tool-traefik-1"],
               capture_output=True
            )
        else:
            return JsonResponse({"error": "YAML configuration missing. Cannot reset."}, status=404)

        db_container.status = "STARTING"
        db_container.save()
        log_user_action(request.user, f"Reset composed project '{db_container.name}'", db_container)

        return JsonResponse({"status": "success", "message": f"Project {project_name} reset."})
    except Exception as e:
        print(f"Error in reset_container: {str(e)}")
        return JsonResponse({"error": "An internal error occurred while resetting."}, status=500)



@require_http_methods(["POST"])
@login_required
def request_teacher_status(request):
    profile = request.user.profile

    if not profile.organization:
         return JsonResponse({"error": "You must join an organization before requesting admin status."}, status=400)
    
    if profile.role in ['ADMIN', 'COADMIN', 'SUPER']:
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
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role not in ['ADMIN', 'COADMIN', 'SUPER']:
        return JsonResponse({"error": "Unauthorized access."}, status=403)

    if profile.role in ['ADMIN', 'COADMIN']:
        if not profile.organization:
             return JsonResponse({"pending_requests": []})
        pending_profiles = UserProfile.objects.filter(
            is_pending_teacher=True, 
            organization=profile.organization
        ).select_related('user')
    else:
        pending_profiles = UserProfile.objects.filter(is_pending_teacher=True).select_related('user')
    
    data = [{
        "user_id": p.user.id,
        "username": p.user.username,
        "organization": p.organization.name if p.organization else "None",
        "date_joined": p.user.date_joined.strftime("%Y-%m-%d")
    } for p in pending_profiles]

    return JsonResponse({"pending_requests": data})

@require_http_methods(["POST"])
@login_required
def approve_teacher(request, target_user_id):
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role not in ['ADMIN', 'COADMIN', 'SUPER']:
        return JsonResponse({"error": "Unauthorized access."}, status=403)

    try:
        target_user = User.objects.get(id=target_user_id)
        target_profile = target_user.profile
        
        if profile.role in ['ADMIN', 'COADMIN'] and target_profile.organization != profile.organization:
             return JsonResponse({"error": "You can only approve co-admins within your own organization."}, status=403)
        
        target_profile.role = 'COADMIN'
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

@require_http_methods(["POST", "DELETE"])
@login_required
def remove_member(request, target_user_id):
    request_profile = getattr(request.user, 'profile', None)
    
    if not request_profile or request_profile.role not in ['ADMIN', 'COADMIN', 'SUPER']:
        return JsonResponse({"error": "Unauthorized. You do not have permission to remove members."}, status=403)

    try:
        target_user = User.objects.get(id=target_user_id)
        target_profile = target_user.profile
        
        if request_profile.role != 'SUPER':
            if target_profile.organization != request_profile.organization:
                return JsonResponse({"error": "This user is not in your organization."}, status=403)
            
            if request_profile.role == 'COADMIN':
                if target_profile.role in ['ADMIN', 'COADMIN', 'SUPER']:
                    return JsonResponse({"error": "Co-Admins can only remove students."}, status=403)
            
            elif request_profile.role == 'ADMIN':
                if target_profile.role in ['ADMIN', 'SUPER']:
                    return JsonResponse({"error": "You cannot remove the Organization Owner or a Superuser."}, status=403)
                    
        org_name = target_profile.organization.name if target_profile.organization else "Unknown"
        
        target_profile.organization = None
        target_profile.role = 'STUDENT' 
        target_profile.is_pending_teacher = False 
        target_profile.save()
        
        Container.objects.filter(user=target_user).update(organization=None)

        log_user_action(request.user, f"Removed {target_user.username} from organization '{org_name}'")
        log_user_action(target_user, f"Removed from organization '{org_name}' by {request.user.username}")
        
        return JsonResponse({
            "status": "success",
            "message": f"User {target_user.username} has been removed and demoted to Student."
        })
        
    except User.DoesNotExist:
        return JsonResponse({"error": "Target user not found."}, status=404)
    except Exception as e:
        print(f"Error in remove_member: {str(e)}")
        return JsonResponse({"error": "An internal server error occurred."}, status=500)

@require_http_methods(["POST"])
@login_required
def create_organization(request):
    try:
        data = json.loads(request.body)
        org_name = data.get('name', '').strip()

        if not org_name:
            return JsonResponse({"error": "Organization name is required."}, status=400)

        new_org = Organization.objects.create(name=org_name)

        profile = request.user.profile
        profile.organization = new_org
        profile.role = 'ADMIN'
        profile.save()

        log_user_action(request.user, f"Created organization '{new_org.name}' and became Admin")
        Container.objects.filter(user=request.user).update(organization=new_org)

        return JsonResponse({
            "status": "success",
            "message": f"Organization '{new_org.name}' created successfully.",
            "org_code": new_org.org_code,
            "organization_name": new_org.name,
            "org_id": new_org.id
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

@require_http_methods(["POST", "DELETE"])
@login_required
def delete_organization(request, org_id):
    profile = getattr(request.user, 'profile', None)

    if not profile or profile.role not in ['ADMIN', 'COADMIN', 'SUPER']:
        return JsonResponse({"error": "Unauthorized."}, status=403)

    try:
        org = get_object_or_404(Organization, id=org_id)
        if profile.role == 'ADMIN' and profile.organization != org:
            return JsonResponse({"error": "You can only delete an organization you own."}, status=403)
        org_name = org.name

        UserProfile.objects.filter(organization=org).update(
            role='STUDENT',
            is_pending_teacher=False
        )

        org.delete()
        log_user_action(request.user, f"Deleted organization '{org_name}'")

        return JsonResponse({
            "status": "success",
            "message": f"Organization '{org_name}' has been deleted."
        })

    except Exception as e:
        print(f"Error in delete_organization: {str(e)}")
        return JsonResponse({"error": "An internal server error occurred."}, status=500)

@require_http_methods(["GET"])
@login_required
def get_organization_stats(request):
    profile = getattr(request.user, 'profile', None)
    
    if not profile or profile.role not in ['ADMIN', 'COADMIN', 'SUPER']:
        return JsonResponse({"error": "Unauthorized."}, status=403)

    try:
        org = profile.organization

        if profile.role == 'SUPER' and not org:
            member_count = UserProfile.objects.count()
            container_count = Container.objects.count()
            org_name = "All users"
        
        elif org:
            member_count = UserProfile.objects.filter(organization=org).count()
            container_count = Container.objects.filter(
                user__profile__organization=org
            ).count()
            org_name = org.name
            
        else:
            return JsonResponse({"error": "You are not assigned to an organization."}, status=400)

        return JsonResponse({
            "status": "success",
            "organization_name": org_name,
            "member_count": member_count,
            "container_count": container_count
        })

    except Exception as e:
        print(f"Error in get_organization_stats: {str(e)}")
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
    elif (
        user_role == 'ADMIN'
        and user_profile.organization
        and getattr(container_record.user.profile, "organization", None) == user_profile.organization
    ):
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
            containers = client.containers.list(
                all=True,
                filters={"label": [f"com.docker.compose.project={container_id}", "com.docker.compose.service=web"]}
            )
            
            if containers:
                docker_container = containers[0]
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
            else:
                print(f"No web container found for project: {container_id}")
                
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

    if user_role not in ['SUPER', 'COADMIN', 'ADMIN']:
        return JsonResponse({"error": "Unauthorized access."}, status=403)

    try:
        page_number = request.GET.get('page', 1)
        admin_org = None

        if user_role in ['ADMIN', 'COADMIN']:
            admin_org = user_profile.organization
            if not admin_org:
                users_with_containers = User.objects.none()
            else:
                users_with_containers = User.objects.filter(profile__organization=admin_org)
        else:
            users_with_containers = User.objects.all()

        users_with_containers = users_with_containers.order_by('username')
        paginator = Paginator(users_with_containers, 10)
        page_obj = paginator.get_page(page_number)
        users_on_page = page_obj.object_list

        if user_role in ['ADMIN', 'COADMIN']:
            containers = Container.objects.filter(
                user__in=users_on_page,
                user__profile__organization=admin_org
            ).select_related('user')
        else:
            containers = Container.objects.filter(user__in=users_on_page).select_related('user')

        organized_data = {
            user.username: {"user_id": user.id, "role": user.profile.role, "containers": []}
            for user in users_on_page
        }
        # Track which catalog apps already exist per user so we can fill missing apps as STOP placeholders.
        existing_app_keys_by_user = {user.username: set() for user in users_on_page}

        def _catalog_display_name(app_key: str) -> str:
            display = {
                "pygoat": "PyGoat",
                "juice-shop": "Juice Shop",
                "grafana": "Grafana",
                "dvwa": "DVWA",
                "apache-struts": "Apache Struts",
                "shellshock": "Shellshock",
                "tiredful-api": "Tiredful API",
            }
            return display.get(app_key, app_key.replace("-", " ").title())

        for container in containers:
            app_key = None
            if container.description and container.description.startswith("Sandbox for "):
                app_key = container.description.replace("Sandbox for ", "", 1).strip()
                existing_app_keys_by_user[container.user.username].add(app_key)
            organized_data[container.user.username]["containers"].append({
                "container_id": container.docker_container_id,
                "name": container.name,
                "status": container.status,
                "created_at": container.created_at.isoformat() if hasattr(container, 'created_at') else None,
                "app_key": app_key,
            })

        # Add synthetic STOP rows for catalog apps the user has never launched yet.
        catalog_keys = [k for k in APP_CATALOG.keys() if k != "attacker-terminal"]
        for user in users_on_page:
            username = user.username
            missing = [k for k in catalog_keys if k not in existing_app_keys_by_user[username]]
            for app_key in missing:
                organized_data[username]["containers"].append({
                    "container_id": None,
                    "name": _catalog_display_name(app_key),
                    "status": "STOP",
                    "created_at": None,
                    "app_key": app_key,
                })

        response_data = [
            {"username": username, "user_id": data["user_id"], "role": data["role"], "containers": data["containers"]}
            for username, data in organized_data.items()
        ]

        org_scope_name = admin_org.name if admin_org else "Global (Super-Admin)"

        return JsonResponse({
            "data": response_data,
            "organization_scope": org_scope_name,
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

    if db_container.status == "STOP":
        return JsonResponse({"error": "Container is stopped.", "ready": False}, status=400)

    app_domain = config("APP_DOMAIN", default="localhost")
    protocol = "http" if app_domain == "localhost" else "https"
    
    hostname = f"{container_id}.{app_domain}"
    terminal_hostname = f"terminal.{hostname}"

    # 1. The Traefik Probes
    app_is_ready = _probe_traefik_host(hostname)
    terminal_is_ready = _probe_traefik_host(terminal_hostname)

    if not (app_is_ready and terminal_is_ready):
        return JsonResponse({"ready": False})

    # 2. Determine the specific landing page for the "Open App" button
    app_path = "/"
    for key, info in APP_CATALOG.items():
        if f"-{key}-" in container_id:
            app_path = info.get("path", "/")
            break

    # 3. Construct the final exact URLs
    protocol = _lab_url_scheme()
    subdomain_url = f"{protocol}://{hostname}{app_path}"
    terminal_url = f"{protocol}://{terminal_hostname}" 

    db_container.status = "RUN"
    db_container.save()

    return JsonResponse({
        "ready": True,
        "url": subdomain_url,
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
