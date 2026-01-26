# =============================================================================
# RDS PostgreSQL Configuration - COST OPTIMIZED
# =============================================================================

# -----------------------------------------------------------------------------
# RDS Security Group
# Defines firewall rules specifically for the database
# -----------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  # Inbound Rule: Allow PostgreSQL traffic (port 5432) ONLY from our ECS services
  ingress {
    description     = "PostgreSQL from ECS services"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [
      aws_security_group.ecs.id,     # Access from Processor
      aws_security_group.ecs_api.id  # Access from API
    ]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# -----------------------------------------------------------------------------
# DB Subnet Group
# Places the DB in the isolated Private Subnets
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-db-subnet-group"
  description = "Database subnet group for Track-Me"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# -----------------------------------------------------------------------------
# DB Parameter Group
# Configures PostgreSQL 15 specific settings
# -----------------------------------------------------------------------------
resource "aws_db_parameter_group" "postgres" {
  name        = "${var.project_name}-${var.environment}-pg15-params"
  family      = "postgres15"
  description = "Parameter group for PostgreSQL 15 with PostGIS support"

  tags = {
    Name = "${var.project_name}-${var.environment}-pg15-params"
  }
}

# -----------------------------------------------------------------------------
# RDS Instance
# Configured for Free Tier eligibility where possible
# -----------------------------------------------------------------------------
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  # Hardware & Engine
  engine         = "postgres"
  engine_version = "15"
  instance_class = var.db_instance_class # defined in variables.tf (use db.t3.micro or t4g.micro)
  
  # Storage (Free Tier gives up to 20GB)
  allocated_storage     = 20
  max_allocated_storage = 100 # Allow auto-scaling if needed
  storage_type          = "gp3"
  storage_encrypted     = true

  # Credentials
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Networking & Security
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false # IMPORTANT: Keep DB private for security
  multi_az               = false # IMPORTANT: False to save cost (Single AZ)

  # Backups & Maintenance
  backup_retention_period = 1             # Keep only 1 day of backups to save cost
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Cost Optimization & Cleanup settings
  performance_insights_enabled = false    # Disable to save cost
  deletion_protection          = false    # Allow easy destroy for learning project
  skip_final_snapshot          = true     # Don't create snapshot on destroy
  final_snapshot_identifier    = null

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}