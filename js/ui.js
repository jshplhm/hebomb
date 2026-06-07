// ─── UI ────────────────────────────────────────────────────────────────────────

const UI = {

  async init() {
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

    // Show a minimal loading state while the critical first fetch runs.
    // This is fast (~200–400ms) and means the picker renders correctly on
    // the first paint rather than showing wrong data that later corrects.
    if (!App.state.history) {
      const phrases = [
        ["Welcome back, Josh", "Let's get after it."],
        ["Ready when you are", "Your program is waiting."],
        ["Consistency is the goal", "Show up. Again."],
        ["Every rep counts", "Make this one count too."],
        ["Strong by design", "Not by accident."],
        ["Progress, not perfection", "Let's move."],
        ["Today is earned", "Put in the work."],
        ["Trust the process", "The numbers don't lie."],
        ["No shortcuts", "Just work."],
        ["One more session", "That's all it ever is."],
        ["Discipline builds champions", "Let's go, Josh."],
        ["What you do today", "Shapes what you lift tomorrow."],
        ["You showed up", "That's already half the battle."],
        ["Train smart. Train hard.", "Then do it again."],
        ["The bar doesn't care", "How you feel. Lift anyway."],
      ];
      const [headline, sub] = phrases[Math.floor(Math.random() * phrases.length)];
      this.root.innerHTML = `<div class="init-loading">
        <div class="init-loading-inner">
          <div class="init-loading-headline">${headline}</div>
          <div class="init-loading-sub">${sub}</div>
          <div class="init-loading-spinner"><span></span><span></span><span></span></div>
        </div>
      </div>`;
      try {
        const { sessions } = await App.fetchHistory();
        App.state.history = sessions;
      } catch (e) {
        App.state.history = [];
      }
    }

    // Fire the rest of the prefetches in the background (non-blocking)
    this._prefetchBackground();
    this.render();
  },

  _prefetchBackground() {
    if (!App.state.bwLog) {
      App.getBodyweightLog()
        .then(log => { App.state.bwLog = this._bwMergeWithShadow(log); })
        .catch(() => { App.state.bwLog = this._bwMergeWithShadow([]); });
    }
    if (!App.state.stats) {
      App.fetchStats().then(stats => { App.state.stats = stats; }).catch(()=>{});
    }
  },

  _prefetchAll() {
    // Legacy: kept for any callers, delegates to _prefetchBackground
    this._prefetchBackground();
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
    const cw  = getCurrentWeek();
    const wd  = WEEKS[cw] || {};
    const pid = wd.phaseId || "strength";
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    this._renderPickerInto(wrap, cw, wd, pid, greeting);
    this.root.appendChild(wrap);
    // History fetch is kicked off in init() via _prefetchAll, which calls
    // back to re-render the picker once data lands. No need to duplicate here.
  },

  _renderPickerInto(wrap, cw, wd, pid, greeting) {
    const history = App.state.history || [];
    const lastDone = {};
    history.forEach(s => {
      if (!lastDone[s.dayId] || s.date > lastDone[s.dayId]) lastDone[s.dayId] = s.date;
    });

    // Today's "default" day = the day done least recently among the 3 program days.
    // If nothing has been done, default to dayA.
    const dayIds = ["dayA","dayB","dayC"];
    const today = this._today();
    let heroId = dayIds[0];
    let oldest = Infinity;
    dayIds.forEach(id => {
      const last = lastDone[id];
      const days = last ? Math.round((Date.now() - new Date(String(last).slice(0,10)+"T12:00:00")) / 86400000) : 9999;
      if (days > oldest) { oldest = days; heroId = id; }
      else if (days === oldest && id !== heroId) { /* keep first */ }
      if (days > oldest || oldest === Infinity) { oldest = days; heroId = id; }
    });
    // Simpler: pick the day whose lastDone date is the smallest (oldest), or hasn't been done.
    heroId = dayIds.reduce((best, id) => {
      const a = lastDone[id] || "0000-00-00";
      const b = lastDone[best] || "0000-00-00";
      return a < b ? id : best;
    }, dayIds[0]);

    const heroDay = PROGRAM[heroId];
    const heroExercises = heroDay.exercises || [];
    const heroSetCount = heroExercises.reduce((n, ex) => n + (ex.sets?.length || 0), 0);
    const heroLastStr = lastDone[heroId] ? UI._daysAgo(lastDone[heroId]) : "not done yet";

    // Top progression — find the biggest weight bump on the hero day's last vs prior session
    const heroLast = history.filter(s => s.dayId === heroId).slice(0, 2);
    let topProg = null;
    if (heroLast.length >= 2) {
      const cur = heroLast[0], prev = heroLast[1];
      cur.exercises?.forEach(ex => {
        const pEx = prev.exercises?.find(e => e.id === ex.id);
        if (!pEx) return;
        const cBest = ex.sets?.reduce((b,s)=>parseFloat(s.weight)>parseFloat(b?.weight||0)?s:b,null);
        const pBest = pEx.sets?.reduce((b,s)=>parseFloat(s.weight)>parseFloat(b?.weight||0)?s:b,null);
        if (cBest && pBest) {
          const diff = parseFloat(cBest.weight) - parseFloat(pBest.weight);
          if (diff > 0 && (!topProg || diff > topProg.diff)) {
            topProg = { name: ex.name, diff };
          }
        }
      });
    }

    // Week rhythm — last 7 days
    const weekCells = this._buildWeekRhythm(history, lastDone);

    // Streak — consecutive weeks with at least 1 session
    const streak = this._calcStreak(history);

    // Other days (everything except hero)
    const otherDays = dayIds.filter(id => id !== heroId);

    const phaseLabel = wd.phase?.label || "Strength";

    wrap.innerHTML = `
      <div class="picker-v2">
        <!-- top identity strip -->
        <div class="land-id">
          <div class="land-id-left">
            <div class="land-greet">${greeting} · Josh</div>
            <div class="land-name">Week ${cw}</div>
          </div>
          <div class="land-phase-chip">
            <span class="wk">Phase</span>
            <span class="ph phase-${pid}">${phaseLabel}</span>
          </div>
        </div>

        <!-- week rhythm — updates in-place when history loads -->
        <div class="land-week" id="land-week-strip">
          ${weekCells.map(c => `
            <div class="land-week-cell ${c.cls}">
              <div class="dow">${c.dow}</div>
              <div class="dot">${c.dotChar}</div>
              <div class="lbl">${c.label}</div>
            </div>`).join("")}
        </div>

        <!-- hero card — updates in-place when history loads -->
        <button class="land-today-hero${!history.length?" land-hero-loading":""}" id="land-hero-card" onclick="UI._previewDay('${heroId}')">
          <div class="land-today-eyebrow"><span class="pulse"></span>Next up</div>
          <div class="land-today-title">${heroDay.title}</div>
          <div class="land-today-meta">
            <div class="land-meta-pair">
              <span class="lbl">Lifts</span>
              <span class="val">${heroExercises.length}</span>
            </div>
            <div class="land-meta-pair">
              <span class="lbl">Sets</span>
              <span class="val">${heroSetCount}</span>
            </div>
            <div class="land-meta-pair">
              <span class="lbl">Last done</span>
              <span class="val" id="land-hero-lastdone">${heroLastStr}</span>
            </div>
            ${topProg ? `
              <div class="land-meta-pair">
                <span class="lbl">Top lift</span>
                <span class="val green">+${topProg.diff} lbs</span>
              </div>` : ""}
          </div>
          <div class="land-today-cta">
            <span>Start workout</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </div>
        </button>

        ${streak >= 2 ? `
          <div class="land-streak">
            <span class="land-streak-icon">🔥</span>
            <span class="land-streak-text"><strong>${streak} weeks</strong> on plan — don't break it.</span>
          </div>` : ""}

        <div class="land-others-label">Or pick another day</div>
        <div class="land-others">
          ${otherDays.map(id => {
            const d = PROGRAM[id];
            const lastStr = lastDone[id] ? UI._daysAgo(lastDone[id]) : "not done yet";
            return `<button class="land-other-row" onclick="UI._previewDay('${id}')">
              <div class="land-other-left">
                <span class="land-other-title">${d.title}</span>
                <span class="land-other-last">${lastStr}</span>
              </div>
              <span class="land-other-arrow">→</span>
            </button>`;
          }).join("")}
        </div>
      </div>
    `;
  },

  // Build last-7-days week rhythm cells based on history
  _buildWeekRhythm(history, lastDone) {
    const cells = [];
    const today = new Date();
    today.setHours(12,0,0,0);
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const dowLabels = ["S","M","T","W","T","F","S"];
    // Build a map of date -> session
    const byDate = {};
    (history||[]).forEach(s => {
      const d = String(s.date).slice(0,10);
      if (!byDate[d]) byDate[d] = s;
    });
    // Start from monday of this week if possible. Actually simpler: last 6 days + today.
    for (let i = -6; i <= 0; i++) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() + i);
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
      const dow = dowLabels[dt.getDay()];
      const s = byDate[ymd];
      const isToday = ymd === todayYmd;
      let cls, label, dotChar = "·";
      if (s) {
        cls = "done";
        dotChar = "✓";
        const day = PROGRAM[s.dayId];
        label = day ? this._shortDayLabel(day.title) : (s.dayTitle ? this._shortDayLabel(s.dayTitle) : "Done");
      } else if (isToday) {
        cls = "today";
        label = "Today";
      } else {
        cls = "rest";
        label = "—";
      }
      cells.push({ dow, cls, dotChar, label });
    }
    return cells;
  },

  _shortDayLabel(title) {
    if (!title) return "";
    // "Upper — Push + Pull" -> "Upper"
    // "Lower + Core" -> "Lower"
    // "Olympic + Power" -> "Oly"
    const t = title.toLowerCase();
    if (t.startsWith("upper")) return "Upper";
    if (t.startsWith("lower")) return "Lower";
    if (t.startsWith("olympic") || t.startsWith("oly")) return "Oly";
    if (t.startsWith("push")) return "Push";
    if (t.startsWith("pull")) return "Pull";
    if (t.startsWith("legs")) return "Legs";
    // Fallback: first word, capped at 5
    const first = title.split(/\s/)[0] || "";
    return first.slice(0, 5);
  },

  // Calculate consecutive weeks with at least one session
  _calcStreak(history) {
    if (!history || !history.length) return 0;
    // Get unique ISO weeks (year-week) where a session happened
    const weeks = new Set();
    history.forEach(s => {
      const d = new Date(String(s.date).slice(0,10) + "T12:00:00");
      if (isNaN(d.getTime())) return;
      const week = this._isoWeek(d);
      weeks.add(week);
    });
    // Walk back from current week
    let streak = 0;
    const now = new Date();
    let cursor = new Date(now);
    while (true) {
      const wk = this._isoWeek(cursor);
      if (weeks.has(wk)) {
        streak++;
        cursor.setDate(cursor.getDate() - 7);
      } else {
        // Allow current week to be empty if it's early in the week (Mon/Tue)
        if (streak === 0 && now.getDay() <= 2 && cursor === now) {
          cursor.setDate(cursor.getDate() - 7);
          continue;
        }
        break;
      }
    }
    return streak;
  },

  // ISO-ish week key "YYYY-Www"
  _isoWeek(d) {
    const tgt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dn = tgt.getUTCDay() || 7;
    tgt.setUTCDate(tgt.getUTCDate() + 4 - dn);
    const yearStart = new Date(Date.UTC(tgt.getUTCFullYear(), 0, 1));
    const wkNum = Math.ceil((((tgt - yearStart) / 86400000) + 1) / 7);
    return `${tgt.getUTCFullYear()}-W${String(wkNum).padStart(2,"0")}`;
  },

  // Preview page — shows full exercise list, editable before starting
  _previewDay(dayId) {
    const d   = PROGRAM[dayId];
    const cw  = getCurrentWeek();
    const wd  = WEEKS[cw] || {};
    const pid = d.phaseId || wd.phaseId || "strength";

    // Build a working draft of the day's exercises that the user can edit
    // before starting. We deep-clone so we don't mutate PROGRAM.
    if (!this._draft || this._draft.dayId !== dayId) {
      this._draft = {
        dayId,
        exercises: (d.exercises||[]).map(ex => ({
          id: ex.id,
          name: ex.name,
          sets: (ex.sets||[]).map(s => ({...s}))
        }))
      };
      // Append cardio finisher to the draft for non-sport days
      if (!d.sportOnly) {
        this._draft.exercises.push({
          id: "cardio_finisher",
          name: "Incline Walk Finisher",
          isFinisher: true,
          sets: [{ reps: "15 min", weight: 0, note: "12% incline · 3.0–3.5 mph" }]
        });
      }
      this._draftEditing = false;
    }

    this._renderPreview(dayId, d, cw, pid);
  },

  _renderPreview(dayId, d, cw, pid) {
    const wrap = this.el("div","preview-v2");
    const exs = this._draft.exercises;
    const lastSession = (App.state.history||[]).find(s => s.dayId === dayId);

    const exRows = exs.map((ex, i) => {
      const setCount = ex.sets?.length || 0;
      const warmups  = ex.sets?.filter(s=>s.note==="warm-up"||s.isWarmup).length || 0;
      const working  = setCount - warmups;

      // Meta line: best from last session, or program targets if no history.
      // Format is always `reps×weight LBS` for consistency (no "90 sec rest" tag).
      let metaParts = [];
      if (ex.isFinisher) {
        metaParts = [ex.sets[0]?.reps || "Finisher", ex.sets[0]?.note || ""];
      } else {
        const prevEx = lastSession?.exercises?.find(e => e.id === ex.id);
        const best = prevEx?.sets?.reduce((b,s)=>parseFloat(s.weight)>parseFloat(b?.weight||0)?s:b,null);
        if (best && best.weight) {
          metaParts.push(`${best.reps}×${best.weight} lbs`);
        } else if (ex.sets?.[0]) {
          const s0 = ex.sets.find(x => !(x.note==="warm-up"||x.isWarmup)) || ex.sets[0];
          if (s0.weight) metaParts.push(`${s0.reps}×${s0.weight} lbs`);
          else metaParts.push(`${s0.reps} reps`);
        }
      }
      const metaHTML = metaParts.filter(Boolean).map((p,idx)=>
        idx>0 ? `<span class="dot-sep">·</span>${p}` : p
      ).join(" ");

      const finisherCls = ex.isFinisher ? " ex-row-finisher" : "";

      // Single editable row — grip + name/meta + set chip + subtle delete
      const setChip = ex.isFinisher
        ? `<div class="ex-row-finbadge">FINISHER</div>`
        : `<div class="set-chip" role="group" aria-label="Set count">
            <button class="set-chip-btn" onclick="event.stopPropagation();UI._draftAdjustSets(${i},-1)" ${working<=1?"disabled":""} aria-label="Fewer sets">−</button>
            <span class="set-chip-val">${working}<small>${working===1?"set":"sets"}</small></span>
            <button class="set-chip-btn" onclick="event.stopPropagation();UI._draftAdjustSets(${i},1)" ${working>=8?"disabled":""} aria-label="More sets">+</button>
          </div>`;

      return `<div class="ex-row-v2 editing${finisherCls}" data-idx="${i}">
          <div class="ex-grip">
            <span></span><span></span><span></span>
          </div>
          <div class="ex-row-main">
            <div class="ex-row-name">${ex.name}</div>
            <div class="ex-row-meta">${metaHTML}</div>
          </div>
          ${setChip}
          <button class="ex-row-trash" onclick="UI._draftRemove(${i})" aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </div>`;
    }).join("") || `<div style="color:var(--sub);font-size:14px;padding:16px 0">${d.title}</div>`;

    wrap.innerHTML = `
      <div class="prev-header">
        <button class="prev-back" onclick="UI._exitPreview()">← Back</button>
        <div class="prev-title-row">
          <div class="prev-title">${d.title}</div>
          <button class="prev-tool-add" onclick="UI._draftAdd()">
            <svg width="11" height="11" viewBox="0 0 11 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><path d="M5.5 1v9M1 5.5h9"/></svg>
            Exercise
          </button>
        </div>
      </div>

      <div class="prev-list">${exRows}</div>

      <div class="prev-bottom">
        <div class="prev-past-row">
          <label class="prev-past-label" for="preview-date">Log for past date</label>
          <input type="date" id="preview-date" class="prev-date-input"
            value="${UI._today()}" max="${UI._today()}">
        </div>
        <button class="prev-start-btn" onclick="UI._startFromPreview('${dayId}')">
          Start Workout
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </button>
      </div>
    `;
    this.root.innerHTML = "";
    document.getElementById("bottom-nav")?.remove();
    this.root.appendChild(wrap);
    this._nav();

    // Always attach drag listeners — single editable view
    this._attachDragListeners();
  },

  // Must be called after the preview list is in the DOM.
  // Attaches touchstart with passive:false to every grip handle so
  // e.preventDefault() actually works and doesn't fight iOS scroll.
  _attachDragListeners() {
    document.querySelectorAll(".ex-grip").forEach((grip, gi) => {
      // Get data-idx from the parent row
      const row = grip.closest(".ex-row-v2[data-idx]");
      if (!row) return;
      const idx = parseInt(row.getAttribute("data-idx"), 10);
      grip.addEventListener("touchstart", (e) => {
        this._exDragStart(e, idx);
      }, { passive: false });
    });
  },

  _setDraftEdit(state) {
    this._draftEditing = state;
    const d = PROGRAM[this._draft.dayId];
    const cw = getCurrentWeek();
    const pid = d.phaseId || WEEKS[cw]?.phaseId || "strength";
    this._renderPreview(this._draft.dayId, d, cw, pid);
  },

  _dismissEditHint() {
    this._editHintDismissed = true;
    document.querySelector(".ex-edit-hint")?.remove();
  },

  // ── Swipe-to-delete on edit rows ─────────────────────────────────────────
  _exSwipeStart(e, idx) {
    const t = e.touches?.[0]; if (!t) return;
    this._swipe = { idx, startX: t.clientX, startY: t.clientY, dx: 0, locked: null };
  },
  _exSwipeMove(e, idx) {
    if (!this._swipe || this._swipe.idx !== idx) return;
    const t = e.touches?.[0]; if (!t) return;
    const dx = t.clientX - this._swipe.startX;
    const dy = t.clientY - this._swipe.startY;
    // Lock direction after a few px so vertical scroll still works
    if (this._swipe.locked === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this._swipe.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
    }
    if (this._swipe.locked !== "h") return;
    e.preventDefault?.();
    this._swipe.dx = Math.min(0, Math.max(dx, -80)); // only allow leftward, cap at -80
    const row = document.querySelector(`.ex-row-v2[data-idx="${idx}"]`);
    if (row) row.style.transform = `translateX(${this._swipe.dx}px)`;
  },
  _exSwipeEnd(e, idx) {
    if (!this._swipe || this._swipe.idx !== idx) return;
    const row = document.querySelector(`.ex-row-v2[data-idx="${idx}"]`);
    if (!row) { this._swipe = null; return; }
    const dx = this._swipe.dx;
    // Clear any previously-swiped sibling
    document.querySelectorAll(".ex-row-v2.swiped").forEach(r => {
      if (r !== row) { r.classList.remove("swiped"); r.style.transform = ""; }
    });
    row.style.transition = "transform .2s ease";
    if (dx < -40) {
      row.classList.add("swiped");
      row.style.transform = "translateX(-72px)";
    } else {
      row.classList.remove("swiped");
      row.style.transform = "";
    }
    setTimeout(() => { if (row) row.style.transition = ""; }, 220);
    this._swipe = null;
  },

  // ── Drag-to-reorder via the grip handle ──────────────────────────────────
  _exDragStart(e, idx) {
    e.stopPropagation?.();
    const t = e.touches?.[0]; if (!t) return;
    e.preventDefault?.();
    const rowEl = document.querySelector(`.ex-row-v2[data-idx="${idx}"]`);
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    const rowH = rect.height + 6; // gap
    const siblings = Array.from(document.querySelectorAll(".prev-list .ex-row-v2[data-idx]"))
      .filter(el => el !== rowEl);
    this._drag = {
      idx, startY: t.clientY, currentIdx: idx, rowH, rowEl, siblings,
      pendingDy: 0, pendingIdx: idx, raf: null
    };

    // Promote dragged row to its own layer (hardware-accelerated)
    rowEl.style.zIndex = "10";
    rowEl.style.boxShadow = "0 8px 24px rgba(0,0,0,.5)";
    rowEl.style.opacity = "0.95";
    rowEl.style.willChange = "transform";
    rowEl.style.transform = "translate3d(0,0,0)";

    // Pre-promote siblings to GPU layers with smooth transitions for shifts
    siblings.forEach(sib => {
      sib.style.willChange = "transform";
      sib.style.transition = "transform 0.16s cubic-bezier(.2,.7,.3,1)";
      sib.style.transform = "translate3d(0,0,0)";
    });
    if (navigator.vibrate) navigator.vibrate(15);

    const applyFrame = () => {
      if (!this._drag) return;
      this._drag.raf = null;
      const { pendingDy, pendingIdx } = this._drag;
      // Move dragged row
      this._drag.rowEl.style.transform = `translate3d(0,${pendingDy}px,0)`;
      // Shift siblings only when the slot changes
      if (pendingIdx !== this._drag.currentIdx) {
        const fromIdx = this._drag.idx;
        const toIdx = pendingIdx;
        this._drag.siblings.forEach(sib => {
          const sIdx = parseInt(sib.getAttribute("data-idx"), 10);
          let shift = 0;
          if (fromIdx < toIdx) {
            if (sIdx > fromIdx && sIdx <= toIdx) shift = -rowH;
          } else if (fromIdx > toIdx) {
            if (sIdx >= toIdx && sIdx < fromIdx) shift = rowH;
          }
          sib.style.transform = shift
            ? `translate3d(0,${shift}px,0)`
            : "translate3d(0,0,0)";
        });
        this._drag.currentIdx = pendingIdx;
        if (navigator.vibrate) navigator.vibrate(6);
      }
    };

    const onMove = (ev) => {
      const tt = ev.touches?.[0]; if (!tt) return;
      ev.preventDefault();
      if (!this._drag) return;
      const dy = tt.clientY - this._drag.startY;
      const newIdx = Math.max(0, Math.min((this._draft?.exercises?.length || 1)-1,
        this._drag.idx + Math.round(dy / this._drag.rowH)));
      this._drag.pendingDy = dy;
      this._drag.pendingIdx = newIdx;
      // Batch DOM writes into the next animation frame to prevent jitter
      if (!this._drag.raf) this._drag.raf = requestAnimationFrame(applyFrame);
    };
    const onEnd = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      if (!this._drag) return;
      if (this._drag.raf) cancelAnimationFrame(this._drag.raf);
      const { idx: from, currentIdx: to, rowEl: el, siblings: sibs } = this._drag;
      // Reset transient inline styles before re-render
      el.style.transform = ""; el.style.zIndex = ""; el.style.boxShadow = "";
      el.style.opacity = ""; el.style.willChange = "";
      sibs.forEach(s => { s.style.transition = ""; s.style.transform = ""; s.style.willChange = ""; });
      this._drag = null;
      if (from !== to) {
        const exs = this._draft.exercises;
        const [moved] = exs.splice(from, 1);
        exs.splice(to, 0, moved);
        const d = PROGRAM[this._draft.dayId];
        const cw = getCurrentWeek();
        const pid = d.phaseId || WEEKS[cw]?.phaseId || "strength";
        this._renderPreview(this._draft.dayId, d, cw, pid);
      }
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  },

  _exitPreview() {
    this._draft = null;
    this._draftEditing = false;
    this.nav("picker");
  },

  _toggleDraftEdit() {
    this._draftEditing = !this._draftEditing;
    const d = PROGRAM[this._draft.dayId];
    const cw = getCurrentWeek();
    const wd = WEEKS[cw] || {};
    const pid = d.phaseId || wd.phaseId || "strength";
    this._renderPreview(this._draft.dayId, d, cw, pid);
  },

  _draftMove(i, dir) {
    const exs = this._draft.exercises;
    const ni = i+dir;
    if (ni<0||ni>=exs.length) return;
    [exs[i], exs[ni]] = [exs[ni], exs[i]];
    const d = PROGRAM[this._draft.dayId];
    const cw = getCurrentWeek();
    const pid = d.phaseId || WEEKS[cw]?.phaseId || "strength";
    this._renderPreview(this._draft.dayId, d, cw, pid);
  },

  _draftRemove(i) {
    if (this._draft.exercises.length <= 1) { this._toast("Can't remove the last exercise"); return; }
    this._draft.exercises.splice(i, 1);
    const d = PROGRAM[this._draft.dayId];
    const cw = getCurrentWeek();
    const pid = d.phaseId || WEEKS[cw]?.phaseId || "strength";
    this._renderPreview(this._draft.dayId, d, cw, pid);
  },

  _draftAdjustSets(i, delta) {
    const ex = this._draft.exercises[i];
    if (!ex || ex.isFinisher) return;
    const working = (ex.sets||[]).filter(s => !(s.note==="warm-up"||s.isWarmup));
    if (delta > 0 && working.length < 8) {
      // Clone the last working set
      const tmpl = working[working.length-1] || ex.sets[ex.sets.length-1] || {reps:8,weight:0};
      ex.sets.push({
        reps: tmpl.reps,
        weight: tmpl.weight,
        note: tmpl.note && tmpl.note !== "warm-up" ? tmpl.note : undefined
      });
    } else if (delta < 0 && working.length > 1) {
      // Remove the LAST working set (preserve warmups, which are typically first)
      for (let k = ex.sets.length - 1; k >= 0; k--) {
        if (!(ex.sets[k].note === "warm-up" || ex.sets[k].isWarmup)) {
          ex.sets.splice(k, 1);
          break;
        }
      }
    }
    const d = PROGRAM[this._draft.dayId];
    const cw = getCurrentWeek();
    const pid = d.phaseId || WEEKS[cw]?.phaseId || "strength";
    this._renderPreview(this._draft.dayId, d, cw, pid);
  },

  _draftAdd() {
    // Open the add-exercise sheet against the draft (not a live session)
    this._draftAddOpen = true;
    this._openAddEx(false);
  },

  _startFromPreview(dayId) {
    // Pick up date from preview page if set
    const previewDate = document.getElementById("preview-date")?.value;
    if (previewDate) {
      const el = document.createElement("input");
      el.id = "log-past-date"; el.type = "date"; el.value = previewDate;
      el.style.display = "none";
      document.body.appendChild(el);
    }
    this.startDay(dayId);
  },

  // ── START ─────────────────────────────────────────────────────────────────
  async startDay(dayId) {
    document.getElementById("bottom-nav")?.remove();

    // Show a 3-2-1 countdown with a motivating phrase while we fetch last session
    const phrases = [
      ["Let's get to work", ""],
      ["Time to train", ""],
      ["Make it count", ""],
      ["Lock in", ""],
      ["Let's go", ""],
      ["Eyes on the bar", ""],
      ["Show up strong", ""],
      ["Focus. Breathe. Lift.", ""],
      ["Every set matters", ""],
      ["Today you earn it", ""],
    ];
    const [headline] = phrases[Math.floor(Math.random() * phrases.length)];

    const renderCountdown = (n) => {
      this.root.innerHTML = `<div class="init-loading workout-start-loading">
        <div class="init-loading-inner">
          <div class="init-loading-headline">${headline}</div>
          <div class="workout-countdown">${n > 0 ? n : "GO"}</div>
          <div class="init-loading-spinner"><span></span><span></span><span></span></div>
        </div>
      </div>`;
    };

    renderCountdown(3);
    // Fire the fetch immediately in parallel with countdown
    const fetchPromise = (async () => {
      this._logDate = document.getElementById("preview-date")?.value
                   || document.getElementById("log-past-date")?.value
                   || null;
      const today = this._today();
      if (this._logDate === today) this._logDate = null;
      App.state.activeDay = dayId;
      this._sessionStartTime = Date.now();
      const session = App.newSession(dayId);
      const last = await App.fetchLastSession(dayId);
      App.state.lastSession = last;
      return { session, last };
    })();

    // Tick down visually
    await new Promise(r => setTimeout(r, 600));
    renderCountdown(2);
    await new Promise(r => setTimeout(r, 600));
    renderCountdown(1);
    await new Promise(r => setTimeout(r, 600));
    renderCountdown(0);
    await new Promise(r => setTimeout(r, 400));

    const { session, last } = await fetchPromise;
    App.state.lastSession = last;
    App.state.session = App.applyLastSession(session, last);

    // If the user edited the draft on the preview page, merge it with the
    // applyLastSession output so prev-session weights are preserved for
    // exercises the user kept. New exercises (added in the draft) are taken
    // straight from the draft. Order follows the draft.
    if (this._draft && this._draft.dayId === dayId) {
      const enrichedById = {};
      App.state.session.exercises.forEach(ex => { enrichedById[ex.id] = ex; });
      const merged = this._draft.exercises.map(dEx => {
        const enriched = enrichedById[dEx.id];
        // If the exercise was already in the program AND the user didn't
        // change its set count, keep the enriched (last-session-merged) version
        if (enriched && !dEx.isFinisher) {
          const draftWorking = (dEx.sets||[]).filter(s=>!(s.note==="warm-up"||s.isWarmup)).length;
          const enrichedWorking = (enriched.sets||[]).filter(s=>!s.isWarmup).length;
          if (draftWorking === enrichedWorking) {
            return enriched;
          }
          // User changed set count — start from enriched but resize the
          // working-set list to match the draft count
          const out = {...enriched, sets: [...enriched.sets]};
          const warmups = out.sets.filter(s=>s.isWarmup);
          const working = out.sets.filter(s=>!s.isWarmup);
          while (working.length < draftWorking) {
            const last = working[working.length-1] || {reps:8, weight:0};
            working.push({...last, logged:false, excluded:false, claimed:{}});
          }
          while (working.length > draftWorking) {
            working.pop();
          }
          out.sets = [...warmups, ...working];
          return out;
        }
        // New exercise or finisher — use the draft entry as-is
        return {...dEx, sets: (dEx.sets||[]).map(s=>({...s}))};
      });
      App.state.session.exercises = merged;
      this._draft = null;
      this._draftEditing = false;
    } else if (!PROGRAM[dayId]?.sportOnly) {
      App.state.session.exercises.push({
        id: "cardio_finisher",
        name: "Incline Walk Finisher",
        isFinisher: true,
        sets: [{
          reps: "15 min",
          weight: 0,
          note: "12% incline · 3.0–3.5 mph"
        }]
      });
    }

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

    const day = PROGRAM[activeDay] || {};

    const wrap = document.createElement("div");
    wrap.id = "session-wrap";

    wrap.innerHTML = `
      <!-- ① Compact header: PROGRAM | EXERCISE NAME · dots · target | END -->
      <div class="sess-header" id="sess-header">
        <div class="sess-hdr-row">
          <button class="sess-icon-btn" id="sess-prog-btn" onclick="UI._toggleDrawer()" aria-label="Program">
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="0" y1="2" x2="20" y2="2"/><line x1="0" y1="8" x2="14" y2="8"/><line x1="0" y1="14" x2="9" y2="14"/></svg>
          </button>
          <div class="sess-hdr-center">
            <button class="sess-ex-name" id="sess-ex-name"
              ontouchstart="UI._lpStart(event)" ontouchend="UI._lpEnd()" ontouchmove="UI._lpEnd()"
              oncontextmenu="event.preventDefault();UI._showExMenu()">—</button>
            <div class="sess-dots-row" id="sess-dots-row"></div>
          </div>
          <button class="sess-icon-btn sess-icon-end" onclick="UI._confirmEnd()" aria-label="End workout">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="12" height="12" rx="1.5"/></svg>
          </button>
        </div>
      </div>

      <!-- ② Focused logging zone — set context list for current exercise -->
      <div class="sess-focus" id="sess-focus">
        <div class="sf-set-list" id="sf-set-list"></div>
      </div>

      <!-- Exercise queue scroll strip -->
      <div class="sess-queue" id="sess-queue"></div>

      <!-- Thin rest progress bar — only visible during rest, above action row -->
      <div id="rest-progress-bar"><div id="rest-progress-fill"></div></div>

      <!-- ③ Action row: SKIP + LOG. During rest, the SKIP becomes the rest pill. -->
      <div class="sf-action-row" id="sf-action-row">
        <button class="sf-skip-btn" id="sf-skip-btn" onclick="UI._skipCurrentSet()">SKIP</button>
        <div class="sf-rest-pill" id="sf-rest-pill" style="display:none">
          <div class="sf-rest-time-block">
            <span class="sf-rest-label" id="rest-banner-label">REST</span>
            <span class="sf-rest-time" id="rest-banner-time">1:30</span>
          </div>
          <div class="sf-rest-adj">
            <button onclick="UI._adjRest(-30)">−30s</button>
            <button onclick="UI._adjRest(30)">+30s</button>
          </div>
        </div>
        <button class="sf-log-btn" id="sess-save-btn" onclick="UI._tapCurrentSetDone()">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l5 5 7-8"/></svg>
          LOG SET
        </button>
      </div>

      <!-- ⑤ Program drawer (slides down from top) -->
      <div id="prog-drawer">
        <div class="drawer-header">
          <div>
            <div class="drawer-title">TODAY</div>
            <div class="drawer-day-name" id="drawer-day-name">${day.title || ''}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="drawer-end-btn" onclick="UI._confirmEnd();UI._closeDrawer()">END WORKOUT</button>
            <button class="drawer-close-btn" onclick="UI._closeDrawer()">✕</button>
          </div>
        </div>
        <div class="drawer-ex-list" id="drawer-ex-list"></div>
      </div>
    `;

    this.root.appendChild(wrap);
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
    this._updateDrawer();
  },

  // Tap the Done button — marks current set done
  _tapCurrentSetDone() {
    const ei = this._activeExIdx;
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const si = ex.sets.findIndex(s=>!s.logged&&!s.excluded);
    if (si >= 0) {
      this._tapDone(ei, si);
    } else {
      // All sets done on this exercise — bottom action
      this._bottomAction();
    }
  },

  // Render the full set context for the current exercise
  _updateFocusView() {
    const ei = this._activeExIdx;
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) return;

    const si = ex.sets.findIndex(s=>!s.logged&&!s.excluded);
    const wSets = ex.sets.filter(x=>!x.isWarmup&&!x.excluded);
    const setBtn = document.getElementById("sess-save-btn");
    const listEl = document.getElementById("sf-set-list");
    if (!listEl) return;

    // ── All sets done ─────────────────────────────────────────────────────
    if (si < 0) {
      // Compact summary of what was actually done — warmups separated, working sets prominent
      const wDone = ex.sets.filter(s => !s.isWarmup && !s.excluded && s.logged);
      const warmDone = ex.sets.filter(s => s.isWarmup && !s.excluded && s.logged);
      const totalVol = wDone.reduce((sum, s) =>
        sum + (parseInt(s.reps)||0) * (parseFloat(s.weight)||0), 0);
      const isPR = wDone.some(s => {
        const cur = parseFloat(s.weight)||0;
        const prev = parseFloat(s.prev?.weight)||0;
        return prev > 0 && cur > prev;
      });

      const rows = [];
      if (warmDone.length) {
        rows.push(`<div class="sf-done-row sf-done-row-warm">
          <span class="sf-done-w">W</span>
          <span class="sf-done-data">${warmDone.length} warm-up${warmDone.length===1?"":"s"}</span>
        </div>`);
      }
      wDone.forEach((s, i) => {
        const cur = parseFloat(s.weight)||0;
        const prev = parseFloat(s.prev?.weight)||0;
        const pr = prev > 0 && cur > prev;
        rows.push(`<div class="sf-done-row${pr?" sf-done-row-pr":""}">
          <span class="sf-done-num">${i+1}</span>
          <span class="sf-done-data">${s.reps}<span class="sf-done-x">×</span>${s.weight}<span class="sf-done-unit">lbs</span></span>
          ${pr ? `<span class="sf-done-pr">PR</span>` : `<span class="sf-done-tick">✓</span>`}
        </div>`);
      });

      listEl.innerHTML = `<div class="sf-done-wrap">
        <div class="sf-done-list">${rows.join("")}</div>
        <div class="sf-done-stats">
          <span class="sf-done-stat-val">${Math.round(totalVol).toLocaleString()}</span>
          <span class="sf-done-stat-lbl">lbs moved</span>
        </div>
        <div class="sf-done-hero">
          <div class="sf-done-check${isPR?" sf-done-check-pr":""}">✓</div>
          <div class="sf-done-label">${isPR ? "Personal best" : "All sets done"}</div>
        </div>
      </div>`;
      if (setBtn) {
        const allDone = App.state.session.exercises.every(e=>e.sets.filter(s=>!s.excluded).every(s=>s.logged));
        const next = App.state.session.exercises.findIndex((e,i)=>i>ei&&!e.sets.filter(s=>!s.excluded).every(s=>s.logged));
        setBtn.classList.add("ready");
        if (allDone) { setBtn.innerHTML = 'FINISH WORKOUT'; setBtn.onclick = ()=>UI._confirmFinish(); }
        else if (next>=0) { setBtn.innerHTML = `NEXT: ${App.state.session.exercises[next].name} →`; setBtn.onclick = ()=>UI._bottomAction(); }
        else { setBtn.innerHTML = 'FINISH WORKOUT'; setBtn.onclick = ()=>UI._confirmFinish(); }
      }
      // Hide SKIP — no active set to skip
      const skipBtn2 = document.getElementById("sf-skip-btn");
      if (skipBtn2) skipBtn2.style.display = "none";
      return;
    }

    // ── Active set ────────────────────────────────────────────────────────
    const s = ex.sets[si];
    this._claimSet(ei, si);
    this._focusEi = ei;
    this._focusSi = si;

    const r = s.claimed?.reps   ?? s.reps;
    const w = s.claimed?.weight ?? s.weight;
    const isWarm = s.isWarmup;

    // Build rows for each set in this exercise (excluding excluded ones)
    const activeSets = ex.sets.filter(x=>!x.excluded);
    const rows = activeSets.map((set, aidx) => {
      const isWarmSet = set.isWarmup;
      const wIdx = isWarmSet ? null : wSets.indexOf(set);
      const numLabel = isWarmSet ? "W" : String(wIdx+1);

      if (set.logged) {
        // ── DONE row — tappable to un-log and re-edit ──
        return `<div class="sf-row sf-row-done" onclick="UI._unlockSet(${activeSets.indexOf(set)})" title="Tap to edit">
          <span class="sf-row-num">${numLabel}</span>
          <span class="sf-row-data">${set.claimed?.reps??set.reps}<span class="sf-row-x">×</span>${set.claimed?.weight??set.weight}<span class="sf-row-unit">lbs</span></span>
          <span class="sf-row-edit">✎</span>
        </div>`;
      }

      if (set === s) {
        // ── CURRENT — prominent set label + big input ──
        const rVal = s.claimed?.reps   ?? s.reps;
        const wVal = s.claimed?.weight ?? s.weight;
        const setLabel = isWarm
          ? "WARM-UP"
          : (wTot > 1 ? `SET ${wDone + 1} OF ${wTot}` : "SET 1");
        return `<div class="sf-row sf-row-current">
          <div class="sf-current-block">
            <div class="sf-current-set-label">${setLabel}</div>
            <div class="sf-big-row">
              <div class="sf-field">
                <span class="sf-field-label">REPS</span>
                <div class="sf-field-row">
                  <span class="sf-big-num" id="sf-reps">${rVal}</span>
                  <div class="sf-steppers">
                    <button class="sf-step-btn" onclick="UI._focusStep('reps',-1)">−</button>
                    <button class="sf-step-btn" onclick="UI._focusStep('reps',1)">+</button>
                  </div>
                </div>
              </div>
              <div class="sf-field">
                <span class="sf-field-label">LBS</span>
                <div class="sf-field-row">
                  <span class="sf-big-num" id="sf-weight">${wVal}</span>
                  <div class="sf-steppers">
                    <button class="sf-step-btn" onclick="UI._focusStep('weight',-1)">−</button>
                    <button class="sf-step-btn" onclick="UI._focusStep('weight',1)">+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      }

      // ── UPCOMING row ──
      const upR = set.prev?.reps   ?? set.reps;
      const upW = set.prev?.weight ?? set.weight;
      return `<div class="sf-row sf-row-up">
        <span class="sf-row-num">${numLabel}</span>
        <span class="sf-row-data sf-row-data-up">${upR}<span class="sf-row-x">×</span>${upW}<span class="sf-row-unit">lbs</span></span>
      </div>`;
    }).join("");

    listEl.innerHTML = rows;

    // Log button + SKIP visibility
    if (setBtn) {
      setBtn.classList.remove("ready");
      setBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l5 5 7-8"/></svg>${isWarm ? "LOG WARM-UP" : "LOG SET"}`;
      setBtn.onclick = ()=>UI._tapCurrentSetDone();
    }
    // SKIP is useful for active sets. Show it whenever there's an active set.
    // Restore if the rest pill is not currently showing.
    const skipBtn = document.getElementById("sf-skip-btn");
    const restPill = document.getElementById("sf-rest-pill");
    const restActive = restPill && restPill.style.display !== "none";
    if (skipBtn) skipBtn.style.display = restActive ? "none" : "";
  },

  // Un-log a previously logged set so it can be re-edited.
  // `aidx` is the index within activeSets (excludes excluded sets).
  _unlockSet(aidx) {
    const ei = this._activeExIdx;
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const activeSets = ex.sets.filter(s=>!s.excluded);
    const set = activeSets[aidx];
    if (!set || !set.logged) return;

    // Un-log it
    set.logged = false;
    // Clear claimed so it shows the original target values
    delete set.claimed;

    // Stop any rest timer (we're going back to edit mode)
    this._stopRest();

    // Rebuild the view
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();

    // Haptic nudge
    if (navigator.vibrate) navigator.vibrate(10);
  },

  _focusStep(field, dir) {
    const ei = this._focusEi ?? this._activeExIdx;
    const si = this._focusSi;
    if (si === undefined || si < 0) return;
    this._step(ei, si, field, dir);
    // Reflect in big numbers
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s) return;
    const id = field === "reps" ? "sf-reps" : "sf-weight";
    const el = document.getElementById(id);
    if (el) el.textContent = s.claimed?.[field] ?? (field==="reps"?s.reps:s.weight);
  },

  // Horizontal exercise queue pill strip
  _updateQueue() {
    const queue = document.getElementById("sess-queue");
    if (!queue) return;
    const exs = App.state.session?.exercises || [];
    const ei  = this._activeExIdx;
    queue.innerHTML = exs.map((ex,i) => {
      const allDone = ex.sets.filter(s=>!s.excluded).every(s=>s.logged);
      const partial  = !allDone && ex.sets.some(s=>s.logged);
      const isCur    = i === ei;
      return `<button class="sq-pill ${isCur?"sq-active":allDone?"sq-done":partial?"sq-partial":""}"
        onclick="UI._goTo(${i})">${ex.name}</button>`;
    }).join("");
    // Scroll active pill into view
    const active = queue.querySelector(".sq-active");
    if (active) active.scrollIntoView({ inline:"center", behavior:"smooth" });
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
        const ei2 = i;
        return `<div class="ex-block active" id="exb-${i}">
          <div class="ex-active-head">
            <button class="ex-manage-btn" onclick="UI._showExMenu()" title="Reorder / swap / remove">⋮</button>
          </div>
          ${ex.sets.map((_,si) => this._setRowHTML(i,si)).join("")}
          <button class="ex-add-set-btn" onclick="UI._addSet(${i})">+ Add set</button>
        </div>`;
      }

      const dot = allDone ? "done-muted" : partial ? "partial" : "untouched";
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

  // Rebuild after set actions — refresh focused view
  _rebuildActive() {
    this._updateFocusView();
    this._updateQueue();
    this._updateDrawer();
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

  // Uncheck a done set (via the done-collapsed row in the set list within focus view)
  _uncollapseDone(ei, si) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s) return;
    s.logged = false;
    this._stopRest();
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
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

  _scrollToActive(instant) {
    const body = document.getElementById("sess-body");
    if (!body) return;
    const ei = this._activeExIdx;
    // Scroll so the active exercise block is flush at the top of the body viewport
    const exb = document.getElementById(`exb-${ei}`);
    if (!exb) return;
    // Use scrollTop directly for instant snap, smooth for auto-advance
    const targetScrollTop = exb.offsetTop;
    if (instant) {
      body.scrollTop = targetScrollTop;
    } else {
      body.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  },

  _updateHeader() {
    const ei  = this._activeExIdx;
    const ex  = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const wDone = ex.sets.filter(s=>!s.isWarmup&&s.logged).length;
    const wTot  = ex.sets.filter(s=>!s.isWarmup&&!s.excluded).length;

    const nameEl = document.getElementById("sess-ex-name");
    if (nameEl) nameEl.textContent = ex.name;

    // Find current (next unlogged) set to show type badge + target
    const si = ex.sets.findIndex(s=>!s.logged&&!s.excluded);
    const curSet = si >= 0 ? ex.sets[si] : null;
    const isWarmup = curSet?.isWarmup;
    const prevR = curSet?.prev?.reps   ?? curSet?.reps;
    const prevW = curSet?.prev?.weight ?? curSet?.weight;

    // Dots + set counter — no target chip (that's shown in the set list)
    const dotsEl = document.getElementById("sess-dots-row");
    if (dotsEl) {
      const activeSets = ex.sets.filter(s=>!s.excluded);
      if (activeSets.length === 0) {
        dotsEl.style.display = "none";
      } else {
        dotsEl.style.display = "flex";
        const firstUndone = activeSets.findIndex(x=>!x.logged);
        const dotsHtml = activeSets.map((s,i) => {
          if (s.isWarmup) return `<span class="sdot sdot-warm"></span>`;
          if (s.logged)   return `<span class="sdot sdot-done"></span>`;
          if (i === firstUndone) return `<span class="sdot sdot-next"></span>`;
          return `<span class="sdot sdot-up"></span>`;
        }).join("");
        const typeHtml = isWarmup
          ? `<span class="sess-set-label">WARM-UP</span>`
          : (si >= 0 ? `<span class="sess-set-label">SET ${wDone+1} / ${wTot}</span>` : `<span class="sess-set-label">${wTot} / ${wTot} DONE</span>`);
        dotsEl.innerHTML = dotsHtml + typeHtml;
      }
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
    this._activeExIdx = ei;
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
    this._updateDrawer();
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

  _flashSaved() {
    const row = document.getElementById("sf-action-row");
    if (!row) return;
    row.classList.remove("flash-saved");
    // Force reflow to restart animation
    void row.offsetWidth;
    row.classList.add("flash-saved");
    setTimeout(()=>row.classList.remove("flash-saved"), 700);
  },

  _tapDone(ei, si) {
    const s = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!s || s.excluded) return;

    this._claimSet(ei, si);
    s.logged = !s.logged;
    if (s.logged && s.claimed) {
      if (s.claimed.reps   !== undefined) s.reps   = s.claimed.reps;
      if (s.claimed.weight !== undefined) s.weight = s.claimed.weight;
    }

    // Pre-claim the next unlogged set
    const ex = App.state.session.exercises[ei];
    const nextSi = ex.sets.findIndex(s=>!s.logged&&!s.excluded);
    if (nextSi >= 0) this._claimSet(ei, nextSi);

    this._updateHeader();

    if (s.logged) {
      this._flashSaved();
      const allDone = ex.sets.filter(s=>!s.excluded).every(s=>s.logged);
      if (!allDone) {
        this._startRest(this._parseRest(ex.rest));
        this._updateFocusView();
        this._updateQueue();
        this._updateDrawer();
      } else {
        this._stopRest();
        this._updateFocusView();
        this._updateQueue();
        this._updateDrawer();
      }
    } else {
      this._stopRest();
      this._updateFocusView();
      this._updateQueue();
      this._updateDrawer();
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
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
  },

  _delSet(ei, si) {
    const ex = App.state.session?.exercises?.[ei];
    if (!ex || ex.sets.length <= 1) { this._toast("Can't remove last set"); return; }
    ex.sets.splice(si, 1);
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
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

  // ── REST TIMER (full-screen ring) ─────────────────────────────────────────
  _parseRest(s) {
    if (!s) return 90;
    const m=s.match(/(\d+)\s*min/i); if(m) return parseInt(m[1])*60;
    const c=s.match(/(\d+)\s*sec/i); if(c) return parseInt(c[1]);
    const n=parseInt(s); return isNaN(n)?90:n;
  },

  _fmtTime(sec) {
    const abs = Math.abs(sec);
    const m = Math.floor(abs/60);
    const s = abs % 60;
    return m > 0 ? `${m}:${String(s).padStart(2,"0")}` : `${abs}s`;
  },

  _startRest(sec) {
    this._stopRest();
    this._restTarget  = Date.now() + sec*1000;
    this._restTotal   = sec;
    this._restStarted = true;
    this._restOver    = false;

    // Swap action row into rest mode: hide SKIP button, show rest pill
    const skipBtn = document.getElementById("sf-skip-btn");
    const pill    = document.getElementById("sf-rest-pill");
    const progBar = document.getElementById("rest-progress-bar");
    if (skipBtn) skipBtn.style.display = "none";
    if (pill)    pill.style.display = "flex";
    if (progBar) progBar.classList.add("active");

    const tick = () => {
      const raw  = (this._restTarget - Date.now()) / 1000;
      const rem  = Math.ceil(raw);
      const timeEl = document.getElementById("rest-banner-time");
      const labelEl = document.getElementById("rest-banner-label");
      const fillEl = document.getElementById("rest-progress-fill");
      const pillEl = document.getElementById("sf-rest-pill");

      if (!timeEl) return;

      if (rem > 0) {
        const pct = Math.max(0, Math.min(1, raw / this._restTotal));
        timeEl.textContent = this._fmtTime(rem);
        if (labelEl) labelEl.textContent = "REST";
        if (fillEl) fillEl.style.width = `${pct * 100}%`;
        if (pillEl) pillEl.classList.remove("overtime");
        const pb = document.getElementById("rest-progress-bar");
        if (pb) pb.classList.remove("overtime");
      } else {
        if (!this._restOver) {
          this._restOver = true;
          if (navigator.vibrate) navigator.vibrate([150,80,150]);
        }
        const over = Math.abs(Math.floor(raw));
        timeEl.textContent = `+${this._fmtTime(over)}`;
        if (labelEl) labelEl.textContent = "OVER";
        if (fillEl) fillEl.style.width = "100%";
        if (pillEl) pillEl.classList.add("overtime");
        const pb = document.getElementById("rest-progress-bar");
        if (pb) pb.classList.add("overtime");
      }
    };
    tick();
    this._restTimer = setInterval(tick, 200);
  },

  _stopRest() {
    if (this._restTimer) { clearInterval(this._restTimer); this._restTimer = null; }
    this._restStarted = false;
    this._restOver    = false;
    const skipBtn = document.getElementById("sf-skip-btn");
    const pill    = document.getElementById("sf-rest-pill");
    const progBar = document.getElementById("rest-progress-bar");
    if (skipBtn) skipBtn.style.display = "";
    if (pill)    { pill.style.display = "none"; pill.classList.remove("overtime"); }
    if (progBar) { progBar.classList.remove("active"); progBar.classList.remove("overtime"); }
  },

  _adjRest(d) {
    if (!this._restTarget) return;
    this._restTarget += d*1000;
    this._restTotal = Math.max(1, this._restTotal + d);
  },

  _skipRest() {
    this._stopRest();
    this._updateFocusView();
  },

  _updateRestUpNext() {
    const el = document.getElementById("rest-upnext");
    if (!el) return;
    const ei = this._activeExIdx;
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) { el.textContent = ""; return; }

    // Within current exercise — show set and target
    const nextSi = ex.sets.findIndex(s=>!s.logged&&!s.excluded);
    const wSets  = ex.sets.filter(x=>!x.isWarmup&&!x.excluded);

    if (nextSi >= 0) {
      const s = ex.sets[nextSi];
      const wIdx = s.isWarmup ? null : wSets.indexOf(s);
      const setStr = s.isWarmup ? "Warm-up" : `Set ${wIdx+1} of ${wSets.length}`;
      const r = s.claimed?.reps   ?? s.prev?.reps   ?? s.reps;
      const w = s.claimed?.weight ?? s.prev?.weight ?? s.weight;
      el.textContent = `${setStr} · ${r} reps × ${w} lbs`;
    } else {
      // Moving to next exercise — show name + first set target so plates can be prepped
      const nextEx = App.state.session?.exercises?.[ei+1];
      if (nextEx) {
        const nSets = nextEx.sets.filter(x=>!x.isWarmup&&!x.excluded).length;
        // First working set's target (skip warmups for the prep number)
        const firstWork = nextEx.sets.find(s=>!s.isWarmup&&!s.excluded);
        const r = firstWork?.prev?.reps   ?? firstWork?.reps;
        const w = firstWork?.prev?.weight ?? firstWork?.weight;
        const target = (r && w) ? ` · ${r} reps × ${w} lbs` : (r ? ` · ${r} reps` : "");
        el.textContent = `${nextEx.name} — ${nSets} ${nSets===1?"set":"sets"}${target}`;
      } else {
        el.textContent = "Last set — finishing up!";
      }
    }
  },

  _skipCurrentSet() {
    const ei = this._activeExIdx;
    const ex = App.state.session?.exercises?.[ei];
    if (!ex) return;
    const si = ex.sets.findIndex(s=>!s.logged&&!s.excluded);
    if (si >= 0) this._toggleExclude(ei, si);
  },

  // ── PROGRAM DRAWER ────────────────────────────────────────────────────────
  _toggleDrawer() {
    const d = document.getElementById("prog-drawer");
    if (d) d.classList.toggle("open");
  },

  _closeDrawer() {
    const d = document.getElementById("prog-drawer");
    if (d) d.classList.remove("open");
  },

  _updateDrawer() {
    const el = document.getElementById("drawer-ex-list");
    if (!el) return;
    const exs = App.state.session?.exercises || [];
    const ei  = this._activeExIdx;
    const editing = this._drawerEditing;

    // V2 toolbar
    const editBar = `<div class="drawer-toolbar">
        <div class="prev-tool-segment">
          <button class="prev-tool-btn${!editing?" active":""}" onclick="UI._setDrawerEdit(false)">View</button>
          <button class="prev-tool-btn${editing?" active":""}" onclick="UI._setDrawerEdit(true)">Edit</button>
        </div>
        ${editing ? `<button class="prev-tool-add" onclick="UI._openAddEx(false);UI._closeDrawer()">
          <svg width="11" height="11" viewBox="0 0 11 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><path d="M5.5 1v9M1 5.5h9"/></svg>
          Add
        </button>` : ""}
      </div>`;

    const rows = exs.map((ex, i) => {
      const wDone = ex.sets.filter(s=>!s.isWarmup&&s.logged).length;
      const wTot  = ex.sets.filter(s=>!s.isWarmup&&!s.excluded).length;
      const isCur = i === ei;
      const allDone = wDone === wTot && wTot > 0;
      const curCls = isCur ? " current" : "";
      const finisherCls = ex.isFinisher ? " ex-row-finisher" : "";
      const hereLabel = isCur ? `<span class="ex-row-here">← YOU'RE HERE</span>` : "";

      // Build meta: progress + maybe a target
      let metaParts = [];
      if (ex.isFinisher) {
        metaParts.push(ex.sets[0]?.reps || "Finisher");
      } else {
        if (allDone) metaParts.push(`<span class="meta-done">All done ✓</span>`);
        else metaParts.push(`${wDone}/${wTot} done`);
        // Show next-set target if exercise in progress
        const next = ex.sets.find(s=>!s.logged&&!s.excluded&&!s.isWarmup);
        if (next && next.weight) metaParts.push(`Next: ${next.reps}×${next.weight}`);
      }
      const metaHTML = metaParts.filter(Boolean).map((p,idx)=>
        idx>0 ? `<span class="dot-sep">·</span>${p}` : p
      ).join(" ");

      // VIEW mode — tap to jump
      if (!editing) {
        const progBadge = ex.isFinisher
          ? `<div class="ex-row-finbadge">FINISHER</div>`
          : allDone
            ? `<div class="ex-row-sets-static" style="border-color:rgba(61,255,160,.3);background:rgba(61,255,160,.05);"><span class="val" style="color:var(--green)">✓</span><span class="lbl" style="color:var(--green)">done</span></div>`
            : `<div class="ex-row-sets-static"><span class="val">${wDone}<span style="color:var(--muted);font-size:12px">/${wTot}</span></span><span class="lbl">${wTot===1?"set":"sets"}</span></div>`;
        return `<div class="ex-row-v2 drawer-row${curCls}${finisherCls}" onclick="UI._goTo(${i});UI._closeDrawer()">
          <div class="ex-row-main">
            <div class="ex-row-name">${ex.name}${hereLabel}</div>
            <div class="ex-row-meta">${metaHTML}</div>
          </div>
          ${progBadge}
        </div>`;
      }

      // EDIT mode — grip + set chip + swipe-to-delete
      const undoneWorking = ex.sets.filter(s=>!s.isWarmup&&!s.excluded&&!s.logged).length;
      const setChip = ex.isFinisher
        ? `<div class="ex-row-finbadge">FINISHER</div>`
        : `<div class="set-chip" role="group" aria-label="Set count">
            <button class="set-chip-btn" onclick="event.stopPropagation();UI._sessionAdjustSets(${i},-1)" ${undoneWorking<=0?"disabled":""} aria-label="Fewer sets">−</button>
            <span class="set-chip-val">${wTot}<small>${wTot===1?"set":"sets"}</small></span>
            <button class="set-chip-btn" onclick="event.stopPropagation();UI._sessionAdjustSets(${i},1)" ${wTot>=8?"disabled":""} aria-label="More sets">+</button>
          </div>`;

      return `<div class="ex-row-v2 editing drawer-row${curCls}${finisherCls}" data-didx="${i}">
          <div class="ex-grip" data-dragidx="${i}">
            <span></span><span></span><span></span>
          </div>
          <div class="ex-row-main">
            <div class="ex-row-name">${ex.name}</div>
            <div class="ex-row-meta">${metaHTML}</div>
          </div>
          ${setChip}
          <button class="ex-row-trash" onclick="UI._removeEx(${i})" aria-label="Delete">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 3.5h10M5 3.5V2.2c0-.7.5-1.2 1.2-1.2h1.6c.7 0 1.2.5 1.2 1.2V3.5M3.5 3.5L4 12c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5l.5-8.5M6 6.5v4M8 6.5v4"/></svg>
          </button>
        </div>`;
    }).join("");

    el.innerHTML = editBar + rows;

    // Attach drag listeners imperatively for drawer grips
    if (editing) {
      el.querySelectorAll(".ex-grip[data-dragidx]").forEach(grip => {
        const idx = parseInt(grip.getAttribute("data-dragidx"), 10);
        grip.addEventListener("touchstart", (e) => {
          this._drwDragStart(e, idx);
        }, { passive: false });
      });
    }

    // Update day name
    const dn = document.getElementById("drawer-day-name");
    const day = PROGRAM[App.state.activeDay] || {};
    if (dn) dn.textContent = day.title || "";
  },

  _setDrawerEdit(state) {
    this._drawerEditing = state;
    this._updateDrawer();
  },

  _dismissDrawerHint() {
    this._drawerHintDismissed = true;
    this._updateDrawer();
  },

  // Drawer swipe-to-delete (parallel to preview swipe)
  _drwSwipeStart(e, idx) {
    const t = e.touches?.[0]; if (!t) return;
    this._drwSwipe = { idx, startX: t.clientX, startY: t.clientY, dx: 0, locked: null };
  },
  _drwSwipeMove(e, idx) {
    if (!this._drwSwipe || this._drwSwipe.idx !== idx) return;
    const t = e.touches?.[0]; if (!t) return;
    const dx = t.clientX - this._drwSwipe.startX;
    const dy = t.clientY - this._drwSwipe.startY;
    if (this._drwSwipe.locked === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this._drwSwipe.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
    }
    if (this._drwSwipe.locked !== "h") return;
    e.preventDefault?.();
    this._drwSwipe.dx = Math.min(0, Math.max(dx, -80));
    const row = document.querySelector(`.ex-row-v2[data-didx="${idx}"]`);
    if (row) row.style.transform = `translateX(${this._drwSwipe.dx}px)`;
  },
  _drwSwipeEnd(e, idx) {
    if (!this._drwSwipe || this._drwSwipe.idx !== idx) return;
    const row = document.querySelector(`.ex-row-v2[data-didx="${idx}"]`);
    if (!row) { this._drwSwipe = null; return; }
    const dx = this._drwSwipe.dx;
    document.querySelectorAll(".ex-row-v2.drawer-row.swiped").forEach(r => {
      if (r !== row) { r.classList.remove("swiped"); r.style.transform = ""; }
    });
    row.style.transition = "transform .2s ease";
    if (dx < -40) { row.classList.add("swiped"); row.style.transform = "translateX(-72px)"; }
    else { row.classList.remove("swiped"); row.style.transform = ""; }
    setTimeout(() => { if (row) row.style.transition = ""; }, 220);
    this._drwSwipe = null;
  },

  _drwDragStart(e, idx) {
    e.stopPropagation?.();
    const t = e.touches?.[0]; if (!t) return;
    e.preventDefault?.();
    const wrapEl = document.querySelector(`.ex-swipe-wrap[data-didx="${idx}"]`);
    if (!wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    const rowH = rect.height + 6;
    this._drwDrag = { idx, startY: t.clientY, currentIdx: idx, rowH, wrapEl };
    wrapEl.classList.add("dragging");
    if (navigator.vibrate) navigator.vibrate(15);

    const onMove = (ev) => {
      const tt = ev.touches?.[0]; if (!tt) return;
      ev.preventDefault();
      const dy = tt.clientY - this._drwDrag.startY;
      this._drwDrag.wrapEl.style.transform = `translateY(${dy}px)`;
      const exs = App.state.session?.exercises || [];
      const newIdx = Math.max(0, Math.min(exs.length-1,
        this._drwDrag.idx + Math.round(dy / this._drwDrag.rowH)));
      this._drwDrag.currentIdx = newIdx;
    };
    const onEnd = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      if (!this._drwDrag) return;
      const { idx: from, currentIdx: to } = this._drwDrag;
      this._drwDrag.wrapEl.classList.remove("dragging");
      this._drwDrag.wrapEl.style.transform = "";
      this._drwDrag = null;
      if (from !== to) {
        this._sessionMove(from, to - from);
      }
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  },

  _toggleDrawerEdit() {
    this._drawerEditing = !this._drawerEditing;
    this._updateDrawer();
  },

  // Move an exercise in the live session (different from _moveEx which moves the active one)
  _sessionMove(i, dir) {
    const exs = App.state.session?.exercises;
    if (!exs) return;
    const ni = Math.max(0, Math.min(exs.length - 1, i + dir));
    if (ni === i) return;
    const [moved] = exs.splice(i, 1);
    exs.splice(ni, 0, moved);
    // Track active exercise
    if (this._activeExIdx === i) this._activeExIdx = ni;
    else if (i < this._activeExIdx && ni >= this._activeExIdx) this._activeExIdx--;
    else if (i > this._activeExIdx && ni <= this._activeExIdx) this._activeExIdx++;
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
    this._updateDrawer();
  },

  // Adjust the number of working sets on an exercise mid-workout
  _sessionAdjustSets(i, delta) {
    const ex = App.state.session?.exercises?.[i];
    if (!ex || ex.isFinisher) return;
    const working = ex.sets.filter(s => !s.isWarmup && !s.excluded);
    if (delta > 0 && working.length < 8) {
      // Clone the last working set as a fresh undone set
      const tmpl = working[working.length-1] || ex.sets[ex.sets.length-1] || {reps:8,weight:0};
      ex.sets.push({
        isWarmup: false,
        reps: tmpl.reps,
        weight: tmpl.weight,
        prev: tmpl.prev ? {...tmpl.prev} : {reps:tmpl.reps,weight:tmpl.weight},
        claimed: {},
        logged: false,
        excluded: false
      });
    } else if (delta < 0 && working.length > 0) {
      // Remove the last unlogged working set; if all logged, exclude the last one
      for (let k = ex.sets.length - 1; k >= 0; k--) {
        const s = ex.sets[k];
        if (s.isWarmup || s.excluded) continue;
        if (!s.logged) { ex.sets.splice(k, 1); break; }
      }
      // If we didn't remove anything (all logged), drop the last logged one
      const stillWorking = ex.sets.filter(s => !s.isWarmup && !s.excluded);
      if (stillWorking.length === working.length) {
        for (let k = ex.sets.length - 1; k >= 0; k--) {
          if (!ex.sets[k].isWarmup && !ex.sets[k].excluded) {
            ex.sets.splice(k, 1); break;
          }
        }
      }
    }
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
    this._updateDrawer();
  },
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

  // Closing the exercise picker specifically (clears draft-add flag)
  _closePicker() {
    this._draftAddOpen = false;
    this._swappingEi = undefined;
    this._closeSheet();
  },

  _moveEx(ei, dir) {
    const exs = App.state.session?.exercises;
    const ni = ei+dir;
    if (!exs||ni<0||ni>=exs.length) return;
    [exs[ei],exs[ni]] = [exs[ni],exs[ei]];
    this._activeExIdx = ni;
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
  },

  _removeEx(ei) {
    const exs = App.state.session?.exercises;
    if (!exs||exs.length<=1) { this._toast("Can't remove last exercise"); return; }
    exs.splice(ei,1);
    this._activeExIdx = Math.min(ei, exs.length-1);
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
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
        <button class="ex-picker-back" onclick="UI._closePicker()">✕</button>
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
    // Capture draft-add context BEFORE _closeSheet runs (it can clear state)
    const isDraftAdd = this._draftAddOpen && this._draft;
    this._draftAddOpen = false;
    this._closeSheet();
    const ww = Math.round(((baseline||45)*0.85)/5)*5;
    const newEx = {
      id, name, rest:"90 sec", tip:"", bodyweight:baseline===0,
      sets: Array.from({length:3},()=>({
        isWarmup:false, reps:8, weight:ww,
        prev:{reps:8,weight:ww}, claimed:{}, logged:false, excluded:false
      }))
    };

    // Adding from preview-draft context (no live session yet)
    if (isDraftAdd) {
      // Insert before the finisher if it exists
      const exs = this._draft.exercises;
      const fIdx = exs.findIndex(e=>e.isFinisher);
      if (fIdx >= 0) exs.splice(fIdx, 0, newEx);
      else exs.push(newEx);
      const d = PROGRAM[this._draft.dayId];
      const cw = getCurrentWeek();
      const pid = d.phaseId || WEEKS[cw]?.phaseId || "strength";
      this._renderPreview(this._draft.dayId, d, cw, pid);
      return;
    }

    const { session } = App.state;
    if (!session) return;
    if (this._swappingEi !== undefined) {
      session.exercises[this._swappingEi] = newEx;
      this._swappingEi = undefined;
    } else {
      session.exercises.push(newEx);
      this._activeExIdx = session.exercises.length-1;
    }
    this._updateFocusView();
    this._updateHeader();
    this._updateQueue();
    this._updateDrawer();
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
      <button class="confirm-action" onclick="UI._save()">Finish anyway</button>
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
    // Capture session metadata for the finish screen BEFORE we save (so we can
    // diff against the previous session and compute a story).
    const sessionStartTime = this._sessionStartTime || null;
    const lastSession = App.state.lastSession || null;
    try {
      await App.saveSession(toSave);
      const summary = this._buildSessionSummary(toSave, lastSession, sessionStartTime);
      App.state.session = App.state.activeDay = null;
      App.state.history = null;
      this._renderFinishScreen(summary, day);
    } catch(e) { this._toast("Save failed"); }
  },

  _buildSessionSummary(toSave, lastSession, startTime) {
    const exs = toSave.exercises || [];
    const workingSets = exs.flatMap(ex => (ex.sets||[]).filter(s=>!s.isWarmup));
    const loggedSets = workingSets.filter(s=>s.logged);
    const skippedSets = workingSets.length - loggedSets.length;

    let totalReps = 0;
    let totalVolume = 0;
    let prevVolume = 0;

    // Build per-exercise comparison rows
    const compare = exs.filter(ex => !ex.isFinisher).map(ex => {
      const working = (ex.sets||[]).filter(s=>!s.isWarmup&&s.logged);
      if (!working.length) return null;
      // Best set this session
      const best = working.reduce((b,s)=>parseFloat(s.weight||0)>parseFloat(b?.weight||0)?s:b, null);
      // Find matching exercise in last session
      const prevEx = lastSession?.exercises?.find(e => e.id === ex.id);
      const prevWorking = prevEx?.sets?.filter(s=>!s.isWarmup) || [];
      const prevBest = prevWorking.reduce((b,s)=>parseFloat(s.weight||0)>parseFloat(b?.weight||0)?s:b, null);

      // Tally volume
      working.forEach(s => {
        const r = parseInt(s.reps) || 0;
        const w = parseFloat(s.weight) || 0;
        totalReps += r;
        totalVolume += r * w;
      });
      prevWorking.forEach(s => {
        const r = parseInt(s.reps) || 0;
        const w = parseFloat(s.weight) || 0;
        prevVolume += r * w;
      });

      // Compute delta vs prev best
      let delta = null;
      let deltaKind = "flat";
      if (best && prevBest) {
        const wDiff = parseFloat(best.weight||0) - parseFloat(prevBest.weight||0);
        const rDiff = parseInt(best.reps||0) - parseInt(prevBest.reps||0);
        if (Math.abs(wDiff) >= 0.5) {
          delta = (wDiff > 0 ? "+" : "") + wDiff;
          deltaKind = wDiff > 0 ? "up" : "down";
        } else if (rDiff !== 0) {
          delta = (rDiff > 0 ? "+" : "") + rDiff + "r";
          deltaKind = rDiff > 0 ? "up" : "down";
        } else {
          delta = "=";
          deltaKind = "flat";
        }
      } else if (best && !prevBest) {
        delta = "NEW";
        deltaKind = "up";
      }

      return {
        name: ex.name,
        cur: best ? `${best.reps}×${best.weight}` : "—",
        prev: prevBest ? `${prevBest.reps}×${prevBest.weight}` : null,
        delta,
        deltaKind,
        weight: best ? parseFloat(best.weight)||0 : 0,
        prevWeight: prevBest ? parseFloat(prevBest.weight)||0 : 0,
        reps: best ? parseInt(best.reps)||0 : 0,
        prevReps: prevBest ? parseInt(prevBest.reps)||0 : 0,
      };
    }).filter(Boolean);

    // Volume delta vs last
    let volDeltaPct = null;
    if (prevVolume > 0) {
      volDeltaPct = Math.round(((totalVolume - prevVolume) / prevVolume) * 100);
    }

    // Pick the headline: prioritize a PR (weight bump), then rep PR, then volume jump, then completion
    let headline = null;
    const prCandidate = compare.find(c => c.deltaKind === "up" && c.weight > c.prevWeight && c.prevWeight > 0);
    const repCandidate = compare.find(c => c.deltaKind === "up" && c.weight === c.prevWeight && c.reps > c.prevReps);
    const newCandidate = compare.find(c => c.delta === "NEW");

    if (prCandidate) {
      const diff = prCandidate.weight - prCandidate.prevWeight;
      headline = {
        kind: "pr",
        label: "★ New PR",
        main: `You hit <span class="accent">${prCandidate.cur}</span> on ${prCandidate.name} —<br>that's a ${diff}-pound jump.`,
        sub: prCandidate.prev ? `Last session: ${prCandidate.prev} lbs.` : "First time at this weight."
      };
    } else if (repCandidate) {
      const rDiff = repCandidate.reps - repCandidate.prevReps;
      headline = {
        kind: "reps",
        label: "★ Rep PR",
        main: `${rDiff} more rep${rDiff>1?"s":""} on ${repCandidate.name} —<br>at the same weight.`,
        sub: `${repCandidate.cur} (was ${repCandidate.prev}).`
      };
    } else if (newCandidate) {
      headline = {
        kind: "new",
        label: "First time",
        main: `${newCandidate.name} added to your program —<br>baseline locked at <span class="accent">${newCandidate.cur}</span>.`,
        sub: "Now there's a number to beat."
      };
    } else if (volDeltaPct !== null && volDeltaPct >= 5) {
      headline = {
        kind: "volume",
        label: "Volume up",
        main: `Moved <span class="accent">${volDeltaPct}% more weight</span> than last time.<br>Same plan, bigger numbers.`,
        sub: `${Math.round(totalVolume).toLocaleString()} lbs total today.`
      };
    } else if (skippedSets === 0 && loggedSets.length >= 10) {
      headline = {
        kind: "complete",
        label: "Full clear",
        main: `Every set, every lift — no skips.<br><span class="accent">Solid session.</span>`,
        sub: "Consistency is the whole point."
      };
    } else {
      headline = {
        kind: "default",
        label: "Logged",
        main: `Another one in the books.<br><span class="accent">${exs.filter(e=>!e.isFinisher).length} lifts</span> done.`,
        sub: skippedSets > 0 ? `${skippedSets} set${skippedSets>1?"s":""} skipped.` : "Stay on the plan."
      };
    }

    // Duration
    let durationStr = null;
    if (startTime) {
      const sec = Math.round((Date.now() - startTime) / 1000);
      if (sec < 60) {
        durationStr = `${sec}s`;
      } else {
        const m = Math.floor(sec / 60);
        const h = Math.floor(m / 60);
        if (h >= 1) {
          durationStr = `${h}h ${m - h*60}m`;
        } else {
          durationStr = `${m} min`;
        }
      }
    }
    const timeStr = new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});

    // Last session date (for the compare card header)
    let lastSessionAgo = null;
    if (lastSession?.date) {
      const d = new Date(String(lastSession.date).slice(0,10) + "T12:00:00");
      if (!isNaN(d.getTime())) {
        const days = Math.round((Date.now() - d.getTime()) / 86400000);
        lastSessionAgo = days === 0 ? "earlier today" : days === 1 ? "yesterday" : `${days} days ago`;
      }
    }

    return {
      exCount: exs.filter(ex=>!ex.isFinisher).length,
      totalSets: loggedSets.length,
      totalReps,
      totalVolume,
      prevVolume,
      volDeltaPct,
      compare,
      headline,
      skippedSets,
      workingSetCount: workingSets.length,
      durationStr,
      timeStr,
      lastSessionAgo
    };
  },

  _renderFinishScreen(summary, day) {
    this.root.innerHTML = "";
    document.getElementById("bottom-nav")?.remove();

    const dayTitle = day?.title || "Workout";

    // Contextual quote — references day or phase rather than being purely generic
    const quotes = [
      `The bar doesn't lie. Neither do you.`,
      `Today's work is tomorrow's strength.`,
      `Stack the days. That's how it compounds.`,
      `Every rep is a vote for who you're becoming.`,
      `Showing up is half. You did the other half.`,
      `Progress doesn't ask if you felt like it.`,
      `You moved real weight today. Bank it.`,
      `One more day on the plan. Don't break the chain.`
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    // Compare rows
    const allNew = summary.compare.length > 0 && summary.compare.every(c => !c.prev);
    const compareHeading = allNew ? "Baselines locked" : "Vs. last session";
    const compareHTML = summary.compare.length ? `
      <div class="finv2-compare">
        <div class="finv2-compare-head">
          <span>${compareHeading}</span>
          ${(!allNew && summary.lastSessionAgo) ? `<span>${summary.lastSessionAgo}</span>` : ""}
        </div>
        ${summary.compare.map(c => `
          <div class="finv2-compare-row">
            <span class="finv2-name">${c.name}</span>
            <span class="finv2-vals"><strong>${c.cur}</strong>${c.prev ? ` <span class="finv2-was">· was ${c.prev}</span>` : ""}</span>
            ${c.delta !== null ? `<span class="finv2-delta finv2-delta-${c.deltaKind}">${c.delta}</span>` : ""}
          </div>`).join("")}
      </div>` : "";

    // Stats grid (2-up)
    const volStr = summary.totalVolume > 0 ? Math.round(summary.totalVolume).toLocaleString() : "0";
    const volDeltaHTML = summary.volDeltaPct !== null
      ? `<div class="finv2-delta-line ${summary.volDeltaPct > 0 ? 'up' : summary.volDeltaPct < 0 ? 'down' : 'flat'}">
          ${summary.volDeltaPct > 0 ? '↑' : summary.volDeltaPct < 0 ? '↓' : '='} ${Math.abs(summary.volDeltaPct)}% vs last
        </div>`
      : `<div class="finv2-delta-line flat">First time</div>`;
    const completionPct = summary.workingSetCount > 0
      ? Math.round((summary.totalSets / summary.workingSetCount) * 100)
      : 100;
    const completionDelta = summary.skippedSets === 0
      ? `<div class="finv2-delta-line up">Full clear</div>`
      : `<div class="finv2-delta-line flat">${summary.skippedSets} skipped</div>`;

    const wrap = document.createElement("div");
    wrap.id = "finv2";
    wrap.innerHTML = `
      <canvas id="confetti-canvas"></canvas>
      <div class="finv2-bg-dots"></div>
      <div class="finv2-inner">
        <div class="finv2-header">
          <div class="finv2-eyebrow">Workout complete</div>
          <div class="finv2-day-name">${dayTitle}</div>
          <div class="finv2-meta-line">
            ${summary.durationStr ? `<span>${summary.durationStr}</span><span class="finv2-pip">·</span>` : ""}
            <span>${summary.timeStr}</span>
          </div>
        </div>

        <div class="finv2-scroll">
          <div class="finv2-headline finv2-headline-${summary.headline.kind}">
            <span class="finv2-headline-lbl">${summary.headline.label}</span>
            <div class="finv2-headline-main">${summary.headline.main}</div>
            <div class="finv2-headline-sub">${summary.headline.sub}</div>
          </div>

          <div class="finv2-stats">
            <div class="finv2-stat">
              <div class="finv2-stat-lbl">Volume moved</div>
              <div class="finv2-stat-val">${volStr}<span class="finv2-stat-unit">lbs</span></div>
              ${volDeltaHTML}
            </div>
            <div class="finv2-stat">
              <div class="finv2-stat-lbl">Working sets</div>
              <div class="finv2-stat-val">${summary.totalSets} <span class="finv2-stat-unit">/ ${summary.workingSetCount}</span></div>
              ${completionDelta}
            </div>
          </div>

          ${compareHTML}

          <div class="finv2-quote">${quote}</div>
        </div>

        <div class="finv2-footer">
          <div class="finv2-actions">
            <button class="finv2-share" onclick="UI._shareFinish()" aria-label="Share">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-3-3-3 3M7 1v8M2 9v3a1 1 0 001 1h8a1 1 0 001-1V9"/></svg>
              Share
            </button>
            <button class="finv2-cta" onclick="UI._closeFinish()">Done →</button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(wrap);

    // Subtle confetti — quieter than before but still earned
    this._fireConfetti();

    // Haptic
    if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 120]);

    // Stash summary for share intent
    this._lastFinishSummary = summary;
    this._lastFinishDayTitle = dayTitle;
  },

  _shareFinish() {
    const s = this._lastFinishSummary;
    const t = this._lastFinishDayTitle;
    if (!s) return;
    const lines = [
      `💪 ${t}`,
      s.headline.label + " — " + s.headline.main.replace(/<[^>]+>/g, "").replace(/\n/g, " "),
      `${Math.round(s.totalVolume).toLocaleString()} lbs moved · ${s.totalSets}/${s.workingSetCount} sets`,
    ];
    const text = lines.join("\n");
    if (navigator.share) {
      navigator.share({ text }).catch(()=>{});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this._toast("Copied to clipboard");
    }
  },

  _closeFinish() {
    if (this._confettiRaf) { cancelAnimationFrame(this._confettiRaf); this._confettiRaf = null; }
    this.nav("history");
  },

  _fireConfetti() {
    const cv = document.getElementById("confetti-canvas");
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);

    const colors = ["#E8FF47", "#3DFFA0", "#FF6B35", "#5BA4FF", "#FFFFFF", "#B87FFF"];
    const N = 140;
    const start = performance.now();
    const particles = [];
    for (let i = 0; i < N; i++) {
      particles.push({
        x: W / 2 + (Math.random() - 0.5) * 60,
        y: H * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 16 - 6,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        size: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() < 0.5 ? "rect" : "circ"
      });
    }
    const G = 0.45;
    const DRAG = 0.992;
    const tick = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.vy += G;
        p.vx *= DRAG;
        p.vy *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 3000);
        if (p.shape === "rect") {
          ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size/2, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      });
      if (elapsed < 3000) {
        this._confettiRaf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
        this._confettiRaf = null;
      }
    };
    this._confettiRaf = requestAnimationFrame(tick);
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
  renderStats() {
    const wrap = this.el("div","page stats-page");
    wrap.innerHTML = `
      <div class="statsv2-top">
        <div class="statsv2-title-row">
          <div>
            <div class="statsv2-eyebrow">Progress</div>
            <div class="statsv2-title">Stats</div>
          </div>
        </div>
        <div class="stats-tabs">
          <button class="stats-tab ${this._statsTab==="body"?"active":""}"   onclick="UI._setTab('body')">Body</button>
          <button class="stats-tab ${this._statsTab==="lifts"?"active":""}"  onclick="UI._setTab('lifts')">Lifts</button>
          <button class="stats-tab ${this._statsTab==="recomp"?"active":""}" onclick="UI._setTab('recomp')">Recomp</button>
          <button class="stats-tab ${this._statsTab==="coach"?"active":""}"  onclick="UI._setTab('coach')">Coach</button>
        </div>
      </div>
      <div id="stats-content"><div class="loading-text">Loading…</div></div>`;
    this.root.appendChild(wrap);
    // Render the active tab immediately — each tab handles its own data dependency
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
    const tab = this._statsTab;
    // Body tab needs bwLog only — render immediately if cached, otherwise show loading + fetch
    if (tab==="body") { this._bodyTab().then(h=>{if(el && this._statsTab==="body") el.innerHTML=h;}); return; }
    // Lifts/Recomp/Coach need full stats — render now if cached, otherwise fetch
    if (App.state.stats) {
      if (tab==="lifts") el.innerHTML = this._liftsTab(App.state.stats);
      if (tab==="recomp")el.innerHTML = this._recompTab(App.state.stats);
      if (tab==="coach") el.innerHTML = this._coachTab(App.state.stats);
      return;
    }
    App.fetchStats().then(stats => {
      App.state.stats = stats;
      if (!el || this._statsTab !== tab) return;
      if (tab==="lifts") el.innerHTML = this._liftsTab(stats);
      if (tab==="recomp")el.innerHTML = this._recompTab(stats);
      if (tab==="coach") el.innerHTML = this._coachTab(stats);
    }).catch(()=>{});
  },

  async _bodyTab() {
    let raw = App.state.bwLog;
    if (!raw) {
      try {
        const server = await App.getBodyweightLog();
        raw = this._bwMergeWithShadow(server);
      } catch {
        raw = this._bwMergeWithShadow([]);
      }
      App.state.bwLog = raw;
    }

    // Normalise. Server log may contain duplicate rows for the same date (append-only).
    // Google Sheets sometimes stores dates as serial numbers (days since Dec 30, 1899)
    // instead of "YYYY-MM-DD" text — detect and convert before the regex filter.
    const sheetSerialToYmd = (n) => {
      // Sheets epoch: Dec 30, 1899. JS epoch: Jan 1, 1970 = serial 25569.
      // Subtract 1 because Sheets incorrectly treats 1900 as a leap year.
      const ms = (n - 25569) * 86400000;
      const d = new Date(ms);
      // Use UTC to avoid timezone-driven off-by-one
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    };

    const byDate = new Map();
    (raw || []).forEach((e, i) => {
      let ymd = String(e.date).slice(0,10);
      // If the date looks like a bare integer serial (e.g. "46772"), convert it
      if (/^\d{4,6}$/.test(ymd.trim()) && !ymd.includes("-")) {
        ymd = sheetSerialToYmd(parseInt(e.date, 10));
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
      const prior = byDate.get(ymd);
      const curStamp = e.logged_at ? new Date(e.logged_at).getTime() : i;
      const priorStamp = prior ? (prior.logged_at ? new Date(prior.logged_at).getTime() : prior._idx) : -Infinity;
      if (!prior || curStamp >= priorStamp) {
        // Normalize weight field — server may return either `w` or `weight_lbs`
        const weight = e.w ?? e.weight_lbs ?? e.weight;
        byDate.set(ymd, { ...e, _ymd: ymd, _idx: i, w: parseFloat(weight)||0 });
      }
    });
    const entries = Array.from(byDate.values())
      .sort((a,b) => a._ymd < b._ymd ? -1 : a._ymd > b._ymd ? 1 : 0);

    const gl=CONFIG.GOAL_LB_LOW, gh=CONFIG.GOAL_LB_HIGH;
    const today = this._today();
    const todayE = entries.find(e=>e._ymd===today);

    // Latest = last entry after sort
    const latest = entries.length ? entries[entries.length-1] : null;
    const inGoal = latest && latest.w >= gl && latest.w <= gh;

    // 30-day change
    const cutoff30 = (() => {
      const d = new Date(); d.setDate(d.getDate()-30);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    })();
    const oldest30 = entries.find(e => e._ymd >= cutoff30);
    let change30 = null;
    if (oldest30 && latest && oldest30._ymd !== latest._ymd) {
      change30 = (latest.w - oldest30.w).toFixed(1);
    }

    // Streak (consecutive days with an entry)
    let streak = 0;
    {
      let cursor = new Date(); cursor.setHours(12,0,0,0);
      const byYmd = new Set(entries.map(e=>e._ymd));
      while (true) {
        const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`;
        if (byYmd.has(ymd)) { streak++; cursor.setDate(cursor.getDate()-1); }
        else break;
      }
    }

    const change30Str = change30 !== null
      ? `<span class="${parseFloat(change30)<0?"green":"orange"}">${parseFloat(change30)<0?"":"+"}${change30} lbs</span>`
      : `<span class="flat">—</span>`;

    const r = this._bwRange;
    const rl = {30:"30 days",90:"90 days",365:"1 year",0:"All time"};

    // History rows (newest-first, sorted correctly)
    const histRows = entries.slice().reverse().slice(0,30).map((e, idx, arr) => {
      const prev = arr[idx+1];
      const delta = prev ? parseFloat((e.w - prev.w).toFixed(1)) : null;
      let deltaHTML = "";
      if (delta !== null) {
        if (Math.abs(delta) < 0.05) {
          deltaHTML = `<span class="bwv2-delta flat">=</span>`;
        } else if (delta < 0) {
          deltaHTML = `<span class="bwv2-delta down">${delta}</span>`;
        } else {
          deltaHTML = `<span class="bwv2-delta up">+${delta}</span>`;
        }
      }
      return `<div class="bwv2-hist-row">
        <span class="bwv2-hist-date">${this._dateExact(e._ymd)}</span>
        <span class="bwv2-hist-val">${e.w}<span class="bwv2-hist-unit">lbs</span></span>
        ${deltaHTML}
        <button class="bwv2-hist-del" onclick="App.deleteBodyweight('${e.date}').then(()=>{App.state.bwLog=null;UI._setTab('body')})" aria-label="Delete">✕</button>
      </div>`;
    }).join("") || `<div class="loading-text muted" style="padding:12px 14px">No entries yet</div>`;

    return `
      <!-- HERO -->
      <div class="bwv2-hero">
        <div class="bwv2-hero-lbl">Current weight</div>
        <div class="bwv2-hero-val">${latest ? latest.w : "—"}<span class="bwv2-hero-unit">lbs</span></div>
        <div class="bwv2-hero-meta">
          <div class="bwv2-meta-pair">
            <span class="lbl">Goal</span>
            <span class="val ${inGoal?"green":""}">${gl}–${gh}${inGoal?" ✓":""}</span>
          </div>
          <div class="bwv2-meta-pair">
            <span class="lbl">30d change</span>
            <span class="val">${change30Str}</span>
          </div>
          ${streak>1?`<div class="bwv2-meta-pair"><span class="lbl">Streak</span><span class="val">${streak} days</span></div>`:""}
        </div>
      </div>

      <!-- Quick log -->
      <div class="bwv2-log-strip">
        <input type="number" inputmode="decimal" id="bw-in" class="bwv2-log-input"
          placeholder="${todayE?todayE.w:"170.0"}" step="0.1" value="${todayE?todayE.w:""}">
        <span class="bwv2-log-unit">lbs</span>
        <input type="date" id="bw-date" class="bwv2-log-date" value="${today}" max="${today}">
        <button class="bwv2-log-save" onclick="UI._saveBW()">${todayE?"Update":"Save"}</button>
      </div>

      ${entries.length>=2?`
        <!-- Range selector -->
        <div class="bwv2-range">
          ${[30,90,365,0].map(rv=>`<button class="bwv2-range-btn ${r===rv?"active":""}" data-range="${rv}" onclick="UI._setBWRange(${rv})">${rl[rv]}</button>`).join("")}
        </div>
        <!-- Chart -->
        <div class="bwv2-chart-card">
          <div id="bw-chart">${this._bwChart(entries,r)}</div>
        </div>
      `:""}

      <!-- History -->
      <div class="bwv2-hist-head">
        <span>Entries</span>
        <span class="count">${entries.length}</span>
      </div>
      <div class="bwv2-hist">${histRows}</div>
    `;
  },

  // _dateExact: always returns absolute date string, no "N days ago" ambiguity.
  // Used for body weight history where precision matters.
  // Returns "Today", "Yesterday", or "Thu · Jun 4" — always has day-of-week AND calendar date.
  _dateExact(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "—";
    // Parse at local noon to avoid UTC midnight off-by-one issues
    const d = new Date(`${ymd}T12:00:00`);
    if (isNaN(d.getTime())) return ymd;

    const today = this._today();
    const yest = (() => {
      const y = new Date(); y.setDate(y.getDate()-1);
      return `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;
    })();

    if (ymd === today) return "Today";
    if (ymd === yest) return "Yesterday";

    // Always show day-of-week AND date — never "N days ago"
    const dow  = d.toLocaleDateString("en-US", { weekday:"short" });
    const mon  = d.toLocaleDateString("en-US", { month:"short" });
    const day  = d.getDate();
    return `${dow} · ${mon} ${day}`;
  },

  // localStorage shadow: keeps recent saves alive even if the backend retrieve
  // returns a stale dataset (server-side read range limitation).
  _bwShadowKey: "bw_shadow_v1",
  _bwShadowMaxAge: 90 * 86400 * 1000, // 90 days
  _bwShadowGet() {
    try {
      const raw = localStorage.getItem(this._bwShadowKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const cutoff = Date.now() - this._bwShadowMaxAge;
      return parsed.filter(e => new Date(e.date+"T12:00:00").getTime() >= cutoff);
    } catch { return []; }
  },
  _bwShadowAdd(date, w) {
    const list = this._bwShadowGet().filter(e => e.date !== date);
    list.push({ date, w, ts: Date.now() });
    try { localStorage.setItem(this._bwShadowKey, JSON.stringify(list)); } catch {}
  },
  // Merge server log + local shadow. Server wins for dates present in both.
  _bwMergeWithShadow(serverLog) {
    const sheetSerialToYmd = (n) => {
      const d = new Date((n - 25569) * 86400000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    };
    const toYmd = (raw) => {
      let ymd = String(raw).slice(0,10);
      if (/^\d{4,6}$/.test(ymd.trim()) && !ymd.includes("-")) ymd = sheetSerialToYmd(parseInt(raw, 10));
      return ymd;
    };
    const merged = new Map();
    this._bwShadowGet().forEach(e => merged.set(e.date, { date: e.date, w: e.w, logged_at: new Date(e.ts).toISOString(), _shadow: true }));
    (serverLog || []).forEach(e => {
      const ymd = toYmd(e.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return; // skip unparseable
      // Server entries override shadow for the same date. Normalize weight field.
      const weight = e.w ?? e.weight_lbs ?? e.weight;
      merged.set(ymd, { ...e, date: ymd, w: parseFloat(weight)||0 });
    });
    return Array.from(merged.values());
  },

  async _saveBW() {
    const w = parseFloat(document.getElementById("bw-in")?.value);
    const d = document.getElementById("bw-date")?.value;
    if (!w || w < 50 || w > 500) { this._toast("Enter a valid weight"); return; }

    // Optimistic update — push into local cache immediately so the entry shows
    // even before the network round-trip completes. If an entry for this date
    // already exists, replace it; otherwise insert.
    const log = App.state.bwLog || [];
    const idx = log.findIndex(e => String(e.date).slice(0,10) === d);
    if (idx >= 0) log[idx] = { ...log[idx], w };
    else log.push({ date: d, w });
    App.state.bwLog = log;

    // Mirror to localStorage so the entry survives a hard refresh, even if the
    // backend retrieve range doesn't return the latest rows.
    this._bwShadowAdd(d, w);

    // Re-render Body tab right away so the row shows
    this._setTab("body");
    this._toast("Saved ✓");

    // Persist in the background
    try {
      await App.logBodyweight(d, w);
    } catch (e) {
      // Network failed entirely — surface to user. The shadow entry stays in
      // localStorage so the value isn't lost across a refresh, and the next
      // successful save will sync.
      this._toast("Save failed — kept locally");
    }
  },

  _setBWRange(r) {
    this._bwRange = r;
    const el = document.getElementById("bw-chart");
    if (el && App.state.bwLog) {
      // bwLog may be raw (from server) or already processed (from _bodyTab cache).
      // Normalize dates to _ymd using the same serial-conversion logic.
      const sheetSerialToYmd = (n) => {
        const d = new Date((n - 25569) * 86400000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
      };
      const sorted = (App.state.bwLog||[])
        .map(e => {
          if (e._ymd) return e; // already normalized
          let ymd = String(e.date).slice(0,10);
          if (/^\d{4,6}$/.test(ymd.trim()) && !ymd.includes("-")) ymd = sheetSerialToYmd(parseInt(e.date,10));
          return { ...e, _ymd: ymd };
        })
        .filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e._ymd))
        .sort((a,b)=>a._ymd<b._ymd?-1:a._ymd>b._ymd?1:0);
      el.innerHTML = this._bwChart(sorted, r);
    }
    // Fix: class is bwv2-range-btn in the rendered HTML
    document.querySelectorAll(".bwv2-range-btn").forEach(b => {
      const btnRange = parseInt(b.getAttribute("data-range") ?? "-1");
      b.classList.toggle("active", btnRange === r);
    });
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
    // Net delta for this range — first to last weight in the selected window
    const first = data[0]?.w, last = data[data.length-1]?.w;
    const delta = (first != null && last != null) ? (last - first) : null;
    const deltaStr = delta !== null
      ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} lbs`
      : "";
    const deltaClass = delta !== null ? (delta < 0 ? "down" : delta > 0 ? "up" : "flat") : "";
    const gTop=H-((gh-mn)/rng)*H, gBotPx=H-((gl-mn)/rng)*H, gH=Math.max(0, gBotPx-gTop);
    const latest = data[data.length-1]?.w;
    const status = latest >= gl && latest <= gh ? "in goal" :
                   latest > gh ? `${(latest-gh).toFixed(1)} above` :
                   `${(gl-latest).toFixed(1)} below`;
    const statusCls = latest >= gl && latest <= gh ? "in" :
                      latest > gh ? "above" : "below";
    return `<div class="chart-block" style="padding:14px">
      <div class="chart-title-row"><span class="chart-title">${data.length} entries</span>${deltaStr ? `<span class="chart-trend ${deltaClass}">${deltaStr}</span>` : ""}</div>
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
          <rect x="0" y="${gTop}" width="${W}" height="${gH}" fill="rgba(61,255,160,.14)"/>
          <line x1="0" y1="${gTop}" x2="${W}" y2="${gTop}" stroke="rgba(61,255,160,.55)" stroke-width="0.8" stroke-dasharray="3 3"/>
          <line x1="0" y1="${gBotPx}" x2="${W}" y2="${gBotPx}" stroke="rgba(61,255,160,.55)" stroke-width="0.8" stroke-dasharray="3 3"/>
          <line x1="0" y1="${ty0}" x2="${W}" y2="${ty1}" stroke="#5ba4ff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
          <polyline points="${pts}" fill="none" stroke="#e8ff47" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${data.length<=20?data.map((e,i)=>`<circle cx="${(i/(data.length-1))*W}" cy="${H-((e.w-mn)/rng)*H}" r="2.5" fill="#e8ff47"/>`).join(""):""}
        </svg>
        <div class="svg-y-labels"><span>${mx.toFixed(0)}</span><span>${((mx+mn)/2).toFixed(0)}</span><span>${mn.toFixed(0)}</span></div>
      </div>
      <div class="chart-goal-label">
        <span class="goal-band-dot"></span> Goal ${gl}–${gh} lbs
        <span class="goal-status goal-status-${statusCls}">${status}</span>
      </div>
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
    const wrap = this.el("div","page hist-page");
    wrap.innerHTML = `
      <div class="histv2-top">
        <div class="histv2-eyebrow">Training log</div>
        <div class="histv2-title">History</div>
        <div class="histv2-summary-strip" id="hist-summary-strip">
          <div class="histv2-sum-loading">Loading…</div>
        </div>
      </div>
      <div id="hist-content" class="histv2-body"><div class="loading-text">Loading…</div></div>`;
    this.root.appendChild(wrap);
    if (!App.state.history) {
      const { sessions } = await App.fetchHistory();
      App.state.history = sessions;
    }
    const el = document.getElementById("hist-content");
    if (!el) return;
    const sessions = App.state.history || [];

    if (!sessions.length) {
      el.innerHTML = `<div class="loading-text muted" style="padding:24px 16px">No sessions logged yet.</div>`;
      return;
    }

    // Sort sessions newest-first by date
    const sorted = sessions.slice().sort((a,b) => {
      const da = String(a.date).slice(0,10);
      const db = String(b.date).slice(0,10);
      return da < db ? 1 : da > db ? -1 : 0;
    });

    // Summary strip — calculate stats
    const now = Date.now();
    const weekAgo = now - 7*86400000;
    const month30 = now - 30*86400000;
    let weekCount = 0, month30Sets = 0, month30Vol = 0, month30PRs = 0;
    sorted.forEach(s => {
      const d = new Date(String(s.date).slice(0,10)+"T12:00:00");
      if (d >= weekAgo) weekCount++;
      if (d >= month30) {
        (s.exercises||[]).forEach(ex => {
          (ex.sets||[]).forEach(st => {
            // Skip warmups; count a set if it has reps OR weight, regardless of
            // whether the `logged` flag is set (older saved sets don't carry it).
            if (st.isWarmup) return;
            const reps = parseInt(st.reps)||0;
            const wt   = parseFloat(st.weight)||0;
            if (reps === 0 && wt === 0) return;
            month30Sets++;
            month30Vol += reps * wt;
            const prevW = parseFloat(st.prev?.weight||0);
            if (wt > prevW && prevW > 0) month30PRs++;
          });
        });
      }
    });
    // Always show the full number with commas — "18.5k" loses the satisfying detail
    const volStr = Math.round(month30Vol).toLocaleString();
    const summaryEl = document.getElementById("hist-summary-strip");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="histv2-sum"><div class="histv2-sum-lbl">This wk</div><div class="histv2-sum-val">${weekCount}</div></div>
        <div class="histv2-sum"><div class="histv2-sum-lbl">30d sets</div><div class="histv2-sum-val">${month30Sets}</div></div>
        <div class="histv2-sum histv2-sum-wide"><div class="histv2-sum-lbl">30d vol</div><div class="histv2-sum-val yellow">${volStr}<span class="histv2-sum-unit">lbs</span></div></div>
        <div class="histv2-sum"><div class="histv2-sum-lbl">PRs</div><div class="histv2-sum-val green">${month30PRs}</div></div>
      `;
    }

    // Group sessions into time buckets
    const todayYmd = this._today();
    const groups = [];
    let curGroup = null;
    sorted.forEach((s, idx) => {
      const ymd = String(s.date).slice(0,10);
      const d = new Date(ymd+"T12:00:00");
      const daysAgo = Math.round((now - d.getTime()) / 86400000);
      let groupKey;
      if (daysAgo <= 1) groupKey = "Today";
      else if (daysAgo <= 7) groupKey = "This week";
      else if (daysAgo <= 14) groupKey = "Last week";
      else {
        // Month name
        groupKey = d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
      }
      if (!curGroup || curGroup.key !== groupKey) {
        curGroup = { key: groupKey, sessions: [] };
        groups.push(curGroup);
      }
      curGroup.sessions.push({ s, idx });
    });

    // Build HTML
    const html = groups.map(g => {
      const sessionCards = g.sessions.map(({ s, idx }) => {
        // Volume + set count — count any non-warmup set with reps or weight,
        // regardless of whether `logged` flag is set (older saved sets lack it)
        let vol = 0, sets = 0;
        (s.exercises||[]).forEach(ex => {
          (ex.sets||[]).forEach(st => {
            if (st.isWarmup) return;
            const reps = parseInt(st.reps)||0;
            const wt   = parseFloat(st.weight)||0;
            if (reps === 0 && wt === 0) return;
            sets++;
            vol += reps * wt;
          });
        });
        const volDisp = vol > 0 ? Math.round(vol).toLocaleString() : "—";

        // Date label
        const ymd = String(s.date).slice(0,10);
        const dateLabel = this._dateExact(ymd);

        // Duration — not tracked in old sessions, skip gracefully
        const durStr = s.duration ? ` · ${Math.round(s.duration/60)}m` : "";

        // Lift pills — top 4 working exercises, mark PRs
        const pillsHTML = (s.exercises||[]).filter(ex=>!ex.isFinisher).slice(0,4).map(ex => {
          const working = (ex.sets||[]).filter(st=>!st.isWarmup);
          const best = working.reduce((b,st)=>parseFloat(st.weight||0)>parseFloat(b?.weight||0)?st:b,null);
          const isPR = best && parseFloat(best.weight||0) > parseFloat(best.prev?.weight||0) && parseFloat(best.prev?.weight||0) > 0;
          const label = best?.weight ? `${best.reps}×${best.weight}` : "";
          return `<span class="histv2-lift-pill ${isPR?"pr":""}">${ex.name}${label?` <strong>${label}</strong>`:""}</span>`;
        }).join("");

        // Expanded per-exercise set detail
        const exDetailHTML = (s.exercises||[]).filter(ex=>!ex.isFinisher).map(ex => {
          const best = (ex.sets||[]).filter(st=>!st.isWarmup).reduce((b,st)=>parseFloat(st.weight||0)>parseFloat(b?.weight||0)?st:b,null);
          const isPREx = best && parseFloat(best.weight||0) > parseFloat(best.prev?.weight||0) && parseFloat(best.prev?.weight||0) > 0;
          const setHtml = (ex.sets||[]).map((st, si) => {
            const warm = st.note==="warm-up"||st.isWarmup;
            const isBest = !warm && best && st.reps===best.reps && st.weight===best.weight;
            const cls = warm ? "warm" : isBest ? "best" : "";
            const wt = st.weight ? `×${st.weight}` : "";
            return `<span class="histv2-set-pill ${cls}"><span class="n">${warm?"W":si+1}</span>${st.reps}${wt}</span>`;
          }).join("");
          return `<div class="histv2-ex-block">
            <div class="histv2-ex-name">${ex.name}${isPREx?` <span class="histv2-ex-pr">★ PR</span>`:" "}<span class="histv2-ex-best">${best?.weight?`${best.weight} lbs`:""}</span></div>
            <div class="histv2-ex-sets">${setHtml}</div>
          </div>`;
        }).join("");

        return `<div class="histv2-card" data-idx="${idx}">
          <div class="histv2-card-head" onclick="UI._toggleHistRow(${idx})">
            <div class="histv2-card-l">
              <div class="histv2-day-top">
                <span class="histv2-day-date">${dateLabel}</span>
                <span class="histv2-day-dot">·</span>
                <span class="histv2-day-time">${s.time||""}${durStr}</span>
              </div>
              <div class="histv2-day-name">${s.dayTitle||"Workout"}</div>
            </div>
            <div class="histv2-card-stats">
              ${vol>0?`<div class="histv2-stat-mini"><div class="v">${volDisp}</div><div class="l">vol</div></div>`:""}
              <div class="histv2-stat-mini"><div class="v">${sets}</div><div class="l">sets</div></div>
              <span class="histv2-chev" id="hist-chev-${idx}">▾</span>
            </div>
          </div>
          <div class="histv2-card-expand" id="hist-exp-${idx}">${exDetailHTML}</div>
        </div>`;
      }).join("");

      return `<div class="histv2-group-head"><span>${g.key}</span><span class="ct">${g.sessions.length}</span></div>
        ${sessionCards}`;
    }).join("");

    el.innerHTML = html;
  },

  _toggleHistRow(idx) {
    const exp  = document.getElementById(`hist-exp-${idx}`);
    const chev = document.getElementById(`hist-chev-${idx}`);
    if (!exp) return;
    const open = exp.classList.toggle("open");
    if (chev) chev.textContent = open ? "▴" : "▾";
  },

  // ── HELPERS ───────────────────────────────────────────────────────────────
  _daysAgo(iso) {
    if (!iso) return "";
    const d = new Date(String(iso).slice(0,10)+"T12:00:00");
    if (isNaN(d.getTime())) return "";
    const days = Math.round((Date.now() - d) / 86400000);
    if (days < 0)  return "";
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7)  return `${days} days ago`;
    if (days < 14) return "last week";
    const weeks = Math.round(days / 7);
    return `${weeks} weeks ago`;
  },

  _date(iso) {
    if(!iso)return"—";
    // Try YYYY-MM-DD shape first (from local picker, or sliced ISO timestamp)
    const sliced = String(iso).slice(0,10);
    let target = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(sliced)) {
      target = new Date(sliced+"T12:00:00");
    } else {
      // Fallback: try parsing the raw string in case the API returns something like
      // "Thu Jun 05 2026" or a full ISO timestamp. JS handles both.
      const parsed = new Date(String(iso));
      if (!isNaN(parsed.getTime())) target = parsed;
    }
    if (!target || isNaN(target.getTime())) return "—";
    // Compare YYYY-MM-DD in local time
    const ymd = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`;
    const today = this._today();
    if (ymd === today) return "Today";
    const y = new Date(); y.setDate(y.getDate()-1);
    const yest = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;
    if (ymd === yest) return "Yesterday";
    const ago = Math.round((Date.now() - target.getTime()) / 86400000);
    if (ago >= 0 && ago < 7) return `${ago} days ago`;
    return target.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  },

  el(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;},

  _toast(msg){
    let t=document.getElementById("toast");
    if(!t){t=document.createElement("div");t.id="toast";document.body.appendChild(t);}
    t.textContent=msg;t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT=setTimeout(()=>t.classList.remove("show"),2500);
  },

  // Local date as YYYY-MM-DD (not UTC)
  _today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  },
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
