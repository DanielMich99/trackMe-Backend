# =============================================================================
# RDS PostgreSQL Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# DB Subnet Group (uses private subnets)
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
# RDS Parameter Group with PostGIS Configuration
# -----------------------------------------------------------------------------

resource "aws_db_parameter_group" "postgres" {
  name        = "${var.project_name}-${var.environment}-pg15-params"
  family      = "postgres15"
  description = "Parameter group for PostgreSQL 15 with PostGIS"

  # PostGIS and other extensions are enabled via shared_preload_libraries or SQL
  # The actual extension must be created in the database after provisioning

  tags = {
    Name = "${var.project_name}-${var.environment}-pg15-params"
  }
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL Instance
# -----------------------------------------------------------------------------

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  # Engine configuration
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  max_allocated_storage = 100 # Enable autoscaling up to 100 GB

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Storage configuration
  storage_type      = "gp3"
  storage_encrypted = true

  # Backup configuration
  backup_retention_period = 1  # Reduced for free tier compatibility
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Performance and monitoring
  parameter_group_name          = aws_db_parameter_group.postgres.name
  performance_insights_enabled  = false # Disabled for db.t3.micro to save cost
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # High availability (disabled for cost savings)
  multi_az = false

  # Deletion protection (enable in production)
  deletion_protection = false
  skip_final_snapshot = true

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

# -----------------------------------------------------------------------------
# Note: PostGIS Extension
# After the RDS instance is created, connect and run:
#   CREATE EXTENSION IF NOT EXISTS postgis;
#   CREATE EXTENSION IF NOT EXISTS postgis_topology;
# -----------------------------------------------------------------------------
