terraform {
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
  backend "s3" { bucket = "shahid-terraform-state", key = "secrets/terraform.tfstate", region = "us-east-1", encrypt = true, dynamodb_table = "shahid-terraform-lock" }
}
provider "aws" { region = var.aws_region
  default_tags { tags = { Project = "SHAHID", Environment = var.environment, ManagedBy = "Terraform" } }
}
variable "environment" { type = string, default = "production" }
variable "aws_region" { type = string, default = "us-east-1" }
variable "supabase_url" { type = string, sensitive = true }
variable "supabase_service_key" { type = string, sensitive = true }
variable "supabase_anon_key" { type = string, sensitive = true }
variable "jwt_secret" { type = string, sensitive = true }
variable "s3_access_key" { type = string, sensitive = true }
variable "s3_secret_key" { type = string, sensitive = true }
variable "redis_url" { type = string, sensitive = true }
variable "database_url" { type = string, sensitive = true }
variable "fcm_server_key" { type = string, sensitive = true }
variable "smtp_host" { type = string, default = "email-smtp.us-east-1.amazonaws.com" }
variable "smtp_user" { type = string, sensitive = true }
variable "smtp_password" { type = string, sensitive = true }
variable "google_vision_api_key" { type = string, sensitive = true, default = "" }
variable "anthropic_api_key" { type = string, sensitive = true, default = "" }
variable "slack_webhook_url" { type = string, sensitive = true, default = "" }
variable "encryption_key" { type = string, sensitive = true, default = "" }

resource "aws_kms_key" "secrets_key" {
  description = "KMS key for SHAHID secrets", deletion_window_in_days = 30, enable_key_rotation = true, multi_region = true
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      { Sid = "Enable IAM User Permissions", Effect = "Allow", Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }, Action = "kms:*", Resource = "*" },
      { Sid = "Allow ECS Task Execution", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = "*", Condition = { StringEquals = { "kms:CallerAccount" = data.aws_caller_identity.current.account_id } } }
    ]
  })
  tags = { Name = "SHAHID Secrets Encryption Key" }
}
resource "aws_kms_alias" "secrets_key_alias" { name = "alias/shahid-secrets-${var.environment}", target_key_id = aws_kms_key.secrets_key.key_id }

resource "aws_secretsmanager_secret" "shahid_api_secrets" {
  name = "shahid/${var.environment}/api-gateway", description = "SHAHID API Gateway secrets — ${var.environment}", kms_key_id = aws_kms_key.secrets_key.arn, recovery_window_in_days = 7
  tags = { Name = "SHAHID API Secrets", Component = "api-gateway", Tier = "critical", Rotation = "quarterly" }
}
resource "aws_secretsmanager_secret_version" "api_secrets_v1" {
  secret_id = aws_secretsmanager_secret.shahid_api_secrets.id
  secret_string = jsonencode({ SUPABASE_URL = var.supabase_url, SUPABASE_SERVICE_KEY = var.supabase_service_key, SUPABASE_ANON_KEY = var.supabase_anon_key, JWT_SECRET = var.jwt_secret, DATABASE_URL = var.database_url, REDIS_URL = var.redis_url, S3_ACCESS_KEY = var.s3_access_key, S3_SECRET_KEY = var.s3_secret_key, API_ENCRYPTION_KEY = var.encryption_key })
}
resource "aws_secretsmanager_secret" "shahid_ai_secrets" {
  name = "shahid/${var.environment}/ai-service", description = "SHAHID AI Service API keys — ${var.environment}", kms_key_id = aws_kms_key.secrets_key.arn, recovery_window_in_days = 7
  tags = { Name = "SHAHID AI Secrets", Component = "ai-service", Tier = "high" }
}
resource "aws_secretsmanager_secret_version" "ai_secrets_v1" {
  secret_id = aws_secretsmanager_secret.shahid_ai_secrets.id
  secret_string = jsonencode({ GOOGLE_VISION_API_KEY = var.google_vision_api_key, ANTHROPIC_API_KEY = var.anthropic_api_key, DATABASE_URL = var.database_url, REDIS_URL = var.redis_url })
}
resource "aws_secretsmanager_secret" "shahid_notification_secrets" {
  name = "shahid/${var.environment}/notification-service", description = "SHAHID Notification Service credentials — ${var.environment}", kms_key_id = aws_kms_key.secrets_key.arn, recovery_window_in_days = 7
  tags = { Name = "SHAHID Notification Secrets", Component = "notification-service", Tier = "high" }
}
resource "aws_secretsmanager_secret_version" "notification_secrets_v1" {
  secret_id = aws_secretsmanager_secret.shahid_notification_secrets.id
  secret_string = jsonencode({ FCM_SERVER_KEY = var.fcm_server_key, SMTP_HOST = var.smtp_host, SMTP_USER = var.smtp_user, SMTP_PASSWORD = var.smtp_password, DATABASE_URL = var.database_url, REDIS_URL = var.redis_url, SLACK_WEBHOOK_URL = var.slack_webhook_url })
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "shahid-${var.environment}-ecs-task-execution"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" } }] })
}
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "shahid-${var.environment}-secrets-access", role = aws_iam_role.ecs_task_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"], Resource = [aws_secretsmanager_secret.shahid_api_secrets.arn, aws_secretsmanager_secret.shahid_ai_secrets.arn, aws_secretsmanager_secret.shahid_notification_secrets.arn] },
      { Effect = "Allow", Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"], Resource = "arn:aws:ssm:*:*:parameter/shahid/${var.environment}/*" },
      { Effect = "Allow", Action = ["kms:Decrypt"], Resource = aws_kms_key.secrets_key.arn }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "ecs_execution_policy" {
  role = aws_iam_role.ecs_task_execution_role.name, policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_caller_identity" "current" {}
output "api_secrets_arn" { value = aws_secretsmanager_secret.shahid_api_secrets.arn }
output "ai_secrets_arn" { value = aws_secretsmanager_secret.shahid_ai_secrets.arn }
output "notification_secrets_arn" { value = aws_secretsmanager_secret.shahid_notification_secrets.arn }
output "kms_key_arn" { value = aws_kms_key.secrets_key.arn }
output "ecs_execution_role_arn" { value = aws_iam_role.ecs_task_execution_role.arn }
