-- Migration 014 : chiffrement applicatif des tokens Strava (cf. AUDIT #5)
--   Les colonnes access_token / refresh_token de user_strava_link stockaient
--   les tokens EN CLAIR. Ils sont désormais chiffrés en AES-256-GCM côté
--   application (src/lib/token-crypto.js), au format :
--     "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
--   qui est nettement plus long que le token brut → on élargit les colonnes
--   de VARCHAR(255) à VARCHAR(512) pour absorber le surcoût du chiffrement.
--
--   Rétro-compatibilité : le déchiffrement (decryptToken) renvoie tel quel
--   toute valeur non préfixée "enc:v1:", donc les tokens en clair déjà
--   présents continuent de fonctionner et sont ré-chiffrés au prochain
--   refresh/relink. Aucune migration de données n'est nécessaire.

ALTER TABLE user_strava_link
  MODIFY COLUMN access_token  VARCHAR(512) NOT NULL,
  MODIFY COLUMN refresh_token VARCHAR(512) NOT NULL;
