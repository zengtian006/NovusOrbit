#!/bin/bash
# ============================================
# EC2 User Data — Bootstrap Docker + Caddy + App
# ============================================
set -euo pipefail
exec > >(tee /var/log/user-data.log) 2>&1

echo "=== Starting NovusOrbit EC2 Bootstrap ==="

# ---- Install Docker ----
dnf update -y
dnf install -y docker jq aws-cli
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
curl -SL "https://github.com/docker/compose/releases/download/$${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# ---- Install Caddy ----
# Download pre-built binary (COPR doesn't support Amazon Linux 2023)
CADDY_VERSION=$(curl -s https://api.github.com/repos/caddyserver/caddy/releases/latest | jq -r .tag_name | sed 's/^v//')
curl -SL "https://github.com/caddyserver/caddy/releases/download/v$${CADDY_VERSION}/caddy_$${CADDY_VERSION}_linux_amd64.tar.gz" \
  -o /tmp/caddy.tar.gz
tar -xzf /tmp/caddy.tar.gz -C /usr/local/bin caddy
chmod +x /usr/local/bin/caddy
rm -f /tmp/caddy.tar.gz

# Create caddy user and directories
useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy || true
mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy
chown caddy:caddy /var/lib/caddy /var/log/caddy

# Create systemd service for Caddy
cat > /etc/systemd/system/caddy.service <<'CADDYSVC'
[Unit]
Description=Caddy
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
CADDYSVC

systemctl daemon-reload
systemctl enable caddy

# ---- Create app directories ----
mkdir -p /opt/novusorbit/{data/user,data/knowledge_bases,data/portfolios,config}

# ---- Install the update script (shared with deploy.sh: host/update.sh) ----
# It writes .env from the Secrets Manager DOTENV key, pulls the image and
# starts the container. deploy.sh re-installs and re-runs it on every deploy.
echo "${update_script_b64}" | base64 -d > /opt/novusorbit/update.sh
chmod 700 /opt/novusorbit/update.sh

# ---- Create docker-compose.yml ----
cat > /opt/novusorbit/docker-compose.yml <<'COMPOSEEOF'
services:
  novusorbit:
    image: ${ecr_repo_url}:${image_tag}
    container_name: novusorbit
    restart: unless-stopped
    ports:
      - "${backend_port}:${backend_port}"
      - "${frontend_port}:${frontend_port}"
    env_file:
      - .env
    volumes:
      - ./data/user:/app/data/user
      - ./data/knowledge_bases:/app/data/knowledge_bases
      - ./data/portfolios:/app/data/portfolios
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${backend_port}/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
COMPOSEEOF

# ---- Configure Caddy ----
%{ if domain_name != "" }
cat > /etc/caddy/Caddyfile <<'CADDYEOF'
${domain_name} {
    redir https://www.${domain_name}{uri} permanent
}

www.${domain_name} {
    # Next.js API routes -> frontend
    handle /api/auth/* {
        reverse_proxy localhost:${frontend_port}
    }
    handle /api/admin/* {
        reverse_proxy localhost:${frontend_port}
    }
    handle /api/analytics/* {
        reverse_proxy localhost:${frontend_port}
    }

    # Backend API routes
    handle /api/v1/* {
        reverse_proxy localhost:${backend_port}
    }
    handle /api/outputs/* {
        reverse_proxy localhost:${backend_port}
    }
    handle /docs {
        reverse_proxy localhost:${backend_port}
    }
    handle /openapi.json {
        reverse_proxy localhost:${backend_port}
    }

    # Everything else -> frontend
    handle {
        reverse_proxy localhost:${frontend_port}
    }
}
CADDYEOF
%{ else }
cat > /etc/caddy/Caddyfile <<'CADDYEOF'
:80 {
    # Next.js API routes -> frontend
    handle /api/auth/* {
        reverse_proxy localhost:${frontend_port}
    }
    handle /api/admin/* {
        reverse_proxy localhost:${frontend_port}
    }
    handle /api/analytics/* {
        reverse_proxy localhost:${frontend_port}
    }

    # Backend API routes
    handle /api/v1/* {
        reverse_proxy localhost:${backend_port}
    }
    handle /api/outputs/* {
        reverse_proxy localhost:${backend_port}
    }
    handle /docs {
        reverse_proxy localhost:${backend_port}
    }
    handle /openapi.json {
        reverse_proxy localhost:${backend_port}
    }

    # Everything else -> frontend
    handle {
        reverse_proxy localhost:${frontend_port}
    }
}
CADDYEOF
%{ endif }

# ---- Fetch .env, pull and start the app ----
echo "Starting NovusOrbit..."
AWS_REGION="${aws_region}" \
SECRET_ID="${secret_arn}" \
ECR_REGISTRY="${ecr_registry}" \
  /opt/novusorbit/update.sh

echo "Starting Caddy..."
systemctl restart caddy

echo "=== NovusOrbit EC2 Bootstrap Complete ==="
