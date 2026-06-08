// ─── HEBOMB APP — Data & State ───────────────────────────────────────────────

const App = {
  state: {
    view: "home",          // home | log | history | stats
    activeDay: null,
    session: null,         // current in-progress session
    lastSession: null,     // last logged session for active day
    history: null,
    stats: null,
    loading: false,
    saving: false,
    error: null
  },

  // ── API ──────────────────────────────────────────────────────────────────
  async fetchLastSession(dayId) {
    if (!CONFIG.SHEETS_URL || CONFIG.SHEETS_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
      return this._localGetLastSession(dayId);
    }
    try {
      const url = `${CONFIG.SHEETS_URL}?action=getLastSession&dayId=${dayId}`;
      const r = await fetch(url);
      return await r.json();
    } catch(e) {
      return this._localGetLastSession(dayId);
    }
  },

  async fetchStats() {
    if (!CONFIG.SHEETS_URL || CONFIG.SHEETS_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
      return this._localGetStats();
    }
    try {
      const url = `${CONFIG.SHEETS_URL}?action=getStats`;
      const r = await fetch(url);
      return await r.json();
    } catch(e) {
      return this._localGetStats();
    }
  },

  async fetchHistory() {
    if (!CONFIG.SHEETS_URL || CONFIG.SHEETS_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
      return this._localGetHistory();
    }
    try {
      const url = `${CONFIG.SHEETS_URL}?action=getHistory`;
      const r = await fetch(url);
      return await r.json();
    } catch(e) {
      return this._localGetHistory();
    }
  },

  async saveSession(session) {
    // Always save locally first
    this._localSaveSession(session);

    if (!CONFIG.SHEETS_URL || CONFIG.SHEETS_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
      return { success: true, local: true };
    }
    try {
      const r = await fetch(CONFIG.SHEETS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "logSession", session })
      });
      return await r.json();
    } catch(e) {
      return { success: true, local: true, error: e.message };
    }
  },

  // ── LOCAL STORAGE FALLBACK ───────────────────────────────────────────────
  _localKey(k) { return `hebomb_${k}`; },

  _localSaveSession(session) {
    const key = this._localKey("sessions");
    const sessions = JSON.parse(localStorage.getItem(key) || "[]");
    sessions.unshift(session);
    localStorage.setItem(key, JSON.stringify(sessions.slice(0, 200)));
  },

  _localGetHistory() {
    const sessions = JSON.parse(localStorage.getItem(this._localKey("sessions")) || "[]");
    return { sessions };
  },

  _localGetLastSession(dayId) {
    const { sessions } = this._localGetHistory();
    const daySessions = sessions.filter(s => s.dayId === dayId);
    if (!daySessions.length) return { sets: {} };
    const last = daySessions[0];
    const sets = {};
    last.exercises.forEach(ex => { sets[ex.id] = ex.sets; });
    return { date: last.date, sets };
  },

  _localGetStats() {
    const { sessions } = this._localGetHistory();
    const now = new Date();
    const d7  = new Date(); d7.setDate(now.getDate() - 7);
    const d30 = new Date(); d30.setDate(now.getDate() - 30);
    const last7  = sessions.filter(s => new Date(s.date) >= d7).length;
    const last30 = sessions.filter(s => new Date(s.date) >= d30).length;

    const bests = {};
    const volumeHistory = {};
    sessions.forEach(s => {
      s.exercises && s.exercises.forEach(ex => {
        ex.sets && ex.sets.forEach(set => {
          const w = parseFloat(set.weight) || 0;
          const r = parseFloat(set.reps) || 0;
          if (w > 0 && (!bests[ex.id] || w > bests[ex.id].weight)) {
            bests[ex.id] = { name: ex.name, weight: w, reps: r, date: s.date };
          }
        });
        if (!volumeHistory[ex.id]) volumeHistory[ex.id] = [];
        if (ex.sets && ex.sets.length) {
          const top = ex.sets.reduce((b, s) =>
            (parseFloat(s.weight)||0) > (parseFloat(b.weight)||0) ? s : b, ex.sets[0]);
          volumeHistory[ex.id].push({
            date: s.date,
            weight: parseFloat(top.weight) || 0,
            reps: parseFloat(top.reps) || 0
          });
        }
      });
    });

    const stretches = {};
    Object.entries(bests).forEach(([id, best]) => {
      let nw = best.weight, nr = best.reps;
      if (best.reps >= 10) { nw = best.weight + 5; nr = 8; }
      else { nr = best.reps + 1; }
      stretches[id] = {
        name: best.name,
        current: `${best.weight}×${best.reps}`,
        target: `${nw}×${nr}`,
        date: best.date
      };
    });

    return { last7, last30, bests, stretches, volumeHistory };
  },

  // ── SESSION HELPERS ──────────────────────────────────────────────────────
  newSession(dayId) {
    const day = PROGRAM[dayId];
    if (!day) return null;
    const sessionId = `${dayId}_${Date.now()}`;
    return {
      sessionId,
      dayId,
      dayTitle: day.title,
      date: new Date().toISOString().split("T")[0],
      startTime: Date.now(),
      exercises: day.sportOnly ? [] : day.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets.map(s => ({ ...s, logged: false }))
      }))
    };
  },

  applyLastSession(session, lastData) {
    if (!lastData || !lastData.sets) return session;
    session.exercises.forEach(ex => {
      const lastSets = lastData.sets[ex.id];
      if (lastSets && lastSets.length) {
        ex.sets.forEach((set, i) => {
          if (lastSets[i]) {
            set.weight = lastSets[i].weight;
            set.reps   = lastSets[i].reps;
          }
        });
      }
    });
    return session;
  },

  // ── BODYWEIGHT LOG ───────────────────────────────────────────────────────
  // Always writes to localStorage immediately (fast/offline),
  // then syncs to Sheets in background — same pattern as sessions.

  _localBWKey() { return "hebomb_bw"; },

  _localGetBW() {
    return JSON.parse(localStorage.getItem(this._localBWKey()) || "[]");
  },

  _localSaveBW(log) {
    log.sort((a,b) => String(a.date).localeCompare(String(b.date)));
    localStorage.setItem(this._localBWKey(), JSON.stringify(log));
  },

  async getBodyweightLog() {
    // Try Sheets first, fall back to localStorage
    if (CONFIG.SHEETS_URL && CONFIG.SHEETS_URL !== "YOUR_APPS_SCRIPT_URL_HERE") {
      try {
        const r = await fetch(`${CONFIG.SHEETS_URL}?action=getBodyweight`);
        const data = await r.json();
        if (data.entries && data.entries.length) {
          // Normalize: Sheets returns {date, weight_lbs} but local storage expects {date, w}
          const normalized = data.entries
            .map(e => ({
              date: String(e.date || "").slice(0, 10),
              w: parseFloat(e.w ?? e.weight_lbs ?? e.weight) || 0
            }))
            .filter(e => e.w > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
          // Sync normalized form back to localStorage so offline works
          this._localSaveBW(normalized);
          return normalized;
        }
      } catch(e) { /* fall through to local */ }
    }
    return this._localGetBW();
  },

  async logBodyweight(date, weight) {
    // 1. Write locally immediately
    const log = this._localGetBW().filter(e => e.date !== date);
    log.push({ date, w: weight });
    this._localSaveBW(log);

    // 2. Sync to Sheets in background
    if (CONFIG.SHEETS_URL && CONFIG.SHEETS_URL !== "YOUR_APPS_SCRIPT_URL_HERE") {
      try {
        await fetch(CONFIG.SHEETS_URL, {
          method: "POST",
          body: JSON.stringify({ action: "logBodyweight", date, weight })
        });
      } catch(e) { /* local save already done, silent fail */ }
    }
  },

  async deleteBodyweight(date) {
    // 1. Remove locally
    const log = this._localGetBW().filter(e => e.date !== date);
    this._localSaveBW(log);

    // 2. Sync deletion to Sheets
    if (CONFIG.SHEETS_URL && CONFIG.SHEETS_URL !== "YOUR_APPS_SCRIPT_URL_HERE") {
      try {
        await fetch(CONFIG.SHEETS_URL, {
          method: "POST",
          body: JSON.stringify({ action: "deleteBodyweight", date })
        });
      } catch(e) { /* silent */ }
    }
  },

  // Apple Health XML import — bulk write to Sheets after parsing
  async importAppleHealth(file, callback) {
    if (!file) return;
    UI.showToast("Parsing Apple Health data...");
    const text = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const records = xml.querySelectorAll('Record[type="HKQuantityTypeIdentifierBodyMass"]');

    const entries = [];
    records.forEach(r => {
      const date  = r.getAttribute("startDate")?.slice(0, 10);
      const unit  = r.getAttribute("unit");
      let   value = parseFloat(r.getAttribute("value"));
      if (!date || isNaN(value)) return;
      if (unit === "kg") value = Math.round(value * 2.20462 * 10) / 10;
      entries.push({ date, w: value });
    });

    // Dedupe by date (keep last entry per day)
    const byDate = {};
    entries.forEach(e => { byDate[e.date] = e; });
    const deduped = Object.values(byDate);

    // Save all to localStorage
    const existing = this._localGetBW();
    const merged = Object.values(
      [...existing, ...deduped].reduce((acc, e) => { acc[e.date] = e; return acc; }, {})
    );
    this._localSaveBW(merged);

    // Bulk sync to Sheets
    if (CONFIG.SHEETS_URL && CONFIG.SHEETS_URL !== "YOUR_APPS_SCRIPT_URL_HERE") {
      UI.showToast(`Syncing ${deduped.length} entries to Sheets...`);
      try {
        await fetch(CONFIG.SHEETS_URL, {
          method: "POST",
          body: JSON.stringify({ action: "importBodyweight", entries: deduped })
        });
      } catch(e) { /* local already saved */ }
    }

    UI.showToast(`Imported ${deduped.length} weight entries ✓`);
    if (callback) callback();
  },

  getSuggestedDay() {
    const dow = new Date().getDay();
    return DAY_SUGGESTIONS[dow] || "dayA";
  },

  // ── CLAUDE EXPORT ────────────────────────────────────────────────────────
  async buildClaudeExport() {
    const { sessions } = await this.fetchHistory();
    const stats = await this.fetchStats();
    const now = new Date().toISOString().split("T")[0];

    // Last 3 weeks of sessions
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 21);
    const recent = sessions.filter(s => new Date(s.date) >= cutoff);

    // Format each session
    const sessionLines = recent.map(s => {
      const exLines = s.exercises.map(ex => {
        const sets = ex.sets.map(st => `${st.weight}×${st.reps}`).join(", ");
        return `    ${ex.name}: ${sets}`;
      }).join("\n");
      return `${s.date} — ${s.dayTitle}\n${exLines}`;
    }).join("\n\n");

    // Current program defaults for context
    const programLines = Object.values(PROGRAM)
      .filter(d => !d.sportOnly)
      .map(d => {
        const exLines = (d.exercises || []).map(ex => {
          const sets = ex.sets.map(s => `${s.weight}×${s.reps}`).join(", ");
          return `    ${ex.name}: ${sets}`;
        }).join("\n");
        return `${d.title}\n${exLines}`;
      }).join("\n\n");

    // Bests
    const bestLines = Object.values(stats.bests || {})
      .map(b => `  ${b.name}: ${b.weight}×${b.reps} (${b.date})`)
      .join("\n");

    // Stretch targets
    const stretchLines = Object.values(stats.stretches || {})
      .map(s => `  ${s.name}: currently ${s.current} → target ${s.target}`)
      .join("\n");

    // Bodyweight — last 30 entries
    const bwLog = await this.getBodyweightLog();
    const bwRecent = bwLog.slice(-30);
    const bwLatest = bwRecent[bwRecent.length - 1];
    const bwFirst  = bwRecent[0];
    const bwChange = bwLatest && bwFirst
      ? (bwLatest.w - bwFirst.w).toFixed(1) : null;
    const bwLines = bwRecent
      .map(e => `  ${e.date}: ${e.w} lbs`)
      .join("\n");

    const currentWeek = getCurrentWeek();
    const currentPhase = WEEK_PHASES[currentWeek] || "strength";

    const text = `
HEBOMB TRAINING CHECK-IN — ${now}
User: ${CONFIG.USER}
Current week: ${currentWeek}/13 · Phase: ${currentPhase.toUpperCase()}
Goal: ${CONFIG.GOAL_LB_LOW}–${CONFIG.GOAL_LB_HIGH} lbs bodyweight, lean recomp
Sessions last 7d: ${stats.last7} · last 30d: ${stats.last30} · avg/week: ${((stats.last30||0)/4.3).toFixed(1)}

━━━ BODYWEIGHT (last 30 entries) ━━━
Current: ${bwLatest ? bwLatest.w + " lbs" : "not logged"}
Change over period: ${bwChange !== null ? (bwChange > 0 ? "+" : "") + bwChange + " lbs" : "—"}
Goal zone: ${CONFIG.GOAL_LB_LOW}–${CONFIG.GOAL_LB_HIGH} lbs
${bwLines || "No bodyweight entries yet."}

━━━ LAST 3 WEEKS OF SESSIONS ━━━
${sessionLines || "No sessions logged yet."}

━━━ ALL-TIME BESTS ━━━
${bestLines || "None yet."}

━━━ CURRENT STRETCH TARGETS ━━━
${stretchLines || "None yet."}

━━━ CURRENT PROGRAM (program.js) ━━━
${programLines}

━━━ INSTRUCTIONS FOR CLAUDE ━━━
Review everything above. Based on the bodyweight trend, session data, and stretch targets:
1. Assess recomp progress — is weight moving the right direction relative to strength gains?
2. Flag any plateaus (same weight 3+ sessions on same lift)
3. Tell me what's working and what to change
4. Give me updated MAIN_LIFTS baseline weights for program.js if any need adjusting
5. Note any muscle groups being under- or over-worked
Goal: lean, chiseled, athletic — not bulk. Recomp over mass.
`.trim();

    return text;
  }
};
