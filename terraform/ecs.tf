# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

# Local variables for URL configuration
locals {
  # Use custom domain if configured (with www), otherwise use ALB DNS
  base_domain = var.domain_name != "" ? "www.${var.domain_name}" : aws_lb.main.dns_name

  # Use HTTPS if certificate is configured, otherwise HTTP
  protocol = var.certificate_arn != "" || var.domain_name != "" ? "https" : "http"

  # Full base URL
  base_url = "${local.protocol}://${local.base_domain}"
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  # Prefer FARGATE_SPOT for cost savings, keep 1 on-demand for stability
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 3
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-app"
      image     = "${aws_ecr_repository.app.repository_url}:${var.docker_image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.backend_port
          hostPort      = var.backend_port
          protocol      = "tcp"
          name          = "backend"
        },
        {
          containerPort = var.frontend_port
          hostPort      = var.frontend_port
          protocol      = "tcp"
          name          = "frontend"
        }
      ]

      environment = [
        { name = "BACKEND_PORT", value = tostring(var.backend_port) },
        { name = "FRONTEND_PORT", value = tostring(var.frontend_port) },
        { name = "LLM_BINDING", value = var.llm_binding },
        { name = "LLM_MODEL", value = var.llm_model },
        { name = "LLM_HOST", value = var.llm_host },
        { name = "EMBEDDING_BINDING", value = var.embedding_binding },
        { name = "EMBEDDING_MODEL", value = var.embedding_model },
        { name = "EMBEDDING_HOST", value = var.embedding_host },
        { name = "EMBEDDING_DIMENSION", value = tostring(var.embedding_dimension) },
        { name = "EMBEDDING_MAX_TOKENS", value = "8192" },
        { name = "SEARCH_PROVIDER", value = var.search_provider },
        { name = "TTS_MODEL", value = var.tts_model },
        { name = "TTS_URL", value = var.llm_host },
        { name = "TTS_VOICE", value = "alloy" },
        { name = "DISABLE_SSL_VERIFY", value = "false" },
        { name = "NODE_ENV", value = "production" },
        { name = "NEXTAUTH_URL", value = local.base_url },
        { name = "AUTH_URL", value = local.base_url },
        { name = "AUTH_TRUST_HOST", value = "true" },
        { name = "NEXT_PUBLIC_API_BASE", value = local.base_url },
        { name = "NEXT_PUBLIC_API_BASE_EXTERNAL", value = local.base_url },
        { name = "SMTP_SERVER", value = var.smtp_server },
        { name = "SMTP_PORT", value = tostring(var.smtp_port) },
        { name = "FEEDBACK_EMAIL_FROM", value = var.feedback_email_from }
      ]

      secrets = [
        {
          name      = "LLM_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:LLM_API_KEY::"
        },
        {
          name      = "EMBEDDING_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:EMBEDDING_API_KEY::"
        },
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::"
        },
        {
          name      = "NEXTAUTH_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:NEXTAUTH_SECRET::"
        },
        {
          name      = "GOOGLE_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GOOGLE_CLIENT_ID::"
        },
        {
          name      = "GOOGLE_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GOOGLE_CLIENT_SECRET::"
        },
        {
          name      = "SEARCH_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SEARCH_API_KEY::"
        },
        {
          name      = "TTS_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:TTS_API_KEY::"
        },
        {
          name      = "SMTP_USER"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SMTP_USER::"
        },
        {
          name      = "SMTP_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SMTP_PASSWORD::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      mountPoints = var.enable_efs ? [
        {
          sourceVolume  = "user-data"
          containerPath = "/app/data/user"
          readOnly      = false
        },
        {
          sourceVolume  = "knowledge-bases"
          containerPath = "/app/data/knowledge_bases"
          readOnly      = false
        }
      ] : []

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.backend_port}/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  dynamic "volume" {
    for_each = var.enable_efs ? [1] : []
    content {
      name = "user-data"

      efs_volume_configuration {
        file_system_id     = aws_efs_file_system.app[0].id
        transit_encryption = "ENABLED"
        authorization_config {
          access_point_id = aws_efs_access_point.user_data[0].id
          iam             = "ENABLED"
        }
      }
    }
  }

  dynamic "volume" {
    for_each = var.enable_efs ? [1] : []
    content {
      name = "knowledge-bases"

      efs_volume_configuration {
        file_system_id     = aws_efs_file_system.app[0].id
        transit_encryption = "ENABLED"
        authorization_config {
          access_point_id = aws_efs_access_point.knowledge_bases[0].id
          iam             = "ENABLED"
        }
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-task"
  }
}

# ECS Service
resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count

  platform_version = "LATEST"

  # Use capacity provider strategy for FARGATE_SPOT cost savings
  # 1 on-demand task for stability, rest on spot instances (70% cost reduction)
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 3
  }

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "${var.project_name}-app"
    container_port   = var.frontend_port
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "${var.project_name}-app"
    container_port   = var.backend_port
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  # Wait for ALB to be ready
  depends_on = [
    aws_lb_listener.http,
    aws_lb_target_group.frontend,
    aws_lb_target_group.backend
  ]

  tags = {
    Name = "${var.project_name}-${var.environment}-service"
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Auto Scaling Target
resource "aws_appautoscaling_target" "ecs" {
  count              = var.enable_autoscaling ? 1 : 0
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policy - CPU
resource "aws_appautoscaling_policy" "cpu" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${var.project_name}-${var.environment}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - Memory
resource "aws_appautoscaling_policy" "memory" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${var.project_name}-${var.environment}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.memory_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
