"use strict";
/* Office life (shared by the trading floor and Research Inc. B1). Zero AI tokens: every reaction is detected in code from
   changes in data the page already polls (state.json trades/events/accounts/regime/market/tuning, /b1/data.json briefs,
   signals, lessons, calls, events, research visits). Staff walk to EXISTING standing spots in front of props (already in the
   walk graph, so collisions are unchanged) and the renderer animates the prop while they use it.
   window.LIFE: fire(k, secs, data) / on(k) / prog(k) = prop effects; hold/view/commit = boards keep the old content until
   someone physically updates them; user(spotKeys) = who is standing at a prop right now; glow = desk-sign glows. */
(function () {
const ON_B1 = typeof window.__b1 === "object" && typeof dataChanges === "function";
const MAIN = !ON_B1 && typeof onTrade === "function" && typeof WALLS !== "undefined";
if (!ON_B1 && !MAIN) return;
const L = window.LIFE = { fx: {}, held: {}, glow: {}, floor: ON_B1 ? "b1" : "main" };
L.fire = (k, secs, data) => { L.fx[k] = { t0: T, until: T + secs, data }; };
L.on = (k) => (L.fx[k] && T < L.fx[k].until ? L.fx[k] : null);
L.prog = (k) => { const f = L.on(k); return f ? (T - f.t0) / (f.until - f.t0) : -1; };
L.hold = (k, v) => { if (!(k in L.held)) L.held[k] = { v, t: T }; };
L.view = (k, cur) => { const h = L.held[k]; if (h && T - h.t < 75) return h.v; delete L.held[k]; return cur; };
L.commit = (k) => { delete L.held[k]; };
L.user = (keys) => { for (const key of keys) { const s = SPOTS[key]; if (!s) continue; for (const id of ORDER) { const c = chars[id]; if (c && !c.hidden && c.tx === s.x && c.ty === s.y && !c.moving && !(c.path && c.path.length)) return c; } } return null; };
const spot = (keys, id) => { const k = freeSpot(keys, id); return k ? SPOTS[k] : null; };
const vis = (id) => chars[id] && !chars[id].hidden;
const etHM = () => { try { const e = etNow(); return { h: e.hh, m: e.mm, wd: e.wd }; } catch (er) { return { h: 12, m: 0, wd: "Mon" }; } };

// ================================================================= B1 (Research Inc.)
if (ON_B1) {
  const freeB = (id) => vis(id) && !isAway(id) && !activeTrip(id) && (!chars[id].task || ["errand", "home", "pong"].includes(chars[id].task.label));
  const after = (id, steps, workDur) => {   // chain prop steps after the "working at my desk" step dataChanges just set
    const c = chars[id]; if (!vis(id) || isAway(id) || !c.task || c.task.label !== "work") return false;
    if (workDur && c.task.steps[0]) c.task.steps[0].dur = workDur;
    for (const s of steps) if (s.spot) c.task.steps.push(s); return true;
  };
  const _dc = dataChanges;
  dataChanges = function (prev, cur) {
    _dc(prev, cur); if (!prev || !cur) return;
    try {
      // signals.json -> Sage pins/replaces sticky notes on the IDEAS corkboard (board keeps the old notes until then)
      const ps = prev.signals || {}, cs = cur.signals || {};
      if (cs.mtime && cs.mtime !== ps.mtime) { L.hold("signals", ps.data || {});
        if (!after("sage", [{ spot: spot(["ideas_1", "ideas_2"], "sage") || SPOTS.ideas_1, dur: 6, say: "PINNING NEW IDEAS", onArrive: () => { L.fire("cork", 6); setTimeoutSim(() => L.commit("signals"), 2.5); } }], 6)) L.commit("signals"); }
      // a new or revised brief -> author prints it, collects the pages, staples them at the archive, keeps the folder
      const pb = {}; for (const b of prev.briefs || []) pb[b.name] = b.mtime;
      for (const b of (cur.briefs || []).slice(0, 3)) if (pb[b.name] !== b.mtime) {
        const id = briefOwner(b); L.hold("brief", (prev.briefs || [])[0] || null);
        const ok = after(id, [
          { spot: spot(["printer_1", "printer_2"], id) || SPOTS.printer_1, dur: 5, say: "PRINTING IT", onArrive: () => { L.fire("print", 5, { who: id }); setTimeoutSim(() => L.commit("brief"), 3); } },
          { spot: spot(["archive_1", "archive_2", "archive_3"], id) || SPOTS.archive_2, dur: 3, say: "STAPLED", onArrive: () => { chars[id].carry = true; L.fire("staple", 1.6, { who: id }); setTimeoutSim(() => { if (!activeTrip(id)) chars[id].carry = false; }, 40); } },
        ], 7);
        if (!ok) L.commit("brief"); break;
      }
      // lessons.md -> Proof writes on the whiteboard (marker), then the new lines appear; calls log -> Proof updates CALLS
      const lm = (x) => (x && x.lessons && x.lessons.mtime) || null;
      if (lm(cur) && lm(cur) !== lm(prev)) { L.hold("lessons", prev.lessons || null);
        if (!after("proof", [{ spot: spot(["lessons_1", "lessons_2"], "proof") || SPOTS.lessons_1, dur: 6, say: "WRITING IT UP", onArrive: () => { L.fire("marker", 6); setTimeoutSim(() => L.commit("lessons"), 4); } }], 5)) L.commit("lessons"); }
      else if (cur.calls && prev.calls && (cur.calls.total !== prev.calls.total || cur.calls.hit_rate !== prev.calls.hit_rate)) { L.hold("calls", prev.calls);
        if (!after("proof", [{ spot: spot(["score_1", "score_2"], "proof") || SPOTS.score_1, dur: 5, say: "GRADING CALLS", onArrive: () => { L.fire("callsboard", 5); setTimeoutSim(() => L.commit("calls"), 2.5); } }], 5)) L.commit("calls"); }
      // new squawk / floor event -> Scoop flips channels at the news wall
      const pe = (prev.events || []).length, ce = (cur.events || []).length, lastE = (cur.events || [])[ce - 1], prevE = (prev.events || [])[pe - 1];
      if (lastE && (!prevE || lastE.ts !== prevE.ts || ce !== pe)) newsFlip("CHANNEL CHECK");
    } catch (e) { /* never break the sim */ }
  };
  function newsFlip(cap) { if (!freeB("scoop")) { L.fire("tv", 3); return; } const s = spot(["news_2", "news_1", "news_3"], "scoop"); if (!s) return;
    setTask("scoop", [{ spot: s, dur: 6, say: cap, onArrive: () => L.fire("tv", 6) }, { spot: home("scoop"), dur: 0 }], "errand"); }
  // watchers: tube whoosh when someone heads upstairs, SPY move buckets (breaking news), shift start coffee + huddle
  let goingSeen = new Set(), spyB = null; const shiftDone = {};
  setInterval(() => { try {
    for (const id of ORDER) { const c = chars[id], g = c && c.task && c.task.label === "goingup"; if (g && !goingSeen.has(id)) { goingSeen.add(id); L.fire("tube", 3.2); } if (!g) goingSeen.delete(id); }
    const k = typeof tick === "function" ? tick("SPY") : null; if (k && k.chg_pct != null) { const b = Math.floor(Math.abs(k.chg_pct) * 100); if (spyB != null && b > spyB && b >= 1) newsFlip(`SPY ${k.chg_pct >= 0 ? "UP" : "DOWN"} ${b}%!`); spyB = b; }
    const t = etHM(); if (t.wd === "Sat" || t.wd === "Sun") return; const day = (typeof dayKey === "function" ? dayKey() : new Date().toDateString());
    for (const s of shiftList()) { const [h, m] = String(s.time_et).split(":").map(Number), key = day + s.time_et; if (t.h === h && t.m >= m && t.m < m + 2 && !shiftDone[key]) { shiftDone[key] = 1; shiftStart(s); } }
  } catch (e) { /* */ } }, 1000);
  function shiftStart(s) {
    L.fire("shift", 12, { name: s.name || s.id }); const crew = ORDER.filter((id) => id !== "nancy" && freeB(id)), hs = HUDDLE.slice();
    crew.forEach((id, n) => { const st = []; if (n < 2) st.push({ spot: SPOTS["coffee_" + (n + 1)], dur: 4, say: n === 0 ? "COFFEE FIRST" : null });
      st.push({ spot: SPOTS[hs[n % hs.length]], dur: 8, say: n === 0 ? "SHIFT HUDDLE" : null }, { spot: home(id), dur: 0 }); setTask(id, st, "huddle"); });
    if (crew.length) amb(crew[0], "starts the " + String(s.name || s.id).toLowerCase() + " shift with coffee and a huddle");
  }
  L.newsFlip = newsFlip; L.shiftStart = shiftStart;
}

// ================================================================= upper floor (Tendies and Dip)
if (MAIN) {
  const freeM = (id) => vis(id) && !chars[id].task;
  const DESK = { day: ["dash", "vee", "snap"], swing: ["trek", "dip", "rota", "drift", "zip"] };
  // a BUY prints a ticket at the copier first; the trader carries it into El Jefe's office
  const _ot = onTrade;
  onTrade = function (t) {
    _ot(t);
    try { if (t.side !== "BUY" && Math.abs(t.pnl || 0) >= 20) glowDesk(t.account, (t.pnl || 0) >= 0);
      const id = t.bot, c = chars[id]; if (!c || c.hidden || !c.task || c.task.label !== "takes a ticket to El Jefe") return;
      const s = spot(["copier", "copier_2"], id); if (!s) return; const last = c.task.steps[c.task.steps.length - 1], oa = last.onArrive;
      last.onArrive = () => { c.carry = false; L.fire("ticket", 6, { who: id }); if (oa) oa(); };
      c.task.steps.unshift({ spot: s, dur: 2.6, say: "PRINTING TICKET", onArrive: () => { L.fire("copier", 2.6, { who: id }); setTimeoutSim(() => { c.carry = true; }, 2.2); } });
      c.task.t0 = T;
    } catch (e) { /* */ }
  };
  function glowDesk(d, up) { if (!DESK[d]) return; L.glow[d] = { until: T + 10, up };
    DESK[d].filter(vis).forEach((id, n) => { emote(id, up ? "cheer" : "sweat", 3); if (up) chars[id].jumpUntil = T + 1.2; if (n === 0) say(id, up ? "LET'S GO!" : "OOF. WE'LL GET IT BACK", 3, up ? "up" : "dn"); }); }
  let last = null, riSeen = new Set(), lastJam = -999;
  setInterval(() => { try {
    if (typeof S === "undefined" || !S) return;
    const cur = { mkt: S.market && S.market.status, reg: JSON.stringify(S.regime ? { b: !!S.regime.block, m: S.regime.mult } : null), tun: ((S.tuning && S.tuning.recent_changes) || []).length, pnl: {} };
    for (const d of ["day", "swing"]) cur.pnl[d] = S.accounts && S.accounts[d] ? S.accounts[d].pnl_today || 0 : 0;
    if (last) {
      for (const d of ["day", "swing"]) { const dv = cur.pnl[d] - last.pnl[d]; if (Math.abs(dv) >= 25) glowDesk(d, dv > 0); }
      if (cur.mkt !== last.mkt) { L.fire("mkt", 8, { to: cur.mkt });
        if (cur.mkt === "open") { say("goldie", "OPENING BELL!", 4, "up"); for (const id of ORDER) if (vis(id) && !RI[id] && Math.random() < 0.5) emote(id, "!", 2); }
        else if (cur.mkt === "closed" || cur.mkt === "after-hours") say("grok", "THAT'S THE BELL. NICE WORK.", 4); }
      if (cur.reg !== last.reg || cur.tun !== last.tun) { const on = S.regime && !S.regime.block && (S.regime.mult || 0) >= 1; if (cur.reg !== last.reg) L.fire("risk", 8, { on });
        if (freeM("knobs")) setTask("knobs", [{ spot: spot(["board", "board2"], "knobs") || SPOTS.board, dur: 6, say: cur.reg !== last.reg ? (on ? "RISK ON. NOTED." : "RISK OFF. WRITING IT UP") : "NEW PARAMS ON THE BOARD", onArrive: () => L.fire("rdwrite", 6) }], "updates the R&D whiteboard"); }
    }
    last = cur;
    // a Research Inc. visitor walks in -> Goldie's phone rings and she answers
    for (const id of RI_IDS) { const v = vis(id); if (v && !riSeen.has(id)) { riSeen.add(id); L.fire("phone", 2.2); setTimeoutSim(() => { if (vis("goldie")) { chars.goldie.phoneUntil = T + 4; say("goldie", "FRONT DESK! RESEARCH IS ON THE WAY UP", 4); } }, 1.4); } if (!v) riSeen.delete(id); }
    // broken-copier day: paper jams send Pixel over to clear them
    const ev = window.__seasons ? window.__seasons.events() : {}, broke = ev.copier && !(chars.tech && chars.tech.fixedDay === window.__seasons.D().k);
    if (broke && T - lastJam > 150 && freeM("pixel")) { lastJam = T; const s = spot(["copier", "copier_2"], "pixel");
      if (s) setTask("pixel", [{ spot: s, dur: 6, say: "PAPER JAM. AGAIN.", onArrive: () => { L.fire("jam", 6); setTimeoutSim(() => say("pixel", "CLEARED. FOR NOW.", 3), 4.5); } }], "clears a paper jam"); }
  } catch (e) { /* */ } }, 1000);
  L.glowDesk = glowDesk;
}

// ================================================================= daily happenings (visual only; date-seeded, same all day)
// ?day=YYYY-MM-DD re-rolls the pick for screenshots; ?happen=anniversary,cards,dog forces a list. Sessions only start in the
// lunch (12:00-13:30 ET) and after-close (16:10-17:45 ET) windows, only with free staff, and never preempt real-event tasks.
const Q = new URLSearchParams(location.search);
const emo = (id, e, secs) => { if (typeof emote === "function") return emote(id, e, secs); const c = chars[id]; if (c) { c.emote = e; c.emoteUntil = T + secs; } };
const hfnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const realDay = () => (window.TND && window.TND.dayKey ? window.TND.dayKey() : new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()));
const DAY = /^\d{4}-\d{2}-\d{2}$/.test(Q.get("day") || "") ? Q.get("day") : realDay();
const STAFF = ON_B1 ? ["scoop", "tape", "beats", "sage", "proof"] : ["dash", "vee", "zip", "snap", "trek", "dip", "rota", "drift", "knobs", "pixel", "goldie"];
const DOGS = [["golden retriever", "#d9a441", null], ["black lab", "#2f2a26", null], ["beagle", "#f2ead8", "#8b5a2b"], ["dalmatian", "#f6f4ef", "#1d1d1d"], ["corgi", "#d98c3a", "#f6f1e6"], ["husky", "#8f97a0", "#f2f2f2"], ["dachshund", "#7a4220", null]];
const CATS = [["orange tabby", "#e08a3c", "#b8642a"], ["black cat", "#232020", null], ["tuxedo cat", "#262424", "#f4f1ea"], ["grey cat", "#8d939a", "#6f757c"], ["calico", "#f4ede0", "#d4823a"], ["siamese", "#efe3cf", "#5a4636"]];
function pickHappen(day) {
  const r = (k) => hfnv(day + ":" + L.floor + ":h:" + k), wd = new Date(day + "T12:00:00Z").getUTCDay(), out = [];
  if (Q.get("happen")) return Q.get("happen").split(",").map((v) => v.trim()).filter(Boolean);
  if (r("quiet") >= 0.22) {
    const parties = ["anniversary", "bigwin", "potluck"].concat(wd === 5 ? ["pizzafri", "pizzafri", "pizzafri"] : []), games = ON_B1 ? ["pingpong", "darts", "cards", "arcade", "planes"] : ["cards", "planes"];
    const party = r("kind") < 0.42, pk = (a, k) => a[Math.floor(r(k) * a.length)];
    out.push(wd === 5 && r("pz") < 0.5 ? "pizzafri" : party ? pk(parties, "p") : pk(games, "g")); if (r("two") < 0.3) { const v = party || out[0] === "pizzafri" ? pk(games, "g2") : pk(parties, "p2"); if (!out.includes(v)) out.push(v); }
  }
  if (r("pet") < 0.42) { const k = r("pk"); out.push(k < 0.5 ? "dog" : k < 0.85 ? "cat" : "dog", ...(k >= 0.85 ? ["cat"] : [])); }
  return out;
}
const H = L.happen = { day: DAY, list: pickHappen(DAY) };
H.pick = pickHappen;   // diagnostics: LIFE.happen.pick('2026-10-09')
H.has = (k) => H.list.some((v) => v === k || v.startsWith(k + ":"));
const forcedBreed = (k) => { const v = H.list.find((q) => q.startsWith(k + ":")); return v ? v.slice(k.length + 1).replace(/_/g, " ") : null; };
H.who = STAFF[Math.floor(hfnv(DAY + ":" + L.floor + ":who") * STAFF.length)];
H.years = 1 + Math.floor(hfnv(DAY + ":yrs") * 9);
H.banner = H.has("anniversary") ? `HAPPY ${H.years} YEAR${H.years > 1 ? "S" : ""}, ${String((CAST[H.who] && CAST[H.who].name) || H.who).toUpperCase()}!` : H.has("bigwin") ? "BIG WIN PARTY!" : H.has("potluck") ? "POTLUCK LUNCH" : H.has("pizzafri") ? "PIZZA FRIDAY" : H.has("arcade") ? "ARCADE TOURNAMENT" : H.has("planes") ? "PAPER AIRPLANE CONTEST" : "";
if (ON_B1) { S_("dart_1", 3, 4, "W"); S_("dart_2", 4, 4, "W"); S_("arcade_1", 2, 7, "W"); S_("arcade_2", 2, 8, "W"); }
const PARTY = ON_B1 ? ["huddle_1", "huddle_2", "huddle_3", "huddle_4", "huddle_5", "huddle_6"] : ["break_0", "break_1", "break_2", "break_3", "break_4", "break_5", "break_6", "break_7"];
const CARDS = ON_B1 ? ["huddle_1", "huddle_2", "huddle_3", "huddle_4"] : ["break_0", "break_1", "break_2", "break_3"];
const busyReal = () => ORDER.some((id) => { const c = chars[id], l = c && c.task && c.task.label; return l === "goingup" || l === "work" || l === "prepping" || l === "takes a ticket to El Jefe" || l === "clears a paper jam"; });
const idle = (id) => vis(id) && !chars[id].task && !(ON_B1 && (isAway(id) || activeTrip(id)));
const inWindow = () => { const t = etHM(), h = t.h + t.m / 60; return (h >= 12 && h < 13.5) || (h >= 16.17 && h < 17.75) || Q.has("happen"); };
const LBL = ON_B1 ? "errand" : "fun";
function session(kind) {
  const crew = STAFF.filter(idle).sort(() => Math.random() - 0.5); if (!crew.length) return;
  const go = (ids, keys, dur, lines, fx) => { ids.forEach((id, n) => { const k = freeSpot(keys.slice(n).concat(keys.slice(0, n)), id); if (!k) return;
    const st = [{ spot: SPOTS[k], dur: dur + n * 0.5, say: lines[n] || null, onArrive: n === 0 && fx ? fx : null }]; if (ON_B1) st.push({ spot: home(id), dur: 0 }); setTask(id, st, LBL); }); };
  if (["anniversary", "bigwin", "potluck", "pizzafri"].includes(kind)) { const ids = crew.slice(0, 5); if (ON_B1 && H.has("anniversary") && idle(H.who) && !ids.includes(H.who)) ids[0] = H.who;
    const L0 = { anniversary: ["CAKE TIME!", "HAPPY ANNIVERSARY!", "SPEECH! SPEECH!"], bigwin: ["TO THE BIG WIN!", "CHEERS!", "WHAT A WEEK"], potluck: ["I MADE CHILI", "WHO BROUGHT THE DIP?", "SECONDS!"], pizzafri: ["PIZZA FRIDAY!", "PEPPERONI PLEASE", "BEST DAY OF THE WEEK"] }[kind];
    go(ids, PARTY, 18, L0, () => { L.fire("party", 18, { kind }); ids.forEach((id) => { emo(id, "cheer", 3); }); }); }
  else if (kind === "cards") go(crew.slice(0, 4), CARDS, 26, ["DEALING IN", "GO FISH", "I'M ALL IN... ON CHIPS"], () => L.fire("cards", 26));
  else if (kind === "pingpong" && ON_B1) go(crew.slice(0, 2), ["pong_1", "pong_2"], 22, ["RALLY TO TWENTY-ONE", "YOU'RE ON"], null);
  else if (kind === "darts" && ON_B1) go(crew.slice(0, 2), ["dart_1", "dart_2"], 20, ["BULLSEYE INCOMING", "SURE IT IS"], () => L.fire("darts", 20));
  else if (kind === "arcade" && ON_B1) go(crew.slice(0, 2), ["arcade_1", "arcade_2"], 24, ["TOURNAMENT ROUND ONE", "HIGH SCORE IS MINE"], () => L.fire("arcade", 24));
  else if (kind === "planes") { L.fire("planes", 22, { from: crew.slice(0, 3) }); crew.slice(0, 3).forEach((id, n) => setTimeoutSim(() => say(id, ["WATCH THIS ONE", "ALL THE WAY TO THE WALL", "AERODYNAMICS!"][n], 3), n * 2.5)); }
}
let nextSession = 0;
const fun = H.list.filter((k) => !/^(dog|cat)(:|$)/.test(k));
setInterval(() => { try {
  if (!fun.length || !inWindow() || busyReal() || T < nextSession) return;
  if (ORDER.some((id) => chars[id] && chars[id].task && chars[id].task.label === LBL && chars[id].task.steps.some((s) => s.dur >= 15))) return;
  session(fun[Math.floor(Math.random() * fun.length)]); nextSession = T + 70 + Math.random() * 50;
} catch (e) { /* */ } }, 2000);
L.session = session;

// ---------------------------------------------------------------- pets: wander, visit desks, nap; the cat sits on keyboards
L.pets = [];
const pr = (k) => hfnv(DAY + ":" + L.floor + ":pet:" + k);
if (H.has("dog")) { const b = DOGS.find((d) => d[0] === forcedBreed("dog")) || DOGS[Math.floor(pr("db") * DOGS.length)]; L.pets.push({ kind: "dog", breed: b[0], col: b[1], col2: b[2], big: b[0] === "dachshund" || b[0] === "corgi" ? 0.85 : 1 }); }
if (H.has("cat")) { const b = CATS.find((d) => d[0] === forcedBreed("cat")) || CATS[Math.floor(pr("cb") * CATS.length)]; L.pets.push({ kind: "cat", breed: b[0], col: b[1], col2: b[2], big: 0.8 }); }
const FRONTS = Object.keys(SPOTS).filter((k) => k.startsWith("front_") && k !== "front_indy");
const petFree = (x, y) => x > 0 && y > 2 && x < GW - 1 && y < GH - 1 && !blocked[I(x, y)] && !seat[I(x, y)];
const people = () => { const s = new Set(); for (const id of ORDER) { const c = chars[id]; if (c && !c.hidden) { s.add(I(c.tx, c.ty)); if (c.moving && c.path && c.path[0]) s.add(I(c.path[0][0], c.path[0][1])); } } return s; };
function petPlace(p) { for (let k = 0; k < 200; k++) { const x = 1 + Math.floor(Math.random() * (GW - 2)), y = 3 + Math.floor(Math.random() * (GH - 4)); if (petFree(x, y) && !people().has(I(x, y))) { p.tx = x; p.ty = y; p.x = x * TS + 8; p.y = y * TS + 8; p.path = []; p.mode = "idle"; p.until = T + 2; p.face = 1; return; } } }
function petGoal(p) {
  const r = Math.random(), sit = STAFF.filter((id) => vis(id) && SPOTS["chair_" + id] && chars[id].tx === SPOTS["chair_" + id].x && chars[id].ty === SPOTS["chair_" + id].y);
  if (r < 0.35 && sit.length) { const id = sit[Math.floor(Math.random() * sit.length)], f = SPOTS["front_" + id]; if (f && petFree(f.x, f.y)) return { x: f.x, y: f.y, then: p.kind === "cat" ? "desk" : "visit", who: id }; }
  if (r < 0.55) { for (let k = 0; k < 40; k++) { const x = 1 + Math.floor(Math.random() * (GW - 2)), y = 3 + Math.floor(Math.random() * (GH - 4)); if (petFree(x, y)) return { x, y, then: "nap" }; } }
  for (let k = 0; k < 60; k++) { const x = 1 + Math.floor(Math.random() * (GW - 2)), y = 3 + Math.floor(Math.random() * (GH - 4)); if (petFree(x, y)) return { x, y, then: "idle" }; }
  return null;
}
let lastPetT = null;
function petTick() {
  if (!L.pets.length || typeof T !== "number") return; const dt = lastPetT == null ? 0 : Math.min(0.3, Math.max(0, T - lastPetT)); lastPetT = T; if (!dt) return;
  const ppl = people();
  for (const p of L.pets) {
    if (p.tx == null) petPlace(p); if (p.tx == null) continue;
    if (ppl.has(I(p.tx, p.ty)) && !p.path.length) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (petFree(p.tx + dx, p.ty + dy) && !ppl.has(I(p.tx + dx, p.ty + dy))) { p.path = [[p.tx + dx, p.ty + dy]]; p.mode = "walk"; break; } }   // scoot out of the way
    if (p.path.length) {
      const [nx, ny] = p.path[0], gx = nx * TS + 8, gy = ny * TS + 8, sp = (p.kind === "dog" ? 2.6 : 2.1) * TS * dt, dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy);
      if (!petFree(nx, ny) || (ppl.has(I(nx, ny)) && d > TS * 0.6)) { p.wait = (p.wait || 0) + dt; if (p.wait > 1.5) { p.path = []; p.wait = 0; p.mode = "idle"; p.until = T + 1; } continue; }
      p.wait = 0; if (Math.abs(dx) > 0.1) p.face = dx > 0 ? 1 : -1; p.walkT = (p.walkT || 0) + dt;
      if (d <= sp) { p.x = gx; p.y = gy; p.tx = nx; p.ty = ny; p.path.shift(); if (!p.path.length) arrive(p); } else { p.x += (dx / d) * sp; p.y += (dy / d) * sp; }
      continue;
    }
    if (T < p.until) continue;
    const g = petGoal(p); if (!g) { p.until = T + 3; continue; }
    const path = astar(p.tx, p.ty, g.x, g.y, null); if (!path || !path.length) { p.until = T + 2; continue; }
    p.path = path.filter(([x, y]) => petFree(x, y)).length === path.length ? path : []; p.goal = g; p.mode = "walk"; if (!p.path.length) p.until = T + 2;
  }
}
function arrive(p) {
  const g = p.goal || { then: "idle" }; p.mode = g.then; p.who = g.who;
  if (g.then === "nap") p.until = T + 14 + Math.random() * 18;
  else if (g.then === "visit") { p.until = T + 7; if (vis(g.who) && Math.random() < 0.6) say(g.who, ["GOOD DOG!", "WHO'S A GOOD PUP?", "HI BUDDY", "NO TREATS ON THE DESK"][Math.floor(Math.random() * 4)], 3); }
  else if (g.then === "desk") { p.until = T + 12; setTimeoutSim(() => { if (p.mode === "desk") { L.fire("knock", 2, { who: g.who }); if (vis(g.who)) { emo(g.who, "?", 2.5); say(g.who, ["HEY! THAT WAS MY PEN", "NOT THE KEYBOARD!", "OFF THE DESK, PLEASE"][Math.floor(Math.random() * 3)], 3); } } }, 5); }
  else p.until = T + 2 + Math.random() * 4;
}
setInterval(() => { try { petTick(); } catch (e) { /* */ } }, 60);
L.petViolations = () => L.pets.filter((p) => p.tx != null && (blocked[I(p.tx, p.ty)] || seat[I(p.tx, p.ty)])).length;
})();
