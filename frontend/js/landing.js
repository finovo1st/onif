/* ============================================================
   FINOVO LANDING PAGE — JavaScript
   Handles: Navbar scroll, count-up animations, FAQ accordion,
            scroll-reveal, and smooth anchor navigation.
   ============================================================ */

'use strict';

/* ── 1. Navbar Scroll Behaviour & Session Detection ───────── */
(function initNav() {
  const nav = document.getElementById('lp-nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run on load

  // If user already has an active session, personalize the CTA buttons
  try {
    const token = localStorage.getItem('finovo_token');
    if (token) {
      const signInBtn = document.getElementById('nav-signin');
      const getStartedBtn = document.getElementById('nav-getstarted');
      const heroSecondary = document.getElementById('hero-cta-secondary');
      if (signInBtn) {
        signInBtn.innerText = 'Launch App →';
        signInBtn.href = 'app.html';
      }
      if (getStartedBtn) {
        getStartedBtn.innerText = 'Dashboard →';
        getStartedBtn.href = 'app.html';
      }
      if (heroSecondary) {
        heroSecondary.innerText = 'Open Member Dashboard →';
        heroSecondary.href = 'app.html';
      }
    }
  } catch (e) { }
})();

/* ── 2. Smooth Anchor Navigation ──────────────────────────── */
(function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();

      const navHeight = document.getElementById('lp-nav')?.offsetHeight ?? 68;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ── 3. Enhanced Scroll-Reveal (Intersection Observer) ────── */
(function initReveal() {
  const SELECTORS = '.reveal, .reveal-left, .reveal-right, .reveal-scale';

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.10, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll(SELECTORS).forEach(el => observer.observe(el));
})();

/* ── 3b. Hero Parallax disabled for smooth 60fps scrolling ── */


/* ── 4. Number Count-Up Animation ─────────────────────────── */
function animateCount(el) {
  const target = parseFloat(el.dataset.target);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const duration = parseInt(el.dataset.duration || '2000', 10);
  const start = performance.now();

  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const tick = now => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const current = target * easeOut(progress);

    el.textContent = prefix + formatNumber(current, decimals) + suffix;

    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = prefix + formatNumber(target, decimals) + suffix;
  };

  requestAnimationFrame(tick);
}

function formatNumber(n, decimals) {
  if (decimals > 0) return n.toFixed(decimals);
  // Add thousand separators
  return Math.floor(n).toLocaleString('en-IN');
}

(function initCountUps() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.counted) {
          entry.target.dataset.counted = 'true';
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));
})();

/* ── 5. FAQ Accordion ─────────────────────────────────────── */
(function initFAQ() {
  const items = document.querySelectorAll('.faq-item');

  items.forEach(item => {
    const btn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all
      items.forEach(i => {
        i.classList.remove('open');
        const a = i.querySelector('.faq-answer');
        if (a) a.style.maxHeight = '0';
      });

      // Toggle clicked
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
})();

/* ── 6. Mobile Menu Toggle ────────────────────────────────── */
(function initMobileMenu() {
  const toggle = document.getElementById('nav-mobile-toggle');
  const menu = document.getElementById('nav-mobile-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Close on link click
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();

/* ── 7. Removed Motion Background ─── */

/* ── 8. Hero Motion Graphic Cockpit (Crypto Chart Visualization) ── */
(function initHeroChart() {
  const canvas = document.getElementById('hero-chart-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const priceEl = document.getElementById('hero-live-price');
  const changeEl = document.getElementById('hero-live-change');
  const statusEl = document.querySelector('.status-text');

  let width = 0;
  let height = 0;
  let dpr = 1;
  let dataPoints = [];
  let candles = [];
  let strategyMilestones = [];
  let scanlineX = 0;
  const steadyPrice = 96482.50;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (width === 0 || height === 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Pre-seed an aesthetically curated, realistic price wave structure
  function initChartData() {
    dataPoints = [];
    candles = [];
    strategyMilestones = [];

    // Realistic upward trend structure with healthy retracements
    const deltas = [
      0, 45, 60, -30, 80, 110, -50, -20, 95, 140,
      -70, -35, 65, 120, 180, -90, -40, 85, 130, 195,
      -60, 40, 110, 165, -80, -30, 90, 140, 210, -75,
      55, 130, 175, 90, -45, 120, 160, 85
    ];

    let p = 94820;
    for (let i = 0; i < deltas.length; i++) {
      p += deltas[i];
      const open = p - deltas[i];
      const close = p;
      const high = Math.max(open, close) + Math.abs(deltas[i]) * 0.4 + 25;
      const low = Math.min(open, close) - Math.abs(deltas[i]) * 0.3 - 20;
      const vol = 40 + Math.sin(i * 0.6) * 30 + (deltas[i] > 100 ? 45 : 15);

      dataPoints.push(close);
      candles.push({ open, high, low, close, volume: vol });
    }

    // Set curated strategy execution events at key breakout points
    strategyMilestones = [
      { index: 8, label: 'ARB EXECUTION', price: dataPoints[8], alpha: 0.85, radius: 2 },
      { index: 18, label: 'ALPHA HARVEST', price: dataPoints[18], alpha: 0.9, radius: 2 },
      { index: 28, label: 'PROFIT SHARE', price: dataPoints[28], alpha: 0.95, radius: 2 }
    ];

    if (priceEl) {
      priceEl.textContent = '$' + steadyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (changeEl) {
      changeEl.textContent = '+4.82% / WK';
      changeEl.className = 'live-change-badge positive';
    }
    if (statusEl) {
      statusEl.textContent = 'STRATEGY DESK ACTIVE';
    }
  }

  initChartData();

  function draw(time) {
    if (width === 0 || height === 0) {
      resize();
    }

    ctx.clearRect(0, 0, width, height);

    // Determine scale bounds
    let minP = Math.min(...dataPoints);
    let maxP = Math.max(...dataPoints);
    const padding = (maxP - minP) * 0.22 || 80;
    minP -= padding;
    maxP += padding;

    const getY = p => height - ((p - minP) / (maxP - minP)) * (height - 60) - 35;
    const stepX = width / Math.max(1, dataPoints.length - 1);

    // 1. Draw High-Tech Grid & Axis Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const gy = (height - 40) * (i / gridCount) + 15;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();

      // Right axis price tags
      const gridPrice = maxP - (i / gridCount) * (maxP - minP);
      ctx.fillStyle = 'rgba(138, 148, 164, 0.45)';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('$' + gridPrice.toFixed(0), width - 8, gy - 4);
    }

    // Vertical grid lines
    for (let i = 0; i < dataPoints.length; i += 6) {
      const gx = i * stepX;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }

    // 2. Draw Candlestick Bars in Background
    const candleWidth = Math.max(4, stepX * 0.55);
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const cx = i * stepX;
      const yOpen = getY(c.open);
      const yClose = getY(c.close);
      const yHigh = getY(c.high);
      const yLow = getY(c.low);
      const isUp = c.close >= c.open;

      ctx.strokeStyle = isUp ? 'rgba(198, 153, 61, 0.45)' : 'rgba(248, 113, 113, 0.35)';
      ctx.fillStyle = isUp ? 'rgba(198, 153, 61, 0.3)' : 'rgba(248, 113, 113, 0.25)';

      // Wick
      ctx.beginPath();
      ctx.moveTo(cx, yHigh);
      ctx.lineTo(cx, yLow);
      ctx.stroke();

      // Body
      const topY = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillRect(cx - candleWidth / 2, topY, candleWidth, bodyHeight);

      // Volume histogram bar at bottom
      const volHeight = Math.min(36, (c.volume / 120) * 32);
      ctx.fillStyle = isUp ? 'rgba(198, 153, 61, 0.22)' : 'rgba(248, 113, 113, 0.18)';
      ctx.fillRect(cx - candleWidth / 2, height - volHeight - 5, candleWidth, volHeight);
    }

    // 3. Draw Area Fill Under Glowing Trend Line
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(198, 153, 61, 0.28)');
    grad.addColorStop(0.6, 'rgba(198, 153, 61, 0.06)');
    grad.addColorStop(1, 'rgba(198, 153, 61, 0)');

    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, getY(dataPoints[0]));

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const x0 = i * stepX;
      const y0 = getY(dataPoints[i]);
      const x1 = (i + 1) * stepX;
      const y1 = getY(dataPoints[i + 1]);
      const mx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(x0, y0, mx, (y0 + y1) / 2);
    }
    const lastX = (dataPoints.length - 1) * stepX;
    const lastY = getY(dataPoints[dataPoints.length - 1]);
    ctx.lineTo(lastX, lastY);
    ctx.lineTo(lastX, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 4. Draw Neon Glow Spline Line
    ctx.beginPath();
    ctx.moveTo(0, getY(dataPoints[0]));
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const x0 = i * stepX;
      const y0 = getY(dataPoints[i]);
      const x1 = (i + 1) * stepX;
      const y1 = getY(dataPoints[i + 1]);
      const mx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(x0, y0, mx, (y0 + y1) / 2);
    }
    ctx.lineTo(lastX, lastY);
    ctx.strokeStyle = '#C6993D';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 5. Draw Strategy Execution Milestones & Pulse Rings
    for (let i = 0; i < strategyMilestones.length; i++) {
      const s = strategyMilestones[i];
      const sx = s.index * stepX;
      const sy = getY(s.price);

      const ringPulse = 6 + Math.sin(time / 300 + i) * 3;
      const ringAlpha = 0.4 + Math.sin(time / 300 + i) * 0.25;

      ctx.beginPath();
      ctx.arc(sx, sy, ringPulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(198, 153, 61, ${ringAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Strategy Marker Pill
      ctx.fillStyle = 'rgba(198, 153, 61, 0.95)';
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, sx, sy - 14);
    }

    // 6. Draw Current Price Dot & Crosshair Pulse
    const pulseSize = 4 + Math.sin(time / 200) * 2;
    ctx.beginPath();
    ctx.arc(lastX, lastY, pulseSize + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(198, 153, 61, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#DFBD69';
    ctx.fill();

    // Horizontal guide line for current price
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(198, 153, 61, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, lastY);
    ctx.lineTo(width, lastY);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Current Price HUD Tag on Right Margin
    ctx.fillStyle = '#C6993D';
    ctx.fillRect(width - 78, lastY - 10, 76, 20);
    ctx.fillStyle = '#030507';
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$' + steadyPrice.toFixed(1), width - 40, lastY + 4);

    // 7. Scanning Laser Beam Effect
    scanlineX = (scanlineX + 1.2) % width;
    ctx.strokeStyle = 'rgba(198, 153, 61, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scanlineX, 0);
    ctx.lineTo(scanlineX, height);
    ctx.stroke();

    if (isCanvasVisible) {
      animFrameId = requestAnimationFrame(draw);
    }
  }

  let isCanvasVisible = true;
  let animFrameId = null;

  const canvasObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      isCanvasVisible = entry.isIntersecting;
      if (isCanvasVisible && !animFrameId) {
        animFrameId = requestAnimationFrame(draw);
      } else if (!isCanvasVisible && animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    });
  }, { threshold: 0.05 });
  canvasObserver.observe(canvas);

  window.addEventListener('resize', resize, { passive: true });
  resize();
})();

/* ── 9. Stagger Children Reveal ──────────────────────────── */
(function initStaggerReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const children = entry.target.querySelectorAll('.reveal-child');
          children.forEach((child, i) => {
            setTimeout(() => child.classList.add('visible'), i * 120);
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.reveal-stagger').forEach(el => observer.observe(el));
})();

