// ─── UI ────────────────────────────────────────────────────────────────────────
// All rendering logic. Function names / signatures unchanged from original.
// Data layer lives in app.js — we never call anything not already defined there.

const UI = {

  // ── INIT ──────────────────────────────────────────────────────────────────
  init() {
    this.root = document.getElementById("app");
    this._restTimer    = null;
    this._restTarget   = null;
    this._activeRestBtn = null;
    this._logDate      = null;
    this._bwRange      = 30;   // default chart range: 30 | 90 | 0 (all)

    // Pre-warm all caches in parallel on load — everything is ready by the
    // time the user taps any tab
    this._prefetch();
    this.render();
  },

  // Fetch everything in parallel and store in App.state
  async _prefetch() {
    try {
      const [stats, bwResult, histResult] = await Promise.all([
        App.state.stats   ? Promise.resolve(App.state.stats)   : App.fetchStats(),
        App.state.bwLog   ? Promise.resolve({ entries: App.state.bwLog }) : App.fetchBodyweightLog?.() || this._fetchBWFallback(),
        App.state.history ? Promise.resolve({ sessions: App.state.history }) : App.fetchHistory()
      ]);
      App.state.stats   = stats;
      App.state.bwLog   = bwResult.entries || bwResult;
      App.state.history = histResult.sessions || histResult;
      // If home or stats is already showing, refresh the live area quietly
      this._refreshOpenView();
    } catch(e) {
      // Silently fail — views handle their own empty states
    }
  },

  // Fetch BW via App.getBodyweightLog (sync local) or App.fetchBodyweightLog (async remote)
  async _fetchBWFallback() {
    // App.getBodyweightLog() returns entries synchronously from localStorage or cache
    const entries = await App.getBodyweightLog();
    return { entries };
  },

  // After prefetch completes, update any already-rendered dynamic areas
  _refreshOpenView() {
    const { view } = App.state;
    if (view === "home") {
      const area = document.getElementById("home-stats-area");
      if (area && App.state.stats) this._renderHomeStatsInto(area, App.state.stats);
    }
    if (view === "stats") {
      const content = document.getElementById("stats-tab-content");
      if (content) this.renderStatsTab(App.state.stats);
    }
    if (view === "history") {
      const content = document.getElementById("history-content");
      if (content && App.state.history) this._renderHistoryInto(content, App.state.history);
    }
  },

  // Invalidate caches after a save so next view is fresh
  _invalidateCache() {
    App.state.stats   = null;
    App.state.bwLog   = null;
    App.state.history = null;
  },

  render() {
    const { view } = App.state;
    this.root.innerHTML = "";
    if (view === "home")    this.renderHome();
    if (view === "log")     this.renderLog();
    if (view === "history") this.renderHistory();
    if (view === "stats")   this.renderStats();
    this.renderNav();
  },

  nav(view) {
    App.state.view = view;
    this.render();
    window.scrollTo(0, 0);
  },

  // ── NAV BAR ───────────────────────────────────────────────────────────────
  renderNav() {
    const nav = document.createElement("nav");
    nav.className = "bottom-nav";

    // SVG icon set — clean, no emojis
    const icons = {
      home: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M8 20v-8h6v8"/>
      </svg>`,
      log: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="9"/>
        <path d="M11 7v4l3 3"/>
      </svg>`,
      stats: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3,17 8,11 12,14 19,6"/>
        <polyline points="15,6 19,6 19,10"/>
      </svg>`,
      history: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7h16M3 12h10M3 17h7"/>
      </svg>`
    };

    const tabs = [
      { id: "home",    icon: icons.home,    label: "Today" },
      { id: "log",     icon: icons.log,     label: "Log" },
      { id: "stats",   icon: icons.stats,   label: "Stats" },
      { id: "history", icon: icons.history, label: "History" }
    ];

    tabs.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "nav-btn" + (App.state.view === t.id ? " active" : "");
      btn.innerHTML = `<span class="nav-icon">${t.icon}</span><span class="nav-label">${t.label}</span>`;
      btn.onclick = () => this.nav(t.id);
      nav.appendChild(btn);
    });

    this.root.appendChild(nav);
  },

  // ── HOME ──────────────────────────────────────────────────────────────────
  renderHome() {
    const wrap = this.el("div", "page");
    const suggestedId = App.getSuggestedDay();
    const suggested = PROGRAM[suggestedId];
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek];
    const phase = weekData.phase;

    // Human-readable reason why this workout is suggested
    const dayNames = { dayA: "Upper Push+Pull (Mon)", dayB: "Lower+Core (Wed)", dayC: "Olympic (Fri)", sport: "Sport / Active Recovery" };
    const dow = new Date().getDay(); // 0=Sun
    const scheduleNote = dow === 0 || dow === 2 || dow === 4 || dow === 6
      ? "Today's a rest/sport day — active recovery keeps the streak."
      : `Your schedule puts ${dayNames[suggestedId] || suggested.title} today.`;

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-label">${dateStr}</div>
        <h1 class="page-title">TODAY</h1>
      </header>

      <div class="week-banner">
        <div class="week-banner-left">
          <div class="week-banner-num">WEEK ${currentWeek} <span class="week-of">/ 13</span></div>
          <div class="week-banner-phase phase-text-${weekData.phaseId}">${phase.label}</div>
          <div class="week-banner-tip">${phase.tip}</div>
        </div>
        <div class="week-banner-controls">
          <button class="week-ctrl" onclick="UI.changeWeek(-1)" ${currentWeek <= 1 ? "disabled" : ""}>‹</button>
          <button class="week-ctrl" onclick="UI.changeWeek(1)"  ${currentWeek >= 13 ? "disabled" : ""}>›</button>
        </div>
      </div>

      <div class="suggested-card phase-bg-${weekData.phaseId}">
        <div class="suggested-label">SUGGESTED TODAY</div>
        <div class="suggested-title">${suggested.title}</div>
        <div class="suggested-why">${scheduleNote}</div>
        <button class="btn-primary" onclick="UI.startDay('${suggestedId}')">
          Start ${suggested.label || suggested.id}
        </button>
      </div>

      <div class="section-head">THIS WEEK — PICK A DAY</div>
      <div class="day-picker">
        ${["dayA","dayB","dayC","sport"].map(id => {
          const d = PROGRAM[id];
          return `
            <button class="day-pick-btn" onclick="UI.startDay('${id}')">
              <span class="dpb-label">${d.label || id}</span>
              <span class="dpb-title">${d.title}</span>
            </button>`;
        }).join("")}
      </div>

      <div id="home-stats-area">
        <div class="loading-text">Loading stats…</div>
      </div>
    `;

    this.root.appendChild(wrap);
    this.loadHomeStats();
  },

  changeWeek(delta) {
    const current = getCurrentWeek();
    const next = Math.max(1, Math.min(13, current + delta));
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
      area.innerHTML = `<div class="loading-text muted">No data yet — log your first session.</div>`;
    }
  },

  _renderHomeStatsInto(area, stats) {
    area.innerHTML = `
      <div class="section-head">TRAILING ACTIVITY</div>
      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-num">${stats.last7 || 0}</div>
          <div class="stat-lbl">last 7 days</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${stats.last30 || 0}</div>
          <div class="stat-lbl">last 30 days</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${((stats.last30 || 0) / 4.3).toFixed(1)}</div>
          <div class="stat-lbl">avg / week</div>
        </div>
      </div>
      ${this.renderTopStretches(stats.stretches)}
    `;
  },

  renderTopStretches(stretches) {
    if (!stretches || !Object.keys(stretches).length) return "";
    const keys = ["bench", "squat", "clean", "rdl"];
    const shown = keys.filter(k => stretches[k]);
    if (!shown.length) return "";
    return `
      <div class="section-head">STRETCH TARGETS</div>
      <div class="stretch-list">
        ${shown.map(k => `
          <div class="stretch-row">
            <span class="stretch-name">${stretches[k].name}</span>
            <span class="stretch-curr">${stretches[k].current}</span>
            <span class="stretch-arrow">→</span>
            <span class="stretch-target">${stretches[k].target}</span>
          </div>
        `).join("")}
      </div>
    `;
  },

  // ── START A DAY ───────────────────────────────────────────────────────────
  async startDay(dayId) {
    App.state.loading = true;
    App.state.activeDay = dayId;
    this._logDate = null; // reset to today when starting fresh
    const session = App.newSession(dayId);

    const last = await App.fetchLastSession(dayId);
    App.state.lastSession = last;
    App.state.session = App.applyLastSession(session, last);
    App.state.loading = false;
    App.state.view = "log";
    this.render();
  },

  // ── LOG VIEW ──────────────────────────────────────────────────────────────
  renderLog() {
    const wrap = this.el("div", "page");
    const { session, activeDay, loading } = App.state;

    // Guard: if no active session, show day picker instead of infinite loader
    if (!activeDay || (!loading && !session)) {
      wrap.innerHTML = `
        <header class="page-header">
          <h1 class="page-title">LOG</h1>
          <div class="header-date">Pick a day to start</div>
        </header>
        <div class="section-head">PICK A DAY</div>
        <div class="day-picker">
          ${["dayA","dayB","dayC","sport"].map(id => {
            const d = PROGRAM[id];
            return `
              <button class="day-pick-btn" onclick="UI.startDay('${id}')">
                <span class="dpb-label">${d.label || id}</span>
                <span class="dpb-title">${d.title}</span>
              </button>`;
          }).join("")}
        </div>
      `;
      this.root.appendChild(wrap);
      return;
    }

    if (loading) {
      wrap.innerHTML = `<div class="loading-text" style="padding-top:80px">Loading last session…</div>`;
      this.root.appendChild(wrap);
      return;
    }

    const day = PROGRAM[activeDay];
    const lastDate = App.state.lastSession?.date
      ? `Last: ${App.state.lastSession.date}` : "First session";

    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek];
    const phaseId = day.phaseId || weekData.phaseId;
    const phase = day.phase || weekData.phase;

    // Effective log date for display
    const today = new Date().toISOString().split("T")[0];
    const displayDate = this._logDate || today;

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-back" onclick="UI.nav('home')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Back
        </div>
        <div class="phase-badge phase-badge-${phaseId}">Week ${currentWeek} · ${phase.label}</div>
        <h1 class="log-title">${day.title}</h1>
        <div class="log-header-meta">
          <span class="log-last-session">${lastDate}</span>
          <span class="log-date-pill" title="Tap to log for a different date">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="12" height="11" rx="1.5"/>
              <path d="M5 1v4M11 1v4M2 7h12"/>
            </svg>
            ${this._formatDisplayDate(displayDate)}
            <input type="date" value="${displayDate}" max="${today}" onchange="UI._setLogDate(this.value)">
          </span>
        </div>
      </header>
    `;

    if (day.sportOnly) {
      wrap.appendChild(this.renderSportLog(session, day));
    } else {
      // Render from session.exercises (not day.exercises) so added exercises appear.
      // session.exercises carries all the data we need (name, sets, rest, tip, bodyweight).
      session.exercises.forEach((ex, ei) => {
        wrap.appendChild(this.renderExerciseBlock(ex, ei, session));
      });

      // "Add exercise" button
      const addBtn = this.el("button", "btn-add-exercise");
      addBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M8 3v10M3 8h10"/>
        </svg>
        Add Exercise
      `;
      addBtn.onclick = () => this.showExercisePicker(day, session);
      wrap.appendChild(addBtn);

      if (day.finisher) {
        const fin = this.el("div", "finisher-block");
        fin.innerHTML = `<span class="fin-icon">🏔</span> <span>${day.finisher}</span>`;
        wrap.appendChild(fin);
      }
    }

    const saveBtn = this.el("button", "btn-save");
    saveBtn.textContent = "Save Session";
    saveBtn.onclick = () => this.saveSession();
    wrap.appendChild(saveBtn);

    this.root.appendChild(wrap);
  },

  _setLogDate(val) {
    this._logDate = val || null;
    // Update the display text without full re-render
    const pill = document.querySelector(".log-date-pill");
    if (pill) {
      // Replace text node (first child)
      const svgClone = pill.querySelector("svg").cloneNode(true);
      const input = pill.querySelector("input").cloneNode(true);
      input.value = val;
      input.onchange = (e) => this._setLogDate(e.target.value);
      pill.innerHTML = "";
      pill.appendChild(svgClone);
      pill.appendChild(document.createTextNode(" " + this._formatDisplayDate(val) + " "));
      pill.appendChild(input);
    }
  },

  _formatDisplayDate(iso) {
    if (!iso) return "Today";
    const today = new Date().toISOString().split("T")[0];
    if (iso === today) return "Today";
    const d = new Date(iso + "T12:00:00"); // noon to avoid tz edge cases
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },

  // ── EXERCISE BLOCK ────────────────────────────────────────────────────────
  renderExerciseBlock(ex, ei, session) {
    const block = this.el("div", "ex-block");
    const sessionEx = session.exercises[ei];
    const tipsHTML = ex.tip ? `<div class="ex-tip">${ex.tip}</div>` : "";

    // Parse rest string to seconds for timer
    const restSec = this._parseRestToSeconds(ex.rest);
    const restLabel = ex.rest || "—";

    block.innerHTML = `
      <div class="ex-header">
        <span class="ex-name">${ex.name}</span>
        <button class="ex-rest-pill" id="rest-pill-${ei}"
          onclick="UI._startRestTimer(${ei}, ${restSec})"
          title="Tap after a set to start rest timer">
          <span class="ex-rest-dot"></span>
          <span class="rest-label-text">${restLabel}</span>
        </button>
      </div>
      ${tipsHTML}
      <div class="sets-grid">
        <div class="set-row header-row">
          <span>Set</span><span>Reps</span><span>Weight</span><span>Done</span><span>Skip</span>
        </div>
        ${sessionEx.sets.map((set, si) => this._renderSetRow(ex, ei, si, set)).join("")}
      </div>
    `;
    return block;
  },

  _renderSetRow(ex, ei, si, set) {
    const isExcluded = set.excluded || false;
    const isDone     = set.logged  || false;

    // Bodyweight exercises: show the prescription as plain text, no weight column
    if (ex.bodyweight) {
      return `
        <div class="set-row${isExcluded ? " excluded" : ""}" id="set-${ei}-${si}">
          <span class="set-num">${si + 1}</span>
          <span class="set-bw-label" colspan="2">${set.reps}</span>
          <span class="set-bw-spacer"></span>
          <button class="set-done ${isDone ? "checked" : ""}"
            onclick="UI.toggleSet(${ei}, ${si})">
            ${isDone ? "✓" : ""}
          </button>
          <button class="set-exclude" onclick="UI.toggleExclude(${ei}, ${si})" title="Skip this set">
            ${isExcluded ? "↩" : "✕"}
          </button>
        </div>
      `;
    }

    // Regular exercise: tapping the set number copies values down to remaining sets
    const canCopyDown = si < (App.state.session?.exercises?.[ei]?.sets?.length - 1);
    return `
      <div class="set-row${isExcluded ? " excluded" : ""}" id="set-${ei}-${si}">
        <span class="set-num ${canCopyDown ? "copyable" : ""}"
          onclick="${canCopyDown ? `UI._copySetDown(${ei}, ${si})` : ""}"
          title="${canCopyDown ? "Tap to copy reps & weight to sets below" : ""}">
          ${si + 1}${set.note ? `<em>${set.note}</em>` : ""}
          ${canCopyDown ? `<em class="copy-hint">↓</em>` : ""}
        </span>
        <input class="set-input" type="number" inputmode="decimal"
          value="${set.reps}" placeholder="reps"
          onchange="UI.updateSet(${ei}, ${si}, 'reps', this.value)">
        <input class="set-input weight-input" type="number" inputmode="decimal"
          value="${set.weight}" placeholder="lbs"
          onchange="UI.updateSet(${ei}, ${si}, 'weight', this.value)">
        <button class="set-done ${isDone ? "checked" : ""}"
          onclick="UI.toggleSet(${ei}, ${si})">
          ${isDone ? "✓" : ""}
        </button>
        <button class="set-exclude" onclick="UI.toggleExclude(${ei}, ${si})" title="Skip this set">
          ${isExcluded ? "↩" : "✕"}
        </button>
      </div>
    `;
  },

  // Copy reps+weight from set si down to all subsequent sets in exercise ei
  _copySetDown(ei, si) {
    const sets = App.state.session?.exercises?.[ei]?.sets;
    if (!sets) return;
    const src = sets[si];
    for (let i = si + 1; i < sets.length; i++) {
      if (sets[i].excluded) continue;
      sets[i].reps   = src.reps;
      sets[i].weight = src.weight;
      // Update DOM inputs directly — avoids full re-render
      const row = document.getElementById(`set-${ei}-${i}`);
      if (row) {
        const inputs = row.querySelectorAll(".set-input");
        if (inputs[0]) inputs[0].value = src.reps;
        if (inputs[1]) inputs[1].value = src.weight;
      }
    }
    this.showToast("Copied down ↓");
  },

  renderSportLog(session, day) {
    const block = this.el("div", "ex-block");
    block.innerHTML = `
      <div class="sport-log">
        <div class="sport-log-label">Log your session</div>
        <div class="sport-fields">
          <label>Activity
            <select id="sport-type" class="sport-select">
              <option>Basketball</option>
              <option>Pickleball</option>
              <option>Hike</option>
              <option>Other</option>
            </select>
          </label>
          <label>Duration (min)
            <input type="number" inputmode="decimal" id="sport-duration"
              class="set-input" placeholder="60" value="60">
          </label>
          <label>Notes
            <input type="text" id="sport-notes" class="set-input notes-input"
              placeholder="e.g. pickup, 5 games">
          </label>
        </div>
      </div>
    `;
    return block;
  },

  // ── SET ACTIONS ───────────────────────────────────────────────────────────
  updateSet(ei, si, field, value) {
    if (App.state.session?.exercises?.[ei]?.sets?.[si]) {
      App.state.session.exercises[ei].sets[si][field] = value;
    }
  },

  // toggleSet now called "set-done" — marks as done/undone
  toggleSet(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set || set.excluded) return;
    set.logged = !set.logged;
    const row = document.getElementById(`set-${ei}-${si}`);
    if (row) {
      const btn = row.querySelector(".set-done");
      if (btn) {
        btn.classList.toggle("checked", set.logged);
        btn.textContent = set.logged ? "✓" : "";
      }
    }
  },

  // Toggle "excluded" — dims the row and marks it as not-to-save
  toggleExclude(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set) return;
    set.excluded = !set.excluded;
    if (set.excluded) set.logged = false; // can't be done if excluded
    const row = document.getElementById(`set-${ei}-${si}`);
    if (row) {
      row.classList.toggle("excluded", set.excluded);
      const doneBtn = row.querySelector(".set-done");
      const skipBtn = row.querySelector(".set-exclude");
      if (doneBtn) { doneBtn.classList.remove("checked"); doneBtn.textContent = ""; }
      if (skipBtn) skipBtn.textContent = set.excluded ? "↩" : "✕";
    }
  },

  // ── REST TIMER ────────────────────────────────────────────────────────────
  _parseRestToSeconds(restStr) {
    if (!restStr) return 90;
    const m = restStr.match(/(\d+)\s*min/i);
    if (m) return parseInt(m[1]) * 60;
    const s = restStr.match(/(\d+)\s*sec/i);
    if (s) return parseInt(s[1]);
    // "90 sec" or "3 min" handled above; fallback
    const n = parseInt(restStr);
    if (!isNaN(n)) return n;
    return 90;
  },

  _startRestTimer(ei, seconds) {
    // Clear any existing timer
    if (this._restTimer) {
      clearInterval(this._restTimer);
      this._restTimer = null;
    }
    if (this._activeRestBtn) {
      this._activeRestBtn.classList.remove("running");
    }

    const btn = document.getElementById(`rest-pill-${ei}`);
    if (!btn) return;

    this._activeRestBtn = btn;
    btn.classList.add("running");
    this._restTarget = Date.now() + seconds * 1000;

    const update = () => {
      const rem = Math.max(0, Math.ceil((this._restTarget - Date.now()) / 1000));
      const labelEl = btn.querySelector(".rest-label-text");
      if (labelEl) {
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        labelEl.textContent = rem > 0 ? `${m}:${String(s).padStart(2,"0")}` : "Done!";
      }
      if (rem <= 0) {
        clearInterval(this._restTimer);
        this._restTimer = null;
        btn.classList.remove("running");
        this._showRestDone();
        setTimeout(() => {
          if (labelEl) labelEl.textContent = this._parseRestLabel(btn, seconds);
        }, 2000);
      }
    };

    update();
    this._restTimer = setInterval(update, 500);
  },

  _parseRestLabel(btn, seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (s === 0) return `${m} min`;
    return `${m}:${String(s).padStart(2,"0")}`;
  },

  _showRestDone() {
    let t = document.getElementById("rest-timer-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "rest-timer-toast";
      document.body.appendChild(t);
    }
    t.textContent = "Rest done — next set!";
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  },

  // ── ADD EXERCISE SHEET ────────────────────────────────────────────────────
  showExercisePicker(day, session) {
    // Flatten all exercises from ACC_POOLS into a deduplicated, grouped list
    const groups = {
      "Upper — Push":   ["push_acc"],
      "Upper — Pull":   ["pull_acc"],
      "Upper — Biceps": ["curl_acc"],
      "Upper — Delts":  ["latraise_acc"],
      "Upper — Core":   ["core_upper"],
      "Lower — Quad":   ["leg_acc"],
      "Lower — Hamstring": ["hamstring_acc"],
      "Lower — Calves": ["calf_acc"],
      "Lower — Core":   ["core_lower"],
      "Lower — Lateral": ["sideplank_acc"],
      "Olympic":        ["snatch_acc", "jerk_acc"],
      "Lower — Squat":  ["squat_fri_acc"],
      "Lower — Deadlift": ["rdl_fri_acc"]
    };

    const currentWeek = getCurrentWeek();
    const cycle = getCycle(currentWeek);

    // Build flat deduplicated list keyed by name
    const exerciseMap = {};
    Object.entries(groups).forEach(([groupName, poolKeys]) => {
      poolKeys.forEach(poolKey => {
        const pool = ACC_POOLS[poolKey];
        if (!pool) return;
        pool.forEach(ex => {
          if (!exerciseMap[ex.name]) {
            exerciseMap[ex.name] = { ...ex, group: groupName };
          }
        });
      });
    });

    // Also add main lifts
    const mainLiftsGroup = "Main Lifts";
    Object.values(MAIN_LIFTS).forEach(ex => {
      if (!exerciseMap[ex.name]) {
        exerciseMap[ex.name] = { ...ex, group: mainLiftsGroup };
      }
    });

    const allExercises = Object.values(exerciseMap).sort((a,b) => a.name.localeCompare(b.name));

    const overlay = this.el("div", "sheet-overlay");
    overlay.id = "exercise-picker-overlay";

    const render = (filter) => {
      const filtered = filter
        ? allExercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
        : allExercises;

      // Group for display
      const byGroup = {};
      filtered.forEach(ex => {
        if (!byGroup[ex.group]) byGroup[ex.group] = [];
        byGroup[ex.group].push(ex);
      });

      const listHTML = Object.entries(byGroup).map(([g, exs]) => `
        <div class="sheet-group-label">${g}</div>
        ${exs.map(ex => `
          <div class="sheet-item" onclick="UI._addExerciseFromPicker('${ex.id}', '${ex.name.replace(/'/g,"\\'")}', ${ex.baseline || 0})">
            <div>
              <div class="sheet-item-name">${ex.name}</div>
              ${ex.baseline ? `<div class="sheet-item-meta">Baseline ${ex.baseline} lbs</div>` : ""}
            </div>
            <span class="sheet-item-add">+</span>
          </div>
        `).join("")}
      `).join("");

      const list = overlay.querySelector(".sheet-list");
      if (list) list.innerHTML = listHTML || `<div class="loading-text muted">No matches.</div>`;
    };

    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Add Exercise</span>
          <button class="sheet-close" onclick="document.getElementById('exercise-picker-overlay').remove()">✕</button>
        </div>
        <div class="sheet-search">
          <input type="search" placeholder="Search exercises…" id="ex-search-input"
            oninput="UI._filterExercises(this.value)" autocomplete="off" autocorrect="off">
        </div>
        <div class="sheet-list"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    render("");
    setTimeout(() => document.getElementById("ex-search-input")?.focus(), 200);

    // Close on overlay tap (outside sheet)
    overlay.addEventListener("click", e => {
      if (e.target === overlay) overlay.remove();
    });
  },

  _filterExercises(query) {
    const overlay = document.getElementById("exercise-picker-overlay");
    if (!overlay) return;
    // Re-invoke showExercisePicker render by finding list and re-populating
    // We do this by keeping allExercises accessible — simpler to just call a stored fn
    // Since we can't store closures cleanly here, find all sheet-items and filter
    const allItems = overlay.querySelectorAll(".sheet-item, .sheet-group-label");
    allItems.forEach(el => {
      if (el.classList.contains("sheet-group-label")) {
        el.style.display = "";
        return;
      }
      const name = el.querySelector(".sheet-item-name")?.textContent || "";
      el.style.display = name.toLowerCase().includes(query.toLowerCase()) ? "" : "none";
    });
    // Hide group labels that have no visible children
    overlay.querySelectorAll(".sheet-group-label").forEach(label => {
      let next = label.nextElementSibling;
      let hasVisible = false;
      while (next && !next.classList.contains("sheet-group-label")) {
        if (next.style.display !== "none") hasVisible = true;
        next = next.nextElementSibling;
      }
      label.style.display = hasVisible ? "" : "none";
    });
  },

  _addExerciseFromPicker(id, name, baseline) {
    const { session, activeDay } = App.state;
    const day = PROGRAM[activeDay];
    if (!session || !day) return;

    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek];
    const phaseId = day.phaseId || weekData.phaseId;
    const phase = PHASES[phaseId];

    // Build a default set of sets for the added exercise
    const workingWeight = Math.round((baseline || 45) * (
      phaseId === "strength"    ? 1.0  :
      phaseId === "hypertrophy" ? 0.85 :
      phaseId === "conditioning"? 0.70 : 0.60
    ) / 5) * 5;
    const reps = phase.acc?.reps || 8;
    const sets = Array.from({ length: phase.acc?.sets || 3 }, () => ({ reps, weight: workingWeight }));

    const newEx = { id, name, sets, rest: phase.acc?.rest || "60 sec", tip: "", bodyweight: baseline === 0 };
    session.exercises.push(newEx);

    // Close sheet
    const overlay = document.getElementById("exercise-picker-overlay");
    if (overlay) overlay.remove();

    // Re-render the log page (session state is preserved)
    App.state.view = "log";
    this.render();
    // Scroll to bottom to reveal new block
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
  },

  // ── SAVE SESSION ──────────────────────────────────────────────────────────
  async saveSession() {
    const { session, activeDay } = App.state;
    const day = PROGRAM[activeDay];
    if (!session) return;

    // Strip excluded sets before saving
    const sessionToSave = {
      ...session,
      exercises: session.exercises.map(ex => ({
        ...ex,
        sets: (ex.sets || []).filter(s => !s.excluded)
      })).filter(ex => ex.sets.length > 0)
    };

    // Attach log date if user picked a past date
    if (this._logDate) {
      sessionToSave.date = this._logDate;
    }

    // Handle sport session
    if (day.sportOnly) {
      const type  = document.getElementById("sport-type")?.value || "Sport";
      const dur   = document.getElementById("sport-duration")?.value || 0;
      const notes = document.getElementById("sport-notes")?.value || "";
      sessionToSave.exercises = [{
        id: "sport", name: type,
        sets: [{ reps: `${dur} min`, weight: 0, note: notes }]
      }];
    }

    const btn = document.querySelector(".btn-save");
    if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }

    try {
      const result = await App.saveSession(sessionToSave);
      this._invalidateCache();  // force fresh fetch next time
      this.showToast(result.local ? "Saved locally ✓" : "Saved to Sheets ✓");
      setTimeout(() => { App.state.view = "home"; this.render(); }, 1200);
    } catch(e) {
      this.showToast("Save failed — try again");
      if (btn) { btn.textContent = "Save Session"; btn.disabled = false; }
    }
  },

  // ── STATS VIEW ────────────────────────────────────────────────────────────
  async renderStats() {
    const wrap = this.el("div", "page");

    if (!App.state.statsTab) App.state.statsTab = "body";

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-label">Progress</div>
        <h1 class="page-title">STATS</h1>
      </header>
      <div class="stats-tabs">
        <button class="stats-tab ${App.state.statsTab==="body"?"active":""}"   onclick="UI.setStatsTab('body')">Body</button>
        <button class="stats-tab ${App.state.statsTab==="lifts"?"active":""}"  onclick="UI.setStatsTab('lifts')">Lifts</button>
        <button class="stats-tab ${App.state.statsTab==="recomp"?"active":""}" onclick="UI.setStatsTab('recomp')">Recomp</button>
        <button class="stats-tab ${App.state.statsTab==="coach"?"active":""}"  onclick="UI.setStatsTab('coach')">Coach</button>
      </div>
      <div id="stats-tab-content"><div class="loading-text">Loading…</div></div>
    `;
    this.root.appendChild(wrap);

    // Use cache — prefetch may have already populated this
    if (App.state.stats) {
      this.renderStatsTab(App.state.stats);
    } else {
      const stats = await App.fetchStats();
      App.state.stats = stats;
      this.renderStatsTab(stats);
    }
  },

  setStatsTab(tab) {
    App.state.statsTab = tab;
    document.querySelectorAll(".stats-tab").forEach(b => {
      b.classList.toggle("active", b.textContent.toLowerCase().trim() === tab);
    });
    const content = document.getElementById("stats-tab-content");
    if (!content || !App.state.stats) return;
    this.renderStatsTab(App.state.stats);
  },

  renderStatsTab(stats) {
    const content = document.getElementById("stats-tab-content");
    if (!content) return;
    const tab = App.state.statsTab || "body";
    if (tab === "body")   { this.renderBodyTab().then(html => { if (content) content.innerHTML = html; }); return; }
    if (tab === "lifts")  content.innerHTML = this.renderLiftsTab(stats);
    if (tab === "recomp") content.innerHTML = this.renderRecompTab(stats);
    if (tab === "coach")  content.innerHTML = this.renderCoachTab(stats);
  },

  // ── BODY TAB ──────────────────────────────────────────────────────────────
  async renderBodyTab() {
    // Use cache if warm — App.getBodyweightLog() is sync from localStorage,
    // but the remote copy lives in App.state.bwLog after prefetch
    let entries = App.state.bwLog;
    if (!entries) {
      entries = await App.getBodyweightLog();
      App.state.bwLog = entries;
    }

    const latest   = entries.length ? entries[entries.length - 1] : null;
    const goal_lo  = CONFIG.GOAL_LB_LOW;
    const goal_hi  = CONFIG.GOAL_LB_HIGH;
    const inGoal   = latest && latest.w >= goal_lo && latest.w <= goal_hi;
    const today    = new Date().toISOString().split("T")[0];
    const todayEntry = entries.find(e => e.date === today);

    const rangeLabels = { 30: "30 days", 90: "90 days", 0: "All time" };
    const currentRange = this._bwRange;

    return `
      <div class="bw-log-entry">
        <div class="bw-log-left">
          <div class="bw-current">${latest ? latest.w + " lbs" : "— lbs"}</div>
          <div class="bw-goal ${inGoal ? "in-goal" : ""}">
            Goal: ${goal_lo}–${goal_hi} lbs ${inGoal ? "✓" : ""}
          </div>
        </div>
      </div>

      <div class="bw-quick-entry">
        <div class="bw-quick-row">
          <input type="number" inputmode="decimal" id="bw-quick-input"
            class="bw-quick-num" placeholder="${todayEntry ? todayEntry.w : "170.0"}"
            step="0.1" value="${todayEntry ? todayEntry.w : ""}">
          <span class="bw-quick-unit">lbs</span>
          <input type="date" id="bw-quick-date" class="bw-quick-date-input"
            value="${today}" max="${today}">
          <button class="bw-quick-save" onclick="UI._saveQuickBW()">
            ${todayEntry ? "Update" : "Save"}
          </button>
        </div>
      </div>

      ${entries.length >= 2 ? `
        <div class="bw-range-toggle">
          ${[30, 90, 0].map(r => `
            <button class="bw-range-btn ${currentRange === r ? "active" : ""}"
              onclick="UI._setBWRange(${r})">
              ${rangeLabels[r]}
            </button>
          `).join("")}
        </div>
        <div id="bw-chart-area">
          ${this.renderBWChart(entries, currentRange)}
        </div>
      ` : `
        <div class="loading-text muted" style="margin:16px 0">
          Log a few weights to see your trend.
        </div>
      `}

      <div class="section-head" style="margin-top:16px">HISTORY</div>
      <div class="bw-history">
        ${entries.slice().reverse().slice(0, 30).map(e => `
          <div class="bw-hist-row">
            <span class="bw-hist-date">${e.date === today ? "Today" : e.date}</span>
            <span class="bw-hist-val">${e.w} lbs</span>
            <button class="bw-hist-del" onclick="App.deleteBodyweight('${e.date}').then(() => { App.state.bwLog = null; UI.setStatsTab('body'); })">✕</button>
          </div>
        `).join("") || `<div class="loading-text muted">No entries yet.</div>`}
      </div>
    `;
  },

  _setBWRange(r) {
    this._bwRange = r;
    // Swap just the chart area — no re-fetch, no full re-render
    const chartArea = document.getElementById("bw-chart-area");
    if (chartArea && App.state.bwLog) {
      chartArea.innerHTML = this.renderBWChart(App.state.bwLog, r);
    }
    document.querySelectorAll(".bw-range-btn").forEach(b => {
      b.classList.toggle("active", b.textContent.trim() === { 30:"30 days", 90:"90 days", 0:"All time" }[r]);
    });
  },

  _saveQuickBW() {
    const w = parseFloat(document.getElementById("bw-quick-input")?.value);
    const d = document.getElementById("bw-quick-date")?.value;
    if (!w || w < 50 || w > 500) { this.showToast("Enter a valid weight"); return; }
    App.logBodyweight(d, w);
    App.state.bwLog = null;  // invalidate BW cache only
    this.showToast("Weight saved ✓");
    setTimeout(() => this.setStatsTab("body"), 600);
  },

  renderBWChart(entries, range) {
    // range: 30 = last 30 entries, 90 = last 90, 0 = all
    const data = range > 0 ? entries.slice(-range) : entries;
    if (data.length < 2) return "";
    const weights = data.map(e => e.w);
    const min = Math.min(...weights) - 2;
    const max = Math.max(...weights) + 2;
    const range_ = max - min || 1;
    const goal_lo = CONFIG.GOAL_LB_LOW;
    const goal_hi = CONFIG.GOAL_LB_HIGH;
    const gLoPct  = ((goal_lo - min) / range_) * 100;
    const gHiPct  = ((goal_hi - min) / range_) * 100;
    const goalH   = Math.max(0, Math.min(100, gHiPct - gLoPct));
    const goalBot = Math.max(0, Math.min(100, gLoPct));

    const W = 320, H = 100;
    const pts = data.map((e, i) => {
      const x = data.length < 2 ? W/2 : (i / (data.length - 1)) * W;
      const y = H - ((e.w - min) / range_) * H;
      return `${x},${y}`;
    }).join(" ");

    const n = data.length;
    const sumX = data.reduce((s,_,i) => s+i, 0);
    const sumY = data.reduce((s,e) => s+e.w, 0);
    const sumXY = data.reduce((s,e,i) => s+i*e.w, 0);
    const sumX2 = data.reduce((s,_,i) => s+i*i, 0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX || 1);
    const intercept = (sumY - slope*sumX) / n;
    const ty0 = H - ((intercept - min) / range_) * H;
    const ty1 = H - (((slope*(n-1)+intercept) - min) / range_) * H;
    const trendDir = slope < -0.05 ? "↓ trending down" : slope > 0.05 ? "↑ trending up" : "→ holding steady";

    return `
      <div class="chart-block" style="padding:14px 14px 10px">
        <div class="chart-title-row">
          <span class="chart-title">Bodyweight — ${data.length} entries</span>
          <span class="chart-trend">${trendDir}</span>
        </div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <rect x="0" y="${H - goalBot - goalH}%" width="${W}" height="${goalH}%" fill="rgba(232,255,71,.08)"/>
            <line x1="0" y1="${ty0}" x2="${W}" y2="${ty1}" stroke="#5ba4ff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
            <polyline points="${pts}" fill="none" stroke="#e8ff47" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${data.map((e, i) => {
              const x = data.length < 2 ? W/2 : (i / (data.length - 1)) * W;
              const y = H - ((e.w - min) / range_) * H;
              return `<circle cx="${x}" cy="${y}" r="3" fill="#e8ff47"/>`;
            }).join("")}
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
      </div>
    `;
  },

  // ── LIFTS TAB ─────────────────────────────────────────────────────────────
  renderLiftsTab(stats) {
    const vh = stats.volumeHistory || {};
    const lifts = [
      { id:"bench",  name:"Bench Press",  color:"#e8ff47" },
      { id:"squat",  name:"Back Squat",   color:"#ff6b35" },
      { id:"clean",  name:"Power Clean",  color:"#3dffa0" },
      { id:"rdl",    name:"RDL",          color:"#5ba4ff" }
    ];
    function epley(w, r) { return Math.round(w * (1 + r / 30)); }

    const oneRMs = {};
    lifts.forEach(l => {
      const history = (vh[l.id] || []).slice().reverse();
      oneRMs[l.id] = history.map(d => ({ date: d.date, orm: epley(d.weight, d.reps) }));
    });
    const stretches = stats.stretches || {};

    return lifts.map(l => {
      const data = oneRMs[l.id];
      if (!data.length) return `
        <div class="chart-block">
          <div class="chart-title">${l.name} — Est. 1RM</div>
          <div class="loading-text muted">Log sessions to see progress.</div>
        </div>`;

      const orms = data.map(d => d.orm);
      const min = Math.min(...orms) - 10;
      const max = Math.max(...orms) + 10;
      const range = max - min || 1;
      const latest = orms[orms.length - 1];
      const first  = orms[0];
      const gain   = latest - first;
      const gainStr = gain > 0 ? `+${gain} lbs` : gain < 0 ? `${gain} lbs` : "—";
      const W = 320, H = 80;
      const pts = data.map((d, i) => {
        const x = data.length < 2 ? W/2 : (i / (data.length - 1)) * W;
        const y = H - ((d.orm - min) / range) * H;
        return `${x},${y}`;
      }).join(" ");
      const stretch = stretches[l.id];

      return `
        <div class="chart-block">
          <div class="chart-title-row">
            <span class="chart-title">${l.name}</span>
            <span class="orm-badge" style="color:${l.color}">${latest} lbs est. 1RM</span>
          </div>
          <div class="svg-chart-wrap">
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
              <polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              ${data.map((d, i) => {
                const x = data.length < 2 ? W/2 : (i / (data.length - 1)) * W;
                const y = H - ((d.orm - min) / range) * H;
                return `<circle cx="${x}" cy="${y}" r="3" fill="${l.color}" opacity="0.8"/>`;
              }).join("")}
            </svg>
            <div class="svg-y-labels">
              <span>${max}</span>
              <span>${Math.round((max+min)/2)}</span>
              <span>${min}</span>
            </div>
          </div>
          <div class="lift-meta-row">
            <span class="lift-meta-item">
              <span class="lift-meta-lbl">Program gain</span>
              <span class="lift-meta-val" style="color:${gain>=0?"#3dffa0":"#ff6b35"}">${gainStr}</span>
            </span>
            ${stretch ? `
            <span class="lift-meta-item">
              <span class="lift-meta-lbl">Next target</span>
              <span class="lift-meta-val" style="color:#e8ff47">${stretch.target}</span>
            </span>` : ""}
            <span class="lift-meta-item">
              <span class="lift-meta-lbl">Sessions</span>
              <span class="lift-meta-val">${data.length}</span>
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  // ── RECOMP TAB ────────────────────────────────────────────────────────────
  renderRecompTab(stats) {
    const bwLog = App.getBodyweightLog();
    const vh    = stats.volumeHistory || {};
    function epley(w, r) { return Math.round(w * (1 + r / 30)); }

    const squatHistory = (vh["squat"] || []).slice().reverse();
    const ratioData = squatHistory.map(s => {
      const orm = epley(s.weight, s.reps);
      const bw = bwLog.reduce((best, e) => {
        const d1 = Math.abs(new Date(e.date) - new Date(s.date));
        const d2 = Math.abs(new Date(best.date||"2099") - new Date(s.date));
        return d1 < d2 ? e : best;
      }, bwLog[0]);
      if (!bw) return null;
      return { date: s.date, ratio: (orm / bw.w).toFixed(2), orm, bw: bw.w };
    }).filter(Boolean);

    const latest = ratioData[ratioData.length - 1];
    const first  = ratioData[0];
    const ratioGain = latest && first ? (latest.ratio - first.ratio).toFixed(2) : null;
    const weeklyVol = this.calcWeeklyVolume(stats);

    return `
      <div class="section-head">STRENGTH / BODYWEIGHT RATIO</div>
      <div class="recomp-explainer">
        Squat 1RM ÷ Bodyweight. Rises as you recomp even when the scale barely moves — best single metric for your goal.
      </div>

      ${ratioData.length >= 2 ? (() => {
        const vals = ratioData.map(d => parseFloat(d.ratio));
        const min  = Math.min(...vals) - 0.05;
        const max  = Math.max(...vals) + 0.05;
        const range = max - min || 1;
        const W = 320, H = 80;
        const pts = ratioData.map((d, i) => {
          const x = ratioData.length < 2 ? W/2 : (i/(ratioData.length-1))*W;
          const y = H - ((parseFloat(d.ratio)-min)/range)*H;
          return `${x},${y}`;
        }).join(" ");
        return `
          <div class="chart-block">
            <div class="chart-title-row">
              <span class="chart-title">Squat 1RM / Bodyweight</span>
              ${latest ? `<span class="orm-badge" style="color:#3dffa0">${latest.ratio}×</span>` : ""}
            </div>
            <div class="svg-chart-wrap">
              <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
                <polyline points="${pts}" fill="none" stroke="#3dffa0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                ${ratioData.map((d,i) => {
                  const x = ratioData.length<2?W/2:(i/(ratioData.length-1))*W;
                  const y = H-((parseFloat(d.ratio)-min)/range)*H;
                  return `<circle cx="${x}" cy="${y}" r="3" fill="#3dffa0"/>`;
                }).join("")}
              </svg>
              <div class="svg-y-labels">
                <span>${max.toFixed(2)}</span>
                <span>${((max+min)/2).toFixed(2)}</span>
                <span>${min.toFixed(2)}</span>
              </div>
            </div>
            ${ratioGain ? `
              <div class="lift-meta-row">
                <span class="lift-meta-item">
                  <span class="lift-meta-lbl">Program change</span>
                  <span class="lift-meta-val" style="color:${parseFloat(ratioGain)>=0?"#3dffa0":"#ff6b35"}">
                    ${parseFloat(ratioGain)>=0?"+":""}${ratioGain}×
                  </span>
                </span>
                <span class="lift-meta-item">
                  <span class="lift-meta-lbl">Target</span>
                  <span class="lift-meta-val" style="color:#e8ff47">1.5× BW</span>
                </span>
              </div>
            ` : ""}
          </div>
        `;
      })() : `<div class="loading-text muted">Need bodyweight + squat data to calculate.</div>`}

      <div class="section-head" style="margin-top:16px">WEEKLY TRAINING VOLUME</div>
      ${weeklyVol.length ? (() => {
        const vols = weeklyVol.map(w => w.vol);
        const maxV = Math.max(...vols) || 1;
        return `
          <div class="chart-block">
            <div class="chart-title">Total Tonnage (sets × reps × weight)</div>
            <div class="chart-wrap" style="height:90px">
              ${weeklyVol.slice(-10).map(w => {
                const pct = (w.vol / maxV) * 85;
                const isDeload = w.label.includes("D");
                return `
                  <div class="chart-col" style="width:${100/Math.min(weeklyVol.length,10)}%">
                    <div class="chart-bar-wrap">
                      <div class="chart-bar" style="height:${pct}%;background:${isDeload?"#5ba4ff":"#e8ff47"}"></div>
                    </div>
                    <div class="chart-val">${w.vol > 1000 ? (w.vol/1000).toFixed(1)+"k" : w.vol}</div>
                    <div class="chart-date">${w.label}</div>
                  </div>`;
              }).join("")}
            </div>
          </div>
        `;
      })() : `<div class="loading-text muted">Log sessions to see volume.</div>`}
    `;
  },

  calcWeeklyVolume(stats) {
    const vh = stats.volumeHistory || {};
    const weekMap = {};
    Object.values(vh).forEach(sessions => {
      sessions.forEach(s => {
        if (!s.date) return;
        const d = new Date(s.date);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        const key = `${d.getFullYear()}-W${String(week).padStart(2,"0")}`;
        const vol = (s.weight || 0) * (parseFloat(s.reps) || 0);
        weekMap[key] = (weekMap[key] || 0) + vol;
      });
    });
    return Object.entries(weekMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => ({ label: k.slice(6), vol: Math.round(v) }));
  },

  // ── COACH TAB ─────────────────────────────────────────────────────────────
  renderCoachTab(stats) {
    const stretches = stats.stretches || {};
    const keys = Object.keys(stretches);
    return `
      <div class="section-head">STRETCH TARGETS</div>
      ${keys.length ? `
        <div class="stretch-list">
          ${keys.map(k => `
            <div class="stretch-row">
              <span class="stretch-name">${stretches[k].name}</span>
              <span class="stretch-curr">${stretches[k].current}</span>
              <span class="stretch-arrow">→</span>
              <span class="stretch-target">${stretches[k].target}</span>
              <span class="stretch-date">${stretches[k].date}</span>
            </div>
          `).join("")}
        </div>
      ` : `<div class="loading-text muted">Log sessions to see targets.</div>`}

      <div class="section-head" style="margin-top:16px">ACTIVITY</div>
      <div class="stat-row">
        <div class="stat-box"><div class="stat-num">${stats.last7 || 0}</div><div class="stat-lbl">last 7 days</div></div>
        <div class="stat-box"><div class="stat-num">${stats.last30 || 0}</div><div class="stat-lbl">last 30 days</div></div>
        <div class="stat-box"><div class="stat-num">${((stats.last30||0)/4.3).toFixed(1)}</div><div class="stat-lbl">avg / week</div></div>
      </div>

      <div class="section-head" style="margin-top:16px">COACHING CHECK-IN</div>
      <div class="claude-export-card">
        <div class="claude-export-text">
          Copies your full 3-week training summary formatted for Claude —
          all lifts, weights, phase, and stretch targets. Paste into a new chat for program updates or plateau fixes.
        </div>
        <button class="btn-claude" id="claude-copy-btn" onclick="UI.copyForClaude()">
          Copy for Claude
        </button>
      </div>
    `;
  },

  async copyForClaude() {
    const btn = document.getElementById("claude-copy-btn");
    if (btn) { btn.textContent = "Building…"; btn.disabled = true; }
    try {
      const text = await App.buildClaudeExport();
      await navigator.clipboard.writeText(text);
      this.showToast("Copied — paste into Claude ✓");
      if (btn) { btn.textContent = "Copied ✓"; }
      setTimeout(() => { if (btn) { btn.textContent = "Copy for Claude"; btn.disabled = false; } }, 3000);
    } catch(e) {
      this.showClaudeFallback(await App.buildClaudeExport());
      if (btn) { btn.textContent = "Copy for Claude"; btn.disabled = false; }
    }
  },

  showClaudeFallback(text) {
    const overlay = this.el("div", "export-overlay");
    overlay.innerHTML = `
      <div class="export-modal">
        <div class="export-modal-head">
          <span>Copy into Claude</span>
          <button onclick="this.closest('.export-overlay').remove()">✕</button>
        </div>
        <textarea class="export-textarea" readonly>${text}</textarea>
        <button class="btn-primary" onclick="
          this.previousElementSibling.select();
          document.execCommand('copy');
          UI.showToast('Copied ✓');
        ">Select All & Copy</button>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  // ── HISTORY VIEW ──────────────────────────────────────────────────────────
  async renderHistory() {
    const wrap = this.el("div", "page");
    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-label">All Sessions</div>
        <h1 class="page-title">HISTORY</h1>
      </header>
      <div id="history-content"><div class="loading-text">Loading…</div></div>
    `;
    this.root.appendChild(wrap);

    // Render from cache instantly if warm
    const content = document.getElementById("history-content");
    if (!content) return;

    if (App.state.history) {
      this._renderHistoryInto(content, App.state.history);
    } else {
      const { sessions } = await App.fetchHistory();
      App.state.history = sessions;
      this._renderHistoryInto(content, sessions);
    }
  },

  _renderHistoryInto(content, sessions) {
    if (!sessions || !sessions.length) {
      content.innerHTML = `<div class="loading-text muted">No sessions logged yet.</div>`;
      return;
    }
    content.innerHTML = sessions.map(s => `
      <div class="history-card">
        <div class="history-header">
          <span class="history-date">${s.date}</span>
          <span class="history-day">${s.dayTitle}</span>
        </div>
        <div class="history-exercises">
          ${s.exercises.map(ex => {
            const setStr = ex.sets?.map(st => `${st.weight}×${st.reps}`).join(" · ") || "";
            return `
              <div class="history-ex">
                <span class="history-ex-name">${ex.name}</span>
                <span class="history-ex-sets">${setStr}</span>
              </div>`;
          }).join("")}
        </div>
      </div>
    `).join("");
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────
  el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  },

  showToast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }
};
