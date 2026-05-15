# 2FA — Procédures de récupération

Document interne — à conserver hors du dépôt public et hors du téléphone qui porte l'app TOTP.

## Comment ça marche côté code

- Colonnes `users.totp_secret`, `totp_enabled`, `totp_backup_codes` (migration `004_2fa_totp.sql`).
- Le secret est stocké **en clair base32** (standard TOTP, irrécupérable sans accès direct à la BDD).
- Les 8 codes de récupération sont stockés **hashés sha256** — la liste claire n'est affichée qu'une fois, au moment de l'activation (panel admin → Sécurité 2FA → bouton « Activer 2FA »).
- Chaque backup code consommé est supprimé de la liste. Quand `backup_codes_remaining = 0`, plus de filet de sécurité.

## Cas 1 — J'ai perdu mon téléphone mais j'ai mes codes de récupération

1. Sur la page de login, saisir email + mot de passe normalement.
2. Quand le champ "Code 2FA" apparaît, **saisir un des codes de récupération** (8 à 12 caractères alphanumériques, pas 6 chiffres). Le backend accepte les deux formats.
3. Le code est consommé (one-time). Plus tard, depuis ton compte reconnecté :
   - Panel admin → **Sécurité (2FA)** → **Désactiver 2FA** (mot de passe + un nouveau code TOTP requis — ou tu fais l'opération depuis un autre device si tu en as encore configuré un).
   - Puis **Activer 2FA** à nouveau pour générer un nouveau secret + 8 nouveaux backup codes.

## Cas 2 — J'ai perdu mon téléphone ET mes codes de récupération

C'est l'urgence. Personne ne peut récupérer ton compte côté code. Il faut intervenir directement en BDD.

**Méthode 1 — désactiver le 2FA via SQL (recommandée)** :

```sql
-- Identifie l'admin
SELECT id, email, username, totp_enabled FROM users WHERE email = 'ton.email@example.com';

-- Désactive le 2FA en wipant les colonnes correspondantes
UPDATE users
SET totp_secret = NULL,
    totp_enabled = 0,
    totp_backup_codes = NULL
WHERE id = <ton_id>;

-- Vérifier
SELECT id, email, totp_enabled FROM users WHERE id = <ton_id>;
```

L'audit en BDD garde une trace (table `audit_log` — entrée `role_change` event=2fa-disabled est posée par le code, mais ici comme on fait du SQL direct, **rien n'est tracé**). Mentionner manuellement dans audit_log :

```sql
INSERT INTO audit_log (user_id, username, action, entity, entity_id, payload, ip_address)
VALUES (<ton_id>, 'manual-sql', 'role_change', 'user', <ton_id>,
        JSON_OBJECT('event', '2fa-emergency-disable', 'reason', 'lost-device-and-codes'),
        'localhost');
```

Reconnecte-toi avec juste email+password. Réactive ensuite le 2FA proprement depuis le panel.

**Méthode 2 — réinitialiser le mot de passe + 2FA pour un autre admin** :

Si tu n'es pas le seul admin, un autre admin peut :
- Aller dans la console admin → onglet Membres → toi → "Réinitialiser mot de passe" (génère un lien jetable JWT 24h).
- Cette opération **ne touche pas au 2FA** côté code. Donc même avec un nouveau mot de passe, le challenge 2FA bloque toujours le login.
- L'autre admin doit aussi faire le UPDATE SQL ci-dessus.

## Cas 3 — Plus aucun admin n'a accès

Plan nucléaire : créer un nouvel admin via INSERT direct.

```sql
-- bcrypt hash de 'NouveauMotDePasse1234' généré côté Node :
--   node -e "console.log(require('bcryptjs').hashSync('NouveauMotDePasse1234', 12))"
INSERT INTO users (numero, username, email, password_hash, prenom, nom, role, actif)
VALUES (NULL, 'recovery_admin', 'recovery@example.com',
        '<le hash bcrypt>',
        'Recovery', 'Admin', 'admin', 1);
```

Connecte-toi avec ce compte, fais le ménage, supprime-le quand tu as repris la main sur l'ancien.

## Prévention

- **Imprime les codes de récupération** au moment de l'activation. Range-les avec les papiers importants du club, pas sur ton téléphone.
- **Active le 2FA sur au moins deux comptes admin** (toi + un suppléant). Si un téléphone meurt, l'autre admin peut intervenir sans toucher à la BDD.
- **Backup MySQL** (cf. `scripts/backup-db.js`) — au moins un backup datant d'avant l'incident permet de retrouver les codes hashés si jamais.

## Modèle de mail de réception des codes

À envoyer au membre du bureau qui active 2FA :

> Tu viens d'activer la double authentification sur ton compte admin du C.C. Salouel. Voici tes 8 codes de récupération à usage unique :
>
> ```
> <coller la liste depuis le panel>
> ```
>
> Imprime ce mail et range-le avec les statuts du club. Chaque code n'est utilisable qu'une fois. Si tu perds ton téléphone, ces codes te permettent de te reconnecter le temps de reconfigurer 2FA.
>
> **Ne réponds pas à ce mail. Ne stocke pas ces codes en ligne (Drive, Slack, etc.).**
