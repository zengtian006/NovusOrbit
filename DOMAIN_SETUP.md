# Domain Setup Guide: NovusOrbit.com with Route53 & Terraform

This guide walks you through registering `NovusOrbit.com` in Route53 and configuring it with your AWS deployment using Terraform.

---

## Overview

**What we'll set up:**
- ✅ Domain registration in Route53
- ✅ SSL/TLS certificate (ACM) for HTTPS
- ✅ DNS records pointing to your ALB
- ✅ Automatic HTTPS redirect
- ✅ Both www and root domain support

**Cost:** ~$12/year for .com domain + $0.50/month for Route53 hosted zone

---

## Step 1: Register Domain in Route53

### Option A: Register New Domain (Recommended)

1. **Go to Route53 Console**
   - Navigate to: https://console.aws.amazon.com/route53/
   - Click **"Registered domains"** in the left sidebar
   - Click **"Register domain"**

2. **Search for Domain**
   - Enter: `novusorbit.com`
   - Check availability
   - Add to cart ($12-$13/year for .com)

3. **Fill Contact Information**
   - Enter your contact details
   - Choose privacy protection (recommended)
   - Complete purchase

4. **Wait for Registration**
   - Takes 10-30 minutes
   - You'll receive email confirmation
   - Hosted zone is automatically created

### Option B: Transfer Existing Domain

If you already own `novusorbit.com` elsewhere:

1. **Get Transfer Code** from current registrar
2. **Unlock Domain** at current registrar  
3. **Transfer to Route53**:
   - Route53 Console → Registered domains → Transfer domain
   - Enter domain name and authorization code
   - Complete transfer (takes 5-7 days)

---

## Step 2: Verify Hosted Zone

After registration, verify the hosted zone was created:

```bash
cd /Users/tzeng/Development/NovusOrbit/terraform
aws route53 list-hosted-zones-by-name --dns-name novusorbit.com
```

You should see output with your hosted zone ID and name servers.

---

## Step 3: Update Terraform Configuration

### Edit `terraform.tfvars`

```bash
cd /Users/tzeng/Development/NovusOrbit/terraform
nano terraform.tfvars
```

**Update these lines:**
```hcl
# Domain Configuration
domain_name = "novusorbit.com"
# Leave certificate_arn empty - Terraform will create it
certificate_arn = ""
```

**Full example terraform.tfvars:**
```hcl
# AWS Configuration
aws_region   = "us-east-1"
project_name = "novusorbit"
environment  = "production"

# Domain Configuration
domain_name     = "novusorbit.com"
certificate_arn = ""  # Auto-created by Terraform

# ECS Configuration
task_cpu      = 2048
task_memory   = 4096
desired_count = 2

# ... rest of your configuration ...
```

---

## Step 4: Apply Terraform Configuration

### Initialize and Plan

```bash
cd /Users/tzeng/Development/NovusOrbit/terraform

# Initialize (downloads Route53 provider)
terraform init

# Preview changes
terraform plan
```

**You should see Terraform will create:**
- ✅ ACM certificate for `novusorbit.com` and `www.novusorbit.com`
- ✅ DNS validation records
- ✅ A records for root domain → ALB
- ✅ A records for www subdomain → ALB
- ✅ Update ALB listener to use HTTPS
- ✅ Update ECS environment variables with new domain

### Apply Changes

```bash
terraform apply
```

Type `yes` when prompted.

**⏱️ This will take ~5-10 minutes** because AWS needs to:
1. Issue the SSL certificate
2. Validate domain ownership via DNS
3. Update ALB configuration
4. Deploy new ECS tasks

---

## Step 5: Verify Certificate Validation

Watch the certificate validation process:

```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw certificate_arn) \
  --region us-east-1 \
  --query 'Certificate.Status'
```

Wait until status shows: `"ISSUED"`

---

## Step 6: Update Google OAuth Redirect URI

Since your domain changed, update Google Cloud Console:

1. Go to: https://console.cloud.google.com
2. Navigate to: **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. **Add new Authorized redirect URIs:**
   ```
   https://novusorbit.com/api/auth/callback/google
   https://www.novusorbit.com/api/auth/callback/google
   ```
5. Click **Save**

---

## Step 7: Test Your Domain

### Test HTTP → HTTPS Redirect

```bash
curl -I http://novusorbit.com
```

**Expected:** Should see `301 Moved Permanently` redirecting to HTTPS

### Test HTTPS

```bash
curl -I https://novusorbit.com
```

**Expected:** Should see `200 OK` with your application

### Test WWW Subdomain

```bash
curl -I https://www.novusorbit.com
```

**Expected:** Should work identically to root domain

### Test in Browser

Visit:
- https://novusorbit.com
- https://www.novusorbit.com
- http://novusorbit.com (should redirect to HTTPS)

All should load your NovusOrbit application with valid SSL certificate (green padlock).

---

## Step 8: Verify DNS Propagation

Check DNS records are correctly configured:

```bash
# Check A record for root domain
dig novusorbit.com

# Check A record for www
dig www.novusorbit.com
```

Both should show ALIAS records pointing to your ALB.

---

## Troubleshooting

### Certificate Stuck in "Pending Validation"

**Cause:** DNS validation records not propagating

**Fix:**
```bash
# Check validation records
terraform output domain_validation_options

# Verify records exist in Route53
aws route53 list-resource-record-sets \
  --hosted-zone-id $(aws route53 list-hosted-zones-by-name \
    --dns-name novusorbit.com \
    --query 'HostedZones[0].Id' --output text)
```

### "Site Can't Be Reached"

**Cause:** DNS not propagated yet

**Fix:** Wait 5-15 minutes for DNS propagation

### SSL Certificate Error in Browser

**Cause:** Old certificate cached or wrong certificate

**Fix:**
1. Hard refresh browser (Cmd+Shift+R)
2. Check certificate:
   ```bash
   openssl s_client -connect novusorbit.com:443 -servername novusorbit.com
   ```

### Google OAuth Not Working

**Cause:** Redirect URI mismatch

**Fix:** Verify in Google Console the redirect URIs include:
- `https://novusorbit.com/api/auth/callback/google`

---

## What Terraform Created

After `terraform apply`, you now have:

### Route53 Resources
- **Hosted Zone**: `novusorbit.com`
- **A Record (root)**: `novusorbit.com` → ALB
- **A Record (www)**: `www.novusorbit.com` → ALB
- **Certificate validation records**: `_acme-challenge.novusorbit.com`

### ACM Certificate
- **Domains**: `novusorbit.com`, `www.novusorbit.com`
- **Validation**: DNS (automatic)
- **Region**: us-east-1 (required for ALB)

### Updated ALB
- **HTTP (port 80)**: Redirects to HTTPS
- **HTTPS (port 443)**: Serves your application
- **Certificate**: Attached ACM certificate

### Updated ECS Tasks
- **NEXTAUTH_URL**: `https://novusorbit.com`
- **AUTH_URL**: `https://novusorbit.com`
- **NEXT_PUBLIC_API_BASE**: `https://novusorbit.com`

---

## Cost Breakdown

| Service | Cost |
|---------|------|
| Route53 Domain Registration | $12/year |
| Route53 Hosted Zone | $0.50/month |
| Route53 DNS Queries | $0.40/million queries |
| ACM Certificate | **FREE** |
| **Total** | **~$18/year** |

---

## Optional: Add More Subdomains

To add additional subdomains (e.g., `api.novusorbit.com`):

**Add to `terraform/route53.tf`:**
```hcl
resource "aws_route53_record" "api" {
  count   = var.domain_name != "" ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
```

Then run `terraform apply`.

---

## Next Steps

1. ✅ **Setup Complete!** Visit https://novusorbit.com
2. Monitor certificate expiration (auto-renews via ACM)
3. Consider adding:
   - CloudFront CDN for faster global access
   - AWS WAF for security
   - Additional DNS records (MX, TXT) if needed

---

## Reference Commands

**View all Terraform outputs:**
```bash
cd /Users/tzeng/Development/NovusOrbit/terraform
terraform output
```

**Get certificate ARN:**
```bash
terraform output certificate_arn
```

**Force certificate recreation:**
```bash
terraform taint aws_acm_certificate.main[0]
terraform apply
```

**Destroy domain resources:**
```bash
# WARNING: This removes DNS records but NOT domain registration
terraform destroy -target=aws_route53_record.root
terraform destroy -target=aws_route53_record.www
```

---

## Support Links

- [Route53 Documentation](https://docs.aws.amazon.com/route53/)
- [ACM Documentation](https://docs.aws.amazon.com/acm/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [NextAuth.js Configuration](https://authjs.dev/getting-started/deployment)
