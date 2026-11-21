# Deployment (AWS EC2)

Production runs the single Docker image on one EC2 instance. Infrastructure lives in `terraform-ec2/`. The estimated cost is about $18 a month: EC2 t3.small ~$15, 30 GB EBS ~$2.40, Route53 ~$0.50, plus small amounts for ECR and Secrets Manager.

## What Terraform manages

| File | Resources |
|---|---|
| `networking.tf` | VPC, one public subnet, internet gateway, security group (80/443 open; SSH only from `ssh_allowed_cidrs`) |
| `ec2.tf` | Instance (Amazon Linux 2023), Elastic IP, root volume. Boot script is `user_data.sh`. |
| `iam.tf` | Instance role: ECR pull, Secrets Manager read, CloudWatch Logs, SSM Session Manager |
| `ecr.tf` | `novusorbit` image repository with a lifecycle policy |
| `secrets.tf` | Secret `novusorbit-production-secrets` (JSON of every app secret, from tfvars) |
| `dns.tf` | A records for the apex and `www`, pointing at the Elastic IP. The Route53 hosted zone must already exist. |
| `cloudwatch.tf` | Log group |

State is stored locally in `terraform-ec2/terraform.tfstate`; the S3 backend is commented out in `main.tf`. Keep the state file safe. It's git-ignored, so back it up yourself.

## First-time setup

1. **Prerequisites:** AWS CLI with credentials (`aws configure`), Terraform 1.5 or later, Docker, and a Route53 hosted zone for your domain.
2. **Variables:** copy the template and fill it in. `terraform.tfvars` is git-ignored.
   ```bash
   cd terraform-ec2
   cp terraform.tfvars.example terraform.tfvars
   ```
   It needs `domain_name`, the `llm_*` and `embedding_*` values, `database_url`, `nextauth_secret`, `google_client_id`/`google_client_secret`, and optionally search, TTS and SMTP keys.
3. **Deploy:**
   ```bash
   ./deploy.sh          # terraform init/plan/apply (asks before applying) → build → push → update
   ```
   On first boot, `user_data.sh` does the following:
   - installs Docker, Docker Compose and Caddy
   - writes `/opt/novusorbit/docker-compose.yml` and the Caddyfile
   - installs `host/update.sh` as `/opt/novusorbit/update.sh` and runs it, which writes `.env` and starts the app

   Caddy gets a Let's Encrypt certificate automatically once DNS points to the Elastic IP.
4. **Google OAuth:** add `https://www.<domain>/api/auth/callback/google` as an authorized redirect URI. See [authentication.md](authentication.md).

## Routine deploys

```bash
cd terraform-ec2
./deploy.sh -s       # skip Terraform: docker build → push :latest to ECR → SSM runs update.sh
./deploy.sh -s -t v1.2.0   # push and deploy a specific tag
```

Each deploy ships the repo's `host/update.sh` to the instance over SSM, so the host always runs the current version. The script:
1. Writes `.env` from the secret's `DOTENV` key.
2. Makes sure every data volume is mounted (see [Data persistence](#data-persistence)).
3. Runs `docker compose pull` and `docker compose up -d --force-recreate`, then prunes old images.
4. Waits up to 3 minutes for the backend and frontend to respond.

`deploy.sh` prints the host output and exits non-zero if any step fails. Expect about 30 seconds of downtime while the container restarts.

Check the deploy afterwards:

```bash
curl -I https://www.novusorbit.com/
curl -s -o /dev/null -w "%{http_code}\n" https://www.novusorbit.com/api/v1/portfolio/list
```

## Changing secrets or environment variables

Every app setting and secret comes from `terraform.tfvars`. Terraform renders the complete `.env` (`templates/app.env.tftpl`) into the `DOTENV` key of the Secrets Manager secret, and `host/update.sh` writes it to `/opt/novusorbit/.env` on every deploy:

```bash
vi terraform.tfvars        # change the value
terraform apply            # updates the secret (only the secret version changes)
./deploy.sh -s             # host refreshes .env and recreates the container
```

Don't edit `/opt/novusorbit/.env` on the host, because the next deploy overwrites it. To add a new variable, add it to `templates/app.env.tftpl` (plus a variable in `variables.tf` and an entry in `secrets.tf`).

## Operations

```bash
terraform output                                  # instance_id, public_ip, app_url, ecr_repository_url, ssm_command
aws ssm start-session --target <instance_id> --region us-east-1   # shell, no SSH key needed
sudo docker logs -f novusorbit                    # app logs (backend + frontend via supervisord)
sudo journalctl -u caddy -f                       # proxy/TLS logs
```

**Rollback:** push a previous image under `:latest`, then run `update.sh`. Alternatively, set `image:` in `/opt/novusorbit/docker-compose.yml` to an older tag and run `docker compose up -d`. ECR keeps the last 5 images; older ones are expired by the lifecycle policy.

## Data persistence

App data lives under `/opt/novusorbit/data/` on the instance's EBS root volume and is bind-mounted into the container:

| Host path | Container path | Contents |
|---|---|---|
| `/opt/novusorbit/data/user` | `/app/data/user` | Per-user job boards, sessions and resume writer data in `accounts/<uid>/`; shared settings and logs |
| `/opt/novusorbit/data/portfolios` | `/app/data/portfolios` | Per-user portfolios in `users/<uid>/` (uploaded CVs and their indexes) |
| `/opt/novusorbit/data/knowledge_bases` | `/app/data/knowledge_bases` | Legacy, unused |

Before November 2026 the portfolios volume wasn't mounted, so portfolios were lost on every redeploy. `update.sh` fixes older hosts automatically. On the first deploy that finds the volume missing, it:
1. copies any portfolios out of the running container
2. adds the volume line (after backing up `docker-compose.yml.bak`)
3. recreates the container

**Per-user data migration.** The first deploy with per-user data moves the old shared portfolios, job boards and sessions into the earliest ADMIN user's account. It writes `data/user/.legacy_data_migrated.json` and is postponed until an admin exists. `deploy.sh` prints the backend's `[DataMigration]` and `[UserContext]` log lines after each deploy so you can confirm it ran.

There are no automated backups. If you want them, consider EBS snapshots, for example with AWS Data Lifecycle Manager.

## Image notes

- `deploy.sh` builds on your machine with `docker build`. Build on x86_64, or add `--platform linux/amd64`, because t3 instances are amd64.
- Docker Desktop must be running before you deploy.
- The image is about 1.1 GB. See [architecture.md](architecture.md#container-image).
