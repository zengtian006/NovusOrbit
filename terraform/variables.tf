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
  description = "Environment name (e.g., production, staging, dev)"
  type        = string
  default     = "production"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

# ECS Configuration
variable "task_cpu" {
  description = "CPU units for ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 2048 # 2 vCPU
}

variable "task_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 4096 # 4 GB
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 4
}

# Application Configuration
variable "backend_port" {
  description = "Port for the backend API"
  type        = number
  default     = 8001
}

variable "frontend_port" {
  description = "Port for the frontend web app"
  type        = number
  default     = 3782
}

variable "health_check_path" {
  description = "Health check path for the backend"
  type        = string
  default     = "/"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_healthy_threshold" {
  description = "Number of consecutive health checks to be considered healthy"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive health checks to be considered unhealthy"
  type        = number
  default     = 3
}

# Docker Configuration
variable "docker_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# Domain Configuration (Optional)
variable "domain_name" {
  description = "Domain name for the application (leave empty if not using custom domain)"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (leave empty for HTTP only)"
  type        = string
  default     = ""
}

# Environment Variables - Secrets
variable "llm_api_key" {
  description = "API key for LLM provider"
  type        = string
  sensitive   = true
}

variable "llm_binding" {
  description = "LLM provider binding (openai, azure_openai, etc.)"
  type        = string
  default     = "openai"
}

variable "llm_model" {
  description = "LLM model name"
  type        = string
  default     = "gpt-4o"
}

variable "llm_host" {
  description = "LLM API host"
  type        = string
  default     = "https://api.openai.com/v1"
}

variable "embedding_api_key" {
  description = "API key for embedding provider"
  type        = string
  sensitive   = true
}

variable "embedding_binding" {
  description = "Embedding provider binding"
  type        = string
  default     = "openai"
}

variable "embedding_model" {
  description = "Embedding model name"
  type        = string
  default     = "text-embedding-3-small"
}

variable "embedding_host" {
  description = "Embedding API host"
  type        = string
  default     = "https://api.openai.com/v1"
}

variable "embedding_dimension" {
  description = "Embedding vector dimension"
  type        = number
  default     = 1536
}

variable "database_url" {
  description = "MongoDB connection URL for NextAuth"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth secret key"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Optional Services
variable "search_provider" {
  description = "Search provider (perplexity, tavily, etc.)"
  type        = string
  default     = "perplexity"
}

variable "search_api_key" {
  description = "API key for search provider"
  type        = string
  sensitive   = true
  default     = ""
}

variable "tts_api_key" {
  description = "API key for TTS provider"
  type        = string
  sensitive   = true
  default     = ""
}

variable "tts_model" {
  description = "TTS model name"
  type        = string
  default     = "tts-1"
}

# SMTP Configuration for Email Notifications
variable "smtp_user" {
  description = "SMTP username for sending emails"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_password" {
  description = "SMTP password or app password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_server" {
  description = "SMTP server hostname"
  type        = string
  default     = "smtp.gmail.com"
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = number
  default     = 587
}

variable "feedback_email_from" {
  description = "From email address for feedback notifications"
  type        = string
  default     = "noreply@novusorbit.com"
}

# EFS Configuration
variable "enable_efs" {
  description = "Enable EFS for persistent storage"
  type        = bool
  default     = true
}

# CloudWatch Logs
variable "log_retention_days" {
  description = "CloudWatch logs retention in days"
  type        = number
  default     = 30
}

# Auto Scaling
variable "enable_autoscaling" {
  description = "Enable auto scaling for ECS service"
  type        = bool
  default     = true
}

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto scaling"
  type        = number
  default     = 75
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto scaling"
  type        = number
  default     = 75
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
