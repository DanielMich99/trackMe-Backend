# =============================================================================
# Input Variables for Track-Me Infrastructure
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "track-me"
}

# -----------------------------------------------------------------------------
# VPC Configuration
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

# -----------------------------------------------------------------------------
# RDS Configuration
# -----------------------------------------------------------------------------

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "track_me_db"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "trackme_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 20
}

# -----------------------------------------------------------------------------
# ECS Fargate Configuration (Processor)
# -----------------------------------------------------------------------------

variable "processor_cpu" {
  description = "CPU units for processor task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "processor_memory" {
  description = "Memory for processor task in MB"
  type        = number
  default     = 512
}

variable "processor_desired_count" {
  description = "Number of processor tasks to run"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# ECS API Configuration
# -----------------------------------------------------------------------------

variable "api_cpu" {
  description = "CPU units for API task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Memory for API task in MB"
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Number of API tasks to run"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# External Services (Confluent Cloud Kafka)
# -----------------------------------------------------------------------------

variable "confluent_kafka_brokers" {
  description = "Confluent Cloud Kafka bootstrap servers"
  type        = string
  sensitive   = true
}

variable "confluent_kafka_api_key" {
  description = "Confluent Cloud Kafka API Key"
  type        = string
  sensitive   = true
}

variable "confluent_kafka_api_secret" {
  description = "Confluent Cloud Kafka API Secret"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# External Services (Upstash Redis)
# -----------------------------------------------------------------------------

variable "upstash_redis_url" {
  description = "Upstash Redis connection URL"
  type        = string
  sensitive   = true
}

variable "upstash_redis_password" {
  description = "Upstash Redis password"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Google OAuth
# -----------------------------------------------------------------------------

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}
