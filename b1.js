"use strict";
/* Research Inc. - B1 office, one floor below the trading floor. Same engine conventions as floor2d.js:
   26x18 tiles of 16 px, tile collision + A* + tile reservation, chairs are sit points, pixel font, 2D canvas.
   Data is REAL and read-only: GET /b1/data.json (Research Inc. files), GET /b1/brief.json?name=..., GET /state.json (tape).
   Staff go upstairs when floor_events.jsonl has a visit for them; while upstairs they're away from B1 (and on the trading floor). */
const TS = 16, GW = 26, GH = 18, LW = GW * TS, LH = GH * TS;
const $ = (id) => document.getElementById(id);
const STATIC_HOST = /\.github\.io$/i.test(location.hostname);   // always-on static copy: gentle polling, pre-built brief files
const RI_TAG = "#00e5ff";
const LAG_MS = 8000, LEAD_MS = 7000;   // staffer reaches the top of the stairs ~8 s after the event; leaves the desk ~7 s before

// ============================================================== pixel font (3x5), same as the trading floor
const FONT = {
  A:".#.#.#####.##.#",B:"##.#.###.#.###.",C:".###..#..#...##",D:"##.#.##.##.###.",E:"####..##.#..###",F:"####..##.#..#..",
  G:".###..#.##.#.##",H:"#.##.#####.##.#",I:"###.#..#..#.###",J:"..#..#..##.#.#.",K:"#.##.###.#.##.#",L:"#..#..#..#..###",
  M:"#.#####.##.##.#",N:"##.#.##.##.##.#",O:".#.#.##.##.#.#.",P:"##.#.###.#..#..",Q:".#.#.##.###..##",R:"##.#.###.#.##.#",
  S:".###...#...###.",T:"###.#..#..#..#.",U:"#.##.##.##.####",V:"#.##.##.##.#.#.",W:"#.##.##.#####.#",X:"#.##.#.#.#.##.#",
  Y:"#.##.#.#..#..#.",Z:"###..#.#.#..###","0":"####.##.##.####","1":".#.##..#..#.###","2":"##...#.#.#..###",
  "3":"##...#.#...###.","4":"#.##.####..#..#","5":"####..##...###.","6":".###..####.####","7":"###..#.#..#..#.",
  "8":"####.#####.####","9":"####.####..###.",".":"............#..",",":".........#.#...",":":"....#.....#....",
  "-":"......###......","+":"....#.###.#....","$":".####..#..####.","%":"#....#.#.#....#","/":"..#..#.#.#..#..",
  "(":".#.#..#..#...#.",")":".#...#..#..#.#.","!":".#..#..#.....#.","?":"##...#.#.....#.","'":".#..#..........",
  "#":"#.#####.#####.#",">":"#...#...#.#.#..","<":"..#.#.#...#...#","=":"...###...###...","&":".#.#.#.#.#.#.##",
  "_":"............###","*":"...#.#.#.#.#...","^":".#.###.........","@":".#.#.####.#..##"," ":"..............."
};
const tw = (s, px) => (String(s).length * 4 - 1) * px;
function ptext(g, s, x, y, col, px) {
  s = String(s).toUpperCase(); g.fillStyle = col;
  let cx = Math.round(x); y = Math.round(y);
  for (const ch of s) { const f = FONT[ch] || FONT["?"]; for (let i = 0; i < 15; i++) if (f.charCodeAt(i) === 35) g.fillRect(cx + (i % 3) * px, y + ((i / 3) | 0) * px, px, px); cx += 4 * px; }
}
function ptextC(g, s, cx, y, col, px) { ptext(g, s, cx - tw(s, px) / 2, y, col, px); }
const MAPC = { ";": ",", '"': "'", "\u2019": "'", "\u2018": "'", "\u201c": "'", "\u201d": "'", "\u2014": "-", "\u2013": "-", "|": "/", "\u2192": ">" };
function clean(s, n) { let t = String(s == null ? "" : s).toUpperCase().split("").map((ch) => MAPC[ch] || (FONT[ch] ? ch : " ")).join("").replace(/\s+/g, " ").trim(); return n && t.length > n ? t.slice(0, n - 2).trim() + ".." : t; }

// ============================================================== map
const blocked = new Uint8Array(GW * GH), seat = new Uint8Array(GW * GH);
const I = (x, y) => y * GW + x;
function B(x0, y0, x1, y1, v = 1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[I(x, y)] = v; }
B(0, 0, GW - 1, 2); B(0, GH - 1, GW - 1, GH - 1); B(0, 0, 0, GH - 1); B(GW - 1, 0, GW - 1, GH - 1);
const FURN = [];
function F(type, x, y, w = 1, h = 1, o = {}) { FURN.push(Object.assign({ type, x, y, w, h }, o)); B(x, y, x + w - 1, y + h - 1); }
// Desks are grouped into pods like the trading floor's clusters (3-wide desks, sign tile in the middle column).
// The research pod matches the trading floor's clusters exactly: two south-facing rows (desks y=5 and y=8, chairs north of each
// desk, so every seated person faces the viewer) with an aisle between them (y=6), and a sign tile in the middle column of each row.
// Proof (Quality) has a corner desk under the lessons whiteboard, with a credenza and the calls scoreboard beside it.
const DESKS = { scoop: [7, 5, "S"], tape: [11, 5, "S"], beats: [7, 8, "S"], sage: [11, 8, "S"], proof: [19, 6, "S"] };
for (const id in DESKS) F("desk", DESKS[id][0], DESKS[id][1], 3, 1, { who: id, face: DESKS[id][2] });
F("podsign", 10, 5); F("podplant", 10, 8); F("cred", 22, 6); F("score", 23, 6, 2, 1);
F("table", 11, 11, 3, 2); F("coffee", 1, 14, 3, 1); F("rack", 1, 9, 1, 3); F("cooler", 4, 9); F("archive", 5, 12, 4, 1);
F("tube", 19, 16); F("printer", 5, 16, 2, 1);
F("pingpong", 2, 5, 3, 2); F("arcade", 1, 7);   // game corner in the free west bay (staff play quick ping-pong rallies)
F("plant", 24, 3, 1, 1, { big: 1 }); F("plant", 8, 16); F("plant", 24, 16, 1, 1, { big: 1 }); F("plant", 1, 3); F("plant", 6, 4);

const SPOTS = {};
function S_(key, x, y, face = "S", pose = "stand") { SPOTS[key] = { key, x, y, face, pose }; }
const CHAIRS = {}, FRONT = {};
for (const id in DESKS) { const [x, y, f] = DESKS[id], cy = f === "N" ? y + 1 : y - 1; CHAIRS[id] = [x + 1, cy]; S_("chair_" + id, x + 1, cy, f, "sit"); seat[I(x + 1, cy)] = 1; }
// visitor spots: across the desk, facing the seated person (same as upstairs FRONT)
const FRONT_AT = { scoop: [8, 6, "N"], tape: [12, 6, "N"], beats: [8, 9, "N"], sage: [12, 9, "N"], proof: [20, 7, "N"] };
for (const id in FRONT_AT) { FRONT[id] = FRONT_AT[id].slice(0, 2); S_("front_" + id, ...FRONT_AT[id]); }
S_("news_1", 3, 3, "N"); S_("news_2", 4, 3, "N"); S_("news_3", 5, 3, "N"); S_("earn_1", 9, 3, "N"); S_("earn_2", 10, 3, "N");
S_("ideas_1", 14, 3, "N"); S_("ideas_2", 15, 3, "N"); S_("lessons_1", 20, 3, "N"); S_("lessons_2", 21, 3, "N");
S_("coffee_1", 1, 15, "N"); S_("coffee_2", 2, 15, "N"); S_("coffee_3", 3, 15, "N"); S_("rack", 2, 10, "W"); S_("cooler", 4, 10, "N");
S_("archive_1", 5, 13, "N"); S_("archive_2", 6, 13, "N"); S_("archive_3", 7, 13, "N"); S_("score_1", 23, 7, "N"); S_("score_2", 24, 7, "N");
S_("printer_1", 5, 15, "S"); S_("printer_2", 6, 15, "S");
S_("huddle_1", 10, 11, "E"); S_("huddle_2", 14, 11, "W"); S_("huddle_3", 12, 10, "S"); S_("huddle_4", 12, 13, "N"); S_("huddle_5", 10, 12, "E"); S_("huddle_6", 14, 12, "W");
S_("pong_1", 1, 5, "E"); S_("pong_2", 5, 6, "W");
S_("up_1", 16, 16, "S"); S_("up_2", 15, 16, "S"); S_("up_3", 17, 16, "S");
const STAIRS = ["up_1", "up_2", "up_3"], HUDDLE = ["huddle_1", "huddle_2", "huddle_3", "huddle_4", "huddle_5", "huddle_6"];
const AREAS = [[14, 15, 18, 16, "the stairs"], [1, 3, 6, 4, "the news wall"], [7, 3, 11, 4, "the earnings board"], [12, 3, 16, 4, "the ideas board"],
  [19, 3, 24, 4, "Proof's whiteboard"], [9, 10, 15, 13, "the meeting table"], [1, 13, 4, 16, "the coffee nook"], [1, 8, 4, 12, "the server rack"],
  [5, 12, 8, 13, "the archive"], [22, 5, 24, 8, "the calls scoreboard"], [5, 14, 7, 16, "the printer"], [6, 4, 14, 9, "the research pod"], [18, 4, 21, 8, "the quality desk"], [1, 4, 5, 8, "the game corner"]];
const areaOf = (x, y) => { for (const a of AREAS) if (x >= a[0] && x <= a[2] && y >= a[1] && y <= a[3]) return a[4]; return "the B1 floor"; };

// ============================================================== A* (same rules as upstairs)
function passable(x, y, gx, gy, dyn) {
  if (x < 0 || y < 0 || x >= GW || y >= GH) return false;
  const i = I(x, y); if (blocked[i]) return false;
  const goal = x === gx && y === gy;
  if (seat[i] && !goal) return false;
  if (dyn && dyn.has(i) && !goal) return false;
  return true;
}
function astar(sx, sy, gx, gy, dyn) {
  if (sx === gx && sy === gy) return [];
  if (!passable(gx, gy, gx, gy, null)) return null;
  const N = GW * GH, gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [I(sx, sy)]; gs[I(sx, sy)] = 0;
  const h = (i) => Math.abs((i % GW) - gx) + Math.abs(((i / GW) | 0) - gy);
  while (open.length) {
    let bi = 0, bf = 1e9;
    for (let k = 0; k < open.length; k++) { const f = gs[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k; } }
    const cur = open.splice(bi, 1)[0];
    if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % GW, cy = (cur / GW) | 0;
    if (cx === gx && cy === gy) { const path = []; let c = cur; while (c !== I(sx, sy)) { path.push([c % GW, (c / GW) | 0]); c = came[c]; } return path.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!passable(nx, ny, gx, gy, dyn)) continue;
      const ni = I(nx, ny); if (closed[ni]) continue;
      const ng = gs[cur] + 1 + (seat[ni] ? 2 : 0);
      if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; open.push(ni); }
    }
  }
  return null;
}

// ============================================================== cast (same looks as on the trading floor)
const CAST = {
  scoop: { name: "SCOOP", desk: "News Desk", skin: "#f1c27d", hair: "#6b4423", shirt: "#7cb342", pants: "#3b3f2a", ri: "fedora" },
  tape:  { name: "TAPE", desk: "Markets Desk", skin: "#8d5524", hair: "#1b1b1b", shirt: "#1ea5c9", pants: "#203040", ri: "bun" },
  beats: { name: "BEATS", desk: "Earnings & IPO Desk", skin: "#e0ac69", hair: "#b5651d", shirt: "#ff8a65", pants: "#33263a", ri: "bowtie", long: 1 },
  sage:  { name: "SAGE", desk: "Analyst Desk", skin: "#c68642", hair: "#d9d9d9", shirt: "#6a4bd8", pants: "#1f1b3a", ri: "beret" },
  proof: { name: "PROOF", desk: "Quality Desk", skin: "#f1c27d", hair: "#3a2a1a", shirt: "#d77a7f", pants: "#2f2f3a", ri: "hardhat" },
};
const COL = { scoop: "#b5e48c", tape: "#48cae4", beats: "#ff9e7a", sage: "#9d84ff", proof: "#e5989b" };
const ORDER = Object.keys(CAST);
const UPSTAIRS = { grok: "EL JEFE", goldie: "GOLDIE", dash: "DASH", vee: "VEE", zip: "MEET KEVIN", snap: "SNAP", trek: "TREK", dip: "DIP", rota: "ROTA",
  pixel: "PIXEL", knobs: "KNOBS", indy: "INDY", desk: "EL JEFE", center: "THE FLOOR", board: "THE R&D BOARD", coffee: "THE ESPRESSO BAR" };
const upName = (to) => UPSTAIRS[String(to || "").toLowerCase()] || clean(to || "THE FLOOR");

// ============================================================== state
let DATA = null, ST = null, T = 0, STRESS = 0, simBase = 0;
const nowMs = () => (STRESS ? simBase + T * 1000 : Date.now());
let rngSeed = 7654321;
const rnd = () => ((rngSeed = (rngSeed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[(rnd() * a.length) | 0];
function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973; return h / 9973; }
const occ = new Map(), chars = {}, ambient = [], feed = [], timers = [];
let tubeUntil = -1;
for (const id of ORDER) chars[id] = { id, tx: 0, ty: 0, x: 0, y: 0, path: [], moving: false, from: null, goal: null, task: null, face: "S", pose: "stand",
  hidden: true, wait: 0, walkT: 0, bubble: null, emote: null, emoteUntil: 0, jumpUntil: 0, nextErrand: 0, homeKey: null, speed: 3.4, trip: null, carry: false };
function setTimeoutSim(fn, secs) { timers.push({ at: T + secs, fn }); }
function say(id, text, secs = 3.5) { const c = chars[id]; if (!c || c.hidden) return; c.bubble = { text: clean(text, 34), until: T + secs }; }
function amb(id, msg) { ambient.push({ t: new Date(nowMs()), who: id, msg }); if (ambient.length > 14) ambient.shift(); }
function etNow() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { h: (+p.hour % 24) + (+p.minute) / 60 + (+p.second) / 3600, wd: p.weekday, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}

// ============================================================== shift schedule (weekdays, ET)
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function shiftList() { return (DATA && DATA.shifts) || [{ time_et: "08:13", id: "pre-market", name: "Pre-market brief" }, { time_et: "12:17", id: "midday", name: "Midday scan" }, { time_et: "16:47", id: "close", name: "Close wrap" }]; }
function nextShift() {
  const e = etNow(), nowMin = e.hh * 60 + e.mm + e.ss / 60, d0 = WD.indexOf(e.wd);
  for (let k = 0; k < 8; k++) {
    const wd = (d0 + k) % 7; if (wd === 0 || wd === 6) continue;
    for (const s of shiftList()) {
      const [h, m] = s.time_et.split(":").map(Number), mins = k * 1440 + h * 60 + m - nowMin;
      if (mins > 0) return Object.assign({ mins, day: k === 0 ? "today" : k === 1 ? "tomorrow" : WD[wd] }, s);
    }
  }
  return null;
}
const h12 = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const cd = (mins) => { const h = Math.floor(mins / 60), m = Math.floor(mins % 60); return h >= 24 ? `${Math.floor(h / 24)}D ${h % 24}H ${String(m).padStart(2, "0")}M` : `${h}H ${String(m).padStart(2, "0")}M`; };
function nextShiftShort() { const n = nextShift(); if (!n) return "SHIFTS ON WEEKDAYS"; return `${DATA && DATA.briefs && DATA.briefs.length ? "NEXT" : "FIRST"} SHIFT ${h12(n.time_et)}`; }

// ============================================================== data-backed lines (never claim research that didn't happen)
const sig = () => (DATA && DATA.signals && DATA.signals.ok && DATA.signals.data) || {};
const arr = (x) => (Array.isArray(x) ? x : []);
function tick(sym) { return ((ST && ST.tickers) || []).find((t) => t.symbol === sym); }
function line(id) {
  const s = sig();
  if (id === "scoop") return DATA && DATA.briefs && DATA.briefs.length ? "LATEST BRIEF: " + clean(DATA.briefs[0].shift || DATA.briefs[0].name, 20) : "NO BRIEFS YET. " + nextShiftShort();
  if (id === "tape") { const t = tick("SPY"); return t ? `SPY ${t.chg_pct >= 0 ? "+" : ""}${(t.chg_pct * 100).toFixed(2)}% TODAY` : "WAITING ON QUOTES"; }
  if (id === "beats") { const e = arr(s.earnings)[0]; return e ? `${clean(e.ticker)} ${clean(e.date).slice(5)} ${clean(e.timing || "")}` : "NO EARNINGS LISTED YET"; }
  if (id === "sage") { const n = arr(s.ideas).length, a = arr(s.avoid).length; return n || a ? `${n} IDEA${n === 1 ? "" : "S"}, ${a} AVOID IN SIGNALS` : "NO IDEAS POSTED YET"; }
  if (id === "proof") { const c = (DATA && DATA.calls) || {}; return c.hit_rate != null ? `HIT RATE ${Math.round(c.hit_rate * 100)}%` : c.total ? `${c.open} CALLS OPEN, NONE GRADED` : "NO CALLS LOGGED YET"; }
  return "";
}
const IDLE = ["STRETCH BREAK", "HYDRATE", "QUIET IN HERE", "COFFEE'S FRESH", "TIDYING MY DESK", "WHO MOVED MY STAPLER?"];

// ============================================================== movement (same as upstairs)
function place(c, x, y) { for (const [k, v] of occ) if (v === c.id) occ.delete(k); c.tx = x; c.ty = y; c.x = x * TS + 8; c.y = y * TS + 8; c.path = []; c.moving = false; occ.set(I(x, y), c.id); }
function dynBlockers(self) { const s = new Set(); for (const c of Object.values(chars)) if (c !== self && !c.hidden) { s.add(I(c.tx, c.ty)); if (c.moving && c.path[0]) s.add(I(c.path[0][0], c.path[0][1])); } return s; }
function routeTo(c, spot) {
  c.goal = spot;
  const cur = c.moving && c.path[0] ? c.path[0] : null, sx = cur ? cur[0] : c.tx, sy = cur ? cur[1] : c.ty;
  let p = astar(sx, sy, spot.x, spot.y, dynBlockers(c)); if (!p) p = astar(sx, sy, spot.x, spot.y, null);
  if (p && cur) p = [cur].concat(p);
  c.path = p || (cur ? [cur] : []); c.wait = 0; if (!p) c.goal = null; return !!p;
}
function sidestep(c) {
  if (c.moving) return false;
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c.tx + dx, c.ty + dy]).filter(([x, y]) => passable(x, y, -1, -1, null) && !occ.has(I(x, y)));
  if (!opts.length) return false; c.path = [pick(opts)]; return true;
}
function stepMove(c, dt) {
  if (!c.path.length) return;
  const [nx, ny] = c.path[0];
  if (!c.moving) {
    const who = occ.get(I(nx, ny));
    if (who && who !== c.id) {
      c.wait += dt;
      if (c.wait > 0.6 && c.goal && c.wait - dt <= 0.6) { const g0 = c.goal; routeTo(c, g0); c.wait = 0.61; }
      if (c.wait > 2.2) {
        const other = chars[who];
        if (c.goal && I(c.goal.x, c.goal.y) === I(nx, ny) && other && !other.moving && !other.path.length) { c.path = []; c.goal = null; c.wait = 0; if (c.task && c.task.steps[0]) c.task.steps[0].near = true; }
        else if (sidestep(c)) c.wait = 0; else c.wait = 1.0;
      }
      return;
    }
    if (blocked[I(nx, ny)]) { c.path = []; return; }
    occ.set(I(nx, ny), c.id); c.moving = true; c.from = [c.tx, c.ty]; c.wait = 0;
    c.face = nx > c.tx ? "E" : nx < c.tx ? "W" : ny > c.ty ? "S" : "N";
  }
  const tx = nx * TS + 8, ty = ny * TS + 8, sp = c.speed * TS * dt * (c.run ? 1.5 : 1);
  const dx = tx - c.x, dy = ty - c.y, d = Math.abs(dx) + Math.abs(dy);
  c.walkT += dt;
  if (d <= sp) {
    c.x = tx; c.y = ty;
    if (occ.get(I(c.from[0], c.from[1])) === c.id) occ.delete(I(c.from[0], c.from[1]));
    c.tx = nx; c.ty = ny; c.moving = false; c.path.shift();
    if (!c.path.length && c.goal && (c.tx !== c.goal.x || c.ty !== c.goal.y)) routeTo(c, c.goal);
  } else { c.x += Math.sign(dx) * Math.min(Math.abs(dx), sp); c.y += Math.sign(dy) * Math.min(Math.abs(dy), sp); }
}
const atSpot = (c, s) => s && c.tx === s.x && c.ty === s.y && !c.moving && !c.path.length;
const spotBusy = (key, except) => Object.values(chars).some((c) => c.id !== except && !c.hidden && ((c.goal && c.goal.key === key) || c.homeKey === key || (SPOTS[key] && c.tx === SPOTS[key].x && c.ty === SPOTS[key].y)));
function freeSpot(keys, id) { const k = keys.filter((x) => SPOTS[x] && !spotBusy(x, id)); return k.length ? pick(k) : null; }
function setTask(id, steps, label) { const c = chars[id]; if (!c || c.hidden) return false; c.task = { steps: steps.slice(), label, t0: T }; c.goal = null; c.path = c.moving ? c.path.slice(0, 1) : []; return true; }
function vanish(c, msg) { for (const [k, v] of occ) if (v === c.id) occ.delete(k); c.hidden = true; c.task = null; c.goal = null; c.bubble = null; c.run = false; if (msg) amb(c.id, msg); }
function runTask(c) {
  const id = c.id, s = c.task.steps[0];
  if (!s) { c.task = null; c.goal = null; return; }
  if (!s.near && (!c.goal || c.goal.key !== s.spot.key)) { if (!routeTo(c, s.spot)) { c.task.steps.shift(); return; } }
  if (atSpot(c, s.spot) || (s.near && !c.moving && !c.path.length)) {
    if (s.started == null) {
      s.started = T; c.face = s.spot.face; c.pose = s.spot.pose || "stand";
      if (s.say) say(id, typeof s.say === "function" ? s.say() : s.say, Math.min(5, s.dur || 3));
      if (s.reply) setTimeoutSim(() => say(s.reply, line(s.reply), 4), 1.8);
      if (s.onArrive) s.onArrive();
      if (s.leave) { vanish(c, c.trip ? "goes up to the trading floor (" + upName(c.trip.to) + ")" : "goes upstairs"); return; }
    }
    if (T - s.started >= (s.dur || 0)) { c.task.steps.shift(); c.goal = null; if (!c.task.steps.length) { c.task = null; c.nextErrand = T + errandGap(); } }
  } else if (!c.path.length && !c.moving && c.goal) routeTo(c, c.goal);
  if (c.task && T - c.task.t0 > 90 && c.task.label !== "prepping") { c.task = null; c.goal = null; }
}

// ============================================================== trips upstairs (driven by floor_events.jsonl via /b1/data.json)
const trips = {};   // id -> [{key, tUp, tBack, to, type, note}]
for (const id of ORDER) trips[id] = [];
const whoList = (w) => (Array.isArray(w) ? w : String(w || "").split(",")).map((x) => String(x).trim().toLowerCase()).filter((x) => CAST[x]);
function addTrips(evs) {
  for (const e of evs || []) {
    const ts = Date.parse(e.ts); if (!ts) continue;
    whoList(e.who).forEach((id, n) => {
      const key = e.id + ":" + id; if (trips[id].some((t) => t.key === key)) return;
      const tUp = ts + LAG_MS + n * 800, tBack = tUp + (e.type === "meeting" ? 40000 : 30000);
      if (tBack < nowMs() - 1000) return;
      trips[id].push({ key, tUp, tBack, to: e.to, type: e.type, note: e.note || "" });
      if (e.type === "deliver" && ts > nowMs() - 15000) tubeUntil = T + 3.2;
    });
  }
  for (const id of ORDER) { trips[id] = trips[id].filter((t) => t.tBack > nowMs() - 1000).sort((a, b) => a.tUp - b.tUp); }
}
const activeTrip = (id) => trips[id].find((t) => nowMs() < t.tBack) || null;
const isAway = (id) => { const t = activeTrip(id); return !!t && nowMs() >= t.tUp; };

// ============================================================== work triggers: a file changed -> the owner visibly works on it
function briefOwner(b) { const s = ((b.shift || "") + " " + b.name).toLowerCase(); return /week|score|grade/.test(s) ? "proof" : /close|wrap|eod/.test(s) ? "beats" : /mid|noon/.test(s) ? "tape" : "scoop"; }
function dataChanges(prev, cur) {
  if (!prev) return;
  const work = (id, cap) => { const c = chars[id]; if (!c || c.hidden || isAway(id)) return; c.workUntil = T + 12; setTask(id, [{ spot: SPOTS["chair_" + id], dur: 12, say: cap }], "work"); amb(id, cap.toLowerCase()); };
  const ps = prev.signals || {}, cs = cur.signals || {};
  if (cs.mtime && cs.mtime !== ps.mtime) { const d = cs.data || {}; work("sage", `SIGNALS.JSON UPDATED: ${arr(d.ideas).length} IDEAS, ${arr(d.avoid).length} AVOID`); }
  const pb = {}; for (const b of prev.briefs || []) pb[b.name] = b.mtime;
  for (const b of (cur.briefs || []).slice(0, 3)) if (pb[b.name] !== b.mtime) { work(briefOwner(b), (pb[b.name] ? "BRIEF REVISED: " : "BRIEF FILED: ") + clean(b.shift || b.name, 18)); break; }
  const lm = (x) => (x && x.lessons && x.lessons.mtime) || null;
  if (lm(cur) && lm(cur) !== lm(prev)) work("proof", "LESSONS.MD UPDATED");
  else if (cur.calls && prev.calls && cur.calls.total !== prev.calls.total) work("proof", `CALLS LOG: ${cur.calls.total} CALLS`);
  const nm = (x) => (x && x.note && x.note.mtime) || null;
  if (nm(cur) && nm(cur) !== nm(prev)) work("sage", "ANALYST NOTE UPDATED");
}

// ============================================================== director
const BOARD = { scoop: ["news_1", "news_2", "news_3"], tape: ["news_1", "news_2", "rack"], beats: ["earn_1", "earn_2"], sage: ["ideas_1", "ideas_2"], proof: ["lessons_1", "lessons_2", "score_1", "score_2"] };
const errandGap = () => 14 + rnd() * 26;
const home = (id) => SPOTS["chair_" + id];
function errand(c) {
  const id = c.id, r = rnd(), others = ORDER.filter((o) => o !== id && !chars[o].hidden && !chars[o].task);
  if (r < 0.12 && others.length >= 2 && !ORDER.some((o) => chars[o].task && chars[o].task.label === "huddle")) {   // quick huddle at the table
    const crew = [id].concat(others.slice(0, 1 + ((rnd() * 2) | 0))), spots = HUDDLE.slice().sort(() => rnd() - 0.5);
    crew.forEach((m, n) => setTask(m, [{ spot: SPOTS[spots[n]], dur: 9, say: n === 0 ? "QUICK HUDDLE" : n === 1 ? () => line(m) : null }, { spot: home(m), dur: 0 }], "huddle"));
    amb(id, "calls a quick huddle at the table");
    return;
  }
  let st;
  if (r < 0.32) st = [{ spot: SPOTS[freeSpot(["coffee_1", "coffee_2", "coffee_3"], id) || "coffee_2"], dur: 5, say: pick(["COFFEE'S FRESH", "REFILL TIME", "DECAF? NEVER"]) }];
  else if (r < 0.58) { const k = freeSpot(BOARD[id], id); if (k) st = [{ spot: SPOTS[k], dur: 6, say: () => line(id) }]; }
  else if (r < 0.7) { const k = freeSpot(["archive_1", "archive_2", "archive_3"], id); if (k) st = [{ spot: SPOTS[k], dur: 5, say: pick(["FILING OLD NOTES", "ARCHIVE RUN", "WHERE'S LAST WEEK?"]) }]; }
  else if (r < 0.8) { const k = freeSpot(["printer_1", "printer_2", "cooler"], id); if (k) st = [{ spot: SPOTS[k], dur: 4, say: pick(IDLE) }]; }
  else if (r < 0.86 && others.length && freeSpot(["pong_1"], id) && freeSpot(["pong_2"], id) && !ORDER.some((o) => chars[o].task && chars[o].task.label === "pong")) {   // quick ping-pong rally
    const o = pick(others);
    setTask(id, [{ spot: SPOTS.pong_1, dur: 8, say: pick(["RALLY TIME", "FIRST TO FIVE", "QUICK GAME?"]) }, { spot: home(id), dur: 0 }], "pong");
    setTask(o, [{ spot: SPOTS.pong_2, dur: 8, say: pick(["YOU'RE ON", "SERVE IT UP", "BRING IT"]) }, { spot: home(o), dur: 0 }], "pong");
    amb(id, "starts a ping-pong rally in the game corner"); return;
  }
  else if (others.length) { const o = pick(others); st = [{ spot: SPOTS["front_" + o], dur: 6, say: pick(["GOT A SEC?", "HOW'S IT LOOKING?", "WHAT'S ON YOUR BOARD?"]), reply: o }]; }
  if (!st) { c.nextErrand = T + 5; return; }
  st.push({ spot: home(id), dur: 0 });
  setTask(id, st, "errand");
}
let firstPlace = true;
function initialPlace() {
  for (const id of ORDER) {
    const c = chars[id], t = activeTrip(id);
    if (t && nowMs() >= t.tUp) { c.hidden = true; c.trip = t; continue; }   // already upstairs when the page loads
    c.hidden = false; const s = home(id); place(c, s.x, s.y); c.pose = "sit"; c.face = s.face; c.nextErrand = T + 3 + rnd() * 15;
  }
  firstPlace = false;
}
function director(c) {
  const id = c.id, now = nowMs(), t = activeTrip(id);
  if (c.hidden) {
    if (t && now >= t.tUp) return;   // upstairs on the trading floor
    if (t && now < t.tUp && !c.trip) { const s = home(id); place(c, s.x, s.y); c.hidden = false; return; }
    const s = SPOTS[freeSpot(STAIRS, id) || "up_1"]; if (occ.has(I(s.x, s.y))) return;   // wait for the landing to clear
    c.hidden = false; c.carry = false; place(c, s.x, s.y); c.face = "N"; c.pose = "stand";
    if (c.trip) { say(id, "BACK FROM UPSTAIRS", 3.5); amb(id, "is back from the trading floor (" + upName(c.trip.to) + ")"); }
    c.trip = null; setTask(id, [{ spot: home(id), dur: 0 }], "home"); return;
  }
  if (t) {
    const lbl = c.task && c.task.label;
    if (now >= t.tUp + 6000) { c.trip = t; c.carry = false; vanish(c, "goes up to the trading floor (" + upName(t.to) + ")"); return; }
    if (now >= t.tUp - LEAD_MS) {
      if (lbl !== "goingup") {
        c.trip = t; c.carry = t.type === "deliver"; c.workUntil = 0;
        const s = SPOTS[freeSpot(STAIRS, id) || "up_1"], what = t.type === "meeting" ? "MEETING UPSTAIRS" : t.type === "deliver" ? "TAKING THIS TO " + upName(t.to) : "POPPING UP TO SEE " + upName(t.to);
        if (setTask(id, [{ spot: s, dur: 0, say: what, leave: true }], "goingup")) c.run = now > t.tUp - 2500;
      }
    } else if (lbl !== "prepping" && lbl !== "work") {
      c.workUntil = T + (t.tUp - LEAD_MS - now) / 1000;
      setTask(id, [{ spot: home(id), dur: (t.tUp - LEAD_MS - now) / 1000, say: t.type === "meeting" ? "PREPPING FOR A MEETING" : t.note ? clean(t.note, 30) : "PREPPING A HANDOFF" }], "prepping");
    }
  }
  if (c.task) return runTask(c);
  if (!atSpot(c, home(id))) { setTask(id, [{ spot: home(id), dur: 0 }], "home"); return; }
  c.pose = "sit"; c.face = home(id).face;
  if (T >= c.nextErrand) errand(c);
}

// ============================================================== rendering: world (logical pixels)
const off = document.createElement("canvas"); off.width = LW; off.height = LH;
const g = off.getContext("2d"); g.imageSmoothingEnabled = false;
const bg = document.createElement("canvas"); bg.width = LW; bg.height = LH;
const gb = bg.getContext("2d"); gb.imageSmoothingEnabled = false;
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r * f)); gg = Math.max(0, Math.min(255, gg * f)); b = Math.max(0, Math.min(255, b * f));
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}
function frame(c, x, y, w, h, col = "#3b2a1a") { R(c, x - 2, y - 2, w + 4, h + 4, col); R(c, x - 1, y - 1, w + 2, h + 2, shade(col, 1.4)); }
function drawBackground() {
  const c = gb;
  for (let y = 3; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {   // basement carpet tiles (teal-grey, RI)
    R(c, x * TS, y * TS, 16, 16, (x + y) % 2 ? "#2c3e46" : "#31444d"); R(c, x * TS, y * TS, 16, 1, "#26363d"); R(c, x * TS, y * TS, 1, 16, "#26363d");
  }
  const plank = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let k = 0; k < 2; k++) { const row = y * 2 + k; R(c, x * TS, y * TS + k * 8, 16, 8, row % 2 ? "#5a4632" : "#604b36"); R(c, x * TS, y * TS + k * 8 + 7, 16, 1, "#463626"); if (((x * TS + (row % 3) * 16) % 48) === 0) R(c, x * TS, y * TS + k * 8, 1, 7, "#4c3a28"); } };
  plank(6, 4, 14, 9); plank(18, 4, 24, 8);   // wood floor under the research pod and the quality corner (like the trading floor)
  c.strokeStyle = RI_TAG; c.lineWidth = 1; c.strokeRect(6 * TS + 0.5, 4 * TS + 0.5, 9 * TS - 1, 6 * TS - 1); c.strokeRect(18 * TS + 0.5, 4 * TS + 0.5, 7 * TS - 1, 5 * TS - 1);
  for (let y = 13; y <= 16; y++) for (let x = 1; x <= 4; x++) R(c, x * TS, y * TS, 16, 16, (x + y) % 2 ? "#2f2f35" : "#e9e3d3");   // coffee nook tiles
  R(c, 9 * TS + 4, 10 * TS + 4, 7 * TS - 8, 4 * TS - 8, "#173b44"); c.strokeStyle = RI_TAG; c.lineWidth = 1; c.strokeRect(9 * TS + 6.5, 10 * TS + 6.5, 7 * TS - 13, 4 * TS - 13);   // meeting rug
  R(c, 4 * TS + 4, 12 * TS + 4, 5 * TS - 8, 2 * TS - 6, "#3a3328");   // archive mat
  // stairs up (bottom wall) + landing mat
  const sx = 15 * TS, sy = 16 * TS, by = 17 * TS;
  R(c, sx + 1, sy + 2, 46, 13, "#0b3b44"); c.strokeStyle = RI_TAG; c.strokeRect(sx + 1.5, sy + 2.5, 45, 12);
  ptextC(c, "^ UP TO", sx + 24, sy + 3, RI_TAG, 1); ptextC(c, "THE FLOOR", sx + 24, sy + 9, "#bff8ff", 1);
  // walls
  R(c, 0, 3 * TS, TS, LH, "#1a2226"); R(c, LW - TS, 3 * TS, TS, LH, "#1a2226");
  R(c, TS - 3, 3 * TS, 3, LH - 4 * TS, "#2c383e"); R(c, LW - TS, 3 * TS, 3, LH - 4 * TS, "#2c383e");
  R(c, 0, (GH - 1) * TS, LW, TS, "#1a2226"); R(c, 0, (GH - 1) * TS, LW, 3, "#2c383e");
  for (let i = 0; i < 4; i++) { R(c, sx + 1, by + 12 - i * 4, 46, 4, shade("#5d7480", 1 - i * 0.16)); R(c, sx + 1, by + 12 - i * 4, 46, 1, shade("#9bb3bf", 1 - i * 0.16)); }
  R(c, sx - 1, by - 4, 2, TS + 4, "#c79a3a"); R(c, sx + 47, by - 4, 2, TS + 4, "#c79a3a");
  R(c, 0, 0, LW, 3 * TS, "#1f2d33");   // top wall (cooler than upstairs green)
  for (let x = 0; x < LW; x += 8) R(c, x, 4, 1, 30, "rgba(0,0,0,.08)");
  R(c, 0, 0, LW, 3, "#121b1f"); R(c, 0, 36, LW, 12, "#3a3026"); R(c, 0, 36, LW, 2, "#5f5040"); R(c, 0, 46, LW, 2, "#241c14");
  for (let x = 4; x < LW; x += 24) R(c, x, 39, 16, 5, "#463a2c");
  R(c, 0, 37, LW, 1, RI_TAG);   // cyan RI stripe
  R(c, 0, 3 * TS - 1, LW, 1, "#141008");
  // board frames
  R(c, 14, 4, 84, 32, "#0e1316"); frame(c, 14, 4, 84, 32, "#2b2b2b");            // news wall
  R(c, 126, 6, 60, 28, "#1b2a22"); frame(c, 126, 6, 60, 28, "#5a3b22");           // earnings + macro board
  R(c, 198, 6, 66, 28, "#b08350"); frame(c, 198, 6, 66, 28, "#5a3b22");           // ideas corkboard
  for (let i = 0; i < 40; i++) R(c, 199 + ((i * 37) % 64), 7 + ((i * 17) % 26), 1, 1, "#8f6a3e");
  R(c, 300, 6, 82, 28, "#9aa3a8"); R(c, 302, 8, 78, 24, "#f4f6f2"); R(c, 312, 33, 60, 2, "#7a8288");   // Proof's whiteboard
  R(c, 102, 10, 18, 14, "#0b3b44"); c.strokeStyle = RI_TAG; c.strokeRect(102.5, 10.5, 17, 13); ptextC(c, "B1", 111, 12, RI_TAG, 1); ptextC(c, "RI", 111, 18, "#bff8ff", 1);
  R(c, 132, (GH - 1) * TS + 3, 100, 12, "#05080a"); frame(c, 132, (GH - 1) * TS + 3, 100, 12, "#2b2b2b");   // LED sign frame
}
function marquee(c, s, x, y, w, col, t, speed = 14) {
  const tw0 = tw(s, 1);
  c.save(); c.beginPath(); c.rect(x, y - 1, w, 7); c.clip();
  if (tw0 <= w) ptext(c, s, x + (w - tw0) / 2, y, col, 1);
  else { const o = (t * speed) % (tw0 + 20); ptext(c, s, x - o, y, col, 1); ptext(c, s, x - o + tw0 + 20, y, col, 1); }
  c.restore();
}
function drawWallLive(t) {
  const c = g, s = sig(), briefs = (DATA && DATA.briefs) || [], evs = (DATA && DATA.events) || [];
  // ---- news wall: 6 TVs with real feeds
  const tvs = [];
  tvs.push(["BRIEF", briefs.length ? clean(briefs[0].headline || briefs[0].shift || briefs[0].name, 60) : "NO BRIEFS YET", "#ffd166"]);
  for (const sym of ["SPY", "QQQ"]) { const k = tick(sym); tvs.push([sym, k ? `${k.price.toFixed(2)} ${k.chg_pct >= 0 ? "+" : ""}${(k.chg_pct * 100).toFixed(2)}%` : "NO QUOTE", k && k.chg_pct < 0 ? "#ff6b6b" : "#3ddc84"]); }
  tvs.push(["MARKET", clean((ST && ST.market && ST.market.status) || "-"), "#9ad1ff"]);
  const n = nextShift(); tvs.push(["NEXT", n ? h12(n.time_et) : "-", "#bff8ff"]);
  const le = evs[evs.length - 1]; tvs.push(["SQUAWK", le ? clean(le.note || le.type, 50) : "QUIET", "#f4efe0"]);
  tvs.forEach(([hd, body, col], i) => {
    const x = 16 + (i % 3) * 27, y = 6 + ((i / 3) | 0) * 15;
    R(c, x, y, 25, 13, "#15151b"); R(c, x + 1, y + 1, 23, 11, "#071017");
    ptext(c, hd.slice(0, 6), x + 2, y + 1, RI_TAG, 1); marquee(c, body, x + 1, y + 7, 23, col, t + i * 3, 10);
  });
  // ---- earnings + macro board
  ptext(c, "EARNINGS", 128, 8, "#f2c14e", 1);
  let er = s.earnings; if (er && !Array.isArray(er) && typeof er === "object") er = Object.keys(er).map((k) => Object.assign({ ticker: k }, typeof er[k] === "object" ? er[k] : { date: er[k] }));
  er = arr(er);
  if (!er.length) ptext(c, "NONE YET", 128, 15, "#7f8f86", 1);
  er.slice(0, 2).forEach((e, i) => ptext(c, `${clean(e.ticker, 5)} ${clean(e.date || "").slice(5)}`, 128, 15 + i * 6, "#e8e2cf", 1));
  ptext(c, "MACRO", 128, 27 - (er.length > 1 ? 0 : 0), "#f2c14e", 1);
  const mc = arr(s.macro_events || s.macro);
  ptext(c, mc.length ? clean(`${mc[0].time_et || ""} ${mc[0].event || ""}`, 7) : "-", 152, 27, mc.length && mc[0].impact === "high" ? "#ff8a8a" : "#c9d3cc", 1);
  // ---- ideas corkboard
  const notes = arr(s.ideas).slice(0, 4).map((x) => [clean(x.ticker, 5), x.direction ? clean(x.direction, 5) : "", "#fff3a0", x.confidence])
    .concat(arr(s.avoid).slice(0, 2).map((x) => [clean(x.ticker, 5), "AVOID", "#ffb3b3", null]));
  if (!notes.length) { R(c, 208, 13, 46, 13, "#f4efe0"); R(c, 230, 12, 2, 2, "#d03030"); ptextC(c, "NO IDEAS", 231, 15, "#555", 1); ptextC(c, "YET", 231, 21, "#555", 1); }
  notes.slice(0, 6).forEach(([tk, d, col, conf], i) => {
    const x = 200 + (i % 3) * 21, y = 8 + ((i / 3) | 0) * 13;
    R(c, x, y, 19, 12, col); R(c, x + 8, y - 1, 2, 2, "#d03030"); ptext(c, tk, x + 1, y + 1, "#222", 1);
    ptext(c, d || (conf != null ? String(conf).slice(0, 4) : ""), x + 1, y + 6, d === "AVOID" ? "#b91c1c" : "#555", 1);
  });
  // ---- Proof's lessons whiteboard
  ptext(c, "LESSONS", 304, 10, "#2f6fdb", 1);
  const ls = (DATA && DATA.lessons && DATA.lessons.items) || [];
  ptext(c, ls.length ? ls.length + " LOGGED" : "NONE YET", 336, 10, "#d03030", 1);
  for (let i = 0; i < 2; i++) ptext(c, ls[i] ? clean(ls[i], 19) : "", 304, 17 + i * 7, i === 0 ? "#222" : "#555", 1);
  // ---- clock
  R(c, 388, 12, 12, 12, "#e9e2c9"); c.strokeStyle = "#3b2a1a"; c.lineWidth = 1; c.strokeRect(388.5, 12.5, 11, 11);
  const et = etNow(), a1 = (et.hh % 12 + et.mm / 60) / 12 * Math.PI * 2, a2 = et.mm / 60 * Math.PI * 2;
  c.strokeStyle = "#111"; c.beginPath(); c.moveTo(394, 18); c.lineTo(394 + Math.sin(a1) * 3, 18 - Math.cos(a1) * 3); c.stroke();
  c.strokeStyle = "#a00"; c.beginPath(); c.moveTo(394, 18); c.lineTo(394 + Math.sin(a2) * 5, 18 - Math.cos(a2) * 5); c.stroke();
  // ---- LED next-shift sign (bottom wall)
  const nx = nextShift();
  marquee(c, nx ? `${nextShiftShort()} ${nx.day === "today" ? "" : nx.day.toUpperCase()} - IN ${cd(nx.mins)}` : "NO SHIFT SCHEDULED", 134, (GH - 1) * TS + 6, 96, "#ff9d3b", t, 12);
}
function monitor(c, x, y, w, h, mode, seed, t) {
  R(c, x, y, w, h, "#15151b"); R(c, x + w / 2 - 1, y + h, 2, 2, "#2a2a30");
  const sx = x + 1, sy = y + 1, sw = w - 2, sh = h - 2;
  if (mode === "off") { R(c, sx, sy, sw, sh, "#0b0d14"); return; }
  if (mode === "saver") { R(c, sx, sy, sw, sh, "#0d1f26"); const k = Math.floor(t * 2 + seed * 7) % (sw * sh); R(c, sx + (k % sw), sy + ((k / sw) | 0), 1, 1, RI_TAG); return; }
  R(c, sx, sy, sw, sh, "#eef3f5");   // document being written
  const sc = Math.floor(t * 3 + seed * 10);
  for (let i = 0; i < sh; i += 2) R(c, sx + 1, sy + i, ((i * 7 + sc * 3) % (sw - 3)) + 2, 1, i === 0 ? RI_TAG : "#7a8794");
}
const DRAW = {
  desk(f, t) {
    const px = f.x * TS, py = f.y * TS, id = f.who, c = chars[id], away = c.hidden || (activeTrip(id) && nowMs() >= activeTrip(id).tUp);
    const top = "#5e6b72";
    if (f.face === "N") {   // (dormant: no desk uses it since every desk faces the viewer) back-to-back half of a pod: we see the monitor backs, the staffer sits south of the desk
      R(g, px + 1, py - 1, 46, 12, top); R(g, px + 1, py - 1, 46, 1, shade(top, 1.25)); R(g, px + 1, py + 11, 46, 5, "#3a444a"); R(g, px + 1, py + 15, 46, 1, RI_TAG);
      for (const mx of [px + 3, px + 32]) { R(g, mx, py - 6, 13, 9, "#202228"); R(g, mx + 1, py - 5, 11, 7, "#2b2e36"); R(g, mx + 5, py + 3, 3, 2, "#202228"); R(g, mx + 1, py - 5, 11, 1, away ? "#2b2e36" : c.workUntil > T ? RI_TAG : "#3a4a52"); }
      R(g, px + 18, py + 6, 12, 3, "#2b2b33"); R(g, px + 19, py + 7, 10, 1, "#55555f");
      R(g, px + 34, py + 6, 8, 4, "#e8e2cf"); R(g, px + 35, py + 7, 6, 1, "#999"); R(g, px + 5, py + 6, 3, 3, "#f1f1f1"); R(g, px + 6, py + 6, 1, 1, "#5a3a22");
      R(g, px + 1, py + 11, 18, 5, "#1a2226"); ptext(g, CAST[id].name, px + 2, py + 11, COL[id], 1);
      if (away) { R(g, px + 32, py + 1, 11, 8, "#fff3a0"); ptextC(g, "UP", px + 38, py + 2, "#b45309", 1); }
      return;
    }
    R(g, px + 1, py - 3, 46, 13, top); R(g, px + 1, py - 3, 46, 2, shade(top, 1.25)); R(g, px + 1, py + 10, 46, 6, "#3a444a");
    R(g, px + 1, py + 10, 46, 1, RI_TAG);
    monitor(g, px + 3, py - 12, 13, 9, away ? "off" : c.workUntil > T ? "doc" : "saver", hash(id), t);
    monitor(g, px + 32, py - 12, 13, 9, away ? "off" : c.workUntil > T ? "doc" : "saver", hash(id) + 0.5, t);
    R(g, px + 18, py + 2, 12, 3, "#2b2b33"); R(g, px + 19, py + 3, 10, 1, "#55555f");
    R(g, px + 38, py + 3, 3, 3, "#f1f1f1"); R(g, px + 39, py + 3, 1, 1, "#5a3a22");
    R(g, px + 5, py + 2, 8, 5, "#e8e2cf"); R(g, px + 6, py + 3, 6, 1, "#999"); R(g, px + 6, py + 5, 4, 1, "#999");
    R(g, px + 15, py + 11, 18, 5, "#1a2226"); ptextC(g, CAST[id].name, px + 24, py + 11, COL[id], 1);
    if (away) { R(g, px + 33, py - 2, 11, 8, "#fff3a0"); ptextC(g, "UP", px + 39, py - 1, "#b45309", 1); }
  },
  podsign(f) {   // like the desk-cluster signs upstairs
    const px = f.x * TS, py = f.y * TS, n = nextShift();
    R(g, px + 7, py + 2, 2, 14, "#3a3026"); R(g, px + 1, py - 12, 14, 15, "#0b3b44"); g.strokeStyle = RI_TAG; g.lineWidth = 1; g.strokeRect(px + 1.5, py - 11.5, 13, 14);
    ptextC(g, "RI", px + 8, py - 10, RI_TAG, 1); ptextC(g, n ? n.time_et.replace(":", "") : "--", px + 8, py - 3, "#bff8ff", 1);
  },
  podplant(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 2, py + 2, 12, 12, "#4a3a2c"); R(g, px + 2, py + 2, 12, 1, "#6b5640"); R(g, px + 3, py - 6, 10, 9, "#2f7d3a"); R(g, px + 1, py - 2, 4, 4, "#3c9a48"); R(g, px + 11, py - 3, 4, 4, "#3c9a48"); R(g, px + 6, py - 8, 3, 3, "#3c9a48"); },
  cred(f) {   // Proof's credenza: in/out trays for graded calls
    const px = f.x * TS, py = f.y * TS;
    R(g, px + 1, py - 2, 14, 17, "#4a3a2c"); R(g, px + 1, py - 2, 14, 2, "#6b5640"); R(g, px + 3, py + 6, 10, 1, "#2b2016"); R(g, px + 7, py + 9, 2, 1, "#c79a3a");
    R(g, px + 2, py - 6, 12, 4, "#8b5e3c"); R(g, px + 3, py - 7, 10, 2, "#f8f8f4"); R(g, px + 3, py - 10, 10, 3, "#e9c46a");
  },
  table(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 2, py - 2, f.w * TS - 4, f.h * TS - 2, "#6b4a2e"); R(g, px + 2, py - 2, f.w * TS - 4, 2, "#8a6440"); R(g, px + 2, py + f.h * TS - 6, f.w * TS - 4, 4, "#4a3020"); R(g, px + 14, py + 6, 8, 6, "#e8e2cf"); R(g, px + 26, py + 10, 3, 3, "#f1f1f1"); },
  coffee(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px, py - 4, 48, 14, "#5b3a1e"); R(g, px, py - 4, 48, 2, "#7a5030"); R(g, px, py + 10, 48, 6, "#3b2614");
    R(g, px + 4, py - 14, 12, 12, "#2b2b2b"); R(g, px + 6, py - 12, 8, 4, "#c0392b"); R(g, px + 8, py - 6, 4, 3, "#111");
    if (Math.floor(t * 2) % 2) R(g, px + 9, py - 17, 1, 2, "rgba(255,255,255,.5)");
    for (let i = 0; i < 4; i++) R(g, px + 22 + i * 5, py - 2, 3, 4, i % 2 ? "#f1f1f1" : "#00a5b8");
    ptextC(g, "COFFEE", px + 24, py + 11, "#e7c56a", 1);
  },
  rack(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px + 1, py - 10, 14, f.h * TS + 8, "#141619"); R(g, px + 2, py - 9, 12, f.h * TS + 6, "#23262b");
    for (let i = 0; i < 9; i++) { R(g, px + 3, py - 7 + i * 5, 10, 3, "#30343a"); R(g, px + 4 + ((i * 3 + Math.floor(t * 4)) % 7 < 3 ? 6 : 0), py - 6 + i * 5, 1, 1, (i + Math.floor(t * 3)) % 3 ? "#3ddc84" : RI_TAG); }
  },
  cooler(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 4, py - 8, 8, 18, "#e9eef2"); R(g, px + 5, py - 16, 6, 9, "#7fd3ff"); R(g, px + 6, py - 14, 1, 5, "#c5ecff"); R(g, px + 5, py - 2, 2, 2, "#2563eb"); R(g, px + 9, py - 2, 2, 2, "#dc2626"); },
  archive(f) {
    const px = f.x * TS, py = f.y * TS;
    for (let i = 0; i < f.w; i++) { const x = px + i * TS; R(g, x + 1, py - 12, 14, 26, "#6b7a80"); R(g, x + 1, py - 12, 14, 2, "#8c9ba1"); for (let k = 0; k < 3; k++) { R(g, x + 2, py - 9 + k * 8, 12, 7, "#59676d"); R(g, x + 6, py - 6 + k * 8, 4, 1, "#c9d3d6"); } }
    ptextC(g, "ARCHIVE", px + f.w * 8, py + 9, "#e8e2cf", 1);
  },
  tube(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px + 4, py - 30, 8, 44, "#c79a3a"); R(g, px + 5, py - 30, 6, 44, "rgba(180,230,240,.55)"); R(g, px + 2, py + 6, 12, 8, "#8a6a2a"); R(g, px + 3, py + 7, 10, 2, "#e7c56a");
    if (tubeUntil > T) { const k = 1 - (tubeUntil - T) / 3.2, cy = py + 4 - k * 36; R(g, px + 5, cy, 6, 8, "#ffd166"); R(g, px + 5, cy, 6, 1, "#b8933a"); }
    ptextC(g, "TUBE", px + 8, py + 9, "#3b2a1a", 1);
  },
  score(f) {
    const px = f.x * TS, py = f.y * TS, cl = (DATA && DATA.calls) || {};
    R(g, px + 4, py + 2, 2, 12, "#3b2a1a"); R(g, px + 26, py + 2, 2, 12, "#3b2a1a");
    R(g, px, py - 14, 32, 18, "#0e1316"); frame(g, px, py - 14, 32, 18, "#5a3b22");
    ptextC(g, "CALLS", px + 16, py - 13, "#f2c14e", 1);
    ptextC(g, cl.hit_rate != null ? Math.round(cl.hit_rate * 100) + "%" : cl.total ? cl.open + " OPEN" : "NONE", px + 16, py - 6, cl.hit_rate != null ? "#3ddc84" : "#9fb3bb", 1);
  },
  printer(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 2, py - 6, 28, 16, "#d6d9dc"); R(g, px + 2, py - 6, 28, 2, "#f1f3f5"); R(g, px + 6, py - 9, 20, 4, "#f8f8f4"); R(g, px + 4, py + 4, 24, 3, "#2b2b33"); R(g, px + 26, py - 2, 2, 2, "#3ddc84"); },
  pingpong(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 2, py + 2, 44, 26, "#1f6f5c"); R(g, px + 2, py + 2, 44, 1, "#e8f1ee"); R(g, px + 2, py + 27, 44, 1, "#e8f1ee"); R(g, px + 23, py, 2, 30, "#e8f1ee"); R(g, px + 2, py + 14, 44, 1, "#bcd6cf"); },
  arcade(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 2, py - 8, 12, 22, "#3b2a6b"); R(g, px + 3, py - 6, 10, 7, "#0b1020"); R(g, px + 4, py - 5, 3, 2, "#ff4fa3"); R(g, px + 9, py - 3, 2, 2, "#00e5ff"); R(g, px + 3, py + 3, 10, 3, "#22223a"); R(g, px + 5, py + 3, 2, 2, "#e63946"); },
  plant(f) { const px = f.x * TS, py = f.y * TS, b = f.big ? 2 : 0; R(g, px + 4, py + 6, 8, 8, "#8a4b2a"); R(g, px + 5 - b, py - 4 - b * 2, 6 + b * 2, 10 + b, "#2f7d3a"); R(g, px + 2 - b, py - 1, 4, 5, "#3c9a48"); R(g, px + 10 + b, py - 2, 4, 5, "#3c9a48"); },
};
function drawChar(c, t) {
  const k = CAST[c.id], col = COL[c.id];
  const sitting = c.pose === "sit" && !c.moving && !c.path.length;
  const fx = Math.round(c.x), fy = Math.round(c.y + (sitting ? 3 : 6)), face = c.face, x0 = fx - 7, top = fy - 24;
  const walkF = c.moving ? Math.floor(c.walkT * 8) % 2 : 0;
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(fx - 6, fy - 1, 12, 3);
  if (!sitting) {
    R(g, x0 + 3, top + 19, 3, 4 - (walkF ? 1 : 0), k.pants); R(g, x0 + 8, top + 19, 3, 4 - (walkF ? 0 : 1), k.pants);
    R(g, x0 + 3, top + 23 - (walkF ? 1 : 0), 3, 1, "#1f1f1f"); R(g, x0 + 8, top + 23 - (walkF ? 0 : 1), 3, 1, "#1f1f1f"); R(g, x0 + 3, top + 18, 8, 1, shade(k.pants, 0.8));
  }
  R(g, x0 + 2, top + 11, 10, 8, k.shirt); R(g, x0 + 2, top + 11, 10, 1, shade(k.shirt, 1.2));
  const a1 = sitting && c.workUntil > T && Math.floor(t * 6 + hash(c.id) * 5) % 2 ? 1 : 0;
  R(g, x0, top + 12 + a1, 2, 5, k.shirt); R(g, x0 + 12, top + 12 + (1 - a1), 2, 5, k.shirt);
  R(g, x0, top + 17 + a1, 2, 1, k.skin); R(g, x0 + 12, top + 17 + (1 - a1), 2, 1, k.skin);
  R(g, x0 + 1, top + 1, 12, 10, k.skin); R(g, x0 + 1, top + 10, 12, 1, shade(k.skin, 0.85));
  if (face === "N") R(g, x0 + 1, top, 12, 10, k.hair);
  else {
    R(g, x0 + 1, top, 12, 3, k.hair); R(g, x0, top + 1, 2, 6, k.hair); R(g, x0 + 12, top + 1, 2, 6, k.hair);
    if (k.long) { R(g, x0, top + 1, 2, 12, k.hair); R(g, x0 + 12, top + 1, 2, 12, k.hair); R(g, x0 + 1, top - 1, 12, 2, k.hair); }
    const ex = face === "E" ? [7, 10] : face === "W" ? [3, 6] : [4, 9];
    R(g, x0 + ex[0], top + 5, 2, 2, "#1b1b1b"); R(g, x0 + ex[1], top + 5, 2, 2, "#1b1b1b");
    R(g, x0 + (face === "E" ? 8 : face === "W" ? 4 : 6), top + 8, 2, 1, "#9a3b3b");
  }
  if (face !== "N") { R(g, x0 + 4, top + 11, 1, 4, RI_TAG); R(g, x0 + 9, top + 11, 1, 4, RI_TAG); R(g, x0 + 5, top + 14, 4, 4, "#ffffff"); R(g, x0 + 6, top + 15, 2, 1, RI_TAG); R(g, x0 + 6, top + 17, 2, 1, "#555"); }
  else R(g, x0 + 4, top + 11, 6, 1, RI_TAG);
  switch (k.ri) {
    case "fedora": R(g, x0 - 2, top + 1, 18, 2, "#3d2b1f"); R(g, x0 + 1, top - 4, 12, 5, "#5a4632"); R(g, x0 + 1, top - 1, 12, 1, "#1b1b1b");
      if (face !== "N") { R(g, x0 + 9, top - 4, 3, 3, "#fff"); R(g, x0 + 10, top - 3, 1, 1, "#c00"); } break;
    case "bun": R(g, x0 + 5, top - 4, 4, 4, k.hair);
      if (face !== "N") { const ex = face === "E" ? [7, 10] : face === "W" ? [3, 6] : [4, 9]; R(g, x0 + ex[0] - 1, top + 4, 4, 1, col); R(g, x0 + ex[1] - 1, top + 4, 4, 1, col); R(g, x0 + ex[0] - 1, top + 7, 4, 1, col); R(g, x0 + ex[1] - 1, top + 7, 4, 1, col); } break;
    case "bowtie": if (face === "S") { R(g, x0 + 4, top + 11, 2, 2, "#2b2d42"); R(g, x0 + 8, top + 11, 2, 2, "#2b2d42"); R(g, x0 + 6, top + 11, 2, 1, "#ffd166"); } break;
    case "beret": R(g, x0, top - 2, 13, 4, "#2b2d42"); R(g, x0 + 6, top - 3, 2, 1, "#2b2d42"); if (face !== "N") R(g, face === "W" ? x0 + 12 : x0 - 1, top + 3, 2, 4, "#f2c14e"); break;
    case "hardhat": R(g, x0 + 1, top - 3, 12, 5, "#ffd60a"); R(g, x0 - 1, top + 1, 16, 1, "#d4a800"); R(g, x0 + 6, top - 3, 2, 4, "#fff3a0"); break;
  }
  const hx = face === "W" ? x0 - 4 : x0 + 11;
  if (c.carry) { R(g, hx, top + 12, 7, 6, "#e9c46a"); R(g, hx, top + 12, 7, 1, "#b8933a"); R(g, hx + 1, top + 14, 5, 1, "#7a5a12"); R(g, hx + 1, top + 16, 3, 1, "#7a5a12"); }
  else if (k.ri === "hardhat" && !sitting) { R(g, hx + 1, top + 11, 5, 7, "#8b5e3c"); R(g, hx + 2, top + 12, 3, 5, "#fff"); R(g, hx + 2, top + 13, 1, 1, "#16a34a"); R(g, hx + 2, top + 15, 1, 1, "#16a34a"); }
}
let bgDone = false;
function renderWorld(t) {
  if (!bgDone) { drawBackground(); bgDone = true; }
  g.drawImage(bg, 0, 0);
  drawWallLive(t);
  const items = [];
  for (const f of FURN) items.push({ y: (f.y + f.h) * TS - (f.type === "desk" ? 0 : 1), f });
  for (const id in CHAIRS) { const nf = SPOTS["chair_" + id] && SPOTS["chair_" + id].face === "N"; items.push({ y: CHAIRS[id][1] * TS + (nf ? 15 : 12), chair: CHAIRS[id], nf }); }
  for (const id of ORDER) { const c = chars[id]; if (!c.hidden) items.push({ y: c.y + 6.5, c }); }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.f) DRAW[it.f.type](it.f, t);
    else if (it.chair && it.nf) { const px = it.chair[0] * TS, py = it.chair[1] * TS; R(g, px + 2, py + 2, 12, 5, "#30303a"); R(g, px + 3, py + 7, 10, 5, "#23232b"); R(g, px + 3, py + 7, 10, 1, "#3a3a46"); R(g, px + 7, py + 12, 2, 2, "#18181d"); R(g, px + 4, py + 14, 8, 1, "#18181d"); }
    else if (it.chair) { const px = it.chair[0] * TS, py = it.chair[1] * TS; R(g, px + 3, py - 1, 10, 4, "#23232b"); R(g, px + 2, py + 3, 12, 6, "#30303a"); R(g, px + 7, py + 9, 2, 3, "#18181d"); R(g, px + 4, py + 12, 8, 1, "#18181d"); }
    else if (it.c) drawChar(it.c, t);
  }
  // fluorescent ceiling panels (basement: steady light, no windows)
  g.save(); g.globalCompositeOperation = "lighter";
  for (const [lx, ly] of [[4, 5], [9, 5], [14, 5], [19, 5], [23, 5], [6, 11], [12, 11], [18, 11], [3, 15], [12, 15], [21, 15]]) {
    const x = lx * TS, y = ly * TS, gr = g.createRadialGradient(x, y, 2, x, y, 30);
    gr.addColorStop(0, "rgba(170,235,255,.09)"); gr.addColorStop(1, "rgba(170,235,255,0)"); g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60);
  }
  g.restore();
  R(g, 16 * TS + 12, 17 * TS + 1, 2, 2, ORDER.some((id) => chars[id].task && chars[id].task.label === "goingup") || Math.floor(t * 2) % 2 ? RI_TAG : "#0b3b44");   // stair light
}

// ============================================================== display canvas + overlay text (device pixels)
const cv = $("cv"), ctx = cv.getContext("2d");
let SC = 2, DPR = 1, ZOOM = 1, LP = 2, selected = null;
function layout() {
  DPR = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
  const wrap = $("floorWrap"), side = matchMedia("(min-width:760px) and (min-aspect-ratio:1/1)").matches;
  const availW = (side ? wrap.clientWidth : document.documentElement.clientWidth) - (side ? 12 : 4);
  const availH = side ? wrap.clientHeight - 8 : Math.round(window.innerHeight * 0.62);
  const sFit = Math.min(availW / LW, availH / LH) * DPR;
  let s = Math.floor(sFit); if (s < 1 || s < sFit * 0.86) s = sFit;
  SC = s * ZOOM;
  cv.width = Math.round(LW * SC); cv.height = Math.round(LH * SC);
  cv.style.width = (cv.width / DPR) + "px"; cv.style.height = (cv.height / DPR) + "px";
  wrap.style.height = side ? "" : (cv.height / DPR) + "px";
  LP = Math.max(2, Math.round(Math.max(DPR * 1.55, SC * 0.62)));
  ctx.imageSmoothingEnabled = false;
}
function roundRect(c, x, y, w, h, r, fill, stroke, lw) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function wrapText(s, n) { const w = s.split(" "), out = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) out.push(cur); return out.slice(0, 3); }
function drawOverlay() {
  const px = LP, vis = ORDER.map((id) => chars[id]).filter((c) => !c.hidden).sort((a, b) => b.y - a.y);
  const placed = [], bubbles = [], bubbleQ = [];
  let zoomR = null;   // the HTML buttons float over the canvas: keep bubbles out from under them
  const zb = $("floorBtns");
  if (zb && zb.offsetWidth) { const a = zb.getBoundingClientRect(), b = cv.getBoundingClientRect(), k = cv.width / (b.width || 1); zoomR = { x: (a.left - b.left) * k, y: (a.top - b.top) * k, w: a.width * k, h: a.height * k }; }
  for (const c of vis) {
    const sitting = c.pose === "sit" && !c.moving && !c.path.length;
    const headY = (c.y + (sitting ? 3 : 6) - 30) * SC, cx = c.x * SC, name = CAST[c.id].name;
    const w = tw(name, px) + px * 4, h = px * 7, tgw = tw("RI", px) + px * 2;
    const lx = Math.round(cx - (w - tgw) / 2); let ly = Math.round(headY - h - px);
    for (let guard = 0; guard < 8; guard++) { const hit = placed.find((r) => lx - tgw < r.x + r.w + px && lx + w + px > r.x && ly < r.y + r.h && ly + h > r.y); if (!hit) break; ly = hit.y - h - px; }
    placed.push({ x: lx - tgw, y: ly, w: w + tgw, h });
    ctx.fillStyle = selected === c.id ? "rgba(242,193,78,.95)" : "rgba(8,10,12,.78)"; ctx.fillRect(lx, ly, w, h);
    ctx.fillStyle = COL[c.id]; ctx.fillRect(lx, ly + h - px, w, px);
    ptext(ctx, name, lx + px * 2, ly + px, selected === c.id ? "#1a1205" : "#f4efe0", px);
    ctx.fillStyle = RI_TAG; ctx.fillRect(lx - tgw, ly, tgw, h); ptext(ctx, "RI", lx - tgw + px, ly + px, "#03262c", px);
    const by = ly - px;
    if (c.bubble) bubbleQ.push(() => {
      const lines = wrapText(c.bubble.text, 16);
      const bw = Math.max(...lines.map((l) => tw(l, px))) + px * 6, bh = lines.length * px * 7 + px * 3;
      let bx = Math.round(cx - bw / 2); bx = Math.max(2, Math.min(cv.width - bw - 2, bx));
      let byy = Math.round(by - bh - px * 3), down = false;
      const obst = bubbles.concat(placed, zoomR ? [zoomR] : []);
      const hitAt = (y) => obst.find((r) => bx < r.x + r.w + px && bx + bw + px > r.x && y < r.y + r.h + px && y + bh + px > r.y);
      let y = byy, ok = false;
      const maxUp = byy - bh - px * 12, y0 = Math.round((c.y + 8) * SC + px * 3);
      for (let k = 0; k < 4 && y >= 2 && y >= maxUp; k++) { const hit = hitAt(y); if (!hit) { ok = true; break; } y = hit.y - bh - px * 2; }
      if (!ok) { y = y0; for (let k = 0; k < 3 && y + bh <= cv.height - 2 && y <= y0 + px * 10; k++) { const hit = hitAt(y); if (!hit) { ok = down = true; break; } y = hit.y + hit.h + px * 2; } }
      if (ok) byy = y; else if (Math.floor(T / 2.5) % 2 === 0) return;
      byy = Math.max(2, byy);
      bubbles.push({ x: bx, y: byy, w: bw, h: bh });
      const tx = Math.max(bx + px * 3, Math.min(bx + bw - px * 3, cx));
      roundRect(ctx, bx, byy, bw, bh, px * 2, "#fffdf3", "#1b1b1b", Math.max(1, px / 2));
      ctx.fillStyle = "#fffdf3"; ctx.beginPath();
      if (down) { ctx.moveTo(tx - px * 2, byy + 1); ctx.lineTo(tx + px * 2, byy + 1); ctx.lineTo(tx, byy - px * 3); }
      else { ctx.moveTo(tx - px * 2, byy + bh - 1); ctx.lineTo(tx + px * 2, byy + bh - 1); ctx.lineTo(tx, byy + bh + px * 3); }
      ctx.fill();
      lines.forEach((l, i) => ptext(ctx, l, bx + (bw - tw(l, px)) / 2, byy + px * 2 + i * px * 7, "#1b1b1b", px));
    });
  }
  for (const f of bubbleQ) f();
}
function render(t) {
  renderWorld(t);
  ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(off, 0, 0, LW, LH, 0, 0, cv.width, cv.height);
  drawOverlay();
}

// ============================================================== side panel (real data only, with empty states)
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const hhmm = (ts) => { try { return new Date(ts).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }); } catch (e) { return "--:--"; } };
const dshort = (ts) => { try { return new Date(ts).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }); } catch (e) { return ""; } };
const empty = (s) => `<div class="empty">${esc(s)}</div>`;
const firstShift = () => `First shift ${h12(shiftList()[0].time_et)} ET.`;
function setHTML(id, h) { const el = $(id); if (el && el.dataset.k !== h) { el.innerHTML = h; el.dataset.k = h; } }
function status(id) {
  const c = chars[id], t = activeTrip(id);
  if (c.hidden && t) return ["UPSTAIRS", "with " + upName(t.to)];
  if (c.task && c.task.label === "goingup") return ["HEADING UP", "to " + upName(t ? t.to : "")];
  if (c.workUntil > T) return ["WORKING", c.task && c.task.steps[0] && typeof c.task.steps[0].say === "string" ? c.task.steps[0].say.toLowerCase() : "at desk"];
  if (atSpot(c, home(id))) return ["AT DESK", ""];
  return ["ON B1", areaOf(c.tx, c.ty)];
}
function renderHeader() {
  const n = nextShift();
  $("nextShift").textContent = n ? `${n.name} ${h12(n.time_et)}${n.day === "today" ? "" : " " + n.day}` : "-";
  $("countdown").textContent = n ? cd(n.mins).toLowerCase() : "-";
  $("shiftPill").textContent = n ? "NEXT: " + n.id.toUpperCase() : "WEEKEND";
  const s = DATA && DATA.signals;
  $("sigUpd").textContent = s && s.ok && s.mtime ? `${dshort(s.mtime)} ${hhmm(s.mtime)}` : s && s.status ? s.status : "-";
  $("clock").textContent = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date()) + " ET";
}
function renderPanel() {
  if (!DATA) return;
  const d = DATA, s = sig(), briefs = d.briefs || [];
  // analyst note
  const nt = d.note || {};
  setHTML("note", nt.exists && nt.text ? `<div class="note">${esc(nt.text)}</div><div class="gate">roundup_note.md &middot; ${esc(dshort(nt.mtime))} ${esc(hhmm(nt.mtime))} ET${nt.today ? "" : " (not from today)"}</div>` : empty("No analyst note yet. " + firstShift()));
  $("c-note").textContent = nt.exists && nt.text ? (nt.today ? "today" : dshort(nt.mtime)) : "";
  // shift schedule
  const n = nextShift(), today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  setHTML("shifts", shiftList().map((x) => {
    const own = { "pre-market": "scoop", midday: "tape", close: "beats" }[x.id] || "sage";
    const filed = briefs.some((b) => b.date === today && briefOwner(b) === own);
    const nx = n && n.id === x.id && n.day === "today";
    return `<div class="row"><span class="nm">${h12(x.time_et)}</span><span class="grow">${esc(x.name)} <span style="color:${COL[own]}">&middot; ${CAST[own].name}</span></span>${filed ? `<span class="badge b-act">FILED</span>` : nx ? `<span class="badge b-hold">NEXT</span>` : ""}</div>`;
  }).join("") + `<div class="gate">${n ? `Next: ${esc(n.name)} ${h12(n.time_et)} ET ${esc(n.day)}, in ${cd(n.mins).toLowerCase()}` : ""}. Weekdays only.</div>`);
  $("c-shifts").textContent = n ? "in " + cd(n.mins).toLowerCase() : "";
  // signals.json
  if (!(d.signals && d.signals.ok)) { setHTML("signals", empty("signals.json " + ((d.signals && d.signals.status) || "not written yet") + ". " + firstShift())); $("c-signals").textContent = ""; }
  else {
    let er = s.earnings; if (er && !Array.isArray(er) && typeof er === "object") er = Object.keys(er).map((k) => Object.assign({ ticker: k }, typeof er[k] === "object" ? er[k] : { date: er[k] }));
    er = arr(er); const av = arr(s.avoid), mc = arr(s.macro_events || s.macro), id = arr(s.ideas);
    const confCls = (c) => { const v = typeof c === "number" ? c : parseFloat(c); const t = String(c || "").toLowerCase(); return t.startsWith("h") || v >= 0.7 ? "h" : t.startsWith("m") || v >= 0.4 ? "m" : "l"; };
    const sec = (title, list, f, none) => `<div class="gate" style="margin-top:6px;color:var(--ri)">${title}</div>` + (list.length ? list.map(f).join("") : empty(none));
    setHTML("signals", `<div class="gate">Updated ${esc(dshort(s.updated || d.signals.mtime))} ${esc(hhmm(s.updated || d.signals.mtime))} ET</div>`
      + sec("IDEAS", id, (x) => `<div class="row"><b class="nm">${esc(x.ticker)}</b><span class="grow">${esc(x.direction || "")} ${esc(x.horizon || "")}${x.risk ? " &middot; risk: " + esc(x.risk) : ""}</span>${x.confidence != null ? `<span class="chip ${confCls(x.confidence)}">${esc(x.confidence)}</span>` : ""}</div>`, "No ideas posted yet.")
      + sec("AVOID", av, (x) => `<div class="row"><span class="chip av">${esc(x.ticker)}</span><span class="grow">${esc(x.reason || "")}</span><span class="r">${esc(x.until || "")}</span></div>`, "Nothing on the avoid list.")
      + sec("EARNINGS", er, (x) => `<div class="row"><b class="nm">${esc(x.ticker)}</b><span class="grow">${esc(x.date || "")}</span><span class="r">${esc(x.timing || "")}</span></div>`, "No earnings listed yet.")
      + sec("MACRO", mc, (x) => `<div class="row"><span class="nm">${esc(x.time_et || "")}</span><span class="grow">${esc(x.event || "")} ${esc(x.date || "")}</span>${x.impact ? `<span class="chip ${x.impact === "high" ? "av" : "m"}">${esc(x.impact)}</span>` : ""}</div>`, "No macro events listed yet."));
    $("c-signals").textContent = `${id.length} ideas · ${av.length} avoid`;
  }
  // briefs
  setHTML("briefs", briefs.length ? briefs.map((b) => `<div class="brief" data-brief="${esc(b.name)}"><div class="hd">${esc(b.date)} &middot; ${esc(b.shift)} <span style="color:${COL[briefOwner(b)]}">${CAST[briefOwner(b)].name}</span></div><div>${esc(b.headline || "")}</div>${(b.preview || []).slice(0, 2).map((l) => `<div class="pv">${esc(l)}</div>`).join("")}</div>`).join("") : empty("No briefs yet. " + firstShift()));
  $("c-briefs").textContent = briefs.length ? String(briefs.length) : "";
  // squawk: real floor events + B1 ambient (italic)
  const sq = (d.events || []).slice(-12).map((e) => ({ t: new Date(e.ts), who: whoList(e.who), msg: `${e.type === "meeting" ? "meeting" : e.type} &rarr; ${esc(upName(e.to))}: ${esc(e.note || "")}`, amb: false }))
    .concat(ambient.map((a) => ({ t: a.t, who: [a.who], msg: esc(a.msg), amb: true }))).sort((a, b) => b.t - a.t).slice(0, 16);
  setHTML("squawk", sq.length ? sq.map((x) => `<div class="sq${x.amb ? " amb" : ""}"><span class="t">${esc(hhmm(x.t))}</span><span class="w">${x.who.map((w) => `<span style="color:${COL[w]}">${CAST[w].name}</span>`).join("+")}</span><span class="m">${x.msg}</span></div>`).join("") : empty("Quiet on B1. Nothing sent upstairs yet."));
  $("c-squawk").textContent = (d.events || []).length ? (d.events || []).length + " events" : "";
  // staff
  setHTML("staff", ORDER.map((id) => { const [st, wh] = status(id); return `<div class="row" data-who="${id}" style="cursor:pointer"><span class="sw" style="background:${COL[id]}"></span><span class="nm">${CAST[id].name}</span><span class="grow">${esc(CAST[id].desk)}${wh ? " &middot; " + esc(wh) : ""}</span><span class="badge ${st === "UPSTAIRS" || st === "HEADING UP" ? "b-hold" : st === "WORKING" ? "b-act" : "b-home"}">${st}</span></div>`; }).join(""));
  $("c-staff").textContent = ORDER.filter((id) => chars[id].hidden).length ? ORDER.filter((id) => chars[id].hidden).length + " upstairs" : "all on B1";
  // calls board
  const cl = d.calls || {};
  setHTML("calls", cl.total ? `<div class="grid2"><div class="kv"><span>Open</span><b>${cl.open}</b></div><div class="kv"><span>Hit rate</span><b>${cl.hit_rate != null ? Math.round(cl.hit_rate * 100) + "%" : "not graded yet"}</b></div><div class="kv"><span>Hit</span><b class="up">${cl.hit}</b></div><div class="kv"><span>Miss</span><b class="dn">${cl.miss}</b></div></div>`
    + `<table style="margin-top:4px"><tr><th>Date</th><th>Ticker</th><th>Dir</th><th>Conf</th><th>Result</th></tr>${cl.rows.slice().reverse().slice(0, 20).map((r) => `<tr title="${esc(r.reason)}"><td>${esc(r.date)}</td><td><b>${esc(r.ticker)}</b></td><td>${esc(r.direction)}</td><td>${esc(r.confidence)}</td><td><span class="oc ${r.outcome}">${esc(r.outcome === "other" ? r.outcome_raw : r.outcome).toUpperCase()}</span></td></tr>`).join("")}</table>`
    : empty(cl.exists ? "No calls logged yet. Proof grades calls every Friday." : "calls.md not found."));
  $("c-calls").textContent = cl.total ? (cl.hit_rate != null ? Math.round(cl.hit_rate * 100) + "% hit" : cl.open + " open") : "";
  // lessons
  const ls = d.lessons || {};
  setHTML("lessons", ls.items && ls.items.length ? `<ol style="margin:0;padding-left:18px">${ls.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><div class="gate">lessons.md &middot; ${esc(dshort(ls.mtime))} ${esc(hhmm(ls.mtime))} ET</div>` : empty("No lessons logged yet."));
  $("c-lessons").textContent = ls.items && ls.items.length ? String(ls.items.length) : "";
  // coverage
  const cv0 = d.coverage || {};
  setHTML("cov", (cv0.desks || []).map((x) => `<div class="desk"><h4><span style="color:${COL[x.who]}">${CAST[x.who] ? CAST[x.who].name : esc(x.who)}</span><span class="gate" style="margin:0">${esc(x.desk)}</span></h4><div class="gate" style="margin:0">${esc(x.desc)}</div><div style="margin-top:3px">${esc(x.covers)}</div></div>`).join("")
    + (cv0.day ? `<div class="gate">Watchlist: day ${cv0.day.length} &middot; swing ${(cv0.swing || []).length}</div>` : empty("watchlist.md not found.")));
  $("c-cov").textContent = cv0.day ? (cv0.day.length + (cv0.swing || []).length) + " tickers" : "";
  $("upd").textContent = "B1 data " + hhmm(d.now) + " ET · read-only · zero tokens";
}
function renderTicker() {
  const tk = ((ST && ST.tickers) || []).map((x) => `<span>${esc(x.symbol)} ${x.price.toFixed(2)} <b class="${x.chg_pct > 0 ? "up" : x.chg_pct < 0 ? "dn" : ""}">${x.chg_pct >= 0 ? "▲" : "▼"}${Math.abs(x.chg_pct * 100).toFixed(2)}%</b></span>`).join("");
  const ti = $("tickInner"); if (ti.dataset.k !== tk) { ti.innerHTML = tk || "no quotes yet"; ti.dataset.k = tk; ti.style.animationDuration = Math.max(30, ((ST && ST.tickers) || []).length * 3.2) + "s"; }
}
async function openBrief(name) {
  $("modalTitle").textContent = name; $("modalBody").textContent = "loading..."; $("modal").classList.remove("hidden");
  try { const r = await fetch(STATIC_HOST ? "b1/briefs/" + encodeURIComponent(name) + ".json?ts=" + Date.now() : "b1/brief.json?name=" + encodeURIComponent(name), { cache: "no-store" }); const j = await r.json(); $("modalBody").textContent = r.ok ? j.text : (j.error || "not found"); }
  catch (e) { $("modalBody").textContent = "could not load the brief"; }
}
function showCard(id) {
  selected = id; const [st, wh] = status(id), desk = (DATA && DATA.coverage && (DATA.coverage.desks || []).find((x) => x.who === id)) || {};
  $("cardBody").innerHTML = `<h3 style="color:#1d1a12"><span class="sw" style="display:inline-block;background:${COL[id]}"></span> ${CAST[id].name} <span class="mut" style="font-size:11px">Research Inc. &middot; ${esc(CAST[id].desk)}</span></h3>`
    + `<div><b>${st}</b>${wh ? " &middot; " + esc(wh) : ""}</div><div class="mut">${esc(desk.desc || "")}</div><div style="margin-top:4px">${esc(line(id))}</div>`;
  $("card").classList.remove("hidden");
}
function openSec(id) { const el = $(id); if (!el) return; el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); el.style.outline = "2px solid " + RI_TAG; setTimeout(() => (el.style.outline = ""), 1200); }

// ============================================================== navigation (stairs up, deep link back)
function goUp(ev) {
  if (ev) ev.preventDefault();
  const f = $("fade"); f.querySelector("span").textContent = "▲ GOING UP"; f.querySelector("small").textContent = "TO THE TRADING FLOOR"; f.classList.remove("off");
  try { sessionStorage.setItem("floorNav", "fromB1"); } catch (e) { /* private mode */ }
  setTimeout(() => { location.href = "index.html"; }, 500);
}
$("upBtn").addEventListener("click", goUp); $("upBtn2").addEventListener("click", goUp);
const HOT = [{ id: "up", x: 15 * TS, y: 16 * TS, w: 3 * TS, h: 2 * TS }, { id: "s-briefs", x: 12, y: 2, w: 90, h: 36 }, { id: "s-signals", x: 124, y: 4, w: 142, h: 32 },
  { id: "s-lessons", x: 298, y: 4, w: 86, h: 32 }, { id: "s-calls", x: 22 * TS, y: 5 * TS, w: 3 * TS, h: 2 * TS }, { id: "s-shifts", x: 130, y: 17 * TS, w: 104, h: TS }, { id: "s-squawk", x: 19 * TS, y: 14 * TS, w: TS, h: 3 * TS }];
cv.addEventListener("click", (ev) => {
  const r = cv.getBoundingClientRect(), lx = (ev.clientX - r.left) * (cv.width / r.width) / SC, ly = (ev.clientY - r.top) * (cv.height / r.height) / SC;
  let best = null;
  for (const id of ORDER) { const c = chars[id]; if (c.hidden) continue; if (lx >= c.x - 9 && lx <= c.x + 9 && ly >= c.y - 22 && ly <= c.y + 8) if (!best || c.y > best.y) best = c; }
  if (best) return showCard(best.id);
  for (const h of HOT) if (lx >= h.x && lx <= h.x + h.w && ly >= h.y && ly <= h.y + h.h) return h.id === "up" ? goUp() : openSec(h.id);
  $("card").classList.add("hidden"); selected = null;
});
$("cardX").onclick = () => { $("card").classList.add("hidden"); selected = null; };
$("modalX").onclick = () => $("modal").classList.add("hidden");
$("modal").addEventListener("click", (ev) => { if (ev.target.id === "modal") $("modal").classList.add("hidden"); });
addEventListener("keydown", (ev) => { if (ev.key === "Escape") $("modal").classList.add("hidden"); });
$("briefs").addEventListener("click", (ev) => { const b = ev.target.closest("[data-brief]"); if (b) openBrief(b.dataset.brief); });
$("staff").addEventListener("click", (ev) => { const r = ev.target.closest("[data-who]"); if (r) showCard(r.dataset.who); });
$("zoomBtn").onclick = () => { ZOOM = ZOOM > 1 ? 1 : 1.7; $("floorWrap").classList.toggle("zoomed", ZOOM > 1); layout(); if (ZOOM > 1) { const w = $("floorWrap"); w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2; } };

// ============================================================== polling + main loop
let pollFails = 0;
async function pollB1() {
  try {
    const r = await fetch("b1/data.json?ts=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const prev = DATA; DATA = await r.json(); pollFails = 0;
    addTrips(DATA.events);
    if (firstPlace) initialPlace();
    dataChanges(prev, DATA);
    renderPanel();
  } catch (e) { pollFails++; if (pollFails === 3) $("upd").textContent = "waiting for the server..."; }
}
async function pollState() { try { const r = await fetch("state.json?ts=" + Date.now(), { cache: "no-store" }); if (r.ok) { ST = await r.json(); renderTicker(); } } catch (e) { /* keep last */ } }
let dirAcc = 0;
function step(dt) {
  T += dt;
  for (let k = timers.length - 1; k >= 0; k--) if (timers[k].at <= T) { const f = timers[k].fn; timers.splice(k, 1); try { f(); } catch (e) { /* ignore */ } }
  dirAcc += dt;
  if (dirAcc >= 0.25) { dirAcc = 0; for (const id of ORDER) director(chars[id]); }
  for (const id of ORDER) { const c = chars[id]; if (c.hidden) continue; stepMove(c, dt); if (c.bubble && c.bubble.until < T) c.bubble = null; }
}
let lastFrame = performance.now(), acc = 0, rendered = 0, panelAcc = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000); lastFrame = now;
  if (DATA && !STRESS) { acc += dt; while (acc >= 1 / 30) { step(1 / 30); acc -= 1 / 30; } }
  if (now - rendered > 32) { rendered = now; render(T); }
  if (now - panelAcc > 1000) { panelAcc = now; renderHeader(); if (DATA) renderPanel(); }
  requestAnimationFrame(loop);
}
addEventListener("resize", layout);
addEventListener("orientationchange", () => setTimeout(layout, 200));
if (matchMedia("(max-width:759px), (max-aspect-ratio:1/1)").matches) for (const id of ["s-squawk", "s-staff", "s-calls", "s-lessons", "s-cov"]) $(id).open = false;
layout(); renderHeader();
pollB1(); setInterval(pollB1, STATIC_HOST ? 60000 : 5000);
pollState(); setInterval(pollState, STATIC_HOST ? 60000 : 10000);
requestAnimationFrame(loop);
setTimeout(() => $("fade").classList.add("off"), 350);
addEventListener("pageshow", (ev) => { if (ev.persisted) $("fade").classList.add("off"); });   // back/forward cache

// ============================================================== test hook (tests/check_floor.py)
window.__b1 = {
  chars, blocked, trips,
  violations() {
    const out = [], vis = ORDER.map((id) => chars[id]).filter((c) => !c.hidden);
    for (const c of vis) { const tx = Math.floor(c.x / TS), ty = Math.floor(c.y / TS); if (tx < 0 || ty < 0 || tx >= GW || ty >= GH || blocked[I(tx, ty)]) out.push({ kind: "blocked", id: c.id, tx, ty }); }
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) { const a = vis[i], b = vis[j]; if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 12) out.push({ kind: "overlap", a: a.id, b: b.id }); }
    return out;
  },
  // simulate `secs` seconds on B1: trips upstairs (single + pair meetings), file-change work bursts, errands, huddles
  stress(secs, seed) {
    rngSeed = seed || 99991; simBase = Date.now() - T * 1000; STRESS = 1;
    const stats = { steps: 0, samples: 0, blocked: 0, overlap: 0, examples: [], moves: 0, trips: 0, maxAway: 0 };
    const lastTile = {}; let eid = 0;
    for (let k = 0; k < secs * 30; k++) {
      if (k % 600 === 200) { addTrips([{ id: "stress" + (++eid), ts: new Date(nowMs()).toISOString(), who: rnd() < 0.25 ? "sage,beats" : pick(ORDER), type: pick(["deliver", "visit", "meeting"]), to: pick(["grok", "dash", "knobs", "goldie"]), note: "STRESS TEST" }]); stats.trips++; }
      if (k % 900 === 450) dataChanges({ signals: { mtime: "a" }, briefs: [], lessons: {}, calls: { total: 0 }, note: {} }, { signals: { mtime: "b" + k, data: {} }, briefs: [], lessons: { mtime: rnd() < 0.5 ? "x" + k : null }, calls: { total: 0 }, note: {} });
      step(1 / 30); stats.steps++;
      if (k % 3 === 0) {
        stats.samples++;
        for (const x of this.violations()) { stats[x.kind]++; if (stats.examples.length < 8) stats.examples.push(Object.assign({ t: +T.toFixed(2) }, x)); }
        let away = 0;
        for (const id of ORDER) { const c = chars[id]; if (c.hidden) { away++; continue; } const key = c.tx + "," + c.ty; if (lastTile[id] && lastTile[id] !== key) stats.moves++; lastTile[id] = key; }
        stats.maxAway = Math.max(stats.maxAway, away);
      }
    }
    for (const id of ORDER) trips[id] = trips[id].filter((t) => !String(t.key).startsWith("stress"));
    STRESS = 0;
    return stats;
  },
};
