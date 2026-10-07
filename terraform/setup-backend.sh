#!/bin/bash

# ============================================
# Setup Terraform S3 Backend
# ============================================
# This script creates an S3 bucket and DynamoDB table
# for Terraform state management
#
# Usage: ./setup-backend.sh [OPTIONS]
# Options:
#   -r REGION    AWS region (default: us-east-1)
#   -b BUCKET    S3 bucket name (default: novusorbit-terraform-state)
#   -t TABLE     DynamoDB table name (default: terraform-state-lock)
#   -h           Show help
# ============================================

set -e

# Default values
AWS_REGION="${AWS_REGION:-us-east-1}"
BUCKET_NAME="${1:-novusorbit-terraform-state}"
TABLE_NAME="${2:-terraform-state-lock}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up Terraform S3 backend...${NC}"
echo "Region: $AWS_REGION"
echo "Bucket: $BUCKET_NAME"
echo "Table: $TABLE_NAME"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $ACCOUNT_ID"

# Create S3 bucket
echo -e "${GREEN}Creating S3 bucket...${NC}"
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Bucket already exists${NC}"
else
    if [ "$AWS_REGION" == "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    echo "Bucket created ✓"
fi

# Enable versioning
echo -e "${GREEN}Enabling versioning...${NC}"
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
echo "Versioning enabled ✓"

# Enable encryption
echo -e "${GREEN}Enabling encryption...${NC}"
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'
echo "Encryption enabled ✓"

# Block public access
echo -e "${GREEN}Blocking public access...${NC}"
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "Public access blocked ✓"

# Create DynamoDB table for state locking
echo -e "${GREEN}Creating DynamoDB table...${NC}"
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" 2>/dev/null; then
    echo -e "${YELLOW}Table already exists${NC}"
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region "$AWS_REGION"
    
    echo "Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$AWS_REGION"
    echo "Table created ✓"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Backend setup complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Update your main.tf with:"
echo ""
echo "terraform {"
echo "  backend \"s3\" {"
echo "    bucket         = \"$BUCKET_NAME\""
echo "    key            = \"production/terraform.tfstate\""
echo "    region         = \"$AWS_REGION\""
echo "    encrypt        = true"
echo "    dynamodb_table = \"$TABLE_NAME\""
echo "  }"
echo "}"
echo ""
echo "Then run:"
echo "  terraform init -migrate-state"
