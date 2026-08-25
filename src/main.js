// ═════════════════════════════════════════════════════════════
// DEADCV — VIRAL RESUME ROASTING PLATFORM
// "recruiter.exe has entered the chat"
// ═════════════════════════════════════════════════════════════

// ── RETRO SYNTH AUDIO ───────────────────────────────────────
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playCursedBeep(freq = 440, type = 'square', duration = 0.08, vol = 0.05) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio silently ignored if not permitted
  }
}

// ── CURSOR TRAIL EFFECT ─────────────────────────────────────
const cursorDot = document.querySelector('.cursor-dot');
if (cursorDot) {
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let dotX = mouseX;
  let dotY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function renderCursor() {
    dotX += (mouseX - dotX) * 0.3;
    dotY += (mouseY - dotY) * 0.3;
    cursorDot.style.transform = `translate(${dotX - 4}px, ${dotY - 4}px)`;
    requestAnimationFrame(renderCursor);
  }
  renderCursor();
}

// ── TERMINAL BOOT SEQUENCE (HOME VIEW) ──────────────────────
function initTerminal() {
  const terminalBody = document.getElementById('terminal-body');
  if (!terminalBody) return;

  const lines = [
    { text: '> booting deadcv...', delay: 150, color: 'var(--green)' },
    { text: '> loading recruiter...', delay: 800, color: 'var(--green)' },
    { text: '> scanning resume...', delay: 1500, color: 'var(--green)' },
    { text: '> status: concerning', delay: 2200, color: 'var(--red)', isError: true },
    { text: '> _', delay: 2800, color: 'var(--fg)' }
  ];

  terminalBody.innerHTML = '';

  lines.forEach((line) => {
    setTimeout(() => {
      const lineEl = document.createElement('div');
      lineEl.className = 'terminal__line' + (line.isError ? ' terminal__line--error' : '');
      lineEl.style.color = line.color;
      lineEl.textContent = line.text;
      terminalBody.appendChild(lineEl);
      terminalBody.scrollTop = terminalBody.scrollHeight;
      playCursedBeep(line.isError ? 160 : 380 + Math.random() * 150, 'sawtooth', 0.03, 0.02);
    }, line.delay);
  });
}

// ── SCORE ANIMATION (HOME VIEW) ─────────────────────────────
function initScoreCounter() {
  const scoreEl = document.getElementById('report-score');
  if (!scoreEl) return;

  let hasAnimated = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        let count = 0;
        const target = 63;
        const interval = setInterval(() => {
          count += 2;
          if (count >= target) {
            count = target;
            clearInterval(interval);
          }
          scoreEl.textContent = count;
        }, 30);
      }
    });
  }, { threshold: 0.5 });

  const reportSection = document.getElementById('sample-report');
  if (reportSection) observer.observe(reportSection);
}

// ── SOUND FX ON BUTTON HOVER & CLICK ────────────────────────
function bindSoundEffects() {
  document.querySelectorAll('a, button, .kill-card, .how-step, .tombstone, .morgue-drop-box, .roast-card-box').forEach(elem => {
    if (elem.dataset.hasAudio) return;
    elem.dataset.hasAudio = 'true';
    elem.addEventListener('mouseenter', () => {
      playCursedBeep(320, 'square', 0.03, 0.015);
    });
    elem.addEventListener('click', () => {
      playCursedBeep(580, 'sawtooth', 0.06, 0.03);
    });
  });
}

// ── EASTER EGG: GLITCH ON SKULL CLICK ───────────────────────
const skull = document.querySelector('.nav__skull');
if (skull) {
  skull.addEventListener('click', () => {
    document.body.classList.add('glitch');
    playCursedBeep(120, 'sawtooth', 0.3, 0.1);
    setTimeout(() => {
      document.body.classList.remove('glitch');
    }, 400);
  });
}

// ═════════════════════════════════════════════════════════════
// CLIENT-SIDE ROUTER & VIEW SWITCHER
// ═════════════════════════════════════════════════════════════
let waitingPollTimer = null;

function navigateTo(path) {
  history.pushState(null, '', path);
  renderCurrentRoute();
}

function renderCurrentRoute() {
  const path = window.location.pathname;
  const viewHome       = document.getElementById('view-home');
  const viewUpload     = document.getElementById('view-upload');
  const viewPayment    = document.getElementById('view-payment');
  const viewWaiting    = document.getElementById('view-waiting');
  const viewProcessing = document.getElementById('view-processing');
  const viewResult     = document.getElementById('view-result');
  const viewOwner      = document.getElementById('view-owner');
  const viewTerms      = document.getElementById('view-terms');
  const viewPrivacy    = document.getElementById('view-privacy');
  const viewRefund     = document.getElementById('view-refund');
  const viewContact    = document.getElementById('view-contact');

  if (waitingPollTimer) {
    clearInterval(waitingPollTimer);
    waitingPollTimer = null;
  }
  if (typeof _upiPollTimer !== 'undefined' && _upiPollTimer) {
    clearInterval(_upiPollTimer);
    _upiPollTimer = null;
  }

  [
    viewHome, viewUpload, viewPayment, viewWaiting, viewProcessing,
    viewResult, viewOwner, viewTerms, viewPrivacy, viewRefund, viewContact
  ].forEach(v => { if (v) v.style.display = 'none'; });

  window.scrollTo(0, 0);

  if (path === '/upload') {
    if (viewUpload) viewUpload.style.display = 'block';
    resetUploadFormState();
  } else if (path === '/payment') {
    if (viewPayment) viewPayment.style.display = 'block';
    initPaymentPage();
  } else if (path === '/waiting') {
    if (viewWaiting) viewWaiting.style.display = 'block';
    initWaitingPage();
  } else if (path === '/processing') {
    if (viewProcessing) viewProcessing.style.display = 'block';
    initProcessingPage();
  } else if (path === '/result') {
    if (viewResult) viewResult.style.display = 'block';
    initResultPage();
  } else if (path === '/owner') {
    if (viewOwner) viewOwner.style.display = 'block';
    initOwnerPage();
  } else if (path === '/terms') {
    if (viewTerms) viewTerms.style.display = 'block';
  } else if (path === '/privacy') {
    if (viewPrivacy) viewPrivacy.style.display = 'block';
  } else if (path === '/refund') {
    if (viewRefund) viewRefund.style.display = 'block';
  } else if (path === '/contact') {
    if (viewContact) viewContact.style.display = 'block';
  } else {
    if (viewHome) viewHome.style.display = 'block';
    initTerminal();
    syncGlobalPrice();
  }

  bindSoundEffects();
  // Always keep global INR display in sync (hero, how, etc) if visible
  syncGlobalPrice();
}

async function syncGlobalPrice() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();
    const inrDisplay = cfg.displayInrEquiv || cfg.displayUpiINR || `₹${cfg.inrEquiv || 88}`;
    document.querySelectorAll('.inr-equiv, #hero-inr-val').forEach(el => { el.textContent = inrDisplay; });
    const upiNote = document.getElementById('upi-inr-note');
    if (upiNote) upiNote.textContent = inrDisplay;
    const upiPriceEl = document.getElementById('upi-price-display');
    if (upiPriceEl && !window.location.pathname.includes('/payment')) {
      // Only update UPI door if not on payment page (payment page has its own logic)
    }
  } catch (_) {}
}

// Intercept link clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    if (href && (href.startsWith('/') || href.startsWith('#'))) {
      e.preventDefault();
      navigateTo(href || '/');
    }
  }
});

window.addEventListener('popstate', renderCurrentRoute);

// ═════════════════════════════════════════════════════════════
// UPLOAD FLOW CONTROLLER
// ═════════════════════════════════════════════════════════════
let selectedResumeFile = null;

function resetUploadFormState() {
  selectedResumeFile = null;
  const errorBanner = document.getElementById('upload-error-banner');
  const dropBox = document.getElementById('morgue-drop-box');
  const fileFoundSection = document.getElementById('file-found-section');
  const loader = document.getElementById('morgue-loader');
  const submitBtn = document.getElementById('btn-submit-morgue');
  const fileInput = document.getElementById('file-input-hidden');
  const targetJobInput = document.getElementById('target-job-input');
  const jobDescInput = document.getElementById('job-desc-input');

  if (errorBanner) errorBanner.style.display = 'none';
  if (dropBox) dropBox.style.display = 'block';
  if (fileFoundSection) fileFoundSection.style.display = 'none';
  if (loader) loader.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (targetJobInput) targetJobInput.value = '';
  if (jobDescInput) jobDescInput.value = '';
  if (submitBtn) {
    submitBtn.removeAttribute('disabled');
    submitBtn.style.opacity = '1';
  }
}

function showUploadError(msg) {
  const banner = document.getElementById('upload-error-banner');
  const text = document.getElementById('upload-error-text');
  if (banner && text) {
    text.textContent = msg;
    banner.style.display = 'flex';
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playCursedBeep(140, 'sawtooth', 0.2, 0.08);
  }
}

function hideUploadError() {
  const banner = document.getElementById('upload-error-banner');
  if (banner) banner.style.display = 'none';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'kb';
  return (bytes / (1024 * 1024)).toFixed(1) + 'mb';
}

function handleFileSelection(file) {
  hideUploadError();

  if (!file) return;

  // Validate size: 10 MB
  if (file.size > 10 * 1024 * 1024) {
    showUploadError('file too large. the resume is already suffering enough.');
    return;
  }

  // Validate format
  const lowerName = file.name.toLowerCase();
  const isValidType = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc');

  if (!isValidType) {
    showUploadError('unsupported file format. only PDF or DOCX corpses accepted.');
    return;
  }

  selectedResumeFile = file;

  const dropBox = document.getElementById('morgue-drop-box');
  const fileFoundSection = document.getElementById('file-found-section');
  const foundFilename = document.getElementById('found-filename');
  const foundFilesize = document.getElementById('found-filesize');
  const foundStatus = document.getElementById('found-status');

  if (foundFilename) foundFilename.textContent = file.name;
  if (foundFilesize) foundFilesize.textContent = formatFileSize(file.size);
  if (foundStatus) foundStatus.textContent = 'readable';

  if (dropBox) dropBox.style.display = 'none';
  if (fileFoundSection) fileFoundSection.style.display = 'block';

  playCursedBeep(660, 'sine', 0.1, 0.05);

  const targetJobInput = document.getElementById('target-job-input');
  if (targetJobInput) {
    setTimeout(() => targetJobInput.focus(), 100);
  }
}

function initUploadEventListeners() {
  const dropBox = document.getElementById('morgue-drop-box');
  const chooseBtn = document.getElementById('btn-choose-file');
  const fileInput = document.getElementById('file-input-hidden');
  const changeFileBtn = document.getElementById('btn-change-file');
  const uploadForm = document.getElementById('upload-form');

  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropBox && fileInput) {
    dropBox.addEventListener('click', () => {
      fileInput.click();
    });

    dropBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropBox.classList.add('dragover');
    });

    dropBox.addEventListener('dragleave', () => {
      dropBox.classList.remove('dragover');
    });

    dropBox.addEventListener('drop', (e) => {
      e.preventDefault();
      dropBox.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  if (changeFileBtn) {
    changeFileBtn.addEventListener('click', () => {
      resetUploadFormState();
      playCursedBeep(300, 'square', 0.05, 0.03);
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!selectedResumeFile) {
        showUploadError('no file provided. please present the body.');
        return;
      }

      const targetJob = (document.getElementById('target-job-input')?.value || '').trim();
      const jobDescription = (document.getElementById('job-desc-input')?.value || '').trim();
      const roastIntensity = document.querySelector('input[name="roastIntensity"]:checked')?.value || 'Brutal';

      if (!targetJob) {
        showUploadError('please specify what job you are trying to get hired for.');
        return;
      }

      hideUploadError();

      const loader = document.getElementById('morgue-loader');
      const submitBtn = document.getElementById('btn-submit-morgue');
      if (loader) loader.style.display = 'block';
      if (submitBtn) {
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.style.opacity = '0.5';
      }

      const formData = new FormData();
      formData.append('resume', selectedResumeFile);
      formData.append('targetJob', targetJob);
      formData.append('jobDescription', jobDescription);
      formData.append('roastIntensity', roastIntensity);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'this corpse is unreadable.');
        }

        sessionStorage.setItem('deadcv_latest_order', JSON.stringify(data.order || { orderId: data.orderId }));

        playCursedBeep(880, 'sawtooth', 0.2, 0.06);

        navigateTo(`/payment?orderId=${encodeURIComponent(data.orderId)}`);

      } catch (err) {
        console.error('Upload error:', err);
        showUploadError(err.message || 'this corpse is unreadable.');
        if (loader) loader.style.display = 'none';
        if (submitBtn) {
          submitBtn.removeAttribute('disabled');
          submitBtn.style.opacity = '1';
        }
      }
    });
  }
}

// ═════════════════════════════════════════════════════════════
// PAYMENT FLOW (/payment) — Two-door layout
//   Door 1: Razorpay Standard Checkout ($1 international)
//   Door 2: UPI QR + manual UTR (₹ India)
// ═════════════════════════════════════════════════════════════
let _checkoutOrderId  = null;
let _checkoutKeyId    = null;
let _checkoutCurrency = 'USD';

// ── helpers ──────────────────────────────────────────────────
function showEl(id)  { const e = document.getElementById(id); if (e) e.style.display = ''; }
function hideEl(id)  { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
function blockEl(id) { const e = document.getElementById(id); if (e) e.style.display = 'block'; }

function setIntlState(state) {
  // state: 'available' | 'unavailable' | 'verifying' | 'failed' | 'cancelled'
  ['intl-available', 'intl-unavailable', 'intl-verifying', 'intl-failed', 'intl-cancelled']
    .forEach(id => hideEl(id));
  blockEl('intl-' + state);
}

async function initPaymentPage() {
  // Resolve order ID from URL or session
  const urlParams = new URLSearchParams(window.location.search);
  let orderId = urlParams.get('orderId');
  if (!orderId) {
    try {
      const cached = sessionStorage.getItem('deadcv_latest_order');
      if (cached) orderId = JSON.parse(cached).orderId;
    } catch (_) {}
  }

  hideEl('pay2-init-loading');

  if (!orderId) {
    blockEl('pay2-init-error');
    return;
  }

  _checkoutOrderId = orderId;
  const el = document.getElementById('pay2-order-id');
  if (el) el.textContent = orderId;

  // Fetch config
  let config = null;
  try {
    const res = await fetch('/api/config');
    config = await res.json();
  } catch (_) {
    blockEl('pay2-init-error');
    return;
  }

  if (!config.razorpayConfigured || !config.razorpayKeyId) {
    blockEl('pay2-init-error');
    return;
  }

  _checkoutKeyId = config.razorpayKeyId;

  // Update price labels from server values — single global $1, INR is live conversion
  const intlPriceEl = document.getElementById('intl-price-display');
  const upiPriceEl  = document.getElementById('upi-price-display');
  const upiInrNote  = document.getElementById('upi-inr-note');
  const intlBtnLbl  = document.getElementById('btn-intl-label');
  const priceUSD    = config.displayPriceUSD || '$1';
  const inrDisplay  = config.displayInrEquiv || config.displayUpiINR || `₹${config.inrEquiv || 88}`;
  const inrVal      = config.displayInrEquiv || config.displayUpiINR || `₹${config.inrEquiv || 88}`;
  if (intlPriceEl) intlPriceEl.textContent = priceUSD;
  if (upiPriceEl)  upiPriceEl.textContent  = inrDisplay;
  if (upiInrNote)  upiInrNote.textContent  = inrDisplay;
  if (intlBtnLbl)  intlBtnLbl.textContent  = `PAY ${priceUSD} & GET COOKED →`;
  // Update all generic inr-equiv spans on the page (hero, how, final cta)
  document.querySelectorAll('.inr-equiv, #hero-inr-val').forEach(el => {
    el.textContent = inrDisplay;
  });
  const heroNote = document.getElementById('hero-inr-note');
  if (heroNote) heroNote.style.display = '';

  // Show intl door state
  if (config.internationalEnabled) {
    setIntlState('available');
  } else {
    setIntlState('unavailable');
  }

  // Reveal the two doors
  blockEl('pay2-doors');

  // ── Wire intl pay buttons ──
  ['btn-pay-intl', 'btn-intl-retry', 'btn-intl-cancelled-pay'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn && !btn.dataset.hasListener) {
      btn.dataset.hasListener = 'true';
      btn.addEventListener('click', () => openRazorpayCheckout());
    }
  });

  // ── Wire UTR submit ──
  const utrInput = document.getElementById('utr-input');
  const utrBtn   = document.getElementById('btn-submit-utr');
  if (utrBtn && !utrBtn.dataset.hasListener) {
    utrBtn.dataset.hasListener = 'true';
    utrBtn.addEventListener('click', () => submitUTR());
  }
  if (utrInput && !utrInput.dataset.hasListener) {
    utrInput.dataset.hasListener = 'true';
    utrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitUTR();
    });
  }

  // If this order already has pending_verification status (user came back),
  // skip straight to the waiting state
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.order?.paymentStatus === 'approved') {
        navigateTo(`/processing?orderId=${encodeURIComponent(orderId)}`);
        return;
      }
      if (data.order?.paymentStatus === 'pending_verification') {
        blockEl('upi-waiting');
        hideEl('upi-qr-section');
        hideEl('upi-utr-section');
        startUpiPolling(orderId);
      }
    }
  } catch (_) {}
}

async function openRazorpayCheckout() {
  if (!_checkoutOrderId || !_checkoutKeyId) return;

  setIntlState('available');
  const btn = document.getElementById('btn-pay-intl');
  if (btn) { btn.textContent = 'connecting...'; btn.disabled = true; }

  let razorpayOrderId, amount, currency;
  try {
    const res = await fetch('/api/payments/create-order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ deadcvOrderId: _checkoutOrderId, currency: 'USD' }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (data.error === 'INTERNATIONAL_PAYMENTS_NOT_ENABLED') {
        setIntlState('unavailable');
        return;
      }
      throw new Error(data.message || 'Could not create payment order.');
    }
    razorpayOrderId = data.razorpayOrderId;
    amount          = data.amount;
    currency        = data.currency;
  } catch (err) {
    console.error('[checkout] order creation failed:', err);
    setIntlState('failed');
    return;
  } finally {
    const b = document.getElementById('btn-pay-intl');
    if (b) { b.textContent = `PAY ${document.getElementById('intl-price-display')?.textContent || '$1'} & GET COOKED →`; b.disabled = false; }
  }

  const options = {
    key:         _checkoutKeyId,
    amount,
    currency,
    name:        'DEADCV',
    description: 'Resume Roast — One-time payment',
    order_id:    razorpayOrderId,
    prefill:     {},
    theme:       { color: '#ff2222' },
    modal: {
      ondismiss: () => {
        setIntlState('cancelled');
        playCursedBeep(200, 'sawtooth', 0.2, 0.08);
      },
    },
    handler: async (response) => {
      setIntlState('verifying');
      playCursedBeep(880, 'sine', 0.15, 0.06);
      await verifyAndProceed(response);
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', () => {
      setIntlState('failed');
      playCursedBeep(130, 'sawtooth', 0.3, 0.1);
    });
    rzp.open();
  } catch (err) {
    console.error('[checkout] Razorpay SDK error:', err);
    setIntlState('failed');
  }
}

async function verifyAndProceed(razorpayResponse) {
  try {
    const res = await fetch('/api/payments/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        deadcvOrderId:     _checkoutOrderId,
        razorpayOrderId:   razorpayResponse.razorpay_order_id,
        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
        razorpaySignature: razorpayResponse.razorpay_signature,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      playCursedBeep(980, 'sine', 0.3, 0.08);
      navigateTo('/processing?orderId=' + encodeURIComponent(_checkoutOrderId));
    } else {
      setIntlState('failed');
    }
  } catch (err) {
    console.error('[checkout] verification error:', err);
    setIntlState('failed');
  }
}

async function submitUTR() {
  const input    = document.getElementById('utr-input');
  const errorEl  = document.getElementById('utr-error');
  const utr      = (input?.value || '').trim();

  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  if (!utr || utr.length < 6) {
    if (errorEl) { errorEl.textContent = '> UTR is too short. Check the transaction ID in your UPI app.'; errorEl.style.display = 'block'; }
    playCursedBeep(200, 'sawtooth', 0.1, 0.05);
    return;
  }

  const btn = document.getElementById('btn-submit-utr');
  if (btn) { btn.textContent = 'submitting...'; btn.disabled = true; }

  try {
    const res = await fetch('/api/payments/submit-utr', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ deadcvOrderId: _checkoutOrderId, utr }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      playCursedBeep(660, 'sine', 0.12, 0.06);
      // Show waiting state in UPI door
      hideEl('upi-qr-section');
      hideEl('upi-utr-section');
      blockEl('upi-waiting');
      startUpiPolling(_checkoutOrderId);
    } else {
      if (errorEl) { errorEl.textContent = '> ' + (data.error || 'Submission failed. Try again.'); errorEl.style.display = 'block'; }
      playCursedBeep(200, 'sawtooth', 0.1, 0.05);
    }
  } catch (err) {
    if (errorEl) { errorEl.textContent = '> Connection error. Please retry.'; errorEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.textContent = 'I PAID →'; btn.disabled = false; }
  }
}

let _upiPollTimer = null;
function startUpiPolling(orderId) {
  if (_upiPollTimer) return; // already polling
  _upiPollTimer = setInterval(async () => {
    try {
      const res  = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.order?.paymentStatus === 'approved') {
        clearInterval(_upiPollTimer);
        _upiPollTimer = null;
        playCursedBeep(980, 'sine', 0.3, 0.08);
        navigateTo(`/processing?orderId=${encodeURIComponent(orderId)}`);
      }
      if (data.order?.paymentStatus === 'rejected') {
        clearInterval(_upiPollTimer);
        _upiPollTimer = null;
        // Bring back the UTR form with an error
        hideEl('upi-waiting');
        showEl('upi-qr-section');
        showEl('upi-utr-section');
        const errorEl = document.getElementById('utr-error');
        if (errorEl) { errorEl.textContent = '> Payment was rejected. Check the amount and retry.'; errorEl.style.display = 'block'; }
        playCursedBeep(130, 'sawtooth', 0.3, 0.1);
      }
    } catch (_) {}
  }, 4000);
}

// ═════════════════════════════════════════════════════════════
// WAITING PAGE (/waiting)
// ═════════════════════════════════════════════════════════════
function initWaitingPage() {
  const urlParams = new URLSearchParams(window.location.search);
  let orderId = urlParams.get('orderId');

  if (!orderId) {
    try {
      const cached = sessionStorage.getItem('deadcv_latest_order');
      if (cached) orderId = JSON.parse(cached).orderId;
    } catch (e) {}
  }

  const waitingOrderId = document.getElementById('waiting-order-id');
  const waitingTargetRole = document.getElementById('waiting-target-role');
  const waitingUtrVal = document.getElementById('waiting-utr-val');
  const waitingTimeVal = document.getElementById('waiting-time-val');
  const waitingPulse = document.getElementById('waiting-pulse-status');
  const rejectionBox = document.getElementById('waiting-rejection-msg');
  const rejReason = document.getElementById('waiting-rej-reason');
  const retryBtn = document.getElementById('rej-retry-btn');

  if (waitingOrderId) waitingOrderId.textContent = orderId || 'DEAD-UNKNOWN';
  if (rejectionBox) rejectionBox.style.display = 'none';

  let pollCount = 0;

  async function checkOrderStatus() {
    if (!orderId) return;
    pollCount++;
    if (waitingPulse) {
      waitingPulse.textContent = `> listening for operator confirmation... [poll #${pollCount}]`;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.order) {
          const o = json.order;

          if (waitingTargetRole) waitingTargetRole.textContent = o.targetJob || 'General Role';
          if (waitingUtrVal) waitingUtrVal.textContent = o.utr || 'Not submitted yet';
          if (waitingTimeVal) {
            waitingTimeVal.textContent = o.utrSubmittedAt ? new Date(o.utrSubmittedAt).toLocaleTimeString() : 'Pending';
          }

          // Check if approved -> immediately move to /processing -> /result
          if (o.paymentStatus === 'approved') {
            clearInterval(waitingPollTimer);
            waitingPollTimer = null;
            playCursedBeep(980, 'sine', 0.3, 0.08);
            navigateTo(`/processing?orderId=${encodeURIComponent(orderId)}`);
            return;
          }

          if (o.paymentStatus === 'rejected') {
            clearInterval(waitingPollTimer);
            waitingPollTimer = null;
            if (rejectionBox) {
              rejectionBox.style.display = 'block';
              if (rejReason) rejReason.textContent = o.verificationNote || 'UTR could not be verified in bank ledger.';
            }
            if (waitingPulse) waitingPulse.textContent = '> verification terminated: payment rejected.';
            playCursedBeep(130, 'sawtooth', 0.4, 0.1);
          }
        }
      }
    } catch (e) {
      console.warn('Polling error:', e);
    }
  }

  if (retryBtn) {
    retryBtn.href = `/payment?orderId=${encodeURIComponent(orderId || '')}`;
  }

  checkOrderStatus();
  waitingPollTimer = setInterval(checkOrderStatus, 3000);
}

// ═════════════════════════════════════════════════════════════
// PROCESSING PAGE (/processing) -> Generates Roast & Moves to /result
// ═════════════════════════════════════════════════════════════
async function initProcessingPage() {
  const urlParams = new URLSearchParams(window.location.search);
  let orderId = urlParams.get('orderId');

  if (!orderId) {
    try {
      const cached = sessionStorage.getItem('deadcv_latest_order');
      if (cached) orderId = JSON.parse(cached).orderId;
    } catch (e) {}
  }

  const progressBar = document.getElementById('proc-progress');
  const activeStep = document.getElementById('proc-active-step');

  const steps = [
    { text: '> auditing buzzword overdose...', pct: 25 },
    { text: '> calculating recruiter cringe factor...', pct: 55 },
    { text: '> detecting missing measurable metrics...', pct: 80 },
    { text: '> assembling viral autopsy report...', pct: 100 }
  ];

  let currentStep = 0;
  const stepInterval = setInterval(() => {
    if (currentStep < steps.length) {
      if (activeStep) activeStep.textContent = steps[currentStep].text;
      if (progressBar) progressBar.style.width = steps[currentStep].pct + '%';
      playCursedBeep(450 + currentStep * 100, 'square', 0.05, 0.02);
      currentStep++;
    }
  }, 500);

  // Request the roast generation from backend
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/roast`);
    const data = await res.json();

    clearInterval(stepInterval);
    if (progressBar) progressBar.style.width = '100%';

    if (data.success && data.roast) {
      sessionStorage.setItem(`deadcv_roast_${orderId}`, JSON.stringify(data.roast));
      setTimeout(() => {
        navigateTo(`/result?orderId=${encodeURIComponent(orderId)}`);
      }, 700);
    } else {
      alert('☠️ ' + (data.error || 'Could not generate roast report.'));
      navigateTo(`/waiting?orderId=${encodeURIComponent(orderId)}`);
    }
  } catch (err) {
    clearInterval(stepInterval);
    console.error('Error generating roast:', err);
    alert('☠️ Error communicating with morgue AI engine.');
  }
}

// ═════════════════════════════════════════════════════════════
// VIRAL RESULT & ROAST CARD VIEW (/result)
// ═════════════════════════════════════════════════════════════
let currentRoastData = null;
let currentRoastOrderId = null;

async function initResultPage() {
  const urlParams = new URLSearchParams(window.location.search);
  let orderId = urlParams.get('orderId');

  if (!orderId) {
    try {
      const cached = sessionStorage.getItem('deadcv_latest_order');
      if (cached) orderId = JSON.parse(cached).orderId;
    } catch (e) {}
  }

  currentRoastOrderId = orderId || 'DEAD-SAMPLE';

  // Try local session cache first for instant render
  let roast = null;
  const cachedRoast = sessionStorage.getItem(`deadcv_roast_${currentRoastOrderId}`);
  if (cachedRoast) {
    try { roast = JSON.parse(cachedRoast); } catch (e) {}
  }

  // If not in cache, fetch from backend
  if (!roast) {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(currentRoastOrderId)}/roast`);
      const data = await res.json();
      if (data.success && data.roast) {
        roast = data.roast;
        sessionStorage.setItem(`deadcv_roast_${currentRoastOrderId}`, JSON.stringify(roast));
      }
    } catch (e) {
      console.warn('Could not fetch roast:', e);
    }
  }

  // If still null, fallback to sample
  if (!roast) {
    roast = {
      deadPercentage: 73,
      causeOfDeath: 'ZERO MEASURABLE IMPACT',
      stats: {
        buzzwords: 17,
        weakBullets: 6,
        actualImpact: '2%',
        recruiterSurvival: '38%',
        personality: 'LinkedIn corporate NPC',
        species: 'The "I did projects" type',
        mostDangerousWord: '"Developed" (7 times)',
        atsStatus: 'Barely breathing'
      },
      roasts: [
        {
          tag: 'YOUR WORST BULLET',
          target: '"Worked on various projects."',
          comment: "bro WHAT projects? that's not an achievement. that's a weather report."
        },
        {
          tag: 'MOST ABUSED WORD',
          target: '"DEVELOPED" (7 TIMES)',
          comment: 'you developed so much you forgot to achieve anything.'
        },
        {
          tag: 'BIGGEST RED FLAG',
          target: 'Your projects have technologies.',
          comment: "They don't have results."
        }
      ],
      recruiterReaction: '“Okay... but what did you actually accomplish?”',
      strongestPart: 'Your name is spelled correctly.',
      biggestWeakness: '14 technologies listed with zero proof of business impact.',
      shareText: 'DEADCV just told me my resume is 73% dead 💀\nApparently "developed" is my entire personality.\nCheck yours: https://deadcv.com',
      improvedRewrite: {
        originalBullet: '"Worked on various projects."',
        critique: "Passive voice, zero metric ownership.",
        fixedBullet: 'Spearheaded 3 core microservices reducing user load time by 34%.',
        actionPlan: [
          'Replace all "responsible for" with concrete percentage gains.',
          'Remove skill bar meters (80% CSS is meaningless).',
          'Condense bullet points to max 2 lines with action verb + metric.'
        ]
      }
    };
  }

  currentRoastData = roast;
  renderRoastContent(roast, currentRoastOrderId);
  bindSocialShareButtons(roast, currentRoastOrderId);
  bindFixResumeSection(roast);
}

function renderRoastContent(roast, orderId) {
  // 1. Animate Dead Percentage
  const deadPctEl = document.getElementById('result-dead-pct');
  const cardScoreBanner = document.getElementById('card-score-banner');
  const targetPct = roast.deadPercentage || 73;

  if (deadPctEl) {
    let count = 0;
    const interval = setInterval(() => {
      count += 3;
      if (count >= targetPct) {
        count = targetPct;
        clearInterval(interval);
      }
      deadPctEl.textContent = count + '%';
      if (cardScoreBanner) cardScoreBanner.textContent = count + '% DEAD';
    }, 25);
  }

  // 2. Cause of Death
  const causeTitle = document.getElementById('result-cause-of-death');
  const cardCauseVal = document.getElementById('card-cause-val');
  const causeText = roast.causeOfDeath || 'NO MEASURABLE IMPACT';

  if (causeTitle) causeTitle.textContent = causeText;
  if (cardCauseVal) cardCauseVal.textContent = causeText;

  // 3. Stats Grid
  const s = roast.stats || {};
  setElText('card-stat-buzzwords', s.buzzwords ?? 17);
  setElText('card-stat-bullets', s.weakBullets ?? 6);
  setElText('card-stat-impact', s.actualImpact || '2%');
  setElText('card-stat-survival', s.recruiterSurvival || '38%');
  setElText('card-stat-personality', s.personality || 'LinkedIn corporate NPC');
  setElText('card-stat-species', s.species || 'The "I did projects" type');
  setElText('card-stat-word', s.mostDangerousWord || '"Developed" (7 times)');
  setElText('card-stat-ats', s.atsStatus || 'Barely breathing');

  // 4. Roast Items List
  const roastList = document.getElementById('roast-items-list');
  if (roastList && roast.roasts && roast.roasts.length > 0) {
    roastList.innerHTML = roast.roasts.map(r => `
      <div class="roast-card-box">
        <span class="roast-tag-badge">&gt; ${escapeHtml(r.tag)}</span>
        <div class="roast-quote-target">${escapeHtml(r.target)}</div>
        <div class="roast-deadcv-comment">
          <strong style="color:var(--red);">DEADCV:</strong> ${escapeHtml(r.comment)}
        </div>
      </div>
    `).join('');
  }

  // 5. Recruiter reaction & strengths/weaknesses
  setElText('roast-recruiter-reaction', roast.recruiterReaction || '“Okay... but what did you actually accomplish?”');
  setElText('roast-strongest-part', roast.strongestPart || 'Your name is spelled correctly.');
  setElText('roast-biggest-weakness', roast.biggestWeakness || 'Zero measurable impact.');

  // 6. Share Caption Textarea
  const captionArea = document.getElementById('share-caption-textarea');
  if (captionArea) {
    captionArea.value = roast.shareText || `DEADCV just told me my resume is ${targetPct}% dead 💀\nCause of death: ${causeText}\nCheck yours before a recruiter does: https://deadcv.com`;
  }
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── FIX RESUME TOGGLE ───────────────────────────────────────
function bindFixResumeSection(roast) {
  const toggleBtn = document.getElementById('btn-toggle-fix');
  const contentPanel = document.getElementById('fix-content-panel');
  const fix = roast.improvedRewrite;

  if (fix) {
    setElText('fix-before-text', fix.originalBullet || '"Worked on various projects."');
    setElText('fix-after-text', fix.fixedBullet || 'Spearheaded 3 core services reducing latency by 32%.');
    setElText('fix-critique-text', fix.critique || 'Eliminates passive filler words and adds clear metrics.');

    const actionList = document.getElementById('fix-action-list');
    if (actionList && fix.actionPlan) {
      actionList.innerHTML = fix.actionPlan.map(a => `<li>${escapeHtml(a)}</li>`).join('');
    }
  }

  if (toggleBtn && !toggleBtn.dataset.hasListener) {
    toggleBtn.dataset.hasListener = 'true';
    toggleBtn.addEventListener('click', () => {
      if (contentPanel) {
        const isHidden = contentPanel.style.display === 'none';
        contentPanel.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? '⚡ [ HIDE PRO FIX ]' : '⚡ [ FIX MY RESUME ]';
        if (isHidden) {
          contentPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          playCursedBeep(750, 'sine', 0.1, 0.05);
        }
      }
    });
  }
}

// ═════════════════════════════════════════════════════════════
// SOCIAL SHARING & HIGH-RES CANVAS EXPORT
// ═════════════════════════════════════════
function bindSocialShareButtons(roast, orderId) {
  const btnStory = document.getElementById('btn-download-story');
  const btnPost = document.getElementById('btn-download-post');
  const btnWhatsapp = document.getElementById('btn-share-whatsapp');
  const btnX = document.getElementById('btn-share-x');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const copyLinkText = document.getElementById('copy-link-text');
  const btnCopyCaption = document.getElementById('btn-copy-caption');
  const captionArea = document.getElementById('share-caption-textarea');

  const shareUrl = window.location.origin + `/result?orderId=${encodeURIComponent(orderId)}`;
  const shareText = captionArea?.value || `DEADCV told me my resume is ${roast.deadPercentage || 73}% dead 💀 Check yours: ${shareUrl}`;

  // Download Story Card (1080 x 1920)
  if (btnStory && !btnStory.dataset.hasListener) {
    btnStory.dataset.hasListener = 'true';
    btnStory.addEventListener('click', () => {
      exportCanvasImage(roast, orderId, 'story');
    });
  }

  // Download Post Card (1080 x 1080)
  if (btnPost && !btnPost.dataset.hasListener) {
    btnPost.dataset.hasListener = 'true';
    btnPost.addEventListener('click', () => {
      exportCanvasImage(roast, orderId, 'post');
    });
  }

  // WhatsApp
  if (btnWhatsapp && !btnWhatsapp.dataset.hasListener) {
    btnWhatsapp.dataset.hasListener = 'true';
    btnWhatsapp.addEventListener('click', () => {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank');
      playCursedBeep(650, 'sine', 0.08, 0.04);
    });
  }

  // X / Twitter
  if (btnX && !btnX.dataset.hasListener) {
    btnX.dataset.hasListener = 'true';
    btnX.addEventListener('click', () => {
      const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
      window.open(xUrl, '_blank');
      playCursedBeep(650, 'sine', 0.08, 0.04);
    });
  }

  // Copy Link
  if (btnCopyLink && !btnCopyLink.dataset.hasListener) {
    btnCopyLink.dataset.hasListener = 'true';
    btnCopyLink.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        if (copyLinkText) copyLinkText.textContent = 'COPIED TO CLIPBOARD! ✓';
        playCursedBeep(880, 'sine', 0.1, 0.05);
        setTimeout(() => {
          if (copyLinkText) copyLinkText.textContent = 'COPY LINK';
        }, 2500);
      });
    });
  }

  // Copy Caption
  if (btnCopyCaption && !btnCopyCaption.dataset.hasListener) {
    btnCopyCaption.dataset.hasListener = 'true';
    btnCopyCaption.addEventListener('click', () => {
      navigator.clipboard.writeText(captionArea?.value || shareText).then(() => {
        btnCopyCaption.textContent = '[ COPIED! ✓ ]';
        playCursedBeep(880, 'sine', 0.1, 0.05);
        setTimeout(() => {
          btnCopyCaption.textContent = '[ COPY SHARE TEXT ]';
        }, 2500);
      });
    });
  }
}

// ── HIGH RESOLUTION HTML5 CANVAS CARD GENERATOR ─────────────
function exportCanvasImage(roast, orderId, format = 'story') {
  playCursedBeep(700, 'sawtooth', 0.15, 0.05);

  const isStory = format === 'story';
  const width = 1080;
  const height = isStory ? 1920 : 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  // Scanlines effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 2);
  }

  // Outer Border
  ctx.strokeStyle = '#ff2222';
  ctx.lineWidth = 12;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // Inner dashed border
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 16]);
  ctx.strokeRect(65, 65, width - 130, height - 130);
  ctx.setLineDash([]);

  // Top Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px "Space Mono", monospace, sans-serif';
  ctx.fillText('DEADCV 💀', width / 2, isStory ? 180 : 140);

  ctx.fillStyle = '#888888';
  ctx.font = '28px "IBM Plex Mono", monospace, sans-serif';
  ctx.fillText('YOUR RESUME IS', width / 2, isStory ? 240 : 190);

  // Giant Score
  ctx.fillStyle = '#ff2222';
  ctx.font = `bold ${isStory ? 160 : 130}px "Space Mono", monospace, sans-serif`;
  ctx.fillText(`${roast.deadPercentage || 73}% DEAD`, width / 2, isStory ? 410 : 330);

  // Cause of Death Banner
  const causeY = isStory ? 520 : 410;
  ctx.fillStyle = '#180808';
  ctx.fillRect(100, causeY, width - 200, isStory ? 170 : 130);
  ctx.strokeStyle = '#aa1111';
  ctx.lineWidth = 3;
  ctx.strokeRect(100, causeY, width - 200, isStory ? 170 : 130);

  ctx.fillStyle = '#ff2222';
  ctx.font = 'bold 24px "IBM Plex Mono", monospace, sans-serif';
  ctx.fillText('CAUSE OF DEATH', width / 2, causeY + 45);

  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold ${isStory ? 34 : 28}px "Space Mono", monospace, sans-serif`;
  const causeStr = roast.causeOfDeath || 'ZERO MEASURABLE IMPACT';
  ctx.fillText(causeStr.length > 38 ? causeStr.slice(0, 35) + '...' : causeStr, width / 2, causeY + (isStory ? 115 : 95));

  // Stats Grid Box
  const statsY = isStory ? 750 : 580;
  const s = roast.stats || {};
  const statsList = [
    { lbl: 'BUZZWORDS', val: s.buzzwords ?? 17 },
    { lbl: 'WEAK BULLETS', val: s.weakBullets ?? 6 },
    { lbl: 'ACTUAL IMPACT', val: s.actualImpact || '2%' },
    { lbl: 'RECRUITER SURVIVAL', val: s.recruiterSurvival || '38%' }
  ];

  const colWidth = (width - 240) / 2;
  statsList.forEach((st, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const boxX = 120 + col * (colWidth + 20);
    const boxY = statsY + row * 110;

    ctx.fillStyle = '#111111';
    ctx.fillRect(boxX, boxY, colWidth, 90);
    ctx.strokeStyle = '#2a2a2a';
    ctx.strokeRect(boxX, boxY, colWidth, 90);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#888888';
    ctx.font = '20px "IBM Plex Mono", monospace, sans-serif';
    ctx.fillText(st.lbl, boxX + 20, boxY + 36);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Space Mono", monospace, sans-serif';
    ctx.fillText(String(st.val), boxX + 20, boxY + 74);
  });

  // Long Personality & Species Rows (for Story mode)
  if (isStory) {
    const extraY = statsY + 250;
    const extraRows = [
      { lbl: 'PERSONALITY:', val: s.personality || 'LinkedIn corporate NPC' },
      { lbl: 'SPECIES:', val: s.species || 'The "I did projects" type' },
      { lbl: 'DANGEROUS WORD:', val: s.mostDangerousWord || '"Developed" (7 times)' },
      { lbl: 'ATS STATUS:', val: s.atsStatus || 'Barely breathing' }
    ];

    extraRows.forEach((row, i) => {
      const yPos = extraY + i * 85;
      ctx.fillStyle = '#0f0f0f';
      ctx.fillRect(120, yPos, width - 240, 68);
      ctx.strokeStyle = '#222222';
      ctx.strokeRect(120, yPos, width - 240, 68);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#888888';
      ctx.font = '20px "IBM Plex Mono", monospace, sans-serif';
      ctx.fillText(row.lbl, 140, yPos + 42);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 22px "Space Mono", monospace, sans-serif';
      ctx.fillText(row.val, width - 140, yPos + 42);
    });

    // Sample Worst Bullet quote on story card
    if (roast.roasts && roast.roasts[0]) {
      const quoteY = extraY + 380;
      ctx.fillStyle = '#140808';
      ctx.fillRect(120, quoteY, width - 240, 190);
      ctx.strokeStyle = '#aa1111';
      ctx.strokeRect(120, quoteY, width - 240, 190);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff2222';
      ctx.font = 'bold 20px "IBM Plex Mono", monospace, sans-serif';
      ctx.fillText('> YOUR WORST BULLET:', 140, quoteY + 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 22px "IBM Plex Mono", monospace, sans-serif';
      const targetText = roast.roasts[0].target || '';
      ctx.fillText(targetText.length > 55 ? targetText.slice(0, 52) + '...' : targetText, 140, quoteY + 85);

      ctx.fillStyle = '#aaaaaa';
      ctx.font = '20px "IBM Plex Mono", monospace, sans-serif';
      ctx.fillText(`DEADCV: ${roast.roasts[0].comment.slice(0, 58)}...`, 140, quoteY + 140);
    }
  }

  // Footer Watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = '#555555';
  ctx.font = 'bold 30px "Space Mono", monospace, sans-serif';
  ctx.fillText('DEADCV.COM — GET YOUR RESUME ROASTED', width / 2, height - (isStory ? 100 : 70));

  // Convert to image and trigger download
  const imageURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = imageURL;
  a.download = `DEADCV-Roast-${orderId}-${format}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ═════════════════════════════════════════════════════════════
// OWNER OPERATOR ROOM (/owner)
// ═════════════════════════════════════════════════════════════
let ownerSecret = localStorage.getItem('deadcv_admin_secret') || 'deadcv666';
let currentFilter = 'all';
let ownerPollTimer = null;

function initOwnerPage() {
  const authBox = document.getElementById('owner-auth-box');
  const dashboard = document.getElementById('owner-dashboard');
  const authForm = document.getElementById('owner-auth-form');
  const secretInput = document.getElementById('owner-secret-input');
  const refreshBtn = document.getElementById('btn-refresh-orders');

  if (ownerSecret) {
    if (secretInput) secretInput.value = ownerSecret;
    testAndLoadOwnerDashboard();
  }

  if (authForm && !authForm.dataset.hasListener) {
    authForm.dataset.hasListener = 'true';
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      ownerSecret = (secretInput?.value || '').trim();
      localStorage.setItem('deadcv_admin_secret', ownerSecret);
      testAndLoadOwnerDashboard();
    });
  }

  if (refreshBtn && !refreshBtn.dataset.hasListener) {
    refreshBtn.dataset.hasListener = 'true';
    refreshBtn.addEventListener('click', () => {
      fetchAndRenderOwnerOrders();
      playCursedBeep(600, 'square', 0.05, 0.02);
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.hasListener) return;
    btn.dataset.hasListener = 'true';
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      fetchAndRenderOwnerOrders();
    });
  });
}

async function testAndLoadOwnerDashboard() {
  const authBox = document.getElementById('owner-auth-box');
  const dashboard = document.getElementById('owner-dashboard');

  try {
    const res = await fetch('/api/admin/orders', {
      headers: { 'x-admin-secret': ownerSecret }
    });

    if (!res.ok) {
      if (authBox) authBox.style.display = 'block';
      if (dashboard) dashboard.style.display = 'none';
      alert('☠️ ACCESS DENIED: Invalid operator secret.');
      return;
    }

    if (authBox) authBox.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';

    fetchAndRenderOwnerOrders();

    if (!ownerPollTimer) {
      ownerPollTimer = setInterval(fetchAndRenderOwnerOrders, 5000);
    }
  } catch (err) {
    console.error('Owner dashboard auth error:', err);
  }
}

async function fetchAndRenderOwnerOrders() {
  const tbody = document.getElementById('owner-orders-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/orders', {
      headers: { 'x-admin-secret': ownerSecret }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:var(--red);">&gt; unauthorized: check operator secret.</td></tr>`;
      return;
    }

    let orders = data.orders || [];

    if (currentFilter === 'pending_verification') {
      orders = orders.filter(o => o.paymentStatus === 'pending_verification' || o.paymentStatus === 'pending');
    } else if (currentFilter === 'approved') {
      orders = orders.filter(o => o.paymentStatus === 'approved');
    } else if (currentFilter === 'rejected') {
      orders = orders.filter(o => o.paymentStatus === 'rejected');
    }

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-loading">&gt; no orders matching filter "${currentFilter}".</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const statusClass = `badge-status--${o.paymentStatus || 'pending'}`;
      const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
      const utrStr = o.utr ? `<span style="color:var(--yellow); font-weight:700;">${escapeHtml(o.utr)}</span>` : '<span style="color:var(--fg-dimmer);">No UTR yet</span>';

      return `
        <tr>
          <td>
            <strong style="color:var(--fg);">${escapeHtml(o.orderId)}</strong>
            <div style="font-size:10px; color:var(--fg-dimmer);">${timeStr}</div>
          </td>
          <td>${escapeHtml(o.targetJob || 'General Role')}</td>
          <td>
            <div>${escapeHtml(o.originalName)}</div>
            <div style="font-size:10px; color:var(--green);">${o.wordCount || 0} words (${(o.sizeBytes / 1024).toFixed(0)} KB)</div>
          </td>
          <td>${utrStr}</td>
          <td>
            <span class="badge-status ${statusClass}">${escapeHtml(o.paymentStatus)}</span>
          </td>
          <td>
            <div class="table-actions">
              ${o.paymentStatus !== 'approved' ? `
                <button class="btn-approve" onclick="window.verifyOrder('${o.orderId}', 'approve')">
                  APPROVE ✓
                </button>
              ` : `
                <a href="/result?orderId=${encodeURIComponent(o.orderId)}" style="color:var(--yellow); font-size:11px; text-decoration:underline;">
                  VIEW ROAST →
                </a>
              `}

              ${o.paymentStatus !== 'rejected' && o.paymentStatus !== 'approved' ? `
                <button class="btn-reject" onclick="window.verifyOrder('${o.orderId}', 'reject')">
                  REJECT ✕
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading">&gt; error communicating with morgue database.</td></tr>`;
  }
}

window.verifyOrder = async function(orderId, action) {
  playCursedBeep(action === 'approve' ? 880 : 200, 'sawtooth', 0.1, 0.05);

  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ownerSecret
      },
      body: JSON.stringify({ action })
    });

    const json = await res.json();
    if (json.success) {
      fetchAndRenderOwnerOrders();
    } else {
      alert('☠️ ' + (json.error || 'Action failed'));
    }
  } catch (e) {
    alert('☠️ ' + e.message);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  renderCurrentRoute();
  initScoreCounter();
  initUploadEventListeners();
  bindSoundEffects();
});
