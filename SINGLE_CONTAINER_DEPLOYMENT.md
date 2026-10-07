# Single-Container ECS Fargate Deployment Guide

## Overview

Your NovusOrbit application is configured for **single-container deployment** where both the FastAPI backend and Next.js frontend run in the same ECS Fargate task. This setup uses internal `localhost` communication for efficiency.

## Architecture

```
┌─────────────────────────────────────────┐
│         AWS Application Load Balancer   │
│                                         │
│  Port 3782 → Frontend (Next.js)         │
│  Port 8001 → Backend (FastAPI)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      ECS Fargate Container              │
│  ┌────────────────┐  ┌────────────────┐ │
│  │  Next.js       │  │  FastAPI       │ │
│  │  Port: 3782    │──▶  Port: 8001    │ │
│  │                │  │                │ │
│  └────────────────┘  └────────────────┘ │
│                                         │
│  Internal Communication: localhost:8001 │
└─────────────────────────────────────────┘
```

## Key Configuration Changes

### 1. Dockerfile Startup Script
- **Default behavior**: Frontend connects to `http://localhost:8001` for API calls
- **Efficient**: No external network hops, direct container-internal communication
- **Fallback**: If `NEXT_PUBLIC_API_BASE` is set, uses that value instead

### 2. Terraform ECS Configuration
- **Removed**: `NEXT_PUBLIC_API_BASE_EXTERNAL` environment variable
- **Reason**: Prevents frontend from routing through external ALB for internal API calls
- **Result**: Frontend uses localhost by default (set by Dockerfile)

### 3. Docker Compose
- **Updated comments**: Clarifies single-container vs multi-container deployment
- **Default behavior**: Uses localhost unless explicitly overridden

## Deployment Steps

### Step 1: Rebuild and Push Docker Image

```bash
# Navigate to project root
cd /Users/tzeng/Development/NovusOrbit

# Build the Docker image with updated configuration
docker build -t novusorbit:latest -f Dockerfile .

# Test locally (optional)
docker run -p 8001:8001 -p 3782:3782 --env-file .env novusorbit:latest
```

### Step 2: Apply Terraform Changes

```bash
cd terraform

# Review the changes
terraform plan

# Apply the updated ECS task definition
terraform apply

# The key change: NEXT_PUBLIC_API_BASE_EXTERNAL env var is removed
```

### Step 3: Deploy to ECS

```bash
# Use the deployment script
./deploy.sh

# Or manually:
# 1. Login to ECR
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# 2. Tag and push
docker tag novusorbit:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/novusorbit-production:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/novusorbit-production:latest

# 3. Force new deployment
aws ecs update-service \
    --cluster novusorbit-production \
    --service novusorbit-production-service \
    --force-new-deployment \
    --region us-east-1
```

### Step 4: Verify Deployment

```bash
# Check task status
aws ecs describe-tasks \
    --cluster novusorbit-production \
    --tasks $(aws ecs list-tasks --cluster novusorbit-production --service-name novusorbit-production-service --query 'taskArns[0]' --output text) \
    --region us-east-1

# View logs
aws logs tail /aws/ecs/novusorbit-production --follow --region us-east-1

# Test endpoints
curl http://<ALB_DNS_NAME>:8001/     # Backend health check
curl http://<ALB_DNS_NAME>:3782/     # Frontend
```

## Environment Variable Reference

### Required in ECS Task Definition
| Variable | Value | Purpose |
|----------|-------|---------|
| `BACKEND_PORT` | `8001` | FastAPI backend port |
| `FRONTEND_PORT` | `3782` | Next.js frontend port |
| `NODE_ENV` | `production` | Next.js environment |
| `NEXTAUTH_URL` | `http://<ALB_DNS>` | NextAuth callback URL |

### NOT Set (Uses Dockerfile Default)
| Variable | Default | Why Not Set? |
|----------|---------|--------------|
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8001` | Let Dockerfile default to localhost for internal communication |
| `NEXT_PUBLIC_API_BASE_EXTERNAL` | N/A (deprecated) | Causes inefficient external routing |

## Troubleshooting

### Issue: Frontend can't reach backend

**Symptoms:**
- API calls fail with connection errors
- Seeing old placeholder URLs like `PLACEHOLDER_API_HOST`

**Solution:**
1. Ensure you've deployed the updated Docker image
2. Force a new ECS deployment to use the latest image
3. Check logs for startup messages showing API URL configuration

```bash
# Check what the frontend is using
aws logs filter-pattern "[Frontend]" \
    --log-group-name /aws/ecs/novusorbit-production \
    --region us-east-1
```

### Issue: Old environment variables lingering

**Solution:**
1. Check ECS task definition for old env vars
2. Update terraform and reapply
3. Force new deployment

```bash
# View current env vars
aws ecs describe-task-definition \
    --task-definition novusorbit-production \
    --query 'taskDefinition.containerDefinitions[0].environment' \
    --region us-east-1
```

### Issue: Need to use external API URL

**When:** Multi-container deployment or separate API service

**Solution:**
Set `NEXT_PUBLIC_API_BASE` in terraform:

```terraform
environment = [
  # ... other vars ...
  { name = "NEXT_PUBLIC_API_BASE", value = "https://api.yourdomain.com" }
]
```

## Performance Benefits

Using localhost for internal communication provides:
- **Lower latency**: No network hop through ALB
- **Reduced costs**: Less ALB data transfer
- **Better reliability**: No dependency on external network
- **Simplified security**: No need for container to reach its own ALB

## Next Steps

1. ✅ Dockerfile updated with single-container optimizations
2. ✅ Terraform ECS configuration fixed
3. ✅ Docker Compose comments updated
4. ⏭️ Rebuild and deploy the updated image
5. ⏭️ Monitor logs to confirm localhost usage
6. ⏭️ Test application functionality

## Support

If you encounter issues:
1. Check CloudWatch logs: `/aws/ecs/novusorbit-production`
2. Verify ECS task health in AWS console
3. Test ALB target groups are healthy
4. Review security group rules (should allow internal container communication)
