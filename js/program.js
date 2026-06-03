// ─── HEBOMB — 13-WEEK PROGRAM WITH ROTATING ACCESSORIES ─────────────────────
//
// MAIN LIFTS: locked every week — these drive your physique over 13 weeks
//   Bench Press, Back Squat, RDL, Lat Pulldown, Power Clean
//
// ACCESSORIES: rotate each 3-week phase block — prevents adaptation, kills staleness
//   Push, Pull, Curl, Leg, Core accessories all swap per cycle
//
// PHASES (repeat 3x + peak):
//   Week 1,5,9  → Strength     4×5  heavy / long rest
//   Week 2,6,10 → Hypertrophy  4×8  moderate / medium rest
//   Week 3,7,11 → Conditioning 3×12 lighter / short rest
//   Week 4,8,12 → Deload       3×8  60% / recovery
//   Week 13     → Peak         test your new bests
//
// SCHEDULE: Mon=Upper, Wed=Lower, Fri=Olympic
// ─────────────────────────────────────────────────────────────────────────────

// ── PHASE DEFINITIONS ────────────────────────────────────────────────────────
const PHASES = {
  strength: {
    id: "strength", label: "STRENGTH",
    color: "#e8ff47",
    main:  { sets: 4, reps: 5,  rest: "3 min"   },
    acc:   { sets: 3, sets4: 4, reps: 6,  reps4: 6,  rest: "90 sec" },
    tip: "Heavy. Stop 1 rep before failure. Full rest between sets."
  },
  hypertrophy: {
    id: "hypertrophy", label: "HYPERTROPHY",
    color: "#ff6b35",
    main:  { sets: 4, reps: 8,  rest: "90 sec"  },
    acc:   { sets: 3, sets4: 4, reps: 10, reps4: 8,  rest: "60 sec" },
    tip: "Moderate weight. 2-sec descent every rep. Stop 1 before failure."
  },
  conditioning: {
    id: "conditioning", label: "CONDITIONING",
    color: "#4dff91",
    main:  { sets: 3, reps: 12, rest: "60 sec"  },
    acc:   { sets: 3, sets4: 3, reps: 15, reps4: 12, rest: "45 sec" },
    tip: "Lighter, faster, less rest. This is your metabolic work."
  },
  deload: {
    id: "deload", label: "DELOAD",
    color: "#4d9fff",
    main:  { sets: 3, reps: 8,  rest: "90 sec"  },
    acc:   { sets: 2, sets4: 2, reps: 10, reps4: 8,  rest: "60 sec" },
    tip: "60% of normal weight. Recovery. Focus on form and mobility."
  },
  peak: {
    id: "peak", label: "PEAK",
    color: "#ff4dff",
    main:  { sets: 5, reps: 3,  rest: "4 min"   },
    acc:   { sets: 3, sets4: 3, reps: 6,  reps4: 5,  rest: "90 sec" },
    tip: "Week 13. Go for new bests. This is what 12 weeks built toward."
  }
};

const WEEK_PHASES = {
  1:"strength", 2:"hypertrophy", 3:"conditioning", 4:"deload",
  5:"strength", 6:"hypertrophy", 7:"conditioning", 8:"deload",
  9:"strength", 10:"hypertrophy",11:"conditioning",12:"deload",
  13:"peak"
};

// Which accessory CYCLE (1, 2, or 3) is each week in?
// Weeks 1–4 = cycle 1, 5–8 = cycle 2, 9–13 = cycle 3
function getCycle(weekNum) {
  if (weekNum <= 4)  return 1;
  if (weekNum <= 8)  return 2;
  return 3;
}

// ── MAIN LIFTS (never change) ────────────────────────────────────────────────
// baseline = strength week working weight (4×5 clean)
// app scales other phases from this automatically

const MAIN_LIFTS = {
  bench: {
    id: "bench", name: "Bench Press",
    baseline: 145, deloadMult: 0.60,
    warmup: { reps: 8, weight: 95 },
    tips: {
      strength:    "Pause 1 sec at chest. 4×5 — add 5 lbs if all sets clean.",
      hypertrophy: "2-sec descent. Squeeze at top. Stop 1 before failure.",
      conditioning:"Lighter, faster. Full ROM. 60-sec rest only.",
      deload:      "Smooth and controlled. Own the movement.",
      peak:        "Work up to a heavy 3. New PR attempt on last set."
    }
  },
  latpull: {
    id: "latpull", name: "Lat Pulldown",
    baseline: 130, deloadMult: 0.60,
    warmup: { reps: 8, weight: 70 },
    tips: {
      strength:    "Heavy 5s. Drive elbows to hips, not just pulling with arms.",
      hypertrophy: "Full stretch at top. 2-sec up. Squeeze lats at bottom.",
      conditioning:"Higher reps, pump. Keep form, no swinging.",
      deload:      "Light. Full ROM. Shoulder health first.",
      peak:        "Heavy 3s. Best form you've had all program."
    }
  },
  squat: {
    id: "squat", name: "Back Squat",
    baseline: 195, deloadMult: 0.60,
    warmup: { reps: 5, weight: 135 },
    tips: {
      strength:    "Hit depth every rep. Add 5 lbs if all sets clean.",
      hypertrophy: "Controlled descent, explode up. 4×8 at 85%.",
      conditioning:"3×12, keep moving. 60-sec rest. Legs should burn.",
      deload:      "3×8 at 60%. Perfect mechanics. No grinding.",
      peak:        "3×3 working up to a heavy single attempt."
    }
  },
  rdl: {
    id: "rdl", name: "Romanian Deadlift",
    baseline: 155, deloadMult: 0.60,
    warmup: null,
    tips: {
      strength:    "Heavy 5s. Hip hinge, bar drags down legs. Feel the hamstring.",
      hypertrophy: "8 reps, slow lower. Stretch at bottom every rep.",
      conditioning:"12 reps, moderate. Own every inch of the ROM.",
      deload:      "Light. Hamstring mobility focus.",
      peak:        "Heavy 4s. Best posterior chain work of the program."
    }
  },
  clean: {
    id: "clean", name: "Power Clean",
    baseline: 135, deloadMult: 0.60,
    warmup: { reps: 3, weight: 65 },
    tips: {
      strength:    "Build to top weight. Explosive. Full reset each rep.",
      hypertrophy: "4×4 at 85%. Smooth and fast, not grinding.",
      conditioning:"5×3 at 70%. Crisp technique. Short rest.",
      deload:      "3×3 at 60%. Technique only. Perfect reps.",
      peak:        "Work to a heavy single. Best clean of the program."
    }
  }
};

// ── ACCESSORY POOLS ──────────────────────────────────────────────────────────
// 3 options per slot — one per cycle. All have baseline weights.

const ACC_POOLS = {

  // DAY A — UPPER ACCESSORIES
  push_acc: [
    // Cycle 1
    { id:"dbpress",   name:"DB Shoulder Press",   baseline:45,  tips:{strength:"Heavy 5s. No bounce at bottom.",hypertrophy:"2-sec descent. 8 clean reps.",conditioning:"12 reps, short rest. Shoulders burn.",deload:"Light. Perfect mechanics.",peak:"Heavy 5s — best overhead of program."} },
    // Cycle 2
    { id:"incline",   name:"Incline DB Press",     baseline:40,  tips:{strength:"Incline 5s. Full ROM top to bottom.",hypertrophy:"8 reps, squeeze at top.",conditioning:"12 reps, upper chest pump.",deload:"Light. Upper chest activation.",peak:"Heavy 5s — incline max."} },
    // Cycle 3
    { id:"dips",      name:"Weighted Dips",        baseline:25,  tips:{strength:"Add 25 lbs, 5 reps. Full dip depth.",hypertrophy:"8 reps, lean slightly forward.",conditioning:"12 reps BW or light plate.",deload:"BW only. Shoulder health.",peak:"Heaviest weighted dips — go for it."} }
  ],

  pull_acc: [
    // Cycle 1
    { id:"facepull",  name:"Face Pulls",            baseline:45,  tips:{strength:"Heavy 5s. Rotate hard at end.",hypertrophy:"8 reps, external rotation focus.",conditioning:"15 reps. Shoulder health investment.",deload:"Light. Rehab mode.",peak:"Heavy 5s."} },
    // Cycle 2
    { id:"cablerow",  name:"Cable Row",             baseline:120, tips:{strength:"Heavy 5s. Elbows tight to body.",hypertrophy:"8 reps, squeeze scapula at end.",conditioning:"12 reps, keep chest up.",deload:"Light. Full ROM.",peak:"Heavy 5s — best row of program."} },
    // Cycle 3
    { id:"chestrow",  name:"Chest-Supported Row",   baseline:50,  tips:{strength:"Heavy 5s DB each hand. No momentum.",hypertrophy:"8 reps, 2-sec squeeze.",conditioning:"12 reps, burn the mid-back.",deload:"Light. Form only.",peak:"Heavy 5s."} }
  ],

  curl_acc: [
    // Cycle 1
    { id:"curl",      name:"Straight Bar Curl",     baseline:55,  tips:{strength:"Heavy 5s. 3-sec negative.",hypertrophy:"8 reps, squeeze at top.",conditioning:"12 reps, pump. Elbows pinned.",deload:"Light. Perfect form.",peak:"Heavy 5s — bar curl max."} },
    // Cycle 2
    { id:"hammercurl",name:"Hammer Curl",           baseline:35,  tips:{strength:"Heavy 5s each. Neutral grip.",hypertrophy:"8 reps, slow negative.",conditioning:"12 reps, brachialis pump.",deload:"Light. Elbow health.",peak:"Heavy 5s — hammer max."} },
    // Cycle 3
    { id:"inclinecurl",name:"Incline DB Curl",      baseline:25,  tips:{strength:"Heavy 5s. Full stretch at bottom.",hypertrophy:"8 reps, peak contraction.",conditioning:"12 reps, full stretch every rep.",deload:"Light. Full ROM only.",peak:"Heavy 5s — best bicep isolation."} }
  ],

  latraise_acc: [
    // Cycle 1
    { id:"latraise",  name:"Lateral Raises",        baseline:15,  tips:{strength:"5 slow heavy reps. Lead with elbows.",hypertrophy:"8 reps, no momentum.",conditioning:"15 reps, burn it out.",deload:"Very light.",peak:"Heavy 5s."} },
    // Cycle 2
    { id:"cablelatr", name:"Cable Lateral Raise",   baseline:15,  tips:{strength:"Heavy 5s each side. Constant tension.",hypertrophy:"8 reps, squeeze at top.",conditioning:"15 reps, cable keeps tension.",deload:"Light.",peak:"Heavy 5s each side."} },
    // Cycle 3
    { id:"upright",   name:"Upright Row",           baseline:65,  tips:{strength:"Heavy 5s. Elbows above wrists.",hypertrophy:"8 reps, controlled.",conditioning:"12 reps, trap and delt pump.",deload:"Light. No shoulder impingement.",peak:"Heavy 5s."} }
  ],

  core_upper: [
    // Cycle 1
    { id:"plankpush", name:"Plank → Pushup Circuit",baseline:0, bodyweight:true, tips:{strength:"3×: 60s plank + 20 pushups. Rest 60s.",hypertrophy:"3×: 45s plank + 15 pushups.",conditioning:"4×: 30s plank + 12 pushups. Rest 30s.",deload:"2×: 30s plank + 10 pushups.",peak:"3×: 60s plank + 20 pushups."} },
    // Cycle 2
    { id:"cablecrunch",name:"Cable Crunch",         baseline:50, tips:{strength:"Heavy 5s. Full crunch down.",hypertrophy:"8 reps, squeeze at bottom.",conditioning:"15 reps, keep moving.",deload:"Light. Core activation.",peak:"Heavy 5s."} },
    // Cycle 3
    { id:"lsithold",  name:"L-Sit + Tuck Hold",    baseline:0, bodyweight:true, tips:{strength:"3×20s L-sit hold. Full extension.",hypertrophy:"3×15s. Build to straight legs.",conditioning:"4×10s with 10 knee raises.",deload:"2×10s tuck hold.",peak:"Max hold — show 12 weeks of core work."} }
  ],

  // DAY B — LOWER ACCESSORIES
  leg_acc: [
    // Cycle 1
    { id:"bss",       name:"Bulgarian Split Squat", baseline:30,  tips:{strength:"5 each leg, heavy DBs.",hypertrophy:"8 each, 2-sec descent.",conditioning:"12 each, lighter. Legs on fire.",deload:"8 each, BW or very light.",peak:"Heavy 5s each — best BSS of program."} },
    // Cycle 2
    { id:"legpress",  name:"Leg Press",             baseline:270, tips:{strength:"Heavy 5s. Full ROM, don't lock out.",hypertrophy:"8 reps, 2-sec descent.",conditioning:"15 reps, quad pump.",deload:"Light. Knee health.",peak:"Heavy 5s — leg press max."} },
    // Cycle 3
    { id:"lunge",     name:"Walking Lunges",        baseline:30,  tips:{strength:"5 each leg heavy DBs. Long stride.",hypertrophy:"8 each, controlled.",conditioning:"15 each, lighter. Glute burn.",deload:"BW only.",peak:"Heavy 5s each — go for it."} }
  ],

  hamstring_acc: [
    // Cycle 1
    { id:"legcurl",   name:"Leg Curl",              baseline:75,  tips:{strength:"Heavy 5s. Full contraction.",hypertrophy:"8, 3-sec negative.",conditioning:"12 reps, hamstring pump.",deload:"Light. Full ROM.",peak:"Heavy 5s."} },
    // Cycle 2
    { id:"nordichams", name:"Nordic Hamstring Curl", baseline:0, bodyweight:true, tips:{strength:"5 slow reps. Eccentric control.",hypertrophy:"8 reps, as slow as possible.",conditioning:"10 reps BW. Brutal.",deload:"5 very slow reps.",peak:"Max reps — hardest hamstring test."} },
    // Cycle 3
    { id:"goodmorning",name:"Good Morning",         baseline:65,  tips:{strength:"5 heavy reps. Hinge hard.",hypertrophy:"8 reps, feel the hamstring.",conditioning:"12 reps, moderate.",deload:"Light. Mobility focus.",peak:"Heavy 5s."} }
  ],

  calf_acc: [
    // All cycles — calves need consistent work, just vary reps via phase
    { id:"calf_stand", name:"Standing Calf Raise",  baseline:35, tips:{strength:"Heavy 5s. Pause top and bottom.",hypertrophy:"8 slow reps. Full ROM.",conditioning:"20 reps. Fast but full.",deload:"Light. Stretch focus.",peak:"Heavy 5s."} },
    { id:"calf_seat",  name:"Seated Calf Raise",    baseline:90, tips:{strength:"Heavy 5s. Soleus focus.",hypertrophy:"10 reps. Slow and full.",conditioning:"20 reps.",deload:"Light.",peak:"Heavy 5s — seated max."} },
    { id:"calf_stand", name:"Standing Calf Raise",  baseline:35, tips:{strength:"Heavy 5s.",hypertrophy:"8 slow reps.",conditioning:"20 reps.",deload:"Light.",peak:"Heavy 5s."} }
  ],

  core_lower: [
    // Cycle 1
    { id:"abwheel",   name:"Ab Wheel Rollout",      baseline:0, bodyweight:true, tips:{strength:"3×8 slow. Hips stay level.",hypertrophy:"3×10. Control out and back.",conditioning:"4×12. Keep moving.",deload:"2×8. Easy.",peak:"3×10 — full extension."} },
    // Cycle 2
    { id:"hangknee",  name:"Hanging Knee Raise",    baseline:0, bodyweight:true, tips:{strength:"3×10 slow. No swing.",hypertrophy:"3×12. Pause at top.",conditioning:"4×15. Short rest.",deload:"2×10. Easy.",peak:"3×12 straight leg if possible."} },
    // Cycle 3
    { id:"dragonfl",  name:"Dragon Flag",           baseline:0, bodyweight:true, tips:{strength:"3×5. Full extension if possible.",hypertrophy:"3×8. Tuck if needed.",conditioning:"4×10 tuck.",deload:"2×5 tuck.",peak:"Max reps full dragon flag."} }
  ],

  sideplank_acc: [
    // All cycles — varies by phase reps only
    { id:"sideplank", name:"Side Plank", baseline:0, bodyweight:true, tips:{strength:"2×45s each side.",hypertrophy:"2×40s each side.",conditioning:"3×30s each side.",deload:"2×20s.",peak:"2×60s each side."} },
    { id:"sideplank", name:"Side Plank", baseline:0, bodyweight:true, tips:{strength:"2×45s each.",hypertrophy:"2×40s each.",conditioning:"3×30s each.",deload:"2×20s.",peak:"2×60s each."} },
    { id:"sideplank", name:"Side Plank", baseline:0, bodyweight:true, tips:{strength:"2×45s each.",hypertrophy:"2×40s each.",conditioning:"3×30s each.",deload:"2×20s.",peak:"2×60s each."} }
  ],

  // DAY C — OLYMPIC ACCESSORIES
  snatch_acc: [
    { id:"snatch",    name:"Snatch / Hang Snatch",  baseline:95, tips:{strength:"4×2 to top weight. Pretty over heavy.",hypertrophy:"4×3 at 85%. Speed through the middle.",conditioning:"5×3 at 70%. Hang if full breaks down.",deload:"3×2 at 60%. Technique only.",peak:"Work to heavy single — new snatch PR."} },
    { id:"snatch",    name:"Hang Snatch",           baseline:85, tips:{strength:"4×3 hang. Control the catch.",hypertrophy:"4×4 at 85%.",conditioning:"5×3 at 70%.",deload:"3×3 light.",peak:"Heavy 3 hang snatch."} },
    { id:"snatch",    name:"Power Snatch",          baseline:90, tips:{strength:"4×2. Catch above parallel.",hypertrophy:"4×3 at 85%.",conditioning:"5×3 at 70%.",deload:"3×2 light.",peak:"Work to max power snatch."} }
  ],

  jerk_acc: [
    { id:"jerk",      name:"Push Press",            baseline:120, tips:{strength:"4×3 heavy. Dip-drive-lock.",hypertrophy:"4×5 at 85%. Clean extension.",conditioning:"3×8 push press. Shoulder stamina.",deload:"3×5 light. Mechanics.",peak:"Heavy 3 — push press max."} },
    { id:"jerk",      name:"Push Jerk",             baseline:115, tips:{strength:"4×2 jerk. Catch in dip.",hypertrophy:"4×3 at 85%.",conditioning:"3×6 at 70%.",deload:"3×3 light.",peak:"Work to max push jerk."} },
    { id:"jerk",      name:"Split Jerk",            baseline:110, tips:{strength:"4×2. Aggressive split.",hypertrophy:"4×3 at 85%.",conditioning:"3×5 at 70%.",deload:"3×2 very light.",peak:"Max split jerk — full send."} }
  ],

  squat_fri_acc: [
    { id:"squat_fri", name:"Back Squat (Fri)",      baseline:205, tips:{strength:"3×3 heavy. Heavier than Monday.",hypertrophy:"3×6 at 85%.",conditioning:"4×8 at 70%.",deload:"3×5 at 60%.",peak:"Work to 1RM — peak squat."} },
    { id:"frsquat",   name:"Front Squat",           baseline:155, tips:{strength:"3×3 front squat. Upright torso.",hypertrophy:"3×5 at 85%.",conditioning:"4×8 at 70%.",deload:"3×5 light.",peak:"Heavy 3 front squat."} },
    { id:"paused",    name:"Paused Squat",          baseline:165, tips:{strength:"3×3 with 3s pause at bottom.",hypertrophy:"3×5 paused.",conditioning:"4×6 paused.",deload:"3×5 very light paused.",peak:"Max paused squat — brutal test."} }
  ],

  rdl_fri_acc: [
    { id:"rdl_fri",   name:"RDL (Fri)",             baseline:175, tips:{strength:"3×4 heavy. Heavier than Wednesday.",hypertrophy:"3×6 at 85%.",conditioning:"4×10 at 70%.",deload:"3×6 at 60%.",peak:"Heavy 4s — best RDL of program."} },
    { id:"trap",      name:"Trap Bar Deadlift",      baseline:225, tips:{strength:"3×3 heavy trap bar.",hypertrophy:"3×5 at 85%.",conditioning:"4×8 at 70%.",deload:"3×5 at 60%.",peak:"Max trap bar — new PR."} },
    { id:"sldl",      name:"Single-Leg RDL",         baseline:35,  tips:{strength:"5 each leg, heavy DB. Balance + strength.",hypertrophy:"8 each at 85%.",conditioning:"10 each at 70%.",deload:"5 each light.",peak:"Heavy 5s each — best SLRDL."} }
  ]
};

// ── BUILD SETS FOR AN EXERCISE ────────────────────────────────────────────────
function w5(n) { return Math.round(n / 5) * 5; } // round to nearest 5 lbs

function buildSets(ex, phaseId, isMain) {
  const phase = PHASES[phaseId];
  const cfg = isMain ? phase.main : phase.acc;

  if (ex.bodyweight) {
    const repMap = {
      strength: "5", hypertrophy: "8", conditioning: "12", deload: "8", peak: "max"
    };
    const numSets = cfg.sets || 3;
    return Array(numSets).fill(null).map(() => ({ reps: repMap[phaseId], weight: 0 }));
  }

  const mult = phaseId === "deload" ? (ex.deloadMult || 0.60) :
               phaseId === "peak"   ? 1.05 :
               isMain               ? 1.0  :
               phaseId === "strength"    ? 1.0  :
               phaseId === "hypertrophy" ? 0.85 :
               phaseId === "conditioning"? 0.70 : 0.60;

  const working = w5(ex.baseline * mult);
  const numSets = isMain ? cfg.sets : (cfg.sets || 3);
  const reps    = isMain ? cfg.reps : (cfg.reps || 8);

  const sets = [];
  if (ex.warmup) sets.push({ ...ex.warmup, note: "warm-up" });
  for (let i = 0; i < numSets; i++) sets.push({ reps, weight: working });
  return sets;
}

function getAcc(pool, cycle) {
  return pool[Math.min(cycle - 1, pool.length - 1)];
}

// ── BUILD A FULL WEEK ─────────────────────────────────────────────────────────
function buildWeek(weekNum) {
  const phaseId = WEEK_PHASES[weekNum] || "strength";
  const phase   = PHASES[phaseId];
  const cycle   = getCycle(weekNum);

  function ex(def, isMain) {
    const tip = def.tips ? (def.tips[phaseId] || "") : "";
    return {
      id: def.id, name: def.name,
      sets: buildSets(def, phaseId, isMain),
      rest: isMain ? phase.main.rest : phase.acc.rest,
      tip,
      bodyweight: def.bodyweight || false
    };
  }

  // Pick accessories for this cycle
  const pushAcc   = getAcc(ACC_POOLS.push_acc,   cycle);
  const pullAcc   = getAcc(ACC_POOLS.pull_acc,   cycle);
  const curlAcc   = getAcc(ACC_POOLS.curl_acc,   cycle);
  const latAcc    = getAcc(ACC_POOLS.latraise_acc, cycle);
  const coreUp    = getAcc(ACC_POOLS.core_upper, cycle);
  const legAcc    = getAcc(ACC_POOLS.leg_acc,    cycle);
  const hamAcc    = getAcc(ACC_POOLS.hamstring_acc, cycle);
  const calfAcc   = getAcc(ACC_POOLS.calf_acc,   cycle);
  const coreLo    = getAcc(ACC_POOLS.core_lower, cycle);
  const sideAcc   = getAcc(ACC_POOLS.sideplank_acc, cycle);
  const snatAcc   = getAcc(ACC_POOLS.snatch_acc, cycle);
  const jerkAcc   = getAcc(ACC_POOLS.jerk_acc,   cycle);
  const sqFriAcc  = getAcc(ACC_POOLS.squat_fri_acc, cycle);
  const rdlFriAcc = getAcc(ACC_POOLS.rdl_fri_acc, cycle);

  const isDeload = phaseId === "deload";

  return {
    weekNum, phaseId, phase, cycle,
    days: {
      dayA: {
        id: "dayA", label: `Wk${weekNum} · Mon`,
        title: "Upper — Push + Pull",
        phaseId, phase,
        exercises: [
          ex(MAIN_LIFTS.bench,   true),
          ex(MAIN_LIFTS.latpull, true),
          ex(pushAcc,  false),
          ex(pullAcc,  false),
          ex(latAcc,   false),
          ex(curlAcc,  false),
          ex(coreUp,   false)
        ],
        finisher: isDeload
          ? "10 min easy walk — no incline, recovery only"
          : "15 min incline walk · 12% · 3.0–3.5 mph"
      },
      dayB: {
        id: "dayB", label: `Wk${weekNum} · Wed`,
        title: "Lower + Core",
        phaseId, phase,
        exercises: [
          ex(MAIN_LIFTS.squat, true),
          ex(MAIN_LIFTS.rdl,   true),
          ex(legAcc,  false),
          ex(hamAcc,  false),
          ex(calfAcc, false),
          ex(coreLo,  false),
          ex(sideAcc, false)
        ],
        finisher: isDeload
          ? "10 min easy walk — no incline, recovery only"
          : "15 min incline walk · 12% · 3.0–3.5 mph"
      },
      dayC: {
        id: "dayC", label: `Wk${weekNum} · Fri`,
        title: "Olympic + Power",
        phaseId, phase,
        exercises: [
          ex(MAIN_LIFTS.clean, true),
          ex(snatAcc,   false),
          ex(jerkAcc,   false),
          ex(sqFriAcc,  false),
          ex(rdlFriAcc, false)
        ]
      }
    }
  };
}

// ── BUILD ALL 13 WEEKS ────────────────────────────────────────────────────────
const WEEKS = {};
for (let w = 1; w <= 13; w++) { WEEKS[w] = buildWeek(w); }

// ── WEEK TRACKING ─────────────────────────────────────────────────────────────
function getCurrentWeek() {
  return parseInt(localStorage.getItem("hebomb_week") || "1", 10);
}
function setCurrentWeek(w) {
  localStorage.setItem("hebomb_week", String(Math.max(1, Math.min(13, w))));
}

// ── APP-FACING PROGRAM ────────────────────────────────────────────────────────
const PROGRAM = {
  get dayA()  { return WEEKS[getCurrentWeek()].days.dayA; },
  get dayB()  { return WEEKS[getCurrentWeek()].days.dayB; },
  get dayC()  { return WEEKS[getCurrentWeek()].days.dayC; },
  sport: {
    id: "sport", label: "Sport",
    title: "Basketball / Pickleball / Hike",
    color: "green",
    description: "Log your sport session.",
    sportOnly: true
  }
};

const DAY_SUGGESTIONS = {
  0:"sport", 1:"dayA", 2:"sport", 3:"dayB", 4:"sport", 5:"dayC", 6:"sport"
};
