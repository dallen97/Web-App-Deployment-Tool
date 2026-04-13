APP_CATALOG = {
    "pygoat": {
        "image": "pygoat/pygoat:latest",
        "port": "8000"
    },
    "juice-shop": {
        "image": "bkimminich/juice-shop:latest",
        "port": "3000",
        "path": "/#",
    },
    "grafana": {
        "image": "grafana/grafana:8.3.0",  
        "port": "3000"  
    },
    "dvwa": {
        "image": "vulnerables/web-dvwa",
        "port": "80",
        "path": "/login.php",
        "cap_add": ["SETUID", "SETGID", "CHOWN"]
    },
    "apache-struts": {
        "image": "piesecurity/apache-struts2-cve-2017-5638",
        "port": "8080"
    },
    "attacker-terminal": {
        "image": "wadt-attacker:latest",
        "port": "7681",
        "command": "ttyd -W bash",
        "labels": {
            "traefik.enable": "true",
            "traefik.http.routers.attacker.rule": "Host(`terminal.localhost`)",
            "traefik.http.services.attacker.loadbalancer.server.port": "7681"
         }
    },
    "shellshock": {
        "image": "vulnerables/cve-2014-6271",
        "port": "80",
        "path": "/cgi-bin/vulnerable",
        "labels": {
            "traefik.enable": "true",
            "traefik.http.routers.shellshock.rule": "Host(`shellshock.localhost`) index.cgi",
            "traefik.http.services.shellshock.loadbalancer.server.port": "80"
        }
    },
    "redis-lab": {
        "image": "redis:6.0",
        "port": "6379",
    },
    "tiredful-api": {
        "image": "tuxotron/tiredful-api",
        "port": "8000"
    },
    # ⭐ NEW ENTRIES
    "cvwa": {
        "image": "convisolabs/cvwa:latest",
        "port": "8080"
    },

    "ghostkit-lab": {
        "image": "yourdockerhub/ghostkit-lab:latest",
        "port": "9090"
    }
}
