'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  amount: $('amount'), rate: $('rate'), tenure: $('tenure'), extra: $('extra'), currency: $('currency'),
};
const LOCALE = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
let view = 'year';
let last = null;

function fmt(n, digits = 0) {
  const cur = els.currency.value;
  return new Intl.NumberFormat(LOCALE[cur], {
    style: 'currency', currency: cur, maximumFractionDigits: digits, minimumFractionDigits: digits,
  }).format(n);
}

function months(m) {
  const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} yr` : '', r ? `${r} mo` : ''].filter(Boolean).join(' ') || '0 mo';
}

/** Standard reducing-balance EMI. */
function emiFor(P, annualRate, n) {
  const r = annualRate / 12 / 100;
  if (r === 0) return P / n;
  const k = Math.pow(1 + r, n);
  return (P * r * k) / (k - 1);
}

/** Month-by-month schedule; extra is applied to principal after the EMI. */
function schedule(P, annualRate, n, extra) {
  const r = annualRate / 12 / 100;
  const emi = emiFor(P, annualRate, n);
  const rows = [];
  let bal = P;
  for (let m = 1; bal > 0.005 && m <= n; m++) {
    const interest = bal * r;
    let principal = Math.min(emi - interest, bal);
    bal -= principal;
    const ex = Math.min(extra, bal);
    bal -= ex;
    rows.push({ m, principal, interest, extra: ex, balance: Math.max(bal, 0) });
  }
  return { emi, rows };
}

const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);

function read() {
  return {
    P: +els.amount.value, rate: +els.rate.value, n: +els.tenure.value, extra: +els.extra.value,
  };
}

function render() {
  const { P, rate, n, extra } = read();
  $('amountOut').textContent = fmt(P);
  $('rateOut').textContent = `${rate.toFixed(1)}%`;
  $('tenureOut').textContent = months(n);
  $('extraOut').textContent = extra ? fmt(extra) : 'None';

  const base = schedule(P, rate, n, 0);
  const plan = extra ? schedule(P, rate, n, extra) : base;
  const interest = sum(plan.rows, 'interest');

  $('emi').textContent = fmt(plan.emi);
  $('principal').textContent = fmt(P);
  $('interest').textContent = fmt(interest);
  $('total').textContent = fmt(P + interest);
  const pPct = (P / (P + interest)) * 100;
  $('pPct').textContent = `${pPct.toFixed(1)}%`;
  $('iPct').textContent = `${(100 - pPct).toFixed(1)}%`;

  const s = $('savings');
  if (extra) {
    const saved = sum(base.rows, 'interest') - interest;
    const sooner = base.rows.length - plan.rows.length;
    s.hidden = false;
    s.textContent = `Paying ${fmt(extra)} extra each month saves ${fmt(saved)} in interest and closes the loan ${months(sooner)} sooner.`;
  } else {
    s.hidden = true;
  }

  last = { base, plan };
  drawDonut(pPct);
  drawChart(base.rows, plan.rows, P, n);
  renderTable(plan.rows);
  syncUrl();
}

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawDonut(pPct) {
  const c = $('donut'), ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 160;
  c.width = size * dpr; c.height = size * dpr; c.style.width = size + 'px'; c.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, rad = 64, w = 22, start = -Math.PI / 2;
  const split = start + (pPct / 100) * Math.PI * 2;
  ctx.lineWidth = w;
  ctx.strokeStyle = css('--accent');
  ctx.beginPath(); ctx.arc(cx, cx, rad, start, split); ctx.stroke();
  ctx.strokeStyle = css('--interest');
  ctx.beginPath(); ctx.arc(cx, cx, rad, split, start + Math.PI * 2); ctx.stroke();
}

function drawChart(baseRows, planRows, P, n) {
  const c = $('chart'), ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = 260;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 72, r: 12, t: 10, b: 28 };
  const x = (m) => pad.l + (m / n) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / P) * (H - pad.t - pad.b);

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = css('--muted');
  ctx.strokeStyle = css('--line');
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = (P * i) / 4, yy = y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(compact(v), pad.l - 8, yy);
  }
  const yearStep = Math.max(1, Math.ceil(n / 12 / 8));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let yr = 0; yr * 12 <= n; yr += yearStep) {
    ctx.fillText(yr === 0 ? 'Start' : `Yr ${yr}`, x(yr * 12), H - pad.b + 8);
  }

  const line = (rows, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x(0), y(P));
    rows.forEach((r) => ctx.lineTo(x(r.m), y(r.balance)));
    ctx.stroke();
  };
  if (planRows !== baseRows) line(baseRows, css('--base'), 2);
  line(planRows, css('--accent'), 2.5);
}

function compact(v) {
  const cur = els.currency.value;
  return new Intl.NumberFormat(LOCALE[cur], {
    style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1,
  }).format(v);
}

function grouped(rows) {
  if (view === 'month') return rows.map((r) => ({ label: `Month ${r.m}`, ...r }));
  const out = [];
  rows.forEach((r) => {
    const yi = Math.ceil(r.m / 12) - 1;
    out[yi] ??= { label: `Year ${yi + 1}`, principal: 0, interest: 0, extra: 0, balance: 0 };
    out[yi].principal += r.principal;
    out[yi].interest += r.interest;
    out[yi].extra += r.extra;
    out[yi].balance = r.balance;
  });
  return out;
}

function renderTable(rows) {
  $('periodHead').textContent = view === 'year' ? 'Year' : 'Month';
  $('rows').innerHTML = grouped(rows).map((r) =>
    `<tr><td>${r.label}</td><td>${fmt(r.principal)}</td><td>${fmt(r.interest)}</td><td>${r.extra ? fmt(r.extra) : '–'}</td><td>${fmt(r.balance)}</td></tr>`
  ).join('');
}

function downloadCsv() {
  const lines = ['month,principal,interest,extra,balance'];
  last.plan.rows.forEach((r) =>
    lines.push([r.m, r.principal, r.interest, r.extra, r.balance].map((v, i) => (i === 0 ? v : v.toFixed(2))).join(','))
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'emi-schedule.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function syncUrl() {
  const p = new URLSearchParams({
    a: els.amount.value, r: els.rate.value, t: els.tenure.value, x: els.extra.value, c: els.currency.value,
  });
  history.replaceState(null, '', `?${p}`);
}

function loadUrl() {
  const p = new URLSearchParams(location.search);
  const map = { a: 'amount', r: 'rate', t: 'tenure', x: 'extra', c: 'currency' };
  Object.entries(map).forEach(([k, id]) => { if (p.has(k)) els[id].value = p.get(k); });
}

Object.values(els).forEach((el) => el.addEventListener('input', render));
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach((o) => o.classList.toggle('on', o === b));
  view = b.dataset.view;
  renderTable(last.plan.rows);
}));
$('csv').addEventListener('click', downloadCsv);
$('share').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); $('share').textContent = 'Link copied'; }
  catch { $('share').textContent = 'Copy the URL from the address bar'; }
  setTimeout(() => ($('share').textContent = 'Copy share link'), 1800);
});
window.addEventListener('resize', () => last && drawChart(last.base.rows, last.plan.rows, +els.amount.value, +els.tenure.value));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

loadUrl();
render();
