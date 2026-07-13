/* ═════════════════════════════════════════════════════════════════
   lib/image-sniff.js — détection du type réel d'une image par magic bytes
   (cf. AUDIT item #3 — upload photo : filtre MIME déclaratif uniquement)

   Le header Content-Type d'un upload multipart est contrôlé par le
   client : un fichier `x.svg` avec du `<script>` peut être envoyé en
   déclarant `Content-Type: image/png`. On sniffe donc les premiers
   octets réels (comme isLikelyGpx le fait pour les GPX) et on dérive
   l'extension stockée du type RÉEL, pas du nom fourni par le client.
   ═════════════════════════════════════════════════════════════════ */

/**
 * Renvoie { mime, ext } si le buffer est une image d'un type autorisé
 * (jpeg/png/webp/gif), sinon null.
 * @param {Buffer} buf
 */
function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG : FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return { mime: 'image/png', ext: '.png' };
  }
  // GIF : "GIF87a" ou "GIF89a"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) {
    return { mime: 'image/gif', ext: '.gif' };
  }
  // WEBP : "RIFF"...."WEBP"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

module.exports = { sniffImage };
