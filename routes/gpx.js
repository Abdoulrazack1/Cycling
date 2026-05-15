// routes/gpx.js — Upload et service des fichiers GPX
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadGpx, handleMulterError, validateGpxFile, GPX_DIR } = require('../middleware/upload');

const router = express.Router();

// POST /api/gpx/upload — Uploader un fichier GPX
router.post('/upload',
  requireAuth, requireAdmin,
  uploadGpx.single('gpx'),
  handleMulterError,
  validateGpxFile,     // sniffing du contenu (Brief B4)
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    res.status(201).json({
      filename:     req.file.filename,
      size:         req.file.size,
      originalname: req.file.originalname,
      path:         `/api/gpx/${req.file.filename}`
    });
  }
);

// GET /api/gpx — Lister les GPX disponibles
router.get('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const files = fs.readdirSync(GPX_DIR)
      .filter(f => f.endsWith('.gpx'))
      .map(f => {
        const stat = fs.statSync(path.join(GPX_DIR, f));
        return { filename: f, size: stat.size, modified: stat.mtime };
      });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lecture dossier GPX' });
  }
});

// GET /api/gpx/:filename — Servir un fichier GPX
router.get('/:filename', (req, res) => {
  const { filename } = req.params;
  // Sécurité : pas de path traversal
  if (!/^[a-zA-Z0-9_-]+\.gpx$/.test(filename)) {
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }
  const filePath = path.join(GPX_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier GPX introuvable' });
  }
  res.setHeader('Content-Type', 'application/gpx+xml');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.sendFile(filePath);
});

// DELETE /api/gpx/:filename — Supprimer un GPX
router.delete('/:filename', requireAuth, requireAdmin, async (req, res) => {
  const { filename } = req.params;
  if (!/^[a-zA-Z0-9_-]+\.gpx$/.test(filename)) {
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }
  const filePath = path.join(GPX_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier introuvable' });
  }
  // Vérifier qu'aucune sortie n'utilise ce fichier
  const [inUse] = await query('SELECT id FROM sorties WHERE gpx_filename = ? LIMIT 1', [filename]);
  if (inUse) {
    return res.status(409).json({
      error: `Ce fichier est utilisé par la sortie ${inUse.id}`,
      sortie_id: inUse.id
    });
  }
  fs.unlinkSync(filePath);
  res.json({ message: 'Fichier supprimé' });
});

module.exports = router;
