#!/bin/bash

# ============================================
# NovusOrbit AWS ECS Deployment Script
# ============================================
# This script automates the deployment process to AWS ECS Fargate
#
# Prerequisites:
# 1. Terraform applied successfully
# 2. AWS CLI configured
# 3. Docker installed
#
# Usage: ./deploy.sh [OPTIONS]
# Options:
#   -r REGION    AWS region (default: us-east-1)
#   -e ENV       Environment (default: production)
#   -t TAG       Docker image tag (default: latest)
#   -h           Show help
# ============================================

set -e

# Default values
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
PROJECT_NAME="${PROJECT_NAME:-novusorbit}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy NovusOrbit to AWS ECS Fargate

OPTIONS:
    -r REGION    AWS region (default: us-east-1)
    -e ENV       Environment (default: production)
    -t TAG       Docker image tag (default: latest)
    -p PROJECT   Project name (default: novusorbit)
    -h           Show this help message

ENVIRONMENT VARIABLES:
    AWS_REGION       AWS region
    ENVIRONMENT      Deployment environment
    PROJECT_NAME     Project name
    IMAGE_TAG        Docker image tag

EXAMPLES:
    ./deploy.sh
    ./deploy.sh -r us-west-2 -e staging -t v1.0.0
    AWS_REGION=eu-west-1 ./deploy.sh

EOF
    exit 1
}

# Parse command line arguments
while getopts "r:e:t:p:h" opt; do
    case $opt in
        r) AWS_REGION="$OPTARG" ;;
        e) ENVIRONMENT="$OPTARG" ;;
        t) IMAGE_TAG="$OPTARG" ;;
        p) PROJECT_NAME="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Derived variables
CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
SERVICE_NAME="${PROJECT_NAME}-${ENVIRONMENT}"

print_info "============================================"
print_info "NovusOrbit Deployment to AWS ECS"
print_info "============================================"
print_info "AWS Region: $AWS_REGION"
print_info "Environment: $ENVIRONMENT"
print_info "Project: $PROJECT_NAME"
print_info "Image Tag: $IMAGE_TAG"
print_info "Cluster: $CLUSTER_NAME"
print_info "Service: $SERVICE_NAME"
print_info "============================================"

# Check prerequisites
print_info "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

print_info "Prerequisites check passed ✓"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_info "AWS Account ID: $ACCOUNT_ID"

# ECR repository URL
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${CLUSTER_NAME}"
print_info "ECR Repository: $ECR_REPO"

# Check if ECR repository exists
print_info "Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names "$CLUSTER_NAME" --region "$AWS_REGION" &> /dev/null; then
    print_error "ECR repository not found. Please run 'terraform apply' first."
    exit 1
fi

# Login to ECR
print_info "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

if [ $? -eq 0 ]; then
    print_info "ECR login successful ✓"
else
    print_error "ECR login failed"
    exit 1
fi

# Build Docker image
print_info "Building Docker image..."
cd "$(dirname "$0")/.."  # Go to project root
docker build -t "$PROJECT_NAME" -f Dockerfile .

if [ $? -eq 0 ]; then
    print_info "Docker build successful ✓"
else
    print_error "Docker build failed"
    exit 1
fi

# Tag image
print_info "Tagging Docker image..."
docker tag "$PROJECT_NAME:latest" "$ECR_REPO:$IMAGE_TAG"
docker tag "$PROJECT_NAME:latest" "$ECR_REPO:latest"

# Push image to ECR
print_info "Pushing image to ECR..."
docker push "$ECR_REPO:$IMAGE_TAG"
docker push "$ECR_REPO:latest"

if [ $? -eq 0 ]; then
    print_info "Docker push successful ✓"
else
    print_error "Docker push failed"
    exit 1
fi

# Get current task definition
print_info "Getting current task definition..."
TASK_FAMILY="${CLUSTER_NAME}"

# Update ECS service
print_info "Updating ECS service..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

if [ $? -eq 0 ]; then
    print_info "ECS service update initiated ✓"
else
    print_error "ECS service update failed"
    exit 1
fi

# Wait for deployment to complete
print_info "Waiting for deployment to complete..."
print_warn "This may take 5-10 minutes. You can press Ctrl+C to skip waiting."
print_warn "The deployment will continue in the background."

aws ecs wait services-stable \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --region "$AWS_REGION" 2>/dev/null &

WAIT_PID=$!

# Show deployment progress
while kill -0 $WAIT_PID 2>/dev/null; do
    RUNNING_COUNT=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query 'services[0].runningCount' \
        --output text)
    
    DESIRED_COUNT=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query 'services[0].desiredCount' \
        --output text)
    
    print_info "Running tasks: $RUNNING_COUNT / $DESIRED_COUNT"
    sleep 10
done

wait $WAIT_PID
WAIT_STATUS=$?

if [ $WAIT_STATUS -eq 0 ]; then
    print_info "Deployment completed successfully ✓"
else
    print_warn "Wait timed out or was interrupted, but deployment continues in background"
fi

# Get load balancer URL
print_info "Getting application URL..."
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --region "$AWS_REGION" \
    --query "LoadBalancers[?contains(LoadBalancerName, '$PROJECT_NAME')].DNSName" \
    --output text | head -1)

# Check if domain is configured in terraform
cd "$(dirname "$0")"  # Go to terraform directory
DOMAIN_NAME=$(terraform output -raw domain_name 2>/dev/null || echo "")
CERT_ARN=$(terraform output -raw certificate_arn 2>/dev/null || echo "")

# Determine the application URL
if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "null" ] && [ "$DOMAIN_NAME" != '""' ]; then
    # Custom domain configured
    if [ -n "$CERT_ARN" ] && [ "$CERT_ARN" != "null" ]; then
        PROTOCOL="https"
        print_info "Custom domain configured with HTTPS"
        
        # Check certificate status
        CERT_STATUS=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --region "$AWS_REGION" \
            --query 'Certificate.Status' \
            --output text 2>/dev/null || echo "UNKNOWN")
        
        if [ "$CERT_STATUS" = "ISSUED" ]; then
            print_info "SSL Certificate: ✓ Valid (Issued)"
        elif [ "$CERT_STATUS" = "PENDING_VALIDATION" ]; then
            print_warn "SSL Certificate: ⏳ Pending DNS validation"
            print_warn "Check Route53 for validation records"
        else
            print_warn "SSL Certificate Status: $CERT_STATUS"
        fi
    else
        PROTOCOL="http"
        print_warn "Custom domain configured but no SSL certificate"
    fi
    BASE_URL="$PROTOCOL://$DOMAIN_NAME"
    WWW_URL="$PROTOCOL://www.$DOMAIN_NAME"
else
    # Using ALB DNS
    PROTOCOL="http"
    BASE_URL="$PROTOCOL://$ALB_DNS"
    WWW_URL=""
    print_info "Using ALB DNS (no custom domain)"
fi

if [ -n "$ALB_DNS" ]; then
    print_info ""
    print_info "============================================"
    print_info "Deployment Summary"
    print_info "============================================"
    print_info "Cluster:      $CLUSTER_NAME"
    print_info "Service:      $SERVICE_NAME"
    print_info "Image Tag:    $IMAGE_TAG"
    print_info ""
    
    if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "null" ] && [ "$DOMAIN_NAME" != '""' ]; then
        print_info "🌐 Application URLs:"
        print_info "   Root Domain:  $BASE_URL"
        if [ -n "$WWW_URL" ]; then
            print_info "   WWW Domain:   $WWW_URL"
        fi
        print_info "   Backend API:  $BASE_URL/api/v1"
        print_info "   API Docs:     $BASE_URL/docs"
        print_info ""
        print_info "🔗 Direct ALB Access (bypass DNS):"
        print_info "   ALB URL:      http://$ALB_DNS"
    else
        print_info "🌐 Application URLs:"
        print_info "   Frontend:     $BASE_URL"
        print_info "   Backend API:  $BASE_URL/api/v1"
        print_info "   API Docs:     $BASE_URL/docs"
    fi
    
    print_info ""
    print_info "🔐 Authentication:"
    print_info "   NextAuth:     $BASE_URL/api/auth/signin"
    if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "null" ]; then
        print_info "   ⚠️  Update Google OAuth redirect URI to:"
        print_info "       $BASE_URL/api/auth/callback/google"
    fi
    
    print_info "============================================"
else
    print_warn "Could not retrieve load balancer URL"
fi

# Show service status
print_info ""
print_info "📊 Monitoring Commands:"
print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "Check service status:"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION"

print_info ""
print_info "View live logs (frontend + backend):"
echo "  aws logs tail /ecs/$CLUSTER_NAME --follow --region $AWS_REGION"

print_info ""
print_info "View recent errors only:"
echo "  aws logs tail /ecs/$CLUSTER_NAME --since 10m --format short | grep -i error"

if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "null" ] && [ "$DOMAIN_NAME" != '""' ]; then
    print_info ""
    print_info "📋 DNS/Certificate Commands:"
    print_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_info "Check DNS records:"
    echo "  dig $DOMAIN_NAME"
    echo "  dig www.$DOMAIN_NAME"
    
    if [ -n "$CERT_ARN" ] && [ "$CERT_ARN" != "null" ]; then
        print_info ""
        print_info "Check certificate status:"
        echo "  aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION"
    fi
fi

print_info ""
print_info "✅ Deployment script completed!"
print_info ""

# Final health check
if [ -n "$BASE_URL" ]; then
    print_info "🏥 Running health check..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$BASE_URL" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        print_info "Health check: ✓ Application is responding (HTTP $HTTP_CODE)"
    elif [ "$HTTP_CODE" = "000" ]; then
        print_warn "Health check: ⏳ Application not yet accessible (DNS may still be propagating)"
    else
        print_warn "Health check: ⚠️  Received HTTP $HTTP_CODE (service may still be starting)"
    fi
fi
