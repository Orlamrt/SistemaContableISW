START TRANSACTION;

INSERT INTO roles (name)
VALUES ('ADMIN'), ('AUDITOR'), ('CLIENTE'), ('SOPORTE')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO users (email, password_hash, status, created_at, updated_at, version)
VALUES
  ('admin@example.com', '$2b$10$F9t8gSNvHwtImobZJNzGLuoUBPUrvndrWWgHWrTXUPsJWrpiYLenu', 'active', NOW(), NOW(), 0),
  ('auditor@example.com', '$2b$10$ANIUa3e.z.w8yYzKQYKr.Og6s3qUIzq35KwhLgwx3gHJ74XiBszci', 'active', NOW(), NOW(), 0),
  ('cliente@example.com', '$2b$10$/jZrXDMC1Jf.rIluVMb6FODipQNbhEeg1JU1MtfjES9ZXluGvaHdW', 'active', NOW(), NOW(), 0),
  ('soporte@example.com', '$2b$10$tLY7dAZBIv/twdrTsCcxBu/2Gjnj3MqM1muOkxRk0qeBS2e1SWAhW', 'active', NOW(), NOW(), 0)
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON (
  (u.email = 'admin@example.com' AND r.name = 'ADMIN') OR
  (u.email = 'auditor@example.com' AND r.name = 'AUDITOR') OR
  (u.email = 'cliente@example.com' AND r.name = 'CLIENTE') OR
  (u.email = 'soporte@example.com' AND r.name = 'SOPORTE')
)
ON DUPLICATE KEY UPDATE role_id = role_id;

COMMIT;
