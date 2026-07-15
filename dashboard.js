/* ============================================
   HR Admin Dashboard — Logic
   Reads from Google Sheets API via backend proxy
   or parses data fetched from the sheet directly
   ============================================ */

(function () {
  'use strict';

  /* ── Config ────────────────────────────────── */
  // Passcode stored only in memory — change this to your desired password
  const PASSCODE = 'hrdisc2026';

  // Google Sheets — published CSV URL (already configured)
  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_zTTPZ3F8r3NkuzIcKPQS9oycZ2mt9BOlzKkGoop-NvyXl6E52TBEhRg73TsbSk0HHZuLzDGiix7r/pub?gid=922544061&single=true&output=csv';

  /* ── State ─────────────────────────────────── */
  const state = {
    unlocked:   false,
    allRows:    [],      // parsed rows from sheet
    filtered:   [],
    page:       1,
    pageSize:   15,
    search:     '',
    filterPos:  '',
    filterStat: '',
  };

  /* ── DOM refs ──────────────────────────────── */
  const qs = id => document.getElementById(id);

  const D = {
    gateView:        qs('gateView'),
    dashView:        qs('dashView'),
    gateForm:        qs('gateForm'),
    passcodeInput:   qs('passcodeInput'),
    gateError:       qs('gateError'),
    btnUnlock:       qs('btnUnlock'),
    btnLogout:       qs('btnLogout'),
    btnRefresh:      qs('btnRefresh'),
    tabTitle:        qs('tabTitle'),
    lastRefresh:     qs('lastRefresh'),
    // stats
    statTotal:       qs('statTotal'),
    statPending:     qs('statPending'),
    statDev:         qs('statDev'),
    statDes:         qs('statDes'),
    // overview
    profileTbody:    qs('profileTbody'),
    // candidates tab
    searchInput:     qs('searchInput'),
    filterPosition:  qs('filterPosition'),
    filterStatus:    qs('filterStatus'),
    candidatesTbody: qs('candidatesTbody'),
    pagination:      qs('pagination'),
  };

  /* ══════════════════════════════════════════════
     PASSCODE GATE
     ══════════════════════════════════════════════ */
  D.gateForm.addEventListener('submit', e => {
    e.preventDefault();
    const entered = D.passcodeInput.value;
    if (entered === PASSCODE) {
      unlock();
    } else {
      D.gateError.style.display = 'block';
      D.passcodeInput.value = '';
      D.passcodeInput.focus();
      D.passcodeInput.closest('.input-group').classList.add('error');
    }
  });

  D.passcodeInput.addEventListener('input', () => {
    D.gateError.style.display = 'none';
    D.passcodeInput.closest('.input-group').classList.remove('error');
  });

  function unlock() {
    state.unlocked = true;
    D.gateView.classList.add('hidden');
    D.dashView.classList.remove('hidden');
    loadData();
  }

  D.btnLogout.addEventListener('click', () => {
    state.unlocked = false;
    D.dashView.classList.add('hidden');
    D.gateView.classList.remove('hidden');
    D.passcodeInput.value = '';
    state.allRows = [];
    state.filtered = [];
  });

  /* ══════════════════════════════════════════════
     TAB NAVIGATION
     ══════════════════════════════════════════════ */
  document.querySelectorAll('.sidebar-nav a[data-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const tab = link.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      const pane = qs(`tab-${tab}`);
      if (pane) pane.classList.remove('hidden');

      const titles = { overview: 'Overview', candidates: 'Candidates' };
      D.tabTitle.textContent = titles[tab] ?? tab;
    });
  });

  /* ══════════════════════════════════════════════
     DATA LOADING (Google Sheets CSV export)
     ══════════════════════════════════════════════ */
  async function loadData() {
    setTableLoading();

    try {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      state.allRows = parseCSV(csv);
      D.lastRefresh.textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
      renderAll();
    } catch (err) {
      console.error('Data load error:', err);
      // Show fallback empty state
      state.allRows = [];
      renderAll();
      showError('Could not load data from Google Sheets. Make sure the sheet is published to web as CSV.');
    }
  }

  D.btnRefresh.addEventListener('click', loadData);

  /* ── Parse CSV ─────────────────────────────── */
  function parseCSV(csv) {
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = splitCSVRow(lines[0]);

    return lines.slice(1).map(line => {
      const vals = splitCSVRow(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim(); });
      return obj;
    }).filter(r => r['Candidate_ID']); // skip empty rows
  }

  function splitCSVRow(row) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"' && !inQ)                  { inQ = true; }
      else if (ch === '"' && inQ && row[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"' && inQ)              { inQ = false; }
      else if (ch === ',' && !inQ)             { result.push(cur); cur = ''; }
      else                                     { cur += ch; }
    }
    result.push(cur);
    return result;
  }

  /* ── Sheet column mapping ──────────────────── */
  // These match the actual column headers in your Google Sheet
  const COL = {
    id:       'Candidate_ID',
    time:     'Waktu_Ujian',
    name:     'Nama_Lengkap',
    email:    'Email',
    position: 'Posisi',
    cv:       'Link_CV',
    port:     'Link_Portfolio',
    pub:      'Profile_Graph_1',
    priv:     'Profile_Graph_2',
    core:     'Profile_Graph_3',
    status:   'Status_Evaluasi',
  };

  /* ══════════════════════════════════════════════
     RENDER ALL
     ══════════════════════════════════════════════ */
  function renderAll() {
    applyFilters();
    renderStats();
    renderProfileChart();
    renderCandidates();
  }

  /* ── Apply search + filters ────────────────── */
  function applyFilters() {
    const q   = state.search.toLowerCase();
    const pos = state.filterPos;
    const st  = state.filterStat;

    state.filtered = state.allRows.filter(r => {
      const matchQ   = !q || (r[COL.name] ?? '').toLowerCase().includes(q)
                           || (r[COL.email] ?? '').toLowerCase().includes(q)
                           || (r[COL.id]   ?? '').toLowerCase().includes(q);
      const matchPos = !pos || r[COL.position] === pos;
      const matchSt  = !st  || r[COL.status]   === st;
      return matchQ && matchPos && matchSt;
    });

    state.page = 1;
  }

  /* ── Stats ─────────────────────────────────── */
  function renderStats() {
    const rows    = state.allRows;
    const total   = rows.length;
    const pending = rows.filter(r => (r[COL.status] ?? 'Pending') === 'Pending').length;
    const dev     = rows.filter(r => r[COL.position] === 'Web Developer').length;
    const des     = rows.filter(r => r[COL.position] === 'Web Designer').length;

    animCount(D.statTotal,   total);
    animCount(D.statPending, pending);
    animCount(D.statDev,     dev);
    animCount(D.statDes,     des);
  }

  function animCount(el, target) {
    const start   = parseInt(el.textContent) || 0;
    const dur     = 600;
    const startTs = performance.now();
    const step    = ts => {
      const prog = Math.min((ts - startTs) / dur, 1);
      el.textContent = Math.round(start + (target - start) * easeOut(prog));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* ── Profile frequency chart (table) ──────── */
  function renderProfileChart() {
    const freq = {};
    state.allRows.forEach(r => {
      const p = r[COL.pub] || 'Unknown';
      freq[p] = (freq[p] || 0) + 1;
    });

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const total  = state.allRows.length || 1;

    if (!sorted.length) {
      D.profileTbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📭</div><h4>No data yet</h4><p>Candidate submissions will appear here.</p></div></td></tr>`;
      return;
    }

    D.profileTbody.innerHTML = sorted.map(([name, count], i) => {
      const pct = ((count / total) * 100).toFixed(1);
      return `
        <tr>
          <td style="color:var(--text-muted)">${i + 1}</td>
          <td style="font-weight:600;color:var(--text-primary)">${escHtml(name)}</td>
          <td>${count}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-secondary));border-radius:99px"></div>
              </div>
              <span style="font-size:0.78rem;color:var(--text-muted);min-width:36px">${pct}%</span>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  /* ── Candidate table ───────────────────────── */
  function renderCandidates() {
    const { filtered, page, pageSize } = state;
    const start  = (page - 1) * pageSize;
    const chunk  = filtered.slice(start, start + pageSize);

    if (!chunk.length) {
      const msg = state.allRows.length
        ? 'No candidates match the current filters.'
        : 'No candidate data found.';
      D.candidatesTbody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h4>${msg}</h4>
            <p>Try adjusting your search or filters.</p>
          </div>
        </td></tr>`;
      D.pagination.innerHTML = '';
      return;
    }

    D.candidatesTbody.innerHTML = chunk.map(r => {
      const statusClass = {
        'Pending':  'badge-pending',
        'Reviewed': 'badge-reviewed',
        'Hired':    'badge-hired',
        'Rejected': 'badge-rejected',
      }[r[COL.status]] ?? 'badge-pending';

      const date = r[COL.time] ? new Date(r[COL.time]).toLocaleDateString() : '—';

      return `
        <tr>
          <td style="font-family:monospace;font-size:0.78rem;color:var(--accent-light)">${escHtml(r[COL.id] ?? '—')}</td>
          <td class="name-cell">${escHtml(r[COL.name] ?? '—')}</td>
          <td>${escHtml(r[COL.email] ?? '—')}</td>
          <td>${escHtml(r[COL.position] ?? '—')}</td>
          <td style="font-size:0.82rem">${escHtml(r[COL.pub]  ?? '—')}</td>
          <td style="font-size:0.82rem">${escHtml(r[COL.priv] ?? '—')}</td>
          <td style="font-size:0.82rem">${escHtml(r[COL.core] ?? '—')}</td>
          <td style="font-size:0.82rem;color:var(--text-muted)">${date}</td>
          <td><span class="badge ${statusClass}">${escHtml(r[COL.status] ?? 'Pending')}</span></td>
        </tr>`;
    }).join('');

    renderPagination(filtered.length);
  }

  /* ── Pagination ────────────────────────────── */
  function renderPagination(total) {
    const pages = Math.ceil(total / state.pageSize);
    if (pages <= 1) { D.pagination.innerHTML = ''; return; }

    let html = '';

    const addBtn = (label, pg, isActive = false, isDisabled = false) => {
      html += `<button class="page-btn${isActive ? ' active' : ''}" data-page="${pg}" ${isDisabled ? 'disabled' : ''}>${label}</button>`;
    };

    addBtn('‹', state.page - 1, false, state.page === 1);

    for (let p = 1; p <= pages; p++) {
      if (pages > 7 && p > 2 && p < pages - 1 && Math.abs(p - state.page) > 1) {
        if (p === 3 || p === pages - 2) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
        continue;
      }
      addBtn(p, p, p === state.page);
    }

    addBtn('›', state.page + 1, false, state.page === pages);

    D.pagination.innerHTML = html;
    D.pagination.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = parseInt(btn.dataset.page, 10);
        renderCandidates();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ── Filter listeners ──────────────────────── */
  D.searchInput.addEventListener('input', () => {
    state.search = D.searchInput.value.trim();
    applyFilters();
    renderCandidates();
  });

  D.filterPosition.addEventListener('change', () => {
    state.filterPos = D.filterPosition.value;
    applyFilters();
    renderCandidates();
  });

  D.filterStatus.addEventListener('change', () => {
    state.filterStat = D.filterStatus.value;
    applyFilters();
    renderCandidates();
  });

  /* ── Helpers ───────────────────────────────── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setTableLoading() {
    const msg = '<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--text-muted)">⏳ Loading data…</td></tr>';
    D.candidatesTbody.innerHTML = msg;
    D.profileTbody.innerHTML    = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted)">⏳ Loading…</td></tr>';
  }

  function showError(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:1rem;right:1rem;background:var(--bg-tertiary);border:1px solid var(--error);border-radius:12px;padding:1rem 1.25rem;color:var(--error);font-size:0.85rem;max-width:380px;z-index:9000;box-shadow:var(--shadow-lg)';
    el.innerHTML = `⚠️ ${msg}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

})();
