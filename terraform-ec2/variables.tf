# ============================================
# Variables
# ============================================

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "novusorbit"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# EC2 Configuration
variable "instance_type" {
  description = "EC2 instance type (t3.small is good for ~10 concurrent users)"
  type        = string
  default     = "t3.small" # 2 vCPU, 2 GB RAM — ~$15/month
}

variable "volume_size" {
  description = "EBS root volume size in GB"
  type        = number
  default     = 30
}

variable "ssh_key_name" {
  description = "Name of existing EC2 key pair for SSH access (leave empty to skip SSH)"
  type        = string
  default     = ""
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH (default: nowhere)"
  type        = list(string)
  default     = []
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name (e.g., novusorbit.com). Leave empty if not using custom domain"
  type        = string
  default     = ""
}

# Application Ports
variable "backend_port" {
  description = "Backend API port"
  type        = number
  default     = 8001
}

variable "frontend_port" {
  description = "Frontend web port"
  type        = number
  default     = 3782
}

# Docker Configuration
variable "docker_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# LLM Configuration
variable "llm_binding" {
  type    = string
  default = "openai"
}

variable "llm_model" {
  type    = string
  default = "gpt-4o"
}

variable "llm_host" {
  type    = string
  default = "https://api.openai.com/v1"
}

variable "llm_api_key" {
  type      = string
  sensitive = true
}

# Embedding Configuration
variable "embedding_binding" {
  type    = string
  default = "openai"
}

variable "embedding_model" {
  type    = string
  default = "text-embedding-3-small"
}

variable "embedding_host" {
  type    = string
  default = "https://api.openai.com/v1"
}

variable "embedding_dimension" {
  type    = number
  default = 1536
}

variable "embedding_api_key" {
  type      = string
  sensitive = true
}

# Database
variable "database_url" {
  type      = string
  sensitive = true
}

# Auth
variable "nextauth_secret" {
  type      = string
  sensitive = true
}

variable "google_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "google_client_secret" {
  type      = string
  sensitive = true
  default   = ""
}

# Optional services
variable "search_provider" {
  type    = string
  default = "perplexity"
}

variable "search_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "tts_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "tts_model" {
  type    = string
  default = "tts-1"
}

# SMTP
variable "smtp_user" {
  type      = string
  sensitive = true
  default   = ""
}

variable "smtp_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "smtp_server" {
  type    = string
  default = "smtp.gmail.com"
}

variable "smtp_port" {
  type    = number
  default = 587
}

variable "feedback_email_from" {
  type    = string
  default = "noreply@novusorbit.com"
}

# Logging
variable "log_retention_days" {
  description = "CloudWatch logs retention in days"
  type        = number
  default     = 7
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
