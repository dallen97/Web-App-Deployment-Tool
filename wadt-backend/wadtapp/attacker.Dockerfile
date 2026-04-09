FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends nmap curl iputils-ping ca-certificates && \
    ARCH="$(uname -m)" && \
    case "$ARCH" in \
      x86_64|amd64) T=ttyd.x86_64 ;; \
      aarch64|arm64) T=ttyd.aarch64 ;; \
      *) T=ttyd.x86_64 ;; \
    esac && \
    curl -fL "https://github.com/tsl0922/ttyd/releases/download/1.7.7/${T}" -o /usr/local/bin/ttyd && \
    chmod +x /usr/local/bin/ttyd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 7681
CMD ["ttyd", "-W", "bash"]
