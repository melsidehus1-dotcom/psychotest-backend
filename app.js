/* ============================================
   DISC Assessment — App Logic v2
   Bug fixes + polished UX
   ============================================ */

(function () {
  'use strict';

  /* ── Config ────────────────────────────────── */
  const API_URL     = '/api/submit';
  const Q_JSON_URL  = '/disc_questions.json';

  /* ── State ─────────────────────────────────── */
  const state = {
    view:        'view-welcome',
    questions:   [],
    currentQ:    0,
    most:        [],   // 1-based statement index per question
    least:       [],
    biodata:     { name:'', email:'', position:'', cv_link:'', portfolio_link:'' },
    submitting:  false,
    submitted:   false,
  };

  /* ── Helpers ───────────────────────────────── */
  const qs   = id  => document.getElementById(id);
  const qsa  = sel => document.querySelectorAll(sel);

  /* ── DOM refs (by new HTML IDs) ────────────── */
  const D = {
    // Welcome
    btnStart:        qs('btnStart'),
    btnShowSearch:   qs('btnShowSearch'),
    searchBoxWelcome:qs('searchBoxWelcome'),
    inputSearchId:   qs('inputSearchId'),
    btnDoSearch:     qs('btnDoSearch'),
    // Biodata
    form:            qs('biodataForm'),
    inputName:       qs('inputName'),
    inputEmail:      qs('inputEmail'),
    inputPosition:   qs('inputPosition'),
    inputCV:         qs('inputCV'),
    inputPortfolio:  qs('inputPortfolio'),
    btnContinue:     qs('btnContinue'),
    btnBackToWelcome:qs('btnBackToWelcome'),
    // Instructions
    btnStartTest:    qs('btnStartTest'),
    btnBackToBiodata:qs('btnBackToBiodata'),
    // Test
    qNum:            qs('qNum'),
    qTotal:          qs('qTotal'),
    progressFill:    qs('progressFill'),
    qPercent:        qs('qPercent'),
    questionCard:    qs('questionCard'),
    stmtBody:        qs('stmtBody'),
    btnPrev:         qs('btnPrev'),
    btnNext:         qs('btnNext'),
    navStatus:       qs('navStatus'),
    // Result
    resultId:        qs('resultId'),
    profilePublic:   qs('profilePublic'),
    profilePrivate:  qs('profilePrivate'),
    profileCore:     qs('profileCore'),
    // Result DISC scores
    discTypeCode:    qs('discTypeCode'),
    discTypeName:    qs('discTypeName'),
    discTypeDesc:    qs('discTypeDesc'),
    pctD: qs('pctD'), pctI: qs('pctI'), pctS: qs('pctS'), pctC: qs('pctC'),
    barD: qs('barD'), barI: qs('barI'), barS: qs('barS'), barC: qs('barC'),
    barPctD: qs('barPctD'), barPctI: qs('barPctI'), barPctS: qs('barPctS'), barPctC: qs('barPctC'),
    scoreD: qs('scoreD'), scoreI: qs('scoreI'), scoreS: qs('scoreS'), scoreC: qs('scoreC'),
    discWheel:       qs('discWheel'),
    // UI
    toastStack:      qs('toastStack'),
    loadingVeil:     qs('loadingVeil'),
  };

  /* ══════════════════════════════════════════════
     VIEW ROUTER
     ══════════════════════════════════════════════ */
  function goTo(viewId) {
    qsa('.view').forEach(v => v.classList.remove('active'));
    const target = qs(viewId);
    if (!target) return;
    // force animation restart
    target.style.animation = 'none';
    target.offsetHeight;          // reflow
    target.style.animation = '';
    target.classList.add('active');
    state.view = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════════════
     TOAST
     ══════════════════════════════════════════════ */
  const TOAST_ICONS = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };

  function toast(msg, type = 'success', ms = 3500) {
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] ?? '💬'}</span><span>${msg}</span>`;
    D.toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, ms);
  }

  /* ══════════════════════════════════════════════
     LOADING VEIL
     ══════════════════════════════════════════════ */
  function setLoading(on) {
    D.loadingVeil.classList.toggle('active', on);
  }

  /* ══════════════════════════════════════════════
     FORM VALIDATION
     ══════════════════════════════════════════════ */
  function setFieldError(inputEl, hasError) {
    const grp = inputEl.closest('.input-group');
    grp.classList.toggle('error', hasError);
  }

  function clearError(inputEl) { setFieldError(inputEl, false); }

  function validateForm() {
    let ok = true;
    const name  = D.inputName.value.trim();
    const email = D.inputEmail.value.trim();
    const pos   = D.inputPosition.value;

    if (!name)                                          { setFieldError(D.inputName, true);     ok = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                                                        { setFieldError(D.inputEmail, true);    ok = false; }
    if (!pos)                                           { setFieldError(D.inputPosition, true); ok = false; }

    if (ok) {
      state.biodata = {
        name,
        email,
        position:       pos,
        cv_link:        D.inputCV.value.trim(),
        portfolio_link: D.inputPortfolio.value.trim(),
      };
    }
    return ok;
  }

  function setupFormListeners() {
    [D.inputName, D.inputEmail, D.inputPosition, D.inputCV, D.inputPortfolio].forEach(el => {
      if (!el) return;
      el.addEventListener('input',  () => clearError(el));
      el.addEventListener('change', () => clearError(el));
    });
  }

  /* ══════════════════════════════════════════════
     LOAD QUESTIONS
     ══════════════════════════════════════════════ */
  async function loadQuestions() {
    try {
      const res = await fetch(Q_JSON_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.questions = await res.json();
      const n = state.questions.length;
      state.most  = new Array(n).fill(null);
      state.least = new Array(n).fill(null);
      D.qTotal.textContent = n;
    } catch (e) {
      console.error('Failed to load questions', e);
      toast('Failed to load test questions — please refresh.', 'error', 6000);
    }
  }

  /* ══════════════════════════════════════════════
     RENDER QUESTION
     ══════════════════════════════════════════════ */
  function renderQuestion(dir = 'none') {
    const idx = state.currentQ;
    const q   = state.questions[idx];
    if (!q) return;

    const selMost  = state.most[idx];
    const selLeast = state.least[idx];
    const total    = state.questions.length;
    const pct      = Math.round(((idx + 1) / total) * 100);

    // Update chrome
    D.qNum.textContent          = idx + 1;
    D.progressFill.style.width  = `${(idx + 1) / total * 100}%`;
    D.qPercent.textContent      = `${pct}%`;

    const doRender = () => buildRows(q, idx, selMost, selLeast);

    if (dir === 'none') {
      doRender();
      updateNav();
      return;
    }

    // Slide animation: wait for out-anim, then swap content & slide in
    const outClass = dir === 'next' ? 'slide-out-left' : 'slide-out-right';
    const inClass  = dir === 'next' ? 'slide-in-right' : 'slide-in-left';

    D.questionCard.classList.add(outClass);

    const onEnd = () => {
      D.questionCard.removeEventListener('animationend', onEnd);
      D.questionCard.classList.remove(outClass);
      doRender();
      updateNav();
      D.questionCard.classList.add(inClass);
      D.questionCard.addEventListener('animationend', () => {
        D.questionCard.classList.remove(inClass);
      }, { once: true });
    };

    D.questionCard.addEventListener('animationend', onEnd, { once: true });
  }

  /* ── Build table rows ──────────────────────── */
  function buildRows(q, idx, selMost, selLeast) {
    let html = '';

    q.statements.forEach((stmt, si) => {
      const val  = si + 1; // 1-based
      const isMostSel   = selMost  === val;
      const isLeastSel  = selLeast === val;
      const mostDis     = selLeast === val;   // this row is chosen as Least → disable Most
      const leastDis    = selMost  === val;   // this row is chosen as Most → disable Least

      let rowClass = 'stmt-row';
      if (isMostSel)  rowClass += ' row-most-selected';
      if (isLeastSel) rowClass += ' row-least-selected';

      html += `
        <tr class="${rowClass}">
          <td>${escHtml(stmt.text)}</td>
          <td>
            <label class="c-radio type-most${mostDis ? ' is-disabled' : ''}">
              <input type="radio" name="most-${idx}" value="${val}"
                ${isMostSel ? 'checked' : ''}
                ${mostDis   ? 'disabled' : ''}
                data-q="${idx}" data-t="most"
                aria-label="Most like me: ${escHtml(stmt.text)}">
              <span class="radio-dot"></span>
              <span class="mob-label">Most</span>
            </label>
          </td>
          <td>
            <label class="c-radio type-least${leastDis ? ' is-disabled' : ''}">
              <input type="radio" name="least-${idx}" value="${val}"
                ${isLeastSel ? 'checked' : ''}
                ${leastDis   ? 'disabled' : ''}
                data-q="${idx}" data-t="least"
                aria-label="Least like me: ${escHtml(stmt.text)}">
              <span class="radio-dot"></span>
              <span class="mob-label">Least</span>
            </label>
          </td>
        </tr>`;
    });

    D.stmtBody.innerHTML = html;

    // Wire change events
    D.stmtBody.querySelectorAll('input[type="radio"]').forEach(r => {
      r.addEventListener('change', onRadioChange);
    });
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Radio change handler ──────────── */
  let autoAdvanceTimer = null;

  function onRadioChange(e) {
    const r   = e.target;
    const idx = parseInt(r.dataset.q, 10);
    const t   = r.dataset.t;   // 'most' | 'least'
    const val = parseInt(r.value, 10);

    state[t][idx] = val;

    // Re-build rows to update conflict states (no animation)
    const q = state.questions[idx];
    buildRows(q, idx, state.most[idx], state.least[idx]);
    updateNav();

    // Auto-advance when both most and least are chosen
    const hasMost  = state.most[idx]  !== null;
    const hasLeast = state.least[idx] !== null;
    const isLast   = idx === state.questions.length - 1;

    if (hasMost && hasLeast && !isLast) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = setTimeout(() => {
        // Only advance if still on the same question
        if (state.currentQ === idx && !isLast) {
          next();
        }
      }, 300);
    }
  }

  /* ── Update nav buttons & status ──────────── */
  function updateNav() {
    const idx     = state.currentQ;
    const hasMost  = state.most[idx]  !== null;
    const hasLeast = state.least[idx] !== null;
    const complete = hasMost && hasLeast;
    const isFirst  = idx === 0;
    const isLast   = idx === state.questions.length - 1;

    D.btnPrev.disabled = isFirst;
    D.btnNext.disabled = !complete;

    if (isLast && complete) {
      D.btnNext.textContent = 'Submit ✓';
    } else {
      D.btnNext.textContent = 'Next →';
    }

    // Status text
    if (complete) {
      const done = state.most.filter(v => v !== null).length;
      D.navStatus.textContent = `${done} of ${state.questions.length} answered`;
      D.navStatus.className = 'nav-status complete';
    } else {
      const missing = [];
      if (!hasMost)  missing.push('"Most"');
      if (!hasLeast) missing.push('"Least"');
      D.navStatus.textContent = `Select ${missing.join(' & ')} to continue`;
      D.navStatus.className = 'nav-status';
    }
  }

  /* ══════════════════════════════════════════════
     NAVIGATION
     ══════════════════════════════════════════════ */
  function next() {
    const isLast = state.currentQ === state.questions.length - 1;
    if (isLast) {
      submit();
    } else {
      state.currentQ++;
      renderQuestion('next');
    }
  }

  function prev() {
    if (state.currentQ > 0) {
      state.currentQ--;
      renderQuestion('prev');
    }
  }

  /* ══════════════════════════════════════════════
     SUBMIT
     ══════════════════════════════════════════════ */
  async function submit() {
    if (state.submitting || state.submitted) return;

    // Check all answered
    const missed = [];
    for (let i = 0; i < state.questions.length; i++) {
      if (state.most[i] === null || state.least[i] === null) missed.push(i + 1);
    }
    if (missed.length) {
      toast(`Please complete question(s): ${missed.slice(0,5).join(', ')}${missed.length > 5 ? '…' : ''}`, 'warning', 5000);
      state.currentQ = missed[0] - 1;
      renderQuestion('none');
      return;
    }

    state.submitting = true;
    setLoading(true);

    const payload = {
      name:                       state.biodata.name,
      email:                      state.biodata.email,
      position:                   state.biodata.position,
      cv_link:                    state.biodata.cv_link,
      portfolio_link:             state.biodata.portfolio_link,
      cognitive_score:            0,
      cognitive_duration_seconds: 0,
      disc_most:                  state.most,
      disc_least:                 state.least,
    };

    try {
      const res  = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || `Server error ${res.status}`);
      }

      state.submitted = true;
      showResult(data);
      toast('Assessment submitted successfully!', 'success', 4000);

    } catch (err) {
      console.error('Submit failed:', err);
      toast(`Submission failed: ${err.message}`, 'error', 6000);
      state.submitting = false;
    } finally {
      setLoading(false);
    }
  }

  /* ── Render result screen ──────────────────── */
  function showResult(data) {
    D.resultId.textContent       = data.candidate_id         ?? '—';
    D.profilePublic.textContent  = data.disc_profile?.public_self  ?? '—';
    D.profilePrivate.textContent = data.disc_profile?.private_self ?? '—';
    D.profileCore.textContent    = data.disc_profile?.core_self    ?? '—';

    // Populate DISC scores if available
    const scores = data.disc_scores;
    if (scores) {
      const total = scores.D + scores.I + scores.S + scores.C;
      const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
      const dP = pct(scores.D), iP = pct(scores.I), sP = pct(scores.S), cP = pct(scores.C);

      // Highlight the dominant type cell
      const max = Math.max(dP, iP, sP, cP);
      const dominant = dP === max ? 'D' : iP === max ? 'I' : sP === max ? 'S' : 'C';

      // Set score grid
      D.pctD.textContent = `${dP}%`;
      D.pctI.textContent = `${iP}%`;
      D.pctS.textContent = `${sP}%`;
      D.pctC.textContent = `${cP}%`;
      if (D.scoreD) D.scoreD.classList.toggle('is-dominant', dominant === 'D');
      if (D.scoreI) D.scoreI.classList.toggle('is-dominant', dominant === 'I');
      if (D.scoreS) D.scoreS.classList.toggle('is-dominant', dominant === 'S');
      if (D.scoreC) D.scoreC.classList.toggle('is-dominant', dominant === 'C');

      // Animate bars with a staggered delay
      const bars = [
        { el: D.barD, pct: D.barPctD, val: dP },
        { el: D.barI, pct: D.barPctI, val: iP },
        { el: D.barS, pct: D.barPctS, val: sP },
        { el: D.barC, pct: D.barPctC, val: cP },
      ];
      bars.forEach(({ el, pct, val }, i) => {
        setTimeout(() => {
          if (el) el.style.width = `${val}%`;
          if (pct) pct.textContent = `${val}%`;
        }, 400 + i * 120);
      });

      // Populate DISC type card
      const typeMap = { D: 'Dominant', I: 'Influential', S: 'Steady', C: 'Conscientious' };
      const descMap = {
        D: 'You are results-driven and decisive. You thrive on challenges, take charge in high-pressure situations, and are motivated by achieving tangible results.',
        I: 'You are enthusiastic and optimistic. You excel at building relationships, inspiring others, and creating an energetic atmosphere in the workplace.',
        S: 'You are patient and dependable. You value harmony, consistency, and genuine connection. You are a trusted team member who listens deeply and creates a stable environment.',
        C: 'You are analytical and precise. You value accuracy, quality, and systematic thinking. You excel in roles requiring careful research and thorough attention to detail.',
      };
      if (D.discTypeCode) D.discTypeCode.textContent = dominant;
      if (D.discTypeName) D.discTypeName.textContent = typeMap[dominant];
      if (D.discTypeDesc) D.discTypeDesc.textContent = descMap[dominant];

      // Draw wheel
      drawDiscWheel(dP, iP, sP, cP, dominant);
    }

    goTo('view-result');
  }

  /* ── Draw DISC Wheel (canvas) ──────── */
  function drawDiscWheel(d, i, s, c, dominant) {
    const canvas = D.discWheel;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 70, cy = 70, r = 58, innerR = 24;
    const segments = [
      { val: d, color: '#ef4444', label: 'D' },  // red
      { val: i, color: '#f59e0b', label: 'I' },  // amber
      { val: s, color: '#22c55e', label: 'S' },  // green
      { val: c, color: '#3b82f6', label: 'C' },  // blue
    ];
    const total = d + i + s + c || 1;
    let startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    segments.forEach(seg => {
      const slice = (seg.val / total) * 2 * Math.PI;
      const isDom = seg.label === dominant;
      const outerR = isDom ? r + 8 : r;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = isDom ? seg.color : seg.color + '66';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,15,30,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle += slice;
    });

    // Draw inner circle (donut hole)
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = 'hsl(228,28%,8%)';
    ctx.fill();

    // Draw dominant letter
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dominant, cx, cy);
  }

  /* ══════════════════════════════════════════════
     KEYBOARD NAVIGATION
     ══════════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    if (state.view !== 'view-disc-test') return;
    if (e.key === 'ArrowRight' && !D.btnNext.disabled) { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft'  && !D.btnPrev.disabled) { e.preventDefault(); prev(); }
  });

  /* ══════════════════════════════════════════════
     EVENT BINDINGS
     ══════════════════════════════════════════════ */
  function bindEvents() {
    D.btnStart.addEventListener('click', () => goTo('view-biodata'));
    if (D.btnBackToWelcome) {
      D.btnBackToWelcome.addEventListener('click', () => goTo('view-welcome'));
    }
    if (D.btnBackToBiodata) {
      D.btnBackToBiodata.addEventListener('click', () => goTo('view-biodata'));
    }

    D.form.addEventListener('submit', e => {
      e.preventDefault();
      if (validateForm()) {
        goTo('view-instructions');
      } else {
        toast('Please fill in all required fields.', 'warning');
      }
    });

    D.btnStartTest.addEventListener('click', () => {
      if (!state.questions.length) {
        toast('Questions are still loading — please wait a moment.', 'warning');
        return;
      }
      state.currentQ = 0;
      goTo('view-disc-test');
      renderQuestion('none');
    });

    D.btnNext.addEventListener('click', next);
    D.btnPrev.addEventListener('click', prev);

    // Theme toggle
    const themeBtn = qs('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const next = isLight ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('disc-theme', next);
      });
    }

    // Search toggle
    if (D.btnShowSearch && D.searchBoxWelcome) {
      D.btnShowSearch.addEventListener('click', () => {
        const isHidden = D.searchBoxWelcome.classList.contains('hidden');
        if (isHidden) {
          D.searchBoxWelcome.classList.remove('hidden');
          D.btnShowSearch.innerHTML = '▲ Hide Search';
          D.inputSearchId.focus();
        } else {
          D.searchBoxWelcome.classList.add('hidden');
          D.btnShowSearch.innerHTML = 'View My Profile <span class="p360-arrow">→</span>';
        }
      });
    }

    // Do search lookup
    if (D.btnDoSearch) {
      D.btnDoSearch.addEventListener('click', async () => {
        const queryId = D.inputSearchId.value.trim();
        if (!queryId) {
          toast('Please enter a Candidate ID.', 'warning');
          return;
        }

        setLoading(true);
        try {
          const res = await fetch(`/api/get-result?id=${encodeURIComponent(queryId)}`);
          const data = res.ok ? await res.json() : null;

          if (!res.ok || !data || data.status !== 'success') {
            const msg = (data && data.message) ? data.message : `Candidate ID not found.`;
            throw new Error(msg);
          }

          toast('Results retrieved successfully!', 'success', 3000);
          showResult(data);

        } catch (err) {
          console.error('Search failed:', err);
          toast(err.message || 'Retrieval failed — please verify Candidate ID.', 'error', 5000);
        } finally {
          setLoading(false);
        }
      });
    }
  }

  /* ══════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════ */
  async function init() {
    // Apply saved theme immediately (before render) to avoid flash
    const savedTheme = localStorage.getItem('disc-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    setupFormListeners();
    bindEvents();
    await loadQuestions();   // pre-fetch questions in background
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
