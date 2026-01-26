# =============================================================================
# Security Groups Configuration - COST OPTIMIZED & SECURED
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# Allows HTTP/HTTPS traffic from the internet
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # Inbound HTTP from anywhere
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Inbound HTTPS from anywhere
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to anywhere (required to reach ECS tasks)
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
# ECS Processor Security Group
# Public Subnet but LOCKED DOWN (No Inbound)
# -----------------------------------------------------------------------------
resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-${var.environment}-ecs-processor-sg"
  description = "Security group for ECS Fargate processor"
  vpc_id      = aws_vpc.main.id

  # No Inbound Rules:
  # Since this task only processes background jobs and connects OUT to Kafka/DB,
  # we do not allow any incoming connections from the internet.
  
  # Outbound to anywhere
  # Required to pull Docker images, connect to RDS, Redis, Kafka, and Google APIs
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
# ECS API Security Group
# Public Subnet but restricted to ALB access only
# -----------------------------------------------------------------------------
resource "aws_security_group" "ecs_api" {
  name        = "${var.project_name}-${var.environment}-ecs-api-sg"
  description = "Security group for ECS Fargate API"
  vpc_id      = aws_vpc.main.id

  # Inbound from ALB only
  # The API listens on port 3000 and only accepts traffic from the Load Balancer
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Outbound to anywhere
  # Required to pull Docker images, connect to RDS, Redis, Kafka, and Google APIs
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