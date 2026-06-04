// ─── UI — two states: PICK and SESSION ────────────────────────────────────────

const UI = {

  init() {
    this.root         = document.getElementById("app");
    this._restTimer   = null;
    this._restTarget  = null;
    this._restTotal   = 0;
    this._activeExIdx = 0;
    this._logDate     = null;
    this._longPressTimer = null;
    this._swappingEi  = undefined;
    this._prefetch();
    this.render();
  },

  // ── CACHE ──────────────────────────────────────────────────────────────────
  async _prefetch() {
    try {
      const [stats, histResult] = await Promise.all([
        App.state.stats   ? Promise.resolve(App.state.stats)   : App.fetchStats(),
        App.state.history ? Promise.resolve({ sessions: App.state.history }) : App.fetchHistory()
      ]);
      App.state.stats   = stats;
      App.state.history = histResult.sessions || histResult;
    } catch(e) {}
  },
  _invalidateCache() {
    App.state.stats = App.state.bwLog = App.state.history = null;
  },

  // ── RENDER ─────────────────────────────────────────────────────────────────
  render() {
    this.root.innerHTML = "";
    document.getElementById("bottom-nav")?.remove();
    const v = App.state.view || "pick";
    if (v === "session") { this.renderSession(); return; }
    this.renderPick();
  },

  nav(view) { App.state.view = view; this.render(); window.scrollTo(0,0); },

  // ══════════════════════════════════════════════════════════════════════════
  // PICK — the only "home" screen
  // ══════════════════════════════════════════════════════════════════════════
  renderPick() {
    const wrap = this.el("div", "pick-wrap");
    const currentWeek = getCurrentWeek();
    const weekData    = WEEKS[currentWeek] || {};
    const phaseId     = weekData.phaseId || "strength";
    const phase       = weekData.phase   || {};
    const suggestedId = App.getSuggestedDay();
    const dow         = new Date().getDay();
    const dateStr     = new Date().toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });

    const days = [
      { id:"dayA",  label:"Monday",   tag:"Upper"  },
      { id:"dayB",  label:"Wednesday",tag:"Lower"  },
      { id:"dayC",  label:"Friday",   tag:"Olympic"},
      { id:"sport", label:"Any day",  tag:"Sport"  }
    ];

    wrap.innerHTML = `
      <div class="pick-header">
        <div class="pick-date">${dateStr}</div>
        <div class="pick-phase">
          <span class="phase-dot phase-dot-${phaseId}"></span>
          Wk ${currentWeek} · ${phase.label || ""}
        </div>
      </div>

      <div class="pick-cards">
        ${days.map(d => {
          const prog    = PROGRAM[d.id];
          const isSuggested = d.id === suggestedId;
          return `
            <button class="pick-card ${isSuggested ? "pick-card-suggested" : ""}"
              onclick="UI.startDay('${d.id}')">
              <div class="pick-card-inner">
                <div class="pick-card-tag">${d.tag}</div>
                <div class="pick-card-title">${prog.title}</div>
                ${isSuggested ? `<div class="pick-card-cta">Start →</div>` : ""}
              </div>
            </button>`;
        }).join("")}
      </div>

      <div class="pick-past">
        <span class="pick-past-label">Logging for a past date?</span>
        <input type="date" id="log-past-date" class="pick-date-input"
          max="${new Date().toISOString().split("T")[0]}"
          value="${new Date().toISOString().split("T")[0]}">
      </div>
    `;

    this.root.appendChild(wrap);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // START DAY
  // ══════════════════════════════════════════════════════════════════════════
  async startDay(dayId) {
    // Show immediate loading state
    this.root.innerHTML = `<div class="session-loading">Loading…</div>`;

    const today = new Date().toISOString().split("T")[0];
    const picked = document.getElementById("log-past-date")?.value;
    this._logDate = (picked && picked !== today) ? picked : null;

    App.state.activeDay = dayId;
    const session = App.newSession(dayId);
    const last = await App.fetchLastSession(dayId);
    App.state.lastSession = last;
    App.state.session = App.applyLastSession(session, last);
    App.state.loading = false;
    App.state.view = "session";
    this._activeExIdx = 0;
    this.render();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION — full screen, one exercise at a time
  // ══════════════════════════════════════════════════════════════════════════
  renderSession() {
    const { session, activeDay } = App.state;
    if (!activeDay) { App.state.view = "pick"; this.render(); return; }
    if (!session)   { this.root.innerHTML = `<div class="session-loading">Loading…</div>`; return; }

    const day = PROGRAM[activeDay];
    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek] || {};
    const phaseId  = day.phaseId || weekData.phaseId || "strength";

    const wrap = this.el("div", "session-wrap");

    // ── Sticky header
    const hdr = this.el("div", "session-header");
    hdr.id = "session-header";
    hdr.innerHTML = `
      <div class="session-top-row">
        <button class="session-end-btn" onclick="UI._confirmEndSession()">✕</button>
        <button class="session-ex-name-btn" id="session-ex-name"
          ontouchstart="UI._longPressStart(event)"
          ontouchend="UI._longPressEnd()"
          ontouchmove="UI._longPressEnd()">—</button>
        <span class="session-set-badge" id="session-set-count"></span>
      </div>
      <div class="session-phase-row">
        <span class="phase-dot phase-dot-${phaseId}"></span>
        <span class="session-phase-txt">${phase.tip || ""}</span>
      </div>
      <div id="rest-bar" class="rest-bar">
        <div id="rest-bar-fill" class="rest-bar-fill"></div>
        <div class="rest-bar-row">
          <button class="rest-adj" onclick="UI._adjustRest(-30)">−30s</button>
          <span id="rest-bar-time" class="rest-bar-time">0:00</span>
          <button class="rest-adj" onclick="UI._adjustRest(30)">+30s</button>
          <button class="rest-skip" onclick="UI._cancelRestTimer()">Skip</button>
        </div>
      </div>
    `;
    wrap.appendChild(hdr);

    // ── Body — one exercise
    const body = this.el("div", "session-body");
    body.id = "session-body";
    wrap.appendChild(body);

    // ── Bottom bar
    const bot = this.el("div", "session-bottom");
    bot.id = "session-bottom";
    wrap.appendChild(bot);

    this.root.appendChild(wrap);
    this._renderActiveExercise();
    this._updateHeader();
    this._updateBottom();
  },

  _renderActiveExercise() {
    const body = document.getElementById("session-body");
    if (!body) return;
    const { session } = App.state;
    const ei = this._activeExIdx;
    if (!session?.exercises?.[ei]) return;

    const ex   = session.exercises[ei];
    const sets = ex.sets;

    body.innerHTML = `
      ${ex.tip ? `<div class="ex-tip-banner">${ex.tip}</div>` : ""}
      <div class="sets-table">
        <div class="sets-header">
          <span class="sh-set">Set</span>
          <span class="sh-reps">Reps</span>
          <span class="sh-weight">Weight</span>
          <span class="sh-done"></span>
        </div>
        ${sets.map((set, si) => this._renderSetRow(ex, ei, si, set)).join("")}
      </div>
    `;
  },

  _renderSetRow(ex, ei, si, set) {
    const done     = set.logged   || false;
    const excluded = set.excluded || false;
    const prev     = set.prev;
    const repsGhost   = !done && prev && String(set.reps)   === String(prev.reps);
    const weightGhost = !done && prev && String(set.weight) === String(prev.weight);

    if (excluded) return `
      <div class="set-row excluded" id="set-${ei}-${si}">
        <span class="sr-set">${si+1}</span>
        <span class="sr-skipped">skipped</span>
        <span></span>
        <button class="sr-undo" onclick="UI.toggleExclude(${ei},${si})">undo</button>
      </div>`;

    const checkSVG = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l5 5 7-8"/></svg>`;

    if (ex.bodyweight) return `
      <div class="set-row ${done?"set-done":""}" id="set-${ei}-${si}">
        <span class="sr-set">${si+1}${set.note?`<em>${set.note}</em>`:""}</span>
        <span class="sr-bw">${set.reps}</span>
        <span></span>
        <button class="sr-circle ${done?"checked":""}" onclick="UI.toggleSet(${ei},${si})">
          ${done?checkSVG:""}
        </button>
      </div>`;

    return `
      <div class="set-row ${done?"set-done":""}" id="set-${ei}-${si}">
        <span class="sr-set">${si+1}${set.note?`<em>${set.note}</em>`:""}</span>
        <span class="sr-stepper">
          <button class="sr-step" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'reps',-1)">−</button>
          <span class="sr-val ${repsGhost?"ghost":""}" id="rv-${ei}-${si}">${set.reps}</span>
          <button class="sr-step" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'reps',1)">+</button>
        </span>
        <span class="sr-stepper">
          <button class="sr-step" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'weight',-5)">−</button>
          <span class="sr-val ${weightGhost?"ghost":""}" id="wv-${ei}-${si}">${set.weight}</span>
          <button class="sr-step" ontouchstart="event.preventDefault()" onclick="UI._step(${ei},${si},'weight',5)">+</button>
        </span>
        <button class="sr-circle ${done?"checked":""}" onclick="UI.toggleSet(${ei},${si})">
          ${done?checkSVG:""}
        </button>
      </div>`;
  },

  // ── SET ACTIONS ────────────────────────────────────────────────────────────
  _step(ei, si, field, delta) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set) return;
    const next = Math.max(0, (parseFloat(set[field])||0) + delta);
    set[field] = next;
    const id = field === "reps" ? `rv-${ei}-${si}` : `wv-${ei}-${si}`;
    const el = document.getElementById(id);
    if (el) { el.textContent = next; el.classList.remove("ghost"); }
  },

  toggleSet(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set || set.excluded) return;
    set.logged = !set.logged;

    const row = document.getElementById(`set-${ei}-${si}`);
    if (row) {
      row.classList.toggle("set-done", set.logged);
      const btn = row.querySelector(".sr-circle");
      if (btn) {
        btn.classList.toggle("checked", set.logged);
        const svg = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l5 5 7-8"/></svg>`;
        btn.innerHTML = set.logged ? svg : "";
      }
    }

    const ex = App.state.session.exercises[ei];
    const activeSets = ex.sets.filter(s => !s.excluded);
    const doneSets   = ex.sets.filter(s => s.logged);

    this._updateHeader();
    this._updateBottom();

    if (set.logged) {
      const restSec = this._parseRestToSeconds(ex.rest);
      if (restSec > 0) this._startRestTimer(restSec);

      // Auto-advance when all sets done
      if (doneSets.length === activeSets.length) {
        const nextEi = ei + 1;
        if (nextEi < App.state.session.exercises.length) {
          setTimeout(() => this._jumpToEx(nextEi), 700);
        }
      }
    } else {
      this._cancelRestTimer();
    }
  },

  toggleExclude(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set) return;
    set.excluded = !set.excluded;
    if (set.excluded) set.logged = false;
    this._renderActiveExercise();
    this._updateHeader();
    this._updateBottom();
  },

  updateSet(ei, si, field, val) {
    if (App.state.session?.exercises?.[ei]?.sets?.[si])
      App.state.session.exercises[ei].sets[si][field] = val;
  },

  // ── NAVIGATION ─────────────────────────────────────────────────────────────
  _jumpToEx(ei) {
    this._activeExIdx = ei;
    this._renderActiveExercise();
    this._updateHeader();
    this._updateBottom();
    document.getElementById("session-body")?.scrollTo({top:0,behavior:"instant"});
  },

  _updateHeader() {
    const ei  = this._activeExIdx;
    const ex  = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const activeSets = ex.sets.filter(s => !s.excluded);
    const doneSets   = ex.sets.filter(s => s.logged);
    const nameEl  = document.getElementById("session-ex-name");
    const countEl = document.getElementById("session-set-count");
    if (nameEl)  nameEl.textContent  = ex.name;
    if (countEl) countEl.textContent = `${Math.min(doneSets.length+1, activeSets.length)} / ${activeSets.length}`;
  },

  _updateBottom() {
    const bot = document.getElementById("session-bottom");
    if (!bot || !App.state.session) return;
    const { session } = App.state;
    const allDone = session.exercises.every(ex =>
      ex.sets.filter(s=>!s.excluded).every(s=>s.logged));

    const pills = session.exercises.map((ex, ei) => {
      const active  = ei === this._activeExIdx;
      const exDone  = ex.sets.filter(s=>!s.excluded).every(s=>s.logged) && ex.sets.some(s=>!s.excluded);
      return `<button class="ep ${active?"ep-active":""} ${exDone?"ep-done":""}"
        onclick="UI._jumpToEx(${ei})">${ex.name.split(" ").slice(0,2).join(" ")}</button>`;
    }).join("");

    bot.innerHTML = `
      <div class="ep-scroll">${pills}</div>
      <button class="btn-finish-session ${allDone?"btn-finish-ready":""}"
        onclick="UI._confirmFinish()">
        ${allDone ? "✓ Finish" : "Finish"}
      </button>`;
  },

  // ── EXERCISE MANAGEMENT ────────────────────────────────────────────────────
  _longPressStart(e) {
    this._longPressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      this._showExMenu();
    }, 500);
  },
  _longPressEnd() { clearTimeout(this._longPressTimer); },

  _showExMenu() {
    const ei  = this._activeExIdx;
    const exs = App.state.session?.exercises;
    const ex  = exs?.[ei];
    if (!ex) return;
    const sheet = this.el("div", "sheet-overlay");
    sheet.id = "ex-menu-overlay";
    sheet.innerHTML = `
      <div class="bottom-sheet">
        <div class="bs-handle"></div>
        <div class="bs-title">${ex.name}</div>
        ${ei > 0 ? `<button class="bs-btn" onclick="UI._moveEx(${ei},-1);document.getElementById('ex-menu-overlay').remove()">↑ Move Up</button>` : ""}
        ${ei < exs.length-1 ? `<button class="bs-btn" onclick="UI._moveEx(${ei},1);document.getElementById('ex-menu-overlay').remove()">↓ Move Down</button>` : ""}
        <button class="bs-btn" onclick="UI._swapEx(${ei});document.getElementById('ex-menu-overlay').remove()">⇄ Swap Exercise</button>
        <button class="bs-btn bs-btn-danger" onclick="UI._removeEx(${ei});document.getElementById('ex-menu-overlay').remove()">Remove</button>
        <button class="bs-btn bs-btn-cancel" onclick="document.getElementById('ex-menu-overlay').remove()">Cancel</button>
      </div>`;
    sheet.addEventListener("click", e => { if (e.target===sheet) sheet.remove(); });
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
    this._updateHeader();
    this._updateBottom();
  },

  _removeEx(ei) {
    const exs = App.state.session?.exercises;
    if (!exs || exs.length <= 1) { this.showToast("Can't remove last exercise"); return; }
    exs.splice(ei, 1);
    this._activeExIdx = Math.min(ei, exs.length-1);
    this._renderActiveExercise();
    this._updateHeader();
    this._updateBottom();
  },

  _swapEx(ei) {
    this._swappingEi = ei;
    this.showExercisePicker(PROGRAM[App.state.activeDay], App.state.session, true);
  },

  // ── REST TIMER ─────────────────────────────────────────────────────────────
  _parseRestToSeconds(s) {
    if (!s) return 90;
    const m = s.match(/(\d+)\s*min/i); if (m) return parseInt(m[1])*60;
    const sc = s.match(/(\d+)\s*sec/i); if (sc) return parseInt(sc[1]);
    const n = parseInt(s); return isNaN(n) ? 90 : n;
  },

  _startRestTimer(seconds) {
    this._cancelRestTimer();
    this._restTarget = Date.now() + seconds * 1000;
    this._restTotal  = seconds;

    const bar = document.getElementById("rest-bar");
    if (bar) bar.classList.add("rest-bar-visible");

    const tick = () => {
      const rem = Math.max(0, Math.ceil((this._restTarget - Date.now()) / 1000));
      const pct = (rem / this._restTotal) * 100;
      const t   = document.getElementById("rest-bar-time");
      const f   = document.getElementById("rest-bar-fill");
      if (t) t.textContent = `${Math.floor(rem/60)}:${String(rem%60).padStart(2,"0")}`;
      if (f) {
        f.style.width = pct + "%";
        f.style.background = pct > 60 ? "var(--green)" : pct > 25 ? "var(--orange)" : "#ff3b3b";
      }
      if (rem <= 0) {
        this._cancelRestTimer();
        if (navigator.vibrate) navigator.vibrate([150,80,150]);
        if (f) { f.style.width="100%"; f.style.background="var(--yellow)"; }
        if (t) t.textContent = "Go!";
        setTimeout(() => {
          const b = document.getElementById("rest-bar");
          if (b) b.classList.remove("rest-bar-visible");
        }, 2000);
      }
    };
    tick();
    this._restTimer = setInterval(tick, 500);
  },

  _cancelRestTimer() {
    if (this._restTimer) { clearInterval(this._restTimer); this._restTimer = null; }
    const b = document.getElementById("rest-bar");
    if (b) b.classList.remove("rest-bar-visible");
  },

  _adjustRest(delta) {
    if (!this._restTarget) return;
    this._restTarget += delta * 1000;
    this._restTotal  = Math.max(1, this._restTotal + delta);
  },

  // ── END SESSION ────────────────────────────────────────────────────────────
  _confirmEndSession() {
    const sheet = this.el("div", "sheet-overlay");
    sheet.innerHTML = `
      <div class="bottom-sheet">
        <div class="bs-handle"></div>
        <div class="bs-title">End Workout?</div>
        <button class="bs-btn" onclick="UI._doSave()">Save & Exit</button>
        <button class="bs-btn bs-btn-danger" onclick="UI._discard()">Discard</button>
        <button class="bs-btn bs-btn-cancel" onclick="this.closest('.sheet-overlay').remove()">Keep Going</button>
      </div>`;
    document.body.appendChild(sheet);
  },

  _confirmFinish() {
    const allDone = App.state.session?.exercises.every(ex =>
      ex.sets.filter(s=>!s.excluded).every(s=>s.logged));
    if (allDone) { this._doSave(); return; }
    const sheet = this.el("div", "sheet-overlay");
    sheet.innerHTML = `
      <div class="bottom-sheet">
        <div class="bs-handle"></div>
        <div class="bs-title">Finish Workout?</div>
        <div class="bs-sub">Some sets aren't marked done yet.</div>
        <button class="bs-btn" onclick="UI._doSave()">Save Anyway</button>
        <button class="bs-btn bs-btn-cancel" onclick="this.closest('.sheet-overlay').remove()">Keep Going</button>
      </div>`;
    document.body.appendChild(sheet);
  },

  async _doSave() {
    document.querySelector(".sheet-overlay")?.remove();
    const { session, activeDay } = App.state;
    const day = PROGRAM[activeDay];
    if (!session) return;

    const toSave = {
      ...session,
      exercises: session.exercises.map(ex => ({
        ...ex, sets: ex.sets.filter(s => !s.excluded)
      })).filter(ex => ex.sets.length > 0)
    };
    if (this._logDate) toSave.date = this._logDate;

    if (day.sportOnly) {
      const type  = document.getElementById("sport-type")?.value  || "Sport";
      const dur   = document.getElementById("sport-duration")?.value || 0;
      const notes = document.getElementById("sport-notes")?.value  || "";
      toSave.exercises = [{ id:"sport", name:type, sets:[{reps:`${dur} min`,weight:0,note:notes}] }];
    }

    this.showToast("Saving…");
    try {
      const r = await App.saveSession(toSave);
      this._cancelRestTimer();
      this._invalidateCache();
      this.showToast(r.local ? "Saved locally ✓" : "Saved ✓");
      App.state.session = App.state.activeDay = null;
      setTimeout(() => { App.state.view = "pick"; this.render(); }, 800);
    } catch(e) {
      this.showToast("Save failed — try again");
    }
  },

  _discard() {
    document.querySelector(".sheet-overlay")?.remove();
    this._cancelRestTimer();
    App.state.session = App.state.activeDay = null;
    App.state.view = "pick";
    this.render();
  },

  // ── EXERCISE PICKER ────────────────────────────────────────────────────────
  showExercisePicker(day, session) {
    const groups = {
      "Upper — Push":["push_acc"],"Upper — Pull":["pull_acc"],
      "Biceps":["curl_acc"],"Shoulders":["latraise_acc"],
      "Core":["core_upper","core_lower","sideplank_acc"],
      "Lower — Quad":["leg_acc"],"Lower — Ham":["hamstring_acc"],
      "Calves":["calf_acc"],"Olympic":["snatch_acc","jerk_acc"],
      "Squat":["squat_fri_acc"],"Deadlift":["rdl_fri_acc"]
    };
    const exMap = {};
    Object.entries(groups).forEach(([g,keys]) => {
      keys.forEach(k => { (ACC_POOLS[k]||[]).forEach(ex => { if(!exMap[ex.name]) exMap[ex.name]={...ex,group:g}; }); });
    });
    Object.values(MAIN_LIFTS||{}).forEach(ex => { if(!exMap[ex.name]) exMap[ex.name]={...ex,group:"Main Lifts"}; });
    const all = Object.values(exMap).sort((a,b)=>a.name.localeCompare(b.name));

    const overlay = this.el("div","sheet-overlay");
    overlay.id = "exercise-picker-overlay";
    const byGroup = {};
    all.forEach(e => { (byGroup[e.group]=byGroup[e.group]||[]).push(e); });
    const listHTML = Object.entries(byGroup).map(([g,exs]) => `
      <div class="picker-group">${g}</div>
      ${exs.map(ex => `
        <button class="picker-item" onclick="UI._addEx('${ex.id}','${ex.name.replace(/'/g,"\\'")}',${ex.baseline||0})">
          <span class="picker-name">${ex.name}</span>
          ${ex.baseline?`<span class="picker-meta">${ex.baseline} lbs</span>`:""}
        </button>`).join("")}`).join("");

    overlay.innerHTML = `
      <div class="bottom-sheet bottom-sheet-tall">
        <div class="bs-handle"></div>
        <div class="bs-search-row">
          <input type="search" placeholder="Search…" id="ex-search"
            autocomplete="off" autocorrect="off"
            oninput="UI._filterPicker(this.value)">
        </div>
        <div class="picker-list" id="picker-list">${listHTML}</div>
      </div>`;
    overlay.addEventListener("click", e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById("ex-search")?.focus(), 150);
  },

  _filterPicker(q) {
    document.querySelectorAll("#picker-list .picker-item").forEach(el => {
      el.style.display = el.querySelector(".picker-name").textContent.toLowerCase().includes(q.toLowerCase()) ? "" : "none";
    });
    document.querySelectorAll("#picker-list .picker-group").forEach(lbl => {
      let n=lbl.nextElementSibling, vis=false;
      while(n && !n.classList.contains("picker-group")) { if(n.style.display!=="none") vis=true; n=n.nextElementSibling; }
      lbl.style.display = vis ? "" : "none";
    });
  },

  _addEx(id, name, baseline) {
    const { session, activeDay } = App.state;
    if (!session) return;
    const day = PROGRAM[activeDay];
    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek]||{};
    const phaseId = day.phaseId || weekData.phaseId || "strength";
    const ww = Math.round(((baseline||45)*(phaseId==="strength"?1.0:phaseId==="hypertrophy"?0.85:0.70))/5)*5;
    const sets = Array.from({length:3},()=>({reps:8,weight:ww}));
    const newEx = {id,name,sets,rest:"90 sec",tip:"",bodyweight:baseline===0};

    document.getElementById("exercise-picker-overlay")?.remove();

    if (this._swappingEi !== undefined) {
      session.exercises[this._swappingEi] = newEx;
      this._swappingEi = undefined;
    } else {
      session.exercises.push(newEx);
      this._activeExIdx = session.exercises.length-1;
    }

    this._renderActiveExercise();
    this._updateHeader();
    this._updateBottom();
  },

  // ── SPORT LOG ──────────────────────────────────────────────────────────────
  renderSportLog(session, day) {
    const block = this.el("div","ex-block");
    block.innerHTML = `<div class="sport-log">
      <div class="sport-log-label">Log your session</div>
      <div class="sport-fields">
        <label>Activity<select id="sport-type" class="sport-select">
          <option>Basketball</option><option>Pickleball</option><option>Hike</option><option>Other</option>
        </select></label>
        <label>Duration (min)<input type="number" inputmode="decimal" id="sport-duration" class="set-input" placeholder="60" value="60"></label>
        <label>Notes<input type="text" id="sport-notes" class="set-input" placeholder="e.g. pickup, 5 games"></label>
      </div>
    </div>`;
    return block;
  },

  // ── HELPERS ────────────────────────────────────────────────────────────────
  el(tag, cls) { const e=document.createElement(tag); if(cls) e.className=cls; return e; },

  showToast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t=document.createElement("div"); t.id="toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
  }
};
