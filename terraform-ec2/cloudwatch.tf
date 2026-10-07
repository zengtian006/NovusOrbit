# ============================================
# CloudWatch Log Group (minimal)
# ============================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ec2/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-logs"
  }
}
