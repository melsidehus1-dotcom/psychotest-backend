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
    // Biodata
    form:            qs('biodataForm'),
    inputName:       qs('inputName'),
    inputEmail:      qs('inputEmail'),
    inputPosition:   qs('inputPosition'),
    inputCV:         qs('inputCV'),
    inputPortfolio:  qs('inputPortfolio'),
    btnContinue:     qs('btnContinue'),
    // Instructions
    btnStartTest:    qs('btnStartTest'),
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
      el.addEventListener('change', () => {
        clearError(el);
        if (el.tagName === 'SELECT' && el.value) {
          el.closest('.input-group').classList.add('has-value');
        }
      });
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

  /* ── Radio change handler ──────────────────── */
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
    goTo('view-result');
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
  }

  /* ══════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════ */
  async function init() {
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
