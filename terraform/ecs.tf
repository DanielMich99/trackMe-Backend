# =============================================================================
# ECS Fargate Configuration (Processor Microservice)
# =============================================================================

# -----------------------------------------------------------------------------
# ECS Cluster
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

# -----------------------------------------------------------------------------
# ECS Task Execution Role (for pulling images and writing logs)
# -----------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Policy to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_secrets_policy" {
  name = "${var.project_name}-${var.environment}-ecs-secrets-policy"
  role = aws_iam_role.ecs_task_execution.id

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
# ECS Task Role (for application permissions)
# -----------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-task-role"
  }
}

# -----------------------------------------------------------------------------
# ECS Task Definition for Processor
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "processor" {
  family                   = "${var.project_name}-processor"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.processor_cpu
  memory                   = var.processor_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "processor"
      image = "${aws_ecr_repository.processor.repository_url}:latest"

      essential = true

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]

      secrets = [
        {
          name      = "DB_HOST"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:host::"
        },
        {
          name      = "DB_PORT"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:port::"
        },
        {
          name      = "DB_NAME"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:dbname::"
        },
        {
          name      = "DB_USERNAME"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:username::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:password::"
        },
        {
          name      = "KAFKA_BROKERS"
          valueFrom = "${aws_secretsmanager_secret.confluent_kafka.arn}:brokers::"
        },
        {
          name      = "KAFKA_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.confluent_kafka.arn}:api_key::"
        },
        {
          name      = "KAFKA_API_SECRET"
          valueFrom = "${aws_secretsmanager_secret.confluent_kafka.arn}:api_secret::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${aws_secretsmanager_secret.upstash_redis.arn}:url::"
        },
        {
          name      = "REDIS_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.upstash_redis.arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.processor.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "processor"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-processor-task"
  }
}

# -----------------------------------------------------------------------------
# ECS Service for Processor
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "processor" {
  name            = "${var.project_name}-processor-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.processor.arn
  desired_count   = var.processor_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # Allow external deployment without Terraform
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Name = "${var.project_name}-processor-service"
  }
}

# =============================================================================
# ECS Configuration for API Service
# =============================================================================

# -----------------------------------------------------------------------------
# ECS Task Definition for API
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_ecr_repository.api.repository_url}:latest"

      essential = true

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        }
      ]

      secrets = [
        {
          name      = "DB_HOST"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:host::"
        },
        {
          name      = "DB_PORT"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:port::"
        },
        {
          name      = "DB_NAME"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:dbname::"
        },
        {
          name      = "DB_USERNAME"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:username::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.database.arn}:password::"
        },
        {
          name      = "KAFKA_BROKERS"
          valueFrom = "${aws_secretsmanager_secret.confluent_kafka.arn}:brokers::"
        },
        {
          name      = "KAFKA_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.confluent_kafka.arn}:api_key::"
        },
        {
          name      = "KAFKA_API_SECRET"
          valueFrom = "${aws_secretsmanager_secret.confluent_kafka.arn}:api_secret::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${aws_secretsmanager_secret.upstash_redis.arn}:url::"
        },
        {
          name      = "REDIS_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.upstash_redis.arn}:password::"
        },
        {
          name      = "GOOGLE_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.google_oauth.arn}:client_id::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-api-task"
  }
}

# -----------------------------------------------------------------------------
# ECS Service for API (behind ALB)
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  # Ensure ALB target group is created first
  depends_on = [aws_lb_listener.api_http]

  # Allow external deployment without Terraform
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Name = "${var.project_name}-api-service"
  }
}
