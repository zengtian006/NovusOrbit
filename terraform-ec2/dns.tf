# ============================================
# Route53 — DNS records pointing to Elastic IP
# ============================================
# No ALB needed — Caddy handles SSL termination via Let's Encrypt

data "aws_route53_zone" "main" {
  count        = var.domain_name != "" ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

# Root domain -> Elastic IP
resource "aws_route53_record" "root" {
  count   = var.domain_name != "" ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

# www subdomain -> Elastic IP
resource "aws_route53_record" "www" {
  count   = var.domain_name != "" ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}
