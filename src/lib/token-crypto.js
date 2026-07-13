/* ═════════════════════════════════════════════════════════════════
   lib/token-crypto.js — chiffrement applicatif des tokens tiers
   (cf. AUDIT item #5 — tokens Strava stockés en clair en base)

   AES-256-GCM (chiffrement authentifié : confidentialité + intégrité).
   Format stocké : "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".

   Clé : STRAVA_TOKEN_ENC_KEY si présent (hex 64 / base64 / passphrase),
   sinon dérivée de JWT_SECRET via scrypt (fallback robuste — mieux vaut
   toujours chiffrer que dépendre d'une variable d'env optionnelle).
   La clé dérivée est distincte de JWT_SECRET (salt + label dédiés).

   decrypt() est rétro-compatible : une valeur SANS préfixe "enc:v1:"
   est retournée telle quelle (tokens déjà stockés en clair avant ce
   correctif) — ils sont ré-chiffrés au prochain refresh/relink.
   ═════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

let _key = null;

function getKey() {
  if (_key) return _key;
  const raw = process.env.STRAVA_TOKEN_ENC_KEY;
  if (raw && raw.length >= 16) {
    // hex 64 chars → 32 bytes ; sinon dérive une clé 32B stable via scrypt
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      _key = Buffer.from(raw, 'hex');
    } else {
      _key = crypto.scryptSync(raw, 'ccs-strava-token-salt', 32);
    }
  } else {
    // Fallback : dérivé de JWT_SECRET (garanti présent, cf. fail-fast server.js)
    const base = process.env.JWT_SECRET || '';
    _key = crypto.scryptSync(base, 'ccs-strava-token-derive-v1', 32);
  }
  return _key;
}

/** Chiffre une chaîne. Renvoie null/'' inchangés. */
function encryptToken(plain) {
  if (plain == null || plain === '') return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Déchiffre. Rétro-compatible : renvoie tel quel si non préfixé. */
function decryptToken(stored) {
  if (stored == null || stored === '') return stored;
  const s = String(stored);
  if (!s.startsWith(PREFIX)) return s; // token en clair pré-correctif
  const [, , ivB64, tagB64, ctB64] = s.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { encryptToken, decryptToken };
