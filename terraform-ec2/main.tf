# ============================================
# NovusOrbit EC2 Deployment - Main Configuration
# ============================================
# Cost-optimized single EC2 instance deployment
# Estimated cost: ~$15-20/month (vs ~$250-300/month on Fargate)
#
# What's eliminated vs Fargate setup:
#   - ALB ($16/month)           -> Caddy reverse proxy (free)
#   - NAT Gateways ($64/month)  -> Public subnet (free)
#   - Fargate ($130/month)      -> t3.small EC2 ($15/month)
#   - EFS ($10/month)           -> EBS volume (included)
#   - Container Insights        -> CloudWatch basic (free tier)
# ============================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: Configure S3 backend for state management
  # backend "s3" {
  #   bucket         = "novusorbit-terraform-state"
  #   key            = "ec2/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}
