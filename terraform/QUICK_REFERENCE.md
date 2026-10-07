# AWS ECS Deployment - Quick Reference

## Initial Setup (One-time)

```bash
# 1. Configure AWS CLI
aws configure

# 2. Setup Terraform backend (optional but recommended)
cd terraform
./setup-backend.sh

# 3. Configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 4. Initialize and apply Terraform
terraform init
terraform plan
terraform apply

# 5. Deploy application
./deploy.sh
```

## Deploy Updates

```bash
# From terraform directory
./deploy.sh

# Or manually
cd ..
docker build -t novusorbit .
# ... push to ECR and update service
```

## Useful Commands

### View Logs
```bash
# Real-time logs
aws logs tail /ecs/novusorbit-production --follow --region us-east-1

# Filter logs
aws logs tail /ecs/novusorbit-production --filter-pattern "ERROR" --region us-east-1
```

### Check Service Status
```bash
# Service details
aws ecs describe-services \
  --cluster novusorbit-production \
  --services novusorbit-production \
  --region us-east-1

# Running tasks
aws ecs list-tasks \
  --cluster novusorbit-production \
  --region us-east-1
```

### Scale Service
```bash
# Quick scale
aws ecs update-service \
  --cluster novusorbit-production \
  --service novusorbit-production \
  --desired-count 4 \
  --region us-east-1
```

### Access Task (SSH equivalent)
```bash
# List tasks
TASK_ARN=$(aws ecs list-tasks \
  --cluster novusorbit-production \
  --service-name novusorbit-production \
  --region us-east-1 \
  --query 'taskArns[0]' --output text)

# Execute command in task
aws ecs execute-command \
  --cluster novusorbit-production \
  --task $TASK_ARN \
  --container novusorbit-app \
  --interactive \
  --command "/bin/bash" \
  --region us-east-1
```

### Update Secrets
```bash
# Update secret
aws secretsmanager update-secret \
  --secret-id novusorbit-production-secrets \
  --secret-string '{
    "LLM_API_KEY": "new-key",
    "DATABASE_URL": "mongodb+srv://..."
  }' \
  --region us-east-1

# Force redeployment
aws ecs update-service \
  --cluster novusorbit-production \
  --service novusorbit-production \
  --force-new-deployment \
  --region us-east-1
```

### Rollback Deployment
```bash
# List task definitions
aws ecs list-task-definitions \
  --family-prefix novusorbit-production \
  --region us-east-1

# Update to previous version
aws ecs update-service \
  --cluster novusorbit-production \
  --service novusorbit-production \
  --task-definition novusorbit-production:1 \
  --region us-east-1
```

### Infrastructure Updates
```bash
# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy everything (careful!)
terraform destroy
```

## Monitoring

### CloudWatch Dashboard
Browse to: CloudWatch → Dashboards → Container Insights → novusorbit-production

### Key Metrics
- CPU Utilization
- Memory Utilization
- Request Count
- Target Response Time
- Healthy Host Count

### Alarms
Browse to: CloudWatch → Alarms

Configured alarms:
- CPU high (>85%)
- Memory high (>85%)
- Unhealthy targets

## Costs

### View Current Costs
AWS Console → Cost Explorer → Filter by tag: `Project=novusorbit`

### Typical Monthly Costs
- **Small** (1 task, 1 vCPU, 2 GB): ~$90/month
- **Medium** (2 tasks, 2 vCPU, 4 GB): ~$235/month
- **Large** (4 tasks, 2 vCPU, 4 GB): ~$465/month

### Cost Optimization
```hcl
# In terraform.tfvars
task_cpu      = 1024  # Reduce to 1 vCPU
task_memory   = 2048  # Reduce to 2 GB
desired_count = 1     # Run single task
```

## Troubleshooting

### Task keeps restarting
```bash
# Check logs
aws logs tail /ecs/novusorbit-production --follow

# Check task stopped reason
aws ecs describe-tasks \
  --cluster novusorbit-production \
  --tasks <task-arn> \
  --region us-east-1
```

### 503 Errors
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>

# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=*novusorbit*"
```

### Cannot connect to database
1. Check MongoDB Atlas network access (whitelist 0.0.0.0/0)
2. Verify DATABASE_URL in secrets
3. Test from ECS task

### High costs
1. Check number of running tasks
2. Review NAT Gateway data transfer
3. Check ALB request count
4. Consider Fargate Spot

## Environment Variables

### Required
- `LLM_API_KEY`
- `LLM_MODEL`
- `EMBEDDING_API_KEY`
- `DATABASE_URL`
- `NEXTAUTH_SECRET`

### Optional
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SEARCH_API_KEY`
- `TTS_API_KEY`

## Files

```
terraform/
├── main.tf                 # Provider and backend configuration
├── variables.tf            # Variable definitions
├── terraform.tfvars        # Your values (DO NOT COMMIT)
├── outputs.tf              # Output values
├── vpc.tf                  # VPC and networking
├── security_groups.tf      # Security groups
├── alb.tf                  # Load balancer
├── ecs.tf                  # ECS cluster and service
├── ecr.tf                  # Container registry
├── efs.tf                  # File storage
├── iam.tf                  # IAM roles
├── secrets.tf              # Secrets Manager
├── cloudwatch.tf           # Logging and alarms
├── deploy.sh               # Deployment script
├── setup-backend.sh        # Backend setup script
└── README.md               # Detailed documentation
```

## Support

For detailed instructions, see:
- [Terraform README](terraform/README.md)
- [AWS Deployment Guide](DEPLOYMENT_AWS.md)
- [Main README](README.md)

## Quick Links

- [AWS ECS Console](https://console.aws.amazon.com/ecs)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
- [ECR Repositories](https://console.aws.amazon.com/ecr/repositories)
- [Cost Explorer](https://console.aws.amazon.com/cost-management/home#/cost-explorer)
