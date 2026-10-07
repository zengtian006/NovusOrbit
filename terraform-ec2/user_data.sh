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
mkdir -p /opt/novusorbit/{data/user,data/knowledge_bases,config}

# ---- Pull secrets from Secrets Manager ----
echo "Fetching secrets..."
SECRETS=$(aws secretsmanager get-secret-value \
  --region "${aws_region}" \
  --secret-id "${secret_arn}" \
  --query 'SecretString' --output text)

LLM_API_KEY=$(echo "$SECRETS" | jq -r '.LLM_API_KEY')
EMBEDDING_API_KEY=$(echo "$SECRETS" | jq -r '.EMBEDDING_API_KEY')
DATABASE_URL=$(echo "$SECRETS" | jq -r '.DATABASE_URL')
NEXTAUTH_SECRET=$(echo "$SECRETS" | jq -r '.NEXTAUTH_SECRET')
GOOGLE_CLIENT_ID=$(echo "$SECRETS" | jq -r '.GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET=$(echo "$SECRETS" | jq -r '.GOOGLE_CLIENT_SECRET')
SEARCH_API_KEY=$(echo "$SECRETS" | jq -r '.SEARCH_API_KEY')
TTS_API_KEY=$(echo "$SECRETS" | jq -r '.TTS_API_KEY')
SMTP_USER=$(echo "$SECRETS" | jq -r '.SMTP_USER')
SMTP_PASSWORD=$(echo "$SECRETS" | jq -r '.SMTP_PASSWORD')

# ---- Determine base URL ----
%{ if domain_name != "" }
BASE_URL="https://www.${domain_name}"
%{ else }
# Get public IP from instance metadata (IMDSv2)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)
BASE_URL="http://$PUBLIC_IP"
%{ endif }

# ---- Login to ECR ----
echo "Logging in to ECR..."
aws ecr get-login-password --region "${aws_region}" | \
  docker login --username AWS --password-stdin "${ecr_registry}"

# ---- Create .env file ----
cat > /opt/novusorbit/.env <<ENVEOF
# NovusOrbit Environment Configuration
LLM_BINDING=${llm_binding}
LLM_MODEL=${llm_model}
LLM_API_KEY=$LLM_API_KEY
LLM_HOST=${llm_host}
EMBEDDING_BINDING=${embedding_binding}
EMBEDDING_MODEL=${embedding_model}
EMBEDDING_API_KEY=$EMBEDDING_API_KEY
EMBEDDING_HOST=${embedding_host}
EMBEDDING_DIMENSION=${embedding_dimension}
EMBEDDING_MAX_TOKENS=8192
SEARCH_PROVIDER=${search_provider}
SEARCH_API_KEY=$SEARCH_API_KEY
TTS_MODEL=${tts_model}
TTS_API_KEY=$TTS_API_KEY
TTS_URL=${llm_host}
TTS_VOICE=alloy
DISABLE_SSL_VERIFY=false
BACKEND_PORT=${backend_port}
FRONTEND_PORT=${frontend_port}
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
NEXTAUTH_URL=$BASE_URL
AUTH_URL=$BASE_URL
AUTH_TRUST_HOST=true
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_API_BASE=$BASE_URL
NEXT_PUBLIC_API_BASE_EXTERNAL=$BASE_URL
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASSWORD
SMTP_SERVER=${smtp_server}
SMTP_PORT=${smtp_port}
FEEDBACK_EMAIL_FROM=${feedback_email_from}
ENVEOF

chmod 600 /opt/novusorbit/.env

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

# ---- Pull and start the app ----
echo "Pulling Docker image..."
docker pull "${ecr_repo_url}:${image_tag}"

echo "Starting NovusOrbit..."
cd /opt/novusorbit
docker compose up -d

echo "Starting Caddy..."
systemctl restart caddy

# ---- Create update script ----
cat > /opt/novusorbit/update.sh <<'UPDATEEOF'
#!/bin/bash
set -euo pipefail
cd /opt/novusorbit

echo "Logging in to ECR..."
aws ecr get-login-password --region "${aws_region}" | \
  docker login --username AWS --password-stdin "${ecr_registry}"

echo "Pulling latest image..."
docker compose pull

echo "Restarting app..."
docker compose up -d --force-recreate

echo "Cleaning up old images..."
docker image prune -f

echo "Done! App updated."
UPDATEEOF
chmod +x /opt/novusorbit/update.sh

echo "=== NovusOrbit EC2 Bootstrap Complete ==="
