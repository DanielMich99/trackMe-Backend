# =============================================================================
# Terraform Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

# -----------------------------------------------------------------------------
# ECR Outputs
# -----------------------------------------------------------------------------

output "ecr_api_repository_url" {
  description = "ECR repository URL for API"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_processor_repository_url" {
  description = "ECR repository URL for processor"
  value       = aws_ecr_repository.processor.repository_url
}

# -----------------------------------------------------------------------------
# RDS Outputs
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS instance address (hostname only)"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

# -----------------------------------------------------------------------------
# ECS Outputs
# -----------------------------------------------------------------------------

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "ECS processor service name"
  value       = aws_ecs_service.processor.name
}

# -----------------------------------------------------------------------------
# ALB Outputs (API)
# -----------------------------------------------------------------------------

output "api_url" {
  description = "API URL (ALB DNS name)"
  value       = "http://${aws_lb.api.dns_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.api.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.api.arn
}

# -----------------------------------------------------------------------------
# ECS API Outputs
# -----------------------------------------------------------------------------

output "ecs_api_service_name" {
  description = "ECS API service name"
  value       = aws_ecs_service.api.name
}

# -----------------------------------------------------------------------------
# Secrets Outputs
# -----------------------------------------------------------------------------

output "database_secret_arn" {
  description = "ARN of database credentials secret"
  value       = aws_secretsmanager_secret.database.arn
}

# -----------------------------------------------------------------------------
# CloudWatch Outputs
# -----------------------------------------------------------------------------

output "cloudwatch_log_group_api" {
  description = "CloudWatch log group for API"
  value       = aws_cloudwatch_log_group.api.name
}

output "cloudwatch_log_group_processor" {
  description = "CloudWatch log group for processor"
  value       = aws_cloudwatch_log_group.processor.name
}
