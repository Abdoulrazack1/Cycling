-- Migration 010 : table newsletter_subscribers (opt-in mailing).
-- Stocke les emails ayant accepté de recevoir les annonces du club
-- (nouvelle sortie, événement, palmarès, etc.). Conforme RGPD :
-- token de désabonnement unique, confirmed_at pour double opt-in.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  -- Token aléatoire utilisé pour confirmer ET pour se désabonner
  token CHAR(48) NOT NULL,
  -- Date à laquelle l'utilisateur a cliqué sur le lien de confirmation
  -- (null = pas encore confirmé)
  confirmed_at DATETIME NULL,
  unsubscribed_at DATETIME NULL,
  -- Métadonnées légères pour analyse anti-spam
  source VARCHAR(40) DEFAULT 'home',
  ip_addr VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_email (email),
  UNIQUE KEY uniq_token (token),
  KEY idx_confirmed (confirmed_at)
);
