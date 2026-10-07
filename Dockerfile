# ============================================
# NovusOrbit Multi-Stage Dockerfile
# ============================================
# This Dockerfile builds a production-ready image for NovusOrbit
# containing both the FastAPI backend and Next.js frontend
#
# Build: docker compose build
# Run:   docker compose up -d
#
# Prerequisites:
#   1. Copy .env.example to .env and configure your API keys
#   2. Optionally customize config/main.yaml
# ============================================

# ============================================
# Stage 1: Frontend Builder
# ============================================
FROM node:22-slim AS frontend-builder

WORKDIR /app/web

# Accept build argument for backend port
ARG BACKEND_PORT=8001

# Copy package files first for better caching
COPY web/package.json web/package-lock.json* ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source code
COPY web/ ./

# Create .env.local with valid URL for build time
# Using localhost as build-time value (will be replaced at runtime if needed)
RUN echo "NEXT_PUBLIC_API_BASE=http://localhost:8001" > .env.local

# Generate Prisma Client before building Next.js
# This is required because Next.js imports @prisma/client during build
RUN npx prisma generate

# Build Next.js for production
# Set NODE_ENV=production to ensure optimized production build
ENV NODE_ENV=production
RUN npm run build

# ============================================
# Stage 2: Python Base with Dependencies
# ============================================
FROM python:3.11-slim AS python-base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
# Note: libgl1 and libglib2.0-0 are required for OpenCV (used by mineru)
# Rust is required for building tiktoken and other packages without pre-built wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/* \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# ============================================
# Stage 3: Production Image
# ============================================
FROM python:3.11-slim AS production

# Labels
LABEL maintainer="NovusOrbit Team" \
    description="NovusOrbit: AI-Powered Personalized Learning Assistant" \
    version="0.1.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    NODE_ENV=production \
    # Default ports (can be overridden)
    BACKEND_PORT=8001 \
    FRONTEND_PORT=3782

WORKDIR /app

# Install system dependencies
# Note: libgl1 and libglib2.0-0 are required for OpenCV (used by mineru)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    bash \
    supervisor \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js from frontend-builder stage (avoids re-downloading from NodeSource)
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version && npm --version

# Copy Python packages from builder stage
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-base /usr/local/bin /usr/local/bin

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/web/.next ./web/.next
COPY --from=frontend-builder /app/web/public ./web/public
COPY --from=frontend-builder /app/web/package.json ./web/package.json
COPY --from=frontend-builder /app/web/next.config.js ./web/next.config.js
COPY --from=frontend-builder /app/web/postcss.config.js ./web/postcss.config.js
COPY --from=frontend-builder /app/web/tailwind.config.js ./web/tailwind.config.js
COPY --from=frontend-builder /app/web/node_modules ./web/node_modules
# Copy Next.js source files (required for next start)
COPY --from=frontend-builder /app/web/app ./web/app
COPY --from=frontend-builder /app/web/components ./web/components
COPY --from=frontend-builder /app/web/context ./web/context
COPY --from=frontend-builder /app/web/hooks ./web/hooks
COPY --from=frontend-builder /app/web/i18n ./web/i18n
COPY --from=frontend-builder /app/web/lib ./web/lib
COPY --from=frontend-builder /app/web/types ./web/types
COPY --from=frontend-builder /app/web/locales ./web/locales
COPY --from=frontend-builder /app/web/prisma ./web/prisma
COPY --from=frontend-builder /app/web/middleware.ts ./web/middleware.ts
COPY --from=frontend-builder /app/web/next-env.d.ts ./web/next-env.d.ts
COPY --from=frontend-builder /app/web/tsconfig.json ./web/tsconfig.json
COPY --from=frontend-builder /app/web/.env.local ./web/.env.local

# Copy application source code
COPY src/ ./src/
COPY config/ ./config/
COPY scripts/ ./scripts/
COPY pyproject.toml ./
COPY requirements.txt ./

# Create necessary directories (these will be overwritten by volume mounts)
RUN mkdir -p \
    data/user/solve \
    data/user/question \
    data/user/research/cache \
    data/user/research/reports \
    data/user/guide \
    data/user/notebook \
    data/user/co-writer/audio \
    data/user/co-writer/tool_calls \
    data/user/logs \
    data/user/run_code_workspace \
    data/user/performance \
    data/knowledge_bases

# Create supervisord configuration for running both services
# Log output goes to stdout/stderr so docker logs can capture them
RUN mkdir -p /etc/supervisor/conf.d && \
    printf '[supervisord]\n' > /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'nodaemon=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'logfile=/dev/null\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'pidfile=/var/run/supervisord.pid\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf '\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf '[program:backend]\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'command=/bin/bash /app/start-backend.sh\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'directory=/app\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'autostart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'autorestart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stdout_logfile=/dev/fd/1\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stdout_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stderr_logfile=/dev/fd/2\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stderr_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'environment=PYTHONPATH="/app",PYTHONUNBUFFERED="1"\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf '\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf '[program:frontend]\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'command=/bin/bash /app/start-frontend.sh\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'directory=/app/web\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'autostart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'autorestart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'startsecs=5\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stdout_logfile=/dev/fd/1\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stdout_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stderr_logfile=/dev/fd/2\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'stderr_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
    printf 'environment=NODE_ENV="production"\n' >> /etc/supervisor/conf.d/novusorbit.conf

# Create backend startup script
RUN printf '#!/bin/bash\n\
    set -e\n\
    \n\
    BACKEND_PORT=${BACKEND_PORT:-8001}\n\
    \n\
    echo "[Backend]  Starting FastAPI backend on port ${BACKEND_PORT}..."\n\
    \n\
    # Run uvicorn directly - the application'"'"'s logging system already handles:\n\
    # 1. Console output (visible in docker logs)\n\
    # 2. File logging to data/user/logs/ai_tutor_*.log\n\
    exec python -m uvicorn src.api.main:app --host 0.0.0.0 --port ${BACKEND_PORT}\n' > /app/start-backend.sh && \
    chmod +x /app/start-backend.sh

# Create frontend startup script
# This script handles runtime environment variable injection for Next.js
RUN printf '#!/bin/bash\n\
    set -e\n\
    \n\
    export NODE_ENV=production\n\
    \n\
    BACKEND_PORT=${BACKEND_PORT:-8001}\n\
    FRONTEND_PORT=${FRONTEND_PORT:-3782}\n\
    \n\
    if [ -n "$NEXT_PUBLIC_API_BASE" ]; then\n\
    API_BASE="$NEXT_PUBLIC_API_BASE"\n\
    echo "[Frontend] Using configured API URL: ${API_BASE}"\n\
    elif [ -n "$NEXT_PUBLIC_API_BASE_EXTERNAL" ]; then\n\
    API_BASE="$NEXT_PUBLIC_API_BASE_EXTERNAL"\n\
    echo "[Frontend] Using external API URL: ${API_BASE}"\n\
    else\n\
    API_BASE="http://localhost:${BACKEND_PORT}"\n\
    echo "[Frontend] Single-container mode: ${API_BASE}"\n\
    fi\n\
    \n\
    echo "[Frontend] Starting Next.js in production mode on port ${FRONTEND_PORT}..."\n\
    \n\
    if [ "${API_BASE}" != "http://localhost:8001" ]; then\n\
    echo "[Frontend] Updating API endpoint..."\n\
    find /app/web/.next -type f \\( -name "*.js" -o -name "*.json" \\) -exec sed -i "s|http://localhost:8001|${API_BASE}|g" {} \\; 2>/dev/null || true\n\
    fi\n\
    \n\
    echo "NODE_ENV=production" > /app/web/.env.local\n\
    echo "NEXT_PUBLIC_API_BASE=${API_BASE}" >> /app/web/.env.local\n\
    cd /app/web && exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${FRONTEND_PORT}\n' > /app/start-frontend.sh && \
    chmod +x /app/start-frontend.sh

# Create entrypoint script
RUN printf '#!/bin/bash\n\
    set -e\n\
    \n\
    echo "============================================"\n\
    echo "Starting NovusOrbit"\n\
    echo "============================================"\n\
    \n\
    export BACKEND_PORT=${BACKEND_PORT:-8001}\n\
    export FRONTEND_PORT=${FRONTEND_PORT:-3782}\n\
    \n\
    echo "Backend Port: ${BACKEND_PORT}"\n\
    echo "Frontend Port: ${FRONTEND_PORT}"\n\
    \n\
    if [ -z "$LLM_API_KEY" ]; then\n\
    echo "WARNING: LLM_API_KEY not set"\n\
    fi\n\
    \n\
    if [ -z "$LLM_MODEL" ]; then\n\
    echo "WARNING: LLM_MODEL not set"\n\
    fi\n\
    \n\
    echo "Checking data directories..."\n\
    if [ ! -f "/app/data/user/user_history.json" ]; then\n\
    python -c "from pathlib import Path; from src.services.setup import init_user_directories; init_user_directories(Path('"'"'/app'"'"'))" 2>/dev/null || echo "Directory init skipped"\n\
    fi\n\
    \n\
    echo "============================================"\n\
    exec /usr/bin/supervisord -c /etc/supervisor/conf.d/novusorbit.conf\n' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Expose ports
EXPOSE 8001 3782

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${BACKEND_PORT:-8001}/ || exit 1

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# # ============================================
# # Stage 4: Development Image (Optional)
# # ============================================
# FROM production AS development

# # Install development tools
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     vim \
#     git \
#     && rm -rf /var/lib/apt/lists/*

# # Install development Python packages
# RUN pip install --no-cache-dir \
#     pre-commit \
#     black \
#     ruff

# # Override supervisord config for development (with reload)
# # Log output goes to stdout/stderr so docker logs can capture them
# RUN printf '[supervisord]\n' > /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'nodaemon=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'logfile=/dev/null\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'pidfile=/var/run/supervisord.pid\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf '\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf '[program:backend]\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'command=python -m uvicorn src.api.main:app --host 0.0.0.0 --port %%(ENV_BACKEND_PORT)s --reload\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'directory=/app\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'autostart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'autorestart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stdout_logfile=/dev/fd/1\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stdout_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stderr_logfile=/dev/fd/2\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stderr_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'environment=PYTHONPATH="/app",PYTHONUNBUFFERED="1"\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf '\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf '[program:frontend]\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'command=/bin/bash -c "cd /app/web && node node_modules/next/dist/bin/next dev -H 0.0.0.0 -p ${FRONTEND_PORT:-3782}"\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'directory=/app/web\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'autostart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'autorestart=true\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'startsecs=5\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stdout_logfile=/dev/fd/1\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stdout_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stderr_logfile=/dev/fd/2\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'stderr_logfile_maxbytes=0\n' >> /etc/supervisor/conf.d/novusorbit.conf && \
#     printf 'environment=NODE_ENV="development"\n' >> /etc/supervisor/conf.d/novusorbit.conf

# # Development ports
# EXPOSE 8001 3782