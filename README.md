# 💀 DEADCV

> Upload your resume. Pay **$1** — we'll tell you exactly what's wrong. In India $1 ≈ ₹88 via UPI.

DEADCV is an AI-powered resume roasting service. You get a brutally honest, AI-generated analysis of everything wrong with your resume — buzzwords, weak bullets, zero metrics, the works — presented as a shareable "death card".

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES Modules), HTML, CSS |
| Backend | Node.js + Express 5 (ESM) |
| Payments | Razorpay Standard Checkout |
| AI | Google Gemini 2.5 Flash |
| Resume parsing | pdf-parse (PDF), Mammoth (DOCX) |
| Build tool | Vite |
| Deployment | Vercel (frontend static + serverless API) |
| Data store | Flat JSON file (`data/orders.json`) |

---

## Local Installation

```bash
git clone https://github.com/prathameshtarde124/DEADCV.git
cd DEADCV
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3000`) |
| `ADMIN_SECRET` | Yes | Password for the `/owner` operator dashboard |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key ID (public) |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API key secret (server-side only) |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Secret for webhook signature verification |
| `PRICE_USD` | No | Global price in dollars — single price for all countries (default: `1`) |
| `UPI_PRICE_INR` | No | INR display equivalent of $1 for UPI QR fallback (default: `88` ≈ live USD→INR) |
| `INTERNATIONAL_PAYMENTS_ENABLED` | No | Set `true` only after Razorpay approves international USD payments (default: `false`) |
| `UPI_ID` | No | UPI ID for operator reference only (not shown on site; QR image is used) |
| `UPI_MERCHANT_NAME` | No | Merchant name for operator reference |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for roast generation |

**Pricing note:** There are **no country-specific tiers**. The canonical price is **$1 USD everywhere**. Indian visitors see the approximate INR equivalent (live USD→INR via `open.er-api.com`, cached 1h, fallback ₹84) alongside $1 plus the UPI QR option. The QR amount is configured via `UPI_PRICE_INR` and should reflect the current conversion — do not claim a fixed ₹99 equals $1.

**Never put real secret values into source code or commit `.env` to Git.**

---

## Running Locally

Start the Express API server:

```bash
node server.js
```

In a separate terminal, start the Vite dev server (proxies `/api` to port 3000):

```bash
npm run dev
```

Open `http://localhost:5173`.

Use Razorpay **test keys** (`rzp_test_...`) during local development. Never use live keys locally.

---

## Payment Integration

DEADCV uses [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).

### How it works

```
1. User uploads resume  →  POST /api/upload  →  DEADCV order created
2. User lands on /payment  →  GET /api/config  →  server resolves currency
3. User clicks Pay  →  POST /api/payments/create-order  →  Razorpay order created server-side
4. Razorpay popup opens  →  user completes payment (UPI / Card / Apple Pay / Google Pay)
5. Razorpay calls handler with payment IDs  →  POST /api/payments/verify
6. Server verifies HMAC signature + amount via Razorpay API
7. Order marked approved  →  redirect to /processing  →  AI roast generated
```

### Pricing — single global price

DEADCV has **one** price: **$1 USD** for every country — no tiers.  
Indian visitors see the approximate INR equivalent (live USD→INR from `open.er-api.com`, cached 1h, fallback ₹84) alongside the $1 label plus the **UPI QR** option. International visitors see `$1` with **Razorpay Standard Checkout** (cards/wallets). The INR value is a conversion display only — the underlying charge remains $1.

### Payment methods shown

Razorpay determines available payment methods based on the user's device, browser, and account:

- **India (UPI door)**: Scan UPI QR with any UPI app → submit UTR → operator verifies manually; alternatively Razorpay INR if needed
- **International (Razorpay door, when enabled)**: Visa, Mastercard, Amex, Apple Pay (eligible devices), Google Pay (eligible devices)

No methods are hardcoded or pretended. The INR UPI amount is configured via `UPI_PRICE_INR` and should reflect the current $1 conversion — never claim a fixed ₹99 equals $1.

---

## Razorpay Setup

1. Create an account at [razorpay.com](https://razorpay.com).
2. Complete KYC and link your Indian bank account for settlement.
3. Get API keys from **Dashboard → Settings → API Keys**.
4. Use **Test mode keys** (`rzp_test_...`) for development.
5. **International payments** require Razorpay to approve your account. Keep `INTERNATIONAL_PAYMENTS_ENABLED=false` until they do.

### Settlement flow

```
Customer → Razorpay → Settlement → Your Indian Bank Account
```

DEADCV does not handle money directly. Razorpay settles to the configured bank account on your merchant dashboard.

---

## Webhook Endpoint

```
POST /api/payments/razorpay/webhook
```

Configure this in **Razorpay Dashboard → Webhooks**.

- Set the URL to `https://YOUR-DOMAIN.com/api/payments/razorpay/webhook`
- Set a webhook secret and add it to your environment as `RAZORPAY_WEBHOOK_SECRET`
- Enable the `payment.captured` event

The webhook verifies the `X-Razorpay-Signature` header, checks amount, and is idempotent — it will never approve an order twice or trigger duplicate roast generation.

---

## Vercel Deployment

### Deploy from GitHub

1. Push this repo to GitHub (`.env` is gitignored — never committed).
2. Import the project in [vercel.com](https://vercel.com).
3. Vercel auto-detects the config from `vercel.json`.

### Configure environment variables in Vercel

Go to **Project → Settings → Environment Variables** and add:

```
RAZORPAY_KEY_ID         → your live key ID  (rzp_live_...)
RAZORPAY_KEY_SECRET     → your live key secret
RAZORPAY_WEBHOOK_SECRET → your webhook secret
GEMINI_API_KEY          → your Gemini API key
ADMIN_SECRET            → a strong random secret
PRICE_USD               → 1
UPI_PRICE_INR           → 88
INTERNATIONAL_PAYMENTS_ENABLED → false (or true when approved)
```

**Do not use the `VITE_` prefix for any of these** — they are all server-side secrets and must never be exposed to the browser.

### After deploying

Update your Razorpay webhook URL to point to your Vercel deployment:

```
https://YOUR-PROJECT.vercel.app/api/payments/razorpay/webhook
```

The app works without a custom domain. Add one later from Vercel's domain settings.

---

## Pages

| Path | Description |
|---|---|
| `/` | Landing page |
| `/upload` | Resume upload + job details form |
| `/payment` | Razorpay checkout |
| `/processing` | AI roast generation (post-payment) |
| `/result` | Roast card + social share |
| `/owner` | Operator dashboard (admin-only) |
| `/terms` | Terms & Conditions |
| `/privacy` | Privacy Policy |
| `/refund` | Refund & Cancellation Policy |
| `/contact` | Contact page |

---

## Security Notes

- Card numbers, CVV, and credentials are never handled by DEADCV. Razorpay handles all card data.
- Payment verification uses HMAC-SHA256 with `crypto.timingSafeEqual` — never the frontend success state.
- Webhook signatures are verified before any order state changes.
- The Razorpay secret key, Gemini API key, and webhook secret are server-side only and never sent to the browser.
- Uploaded resume files and `data/orders.json` are gitignored and never committed.

---

## Build

```bash
npm run build    # Vite build → dist/
npm run preview  # Preview the production build locally
```
