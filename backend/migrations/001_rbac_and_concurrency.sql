-- Up
START TRANSACTION;

-- Users table adjustments
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive','locked') NOT NULL DEFAULT 'active' AFTER password_hash,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0 AFTER updated_at;

-- Audit requests adjustments
ALTER TABLE audit_requests
  MODIFY file_path VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;

-- Notifications adjustments
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0,
  ADD INDEX IF NOT EXISTS idx_notifications_user_created (user_id, created_at);

-- Meetings adjustments
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0,
  ADD INDEX IF NOT EXISTS idx_meetings_user_schedule (user_id, scheduled_at);

-- Compliance logs index
ALTER TABLE compliance_logs
  ADD INDEX IF NOT EXISTS idx_compliance_checked_at (checked_at);

-- Password resets adjustments
ALTER TABLE password_resets
  ADD COLUMN IF NOT EXISTS token_hash VARBINARY(32) NULL AFTER token,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD INDEX IF NOT EXISTS idx_password_resets_token_hash (token_hash),
  MODIFY used TINYINT(1) NOT NULL DEFAULT 0;

-- Foreign key hardening
ALTER TABLE audit_requests
  DROP FOREIGN KEY IF EXISTS audit_requests_ibfk_1;
ALTER TABLE audit_requests
  ADD CONSTRAINT fk_audit_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE notifications
  DROP FOREIGN KEY IF EXISTS notifications_ibfk_1;
ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE meetings
  DROP FOREIGN KEY IF EXISTS meetings_ibfk_1;
ALTER TABLE meetings
  ADD CONSTRAINT fk_meetings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- RBAC tables
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  INDEX idx_user_roles_user (user_id),
  INDEX idx_user_roles_role (role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  INDEX idx_role_permissions_role (role_id)
) ENGINE=InnoDB;

-- Idempotency table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(120) NOT NULL,
  key_hash VARBINARY(32) NOT NULL,
  response_status SMALLINT NOT NULL,
  response_body TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idempotency (user_id, endpoint, key_hash)
) ENGINE=InnoDB;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_log_entity (entity, entity_id)
) ENGINE=InnoDB;

COMMIT;

-- Down (idempotent clean-up instructions)
-- Para revertir manualmente, eliminar relaciones y tablas creadas si es necesario.
