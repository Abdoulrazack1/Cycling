-- Migration 009 : ajoute 'export_data' à l'ENUM audit_log.action
-- pour tracer les demandes RGPD article 20 (portabilité).
ALTER TABLE audit_log
  MODIFY COLUMN action ENUM(
    'create','update','delete','login','logout',
    'password_reset','role_change','export_data'
  ) NOT NULL;
