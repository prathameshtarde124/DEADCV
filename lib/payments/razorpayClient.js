// ─────────────────────────────────────────────────────────────
// DEADCV — Razorpay API Client (isolated SDK wrapper)
// All Razorpay SDK access goes through here only.
// ─────────────────────────────────────────────────────────────
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let _instance = null;

/**
 * Returns a singleton Razorpay instance.
 * Throws if credentials are missing or the package is not installed.
 */
export function getRazorpayInstance() {
  if (_instance) return _instance;

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env before using payment features.'
    );
  }

  let RazorpayClass;
  try {
    const mod = require('razorpay');
    // razorpay ships as CJS; handle both default and named export shapes
    RazorpayClass = mod.default || mod;
  } catch (err) {
    throw new Error(
      'razorpay npm package not installed. Run: npm install razorpay'
    );
  }

  _instance = new RazorpayClass({ key_id: keyId, key_secret: keySecret });
  return _instance;
}

/**
 * Force-reset the singleton.
 * Useful in tests or when credentials change at runtime.
 */
export function resetRazorpayInstance() {
  _instance = null;
}
