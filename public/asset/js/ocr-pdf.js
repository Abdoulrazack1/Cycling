/* ═════════════════════════════════════════════════════════════════
   ocr-pdf.js — OCR client-side d'un PDF Strava
   ─────────────────────────────────────────────────────────────────
   Stratégie :
     1. Tente l'extraction texte natif via pdf.js (rapide, instantané)
     2. Si la page n'a pas de texte exploitable → rend en image et
        passe en Tesseract.js OCR (lent, ~5-10s par page)

   Charge pdf.js + tesseract.js depuis CDN à la demande (caché ensuite).

   API publique : window.CCS_OCR.extractPdfText(file, opts) → string
     opts.onProgress(stage, ratio)  → callback de progression
     opts.lang                       → 'fra' (default) | 'eng' | …
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const PDFJS_URL    = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';

  let pdfjsLib = null;
  let tesseractReady = false;

  async function loadPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await import(PDFJS_URL);
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return pdfjsLib;
  }

  async function loadTesseract() {
    if (tesseractReady) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Impossible de charger Tesseract.js (réseau ?)'));
      document.head.appendChild(s);
    });
    tesseractReady = true;
    return window.Tesseract;
  }

  // Rend la page PDF dans un canvas haute résolution et retourne le canvas.
  async function renderPageToCanvas(pdfDoc, pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // ~150 DPI, bon compromis qualité/vitesse OCR
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // Tente l'extraction de texte natif depuis le PDF.
  async function tryNativeText(pdfDoc) {
    const parts = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const txt = content.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (txt) parts.push(txt);
    }
    return parts.join('\n');
  }

  /**
   * Extrait le texte d'un PDF (texte natif si présent, sinon OCR).
   * @param {File} file
   * @param {object} [opts]
   * @param {(stage:string, ratio:number)=>void} [opts.onProgress] - callback (0..1)
   * @param {string} [opts.lang] - langue Tesseract (défaut 'fra')
   * @returns {Promise<{ text: string, source: 'native'|'ocr' }>}
   */
  async function extractPdfText(file, opts = {}) {
    const onProgress = opts.onProgress || (() => {});
    const lang = opts.lang || 'fra';

    onProgress('load-pdf', 0.05);
    const pdfjs = await loadPdfJs();
    const ab = await file.arrayBuffer();
    const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;

    onProgress('native-text', 0.15);
    const nativeText = await tryNativeText(pdfDoc);
    if (nativeText && /\d+[.,]\d+\s*km/i.test(nativeText)) {
      onProgress('done', 1);
      return { text: nativeText, source: 'native' };
    }

    onProgress('load-ocr', 0.25);
    const Tesseract = await loadTesseract();

    const allText = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const pageStart = 0.30 + (i - 1) / pdfDoc.numPages * 0.65;
      const pageSpan  = 0.65 / pdfDoc.numPages;
      onProgress(`render-${i}`, pageStart);
      const canvas = await renderPageToCanvas(pdfDoc, i);

      onProgress(`ocr-init-${i}`, pageStart + 0.02);
      const result = await Tesseract.recognize(canvas, lang, {
        logger: (m) => {
          if (!m || !m.status) return;
          const p = typeof m.progress === 'number' ? m.progress : 0;
          // Tesseract émet plusieurs phases avant le "recognizing text" réel :
          // - "loading tesseract core" / "initializing tesseract" → vite
          // - "loading language traineddata" → LENT (~30 Mo la 1ère fois)
          // - "initializing api" → instantané
          // - "recognizing text" → ~3-8s
          // On remonte CHAQUE phase pour que l'UI affiche le bon libellé.
          onProgress(`ocr-${m.status.replace(/\s+/g,'-')}-${i}`, pageStart + 0.02 + p * (pageSpan - 0.02));
        },
      });
      allText.push(result.data.text);
    }

    onProgress('done', 1);
    return { text: allText.join('\n'), source: 'ocr' };
  }

  window.CCS_OCR = { extractPdfText };
})();
