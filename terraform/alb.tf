# Local variables for certificate resolution
locals {
  # Determine if HTTPS should be enabled
  https_enabled = var.domain_name != "" || var.certificate_arn != ""

  # Resolve the actual certificate ARN (either provided or auto-created)
  resolved_certificate_arn = var.certificate_arn != "" ? var.certificate_arn : (
    var.domain_name != "" ? try(aws_acm_certificate.main[0].arn, "") : ""
  )
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection       = false
  enable_http2                     = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-${var.environment}-frontend"
  port        = var.frontend_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = 60
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200-399"
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend-tg"
  }
}

# Target Group for Backend API
resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-${var.environment}-backend"
  port        = var.backend_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = var.health_check_interval
    timeout             = var.health_check_timeout
    healthy_threshold   = var.health_check_healthy_threshold
    unhealthy_threshold = var.health_check_unhealthy_threshold
    matcher             = "200-299"
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-tg"
  }
}

# HTTP Listener (redirect to HTTPS if certificate is provided or domain is configured)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = local.https_enabled ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = local.https_enabled ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    dynamic "forward" {
      for_each = local.https_enabled ? [] : [1]
      content {
        target_group {
          arn    = aws_lb_target_group.frontend.arn
          weight = 1
        }
      }
    }
  }
}

# HTTPS Listener (if certificate is provided or domain is configured)
resource "aws_lb_listener" "https" {
  count             = local.https_enabled ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.resolved_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  depends_on = [aws_acm_certificate_validation.main]
}

# Redirect non-www to www (canonical domain)
resource "aws_lb_listener_rule" "redirect_apex_to_www" {
  count        = var.domain_name != "" && local.https_enabled ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type = "redirect"

    redirect {
      host        = "www.${var.domain_name}"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = [var.domain_name]
    }
  }
}

# Listener Rule for Next.js API Routes (HTTP) - Higher priority to catch first
resource "aws_lb_listener_rule" "nextjs_api_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 90

  action {
    type             = var.certificate_arn != "" ? "redirect" : "forward"
    target_group_arn = var.certificate_arn == "" ? aws_lb_target_group.frontend.arn : null

    dynamic "redirect" {
      for_each = var.certificate_arn != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  condition {
    path_pattern {
      values = ["/api/auth/*", "/api/admin/*", "/api/analytics/*"]
    }
  }
}

# Listener Rule for Backend API (HTTP)
resource "aws_lb_listener_rule" "backend_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = var.certificate_arn != "" ? "redirect" : "forward"
    target_group_arn = var.certificate_arn == "" ? aws_lb_target_group.backend.arn : null

    dynamic "redirect" {
      for_each = var.certificate_arn != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  condition {
    path_pattern {
      values = ["/api/v1/*", "/api/outputs/*", "/docs", "/openapi.json"]
    }
  }
}

# Listener Rule for Next.js API Routes (HTTPS) - Higher priority to catch first
resource "aws_lb_listener_rule" "nextjs_api_https" {
  count        = local.https_enabled ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 90

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = ["/api/auth/*", "/api/admin/*", "/api/analytics/*"]
    }
  }
}

# Listener Rule for Backend API (HTTPS)
resource "aws_lb_listener_rule" "backend_https" {
  count        = local.https_enabled ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/v1/*", "/api/outputs/*", "/docs", "/openapi.json"]
    }
  }
}
