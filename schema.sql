-- ═══════════════════════════════════════════════════════════════
-- Club de Cyclisme de Salouel — Schéma MySQL complet
-- Version 1.1 · 2026
--
-- Idempotent : peut être exécuté plusieurs fois sans erreur.
-- Compatible MySQL 5.7+ et MariaDB 10.2+.
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS ccs_salouel
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ccs_salouel;

-- ─── Membres / Utilisateurs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  numero           INT UNIQUE,
  username         VARCHAR(50)  UNIQUE NOT NULL,
  email            VARCHAR(100) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  prenom           VARCHAR(50)  NOT NULL,
  nom              VARCHAR(50)  NOT NULL,
  role             ENUM('admin','moderateur','membre') DEFAULT 'membre',
  bio              TEXT,
  ftp_w            INT,
  km_saison        INT          DEFAULT 0,
  elevation_saison INT          DEFAULT 0,
  licence_ffc      VARCHAR(20),
  annee_adhesion   INT,
  actif            BOOLEAN      DEFAULT TRUE,
  avatar_initial   CHAR(1)      GENERATED ALWAYS AS (UPPER(LEFT(prenom, 1))) VIRTUAL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Tokens de rafraîchissement ──────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMP    NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Sorties ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sorties (
  id              VARCHAR(100) PRIMARY KEY,
  slug            VARCHAR(100),
  title           VARCHAR(200) NOT NULL,
  title_html      VARCHAR(400),
  subtitle        VARCHAR(300),
  chapter         VARCHAR(200),
  description     TEXT,
  date            DATE         NOT NULL,
  date_label      VARCHAR(100),
  distance_km     DECIMAL(6,1),
  duration_label  VARCHAR(20),
  elevation_gain  INT,
  elevation_loss  INT,
  elevation_max   INT,
  elevation_min   INT,
  tss             INT,
  np_w            INT,
  pave_km         DECIMAL(5,1),
  secteurs        INT,
  hero_img        VARCHAR(500),
  card_img        VARCHAR(500),
  location_name   VARCHAR(100),
  location_lat    DECIMAL(10,7),
  location_lng    DECIMAL(10,7),
  gpx_filename    VARCHAR(255),
  number          INT,
  featured        BOOLEAN      DEFAULT FALSE,
  statut          ENUM('passee','en_cours','future') DEFAULT 'passee',
  created_by      INT,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_date (date),
  INDEX idx_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Tags des sorties ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sortie_tags (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sortie_id   VARCHAR(100) NOT NULL,
  type        VARCHAR(20),
  label       VARCHAR(100),
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
  INDEX idx_sortie (sortie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Stats extra des sorties ──────────────────────────────────
CREATE TABLE IF NOT EXISTS sortie_stats_extra (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sortie_id   VARCHAR(100) NOT NULL,
  label       VARCHAR(50),
  value       VARCHAR(50),
  unit        VARCHAR(20),
  cls         VARCHAR(20),
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
  INDEX idx_sortie (sortie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Segments par sortie ─────────────────────────────────────
-- Note : `time` et `rank` sont des mots réservés MySQL → backticks obligatoires.
CREATE TABLE IF NOT EXISTS sortie_segments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sortie_id   VARCHAR(100) NOT NULL,
  idx         INT,
  name        VARCHAR(200),
  sub         VARCHAR(200),
  stars       INT DEFAULT 3,
  length_m    INT,
  `time`      VARCHAR(20),
  delta       VARCHAR(20),
  delta_cls   VARCHAR(10),
  `rank`      VARCHAR(50),
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
  INDEX idx_sortie (sortie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Points d'intérêt ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pois (
  id              VARCHAR(50)   PRIMARY KEY,
  sortie_id       VARCHAR(100)  NOT NULL,
  type            ENUM('signaleur','ravito','danger','secteur','depart','arrivee') NOT NULL,
  label           VARCHAR(200),
  description     TEXT,
  km              DECIMAL(6,2),
  lat             DECIMAL(10,7) NOT NULL,
  lng             DECIMAL(10,7) NOT NULL,
  contact_name    VARCHAR(100),
  contact_phone   VARCHAR(30),
  user_added      BOOLEAN       DEFAULT FALSE,
  created_by      INT,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sortie_id)  REFERENCES sorties(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_sortie (sortie_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Événements ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evenements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  slug            VARCHAR(100) UNIQUE,
  title           VARCHAR(200) NOT NULL,
  title_html      VARCHAR(400),
  subtitle        VARCHAR(300),
  type            ENUM('cyclosportive','gravel','criterium','course','rando','championnat','autre') DEFAULT 'course',
  date            DATE         NOT NULL,
  heure           VARCHAR(10),
  lieu            VARCHAR(100),
  region          VARCHAR(100),
  distance_km     INT,
  description     TEXT,
  inscrits        INT          DEFAULT 0,
  max_inscrits    INT,
  engagement_eur  DECIMAL(6,2),
  sortie_id       VARCHAR(100),
  hero_img        VARCHAR(500),
  statut          ENUM('ouvert','complet','termine','annule','archive') DEFAULT 'ouvert',
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE SET NULL,
  INDEX idx_date (date),
  INDEX idx_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Inscriptions aux événements ─────────────────────────────
CREATE TABLE IF NOT EXISTS evenement_inscriptions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  evenement_id  INT          NOT NULL,
  user_id       INT,
  prenom        VARCHAR(50)  NOT NULL,
  nom           VARCHAR(50)  NOT NULL,
  email         VARCHAR(100) NOT NULL,
  telephone     VARCHAR(20),
  categorie     VARCHAR(50),
  distance      INT,
  statut        ENUM('en_attente','confirme','annule') DEFAULT 'confirme',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evenement_id) REFERENCES evenements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE SET NULL,
  INDEX idx_evenement (evenement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Messages de contact ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  prenom      VARCHAR(50)  NOT NULL,
  nom         VARCHAR(50)  NOT NULL,
  email       VARCHAR(100) NOT NULL,
  telephone   VARCHAR(20),
  sujet       VARCHAR(200) NOT NULL,
  message     TEXT         NOT NULL,
  statut      ENUM('nouveau','lu','traite','archive') DEFAULT 'nouveau',
  repondu     BOOLEAN      DEFAULT FALSE,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_statut (statut),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Palmarès ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS palmares (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  annee       INT          NOT NULL,
  titre       VARCHAR(200) NOT NULL,
  evenement   VARCHAR(200),
  categorie   VARCHAR(50),
  rang        INT,
  medaille    ENUM('or','argent','bronze'),
  equipe      BOOLEAN      DEFAULT FALSE,
  sortie_id   VARCHAR(100),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE SET NULL,
  INDEX idx_annee (annee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Segments globaux (KOM / classements) ────────────────────
CREATE TABLE IF NOT EXISTS segments_global (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  location        VARCHAR(200),
  stars           INT          DEFAULT 3,
  length_m        INT,
  meilleur_temps  VARCHAR(20),
  delta_moyenne   VARCHAR(20),
  rang            VARCHAR(50),
  rang_cls        VARCHAR(20),
  kom             BOOLEAN      DEFAULT FALSE,
  sortie_id       VARCHAR(100),
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Paramètres du club ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_settings (
  cle         VARCHAR(50)  PRIMARY KEY,
  valeur      TEXT,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Équipements des membres ─────────────────────────────────
CREATE TABLE IF NOT EXISTS user_equipment (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  num         INT,
  titre       VARCHAR(200) NOT NULL,
  description TEXT,
  sort_order  INT          DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Données initiales : Paramètres club ─────────────────────
-- Échappement SQL standard (apostrophe doublée), compatible avec
-- ANSI_QUOTES et NO_BACKSLASH_ESCAPES.
-- INSERT IGNORE = idempotent (re-exécution sans erreur).
INSERT IGNORE INTO club_settings (cle, valeur) VALUES
  ('name',       'C.C. Salouel'),
  ('founded',    '1978'),
  ('president',  'Antoine Lemaire'),
  ('licencies',  '87'),
  ('address',    '14 rue de l''Église, 80480 Salouel'),
  ('email',      'contact@club-salouel.fr'),
  ('phone',      '06 09 12 34 56'),
  ('sortie_day', 'Dimanche · 8h30');
