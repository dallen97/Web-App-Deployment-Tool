APP_CATALOG = {
    "pygoat": {
        "image": "pygoat/pygoat:latest",
        "port": "8000"
    },
    "juice-shop": {
        "image": "bkimminich/juice-shop:latest",
        "port": "3000"
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
        "image": "kalilinux/kali-rolling:latest",
               # Exit 126 on EC2 amd64: old catalog used ttyd.aarch64 (ARM only). Pick binary from `uname -m`.
        "command": (
            'bash -c "set -e; apt-get update && apt-get install -y nmap curl iputils-ping; '
            "ARCH=$$(uname -m); "
            "case $$ARCH in x86_64|amd64) T=ttyd.x86_64 ;; aarch64|arm64) T=ttyd.aarch64 ;; *) T=ttyd.x86_64 ;; esac; "
            "curl -fL https://github.com/tsl0922/ttyd/releases/download/1.7.7/$${T} -o /usr/local/bin/ttyd && "
            'chmod +x /usr/local/bin/ttyd && exec ttyd -W bash"'
        ),
        "port": "7681",
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
}
