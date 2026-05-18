-- Migration 008 : Strava OAuth + activités synchronisées
-- Stocke le lien entre un user CCS et son compte Strava + cache des activités sync.

CREATE TABLE IF NOT EXISTS user_strava_link (
  user_id           INT          PRIMARY KEY,
  strava_athlete_id BIGINT       NOT NULL UNIQUE,
  access_token      VARCHAR(255) NOT NULL,
  refresh_token     VARCHAR(255) NOT NULL,
  expires_at        BIGINT       NOT NULL,           -- unix timestamp (seconds)
  scope             VARCHAR(200),
  athlete_firstname VARCHAR(100),
  athlete_lastname  VARCHAR(100),
  athlete_profile   VARCHAR(500),                    -- URL avatar Strava
  connected_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  last_sync_at      TIMESTAMP    NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_strava_athlete (strava_athlete_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cache des activités Strava importées (légère, on garde l'ID Strava pour ne pas
-- réimporter en boucle et éventuellement déclencher un sync delta).
CREATE TABLE IF NOT EXISTS strava_activities (
  id                 BIGINT       PRIMARY KEY,        -- ID Strava
  user_id            INT          NOT NULL,
  name               VARCHAR(300),
  type               VARCHAR(50),                     -- Ride, VirtualRide, Run...
  distance_m         INT,
  moving_time_s      INT,
  elapsed_time_s     INT,
  elevation_gain_m   INT,
  average_speed_ms   DECIMAL(6,2),
  max_speed_ms       DECIMAL(6,2),
  average_heartrate  INT,
  max_heartrate      INT,
  average_watts      INT,
  kilojoules         INT,
  start_date         DATETIME,
  start_lat          DECIMAL(10,7),
  start_lng          DECIMAL(10,7),
  polyline           TEXT,                            -- summary polyline encodé
  raw_json           JSON,                            -- backup brut
  imported_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
