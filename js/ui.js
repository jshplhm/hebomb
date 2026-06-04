// ─── UI ────────────────────────────────────────────────────────────────────────

const UI = {

  init() {
    this.root          = document.getElementById("app");
    this._restTimer    = null;
    this._restTarget   = null;
    this._restTotal    = 0;
    this._activeExIdx  = 0;
    this._logDate      = null;
    this._lpTimer      = null;
    this._swappingEi   = undefined;
    this._bwRange      = 30;
    this._statsTab     = "body";
    this.render();
  },

  render() {
    const v = App.state.view || "picker";
    this.root.innerHTML = "";
    document.getElementById("bottom-nav")?.remove();

    if (v === "session") { this.renderSession(); return; }
    if (v === "stats")   { this.renderStats();   this._nav(); return; }
    if (v === "history") { this.renderHistory(); this._nav(); return; }
    this.renderPicker();
    this._nav();
  },

  nav(view) { App.state.view = view; this.render(); window.scrollTo(0,0); },

  // ── NAV ───────────────────────────────────────────────────────────────────
  _nav() {
    document.getElementById("bottom-nav")?.remove();
    const nav = document.createElement("nav");
    nav.id = "bottom-nav";
    nav.className = "bottom-nav";
    const icons = {
      picker: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="9"/><path d="M11 7v4l3 3"/></svg>`,
      stats:  `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,17 8,11 12,14 19,6"/><polyline points="15,6 19,6 19,10"/></svg>`,
      history:`<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h16M3 12h10M3 17h7"/></svg>`
    };
    [{id:"picker",icon:icons.picker,label:"Train"},{id:"stats",icon:icons.stats,label:"Stats"},{id:"history",icon:icons.history,label:"History"}]
    .forEach(t => {
      const btn = document.createElement("button");
      btn.className = "nav-btn" + ((App.state.view||"picker")===t.id?" active":"");
      btn.innerHTML = `<span class="nav-icon">${t.icon}</span><span class="nav-label">${t.label}</span>`;
      btn.onclick = () => this.nav(t.id);
      nav.appendChild(btn);
    });
    document.body.appendChild(nav);
  },

  // ── PICKER ────────────────────────────────────────────────────────────────
  renderPicker() {
    const wrap = this.el("div","picker-page");
    const cw   = getCurrentWeek();
    const wd   = WEEKS[cw] || {};
    const pid  = wd.phaseId || "strength";
    const sid  = App.getSuggestedDay();
    const sug  = PROGRAM[sid];
    const date = new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});

    wrap.innerHTML = `
      <div class="picker-top">
        <div class="picker-date">${date}</div>
        <span class="phase-badge phase-badge-${pid}">Wk ${cw} · ${wd.phase?.label||""}</span>
      </div>
      <div class="picker-suggested">
        <div class="picker-suggested-label">Today</div>
        <div class="picker-suggested-name">${sug.title}</div>
        <button class="btn-start" onclick="UI.startDay('${sid}')">Start</button>
      </div>
      <div class="section-head-plain" style="margin-bottom:8px">Other days</div>
      <div class="picker-others">
        ${["dayA","dayB","dayC"].filter(id=>id!==sid).map(id => {
          const d = PROGRAM[id];
          return `<button class="picker-other-btn" onclick="UI._previewDay('${id}')">
            <span class="picker-other-label">${d.label||id}</span>
            <span class="picker-other-title">${d.title}</span>
            <span class="picker-other-hint">Tap to preview →</span>
          </button>`;
        }).join("")}
      </div>
      <div class="picker-past">
        <label class="picker-past-label" for="log-past-date">Log for a past date</label>
        <input type="date" id="log-past-date" class="picker-date-input"
          value="${new Date().toISOString().split("T")[0]}"
          max="${new Date().toISOString().split("T")[0]}">
      </div>`;
    this.root.appendChild(wrap);
  },

  // Preview a day before committing — shows exercise list with Start button
  _previewDay(dayId) {
    const wrap = this.el("div","picker-page");
    const d = PROGRAM[dayId];
    const cw = getCurrentWeek();
    const exNames = (d.exercises||[]).map(ex=>ex.name).join(", ") || d.title;

    wrap.innerHTML = `
      <button class="preview-back" onclick="UI.nav('picker')">← Back</button>
      <div class="preview-title">${d.title}</div>
      <div class="preview-label">${d.label||""}</div>
      <div class="preview-exercises">
        ${(d.exercises||[]).map(ex=>`
          <div class="preview-ex-row">
            <span class="preview-ex-name">${ex.name}</span>
            <span class="preview-ex-sets">${ex.sets?.length||""} sets</span>
          </div>`).join("") || `<div style="color:var(--sub);font-size:14px;padding:16px 0">${d.title}</div>`}
      </div>
      <button class="btn-start" style="margin-top:20px" onclick="UI.startDay('${dayId}')">Start ${d.title}</button>
    `;
    this.root.innerHTML = "";
    document.getElementById("bottom-nav")?.remove();
    this.root.appendChild(wrap);
    this._nav();
  },

  // ── START ─────────────────────────────────────────────────────────────────
  async startDay(dayId) {
    this.root.innerHTML = `<div class="session-loading">Loading…</div>`;
    document.getElementById("bottom-nav")?.remove();
    this._logDate = document.getElementById("log-past-date")?.value || null;
    const today = new Date().toISOString().split("T")[0];
    if (this._logDate === today) this._logDate = null;
    App.state.activeDay = dayId;
    const session = App.newSession(dayId);
    const last = await App.fetchLastSession(dayId);
    App.state.lastSession = last;
    App.state.session = App.applyLastSession(session, last);
    // Seed prev values and isWarmup flag on each set
    App.state.session.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (!s.prev) s.prev = { reps: s.reps, weight: s.weight };
        s.claimed = {};
        // Detect warm-up sets from the note field (program.js sets note:"warm-up")
        if (!s.hasOwnProperty("isWarmup")) {
          s.isWarmup = (s.note === "warm-up" || s.note === "warmup" || s.note === "warm up");
        }
      });
    });
    this._activeExIdx = 0;
    App.state.view = "session";
    this.render();
  },

  // ── SESSION ───────────────────────────────────────────────────────────────
  renderSession() {
    const { session, activeDay } = App.state;
    if (!session || !activeDay) { this.nav("picker"); return; }
    const day = PROGRAM[activeDay];
    const cw  = getCurrentWeek();
    const wd  = WEEKS[cw] || {};
    const pid = day.phaseId || wd.phaseId || "strength";

    const wrap = document.createElement("div");
    wrap.id = "session-wrap";
    wrap.innerHTML = `
      <div class="sess-header" id="sess-header">
        <div class="sess-hdr-top">
          <button class="sess-end" onclick="UI._confirmEnd()">End</button>
          <span class="sess-phase phase-badge-${pid}">${wd.phase?.label||""} · ${day.label||activeDay}</span>
        </div>
        <div class="sess-hdr-name-row">
          <button class="sess-ex-name" id="sess-ex-name"
            ontouchstart="UI._lpStart(event)" ontouchend="UI._lpEnd()" ontouchmove="UI._lpEnd()"
            oncontextmenu="event.preventDefault();UI._showExMenu()">—</button>
          <div class="sess-counter-block">
            <span class="sess-counter" id="sess-counter"></span>
            <span class="sess-counter-lbl">SETS DONE</span>
          </div>
        </div>
        <div class="sess-dots-row" id="sess-dots-row"></div>
        <!-- Rest timer banner — only present in DOM when active -->
        <div class="sess-rest-banner" id="sess-rest-banner" style="display:none">
          <div class="sess-rest-track"><div class="sess-rest-bar" id="sess-rest-bar"></div></div>
          <div class="sess-rest-row">
            <button class="sess-rest-adj" onclick="UI._adjRest(-30)">−30s</button>
            <span class="sess-rest-time" id="sess-rest-time">0:00</span>
            <button class="sess-rest-adj" onclick="UI._adjRest(30)">+30s</button>
            <button class="sess-rest-skip" onclick="UI._stopRest()">skip</button>
          </div>
        </div>
      </div>
      <div class="sess-col-header" id="sess-col-header">
        <span class="sess-col-reps">REPS</span>
        <span class="sess-col-weight">WEIGHT</span>
      </div>
      <div class="sess-body" id="sess-body"></div>
      <div class="sess-bottom" id="sess-bottom">
        <button class="sess-add-ex-btn" onclick="UI._openAddEx(false)">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 1v12M1 7h12"/></svg>
          + Exercise
        </button>
        <button class="sess-save-btn" id="sess-save-btn" onclick="UI._bottomAction()">Save</button>
      </div>`;
    this.root.appendChild(wrap);
    this._buildBody();
    this._updateHeader();
    setTimeout(() => this._syncBodyPadding(), 0);
    this._scrollToActive();
  },

  _bottomAction() {
    const ei = this._activeExIdx;
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) { this._confirmFinish(); return; }
    const exDone = ex.sets.filter(s=>!s.excluded).every(s=>s.logged);
    const allDone = App.state.session.exercises.every(ex=>ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
    if (allDone) { this._confirmFinish(); return; }
    if (exDone) {
      // Jump to next incomplete exercise
      const next = App.state.session.exercises.findIndex((ex,i)=>i>ei&&!ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
      if (next >= 0) this._goTo(next);
    } else {
      this._confirmFinish();
    }
  },

  // Build the full exercise list into sess-body
  _buildBody() {
    const body = document.getElementById("sess-body");
    if (!body) return;

    const { session } = App.state;
    const ei = this._activeExIdx;

    body.innerHTML = session.exercises.map((ex, i) => {
      const isActive = i === ei;
      const doneC = ex.sets.filter(s=>s.logged).length;
      const totC  = ex.sets.filter(s=>!s.excluded).length;
      const allDone = doneC === totC && totC > 0;
      const partial  = doneC > 0 && !allDone;

      if (isActive) {
        return `<div class="ex-block active" id="exb-${i}">
          <div class="ex-active-head">
            <span class="ex-active-name">${ex.name}</span>
            <span class="ex-active-rest">${ex.rest||"—"}</span>
          </div>
          ${ex.sets.map((_,si) => this._setRowHTML(i,si)).join("")}
          <button class="ex-add-set-btn" onclick="UI._addSet(${i})">+ Add set</button>
        </div>`;
      }

      const dot = allDone ? "done" : partial ? "partial" : "untouched";
      const isCurrent = i === ei;
      const meta = allDone
        ? `<span style="color:var(--green);font-size:11px">✓</span>`
        : partial
          ? `<span style="color:var(--yellow);font-size:11px">${doneC}/${totC}</span>`
          : `<span style="font-size:11px;color:var(--muted)">${totC} sets</span>`;
      return `<div class="ex-block${allDone?" ex-all-done":""}" id="exb-${i}">
        <div class="ex-collapsed${isCurrent?" ex-is-next":""}" onclick="UI._goTo(${i})">
          <div class="ex-col-left">
            <div class="ex-dot ${isCurrent?"next":dot}"></div>
            <span class="ex-col-name${isCurrent?" ex-col-name-next":""}">${ex.name}</span>
          </div>
          <span class="ex-col-meta">${meta}</span>
        </div>
      </div>`;
    }).join("");
  },

  // Rebuild just the active exercise block (after set actions)
  _rebuildActive() {
    this._resetAllSwipes();
    const ei  = this._activeExIdx;
    const exb = document.getElementById(`exb-${ei}`);
    if (!exb) return;
    const ex = App.state.session.exercises[ei];
    exb.innerHTML = `
      <div class="ex-active-head">
        <span class="ex-active-name">${ex.name}</span>
        <span class="ex-active-rest">${ex.rest||"—"}</span>
      </div>
      ${ex.sets.map((_,si) => this._setRowHTML(ei,si)).join("")}
      <button class="ex-add-set-btn" onclick="UI._addSet(${ei})">+ Add set</button>`;
  },

  _resetAllSwipes() {
    document.querySelectorAll(".sr-swipe-wrap.swiped").forEach(w => {
      w.classList.remove("swiped");
      const inner = w.querySelector(".sr");
      if (inner) inner.style.transform = "";
    });
  },

  // ── SET ROW HTML ──────────────────────────────────────────────────────────
  _setRowHTML(ei, si) {
    const ex   = App.state.session.exercises[ei];
    const s    = ex.sets[si];
    const sc   = this._setClass(ei, si);
    const g    = this._ghostVals(ei, si);
    const showR = s.claimed?.reps   !== undefined ? s.claimed.reps   : g.reps;
    const showW = s.claimed?.weight !== undefined ? s.claimed.weight : g.weight;
    const rGhost = s.claimed?.reps   === undefined;
    const wGhost = s.claimed?.weight === undefined;

    const wSets    = ex.sets.filter(x=>!x.excluded&&!x.isWarmup);
    const numLabel = s.isWarmup ? "W" : String(wSets.indexOf(s)+1);
    const numCls   = s.isWarmup ? "sn sn-zero" : "sn";

    if (s.excluded) return `
      <div class="sr sr-excluded" id="sr-${ei}-${si}">
        <span class="${numCls}">${numLabel}</span>
        <span class="sr-skipped">skipped</span>
        <button class="sr-undo" onclick="UI._toggleExclude(${ei},${si})">undo</button>
      </div>`;

    const CHECK = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l5 5 7-8"/></svg>`;

    // Done sets collapse to a compact summary line; tap to uncollapse/undo
    if (sc === "done") return `
      <div class="sr sr-done sr-collapsed" id="sr-${ei}-${si}"
        onclick="UI._uncollapseDone(${ei},${si})">
        <span class="${numCls}">${numLabel}</span>
        <span class="sr-summary">${showR} reps · ${showW} lbs</span>
        <button class="sr-circ checked" onclick="event.stopPropagation();UI._tapDone(${ei},${si})">${CHECK}</button>
      </div>`;

    // Swipe wrapper for undone rows
    return `
      <div class="sr-swipe-wrap" id="srw-${ei}-${si}"
        ontouchstart="UI._swipeStart(event,${ei},${si})"
        ontouchmove="UI._swipeMove(event,${ei},${si})"
        ontouchend="UI._swipeEnd(event,${ei},${si})">
        <div class="sr sr-${sc}" id="sr-${ei}-${si}" onclick="UI._claimSet(${ei},${si})">
          <span class="${numCls}">${numLabel}</span>
          <div class="sr-step" onclick="event.stopPropagation()">
            <button class="sr-s-btn" onclick="UI._step(${ei},${si},'reps',-1)">−</button>
            <span class="sr-val${rGhost?" ghost":""}" id="rv-${ei}-${si}">${showR}</span>
            <button class="sr-s-btn" onclick="UI._step(${ei},${si},'reps',1)">+</button>
          </div>
          <div class="sr-step" onclick="event.stopPropagation()">
            <button class="sr-s-btn" onclick="UI._step(${ei},${si},'weight',-1)">−</button>
            <span class="sr-val${wGhost?" ghost":""}" id="wv-${ei}-${si}">${showW}</span>
            <button class="sr-s-btn" onclick="UI._step(${ei},${si},'weight',1)">+</button>
          </div>
          <button class="sr-circ" onclick="event.stopPropagation();UI._tapDone(${ei},${si})"></button>
        </div>
        <button class="sr-delete-reveal" onclick="UI._delSet(${ei},${si});UI._resetSwipe(${ei},${si})">Delete</button>
      </div>`;
  },

  // Tap collapsed done row — uncheck so it expands for editing
  _uncollapseDone(ei, si) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s) return;
    s.logged = false;
    this._stopRest();
    this._rebuildActive();
    this._updateHeader();
    this._updateCollapsed(ei);
  },

  // Three-tier classification
  _setClass(ei, si) {
    const sets = App.state.session.exercises[ei].sets;
    const s = sets[si];
    if (s.logged || s.excluded) return "done";
    const firstUndone = sets.findIndex(x => !x.logged && !x.excluded);
    return si === firstUndone ? "current" : "upcoming";
  },

  // Ghost values: cascade from last done WORKING set only (skip warmup as source)
  // Warmup ghost always comes from prev session only
  _ghostVals(ei, si) {
    const sets = App.state.session.exercises[ei].sets;
    const s    = sets[si];

    // Warmup sets always use their own prev session value — never cascade from above
    if (s.isWarmup) {
      return { reps: s.prev?.reps ?? s.reps, weight: s.prev?.weight ?? s.weight };
    }

    // Working sets: find the last done non-warmup set above this one
    for (let i = si - 1; i >= 0; i--) {
      if (sets[i].logged && !sets[i].isWarmup) {
        return {
          reps:   sets[i].claimed?.reps   !== undefined ? sets[i].claimed.reps   : sets[i].reps,
          weight: sets[i].claimed?.weight !== undefined ? sets[i].claimed.weight : sets[i].weight,
        };
      }
    }
    // Fall back to prev session
    return { reps: s.prev?.reps ?? s.reps, weight: s.prev?.weight ?? s.weight };
  },

  _scrollToActive() {
    const body = document.getElementById("sess-body");
    if (!body) return;
    const ei = this._activeExIdx;
    const sets = App.state.session.exercises[ei]?.sets || [];
    const si = sets.findIndex(s=>!s.logged&&!s.excluded);
    const tId = si >= 0 ? `sr-${ei}-${si}` : `exb-${ei}`;
    const target = document.getElementById(tId);
    if (!target) return;
    const hh = document.getElementById("sess-header")?.offsetHeight || 100;
    const bt = body.getBoundingClientRect().top;
    const tt = target.getBoundingClientRect().top;
    body.scrollBy({ top: tt - bt - hh - 20, behavior: "smooth" });
  },

  _updateHeader() {
    const ei  = this._activeExIdx;
    const ex  = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const wDone = ex.sets.filter(s=>!s.isWarmup&&s.logged).length;
    const wTot  = ex.sets.filter(s=>!s.isWarmup&&!s.excluded).length;

    const nameEl = document.getElementById("sess-ex-name");
    const ctrEl  = document.getElementById("sess-counter");
    if (nameEl) nameEl.textContent = ex.name;
    if (ctrEl)  ctrEl.textContent  = `${wDone} / ${wTot}`;

    // Set dots — filled=done, ring=next, tiny=warmup
    const dotsEl = document.getElementById("sess-dots-row");
    if (dotsEl) {
      dotsEl.innerHTML = ex.sets.filter(s=>!s.excluded).map((s,i) => {
        const allSets = ex.sets.filter(x=>!x.excluded);
        const firstUndone = allSets.findIndex(x=>!x.logged);
        if (s.isWarmup) return `<span class="sdot sdot-warm"></span>`;
        if (s.logged)   return `<span class="sdot sdot-done"></span>`;
        if (i === firstUndone) return `<span class="sdot sdot-next"></span>`;
        return `<span class="sdot sdot-up"></span>`;
      }).join("");
    }

    // Bottom button: contextual
    const exDone = ex.sets.filter(s=>!s.excluded).every(s=>s.logged);
    const allDone = App.state.session.exercises.every(ex=>ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
    const btn = document.getElementById("sess-save-btn");
    if (btn) {
      btn.classList.toggle("ready", exDone || allDone);
      if (allDone)       { btn.textContent = "Finish ✓"; }
      else if (exDone)   { btn.textContent = "Next →"; }
      else               { btn.textContent = "Save"; }
    }
  },

  _updateCollapsed(ei) {
    const exb = document.getElementById(`exb-${ei}`);
    if (!exb) return;
    const ex = App.state.session.exercises[ei];
    const doneC = ex.sets.filter(s=>s.logged).length;
    const totC  = ex.sets.filter(s=>!s.excluded).length;
    const allDone = doneC===totC&&totC>0, partial=doneC>0&&!allDone;
    const dot = allDone?"done":partial?"partial":"untouched";
    const meta = allDone
      ? `<span style="color:var(--green);font-size:11px">✓</span>`
      : partial
        ? `<span style="color:var(--yellow);font-size:11px">${doneC}/${totC}</span>`
        : `<span style="font-size:11px;color:var(--muted)">${totC} sets</span>`;
    if (!exb.classList.contains("active")) {
      exb.className = "ex-block" + (allDone?" ex-all-done":"");
      exb.innerHTML = `<div class="ex-collapsed" onclick="UI._goTo(${ei})">
        <div class="ex-col-left"><div class="ex-dot ${dot}"></div><span class="ex-col-name">${ex.name}</span></div>
        <span class="ex-col-meta">${meta}</span>
      </div>`;
    }
  },

  _goTo(ei) {
    const prev = this._activeExIdx;
    this._activeExIdx = ei;
    this._buildBody();
    this._updateHeader();
    setTimeout(() => { this._syncBodyPadding(); this._scrollToActive(); }, 20);
  },

  // ── SET ACTIONS ───────────────────────────────────────────────────────────
  _wtStep(w) { return w < 30 ? 2.5 : 5; },

  // Claim the ghost values for a set (solidify dim italic → white)
  _claimSet(ei, si) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s || s.logged || s.excluded) return;
    if (!s.claimed) s.claimed = {};
    const g = this._ghostVals(ei, si);
    if (s.claimed.reps   === undefined) s.claimed.reps   = g.reps;
    if (s.claimed.weight === undefined) s.claimed.weight = g.weight;
    // Update DOM to show claimed (non-ghost) state
    const rv = document.getElementById(`rv-${ei}-${si}`);
    const wv = document.getElementById(`wv-${ei}-${si}`);
    if (rv) { rv.textContent = s.claimed.reps;   rv.classList.remove("ghost"); }
    if (wv) { wv.textContent = s.claimed.weight; wv.classList.remove("ghost"); }
  },

  _step(ei, si, field, dir) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s) return;
    if (!s.claimed) s.claimed = {};
    const curr = s.claimed[field] !== undefined ? s.claimed[field]
                 : this._ghostVals(ei,si)[field];
    const step = field==="weight" ? this._wtStep(curr) : 1;
    const next = Math.max(0, curr + dir*step);
    s.claimed[field] = next;
    const id = field==="reps" ? `rv-${ei}-${si}` : `wv-${ei}-${si}`;
    const el = document.getElementById(id);
    if (el) { el.textContent = next; el.classList.remove("ghost"); }
    // Cascade ghosts to subsequent undone non-warmup sets
    this._refreshGhosts(ei, si+1);
  },

  _refreshGhosts(ei, fromSi) {
    const sets = App.state.session.exercises[ei].sets;
    for (let si = fromSi; si < sets.length; si++) {
      const s = sets[si];
      if (s.logged || s.excluded || s.isWarmup) continue;
      const g = this._ghostVals(ei, si);
      if (s.claimed?.reps === undefined) {
        const el = document.getElementById(`rv-${ei}-${si}`);
        if (el) el.textContent = g.reps;
      }
      if (s.claimed?.weight === undefined) {
        const el = document.getElementById(`wv-${ei}-${si}`);
        if (el) el.textContent = g.weight;
      }
    }
  },

  _tapDone(ei, si) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s || s.excluded) return;

    // Claim ghost values first — circle tap solidifies whatever is showing
    this._claimSet(ei, si);

    s.logged = !s.logged;
    // Commit claimed values on done
    if (s.logged && s.claimed) {
      if (s.claimed.reps   !== undefined) s.reps   = s.claimed.reps;
      if (s.claimed.weight !== undefined) s.weight = s.claimed.weight;
    }
    // Rebuild the active block (set classes shift)
    this._rebuildActive();
    this._updateHeader();
    this._updateCollapsed(ei);
    if (s.logged) {
      const ex = App.state.session.exercises[ei];
      this._startRest(this._parseRest(ex.rest));
      const allDone = ex.sets.filter(s=>!s.excluded).every(s=>s.logged);
      if (allDone && ei+1 < App.state.session.exercises.length)
        setTimeout(()=>this._goTo(ei+1), 800);
    } else {
      this._stopRest();
    }
  },

  // ── SWIPE TO DELETE ───────────────────────────────────────────────────────
  _swipeStart(e, ei, si) {
    // Close any other open swipe first
    document.querySelectorAll(".sr-swipe-wrap.swiped").forEach(w => {
      if (w.id !== `srw-${ei}-${si}`) {
        w.classList.remove("swiped");
        const inner = w.querySelector(".sr");
        if (inner) { inner.style.transition="transform 0.2s"; inner.style.transform=""; setTimeout(()=>{inner.style.transition="";},220); }
      }
    });
    this._swTouchId = e.touches[0].identifier;
    this._swStartX  = e.touches[0].clientX;
    this._swStartY  = e.touches[0].clientY;
    this._swEi = ei; this._swSi = si;
    this._swLocked = null; // null=undecided, true=horizontal, false=vertical
  },

  _swipeMove(e, ei, si) {
    const t = Array.from(e.touches).find(t=>t.identifier===this._swTouchId);
    if (!t) return;
    const dx = t.clientX - this._swStartX;
    const dy = Math.abs(t.clientY - this._swStartY);

    // Determine direction lock on first significant movement
    if (this._swLocked === null) {
      if (Math.abs(dx) < 6 && dy < 6) return; // not moved enough yet
      this._swLocked = Math.abs(dx) > dy; // true=horizontal wins
    }

    if (!this._swLocked) return; // vertical — let scroll handle it

    if (dx < -10) {
      e.preventDefault(); // prevent scroll while swiping left
      const inner = document.getElementById(`sr-${ei}-${si}`);
      if (inner) inner.style.transform = `translateX(${Math.max(dx, -84)}px)`;
    } else if (dx > 10) {
      // Swiping right — snap back if was open
      const wrap = document.getElementById(`srw-${ei}-${si}`);
      if (wrap?.classList.contains("swiped")) this._resetSwipe(ei, si);
    }
  },

  _swipeEnd(e, ei, si) {
    const t = Array.from(e.changedTouches).find(t=>t.identifier===this._swTouchId);
    if (!t || !this._swLocked) return;
    const dx = t.clientX - this._swStartX;
    if (dx < -64) {
      const inner = document.getElementById(`sr-${ei}-${si}`);
      const wrap  = document.getElementById(`srw-${ei}-${si}`);
      if (inner) inner.style.transform = "translateX(-84px)";
      if (wrap)  wrap.classList.add("swiped");
    } else {
      this._resetSwipe(ei, si);
    }
    this._swLocked = null;
  },

  _resetSwipe(ei, si) {
    const inner = document.getElementById(`sr-${ei}-${si}`);
    const wrap  = document.getElementById(`srw-${ei}-${si}`);
    if (inner) { inner.style.transition="transform 0.2s"; inner.style.transform=""; setTimeout(()=>{if(inner)inner.style.transition="";},220); }
    if (wrap)  wrap.classList.remove("swiped");
  },

  _toggleExclude(ei, si) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s) return;
    s.excluded = !s.excluded;
    if (s.excluded) s.logged = false;
    this._rebuildActive();
    this._updateHeader();
  },

  _delSet(ei, si) {
    const ex = App.state.session?.exercises?.[ei];
    if (!ex || ex.sets.length <= 1) { this._toast("Can't remove last set"); return; }
    ex.sets.splice(si, 1);
    this._rebuildActive();
    this._updateHeader();
  },

  _addSet(ei) {
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const last = ex.sets[ex.sets.length-1] || {};
    const g = this._ghostVals(ei, ex.sets.length-1);
    ex.sets.push({
      isWarmup: false,
      reps:   last.reps   || g.reps   || 8,
      weight: last.weight || g.weight || 0,
      prev:   { reps: last.reps||8, weight: last.weight||0 },
      claimed: {}
    });
    this._rebuildActive();
    this._updateHeader();
  },

  // ── REST TIMER ────────────────────────────────────────────────────────────
  _parseRest(s) {
    if (!s) return 90;
    const m=s.match(/(\d+)\s*min/i); if(m) return parseInt(m[1])*60;
    const c=s.match(/(\d+)\s*sec/i); if(c) return parseInt(c[1]);
    const n=parseInt(s); return isNaN(n)?90:n;
  },

  _syncBodyPadding() {
    const body   = document.getElementById("sess-body");
    const hdr    = document.getElementById("sess-header");
    const colHdr = document.getElementById("sess-col-header");
    if (!body || !hdr) return;
    const total = (hdr.offsetHeight||0) + (colHdr?.offsetHeight||0) + 1;
    body.style.paddingTop = total + "px";
  },

  _startRest(sec) {
    this._stopRest();
    this._restTarget = Date.now() + sec*1000;
    this._restTotal  = sec;
    const banner = document.getElementById("sess-rest-banner");
    if (banner) banner.style.display = "block";
    setTimeout(() => this._syncBodyPadding(), 20);
    const tick = () => {
      const rem = Math.max(0, Math.ceil((this._restTarget-Date.now())/1000));
      const pct = rem/this._restTotal*100;
      const tEl = document.getElementById("sess-rest-time");
      const bEl = document.getElementById("sess-rest-bar");
      if (tEl) tEl.textContent = `${Math.floor(rem/60)}:${String(rem%60).padStart(2,"0")}`;
      if (bEl) { bEl.style.width=pct+"%"; bEl.style.background=pct>50?"var(--green)":pct>25?"var(--orange)":"var(--red)"; }
      if (rem<=0) {
        this._stopRest();
        if(navigator.vibrate) navigator.vibrate([150,80,150]);
        if(tEl) { tEl.textContent="go!"; tEl.style.color="var(--yellow)"; }
        if(bEl) { bEl.style.width="100%"; bEl.style.background="var(--yellow)"; }
        setTimeout(()=>{ const b=document.getElementById("sess-rest-banner"); if(b)b.style.display="none"; this._syncBodyPadding(); tEl&&(tEl.style.color=""); },2000);
      }
    };
    tick();
    this._restTimer = setInterval(tick, 500);
  },

  _stopRest() {
    if (this._restTimer) { clearInterval(this._restTimer); this._restTimer=null; }
    const b=document.getElementById("sess-rest-banner");
    if (b) { b.style.display="none"; setTimeout(()=>this._syncBodyPadding(), 20); }
  },

  _adjRest(d) {
    if (!this._restTarget) return;
    this._restTarget += d*1000;
    this._restTotal = Math.max(1, this._restTotal+d);
  },

  // ── EXERCISE MANAGEMENT (long-press on exercise name) ─────────────────────
  _lpStart() {
    this._lpTimer = setTimeout(() => {
      if(navigator.vibrate) navigator.vibrate(40);
      this._showExMenu();
    }, 500);
  },
  _lpEnd() { clearTimeout(this._lpTimer); },

  _showExMenu() {
    const ei  = this._activeExIdx;
    const exs = App.state.session?.exercises;
    const ex  = exs?.[ei];
    if (!ex) return;
    this._closeSheet();
    const sheet = document.createElement("div");
    sheet.id = "sess-sheet";
    sheet.className = "sheet-overlay";
    sheet.innerHTML = `<div class="ex-menu-sheet">
      <div class="ex-menu-name">${ex.name}</div>
      ${ei>0 ? `<button class="ex-menu-btn" onclick="UI._moveEx(${ei},-1);UI._closeSheet()">↑ Move up</button>`:""}
      ${ei<exs.length-1 ? `<button class="ex-menu-btn" onclick="UI._moveEx(${ei},1);UI._closeSheet()">↓ Move down</button>`:""}
      <button class="ex-menu-btn" onclick="UI._swapEx(${ei});UI._closeSheet()">⇄ Swap exercise</button>
      <button class="ex-menu-btn danger" onclick="UI._removeEx(${ei});UI._closeSheet()">Remove</button>
      <button class="ex-menu-cancel" onclick="UI._closeSheet()">Cancel</button>
    </div>`;
    sheet.addEventListener("click", e=>{ if(e.target===sheet) this._closeSheet(); });
    document.body.appendChild(sheet);
  },

  _closeSheet() { document.getElementById("sess-sheet")?.remove(); },

  _moveEx(ei, dir) {
    const exs = App.state.session?.exercises;
    const ni = ei+dir;
    if (!exs||ni<0||ni>=exs.length) return;
    [exs[ei],exs[ni]] = [exs[ni],exs[ei]];
    this._activeExIdx = ni;
    this._buildBody();
    this._updateHeader();
  },

  _removeEx(ei) {
    const exs = App.state.session?.exercises;
    if (!exs||exs.length<=1) { this._toast("Can't remove last exercise"); return; }
    exs.splice(ei,1);
    this._activeExIdx = Math.min(ei, exs.length-1);
    this._buildBody();
    this._updateHeader();
  },

  _swapEx(ei) {
    this._swappingEi = ei;
    this._openAddEx(true);
  },

  _openAddEx(isSwap) {
    this._closeSheet();
    const day = PROGRAM[App.state.activeDay];
    const groups = {
      "Upper — Push":["push_acc"],"Upper — Pull":["pull_acc"],
      "Biceps":["curl_acc"],"Delts":["latraise_acc"],
      "Core":["core_upper","core_lower","sideplank_acc"],
      "Lower — Quad":["leg_acc"],"Lower — Hamstring":["hamstring_acc"],
      "Calves":["calf_acc"],"Olympic":["snatch_acc","jerk_acc"],
      "Squat":["squat_fri_acc"],"Deadlift":["rdl_fri_acc"]
    };
    const exMap = {};
    Object.entries(groups).forEach(([g,keys]) => {
      keys.forEach(k => (ACC_POOLS[k]||[]).forEach(ex => {
        if (!exMap[ex.name]) exMap[ex.name] = {...ex, group:g};
      }));
    });
    Object.values(MAIN_LIFTS||{}).forEach(ex => {
      if (!exMap[ex.name]) exMap[ex.name] = {...ex, group:"Main Lifts"};
    });
    const all = Object.values(exMap).sort((a,b)=>a.name.localeCompare(b.name));
    const byGroup = {};
    all.forEach(e => (byGroup[e.group]=byGroup[e.group]||[]).push(e));
    const listHTML = Object.entries(byGroup).map(([g,exs]) => `
      <div class="sheet-group-label">${g}</div>
      ${exs.map(ex=>`<div class="sheet-item" onclick="UI._pickEx('${ex.id}','${ex.name.replace(/'/g,"\\'")}',${ex.baseline||0})">
        <div><div class="sheet-item-name">${ex.name}</div>${ex.baseline?`<div class="sheet-item-meta">Baseline ${ex.baseline} lbs</div>`:""}</div>
        <span class="sheet-item-add">+</span>
      </div>`).join("")}`).join("");

    // Full-screen overlay instead of bottom sheet
    const overlay = document.createElement("div");
    overlay.id = "sess-sheet";
    overlay.className = "ex-picker-fullscreen";
    overlay.innerHTML = `
      <div class="ex-picker-head">
        <button class="ex-picker-back" onclick="UI._closeSheet()">✕</button>
        <span class="ex-picker-title">${isSwap?"Swap Exercise":"Add Exercise"}</span>
      </div>
      <div class="ex-picker-search">
        <input type="search" placeholder="Search exercises…" id="ex-search" autocomplete="off" autocorrect="off"
          oninput="
            const q=this.value.toLowerCase();
            document.querySelectorAll('#sess-sheet .sheet-item').forEach(el=>{
              el.style.display=el.querySelector('.sheet-item-name').textContent.toLowerCase().includes(q)?'':'none';
            });
            document.querySelectorAll('#sess-sheet .sheet-group-label').forEach(l=>{
              let n=l.nextElementSibling,v=false;
              while(n&&!n.classList.contains('sheet-group-label')){if(n.style.display!=='none')v=true;n=n.nextElementSibling;}
              l.style.display=v?'':'none';
            });">
      </div>
      <div class="ex-picker-list">${listHTML}</div>
    `;
    document.body.appendChild(overlay);
    setTimeout(()=>document.getElementById("ex-search")?.focus(), 200);
  },

  _pickEx(id, name, baseline) {
    this._closeSheet();
    const { session } = App.state;
    if (!session) return;
    const ww = Math.round(((baseline||45)*0.85)/5)*5;
    const newEx = {
      id, name, rest:"90 sec", tip:"", bodyweight:baseline===0,
      sets: Array.from({length:3},()=>({
        isWarmup:false, reps:8, weight:ww,
        prev:{reps:8,weight:ww}, claimed:{}, logged:false, excluded:false
      }))
    };
    if (this._swappingEi !== undefined) {
      session.exercises[this._swappingEi] = newEx;
      this._swappingEi = undefined;
    } else {
      session.exercises.push(newEx);
      this._activeExIdx = session.exercises.length-1;
    }
    this._buildBody();
    this._updateHeader();
  },

  // ── CONFIRM / SAVE ────────────────────────────────────────────────────────
  _confirmEnd() {
    this._closeSheet();
    const s = document.createElement("div");
    s.id = "sess-sheet";
    s.className = "sheet-overlay";
    s.innerHTML = `<div class="confirm-sheet">
      <div class="confirm-sheet-title">End workout?</div>
      <button class="confirm-action" onclick="UI._save()">Save & exit</button>
      <button class="confirm-action danger" onclick="UI._discard()">Discard</button>
      <button class="confirm-action muted" onclick="UI._closeSheet()">Keep going</button>
    </div>`;
    s.addEventListener("click", e=>{ if(e.target===s) this._closeSheet(); });
    document.body.appendChild(s);
  },

  _confirmFinish() {
    const allDone = App.state.session?.exercises.every(ex =>
      ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
    if (allDone) { this._save(); return; }
    const s = document.createElement("div");
    s.id = "sess-sheet";
    s.className = "sheet-overlay";
    s.innerHTML = `<div class="confirm-sheet">
      <div class="confirm-sheet-title">Some sets aren't done</div>
      <button class="confirm-action" onclick="UI._save()">Save anyway</button>
      <button class="confirm-action muted" onclick="UI._closeSheet()">Keep going</button>
    </div>`;
    s.addEventListener("click", e=>{ if(e.target===s) this._closeSheet(); });
    document.body.appendChild(s);
  },

  _discard() {
    this._closeSheet();
    this._stopRest();
    App.state.session = App.state.activeDay = null;
    this.nav("picker");
  },

  async _save() {
    this._closeSheet();
    this._stopRest();
    const { session, activeDay } = App.state;
    if (!session) return;
    this._toast("Saving…");
    const toSave = {
      ...session,
      exercises: session.exercises.map(ex => ({
        ...ex, sets: ex.sets.filter(s=>!s.excluded)
      })).filter(ex=>ex.sets.length>0)
    };
    if (this._logDate) toSave.date = this._logDate;
    const day = PROGRAM[activeDay];
    if (day?.sportOnly) {
      const type  = document.getElementById("sport-type")?.value||"Sport";
      const dur   = document.getElementById("sport-duration")?.value||0;
      const notes = document.getElementById("sport-notes")?.value||"";
      toSave.exercises=[{id:"sport",name:type,sets:[{reps:`${dur} min`,weight:0,note:notes}]}];
    }
    try {
      await App.saveSession(toSave);
      this._toast("Saved ✓");
      App.state.session = App.state.activeDay = null;
      App.state.history = null;
      setTimeout(()=>this.nav("picker"), 800);
    } catch(e) { this._toast("Save failed"); }
  },

  // ── SPORT LOG ─────────────────────────────────────────────────────────────
  renderSportLog(session, day) {
    const block = this.el("div","ex-block");
    block.innerHTML=`<div class="sport-log"><div class="sport-log-label">Log your session</div><div class="sport-fields">
      <label>Activity<select id="sport-type" class="sport-select"><option>Basketball</option><option>Pickleball</option><option>Hike</option><option>Other</option></select></label>
      <label>Duration (min)<input type="number" id="sport-duration" class="set-input" placeholder="60" value="60"></label>
      <label>Notes<input type="text" id="sport-notes" class="set-input" placeholder="e.g. pickup, 5 games"></label>
    </div></div>`;
    return block;
  },

  // ── STATS ─────────────────────────────────────────────────────────────────
  async renderStats() {
    const wrap = this.el("div","page");
    wrap.innerHTML = `
      <header class="page-header-compact">
        <div class="compact-date-row"><span class="compact-date">Progress</span></div>
        <h1 class="page-title-compact">Stats</h1>
      </header>
      <div class="stats-tabs">
        <button class="stats-tab ${this._statsTab==="body"?"active":""}"   onclick="UI._setTab('body')">Body</button>
        <button class="stats-tab ${this._statsTab==="lifts"?"active":""}"  onclick="UI._setTab('lifts')">Lifts</button>
        <button class="stats-tab ${this._statsTab==="recomp"?"active":""}" onclick="UI._setTab('recomp')">Recomp</button>
        <button class="stats-tab ${this._statsTab==="coach"?"active":""}"  onclick="UI._setTab('coach')">Coach</button>
      </div>
      <div id="stats-content"><div class="loading-text">Loading…</div></div>`;
    this.root.appendChild(wrap);
    if (!App.state.stats) App.state.stats = await App.fetchStats();
    this._renderStatsTab();
  },

  _setTab(tab) {
    this._statsTab = tab;
    document.querySelectorAll(".stats-tab").forEach(b=>b.classList.toggle("active",b.textContent.toLowerCase().trim()===tab));
    this._renderStatsTab();
  },

  _renderStatsTab() {
    const el = document.getElementById("stats-content");
    if (!el) return;
    const stats = App.state.stats;
    const tab = this._statsTab;
    if (tab==="body")  { this._bodyTab().then(h=>{if(el)el.innerHTML=h;}); return; }
    if (tab==="lifts") el.innerHTML = this._liftsTab(stats);
    if (tab==="recomp")el.innerHTML = this._recompTab(stats);
    if (tab==="coach") el.innerHTML = this._coachTab(stats);
  },

  async _bodyTab() {
    let entries = App.state.bwLog;
    if (!entries) { entries = await App.getBodyweightLog(); App.state.bwLog = entries; }
    const latest = entries.length ? entries[entries.length-1] : null;
    const gl=CONFIG.GOAL_LB_LOW, gh=CONFIG.GOAL_LB_HIGH;
    const inGoal = latest && latest.w>=gl && latest.w<=gh;
    const today  = new Date().toISOString().split("T")[0];
    const todayE = entries.find(e=>e.date===today);
    const r = this._bwRange;
    const rl = {30:"30 days",90:"90 days",365:"1 year",0:"All time"};
    return `
      <div class="bw-log-entry">
        <div class="bw-log-left">
          <div class="bw-current">${latest?latest.w+" lbs":"— lbs"}</div>
          <div class="bw-goal ${inGoal?"in-goal":""}">Goal: ${gl}–${gh} ${inGoal?"✓":""}</div>
        </div>
      </div>
      <div class="bw-quick-entry"><div class="bw-quick-row">
        <input type="number" inputmode="decimal" id="bw-in" class="bw-quick-num"
          placeholder="${todayE?todayE.w:"170.0"}" step="0.1" value="${todayE?todayE.w:""}">
        <span class="bw-quick-unit">lbs</span>
        <input type="date" id="bw-date" class="bw-quick-date-input" value="${today}" max="${today}">
        <button class="bw-quick-save" onclick="UI._saveBW()">${todayE?"Update":"Save"}</button>
      </div></div>
      ${entries.length>=2?`
        <div class="bw-range-toggle">
          ${[30,90,365,0].map(rv=>`<button class="bw-range-btn ${r===rv?"active":""}" onclick="UI._setBWRange(${rv})">${rl[rv]}</button>`).join("")}
        </div>
        <div id="bw-chart">${this._bwChart(entries,r)}</div>
      `:""}
      <div class="section-head-plain" style="margin-top:16px">History</div>
      <div class="bw-history">
        ${entries.slice().reverse().slice(0,30).map(e=>`
          <div class="bw-hist-row">
            <span class="bw-hist-date">${this._date(e.date)}</span>
            <span class="bw-hist-val">${e.w} lbs</span>
            <button class="bw-hist-del" onclick="App.deleteBodyweight('${e.date}').then(()=>{App.state.bwLog=null;UI._setTab('body')})">✕</button>
          </div>`).join("")||`<div class="loading-text muted">No entries</div>`}
      </div>`;
  },

  _saveBW() {
    const w=parseFloat(document.getElementById("bw-in")?.value);
    const d=document.getElementById("bw-date")?.value;
    if (!w||w<50||w>500){this._toast("Enter a valid weight");return;}
    App.logBodyweight(d,w); App.state.bwLog=null;
    this._toast("Saved ✓");
    setTimeout(()=>this._setTab("body"),500);
  },

  _setBWRange(r) {
    this._bwRange=r;
    const el=document.getElementById("bw-chart");
    if(el&&App.state.bwLog)el.innerHTML=this._bwChart(App.state.bwLog,r);
    const rl={30:"30 days",90:"90 days",365:"1 year",0:"All time"};
    document.querySelectorAll(".bw-range-btn").forEach(b=>b.classList.toggle("active",b.textContent.trim()===rl[r]));
  },

  _bwChart(entries, range) {
    const data=range>0?entries.slice(-range):entries;
    if(data.length<2)return"";
    const ws=data.map(e=>e.w),mn=Math.min(...ws)-2,mx=Math.max(...ws)+2,rng=mx-mn||1;
    const gl=CONFIG.GOAL_LB_LOW,gh=CONFIG.GOAL_LB_HIGH,W=320,H=100;
    const pts=data.map((e,i)=>`${(i/(data.length-1))*W},${H-((e.w-mn)/rng)*H}`).join(" ");
    const n=data.length,sx=data.reduce((s,_,i)=>s+i,0),sy=data.reduce((s,e)=>s+e.w,0);
    const sxy=data.reduce((s,e,i)=>s+i*e.w,0),sx2=data.reduce((s,_,i)=>s+i*i,0);
    const sl=(n*sxy-sx*sy)/(n*sx2-sx*sx||1),ic=(sy-sl*sx)/n;
    const ty0=H-((ic-mn)/rng)*H,ty1=H-(((sl*(n-1)+ic)-mn)/rng)*H;
    const tr=sl<-0.05?"↓ trending down":sl>0.05?"↑ trending up":"→ steady";
    const gBot=H-((gh-mn)/rng)*H,gH=Math.max(0,((gh-gl)/rng)*H);
    return `<div class="chart-block" style="padding:14px">
      <div class="chart-title-row"><span class="chart-title">${data.length} entries</span><span class="chart-trend">${tr}</span></div>
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
          <rect x="0" y="${gBot}" width="${W}" height="${gH}" fill="rgba(61,255,160,.08)"/>
          <line x1="0" y1="${ty0}" x2="${W}" y2="${ty1}" stroke="#5ba4ff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
          <polyline points="${pts}" fill="none" stroke="#e8ff47" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${data.length<=20?data.map((e,i)=>`<circle cx="${(i/(data.length-1))*W}" cy="${H-((e.w-mn)/rng)*H}" r="2.5" fill="#e8ff47"/>`).join(""):""}
        </svg>
        <div class="svg-y-labels"><span>${mx.toFixed(0)}</span><span>${((mx+mn)/2).toFixed(0)}</span><span>${mn.toFixed(0)}</span></div>
      </div>
      <div class="chart-goal-label"><span class="goal-band-dot"></span> Goal ${gl}–${gh} lbs</div>
    </div>`;
  },

  _liftsTab(stats) {
    const vh=stats.volumeHistory||{};
    const lifts=[{id:"bench",name:"Bench Press",c:"#e8ff47"},{id:"squat",name:"Back Squat",c:"#ff6b35"},{id:"clean",name:"Power Clean",c:"#3dffa0"},{id:"rdl",name:"RDL",c:"#5ba4ff"}];
    const ep=(w,r)=>Math.round(w*(1+r/30));
    return lifts.map(l=>{
      const data=(vh[l.id]||[]).slice().reverse().map(d=>({date:d.date,orm:ep(d.weight,d.reps)}));
      if(data.length<3)return`<div class="chart-block"><div class="chart-title">${l.name} — Est. 1RM</div><div class="loading-text muted">Log ${Math.max(0,3-data.length)} more session${3-data.length!==1?"s":""} to see trend.</div></div>`;
      const orms=data.map(d=>d.orm),mn=Math.min(...orms)-10,mx=Math.max(...orms)+10,rng=mx-mn||1,W=320,H=80;
      const pts=data.map((d,i)=>`${(i/(data.length-1))*W},${H-((d.orm-mn)/rng)*H}`).join(" ");
      const gain=orms[orms.length-1]-orms[0];
      return`<div class="chart-block">
        <div class="chart-title-row"><span class="chart-title">${l.name} — Est. 1RM</span><span class="orm-badge" style="color:${l.c}">${orms[orms.length-1]} lbs</span></div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <polyline points="${pts}" fill="none" stroke="${l.c}" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div class="svg-y-labels"><span>${mx}</span><span>${Math.round((mx+mn)/2)}</span><span>${mn}</span></div>
        </div>
        <div class="lift-meta-row">
          <span class="lift-meta-item"><span class="lift-meta-lbl">Program gain</span><span class="lift-meta-val" style="color:${gain>=0?"#3dffa0":"#ff6b35"}">${gain>=0?"+":""}${gain} lbs</span></span>
          <span class="lift-meta-item"><span class="lift-meta-lbl">Sessions</span><span class="lift-meta-val">${data.length}</span></span>
        </div>
      </div>`;
    }).join("");
  },

  _recompTab(stats) {
    const vh=stats.volumeHistory||{},bwLog=App.state.bwLog||[];
    const ep=(w,r)=>Math.round(w*(1+r/30));
    const rd=(vh["squat"]||[]).slice().reverse().map(s=>{
      const orm=ep(s.weight,s.reps);
      const bw=bwLog.reduce((b,e)=>Math.abs(new Date(e.date)-new Date(s.date))<Math.abs(new Date(b.date||"2099")-new Date(s.date))?e:b,bwLog[0]);
      return bw?{date:s.date,ratio:(orm/bw.w).toFixed(2)}:null;
    }).filter(Boolean);
    if(rd.length<3)return`<div class="recomp-explainer">Squat 1RM ÷ Bodyweight — rises as you recomp.</div><div class="loading-text muted">Need ${Math.max(0,3-rd.length)} more session${3-rd.length!==1?"s":""}.</div>`;
    const vals=rd.map(d=>parseFloat(d.ratio)),mn=Math.min(...vals)-.05,mx=Math.max(...vals)+.05,rng=mx-mn||1,W=320,H=80;
    const pts=rd.map((d,i)=>`${(i/(rd.length-1))*W},${H-((parseFloat(d.ratio)-mn)/rng)*H}`).join(" ");
    const gain=(rd[rd.length-1].ratio-rd[0].ratio).toFixed(2);
    return`<div class="recomp-explainer">Squat 1RM ÷ Bodyweight. Best single metric for recomp progress.</div>
      <div class="chart-block">
        <div class="chart-title-row"><span class="chart-title">Strength / Bodyweight</span><span class="orm-badge" style="color:#3dffa0">${rd[rd.length-1].ratio}×</span></div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <polyline points="${pts}" fill="none" stroke="#3dffa0" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div class="svg-y-labels"><span>${mx.toFixed(2)}</span><span>${((mx+mn)/2).toFixed(2)}</span><span>${mn.toFixed(2)}</span></div>
        </div>
        <div class="lift-meta-row">
          <span class="lift-meta-item"><span class="lift-meta-lbl">Program change</span><span class="lift-meta-val" style="color:${parseFloat(gain)>=0?"#3dffa0":"#ff6b35"}">${parseFloat(gain)>=0?"+":""}${gain}×</span></span>
          <span class="lift-meta-item"><span class="lift-meta-lbl">Target</span><span class="lift-meta-val" style="color:#e8ff47">1.5× BW</span></span>
        </div>
      </div>`;
  },

  _coachTab(stats) {
    const s=stats.stretches||{};
    return`${Object.keys(s).length?`<div class="section-head-plain">Stretch targets</div><div class="stretch-list">
      ${Object.entries(s).map(([,v])=>`<div class="stretch-row"><span class="stretch-name">${v.name}</span><span class="stretch-curr">${v.current}</span><span class="stretch-arrow">→</span><span class="stretch-target">${v.target}</span></div>`).join("")}
    </div>`:`<div class="loading-text muted">Log sessions to see targets.</div>`}
    <div class="section-head-plain" style="margin-top:16px">Coaching export</div>
    <div class="claude-export-card">
      <div class="claude-export-text">Copies your training summary for Claude.</div>
      <button class="btn-claude" id="claude-btn" onclick="UI._copyCoach()">Copy for Claude</button>
    </div>`;
  },

  async _copyCoach() {
    const btn=document.getElementById("claude-btn");
    if(btn){btn.textContent="Building…";btn.disabled=true;}
    try{
      const text=await App.buildClaudeExport();
      await navigator.clipboard.writeText(text);
      this._toast("Copied ✓");
      if(btn)btn.textContent="Copied ✓";
      setTimeout(()=>{if(btn){btn.textContent="Copy for Claude";btn.disabled=false;}},3000);
    }catch(e){if(btn){btn.textContent="Copy for Claude";btn.disabled=false;}this._toast("Copy failed");}
  },

  // ── HISTORY ───────────────────────────────────────────────────────────────
  async renderHistory() {
    const wrap=this.el("div","page");
    wrap.innerHTML=`
      <header class="page-header-compact">
        <div class="compact-date-row"><span class="compact-date">All sessions</span></div>
        <h1 class="page-title-compact">History</h1>
      </header>
      <div id="hist-content"><div class="loading-text">Loading…</div></div>`;
    this.root.appendChild(wrap);
    if(!App.state.history){const{sessions}=await App.fetchHistory();App.state.history=sessions;}
    const el=document.getElementById("hist-content");
    if(!el)return;
    const sessions=App.state.history;
    if(!sessions?.length){el.innerHTML=`<div class="loading-text muted">No sessions yet.</div>`;return;}
    el.innerHTML=sessions.map(s=>`
      <div class="history-card">
        <div class="history-header">
          <span class="history-date">${this._date(s.date)}</span>
          <span class="history-day">${s.dayTitle}</span>
        </div>
        <div class="history-exercises">
          ${s.exercises.map(ex=>{
            const best=ex.sets?.reduce((b,st)=>parseFloat(st.weight)>parseFloat(b?.weight||0)?st:b,null);
            return`<div class="history-ex"><span class="history-ex-name">${ex.name}</span><span class="history-ex-sets">${best&&best.weight?`${best.weight}×${best.reps}`:""}</span></div>`;
          }).join("")}
        </div>
      </div>`).join("");
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────
  _date(iso) {
    if(!iso)return"";
    const s=String(iso).slice(0,10);
    const today=new Date().toISOString().slice(0,10);
    const yest=new Date(Date.now()-86400000).toISOString().slice(0,10);
    if(s===today)return"Today";
    if(s===yest)return"Yesterday";
    const d=new Date(s+"T12:00:00");
    const ago=Math.round((Date.now()-d)/86400000);
    if(ago<7)return`${ago} days ago`;
    return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  },

  el(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;},

  _toast(msg){
    let t=document.getElementById("toast");
    if(!t){t=document.createElement("div");t.id="toast";document.body.appendChild(t);}
    t.textContent=msg;t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT=setTimeout(()=>t.classList.remove("show"),2500);
  },

  // Legacy shims
  showToast(m){this._toast(m);},
  saveSession(){return this._save();},
  toggleSet(ei,si){this._tapDone(ei,si);},
  toggleExclude(ei,si){this._toggleExclude(ei,si);},
  updateSet(ei,si,f,v){if(App.state.session?.exercises?.[ei]?.sets?.[si])App.state.session.exercises[ei].sets[si][f]=v;},
  changeWeek(d){const n=Math.max(1,Math.min(13,getCurrentWeek()+d));setCurrentWeek(n);this.render();},
  setStatsTab(t){this._setTab(t);},
  renderBodyTab(){return this._bodyTab();},
  renderLiftsTab(s){return this._liftsTab(s);},
  renderRecompTab(s){return this._recompTab(s);},
  renderCoachTab(s){return this._coachTab(s);},
  copyForClaude(){this._copyCoach();}
};
