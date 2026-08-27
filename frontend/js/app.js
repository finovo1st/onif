/* FINOVO - Pure API Integrated Frontend Application */

const API_BASE = '/api/v1';

// Global Application State
let state = {
  token: localStorage.getItem('finovo_token') || null,
  user: null,
  wallet: { balance: 0, total_deposited: 0, total_roi_earned: 0, total_direct_income: 0, total_referral_income: 0, total_withdrawn: 0 },
  plans: [],
  investments: [],
  deposits: [],
  withdrawals: [],
  ledger: [],
  team: [],
  commissions: [],
  tickets: [],
  depositWallets: {
    BEP20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    TRC20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
    BEP20_QR: '',
    TRC20_QR: '',
  },
  apiConnected: false,
  levelStats: [],
  teamLevel: 'all',
  pagination: {
    team: { next: null, previous: null, count: 0 },
    adminUsers: { next: null, previous: null, count: 0 },
    adminFunds: { next: null, previous: null, count: 0 }
  },
};

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', () => {
  // Parse referral code from search params or hash
  const urlParams = new URLSearchParams(window.location.search);
  let refCode = urlParams.get('ref');
  if (!refCode && window.location.hash.includes('ref=')) {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || window.location.hash.replace('#', ''));
    refCode = hashParams.get('ref');
  }

  if (refCode) {
    const regRef = document.getElementById('reg-refcode');
    if (regRef) regRef.value = refCode;
  }

  if (window.location.hash.includes('register') || refCode) {
    switchAuthTab('register');
  } else if (window.location.hash.includes('forgot')) {
    switchAuthTab('forgot');
  } else if (window.location.hash.includes('login')) {
    switchAuthTab('login');
  }

  if (!state.token) {
    showAuthOverlay();
  } else {
    loadAllAPIData().then(() => {
      // Check for deep view routes in hash if logged in
      const validViews = ['dashboard', 'investments', 'wallet', 'referrals', 'kyc', 'support'];
      const currentHash = window.location.hash.replace('#', '').toLowerCase();
      if (validViews.includes(currentHash)) {
        switchNav(currentHash);
      }
    });
  }
});

// Generic Fetch Wrapper with Authorization Header & Error Handling
async function apiCall(endpoint, method = 'GET', body = null, isFormData = false) {
  const headers = {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  // Do not set Content-Type for FormData; browser sets multipart boundary automatically
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    state.apiConnected = true;
    updateConnectionBadge(true);

    if (response.status === 401) {
      handleLogout();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = parseErrorMessage(errData) || `Server Error (${response.status})`;
      throw new Error(errorMsg);
    }

    if (response.status === 204) return null;
    return await response.json();
  } catch (err) {
    console.error(`[API Error] ${method} ${endpoint}:`, err);
    if (err.message.includes('Failed to fetch')) {
      state.apiConnected = false;
      updateConnectionBadge(false);
      throw new Error('Could not connect to backend server at http://127.0.0.1:8000. Is Docker/Django server running?');
    }
    throw err;
  }
}

function parseErrorMessage(errData) {
  if (typeof errData === 'string') return errData;
  if (errData.detail) return errData.detail;
  if (errData.non_field_errors) return errData.non_field_errors.join(' ');
  const keys = Object.keys(errData);
  if (keys.length > 0) {
    const firstVal = errData[keys[0]];
    return `${keys[0]}: ${Array.isArray(firstVal) ? firstVal.join(' ') : firstVal}`;
  }
  return null;
}

function updateConnectionBadge(isConnected) {
  const badge = document.getElementById('connection-status');
  const text = document.getElementById('status-text');
  if (badge && text) {
    if (isConnected) {
      badge.className = 'status-badge';
      text.innerText = 'API Connected (Live)';
    } else {
      badge.className = 'status-badge demo';
      text.innerText = 'API Disconnected';
    }
  }
}

// Show/Hide Auth Screen
function showAuthOverlay() {
  const el = document.getElementById('auth-screen');
  if (el) el.style.display = 'block';

  // Hide main app elements so they don't show through the transparent glass auth screen
  const mainWrapper = document.querySelector('.main-wrapper');
  if (mainWrapper) mainWrapper.style.display = 'none';

  initAuthCanvas();
}

function hideAuthOverlay() {
  const el = document.getElementById('auth-screen');
  if (el) el.style.display = 'none';

  // Restore main app elements
  const mainWrapper = document.querySelector('.main-wrapper');
  if (mainWrapper) mainWrapper.style.display = 'flex';
}

function initAuthCanvas() {
  const canvas = document.getElementById('authCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const candleW = 9, gapW = 7;
  let candles = [], lastPrice = 100;

  function nextCandle() {
    const open = lastPrice;
    const change = (Math.random() - 0.47) * 5.5;
    const close = Math.max(30, open + change);
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    lastPrice = close;
    return { open, close, high, low };
  }
  function seedCandles(width) {
    candles = []; lastPrice = 100;
    const count = Math.ceil(width / (candleW + gapW)) + 3;
    for (let i = 0; i < count; i++) candles.push(nextCandle());
  }
  function draw() {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    const values = candles.flatMap(c => [c.high, c.low]);
    const max = Math.max(...values), min = Math.min(...values);
    const pad = 20;
    const scaleY = v => h - pad - ((v - min) / ((max - min) || 1)) * (h - pad * 2);
    candles.forEach((c, i) => {
      const x = i * (candleW + gapW);
      const up = c.close >= c.open;
      ctx.strokeStyle = up ? 'rgba(198, 153, 61, 0.65)' : 'rgba(228,105,78,0.45)';
      ctx.fillStyle = up ? 'rgba(198, 153, 61, 0.3)' : 'rgba(228,105,78,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleW / 2, scaleY(c.high));
      ctx.lineTo(x + candleW / 2, scaleY(c.low));
      ctx.stroke();
      const yO = scaleY(c.open), yC = scaleY(c.close);
      const top = Math.min(yO, yC), hgt = Math.max(2, Math.abs(yO - yC));
      ctx.fillRect(x, top, candleW, hgt);
    });
  }
  function resize() {
    if (!canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedCandles(rect.width);
    draw();
  }
  if (canvas._resizeHandler) {
    window.removeEventListener('resize', canvas._resizeHandler);
  }
  canvas._resizeHandler = resize;
  window.addEventListener('resize', resize);
  resize();
  if (!reduceMotion && !canvas._intervalId) {
    canvas._intervalId = setInterval(() => {
      const screen = document.getElementById('auth-screen');
      if (screen && screen.style.display === 'none') return;
      candles.shift();
      candles.push(nextCandle());
      draw();
    }, 1300);
  }
}

// Load All Data from Backend API
async function loadAllAPIData() {
  try {
    // 1. Fetch User Profile
    state.user = await apiCall('/auth/profile/');
    hideAuthOverlay();

    // 2. Fetch Dashboard Overview & All Core Resources Parallelly
    const [overviewData, investmentsData, plansData, ledgerData, teamData, commData, depositsData, withdrawalsData, ticketsData, levelsData] = await Promise.all([
      apiCall('/dashboard/').catch(() => null),
      apiCall('/investments/').catch(() => []),
      apiCall('/investments/plans/').catch(() => []),
      apiCall('/wallet/transactions/').catch(() => []),
      apiCall('/referrals/team/').catch(() => []),
      apiCall('/referrals/commissions/').catch(() => []),
      apiCall('/deposits/').catch(() => []),
      apiCall('/withdrawals/').catch(() => []),
      apiCall('/support/tickets/').catch(() => []),
      apiCall('/referrals/levels/').catch(() => []),
    ]);

    if (overviewData) {
      state.wallet = {
        balance: overviewData.wallet_balance || 0,
        total_deposited: overviewData.total_deposited || 0,
        total_roi_earned: overviewData.total_roi_earned || 0,
        total_direct_income: overviewData.total_direct_income || 0,
        total_referral_income: overviewData.total_referral_income || 0,
        total_withdrawn: overviewData.total_withdrawn || 0,
      };
      if (overviewData.active_level !== undefined) {
        state.user.active_level = overviewData.active_level;
      }
      if (overviewData.deposit_wallets) {
        state.depositWallets = overviewData.deposit_wallets;
      }
      if (overviewData.settings) {
        state.settings = overviewData.settings;
      }
    }

    state.investments = Array.isArray(investmentsData) ? investmentsData : (investmentsData.results || []);
    state.plans = Array.isArray(plansData) ? plansData : (plansData.results || []);
    state.ledger = Array.isArray(ledgerData) ? ledgerData : (ledgerData.results || []);
    state.team = Array.isArray(teamData) ? teamData : (teamData.results || []);
    if (teamData && !Array.isArray(teamData)) {
      state.pagination.team = { next: teamData.next, previous: teamData.previous, count: teamData.count };
    }
    state.commissions = Array.isArray(commData) ? commData : (commData.results || []);
    state.deposits = Array.isArray(depositsData) ? depositsData : (depositsData.results || []);
    state.withdrawals = Array.isArray(withdrawalsData) ? withdrawalsData : (withdrawalsData.results || []);
    state.tickets = Array.isArray(ticketsData) ? ticketsData : (ticketsData.results || []);
    state.levelStats = Array.isArray(levelsData) ? levelsData : (levelsData.results || []);

    renderAllViews();
  } catch (err) {
    showToast(err.message, true);
    showAuthOverlay();
  }
}

// Render All UI Views
function renderAllViews() {
  if (!state.user) return;

  // Header & Sidebar Info
  const fullName = `${state.user.first_name || ''} ${state.user.last_name || ''}`.trim() || state.user.username || state.user.email;
  document.getElementById('sidebar-avatar').innerText = (fullName[0] || 'U').toUpperCase();
  document.getElementById('sidebar-username').innerText = fullName;

  // Admin Check & Primary Navigation Setup
  const isAdmin = state.user && (state.user.role === 'ADMIN' || state.user.is_staff || state.user.is_superuser);
  state.isAdmin = isAdmin;

  const topNavUser = document.getElementById('top-nav-user');
  const topNavAdmin = document.getElementById('top-nav-admin');
  const userActions = document.getElementById('user-topbar-actions');
  const adminActions = document.getElementById('admin-topbar-actions');

  if (isAdmin) {
    if (topNavUser) topNavUser.style.display = 'none';
    if (topNavAdmin) topNavAdmin.style.display = 'flex';
    if (userActions) userActions.style.display = 'none';
    if (adminActions) adminActions.style.display = 'flex';
    document.getElementById('sidebar-userrole').innerHTML = `<span class="badge badge-admin">ADMIN COMMAND</span>`;

    // Automatically default to Admin Overview on login
    switchAdminNav('overview');
  } else {
    if (topNavUser) topNavUser.style.display = 'flex';
    if (topNavAdmin) topNavAdmin.style.display = 'none';
    if (userActions) userActions.style.display = 'flex';
    if (adminActions) adminActions.style.display = 'none';
    const banner = document.getElementById('admin-investor-mode-banner');
    if (banner) banner.style.display = 'none';
    document.getElementById('sidebar-userrole').innerText = `Level ${state.user.active_level || 0} Unlock`;

    // Ensure non-admin users always display a valid user view and NEVER the admin view
    const activePageView = document.querySelector('.page-view.active');
    const validViews = ['dashboard', 'investments', 'wallet', 'referrals', 'kyc', 'support'];
    const currentHash = window.location.hash.replace('#', '').toLowerCase();

    if (validViews.includes(currentHash)) {
      switchNav(currentHash);
    } else if (!activePageView || activePageView.id === 'view-admin' || !validViews.includes(activePageView.id.replace('view-', ''))) {
      switchNav('dashboard');
    }
  }

  // Update Topbar & Sidebar KYC Badges
  const kycStatus = state.user.kyc_status || 'UNVERIFIED';
  const sidebarKyc = document.getElementById('sidebar-kyc-badge');
  const topBadgeKyc = document.getElementById('top-badge-kyc');

  if (sidebarKyc) {
    if (kycStatus === 'APPROVED') {
      sidebarKyc.className = 'badge badge-approved';
      sidebarKyc.innerText = 'KYC Verified';
    } else if (kycStatus === 'PENDING') {
      sidebarKyc.className = 'badge badge-pending';
      sidebarKyc.innerText = 'KYC Pending';
    } else if (kycStatus === 'REJECTED') {
      sidebarKyc.className = 'badge badge-rejected';
      sidebarKyc.innerText = 'KYC Rejected';
    } else {
      sidebarKyc.className = 'badge badge-unverified';
      sidebarKyc.innerText = 'KYC Unverified';
    }
  }

  if (topBadgeKyc) {
    topBadgeKyc.style.display = kycStatus === 'APPROVED' ? 'none' : 'inline-block';
    topBadgeKyc.innerText = '!';
  }

  // Update Investments KYC Lock Banner
  const kycLockBanner = document.getElementById('inv-kyc-lock-banner');
  if (kycLockBanner) {
    if (kycStatus === 'APPROVED') {
      kycLockBanner.style.display = 'none';
    } else {
      kycLockBanner.style.display = 'block';
      const titleEl = document.getElementById('inv-kyc-lock-title');
      const descEl = document.getElementById('inv-kyc-lock-desc');
      if (kycStatus === 'PENDING') {
        if (titleEl) titleEl.innerText = 'KYC Verification Under Review';
        if (descEl) descEl.innerText = 'Your identity documents are currently being reviewed by compliance. Purchasing will automatically unlock once approved.';
      } else if (kycStatus === 'REJECTED') {
        if (titleEl) titleEl.innerText = 'KYC Verification Was Rejected';
        if (descEl) descEl.innerText = 'Your previous verification was rejected. Please re-submit valid government-issued identity documents on the KYC page.';
      } else {
        if (titleEl) titleEl.innerText = 'Identity Verification (KYC) Required to Buy Plans';
        if (descEl) descEl.innerText = 'You must complete your KYC identity verification before you can invest in packages or activate deposits.';
      }
    }
  }

  // Dashboard Stats
  document.getElementById('dash-wallet-balance').innerText = `$${Number(state.wallet.balance || 0).toFixed(2)}`;

  const activeInvestSum = state.investments
    .filter(i => i.status === 'ACTIVE')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  document.getElementById('dash-active-invest').innerText = `$${activeInvestSum.toFixed(2)}`;
  document.getElementById('dash-total-roi').innerText = `$${Number(state.wallet.total_roi_earned || 0).toFixed(2)}`;
  document.getElementById('dash-direct-income').innerText = `$${Number(state.wallet.total_direct_income || 0).toFixed(2)}`;
  document.getElementById('dash-level-roi').innerText = `$${Number(state.wallet.total_referral_income || 0).toFixed(2)}`;

  // Referral Link
  const refCode = state.user.referral_code || '';
  document.getElementById('dash-ref-link').value = `https://finovo.app/register?ref=${refCode}`;
  document.getElementById('dash-downline-count').innerText = `${state.team.length} Members`;
  document.getElementById('dash-unlocked-levels').innerText = `Level ${state.user.active_level || 0}`;

  // Dashboard Active Investment List
  renderActiveInvestmentsList();

  // Ledger Table
  renderLedgerTable(state.ledger.slice(0, 8), 'dash-ledger-tbody');

  // Wallet View Totals
  document.getElementById('wallet-pg-balance').innerText = `$${Number(state.wallet.balance || 0).toFixed(2)}`;
  document.getElementById('wallet-pg-deposited').innerText = `$${Number(state.wallet.total_deposited || 0).toFixed(2)}`;
  document.getElementById('wallet-pg-withdrawn').innerText = `$${Number(state.wallet.total_withdrawn || 0).toFixed(2)}`;
  const totalEarnings = Number(state.wallet.total_roi_earned || 0) + Number(state.wallet.total_direct_income || 0) + Number(state.wallet.total_referral_income || 0);
  document.getElementById('wallet-pg-earnings').innerText = `$${totalEarnings.toFixed(2)}`;

  // Plans, Investments, Transactions, Referral Views
  renderInvestmentPlansCards();
  renderMyInvestmentsTable();
  renderDepositsTable();
  renderWithdrawalsTable();
  renderReferralView();
  renderSupportTicketsTable();
}

function renderActiveInvestmentsList() {
  const container = document.getElementById('dash-active-investments-list');
  container.innerHTML = '';

  const activeItems = state.investments.filter(i => i.status === 'ACTIVE' || i.status === 'PENDING');
  if (activeItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
        </div>
        <div class="empty-state-title">No Active Investments</div>
        <div class="empty-state-desc">Select an institutional yield plan to start earning up to 5.0% weekly ROI.</div>
        <button class="btn btn-sm btn-primary" onclick="switchNav('investments')">+ Choose Plan</button>
      </div>
    `;
    return;
  }

  activeItems.forEach(inv => {
    const credited = Number(inv.total_credited || 0);
    const maxRet = Number(inv.max_return || inv.amount * 3);
    const pct = maxRet > 0 ? Math.min(100, (credited / maxRet) * 100) : 0;
    container.innerHTML += `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px;">
          <b style="color: var(--text-main);">${inv.plan_name || 'Plan'} ($${Number(inv.amount).toFixed(2)})</b>
          <span style="color: var(--gold); font-weight: 700; font-family: var(--font-mono);">
            ${inv.status === 'PENDING' ? '<span class="badge badge-pending">PENDING ADMIN APPROVAL</span>' : `$${credited.toFixed(2)} / $${maxRet.toFixed(2)} (${pct.toFixed(0)}%)`}
          </span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  });
}

function renderInvestmentPlansCards() {
  const container = document.getElementById('packages-cards-container') || document.querySelector('#view-investments .packages-grid');
  if (!container) return;
  container.innerHTML = '';

  const defaultTiers = [
    { id: 'package-1', name: 'Package 1', cost: 120, trading_capital: 100, max_return_factor: 3, max_total_return: 350 },
    { id: 'package-2', name: 'Package 2', cost: 350, trading_capital: 300, max_return_factor: 3, max_total_return: 1000 },
    { id: 'package-3', name: 'Package 3', cost: 575, trading_capital: 500, max_return_factor: 3, max_total_return: 1700 },
    { id: 'package-4', name: 'Package 4', cost: 1100, trading_capital: 1000, max_return_factor: 3, max_total_return: 3300 },
    { id: 'package-5', name: 'Package 5', cost: 5500, trading_capital: 5000, max_return_factor: 3, max_total_return: 16500 },
    { id: 'package-6', name: 'Package 6', cost: 11000, trading_capital: 10000, max_return_factor: 3, max_total_return: 33000 },
  ];

  const plansToRender = (state.plans && state.plans.length > 0) ? state.plans : defaultTiers;

  plansToRender.forEach((plan, idx) => {
    const pkgNum = plan.name ? (plan.name.replace(/[^0-9]/g, '') || (idx + 1)) : (idx + 1);
    const cost = Number(plan.cost || plan.minimum_amount || 120);
    const tradingCap = Number(plan.trading_capital || cost);
    const maxFactor = Number(plan.max_return_factor || 3);
    const maxReturn = Number(plan.max_total_return || (tradingCap * maxFactor));
    const profitCap = `${maxFactor}X`;
    const duration = plan.duration_weeks ? `${plan.duration_weeks} WEEKS` : 'FLEXIBLE';

    container.innerHTML += `
      <div class="luxury-pkg-card" onclick="openInvestModal('${plan.id}', '${plan.name || ('Package ' + pkgNum)}', ${cost}, ${tradingCap}, ${maxReturn})" title="Click to Invest in ${plan.name}">
        <!-- Top Right Gold Ribbon -->
        <div class="pkg-ribbon">
          <span class="pkg-ribbon-sub">PACKAGE</span>
          <span class="pkg-ribbon-num">${pkgNum}</span>
        </div>

        <!-- Header: Brand Logo & Tagline -->
        <div class="pkg-header">
          <div class="pkg-brand">
            <div class="pkg-logo-wrap">
              <svg class="pkg-logo-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#f3d078" stroke-width="2" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#d4af37" stroke-width="2" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#e5b955" stroke-width="2" stroke-linejoin="round"/>
              </svg>
              <span class="pkg-brand-title">FINOVO</span>
            </div>
            <span class="pkg-brand-tagline">Trade Smart. Grow Together.</span>
          </div>
        </div>

        <!-- Subheading -->
        <div class="pkg-subheading">INVESTMENT PLAN</div>

        <!-- Main Invest -> You Get (Max) Box -->
        <div class="pkg-invest-box">
          <div class="pkg-invest-col">
            <span class="pkg-invest-lbl">INVEST</span>
            <span class="pkg-invest-val">$${cost.toLocaleString()}</span>
          </div>
          <div class="pkg-arrow">➔</div>
          <div class="pkg-invest-col">
            <span class="pkg-invest-lbl">YOU GET (MAX)</span>
            <span class="pkg-invest-val gold">$${maxReturn.toLocaleString()}</span>
          </div>
        </div>

        <!-- 3-Column Stats Row -->
        <div class="pkg-stats-row">
          <!-- Trading Capital -->
          <div class="pkg-stat-item">
            <div class="pkg-stat-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <ellipse cx="12" cy="6" rx="8" ry="3"></ellipse>
                <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"></path>
                <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"></path>
              </svg>
            </div>
            <div class="pkg-stat-info">
              <span class="pkg-stat-title">TRADING CAPITAL</span>
              <span class="pkg-stat-value">$${tradingCap.toLocaleString()}</span>
            </div>
          </div>

          <!-- Profit Cap -->
          <div class="pkg-stat-item">
            <div class="pkg-stat-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <div class="pkg-stat-info">
              <span class="pkg-stat-title">PROFIT CAP</span>
              <span class="pkg-stat-value">${profitCap}</span>
            </div>
          </div>

          <!-- Duration -->
          <div class="pkg-stat-item">
            <div class="pkg-stat-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div class="pkg-stat-info">
              <span class="pkg-stat-title">DURATION</span>
              <span class="pkg-stat-value">${duration}</span>
            </div>
          </div>
        </div>

        <!-- Profit Payout Gold Banner -->
        <div class="pkg-payout-banner">PROFIT PAYOUT : WEEKLY</div>

        <!-- Trust Badges Footer -->
        <div class="pkg-trust-row">
          <div class="pkg-trust-item">
            <div class="pkg-trust-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </div>
            <span class="pkg-trust-text">SECURE &amp; RELIABLE PLATFORM</span>
          </div>
          <div class="pkg-trust-item">
            <div class="pkg-trust-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <span class="pkg-trust-text">TRANSPARENT SYSTEM</span>
          </div>
          <div class="pkg-trust-item">
            <div class="pkg-trust-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
            </div>
            <span class="pkg-trust-text">24/7 CUSTOMER SUPPORT</span>
          </div>
        </div>

        <!-- Golden Wave Lines Background Overlay -->
        <div class="pkg-wave-bg">
          <svg viewBox="0 0 500 150" preserveAspectRatio="none">
            <path d="M0,80 C150,150 350,0 500,80 L500,150 L0,150 Z" fill="none" stroke="url(#goldGrad-${idx})" stroke-width="1.5"></path>
            <path d="M0,110 C200,40 300,140 500,90 L500,150 L0,150 Z" fill="none" stroke="url(#goldGrad-${idx})" stroke-width="1"></path>
            <defs>
              <linearGradient id="goldGrad-${idx}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#aa7c11" stop-opacity="0.1"/>
                <stop offset="50%" stop-color="#ffd700" stop-opacity="0.7"/>
                <stop offset="100%" stop-color="#aa7c11" stop-opacity="0.1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    `;
  });
}

function renderMyInvestmentsTable() {
  const tbody = document.getElementById('investments-tbody');
  tbody.innerHTML = '';

  if (state.investments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">No Investment History</div>
            <div class="empty-state-desc">Choose a plan and submit your deposit proof to start earning weekly ROI.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  state.investments.forEach(inv => {
    const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleString() : 'N/A';
    const credited = Number(inv.total_credited || 0);
    const maxRet = Number(inv.max_return || inv.amount * 3);
    const pct = maxRet > 0 ? Math.min(100, (credited / maxRet) * 100) : 0;
    const isDepositPending = inv.status === 'DEPOSIT_PENDING';
    tbody.innerHTML += `
      <tr>
        <td><b>${inv.plan_name || 'Plan'}</b></td>
        <td style="font-weight: 700; font-family: var(--font-mono);">$${Number(inv.amount).toFixed(2)}</td>
        <td style="color: var(--gold); font-family: var(--font-mono);">$${maxRet.toFixed(2)}</td>
        <td style="font-family: var(--font-mono);">
          ${isDepositPending ? '—' : `$${credited.toFixed(2)} <small style="color:var(--text-muted);">(${pct.toFixed(0)}%)</small>`}
        </td>
        <td><span class="badge badge-${(inv.status || 'PENDING').toLowerCase().replace('_', '-')}">${inv.status.replace('_', ' ')}</span></td>
        <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
      </tr>
    `;
  });
}

function renderLedgerTable(items, elementId) {
  const tbody = document.getElementById(elementId);
  tbody.innerHTML = '';

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">No Recent Ledger Activity</div>
            <div class="empty-state-desc">All deposits, ROI payouts, direct bonuses, and withdrawals will record here.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  items.forEach(item => {
    const isCredit = item.transaction_type === 'CREDIT';
    const color = isCredit ? 'var(--accent-green)' : 'var(--accent-danger)';
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent';
    tbody.innerHTML += `
      <tr>
        <td><span class="badge ${isCredit ? 'badge-approved' : 'badge-rejected'}">${item.transaction_type}</span></td>
        <td><b>${item.category}</b></td>
        <td style="color: ${color}; font-weight: 700; font-family: var(--font-mono);">${isCredit ? '+' : '-'}$${Number(item.amount).toFixed(2)}</td>
        <td style="font-family: var(--font-mono);">$${Number(item.balance_after || 0).toFixed(2)}</td>
        <td style="font-size: 13px; color: var(--text-muted);">${item.description} (${dateStr})</td>
      </tr>
    `;
  });
}

function renderDepositsTable() {
  // Deposits are now part of investments — show investment deposit status here
  const tbody = document.getElementById('deposits-tbody');
  tbody.innerHTML = '';

  if (state.investments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">No Investment Deposits</div>
            <div class="empty-state-desc">When you buy an investment plan, your deposit proof will appear here for admin verification.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  state.investments.forEach(inv => {
    const dateStr = inv.deposit_submitted_at
      ? new Date(inv.deposit_submitted_at).toLocaleString()
      : (inv.created_at ? new Date(inv.created_at).toLocaleString() : 'N/A');
    const txHash = inv.deposit_txn_hash ? `${inv.deposit_txn_hash.slice(0, 10)}...` : 'N/A';
    const network = inv.deposit_network || 'BEP20';
    const statusBadge = inv.status === 'DEPOSIT_PENDING'
      ? '<span class="badge badge-pending">AWAITING REVIEW</span>'
      : `<span class="badge badge-${(inv.status || 'pending').toLowerCase()}">${inv.status}</span>`;

    const proofThumb = inv.deposit_proof_url
      ? `<img src="${inv.deposit_proof_url}" class="proof-thumbnail" onclick="openLightbox('${inv.deposit_proof_url}')" title="Click to enlarge proof screenshot">`
      : `<span style="font-size:11px; color:var(--mute);">TxID Only</span>`;

    tbody.innerHTML += `
      <tr>
        <td><b>${inv.plan_name || 'Plan'}</b></td>
        <td style="font-weight: 700; font-family: var(--font-mono);">$${Number(inv.amount).toFixed(2)}</td>
        <td><span class="badge badge-approved">${network}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            ${proofThumb}
            <span style="font-family:var(--font-mono); font-size:11px;" title="${inv.deposit_txn_hash || ''}">${txHash}</span>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
      </tr>
    `;
  });
}

function renderWithdrawalsTable() {
  const tbody = document.getElementById('withdrawals-tbody');
  tbody.innerHTML = '';

  if (state.withdrawals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">No Withdrawal History</div>
            <div class="empty-state-desc">Requested payouts and capital redemptions will appear here.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  state.withdrawals.forEach(wdr => {
    const dateStr = wdr.created_at ? new Date(wdr.created_at).toLocaleString() : 'N/A';
    tbody.innerHTML += `
      <tr>
        <td><b>${wdr.withdrawal_type}</b></td>
        <td style="font-weight: 700; font-family: var(--font-mono);">$${Number(wdr.amount).toFixed(2)}</td>
        <td style="color: var(--gold); font-weight: 700; font-family: var(--font-mono);">$${Number(wdr.net_amount || wdr.amount).toFixed(2)}</td>
        <td><span class="badge badge-${(wdr.status || 'PENDING').toLowerCase()}">${wdr.status}</span></td>
        <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
      </tr>
    `;
  });
}

let teamSearchTimeout = null;
function debounceTeamSearch() {
  clearTimeout(teamSearchTimeout);
  teamSearchTimeout = setTimeout(() => {
    loadTeamData();
  }, 350);
}

function filterTeamByLevel(level) {
  state.teamLevel = level;
  document.querySelectorAll('.team-level-pill').forEach(btn => {
    btn.classList.remove('btn-primary', 'active');
    btn.classList.add('btn-secondary');
  });
  const activeBtn = document.getElementById(`pill-lvl-${level}`);
  if (activeBtn) {
    activeBtn.classList.remove('btn-secondary');
    activeBtn.classList.add('btn-primary', 'active');
  }
  loadTeamData();
}

function updateTeamLevelPills() {
  let totalAll = 0;
  if (state.levelStats && Array.isArray(state.levelStats)) {
    state.levelStats.forEach(s => {
      const pill = document.getElementById(`pill-lvl-${s.level}`);
      if (pill) {
        pill.innerText = `Level ${s.level} (${s.total_refers || 0})`;
      }
      totalAll += (s.total_refers || 0);
    });
  }
  const pillAll = document.getElementById('pill-lvl-all');
  if (pillAll) {
    pillAll.innerText = `All Levels (${totalAll})`;
  }
}

async function loadTeamData(overrideUrl = null) {
  let url = overrideUrl || '/referrals/team/';
  if (!overrideUrl) {
    const params = new URLSearchParams();
    if (state.teamLevel && state.teamLevel !== 'all') {
      params.set('level', state.teamLevel);
    }
    const searchVal = document.getElementById('referral-team-search')?.value || '';
    if (searchVal.trim()) {
      params.set('search', searchVal.trim());
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  try {
    const data = await apiCall(url);
    const teamData = Array.isArray(data) ? data : (data.results || []);
    if (data && !Array.isArray(data)) {
      state.pagination.team = { next: data.next, previous: data.previous, count: data.count };
    } else {
      state.pagination.team = { next: null, previous: null, count: teamData.length };
    }
    state.team = teamData;
    renderTeamTable();
    updateTeamLevelPills();
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderTeamTable() {
  const teamTbody = document.getElementById('referral-team-tbody');
  if (!teamTbody) return;
  teamTbody.innerHTML = '';

  if (state.team.length === 0) {
    const isFiltered = state.teamLevel && state.teamLevel !== 'all';
    teamTbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">${isFiltered ? `No Members in Level ${state.teamLevel}` : 'No Team Members Yet'}</div>
            <div class="empty-state-desc">${isFiltered ? `You currently have no downline members at Level ${state.teamLevel}.` : 'Share your referral link to build your team and unlock up to 5 commission levels!'}</div>
          </div>
        </td>
      </tr>
    `;
  } else {
    state.team.forEach(m => {
      const dateJoined = m.date_joined ? new Date(m.date_joined).toLocaleDateString() : 'N/A';
      const sponsorDisplay = m.sponsor_name || m.sponsor_email || (m.level === 1 ? 'You (Direct)' : 'Sponsor');
      const levelBadgeClass = m.level === 1 ? 'badge-approved' : (m.level === 2 ? 'badge-active' : 'badge-pending');
      teamTbody.innerHTML += `
        <tr>
          <td>
            <b style="color: var(--text);">${escapeHtml(m.email)}</b>
            <div style="font-size: 11.5px; color: var(--text-muted);">@${escapeHtml(m.username || 'member')}</div>
          </td>
          <td><span class="badge ${levelBadgeClass}" style="font-size: 11px;">Level ${m.level || 1}</span></td>
          <td style="font-size: 12.5px; color: var(--text);">${escapeHtml(sponsorDisplay)}</td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${m.total_refers || 0}</td>
          <td style="font-family: var(--font-mono); font-weight: 600; color: var(--gold);">$${Number(m.investment_sum || 0).toFixed(2)}</td>
          <td style="font-family: var(--font-mono); font-weight: 600; color: var(--up);">$${Number(m.direct_income_sum || 0).toFixed(2)}</td>
          <td style="font-family: var(--font-mono); font-weight: 600; color: var(--gold);">$${Number(m.roi_income_sum || 0).toFixed(2)}</td>
          <td style="font-size: 12px; color: var(--text-muted);">${dateJoined}</td>
        </tr>
      `;
    });
  }
  if (state.pagination && state.pagination.team) {
    renderPaginationControls('referral-team-pagination', state.pagination.team, loadTeamData);
  }
}

function renderReferralView() {
  document.getElementById('ref-summary-direct').innerText = `$${Number(state.wallet.total_direct_income || 0).toFixed(2)}`;
  document.getElementById('ref-summary-roi').innerText = `$${Number(state.wallet.total_referral_income || 0).toFixed(2)}`;

  // Level Unlock Progress List
  const container = document.getElementById('referral-levels-list');
  container.innerHTML = '';
  const currentDirLvl = state.user.active_level || 0;
  const currentRoiLvl = state.user.active_roi_level || 0;
  
  const levelsData = (state.levelStats && state.levelStats.length > 0) ? state.levelStats : [
    { level: 1, dir_req: 0, roi_req: 2, total_refers: 0, total_investment: 0, direct_income: 0, roi_income: 0 },
    { level: 2, dir_req: 2, roi_req: 4, total_refers: 0, total_investment: 0, direct_income: 0, roi_income: 0 },
    { level: 3, dir_req: 4, roi_req: 6, total_refers: 0, total_investment: 0, direct_income: 0, roi_income: 0 },
    { level: 4, dir_req: 6, roi_req: 8, total_refers: 0, total_investment: 0, direct_income: 0, roi_income: 0 },
    { level: 5, dir_req: 8, roi_req: 10, total_refers: 0, total_investment: 0, direct_income: 0, roi_income: 0 }
  ];

  levelsData.forEach(stats => {
    const dirReq = stats.dir_req !== undefined ? stats.dir_req : (stats.level === 1 ? 0 : (stats.level - 1) * 2);
    const roiReq = stats.roi_req !== undefined ? stats.roi_req : (stats.level * 2);

    const isDirUnlocked = stats.is_direct_unlocked !== undefined ? stats.is_direct_unlocked : (currentDirLvl >= stats.level);
    const isRoiUnlocked = stats.is_roi_unlocked !== undefined ? stats.is_roi_unlocked : (currentRoiLvl >= stats.level);

    container.innerHTML += `
      <div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); margin-bottom: 12px; padding: 14px 16px; border: 1px solid var(--line-light);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text);">Level ${stats.level}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">2.00% Direct Sponsor Commission • 75.00% ROI Referral Yield</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge ${isDirUnlocked ? 'badge-approved' : 'badge-pending'}" style="font-size: 11px; padding: 4px 8px;" title="Direct Income requires ${dirReq} active directs">
              Direct: ${dirReq} Directs ${isDirUnlocked ? 'UNLOCKED' : 'LOCKED'}
            </span>
            <span class="badge ${isRoiUnlocked ? 'badge-approved' : 'badge-pending'}" style="font-size: 11px; padding: 4px 8px;" title="ROI Referral Income requires ${roiReq} active directs">
              ROI: ${roiReq} Directs ${isRoiUnlocked ? 'UNLOCKED' : 'LOCKED'}
            </span>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; border-top: 1px solid var(--line-light); padding-top: 12px;">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Total Refers</div>
            <div style="font-family: var(--font-mono); font-weight: 600; font-size: 14px;">${stats.total_refers}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Investment</div>
            <div style="font-family: var(--font-mono); font-weight: 600; font-size: 14px;">$${Number(stats.total_investment).toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Direct Income</div>
            <div style="font-family: var(--font-mono); font-weight: 600; font-size: 14px; color: var(--up);">$${Number(stats.direct_income).toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">ROI Income</div>
            <div style="font-family: var(--font-mono); font-weight: 600; font-size: 14px; color: var(--gold);">$${Number(stats.roi_income).toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;
  });

  // Downline Team Table & Level Filter Pills
  renderTeamTable();
  updateTeamLevelPills();

  // Commissions Table
  const commTbody = document.getElementById('referral-commissions-tbody');
  commTbody.innerHTML = '';

  if (state.commissions.length === 0) {
    commTbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">No Commission Records</div>
            <div class="empty-state-desc">Earned direct and ROI downline commissions will record here in real-time.</div>
          </div>
        </td>
      </tr>
    `;
  } else {
    state.commissions.forEach(c => {
      const dateStr = c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A';
      const fromUser = c.from_user_email || (typeof c.from_user === 'object' ? c.from_user.email : c.from_user) || 'Downline User';
      commTbody.innerHTML += `
        <tr>
          <td><b>${c.commission_type === 'DIRECT' ? 'Direct Income' : 'ROI Income'}</b></td>
          <td><span class="badge badge-active">Level ${c.level}</span></td>
          <td style="font-size: 13px;">${fromUser}</td>
          <td style="color: var(--gold); font-weight: 700; font-family: var(--font-mono);">+$${Number(c.amount).toFixed(2)}</td>
          <td><span class="badge badge-approved">${c.is_paid ? 'Paid to Wallet' : 'Pending'}</span></td>
          <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
        </tr>
      `;
    });
  }
}

function renderSupportTicketsTable() {
  const tbody = document.getElementById('support-tickets-tbody');
  tbody.innerHTML = '';

  if (state.tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-title">No Tickets Found</div>
            <div class="empty-state-desc">Submit a ticket using the form on the left if you need assistance.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  state.tickets.forEach(t => {
    const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A';
    const statusLower = (t.status || 'OPEN').toLowerCase();
    tbody.innerHTML += `
      <tr style="cursor: pointer;" onclick="openTicketThreadModal('${t.id}')">
        <td><b style="color: var(--gold-soft);">${t.subject}</b> <span style="font-size: 11px; color: var(--mute);">(Click to view thread)</span></td>
        <td>${t.category || 'General'}</td>
        <td><span class="badge badge-${statusLower}">${t.status || 'OPEN'}</span></td>
        <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
      </tr>
    `;
  });
}

// Support Ticket Thread Modal Functions
async function openTicketThreadModal(ticketId) {
  openModal('modal-ticket-thread');
  document.getElementById('thread-ticket-id').value = ticketId;
  const listContainer = document.getElementById('thread-messages-list');
  listContainer.innerHTML = '<div style="text-align: center; color: var(--mute); padding: 20px;">Loading ticket thread...</div>';

  try {
    const ticket = await apiCall(`/support/tickets/${ticketId}/`);
    document.getElementById('thread-ticket-subject').innerText = ticket.subject || 'Ticket Thread';
    const statusLower = (ticket.status || 'OPEN').toLowerCase();
    const statusBadge = document.getElementById('thread-ticket-status');
    statusBadge.className = `badge badge-${statusLower}`;
    statusBadge.innerText = ticket.status || 'OPEN';
    document.getElementById('thread-ticket-date').innerText = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '';

    renderTicketThreadMessages(ticket);
  } catch (err) {
    listContainer.innerHTML = `<div style="color: var(--accent-danger); padding: 20px;">${err.message}</div>`;
  }
}

function renderTicketThreadMessages(ticket) {
  const listContainer = document.getElementById('thread-messages-list');
  listContainer.innerHTML = '';

  const replies = ticket.replies || [];
  if (replies.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; color: var(--mute); padding: 20px;">No replies in this thread yet.</div>';
    return;
  }

  replies.forEach(r => {
    const isStaff = r.is_staff_reply;
    const sender = isStaff ? 'Support Team (Staff)' : (r.user_email || 'You');
    const dateStr = r.created_at ? new Date(r.created_at).toLocaleString() : '';
    const bg = isStaff ? 'rgba(63,203,140,0.06)' : 'var(--field)';
    const border = isStaff ? '1px solid rgba(63,203,140,0.2)' : '1px solid var(--line)';
    const nameColor = isStaff ? 'var(--gold-soft)' : 'var(--text)';

    listContainer.innerHTML += `
      <div style="background: ${bg}; border: ${border}; padding: 12px 14px; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 600; font-size: 13px; color: ${nameColor};">${sender}</span>
          <span style="font-size: 11px; color: var(--mute);">${dateStr}</span>
        </div>
        <div style="font-size: 14px; color: var(--text); white-space: pre-wrap; line-height: 1.5;">${escapeHtml(r.message || '')}</div>
      </div>
    `;
  });

  listContainer.scrollTop = listContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

async function handleSendReply(e) {
  e.preventDefault();
  const ticketId = document.getElementById('thread-ticket-id').value;
  const messageInput = document.getElementById('thread-reply-message');
  const message = messageInput.value.trim();
  if (!message) return;

  try {
    await apiCall(`/support/tickets/${ticketId}/reply/`, 'POST', { message });
    messageInput.value = '';
    showToast('Reply sent successfully!');
    // Refresh thread modal
    const ticket = await apiCall(`/support/tickets/${ticketId}/`);
    renderTicketThreadMessages(ticket);
    // Refresh tickets list
    await loadAllAPIData();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Navigation Handler
function switchAdminNav(tabName) {
  if (!state.isAdmin) {
    switchNav('dashboard');
    return;
  }

  // Activate #view-admin page
  document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
  const adminView = document.getElementById('view-admin');
  if (adminView) adminView.classList.add('active');

  // Hide Investor Preview Banner
  const banner = document.getElementById('admin-investor-mode-banner');
  if (banner) banner.style.display = 'none';

  // Highlight Topbar Admin Nav item
  document.querySelectorAll('#top-nav-admin .nav-item').forEach(el => el.classList.remove('active'));
  const topItem = document.getElementById(`nav-adm-${tabName}`);
  if (topItem) topItem.classList.add('active');

  // Reset dropdown button active state
  const investorDropdown = document.getElementById('nav-adm-investor-sub');
  if (investorDropdown) investorDropdown.classList.remove('active');

  // Switch the internal subpage and fetch live data
  switchAdminTab(tabName);

  const titles = {
    overview: 'Admin Command Center • Platform Telemetry',
    funds: 'Corporate Treasury & Company Funds Ledger History',
    investments: 'Deposit & Investment Verifications',
    withdrawals: 'Withdrawal & Payout Processing',
    users: 'User Directory & Balance Control',
    support: 'Support Helpdesk Console',
    settings: 'System Business Rules & Investment Plans'
  };
  const titleEl = document.getElementById('header-page-title');
  if (titleEl) titleEl.innerText = titles[tabName] || 'FINOVO Command Center';
}

// 2. User Views / Sub-Menu Switcher
function switchNav(viewName) {
  if (viewName === 'admin') {
    if (state.isAdmin) {
      switchAdminNav('overview');
    } else {
      switchNav('dashboard');
    }
    return;
  }

  // Activate view
  document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add('active');

  if (state.isAdmin) {
    // Show investor mode preview banner
    const banner = document.getElementById('admin-investor-mode-banner');
    if (banner) banner.style.display = 'flex';

    // Highlight the "Investor Views" dropdown in topbar
    document.querySelectorAll('#top-nav-admin .nav-item').forEach(el => el.classList.remove('active'));
    const investorDropdown = document.getElementById('nav-adm-investor-sub');
    if (investorDropdown) investorDropdown.classList.remove('active');
  } else {
    // Regular user nav highlight
    document.querySelectorAll('#top-nav-user .nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${viewName}`);
    if (navItem) navItem.classList.add('active');

    const banner = document.getElementById('admin-investor-mode-banner');
    if (banner) banner.style.display = 'none';
  }

  if (viewName === 'kyc') {
    renderKYCView();
  }

  const titles = {
    dashboard: 'Dashboard Overview',
    investments: 'Investment Plans & Portfolio',
    wallet: 'Wallet & Ledger History',
    referrals: 'Multi-Level Referral Downline',
    kyc: 'Identity Verification (KYC)',
    support: 'Support Center'
  };
  const titleEl = document.getElementById('header-page-title');
  if (titleEl) titleEl.innerText = titles[viewName] || 'FINOVO Portal';
}

// Auth Handlers
function switchAuthTab(tab) {
  const loginTab = document.getElementById('tab-login-btn');
  const regTab = document.getElementById('tab-register-btn');
  if (loginTab) loginTab.className = `auth-tab ${tab === 'login' ? 'active' : ''}`;
  if (regTab) regTab.className = `auth-tab ${tab === 'register' ? 'active' : ''}`;

  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('form-verify-otp').style.display = 'none';
  const forgotForm = document.getElementById('form-forgot-password');
  if (forgotForm) forgotForm.style.display = tab === 'forgot' ? 'block' : 'none';
  const resetForm = document.getElementById('form-reset-password');
  if (resetForm) resetForm.style.display = tab === 'reset' ? 'block' : 'none';

  const title = document.getElementById('auth-form-title');
  const subtitle = document.getElementById('auth-form-subtitle');
  if (title && subtitle) {
    if (tab === 'login') {
      title.innerText = 'Sign in to your account';
      subtitle.innerHTML = 'Don\'t have an account? <a href="#" onclick="switchAuthTab(\'register\'); return false;">Register</a>';
    } else if (tab === 'register') {
      title.innerText = 'Create your account';
      subtitle.innerHTML = 'Already have an account? <a href="#" onclick="switchAuthTab(\'login\'); return false;">Sign in</a>';
    } else if (tab === 'forgot') {
      title.innerText = 'Reset your password';
      subtitle.innerHTML = 'Enter your email or username to receive a reset code.';
    } else if (tab === 'reset') {
      title.innerText = 'Set new password';
      subtitle.innerHTML = 'Enter the 6-digit code and your new password.';
    }
  }
}

// Show the OTP verification step
let _otpEmail = '';
let _otpCountdownTimer = null;

function showOTPStep(email) {
  _otpEmail = email;
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-register').style.display = 'none';
  document.getElementById('form-verify-otp').style.display = 'block';
  document.getElementById('otp-email-display').innerText = email;

  const title = document.getElementById('auth-form-title');
  const subtitle = document.getElementById('auth-form-subtitle');
  if (title) title.innerText = 'Verify your email';
  if (subtitle) subtitle.innerHTML = 'Enter the 6-digit code we sent to your inbox.';

  // Clear all digit inputs
  ['otp-d1', 'otp-d2', 'otp-d3', 'otp-d4', 'otp-d5', 'otp-d6'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.className = 'otp-digit'; }
  });

  // Setup digit auto-advance
  initOTPDigitBehaviour();

  // Start 60-second countdown before resend is enabled
  startOTPCountdown(60);

  // Focus first digit
  setTimeout(() => document.getElementById('otp-d1')?.focus(), 100);
}

function initOTPDigitBehaviour() {
  const ids = ['otp-d1', 'otp-d2', 'otp-d3', 'otp-d4', 'otp-d5', 'otp-d6'];
  ids.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', () => {
      // Only allow digits
      el.value = el.value.replace(/[^0-9]/g, '').slice(-1);
      el.classList.toggle('otp-filled', el.value !== '');
      if (el.value && idx < ids.length - 1) {
        document.getElementById(ids[idx + 1])?.focus();
      }
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !el.value && idx > 0) {
        const prev = document.getElementById(ids[idx - 1]);
        if (prev) { prev.value = ''; prev.classList.remove('otp-filled'); prev.focus(); }
      }
    });

    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      ids.forEach((did, di) => {
        const d = document.getElementById(did);
        if (d) { d.value = text[di] || ''; d.classList.toggle('otp-filled', !!d.value); }
      });
      const lastFilled = Math.min(text.length, ids.length) - 1;
      if (lastFilled >= 0) document.getElementById(ids[lastFilled])?.focus();
    });
  });
}

function startOTPCountdown(seconds) {
  if (_otpCountdownTimer) clearInterval(_otpCountdownTimer);
  const resendBtn = document.getElementById('otp-resend-btn');
  const countdownEl = document.getElementById('otp-countdown');
  if (resendBtn) resendBtn.disabled = true;
  let remaining = seconds;

  function updateDisplay() {
    if (countdownEl) countdownEl.innerText = remaining > 0 ? `Resend in ${remaining}s` : '';
    if (remaining <= 0) {
      if (resendBtn) resendBtn.disabled = false;
      clearInterval(_otpCountdownTimer);
    }
    remaining--;
  }
  updateDisplay();
  _otpCountdownTimer = setInterval(updateDisplay, 1000);
}

function getOTPValue() {
  return ['otp-d1', 'otp-d2', 'otp-d3', 'otp-d4', 'otp-d5', 'otp-d6']
    .map(id => (document.getElementById(id)?.value || '')).join('');
}

function setOTPDigitState(state) {
  ['otp-d1', 'otp-d2', 'otp-d3', 'otp-d4', 'otp-d5', 'otp-d6'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = `otp-digit${state ? ` ${state}` : ''}`;
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiCall('/auth/login/', 'POST', { email, password });
    if (data && data.access) {
      state.token = data.access;
      localStorage.setItem('finovo_token', data.access);
      showToast('Signed in successfully!');
      const pwInput = document.getElementById('login-password');
      if (pwInput) pwInput.value = '';
      await loadAllAPIData();
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const first_name = document.getElementById('reg-firstname').value;
  const last_name = document.getElementById('reg-lastname').value;
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const referral_code = document.getElementById('reg-refcode').value;

  if (password !== password2) {
    showToast('Passwords do not match.', true);
    return;
  }

  const submitBtn = document.getElementById('reg-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Creating account…'; }

  try {
    // 1. Register the user
    await apiCall('/auth/register/', 'POST', {
      email, username, first_name, last_name, password, password2, referral_code
    });

    // 2. Silently log in to obtain a token (needed by verify-email endpoint)
    const loginData = await apiCall('/auth/login/', 'POST', { email, password });
    if (loginData && loginData.access) {
      state.token = loginData.access;
      localStorage.setItem('finovo_token', loginData.access);
    }

    // 3. Show OTP verification step
    showToast('Account created! Check your email for the verification code.');
    showOTPStep(email);
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Create Account'; }
  }
}

async function handleVerifyOTP(e) {
  e.preventDefault();
  const otp = getOTPValue();
  if (otp.length !== 6) {
    showToast('Please enter the complete 6-digit code.', true);
    return;
  }

  const submitBtn = document.getElementById('otp-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Verifying…'; }

  try {
    await apiCall('/auth/verify-email/', 'POST', { otp });
    setOTPDigitState('otp-success');
    showToast('Email verified! Welcome to FINOVO 🎉');
    // Short delay so user sees the success state, then load dashboard
    setTimeout(() => loadAllAPIData(), 900);
  } catch (err) {
    setOTPDigitState('otp-error');
    showToast(err.message || 'Invalid or expired OTP.', true);
    // Reset error state after animation
    setTimeout(() => {
      ['otp-d1', 'otp-d2', 'otp-d3', 'otp-d4', 'otp-d5', 'otp-d6'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = `otp-digit${el.value ? ' otp-filled' : ''}`;
      });
    }, 600);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Verify Email'; }
  }
}

async function handleResendOTP() {
  try {
    await apiCall('/auth/resend-otp/', 'POST', { email: _otpEmail });
    showToast('A new code has been sent to your email.');
    startOTPCountdown(60);
    // Clear digit inputs
    ['otp-d1', 'otp-d2', 'otp-d3', 'otp-d4', 'otp-d5', 'otp-d6'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.className = 'otp-digit'; }
    });
    setTimeout(() => document.getElementById('otp-d1')?.focus(), 50);
  } catch (err) {
    showToast(err.message || 'Failed to resend OTP.', true);
  }
}

let _forgotAccount = '';
let _resetCountdownTimer = null;

function startResetCountdown(seconds) {
  if (_resetCountdownTimer) clearInterval(_resetCountdownTimer);
  const resendBtn = document.getElementById('reset-otp-resend-btn');
  const countdownEl = document.getElementById('reset-otp-countdown');
  if (resendBtn) resendBtn.disabled = true;
  let remaining = seconds;

  function updateDisplay() {
    if (countdownEl) countdownEl.innerText = remaining > 0 ? `Resend in ${remaining}s` : '';
    if (remaining <= 0) {
      if (resendBtn) resendBtn.disabled = false;
      clearInterval(_resetCountdownTimer);
    }
    remaining--;
  }
  updateDisplay();
  _resetCountdownTimer = setInterval(updateDisplay, 1000);
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const inputEl = document.getElementById('forgot-email');
  const email = inputEl ? inputEl.value.trim() : '';
  if (!email) {
    showToast('Please enter your email or username.', true);
    return;
  }

  const submitBtn = document.getElementById('forgot-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Sending Code…'; }

  try {
    const res = await apiCall('/auth/forgot-password/', 'POST', { email });
    _forgotAccount = email;
    const resetEmailInput = document.getElementById('reset-email');
    if (resetEmailInput) resetEmailInput.value = email;

    showToast(res.detail || 'Reset code sent! Please check your email.');
    switchAuthTab('reset');
    startResetCountdown(60);
    setTimeout(() => document.getElementById('reset-otp')?.focus(), 100);
  } catch (err) {
    showToast(err.message || 'Failed to send reset code.', true);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Send Reset Code'; }
  }
}

async function handleResendForgotOTP() {
  if (!_forgotAccount) return;
  const resendBtn = document.getElementById('reset-otp-resend-btn');
  if (resendBtn) resendBtn.disabled = true;
  try {
    await apiCall('/auth/forgot-password/', 'POST', { email: _forgotAccount });
    showToast('A new reset code has been sent.');
    startResetCountdown(60);
  } catch (err) {
    showToast(err.message || 'Failed to resend code.', true);
    if (resendBtn) resendBtn.disabled = false;
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const email = document.getElementById('reset-email')?.value.trim() || _forgotAccount;
  const otp = document.getElementById('reset-otp')?.value.trim() || '';
  const new_password = document.getElementById('reset-new-password')?.value || '';
  const new_password2 = document.getElementById('reset-new-password2')?.value || '';

  if (!email) {
    showToast('Account identifier is required.', true);
    return;
  }
  if (!otp || otp.length !== 6) {
    showToast('Please enter the complete 6-digit OTP.', true);
    return;
  }
  if (!new_password || new_password.length < 8) {
    showToast('Password must be at least 8 characters long.', true);
    return;
  }
  if (new_password !== new_password2) {
    showToast('Passwords do not match.', true);
    return;
  }

  const submitBtn = document.getElementById('reset-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Resetting Password…'; }

  try {
    const res = await apiCall('/auth/reset-password/', 'POST', {
      email,
      otp,
      new_password,
      new_password2,
    });
    showToast(res.detail || 'Password reset successfully! Please sign in.');
    switchAuthTab('login');
    // Clear forms
    const forgotInput = document.getElementById('forgot-email');
    if (forgotInput) forgotInput.value = '';
    const resetOtpInput = document.getElementById('reset-otp');
    if (resetOtpInput) resetOtpInput.value = '';
    const resetPw = document.getElementById('reset-new-password');
    if (resetPw) resetPw.value = '';
    const resetPw2 = document.getElementById('reset-new-password2');
    if (resetPw2) resetPw2.value = '';
  } catch (err) {
    showToast(err.message || 'Failed to reset password. Please verify the OTP.', true);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Reset Password'; }
  }
}

function handleLogout() {
  localStorage.removeItem('finovo_token');
  state.token = null;
  state.user = null;
  state.isAdmin = false;
  state.wallet = { balance: 0, total_deposited: 0, total_roi_earned: 0, total_direct_income: 0, total_referral_income: 0, total_withdrawn: 0 };
  state.plans = [];
  state.investments = [];
  state.deposits = [];
  state.withdrawals = [];
  state.ledger = [];
  state.team = [];
  state.commissions = [];
  state.tickets = [];
  state.levelStats = [];
  state.admin = {
    overview: null,
    funds: [],
    fundsSummary: null,
    investments: [],
    withdrawals: [],
    users: [],
    tickets: [],
    settings: [],
    plans: [],
  };

  // Close any open modals
  document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));

  // Reset top navigation and action bars
  const topNavUser = document.getElementById('top-nav-user');
  const topNavAdmin = document.getElementById('top-nav-admin');
  const userActions = document.getElementById('user-topbar-actions');
  const adminActions = document.getElementById('admin-topbar-actions');
  const banner = document.getElementById('admin-investor-mode-banner');

  if (topNavUser) topNavUser.style.display = 'flex';
  if (topNavAdmin) topNavAdmin.style.display = 'none';
  if (userActions) userActions.style.display = 'flex';
  if (adminActions) adminActions.style.display = 'none';
  if (banner) banner.style.display = 'none';

  // Reset active page view to dashboard
  document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
  const dashView = document.getElementById('view-dashboard');
  if (dashView) dashView.classList.add('active');

  // Reset nav items highlight
  document.querySelectorAll('#top-nav-user .nav-item').forEach(el => el.classList.remove('active'));
  const navDash = document.getElementById('nav-dashboard');
  if (navDash) navDash.classList.add('active');

  // Reset header page title
  const titleEl = document.getElementById('header-page-title');
  if (titleEl) titleEl.innerText = 'Dashboard Overview';

  // Clear login password input
  const loginPass = document.getElementById('login-password');
  if (loginPass) loginPass.value = '';

  // Clean URL hash if it's not a referral code
  if (window.location.hash && !window.location.hash.includes('ref')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  showAuthOverlay();
  switchAuthTab('login');
  showToast('Signed out of session.');
}

// Modal Toggle Handlers
function openModal(modalId) {
  if (modalId === 'modal-withdraw' && state.settings) {
    const profitFee = state.settings.PROFIT_WITHDRAWAL_FEE || 1.00;
    const profitMin = state.settings.MIN_PROFIT_WITHDRAWAL || 10.00;
    const capFee = state.settings.CAPITAL_WITHDRAWAL_FEE || 10.00;
    const capMin = state.settings.MIN_CAPITAL_WITHDRAWAL || 100.00;
    
    const select = document.getElementById('wdr-type');
    if (select && select.options.length >= 1) {
      select.options[0].text = `Wallet Withdrawal (Fee $${Number(profitFee).toFixed(2)}, Min $${Number(profitMin).toFixed(2)})`;
    }
  }
  const modalEl = document.getElementById(modalId);
  if (modalEl) {
    modalEl.classList.add('show');
    document.body.classList.add('modal-open');
    modalEl.scrollTop = 0;
  }
}

function closeModal(modalId) {
  const modalEl = document.getElementById(modalId);
  if (modalEl) {
    modalEl.classList.remove('show');
  }
  if (document.querySelectorAll('.modal-backdrop.show').length === 0) {
    document.body.classList.remove('modal-open');
  }
}

// Global Modal Backdrop Click & Escape Key to close modals
document.addEventListener('click', function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('modal-backdrop') && e.target.classList.contains('show')) {
    closeModal(e.target.id);
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' || e.key === 'Esc') {
    const openModals = document.querySelectorAll('.modal-backdrop.show');
    if (openModals.length > 0) {
      const topModal = openModals[openModals.length - 1];
      closeModal(topModal.id);
    }
  }
});

// ─── Investment Plan Modal & API Creation ─────────────────────────────────────

function openInvestModal(planId, planName, cost = 120, tradingCapital = 120, maxReturn = 350) {
  if (state.user && state.user.kyc_status !== 'APPROVED') {
    const kycSt = state.user.kyc_status;
    const msg = kycSt === 'PENDING'
      ? 'Your KYC verification is currently under review by compliance. You will be able to buy packages once approved.'
      : 'KYC identity verification is required before purchasing an investment package. Please submit your identity documents.';
    showToast(msg, true);
    switchNav('kyc');
    return;
  }

  const foundPlan = (state.plans || []).find(p => p.id === planId);
  const costVal = cost || (foundPlan ? (foundPlan.cost || foundPlan.minimum_amount) : 120);
  const tradingCapVal = tradingCapital || (foundPlan ? foundPlan.trading_capital : costVal);
  const maxRetVal = maxReturn || (foundPlan ? (foundPlan.max_total_return || (tradingCapVal * (foundPlan.max_return_factor || 3))) : (costVal * 3));

  document.getElementById('inv-plan-name').value = planId;
  document.getElementById('inv-plan-display').value = planName || (foundPlan ? foundPlan.name : 'Package');

  const input = document.getElementById('inv-amount');
  if (input) input.value = costVal;

  const tradingCapEl = document.getElementById('inv-trading-cap-display');
  if (tradingCapEl) tradingCapEl.value = `$${Number(tradingCapVal).toFixed(2)}`;

  const maxRetEl = document.getElementById('inv-max-return');
  if (maxRetEl) maxRetEl.innerText = `$${Number(maxRetVal).toFixed(2)}`;

  // Clear deposit fields
  document.getElementById('inv-network').value = '';
  document.getElementById('inv-txhash').value = '';
  document.getElementById('inv-sender').value = '';
  document.getElementById('inv-proof').value = '';
  const depBox = document.getElementById('company-deposit-box');
  if (depBox) depBox.style.display = 'none';

  openModal('modal-invest');
}

function getQRUrl(address, customQr = '') {
  if (customQr && customQr.trim()) {
    return customQr.trim();
  }
  if (!address || address === 'Address not configured') {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=4&data=FINOVO';
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=4&data=${encodeURIComponent(address)}`;
}

function handleDepositNetworkChange() {
  const net = document.getElementById('inv-network').value;
  const box = document.getElementById('company-deposit-box');
  if (!box) return;

  if (!net) {
    box.style.display = 'none';
    return;
  }

  const wallets = state.depositWallets || {
    BEP20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    TRC20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
    BEP20_QR: '',
    TRC20_QR: '',
  };

  const address = wallets[net] || 'Address not configured';
  const customQr = net === 'BEP20' ? (wallets.BEP20_QR || '') : (wallets.TRC20_QR || '');

  const addrInput = document.getElementById('company-wallet-addr');
  if (addrInput) addrInput.value = address;

  const qrImg = document.getElementById('company-deposit-qr-img');
  if (qrImg) qrImg.src = getQRUrl(address, customQr);

  const labelEl = document.getElementById('dep-network-label');
  if (labelEl) labelEl.innerText = net === 'BEP20' ? 'BEP20 (BSC)' : 'TRC20 (TRON)';

  const badgeEl = document.getElementById('dep-network-badge');
  if (badgeEl) badgeEl.innerText = `${net} USDT`;

  const noticeEl = document.getElementById('dep-network-notice');
  if (noticeEl) noticeEl.innerText = net;

  box.style.display = 'block';
}

function copyCompanyDepositAddress() {
  const input = document.getElementById('company-wallet-addr');
  if (!input || !input.value) return;

  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById('btn-copy-deposit-addr');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<span>Copied! ✓</span>`;
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }
    showToast('Company deposit address copied to clipboard!');
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!');
  });
}

document.getElementById('inv-amount')?.addEventListener('input', updateMaxReturnCalc);

function updateMaxReturnCalc() {
  const amt = Number(document.getElementById('inv-amount').value) || 0;
  const maxReturn = amt * 3.0;
  document.getElementById('inv-max-return').innerText = `$${maxReturn.toFixed(2)}`;
}

async function handleInvestSubmit(e) {
  e.preventDefault();
  const plan = document.getElementById('inv-plan-name').value;
  const amount = document.getElementById('inv-amount').value;
  const network = document.getElementById('inv-network').value;
  const txhash = document.getElementById('inv-txhash').value;
  const sender = document.getElementById('inv-sender').value;
  const proofFile = document.getElementById('inv-proof').files[0];

  if (!network) {
    showToast('Please select a deposit network.', true);
    return;
  }
  if (!txhash && !proofFile) {
    showToast('Please provide a transaction hash or upload a payment screenshot.', true);
    return;
  }

  const formData = new FormData();
  formData.append('plan', plan);
  formData.append('amount', amount);
  formData.append('deposit_network', network);
  if (txhash) formData.append('deposit_txn_hash', txhash);
  if (sender) formData.append('deposit_sender_address', sender);
  if (proofFile) formData.append('deposit_proof', proofFile);

  try {
    await apiCall('/investments/', 'POST', formData, /* isFormData */ true);
    closeModal('modal-invest');
    showToast('Investment submitted! Admin will verify your deposit and activate the plan.');
    await loadAllAPIData();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ─── Withdrawal Fee Calculator & API Submission ────────────────────────────────

function updateWithdrawalFeeCalc() {
  const type = document.getElementById('wdr-type').value;
  const amount = Number(document.getElementById('wdr-amount').value) || 0;
  
  const profitFee = state.settings?.PROFIT_WITHDRAWAL_FEE || 1.00;
  const capFee = state.settings?.CAPITAL_WITHDRAWAL_FEE || 10.00;
  const fee = type === 'PROFIT' ? profitFee : capFee;
  
  const net = Math.max(0, amount - fee);
  document.getElementById('wdr-fee-preview').innerText = `$${fee.toFixed(2)}`;
  document.getElementById('wdr-net-preview').innerText = `$${net.toFixed(2)}`;
}

async function handleWithdrawSubmit(e) {
  e.preventDefault();
  const withdrawal_type = document.getElementById('wdr-type').value;
  const amount = Number(document.getElementById('wdr-amount').value);
  const network = document.getElementById('wdr-network').value;
  const wallet_address = document.getElementById('wdr-address').value;

  try {
    await apiCall('/withdrawals/', 'POST', { withdrawal_type, amount, network, wallet_address });
    closeModal('modal-withdraw');
    showToast('Withdrawal request submitted! Awaiting Admin approval.');
    await loadAllAPIData();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Copy Referral Link
function copyReferralLink() {
  const input = document.getElementById('dash-ref-link');
  input.select();
  document.execCommand('copy');
  showToast('Referral link copied to clipboard!');
}

// Create Support Ticket via API
async function handleCreateTicket(e) {
  e.preventDefault();
  const subject = document.getElementById('ticket-subject').value;
  const category = document.getElementById('ticket-category').value;
  const message = document.getElementById('ticket-message').value;

  try {
    await apiCall('/support/tickets/', 'POST', { subject, category, message });
    document.getElementById('ticket-subject').value = '';
    document.getElementById('ticket-message').value = '';
    showToast('Support ticket created successfully!');
    await loadAllAPIData();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Toast Helper
function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isError) {
    toast.style.borderColor = 'var(--accent-danger)';
    toast.style.color = 'var(--accent-danger)';
  }
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ==========================================================================
   ADMIN PORTAL OPERATIONS & TELEMETRY HUB
   ========================================================================== */

state.admin = {
  overview: null,
  funds: [],
  fundsSummary: null,
  investments: [],
  withdrawals: [],
  users: [],
  tickets: [],
  settings: [],
  plans: [],
};

let adminSearchDebounceTimer = null;

function debounceAdminSearch(type) {
  clearTimeout(adminSearchDebounceTimer);
  adminSearchDebounceTimer = setTimeout(() => {
    if (type === 'funds') loadAdminFunds();
    else if (type === 'investments') loadAdminInvestments();
    else if (type === 'withdrawals') loadAdminWithdrawals();
    else if (type === 'users') loadAdminUsers();
    else if (type === 'tickets') loadAdminTickets();
  }, 350);
}

function copyElementText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.select();
  document.execCommand('copy');
  showToast('Copied to clipboard!');
}

function copyDirectText(text, msg = 'Copied to clipboard!') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => {
      showToast('Copied: ' + text);
    });
  } else {
    showToast('Copied: ' + text);
  }
}

// ─── Sub-Tab Navigation Switcher ───
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-subpage').forEach(p => p.classList.remove('active'));

  const btn = document.getElementById(`adm-tab-${tabName}`);
  const page = document.getElementById(`adm-content-${tabName}`);

  if (btn) btn.classList.add('active');
  if (page) page.classList.add('active');

  if (tabName === 'overview') loadAdminData();
  else if (tabName === 'funds') { loadAdminFunds(); loadAdminFundsSummary(); }
  else if (tabName === 'investments') loadAdminInvestments();
  else if (tabName === 'withdrawals') loadAdminWithdrawals();
  else if (tabName === 'users') loadAdminUsers();
  else if (tabName === 'support') loadAdminTickets();
  else if (tabName === 'settings') loadAdminSettings();
}

// ─── 1. Admin Overview Telemetry ───
async function loadAdminData(force = false) {
  if (!state.isAdmin) return;

  try {
    const overview = await apiCall('/admin-panel/overview/');
    state.admin.overview = overview;
    renderAdminOverview(overview);
    if (force) showToast('Admin telemetry refreshed live.');
  } catch (err) {
    console.error('Failed to load admin overview:', err);
  }
}

function renderAdminOverview(ov) {
  if (!ov) return;

  // Stat Cards
  const admStatCompany = document.getElementById('adm-stat-company-wallet');
  if (admStatCompany) admStatCompany.innerText = `$${Number(ov.finances.company_wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById('adm-stat-users').innerText = ov.users.total;
  document.getElementById('adm-stat-users-sub').innerText = `${ov.users.verified} verified • ${ov.users.active} active investors • ${ov.users.pending_kyc} KYC pending`;

  document.getElementById('adm-stat-active-inv').innerText = `$${Number(ov.investments.active_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('adm-stat-inv-sub').innerText = `${ov.investments.active_count} active plans ($${Number(ov.investments.all_time_total).toFixed(2)} total)`;

  document.getElementById('adm-stat-pending-dep').innerText = `$${Number(ov.investments.pending_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('adm-stat-pending-dep-sub').innerText = `${ov.investments.pending_count} deposits awaiting review`;

  document.getElementById('adm-stat-pending-wdr').innerText = `$${Number(ov.withdrawals.pending_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('adm-stat-pending-wdr-sub').innerText = `${ov.withdrawals.pending_count} payouts queued`;

  // Badges (Sub-nav & Topbar)
  const invBadge = document.getElementById('adm-badge-investments');
  if (invBadge) invBadge.innerText = ov.investments.pending_count;

  const wdrBadge = document.getElementById('adm-badge-withdrawals');
  if (wdrBadge) wdrBadge.innerText = ov.withdrawals.pending_count;

  const tktBadge = document.getElementById('adm-badge-tickets');
  if (tktBadge) tktBadge.innerText = ov.support.open_tickets;

  const topInvBadge = document.getElementById('top-badge-inv');
  if (topInvBadge) {
    topInvBadge.innerText = ov.investments.pending_count;
    topInvBadge.style.display = ov.investments.pending_count > 0 ? 'inline-block' : 'none';
  }

  const topWdrBadge = document.getElementById('top-badge-wdr');
  if (topWdrBadge) {
    topWdrBadge.innerText = ov.withdrawals.pending_count;
    topWdrBadge.style.display = ov.withdrawals.pending_count > 0 ? 'inline-block' : 'none';
  }

  const topTktBadge = document.getElementById('top-badge-tkt');
  if (topTktBadge) {
    topTktBadge.innerText = ov.support.open_tickets;
    topTktBadge.style.display = ov.support.open_tickets > 0 ? 'inline-block' : 'none';
  }

  // System Balances & Liabilities
  const admFinCompany = document.getElementById('adm-fin-company');
  if (admFinCompany) admFinCompany.innerText = `$${Number(ov.finances.company_wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  document.getElementById('adm-fin-balance').innerText = `$${Number(ov.finances.total_system_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('adm-fin-deposits').innerText = `$${Number(ov.finances.total_system_deposited).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('adm-fin-roi').innerText = `$${Number(ov.finances.total_roi_earned).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('adm-fin-comm').innerText = `$${Number(ov.finances.total_direct_income).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Overview Queues
  renderOverviewDepositsQueue(ov.queues.pending_investments || []);
  renderOverviewWithdrawalsQueue(ov.queues.pending_withdrawals || []);
  renderOverviewTicketsQueue(ov.queues.recent_tickets || []);
}

function renderOverviewDepositsQueue(items) {
  const tbody = document.getElementById('adm-overview-deposits-tbody');
  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--mute); padding:24px;">No pending deposits waiting for review.</td></tr>`;
    return;
  }

  items.forEach(inv => {
    const proofThumb = inv.deposit_proof_url
      ? `<img src="${inv.deposit_proof_url}" class="proof-thumbnail" onclick="event.stopPropagation(); openLightbox('${inv.deposit_proof_url}')" title="Click to enlarge proof screenshot">`
      : `<span style="font-size:11px; color:var(--mute);">TxID Only</span>`;

    const txShort = inv.deposit_txn_hash ? `${inv.deposit_txn_hash.slice(0, 10)}...` : 'N/A';

    tbody.innerHTML += `
      <tr onclick="openProofModal('${inv.id}')" style="cursor:pointer;" title="Click to view full investment dossier & proof">
        <td>
          <div style="font-weight:600; color:var(--text);">${inv.user_email}</div>
          <div style="font-size:11px; color:var(--mute); font-family:var(--font-mono);">${inv.deposit_network || 'BEP20'}</div>
        </td>
        <td>
          <div style="color:var(--text);">${inv.plan_name}</div>
          <b style="color:var(--gold); font-family:var(--font-mono);">$${Number(inv.amount).toFixed(2)}</b>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            ${proofThumb}
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--mute);">${txShort}</span>
          </div>
        </td>
        <td style="text-align:right;">
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn btn-sm btn-primary" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); submitApproveInvestment('${inv.id}')">Approve</button>
            <button class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); openRejectInvestmentModal('${inv.id}')">Reject</button>
            <button class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); openProofModal('${inv.id}')">🔍</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function renderOverviewWithdrawalsQueue(items) {
  const tbody = document.getElementById('adm-overview-withdrawals-tbody');
  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--mute); padding:24px;">No pending withdrawals queued.</td></tr>`;
    return;
  }

  items.forEach(wdr => {
    const addrShort = wdr.wallet_address ? `${wdr.wallet_address.slice(0, 8)}...${wdr.wallet_address.slice(-6)}` : 'N/A';
    tbody.innerHTML += `
      <tr onclick="openWithdrawalDetailModal('${wdr.id}')" style="cursor:pointer;" title="Click to view full payout inspector">
        <td>
          <div style="font-weight:600; color:var(--text);">${wdr.user_email}</div>
          <div style="font-size:11px; color:var(--mute);">${wdr.withdrawal_type}</div>
        </td>
        <td>
          <b style="color:var(--text); font-family:var(--font-mono);">$${Number(wdr.net_amount).toFixed(2)}</b>
          <div style="font-size:10px; color:var(--mute);">Fee: $${Number(wdr.fee).toFixed(2)}</div>
        </td>
        <td>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--mute);">${addrShort}</div>
          <div style="font-size:10px; color:var(--gold);">${wdr.network}</div>
        </td>
        <td style="text-align:right;">
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn btn-sm btn-primary" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); submitApproveWithdrawal('${wdr.id}')">Pay</button>
            <button class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); openRejectWithdrawalModal('${wdr.id}')">Reject</button>
            <button class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); openWithdrawalDetailModal('${wdr.id}')">🔍</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function renderOverviewTicketsQueue(items) {
  const tbody = document.getElementById('adm-overview-tickets-tbody');
  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--mute); padding:24px;">No open support tickets.</td></tr>`;
    return;
  }

  items.forEach(tkt => {
    tbody.innerHTML += `
      <tr>
        <td style="font-weight:600; color:var(--text);">${tkt.user_email}</td>
        <td>${tkt.subject}</td>
        <td><span class="badge badge-${(tkt.status || 'open').toLowerCase().replace('_', '-')}">${tkt.status}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="openAdminTicketModal('${tkt.id}')">Reply</button>
        </td>
      </tr>
    `;
  });
}

// ─── 2. Admin Company Funds & Treasury Ledger ───
function filterAdminFunds() {
  loadAdminFunds();
}

function resetAdminFundsFilters() {
  const searchInput = document.getElementById('adm-funds-search');
  const catFilter = document.getElementById('adm-funds-filter-category');
  const typeFilter = document.getElementById('adm-funds-filter-type');
  if (searchInput) searchInput.value = '';
  if (catFilter) catFilter.value = 'all';
  if (typeFilter) typeFilter.value = 'all';
  loadAdminFunds();
}

async function loadAdminFunds(overrideUrl = null, force = false) {
  if (!state.isAdmin) return;

  let url = overrideUrl;
  if (typeof url !== 'string') {
    const category = document.getElementById('adm-funds-filter-category')?.value || 'all';
    const txnType = document.getElementById('adm-funds-filter-type')?.value || 'all';
    const search = document.getElementById('adm-funds-search')?.value.trim() || '';

    url = `/admin-panel/funds/?`;
    if (category && category !== 'all') url += `&category=${encodeURIComponent(category)}`;
    if (txnType && txnType !== 'all') url += `&transaction_type=${encodeURIComponent(txnType)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const data = await apiCall(url);
    const funds = Array.isArray(data) ? data : (data.results || []);
    if (data && !Array.isArray(data)) {
      state.pagination.adminFunds = { next: data.next, previous: data.previous, count: data.count };
    } else {
      state.pagination.adminFunds = { next: null, previous: null, count: funds.length };
    }

    state.admin.funds = funds;
    renderAdminFunds(funds);
    renderPaginationControls('adm-funds-pagination', state.pagination.adminFunds, loadAdminFunds);

    const countBadge = document.getElementById('adm-funds-count-badge');
    if (countBadge) countBadge.innerText = `${state.pagination.adminFunds.count || funds.length} Records`;

    // Load summary metrics as well
    loadAdminFundsSummary();

    if (force) showToast('Company Funds ledger refreshed.');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadAdminFundsSummary() {
  if (!state.isAdmin) return;

  try {
    const summary = await apiCall('/admin-panel/funds/summary/');
    state.admin.fundsSummary = summary;
    renderAdminFundsSummary(summary);
  } catch (err) {
    console.error('Failed to load company funds summary:', err);
  }
}

function renderAdminFundsSummary(summary) {
  if (!summary) return;

  const balEl = document.getElementById('adm-funds-stat-balance');
  if (balEl) balEl.innerText = `$${Number(summary.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const remEl = document.getElementById('adm-funds-stat-remainders');
  if (remEl) remEl.innerText = `$${Number(summary.total_investment_remainders || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const feeEl = document.getElementById('adm-funds-stat-fees');
  if (feeEl) feeEl.innerText = `$${Number(summary.total_withdrawal_fees || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cntEl = document.getElementById('adm-funds-stat-count');
  if (cntEl) cntEl.innerText = summary.total_count || 0;

  const updEl = document.getElementById('adm-funds-stat-updated');
  if (updEl && summary.updated_at) {
    updEl.innerText = `Live Updated: ${new Date(summary.updated_at).toLocaleTimeString()}`;
  }
}

function renderAdminFunds(funds) {
  const tbody = document.getElementById('adm-funds-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!funds || funds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:36px; color:var(--mute);">No company ledger transactions found for the selected criteria.</td></tr>`;
    return;
  }

  funds.forEach(txn => {
    const isCredit = txn.transaction_type === 'CREDIT';
    const typeBadge = isCredit
      ? `<span class="badge badge-approved" style="font-size:10px; font-weight:700;">+ CREDIT</span>`
      : `<span class="badge badge-pending" style="font-size:10px; font-weight:700; background:rgba(239,68,68,0.15); color:#f87171; border-color:rgba(239,68,68,0.3);">- DEBIT</span>`;

    let catBadgeClass = 'badge-approved';
    let catLabel = txn.category_display || txn.category;
    if (txn.category === 'INVESTMENT_REMAINDER') {
      catBadgeClass = 'badge-approved';
    } else if (txn.category === 'WITHDRAWAL_FEE') {
      catBadgeClass = 'badge-kyc-approved';
    } else if (txn.category === 'ADJUSTMENT') {
      catBadgeClass = 'badge-admin';
    }

    const catBadge = `<span class="badge ${catBadgeClass}" style="font-size:10px;">${catLabel}</span>`;
    const amountColor = isCredit ? '#34d399' : '#f87171';
    const amountSign = isCredit ? '+' : '-';
    const dateStr = txn.created_at ? new Date(txn.created_at).toLocaleString() : 'N/A';
    const refId = txn.reference_id || 'N/A';
    const refShort = refId.length > 16 ? `${refId.slice(0, 8)}...${refId.slice(-6)}` : refId;

    tbody.innerHTML += `
      <tr>
        <td style="font-size:12px; color:var(--mute); font-family:var(--font-mono); white-space:nowrap;">${dateStr}</td>
        <td>${typeBadge}</td>
        <td>${catBadge}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:${amountColor}; font-size:13.5px; white-space:nowrap;">
          ${amountSign}$${Number(txn.amount).toFixed(2)}
        </td>
        <td style="font-family:var(--font-mono); color:var(--mute); font-size:12.5px;">$${Number(txn.balance_before).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); font-weight:600; color:var(--gold); font-size:12.5px;">$${Number(txn.balance_after).toFixed(2)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text);" title="${refId}">${refShort}</span>
            ${refId !== 'N/A' ? `<button type="button" class="btn btn-sm btn-secondary" style="padding:2px 5px; font-size:9px;" onclick="copyDirectText('${refId}', 'Reference ID copied')">Copy</button>` : ''}
          </div>
        </td>
        <td style="font-size:12.5px; color:var(--text); max-width:280px; word-break:break-word;">${txn.description || '—'}</td>
      </tr>
    `;
  });
}

function openAdminFundsAdjustModal() {
  const actionSel = document.getElementById('adm-funds-adj-action');
  const amountInp = document.getElementById('adm-funds-adj-amount');
  const reasonInp = document.getElementById('adm-funds-adj-reason');
  if (actionSel) actionSel.value = 'CREDIT';
  if (amountInp) amountInp.value = '';
  if (reasonInp) reasonInp.value = '';
  openModal('modal-admin-funds-adjust');
}

async function handleCompanyFundsAdjustSubmit(event) {
  event.preventDefault();
  const action = document.getElementById('adm-funds-adj-action').value;
  const amount = document.getElementById('adm-funds-adj-amount').value;
  const reason = document.getElementById('adm-funds-adj-reason').value.trim();

  if (!amount || Number(amount) <= 0) {
    showToast('Please enter a valid positive adjustment amount.', true);
    return;
  }
  if (!reason) {
    showToast('Please provide a justification reason for this adjustment.', true);
    return;
  }

  const submitBtn = document.getElementById('adm-funds-adj-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Processing...';
  }

  try {
    const res = await apiCall('/admin-panel/funds/adjust/', 'POST', {
      action,
      amount: parseFloat(amount),
      reason,
    });

    showToast(res.detail || 'Company wallet adjustment applied successfully.');
    closeModal('modal-admin-funds-adjust');

    // Reload funds ledger, summary and general admin telemetry
    loadAdminFunds();
    loadAdminData();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Apply Treasury Adjustment';
    }
  }
}

// ─── 3. Admin Investments & Deposit Proofs ───
function filterAdminInvestments() {
  loadAdminInvestments();
}

async function loadAdminInvestments() {
  const statusFilter = document.getElementById('adm-inv-filter-status')?.value || 'DEPOSIT_PENDING';
  const search = document.getElementById('adm-inv-search')?.value.trim() || '';

  let url = `/admin-panel/investments/?status=${encodeURIComponent(statusFilter)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const data = await apiCall(url);
    const investments = Array.isArray(data) ? data : (data.results || []);
    state.admin.investments = investments;
    renderAdminInvestments(investments);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderAdminInvestments(investments) {
  const tbody = document.getElementById('adm-investments-tbody');
  tbody.innerHTML = '';

  if (investments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--mute);">No investments found for the selected criteria.</td></tr>`;
    return;
  }

  investments.forEach(inv => {
    const isPending = inv.status === 'DEPOSIT_PENDING' || inv.status === 'PENDING';
    const proofThumb = inv.deposit_proof_url
      ? `<img src="${inv.deposit_proof_url}" class="proof-thumbnail" onclick="event.stopPropagation(); openLightbox('${inv.deposit_proof_url}')" title="Click to enlarge proof screenshot">`
      : `<span style="font-size:11px; color:var(--mute);">—</span>`;

    const txShort = inv.deposit_txn_hash ? `${inv.deposit_txn_hash.slice(0, 10)}...` : 'N/A';
    const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleString() : 'N/A';

    tbody.innerHTML += `
      <tr onclick="openProofModal('${inv.id}')" style="cursor:pointer;" title="Click to view complete investment dossier & proof">
        <td>
          <div style="font-weight:600; color:var(--text);">${inv.user_email}</div>
          <div style="font-size:11px; color:var(--mute);">@${inv.user_username || 'user'}</div>
        </td>
        <td>
          <b style="color:var(--text);">${inv.plan_name}</b>
          <div style="font-size:11px; color:var(--mute);">Max Ret: $${Number(inv.max_return).toFixed(2)}</div>
        </td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--gold);">$${Number(inv.amount).toFixed(2)}</td>
        <td><span class="badge badge-approved" style="font-size:10px;">${inv.deposit_network || 'BEP20'}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            ${proofThumb}
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text);" title="${inv.deposit_txn_hash || ''}">${txShort}</span>
          </div>
        </td>
        <td><span class="badge badge-${inv.status.toLowerCase().replace('_', '-')}">${inv.status.replace('_', ' ')}</span></td>
        <td style="font-size:12px; color:var(--mute);">${dateStr}</td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:6px;">
            ${isPending ? `
              <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); submitApproveInvestment('${inv.id}')">Approve & Activate</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); openRejectInvestmentModal('${inv.id}')">Reject</button>
            ` : ''}
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openProofModal('${inv.id}')">Details</button>
          </div>
        </td>
      </tr>
    `;
  });
}

// ─── 3. Admin Withdrawals Queue ───
function filterAdminWithdrawals() {
  loadAdminWithdrawals();
}

async function loadAdminWithdrawals() {
  const statusFilter = document.getElementById('adm-wdr-filter-status')?.value || 'PENDING';
  const search = document.getElementById('adm-wdr-search')?.value.trim() || '';

  let url = `/admin-panel/withdrawals/?status=${encodeURIComponent(statusFilter)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const data = await apiCall(url);
    const withdrawals = Array.isArray(data) ? data : (data.results || []);
    state.admin.withdrawals = withdrawals;
    renderAdminWithdrawals(withdrawals);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderAdminWithdrawals(withdrawals) {
  const tbody = document.getElementById('adm-withdrawals-tbody');
  tbody.innerHTML = '';

  if (withdrawals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--mute);">No withdrawals found for the selected criteria.</td></tr>`;
    return;
  }

  withdrawals.forEach(wdr => {
    const isPending = wdr.status === 'PENDING';
    const dateStr = wdr.created_at ? new Date(wdr.created_at).toLocaleString() : 'N/A';
    const addrShort = wdr.wallet_address ? `${wdr.wallet_address.slice(0, 8)}...${wdr.wallet_address.slice(-6)}` : 'N/A';

    tbody.innerHTML += `
      <tr onclick="openWithdrawalDetailModal('${wdr.id}')" style="cursor:pointer;" title="Click to view full withdrawal inspector">
        <td>
          <div style="font-weight:600; color:var(--text);">${wdr.user_email}</div>
          <div style="font-size:11px; color:var(--mute);">@${wdr.user_username || 'user'}</div>
        </td>
        <td><span class="badge ${wdr.withdrawal_type === 'CAPITAL' ? 'badge-pending' : 'badge-approved'}">${wdr.withdrawal_type}</span></td>
        <td style="font-family:var(--font-mono); font-weight:700;">$${Number(wdr.amount).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--mute);">$${Number(wdr.fee).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--gold);">$${Number(wdr.net_amount).toFixed(2)}</td>
        <td>
          <div style="font-family:var(--font-mono); font-size:12px; color:var(--text);" title="${wdr.wallet_address || ''}">${addrShort}</div>
          <span class="badge badge-approved" style="font-size:10px;">${wdr.network}</span>
        </td>
        <td><span class="badge badge-${wdr.status.toLowerCase().replace('_', '-')}">${wdr.status}</span></td>
        <td style="font-size:12px; color:var(--mute);">${dateStr}</td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:6px;">
            ${isPending ? `
              <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); submitApproveWithdrawal('${wdr.id}')">Approve & Pay</button>
              <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); openRejectWithdrawalModal('${wdr.id}')">Reject</button>
            ` : `
              <span style="font-size:12px; color:var(--mute); align-self:center;">${wdr.reviewed_by_email ? 'By ' + wdr.reviewed_by_email : 'Processed'}</span>
            `}
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openWithdrawalDetailModal('${wdr.id}')">Details</button>
          </div>
        </td>
      </tr>
    `;
  });
}

// ─── Pagination Utilities ───
function formatApiUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) {
    const urlObj = new URL(url);
    let path = urlObj.pathname + urlObj.search;
    if (path.startsWith(API_BASE)) {
      path = path.substring(API_BASE.length);
    }
    return path;
  }
  return url;
}

function renderPaginationControls(containerId, paginationState, loadFunction) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!paginationState.next && !paginationState.previous) {
    container.innerHTML = '';
    return;
  }

  let pageInfo = `Total Records: <b>${paginationState.count}</b>`;

  container.innerHTML = `
    <div class="pagination-info">${pageInfo}</div>
    <div class="pagination-buttons">
      <button type="button" class="pagination-btn" id="${containerId}-prev" ${!paginationState.previous ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;"><path d="M15 18l-6-6 6-6"/></svg> Previous
      </button>
      <button type="button" class="pagination-btn" id="${containerId}-next" ${!paginationState.next ? 'disabled' : ''}>
        Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:2px;"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  `;

  const prevBtn = document.getElementById(`${containerId}-prev`);
  const nextBtn = document.getElementById(`${containerId}-next`);

  if (prevBtn && paginationState.previous) {
    prevBtn.onclick = () => loadFunction(formatApiUrl(paginationState.previous));
  }
  if (nextBtn && paginationState.next) {
    nextBtn.onclick = () => loadFunction(formatApiUrl(paginationState.next));
  }
}

// ─── 4. Admin User Management ───
function filterAdminUsers() {
  loadAdminUsers();
}

async function loadAdminUsers(overrideUrl = null) {
  let url = overrideUrl;
  if (typeof url !== 'string') {
    const roleFilter = document.getElementById('adm-usr-filter-role')?.value || '';
    const kycFilter = document.getElementById('adm-usr-filter-kyc')?.value || '';
    const search = document.getElementById('adm-usr-search')?.value.trim() || '';

    url = `/admin-panel/users/?`;
    if (roleFilter) url += `&role=${encodeURIComponent(roleFilter)}`;
    if (kycFilter) url += `&kyc_status=${encodeURIComponent(kycFilter)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const data = await apiCall(url);
    const users = Array.isArray(data) ? data : (data.results || []);
    if (data && !Array.isArray(data)) {
      state.pagination.adminUsers = { next: data.next, previous: data.previous, count: data.count };
    } else {
      state.pagination.adminUsers = { next: null, previous: null, count: users.length };
    }
    state.admin.users = users;
    renderAdminUsers(users);
    renderPaginationControls('adm-users-pagination', state.pagination.adminUsers, loadAdminUsers);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('adm-users-tbody');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:32px; color:var(--mute);">No users match the search criteria.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const initial = (u.full_name || u.email || 'U')[0].toUpperCase();
    const roleBadge = u.role === 'ADMIN' ? 'badge-admin' : (u.role === 'SUPPORT' ? 'badge-support' : (u.role === 'FINANCE' ? 'badge-finance' : 'badge-user'));
    const kycBadge = u.kyc_status === 'APPROVED' ? 'badge-kyc-approved' : (u.kyc_status === 'PENDING' ? 'badge-kyc-pending' : 'badge-kyc-unverified');
    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A';

    tbody.innerHTML += `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar" style="width:32px; height:32px; font-size:13px;">${initial}</div>
            <div>
              <div style="font-weight:600; color:var(--text); display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                <span>${u.full_name || u.email}</span>
                <span class="badge ${roleBadge}" style="font-size:9px; padding:2px 6px; line-height:1.2;">${u.role}</span>
                <span class="badge ${kycBadge}" style="font-size:9px; padding:2px 6px; line-height:1.2;">${u.kyc_status}</span>
                <span class="badge badge-approved" style="font-size:9px; padding:2px 6px; line-height:1.2;">Level ${u.active_level || 0}</span>
              </div>
              <div style="font-size:11px; color:var(--mute); font-family:var(--font-mono);">${u.email}</div>
            </div>
          </div>
        </td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--gold);">$${Number(u.wallet_balance || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono);">$${Number(u.total_invested || 0).toFixed(2)} (${u.active_investments_count || 0})</td>
        <td style="font-family:var(--font-mono);">$${Number(u.total_withdrawn || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--success); font-weight:600;">$${Number(u.total_roi_earned || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--accent); font-weight:600;">$${Number(u.total_direct_income || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--text); font-weight:600;">$${Number(u.total_referral_income || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono); font-size:12px;">
          <span style="font-weight:700; color:var(--text);">${u.team_total_members || 0}</span> <span style="color:var(--mute); font-size:11px;">users</span><br>
          <span style="color:var(--gold); font-size:11px;">$${Number(u.team_total_investment || 0).toFixed(2)}</span>
        </td>
        <td style="font-size:12px; color:var(--mute);">${u.parent_email || 'Root (None)'}</td>
        <td style="font-size:12px; color:var(--mute);">${dateStr}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-sm btn-secondary" onclick="openAdminUserTeamModal('${u.id}')" style="margin-right:6px; font-size:11px; padding:4px 9px;">Team</button>
          <button class="btn btn-sm btn-secondary" onclick="openManageUserModal('${u.id}')" style="font-size:11px; padding:4px 9px;">Manage</button>
        </td>
      </tr>
    `;
  });
}

// ─── 5. Admin Support Desk ───
function filterAdminTickets() {
  loadAdminTickets();
}

async function loadAdminTickets() {
  const statusFilter = document.getElementById('adm-tkt-filter-status')?.value || 'OPEN';
  const search = document.getElementById('adm-tkt-search')?.value.trim() || '';

  let url = `/admin-panel/tickets/?status=${encodeURIComponent(statusFilter)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const data = await apiCall(url);
    const tickets = Array.isArray(data) ? data : (data.results || []);
    state.admin.tickets = tickets;
    renderAdminTickets(tickets);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderAdminTickets(tickets) {
  const tbody = document.getElementById('adm-tickets-tbody');
  tbody.innerHTML = '';

  if (tickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--mute);">No tickets found for the selected filter.</td></tr>`;
    return;
  }

  tickets.forEach(tkt => {
    const dateStr = tkt.updated_at ? new Date(tkt.updated_at).toLocaleString() : 'N/A';
    tbody.innerHTML += `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--text);">${tkt.user_email}</div>
          <div style="font-size:11px; color:var(--mute);">@${tkt.user_username || 'user'}</div>
        </td>
        <td><b style="color:var(--text);">${tkt.subject}</b></td>
        <td><span class="badge badge-approved" style="font-size:10px;">${tkt.category}</span></td>
        <td style="font-family:var(--font-mono); font-weight:600;">${tkt.replies_count || 0} msgs</td>
        <td><span class="badge badge-${(tkt.status || 'open').toLowerCase().replace('_', '-')}">${tkt.status}</span></td>
        <td style="font-size:12px; color:var(--mute);">${dateStr}</td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-primary" onclick="openAdminTicketModal('${tkt.id}')">Open Thread</button>
        </td>
      </tr>
    `;
  });
}

// ─── 6. Admin Platform Settings & Plans ───
async function loadAdminSettings() {
  try {
    const [settingsData, plansData] = await Promise.all([
      apiCall('/admin-panel/settings/'),
      apiCall('/admin-panel/plans/'),
    ]);

    const settings = Array.isArray(settingsData) ? settingsData : (settingsData.results || []);
    const plans = Array.isArray(plansData) ? plansData : (plansData.results || []);

    state.admin.settings = settings;
    state.admin.plans = plans;

    renderAdminSettings(settings);
    renderAdminPlans(plans);
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderAdminSettings(settings) {
  // Populate Dedicated Company Wallets & QR Card
  const bep20Setting = settings.find(s => s.key === 'COMPANY_WALLET_BEP20');
  const trc20Setting = settings.find(s => s.key === 'COMPANY_WALLET_TRC20');
  const bep20QrSetting = settings.find(s => s.key === 'COMPANY_WALLET_BEP20_QR');
  const trc20QrSetting = settings.find(s => s.key === 'COMPANY_WALLET_TRC20_QR');

  const bep20Input = document.getElementById('adm-wallet-bep20');
  const trc20Input = document.getElementById('adm-wallet-trc20');
  const bep20QrInput = document.getElementById('adm-wallet-bep20-qr');
  const trc20QrInput = document.getElementById('adm-wallet-trc20-qr');

  if (bep20Input && bep20Setting) bep20Input.value = bep20Setting.value;
  if (trc20Input && trc20Setting) trc20Input.value = trc20Setting.value;
  if (bep20QrInput && bep20QrSetting) bep20QrInput.value = bep20QrSetting.value;
  if (trc20QrInput && trc20QrSetting) trc20QrInput.value = trc20QrSetting.value;

  updateAdminQRPreview('BEP20');
  updateAdminQRPreview('TRC20');

  const tbody = document.getElementById('adm-settings-tbody');
  tbody.innerHTML = '';

  if (settings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--mute);">No platform settings configured.</td></tr>`;
    return;
  }

  settings.forEach(s => {
    tbody.innerHTML += `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:600; color:var(--gold); font-size:12px;">${s.key}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--gold);">${s.value}</td>
        <td style="font-size:12px; color:var(--mute);">${s.description || '—'}</td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-secondary" onclick="openEditSettingModal('${s.key}', '${s.value}', '${(s.description || '').replace(/'/g, "\\'")}')">Edit</button>
        </td>
      </tr>
    `;
  });
}

function renderAdminPlans(plans) {
  const tbody = document.getElementById('adm-plans-tbody');
  tbody.innerHTML = '';

  if (plans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mute);">No investment tiers created.</td></tr>`;
    return;
  }

  plans.forEach(p => {
    const cost = Number(p.cost || p.minimum_amount || 0);
    const tradingCap = Number(p.trading_capital || cost);
    const factor = Number(p.max_return_factor || 3);
    const maxRet = Number(p.max_total_return || (tradingCap * factor));

    tbody.innerHTML += `
      <tr>
        <td><b style="color:var(--text);">${p.name}</b></td>
        <td style="font-family:var(--font-mono); font-weight:700; color:#fff;">$${cost.toFixed(2)}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:#10B981;">$${tradingCap.toFixed(2)}</td>
        <td style="font-family:var(--font-mono); color:var(--gold); font-weight:700;">$${maxRet.toFixed(2)} (${factor}X)</td>
        <td style="font-family:var(--font-mono);">${Number(p.weekly_roi_rate).toFixed(2)}% / wk</td>
        <td><span class="badge ${p.is_active ? 'badge-approved' : 'badge-pending'}">${p.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-sm btn-secondary" onclick="openPlanModal('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" style="margin-left: 6px;" onclick="handleAdminDeletePlan('${p.id}', '${(p.name || '').replace(/'/g, "\\'")}')" title="Delete Plan">Delete</button>
        </td>
      </tr>
    `;
  });
}

// ─── ADMIN ACTION HANDLERS & MODALS ───

// Image Lightbox Viewer
function openLightbox(src) {
  if (!src) return;
  const img = document.getElementById('adm-lightbox-img');
  if (img) img.src = src;
  openModal('modal-admin-lightbox');
}

// Deposit Proof & Investment Full Dossier Modal
async function openProofModal(invId) {
  let inv = null;
  try {
    inv = await apiCall(`/admin-panel/investments/${invId}/`);
  } catch (e) {
    inv = (state.admin.investments || []).find(i => i.id === invId) || (state.admin.overview?.queues.pending_investments || []).find(i => i.id === invId);
  }
  if (!inv) return;

  // Header & Status
  document.getElementById('adm-proof-inv-id').value = inv.id;
  document.getElementById('adm-proof-inv-id-label').innerText = `Record ID: #${inv.id}`;

  const isPending = inv.status === 'DEPOSIT_PENDING' || inv.status === 'PENDING';
  const statusBadge = document.getElementById('adm-proof-status-badge');
  statusBadge.innerText = inv.status.replace('_', ' ');
  statusBadge.className = `badge badge-${inv.status.toLowerCase().replace('_', '-')}`;

  // Media & Proof Image
  const img = document.getElementById('adm-proof-img');
  const placeholder = document.getElementById('adm-proof-placeholder');
  const mediaActions = document.getElementById('adm-proof-media-actions');
  const fullLink = document.getElementById('adm-proof-link-full');

  if (inv.deposit_proof_url) {
    img.src = inv.deposit_proof_url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    if (mediaActions) mediaActions.style.display = 'flex';
    if (fullLink) fullLink.href = inv.deposit_proof_url;
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
    if (mediaActions) mediaActions.style.display = 'none';
  }

  // Blockchain On-Chain Details
  const net = inv.deposit_network || 'BEP20';
  document.getElementById('adm-proof-network-pill').innerText = net;
  document.getElementById('adm-proof-txhash').value = inv.deposit_txn_hash || 'No hash submitted';
  document.getElementById('adm-proof-sender').value = inv.deposit_sender_address || 'Not specified';

  const explorerBtn = document.getElementById('adm-proof-explorer-btn');
  if (inv.explorer_url || inv.deposit_txn_hash) {
    const explorerUrl = inv.explorer_url || (net === 'TRC20' ? `https://tronscan.org/#/transaction/${inv.deposit_txn_hash}` : `https://bscscan.com/tx/${inv.deposit_txn_hash}`);
    explorerBtn.href = explorerUrl;
    explorerBtn.style.display = 'inline-flex';
  } else {
    explorerBtn.style.display = 'none';
  }

  // Investor Dossier
  document.getElementById('adm-proof-investor-name').innerText = `${inv.user_full_name ? inv.user_full_name + ' • ' : ''}${inv.user_email}`;
  document.getElementById('adm-proof-investor-id').innerText = `@${inv.user_username || 'user'} • UID: ${inv.user_id || 'N/A'}`;
  document.getElementById('adm-proof-sponsor').innerText = inv.user_parent_email || 'Root / Direct (No Sponsor)';
  document.getElementById('adm-proof-user-level').innerText = `Level ${inv.user_active_level || 0} Sponsor`;

  // Plan & Financial Progress
  document.getElementById('adm-proof-plan-name').innerText = `${inv.plan_name} (${inv.plan_duration_weeks || 120} Wks)`;
  document.getElementById('adm-proof-plan-roi').innerText = `${Number(inv.plan_weekly_roi_rate || 3.5).toFixed(2)}% / week`;
  document.getElementById('adm-proof-amount').innerText = `$${Number(inv.amount).toFixed(2)}`;
  document.getElementById('adm-proof-max-return').innerText = `$${Number(inv.max_return).toFixed(2)}`;
  document.getElementById('adm-proof-credited').innerText = `$${Number(inv.total_credited || 0).toFixed(2)}`;

  const remaining = inv.remaining_return !== undefined ? Number(inv.remaining_return) : Math.max(0, Number(inv.max_return) - Number(inv.total_credited || 0));
  document.getElementById('adm-proof-remaining').innerText = `$${remaining.toFixed(2)}`;

  const pct = inv.progress_percent !== undefined ? inv.progress_percent : (inv.max_return > 0 ? Math.min(100, Math.round((Number(inv.total_credited || 0) / Number(inv.max_return)) * 100)) : 0);
  document.getElementById('adm-proof-progress-pct').innerText = `${pct}%`;
  document.getElementById('adm-proof-progress-bar').style.width = `${pct}%`;

  // Timeline & Audit
  const submitDate = inv.deposit_submitted_at || inv.created_at;
  document.getElementById('adm-proof-time-submitted').innerText = submitDate ? new Date(submitDate).toLocaleString() : 'N/A';
  document.getElementById('adm-proof-time-approved').innerText = inv.approved_at ? new Date(inv.approved_at).toLocaleString() : (isPending ? 'Pending Admin Action' : 'N/A');
  document.getElementById('adm-proof-admin-reviewer').innerText = inv.approved_by_email || (isPending ? 'Awaiting Review' : 'System');

  const rejRow = document.getElementById('adm-proof-rejection-row');
  if (inv.rejection_reason) {
    rejRow.style.display = 'block';
    document.getElementById('adm-proof-rejection-reason').innerText = inv.rejection_reason;
  } else {
    rejRow.style.display = 'none';
  }

  // Action Buttons
  const btnApprove = document.getElementById('adm-proof-btn-approve');
  const btnReject = document.getElementById('adm-proof-btn-reject');
  if (btnApprove) btnApprove.style.display = isPending ? 'inline-flex' : 'none';
  if (btnReject) btnReject.style.display = isPending ? 'inline-flex' : 'none';

  openModal('modal-admin-proof');
}

// Withdrawal Full Payout Inspector Modal
async function openWithdrawalDetailModal(wdrId) {
  let wdr = null;
  try {
    wdr = await apiCall(`/admin-panel/withdrawals/${wdrId}/`);
  } catch (e) {
    wdr = (state.admin.withdrawals || []).find(w => w.id === wdrId) || (state.admin.overview?.queues.pending_withdrawals || []).find(w => w.id === wdrId);
  }
  if (!wdr) return;

  const isPending = wdr.status === 'PENDING';
  document.getElementById('adm-wdr-detail-id').value = wdr.id;
  document.getElementById('adm-wdr-id-label').innerText = `Payout Request: #${wdr.id}`;

  const statusBadge = document.getElementById('adm-wdr-status-badge');
  statusBadge.innerText = wdr.status;
  statusBadge.className = `badge badge-${wdr.status.toLowerCase().replace('_', '-')}`;

  // Financial Banner
  document.getElementById('adm-wdr-net-display').innerText = `$${Number(wdr.net_amount).toFixed(2)}`;
  document.getElementById('adm-wdr-gross-display').innerText = `$${Number(wdr.amount).toFixed(2)}`;
  document.getElementById('adm-wdr-fee-display').innerText = `$${Number(wdr.fee).toFixed(2)}`;
  document.getElementById('adm-wdr-charge-display').innerText = `$${Number(wdr.capital_charge || (wdr.withdrawal_type === 'CAPITAL' ? 10 : 0)).toFixed(2)}`;

  const typeBadge = document.getElementById('adm-wdr-type-badge');
  typeBadge.innerText = `${wdr.withdrawal_type} WITHDRAWAL`;
  typeBadge.className = `badge ${wdr.withdrawal_type === 'CAPITAL' ? 'badge-pending' : 'badge-approved'}`;

  // User Profile
  document.getElementById('adm-wdr-user-email').innerText = wdr.user_email;
  document.getElementById('adm-wdr-user-name').innerText = wdr.user_full_name || 'N/A';
  document.getElementById('adm-wdr-user-username').innerText = `@${wdr.user_username || 'user'} • UID: ${wdr.user_id || 'N/A'}`;
  document.getElementById('adm-wdr-user-balance').innerText = `$${Number(wdr.user_wallet_balance || 0).toFixed(2)}`;

  // Destination & On-Chain Address
  const net = wdr.network || 'BEP20';
  document.getElementById('adm-wdr-network-badge').innerText = net;
  document.getElementById('adm-wdr-address-input').value = wdr.wallet_address || 'No address specified';

  const explorerBtn = document.getElementById('adm-wdr-address-explorer-btn');
  if (wdr.wallet_address) {
    const explorerUrl = net === 'TRC20' ? `https://tronscan.org/#/address/${wdr.wallet_address}` : `https://bscscan.com/address/${wdr.wallet_address}`;
    explorerBtn.href = explorerUrl;
    explorerBtn.style.display = 'inline-flex';
  } else {
    explorerBtn.style.display = 'none';
  }

  // Timeline & Audit
  document.getElementById('adm-wdr-time-requested').innerText = wdr.created_at ? new Date(wdr.created_at).toLocaleString() : 'N/A';
  document.getElementById('adm-wdr-time-reviewed').innerText = wdr.reviewed_at ? new Date(wdr.reviewed_at).toLocaleString() : (isPending ? 'Pending Admin Action' : 'N/A');
  document.getElementById('adm-wdr-reviewer').innerText = wdr.reviewed_by_email || (isPending ? 'Awaiting Review' : 'System');

  // TxHash Row
  const txRow = document.getElementById('adm-wdr-txhash-row');
  if (wdr.txn_hash) {
    txRow.style.display = 'block';
    document.getElementById('adm-wdr-txhash-input').value = wdr.txn_hash;
  } else {
    txRow.style.display = 'none';
  }

  // Notes / Rejection Row
  const notesRow = document.getElementById('adm-wdr-notes-row');
  const noteText = wdr.notes || wdr.rejection_reason;
  if (noteText) {
    notesRow.style.display = 'block';
    document.getElementById('adm-wdr-notes').innerText = noteText;
  } else {
    notesRow.style.display = 'none';
  }

  // Action Buttons
  const btnApprove = document.getElementById('adm-wdr-btn-approve');
  const btnReject = document.getElementById('adm-wdr-btn-reject');
  if (btnApprove) btnApprove.style.display = isPending ? 'inline-flex' : 'none';
  if (btnReject) btnReject.style.display = isPending ? 'inline-flex' : 'none';

  openModal('modal-admin-wdr-detail');
}

// Approve Investment
async function submitApproveInvestment(invId) {
  if (!confirm('Are you sure you want to approve this deposit and activate the investment plan? This will credit the investment and distribute upline commissions.')) {
    return;
  }

  try {
    const res = await apiCall(`/admin-panel/investments/${invId}/approve/`, 'POST', {});
    showToast(res.detail || 'Investment approved and activated!');
    closeModal('modal-admin-proof');
    await Promise.all([loadAdminData(), loadAdminInvestments()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

// Reject Investment
function openRejectInvestmentModal(invId) {
  document.getElementById('adm-reject-inv-id').value = invId;
  document.getElementById('adm-reject-inv-reason').value = '';
  closeModal('modal-admin-proof');
  openModal('modal-admin-reject-inv');
}

async function handleRejectInvestmentSubmit(e) {
  e.preventDefault();
  const invId = document.getElementById('adm-reject-inv-id').value;
  const reason = document.getElementById('adm-reject-inv-reason').value;

  try {
    const res = await apiCall(`/admin-panel/investments/${invId}/reject/`, 'POST', { reason });
    showToast(res.detail || 'Investment deposit marked as rejected.');
    closeModal('modal-admin-reject-inv');
    await Promise.all([loadAdminData(), loadAdminInvestments()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

// Approve Withdrawal
async function submitApproveWithdrawal(wdrId) {
  const txnHash = prompt('Enter payment transaction hash (TxID) for this payout (optional):', '') || '';

  try {
    const res = await apiCall(`/admin-panel/withdrawals/${wdrId}/approve/`, 'POST', { txn_hash: txnHash });
    showToast(res.detail || 'Withdrawal marked approved and debited.');
    await Promise.all([loadAdminData(), loadAdminWithdrawals()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

// Reject Withdrawal
function openRejectWithdrawalModal(wdrId) {
  document.getElementById('adm-reject-wdr-id').value = wdrId;
  document.getElementById('adm-reject-wdr-reason').value = '';
  openModal('modal-admin-reject-wdr');
}

async function handleRejectWithdrawalSubmit(e) {
  e.preventDefault();
  const wdrId = document.getElementById('adm-reject-wdr-id').value;
  const reason = document.getElementById('adm-reject-wdr-reason').value;

  try {
    const res = await apiCall(`/admin-panel/withdrawals/${wdrId}/reject/`, 'POST', { reason });
    showToast(res.detail || 'Withdrawal request rejected.');
    closeModal('modal-admin-reject-wdr');
    await Promise.all([loadAdminData(), loadAdminWithdrawals()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

// Manage User
async function openManageUserModal(userId) {
  try {
    const u = await apiCall(`/admin-panel/users/${userId}/`);
    document.getElementById('adm-usr-id').value = u.id;
    document.getElementById('adm-usr-modal-name').innerText = `Manage ${u.full_name || u.email}`;
    document.getElementById('adm-usr-modal-email').innerText = `${u.email} • Level ${u.active_level} Sponsor`;
    document.getElementById('adm-usr-role').value = u.role || 'USER';
    document.getElementById('adm-usr-kyc').value = u.kyc_status || 'UNVERIFIED';
    document.getElementById('adm-usr-verified').checked = !!u.is_email_verified;
    document.getElementById('adm-usr-active').checked = u.is_active !== false;
    document.getElementById('adm-usr-curr-balance').innerText = `$${Number(u.wallet_balance || 0).toFixed(2)}`;
    document.getElementById('adm-adj-amount').value = '';
    document.getElementById('adm-adj-reason').value = '';

    // Populate KYC Document review box
    const docBox = document.getElementById('adm-usr-kyc-doc-box');
    if (docBox) {
      if (u.kyc_document_front_url || u.kyc_document_back_url) {
        docBox.style.display = 'block';
        const docImgWrap = document.getElementById('adm-usr-kyc-img-wrap');
        if (docImgWrap) {
          docImgWrap.innerHTML = '';
          if (u.kyc_document_front_url) {
            docImgWrap.innerHTML += `<img src="${u.kyc_document_front_url}" alt="KYC Front" style="width: 100%; height: 100%; object-fit: cover; margin-bottom: 4px;" onclick="openLightbox('${u.kyc_document_front_url}')">`;
          }
          if (u.kyc_document_back_url) {
            docImgWrap.innerHTML += `<img src="${u.kyc_document_back_url}" alt="KYC Back" style="width: 100%; height: 100%; object-fit: cover;" onclick="openLightbox('${u.kyc_document_back_url}')">`;
          }
        }
        document.getElementById('adm-usr-kyc-doctype').innerText = u.kyc_document_type || 'Government ID';
        document.getElementById('adm-usr-kyc-docnum').innerText = u.kyc_document_number || '—';
        const docLink = document.getElementById('adm-usr-kyc-doclink');
        if (docLink) docLink.href = u.kyc_document_front_url || u.kyc_document_back_url || '#';
      } else {
        docBox.style.display = 'none';
      }
    }

    openModal('modal-admin-manage-user');
  } catch (err) {
    showToast(err.message, true);
  }
}

// 5-Level Team Details Modal for Admin
async function openAdminUserTeamModal(userId) {
  try {
    const data = await apiCall(`/admin-panel/users/${userId}/team/`);
    const u = data.user;
    const summary = data.summary;
    const levels = data.levels || [];

    document.getElementById('adm-team-modal-name').innerText = `Team Network: ${u.full_name || u.email}`;
    document.getElementById('adm-team-modal-sub').innerText = `${u.email} • Ref Code: ${u.referral_code || 'N/A'} • Direct Rank: Lvl ${u.active_level || 0} • ROI Rank: Lvl ${u.active_roi_level || 0}`;

    document.getElementById('adm-team-stat-members').innerText = summary.total_team_members;
    document.getElementById('adm-team-stat-investment').innerText = `$${Number(summary.total_team_investment || 0).toFixed(2)}`;
    document.getElementById('adm-team-stat-direct').innerText = `$${Number(summary.total_direct_income || 0).toFixed(2)}`;
    document.getElementById('adm-team-stat-roi').innerText = `$${Number(summary.total_referral_roi_income || 0).toFixed(2)}`;

    const tbody = document.getElementById('adm-team-levels-tbody');
    tbody.innerHTML = '';

    levels.forEach(lvl => {
      tbody.innerHTML += `
        <tr>
          <td><span class="badge badge-approved" style="font-size:11px;">Level ${lvl.level}</span></td>
          <td style="font-family:var(--font-mono); font-weight:700; color:var(--text);">${lvl.total_refers}</td>
          <td style="font-family:var(--font-mono); font-weight:600; color:var(--gold);">$${Number(lvl.total_investment || 0).toFixed(2)}</td>
          <td style="font-family:var(--font-mono); color:var(--accent);">$${Number(lvl.direct_income || 0).toFixed(2)}</td>
          <td style="font-family:var(--font-mono); color:var(--text);">$${Number(lvl.roi_income || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    openModal('modal-admin-user-team');
  } catch (err) {
    showToast(err.message || 'Failed to load team data', true);
  }
}

async function adminQuickKYCStatus(status) {
  const userId = document.getElementById('adm-usr-id').value;
  if (!userId) return;
  try {
    await apiCall(`/admin-panel/users/${userId}/`, 'PATCH', { kyc_status: status });
    document.getElementById('adm-usr-kyc').value = status;
    showToast(`KYC status updated to ${status}.`);
    loadAdminUsers();
    loadAdminData();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleUpdateUserSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('adm-usr-id').value;
  const role = document.getElementById('adm-usr-role').value;
  const kyc_status = document.getElementById('adm-usr-kyc').value;
  const is_email_verified = document.getElementById('adm-usr-verified').checked;
  const is_active = document.getElementById('adm-usr-active').checked;

  try {
    await apiCall(`/admin-panel/users/${userId}/`, 'PATCH', {
      role,
      kyc_status,
      is_email_verified,
      is_active,
    });
    showToast('User profile updated successfully.');
    loadAdminUsers();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleAdjustBalanceSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('adm-usr-id').value;
  const action = document.getElementById('adm-adj-action').value;
  const amount = Number(document.getElementById('adm-adj-amount').value);
  const reason = document.getElementById('adm-adj-reason').value;

  try {
    const res = await apiCall(`/admin-panel/users/${userId}/adjust-balance/`, 'POST', { action, amount, reason });
    showToast(res.detail || 'Balance adjusted successfully.');
    document.getElementById('adm-usr-curr-balance').innerText = `$${Number(res.balance_after).toFixed(2)}`;
    document.getElementById('adm-adj-amount').value = '';
    document.getElementById('adm-adj-reason').value = '';
    loadAdminUsers();
    loadAdminData();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Support Ticket Thread Modal
async function openAdminTicketModal(ticketId) {
  try {
    const tkt = await apiCall(`/admin-panel/tickets/${ticketId}/`);
    document.getElementById('adm-thread-ticket-id').value = tkt.id;
    document.getElementById('adm-thread-ticket-subject').innerText = tkt.subject;
    document.getElementById('adm-thread-ticket-user').innerText = `From: ${tkt.user_email}`;
    document.getElementById('adm-thread-ticket-status').innerText = tkt.status;
    document.getElementById('adm-thread-ticket-status').className = `badge badge-${tkt.status.toLowerCase().replace('_', '-')}`;
    document.getElementById('adm-thread-ticket-date').innerText = new Date(tkt.created_at).toLocaleString();
    document.getElementById('adm-thread-new-status').value = tkt.status;
    document.getElementById('adm-thread-reply-message').value = '';

    const list = document.getElementById('adm-thread-messages-list');
    list.innerHTML = '';

    (tkt.replies || []).forEach(r => {
      const isStaff = r.is_staff;
      const bubbleClass = isStaff ? 'thread-msg-staff' : 'thread-msg-user';
      const senderName = isStaff ? 'Staff Support' : (r.user_full_name || r.user_email);
      const dateStr = new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      list.innerHTML += `
        <div class="thread-msg-bubble ${bubbleClass}">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px; color:var(--mute);">
            <b>${senderName} ${isStaff ? '👑' : ''}</b>
            <span>${dateStr}</span>
          </div>
          <div style="color:var(--text);">${r.message}</div>
        </div>
      `;
    });

    openModal('modal-admin-ticket-thread');
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 100);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleAdminSendReply(e) {
  e.preventDefault();
  const ticketId = document.getElementById('adm-thread-ticket-id').value;
  const message = document.getElementById('adm-thread-reply-message').value;
  const newStatus = document.getElementById('adm-thread-new-status').value;

  try {
    const res = await apiCall(`/admin-panel/tickets/${ticketId}/reply/`, 'POST', { message, status: newStatus });
    showToast('Staff reply sent.');
    document.getElementById('adm-thread-reply-message').value = '';
    openAdminTicketModal(ticketId);
    loadAdminTickets();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Edit Platform Setting
function openEditSettingModal(key, value, description) {
  document.getElementById('adm-setting-key').value = key;
  document.getElementById('adm-setting-key-disp').value = key;
  document.getElementById('adm-setting-value').value = value;
  document.getElementById('adm-setting-desc').innerText = description || 'Configure platform business rule.';
  openModal('modal-admin-edit-setting');
}

async function handleAdminSaveSetting(e) {
  e.preventDefault();
  const key = document.getElementById('adm-setting-key').value;
  const value = document.getElementById('adm-setting-value').value;

  try {
    const res = await apiCall(`/admin-panel/settings/${encodeURIComponent(key)}/`, 'PATCH', { value });
    showToast(res.detail || 'Setting updated successfully.');
    closeModal('modal-admin-edit-setting');
    loadAdminSettings();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Create / Edit Plan Modal
function openPlanModal(planId = null) {
  const plan = planId ? (state.admin.plans || []).find(p => p.id === planId) : null;

  document.getElementById('adm-plan-id').value = plan ? plan.id : '';
  document.getElementById('adm-plan-modal-title').innerText = plan ? `Edit ${plan.name}` : 'Create Investment Plan';
  document.getElementById('adm-plan-name').value = plan ? plan.name : '';
  document.getElementById('adm-plan-desc').value = plan ? (plan.description || '') : '';
  document.getElementById('adm-plan-cost').value = plan ? (plan.cost || plan.minimum_amount || '120') : '120';
  document.getElementById('adm-plan-trading-cap').value = plan ? (plan.trading_capital || '120') : '120';
  document.getElementById('adm-plan-factor').value = plan ? (plan.max_return_factor || '3.0') : '3.0';
  document.getElementById('adm-plan-max-return').value = plan ? (plan.max_total_return || '350') : '350';
  document.getElementById('adm-plan-roi').value = plan ? plan.weekly_roi_rate : '3.00';
  document.getElementById('adm-plan-duration').value = plan ? (plan.duration_weeks || '0') : '0';
  document.getElementById('adm-plan-active').checked = plan ? plan.is_active : true;

  const delBtn = document.getElementById('btn-adm-delete-plan');
  if (delBtn) {
    delBtn.style.display = plan ? 'inline-flex' : 'none';
  }

  openModal('modal-admin-plan');
}

async function handleAdminModalDeletePlan() {
  const planId = document.getElementById('adm-plan-id').value;
  const name = document.getElementById('adm-plan-name').value || 'Plan';
  if (!planId) return;
  const success = await handleAdminDeletePlan(planId, name);
  if (success) {
    closeModal('modal-admin-plan');
  }
}

async function handleAdminDeletePlan(planId, planName) {
  if (!confirm(`Are you sure you want to delete "${planName}"? This action cannot be undone.`)) {
    return false;
  }
  try {
    const res = await apiCall(`/admin-panel/plans/${planId}/`, 'DELETE');
    showToast(res?.detail || `Plan "${planName}" deleted successfully.`);
    await loadAdminSettings();
    return true;
  } catch (err) {
    showToast(err.message || 'Failed to delete plan', true);
    return false;
  }
}

async function handleAdminSavePlan(e) {
  e.preventDefault();
  const planId = document.getElementById('adm-plan-id').value;
  const name = document.getElementById('adm-plan-name').value;
  const description = document.getElementById('adm-plan-desc').value;
  const cost = Number(document.getElementById('adm-plan-cost').value);
  const trading_capital = Number(document.getElementById('adm-plan-trading-cap').value);
  const max_return_factor = Number(document.getElementById('adm-plan-factor').value);
  const max_total_return = Number(document.getElementById('adm-plan-max-return').value);
  const weekly_roi_rate = Number(document.getElementById('adm-plan-roi').value || 0);
  const duration_weeks = Number(document.getElementById('adm-plan-duration').value || 0);
  const is_active = document.getElementById('adm-plan-active').checked;

  const payload = {
    name,
    description,
    cost,
    trading_capital,
    max_return_factor,
    max_total_return,
    weekly_roi_rate,
    duration_weeks,
    is_active,
  };

  try {
    if (planId) {
      await apiCall(`/admin-panel/plans/${planId}/`, 'PATCH', payload);
      showToast('Plan tier updated.');
    } else {
      await apiCall('/admin-panel/plans/', 'POST', payload);
      showToast('New investment plan created.');
    }
    closeModal('modal-admin-plan');
    loadAdminSettings();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Trigger ROI Distribution Modal & Engine
function openTriggerROIModal(mode = 'full_week') {
  const isFullWeek = mode === 'full_week';
  const modeInput = document.getElementById('adm-roi-mode');
  if (modeInput) modeInput.value = isFullWeek ? 'full_week' : 'by_day';

  const titleEl = document.getElementById('adm-roi-modal-title');
  if (titleEl) {
    titleEl.innerText = isFullWeek ? 'Trigger ROI (Full Week)' : 'Trigger ROI (By Day Prorated)';
  }

  const badgeEl = document.getElementById('adm-roi-mode-badge-text');
  if (badgeEl) {
    badgeEl.innerText = isFullWeek ? 'Full Week Mode (100% Weekly Rate)' : 'Daily Mode (Prorated Mon–Fri)';
    badgeEl.className = `badge ${isFullWeek ? 'badge-approved' : 'badge-pending'}`;
  }

  const descEl = document.getElementById('adm-roi-modal-desc');
  if (descEl) {
    descEl.innerHTML = isFullWeek
      ? 'This will execute <b>1 Full Week ROI (100% of weekly rate)</b> for all active investments regardless of start date or elapsed days:'
      : 'This will execute <b>Daily Prorated ROI (weekly rate ÷ 5 per weekday)</b> based on elapsed weekdays (Mon–Fri) since plan start or last ROI date:';
  }

  const bulletsEl = document.getElementById('adm-roi-modal-bullets');
  if (bulletsEl) {
    bulletsEl.innerHTML = isFullWeek
      ? `
        <li>Credits full 100% weekly ROI return directly to each investor's spendable wallet balance</li>
        <li>Ignores weekday counts — triggers immediate full weekly cycle for all active plans</li>
        <li>Fills up investor plans toward their maximum return cap</li>
        <li>Distributes 75% ROI commissions across 5 sponsor levels to upline oldest active plans</li>
        <li>Completes plans that reach their maximum return</li>
      `
      : `
        <li>Calculates profit days (Monday to Friday) between last ROI date / start date and today</li>
        <li>Credits (Weekly Rate ÷ 5 × profit days) to each investor's spendable wallet balance</li>
        <li>Fills up investor plans toward their maximum return cap</li>
        <li>Distributes 75% ROI commissions across 5 sponsor levels to upline oldest active plans</li>
        <li>Completes plans that reach their maximum return</li>
      `;
  }

  openModal('modal-admin-trigger-roi');
}

async function submitTriggerROIEngine() {
  const mode = document.getElementById('adm-roi-mode')?.value || 'full_week';
  const btn = document.getElementById('adm-roi-modal-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Executing ROI Engine…';
  }

  try {
    const res = await apiCall('/admin-panel/actions/trigger-roi/', 'POST', { mode });
    showToast(`${res.detail || 'ROI Run Complete'}: ${res.investments_processed} investment(s) processed. Total $${Number(res.total_roi_distributed).toFixed(2)} distributed.`);
    closeModal('modal-admin-trigger-roi');
    await loadAdminData();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Execute Distribution Now';
    }
  }
}

// Admin Deposit Wallets & QR Code Management
function updateAdminQRPreview(network) {
  const isBep = network === 'BEP20';
  const addrInput = document.getElementById(isBep ? 'adm-wallet-bep20' : 'adm-wallet-trc20');
  const qrInput = document.getElementById(isBep ? 'adm-wallet-bep20-qr' : 'adm-wallet-trc20-qr');
  const qrImg = document.getElementById(isBep ? 'adm-bep20-qr-img' : 'adm-trc20-qr-img');
  const statusEl = document.getElementById(isBep ? 'adm-bep20-qr-status' : 'adm-trc20-qr-status');

  const addr = (addrInput?.value || '').trim();
  const customQr = (qrInput?.value || '').trim();

  if (qrImg) {
    qrImg.src = getQRUrl(addr, customQr);
  }

  if (statusEl) {
    if (customQr) {
      statusEl.innerText = 'Custom Uploaded ✓';
      statusEl.style.color = 'var(--gold)';
    } else {
      statusEl.innerText = 'Auto-Generated';
      statusEl.style.color = 'var(--gold-soft)';
    }
  }
}

function handleAdminQRUpload(event, network) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file for the QR code.', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const isBep = network === 'BEP20';
    const qrInput = document.getElementById(isBep ? 'adm-wallet-bep20-qr' : 'adm-wallet-trc20-qr');
    if (qrInput) qrInput.value = dataUrl;
    updateAdminQRPreview(network);
    showToast(`Custom ${network} QR code loaded. Click "Save Company Deposit Wallets & QR Codes" to apply.`);
  };
  reader.readAsDataURL(file);
}

function resetAdminQR(network) {
  const isBep = network === 'BEP20';
  const qrInput = document.getElementById(isBep ? 'adm-wallet-bep20-qr' : 'adm-wallet-trc20-qr');
  if (qrInput) qrInput.value = '';
  updateAdminQRPreview(network);
  showToast(`Reset ${network} to auto-generated QR code.`);
}

// Save Company Deposit Wallets & QR Codes
async function handleAdminSaveCompanyWallets(e) {
  e.preventDefault();
  const bep20 = (document.getElementById('adm-wallet-bep20')?.value || '').trim();
  const trc20 = (document.getElementById('adm-wallet-trc20')?.value || '').trim();
  const bep20Qr = (document.getElementById('adm-wallet-bep20-qr')?.value || '').trim();
  const trc20Qr = (document.getElementById('adm-wallet-trc20-qr')?.value || '').trim();
  const btn = document.getElementById('adm-save-wallets-btn');

  if (!bep20 || !trc20) {
    showToast('Please enter both BEP20 and TRC20 company deposit addresses.', true);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Saving Wallets & QR Codes…';
  }

  try {
    await Promise.all([
      apiCall('/admin-panel/settings/COMPANY_WALLET_BEP20/', 'PATCH', { value: bep20 }),
      apiCall('/admin-panel/settings/COMPANY_WALLET_TRC20/', 'PATCH', { value: trc20 }),
      apiCall('/admin-panel/settings/COMPANY_WALLET_BEP20_QR/', 'PATCH', { value: bep20Qr }),
      apiCall('/admin-panel/settings/COMPANY_WALLET_TRC20_QR/', 'PATCH', { value: trc20Qr }),
    ]);

    state.depositWallets = {
      BEP20: bep20,
      TRC20: trc20,
      BEP20_QR: bep20Qr,
      TRC20_QR: trc20Qr,
    };

    showToast('Company deposit wallets & QR codes updated successfully.');
    await loadAdminSettings();
  } catch (err) {
    showToast(err.message || 'Failed to update company wallets.', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Company Deposit Wallets &amp; QR Codes`;
    }
  }
}

// ─── KYC Identity Verification Page Logic ────────────────────────
function renderKYCView() {
  if (!state.user) return;
  const kycStatus = state.user.kyc_status || 'UNVERIFIED';

  const badgeEl = document.getElementById('kyc-header-badge');
  if (badgeEl) {
    if (kycStatus === 'APPROVED') {
      badgeEl.className = 'badge badge-approved';
      badgeEl.innerText = 'KYC VERIFIED';
    } else if (kycStatus === 'PENDING') {
      badgeEl.className = 'badge badge-pending';
      badgeEl.innerText = 'UNDER REVIEW';
    } else if (kycStatus === 'REJECTED') {
      badgeEl.className = 'badge badge-rejected';
      badgeEl.innerText = 'REJECTED';
    } else {
      badgeEl.className = 'badge badge-unverified';
      badgeEl.innerText = 'UNVERIFIED';
    }
  }

  const appView = document.getElementById('kyc-view-approved');
  const pendView = document.getElementById('kyc-view-pending');
  const unverView = document.getElementById('kyc-view-unverified');

  if (appView) appView.style.display = 'none';
  if (pendView) pendView.style.display = 'none';
  if (unverView) unverView.style.display = 'none';

  if (kycStatus === 'APPROVED') {
    if (appView) appView.style.display = 'block';
    const docTypeEl = document.getElementById('kyc-appr-doctype');
    const docNumEl = document.getElementById('kyc-appr-docnum');
    const countryEl = document.getElementById('kyc-appr-country');

    const typeLabels = {
      PASSPORT: 'Passport',
      NATIONAL_ID: 'National ID Card',
      DRIVERS_LICENSE: 'Driver\'s License',
      RESIDENCE_PERMIT: 'Residence Permit',
    };

    if (docTypeEl) docTypeEl.innerText = typeLabels[state.user.kyc_document_type] || state.user.kyc_document_type || 'Passport / National ID';
    if (docNumEl) {
      const num = state.user.kyc_document_number || '';
      docNumEl.innerText = num.length > 4 ? `•••• •••• ${num.slice(-4)}` : (num || 'Verified');
    }
    if (countryEl) countryEl.innerText = state.user.country || 'Verified Country';
  } else if (kycStatus === 'PENDING') {
    if (pendView) pendView.style.display = 'block';
    const docTypeEl = document.getElementById('kyc-pend-doctype');
    const docNumEl = document.getElementById('kyc-pend-docnum');
    const dateEl = document.getElementById('kyc-pend-date');

    const typeLabels = {
      PASSPORT: 'Passport',
      NATIONAL_ID: 'National ID Card',
      DRIVERS_LICENSE: 'Driver\'s License',
      RESIDENCE_PERMIT: 'Residence Permit',
    };

    if (docTypeEl) docTypeEl.innerText = typeLabels[state.user.kyc_document_type] || state.user.kyc_document_type || 'Government ID';
    if (docNumEl) docNumEl.innerText = state.user.kyc_document_number || '—';
    if (dateEl) {
      dateEl.innerText = state.user.kyc_submitted_at
        ? new Date(state.user.kyc_submitted_at).toLocaleDateString()
        : 'Recently Submitted';
    }
  } else {
    // UNVERIFIED or REJECTED
    if (unverView) unverView.style.display = 'block';
    const rejAlert = document.getElementById('kyc-rejection-alert');
    if (rejAlert) {
      if (kycStatus === 'REJECTED') {
        rejAlert.style.display = 'block';
        const msgEl = document.getElementById('kyc-rejection-msg');
        if (msgEl) {
          msgEl.innerText = state.user.kyc_rejection_reason || 'Your document could not be verified. Please ensure the document is clear, unexpired, and clearly legible.';
        }
      } else {
        rejAlert.style.display = 'none';
      }
    }

    // Prefill form
    const fn = document.getElementById('kyc-first-name');
    const ln = document.getElementById('kyc-last-name');
    const ctry = document.getElementById('kyc-country');
    const dob = document.getElementById('kyc-dob');

    if (fn && !fn.value) fn.value = state.user.first_name || '';
    if (ln && !ln.value) ln.value = state.user.last_name || '';
    if (ctry && !ctry.value) ctry.value = state.user.country || '';
    if (dob && !dob.value && state.user.date_of_birth) dob.value = state.user.date_of_birth;
  }
}

function handleKYCDocTypeChange() {
  const type = document.getElementById('kyc-doc-type').value;
  const numInput = document.getElementById('kyc-doc-number');
  if (!numInput) return;

  const placeholders = {
    PASSPORT: 'Enter passport number (e.g. A12345678)',
    NATIONAL_ID: 'Enter national identity card number',
    DRIVERS_LICENSE: 'Enter driver\'s license number',
    RESIDENCE_PERMIT: 'Enter residence permit or registration number',
  };
  numInput.placeholder = placeholders[type] || 'Enter document identification number';
}

function handleKYCFileSelect(e, side) {
  const file = e.target.files && e.target.files[0];
  const nameEl = document.getElementById(`kyc-file-name-display-${side}`);
  if (!nameEl) return;

  if (file) {
    nameEl.innerHTML = `<span style="color: var(--gold); font-weight: 600;">${file.name}</span> <span style="color: var(--mute); font-size: 11px;">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>`;
  } else {
    nameEl.innerText = `Click to upload ${side}`;
  }
}

async function handleKYCSubmit(e) {
  e.preventDefault();
  const docType = document.getElementById('kyc-doc-type').value;
  const docNumber = document.getElementById('kyc-doc-number').value.trim();
  const firstName = document.getElementById('kyc-first-name').value.trim();
  const lastName = document.getElementById('kyc-last-name').value.trim();
  const country = document.getElementById('kyc-country').value.trim();
  const dob = document.getElementById('kyc-dob').value;
  const fileInputFront = document.getElementById('kyc-file-input-front');
  const fileFront = fileInputFront.files && fileInputFront.files[0];
  const fileInputBack = document.getElementById('kyc-file-input-back');
  const fileBack = fileInputBack.files && fileInputBack.files[0];
  const submitBtn = document.getElementById('kyc-submit-btn');

  if (!docType) {
    showToast('Please select your document type.', true);
    return;
  }
  if (!fileFront || !fileBack) {
    showToast('Please upload both front and back images of the document.', true);
    return;
  }

  const formData = new FormData();
  formData.append('kyc_document_type', docType);
  if (docNumber) formData.append('kyc_document_number', docNumber);
  formData.append('first_name', firstName);
  formData.append('last_name', lastName);
  formData.append('country', country);
  if (dob) formData.append('date_of_birth', dob);
  formData.append('kyc_document_front', fileFront);
  formData.append('kyc_document_back', fileBack);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting Documents…';
  }

  try {
    const res = await apiCall('/auth/kyc/', 'POST', formData, /* isFormData */ true);
    showToast('KYC documents submitted successfully. Our compliance team is reviewing your verification.');
    if (res.profile) {
      state.user = { ...state.user, ...res.profile };
    } else {
      state.user.kyc_status = 'PENDING';
      state.user.kyc_document_type = docType;
      state.user.kyc_document_number = docNumber;
      state.user.kyc_submitted_at = new Date().toISOString();
    }
    renderAllViews();
    renderKYCView();
  } catch (err) {
    showToast(err.message || 'Failed to submit KYC documents.', true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg> Submit Identity Documents for Verification`;
    }
  }
}

