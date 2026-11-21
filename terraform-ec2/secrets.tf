# ============================================
# Secrets Manager (minimal — single secret)
# ============================================

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}-${var.environment}-secrets"
  description             = "Application secrets for ${var.project_name}"
  recovery_window_in_days = 0 # Immediate delete to avoid charges on old secrets

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

    # Complete .env for the app container. host/update.sh writes this to
    # /opt/novusorbit/.env on every deploy, so `terraform apply` followed by
    # `./deploy.sh -s` is all it takes to change any setting or secret.
    DOTENV = templatefile("${path.module}/templates/app.env.tftpl", {
      base_url             = local.base_url
      backend_port         = var.backend_port
      frontend_port        = var.frontend_port
      llm_binding          = var.llm_binding
      llm_model            = var.llm_model
      llm_host             = var.llm_host
      llm_api_key          = var.llm_api_key
      embedding_binding    = var.embedding_binding
      embedding_model      = var.embedding_model
      embedding_host       = var.embedding_host
      embedding_dimension  = var.embedding_dimension
      embedding_api_key    = var.embedding_api_key
      search_provider      = var.search_provider
      search_api_key       = var.search_api_key
      tts_model            = var.tts_model
      tts_api_key          = var.tts_api_key
      database_url         = var.database_url
      nextauth_secret      = var.nextauth_secret
      google_client_id     = var.google_client_id
      google_client_secret = var.google_client_secret
      smtp_user            = var.smtp_user
      smtp_password        = var.smtp_password
      smtp_server          = var.smtp_server
      smtp_port            = var.smtp_port
      feedback_email_from  = var.feedback_email_from
    })
  })
}
