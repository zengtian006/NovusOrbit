#!/bin/bash
# ============================================
# NovusOrbit EC2 Deployment Script
# ============================================
# Usage: ./deploy.sh [OPTIONS]
#   -r REGION    AWS region (default: us-east-1)
#   -t TAG       Docker image tag (default: latest)
#   -s           Skip Terraform (just push image and update)
#   -h           Show help
# ============================================

set -e

# Defaults
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-novusorbit}"
ENVIRONMENT="${ENVIRONMENT:-production}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SKIP_TERRAFORM=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy NovusOrbit to a single EC2 instance

OPTIONS:
    -r REGION    AWS region (default: us-east-1)
    -t TAG       Docker image tag (default: latest)
    -s           Skip Terraform (just push image and update EC2)
    -h           Show this help

EXAMPLES:
    ./deploy.sh                    # Full deploy (terraform + docker push + update)
    ./deploy.sh -s                 # Just push new image and update EC2
    ./deploy.sh -t v1.0.0          # Deploy with specific tag
EOF
    exit 1
}

while getopts "r:t:sh" opt; do
    case $opt in
        r) AWS_REGION="$OPTARG" ;;
        t) IMAGE_TAG="$OPTARG" ;;
        s) SKIP_TERRAFORM=true ;;
        h) usage ;;
        *) usage ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

print_info "============================================"
print_info "NovusOrbit EC2 Deployment"
print_info "============================================"
print_info "Region:     $AWS_REGION"
print_info "Image Tag:  $IMAGE_TAG"

# Verify AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$ACCOUNT_ID" ]; then
    print_error "AWS credentials not configured. Run: aws configure"
    exit 1
fi
print_info "AWS Account: $ACCOUNT_ID"

# ---- Step 1: Terraform (optional) ----
if [ "$SKIP_TERRAFORM" = false ]; then
    print_info ""
    print_info "Step 1: Running Terraform..."
    cd "$SCRIPT_DIR"

    if [ ! -f "terraform.tfvars" ]; then
        print_error "terraform.tfvars not found. Copy terraform.tfvars.example and fill in values."
        exit 1
    fi

    terraform init -upgrade
    terraform plan -out=tfplan
    
    read -p "Apply Terraform changes? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply tfplan
    else
        print_warn "Terraform apply skipped."
    fi
    rm -f tfplan
else
    print_info "Skipping Terraform (flag -s)."
fi

# ---- Step 2: Get ECR repo URL ----
cd "$SCRIPT_DIR"
ECR_REPO=$(terraform output -raw ecr_repository_url 2>/dev/null)
INSTANCE_ID=$(terraform output -raw instance_id 2>/dev/null)

if [ -z "$ECR_REPO" ] || [ -z "$INSTANCE_ID" ]; then
    print_error "Cannot read Terraform outputs. Run without -s first."
    exit 1
fi

print_info ""
print_info "Step 2: Building and pushing Docker image..."
print_info "ECR Repo: $ECR_REPO"

# Login to ECR
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Build
cd "$PROJECT_ROOT"
print_info "Building Docker image..."
docker build -t "$PROJECT_NAME" .

# Tag and push
docker tag "$PROJECT_NAME:latest" "$ECR_REPO:$IMAGE_TAG"
print_info "Pushing to ECR..."
docker push "$ECR_REPO:$IMAGE_TAG"

# ---- Step 3: Update EC2 instance ----
print_info ""
print_info "Step 3: Updating EC2 instance..."
print_info "Instance: $INSTANCE_ID"

COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[\"/opt/novusorbit/update.sh\"]" \
    --region "$AWS_REGION" \
    --query "Command.CommandId" \
    --output text)

print_info "SSM Command ID: $COMMAND_ID"
print_info "Waiting for update to complete..."

# Wait for command to finish (up to 5 minutes)
for i in $(seq 1 30); do
    STATUS=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query "Status" --output text 2>/dev/null || echo "Pending")
    
    if [ "$STATUS" = "Success" ]; then
        print_info "Update completed successfully!"
        break
    elif [ "$STATUS" = "Failed" ] || [ "$STATUS" = "TimedOut" ]; then
        print_error "Update failed with status: $STATUS"
        print_error "Check logs: aws ssm get-command-invocation --command-id $COMMAND_ID --instance-id $INSTANCE_ID --region $AWS_REGION"
        exit 1
    fi
    
    sleep 10
done

# ---- Done ----
APP_URL=$(cd "$SCRIPT_DIR" && terraform output -raw app_url 2>/dev/null)
print_info ""
print_info "============================================"
print_info "Deployment Complete!"
print_info "============================================"
print_info "App URL: $APP_URL"
print_info ""
print_info "Useful commands:"
print_info "  SSH:  $(cd "$SCRIPT_DIR" && terraform output -raw ssm_command 2>/dev/null)"
print_info "  Logs: docker logs novusorbit"
print_info "============================================"
