# =============================================================================
# CloudWatch Configuration - COST OPTIMIZED
# =============================================================================

# -----------------------------------------------------------------------------
# Log Groups
# Retention lowered to 3 days to save storage costs
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "api" {
  # שינוי השם ל-ecs במקום apprunner להתאמה לארכיטקטורה החדשה
  name              = "/ecs/${var.project_name}-${var.environment}-api"
  retention_in_days = 3 # שומר לוגים רק ל-3 ימים

  tags = {
    Name = "${var.project_name}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "processor" {
  name              = "/ecs/${var.project_name}-${var.environment}-processor"
  retention_in_days = 3

  tags = {
    Name = "${var.project_name}-processor-logs"
  }
}

resource "aws_cloudwatch_log_group" "rds" {
  name              = "/aws/rds/instance/${var.project_name}-${var.environment}-postgres/postgresql"
  retention_in_days = 3

  tags = {
    Name = "${var.project_name}-rds-logs"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# Keeps track of health but minimal cost (~$0.10/alarm/month)
# -----------------------------------------------------------------------------

# RDS CPU Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "This alarm triggers when RDS CPU > 80%"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${var.project_name}-rds-cpu-alarm"
  }
}

# RDS Free Storage Alarm
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120 # 5 GB in bytes
  alarm_description   = "This alarm triggers when RDS free storage is less than 5GB"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${var.project_name}-rds-storage-alarm"
  }
}

# ECS Processor Running Task Count Alarm
resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks" {
  alarm_name          = "${var.project_name}-${var.environment}-processor-no-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "This alarm triggers when processor running tasks count is 0"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.processor.name
  }

  tags = {
    Name = "${var.project_name}-processor-tasks-alarm"
  }
}