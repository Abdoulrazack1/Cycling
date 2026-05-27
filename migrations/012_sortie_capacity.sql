-- Migration 012 : capacité optionnelle sur les sorties + last_viewed pour membres
--   sorties.capacity_max : nombre max d'inscrits, NULL = illimité
--   user_recent_views    : historique de consultation pour "Récemment vues"

ALTER TABLE sorties
  ADD COLUMN capacity_max INT NULL DEFAULT NULL COMMENT 'Nombre max d''inscrits, NULL = illimité',
  ADD COLUMN inscription_ouverte TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Inscription possible ou fermée';

CREATE TABLE IF NOT EXISTS user_recent_views (
  user_id INT NOT NULL,
  sortie_id VARCHAR(100) NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, sortie_id),
  KEY idx_user_recent (user_id, viewed_at),
  CONSTRAINT fk_recent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
