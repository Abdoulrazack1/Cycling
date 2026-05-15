-- ═══════════════════════════════════════════════════════════════
-- Migration 003 — Audit log (cf. AUDIT item #30)
--
-- Avant cette migration, seul DELETE /api/sorties/:id loggait l'auteur.
-- Toutes les autres mutations admin (CREATE/UPDATE de sorties, palmarès,
-- segments, settings, événements…) n'avaient AUCUNE trace.
--
-- À lancer après schema.sql + 002_indexes.sql :
--   mysql -u root -p ccs_salouel < migrations/003_audit_log.sql
-- ═══════════════════════════════════════════════════════════════

USE ccs_salouel;

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,                             -- NULL = action publique (inscriptions visiteurs)
  username    VARCHAR(50),                     -- snapshot pour le cas où l'user est supprimé
  action      ENUM('create','update','delete','login','logout','password_reset','role_change')
              NOT NULL,
  entity      VARCHAR(50) NOT NULL,            -- 'sortie' | 'evenement' | 'membre' | 'palmares' | …
  entity_id   VARCHAR(100),                    -- id (slug pour sortie, INT pour les autres)
  payload     JSON,                            -- diff ou snapshot (peut être NULL)
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user      (user_id),
  INDEX idx_entity    (entity, entity_id),
  INDEX idx_created   (created_at),
  INDEX idx_action    (action),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
