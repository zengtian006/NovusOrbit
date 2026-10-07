# AWS ECS Deployment Guide for NovusOrbit

This guide provides step-by-step instructions for deploying NovusOrbit to AWS ECS Fargate using Terraform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Deployment](#deployment)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **AWS Account** with appropriate IAM permissions
- **AWS CLI** (v2.x or later)
  ```bash
  aws --version
  ```
- **Terraform** (>= 1.5)
  ```bash
  terraform version
  ```
- **Docker** (>= 20.x)
  ```bash
  docker --version
  ```

### Required AWS Permissions

Your AWS user/role needs permissions for:
- VPC, Subnet, IGW, NAT Gateway
- ECS (Cluster, Service, Task Definition)
- ECR (Repository, Image)
- ALB (Load Balancer, Target Group, Listener)
- EFS (File System, Mount Target)
- IAM (Role, Policy)
- CloudWatch (Log Group, Alarm)
- Secrets Manager (Secret)

### Required External Services

- **MongoDB Atlas** (or AWS DocumentDB)
  - Create a cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
  - Get connection string
- **OpenAI API Key** (or other LLM provider)
- **Embedding API Key** (if different from LLM)

## Quick Start

```bash
# 1. Clone and navigate to terraform directory
cd terraform

# 2. Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize Terraform
terraform init

# 4. Review and apply
terraform plan
terraform apply

# 5. Deploy application
./deploy.sh
```

## Detailed Setup

### Step 1: Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# Test connection
aws sts get-caller-identity
```

### Step 2: Prepare Environment Variables

Create `terraform/terraform.tfvars`:

```hcl
# AWS Configuration
aws_region   = "us-east-1"
project_name = "novusorbit"
environment  = "production"

# LLM Configuration (Required)
llm_binding = "openai"
llm_model   = "gpt-4o"
llm_host    = "https://api.openai.com/v1"
llm_api_key = "sk-your-openai-key"

# Embedding Configuration (Required)
embedding_binding   = "openai"
embedding_model     = "text-embedding-3-small"
embedding_host      = "https://api.openai.com/v1"
embedding_dimension = 1536
embedding_api_key   = "sk-your-openai-key"

# Database (Required)
database_url = "mongodb+srv://user:pass@cluster.mongodb.net/novusorbit"

# NextAuth (Required)
nextauth_secret = "your-secret-here"  # Generate with: openssl rand -base64 32

# Google OAuth (Optional)
google_client_id     = "your-google-client-id"
google_client_secret = "your-google-client-secret"
```

**Generate NextAuth Secret:**

```bash
openssl rand -base64 32
```

### Step 3: Review Configuration

Key configuration options in `terraform.tfvars`:

```hcl
# Resource sizing
task_cpu      = 2048  # 2 vCPU
task_memory   = 4096  # 4 GB RAM
desired_count = 2     # Number of tasks

# Auto scaling
enable_autoscaling  = true
min_capacity        = 1
max_capacity        = 4
cpu_target_value    = 75
memory_target_value = 75

# Storage
enable_efs = true  # Persistent storage for user data
```

### Step 4: Initialize Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Validate configuration
terraform validate
```

### Step 5: Plan Infrastructure

```bash
# Review what will be created
terraform plan

# Save plan to file (optional)
terraform plan -out=tfplan
```

Expected resources (~40-50 resources):
- 1 VPC with subnets
- 2 NAT Gateways
- 1 Application Load Balancer
- 1 ECS Cluster
- 1 ECS Service
- 1 ECR Repository
- 2 EFS Access Points
- Multiple Security Groups
- IAM Roles and Policies
- CloudWatch Log Groups
- Secrets Manager Secret

### Step 6: Apply Configuration

```bash
# Apply changes
terraform apply

# Or use saved plan
terraform apply tfplan
```

This will take 10-15 minutes. Review the output for important information:

```
Outputs:

alb_dns_name = "novusorbit-production-alb-123456789.us-east-1.elb.amazonaws.com"
ecr_repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/novusorbit-production"
frontend_url = "http://novusorbit-production-alb-123456789.us-east-1.elb.amazonaws.com"
backend_url = "http://novusorbit-production-alb-123456789.us-east-1.elb.amazonaws.com/api"
```

## Deployment

### Option 1: Using Deploy Script (Recommended)

```bash
# From terraform directory
./deploy.sh
```

The script will:
1. Build Docker image
2. Push to ECR
3. Update ECS service
4. Wait for deployment
5. Display application URLs

### Option 2: Manual Deployment

```bash
# Get values from Terraform output
ECR_REPO=$(terraform output -raw ecr_repository_url)
AWS_REGION=$(terraform output -raw aws_region)
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
SERVICE_NAME=$(terraform output -raw ecs_service_name)

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REPO

# Build and push image (from project root)
cd ..
docker build -t novusorbit .
docker tag novusorbit:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Update ECS service
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region $AWS_REGION

# Wait for deployment
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION
```

## Post-Deployment

### Verify Deployment

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Test backend API
curl http://<alb-dns-name>/api

# Test frontend
open http://<alb-dns-name>
```

### View Logs

```bash
# Real-time logs
aws logs tail /ecs/novusorbit-production --follow --region us-east-1

# Last 10 minutes
aws logs tail /ecs/novusorbit-production --since 10m --region us-east-1
```

### Check Service Status

```bash
# ECS service status
aws ecs describe-services \
  --cluster novusorbit-production \
  --services novusorbit-production \
  --region us-east-1

# Task status
aws ecs list-tasks \
  --cluster novusorbit-production \
  --service-name novusorbit-production \
  --region us-east-1
```

### Configure Custom Domain (Optional)

1. **Request SSL Certificate in ACM:**
   ```bash
   aws acm request-certificate \
     --domain-name novusorbit.example.com \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Update `terraform.tfvars`:**
   ```hcl
   domain_name     = "novusorbit.example.com"
   certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
   ```

3. **Apply changes:**
   ```bash
   terraform apply
   ```

4. **Update DNS:**
   - Create CNAME record: `novusorbit.example.com` → `<alb-dns-name>`
   - Or use Route 53 A record (alias)

### Set Up CI/CD with GitHub Actions

1. **Create GitHub Secrets:**
   - Go to repository Settings → Secrets → Actions
   - Add secrets:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`

2. **Push code to trigger deployment:**
   ```bash
   git push origin main
   ```

The GitHub Actions workflow (`.github/workflows/deploy-ecs.yml`) will automatically deploy on push to main branch.

## Troubleshooting

### Issue: Task fails to start

**Symptoms:**
- Tasks start then stop immediately
- Service never reaches stable state

**Solutions:**

1. Check CloudWatch logs:
   ```bash
   aws logs tail /ecs/novusorbit-production --follow
   ```

2. Common causes:
   - Missing environment variables
   - Invalid secrets in Secrets Manager
   - Docker image not found
   - Health check failures

3. Check task definition:
   ```bash
   aws ecs describe-task-definition \
     --task-definition novusorbit-production
   ```

### Issue: Cannot access application

**Symptoms:**
- Load balancer returns 503/504 errors
- Connection timeout

**Solutions:**

1. Check target health:
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn <target-group-arn>
   ```

2. Check security groups:
   - ALB security group: allows inbound 80/443
   - ECS security group: allows inbound from ALB

3. Check ECS service events:
   ```bash
   aws ecs describe-services \
     --cluster novusorbit-production \
     --services novusorbit-production \
     --query 'services[0].events'
   ```

### Issue: High costs

**Solutions:**

1. **Reduce task size:**
   ```hcl
   task_cpu    = 1024  # 1 vCPU
   task_memory = 2048  # 2 GB
   ```

2. **Use Fargate Spot:**
   - Modify capacity provider strategy in `ecs.tf`

3. **Reduce desired count:**
   ```hcl
   desired_count = 1
   ```

4. **Enable EFS lifecycle:**
   - Already configured to move files to IA after 30 days

### Issue: Database connection fails

**Solutions:**

1. Check database URL format:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database
   ```

2. Verify MongoDB Atlas network access:
   - Add `0.0.0.0/0` to IP whitelist (or specific ECS NAT Gateway IPs)

3. Test connection from ECS task:
   ```bash
   aws ecs execute-command \
     --cluster novusorbit-production \
     --task <task-id> \
     --interactive \
     --command "/bin/bash"
   ```

## Maintenance

### Update Application

```bash
# Option 1: Use deploy script
./deploy.sh

# Option 2: GitHub Actions
git push origin main
```

### Scale Service

```bash
# Manually scale
aws ecs update-service \
  --cluster novusorbit-production \
  --service novusorbit-production \
  --desired-count 4
```

Or update `terraform.tfvars` and apply:

```hcl
desired_count = 4
```

```bash
terraform apply
```

### Update Secrets

```bash
# Update in Secrets Manager
aws secretsmanager update-secret \
  --secret-id novusorbit-production-secrets \
  --secret-string '{"LLM_API_KEY": "new-key"}'

# Force new deployment to pick up changes
aws ecs update-service \
  --cluster novusorbit-production \
  --service novusorbit-production \
  --force-new-deployment
```

### Backup Data

EFS data is automatically backed up if you enable AWS Backup. Manually backup:

```bash
# Create EFS backup
aws backup start-backup-job \
  --backup-vault-name Default \
  --resource-arn <efs-arn> \
  --iam-role-arn <backup-role-arn>
```

## Clean Up

To destroy all resources:

```bash
cd terraform

# Preview what will be destroyed
terraform plan -destroy

# Destroy resources
terraform destroy
```

**Warning:** This will permanently delete:
- All data in EFS
- Container images in ECR
- CloudWatch logs
- All AWS resources

## Cost Estimation

Approximate monthly costs (us-east-1, as of 2025):

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| ECS Fargate | 2 tasks x 2 vCPU x 4 GB | ~$120 |
| ALB | Standard | ~$25 |
| NAT Gateway | 2 AZs | ~$65 |
| EFS | 10 GB + requests | ~$5 |
| CloudWatch | Logs + metrics | ~$10 |
| Data Transfer | ~100 GB | ~$9 |
| **Total** | | **~$234/month** |

**Cost optimization tips:**
- Use 1 task instead of 2: saves ~$60/month
- Use Fargate Spot: saves ~30%
- Reduce task size (1 vCPU, 2 GB): saves ~$60/month
- Use single NAT Gateway: saves ~$32/month (less availability)

## Support

For issues or questions:
- Check [Terraform README](terraform/README.md)
- Review CloudWatch logs
- Consult [AWS ECS documentation](https://docs.aws.amazon.com/ecs/)
- Open an issue on GitHub

## Additional Resources

- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [ECS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
