// ─────────────────────────────────────────────────────────────
// DEADCV — Payment Service Abstraction Layer
// createPayment / verifyPayment / getPaymentStatus / refundPayment
//
// Swap providers by replacing this file + razorpayClient.js only.
// server.js never imports the Razorpay SDK directly.
// ─────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { getRazorpayInstance } from './razorpayClient.js';

// ── PRICING — SINGLE GLOBAL PRICE ─────────────────────────────────
// DEADCV has ONE global price: $1 USD everywhere.
// For Indian users, the INR equivalent is shown alongside $1 (USD × live FX)
// and the existing UPI QR is displayed. There are NO country-specific tiers.
// Read prices at call-time so Vercel env vars are always available.
function getPriceUSD() { return parseInt(process.env.PRICE_USD || '1',   10); }
function getUpiPriceInrFallback() {
  // UPI_PRICE_INR is a configured INR amount for the QR fallback.
  // If not set, derive from $1 × fallback FX (84) so display never breaks.
  const envVal = parseInt(process.env.UPI_PRICE_INR || '', 10);
  if (!Number.isNaN(envVal) && envVal > 0) return envVal;
  // Also support legacy PRICE_INR for backwards compat
  const legacy = parseInt(process.env.PRICE_INR || '', 10);
  if (!Number.isNaN(legacy) && legacy > 0) return legacy;
  return Math.round(getPriceUSD() * 84);
}
function getIntlEnabled() { return process.env.INTERNATIONAL_PAYMENTS_ENABLED === 'true'; }

// ── AMOUNT / CURRENCY RESOLUTION ──────────────────────────────
/**
 * Resolves the correct amount and currency for a given hint.
 * @param {'INR'|'USD'} currencyHint
 * @returns {{ amount: number, currency: string, displayAmount: string, priceRaw: number }}
 *   amount is in smallest unit (paise for INR, cents for USD).
 */
export function resolvePaymentCurrency(currencyHint = 'INR') {
  const hint = (currencyHint || 'INR').toUpperCase();

  if (hint === 'USD') {
    if (!getIntlEnabled()) {
      throw new Error('INTERNATIONAL_PAYMENTS_NOT_ENABLED');
    }
    const price = getPriceUSD();
    return {
      amount:        price * 100,   // cents
      currency:      'USD',
      displayAmount: `$${price}`,
      priceRaw:      price,
    };
  }

  // Default → INR (UPI QR amount)
  // This is NOT a separate price tier — it is the INR equivalent of $1
  // (configured via UPI_PRICE_INR or derived from $1 × fallback FX).
  const price = getUpiPriceInrFallback();
  return {
    amount:        price * 100,   // paise
    currency:      'INR',
    displayAmount: `₹${price}`,
    priceRaw:      price,
  };
}

// ── CREATE PAYMENT ORDER ──────────────────────────────────────
/**
 * Creates a Razorpay order server-side.
 * @param {{ deadcvOrderId: string, currency?: 'INR'|'USD' }}
 * @returns Razorpay order metadata
 */
export async function createPayment({ deadcvOrderId, currency = 'INR' }) {
  const { amount, currency: resolvedCurrency } = resolvePaymentCurrency(currency);

  const razorpay = getRazorpayInstance();

  const order = await razorpay.orders.create({
    amount,
    currency: resolvedCurrency,
    receipt: deadcvOrderId,
    notes: {
      deadcv_order_id: deadcvOrderId,
      product:         'DEADCV Resume Roast',
    },
  });

  return {
    razorpayOrderId: order.id,
    amount:          order.amount,
    currency:        order.currency,
    status:          order.status,
    receipt:         order.receipt,
    createdAt:       new Date(order.created_at * 1000).toISOString(),
  };
}

// ── VERIFY PAYMENT (post-checkout callback) ───────────────────
/**
 * Verifies the Razorpay HMAC signature returned after checkout.
 * Must be called server-side before marking any order approved.
 *
 * Razorpay formula:
 *   HMAC-SHA256( razorpay_order_id + "|" + razorpay_payment_id, key_secret )
 *
 * @returns boolean
 */
export function verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET not configured.');

  const message  = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected,              'hex'),
      Buffer.from(razorpaySignature,     'hex'),
    );
  } catch {
    // Buffer lengths differ → signature is definitely wrong
    return false;
  }
}

// ── VERIFY WEBHOOK SIGNATURE ──────────────────────────────────
/**
 * Verifies the Razorpay webhook signature from X-Razorpay-Signature.
 * rawBody must be the raw Buffer — do NOT pass parsed JSON.
 *
 * @returns boolean
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not configured.');

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected,        'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── GET PAYMENT STATUS ────────────────────────────────────────
/**
 * Fetches live payment details from Razorpay.
 * Use this to double-check state during webhook or verify flows.
 */
export async function getPaymentStatus(razorpayPaymentId) {
  const razorpay  = getRazorpayInstance();
  const payment   = await razorpay.payments.fetch(razorpayPaymentId);

  return {
    id:        payment.id,
    orderId:   payment.order_id,
    status:    payment.status,     // 'captured' | 'failed' | 'refunded'
    amount:    payment.amount,
    currency:  payment.currency,
    method:    payment.method,
    captured:  payment.captured,
    createdAt: new Date(payment.created_at * 1000).toISOString(),
  };
}

// ── REFUND PAYMENT ────────────────────────────────────────────
/**
 * Initiates a full or partial refund.
 * @param {string}  razorpayPaymentId
 * @param {number=} amount  In smallest unit (paise/cents). Omit for full refund.
 */
export async function refundPayment(razorpayPaymentId, amount) {
  const razorpay = getRazorpayInstance();
  const opts     = amount ? { amount } : {};
  const refund   = await razorpay.payments.refund(razorpayPaymentId, opts);

  return {
    refundId:  refund.id,
    paymentId: refund.payment_id,
    amount:    refund.amount,
    currency:  refund.currency,
    status:    refund.status,
    createdAt: new Date(refund.created_at * 1000).toISOString(),
  };
}

// ── INTERNATIONAL AVAILABILITY CHECK ─────────────────────────
export function isInternationalEnabled() {
  return getIntlEnabled();
}
