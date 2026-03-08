import docker
from wadtapp.models import Container
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta

class Command(BaseCommand):
    help = 'stop and remove user containers that have been running for more than 24 hours.'

    def handle(self, *args, **kwargs):
        client = None
        try:
            client = docker.from_env()
            sandbox_containers = client.containers.list(all=True, filters={"label": "wadt.user_id"})
            
            now = timezone.now()
            max_runtime = timedelta(hours=24)
            cleaned_count = 0

            self.stdout.write(f"Found {len(sandbox_containers)} sandbox containers. Checking time alive.")

            for container in sandbox_containers:
                started_at_str = container.attrs['State']['StartedAt']
                started_at = parse_datetime(started_at_str)
                
                if not started_at:
                    self.stdout.write(self.style.WARNING(f"Could not parse time for {container.short_id}. Skipping."))
                    continue

                uptime = now - started_at

                if uptime > max_runtime:
                    self.stdout.write(self.style.ERROR(f"Container {container.short_id} exceeded TTL ({uptime}). Stopping container."))
                    try:
                        container.stop()
                        Container.objects.filter(docker_container_id=container.short_id).update(status="STOP")
                        cleaned_count += 1
                        self.stdout.write(self.style.SUCCESS(f"Successfully stopped {container.short_id}"))
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Failed to remove {container.short_id}: {e}"))
                else:
                    self.stdout.write(self.style.SUCCESS(f"Container {container.short_id} is within time limit ({uptime})."))

            self.stdout.write(self.style.SUCCESS(f"Time check completed. Stopped {cleaned_count} expired containers."))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Fatal error during cleanup: {e}"))
        finally:
            if client:
                client.close()