# ============================================
# Outputs
# ============================================

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Application URL"
  value       = var.domain_name != "" ? "https://www.${var.domain_name}" : "http://${aws_eip.app.public_ip}"
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "ssh_command" {
  description = "SSH command (if key pair configured)"
  value       = var.ssh_key_name != "" ? "ssh -i ~/.ssh/${var.ssh_key_name}.pem ec2-user@${aws_eip.app.public_ip}" : "Use SSM Session Manager: aws ssm start-session --target ${aws_instance.app.id}"
}

output "ssm_command" {
  description = "SSM Session Manager command (no SSH key needed)"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}

output "update_command" {
  description = "Command to update the app on the EC2 instance"
  value       = "aws ssm send-command --instance-ids ${aws_instance.app.id} --document-name AWS-RunShellScript --parameters 'commands=[\"/opt/novusorbit/update.sh\"]' --region ${var.aws_region}"
}

output "deployment_command" {
  description = "Full deployment steps"
  value       = <<-EOT
    # 1. Login to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com

    # 2. Build and push image
    docker build -t ${var.project_name} .
    docker tag ${var.project_name}:latest ${aws_ecr_repository.app.repository_url}:${var.docker_image_tag}
    docker push ${aws_ecr_repository.app.repository_url}:${var.docker_image_tag}

    # 3. Update app on EC2 (via SSM — no SSH needed)
    aws ssm send-command \
      --instance-ids ${aws_instance.app.id} \
      --document-name AWS-RunShellScript \
      --parameters 'commands=["/opt/novusorbit/update.sh"]' \
      --region ${var.aws_region}
  EOT
}

output "estimated_monthly_cost" {
  description = "Estimated monthly AWS cost"
  value       = <<-EOT
    EC2 t3.small (on-demand):  ~$15/month
    EBS 30GB gp3:              ~$2.40/month
    Route53 hosted zone:       ~$0.50/month
    Elastic IP (attached):     $0
    ECR storage:               ~$0.10/month
    Secrets Manager:           ~$0.40/month
    CloudWatch Logs:           ~$0-2/month
    -----------------------------------
    Total:                     ~$18-20/month
    
    With 1-year Savings Plan:  ~$10-12/month
  EOT
}
