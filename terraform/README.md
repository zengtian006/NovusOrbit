# NovusOrbit AWS ECS Fargate Deployment

This directory contains Terraform configuration to deploy NovusOrbit to AWS ECS Fargate.

## Architecture

The deployment includes:

- **VPC**: Multi-AZ setup with public and private subnets
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: For routing traffic to frontend and backend
- **ECR**: Container image registry
- **EFS**: Persistent storage for user data and knowledge bases
- **Secrets Manager**: Secure storage for API keys and credentials
- **CloudWatch**: Logging and monitoring
- **Auto Scaling**: Automatic scaling based on CPU/memory utilization

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Terraform** >= 1.5 installed
4. **Docker** installed for building images
5. **MongoDB Atlas** account (or AWS DocumentDB)

## Setup Instructions

### 1. Configure Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your configuration:

```hcl
# Required: Update these values
aws_region   = "us-east-1"
llm_api_key  = "sk-your-openai-key"
embedding_api_key = "sk-your-embedding-key"
database_url = "mongodb+srv://user:pass@cluster.mongodb.net/db"
nextauth_secret = "your-nextauth-secret"

# Optional: Add custom domain and SSL certificate
# domain_name = "novusorbit.example.com"
# certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
```

**Generate NextAuth Secret:**
```bash
openssl rand -base64 32
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review Infrastructure Plan

```bash
terraform plan
```

This will show you all the resources that will be created.

### 4. Apply Configuration

```bash
terraform apply
```

Type `yes` when prompted to create the resources.

This will take 10-15 minutes to provision all AWS resources.

### 5. Build and Push Docker Image

After Terraform completes, build and push your Docker image:

```bash
# From the project root directory
cd ..

# Login to ECR (use the command from Terraform output)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build the Docker image
docker build -t novusorbit .

# Tag the image
docker tag novusorbit:latest <ecr-repository-url>:latest

# Push to ECR
docker push <ecr-repository-url>:latest

# Update ECS service to deploy
aws ecs update-service --cluster novusorbit-production --service novusorbit-production --force-new-deployment --region us-east-1
```

**Tip:** The Terraform output includes a `deployment_command` with the exact commands for your setup.

### 6. Access Your Application

Get the Application Load Balancer DNS name:

```bash
terraform output alb_dns_name
```

Access your application:
- **Frontend**: `http://<alb-dns-name>`
- **Backend API**: `http://<alb-dns-name>/api`
- **API Docs**: `http://<alb-dns-name>/docs`

## Custom Domain Setup

To use a custom domain:

1. **Create SSL Certificate** in AWS Certificate Manager (ACM):
   - Go to ACM in the AWS Console
   - Request a certificate for your domain
   - Validate domain ownership (DNS or email)

2. **Update terraform.tfvars**:
   ```hcl
   domain_name     = "novusorbit.example.com"
   certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
   ```

3. **Apply changes**:
   ```bash
   terraform apply
   ```

4. **Update DNS**:
   - Create a CNAME record pointing to the ALB DNS name
   - Or use Route 53 alias record (recommended)

## Monitoring and Logs

### CloudWatch Logs

View application logs:

```bash
aws logs tail /ecs/novusorbit-production --follow --region us-east-1
```

Or access via AWS Console: CloudWatch → Log groups → `/ecs/novusorbit-production`

### CloudWatch Alarms

The following alarms are configured:
- High CPU utilization (>85%)
- High memory utilization (>85%)
- Unhealthy backend targets
- Unhealthy frontend targets

### Container Insights

ECS Container Insights is enabled for detailed metrics on:
- CPU usage
- Memory usage
- Network traffic
- Storage usage

## Scaling

### Manual Scaling

Update desired count in `terraform.tfvars`:

```hcl
desired_count = 4
```

Apply changes:

```bash
terraform apply
```

### Auto Scaling

Auto scaling is enabled by default and will automatically adjust the number of tasks based on:
- CPU utilization (target: 75%)
- Memory utilization (target: 75%)

Configure in `terraform.tfvars`:

```hcl
enable_autoscaling   = true
min_capacity         = 1
max_capacity         = 10
cpu_target_value     = 75
memory_target_value  = 75
```

## Cost Optimization

### Use Fargate Spot

To reduce costs, you can use Fargate Spot for non-critical workloads. Update the capacity provider strategy in `ecs.tf`.

### Adjust Resources

Reduce task size if your application doesn't need 2 vCPU / 4 GB:

```hcl
task_cpu    = 1024  # 1 vCPU
task_memory = 2048  # 2 GB
```

### Enable EFS Lifecycle

EFS automatically transitions infrequently accessed files to lower-cost storage after 30 days (configured in `efs.tf`).

## Continuous Deployment

### Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: novusorbit-production
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster novusorbit-production \
            --service novusorbit-production \
            --force-new-deployment
```

## Backup and Disaster Recovery

### EFS Backups

Enable AWS Backup for EFS:

```bash
# Add to your Terraform configuration or enable in AWS Console
# CloudFormation or AWS Backup console
```

### Database Backups

For MongoDB Atlas:
- Enable automated backups in Atlas dashboard
- Configure backup retention policy
- Test restore procedures

## Troubleshooting

### Task Fails to Start

Check CloudWatch logs:

```bash
aws logs tail /ecs/novusorbit-production --follow --region us-east-1
```

Common issues:
- Missing environment variables
- Secrets not accessible
- Image pull errors
- Health check failures

### Connection Timeout

Check security groups:

```bash
terraform output security_group_id
```

Ensure:
- ALB security group allows inbound on ports 80/443
- ECS tasks security group allows inbound from ALB
- ECS tasks security group allows outbound to internet

### High Costs

Monitor costs:
- Check CloudWatch metrics for scaling events
- Review ECS task count
- Consider using Fargate Spot
- Enable EFS lifecycle policies

## Cleaning Up

To destroy all resources:

```bash
terraform destroy
```

**Warning:** This will delete all data in EFS. Back up important data first.

## Support

For issues or questions:
- Check CloudWatch logs
- Review ECS service events in AWS Console
- Consult [NovusOrbit documentation](../README.md)

## Security Best Practices

1. **Never commit** `terraform.tfvars` to version control
2. **Rotate secrets** regularly in Secrets Manager
3. **Enable MFA** on AWS account
4. **Restrict IAM permissions** to minimum required
5. **Enable AWS CloudTrail** for audit logs
6. **Use VPC Flow Logs** for network monitoring
7. **Keep Terraform state** in encrypted S3 bucket

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
