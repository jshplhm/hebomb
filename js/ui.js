// ─── UI ────────────────────────────────────────────────────────────────────────
const UI = {

  // ── INIT ──────────────────────────────────────────────────────────────────
  init() {
    this.root        = document.getElementById("app");
    this._restTimer  = null;
    this._restTarget = null;
    this._restTotal  = 0;
    this._activeExIdx = null;
    this._logDate    = null;
    this._bwRange    = 30;
    this._prefetch();
    this.render();
  },

  async _prefetch() {
    try {
      const [stats, bwResult, histResult] = await Promise.all([
        App.state.stats   ? Promise.resolve(App.state.stats)   : App.fetchStats(),
        App.state.bwLog   ? Promise.resolve({ entries: App.state.bwLog }) : (App.fetchBodyweightLog?.() || this._fetchBWFallback()),
        App.state.history ? Promise.resolve({ sessions: App.state.history }) : App.fetchHistory()
      ]);
      App.state.stats   = stats;
      App.state.bwLog   = bwResult.entries || bwResult;
      App.state.history = histResult.sessions || histResult;
      this._refreshOpenView();
    } catch(e) {}
  },

  async _fetchBWFallback() {
    const entries = await App.getBodyweightLog();
    return { entries };
  },

  _refreshOpenView() {
    const v = App.state.view;
    if (v === "home") {
      const a = document.getElementById("home-stats-area");
      if (a && App.state.stats) this._renderHomeStatsInto(a, App.state.stats);
    }
    if (v === "stats") {
      const c = document.getElementById("stats-tab-content");
      if (c) this.renderStatsTab(App.state.stats);
    }
    if (v === "history") {
      const c = document.getElementById("history-content");
      if (c && App.state.history) this._renderHistoryInto(c, App.state.history);
    }
  },

  _invalidateCache() {
    App.state.stats = App.state.bwLog = App.state.history = null;
  },

  // ── RENDER ────────────────────────────────────────────────────────────────
  render() {
    const v = App.state.view;
    this.root.innerHTML = "";

    // Session is a full-screen takeover — no nav
    if (v === "session") {
      this.renderSession();
      return;
    }

    if (v === "home")    this.renderHome();
    if (v === "log")     this.renderLog();
    if (v === "history") this.renderHistory();
    if (v === "stats")   this.renderStats();
    this.renderNav();
  },

  nav(view) {
    App.state.view = view;
    this.render();
    window.scrollTo(0, 0);
  },

  // ── NAV ───────────────────────────────────────────────────────────────────
  renderNav() {
    document.getElementById("bottom-nav")?.remove();
    const nav = document.createElement("nav");
    nav.id = "bottom-nav";
    nav.className = "bottom-nav";

    const icons = {
      home: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M8 20v-8h6v8"/></svg>`,
      log:  `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="9"/><path d="M11 7v4l3 3"/></svg>`,
      stats:`<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,17 8,11 12,14 19,6"/><polyline points="15,6 19,6 19,10"/></svg>`,
      history:`<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h16M3 12h10M3 17h7"/></svg>`
    };
    const tabs = [
      { id:"home",    icon:icons.home,    label:"Today" },
      { id:"log",     icon:icons.log,     label:"Log" },
      { id:"stats",   icon:icons.stats,   label:"Stats" },
      { id:"history", icon:icons.history, label:"History" }
    ];
    tabs.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "nav-btn" + (App.state.view === t.id ? " active" : "");
      btn.innerHTML = `<span class="nav-icon">${t.icon}</span><span class="nav-label">${t.label}</span>`;
      btn.onclick = () => this.nav(t.id);
      nav.appendChild(btn);
    });
    document.body.appendChild(nav);
  },

  // ── HOME — pure progress dashboard ────────────────────────────────────────
  renderHome() {
    const wrap = this.el("div", "page");
    const dateStr     = new Date().toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });
    const currentWeek = getCurrentWeek();
    const weekData    = WEEKS[currentWeek] || {};
    const phaseId     = weekData.phaseId || "strength";
    const phase       = weekData.phase   || {};

    const dayOrder    = ["dayA","dayB","dayC","sport"];
    const dayLabels   = { dayA:"Upper", dayB:"Lower", dayC:"Olympic", sport:"Sport" };
    const suggestedId = App.getSuggestedDay();
    const history     = App.state.history || [];
    const weekStart   = this._weekStart();
    const loggedThisWeek = new Set(history.filter(s => s.date >= weekStart).map(s => s.dayId));
    const sessionsDone   = Math.min(loggedThisWeek.size, 3);

    const dotHTML = dayOrder.map(id => {
      const done    = loggedThisWeek.has(id);
      const isToday = id === suggestedId;
      const cls = ["week-dot", done?"done":"", isToday&&!done?"today":""].filter(Boolean).join(" ");
      return `<div class="week-dot-col"><div class="${cls}"></div><span class="week-dot-label">${dayLabels[id]}</span></div>`;
    }).join("");

    wrap.innerHTML = `
      <header class="page-header-compact">
        <div class="compact-date-row">
          <span class="compact-date">${dateStr}</span>
          <span class="phase-badge phase-badge-${phaseId}">Wk ${currentWeek} · ${phase.label || ""}</span>
        </div>
      </header>

      <div class="week-progress-card">
        <div class="week-progress-top">
          <span class="week-progress-label">This week</span>
          <span class="week-progress-count">${sessionsDone} of 3 workouts</span>
        </div>
        <div class="week-progress-bar-wrap">
          <div class="week-progress-bar" style="width:${(sessionsDone/3)*100}%"></div>
        </div>
        <div class="week-day-dots">${dotHTML}</div>
      </div>

      <div id="home-stats-area" style="min-height:200px">
        <div class="loading-text muted" style="padding-top:20px">Loading…</div>
      </div>
    `;

    this.root.appendChild(wrap);
    this.loadHomeStats();
  },

  _renderSparkline(entries, goal_lo, goal_hi) {
    if (entries.length < 2) return "";
    const W = 320, H = 56;
    const weights = entries.map(e => e.w);
    const min = Math.min(...weights) - 2;
    const max = Math.max(...weights) + 2;
    const rng = max - min || 1;
    const pts = entries.map((e, i) => {
      const x = (i / (entries.length - 1)) * W;
      const y = H - ((e.w - min) / rng) * H;
      return `${x},${y}`;
    }).join(" ");
    const gLo = H - ((goal_lo - min) / rng) * H;
    const gHi = H - ((goal_hi - min) / rng) * H;
    const bandH = Math.max(0, gLo - gHi);
    return `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:56px;display:block;margin-top:10px">
        <rect x="0" y="${Math.min(gLo,gHi)}" width="${W}" height="${bandH}" fill="rgba(61,255,160,.08)"/>
        <polyline points="${pts}" fill="none" stroke="rgba(240,240,240,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  },

  _weekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(new Date().setDate(diff)).toISOString().split("T")[0];
  },

  changeWeek(delta) {
    const next = Math.max(1, Math.min(13, getCurrentWeek() + delta));
    setCurrentWeek(next);
    this.render();
  },

  async loadHomeStats() {
    const area = document.getElementById("home-stats-area");
    if (!area) return;
    try {
      const stats = App.state.stats || await App.fetchStats();
      App.state.stats = stats;
      this._renderHomeStatsInto(area, stats);
    } catch(e) {
      area.innerHTML = `<div class="loading-text muted">No data yet.</div>`;
    }
  },

  _renderHomeStatsInto(area, stats) {
    const last7  = stats.last7  || 0;
    const last30 = stats.last30 || 0;
    const wkColor = last7 >= 3 ? "var(--green)" : last7 >= 2 ? "var(--yellow)" : "var(--orange)";
    const stretches = stats.stretches || {};
    const keys = Object.keys(stretches).slice(0, 4);
    area.innerHTML = `
      <div class="section-head-plain" style="margin-top:18px">Activity</div>
      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-num" style="color:${wkColor}">${last7}</div>
          <div class="stat-lbl">this week<br><span style="color:var(--muted);font-size:10px">goal: 3</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${last30}</div>
          <div class="stat-lbl">last 30 days</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${(last30/4.3).toFixed(1)}</div>
          <div class="stat-lbl">avg / week</div>
        </div>
      </div>
      ${keys.length ? `
        <div class="section-head-plain" style="margin-top:18px">Stretch targets</div>
        <div class="stretch-list">
          ${keys.map(k => `
            <div class="stretch-row">
              <span class="stretch-name">${stretches[k].name}</span>
              <span class="stretch-curr">${stretches[k].current}</span>
              <span class="stretch-arrow">→</span>
              <span class="stretch-target">${stretches[k].target}</span>
            </div>`).join("")}
        </div>` : ""}
    `;
  },

  // ── LOG — workout picker only ──────────────────────────────────────────────
  renderLog() {
    const wrap = this.el("div", "page");
    const suggestedId = App.getSuggestedDay();
    const currentWeek = getCurrentWeek();
    const weekData    = WEEKS[currentWeek];

    wrap.innerHTML = `
      <header class="page-header-compact">
        <div class="compact-date-row">
          <span class="compact-date">${new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</span>
        </div>
        <h1 class="page-title-compact">Log</h1>
      </header>

      <div class="hero-card phase-bg-${weekData.phaseId}" style="margin-bottom:20px">
        <div class="hero-label">Suggested today</div>
        <div class="hero-title">${PROGRAM[suggestedId].title}</div>
        <button class="btn-primary" onclick="UI.startDay('${suggestedId}')">Start Workout</button>
      </div>

      <div class="section-head-plain">Or pick a different day</div>
      <div class="day-picker">
        ${["dayA","dayB","dayC","sport"].filter(id => id !== suggestedId).map(id => {
          const d = PROGRAM[id];
          return `<button class="day-pick-btn" onclick="UI.startDay('${id}')">
            <span class="dpb-label">${d.label || id}</span>
            <span class="dpb-title">${d.title}</span>
          </button>`;
        }).join("")}
      </div>

      <div class="section-head-plain" style="margin-top:24px">Log for a past date</div>
      <div class="log-date-row">
        <input type="date" id="log-past-date" class="bw-quick-date-input"
          value="${new Date().toISOString().split("T")[0]}"
          max="${new Date().toISOString().split("T")[0]}">
      </div>
    `;
    this.root.appendChild(wrap);
  },

  // ── START SESSION ─────────────────────────────────────────────────────────
  async startDay(dayId) {
    App.state.loading = true;
    App.state.activeDay = dayId;
    this._logDate = document.getElementById("log-past-date")?.value || null;
    const today = new Date().toISOString().split("T")[0];
    if (this._logDate === today) this._logDate = null;

    const session = App.newSession(dayId);
    const last = await App.fetchLastSession(dayId);
    App.state.lastSession = last;
    App.state.session = App.applyLastSession(session, last);
    App.state.loading = false;
    App.state.view = "session";
    this._activeExIdx = 0;
    this.render();
  },

  // ── SESSION — focused single-exercise view ────────────────────────────────
  renderSession() {
    const { session, activeDay } = App.state;
    if (!activeDay) { this.nav("log"); return; }
    if (!session) {
      this.root.innerHTML = `<div class="loading-text" style="padding-top:120px">Loading…</div>`;
      return;
    }

    const day = PROGRAM[activeDay];
    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek] || {};
    const phaseId = day.phaseId || weekData.phaseId || "strength";

    const wrap = document.createElement("div");
    wrap.id = "session-wrap";

    // ── Header: end button, phase, exercise name, set count, rest timer
    const hdr = document.createElement("div");
    hdr.id = "session-header";
    hdr.className = "session-header";
    hdr.innerHTML = `
      <div class="session-header-top">
        <button class="session-end-btn" onclick="UI._confirmEndSession()">✕ End</button>
        <span class="phase-badge phase-badge-${phaseId}">Wk ${currentWeek} · ${weekData.phase?.label || ""}</span>
      </div>
      <div class="session-title-row">
        <button class="session-ex-name" id="session-ex-name"
          oncontextmenu="event.preventDefault();UI._showExMenu()"
          ontouchstart="UI._longPressStart(event)"
          ontouchend="UI._longPressEnd()"
          ontouchmove="UI._longPressEnd()">—</button>
        <span class="session-set-count" id="session-set-count"></span>
      </div>
      <div id="rest-bar-inline" class="rest-bar-inline">
        <div id="rest-bar-fill-inline" class="rest-bar-fill-inline"></div>
        <div class="rest-bar-controls">
          <button class="rest-adj" onclick="UI._adjustRest(-30)">−30</button>
          <span id="rest-bar-time-inline" class="rest-bar-time-inline">0:00</span>
          <button class="rest-adj" onclick="UI._adjustRest(30)">+30</button>
          <button class="rest-skip" onclick="UI._cancelRestTimer()">Skip</button>
        </div>
      </div>
    `;
    wrap.appendChild(hdr);

    // ── Body: single focused exercise block (swappable)
    const body = document.createElement("div");
    body.id = "session-body";
    body.className = "session-body";
    wrap.appendChild(body);

    // ── Bottom bar: pills + finish
    const bottom = document.createElement("div");
    bottom.id = "session-bottom";
    bottom.className = "session-bottom";
    bottom.innerHTML = this._renderExPills(session);
    wrap.appendChild(bottom);

    this.root.appendChild(wrap);
    this._renderActiveExercise();
    this._updateSessionHeader();
  },

  // Render only the currently active exercise into session-body
  _renderActiveExercise() {
    const body = document.getElementById("session-body");
    if (!body) return;
    const { session } = App.state;
    const ei = this._activeExIdx || 0;
    if (!session?.exercises?.[ei]) return;

    const ex = session.exercises[ei];
    body.innerHTML = "";
    body.appendChild(this._renderSessionExBlock(ex, ei, session));

    // Add exercise button at bottom
    const addBtn = this.el("button", "btn-add-exercise");
    addBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg> Add Exercise`;
    addBtn.onclick = () => this.showExercisePicker(PROGRAM[App.state.activeDay], session);
    body.appendChild(addBtn);
  },

  _renderSessionExBlock(ex, ei, session) {
    const block = this.el("div", "ex-block session-ex-block");
    block.id = `ex-block-${ei}`;

    const sets = session.exercises[ei].sets;
    const doneCount = sets.filter(s => s.logged).length;
    const setCount  = sets.filter(s => !s.excluded).length;
    if (doneCount === setCount && setCount > 0) block.classList.add("ex-done");

    block.innerHTML = `
      ${ex.tip ? `<div class="ex-tip-session">${ex.tip}</div>` : ""}
      <div class="sets-grid">
        <div class="set-row header-row">
          <span>Set</span>
          <span class="col-reps-head">Reps</span>
          <span class="col-weight-head">Weight</span>
          <span>✓</span>
        </div>
        ${sets.map((set, si) => this._renderSetRow(ex, ei, si, set)).join("")}
      </div>
    `;
    return block;
  },

  _renderExPills(session) {
    const pills = session.exercises.map((ex, ei) => {
      const sets    = ex.sets;
      const done    = sets.filter(s => s.logged).length;
      const total   = sets.filter(s => !s.excluded).length;
      const allDone = done === total && total > 0;
      const active  = ei === (this._activeExIdx || 0);
      return `<button class="ex-pill ${active?"active":""} ${allDone?"done":""}"
        onclick="UI._jumpToEx(${ei})">${ex.name.split(" ").slice(0,2).join(" ")}</button>`;
    }).join("");
    const allFinished = session.exercises.every(ex =>
      ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
    return `
      <div class="ex-pill-scroll">${pills}</div>
      <button class="btn-finish ${allFinished?"ready":""}" onclick="UI._confirmFinish()">
        ${allFinished?"Finish ✓":"Finish"}
      </button>`;
  },

  _jumpToEx(ei) {
    this._activeExIdx = ei;
    this._renderActiveExercise();
    this._updateSessionHeader();
    this._updatePills();
    document.getElementById("session-body")?.scrollTo({ top: 0, behavior: "instant" });
  },

  _updateSessionHeader() {
    const ei = this._activeExIdx || 0;
    const session = App.state.session;
    if (!session) return;
    const ex = session.exercises[ei];
    if (!ex) return;
    const sets      = ex.sets;
    const done      = sets.filter(s => s.logged).length;
    const total     = sets.filter(s => !s.excluded).length;
    const nameEl    = document.getElementById("session-ex-name");
    const countEl   = document.getElementById("session-set-count");
    if (nameEl)  nameEl.textContent  = ex.name;
    if (countEl) countEl.textContent = `Set ${Math.min(done+1,total)} of ${total}`;
  },

  _updatePills() {
    const bottom = document.getElementById("session-bottom");
    if (bottom && App.state.session) bottom.innerHTML = this._renderExPills(App.state.session);
  },

  // Long-press on exercise name to open management menu
  _longPressStart(e) {
    this._longPressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      this._showExMenu();
    }, 500);
  },
  _longPressEnd() {
    clearTimeout(this._longPressTimer);
  },

  _showExMenu() {
    const ei = this._activeExIdx || 0;
    const session = App.state.session;
    const ex = session?.exercises?.[ei];
    if (!ex) return;

    const canMoveUp   = ei > 0;
    const canMoveDown = ei < session.exercises.length - 1;

    const sheet = document.createElement("div");
    sheet.className = "confirm-sheet-overlay";
    sheet.innerHTML = `
      <div class="confirm-sheet">
        <div class="confirm-sheet-title">${ex.name}</div>
        <div class="ex-menu-actions">
          ${canMoveUp ? `<button class="ex-menu-btn" onclick="UI._moveEx(${ei},-1);this.closest('.confirm-sheet-overlay').remove()">↑ Move Up</button>` : ""}
          ${canMoveDown ? `<button class="ex-menu-btn" onclick="UI._moveEx(${ei},1);this.closest('.confirm-sheet-overlay').remove()">↓ Move Down</button>` : ""}
          <button class="ex-menu-btn" onclick="UI._swapEx(${ei});this.closest('.confirm-sheet-overlay').remove()">⇄ Swap Exercise</button>
          <button class="ex-menu-btn danger" onclick="UI._removeEx(${ei});this.closest('.confirm-sheet-overlay').remove()">✕ Remove</button>
        </div>
        <button class="btn-ghost" style="width:100%;margin-top:10px" onclick="this.closest('.confirm-sheet-overlay').remove()">Cancel</button>
      </div>`;
    document.body.appendChild(sheet);
  },

  _moveEx(ei, dir) {
    const exs = App.state.session?.exercises;
    if (!exs) return;
    const ni = ei + dir;
    if (ni < 0 || ni >= exs.length) return;
    [exs[ei], exs[ni]] = [exs[ni], exs[ei]];
    this._activeExIdx = ni;
    this._renderActiveExercise();
    this._updateSessionHeader();
    this._updatePills();
  },

  _removeEx(ei) {
    const exs = App.state.session?.exercises;
    if (!exs || exs.length <= 1) { this.showToast("Can't remove last exercise"); return; }
    exs.splice(ei, 1);
    this._activeExIdx = Math.min(ei, exs.length - 1);
    this._renderActiveExercise();
    this._updateSessionHeader();
    this._updatePills();
  },

  _swapEx(ei) {
    // Open exercise picker — on selection it will replace this exercise
    this._swappingEi = ei;
    const day = PROGRAM[App.state.activeDay];
    this.showExercisePicker(day, App.state.session, true);
  },

  // Confirm before ending session
  _confirmEndSession() {
    const sheet = document.createElement("div");
    sheet.className = "confirm-sheet-overlay";
    sheet.innerHTML = `
      <div class="confirm-sheet">
        <div class="confirm-sheet-title">End workout?</div>
        <div class="confirm-sheet-sub">Choose what to do with this session.</div>
        <button class="btn-primary" style="margin-bottom:10px" onclick="UI._doSaveSession()">Save & Exit</button>
        <button class="btn-ghost" style="margin-bottom:10px;width:100%;color:var(--orange);border-color:var(--orange)" onclick="UI._discardSession()">Discard — don't save</button>
        <button class="btn-ghost" style="width:100%" onclick="this.closest('.confirm-sheet-overlay').remove()">Keep Going</button>
      </div>`;
    document.body.appendChild(sheet);
  },

  _discardSession() {
    document.querySelector(".confirm-sheet-overlay")?.remove();
    this._cancelRestTimer();
    App.state.session   = null;
    App.state.activeDay = null;
    App.state.view = "log";
    this.render();
  },

  _confirmFinish() {
    const session = App.state.session;
    const allFinished = session?.exercises.every(ex =>
      ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
    if (allFinished) {
      this._doSaveSession();
    } else {
      const sheet = document.createElement("div");
      sheet.className = "confirm-sheet-overlay";
      sheet.innerHTML = `
        <div class="confirm-sheet">
          <div class="confirm-sheet-title">Finish workout?</div>
          <div class="confirm-sheet-sub">Some sets aren't marked done yet.</div>
          <button class="btn-primary" style="margin-bottom:10px" onclick="UI._doSaveSession()">Save Anyway</button>
          <button class="btn-ghost" onclick="this.closest('.confirm-sheet-overlay').remove()">Keep Going</button>
        </div>`;
      document.body.appendChild(sheet);
    }
  },

  // ── SET RENDERING ─────────────────────────────────────────────────────────
  _renderSetRow(ex, ei, si, set) {
    const isExcluded = set.excluded || false;
    const isDone     = set.logged   || false;
    const prev       = set.prev; // ghost value from last session

    if (isExcluded) return `
      <div class="set-row excluded" id="set-${ei}-${si}">
        <span class="set-num">
          ${si + 1}
          <button class="skip-undo" onclick="UI.toggleExclude(${ei},${si})">undo</button>
        </span>
        <span class="set-skipped-label" style="grid-column:2/4">skipped</span>
        <span></span>
      </div>`;

    if (ex.bodyweight) return `
      <div class="set-row${isDone?" set-logged":""}" id="set-${ei}-${si}">
        <span class="set-num">${si+1}</span>
        <span class="set-bw-label" style="grid-column:2/4">${set.reps}</span>
        <button class="set-circle${isDone?" checked":""}" onclick="UI.toggleSet(${ei},${si})">
          ${isDone?`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 4 6-7"/></svg>`:""}
        </button>
      </div>`;

    const checkSVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 4 6-7"/></svg>`;
    // Ghost placeholder: show prev if value matches it (user hasn't changed it)
    const repsIsGhost   = prev && String(set.reps)   === String(prev.reps);
    const weightIsGhost = prev && String(set.weight) === String(prev.weight);

    return `
      <div class="set-row${isDone?" set-logged":""}" id="set-${ei}-${si}">
        <span class="set-num">${si+1}${set.note?`<em>${set.note}</em>`:""}</span>
        <span class="stepper">
          <button class="step-btn" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'reps',-1)">−</button>
          <span class="step-val${repsIsGhost?" ghost":""}" id="reps-val-${ei}-${si}">${set.reps}</span>
          <button class="step-btn" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'reps',1)">+</button>
        </span>
        <span class="stepper">
          <button class="step-btn" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'weight',-5)">−</button>
          <span class="step-val${weightIsGhost?" ghost":""}" id="wt-val-${ei}-${si}">${set.weight}</span>
          <button class="step-btn" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'weight',5)">+</button>
        </span>
        <button class="set-circle${isDone?" checked":""}" onclick="UI.toggleSet(${ei},${si})">
          ${isDone?checkSVG:""}
        </button>
      </div>`;
  },

  // ── SET ACTIONS ───────────────────────────────────────────────────────────
  updateSet(ei, si, field, value) {
    if (App.state.session?.exercises?.[ei]?.sets?.[si])
      App.state.session.exercises[ei].sets[si][field] = value;
  },

  _step(ei, si, field, delta) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set) return;
    const next = Math.max(0, (parseFloat(set[field]) || 0) + delta);
    set[field] = next;
    // Stepping claims the value — remove ghost styling
    const id = field === "reps" ? `reps-val-${ei}-${si}` : `wt-val-${ei}-${si}`;
    const el = document.getElementById(id);
    if (el) { el.textContent = next; el.classList.remove("ghost"); }
  },

  toggleSet(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set || set.excluded) return;
    set.logged = !set.logged;

    const row = document.getElementById(`set-${ei}-${si}`);
    if (row) {
      row.classList.toggle("set-logged", set.logged);
      const btn = row.querySelector(".set-circle");
      if (btn) {
        btn.classList.toggle("checked", set.logged);
        const svg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 4 6-7"/></svg>`;
        btn.innerHTML = set.logged ? svg : "";
      }
    }

    const ex = App.state.session.exercises[ei];
    const setCount  = ex.sets.filter(s=>!s.excluded).length;
    const doneCount = ex.sets.filter(s=>s.logged).length;
    const block = document.getElementById(`ex-block-${ei}`);
    if (block) block.classList.toggle("ex-done", doneCount===setCount && setCount>0);

    // Advance to next exercise when all sets done
    if (set.logged && doneCount === setCount) {
      const nextEi = ei + 1;
      if (nextEi < App.state.session.exercises.length) {
        setTimeout(() => this._jumpToEx(nextEi), 600);
      }
    } else {
      this._updateSessionHeader();
      this._updatePills();
    }

    if (set.logged) {
      const restSec = this._parseRestToSeconds(ex.rest);
      if (restSec > 0) this._startRestTimer(ei, restSec);
    } else {
      if (this._activeExIdx === ei) this._cancelRestTimer();
    }
  },

  toggleExclude(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set) return;
    set.excluded = !set.excluded;
    if (set.excluded) set.logged = false;
    this._renderActiveExercise();
    this._updateSessionHeader();
    this._updatePills();
  },

  _copySetDown(ei, si) {
    const sets = App.state.session?.exercises?.[ei]?.sets;
    if (!sets) return;
    const src = sets[si];
    for (let i = si + 1; i < sets.length; i++) {
      if (sets[i].excluded) continue;
      sets[i].reps   = src.reps;
      sets[i].weight = src.weight;
      const rEl = document.getElementById(`reps-val-${ei}-${i}`);
      const wEl = document.getElementById(`wt-val-${ei}-${i}`);
      if (rEl) { rEl.textContent = src.reps;   rEl.classList.remove("ghost"); }
      if (wEl) { wEl.textContent = src.weight; wEl.classList.remove("ghost"); }
    }
    this.showToast("Copied ↓");
  },

  // ── REST TIMER ────────────────────────────────────────────────────────────
  _parseRestToSeconds(s) {
    if (!s) return 90;
    const m = s.match(/(\d+)\s*min/i); if (m) return parseInt(m[1])*60;
    const sc = s.match(/(\d+)\s*sec/i); if (sc) return parseInt(sc[1]);
    const n = parseInt(s); return isNaN(n) ? 90 : n;
  },

  _startRestTimer(ei, seconds) {
    this._cancelRestTimer();
    this._activeExIdx = ei;
    this._restTarget  = Date.now() + seconds * 1000;
    this._restTotal   = seconds;

    const bar = document.getElementById("rest-bar-inline");
    if (bar) bar.classList.add("visible");

    const update = () => {
      const rem = Math.max(0, Math.ceil((this._restTarget - Date.now()) / 1000));
      const pct = (rem / this._restTotal) * 100;
      const timeEl = document.getElementById("rest-bar-time-inline");
      const fillEl = document.getElementById("rest-bar-fill-inline");
      if (timeEl) timeEl.textContent = `${Math.floor(rem/60)}:${String(rem%60).padStart(2,"0")}`;
      if (fillEl) {
        fillEl.style.width = pct + "%";
        fillEl.style.background = pct > 50 ? "var(--green)" : pct > 25 ? "var(--orange)" : "#ff3b3b";
      }
      if (rem <= 0) {
        this._cancelRestTimer();
        if (timeEl) timeEl.textContent = "Go!";
        // Vibrate if supported
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        // Pulse the fill briefly
        if (fillEl) {
          fillEl.style.width = "100%";
          fillEl.style.background = "var(--yellow)";
        }
        setTimeout(() => {
          const b = document.getElementById("rest-bar-inline");
          if (b) b.classList.remove("visible");
        }, 2000);
      }
    };
    update();
    this._restTimer = setInterval(update, 500);
  },

  _cancelRestTimer() {
    if (this._restTimer) { clearInterval(this._restTimer); this._restTimer = null; }
    const bar = document.getElementById("rest-bar-inline");
    if (bar) bar.classList.remove("visible");
  },

  _adjustRest(delta) {
    if (!this._restTarget) return;
    this._restTarget += delta * 1000;
    this._restTotal   = Math.max(1, this._restTotal + delta);
  },

  // ── SAVE SESSION ──────────────────────────────────────────────────────────
  async saveSession() { await this._doSaveSession(); },

  async _doSaveSession() {
    document.querySelector(".confirm-sheet-overlay")?.remove();
    const { session, activeDay } = App.state;
    const day = PROGRAM[activeDay];
    if (!session) return;

    const sessionToSave = {
      ...session,
      exercises: session.exercises.map(ex => ({
        ...ex, sets: (ex.sets||[]).filter(s => !s.excluded)
      })).filter(ex => ex.sets.length > 0)
    };
    if (this._logDate) sessionToSave.date = this._logDate;

    if (day.sportOnly) {
      const type  = document.getElementById("sport-type")?.value  || "Sport";
      const dur   = document.getElementById("sport-duration")?.value || 0;
      const notes = document.getElementById("sport-notes")?.value  || "";
      sessionToSave.exercises = [{ id:"sport", name:type, sets:[{reps:`${dur} min`,weight:0,note:notes}] }];
    }

    this.showToast("Saving…");
    try {
      const result = await App.saveSession(sessionToSave);
      this._cancelRestTimer();
      this._invalidateCache();
      this.showToast(result.local ? "Saved locally ✓" : "Saved ✓");
      App.state.session  = null;
      App.state.activeDay = null;
      setTimeout(() => { App.state.view = "home"; this.render(); }, 900);
    } catch(e) {
      this.showToast("Save failed — try again");
    }
  },

  // ── EXERCISE PICKER SHEET ─────────────────────────────────────────────────
  showExercisePicker(day, session) {
    const groups = {
      "Upper — Push":["push_acc"],"Upper — Pull":["pull_acc"],
      "Upper — Biceps":["curl_acc"],"Upper — Delts":["latraise_acc"],
      "Core":["core_upper","core_lower","sideplank_acc"],
      "Lower — Quad":["leg_acc"],"Lower — Hamstring":["hamstring_acc"],
      "Lower — Calves":["calf_acc"],"Olympic":["snatch_acc","jerk_acc"],
      "Lower — Squat":["squat_fri_acc"],"Lower — Deadlift":["rdl_fri_acc"]
    };
    const exMap = {};
    Object.entries(groups).forEach(([g, keys]) => {
      keys.forEach(k => {
        (ACC_POOLS[k]||[]).forEach(ex => { if (!exMap[ex.name]) exMap[ex.name] = {...ex, group:g}; });
      });
    });
    Object.values(MAIN_LIFTS||{}).forEach(ex => { if (!exMap[ex.name]) exMap[ex.name] = {...ex, group:"Main Lifts"}; });

    const all = Object.values(exMap).sort((a,b) => a.name.localeCompare(b.name));
    const overlay = this.el("div","sheet-overlay");
    overlay.id = "exercise-picker-overlay";

    const buildList = (filter) => {
      const filtered = filter ? all.filter(e => e.name.toLowerCase().includes(filter.toLowerCase())) : all;
      const byGroup = {};
      filtered.forEach(e => { (byGroup[e.group]=byGroup[e.group]||[]).push(e); });
      return Object.entries(byGroup).map(([g,exs]) => `
        <div class="sheet-group-label">${g}</div>
        ${exs.map(ex => `
          <div class="sheet-item" onclick="UI._addExerciseFromPicker('${ex.id}','${ex.name.replace(/'/g,"\\'")}',${ex.baseline||0})">
            <div>
              <div class="sheet-item-name">${ex.name}</div>
              ${ex.baseline?`<div class="sheet-item-meta">Baseline ${ex.baseline} lbs</div>`:""}
            </div>
            <span class="sheet-item-add">+</span>
          </div>`).join("")}`).join("") || `<div class="loading-text muted">No matches.</div>`;
    };

    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Add Exercise</span>
          <button class="sheet-close" onclick="document.getElementById('exercise-picker-overlay').remove()">✕</button>
        </div>
        <div class="sheet-search">
          <input type="search" placeholder="Search…" id="ex-search-input" autocomplete="off" autocorrect="off"
            oninput="
              const q=this.value;
              document.querySelectorAll('#exercise-picker-overlay .sheet-item').forEach(el=>{
                el.style.display=el.querySelector('.sheet-item-name').textContent.toLowerCase().includes(q.toLowerCase())?'':'none';
              });
              document.querySelectorAll('#exercise-picker-overlay .sheet-group-label').forEach(lbl=>{
                let n=lbl.nextElementSibling,vis=false;
                while(n&&!n.classList.contains('sheet-group-label')){if(n.style.display!=='none')vis=true;n=n.nextElementSibling;}
                lbl.style.display=vis?'':'none';
              });">
        </div>
        <div class="sheet-list">${buildList("")}</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target===overlay) overlay.remove(); });
    setTimeout(() => document.getElementById("ex-search-input")?.focus(), 200);
  },

  _addExerciseFromPicker(id, name, baseline) {
    const { session, activeDay } = App.state;
    const day = PROGRAM[activeDay];
    if (!session || !day) return;
    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek] || {};
    const phaseId = day.phaseId || weekData.phaseId || "strength";
    const ww = Math.round(((baseline||45) * (phaseId==="strength"?1.0:phaseId==="hypertrophy"?0.85:0.70)) / 5) * 5;
    const sets = Array.from({length:3}, () => ({reps:8, weight:ww}));
    const newEx = {id, name, sets, rest:"90 sec", tip:"", bodyweight: baseline===0};

    document.getElementById("exercise-picker-overlay")?.remove();

    if (this._swappingEi !== undefined) {
      // Swap mode — replace existing exercise
      session.exercises[this._swappingEi] = newEx;
      this._swappingEi = undefined;
    } else {
      // Add mode — append
      session.exercises.push(newEx);
      this._activeExIdx = session.exercises.length - 1;
    }

    App.state.view = "session";
    this._renderActiveExercise();
    this._updateSessionHeader();
    this._updatePills();
  },

  // ── SPORT LOG ─────────────────────────────────────────────────────────────
  renderSportLog(session, day) {
    const block = this.el("div","ex-block");
    block.innerHTML = `<div class="sport-log">
      <div class="sport-log-label">Log your session</div>
      <div class="sport-fields">
        <label>Activity<select id="sport-type" class="sport-select">
          <option>Basketball</option><option>Pickleball</option><option>Hike</option><option>Other</option>
        </select></label>
        <label>Duration (min)<input type="number" inputmode="decimal" id="sport-duration" class="set-input" placeholder="60" value="60"></label>
        <label>Notes<input type="text" id="sport-notes" class="set-input notes-input" placeholder="e.g. pickup, 5 games"></label>
      </div>
    </div>`;
    return block;
  },

  // ── STATS ─────────────────────────────────────────────────────────────────
  async renderStats() {
    const wrap = this.el("div","page");
    if (!App.state.statsTab) App.state.statsTab = "body";
    wrap.innerHTML = `
      <header class="page-header-compact">
        <div class="compact-date-row"><span class="compact-date">Progress</span></div>
        <h1 class="page-title-compact">Stats</h1>
      </header>
      <div class="stats-tabs">
        <button class="stats-tab ${App.state.statsTab==="body"?"active":""}"   onclick="UI.setStatsTab('body')">Body</button>
        <button class="stats-tab ${App.state.statsTab==="lifts"?"active":""}"  onclick="UI.setStatsTab('lifts')">Lifts</button>
        <button class="stats-tab ${App.state.statsTab==="recomp"?"active":""}" onclick="UI.setStatsTab('recomp')">Recomp</button>
        <button class="stats-tab ${App.state.statsTab==="coach"?"active":""}"  onclick="UI.setStatsTab('coach')">Coach</button>
      </div>
      <div id="stats-tab-content"><div class="loading-text">Loading…</div></div>`;
    this.root.appendChild(wrap);
    if (App.state.stats) { this.renderStatsTab(App.state.stats); }
    else { const s = await App.fetchStats(); App.state.stats = s; this.renderStatsTab(s); }
  },

  setStatsTab(tab) {
    App.state.statsTab = tab;
    document.querySelectorAll(".stats-tab").forEach(b =>
      b.classList.toggle("active", b.textContent.toLowerCase().trim()===tab));
    const c = document.getElementById("stats-tab-content");
    if (c && App.state.stats) this.renderStatsTab(App.state.stats);
  },

  renderStatsTab(stats) {
    const c = document.getElementById("stats-tab-content");
    if (!c) return;
    const tab = App.state.statsTab || "body";
    if (tab==="body")   { this.renderBodyTab().then(h => { if(c) c.innerHTML=h; }); return; }
    if (tab==="lifts")  c.innerHTML = this.renderLiftsTab(stats);
    if (tab==="recomp") c.innerHTML = this.renderRecompTab(stats);
    if (tab==="coach")  c.innerHTML = this.renderCoachTab(stats);
  },

  async renderBodyTab() {
    let entries = App.state.bwLog;
    if (!entries) { entries = await App.getBodyweightLog(); App.state.bwLog = entries; }
    const latest = entries.length ? entries[entries.length-1] : null;
    const goal_lo = CONFIG.GOAL_LB_LOW, goal_hi = CONFIG.GOAL_LB_HIGH;
    const inGoal  = latest && latest.w >= goal_lo && latest.w <= goal_hi;
    const today   = new Date().toISOString().split("T")[0];
    const todayEntry = entries.find(e => e.date === today);
    const rangeLabels = {30:"30 days",90:"90 days",365:"1 year",0:"All time"};
    const r = this._bwRange;
    return `
      <div class="bw-log-entry">
        <div class="bw-log-left">
          <div class="bw-current">${latest?latest.w+" lbs":"— lbs"}</div>
          <div class="bw-goal ${inGoal?"in-goal":""}">Goal: ${goal_lo}–${goal_hi} lbs ${inGoal?"✓":""}</div>
        </div>
      </div>
      <div class="bw-quick-entry">
        <div class="bw-quick-row">
          <input type="number" inputmode="decimal" id="bw-quick-input" class="bw-quick-num"
            placeholder="${todayEntry?todayEntry.w:"170.0"}" step="0.1" value="${todayEntry?todayEntry.w:""}">
          <span class="bw-quick-unit">lbs</span>
          <input type="date" id="bw-quick-date" class="bw-quick-date-input" value="${today}" max="${today}">
          <button class="bw-quick-save" onclick="UI._saveQuickBW()">${todayEntry?"Update":"Save"}</button>
        </div>
      </div>
      ${entries.length>=2?`
        <div class="bw-range-toggle">
          ${[30,90,365,0].map(rv=>`<button class="bw-range-btn ${r===rv?"active":""}" onclick="UI._setBWRange(${rv})">${rangeLabels[rv]}</button>`).join("")}
        </div>
        <div id="bw-chart-area">${this.renderBWChart(entries,r)}</div>
      `:`<div class="loading-text muted" style="margin:16px 0">Log a few weights to see your trend.</div>`}
      <div class="section-head-plain" style="margin-top:16px">History</div>
      <div class="bw-history">
        ${entries.slice().reverse().slice(0,30).map(e=>`
          <div class="bw-hist-row">
            <span class="bw-hist-date">${this._fmtDate(e.date)}</span>
            <span class="bw-hist-val">${e.w} lbs</span>
            <button class="bw-hist-del" onclick="App.deleteBodyweight('${e.date}').then(()=>{App.state.bwLog=null;UI.setStatsTab('body')})">✕</button>
          </div>`).join("")||`<div class="loading-text muted">No entries yet.</div>`}
      </div>`;
  },

  _setBWRange(r) {
    this._bwRange = r;
    const a = document.getElementById("bw-chart-area");
    if (a && App.state.bwLog) a.innerHTML = this.renderBWChart(App.state.bwLog, r);
    const labels = {30:"30 days",90:"90 days",365:"1 year",0:"All time"};
    document.querySelectorAll(".bw-range-btn").forEach(b =>
      b.classList.toggle("active", b.textContent.trim()===labels[r]));
  },

  _saveQuickBW() {
    const w = parseFloat(document.getElementById("bw-quick-input")?.value);
    const d = document.getElementById("bw-quick-date")?.value;
    if (!w||w<50||w>500) { this.showToast("Enter a valid weight"); return; }
    App.logBodyweight(d, w);
    App.state.bwLog = null;
    this.showToast("Weight saved ✓");
    setTimeout(() => this.setStatsTab("body"), 600);
  },

  renderBWChart(entries, range) {
    const data = range > 0 ? entries.slice(-range) : entries;
    if (data.length < 2) return "";
    const weights = data.map(e=>e.w);
    const min = Math.min(...weights)-2, max = Math.max(...weights)+2;
    const rng = max-min||1;
    const goal_lo = CONFIG.GOAL_LB_LOW, goal_hi = CONFIG.GOAL_LB_HIGH;
    const gLoPct = ((goal_lo-min)/rng)*100, gHiPct = ((goal_hi-min)/rng)*100;
    const goalH = Math.max(0,Math.min(100,gHiPct-gLoPct));
    const goalBot = Math.max(0,Math.min(100,gLoPct));
    const W=320, H=100;
    const pts = data.map((e,i)=>{
      const x = data.length<2?W/2:(i/(data.length-1))*W;
      const y = H-((e.w-min)/rng)*H;
      return `${x},${y}`;
    }).join(" ");
    const n=data.length, sumX=data.reduce((s,_,i)=>s+i,0), sumY=data.reduce((s,e)=>s+e.w,0);
    const sumXY=data.reduce((s,e,i)=>s+i*e.w,0), sumX2=data.reduce((s,_,i)=>s+i*i,0);
    const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX||1);
    const intercept=(sumY-slope*sumX)/n;
    const ty0=H-((intercept-min)/rng)*H, ty1=H-(((slope*(n-1)+intercept)-min)/rng)*H;
    const trendDir=slope<-0.05?"↓ trending down":slope>0.05?"↑ trending up":"→ holding steady";
    return `
      <div class="chart-block" style="padding:14px 14px 10px">
        <div class="chart-title-row">
          <span class="chart-title">Bodyweight — ${data.length} entries</span>
          <span class="chart-trend">${trendDir}</span>
        </div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <rect x="0" y="${H-goalBot-goalH}%" width="${W}" height="${goalH}%" fill="rgba(232,255,71,.08)"/>
            <line x1="0" y1="${ty0}" x2="${W}" y2="${ty1}" stroke="#5ba4ff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
            <polyline points="${pts}" fill="none" stroke="#e8ff47" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${data.length<=20?data.map((e,i)=>{
              const x=data.length<2?W/2:(i/(data.length-1))*W;
              const y=H-((e.w-min)/rng)*H;
              return `<circle cx="${x}" cy="${y}" r="2.5" fill="#e8ff47"/>`;
            }).join(""):""}
          </svg>
          <div class="svg-y-labels">
            <span>${max.toFixed(0)}</span>
            <span>${((max+min)/2).toFixed(0)}</span>
            <span>${min.toFixed(0)}</span>
          </div>
        </div>
        <div class="chart-goal-label">
          <span class="goal-band-dot"></span> Goal zone ${goal_lo}–${goal_hi} lbs
        </div>
      </div>`;
  },

  renderLiftsTab(stats) {
    const vh = stats.volumeHistory||{};
    const lifts = [{id:"bench",name:"Bench Press",color:"#e8ff47"},{id:"squat",name:"Back Squat",color:"#ff6b35"},{id:"clean",name:"Power Clean",color:"#3dffa0"},{id:"rdl",name:"RDL",color:"#5ba4ff"}];
    const epley = (w,r) => Math.round(w*(1+r/30));
    return lifts.map(l => {
      const history = (vh[l.id]||[]).slice().reverse();
      const data = history.map(d=>({date:d.date,orm:epley(d.weight,d.reps)}));
      if (data.length < 3) return `<div class="chart-block"><div class="chart-title">${l.name}</div><div class="loading-text muted">Log ${3-data.length} more session${3-data.length!==1?"s":""} to see your progress curve.</div></div>`;
      const orms=data.map(d=>d.orm), minO=Math.min(...orms)-10, maxO=Math.max(...orms)+10;
      const rng=maxO-minO||1, W=320, H=80;
      const pts=data.map((d,i)=>{const x=(i/(data.length-1))*W,y=H-((d.orm-minO)/rng)*H;return`${x},${y}`;}).join(" ");
      const latest=orms[orms.length-1], gain=latest-orms[0];
      const stretch=(stats.stretches||{})[l.id];
      return `<div class="chart-block">
        <div class="chart-title-row">
          <span class="chart-title">${l.name} — Est. 1RM</span>
          <span class="orm-badge" style="color:${l.color}">${latest} lbs</span>
        </div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="svg-y-labels"><span>${maxO}</span><span>${Math.round((maxO+minO)/2)}</span><span>${minO}</span></div>
        </div>
        <div class="lift-meta-row">
          <span class="lift-meta-item"><span class="lift-meta-lbl">Program gain</span><span class="lift-meta-val" style="color:${gain>=0?"#3dffa0":"#ff6b35"}">${gain>=0?"+":""}${gain} lbs</span></span>
          ${stretch?`<span class="lift-meta-item"><span class="lift-meta-lbl">Next target</span><span class="lift-meta-val" style="color:#e8ff47">${stretch.target}</span></span>`:""}
          <span class="lift-meta-item"><span class="lift-meta-lbl">Sessions</span><span class="lift-meta-val">${data.length}</span></span>
        </div>
      </div>`;
    }).join("");
  },

  renderRecompTab(stats) {
    const vh=stats.volumeHistory||{};
    const bwLog=App.state.bwLog||[];
    const epley=(w,r)=>Math.round(w*(1+r/30));
    const squatH=(vh["squat"]||[]).slice().reverse();
    const ratioData=squatH.map(s=>{
      const orm=epley(s.weight,s.reps);
      const bw=bwLog.reduce((best,e)=>{const d1=Math.abs(new Date(e.date)-new Date(s.date)),d2=Math.abs(new Date(best.date||"2099")-new Date(s.date));return d1<d2?e:best;},bwLog[0]);
      if(!bw)return null;
      return{date:s.date,ratio:(orm/bw.w).toFixed(2),orm,bw:bw.w};
    }).filter(Boolean);
    const latest=ratioData[ratioData.length-1], first=ratioData[0];
    const ratioGain=latest&&first?(latest.ratio-first.ratio).toFixed(2):null;
    if (ratioData.length < 3) return `<div class="recomp-explainer">Squat 1RM ÷ Bodyweight. Rises as you recomp even when the scale barely moves.</div><div class="loading-text muted">Need ${3-ratioData.length} more session${3-ratioData.length!==1?"s":""} to calculate.</div>`;
    const vals=ratioData.map(d=>parseFloat(d.ratio));
    const minR=Math.min(...vals)-0.05, maxR=Math.max(...vals)+0.05, rngR=maxR-minR||1;
    const W=320,H=80;
    const pts=ratioData.map((d,i)=>{const x=(i/(ratioData.length-1))*W,y=H-((parseFloat(d.ratio)-minR)/rngR)*H;return`${x},${y}`;}).join(" ");
    return `
      <div class="recomp-explainer">Squat 1RM ÷ Bodyweight. Rises as you recomp even when the scale barely moves — best single metric for your goal.</div>
      <div class="chart-block">
        <div class="chart-title-row">
          <span class="chart-title">Strength / Bodyweight Ratio</span>
          ${latest?`<span class="orm-badge" style="color:#3dffa0">${latest.ratio}×</span>`:""}
        </div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <polyline points="${pts}" fill="none" stroke="#3dffa0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="svg-y-labels"><span>${maxR.toFixed(2)}</span><span>${((maxR+minR)/2).toFixed(2)}</span><span>${minR.toFixed(2)}</span></div>
        </div>
        ${ratioGain?`<div class="lift-meta-row">
          <span class="lift-meta-item"><span class="lift-meta-lbl">Program change</span><span class="lift-meta-val" style="color:${parseFloat(ratioGain)>=0?"#3dffa0":"#ff6b35"}">${parseFloat(ratioGain)>=0?"+":""}${ratioGain}×</span></span>
          <span class="lift-meta-item"><span class="lift-meta-lbl">Target</span><span class="lift-meta-val" style="color:#e8ff47">1.5× BW</span></span>
        </div>`:""}
      </div>`;
  },

  renderCoachTab(stats) {
    const stretches=stats.stretches||{};
    const keys=Object.keys(stretches);
    return `
      ${keys.length?`
        <div class="section-head-plain">Stretch targets</div>
        <div class="stretch-list">
          ${keys.map(k=>`<div class="stretch-row">
            <span class="stretch-name">${stretches[k].name}</span>
            <span class="stretch-curr">${stretches[k].current}</span>
            <span class="stretch-arrow">→</span>
            <span class="stretch-target">${stretches[k].target}</span>
            <span class="stretch-date">${this._fmtDate(stretches[k].date)}</span>
          </div>`).join("")}
        </div>`:`<div class="loading-text muted">Log sessions to see targets.</div>`}
      <div class="section-head-plain" style="margin-top:16px">Coaching check-in</div>
      <div class="claude-export-card">
        <div class="claude-export-text">Copies your full training summary for Claude — all lifts, weights, phase, stretch targets.</div>
        <button class="btn-claude" id="claude-copy-btn" onclick="UI.copyForClaude()">Copy for Claude</button>
      </div>`;
  },

  async copyForClaude() {
    const btn = document.getElementById("claude-copy-btn");
    if (btn) { btn.textContent="Building…"; btn.disabled=true; }
    try {
      const text = await App.buildClaudeExport();
      await navigator.clipboard.writeText(text);
      this.showToast("Copied — paste into Claude ✓");
      if (btn) btn.textContent = "Copied ✓";
      setTimeout(() => { if(btn){btn.textContent="Copy for Claude";btn.disabled=false;} }, 3000);
    } catch(e) {
      this.showClaudeFallback(await App.buildClaudeExport());
      if (btn) { btn.textContent="Copy for Claude"; btn.disabled=false; }
    }
  },

  showClaudeFallback(text) {
    const overlay = this.el("div","export-overlay");
    overlay.innerHTML=`<div class="export-modal"><div class="export-modal-head"><span>Copy into Claude</span><button onclick="this.closest('.export-overlay').remove()">✕</button></div><textarea class="export-textarea" readonly>${text}</textarea><button class="btn-primary" onclick="this.previousElementSibling.select();document.execCommand('copy');UI.showToast('Copied ✓')">Select All & Copy</button></div>`;
    document.body.appendChild(overlay);
  },

  // ── HISTORY ───────────────────────────────────────────────────────────────
  async renderHistory() {
    const wrap = this.el("div","page");
    wrap.innerHTML=`
      <header class="page-header-compact">
        <div class="compact-date-row"><span class="compact-date">All sessions</span></div>
        <h1 class="page-title-compact">History</h1>
      </header>
      <div id="history-content"><div class="loading-text">Loading…</div></div>`;
    this.root.appendChild(wrap);
    const c = document.getElementById("history-content");
    if (App.state.history) { this._renderHistoryInto(c, App.state.history); }
    else { const {sessions}=await App.fetchHistory(); App.state.history=sessions; this._renderHistoryInto(c,sessions); }
  },

  _renderHistoryInto(content, sessions) {
    if (!sessions?.length) { content.innerHTML=`<div class="loading-text muted">No sessions logged yet.</div>`; return; }
    content.innerHTML = sessions.map(s=>`
      <div class="history-card">
        <div class="history-header">
          <span class="history-date">${this._fmtDate(s.date)}</span>
          <span class="history-day">${s.dayTitle}</span>
        </div>
        <div class="history-exercises">
          ${s.exercises.map(ex=>{
            const best = ex.sets?.reduce((b,st)=>parseFloat(st.weight)>parseFloat(b.weight)?st:b, ex.sets[0]);
            const vol  = ex.sets?.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||0)+sum,0);
            return `<div class="history-ex">
              <span class="history-ex-name">${ex.name}</span>
              <span class="history-ex-sets">${best?`${best.weight}×${best.reps} best`:""} ${vol?`· ${vol.toLocaleString()} vol`:""}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`).join("");
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────
  _fmtDate(iso) {
    if (!iso) return "";
    const s = String(iso).slice(0,10);
    const today = new Date().toISOString().slice(0,10);
    const yest  = new Date(Date.now()-86400000).toISOString().slice(0,10);
    if (s===today) return "Today";
    if (s===yest)  return "Yesterday";
    const d = new Date(s+"T12:00:00");
    const daysAgo = Math.round((Date.now()-d)/86400000);
    if (daysAgo<7) return `${daysAgo} days ago`;
    return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  },
  _formatDisplayDate(iso) { return this._fmtDate(iso)||"Today"; },

  el(tag, cls) { const e=document.createElement(tag); if(cls) e.className=cls; return e; },

  showToast(msg) {
    let t=document.getElementById("toast");
    if (!t) { t=document.createElement("div"); t.id="toast"; document.body.appendChild(t); }
    t.textContent=msg; t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer=setTimeout(()=>t.classList.remove("show"),2500);
  }
};
