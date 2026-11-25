/* Bounty Radar — vanilla JS, no dependencies.
   Data comes from data.js (window.BOUNTY_DATA), generated from live make.fun pages.
   Pure helpers (formatMoney, countdownParts, filterBounties, sortBounties) are
   exported onto window.BountyRadar for testing. */
(function () {
  'use strict';

  var DATA = (typeof window !== 'undefined' && window.BOUNTY_DATA) || { bounties: [], generatedAt: null, sourceNote: '' };

  function formatMoney(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function parseEnds(b) {
    return b.endsAt ? new Date(b.endsAt).getTime() : null;
  }

  /* Remaining time split into d/h/m/s; null when no deadline. */
  function countdownParts(endsMs, nowMs) {
    if (endsMs == null) return null;
    var diff = endsMs - nowMs;
    if (diff <= 0) return { ended: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    var s = Math.floor(diff / 1000);
    return {
      ended: false,
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60
    };
  }

  function formatCountdown(b, nowMs) {
    if (b.status === 'judging') return 'Judging — results pending';
    if (b.status === 'done') return b.winner ? 'Won by @' + b.winner : 'Ended';
    var parts = countdownParts(parseEnds(b), nowMs);
    if (!parts) return 'No deadline listed';
    if (parts.ended) return 'Ended';
    var out = '';
    if (parts.days > 0) out += parts.days + 'd ';
    out += String(parts.hours).padStart(2, '0') + 'h '
      + String(parts.minutes).padStart(2, '0') + 'm '
      + String(parts.seconds).padStart(2, '0') + 's';
    return out;
  }

  function isLiveNow(b, nowMs) {
    if (b.status !== 'live') return false;
    var ends = parseEnds(b);
    return ends == null || ends > nowMs;
  }

  function filterBounties(list, opts, nowMs) {
    var q = (opts.query || '').trim().toLowerCase();
    return list.filter(function (b) {
      if (opts.status === 'live' && !isLiveNow(b, nowMs)) return false;
      if (opts.status === 'judging' && b.status !== 'judging') return false;
      if (opts.status === 'done' && b.status !== 'done') return false;
      if (b.reward < opts.minPrize) return false;
      if (q && b.title.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function sortBounties(list, sortBy) {
    var arr = list.slice();
    if (sortBy === 'prize-desc') arr.sort(function (a, b) { return b.reward - a.reward; });
    else if (sortBy === 'prize-asc') arr.sort(function (a, b) { return a.reward - b.reward; });
    else if (sortBy === 'deadline-asc') arr.sort(function (a, b) {
      var ea = parseEnds(a), eb = parseEnds(b);
      if (ea == null && eb == null) return b.reward - a.reward;
      if (ea == null) return 1;
      if (eb == null) return -1;
      return ea - eb;
    });
    else if (sortBy === 'deadline-desc') arr.sort(function (a, b) {
      var ea = parseEnds(a), eb = parseEnds(b);
      if (ea == null && eb == null) return b.reward - a.reward;
      if (ea == null) return 1;
      if (eb == null) return -1;
      return eb - ea;
    });
    return arr;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function badgeFor(b, nowMs) {
    if (b.status === 'judging') return '<span class="badge judging">Judging</span>';
    if (b.status === 'done') return '<span class="badge done">Done</span>';
    if (!isLiveNow(b, nowMs)) return '<span class="badge ended">Ended</span>';
    return '<span class="badge live">Live</span>';
  }

  /* ---- DOM wiring (browser only) ---- */
  if (typeof document === 'undefined') {
    if (typeof window !== 'undefined') {
      window.BountyRadar = { formatMoney: formatMoney, countdownParts: countdownParts, formatCountdown: formatCountdown, filterBounties: filterBounties, sortBounties: sortBounties, DATA: DATA };
    }
    return;
  }

  var grid = document.getElementById('bounty-grid');
  var countEl = document.getElementById('result-count');
  var emptyEl = document.getElementById('empty-state');
  var searchEl = document.getElementById('search');
  var minPrizeEl = document.getElementById('min-prize');
  var statusEl = document.getElementById('status-filter');
  var sortEl = document.getElementById('sort-by');
  var resetBtn = document.getElementById('reset');
  var backdrop = document.getElementById('modal-backdrop');
  var modalBody = document.getElementById('modal-body');
  var modalClose = document.getElementById('modal-close');

  var current = [];

  function state() {
    return {
      query: searchEl.value,
      minPrize: parseFloat(minPrizeEl.value) || 0,
      status: statusEl.value,
      sortBy: sortEl.value
    };
  }

  function renderStats(nowMs) {
    var live = DATA.bounties.filter(function (b) { return isLiveNow(b, nowMs); });
    var pool = live.reduce(function (sum, b) { return sum + b.reward; }, 0);
    document.getElementById('stat-pool').textContent = formatMoney(pool);
    document.getElementById('stat-live').textContent = String(live.length);
    var soonest = live.filter(function (b) { return parseEnds(b) != null; })
      .sort(function (a, b) { return parseEnds(a) - parseEnds(b); })[0];
    document.getElementById('stat-next').textContent = soonest ? formatCountdown(soonest, nowMs) : '—';
    var gen = DATA.generatedAt ? new Date(DATA.generatedAt) : null;
    document.getElementById('source-line').textContent =
      (gen ? 'Snapshot taken ' + gen.toUTCString() + '. ' : '') + (DATA.sourceNote || '');
  }

  function cardHtml(b, nowMs) {
    var fee = b.entryFee > 0 ? '<span class="fee">Entry fee ' + formatMoney(b.entryFee) + '</span>' : '<span class="fee">Free entry</span>';
    var cd = formatCountdown(b, nowMs);
    var soon = b.status === 'live' && parseEnds(b) != null && (parseEnds(b) - nowMs) < 6 * 3600 * 1000;
    return '<article class="card" tabindex="0" data-title="' + esc(b.title) + '">' +
      '<h2>' + esc(b.title) + '</h2>' +
      '<div class="meta"><span class="prize">' + formatMoney(b.reward) + ' USDC</span>' + badgeFor(b, nowMs) + fee + '</div>' +
      '<div class="countdown' + (soon ? ' soon' : '') + '" data-countdown="' + esc(b.title) + '">Ends in ' + esc(cd) + '</div>' +
      (b.note ? '<p class="note">' + esc(b.note) + '</p>' : '') +
      '<span class="go">View on make.fun →</span>' +
      '</article>';
  }

  function render() {
    var nowMs = Date.now();
    var opts = state();
    current = sortBounties(filterBounties(DATA.bounties, opts, nowMs), opts.sortBy);
    renderStats(nowMs);
    grid.innerHTML = current.map(function (b) { return cardHtml(b, nowMs); }).join('');
    countEl.textContent = current.length + ' bount' + (current.length === 1 ? 'y' : 'ies') +
      ' shown · ' + DATA.bounties.length + ' in snapshot';
    emptyEl.hidden = current.length !== 0;
  }

  function tick() {
    var nowMs = Date.now();
    renderStats(nowMs);
    var nodes = grid.querySelectorAll('[data-countdown]');
    nodes.forEach(function (node) {
      var b = DATA.bounties.find(function (x) { return x.title === node.getAttribute('data-countdown'); });
      if (b) node.textContent = 'Ends in ' + formatCountdown(b, nowMs);
    });
  }

  function openModal(b) {
    var nowMs = Date.now();
    var ends = parseEnds(b);
    modalBody.innerHTML =
      '<h2 id="modal-title">' + esc(b.title) + '</h2>' +
      '<div class="meta"><span class="prize">' + formatMoney(b.reward) + ' USDC</span>' + badgeFor(b, nowMs) + '</div>' +
      '<dl>' +
      '<dt>Status</dt><dd>' + (b.status === 'live' ? (isLiveNow(b, nowMs) ? 'Live' : 'Ended') : b.status) + '</dd>' +
      '<dt>Entry fee</dt><dd>' + (b.entryFee > 0 ? formatMoney(b.entryFee) : 'Free') + '</dd>' +
      '<dt>Deadline</dt><dd>' + (ends ? new Date(ends).toUTCString() + ' (' + esc(formatCountdown(b, nowMs)) + ')' : '—') + '</dd>' +
      (b.winner ? '<dt>Winner</dt><dd>@' + esc(b.winner) + '</dd>' : '') +
      (b.note ? '<dt>Note</dt><dd>' + esc(b.note) + '</dd>' : '') +
      '</dl>' +
      '<a class="cta" href="' + esc(b.url) + '" target="_blank" rel="noopener">Open bounty on make.fun →</a>';
    backdrop.hidden = false;
    modalClose.focus();
  }

  function closeModal() { backdrop.hidden = true; }

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    var b = current.find(function (x) { return x.title === card.getAttribute('data-title'); });
    if (b) openModal(b);
  });
  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    var b = current.find(function (x) { return x.title === card.getAttribute('data-title'); });
    if (b) openModal(b);
  });
  modalClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  [searchEl, minPrizeEl, statusEl, sortEl].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  resetBtn.addEventListener('click', function () {
    searchEl.value = '';
    minPrizeEl.value = '0';
    statusEl.value = 'live';
    sortEl.value = 'prize-desc';
    render();
  });

  /* Deep-linking: ?q=&min=&status=&sort=&bounty=<make.fun URL> — lets a
     screenshot, a share link, or a test open a pre-set view. */
  (function applyQueryParams() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var q = params.get('q');
    if (q != null) searchEl.value = q;
    var min = params.get('min');
    if (min != null && !isNaN(parseFloat(min))) minPrizeEl.value = String(parseFloat(min));
    var status = params.get('status');
    if (status && ['all', 'live', 'judging', 'done'].indexOf(status) !== -1) statusEl.value = status;
    var sort = params.get('sort');
    if (sort && ['prize-desc', 'prize-asc', 'deadline-asc', 'deadline-desc'].indexOf(sort) !== -1) sortEl.value = sort;
    var bountyUrl = params.get('bounty');
    if (bountyUrl) {
      var target = DATA.bounties.find(function (x) { return x.url === bountyUrl; });
      if (target) setTimeout(function () { openModal(target); }, 0);
    }
  })();

  render();
  setInterval(tick, 1000);

  window.BountyRadar = { formatMoney: formatMoney, countdownParts: countdownParts, formatCountdown: formatCountdown, filterBounties: filterBounties, sortBounties: sortBounties, DATA: DATA };
})();
