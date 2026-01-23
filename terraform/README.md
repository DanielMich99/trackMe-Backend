# AWS Infrastructure Deployment Guide

This directory contains Terraform configurations for deploying the Track-Me application to AWS.

## Architecture Overview

| Component | AWS Service | Description |
|-----------|-------------|-------------|
| API | App Runner | track-me NestJS API |
| Worker | ECS Fargate | processor Kafka microservice |
| Database | RDS PostgreSQL | With PostGIS extension |
| Images | ECR | Container registry |
| Secrets | Secrets Manager | Credentials storage |
| Monitoring | CloudWatch | Logs and alarms |

**External Services:** Confluent Cloud (Kafka), Upstash Redis, Cloudflare (DNS/CDN)

## Prerequisites

1. **AWS CLI** configured with credentials
2. **Terraform** >= 1.0 installed
3. **Docker** for building images
4. Upstash Kafka and Redis accounts created
5. Google OAuth Client ID configured

## Quick Start

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual values
```

### 3. Review and Apply

```bash
terraform plan
terraform apply
```

### 4. Build and Push Docker Images

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build and push API
docker build -t track-me-api .
docker tag track-me-api:latest <ECR_API_REPO_URL>:latest
docker push <ECR_API_REPO_URL>:latest

# Build and push Processor
docker build -f apps/processor/Dockerfile -t track-me-processor .
docker tag track-me-processor:latest <ECR_PROCESSOR_REPO_URL>:latest
docker push <ECR_PROCESSOR_REPO_URL>:latest
```

### 5. Enable PostGIS Extension

After RDS is provisioned, connect and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

## Files Overview

| File | Description |
|------|-------------|
| `main.tf` | Provider and backend configuration |
| `variables.tf` | Input variables |
| `outputs.tf` | Output values |
| `vpc.tf` | VPC, subnets, NAT gateway |
| `security-groups.tf` | Security group rules |
| `ecr.tf` | Container registries |
| `secrets.tf` | Secrets Manager |
| `rds.tf` | PostgreSQL database |
| `ecs.tf` | ECS Fargate (processor) |
| `apprunner.tf` | App Runner (API) |
| `cloudwatch.tf` | Logging and alarms |

## Cloudflare Setup

1. Add your domain to Cloudflare
2. Create a CNAME record pointing to the App Runner URL
3. Enable proxy mode for WAF/DDoS protection
4. Configure SSL to "Full (strict)"

## Cost Estimates (Monthly)

| Resource | Estimated Cost |
|----------|---------------|
| RDS db.t3.micro | ~$15 |
| NAT Gateway | ~$32 + data |
| App Runner | ~$25+ (usage-based) |
| ECS Fargate | ~$10 |
| Secrets Manager | ~$2 |
| **Total** | ~$85+ |

## Cleanup

```bash
terraform destroy
```

> ⚠️ This will delete all resources including the database!
