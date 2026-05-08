-- ═══════════════════════════════════════════════════════════════
-- Migration 002 — Indexes manquants (cf. AUDIT opt-1, 8 mai 2026)
--
-- Idempotent : utilise INFORMATION_SCHEMA pour vérifier l'existence
-- avant de créer (CREATE INDEX IF NOT EXISTS n'est arrivé qu'en
-- MySQL 8.0.32 → on ne peut pas l'assumer).
--
-- À lancer après schema.sql :
--   mysql -u root -p ccs_salouel < migrations/002_indexes.sql
-- ═══════════════════════════════════════════════════════════════

USE ccs_salouel;

-- Helper procédural : créer un index seulement s'il n'existe pas.
DROP PROCEDURE IF EXISTS create_index_if_not_exists;
DELIMITER $$
CREATE PROCEDURE create_index_if_not_exists(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_cols  VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = p_table
      AND index_name   = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD INDEX ', p_index, ' (', p_cols, ')');
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- ── Indexes ajoutés ──────────────────────────────────────────
-- sorties.slug : GET /api/sorties/:id par slug faisait un full scan
CALL create_index_if_not_exists('sorties', 'idx_slug', 'slug');

-- evenements.sortie_id : jointure dans GET /api/evenements/:id (FK déjà
-- indexable mais pas explicitement indexée avant la création de la FK
-- selon le moteur).
CALL create_index_if_not_exists('evenements', 'idx_evenements_sortie', 'sortie_id');

-- pois (sortie_id, km) : utilisé par ORDER BY km dans GET /pois.
-- Plus efficace qu'un index simple sur sortie_id pour cette requête.
CALL create_index_if_not_exists('pois', 'idx_pois_sortie_km', 'sortie_id, km');

-- evenement_inscriptions.email : pour les futures purges RGPD et
-- la détection de doublons d'inscription.
CALL create_index_if_not_exists('evenement_inscriptions', 'idx_email', 'email');

-- evenement_inscriptions (evenement_id, statut) : pour le COUNT(*)
-- du nouveau calcul atomique d'inscrits (cf. AUDIT item #9).
CALL create_index_if_not_exists('evenement_inscriptions', 'idx_evt_statut', 'evenement_id, statut');

-- contacts.email : pour retrouver tous les messages d'une personne.
CALL create_index_if_not_exists('contacts', 'idx_contacts_email', 'email');

-- Cleanup
DROP PROCEDURE IF EXISTS create_index_if_not_exists;
