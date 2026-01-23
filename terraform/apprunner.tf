# =============================================================================
# AWS App Runner Configuration (Track-Me API)
# =============================================================================
# DEPRECATED: Migrated to ECS Fargate - keeping file for reference
# =============================================================================

# -----------------------------------------------------------------------------
# App Runner VPC Connector (DISABLED - migrated to ECS)
# -----------------------------------------------------------------------------

# resource "aws_apprunner_vpc_connector" "main" {
#   vpc_connector_name = "${var.project_name}-${var.environment}-vpc-connector"
#   subnets            = aws_subnet.private[*].id
#   security_groups    = [aws_security_group.apprunner_vpc_connector.id]
#
#   tags = {
#     Name = "${var.project_name}-${var.environment}-vpc-connector"
#   }
# }

# -----------------------------------------------------------------------------
# App Runner IAM Access Role (for ECR access) - KEPT for potential future use
# -----------------------------------------------------------------------------

resource "aws_iam_role" "apprunner_access" {
  name = "${var.project_name}-${var.environment}-apprunner-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-apprunner-access-role"
  }
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# -----------------------------------------------------------------------------
# App Runner Instance Role (for Secrets Manager access) - KEPT for potential future use
# -----------------------------------------------------------------------------

resource "aws_iam_role" "apprunner_instance" {
  name = "${var.project_name}-${var.environment}-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-apprunner-instance-role"
  }
}

resource "aws_iam_role_policy" "apprunner_secrets" {
  name = "${var.project_name}-${var.environment}-apprunner-secrets-policy"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.database.arn,
          aws_secretsmanager_secret.confluent_kafka.arn,
          aws_secretsmanager_secret.upstash_redis.arn,
          aws_secretsmanager_secret.google_oauth.arn
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# App Runner Auto Scaling Configuration (DISABLED - migrated to ECS)
# -----------------------------------------------------------------------------

# resource "aws_apprunner_auto_scaling_configuration_version" "api" {
#   auto_scaling_configuration_name = "${var.project_name}-${var.environment}-autoscaling"
#
#   max_concurrency = 100
#   max_size        = 5
#   min_size        = 1
#
#   tags = {
#     Name = "${var.project_name}-${var.environment}-autoscaling"
#   }
# }

# -----------------------------------------------------------------------------
# App Runner Service for Track-Me API (DISABLED - migrated to ECS)
# -----------------------------------------------------------------------------

# resource "aws_apprunner_service" "api" {
#   service_name = "${var.project_name}-${var.environment}-api"
#
#   source_configuration {
#     authentication_configuration {
#       access_role_arn = aws_iam_role.apprunner_access.arn
#     }
#
#     image_repository {
#       image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
#       image_repository_type = "ECR"
#       image_configuration {
#         port = "3000"
#         runtime_environment_variables = {
#           NODE_ENV = "production"
#         }
#         runtime_environment_secrets = {
#           DB_HOST        = "${aws_secretsmanager_secret.database.arn}:host::"
#           DB_PORT        = "${aws_secretsmanager_secret.database.arn}:port::"
#           DB_NAME        = "${aws_secretsmanager_secret.database.arn}:dbname::"
#           DB_USERNAME    = "${aws_secretsmanager_secret.database.arn}:username::"
#           DB_PASSWORD    = "${aws_secretsmanager_secret.database.arn}:password::"
#           KAFKA_BROKERS    = "${aws_secretsmanager_secret.confluent_kafka.arn}:brokers::"
#           KAFKA_API_KEY    = "${aws_secretsmanager_secret.confluent_kafka.arn}:api_key::"
#           KAFKA_API_SECRET = "${aws_secretsmanager_secret.confluent_kafka.arn}:api_secret::"
#           REDIS_URL      = "${aws_secretsmanager_secret.upstash_redis.arn}:url::"
#           REDIS_PASSWORD = "${aws_secretsmanager_secret.upstash_redis.arn}:password::"
#           GOOGLE_CLIENT_ID = "${aws_secretsmanager_secret.google_oauth.arn}:client_id::"
#         }
#       }
#     }
#
#     auto_deployments_enabled = true
#   }
#
#   instance_configuration {
#     cpu               = var.api_cpu
#     memory            = var.api_memory
#     instance_role_arn = aws_iam_role.apprunner_instance.arn
#   }
#
#   network_configuration {
#     egress_configuration {
#       egress_type       = "VPC"
#       vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
#     }
#   }
#
#   auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.api.arn
#
#   health_check_configuration {
#     protocol            = "HTTP"
#     path                = "/"
#     interval            = 10
#     timeout             = 5
#     healthy_threshold   = 1
#     unhealthy_threshold = 5
#   }
#
#   observability_configuration {
#     observability_enabled = true
#   }
#
#   tags = {
#     Name = "${var.project_name}-${var.environment}-api"
#   }
# }
