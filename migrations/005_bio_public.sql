-- ═══════════════════════════════════════════════════════════════
-- Migration 005 — bio_public : opt-in RGPD
--
-- Par défaut, la bio d'un membre n'est PAS visible publiquement
-- (privée à 0 = privé, 1 = public). Le membre doit cocher explicitement
-- "rendre ma bio publique" dans son profil pour qu'elle apparaisse
-- sur la fiche /membre.html?id=X consultée par d'autres.
--
-- Pour les profils déjà existants : on garde l'état actuel privé.
-- Une bio n'a aucune utilité publique tant que l'utilisateur n'a pas
-- décidé du contenu — opt-in pur.
--
-- À lancer :
--   mysql -u root -p ccs_salouel < migrations/005_bio_public.sql
-- ═══════════════════════════════════════════════════════════════

USE ccs_salouel;

ALTER TABLE users
  ADD COLUMN bio_public TINYINT(1) NOT NULL DEFAULT 0 AFTER bio;
