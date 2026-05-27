-- Migration 011 : tables pour renforcer le parcours utilisateur
--   - user_favorites : sorties marquées favorites par un membre
--   - notifications  : flux centralisé d'événements (sortie modifiée,
--                       inscription confirmée, broadcast admin, etc.)
--   - sortie_inscriptions : inscription en 1 clic d'un membre à une
--                            sortie future (équivalent évenement_inscriptions
--                            mais pour les sorties club, plus simple)

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id INT NOT NULL,
  sortie_id VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, sortie_id),
  KEY idx_user (user_id),
  KEY idx_sortie (sortie_id),
  CONSTRAINT fk_favs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  -- Type libre, mais convention : sortie.updated, sortie.new, inscription.confirmed,
  -- broadcast, kom.lost, kom.gained, mention, etc.
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  -- URL cible quand on clique (ex: /sortie.html?id=xxx)
  url VARCHAR(255) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_unread (user_id, read_at),
  KEY idx_user_created (user_id, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sortie_inscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sortie_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  -- 'inscrit' (par défaut), 'liste-attente', 'annule'
  statut ENUM('inscrit','liste-attente','annule') NOT NULL DEFAULT 'inscrit',
  -- Commentaire facultatif (point de RDV différent, covoiturage, etc.)
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sortie_user (sortie_id, user_id),
  KEY idx_sortie (sortie_id),
  KEY idx_user (user_id),
  KEY idx_statut (statut),
  CONSTRAINT fk_sins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Étend audit_log.action avec les nouveaux types
ALTER TABLE audit_log
  MODIFY COLUMN action ENUM(
    'create','update','delete','login','logout',
    'password_reset','role_change','export_data',
    'inscription','annulation','favorite','notification'
  ) NOT NULL;
