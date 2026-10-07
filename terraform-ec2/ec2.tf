# ============================================
# EC2 Instance — Single container host with Caddy
# ============================================

# Latest Amazon Linux 2023
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Determine the base URL for the app
locals {
  app_domain = var.domain_name != "" ? "www.${var.domain_name}" : ""
  base_url   = var.domain_name != "" ? "https://www.${var.domain_name}" : "http://${aws_eip.app.public_ip}"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.ssh_key_name != "" ? var.ssh_key_name : null

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.volume_size
    encrypted             = true
    delete_on_termination = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    aws_region          = var.aws_region
    project_name        = var.project_name
    environment         = var.environment
    ecr_repo_url        = aws_ecr_repository.app.repository_url
    ecr_registry        = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    image_tag           = var.docker_image_tag
    secret_arn          = aws_secretsmanager_secret.app_secrets.arn
    domain_name         = var.domain_name
    backend_port        = var.backend_port
    frontend_port       = var.frontend_port
    llm_binding         = var.llm_binding
    llm_model           = var.llm_model
    llm_host            = var.llm_host
    embedding_binding   = var.embedding_binding
    embedding_model     = var.embedding_model
    embedding_host      = var.embedding_host
    embedding_dimension = var.embedding_dimension
    search_provider     = var.search_provider
    tts_model           = var.tts_model
    smtp_server         = var.smtp_server
    smtp_port           = var.smtp_port
    feedback_email_from = var.feedback_email_from
  }))

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2
  }

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}
