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
    resultName:      qs('resultName'),
    resultPos:       qs('resultPos'),
    resultDate:      qs('resultDate'),
    resultDuration:  qs('resultDuration'),
    profilePublic:   qs('profilePublic'),
    profilePublicCode: qs('profilePublicCode'),
    profilePublicDesc: qs('profilePublicDesc'),
    profilePublicChars: qs('profilePublicChars'),
    profilePrivate:  qs('profilePrivate'),
    profilePrivateCode: qs('profilePrivateCode'),
    profilePrivateDesc: qs('profilePrivateDesc'),
    profilePrivateChars: qs('profilePrivateChars'),
    profileCore:     qs('profileCore'),
    profileCoreCode: qs('profileCoreCode'),
    profileCoreDesc: qs('profileCoreDesc'),
    profileCoreChars: qs('profileCoreChars'),
    // Result DISC scores
    discTypeCode:    qs('discTypeCode'),
    discTypeName:    qs('discTypeName'),
    discTypeDesc:    qs('discTypeDesc'),
    discTypeAbout:   qs('discTypeAbout'),
    pctD: qs('pctD'), pctI: qs('pctI'), pctS: qs('pctS'), pctC: qs('pctC'),
    barD: qs('barD'), barI: qs('barI'), barS: qs('barS'), barC: qs('barC'),
    barPctD: qs('barPctD'), barPctI: qs('barPctI'), barPctS: qs('barPctS'), barPctC: qs('barPctC'),
    scoreD: qs('scoreD'), scoreI: qs('scoreI'), scoreS: qs('scoreS'), scoreC: qs('scoreC'),
    spectrumD: qs('spectrumD'), spectrumI: qs('spectrumI'), spectrumS: qs('spectrumS'), spectrumC: qs('spectrumC'),
    discWheel:       qs('discWheel'),
    wheelCenterBadge: qs('wheelCenterBadge'),
    // Hero Badges & Keywords
    badgeHeroPrimary: qs('badgeHeroPrimary'),
    heroPrimaryLetter: qs('heroPrimaryLetter'),
    heroPrimaryName: qs('heroPrimaryName'),
    badgeHeroSecondary: qs('badgeHeroSecondary'),
    heroSecondaryLetter: qs('heroSecondaryLetter'),
    heroSecondaryName: qs('heroSecondaryName'),
    discHeroKeywords: qs('discHeroKeywords'),
    // At a Glance & 2x2 Info Grid
    discAtAGlanceText: qs('discAtAGlanceText'),
    discAtAGlanceList: qs('discAtAGlanceList'),
    discHowYouWorkText: qs('discHowYouWorkText'),
    discWhatToWatchText: qs('discWhatToWatchText'),
    discYourStrengthText: qs('discYourStrengthText'),
    discBestInText: qs('discBestInText'),
    // Summary Badges
    summaryPrimaryName: qs('summaryPrimaryName'),
    summarySecondaryName: qs('summarySecondaryName'),
    // 4 Domains Grid
    discDomainDecision: qs('discDomainDecision'),
    discDomainCommunication: qs('discDomainCommunication'),
    discDomainRelationships: qs('discDomainRelationships'),
    discDomainEnvironment: qs('discDomainEnvironment'),
    btnCopyId: qs('btnCopyId'),
    // Enrichment containers & actions
    strengthsContainer: qs('strengthsContainer'),
    watchOutsContainer: qs('watchOutsContainer'),
    whatThisMeansText:  qs('whatThisMeansText'),
    btnPrintReport:     qs('btnPrintReport'),
    btnFinishTest:      qs('btnFinishTest'),
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

    const updateChrome = () => {
      D.qNum.textContent          = idx + 1;
      D.progressFill.style.width  = `${(idx + 1) / total * 100}%`;
      D.qPercent.textContent      = `${pct}%`;
    };

    const doRender = () => {
      updateChrome();
      buildRows(q, idx, selMost, selLeast);
    };

    if (dir === 'none') {
      doRender();
      updateNav();
      return;
    }

    // Slide animation: wait for out-anim, then swap content & slide in
    const outClass = dir === 'next' ? 'slide-out-left' : 'slide-out-right';
    const inClass  = dir === 'next' ? 'slide-in-right' : 'slide-in-left';

    D.questionCard.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-right', 'slide-in-left');
    D.questionCard.classList.add(outClass);

    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      D.questionCard.removeEventListener('animationend', onEnd);
      D.questionCard.classList.remove(outClass);
      doRender();
      updateNav();
      D.questionCard.classList.add(inClass);
      
      let inEnded = false;
      const onInEnd = () => {
        if (inEnded) return;
        inEnded = true;
        D.questionCard.removeEventListener('animationend', onInEnd);
        D.questionCard.classList.remove(inClass);
      };
      D.questionCard.addEventListener('animationend', onInEnd, { once: true });
      setTimeout(onInEnd, 300);
    };

    D.questionCard.addEventListener('animationend', onEnd, { once: true });
    setTimeout(onEnd, 220);
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
                aria-label="Paling Sesuai: ${escHtml(stmt.text)}">
              <span class="radio-dot"></span>
              <span class="mob-label">MOST</span>
            </label>
          </td>
          <td>
            <label class="c-radio type-least${leastDis ? ' is-disabled' : ''}">
              <input type="radio" name="least-${idx}" value="${val}"
                ${isLeastSel ? 'checked' : ''}
                ${leastDis   ? 'disabled' : ''}
                data-q="${idx}" data-t="least"
                aria-label="Kurang Sesuai: ${escHtml(stmt.text)}">
              <span class="radio-dot"></span>
              <span class="mob-label">LEAST</span>
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
      D.btnNext.textContent = 'Kirim ✓';
    } else {
      D.btnNext.textContent = 'Selanjutnya →';
    }

    // Status text
    if (complete) {
      const done = state.most.filter(v => v !== null).length;
      D.navStatus.textContent = `${done} dari ${state.questions.length} terjawab`;
      D.navStatus.className = 'nav-status complete';
    } else {
      const missing = [];
      if (!hasMost)  missing.push('"MOST"');
      if (!hasLeast) missing.push('"LEAST"');
      D.navStatus.textContent = `Pilih jawaban ${missing.join(' & ')} untuk melanjutkan`;
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
    const prof = data.disc_profile || {};
    const scores = data.disc_scores || { D: 0, I: 0, S: 0, C: 0 };

    // 1. Candidate Metadata & ID
    if (D.resultId) D.resultId.textContent = data.candidate_id ?? '—';
    if (D.resultName) D.resultName.textContent = data.name || state.candidateName || 'Candidate';
    if (D.resultPos) D.resultPos.textContent = data.position || state.candidatePos || 'General Applicant';
    if (D.resultDate) {
      const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      D.resultDate.textContent = dateStr;
    }
    if (D.resultDuration) {
      const ds = data.duration_seconds || state.durationSeconds || 0;
      const mins = Math.floor(ds / 60);
      const secs = ds % 60;
      D.resultDuration.textContent = ds > 0 ? `${mins}m ${secs}s` : '—';
    }

    // 2. Behavioral Profiles (The 3 Dimensions)
    function populateTile(codeEl, nameEl, descEl, charsEl, code, name, desc, chars) {
      if (name && name.trim().toUpperCase() === 'PENGAMBIL KEPUTUSAN') name = 'DECISION MAKER';
      if (codeEl) codeEl.textContent = code || '—';
      if (nameEl) nameEl.textContent = name || '—';
      if (descEl) descEl.textContent = desc || 'No description available.';
      if (charsEl) {
        if (chars && chars.length > 0) {
          charsEl.innerHTML = chars.map(c => `<span class="trait-chip">${c}</span>`).join('');
        } else {
          charsEl.innerHTML = '<span class="trait-chip">—</span>';
        }
      }
    }

    populateTile(D.profilePublicCode, D.profilePublic, D.profilePublicDesc, D.profilePublicChars,
      prof.public_self_code, prof.public_self, prof.public_self_desc, prof.public_self_chars);
    populateTile(D.profilePrivateCode, D.profilePrivate, D.profilePrivateDesc, D.profilePrivateChars,
      prof.private_self_code, prof.private_self, prof.private_self_desc, prof.private_self_chars);
    populateTile(D.profileCoreCode, D.profileCore, D.profileCoreDesc, D.profileCoreChars,
      prof.core_self_code, prof.core_self, prof.core_self_desc, prof.core_self_chars);

    // 3. Calculate Scores & Intensity Spectrum
    const total = (scores.D || 0) + (scores.I || 0) + (scores.S || 0) + (scores.C || 0);
    const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
    const dP = pct(scores.D), iP = pct(scores.I), sP = pct(scores.S), cP = pct(scores.C);

    const max = Math.max(dP, iP, sP, cP);
    const dominant = dP === max ? 'D' : iP === max ? 'I' : sP === max ? 'S' : 'C';

    if (D.pctD) D.pctD.textContent = `${dP}%`;
    if (D.pctI) D.pctI.textContent = `${iP}%`;
    if (D.pctS) D.pctS.textContent = `${sP}%`;
    if (D.pctC) D.pctC.textContent = `${cP}%`;

    if (D.scoreD) D.scoreD.classList.toggle('is-dominant', dominant === 'D');
    if (D.scoreI) D.scoreI.classList.toggle('is-dominant', dominant === 'I');
    if (D.scoreS) D.scoreS.classList.toggle('is-dominant', dominant === 'S');
    if (D.scoreC) D.scoreC.classList.toggle('is-dominant', dominant === 'C');

    function setSpectrum(el, val) {
      if (!el) return;
      if (val >= 35) {
        el.className = 'disc-spectrum-badge spectrum-high';
        el.textContent = 'High Intensity';
      } else if (val >= 20) {
        el.className = 'disc-spectrum-badge spectrum-mid';
        el.textContent = 'Moderate';
      } else {
        el.className = 'disc-spectrum-badge spectrum-low';
        el.textContent = 'Low Intensity';
      }
    }
    setSpectrum(D.spectrumD, dP);
    setSpectrum(D.spectrumI, iP);
    setSpectrum(D.spectrumS, sP);
    setSpectrum(D.spectrumC, cP);

    // Animate bars with staggered delay
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

    // 4. YOUR DISC TYPE Card (Hero) & Primary/Secondary Badges
    const typeMap = { D: 'Dominant (D)', I: 'Influencing (I)', S: 'Steady (S)', C: 'Conscientious (C)' };
    const descMap = {
      D: 'You are results-driven and decisive. You thrive on challenges, take charge in high-pressure situations, and are motivated by achieving tangible results.',
      I: 'You are enthusiastic and optimistic. You excel at building relationships, inspiring others, and creating an energetic atmosphere in the workplace.',
      S: 'You are patient and dependable. You value harmony, consistency, and genuine connection. You are a trusted team member who listens deeply and creates a stable environment.',
      C: 'You are analytical and precise. You value accuracy, quality, and systematic thinking. You excel in roles requiring careful research and thorough attention to detail.',
    };

    // Find secondary style
    const scorePairs = [
      { key: 'D', val: dP },
      { key: 'I', val: iP },
      { key: 'S', val: sP },
      { key: 'C', val: cP }
    ].sort((a, b) => b.val - a.val);
    const primaryKey = scorePairs[0].key;
    const secondaryKey = scorePairs[1] && scorePairs[1].val > 0 ? scorePairs[1].key : primaryKey;

    if (prof && prof.core_self && prof.core_self !== 'UNKNOWN' && prof.core_self !== '—') {
      const code = prof.core_self_code && prof.core_self_code !== '—' ? prof.core_self_code : dominant;
      const name = prof.core_self;
      const about = prof.core_self_about || prof.core_self_desc || descMap[dominant];

      if (D.discTypeCode) D.discTypeCode.textContent = code;
      if (D.discTypeName) D.discTypeName.textContent = name;
      if (D.discTypeAbout) D.discTypeAbout.textContent = about;
    } else {
      if (D.discTypeCode) D.discTypeCode.textContent = dominant;
      if (D.discTypeName) D.discTypeName.textContent = typeMap[dominant];
      if (D.discTypeAbout) D.discTypeAbout.textContent = descMap[dominant];
    }

    // Populate Hero Badges & Summary Badges
    if (D.heroPrimaryLetter) D.heroPrimaryLetter.textContent = primaryKey;
    if (D.heroPrimaryName) D.heroPrimaryName.textContent = typeMap[primaryKey] || primaryKey;
    if (D.summaryPrimaryName) D.summaryPrimaryName.textContent = typeMap[primaryKey] || primaryKey;

    if (D.heroSecondaryLetter) D.heroSecondaryLetter.textContent = secondaryKey;
    if (D.heroSecondaryName) D.heroSecondaryName.textContent = typeMap[secondaryKey] || secondaryKey;
    if (D.summarySecondaryName) D.summarySecondaryName.textContent = typeMap[secondaryKey] || secondaryKey;

    // Set primary/secondary badge classes
    ['badgeHeroPrimary', 'badgeHeroSecondary'].forEach((id, idx) => {
      const el = D[id];
      if (!el) return;
      const key = idx === 0 ? primaryKey : secondaryKey;
      el.className = `disc-style-badge badge-${idx === 0 ? 'primary' : 'secondary'} style-${key.toLowerCase()}`;
    });

    // Populate Keywords under Hero Code
    if (D.discHeroKeywords) {
      const chars = prof.core_self_chars && prof.core_self_chars.length > 0 ? prof.core_self_chars : (prof.characteristics || ['Reliable', 'Systematic', 'Quality-Focused']);
      D.discHeroKeywords.innerHTML = chars.slice(0, 5).map(c => `
        <span class="hero-keyword-pill">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${c}</span>
        </span>
      `).join('');
    }

    // Populate At a Glance & 4-Card Info Grid
    const rawAtGlance = prof.core_self_at_a_glance || prof.at_a_glance || descMap[dominant];
    if (D.discAtAGlanceList && typeof rawAtGlance === 'string') {
      let parts;
      if (rawAtGlance.includes('\n')) {
        parts = rawAtGlance.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
      } else {
        parts = rawAtGlance.split(/(?=(?:🧭|💪|⚠️|⚠|🎯|📌|🚀|💡|🔥|⭐|🛡️|🛡|👥))/u).map(s => s.trim()).filter(Boolean);
      }

      if (parts.length > 1) {
        D.discAtAGlanceList.innerHTML = parts.map(part => {
          part = part.replace(/^\uFE0F+/, '').trim();
          const match = part.match(/^(?:(?:🧭|💪|⚠️|⚠|🎯|📌|🚀|💡|🔥|⭐|🛡️|🛡|👥)\s*)+/u);
          if (match) {
            const icon = match[0].trim();
            let content = part.substring(match[0].length).trim();
            content = content.replace(/^([^:—\-]+[:—\-])/, '<strong>$1</strong>');
            return `<div class="glance-item"><span class="glance-item-icon">${icon}</span><div class="glance-item-text">${content}</div></div>`;
          }
          return `<div class="glance-item"><span class="glance-item-icon">📌</span><div class="glance-item-text">${part}</div></div>`;
        }).join('');
      } else {
        D.discAtAGlanceList.innerHTML = `<div class="glance-item"><span class="glance-item-icon">👁️</span><div class="glance-item-text">${rawAtGlance}</div></div>`;
      }
    } else if (D.discAtAGlanceText) {
      D.discAtAGlanceText.textContent = rawAtGlance;
    }

    const toArray = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) return val.split(';').map(s => s.trim()).filter(Boolean);
      return [];
    };

    if (D.discHowYouWorkText) {
      D.discHowYouWorkText.textContent = prof.core_self_about || prof.about_you || "You prefer clear guidelines, well-organized processes, and a steady environment where quality is prioritized.";
    }
    if (D.discWhatToWatchText) {
      const wList = toArray(prof.core_self_watch_outs || prof.watch_outs);
      D.discWhatToWatchText.textContent = wList.length > 0 ? wList[0] : "You may overanalyze details or strive for perfection. Try to stay flexible, delegate more, and be open to different perspectives.";
    }
    if (D.discYourStrengthText) {
      const sList = toArray(prof.core_self_strengths || prof.strengths);
      D.discYourStrengthText.textContent = sList.length > 0 ? sList[0] : "You are systematic, reliable, and quality-focused. You pay attention to detail and consistently deliver thorough and dependable results.";
    }
    if (D.discBestInText) {
      let rawBestIn = prof.core_self_job_suitability || prof.job_suitability || "Roles that require accuracy, planning, problem-solving, analytical thinking, and maintaining high standards.";
      if (typeof rawBestIn === 'string' && rawBestIn.includes(',')) {
        const jobs = rawBestIn.split(',').map(j => j.trim()).filter(Boolean);
        if (jobs.length > 7) {
          rawBestIn = jobs.slice(0, 7).join(', ') + ', and related specialty roles.';
        }
      }
      D.discBestInText.textContent = rawBestIn;
    }

    // Draw wheel
    drawDiscWheel(dP, iP, sP, cP, dominant);
    if (D.wheelCenterBadge) D.wheelCenterBadge.textContent = dominant;

    // 5. Strengths Section
    if (D.strengthsContainer) {
      const strengths = toArray(prof.core_self_strengths || prof.strengths);
      const finalStrengths = strengths.length > 0 ? strengths : [
        'Reliable and dependable team contributor who follows through on commitments.',
        'Systematic and structured approach to problem-solving and task execution.',
        'Empathetic listener who fosters collaboration and workplace harmony.'
      ];
      D.strengthsContainer.innerHTML = finalStrengths.map(s => `
        <div class="insight-chip strength-chip">
          <span class="strength-chip-icon">✔</span>
          <span>${s}</span>
        </div>
      `).join('');
    }

    // 6. Watch Outs Section
    if (D.watchOutsContainer) {
      const watchOuts = toArray(prof.core_self_watch_outs || prof.watch_outs);
      const finalWatchOuts = watchOuts.length > 0 ? watchOuts : [
        'May occasionally hesitate or feel stressed when adapting to sudden, unexpected changes.',
        'Can overanalyze details or seek consensus before making rapid, high-stakes decisions.'
      ];
      D.watchOutsContainer.innerHTML = finalWatchOuts.map(w => `
        <div class="insight-chip watch-chip">
          <span class="watch-chip-icon">⚡</span>
          <span>${w}</span>
        </div>
      `).join('');
    }

    // 7. How This Influences Your Life & Work (Database Hook with Smart Fallback)
    function getDefaultDomainText(domainType, domKey) {
      const defaults = {
        decision: {
          D: "You make decisions quickly, decisively, and independently. You focus on bottom-line results and are comfortable taking bold risks when necessary.",
          I: "You make decisions intuitively and collaboratively. You value team input and consider how choices will impact team morale and relationship dynamics.",
          S: "You prefer to make thoughtful, well-considered decisions. You evaluate all details, seek stability, and ensure everyone is aligned before committing.",
          C: "You make logical, analytical, and highly structured decisions. You carefully examine empirical evidence, weigh all risks, and verify accuracy first."
        },
        communication: {
          D: "You communicate directly, concisely, and to the point. You appreciate brevity and clear action items rather than prolonged background details.",
          I: "You communicate enthusiastically, persuasively, and warmly. You excel at engaging listeners, sharing stories, and building rapport effortlessly.",
          S: "You communicate calmly, respectfully, and patiently. You listen deeply, choose your words with consideration, and foster constructive dialogue.",
          C: "You communicate precisely, objectively, and thoroughly. You provide clear explanations supported by facts, data, and well-organized structure."
        },
        relationships: {
          D: "In relationships, you value competence, autonomy, and direct honesty. You respect colleagues who stand their ground and deliver on promises.",
          I: "In relationships, you are friendly, encouraging, and highly social. You build extensive networks and naturally bring positive energy to any group.",
          S: "In relationships, you are loyal, supportive, and dependable. People trust you deeply because you are consistent and always follow through.",
          C: "In relationships, you value reliability, professionalism, and mutual respect. You build lasting trust through high integrity and consistent follow-up."
        },
        environment: {
          D: "You thrive in fast-paced, challenging environments with high autonomy, clear goals, and opportunities to lead initiatives toward tangible outcomes.",
          I: "You thrive in dynamic, collaborative, and energetic environments where creativity, social interaction, and team recognition are actively celebrated.",
          S: "You thrive in structured, well-organized environments with clear expectations, harmonious teamwork, and stable, consistent operating procedures.",
          C: "You thrive in systematic, quiet, and quality-driven environments where accuracy is rewarded and you have ample time to do thorough, precise work."
        }
      };
      return (defaults[domainType] && defaults[domainType][domKey]) || defaults[domainType].S;
    }

    if (D.discDomainDecision) {
      D.discDomainDecision.textContent = prof.core_self_decision_making || prof.decision_making || getDefaultDomainText('decision', primaryKey);
    }
    if (D.discDomainCommunication) {
      D.discDomainCommunication.textContent = prof.core_self_communication || prof.communication || getDefaultDomainText('communication', primaryKey);
    }
    if (D.discDomainRelationships) {
      D.discDomainRelationships.textContent = prof.core_self_relationships || prof.relationships || getDefaultDomainText('relationships', primaryKey);
    }
    if (D.discDomainEnvironment) {
      D.discDomainEnvironment.textContent = prof.core_self_preferred_environment || prof.preferred_environment || getDefaultDomainText('environment', primaryKey);
    }

    if (D.whatThisMeansText) {
      const meaning = prof.core_self_what_this_means || prof.core_self_about || '';
      D.whatThisMeansText.innerHTML = meaning
        .split('\n')
        .filter(p => p.trim().length > 0)
        .map(p => `<p>${p.trim()}</p>`)
        .join('');
    }

    // Copy ID Button action
    if (D.btnCopyId) {
      D.btnCopyId.onclick = () => {
        const idText = D.resultId ? D.resultId.textContent : '';
        if (idText && idText !== '—') {
          navigator.clipboard.writeText(idText);
          toast('User ID copied to clipboard!', 'success', 2500);
        }
      };
    }

    // 8. Footer Actions
    if (D.btnPrintReport) {
      D.btnPrintReport.onclick = () => window.print();
    }
    if (D.btnFinishTest) {
      D.btnFinishTest.onclick = () => {
        goTo('view-welcome');
      };
    }

    goTo('view-result');
  }

  /* ── Draw DISC Wheel (canvas) ──────── */
  function drawDiscWheel(d, i, s, c, dominant) {
    const canvas = D.discWheel;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = (canvas.width / 2) - 18;
    const innerR = r * 0.42;
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
      const outerR = isDom ? r + 10 : r;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = isDom ? seg.color : seg.color + '55';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,15,30,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      startAngle += slice;
    });

    // Draw inner circle (donut hole)
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = 'hsl(226, 32%, 12%)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dominant letter inside hole
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Outfit, Inter, sans-serif';
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
          toast('Please enter a User ID.', 'warning');
          return;
        }

        setLoading(true);
        try {
          const res = await fetch(`/api/get-result?id=${encodeURIComponent(queryId)}`);
          const data = res.ok ? await res.json() : null;

          if (!res.ok || !data || data.status !== 'success') {
            const msg = (data && data.message) ? data.message : `User ID not found.`;
            throw new Error(msg);
          }

          toast('Results retrieved successfully!', 'success', 3000);
          showResult(data);

        } catch (err) {
          console.error('Search failed:', err);
          toast(err.message || 'Retrieval failed — please verify User ID.', 'error', 5000);
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
