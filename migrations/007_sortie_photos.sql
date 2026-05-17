-- Migration 007 : galerie photos par sortie
-- Permet d'attacher plusieurs photos à une sortie (vue ride debrief)
CREATE TABLE IF NOT EXISTS sortie_photos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sortie_id   VARCHAR(100) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  caption     VARCHAR(300),
  sort_order  INT          DEFAULT 0,
  created_by  INT,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)  ON DELETE SET NULL,
  INDEX idx_sortie (sortie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
