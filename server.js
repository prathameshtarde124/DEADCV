import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { generateRoastWithAI } from './roastEngine.js';
import {
  createPayment,
  verifyPayment,
  verifyWebhookSignature,
  getPaymentStatus,
  refundPayment,
  resolvePaymentCurrency,
  isInternationalEnabled,
} from './lib/payments/paymentService.js';

const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET  = process.env.ADMIN_SECRET || 'deadcv666';
const PRICE_USD     = () => parseInt(process.env.PRICE_USD || '1', 10);
// UPI_PRICE_INR is the INR amount shown on the QR (fallback if FX fetch fails).
// The canonical price remains $1; this is its INR display equivalent.
const UPI_PRICE_INR = () => {
  const envVal = parseInt(process.env.UPI_PRICE_INR || '', 10);
  if (!Number.isNaN(envVal) && envVal > 0) return envVal;
  const legacy = parseInt(process.env.PRICE_INR || '', 10);
  if (!Number.isNaN(legacy) && legacy > 0) return legacy;
  return Math.round(PRICE_USD() * FALLBACK_RATE);
};
const PRICE_INR = UPI_PRICE_INR; // legacy alias — do not use for tiered pricing
const TEST_MODE = process.env.DEADCV_TEST_MODE === 'true';
const IS_PROD   = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// ── Live USD→INR exchange rate (cached 1 hour) ────────────────
// Used only for display and UPI amount recording.
// The product price is always $1 USD — INR is the conversion shown to Indian users.
let _cachedRate      = null;
let _cacheExpiry     = 0;
const FALLBACK_RATE  = 84; // sensible fallback if API is unavailable

async function getUsdInrRate() {
  const now = Date.now();
  if (_cachedRate && now < _cacheExpiry) return _cachedRate;

  try {
    // exchangerate-api open endpoint — no key required, returns major pairs
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data?.rates?.INR && typeof data.rates.INR === 'number') {
      _cachedRate  = Math.round(data.rates.INR);
      _cacheExpiry = now + 60 * 60 * 1000; // 1 hour
      return _cachedRate;
    }
  } catch (err) {
    console.warn('[FX] Rate fetch failed, using fallback:', err.message);
  }
  return FALLBACK_RATE;
}

// ── Directory bootstrap ───────────────────────────────────────
// On Vercel, filesystem is read-only except /tmp — use /tmp for ephemeral storage
const IS_VERCEL = process.env.VERCEL === '1';
const UPLOADS_DIR  = IS_VERCEL ? path.join('/tmp', 'deadcv-uploads') : path.join(__dirname, 'uploads');
const DATA_DIR     = IS_VERCEL ? path.join('/tmp', 'deadcv-data')    : path.join(__dirname, 'data');
const ORDERS_FILE  = path.join(DATA_DIR, 'orders.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR))    fs.mkdirSync(DATA_DIR,    { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));

// ═════════════════════════════════════════════════════════════
// WEBHOOK — must be before express.json() to get raw body
// POST /api/payments/razorpay/webhook
// ═════════════════════════════════════════════════════════════
app.post(
  '/api/payments/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['x-razorpay-signature'];

    if (!sig) {
      console.warn('[WEBHOOK] Missing X-Razorpay-Signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    let valid = false;
    try {
      valid = verifyWebhookSignature(req.body, sig);
    } catch (err) {
      console.error('[WEBHOOK] Signature error:', err.message);
      return res.status(500).json({ error: 'Signature verification failed' });
    }

    if (!valid) {
      console.warn('[WEBHOOK] Invalid signature — rejected');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    console.log(`[WEBHOOK] Event: ${event.event}`);

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (!payment) return res.status(200).json({ status: 'ignored: no payment entity' });

      const { order_id: razorpayOrderId, id: razorpayPaymentId } = payment;

      const orders = getOrders();
      const order  = orders.find(o => o.razorpayOrderId === razorpayOrderId);

      if (!order) {
        console.warn(`[WEBHOOK] No DEADCV order for razorpayOrderId: ${razorpayOrderId}`);
        return res.status(200).json({ status: 'ignored: order not found' });
      }

      // Idempotency guard — never double-approve
      if (order.paymentStatus === 'approved') {
        console.log(`[WEBHOOK] Order ${order.orderId} already approved — skipping`);
        return res.status(200).json({ status: 'already processed' });
      }

      // Verify captured amount meets minimum expected
      const expectedAmount = payment.currency === 'USD'
        ? PRICE_USD() * 100
        : PRICE_INR() * 100;

      if (payment.amount < expectedAmount) {
        console.error(`[WEBHOOK] Amount mismatch: got ${payment.amount}, expected ${expectedAmount}`);
        return res.status(200).json({ status: 'amount mismatch — not approved' });
      }

      updateOrder(order.orderId, o => ({
        ...o,
        paymentStatus:     'approved',
        analysisStatus:    'ready',
        razorpayPaymentId,
        paymentMethod:     payment.method,
        paymentAmount:     payment.amount,
        paymentCurrency:   payment.currency,
        approvedAt:        new Date().toISOString(),
        verificationNote:  'verified via webhook (payment.captured)',
      }));

      console.log(`[WEBHOOK] ✅ Order ${order.orderId} approved`);
    }

    return res.status(200).json({ status: 'ok' });
  }
);

// ── Global middleware ─────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Multer ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

// ═════════════════════════════════════════════════════════════
// ORDER HELPERS
// ═════════════════════════════════════════════════════════════
function getOrders() {
  try   { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8')); }
  catch { return []; }
}
function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}
function saveOrder(order) {
  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
}
function updateOrder(orderId, updateFn) {
  const orders = getOrders();
  const i = orders.findIndex(o => o.orderId === orderId);
  if (i === -1) return null;
  orders[i] = updateFn(orders[i]);
  saveOrders(orders);
  return orders[i];
}

// ═════════════════════════════════════════════════════════════
// RESUME TEXT EXTRACTION — supports PDF (pdf-parse v1+v2) + DOCX
// ═════════════════════════════════════════════════════════════
async function extractResumeText(fileBuffer, mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  // Basic buffer sanity
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('bro this file is dead. (empty file — 0 bytes)');
  }
  if (fileBuffer.length > 10 * 1024 * 1024) {
    throw new Error('file too large. the resume is already suffering enough. (max 10 MB)');
  }

  // ── PDF ───────────────────────────────────────────────────
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    let text = '';
    let debugSource = '';
    try {
      // Try pdf-parse v2 (PDFParse class) first — used in pdf-parse@2.4.5
      try {
        const { PDFParse } = await import('pdf-parse');
        if (PDFParse) {
          const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
          const result = await parser.getText();
          text = (result.text || '').trim();
          debugSource = 'pdf-parse@v2';
          // Cleanup if available
          if (result && typeof result.destroy === 'function') try { await result.destroy(); } catch {}
          if (parser && typeof parser.destroy === 'function') try { await parser.destroy(); } catch {}
        }
      } catch (v2err) {
        // Fallback to v1 style require
        if (!text) {
          const pdfParseMod = require('pdf-parse');
          const fn = pdfParseMod.default || pdfParseMod.PDFParse || pdfParseMod;
          // v1 exports a function directly
          if (typeof fn === 'function' && fn.length <= 2) {
            const parsed = await fn(fileBuffer);
            text = (parsed.text || '').trim();
            debugSource = 'pdf-parse@v1';
          } else if (pdfParseMod.PDFParse) {
            const parser2 = new pdfParseMod.PDFParse({ data: new Uint8Array(fileBuffer) });
            const result2 = await parser2.getText();
            text = (result2.text || '').trim();
            debugSource = 'pdf-parse@v2-require';
            if (parser2 && typeof parser2.destroy === 'function') try { await parser2.destroy(); } catch {}
          }
        }
      }

      if (!text || text.length === 0) {
        console.warn(`[EXTRACT] FILE: ${originalName} TEXT EXTRACTED: NO CHARACTERS: 0 SOURCE: ${debugSource}`);
        throw new Error('bro we couldn\'t read this corpse. (PDF contains no extractable text — scanned image? try a text-based PDF or DOCX)');
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      console.log(`[EXTRACT] FILE: ${originalName} TEXT EXTRACTED: YES CHARACTERS: ${text.length} WORDS: ${wordCount} SOURCE: ${debugSource}`);
      // Debug: first 120 chars preview (never full resume in logs verbatim for privacy)
      console.log(`[EXTRACT] PREVIEW: ${text.slice(0, 120).replace(/\s+/g,' ').trim()}...`);
      return text;
    } catch (err) {
      // If we already threw our custom "bro we couldn't read" message, rethrow it
      if (err.message && err.message.startsWith('bro we couldn')) throw err;
      if (err.message && err.message.includes('no extractable text')) throw err;
      console.error(`[EXTRACT] PDF parsing failure FILE: ${originalName} SOURCE: ${debugSource} ERROR:`, err.message);
      throw new Error('bro we couldn\'t read this corpse. (PDF parsing failed — try exporting your resume as DOCX or a text-based PDF)');
    }
  }

  // ── DOCX / DOC ───────────────────────────────────────────
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    ext === '.docx' || ext === '.doc'
  ) {
    // For legacy .doc (not docx), mammoth will fail — give useful error
    if (ext === '.doc' && mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.warn(`[EXTRACT] FILE: ${originalName} is legacy .doc — attempting mammoth anyway`);
    }
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = (result.value || '').trim();
      if (!text || text.length === 0) {
        console.warn(`[EXTRACT] FILE: ${originalName} TEXT EXTRACTED: NO CHARACTERS: 0 (mammoth empty)`);
        throw new Error('bro we couldn\'t read this corpse. (DOCX appears empty or contains only images)');
      }
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      console.log(`[EXTRACT] FILE: ${originalName} TEXT EXTRACTED: YES CHARACTERS: ${text.length} WORDS: ${wordCount} SOURCE: mammoth`);
      console.log(`[EXTRACT] PREVIEW: ${text.slice(0, 120).replace(/\s+/g,' ').trim()}...`);
      if (result.messages && result.messages.length) {
        console.log(`[EXTRACT] mammoth messages:`, result.messages.slice(0,3));
      }
      return text;
    } catch (err) {
      if (err.message && err.message.startsWith('bro we couldn')) throw err;
      console.error(`[EXTRACT] DOCX parsing failure FILE: ${originalName} ERROR:`, err.message);
      throw new Error('this corpse is unreadable. (DOCX parsing failed — try re-exporting from Word/Google Docs)');
    }
  }

  throw new Error('unsupported file format. only PDF or DOCX corpses accepted.');
}

// ═════════════════════════════════════════════════════════════
// GET /api/config
// Returns Razorpay key (public), prices, and feature flags.
// Price is always $1 USD. INR is a live conversion shown to Indian users.
// ═════════════════════════════════════════════════════════════
app.get('/api/config', async (req, res) => {
  const razorpayConfigured = !!(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_ID.includes('XXXXXXXXXXXX')
  );

  const usdInr     = await getUsdInrRate();
  const priceUSD   = PRICE_USD();
  const inrEquiv   = Math.round(priceUSD * usdInr);
  const upiPrice   = UPI_PRICE_INR();

  // DEADCV_TEST_MODE — only true in local dev, never in prod/Vercel
  const testMode = TEST_MODE && !IS_PROD;

  res.json({
    // Public Razorpay key — safe to expose to frontend
    razorpayKeyId:        razorpayConfigured ? process.env.RAZORPAY_KEY_ID : null,
    razorpayConfigured,
    internationalEnabled: isInternationalEnabled(),

    // The product always costs $1 USD — single global price
    priceUSD,
    displayPriceUSD: `$${priceUSD}`,
    PRICE_USD: priceUSD,

    // INR equivalent shown to Indian users (live conversion display only)
    // This does NOT change the underlying $1 price
    inrEquiv,
    displayInrEquiv: `₹${inrEquiv}`,
    usdInrRate:      usdInr,

    // Legacy / compat fields for frontend that may use different names
    displayUpiINR:   `₹${inrEquiv}`,
    displayPriceINR: `₹${inrEquiv}`,
    upiPriceInr:     inrEquiv,
    UPI_PRICE_INR:   inrEquiv,
    PRICE_INR:       inrEquiv,
    // Env-configured static fallback (for order verification)
    upiPriceFallback: upiPrice,

    // Test mode — enables TEST PAYMENT → ROAST button in dev only
    testMode,
    isVercel: IS_VERCEL,
  });
});

// ═════════════════════════════════════════════════════════════
// POST /api/upload — Extracts text server-side, validates, creates order
// ═════════════════════════════════════════════════════════════
app.post('/api/upload', (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        console.warn(`[UPLOAD] REJECTED: file too large >10MB`);
        return res.status(400).json({ success: false, error: 'bro this file is dead. (too large — max 10 MB)' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, error: 'bro this file is dead. (unexpected field name — use "resume")' });
      }
      console.error(`[UPLOAD] multer error:`, err.message);
      return res.status(400).json({ success: false, error: 'bro this file is dead. (' + err.message.slice(0,80) + ')' });
    }

    try {
      const file = req.file;
      if (!file) {
        console.warn(`[UPLOAD] REJECTED: no file`);
        return res.status(400).json({ success: false, error: 'bro this file is dead. (no file provided — did you select a PDF or DOCX?)' });
      }

      console.log(`[UPLOAD] FILE: ${file.originalname} TYPE: ${file.mimetype} SIZE: ${file.size} bytes`);

      const targetJob      = (req.body.targetJob      || '').trim();
      const jobDescription = (req.body.jobDescription || '').trim();
      const roastIntensity = (req.body.roastIntensity || 'Brutal').trim();

      let resumeText = '';
      try {
        resumeText = await extractResumeText(file.buffer, file.mimetype, file.originalname);
      } catch (e) {
        console.warn(`[UPLOAD] EXTRACTION FAILED FILE: ${file.originalname} ERROR: ${e.message}`);
        return res.status(400).json({ success: false, error: e.message });
      }

      // Validate extracted text — do NOT send empty to AI
      const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
      console.log(`[UPLOAD] FILE: ${file.originalname} TEXT EXTRACTED: YES CHARACTERS: ${resumeText.length} WORDS: ${wordCount}`);
      if (!resumeText || resumeText.length < 50 || wordCount < 10) {
        console.warn(`[UPLOAD] REJECTED: text too short FILE: ${file.originalname} CHARACTERS: ${resumeText.length} WORDS: ${wordCount}`);
        return res.status(400).json({ success: false, error: 'bro we couldn\'t read this corpse. (extracted only ' + resumeText.length + ' characters — is this a scanned image? try exporting as DOCX or text-based PDF)' });
      }

      const timestampPart = Date.now().toString(36).toUpperCase();
      const randomPart    = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderId       = `DEAD-${timestampPart}-${randomPart}`;

      const safeFilename  = `${orderId}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, safeFilename), file.buffer);

      const orderRecord = {
        orderId,
        resumeText,
        textLength:   resumeText.length,
        wordCount:    resumeText.split(/\s+/).filter(Boolean).length,
        targetJob:    targetJob || 'General Role',
        jobDescription,
        roastIntensity,
        uploadedFileRef: {
          originalName: file.originalname,
          mimeType:     file.mimetype,
          sizeBytes:    file.size,
          savedPath:    `uploads/${safeFilename}`,
        },
        createdAt:           new Date().toISOString(),
        paymentStatus:       'pending',
        analysisStatus:      'waiting',
        razorpayOrderId:     null,
        razorpayPaymentId:   null,
        paymentAmount:       null,
        paymentCurrency:     null,
        paymentMethod:       null,
        approvedAt:          null,
        verificationNote:    null,
        roastResult:         null,
        roastedAt:           null,
      };

      saveOrder(orderRecord);

      return res.status(201).json({
        success:  true,
        orderId,
        message:  'corpse received and stored in morgue queue.',
        order: {
          orderId,
          originalName:  file.originalname,
          sizeBytes:     file.size,
          targetJob:     orderRecord.targetJob,
          wordCount:     orderRecord.wordCount,
          createdAt:     orderRecord.createdAt,
          paymentStatus: orderRecord.paymentStatus,
        },
      });
    } catch (e) {
      console.error('Upload server error:', e);
      return res.status(500).json({ success: false, error: 'internal morgue malfunction. please retry.' });
    }
  });
});

// ═════════════════════════════════════════════════════════════
// POST /api/payments/create-order
// Body: { deadcvOrderId, currency? }
// Currency is advisory — server may override based on account status.
// ═════════════════════════════════════════════════════════════
app.post('/api/payments/create-order', async (req, res) => {
  const { deadcvOrderId, currency = 'INR' } = req.body;

  if (!deadcvOrderId) {
    return res.status(400).json({ success: false, error: 'deadcvOrderId is required.' });
  }

  const orders = getOrders();
  const found  = orders.find(o => o.orderId === deadcvOrderId);
  if (!found) {
    return res.status(404).json({ success: false, error: 'DEADCV order not found.' });
  }

  // If already has a pending Razorpay order, return it (idempotent)
  if (found.razorpayOrderId && found.paymentStatus === 'pending') {
    const { amount, currency: cur, displayAmount } = resolvePaymentCurrency(found.paymentCurrency || currency);
    return res.json({
      success:        true,
      razorpayOrderId: found.razorpayOrderId,
      amount,
      currency:       cur,
      displayAmount,
      deadcvOrderId,
      keyId:          process.env.RAZORPAY_KEY_ID,
    });
  }

  // Validate requested currency against account capabilities
  const requestedCurrency = (currency || 'INR').toUpperCase();
  if (requestedCurrency === 'USD' && !isInternationalEnabled()) {
    return res.status(403).json({
      success: false,
      error:   'INTERNATIONAL_PAYMENTS_NOT_ENABLED',
      message: 'International payments are not yet enabled on this account.',
    });
  }

  try {
    const paymentOrder = await createPayment({ deadcvOrderId, currency: requestedCurrency });

    updateOrder(deadcvOrderId, o => ({
      ...o,
      razorpayOrderId:  paymentOrder.razorpayOrderId,
      paymentCurrency:  paymentOrder.currency,
      paymentAmount:    paymentOrder.amount,
      paymentStatus:    'pending',
    }));

    const { displayAmount } = resolvePaymentCurrency(paymentOrder.currency);

    return res.json({
      success:         true,
      razorpayOrderId: paymentOrder.razorpayOrderId,
      amount:          paymentOrder.amount,
      currency:        paymentOrder.currency,
      displayAmount,
      deadcvOrderId,
      keyId:           process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[CREATE-ORDER]', err.message);

    if (err.message === 'INTERNATIONAL_PAYMENTS_NOT_ENABLED') {
      return res.status(403).json({
        success: false,
        error:   'INTERNATIONAL_PAYMENTS_NOT_ENABLED',
        message: 'International payments are not yet enabled on this account.',
      });
    }

    if (err.message.includes('not installed')) {
      return res.status(503).json({
        success: false,
        error:   'RAZORPAY_NOT_INSTALLED',
        message: 'Payment package not installed. Run: npm install razorpay',
      });
    }

    return res.status(500).json({ success: false, error: 'Could not create payment order.' });
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/payments/verify
// Body: { deadcvOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
// NEVER trust the frontend — verify HMAC + amount server-side.
// ═════════════════════════════════════════════════════════════
app.post('/api/payments/verify', async (req, res) => {
  const { deadcvOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!deadcvOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ success: false, error: 'Missing required payment verification fields.' });
  }

  const orders = getOrders();
  const order  = orders.find(o => o.orderId === deadcvOrderId);

  if (!order) {
    return res.status(404).json({ success: false, error: 'DEADCV order not found.' });
  }

  // Prevent order-ID substitution attacks
  if (order.razorpayOrderId !== razorpayOrderId) {
    console.error(`[VERIFY] Razorpay order ID mismatch for ${deadcvOrderId}`);
    return res.status(400).json({ success: false, error: 'Payment ID mismatch.' });
  }

  // Idempotent — already approved
  if (order.paymentStatus === 'approved') {
    return res.json({ success: true, message: 'Already approved.', deadcvOrderId });
  }

  // HMAC signature check
  let signatureValid = false;
  try {
    signatureValid = verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
  } catch (err) {
    console.error('[VERIFY] Signature error:', err.message);
    return res.status(500).json({ success: false, error: 'Signature verification failed.' });
  }

  if (!signatureValid) {
    console.error(`[VERIFY] Invalid signature for ${deadcvOrderId}`);
    return res.status(400).json({ success: false, error: 'Invalid payment signature.' });
  }

  // Double-check amount via Razorpay API (signature passed → safe to call)
  try {
    const paymentInfo    = await getPaymentStatus(razorpayPaymentId);
    const expectedAmount = paymentInfo.currency === 'USD'
      ? PRICE_USD() * 100
      : PRICE_INR() * 100;

    if (paymentInfo.amount < expectedAmount) {
      console.error(`[VERIFY] Amount mismatch: got ${paymentInfo.amount}, expected ≥${expectedAmount}`);
      return res.status(400).json({ success: false, error: 'Payment amount mismatch.' });
    }

    updateOrder(deadcvOrderId, o => ({
      ...o,
      paymentStatus:    'approved',
      analysisStatus:   'ready',
      razorpayPaymentId,
      paymentMethod:    paymentInfo.method,
      paymentAmount:    paymentInfo.amount,
      paymentCurrency:  paymentInfo.currency,
      approvedAt:       new Date().toISOString(),
      verificationNote: 'verified via HMAC + Razorpay API amount check',
    }));

    console.log(`[VERIFY] ✅ Order ${deadcvOrderId} approved`);
    return res.json({ success: true, message: 'Payment verified and approved.', deadcvOrderId });

  } catch (err) {
    // Razorpay API unreachable — approve on signature alone (logged for audit)
    console.warn('[VERIFY] Razorpay API fetch failed, approving on signature only:', err.message);

    updateOrder(deadcvOrderId, o => ({
      ...o,
      paymentStatus:    'approved',
      analysisStatus:   'ready',
      razorpayPaymentId,
      approvedAt:       new Date().toISOString(),
      verificationNote: 'verified via HMAC only (Razorpay API fetch failed)',
    }));

    return res.json({ success: true, message: 'Payment verified.', deadcvOrderId });
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/payments/submit-utr
// Body: { deadcvOrderId, utr }
// Records the UTR submitted by an Indian user after UPI payment.
// Payment is NOT approved here — operator verifies manually.
// ═════════════════════════════════════════════════════════════
app.post('/api/payments/submit-utr', async (req, res) => {
  const { deadcvOrderId, utr } = req.body;

  if (!deadcvOrderId || !utr) {
    return res.status(400).json({ success: false, error: 'deadcvOrderId and utr are required.' });
  }

  const cleanUtr = String(utr).trim().replace(/[^a-zA-Z0-9]/g, '');
  if (cleanUtr.length < 6 || cleanUtr.length > 64) {
    return res.status(400).json({ success: false, error: 'UTR looks invalid. It should be 6–64 alphanumeric characters.' });
  }

  const orders = getOrders();
  const found  = orders.find(o => o.orderId === deadcvOrderId);

  if (!found) {
    return res.status(404).json({ success: false, error: 'DEADCV order not found.' });
  }

  if (found.paymentStatus === 'approved') {
    return res.json({ success: true, message: 'Order already approved.', deadcvOrderId });
  }

  // Use live INR equivalent for display amount (fallback to env UPI_PRICE_INR if FX unavailable)
  const liveRate   = await getUsdInrRate();
  const inrDisplay = Math.round(PRICE_USD() * liveRate);
  const recordedAmount = (inrDisplay || UPI_PRICE_INR()) * 100;

  updateOrder(deadcvOrderId, o => ({
    ...o,
    utr:              cleanUtr,
    utrSubmittedAt:   new Date().toISOString(),
    paymentStatus:    'pending_verification',
    paymentMethod:    'upi_qr',
    paymentCurrency:  'INR',
    paymentAmount:    recordedAmount,
    paymentAmountDisplay: `₹${inrDisplay} (≈ $${PRICE_USD()} × ₹${liveRate})`,
    usdInrRate:       liveRate,
    verificationNote: 'UTR submitted by user — awaiting operator verification',
  }));

  console.log(`[UTR] Order ${deadcvOrderId} UTR submitted: ${cleanUtr}`);

  return res.json({
    success:      true,
    message:      'UTR received. Your payment is being verified.',
    deadcvOrderId,
    utr:          cleanUtr,
  });
});

// ═════════════════════════════════════════════════════════════
// POST /api/payments/test-approve — DEVELOPMENT ONLY
// Allows TEST PAYMENT → ROAST without real Razorpay when DEADCV_TEST_MODE=true
// Never available in production/Vercel.
// ═════════════════════════════════════════════════════════════
app.post('/api/payments/test-approve', async (req, res) => {
  if (!TEST_MODE || IS_PROD) {
    return res.status(403).json({ success: false, error: 'TEST MODE disabled — real payment required.' });
  }
  const { deadcvOrderId } = req.body;
  if (!deadcvOrderId) return res.status(400).json({ success: false, error: 'deadcvOrderId is required.' });
  const orders = getOrders();
  const found = orders.find(o => o.orderId === deadcvOrderId);
  if (!found) return res.status(404).json({ success: false, error: 'DEADCV order not found.' });
  if (found.paymentStatus === 'approved') {
    return res.json({ success: true, message: 'Already approved (test mode).', deadcvOrderId });
  }
  // Validate that resume text was actually extracted
  if (!found.resumeText || found.resumeText.length < 50) {
    return res.status(400).json({ success: false, error: 'we couldn\'t read this corpse. (no extractable text — cannot test roast)' });
  }
  console.log(`[TEST-APPROVE] Order ${deadcvOrderId} approved via TEST_MODE`);
  updateOrder(deadcvOrderId, o => ({
    ...o,
    paymentStatus:  'approved',
    analysisStatus: 'ready',
    paymentMethod:  'test_mode',
    paymentCurrency:'TEST',
    approvedAt:     new Date().toISOString(),
    verificationNote: 'approved via DEADCV_TEST_MODE (dev only)',
  }));
  return res.json({ success: true, message: 'Test payment approved — roast unlocked.', deadcvOrderId });
});

// ═════════════════════════════════════════════════════════════
// GET /api/orders/:orderId
// ═════════════════════════════════════════════════════════════
app.get('/api/orders/:orderId', (req, res) => {
  const found = getOrders().find(o => o.orderId === req.params.orderId);
  if (!found) return res.status(404).json({ success: false, error: 'order not found in morgue registry.' });

  return res.json({
    success: true,
    order: {
      orderId:          found.orderId,
      originalName:     found.uploadedFileRef?.originalName || 'resume.pdf',
      sizeBytes:        found.uploadedFileRef?.sizeBytes    || 0,
      targetJob:        found.targetJob,
      wordCount:        found.wordCount,
      createdAt:        found.createdAt,
      paymentStatus:    found.paymentStatus,
      analysisStatus:   found.analysisStatus,
      paymentMethod:    found.paymentMethod    || null,
      paymentCurrency:  found.paymentCurrency  || null,
      approvedAt:       found.approvedAt       || null,
      verificationNote: found.verificationNote || null,
      hasRoast:         !!found.roastResult,
    },
  });
});

// ═════════════════════════════════════════════════════════════
// GET /api/orders/:orderId/roast
// Generates roast only after payment is approved.
// Cached on first generation — never runs AI twice.
// ═════════════════════════════════════════════════════════════
app.get('/api/orders/:orderId/roast', async (req, res) => {
  const found = getOrders().find(o => o.orderId === req.params.orderId);
  if (!found) return res.status(404).json({ success: false, error: 'order not found in morgue database.' });

  // Enhanced payment status messages per spec
  if (found.paymentStatus !== 'approved') {
    if (found.paymentStatus === 'pending_verification') {
      return res.status(402).json({
        success: false,
        error:   'payment received. we\'re verifying it. (UTR submitted — operator will verify shortly)',
        paymentStatus: found.paymentStatus,
      });
    }
    if (found.paymentStatus === 'pending') {
      return res.status(402).json({
        success: false,
        error:   'payment not yet approved. resume is still waiting in morgue lobby. (complete payment to unlock roast)',
        paymentStatus: found.paymentStatus,
      });
    }
    return res.status(402).json({
      success: false,
      error:   'payment not yet approved. resume is still waiting in morgue lobby.',
      paymentStatus: found.paymentStatus,
    });
  }

  // Guard: never send empty text to AI
  if (!found.resumeText || found.resumeText.trim().length < 50) {
    console.error(`[ROAST] Order ${found.orderId} has no extractable resume text — aborting AI`);
    return res.status(500).json({ success: false, error: 'bro we couldn\'t read this corpse. (no text extracted — cannot generate roast)' });
  }

  // Return cached roast — prevents duplicate AI generation (idempotent)
  if (found.roastResult) {
    return res.json({ success: true, orderId: found.orderId, roast: found.roastResult, targetJob: found.targetJob });
  }

  try {
    console.log(`[ROAST] Generating roast for ${found.orderId} file:${found.uploadedFileRef?.originalName} job:${found.targetJob} chars:${found.resumeText.length}`);
    const roast = await generateRoastWithAI(
      found.resumeText,
      found.targetJob,
      found.jobDescription,
      found.uploadedFileRef?.originalName || 'resume.pdf',
      found.roastIntensity || 'Brutal',
    );

    if (!roast || typeof roast !== 'object' || !roast.deadPercentage) {
      console.error(`[ROAST] Empty AI response for ${found.orderId}`, roast);
      return res.status(500).json({ success: false, error: 'the AI came back with absolutely nothing. (empty response — try again)' });
    }

    console.log(`[ROAST] Success for ${found.orderId} — ${roast.deadPercentage}% DEAD cause:${roast.causeOfDeath}`);

    const updated = updateOrder(req.params.orderId, o => ({
      ...o,
      roastResult:    roast,
      analysisStatus: 'completed',
      roastedAt:      new Date().toISOString(),
    }));

    return res.json({ success: true, orderId: updated.orderId, roast: updated.roastResult, targetJob: updated.targetJob });
  } catch (err) {
    console.error('[ROAST] Roast generation error:', err);
    // Log real error server-side, return DEADCV style message to user
    const msg = err.message && err.message.includes('API key') ? 'the roast machine exploded. (AI key missing or invalid)' : 'the roast machine exploded. (AI failed — try again in a moment)';
    return res.status(500).json({ success: false, error: msg });
  }
});

// ═════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═════════════════════════════════════════════════════════════
function checkAdminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.query.secret || req.body?.secret;
  if (!secret || secret !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, error: 'ACCESS DENIED: unauthorized morgue operator.' });
  }
  next();
}

app.get('/api/admin/orders', checkAdminAuth, (req, res) => {
  const orders = getOrders().map(o => ({
    orderId:          o.orderId,
    originalName:     o.uploadedFileRef?.originalName || 'unknown',
    sizeBytes:        o.uploadedFileRef?.sizeBytes    || 0,
    targetJob:        o.targetJob,
    wordCount:        o.wordCount,
    createdAt:        o.createdAt,
    paymentStatus:    o.paymentStatus,
    analysisStatus:   o.analysisStatus,
    paymentMethod:    o.paymentMethod    || null,
    paymentCurrency:  o.paymentCurrency  || null,
    razorpayOrderId:  o.razorpayOrderId  || null,
    razorpayPaymentId:o.razorpayPaymentId|| null,
    approvedAt:       o.approvedAt       || null,
    verificationNote: o.verificationNote || null,
  }));
  res.json({ success: true, count: orders.length, orders: orders.reverse() });
});

// Manual approve / reject
app.post('/api/admin/orders/:orderId/verify', checkAdminAuth, (req, res) => {
  const { action, note } = req.body;
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ success: false, error: 'invalid action.' });
  }

  const approved = action === 'approve';
  const updated  = updateOrder(req.params.orderId, o => ({
    ...o,
    paymentStatus:    approved ? 'approved' : 'rejected',
    analysisStatus:   approved ? 'ready'    : 'rejected',
    verifiedAt:       new Date().toISOString(),
    verificationNote: note || (approved ? 'manually approved by operator' : 'rejected by operator'),
  }));

  if (!updated) return res.status(404).json({ success: false, error: 'order not found.' });

  return res.json({
    success: true,
    message: approved ? 'order approved.' : 'order rejected.',
    order: { orderId: updated.orderId, paymentStatus: updated.paymentStatus },
  });
});

// Refund
app.post('/api/admin/orders/:orderId/refund', checkAdminAuth, async (req, res) => {
  const found = getOrders().find(o => o.orderId === req.params.orderId);
  if (!found)                    return res.status(404).json({ success: false, error: 'order not found.' });
  if (!found.razorpayPaymentId) return res.status(400).json({ success: false, error: 'No Razorpay payment ID on record.' });

  try {
    const refund = await refundPayment(found.razorpayPaymentId);
    updateOrder(req.params.orderId, o => ({ ...o, paymentStatus: 'refunded', refundId: refund.refundId, refundedAt: new Date().toISOString() }));
    return res.json({ success: true, refund });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health check (no secrets) ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'deadcv', vercel: IS_VERCEL });
});

// ── Serve static dist in production (local preview / non-Vercel) ──
if (!IS_VERCEL) {
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback — serve index.html for non-API routes (Express 5 uses /*splat)
    app.get('/*splat', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// ═════════════════════════════════════════════════════════════
// START — only listen when not running as Vercel serverless function
// ═════════════════════════════════════════════════════════════
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`💀 DEADCV Morgue Backend running on http://localhost:${PORT}`);
    const k = process.env.RAZORPAY_KEY_ID || '';
    if (k && !k.includes('XXXXXXXXXXXX')) {
      console.log(`💳 Razorpay configured: ${k.substring(0, 14)}...`);
      console.log(`🌍 International payments: ${isInternationalEnabled() ? 'ENABLED' : 'disabled (India-only)'}`);
    } else {
      console.warn('⚠️  Razorpay not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
    }
  });
}

// Export for Vercel serverless
export default app;
