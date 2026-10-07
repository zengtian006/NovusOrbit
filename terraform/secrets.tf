# Secrets Manager for sensitive environment variables
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}-${var.environment}-secrets"
  description             = "Application secrets for ${var.project_name}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    LLM_API_KEY          = var.llm_api_key
    EMBEDDING_API_KEY    = var.embedding_api_key
    DATABASE_URL         = var.database_url
    NEXTAUTH_SECRET      = var.nextauth_secret
    GOOGLE_CLIENT_ID     = var.google_client_id
    GOOGLE_CLIENT_SECRET = var.google_client_secret
    SEARCH_API_KEY       = var.search_api_key
    TTS_API_KEY          = var.tts_api_key
    SMTP_USER            = var.smtp_user
    SMTP_PASSWORD        = var.smtp_password
  })
}
