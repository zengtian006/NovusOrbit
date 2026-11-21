#!/bin/bash
# ============================================
# NovusOrbit host update script
# ============================================
# Source of truth lives in the repo (terraform-ec2/host/update.sh).
# deploy.sh copies it to /opt/novusorbit/update.sh over SSM and runs it on
# every deploy; user_data.sh installs and runs it on first boot.
#
# Steps:
#   1. Refresh /opt/novusorbit/.env from the Secrets Manager DOTENV key
#   2. Make sure portfolios are on a persistent volume (one-time migration)
#   3. Pull the image and recreate the container
#   4. Wait until backend and frontend answer
#
# Required env: AWS_REGION, SECRET_ID, ECR_REGISTRY
# ============================================
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${SECRET_ID:?SECRET_ID is required}"
: "${ECR_REGISTRY:?ECR_REGISTRY is required}"

APP_DIR=/opt/novusorbit
CONTAINER=novusorbit
cd "$APP_DIR"

# ---- 1. Environment file ----
fetch_dotenv() {
  aws secretsmanager get-secret-value \
    --region "$AWS_REGION" --secret-id "$SECRET_ID" \
    --query SecretString --output text | jq -r '.DOTENV // empty'
}

DOTENV=$(fetch_dotenv)
# On first boot the secret version can land a few seconds after the instance
# starts; wait for it when there is no .env to fall back to.
if [ -z "$DOTENV" ] && [ ! -f .env ]; then
  for _ in $(seq 1 60); do
    sleep 10
    DOTENV=$(fetch_dotenv)
    [ -n "$DOTENV" ] && break
  done
fi

if [ -n "$DOTENV" ]; then
  (umask 077 && printf '%s\n' "$DOTENV" > .env.new)
  if [ -f .env ] && cmp -s .env.new .env; then
    echo "[env] .env unchanged"
  else
    echo "[env] .env updated from Secrets Manager"
  fi
  mv .env.new .env
  chmod 600 .env
elif [ -f .env ]; then
  echo "[env] WARN: secret has no DOTENV key yet (run terraform apply); keeping existing .env"
else
  echo "[env] ERROR: no DOTENV in secret $SECRET_ID and no existing .env" >&2
  exit 1
fi

# ---- 2. Persistent data volumes ----
mkdir -p data/user data/knowledge_bases data/portfolios

if ! grep -q 'data/portfolios' docker-compose.yml; then
  echo "[data] Adding data/portfolios volume to docker-compose.yml"
  # Portfolios uploaded before this fix only exist inside the container:
  # copy them out before the container is recreated.
  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER" && [ -z "$(ls -A data/portfolios)" ]; then
    if docker cp "$CONTAINER:/app/data/portfolios/." data/portfolios/ 2>/dev/null; then
      echo "[data] Copied existing portfolios out of the container: $(ls data/portfolios | tr '\n' ' ')"
    else
      echo "[data] No portfolios found inside the container"
    fi
  fi
  cp docker-compose.yml docker-compose.yml.bak
  sed -i 's#^\([[:space:]]*\)- \./data/knowledge_bases:/app/data/knowledge_bases.*#&\n\1- ./data/portfolios:/app/data/portfolios#' docker-compose.yml
  if ! grep -q '\./data/portfolios:/app/data/portfolios' docker-compose.yml; then
    echo "[data] ERROR: could not add the portfolios volume; restoring docker-compose.yml" >&2
    mv docker-compose.yml.bak docker-compose.yml
    exit 1
  fi
fi

# ---- 3. Pull and recreate ----
echo "[app] Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$ECR_REGISTRY" >/dev/null

echo "[app] Pulling image..."
docker compose pull --quiet

echo "[app] Recreating container..."
docker compose up -d --force-recreate

docker image prune -f >/dev/null

# ---- 4. Wait for health ----
BACKEND_PORT=$(grep -E '^BACKEND_PORT=' .env | cut -d= -f2)
FRONTEND_PORT=$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2)
BACKEND_PORT=${BACKEND_PORT:-8001}
FRONTEND_PORT=${FRONTEND_PORT:-3782}

for i in $(seq 1 36); do
  if curl -fs -o /dev/null "http://localhost:$BACKEND_PORT/" &&
     curl -fs -o /dev/null "http://localhost:$FRONTEND_PORT/"; then
    echo "[app] Healthy after ~$((i * 5))s"
    echo "Done! App updated."
    exit 0
  fi
  sleep 5
done

echo "[app] ERROR: app did not become healthy within 3 minutes" >&2
docker logs --tail 50 "$CONTAINER" >&2 || true
exit 1
