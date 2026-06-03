// ─── HEBOMB UI ────────────────────────────────────────────────────────────────

const UI = {

  // ── INIT ─────────────────────────────────────────────────────────────────
  init() {
    this.root = document.getElementById("app");
    this.render();
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

  // ── NAV BAR ──────────────────────────────────────────────────────────────
  renderNav() {
    const nav = document.createElement("nav");
    nav.className = "bottom-nav";
    const tabs = [
      { id: "home",    icon: "⚡", label: "Today" },
      { id: "log",     icon: "＋", label: "Log" },
      { id: "stats",   icon: "↗", label: "Stats" },
      { id: "history", icon: "≡",  label: "History" }
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

  // ── HOME ─────────────────────────────────────────────────────────────────
  renderHome() {
    const wrap = this.el("div", "page");
    const suggestedId = App.getSuggestedDay();
    const suggested = PROGRAM[suggestedId];
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek];
    const phase = weekData.phase;

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-label">Hebomb · ${CONFIG.USER}</div>
        <h1 class="page-title">TODAY</h1>
        <div class="header-date">${dateStr}</div>
      </header>

      <div class="week-banner">
        <div class="week-banner-left">
          <div class="week-banner-num">WEEK ${currentWeek} <span class="week-of">/13</span></div>
          <div class="week-banner-phase phase-text-${weekData.phaseId}">${phase.label}</div>
          <div class="week-banner-tip">${phase.tip}</div>
        </div>
        <div class="week-banner-controls">
          <button class="week-ctrl" onclick="UI.changeWeek(-1)" ${currentWeek <= 1 ? 'disabled' : ''}>‹</button>
          <button class="week-ctrl" onclick="UI.changeWeek(1)"  ${currentWeek >= 13 ? 'disabled' : ''}>›</button>
        </div>
      </div>

      <div class="suggested-card phase-bg-${weekData.phaseId}">
        <div class="suggested-label">SUGGESTED TODAY</div>
        <div class="suggested-title">${suggested.title}</div>
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
              <span class="dpb-label">${d.label}</span>
              <span class="dpb-title">${d.title}</span>
            </button>`;
        }).join("")}
      </div>

      <div id="home-stats-area">
        <div class="loading-text">Loading stats...</div>
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
      const stats = await App.fetchStats();
      App.state.stats = stats;
      area.innerHTML = `
        <div class="section-head">TRAILING ACTIVITY</div>
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-num">${stats.last7 || 0}</div>
            <div class="stat-lbl">sessions last 7d</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${stats.last30 || 0}</div>
            <div class="stat-lbl">sessions last 30d</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${((stats.last30 || 0) / 4.3).toFixed(1)}</div>
            <div class="stat-lbl">avg / week</div>
          </div>
        </div>
        ${this.renderTopStretches(stats.stretches)}
      `;
    } catch(e) {
      area.innerHTML = `<div class="loading-text muted">No data yet — log your first session.</div>`;
    }
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

  // ── START A DAY ──────────────────────────────────────────────────────────
  async startDay(dayId) {
    App.state.loading = true;
    App.state.activeDay = dayId;
    const session = App.newSession(dayId);

    // Load last session weights
    const last = await App.fetchLastSession(dayId);
    App.state.lastSession = last;
    App.state.session = App.applyLastSession(session, last);
    App.state.loading = false;
    App.state.view = "log";
    this.render();
  },

  // ── LOG VIEW ─────────────────────────────────────────────────────────────
  renderLog() {
    const wrap = this.el("div", "page");
    const { session, activeDay, loading } = App.state;
    const day = PROGRAM[activeDay];

    if (loading || !session) {
      wrap.innerHTML = `<div class="loading-text">Loading last session...</div>`;
      this.root.appendChild(wrap);
      return;
    }

    const lastDate = App.state.lastSession?.date
      ? `Last: ${App.state.lastSession.date}` : "First session";

    const currentWeek = getCurrentWeek();
    const weekData = WEEKS[currentWeek];
    const phaseId = day.phaseId || weekData.phaseId;
    const phase = day.phase || weekData.phase;

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-back" onclick="UI.nav('home')">← Back</div>
        <div class="phase-badge phase-badge-${phaseId}">Week ${currentWeek} · ${phase.label}</div>
        <h1 class="log-title">${day.title}</h1>
        <div class="header-date">${lastDate} · ${phase.tip}</div>
      </header>
    `;

    if (day.sportOnly) {
      wrap.appendChild(this.renderSportLog(session, day));
    } else {
      day.exercises.forEach((ex, ei) => {
        wrap.appendChild(this.renderExerciseBlock(ex, ei, session));
      });

      if (day.finisher) {
        const fin = this.el("div", "finisher-block");
        fin.innerHTML = `<span class="fin-icon">🏔</span> ${day.finisher}`;
        wrap.appendChild(fin);
      }
    }

    const saveBtn = this.el("button", "btn-save");
    saveBtn.textContent = "Save Session";
    saveBtn.onclick = () => this.saveSession();
    wrap.appendChild(saveBtn);

    this.root.appendChild(wrap);
  },

  renderExerciseBlock(ex, ei, session) {
    const block = this.el("div", "ex-block");
    const sessionEx = session.exercises[ei];

    let tipsHTML = ex.tip ? `<div class="ex-tip">${ex.tip}</div>` : "";

    block.innerHTML = `
      <div class="ex-header">
        <span class="ex-name">${ex.name}</span>
        <span class="ex-rest">Rest: ${ex.rest}</span>
      </div>
      ${tipsHTML}
      <div class="sets-grid">
        <div class="set-row header-row">
          <span>Set</span><span>Reps</span><span>Weight</span><span>✓</span>
        </div>
        ${sessionEx.sets.map((set, si) => `
          <div class="set-row" id="set-${ei}-${si}">
            <span class="set-num">${si + 1}${set.note ? ` <em>${set.note}</em>` : ""}</span>
            <input class="set-input" type="number" inputmode="decimal"
              value="${set.reps}" placeholder="reps"
              onchange="UI.updateSet(${ei}, ${si}, 'reps', this.value)"
              ${ex.bodyweight ? 'readonly style="color:var(--muted)"' : ''}>
            <input class="set-input weight-input" type="number" inputmode="decimal"
              value="${ex.bodyweight ? 'BW' : set.weight}" placeholder="lbs"
              onchange="UI.updateSet(${ei}, ${si}, 'weight', this.value)"
              ${ex.bodyweight ? 'readonly style="color:var(--muted)"' : ''}>
            <button class="set-check ${set.logged ? 'checked' : ''}"
              onclick="UI.toggleSet(${ei}, ${si})">
              ${set.logged ? "✓" : "○"}
            </button>
          </div>
        `).join("")}
      </div>
    `;
    return block;
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

  updateSet(ei, si, field, value) {
    if (App.state.session?.exercises?.[ei]?.sets?.[si]) {
      App.state.session.exercises[ei].sets[si][field] = value;
    }
  },

  toggleSet(ei, si) {
    const set = App.state.session?.exercises?.[ei]?.sets?.[si];
    if (!set) return;
    set.logged = !set.logged;
    const row = document.getElementById(`set-${ei}-${si}`);
    if (row) {
      const btn = row.querySelector(".set-check");
      if (btn) {
        btn.classList.toggle("checked", set.logged);
        btn.textContent = set.logged ? "✓" : "○";
      }
    }
  },

  async saveSession() {
    const { session, activeDay } = App.state;
    const day = PROGRAM[activeDay];
    if (!session) return;

    // Handle sport session
    if (day.sportOnly) {
      const type = document.getElementById("sport-type")?.value || "Sport";
      const dur  = document.getElementById("sport-duration")?.value || 0;
      const notes = document.getElementById("sport-notes")?.value || "";
      session.exercises = [{
        id: "sport",
        name: type,
        sets: [{ reps: `${dur} min`, weight: 0, note: notes }]
      }];
    }

    const btn = document.querySelector(".btn-save");
    if (btn) { btn.textContent = "Saving..."; btn.disabled = true; }

    try {
      const result = await App.saveSession(session);
      this.showToast(result.local ? "Saved locally ✓" : "Saved to Sheets ✓");
      setTimeout(() => { App.state.view = "home"; this.render(); }, 1200);
    } catch(e) {
      this.showToast("Save failed — try again");
      if (btn) { btn.textContent = "Save Session"; btn.disabled = false; }
    }
  },

  // ── STATS VIEW ───────────────────────────────────────────────────────────
  async renderStats() {
    const wrap = this.el("div", "page");

    // Sub-tab state
    if (!App.state.statsTab) App.state.statsTab = "body";

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-label">Progress</div>
        <h1 class="page-title">STATS</h1>
      </header>
      <div class="stats-tabs">
        <button class="stats-tab ${App.state.statsTab==="body"?"active":""}"
          onclick="UI.setStatsTab('body')">Body</button>
        <button class="stats-tab ${App.state.statsTab==="lifts"?"active":""}"
          onclick="UI.setStatsTab('lifts')">Lifts</button>
        <button class="stats-tab ${App.state.statsTab==="recomp"?"active":""}"
          onclick="UI.setStatsTab('recomp')">Recomp</button>
        <button class="stats-tab ${App.state.statsTab==="coach"?"active":""}"
          onclick="UI.setStatsTab('coach')">Coach</button>
      </div>
      <div id="stats-tab-content"><div class="loading-text">Loading...</div></div>
    `;
    this.root.appendChild(wrap);

    const stats = App.state.stats || await App.fetchStats();
    App.state.stats = stats;
    this.renderStatsTab(stats);
  },

  setStatsTab(tab) {
    App.state.statsTab = tab;
    const content = document.getElementById("stats-tab-content");
    if (!content || !App.state.stats) return;
    this.renderStatsTab(App.state.stats);
  },

  renderStatsTab(stats) {
    const content = document.getElementById("stats-tab-content");
    if (!content) return;
    const tab = App.state.statsTab || "body";
    if (tab === "body")   { this.renderBodyTab().then(html => { content.innerHTML = html; }); return; }
    if (tab === "lifts")  content.innerHTML = this.renderLiftsTab(stats);
    if (tab === "recomp") content.innerHTML = this.renderRecompTab(stats);
    if (tab === "coach")  content.innerHTML = this.renderCoachTab(stats);
  },

  // ── BODY TAB ─────────────────────────────────────────────────────────────
  async renderBodyTab() {
    const entries = await App.getBodyweightLog();
    const latest  = entries.length ? entries[entries.length - 1] : null;
    const goal_lo = CONFIG.GOAL_LB_LOW;
    const goal_hi = CONFIG.GOAL_LB_HIGH;
    const inGoal  = latest && latest.w >= goal_lo && latest.w <= goal_hi;

    return `
      <div class="bw-log-entry">
        <div class="bw-log-left">
          <div class="bw-current">${latest ? latest.w + " lbs" : "— lbs"}</div>
          <div class="bw-goal ${inGoal?"in-goal":""}">
            Goal: ${goal_lo}–${goal_hi} lbs ${inGoal ? "✓" : ""}
          </div>
        </div>
        <button class="btn-log-bw" onclick="UI.showBWEntry()">+ Log Weight</button>
      </div>

      ${entries.length >= 2 ? this.renderBWChart(entries) : `
        <div class="loading-text muted" style="margin:20px 0">
          Log a few weights to see your trend line.
        </div>
      `}

      <div class="section-head" style="margin-top:16px">HISTORY</div>
      <div class="bw-history">
        ${entries.slice().reverse().slice(0, 14).map(e => `
          <div class="bw-hist-row">
            <span class="bw-hist-date">${e.date}</span>
            <span class="bw-hist-val">${e.w} lbs</span>
            <button class="bw-hist-del" onclick="App.deleteBodyweight('${e.date}').then(() => UI.setStatsTab('body'))">✕</button>
          </div>
        `).join("") || `<div class="loading-text muted">No entries yet.</div>`}
      </div>

      <div class="section-head" style="margin-top:16px">IMPORT FROM APPLE HEALTH</div>
      <div class="import-card">
        <div class="import-instructions">
          1. iPhone → Health app → your profile pic → Export All Health Data<br>
          2. Unzip → find <strong>export.xml</strong><br>
          3. Drop it below — only bodyweight is read, nothing else stored
        </div>
        <label class="btn-import">
          Choose export.xml
          <input type="file" accept=".xml" style="display:none"
            onchange="App.importAppleHealth(this.files[0], () => UI.setStatsTab('body'))">
        </label>
      </div>
    `;
  },

  renderBWChart(entries) {
    const data = entries.slice(-30); // last 30 entries
    const weights = data.map(e => e.w);
    const min = Math.min(...weights) - 2;
    const max = Math.max(...weights) + 2;
    const range = max - min || 1;
    const goal_lo = CONFIG.GOAL_LB_LOW;
    const goal_hi = CONFIG.GOAL_LB_HIGH;
    const gLoPct  = ((goal_lo - min) / range) * 100;
    const gHiPct  = ((goal_hi - min) / range) * 100;
    const goalH   = Math.max(0, Math.min(100, gHiPct - gLoPct));
    const goalBot = Math.max(0, Math.min(100, gLoPct));

    // SVG line chart
    const W = 320, H = 100;
    const pts = data.map((e, i) => {
      const x = data.length < 2 ? W/2 : (i / (data.length - 1)) * W;
      const y = H - ((e.w - min) / range) * H;
      return `${x},${y}`;
    }).join(" ");

    // Trend line (simple linear regression)
    const n = data.length;
    const sumX = data.reduce((s,_,i) => s+i, 0);
    const sumY = data.reduce((s,e) => s+e.w, 0);
    const sumXY = data.reduce((s,e,i) => s+i*e.w, 0);
    const sumX2 = data.reduce((s,_,i) => s+i*i, 0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX || 1);
    const intercept = (sumY - slope*sumX) / n;
    const ty0 = H - ((intercept - min) / range) * H;
    const ty1 = H - (((slope*(n-1)+intercept) - min) / range) * H;
    const trendDir = slope < -0.05 ? "↓ trending down" : slope > 0.05 ? "↑ trending up" : "→ holding steady";

    return `
      <div class="chart-block" style="padding:14px 14px 10px">
        <div class="chart-title-row">
          <span class="chart-title">Bodyweight — Last ${data.length} entries</span>
          <span class="chart-trend">${trendDir}</span>
        </div>
        <div class="svg-chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
            <!-- goal zone -->
            <rect x="0" y="${H - goalBot - goalH}%" width="${W}"
              height="${goalH}%" fill="#e8ff4715" />
            <!-- trend line -->
            <line x1="0" y1="${ty0}" x2="${W}" y2="${ty1}"
              stroke="#4d9fff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
            <!-- weight line -->
            <polyline points="${pts}"
              fill="none" stroke="#e8ff47" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
            <!-- dots -->
            ${data.map((e, i) => {
              const x = data.length < 2 ? W/2 : (i / (data.length - 1)) * W;
              const y = H - ((e.w - min) / range) * H;
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

  showBWEntry() {
    const overlay = this.el("div", "export-overlay");
    const today = new Date().toISOString().split("T")[0];
    overlay.innerHTML = `
      <div class="export-modal bw-entry-modal">
        <div class="export-modal-head">
          <span>Log Bodyweight</span>
          <button onclick="this.closest('.export-overlay').remove()">✕</button>
        </div>
        <div class="bw-entry-body">
          <input type="number" inputmode="decimal" id="bw-input"
            class="bw-big-input" placeholder="170.0" step="0.1">
          <span class="bw-unit">lbs</span>
        </div>
        <div class="bw-entry-date">
          <input type="date" id="bw-date" value="${today}" class="set-input">
        </div>
        <button class="btn-primary" style="margin:12px" onclick="
          const w = parseFloat(document.getElementById('bw-input').value);
          const d = document.getElementById('bw-date').value;
          if (!w || w < 50 || w > 500) return;
          App.logBodyweight(d, w);
          this.closest('.export-overlay').remove();
          UI.setStatsTab('body');
        ">Save</button>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById("bw-input")?.focus(), 100);
  },

  // ── LIFTS TAB ─────────────────────────────────────────────────────────────
  renderLiftsTab(stats) {
    const vh = stats.volumeHistory || {};
    const lifts = [
      { id:"bench",  name:"Bench Press",   color:"#e8ff47" },
      { id:"squat",  name:"Back Squat",    color:"#ff6b35" },
      { id:"clean",  name:"Power Clean",   color:"#4dff91" },
      { id:"rdl",    name:"RDL",           color:"#4d9fff" }
    ];

    // Epley 1RM: w * (1 + r/30)
    function epley(w, r) { return Math.round(w * (1 + r / 30)); }

    const oneRMs = {};
    lifts.forEach(l => {
      const history = (vh[l.id] || []).slice().reverse();
      oneRMs[l.id] = history.map(d => ({
        date: d.date,
        orm: epley(d.weight, d.reps)
      }));
    });

    const stretches = stats.stretches || {};

    return `
      ${lifts.map(l => {
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
                <polyline points="${pts}"
                  fill="none" stroke="${l.color}" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
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
                <span class="lift-meta-val" style="color:${gain>=0?"#4dff91":"#ff6b35"}">${gainStr}</span>
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
      }).join("")}
    `;
  },

  // ── RECOMP TAB ────────────────────────────────────────────────────────────
  renderRecompTab(stats) {
    const bwLog = App.getBodyweightLog();
    const vh    = stats.volumeHistory || {};

    function epley(w, r) { return Math.round(w * (1 + r / 30)); }

    // Build strength-to-bw ratio over time using squat 1RM / bodyweight
    const squatHistory = (vh["squat"] || []).slice().reverse();

    // Match each squat session to nearest bodyweight entry
    const ratioData = squatHistory.map(s => {
      const orm = epley(s.weight, s.reps);
      // find bw entry closest to this date
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
    const ratioGain = latest && first
      ? (latest.ratio - first.ratio).toFixed(2) : null;

    // Weekly volume
    const weeklyVol = this.calcWeeklyVolume(stats);

    return `
      <div class="section-head">STRENGTH / BODYWEIGHT RATIO</div>
      <div class="recomp-explainer">
        Squat 1RM ÷ Bodyweight. Goes up as you recomp even when the scale
        barely moves. Best single metric for your goal.
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
              ${latest ? `<span class="orm-badge" style="color:#4dff91">${latest.ratio}×</span>` : ""}
            </div>
            <div class="svg-chart-wrap">
              <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-chart">
                <polyline points="${pts}"
                  fill="none" stroke="#4dff91" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
                ${ratioData.map((d,i) => {
                  const x = ratioData.length<2?W/2:(i/(ratioData.length-1))*W;
                  const y = H-((parseFloat(d.ratio)-min)/range)*H;
                  return `<circle cx="${x}" cy="${y}" r="3" fill="#4dff91"/>`;
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
                  <span class="lift-meta-val" style="color:${parseFloat(ratioGain)>=0?"#4dff91":"#ff6b35"}">
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
                      <div class="chart-bar"
                        style="height:${pct}%;background:${isDeload?"#4d9fff":"#e8ff47"}">
                      </div>
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
        // ISO week
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
        <div class="stat-box">
          <div class="stat-num">${stats.last7 || 0}</div>
          <div class="stat-lbl">last 7d</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${stats.last30 || 0}</div>
          <div class="stat-lbl">last 30d</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${((stats.last30||0)/4.3).toFixed(1)}</div>
          <div class="stat-lbl">avg/week</div>
        </div>
      </div>

      <div class="section-head" style="margin-top:16px">COACHING CHECK-IN</div>
      <div class="claude-export-card">
        <div class="claude-export-text">
          Copies your full 3-week training summary formatted for Claude —
          all lifts, weights, phase, and stretch targets included.
          Paste into a new chat for program updates or plateau fixes.
        </div>
        <button class="btn-claude" id="claude-copy-btn" onclick="UI.copyForClaude()">
          Copy for Claude
        </button>
      </div>
    `;
  },

  async copyForClaude() {
    const btn = document.getElementById("claude-copy-btn");
    if (btn) { btn.textContent = "Building..."; btn.disabled = true; }
    try {
      const text = await App.buildClaudeExport();
      await navigator.clipboard.writeText(text);
      this.showToast("Copied — paste into Claude ✓");
      if (btn) { btn.textContent = "Copied ✓"; }
      setTimeout(() => {
        if (btn) { btn.textContent = "Copy for Claude"; btn.disabled = false; }
      }, 3000);
    } catch(e) {
      // Fallback: show in a textarea they can manually copy
      this.showClaudeFallback(await App.buildClaudeExport());
      if (btn) { btn.textContent = "Copy for Claude"; btn.disabled = false; }
    }
  },

  showClaudeFallback(text) {
    const overlay = this.el("div", "export-overlay");
    overlay.innerHTML = `
      <div class="export-modal">
        <div class="export-modal-head">
          <span>Copy this into Claude</span>
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

  // renderCharts replaced by per-tab chart methods above

  // ── HISTORY VIEW ─────────────────────────────────────────────────────────
  async renderHistory() {
    const wrap = this.el("div", "page");
    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-label">All Sessions</div>
        <h1 class="page-title">HISTORY</h1>
      </header>
      <div id="history-content"><div class="loading-text">Loading...</div></div>
    `;
    this.root.appendChild(wrap);

    const { sessions } = await App.fetchHistory();
    const content = document.getElementById("history-content");
    if (!content) return;

    if (!sessions.length) {
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
            const top = ex.sets?.reduce((b, st) =>
              (parseFloat(st.weight)||0) > (parseFloat(b.weight)||0) ? st : b,
              ex.sets?.[0] || {});
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

  // ── HELPERS ──────────────────────────────────────────────────────────────
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
