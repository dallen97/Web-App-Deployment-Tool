from django.apps import AppConfig # pyright: ignore[reportMissingModuleSource]
import docker # type: ignore
from docker.errors import APIError # pyright: ignore[reportMissingModuleSource]

def setup_secure_network():
    #creates isolated network
    client = None
    try:
        client = docker.from_env()
        network_name = "wadt_sandbox_network"

        existing_networks = client.networks.list(names=[network_name])
        if existing_networks:
            print(f"Network '{network_name}' already exists.")
            return existing_networks[0]

        print(f"Creating secure network: {network_name}...")
        network = client.networks.create(
            name=network_name,
            driver="bridge",
            options={
                "com.docker.network.bridge.enable_icc": "false",
                "com.docker.network.bridge.name": "wadt_br0" 
            }
        )
        print("Network created successfully.")
        return network

    except docker.errors.APIError as e:
        print(f"Failed to create network: {e}")
        return None
    except Exception as e:
        print(f"Docker client error: {e}")
        return None
    finally:
        if client:
            client.close()

class WadtappConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "wadtapp"

    def ready(self):
        setup_secure_network()
