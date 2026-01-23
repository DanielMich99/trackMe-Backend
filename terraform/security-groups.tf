# =============================================================================
# Security Groups Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# Allows HTTP/HTTPS traffic from the internet
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # HTTP from anywhere
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS from anywhere
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to VPC (to reach ECS tasks)
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

# -----------------------------------------------------------------------------
# ECS API Security Group
# Allows inbound traffic from ALB on port 3000
# -----------------------------------------------------------------------------

resource "aws_security_group" "ecs_api" {
  name        = "${var.project_name}-${var.environment}-ecs-api-sg"
  description = "Security group for ECS API service"
  vpc_id      = aws_vpc.main.id

  # Inbound from ALB on port 3000
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Outbound to anywhere (for RDS, Kafka, Redis)
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-api-sg"
  }
}

# -----------------------------------------------------------------------------
# RDS Security Group
# Allows inbound PostgreSQL connections from ECS API and Processor
# -----------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  # Ingress from ECS Processor
  ingress {
    description     = "PostgreSQL from ECS Processor"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  # Ingress from ECS API
  ingress {
    description     = "PostgreSQL from ECS API"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_api.id]
  }

  # Outbound (not typically needed for RDS but required for updates)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# -----------------------------------------------------------------------------
# ECS Processor Security Group
# Allows outbound to Kafka, RDS, and Redis
# -----------------------------------------------------------------------------

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-${var.environment}-ecs-processor-sg"
  description = "Security group for ECS Fargate processor"
  vpc_id      = aws_vpc.main.id

  # Outbound to anywhere (for Kafka/Redis and RDS)
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-processor-sg"
  }
}

# -----------------------------------------------------------------------------
# DEPRECATED: App Runner VPC Connector Security Group
# Kept for state compatibility - will be removed on next apply
# -----------------------------------------------------------------------------

resource "aws_security_group" "apprunner_vpc_connector" {
  name        = "${var.project_name}-${var.environment}-apprunner-vpc-sg"
  description = "DEPRECATED - Security group for App Runner VPC Connector"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-apprunner-vpc-sg-DEPRECATED"
  }
}
