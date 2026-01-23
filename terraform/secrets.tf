# =============================================================================
# AWS Secrets Manager Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Database Credentials Secret
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "database" {
  name        = "${var.project_name}/${var.environment}/database"
  description = "Database credentials for Track-Me"

  tags = {
    Name = "${var.project_name}-database-secret"
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = var.db_name
    username = var.db_username
    password = var.db_password
  })
}

# -----------------------------------------------------------------------------
# Confluent Cloud Kafka Credentials Secret
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "confluent_kafka" {
  name        = "${var.project_name}/${var.environment}/confluent-kafka"
  description = "Confluent Cloud Kafka credentials for Track-Me"

  tags = {
    Name = "${var.project_name}-confluent-kafka-secret"
  }
}

resource "aws_secretsmanager_secret_version" "confluent_kafka" {
  secret_id = aws_secretsmanager_secret.confluent_kafka.id
  secret_string = jsonencode({
    brokers    = var.confluent_kafka_brokers
    api_key    = var.confluent_kafka_api_key
    api_secret = var.confluent_kafka_api_secret
  })
}

# -----------------------------------------------------------------------------
# Upstash Redis Credentials Secret
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "upstash_redis" {
  name        = "${var.project_name}/${var.environment}/upstash-redis"
  description = "Upstash Redis credentials for Track-Me"

  tags = {
    Name = "${var.project_name}-upstash-redis-secret"
  }
}

resource "aws_secretsmanager_secret_version" "upstash_redis" {
  secret_id = aws_secretsmanager_secret.upstash_redis.id
  secret_string = jsonencode({
    url      = var.upstash_redis_url
    password = var.upstash_redis_password
  })
}

# -----------------------------------------------------------------------------
# Google OAuth Credentials Secret
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "google_oauth" {
  name        = "${var.project_name}/${var.environment}/google-oauth"
  description = "Google OAuth credentials for Track-Me"

  tags = {
    Name = "${var.project_name}-google-oauth-secret"
  }
}

resource "aws_secretsmanager_secret_version" "google_oauth" {
  secret_id = aws_secretsmanager_secret.google_oauth.id
  secret_string = jsonencode({
    client_id = var.google_client_id
  })
}
