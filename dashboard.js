/* ============================================
   HR Admin Dashboard — Logic
   Reads from Google Sheets API via backend proxy
   or parses data fetched from the sheet directly
   ============================================ */

(function () {
  'use strict';

  // Apply saved theme immediately (before render) to avoid flash
  const savedTheme = localStorage.getItem('disc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

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
    themeToggle:     qs('themeToggle'),
    themeToggleDash: qs('themeToggleDash'),
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
    // overview
    profileTbody:    qs('profileTbody'),
    // candidates tab
    searchInput:     qs('searchInput'),
    filterPosition:  qs('filterPosition'),
    filterStatus:    qs('filterStatus'),
    candidatesTbody: qs('candidatesTbody'),
    pagination:      qs('pagination'),
    // drawer elements
    drawerBackdrop:  qs('drawerBackdrop'),
    detailDrawer:    qs('detailDrawer'),
    btnDrawerClose:  qs('btnDrawerClose'),
    drawerId:        qs('drawerId'),
    drawerName:      qs('drawerName'),
    drawerEmail:     qs('drawerEmail'),
    drawerPosition:  qs('drawerPosition'),
    drawerDate:      qs('drawerDate'),
    drawerStatus:    qs('drawerStatus'),
    drawerCvLink:    qs('drawerCvLink'),
    drawerPortLink:  qs('drawerPortLink'),
    drawerPubSelf:   qs('drawerPubSelf'),
    drawerPrivSelf:  qs('drawerPrivSelf'),
    drawerCoreSelf:  qs('drawerCoreSelf'),
    scoreDMost:      qs('scoreDMost'),
    scoreIMost:      qs('scoreIMost'),
    scoreSMost:      qs('scoreSMost'),
    scoreCMost:      qs('scoreCMost'),
    scoreDLeast:     qs('scoreDLeast'),
    scoreILeast:     qs('scoreILeast'),
    scoreSLeast:     qs('scoreSLeast'),
    scoreCLeast:     qs('scoreCLeast'),
    scoreDChange:    qs('scoreDChange'),
    scoreIChange:    qs('scoreIChange'),
    scoreSChange:    qs('scoreSChange'),
    scoreCChange:    qs('scoreCChange'),
    // result report & modal elements
    drawerResultLink: qs('drawerResultLink'),
    btnShowResultModal: qs('btnShowResultModal'),
    resultModalBackdrop: qs('resultModalBackdrop'),
    resultModal:     qs('resultModal'),
    resultModalTitle: qs('resultModalTitle'),
    btnModalOpenTab: qs('btnModalOpenTab'),
    btnResultModalClose: qs('btnResultModalClose'),
    resultIframe:    qs('resultIframe'),
    // evaluation actions & notes
    drawerStatusSelect: qs('drawerStatusSelect'),
    drawerNoteInput:    qs('drawerNoteInput'),
    btnSaveEvaluation:  qs('btnSaveEvaluation'),
    drawerSaveIndicator: qs('drawerSaveIndicator'),
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
    sessionStorage.setItem('hr_dash_unlocked', 'true');
    D.gateView.classList.add('hidden');
    D.dashView.classList.remove('hidden');
    if (D.themeToggle) D.themeToggle.classList.add('hidden');
    loadData();
  }

  D.btnLogout.addEventListener('click', () => {
    state.unlocked = false;
    sessionStorage.removeItem('hr_dash_unlocked');
    D.dashView.classList.add('hidden');
    D.gateView.classList.remove('hidden');
    if (D.themeToggle) D.themeToggle.classList.remove('hidden');
    D.passcodeInput.value = '';
    state.allRows = [];
    state.filtered = [];
    closeDrawer();
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
      applyLocalOverrides(state.allRows);
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
    dMost:    'D_Most',
    iMost:    'I_Most',
    sMost:    'S_Most',
    cMost:    'C_Most',
    dLeast:   'D_Least',
    iLeast:   'I_Least',
    sLeast:   'S_Least',
    cLeast:   'C_Least',
    dChange:  'D_Change',
    iChange:  'I_Change',
    sChange:  'S_Change',
    cChange:  'C_Change',
    note:     'Catatan_HR',
    pdf:      'Link_PDF',
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

    animCount(D.statTotal,   total);
    animCount(D.statPending, pending);
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
        <tr><td colspan="11">
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

      const cvLink = r[COL.cv];
      const portLink = r[COL.port];
      let filesHtml = '<div class="file-badge-wrap">';
      if (cvLink && cvLink.startsWith('http')) {
        filesHtml += `<a href="${escHtml(cvLink)}" target="_blank" class="file-badge cv-badge" title="View CV" data-stop-propagation="true">📄 CV</a>`;
      }
      if (portLink && portLink.startsWith('http')) {
        filesHtml += `<a href="${escHtml(portLink)}" target="_blank" class="file-badge port-badge" title="View Portfolio" data-stop-propagation="true">💼 Port</a>`;
      }
      if (filesHtml === '<div class="file-badge-wrap">') {
        filesHtml += '<span style="color:var(--text-muted)">—</span>';
      }
      filesHtml += '</div>';

      let pdfHtml = '';
      const pdfLink = r[COL.pdf];
      if (pdfLink && pdfLink.startsWith('http')) {
        pdfHtml = `
          <a href="${escHtml(pdfLink)}" target="_blank" class="btn-ghost btn-sm" style="color:var(--accent);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;" data-stop-propagation="true" title="View PDF on Google Drive">
            <span>📄</span> View PDF
          </a>`;
      } else {
        pdfHtml = `
          <button class="btn-primary btn-sm btn-upload-pdf" data-cand-id="${escHtml(r[COL.id])}" data-stop-propagation="true" title="Generate PDF & Upload to Drive" style="display:inline-flex;align-items:center;gap:4px;">
            <span>⬆️</span> Upload PDF
          </button>`;
      }

      return `
        <tr data-cand-id="${escHtml(r[COL.id] ?? '')}">
          <td style="font-family:monospace;font-size:0.78rem;color:var(--accent-light)">${escHtml(r[COL.id] ?? '—')}</td>
          <td class="name-cell">${escHtml(r[COL.name] ?? '—')}</td>
          <td>${escHtml(r[COL.email] ?? '—')}</td>
          <td>${escHtml(r[COL.position] ?? '—')}</td>
          <td>${filesHtml}</td>
          <td>
            <a href="/?result=${encodeURIComponent(r[COL.id] ?? '')}" target="_blank" class="btn-show-result-sm" data-stop-propagation="true" title="Open Full Result Page in New Tab">
              <span>📊</span> Result
            </a>
          </td>
          <td>${pdfHtml}</td>
          <td style="font-size:0.82rem">${escHtml(r[COL.pub]  ?? '—')}</td>
          <td style="font-size:0.82rem">${escHtml(r[COL.priv] ?? '—')}</td>
          <td style="font-size:0.82rem">${escHtml(r[COL.core] ?? '—')}</td>
          <td style="font-size:0.82rem;color:var(--text-muted)">${date}</td>
          <td><span class="badge ${statusClass}">${escHtml(r[COL.status] ?? 'Pending')}</span></td>
          <td style="font-size:0.82rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-secondary)" title="${escHtml(r[COL.note] || r._hrNote || '')}">
            ${(r[COL.note] || r._hrNote) ? '📝 ' + escHtml(r[COL.note] || r._hrNote) : '<span style="color:var(--text-muted)">—</span>'}
          </td>
        </tr>`;
    }).join('');

    renderPagination(filtered.length);
    bindPdfUploadEvents();
  }

  /* ── Bind PDF Upload Events ─────────────────── */
  function bindPdfUploadEvents() {
    const buttons = D.candidatesTbody.querySelectorAll('.btn-upload-pdf');
    buttons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const candId = btn.dataset.candId;
        if (!candId) return;

        // Visual feedback
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span>⏳</span> Uploading...';
        btn.disabled = true;

        try {
          await uploadCandidatePdf(candId);
          // On success, we should refresh the data so it shows the "View PDF" button
          showError('PDF uploaded successfully! Refreshing data...', false);
          setTimeout(loadData, 2000);
        } catch (err) {
          console.error(err);
          showError(`Failed to upload PDF: ${err.message}`);
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      });
    });
  }

  /* ── Cross-Iframe PDF Upload ───────────────── */
  async function uploadCandidatePdf(candidateId) {
    return new Promise((resolve, reject) => {
      const iframe = document.getElementById('hiddenPdfIframe');
      if (!iframe) return reject(new Error('Iframe not found'));

      // 1. Load the candidate's result page
      iframe.src = `/?result=${encodeURIComponent(candidateId)}`;

      iframe.onload = async () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          // Wait for the specific element to be populated
          let attempts = 0;
          let element = null;
          
          const waitForRender = setInterval(async () => {
            attempts++;
            element = iframeDoc.getElementById('view-result');
            
            // Wait until the candidate ID is actually rendered inside the view
            const idEl = iframeDoc.getElementById('resultId');
            const isPopulated = idEl && idEl.textContent.trim() === candidateId;

            if (element && isPopulated) {
              clearInterval(waitForRender);
              
              // Wait an extra second for chart animations
              await new Promise(r => setTimeout(r, 1000));
              
              // Temporarily hide buttons
              const btnPrint = iframeDoc.getElementById('btnPrintReport');
              const btnFinish = iframeDoc.getElementById('btnFinishTest');
              const btnCopy = iframeDoc.getElementById('btnCopyId');
              if (btnPrint) btnPrint.style.display = 'none';
              if (btnFinish) btnFinish.style.display = 'none';
              if (btnCopy) btnCopy.style.display = 'none';

              const opt = {
                margin:       [10, 0, 10, 0],
                filename:     `DISC_Result_${candidateId}.pdf`,
                image:        { type: 'jpeg', quality: 0.8 },
                html2canvas:  { scale: 1.5, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };

              try {
                // Execute html2pdf
                const pdfBase64 = await html2pdf().set(opt).from(element).output('datauristring');
                
                // Upload
                const uploadRes = await fetch('/api/upload-pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    candidateId: candidateId,
                    pdfData: pdfBase64 
                  })
                });

                const uploadData = await uploadRes.json();
                if (!uploadRes.ok || uploadData.status !== 'success') {
                  throw new Error(uploadData.message || 'Failed to upload PDF');
                }
                
                resolve(uploadData);
              } catch (err) {
                reject(err);
              }
            } else if (attempts > 20) {
              clearInterval(waitForRender);
              reject(new Error('Timeout waiting for result page to render'));
            }
          }, 500); // Check every 500ms
          
        } catch (err) {
          reject(err);
        }
      };
    });
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
    const msg = '<tr><td colspan="10" style="text-align:center;padding:2.5rem;color:var(--text-muted)">⏳ Loading data…</td></tr>';
    D.candidatesTbody.innerHTML = msg;
    D.profileTbody.innerHTML    = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted)">⏳ Loading…</td></tr>';
  }

  function showError(msg, isError = true) {
    const el = document.createElement('div');
    const color = isError ? 'var(--error)' : '#34d399';
    el.style.cssText = `position:fixed;top:1rem;right:1rem;background:var(--bg-tertiary);border:1px solid ${color};border-radius:12px;padding:1rem 1.25rem;color:${color};font-size:0.85rem;max-width:380px;z-index:9000;box-shadow:var(--shadow-lg)`;
    el.innerHTML = `${isError ? '⚠️' : '✅'} ${msg}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  /* ══════════════════════════════════════════════
     DETAIL DRAWER LOGIC
     ══════════════════════════════════════════════ */
  D.candidatesTbody.addEventListener('click', e => {
    // Stop drawer opening when clicking badges directly
    if (e.target.closest('a') || e.target.closest('[data-stop-propagation="true"]')) {
      return;
    }

    const tr = e.target.closest('tr');
    if (!tr) return;

    const candId = tr.dataset.candId;
    if (!candId) return;

    const candidate = state.filtered.find(c => c[COL.id] === candId);
    if (candidate) {
      openDrawer(candidate);
    }
  });

  function openDrawer(r) {
    D.drawerId.textContent       = r[COL.id] ?? '—';
    D.drawerName.textContent     = r[COL.name] ?? '—';
    D.drawerEmail.textContent    = r[COL.email] ?? '—';
    D.drawerPosition.textContent = r[COL.position] ?? '—';
    D.drawerDate.textContent     = r[COL.time] ? new Date(r[COL.time]).toLocaleString() : '—';
    
    // Status
    const status = r[COL.status] || 'Pending';
    D.drawerStatus.textContent = status;
    D.drawerStatus.className = 'badge ' + ({
      'Pending': 'badge-pending',
      'Reviewed': 'badge-reviewed',
      'Hired': 'badge-hired',
      'Rejected': 'badge-rejected',
    }[status] ?? 'badge-pending');

    if (D.drawerStatusSelect) D.drawerStatusSelect.value = status;
    if (D.drawerNoteInput) D.drawerNoteInput.value = r[COL.note] || r._hrNote || '';
    if (D.btnSaveEvaluation) D.btnSaveEvaluation.dataset.candId = r[COL.id] || '';

    // CV & Portfolio buttons
    const cv = r[COL.cv];
    if (cv && cv.startsWith('http')) {
      D.drawerCvLink.href = cv;
      D.drawerCvLink.classList.remove('disabled');
    } else {
      D.drawerCvLink.removeAttribute('href');
      D.drawerCvLink.classList.add('disabled');
    }

    const port = r[COL.port];
    if (port && port.startsWith('http')) {
      D.drawerPortLink.href = port;
      D.drawerPortLink.classList.remove('disabled');
    } else {
      D.drawerPortLink.removeAttribute('href');
      D.drawerPortLink.classList.add('disabled');
    }

    // Result Report Links
    const resultUrl = `/?result=${encodeURIComponent(r[COL.id] ?? '')}`;
    if (D.drawerResultLink) {
      D.drawerResultLink.href = resultUrl;
    }
    if (D.btnShowResultModal) {
      D.btnShowResultModal.onclick = () => openResultModal(r[COL.id], r[COL.name]);
    }

    // DISC profiles
    D.drawerPubSelf.textContent  = r[COL.pub] ?? '—';
    D.drawerPrivSelf.textContent = r[COL.priv] ?? '—';
    D.drawerCoreSelf.textContent = r[COL.core] ?? '—';

    // Detailed scores (D, I, S, C)
    D.scoreDMost.textContent   = r[COL.dMost] ?? '0';
    D.scoreIMost.textContent   = r[COL.iMost] ?? '0';
    D.scoreSMost.textContent   = r[COL.sMost] ?? '0';
    D.scoreCMost.textContent   = r[COL.cMost] ?? '0';

    D.scoreDLeast.textContent  = r[COL.dLeast] ?? '0';
    D.scoreILeast.textContent  = r[COL.iLeast] ?? '0';
    D.scoreSLeast.textContent  = r[COL.sLeast] ?? '0';
    D.scoreCLeast.textContent  = r[COL.cLeast] ?? '0';

    D.scoreDChange.textContent = r[COL.dChange] ?? '0';
    D.scoreIChange.textContent = r[COL.iChange] ?? '0';
    D.scoreSChange.textContent = r[COL.sChange] ?? '0';
    D.scoreCChange.textContent = r[COL.cChange] ?? '0';

    // Open animations
    D.drawerBackdrop.classList.remove('hidden');
    D.detailDrawer.classList.remove('hidden');
  }

  function closeDrawer() {
    D.drawerBackdrop.classList.add('hidden');
    D.detailDrawer.classList.add('hidden');
  }

  D.btnDrawerClose.addEventListener('click', closeDrawer);
  D.drawerBackdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDrawer();
      closeResultModal();
    }
  });

  // Theme toggle listener
  const toggleTheme = () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const next = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('disc-theme', next);
  };

  if (D.themeToggle) D.themeToggle.addEventListener('click', toggleTheme);
  if (D.themeToggleDash) D.themeToggleDash.addEventListener('click', toggleTheme);

  /* ══════════════════════════════════════════════
     EVALUATION OVERRIDES & CLOUD SYNC LOGIC
     ══════════════════════════════════════════════ */
  function applyLocalOverrides(rows) {
    const overrides = JSON.parse(localStorage.getItem('hr_candidate_overrides') || '{}');
    rows.forEach(r => {
      const cid = r[COL.id];
      if (cid && overrides[cid]) {
        if (overrides[cid].status) r[COL.status] = overrides[cid].status;
        if (overrides[cid].note !== undefined) {
          r[COL.note] = overrides[cid].note;
          r._hrNote = overrides[cid].note;
        }
      }
    });
  }

  if (D.btnSaveEvaluation) {
    D.btnSaveEvaluation.addEventListener('click', async () => {
      const candId = D.btnSaveEvaluation.dataset.candId;
      if (!candId) return;

      const newStatus = D.drawerStatusSelect ? D.drawerStatusSelect.value : 'Pending';
      const newNote   = D.drawerNoteInput ? D.drawerNoteInput.value.trim() : '';

      // 1. Save locally immediately (Zero latency persistence)
      const overrides = JSON.parse(localStorage.getItem('hr_candidate_overrides') || '{}');
      overrides[candId] = {
        status: newStatus,
        note: newNote,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('hr_candidate_overrides', JSON.stringify(overrides));

      // 2. Update current in-memory row
      const targetRow = state.allRows.find(r => r[COL.id] === candId);
      if (targetRow) {
        targetRow[COL.status] = newStatus;
        targetRow[COL.note] = newNote;
        targetRow._hrNote = newNote;
      }

      // 3. Update UI badges immediately
      if (D.drawerStatus) {
        D.drawerStatus.textContent = newStatus;
        D.drawerStatus.className = 'badge ' + ({
          'Pending': 'badge-pending',
          'Reviewed': 'badge-reviewed',
          'Hired': 'badge-hired',
          'Rejected': 'badge-rejected',
        }[newStatus] || 'badge-pending');
      }

      renderAll(); // Re-render table, badges, note column, and stats instantly!

      if (D.drawerSaveIndicator) {
        D.drawerSaveIndicator.style.display = 'inline';
        D.drawerSaveIndicator.style.color = '#fbbf24';
        D.drawerSaveIndicator.textContent = '⏳ Saving status & note...';
      }

      // 4. Sync to API backend (/api/update-status)
      try {
        const res = await fetch('/api/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate_id: candId,
            status: newStatus,
            note: newNote
          })
        });
        const data = await res.json();
        if (D.drawerSaveIndicator) {
          if (res.ok && data.status === 'success') {
            D.drawerSaveIndicator.style.color = '#34d399';
            D.drawerSaveIndicator.textContent = '✔️ Saved & Synced to Google Sheets!';
          } else {
            D.drawerSaveIndicator.style.color = '#60a5fa';
            D.drawerSaveIndicator.textContent = '✔️ Saved Locally (Cloud standby)';
          }
        }
      } catch (err) {
        console.warn('Cloud sync error (saved locally):', err);
        if (D.drawerSaveIndicator) {
          D.drawerSaveIndicator.style.color = '#60a5fa';
          D.drawerSaveIndicator.textContent = '✔️ Saved Locally';
        }
      }

      setTimeout(() => {
        if (D.drawerSaveIndicator) D.drawerSaveIndicator.style.display = 'none';
      }, 4000);
    });
  }

  /* ══════════════════════════════════════════════
     RESULT PREVIEW MODAL LOGIC
     ══════════════════════════════════════════════ */
  function openResultModal(candId, candName) {
    if (!candId) return;
    const resultUrl = `/?result=${encodeURIComponent(candId)}`;
    if (D.resultModalTitle) D.resultModalTitle.textContent = `Result Report: ${candName || candId} (${candId})`;
    if (D.btnModalOpenTab) D.btnModalOpenTab.href = resultUrl;
    if (D.resultIframe) D.resultIframe.src = resultUrl;
    if (D.resultModalBackdrop) D.resultModalBackdrop.classList.remove('hidden');
    if (D.resultModal) D.resultModal.classList.remove('hidden');
  }

  function closeResultModal() {
    if (D.resultModalBackdrop) D.resultModalBackdrop.classList.add('hidden');
    if (D.resultModal) D.resultModal.classList.add('hidden');
    if (D.resultIframe) D.resultIframe.src = '';
  }

  if (D.btnResultModalClose) D.btnResultModalClose.addEventListener('click', closeResultModal);
  if (D.resultModalBackdrop) D.resultModalBackdrop.addEventListener('click', closeResultModal);

  /* ══════════════════════════════════════════════
     AUTO-UNLOCK SESSION CHECK
     ══════════════════════════════════════════════ */
  if (sessionStorage.getItem('hr_dash_unlocked') === 'true') {
    unlock();
  }

})();
