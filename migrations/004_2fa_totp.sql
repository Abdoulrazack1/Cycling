-- ═══════════════════════════════════════════════════════════════
-- Migration 004 — 2FA TOTP pour comptes admin (Brief D2)
--
-- Ajoute :
--   - totp_secret      : secret TOTP (base32) — NULL = 2FA non configurée
--   - totp_enabled     : 0/1 — un secret peut exister sans être encore activé
--                        (généré au scan QR mais confirmé seulement après
--                        première vérification réussie)
--   - totp_backup_codes: JSON array de 8 codes one-time (déjà hashés sha256)
--
-- À lancer :
--   mysql -u root -p ccs_salouel < migrations/004_2fa_totp.sql
-- ═══════════════════════════════════════════════════════════════

USE ccs_salouel;

ALTER TABLE users
  ADD COLUMN totp_secret VARCHAR(64) NULL AFTER password_hash,
  ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret,
  ADD COLUMN totp_backup_codes JSON NULL AFTER totp_enabled;
