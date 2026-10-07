# EFS File System for persistent storage
resource "aws_efs_file_system" "app" {
  count            = var.enable_efs ? 1 : 0
  creation_token   = "${var.project_name}-${var.environment}-efs"
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"
  encrypted        = true

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-efs"
  }
}

# EFS Mount Targets
resource "aws_efs_mount_target" "app" {
  count           = var.enable_efs ? var.availability_zones_count : 0
  file_system_id  = aws_efs_file_system.app[0].id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs[0].id]
}

# EFS Access Point for data/user
resource "aws_efs_access_point" "user_data" {
  count          = var.enable_efs ? 1 : 0
  file_system_id = aws_efs_file_system.app[0].id

  posix_user {
    uid = 1000
    gid = 1000
  }

  root_directory {
    path = "/user"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "755"
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-efs-ap-user"
  }
}

# EFS Access Point for data/knowledge_bases
resource "aws_efs_access_point" "knowledge_bases" {
  count          = var.enable_efs ? 1 : 0
  file_system_id = aws_efs_file_system.app[0].id

  posix_user {
    uid = 1000
    gid = 1000
  }

  root_directory {
    path = "/knowledge_bases"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "755"
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-efs-ap-kb"
  }
}
