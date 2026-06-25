-- Migration 013 : abonnements Web Push (notifications navigateur)
--   Stocke les PushSubscription (endpoint + clés p256dh/auth) par utilisateur.
--   Un même utilisateur peut posséder plusieurs appareils → plusieurs lignes.
--   endpoint UNIQUE (préfixe 191 pour compat utf8mb4) : un ré-abonnement
--   du même navigateur met à jour la ligne au lieu d'en créer une nouvelle.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(512) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_endpoint (endpoint(191)),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
