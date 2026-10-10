"use strict";
/* Tendies and Dip - 2D pixel trading floor. Read-only: polls state.json, everything else runs in the browser (zero tokens).
   World: 26x18 tiles of 16 px. Tile collision grid + A* (4-way) + tile reservation, so nobody walks through desks,
   walls or each other. Chairs are sit points (only enterable as a destination). */
const TS = 16, GW = 26, GH = 18, LW = GW * TS, LH = GH * TS;
const $ = (id) => document.getElementById(id);
// Always-on static copy (GitHub Pages): data is pushed every few minutes, so poll gently there.
const STATIC_HOST = /\.github\.io$/i.test(location.hostname);

// ============================================================== pixel font (3x5)
const FONT = {};
(function () {
  const d = {
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
  for (const k in d) FONT[k] = d[k];
})();
const tw = (s, px) => (String(s).length * 4 - 1) * px;
function ptext(g, s, x, y, col, px) {
  s = String(s).toUpperCase();
  g.fillStyle = col;
  let cx = Math.round(x); y = Math.round(y);
  for (const ch of s) {
    const f = FONT[ch] || FONT["?"];
    for (let i = 0; i < 15; i++) if (f.charCodeAt(i) === 35) g.fillRect(cx + (i % 3) * px, y + ((i / 3) | 0) * px, px, px);
    cx += 4 * px;
  }
}
function ptextC(g, s, cx, y, col, px) { ptext(g, s, cx - tw(s, px) / 2, y, col, px); }

// ============================================================== map
const blocked = new Uint8Array(GW * GH);   // 1 = wall/furniture
const seat = new Uint8Array(GW * GH);      // 1 = desk chair: only enterable as a destination
const I = (x, y) => y * GW + x;
function B(x0, y0, x1, y1, v = 1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[I(x, y)] = v; }
B(0, 0, GW - 1, 2); B(0, GH - 1, GW - 1, GH - 1); B(0, 0, 0, GH - 1); B(GW - 1, 0, GW - 1, GH - 1);
B(23, 17, 24, 17, 0);                      // entrance (bottom wall)
B(6, 3, 6, 8); B(6, 7, 6, 7, 0); B(1, 8, 6, 8);        // break room partitions, door at (6,7)
B(19, 3, 19, 8); B(19, 6, 19, 6, 0); B(19, 8, 24, 8);  // El Jefe's office: glass west wall (door 19,6), award wall south

const FURN = [];   // drawn + blocking
function F(type, x, y, w = 1, h = 1, o = {}) { FURN.push(Object.assign({ type, x, y, w, h }, o)); B(x, y, x + w - 1, y + h - 1); }
// break room
F("vending", 1, 3); F("fridge", 2, 3); F("kitchen", 3, 3, 2, 1); F("cooler", 5, 3); F("btable", 2, 5, 2, 1);
// left wall services
F("coffee", 1, 10, 3, 1); F("rack", 1, 13, 1, 3); F("copier", 4, 16, 2, 1); F("plant", 1, 16); F("plant", 7, 16, 1, 1, { big: 1 });
// trader desks (3 wide; chair north of the desk, bot faces south over its monitors)
// One Swing Desk department in two neat rows, each split into two pairs by a main aisle (x=13) that runs from the
// stairs/entrance lobby (y=15-16) to the back lounge (y=3-8). Aisles: back cross-aisle y=8, middle cross-aisle y=11-12,
// front aisle y=15, row ends x=6 and x=20. North row = hiring seats + Meet Kevin (training); south row = active traders.
const DESKS = {
  owl: [7, 10], vee: [10, 10], zip: [14, 10], snap: [17, 10],   // owl reuses laid-off dash seat
  trek: [7, 14], dip: [10, 14], rota: [14, 14], drift: [17, 14],
};
for (const id in DESKS) F("tdesk", DESKS[id][0], DESKS[id][1], 3, 1, { bot: id });
F("pdesk", 4, 13, 2, 1, { bot: "pixel" }); F("kdesk", 16, 5, 2, 1, { bot: "knobs" });
F("jdesk", 21, 5, 3, 1, { bot: "grok" }); F("shelf", 20, 3); F("plant", 24, 3, 1, 1, { big: 1 }); F("cabinet", 24, 7);
F("gdesk", 21, 11, 3, 1, { bot: "goldie" }); F("plant", 24, 10, 1, 1, { big: 1 });
// back lounge (where the old free-standing desk sign stood): couch + Indy's SPY placard + the bull statue
F("couch", 8, 4, 3, 1); F("indysign", 11, 4); F("bull", 12, 4, 2, 2); F("plant", 18, 16); F("plant", 22, 16);
F("trash", 3, 16);

const SPOTS = {};
function S_(key, x, y, face = "S", pose = "stand", o = {}) { SPOTS[key] = Object.assign({ key, x, y, face, pose }, o); }
const CHAIRS = { owl: [8, 9], vee: [11, 9], zip: [15, 9], snap: [18, 9], trek: [8, 13], dip: [11, 13], rota: [15, 13], drift: [18, 13],
  knobs: [17, 4], pixel: [4, 12], grok: [22, 4], goldie: [22, 10] };
for (const id in CHAIRS) { S_("chair_" + id, CHAIRS[id][0], CHAIRS[id][1], "S", "sit"); seat[I(...CHAIRS[id])] = 1; }
// in front of each desk (visits, trophy delivery)
const FRONT = { owl: [8, 11], vee: [11, 11], zip: [15, 11], snap: [18, 11], trek: [8, 15], dip: [11, 15], rota: [15, 15], drift: [18, 15],
  knobs: [16, 6], pixel: [5, 14], grok: [22, 6], goldie: [22, 12], indy: [11, 5] };
for (const id in FRONT) S_("front_" + id, FRONT[id][0], FRONT[id][1], id === "indy" ? "W" : "N");
S_("couch_indy", 9, 5, "S", "couch"); S_("couch_2", 8, 5, "S", "couch"); S_("couch_3", 10, 5, "S", "couch");
for (const k of ["couch_indy", "couch_2", "couch_3"]) seat[I(SPOTS[k].x, SPOTS[k].y)] = 1;   // couch cushions: sit-only, nobody walks over them
S_("board", 16, 3, "N", "stand"); S_("board2", 15, 3, "N", "stand");
S_("pace_a", 20, 7, "E"); S_("pace_b", 23, 7, "W"); S_("jefe_window", 22, 3, "N");
S_("coffee_1", 1, 11, "N"); S_("coffee_2", 2, 11, "N"); S_("coffee_3", 3, 11, "N");
S_("cooler", 5, 4, "N"); S_("vending", 1, 4, "N"); S_("copier", 4, 15, "S"); S_("copier_2", 5, 15, "S"); S_("rack", 2, 14, "W");
S_("award_1", 20, 9, "N"); S_("award_2", 22, 9, "N"); S_("award_3", 23, 9, "N");
S_("center", 13, 11, "S"); S_("door", 23, 16, "S");
// Research Inc. stairwell (the department one floor below) at the bottom edge, between the bull and the plant
S_("ri_stairs", 16, 16, "N"); S_("ri_stairs_2", 17, 16, "N"); S_("ri_stairs_3", 15, 16, "N");
S_("chat_1", 6, 11, "E"); S_("chat_2", 20, 12, "W"); S_("chat_3", 18, 8, "S"); S_("chat_4", 20, 15, "W"); S_("chat_5", 6, 14, "E"); S_("chat_6", 15, 7, "S");
const BREAK = [[2, 4, "S", "sit"], [3, 4, "S", "sit"], [2, 6, "N", "sit"], [3, 6, "N", "sit"], [4, 5, "W", "sit"], [5, 5, "W", "stand"], [1, 7, "E", "stand"], [4, 7, "N", "stand"]];
BREAK.forEach((b, i) => S_("break_" + i, b[0], b[1], b[2], b[3], { stool: b[3] === "sit" }));
const AREAS = [   // for the roster "location" column
  [1, 3, 5, 7, "break room"], [20, 3, 24, 7, "El Jefe's office"], [1, 9, 3, 11, "espresso bar"], [1, 12, 3, 15, "server rack"],
  [4, 14, 6, 16, "copier"], [7, 4, 13, 6, "lounge"], [15, 3, 18, 3, "R&D whiteboard"], [21, 9, 24, 12, "front desk"],
  [6, 9, 20, 15, "swing desk"], [16, 4, 18, 6, "R&D desk"], [4, 12, 5, 13, "data desk"], [21, 13, 24, 16, "entrance"]];
AREAS.unshift([15, 16, 17, 16, "Research Inc. stairs"]);
function areaOf(x, y) { for (const a of AREAS) if (x >= a[0] && x <= a[2] && y >= a[1] && y <= a[3]) return a[4]; return "trading floor"; }

// ============================================================== A* (4-way). seats only as goal; optional dynamic blockers
function passable(x, y, gx, gy, dyn) {
  if (x < 0 || y < 0 || x >= GW || y >= GH) return false;
  const i = I(x, y);
  if (blocked[i]) return false;
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
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % GW, cy = (cur / GW) | 0;
    if (cx === gx && cy === gy) {
      const path = []; let c = cur;
      while (c !== I(sx, sy)) { path.push([c % GW, (c / GW) | 0]); c = came[c]; }
      return path.reverse();
    }
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

// ============================================================== cast
const CAST = {
  grok:   { name: "EL JEFE", skin: "#c68642", hair: "#1b1b1b", shirt: "#23232b", pants: "#16161b", acc: "jefe", tie: "#f2c14e" },
  goldie: { name: "GOLDIE", skin: "#f1c27d", hair: "#f6d55c", dress: "#ff2d95", dots: "#ffe14d", acc: "bow", long: 1 },
  dash:   { name: "DASH", skin: "#e0ac69", hair: "#7a3b12", shirt: "#e63946", pants: "#2b2d42", acc: "headband" },
  vee:    { name: "VEE", skin: "#8d5524", hair: "#2b1a10", shirt: "#7b2cbf", pants: "#22223b", acc: "glasses", tie: "#e0aaff" },
  zip:    { name: "MEET KEVIN", skin: "#f1c27d", hair: "#ff9f1c", shirt: "#ffd60a", pants: "#3a3a52", acc: "bolt", spiky: 1 },
  snap:   { name: "SNAP", skin: "#c68642", hair: "#222", shirt: "#2ec4b6", pants: "#1f2937", acc: "beanie", hat: "#ff6b6b" },
  trek:   { name: "TREK", skin: "#e0ac69", hair: "#5c3a1e", shirt: "#2d6a4f", pants: "#40342a", acc: "cap", hat: "#95d5b2" },
  dip:    { name: "DIP", skin: "#f1c27d", hair: "#3a2a1a", shirt: "#1d4ed8", pants: "#e5e7eb", acc: "visor", hat: "#fde047" },
  rota:   { name: "ROTA", skin: "#8d5524", hair: "#111", shirt: "#f77f00", pants: "#1e3a5f", acc: "headset", puff: 1 },
  drift:  { name: "DRIFT", skin: "#e0ac69", hair: "#d4a373", shirt: "#118ab2", pants: "#073b4c", acc: "cap", hat: "#ffb703" },
  owl:    { name: "OWL", skin: "#c68642", hair: "#1a1a2e", shirt: "#16213e", pants: "#0f0f1a", acc: "moon", hat: "#e8e0c8" },
  snapback: { name: "SNAPBACK", skin: "#8d5524", hair: "#1b1b1b", shirt: "#e76f51", pants: "#264653", acc: "beanie", hat: "#2a9d8f" },   // lab candidate (benched)
  payday: { name: "PAYDAY", skin: "#f1c27d", hair: "#6b4423", shirt: "#2a9d8f", pants: "#1d3557", acc: "glasses", tie: "#e9c46a" },   // lab candidate (benched)
  pixel:  { name: "PIXEL", skin: "#e0ac69", hair: "#3d348b", shirt: "#6c757d", pants: "#212529", acc: "headphones" },
  knobs:  { name: "KNOBS", skin: "#f1c27d", hair: "#c7c7c7", shirt: "#f4f4f4", pants: "#495057", acc: "goggles", coat: 1 },
  indy:   { name: "INDY", skin: "#c68642", hair: "#9a9a9a", shirt: "#c9a227", pants: "#5b4636", acc: "paper" },
};
const ORDER = ["grok", "goldie", "dash", "vee", "zip", "snap", "trek", "dip", "rota", "drift", "owl", "snapback", "payday", "knobs", "pixel", "indy"];
const TRADERS = ["dash", "vee", "zip", "snap", "trek", "dip", "rota", "drift", "owl", "snapback", "payday"];
const DESK_OF = { dash: "day", vee: "day", zip: "swing", snap: "day", trek: "swing", dip: "swing", rota: "swing", drift: "swing", owl: "swing", snapback: "swing", payday: "swing" };
const COL = { grok: "#f2c14e", goldie: "#ff2d95", dash: "#e63946", vee: "#b07cff", zip: "#ffd60a", snap: "#2ec4b6", trek: "#52b788",
  dip: "#4f8cff", rota: "#f77f00", drift: "#00b4d8", owl: "#9b8cff", snapback: "#e76f51", payday: "#2a9d8f", pixel: "#a5a5c8", knobs: "#e9ecef", indy: "#c9a227" };
const DISP = (id) => (CAST[id] ? CAST[id].name : String(id || "?").toUpperCase());

// ============================================================== Research Inc. (the floor below): visiting staff
// They live downstairs and only come up the stairs (bottom edge) to deliver research, visit or meet, driven by
// /research_events.json (= /workspace/research-inc/floor_events.jsonl, see floor_event.py). Team mark: cyan lanyard + "RI" tag.
const RI_TAG = "#00e5ff";
const RI = {
  scoop: { desk: "News Desk", lines: ["HI ALL", "FRESH COFFEE UP HERE?", "NICE FLOOR"] },
  tape:  { desk: "Markets Desk", lines: ["HOW'S THE TAPE?", "HEY TEAM", "JUST STOPPING BY"] },
  beats: { desk: "Earnings & IPO Desk", lines: ["HELLO UP HERE", "CALENDAR'S ON B1", "SAY HI TO DIP"] },
  sage:  { desk: "Analyst Desk", lines: ["RISK FIRST", "SIGNALS LIVE ON B1", "GOOD TO SEE YOU"] },
  proof: { desk: "Quality Desk", lines: ["CALLS GET GRADED FRIDAY", "HELLO FLOOR", "QUICK HELLO"] },
};
const RI_IDS = Object.keys(RI);
Object.assign(CAST, {
  scoop: { name: "SCOOP", skin: "#f1c27d", hair: "#6b4423", shirt: "#7cb342", pants: "#3b3f2a", acc: "ri", ri: "fedora" },
  tape:  { name: "TAPE", skin: "#8d5524", hair: "#1b1b1b", shirt: "#1ea5c9", pants: "#203040", acc: "ri", ri: "bun" },
  beats: { name: "BEATS", skin: "#e0ac69", hair: "#b5651d", shirt: "#ff8a65", pants: "#33263a", acc: "ri", ri: "bowtie", long: 1 },
  sage:  { name: "SAGE", skin: "#c68642", hair: "#d9d9d9", shirt: "#6a4bd8", pants: "#1f1b3a", acc: "ri", ri: "beret" },
  proof: { name: "PROOF", skin: "#f1c27d", hair: "#3a2a1a", shirt: "#d77a7f", pants: "#2f2f3a", acc: "ri", ri: "hardhat" },
});
Object.assign(COL, { scoop: "#b5e48c", tape: "#48cae4", beats: "#ff9e7a", sage: "#9d84ff", proof: "#e5989b" });
ORDER.push(...RI_IDS);

// ============================================================== simulation state
let S = null;              // latest state.json
let T = 0;                 // sim clock (s)
let STRESS = 0;            // >0 during the automated collision check
let lastTradeId = null, lastEventId = null, lastFetch = null, lastPixelTrip = -1e9;
const occ = new Map();     // tile index -> char id (current tile + reserved next tile)
const chars = {};
const ambient = [];        // client-side squawk lines (movements), shown dimmed
let rngSeed = 1234567;
const rnd = () => ((rngSeed = (rngSeed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[(rnd() * a.length) | 0];
function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973; return h / 9973; }

for (const id of ORDER) {
  chars[id] = { id, tx: 0, ty: 0, x: 0, y: 0, path: [], moving: false, from: null, goal: null, task: null, face: "S", pose: "stand",
    hidden: true, wait: 0, walkT: 0, bubble: null, emote: null, emoteUntil: 0, jumpUntil: 0, nextErrand: 0, homeKey: null,
    idleSince: 0, speed: 3.4, placed: false, arrivedAt: 0 };
}

function etNow() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  const h = (+p.hour % 24) + (+p.minute) / 60 + (+p.second) / 3600;
  return { h, wd: p.weekday, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}
const mktStatus = () => (S && S.market && S.market.status) || "closed";
// NYSE holidays / early closes (ET dates). Used for client countdown when state times are missing.
const NYSE_HOLIDAYS = new Set(["2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25","2027-01-01"]);
const NYSE_EARLY = new Set(["2026-11-27","2026-12-24"]); // 1:00 PM ET close
function etParts(d) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  const y = p.year, m = p.month, day = p.day;
  return { y, m, day, ymd: `${y}-${m}-${day}`, wd: p.weekday, hh: +p.hour % 24, mm: +p.minute, ss: +p.second,
    h: (+p.hour % 24) + (+p.minute) / 60 + (+p.second) / 3600 };
}
function etDateAt(ymd, hh, mm) {
  const stamp = `${ymd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  for (const off of ["-04:00", "-05:00"]) {
    const g = new Date(stamp + off);
    const q = etParts(g);
    if (q.ymd === ymd && q.hh === hh && q.mm === mm) return g;
  }
  return new Date(stamp + "-04:00");
}
function isWeekend(wd) { return wd === "Sat" || wd === "Sun"; }
function isHoliday(ymd) { return NYSE_HOLIDAYS.has(ymd); }
function sessionCloseHM(ymd) { return NYSE_EARLY.has(ymd) ? [13, 0] : [16, 0]; }
function nextOpenFrom(now) {
  let d = new Date(now.getTime());
  for (let i = 0; i < 14; i++) {
    const p = etParts(d);
    let ymd = p.ymd;
    if (i > 0) {
      // advance calendar day in ET
      const tomorrow = new Date(etDateAt(ymd, 12, 0).getTime() + 36e5 * 24);
      ymd = etParts(tomorrow).ymd;
      d = etDateAt(ymd, 9, 30);
    }
    const q = etParts(etDateAt(ymd, 9, 30));
    if (isWeekend(q.wd) || isHoliday(ymd)) { d = etDateAt(ymd, 12, 0); continue; }
    const open = etDateAt(ymd, 9, 30);
    if (open.getTime() > now.getTime() - 1000) return open;
    d = etDateAt(ymd, 12, 0);
  }
  return etDateAt(etParts(now).ymd, 9, 30);
}
function fmtDur(ms) {
  ms = Math.max(0, ms);
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}
function fmtOpenWhen(dt) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(dt).reduce((o, x) => (o[x.type] = x.value, o), {});
  return `${p.weekday} ${p.hour}:${p.minute} ${p.dayPeriod} ET`;
}
function mktPillText() {
  const st = mktStatus();
  const now = new Date();
  const M = (S && S.market) || {};
  let target = null, whenNote = "";
  if (st === "open") {
    target = M.close_time ? new Date(M.close_time) : null;
    if (!target || isNaN(+target)) {
      const p = etParts(now); const [ch, cm] = sessionCloseHM(p.ymd);
      target = etDateAt(p.ymd, ch, cm);
    }
    return `🟢 OPEN · closes in ${fmtDur(target - now)}`;
  }
  if (st === "pre-market") {
    target = M.open_time ? new Date(M.open_time) : (M.next_open ? new Date(M.next_open) : null);
    if (!target || isNaN(+target)) target = nextOpenFrom(now);
    return `🟠 PRE MARKET · opens in ${fmtDur(target - now)}`;
  }
  if (st === "after-hours") {
    const p = etParts(now);
    target = etDateAt(p.ymd, 20, 0);
    return `🔵 AFTER HOURS · ends in ${fmtDur(target - now)}`;
  }
  // closed (overnight / weekend / holiday)
  target = M.next_open ? new Date(M.next_open) : null;
  if (!target || isNaN(+target) || target <= now) target = nextOpenFrom(now);
  const ms = target - now;
  whenNote = ms > 6 * 3600e3 ? ` (${fmtOpenWhen(target)})` : "";
  return `🔴 CLOSED · opens in ${fmtDur(ms)}${whenNote}`;
}
function refreshMktPill() {
  const pill = $("mkt"); if (!pill) return;
  const st = mktStatus();
  pill.textContent = mktPillText();
  pill.className = "pill " + (st === "open" ? "live" : st === "pre-market" ? "pre" : st === "after-hours" ? "after" : "closed");
}
const bot = (id) => (S && S.bots && S.bots[id]) || null;
const BENCHED = new Set(["benched", "no edge", "unqualified", "desk closed"]);
const LAID_OFF = new Set(["dash", "vee", "snap"]);   // empty Swing Desk seats (Now Hiring); Meet Kevin (zip) trades the 52-week-high strategy since 2026-10-10
function deskSittingOut(desk) { const g = S && S.accounts && S.accounts[desk] && S.accounts[desk].gate; return !!(g && g.sit_out); }

// ---- presence: who is in the office right now (ET clock + market status)
function present(id) {
  if (LAID_OFF.has(id)) return false;                // laid off: empty desks, not on the floor
  if (RI[id]) return false;   // Research Inc. staff: see riDirector
  if (STRESS) return true;
  const st = mktStatus(), h = etNow().h, j = hash(id);
  const tuning = S && S.tuning && S.tuning.running;
  if (id === "pixel") return true;                                   // night shift
  if (id === "knobs" && tuning) return true;
  if (st === "open") return true;
  if (st === "pre-market") return h >= 7.5 + j * 1.4 || id === "grok" && h >= 7;
  if (st === "after-hours") {
    if (id === "goldie") return h < 17.5;
    if (id === "grok") return h < 18.75;
    if (id === "indy") return h < 17;
    if (id === "knobs") return h < 18;
    return h < 17.25 + j * 1.25;                                     // traders wrap up, then go home
  }
  return false;                                                      // weekend / holiday / overnight
}

// ---- where each character belongs, from real engine state
function breakSpotFor(id) {
  const benched = TRADERS.filter((b) => bot(b) && BENCHED.has(bot(b).status));
  const k = benched.indexOf(id);
  return SPOTS["break_" + (k >= 0 ? k % BREAK.length : 0)];
}
function home(id) {
  const b = bot(id);
  if (TRADERS.includes(id)) {
    if (b && BENCHED.has(b.status)) return SPOTS[breakSpotFor(id).key];
    return SPOTS["chair_" + id] || SPOTS[breakSpotFor(id).key];   // a candidate without a desk waits in the break room
  }
  if (id === "grok") {
    const mood = S && S.boss && S.boss.mood;
    if (mood === "worried") return SPOTS[(Math.floor(T / 5) % 2) ? "pace_a" : "pace_b"];
    return Object.assign({}, SPOTS.chair_grok, { pose: mood === "relaxed" ? "feetup" : "sit" });
  }
  if (id === "pixel") return S && S.feed && S.feed.ok === false ? SPOTS.rack : SPOTS.chair_pixel;
  if (id === "knobs") return S && S.tuning && S.tuning.running ? SPOTS.board : SPOTS.chair_knobs;
  if (id === "indy") return SPOTS.couch_indy;
  if (id === "goldie") return SPOTS.chair_goldie;
  return SPOTS.center;
}

// ---- bubbles / emotes
function say(id, text, secs = 3.5, kind = "") {
  const c = chars[id]; if (!c || c.hidden) return;
  c.bubble = { text: String(text).toUpperCase().slice(0, 34), until: T + secs, kind };
}
function emote(id, e, secs = 2.5) { const c = chars[id]; if (c) { c.emote = e; c.emoteUntil = T + secs; } }
function amb(id, msg) { ambient.push({ t: new Date(), bot: id, msg }); if (ambient.length > 12) ambient.shift(); }

// ---- tasks: sequences of {spot, dur, say, onArrive}
function setTask(id, steps, label) {
  const c = chars[id]; if (!c || c.hidden) return false;
  c.task = { steps: steps.slice(), label, t0: T }; c.goal = null; c.path = c.moving ? c.path.slice(0, 1) : [];
  return true;
}
const spotBusy = (key, except) => Object.values(chars).some((c) => c.id !== except && !c.hidden &&
  ((c.goal && c.goal.key === key) || c.homeKey === key || (SPOTS[key] && c.tx === SPOTS[key].x && c.ty === SPOTS[key].y)));
function freeSpot(keys, id) { const k = keys.filter((x) => SPOTS[x] && !spotBusy(x, id)); return k.length ? pick(k) : null; }

// ============================================================== movement
function occupiedBy(i) { return occ.get(i); }
function place(c, x, y) {
  for (const [k, v] of occ) if (v === c.id) occ.delete(k);
  c.tx = x; c.ty = y; c.x = x * TS + 8; c.y = y * TS + 8; c.path = []; c.moving = false;
  occ.set(I(x, y), c.id);
}
function dynBlockers(self) {
  const s = new Set();
  for (const c of Object.values(chars)) if (c !== self && !c.hidden) { s.add(I(c.tx, c.ty)); if (c.moving && c.path[0]) s.add(I(c.path[0][0], c.path[0][1])); }
  return s;
}
function routeTo(c, spot) {
  c.goal = spot;
  // mid-step: finish the step already reserved, then plan from that tile (never re-aim mid-edge)
  const cur = c.moving && c.path[0] ? c.path[0] : null;
  const sx = cur ? cur[0] : c.tx, sy = cur ? cur[1] : c.ty;
  let p = astar(sx, sy, spot.x, spot.y, dynBlockers(c));
  if (!p) p = astar(sx, sy, spot.x, spot.y, null);
  if (p && cur) p = [cur].concat(p);
  c.path = p || (cur ? [cur] : []);
  c.wait = 0;
  if (!p) c.goal = null;
  return !!p;
}
function sidestep(c) {
  if (c.moving) return false;
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c.tx + dx, c.ty + dy])
    .filter(([x, y]) => passable(x, y, -1, -1, null) && !occ.has(I(x, y)));
  if (!opts.length) return false;
  const [x, y] = pick(opts);
  c.path = [[x, y]];
  return true;
}
function stepMove(c, dt) {
  if (!c.path.length) return;
  const [nx, ny] = c.path[0];
  if (!c.moving) {
    const who = occupiedBy(I(nx, ny));
    if (who && who !== c.id) {
      c.wait += dt;
      if (c.wait > 0.6 && c.goal && c.wait - dt <= 0.6) { const g = c.goal; routeTo(c, g); c.wait = 0.61; }
      if (c.wait > 2.2) {
        const other = chars[who];
        const goalBlocked = c.goal && I(c.goal.x, c.goal.y) === I(nx, ny) && other && !other.moving && !other.path.length;
        if (goalBlocked) {   // someone is standing on my target: settle next to it
          c.path = []; c.goal = null; c.wait = 0;
          if (c.task && c.task.steps[0]) c.task.steps[0].near = true;
        } else if (sidestep(c)) c.wait = 0;
        else c.wait = 1.0;
      }
      return;
    }
    if (blocked[I(nx, ny)]) { c.path = []; return; }   // never step into a blocked tile
    occ.set(I(nx, ny), c.id);
    c.moving = true; c.from = [c.tx, c.ty]; c.wait = 0;
    c.face = nx > c.tx ? "E" : nx < c.tx ? "W" : ny > c.ty ? "S" : "N";
  }
  const tx = nx * TS + 8, ty = ny * TS + 8, sp = c.speed * TS * dt * (c.run ? 1.6 : 1);
  const dx = tx - c.x, dy = ty - c.y, d = Math.abs(dx) + Math.abs(dy);
  c.walkT += dt;
  if (d <= sp) {
    c.x = tx; c.y = ty;
    if (occ.get(I(c.from[0], c.from[1])) === c.id) occ.delete(I(c.from[0], c.from[1]));
    c.tx = nx; c.ty = ny; c.moving = false; c.path.shift();
    if (!c.path.length && c.goal && (c.tx !== c.goal.x || c.ty !== c.goal.y)) routeTo(c, c.goal);   // after a sidestep
  } else { c.x += Math.sign(dx) * Math.min(Math.abs(dx), sp); c.y += Math.sign(dy) * Math.min(Math.abs(dy), sp); }
}
const atSpot = (c, s) => s && c.tx === s.x && c.ty === s.y && !c.moving && !c.path.length;

// ============================================================== behaviour (director)
function appear(c) {
  const d = SPOTS.door;
  if (occ.has(I(d.x, d.y))) return;
  c.hidden = false; place(c, d.x, d.y); c.task = null; c.goal = null; c.pose = "stand";
  amb(c.id, "walks in");
}
function leave(c) {
  if (c.task && c.task.label === "leave") return;
  setTask(c.id, [{ spot: SPOTS.door, dur: 0, leave: true }], "leave");
}
function startErrand(c) {
  const id = c.id, st = mktStatus(), b = bot(id);
  const trading = st === "open" && TRADERS.includes(id) && b && b.status === "active" && !deskSittingOut(DESK_OF[id]);
  const benched = TRADERS.includes(id) && b && BENCHED.has(b.status);
  const r = rnd();
  let steps = null, label = "";
  if (benched) {
    if (r < 0.55) { const k = freeSpot(BREAK.map((_, i) => "break_" + i), id); if (k) { steps = [{ spot: SPOTS[k], dur: 20 + rnd() * 25 }]; label = "break room shuffle"; } }
    else if (r < 0.8) { const k = freeSpot(["coffee_1", "coffee_2", "coffee_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: pick(["DECAF PLS", "STILL BENCHED", "WAITING ON KNOBS"]) }]; label = "at the espresso bar"; } }
    else { steps = [{ spot: SPOTS.vending, dur: 5, say: "SNACK BREAK" }]; label = "at the vending machine"; }
  } else if (id === "grok") {
    if (r < 0.4) { steps = [{ spot: SPOTS.center, dur: 6, say: pick(["PROTECT THE WEEK", "NO HAIL MARYS", "RISK FIRST"]) }]; label = "walks the floor"; }
    else if (r < 0.7) { const k = freeSpot(["award_1", "award_2", "award_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 5, say: "HALL OF FAME..." }]; label = "admires the award wall"; } }
    else { const k = freeSpot(["coffee_1", "coffee_2", "coffee_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "CAFECITO" }]; label = "at the espresso bar"; } }
  } else if (id === "goldie") {
    if (r < 0.5) { const k = freeSpot(["copier", "copier_2"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "FILING SCORES" }]; label = "at the copier"; } }
    else if (r < 0.75) { const k = freeSpot(["award_1", "award_2", "award_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "POLISHING PLAQUES" }]; label = "polishes the plaques"; } }
    else { const k = freeSpot(["coffee_1", "coffee_2", "coffee_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6 }]; label = "at the espresso bar"; } }
  } else if (id === "knobs") {
    if (r < 0.6) { steps = [{ spot: SPOTS.board, dur: 14, say: pick(["OOS OR IT DIDN'T HAPPEN", "WALK-FORWARD...", "NO OVERFITTING"]) }]; label = "at the R&D whiteboard"; }
    else { const k = freeSpot(["copier", "copier_2"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "PRINTING BACKTESTS" }]; label = "at the copier"; } }
  } else if (id === "pixel") {
    steps = [{ spot: SPOTS.rack, dur: 8, say: pick(["RACK LOOKS GOOD", "FANS SPINNING", "PING OK"]) }]; label = "checks the server rack";
  } else if (id === "indy") {
    const k = freeSpot(["coffee_1", "coffee_2", "coffee_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "JUST HOLDING" }]; label = "at the espresso bar"; }
  } else {   // traders
    if (r < 0.35) { const k = freeSpot(["coffee_1", "coffee_2", "coffee_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 7, say: pick(["DOUBLE ESPRESSO", "CAFFEINE = ALPHA", "ONE SHOT"]) }]; label = "at the espresso bar"; } }
    else if (r < 0.5) { const k = freeSpot(["copier", "copier_2"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "PRINTING CHARTS" }]; label = "at the copier"; } }
    else if (r < 0.62) { const k = freeSpot(["award_1", "award_2", "award_3"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 6, say: "MY PHOTO GOES THERE" }]; label = "eyes the award wall"; } }
    else if (r < 0.8 && !trading) {   // visit a colleague's desk
      const mates = TRADERS.filter((m) => m !== id && !chars[m].hidden && atSpot(chars[m], SPOTS["chair_" + m]) && !spotBusy("front_" + m, id));
      if (mates.length) { const m = pick(mates); steps = [{ spot: SPOTS["front_" + m], dur: 6, say: "WHAT ARE YOU WATCHING?", reply: m }]; label = "chats with " + DISP(m); }
    } else { const k = freeSpot(["cooler", "chat_1", "chat_2", "chat_3", "chat_6"], id); if (k) { steps = [{ spot: SPOTS[k], dur: 5, say: pick(["STRETCH BREAK", "QUIET TAPE", "HYDRATE"]) }]; label = "stretches"; } }
  }
  if (steps) { setTask(id, steps, label); amb(id, label); }
}
function errandGap(id) {
  if (STRESS) return 1 + rnd() * 3;
  const st = mktStatus(), b = bot(id);
  const trading = st === "open" && TRADERS.includes(id) && b && b.status === "active" && !deskSittingOut(DESK_OF[id]);
  if (trading) return 150 + rnd() * 170;
  if (TRADERS.includes(id) && b && BENCHED.has(b.status)) return 25 + rnd() * 30;
  if (id === "indy") return 300 + rnd() * 300;
  if (id === "grok") return 70 + rnd() * 80;
  return 35 + rnd() * 55;
}
function replyLine(m) {
  const b = bot(m); if (!b) return "...";
  if (b.positions && b.positions.length) { const p = b.positions[0]; return `${p.symbol} ${p.upl >= 0 ? "+" : ""}$${p.upl.toFixed(0)}`; }
  if (b.watch && b.watch.length) return "WATCHING " + b.watch.slice(0, 2).join(" ");
  if (deskSittingOut(DESK_OF[m])) return "DESK SITS OUT TODAY";
  return mktStatus() === "open" ? "NO SETUP YET" : "MARKET'S CLOSED";
}
function director(c) {
  const id = c.id;
  if (RI[id]) return riDirector(c);
  const want = present(id);
  if (c.hidden) { if (want) appear(c); return; }
  if (!want && !(c.task && c.task.label === "leave")) { leave(c); }
  // run task
  if (c.task) { runTask(c); return; }
  // go home / stay home
  const h = home(id);
  if (!c.goal || c.goal.key !== h.key) { routeTo(c, h); c.homeKey = h.key; }
  if (atSpot(c, h)) {
    c.face = h.face; c.pose = h.pose;
    if (!c.nextErrand) c.nextErrand = T + errandGap(id) * (0.3 + rnd());
    if (T > c.nextErrand && !(id === "grok" && S && S.boss && S.boss.mood === "worried")) startErrand(c);
  } else if (!c.path.length && !c.moving) { if (!routeTo(c, h)) { c.nextErrand = T + 2; } }
}
function runTask(c) {
  const id = c.id;
  {
    const s = c.task.steps[0];
    if (!s) { c.task = null; c.goal = null; return; }
    if (!s.near && (!c.goal || c.goal.key !== s.spot.key)) { if (!routeTo(c, s.spot)) { c.task.steps.shift(); return; } }
    if (atSpot(c, s.spot) || (s.near && !c.moving && !c.path.length)) {
      if (s.started == null) {
        s.started = T; c.face = s.spot.face; c.pose = s.spot.pose || "stand";
        if (s.say) say(id, s.say, Math.min(4, s.dur || 3));
        if (s.reply) setTimeoutSim(() => say(s.reply, replyLine(s.reply), 3.5), 1.6);
        if (s.onArrive) s.onArrive();
        if (s.leave) { for (const [k, v] of occ) if (v === id) occ.delete(k); c.hidden = true; c.task = null; c.goal = null; c.bubble = null; amb(id, RI[id] ? "heads back downstairs" : "heads home"); return; }
      }
      if (T - s.started >= (s.dur || 0)) { c.task.steps.shift(); c.goal = null; if (!c.task.steps.length) { c.task = null; c.nextErrand = T + errandGap(id); } }
    } else if (!c.path.length && !c.moving && c.goal) routeTo(c, c.goal);
    if (c.task && T - c.task.t0 > 90) { c.task = null; c.goal = null; }   // give up stuck errands
    return;
  }
}
// sim-time timers (so the stress test runs them too)
const timers = [];
function setTimeoutSim(fn, secs) { timers.push({ at: T + secs, fn }); }

// ============================================================== Research Inc. visits
const riQueue = {}; for (const id of RI_IDS) riQueue[id] = [];
const riFeed = [];          // recent Research Inc. events for the squawk feed + panel
const RI_STAIRS = ["ri_stairs", "ri_stairs_2", "ri_stairs_3"];
const RI_PLACES = { center: "center", board: "board2", coffee: "coffee_2", desk: "front_grok", grok: "front_grok" };
const RI_FONT_MAP = { ";": ",", '"': "'", "\u2019": "'", "\u2018": "'", "\u201c": "'", "\u201d": "'", "\u2014": "-", "\u2013": "-", "|": "/" };
function riText(s, n = 34) {
  let t = String(s || "").toUpperCase().split("").map((ch) => RI_FONT_MAP[ch] || (FONT[ch] ? ch : " ")).join("").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 3).trim() + "..." : t;
}
function riLag(ts) { const age = (Date.now() - Date.parse(ts || "")) / 1000; return isFinite(age) ? Math.max(0, Math.min(8, 8 - age)) : 0; }   // B1 walk-to-stairs time
function riEnqueue(e) {
  const typ = ["deliver", "visit", "meeting"].includes(e.type) ? e.type : "visit";
  let to = String(e.to || "grok").toLowerCase(); if (to === "desk" || to === "jefe" || to === "lead") to = "grok";
  const who = String(e.who || "").toLowerCase().split(",").map((w) => w.trim()).filter((w) => RI[w]);
  who.forEach((w, i) => {
    const q = riQueue[w];
    q.push({ type: typ, to, note: e.note || "", ts: e.ts, id: e.id, group: who, notBefore: T + i * 0.8 + riLag(e.ts) });
    while (q.length > 5) q.shift();
  });
  if (who.length) { riFeed.push({ ts: e.ts || new Date().toISOString(), who: who[0], group: who, type: typ, to, note: e.note || "" }); while (riFeed.length > 30) riFeed.shift(); }
  return who.length;
}
function riNearSpot(base, id) {   // a free walkable tile next to `base` (when the spot is taken)
  const taken = new Set();
  for (const c of Object.values(chars)) if (c.id !== id && !c.hidden) { taken.add(I(c.tx, c.ty)); if (c.goal) taken.add(I(c.goal.x, c.goal.y)); if (c.homeKey && SPOTS[c.homeKey]) taken.add(I(SPOTS[c.homeKey].x, SPOTS[c.homeKey].y)); }
  for (const k of RI_STAIRS.concat(["door"])) taken.add(I(SPOTS[k].x, SPOTS[k].y));
  for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) !== r) continue;
    const x = base.x + dx, y = base.y + dy;
    if (x < 1 || y < 3 || x >= GW - 1 || y >= GH - 1 || blocked[I(x, y)] || seat[I(x, y)] || taken.has(I(x, y))) continue;
    const face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "W" : "E") : (dy > 0 ? "N" : "S");
    return { key: "ri_near_" + x + "_" + y, x, y, face: base.face === "N" && dy === 0 ? "N" : face, pose: "stand" };
  }
  return null;
}
function riTarget(to, id) {
  const key = RI_PLACES[to] || (SPOTS["front_" + to] ? "front_" + to : "center");
  const base = SPOTS[key];
  return spotBusy(key, id) ? riNearSpot(base, id) : base;
}
function riReply(to, v) {
  if (to === "grok") return v.type === "deliver" ? pick(["GOT IT. GRACIAS!", "NOTED. FEED THE ENGINE", "GOOD INTEL"]) : v.type === "meeting" ? "OK, WHAT'S THE PLAN?" : "WHAT'S THE WORD?";
  if (to === "goldie") return "I'LL LOG IT!";
  if (to === "knobs") return v.type === "meeting" ? "OOS OR IT DIDN'T HAPPEN" : "INTERESTING DATA";
  if (to === "pixel") return "I'LL CROSS-CHECK THE FEED";
  if (to === "indy") return "I JUST HOLD SPY";
  if (TRADERS.includes(to)) return v.type === "deliver" ? "THANKS! " + replyLine(to) : replyLine(to);
  return "THANKS!";
}
function riDirector(c) {
  const id = c.id, q = riQueue[id];
  if (c.hidden) {
    if (!q.length || !S || T < (q[0].notBefore || 0)) return;
    const st = RI_STAIRS.map((k) => SPOTS[k]).find((sp) => !occ.has(I(sp.x, sp.y)));
    if (!st) return;
    const v = q.shift();
    c.hidden = false; place(c, st.x, st.y); c.task = null; c.goal = null; c.homeKey = null; c.pose = "stand"; c.face = "N"; c.bubble = null;
    c.carry = v.type === "deliver"; c.visit = v;
    const tgt = riTarget(v.to, id);
    const dur = v.type === "meeting" ? 15 : 7;
    const label = (v.type === "deliver" ? "delivers research to " : v.type === "meeting" ? "meets with " : "visits ") + (CAST[v.to] ? DISP(v.to) : v.to);
    const steps = [];
    if (tgt) steps.push({ spot: tgt, dur, onArrive: () => riArrive(c, v, dur) });
    steps.push({ spot: st, dur: 0, leave: true });
    setTask(id, steps, label);
    amb(id, "comes up from Research Inc. and " + label);
    return;
  }
  if (!c.task) {   // done (or gave up): walk back to the stairs
    c.carry = false;
    const k = freeSpot(RI_STAIRS, id) || RI_STAIRS[0];
    setTask(id, [{ spot: SPOTS[k], dur: 0, leave: true }], "heads back downstairs");
    if (c.leaveSince == null) c.leaveSince = T;
    if (T - c.leaveSince > 45) {   // hopelessly stuck: slip away (never seen in tests)
      for (const [kk, vv] of occ) if (vv === id) occ.delete(kk);
      c.hidden = true; c.task = null; c.goal = null; c.bubble = null; c.leaveSince = null; return;
    }
  }
  runTask(c);
  if (c.hidden) c.leaveSince = null;
}
function riArrive(c, v, dur) {
  const id = c.id, to = v.to;
  const note = riText(v.note) || (v.type === "deliver" ? "FRESH RESEARCH" : v.type === "meeting" ? "QUICK HUDDLE?" : "HEY! QUICK UPDATE");
  say(id, note, Math.max(3, dur - 1.5));
  const t = chars[to];
  const lead = !v.group || v.group[0] === id;
  if (t && !RI[to] && lead) {
    if (!t.hidden) setTimeoutSim(() => { say(to, riReply(to, v), 3.5); if (to === "grok") emote("grok", "thumb", 3); }, 2.2);
    else if (v.type === "deliver") setTimeoutSim(() => say(id, "LEFT IT ON THE DESK", 3), 4);
  }
  if (v.type === "deliver") setTimeoutSim(() => { c.carry = false; }, 2.4);
  if (v.type === "meeting" && lead) setTimeoutSim(() => { if (!c.hidden) say(id, pick(["AGREED. WE'LL TRACK IT", "I'LL ADD IT TO SIGNALS", "BACK TO WORK"]), 4); }, 8.5);
}

// ---- first placement: everyone already at their spot (no parade on page load)
function initialPlace() {
  for (const id of ORDER) {
    const c = chars[id];
    if (!present(id)) { c.hidden = true; continue; }
    const h = home(id);
    if (!occ.has(I(h.x, h.y))) { c.hidden = false; place(c, h.x, h.y); c.goal = h; c.face = h.face; c.pose = h.pose; }
    else { c.hidden = true; }
    c.nextErrand = T + errandGap(id) * (0.2 + rnd());
  }
}

// ============================================================== reacting to engine events
function processState(prev) {
  if (!S) return;
  const trades = S.trades || [], events = S.events || [];
  if (lastTradeId === null) { lastTradeId = S.last_trade_id || 0; lastEventId = S.last_event_id || 0; lastFetch = S.feed && S.feed.last_fetch; return; }
  for (const t of trades) if (t.id > lastTradeId) onTrade(t);
  for (const e of events) if (e.id > lastEventId) onEvent(e);
  lastTradeId = Math.max(lastTradeId, S.last_trade_id || 0);
  lastEventId = Math.max(lastEventId, S.last_event_id || 0);
  const lf = S.feed && S.feed.last_fetch;
  if (lf && lf !== lastFetch) {
    lastFetch = lf;
    const c = chars.pixel;
    if (!c.hidden && !c.task && T - lastPixelTrip > 120 && S.feed.ok !== false) {
      lastPixelTrip = T;
      const k = freeSpot(["copier", "copier_2"], "pixel");
      if (k) { setTask("pixel", [{ spot: SPOTS[k], dur: 4, say: "FRESH BARS" }], "pulls fresh market data"); amb("pixel", "pulls fresh market data at the copier"); }
    }
  }
}
function onTrade(t) {
  const id = t.bot; if (!id || !chars[id]) return;
  if (t.side === "BUY") {
    if (id === "indy") { say(id, "BOUGHT SPY. DONE."); return; }
    say(id, `BUY ${t.symbol}!`, 3, "up");
    const c = chars[id];
    if (!c.hidden) {
      c.run = true;
      setTask(id, [{ spot: SPOTS.front_grok, dur: 3, say: `${t.symbol} x${Math.round(t.qty)}`, onArrive: () => { say("grok", "APPROVED. STOP IS SET.", 3.5); emote("grok", "thumb", 3); } }], "takes a ticket to El Jefe");
      setTimeoutSim(() => { c.run = false; }, 12);
    }
  } else {
    const p = t.pnl || 0;
    say(id, `${t.symbol} ${p >= 0 ? "+" : "-"}$${Math.abs(p).toFixed(2)}`, 4, p >= 0 ? "up" : "dn");
    if (p >= 0) { emote(id, "cheer", 2.5); chars[id].jumpUntil = T + 1.5; } else emote(id, "sweat", 3);
  }
}
function onEvent(e) {
  const m = (e.msg || "").toUpperCase();
  switch (e.type) {
    case "sit_out": say("grok", "SWING DESK SITS OUT", 5); emote("grok", "thumb", 3); break;
    case "block": case "risk": case "halt": say("grok", e.type === "halt" ? "HALT! DAILY LOSS CAP" : "BLOCKED BY RISK RULES", 4); emote("grok", "!", 3); break;
    case "dedup": say("grok", "ONE BOT PER SYMBOL", 4); emote(e.bot, "?", 2); break;
    case "alloc": say("grok", "RISK BUDGET FULL", 4); break;
    case "bench": say(e.bot, "BENCHED...", 4, "dn"); emote(e.bot, "sweat", 4); break;
    case "unbench": say(e.bot, "BACK AT MY DESK!", 4, "up"); emote(e.bot, "cheer", 3); break;
    case "tune": say("knobs", "TUNING TIME", 4); break;
    case "data_error": say("pixel", "FEED DOWN!", 5, "dn"); emote("pixel", "!", 5); break;
    case "corr": case "earnings": say(e.bot, m.split(":")[0] + " SKIPPED", 3); break;
    case "award": case "award_month": ceremony(e.type === "award_month"); break;
    case "week": say("grok", "WEEK IN THE BOOKS", 5); break;
  }
}

// ---- Employee of the Week (silver) / Month (gold) ceremony, run by Goldie
let lastCeremony = -1e9;
function winners() {
  const a = (S && S.awards) || {};
  return { week: a.last_week && a.last_week.winner ? a.last_week : null, month: a.last_month && a.last_month.winner ? a.last_month : null, a };
}
function ceremony(gold) {
  const g = chars.goldie; if (g.hidden || T - lastCeremony < 60) return;
  const w = winners(); const rec = gold ? w.month : w.week;
  lastCeremony = T;
  const title = gold ? "EMPLOYEE OF THE MONTH" : "EMPLOYEE OF THE WEEK";
  const who = rec ? rec.winner : null;
  const steps = [{ spot: SPOTS.center, dur: 5, say: title + "...", onArrive: () => {
    setTimeoutSim(() => say("goldie", who ? `${DISP(who)}! ${gold ? "GOLD" : "SILVER"}` : "NO WINNER THIS TIME", 5, who ? "up" : ""), 2.5);
    if (who) setTimeoutSim(() => { emote(who, "cheer", 4); chars[who].jumpUntil = T + 2; for (const id of ORDER) if (id !== who && id !== "goldie" && !chars[id].hidden && rnd() < 0.6) emote(id, "clap", 3); }, 3);
  } }];
  if (who && SPOTS["front_" + who]) steps.push({ spot: SPOTS["front_" + who], dur: 3, say: gold ? "GOLD TROPHY!" : "SILVER TROPHY!" });
  steps.push({ spot: SPOTS.award_2, dur: 4, say: gold ? "PORTRAIT + HALL OF FAME" : "SILVER PLAQUE UP" });
  setTask("goldie", steps, "runs the award ceremony");
  amb("goldie", title.toLowerCase() + " ceremony");
}
function maybeReplayCeremony() {   // every 10 min for 6 h after an award so late visitors see it
  const w = winners(); const recs = [w.week, w.month].filter(Boolean);
  for (const r of recs) {
    const age = (Date.now() - new Date(r.recorded_at).getTime()) / 3600e3;
    if (age >= 0 && age < 6 && T - lastCeremony > 600) { ceremony(r.tier === "month"); return; }
  }
}

// ---- ambient chatter, driven by real state
function ambientChatter() {
  const vis = ORDER.filter((id) => !chars[id].hidden && !chars[id].bubble && !chars[id].moving);
  if (!vis.length) return;
  const id = pick(vis), b = bot(id), st = mktStatus();
  let line = null;
  if (TRADERS.includes(id) && b) {
    if (b.status === "benched") line = "KILL SWITCH. COOLING OFF";
    else if (b.status === "no edge") line = pick(["NO EDGE IN BACKTEST", "BENCHED TILL I QUALIFY"]);
    else if (b.status === "unqualified") line = "NOT QUALIFIED YET";
    else if (b.positions && b.positions.length) line = replyLine(id);
    else if (deskSittingOut(DESK_OF[id])) line = pick(["DESK SITS OUT TODAY", "QUIET DAY. CASH IS A POSITION"]);
    else if (b.watch && b.watch.length) line = "WATCHING " + b.watch.slice(0, 2).join(" ");
    else line = st === "open" ? "SCANNING..." : pick(["PREPPING TOMORROW", "WRAPPING UP"]);
  } else if (id === "grok") {
    const m = S.boss && S.boss.mood;
    line = m === "worried" ? "BELOW MONDAY! TIGHTEN UP" : m === "relaxed" ? "BOTH DESKS GREEN. NICE." : pick(["PROTECT THE WEEK", "NO HAIL MARYS"]);
  } else if (id === "indy") {
    const a = S.accounts && S.accounts.bench; line = a ? `SPY ${a.pnl_total >= 0 ? "+" : "-"}$${Math.abs(a.pnl_total).toFixed(2)}` : "BUY AND HOLD";
  } else if (id === "knobs") line = S.tuning && S.tuning.running ? "BACKTESTING..." : "OOS OR IT DIDN'T HAPPEN";
  else if (id === "pixel") line = S.feed && S.feed.ok === false ? "FEED DOWN!" : (st === "open" ? "BARS ARE FRESH" : "NIGHT SHIFT");
  else if (id === "goldie") { const lb = S.awards && S.awards.week && S.awards.week.leaderboard; line = lb && lb[0] ? `WEEK LEADER: ${DISP(lb[0].bot)}` : "WELCOME IN!"; }
  else if (RI[id]) line = pick(RI[id].lines);
  if (line) say(id, line, 4);
}

// ============================================================== main sim step
let dirAcc = 0, chatAcc = 0;
function step(dt) {
  T += dt;
  for (let k = timers.length - 1; k >= 0; k--) if (timers[k].at <= T) { const f = timers[k].fn; timers.splice(k, 1); try { f(); } catch (e) { /* ignore */ } }
  dirAcc += dt;
  if (dirAcc >= 0.25) { dirAcc = 0; if (S) for (const id of ORDER) director(chars[id]); }
  for (const id of ORDER) {
    const c = chars[id];
    if (c.hidden) continue;
    stepMove(c, dt);
    if (c.bubble && c.bubble.until < T) c.bubble = null;
    if (c.emote && c.emoteUntil < T) c.emote = null;
  }
  chatAcc += dt;
  if (chatAcc > (STRESS ? 2 : 9) && S) { chatAcc = 0; ambientChatter(); maybeReplayCeremony(); }
}

// ============================================================== rendering: world (logical pixels)
const off = document.createElement("canvas"); off.width = LW; off.height = LH;
const g = off.getContext("2d"); g.imageSmoothingEnabled = false;
const bg = document.createElement("canvas"); bg.width = LW; bg.height = LH;
const gb = bg.getContext("2d"); gb.imageSmoothingEnabled = false;
let bgStamp = -1;
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r * f)); gg = Math.max(0, Math.min(255, gg * f)); b = Math.max(0, Math.min(255, b * f));
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}
function nightFactor(h) {
  if (h >= 7.5 && h <= 17) return 0;
  if (h > 17 && h < 19.5) return (h - 17) / 2.5;
  if (h >= 5.5 && h < 7.5) return 1 - (h - 5.5) / 2;
  return 1;
}
function skyCols(h) {
  if (h >= 7.5 && h < 16.5) return ["#5fa8e6", "#a9d6f5"];
  if (h >= 16.5 && h < 18.5) return ["#3b4f8f", "#f59e5b"];
  if (h >= 5.5 && h < 7.5) return ["#2d3a6b", "#f2a65a"];
  if (h >= 18.5 && h < 20) return ["#1c2350", "#7a4b7a"];
  return ["#070b1f", "#18214a"];
}
const CITY = []; (function () { let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 70; i++) CITY.push([r(), r(), r()]); })();
function windowPane(c, x, y, w, h, hr) {
  const [top, bot] = skyCols(hr);
  const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot);
  c.fillStyle = gr; c.fillRect(x, y, w, h);
  const night = nightFactor(hr);
  if (hr >= 7 && hr < 18) { c.fillStyle = "rgba(255,240,180,.9)"; c.fillRect(x + w * 0.75, y + 3, 3, 3); }
  else if (night > 0.6) { c.fillStyle = "#f4f1d0"; c.fillRect(x + w * 0.2, y + 3, 2, 2); c.fillStyle = "#fff"; for (let i = 0; i < 4; i++) c.fillRect(x + ((i * 37 + 5) % w), y + 2 + (i * 5) % 6, 1, 1); }
  let bx = x;
  for (const [a, b2, cc] of CITY) {
    const bw = 4 + Math.floor(a * 7), bh = 6 + Math.floor(b2 * (h - 6));
    if (bx >= x + w) break;
    const ww = Math.min(bw, x + w - bx);
    c.fillStyle = night > 0.5 ? "#141a33" : shade("#4a5a78", 0.8 + cc * 0.4);
    c.fillRect(bx, y + h - bh, ww, bh);
    if (night > 0.3) for (let yy = y + h - bh + 2; yy < y + h - 1; yy += 3) for (let xx = bx + 1; xx < bx + ww - 1; xx += 2)
      if (((xx * 7 + yy * 13) % 5) < 2) { c.fillStyle = "#ffd77a"; c.fillRect(xx, yy, 1, 1); }
    bx += bw + 1;
  }
  c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(x + 2, y + 1, 2, h - 2);
}
function frame(c, x, y, w, h, col = "#3b2a1a") { R(c, x - 2, y - 2, w + 4, h + 4, col); R(c, x - 1, y - 1, w + 2, h + 2, shade(col, 1.4)); }

function drawBackground(hr) {
  const c = gb;
  // ---- floors
  for (let y = 3; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const px = x * TS, py = y * TS;
    // wood planks (trading floor)
    const row = y * 2;
    for (let k = 0; k < 2; k++) {
      const yy = py + k * 8, off2 = ((row + k) % 3) * 16;
      R(c, px, yy, 16, 8, ((row + k) % 2) ? "#6e4a2e" : "#74502f");
      R(c, px, yy + 7, 16, 1, "#583a22");
      if (((px + off2) % 48) === 0) R(c, px, yy, 1, 7, "#5c3d24");
    }
  }
  // break room tiles
  for (let y = 3; y <= 7; y++) for (let x = 1; x <= 5; x++) for (let k = 0; k < 4; k++)
    R(c, x * TS + (k % 2) * 8, y * TS + (k >> 1) * 8, 8, 8, ((x * 2 + (k % 2) + y * 2 + (k >> 1)) % 2) ? "#d8cfb4" : "#7fa89a");
  // El Jefe's carpet
  R(c, 20 * TS, 3 * TS, 5 * TS, 5 * TS, "#5b1f2a");
  R(c, 20 * TS + 3, 3 * TS + 3, 5 * TS - 6, 5 * TS - 6, "#6e2633");
  c.strokeStyle = "#c79a3a"; c.lineWidth = 1; c.strokeRect(20 * TS + 3.5, 3 * TS + 3.5, 5 * TS - 7, 5 * TS - 7);
  for (let y = 3 * TS + 8; y < 8 * TS - 4; y += 8) for (let x = 20 * TS + 8; x < 25 * TS - 4; x += 8) R(c, x, y, 1, 1, "#8a3644");
  // R&D carpet tiles
  for (let y = 3; y <= 6; y++) for (let x = 15; x <= 18; x++) { R(c, x * TS, y * TS, 16, 16, (x + y) % 2 ? "#4a5560" : "#525e6a"); R(c, x * TS, y * TS, 16, 1, "#3e4852"); }
  // lounge rug
  R(c, 8 * TS - 4, 15 * TS + 2, 5 * TS + 8, 2 * TS - 4, "#23415f"); c.strokeStyle = "#d9b45a"; c.strokeRect(8 * TS - 1.5, 15 * TS + 4.5, 5 * TS + 3, 2 * TS - 9);
  // reception rug
  R(c, 20 * TS + 2, 9 * TS + 2, 5 * TS - 6, 4 * TS - 4, "#1f5d57"); c.strokeStyle = "#e7c56a"; c.strokeRect(20 * TS + 4.5, 9 * TS + 4.5, 5 * TS - 11, 4 * TS - 9);
  // espresso corner tiles
  for (let y = 9; y <= 11; y++) for (let x = 1; x <= 3; x++) { R(c, x * TS, y * TS, 16, 16, (x + y) % 2 ? "#2f2f35" : "#e9e3d3"); }
  // entrance mat
  R(c, 23 * TS, 16 * TS + 2, 2 * TS, 14, "#3b2f2a"); ptextC(c, "WELCOME", 24 * TS, 16 * TS + 6, "#d9b45a", 1);
  // ---- outer walls (top edges)
  R(c, 0, 3 * TS, TS, LH, "#1a2420"); R(c, LW - TS, 3 * TS, TS, LH, "#1a2420");
  R(c, TS - 3, 3 * TS, 3, LH - 4 * TS, "#2c3a33"); R(c, LW - TS, 3 * TS, 3, LH - 4 * TS, "#2c3a33");
  R(c, 0, (GH - 1) * TS, LW, TS, "#1a2420"); R(c, 0, (GH - 1) * TS, LW, 3, "#2c3a33");
  R(c, 23 * TS, (GH - 1) * TS, 2 * TS, TS, "#6e4a2e"); R(c, 23 * TS - 2, (GH - 1) * TS, 2, TS, "#c79a3a"); R(c, 25 * TS, (GH - 1) * TS, 2, TS, "#c79a3a");
  // ---- top wall
  R(c, 0, 0, LW, 3 * TS, "#22342b");
  for (let x = 0; x < LW; x += 8) R(c, x, 4, 1, 30, "rgba(0,0,0,.08)");
  R(c, 0, 0, LW, 3, "#141e19"); R(c, 0, 36, LW, 12, "#4a3020"); R(c, 0, 36, LW, 2, "#7a5533"); R(c, 0, 46, LW, 2, "#2c1c12");
  for (let x = 4; x < LW; x += 24) R(c, x, 39, 16, 5, "#55381f");
  R(c, 0, 3 * TS - 1, LW, 1, "#1b120b");
  // break room wall: window + menu board + clock
  frame(c, 20, 8, 26, 22); windowPane(c, 20, 8, 26, 22, hr);
  R(c, 54, 9, 26, 20, "#1e1e1e"); frame(c, 54, 9, 26, 20, "#5a3b22"); R(c, 54, 9, 26, 20, "#1f2a24");
  ptext(c, "MENU", 59, 11, "#f2c14e", 1); ptext(c, "LATTE", 56, 18, "#e8e2cf", 1); ptext(c, "DECAF", 56, 24, "#8f9a8f", 1);
  // trading floor wall: windows + floor monitor
  frame(c, 114, 8, 28, 24); windowPane(c, 114, 8, 28, 24, hr);
  frame(c, 210, 8, 28, 24); windowPane(c, 210, 8, 28, 24, hr);
  // R&D whiteboard frame (content drawn live)
  R(c, 244, 6, 58, 28, "#9aa3a8"); R(c, 246, 8, 54, 24, "#f4f6f2"); R(c, 252, 33, 42, 2, "#7a8288");
  // El Jefe office wall: big window + brass sign
  frame(c, 322, 6, 60, 28, "#2a1e14"); windowPane(c, 322, 6, 60, 28, hr);
  R(c, 351, 6, 2, 28, "#2a1e14");
  bgStamp = Math.floor(hr * 12);
}

// ---------- live wall pieces
function drawWallLive(t) {
  const c = g;
  // floor monitor (ES/SPY tape + regime)
  R(c, 146, 6, 60, 28, "#0c0f12"); frame(c, 146, 6, 60, 28, "#2b2b2b"); R(c, 146, 6, 60, 28, "#0c1310");
  ptext(c, "FLOOR MONITOR", 148, 8, "#f2c14e", 1);
  const curve = (S && S.curve) || [];
  const pts = curve.map((p) => (p.day || 0) + (p.swing || 0));
  sparkPix(c, 148, 15, 30, 16, pts.length > 1 ? pts : fakeWave(t, 20), "#3ddc84");
  const reg = S && S.regime;
  const riskOn = reg && !reg.block && (reg.mult || 0) >= 1;
  R(c, 182, 15, 22, 13, riskOn ? "#14532d" : "#5b1414");
  ptextC(c, "RISK", 193, 16, riskOn ? "#86efac" : "#fca5a5", 1); ptextC(c, riskOn ? "ON" : "OFF", 193, 22, riskOn ? "#86efac" : "#fca5a5", 1);
  const tk = (S && S.tickers) || [];
  for (let i = 0; i < 7; i++) { const x = tk[i]; const col = !x ? "#333" : x.chg_pct >= 0.01 ? "#16a34a" : x.chg_pct >= 0 ? "#166534" : x.chg_pct > -0.01 ? "#7f1d1d" : "#dc2626"; R(c, 182 + i * 3, 29, 2, 3, col); }
  // whiteboard scribbles: Knobs' recent changes
  const ch = (S && S.tuning && S.tuning.recent_changes) || [];
  ptext(c, "R&D", 248, 10, "#2f6fdb", 1);
  ptext(c, (S && S.tuning && S.tuning.running) ? "TUNING" : "OOS>IS", 264, 10, "#d03030", 1);
  const AL = { position_scale: "SIZE", risk_per_trade_pct: "RISK", breakout_lookback_days: "LOOKBK", trail_atr: "TRAIL", rsi_max: "RSIMAX",
    max_hold_days: "HOLD", rsi_entry: "RSI IN", rsi_exit: "RSI OUT", stop_atr: "STOP", target_atr: "TGT", reward_risk: "R:R", max_stop_pct: "STOP%",
    opening_range_minutes: "OR MIN", min_trend_pct: "TREND", min_gap_pct: "GAP", bb_k: "BB K", lookback_days: "LOOKBK", top_n: "TOP N", exit_rank: "EXIT#" };
  for (let i = 0; i < 2; i++) {
    const x = ch[ch.length - 1 - i];
    const s = x ? `${x.bot.slice(0, 4)} ${AL[x.param] || String(x.param).replace(/_/g, "").slice(0, 6)}` : ["SHARPE-DD", "WALK FWD"][i];
    ptext(c, s, 248, 17 + i * 7, i === 0 ? "#222" : "#555", 1);
  }
  // brass sign + clock in El Jefe's wall
  R(c, 384, 12, 12, 12, "#e9e2c9"); c.strokeStyle = "#3b2a1a"; c.strokeRect(384.5, 12.5, 11, 11);
  const et = etNow(); const a1 = (et.hh % 12 + et.mm / 60) / 12 * Math.PI * 2, a2 = et.mm / 60 * Math.PI * 2;
  c.strokeStyle = "#111"; c.beginPath(); c.moveTo(390, 18); c.lineTo(390 + Math.sin(a1) * 3, 18 - Math.cos(a1) * 3); c.stroke();
  c.strokeStyle = "#a00"; c.beginPath(); c.moveTo(390, 18); c.lineTo(390 + Math.sin(a2) * 5, 18 - Math.cos(a2) * 5); c.stroke();
  R(c, 346, 37, 12, 7, "#c79a3a"); R(c, 347, 38, 10, 5, "#e7c56a"); R(c, 349, 40, 6, 1, "#8a6a2a");
}
function fakeWave(t, n) { const a = []; for (let i = 0; i < n; i++) a.push(Math.sin(i * 0.7 + t * 0.6) + Math.sin(i * 0.23 + t * 0.2) * 2); return a; }
function sparkPix(c, x, y, w, h, pts, col) {
  if (!pts.length) return;
  const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
  let prev = null;
  for (let i = 0; i < w; i++) {
    const v = pts[Math.min(pts.length - 1, Math.floor(i / w * pts.length))];
    const yy = y + h - 1 - Math.round((v - mn) / rg * (h - 1));
    if (prev !== null) { const a = Math.min(prev, yy), b = Math.max(prev, yy); R(c, x + i, a, 1, b - a + 1, col); } else R(c, x + i, yy, 1, 1, col);
    prev = yy;
  }
}
function monitor(c, x, y, w, h, mode, seed, t, up) {
  R(c, x, y, w, h, "#15151b"); R(c, x + w / 2 - 1, y + h, 2, 2, "#2a2a30"); R(c, x + w / 2 - 3, y + h + 2, 6, 1, "#2a2a30");
  const sx = x + 1, sy = y + 1, sw = w - 2, sh = h - 2;
  if (mode === "off") { R(c, sx, sy, sw, sh, "#0b0d14"); return; }
  if (mode === "saver") { R(c, sx, sy, sw, sh, "#0d1530"); const k = Math.floor(t * 2 + seed * 7) % (sw * sh); R(c, sx + (k % sw), sy + ((k / sw) | 0), 1, 1, "#4f8cff"); return; }
  R(c, sx, sy, sw, sh, "#07140d");
  const col = up ? "#3ddc84" : "#ff5c5c";
  if (mode === "bars") { for (let i = 0; i < sw; i += 2) { const v = (Math.sin(i * 1.3 + seed * 5 + t * 1.5) + 1) / 2; R(c, sx + i, sy + sh - 1 - Math.round(v * (sh - 2)), 1, Math.round(v * (sh - 2)) + 1, i % 4 ? col : "#e8e2cf"); } return; }
  let prev = null;
  for (let i = 0; i < sw; i++) {
    const v = Math.sin((i + t * 3 + seed * 13) * 0.55) * 0.35 + Math.sin((i + seed * 31) * 0.21) * 0.4 + (up ? i : -i) / sw * 0.6;
    const yy = sy + Math.max(0, Math.min(sh - 1, Math.round(sh / 2 - v * sh / 2)));
    if (prev !== null) { const a = Math.min(prev, yy), b = Math.max(prev, yy); R(c, sx + i, a, 1, b - a + 1, col); }
    prev = yy;
  }
}
function trophy(c, x, y, gold, big) {
  const m = gold ? "#ffd54a" : "#d9e1ea", d = gold ? "#a87b00" : "#7d8a99", s = big ? 1 : 0;
  R(c, x - 1 - s, y + 6 + s, 6 + 2 * s, 2, "#3a2a1a");
  R(c, x + 1, y + 4 + s, 2, 2 + s, d);
  R(c, x - s, y, 4 + 2 * s, 4 + s, m); R(c, x - 1 - s, y + 1, 1, 2, m); R(c, x + 4 + s, y + 1, 1, 2, m);
  R(c, x + 1, y + 1, 1, 1, "#fff");
  if (gold && Math.floor(T * 3) % 4 === 0) R(c, x + 5 + s, y - 2, 1, 1, "#fff");
}
function deskMode(id) {
  const c = chars[id], b = bot(id), st = mktStatus();
  if (LAID_OFF.has(id)) return "off";                                      // empty Swing Desk seats (hiring)
  if (c.hidden) return "off";
  if (TRADERS.includes(id) && b && BENCHED.has(b.status)) return "saver";
  return st === "open" ? "chart" : st === "pre-market" ? "bars" : "chart";
}
function deskUp(id) { const b = bot(id); return !b || (b.pnl_today || 0) >= 0; }

const DRAW = {
  tdesk(f, t) {
    const px = f.x * TS, py = f.y * TS, id = f.bot, vacant = LAID_OFF.has(id), mode = deskMode(id), up = deskUp(id);
    const top = "#7d5532";   // Swing Desk wood
    R(g, px + 1, py - 3, 46, 13, top); R(g, px + 1, py - 3, 46, 2, shade(top, 1.25)); R(g, px + 1, py + 10, 46, 6, "#4e3019");
    R(g, px + 2, py + 15, 3, 1, "#2a1a0e"); R(g, px + 43, py + 15, 3, 1, "#2a1a0e");
    monitor(g, px + 3, py - 12, 13, 9, mode, hash(id), t, up);
    monitor(g, px + 32, py - 12, 13, 9, mode === "chart" ? "bars" : mode, hash(id) + 0.5, t, up);
    R(g, px + 18, py + 2, 12, 3, "#2b2b33"); R(g, px + 19, py + 3, 10, 1, "#55555f");
    R(g, px + 38, py + 3, 3, 3, "#f1f1f1"); R(g, px + 39, py + 3, 1, 1, "#5a3a22");
    R(g, px + 6, py + 3, 7, 4, "#e8e2cf"); R(g, px + 7, py + 4, 5, 1, "#999");
    R(g, px + 15, py + 11, 18, 5, "#2a1c10");
    if (vacant) {
      ptextC(g, "NOW HIRING", px + 24, py + 11, "#f2c14e", 1);             // empty Swing Desk seat
      R(g, px + 20, py - 1, 8, 5, "#1b1b1b"); ptextC(g, "OPEN", px + 24, py - 1, "#ffb84d", 1);
    } else {
      ptextC(g, CAST[id].name, px + 24, py + 11, COL[id], 1);
      awardsOnDesk(id, px + 40, py - 6);
    }
  },
  pdesk(f, t) {
    const px = f.x * TS, py = f.y * TS, mode = chars.pixel.hidden ? "off" : "chart";
    R(g, px + 1, py - 3, 30, 13, "#5d6670"); R(g, px + 1, py - 3, 30, 2, "#7b858f"); R(g, px + 1, py + 10, 30, 6, "#353c43");
    monitor(g, px + 2, py - 12, 9, 8, S && S.feed && S.feed.ok === false ? "saver" : mode, 0.3, t, true);
    monitor(g, px + 21, py - 12, 9, 8, mode === "chart" ? "bars" : mode, 0.7, t, true);
    R(g, px + 12, py + 2, 8, 3, "#2b2b33"); R(g, px + 5, py + 6, 20, 1, "#1d4ed8");
    ptextC(g, "DATA", px + 16, py + 11, "#a5a5c8", 1); awardsOnDesk("pixel", px + 25, py - 4);
  },
  kdesk(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px + 1, py - 3, 30, 13, "#cfd6dc"); R(g, px + 1, py - 3, 30, 2, "#eef2f5"); R(g, px + 1, py + 10, 30, 6, "#8b949c");
    monitor(g, px + 2, py - 12, 13, 9, chars.knobs.hidden ? "off" : "chart", 0.9, t, true);
    R(g, px + 19, py - 1, 3, 6, "#7ee0c3"); R(g, px + 19, py - 3, 3, 2, "#ccc"); R(g, px + 24, py + 1, 3, 4, "#ff7b7b");
    ptextC(g, "R&D", px + 16, py + 11, "#333", 1); awardsOnDesk("knobs", px + 26, py - 6);
  },
  jdesk(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px, py - 4, 48, 14, "#6b2f1a"); R(g, px, py - 4, 48, 2, "#8c4227"); R(g, px, py + 10, 48, 6, "#4a1f10"); R(g, px, py + 10, 48, 1, "#c79a3a");
    R(g, px + 4, py - 2, 3, 6, "#c79a3a"); R(g, px + 2, py - 5, 7, 3, "#1f7a3a");   // banker's lamp
    monitor(g, px + 32, py - 12, 13, 9, chars.grok.hidden ? "off" : "chart", 0.11, t, !(S && S.boss && S.boss.mood === "worried"));
    R(g, px + 15, py + 1, 18, 4, "#e7c56a"); ptextC(g, "JEFE", px + 24, py + 1, "#3b2a1a", 1);
    R(g, px + 10, py + 5, 5, 2, "#5a2c0f");   // cigar box
    awardsOnDesk("grok", px + 26, py - 8);
    const j = chars.grok;
    if (!j.hidden && j.pose === "feetup" && atSpot(j, SPOTS.chair_grok)) {   // boots on the desk
      R(g, px + 18, py - 4, 5, 6, "#5b3a1e"); R(g, px + 25, py - 4, 5, 6, "#5b3a1e"); R(g, px + 18, py + 1, 5, 2, "#2b1a0c"); R(g, px + 25, py + 1, 5, 2, "#2b1a0c");
      R(g, px + 19, py - 4, 3, 1, "#c79a3a"); R(g, px + 26, py - 4, 3, 1, "#c79a3a");
    }
  },
  gdesk(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px, py - 4, 48, 10, "#efe3c4"); R(g, px, py - 4, 48, 2, "#fff6dc"); R(g, px, py + 6, 48, 10, "#d4b483"); R(g, px, py + 9, 48, 2, "#c79a3a");
    ptextC(g, "RECEPTION", px + 24, py + 12, "#5b3a1e", 1);
    monitor(g, px + 3, py - 12, 12, 8, chars.goldie.hidden ? "off" : "bars", 0.42, t, true);
    R(g, px + 36, py - 7, 4, 4, "#3b82f6"); R(g, px + 35, py - 10, 2, 3, "#ff4fa3"); R(g, px + 39, py - 11, 2, 3, "#ffd54a"); R(g, px + 37, py - 12, 2, 3, "#ff6b6b");
    R(g, px + 26, py - 1, 4, 2, "#c79a3a"); R(g, px + 27, py - 2, 2, 1, "#e7c56a");   // bell
  },
  vending(f, t) { const px = f.x * TS, py = f.y * TS; R(g, px + 1, py - 14, 14, 30, "#b91c1c"); R(g, px + 3, py - 12, 8, 18, "#1e293b"); for (let i = 0; i < 4; i++) R(g, px + 4, py - 11 + i * 4, 6, 2, ["#fde047", "#60a5fa", "#f472b6", "#4ade80"][i]); R(g, px + 12, py - 8, 2, 4, "#e5e7eb"); },
  fridge(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 1, py - 14, 14, 30, "#e5e7eb"); R(g, px + 1, py - 2, 14, 1, "#9ca3af"); R(g, px + 12, py - 10, 1, 5, "#6b7280"); R(g, px + 12, py + 2, 1, 5, "#6b7280"); },
  kitchen(f, t) { const px = f.x * TS, py = f.y * TS; R(g, px, py - 2, 32, 18, "#8b5e3c"); R(g, px, py - 2, 32, 3, "#d6c7a8"); R(g, px + 3, py - 8, 12, 7, "#d1d5db"); R(g, px + 4, py - 7, 7, 5, "#111827"); R(g, px + 20, py - 7, 6, 6, "#3f3f46"); R(g, px + 21, py - 3, 4, 2, "#7c2d12"); },
  cooler(f, t) { const px = f.x * TS, py = f.y * TS; R(g, px + 4, py - 2, 8, 18, "#e5e7eb"); R(g, px + 4, py - 12, 8, 10, "#93c5fd"); R(g, px + 5, py - 11, 2, 7, "#dbeafe"); },
  btable(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 2, py + 1, 28, 12, "#a0703f"); R(g, px + 2, py + 1, 28, 2, "#c08a52"); R(g, px + 8, py + 4, 3, 3, "#fff"); R(g, px + 20, py + 5, 3, 3, "#fca5a5"); R(g, px + 14, py + 3, 4, 2, "#fde68a"); },
  coffee(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px, py - 2, 48, 18, "#3b2416"); R(g, px, py - 2, 48, 3, "#6b4a2e"); R(g, px, py + 12, 48, 4, "#24150c");
    R(g, px + 4, py - 12, 14, 11, "#c0c7cf"); R(g, px + 6, py - 10, 10, 4, "#1f2937"); R(g, px + 8, py - 5, 2, 3, "#111"); R(g, px + 13, py - 5, 2, 3, "#111");
    if (Math.floor(t * 2) % 3) { R(g, px + 9, py - 15 - (Math.floor(t * 4) % 3), 1, 2, "rgba(255,255,255,.6)"); R(g, px + 13, py - 16 + (Math.floor(t * 3) % 3), 1, 2, "rgba(255,255,255,.5)"); }
    for (let i = 0; i < 4; i++) R(g, px + 24 + i * 5, py - 4, 3, 3, "#f5f5f4");
    ptextC(g, "ESPRESSO", px + 24, py + 6, "#f2c14e", 1);
  },
  rack(f, t) {
    const px = f.x * TS, py = f.y * TS, bad = S && S.feed && S.feed.ok === false;
    R(g, px + 1, py - 10, 14, 58, "#111318"); R(g, px + 2, py - 9, 12, 56, "#1c1f26");
    for (let i = 0; i < 12; i++) { R(g, px + 3, py - 7 + i * 4.5, 10, 3, "#2a2e37"); const on = (Math.floor(t * 3 + i * 1.7) % 3) !== 0; R(g, px + 11, py - 6 + i * 4.5, 1, 1, bad ? (on ? "#ef4444" : "#7f1d1d") : on ? "#22c55e" : "#f59e0b"); R(g, px + 4, py - 6 + i * 4.5, 4, 1, "#3b82f6"); }
  },
  copier(f, t) {
    const px = f.x * TS, py = f.y * TS, busy = Object.values(chars).some((c) => !c.hidden && (atSpot(c, SPOTS.copier) || atSpot(c, SPOTS.copier_2)));
    R(g, px + 2, py - 6, 28, 22, "#d4d4d8"); R(g, px + 2, py - 6, 28, 3, "#f4f4f5"); R(g, px + 5, py - 3, 16, 3, "#52525b"); R(g, px + 22, py - 2, 5, 4, "#1f2937");
    R(g, px + 23, py - 1, 3, 1, busy ? "#22c55e" : "#6b7280");
    if (busy) { R(g, px + 6, py - 8 - (Math.floor(t * 4) % 4), 10, 2, "#fff"); }
    R(g, px + 4, py + 6, 24, 6, "#a1a1aa");
  },
  plant(f, t) { const px = f.x * TS, py = f.y * TS, big = f.big; R(g, px + 4, py + 6, 8, 9, "#9a5b2e"); R(g, px + 4, py + 6, 8, 2, "#b8733d");
    const h = big ? 18 : 10; for (let i = 0; i < 7; i++) R(g, px + 1 + ((i * 5) % 12), py + 6 - h + ((i * 7) % h), 5, 6, i % 2 ? "#2f8f4e" : "#3cb36a"); R(g, px + 6, py + 6 - h + 2, 4, h - 2, "#2f8f4e"); },
  shelf(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 1, py - 14, 14, 30, "#5a3418"); for (let r = 0; r < 4; r++) { R(g, px + 2, py - 12 + r * 7, 12, 1, "#3b200d"); for (let k = 0; k < 4; k++) R(g, px + 3 + k * 3, py - 17 + r * 7 + 2, 2, 5, ["#b91c1c", "#1d4ed8", "#f2c14e", "#15803d"][(k + r) % 4]); } },
  cabinet(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 1, py - 12, 14, 28, "#4a2512"); R(g, px + 2, py - 11, 12, 20, "#9fd3e6"); const h = (S && S.awards && S.awards.hall) || []; let k = 0; for (const x of h.slice(0, 4)) { trophy(g, px + 3 + (k % 2) * 6, py - 10 + Math.floor(k / 2) * 9, true, false); k++; } if (!k) ptextC(g, "?", px + 8, py - 4, "#2a2a2a", 1); },
  couch(f) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px - 4, py - 6, 56, 14, "#7a3e2a"); R(g, px - 4, py - 6, 56, 2, "#9a5238");   // back
    R(g, px - 6, py, 6, 28, "#6a3424"); R(g, px + 48, py, 6, 28, "#6a3424");           // arms
    for (let k = 0; k < 3; k++) { R(g, px + k * 16, py + 8, 15, 18, "#8c4a32"); R(g, px + k * 16, py + 8, 15, 2, "#a85c3f"); }
  },
  indysign(f) {
    const px = f.x * TS, py = f.y * TS, a = S && S.accounts && S.accounts.bench, v = a ? a.pnl_total : 0;
    R(g, px + 3, py + 2, 1, 14, "#3b2a1a"); R(g, px + 12, py + 2, 1, 14, "#3b2a1a");
    R(g, px - 2, py - 8, 20, 13, "#f5ecd5"); R(g, px - 2, py - 8, 20, 1, "#b08a4a");
    ptextC(g, "SPY", px + 8, py - 7, "#333", 1); ptextC(g, (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(0), px + 8, py - 1, v >= 0 ? "#15803d" : "#b91c1c", 1);
  },
  bull(f, t) {
    const px = f.x * TS, py = f.y * TS;
    R(g, px + 1, py + 18, 30, 12, "#3a3a3a"); R(g, px + 1, py + 18, 30, 2, "#555"); ptextC(g, "BULLS", px + 16, py + 22, "#e7c56a", 1);
    const gc = "#d4a62a", gd = "#a87b12";
    R(g, px + 5, py + 4, 20, 10, gc); R(g, px + 22, py + 1, 8, 8, gc); R(g, px + 28, py - 1, 2, 3, "#fff3c4"); R(g, px + 22, py - 1, 2, 3, "#fff3c4");
    R(g, px + 6, py + 13, 3, 6, gd); R(g, px + 11, py + 13, 3, 6, gd); R(g, px + 18, py + 13, 3, 6, gd); R(g, px + 22, py + 13, 3, 6, gd);
    R(g, px + 2, py + 5, 4, 2, gd); R(g, px + 7, py + 5, 12, 2, "#f0c74a"); R(g, px + 27, py + 4, 1, 1, "#111");
    if (Math.floor(t * 2) % 5 === 0) R(g, px + 10, py + 6, 1, 1, "#fff");
  },
  trash(f) { const px = f.x * TS, py = f.y * TS; R(g, px + 5, py + 4, 7, 10, "#4b5563"); R(g, px + 4, py + 3, 9, 2, "#6b7280"); R(g, px + 7, py + 2, 3, 2, "#e5e7eb"); },
};
function awardsOnDesk(id, x, y) {
  const w = winners();
  if (w.month && w.month.winner === id) trophy(g, x - 6, y, true, true);
  if (w.week && w.week.winner === id) trophy(g, x, y + 1, false, false);
}

// ---------- partitions (break room, El Jefe's glass office, award wall)
const WALLS = [];
for (let y = 3; y <= 8; y++) if (y !== 7) WALLS.push({ x: 6, y, kind: "v" });
for (let x = 1; x <= 5; x++) WALLS.push({ x, y: 8, kind: "h" });
for (let y = 3; y <= 7; y++) if (y !== 6) WALLS.push({ x: 19, y, kind: "glass" });
WALLS.push({ x: 19, y: 8, kind: "award", w: 6 });
function drawWall(w) {
  const px = w.x * TS, py = w.y * TS;
  if (w.kind === "v") { R(g, px + 5, py - 10, 6, 26, "#3e5a4c"); R(g, px + 5, py - 10, 6, 2, "#5f8a73"); R(g, px + 5, py + 14, 6, 2, "#2a3d33"); return; }
  if (w.kind === "h") { R(g, px, py - 8, 16, 18, "#3e5a4c"); R(g, px, py - 8, 16, 3, "#5f8a73"); R(g, px, py + 8, 16, 2, "#2a3d33"); if (w.x === 3) ptextC(g, "BREAK", px + 8, py - 3, "#cfe8d8", 1); return; }
  if (w.kind === "glass") { R(g, px + 6, py - 10, 4, 26, "rgba(170,220,255,.35)"); R(g, px + 6, py - 10, 1, 26, "#c79a3a"); R(g, px + 9, py - 10, 1, 26, "#c79a3a"); R(g, px + 7, py - 6, 1, 8, "rgba(255,255,255,.7)"); return; }
  if (w.kind === "award") drawAwardWall(px, py, w.w * TS);
}
function portrait(c, x, y, w, h, id, gold) {
  R(c, x - 2, y - 2, w + 4, h + 4, gold ? "#a87b00" : "#7d8a99"); R(c, x - 1, y - 1, w + 2, h + 2, gold ? "#ffd54a" : "#e5ebf1");
  R(c, x, y, w, h, gold ? "#3a2c0a" : "#2a3340");
  if (!id) { ptextC(c, "?", x + w / 2, y + h / 2 - 2, gold ? "#ffd54a" : "#c9d1d9", 1); return; }
  const k = CAST[id]; const cx = x + w / 2 - 4, cy = y + 2;
  R(c, cx - 1, cy + 8, 10, h - 10, k.dress || k.shirt || "#888"); R(c, cx, cy + 1, 8, 7, k.skin); R(c, cx, cy, 8, 3, k.hair);
  if (k.acc === "jefe") { R(c, cx - 2, cy + 1, 12, 1, "#6b4423"); R(c, cx + 1, cy - 2, 6, 3, "#6b4423"); R(c, cx + 1, cy + 3, 6, 1, "#000"); }
  else { R(c, cx + 2, cy + 4, 1, 1, "#000"); R(c, cx + 5, cy + 4, 1, 1, "#000"); }
  if (gold && Math.floor(T * 4) % 3 === 0) { R(c, x + 1, y + 1, 1, 1, "#fff"); R(c, x + w - 2, y + h - 3, 1, 1, "#fff"); }
}
function drawAwardWall(px, py, w) {
  R(g, px, py - 14, w, 26, "#4a2f1d"); R(g, px, py - 14, w, 3, "#6b4a2e"); R(g, px, py + 10, w, 6, "#2c1c12");
  for (let x = px + 3; x < px + w; x += 12) R(g, x, py - 10, 1, 20, "#3e2717");
  const wn = winners();
  portrait(g, px + 8, py - 9, 14, 16, wn.week && wn.week.winner, false);        // silver weekly plaque
  R(g, px + 5, py + 8, 20, 3, "#c9d1d9");
  portrait(g, px + 37, py - 11, 20, 20, wn.month && wn.month.winner, true);     // gold monthly portrait
  R(g, px + 34, py + 10, 26, 2, "#ffd54a");
  const hall = (S && S.awards && S.awards.hall) || [];
  for (let i = 0; i < 6; i++) { const hx = px + 66 + (i % 3) * 9, hy = py - 9 + Math.floor(i / 3) * 10; R(g, hx, hy, 7, 8, "#a87b00"); R(g, hx + 1, hy + 1, 5, 6, hall[i] ? COL[hall[i].winner] || "#777" : "#2a210a"); }
}

// ---------- characters
function drawChar(c, t) {
  const k = CAST[c.id];
  const sitting = (c.pose === "sit" || c.pose === "feetup") && !c.moving && !c.path.length;
  const couch = c.pose === "couch" && !c.moving && !c.path.length;
  let fx = Math.round(c.x), fy = Math.round(c.y + 6);
  if (sitting) fy = Math.round(c.y + 3);
  if (couch) fy = Math.round(c.y + 4);
  if (c.jumpUntil > T) fy -= Math.round(Math.abs(Math.sin(T * 12)) * 3);
  const face = (sitting || couch) ? (c.face || "S") : c.face;
  const x0 = fx - 7, top = fy - 24;
  const walkF = (c.moving ? Math.floor(c.walkT * 8) % 2 : 0);
  // shadow
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(fx - 6, fy - 1, 12, 3);
  // legs / dress
  if (k.dress) {
    if (!sitting) { R(g, x0 + 4, top + 21, 2, 3 - (walkF ? 1 : 0), k.skin); R(g, x0 + 8, top + 21, 2, 3 - (walkF ? 0 : 1), k.skin); R(g, x0 + 3, top + 23, 3, 1, "#c2185b"); R(g, x0 + 8, top + 23, 3, 1, "#c2185b"); }
    R(g, x0 + 2, top + 12, 10, 4, k.dress); R(g, x0 + 1, top + 16, 12, 5, k.dress);
    for (let i = 0; i < 6; i++) R(g, x0 + 2 + ((i * 5) % 10), top + 13 + ((i * 3) % 8), 1, 1, k.dots);
    R(g, x0 + 1, top + 20, 12, 1, "#ffd1ea");
  } else if (!sitting) {
    const lp = couch ? 2 : 4;
    R(g, x0 + 3, top + 19, 3, lp - (walkF ? 1 : 0), k.pants); R(g, x0 + 8, top + 19, 3, lp - (walkF ? 0 : 1), k.pants);
    const sh = k.acc === "jefe" ? "#5b3a1e" : "#1f1f1f";
    R(g, x0 + 3, top + 19 + lp - (walkF ? 1 : 0), 3, 1, sh); R(g, x0 + 8, top + 19 + lp - (walkF ? 0 : 1), 3, 1, sh);
    R(g, x0 + 3, top + 18, 8, 1, shade(k.pants, 0.8));
  }
  // torso + arms
  if (!k.dress) {
    const shirt = k.shirt;
    R(g, x0 + 2, top + 11, 10, 8, shirt); R(g, x0 + 2, top + 11, 10, 1, shade(shirt, 1.2));
    if (k.coat) { R(g, x0 + 6, top + 12, 2, 6, "#9ca3af"); R(g, x0 + 3, top + 15, 2, 2, "#60a5fa"); }
    if (k.tie && face === "S") { R(g, x0 + 6, top + 12, 2, 5, k.tie); }
    if (k.acc === "jefe" && face === "S") { R(g, x0 + 5, top + 11, 4, 2, "#f5f5f5"); R(g, x0 + 4, top + 13, 1, 1, "#f2c14e"); R(g, x0 + 5, top + 14, 1, 1, "#f2c14e"); R(g, x0 + 6, top + 15, 2, 1, "#f2c14e"); R(g, x0 + 8, top + 14, 1, 1, "#f2c14e"); R(g, x0 + 9, top + 13, 1, 1, "#f2c14e"); R(g, x0 + 6, top + 16, 2, 1, "#ffe08a"); }
    if (k.acc === "bolt" && face === "S") { R(g, x0 + 7, top + 12, 2, 2, "#1f1f1f"); R(g, x0 + 6, top + 14, 2, 2, "#1f1f1f"); }
  }
  const typing = sitting && (TRADERS.includes(c.id) || c.id === "pixel" || c.id === "knobs" || c.id === "goldie") && mktStatus() !== "closed";
  const arm = k.dress ? k.skin : k.shirt;
  const a1 = typing && Math.floor(t * 6 + hash(c.id) * 5) % 2 ? 1 : 0;
  if (c.emote === "cheer" || c.emote === "clap") {
    R(g, x0, top + 6, 2, 6, arm); R(g, x0 + 12, top + 6, 2, 6, arm); R(g, x0, top + 5, 2, 2, k.skin); R(g, x0 + 12, top + 5, 2, 2, k.skin);
  } else {
    R(g, x0, top + 12 + a1, 2, 5, arm); R(g, x0 + 12, top + 12 + (1 - a1), 2, 5, arm);
    R(g, x0, top + 17 + a1, 2, 1, k.skin); R(g, x0 + 12, top + 17 + (1 - a1), 2, 1, k.skin);
  }
  if (k.acc === "paper" && (couch || sitting)) { R(g, x0 - 1, top + 12, 16, 7, "#f5f5f0"); for (let i = 0; i < 3; i++) R(g, x0 + 1, top + 14 + i * 2, 12, 1, "#9ca3af"); }
  // head
  R(g, x0 + 1, top + 1, 12, 10, k.skin);
  R(g, x0 + 1, top + 10, 12, 1, shade(k.skin, 0.85));
  // hair
  const hr = k.hair;
  if (face === "N") { R(g, x0 + 1, top, 12, 10, hr); }
  else {
    R(g, x0 + 1, top, 12, 3, hr); R(g, x0, top + 1, 2, 6, hr); R(g, x0 + 12, top + 1, 2, 6, hr);
    if (k.spiky) for (let i = 0; i < 5; i++) R(g, x0 + 1 + i * 2.5, top - 2 + (i % 2), 2, 3, hr);
    if (k.puff) { R(g, x0 - 1, top - 3, 16, 5, hr); R(g, x0 - 1, top + 2, 2, 5, hr); R(g, x0 + 13, top + 2, 2, 5, hr); }
    if (k.long) { R(g, x0, top + 1, 2, 12, hr); R(g, x0 + 12, top + 1, 2, 12, hr); R(g, x0 + 1, top - 1, 12, 2, hr); }
  }
  // face
  if (face !== "N") {
    const ex = face === "E" ? [7, 10] : face === "W" ? [3, 6] : [4, 9];
    if (k.acc === "jefe") { R(g, x0 + 2, top + 5, 10, 3, "#0b0b0b"); R(g, x0 + 3, top + 5, 2, 1, "#6b7280"); R(g, x0 + 4, top + 8, 6, 2, "#2b1a10"); }
    else {
      R(g, x0 + ex[0], top + 5, 2, 2, "#1b1b1b"); R(g, x0 + ex[1], top + 5, 2, 2, "#1b1b1b");
      if (k.acc === "glasses" || k.acc === "goggles") { const gc = k.acc === "goggles" ? "#38bdf8" : "#e0aaff"; R(g, x0 + ex[0] - 1, top + 4, 4, 1, gc); R(g, x0 + ex[1] - 1, top + 4, 4, 1, gc); R(g, x0 + ex[0] - 1, top + 7, 4, 1, gc); R(g, x0 + ex[1] - 1, top + 7, 4, 1, gc); }
      const mouth = c.emote === "sweat" ? "#7f1d1d" : "#9a3b3b";
      R(g, x0 + (face === "E" ? 8 : face === "W" ? 4 : 6), top + 8, 2, 1, mouth);
      if (c.emote === "cheer") R(g, x0 + 5, top + 8, 4, 1, mouth);
    }
  }
  // headwear / accessories
  switch (k.acc) {
    case "jefe": R(g, x0 - 3, top + 1, 20, 2, "#6b4423"); R(g, x0 - 3, top, 2, 1, "#6b4423"); R(g, x0 + 15, top, 2, 1, "#6b4423");
      R(g, x0 + 2, top - 5, 10, 6, "#7a5030"); R(g, x0 + 2, top - 1, 10, 1, "#2b1a10"); R(g, x0 + 5, top - 5, 4, 1, "#5a3a20"); break;
    case "headband": R(g, x0 + 1, top + 2, 12, 2, "#fff"); R(g, x0 + 1, top + 3, 12, 1, "#e63946"); break;
    case "beanie": R(g, x0, top - 2, 14, 5, k.hat); R(g, x0, top + 2, 14, 1, shade(k.hat, 0.8)); R(g, x0 + 6, top - 4, 2, 2, "#fff"); break;
    case "cap": R(g, x0 + 1, top - 2, 12, 4, k.hat); if (face !== "N") R(g, face === "W" ? x0 - 2 : x0 + 4, top + 1, 9, 2, shade(k.hat, 0.8)); break;
    case "visor": R(g, x0, top + 1, 14, 2, k.hat); if (face === "S") R(g, x0 + 2, top + 3, 10, 1, shade(k.hat, 0.7)); break;
    case "headset": R(g, x0 - 1, top + 4, 2, 4, "#222"); R(g, x0 + 13, top + 4, 2, 4, "#222"); if (face === "S") R(g, x0 + 10, top + 8, 3, 1, "#222"); break;
    case "headphones": R(g, x0 + 1, top - 1, 12, 1, "#ff4fa3"); R(g, x0 - 1, top + 3, 3, 5, "#ff4fa3"); R(g, x0 + 12, top + 3, 3, 5, "#ff4fa3"); break;
    case "bow": R(g, x0 + 9, top - 2, 5, 3, "#7c3aed"); R(g, x0 + 11, top - 1, 1, 1, "#fde047"); break;
    case "moon": R(g, x0 + 9, top - 3, 5, 5, k.hat || "#e8e0c8"); R(g, x0 + 11, top - 2, 3, 3, "#16213e"); break;
  }
}

// ---------- Research Inc. stairwell + visitor details (lanyard/ID badge, headwear, folder)
function drawRIStairs(t) {
  const x = 15 * TS, y = 16 * TS, by = 17 * TS;
  for (let i = 0; i < 4; i++) { R(g, x + 1, by + i * 4, 46, 4, shade("#3a4a52", 1 - i * 0.18)); R(g, x + 1, by + i * 4, 46, 1, shade("#6d8794", 1 - i * 0.18)); }
  R(g, x - 1, by - 2, 2, TS + 2, "#c79a3a"); R(g, x + 47, by - 2, 2, TS + 2, "#c79a3a");
  R(g, x + 1, y + 1, 46, 15, "#0b3b44"); g.strokeStyle = RI_TAG; g.lineWidth = 1; g.strokeRect(x + 1.5, y + 1.5, 45, 14);
  ptextC(g, "RESEARCH", x + 24, y + 4, RI_TAG, 1); ptextC(g, "INC. B1", x + 24, y + 10, "#bff8ff", 1);
  const vis = RI_IDS.some((id) => !chars[id].hidden);
  R(g, x + 44, by + 1, 2, 2, vis || Math.floor(t * 2) % 2 ? RI_TAG : "#0b3b44");   // stair light blinks while idle, solid on visits
}
function drawRIExtras(c, t) {
  const k = CAST[c.id], col = COL[c.id];
  const sitting = (c.pose === "sit" || c.pose === "feetup") && !c.moving && !c.path.length;
  let fx = Math.round(c.x), fy = Math.round(c.y + (sitting ? 3 : 6));
  if (c.jumpUntil > T) fy -= Math.round(Math.abs(Math.sin(T * 12)) * 3);
  const x0 = fx - 7, top = fy - 24, face = c.face;
  if (face !== "N") {   // cyan lanyard + white ID badge = Research Inc.
    R(g, x0 + 4, top + 11, 1, 4, RI_TAG); R(g, x0 + 9, top + 11, 1, 4, RI_TAG); R(g, x0 + 5, top + 14, 4, 4, "#ffffff"); R(g, x0 + 6, top + 15, 2, 1, RI_TAG); R(g, x0 + 6, top + 17, 2, 1, "#555");
  } else R(g, x0 + 4, top + 11, 6, 1, RI_TAG);
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
  else if (k.ri === "hardhat") { R(g, hx + 1, top + 11, 5, 7, "#8b5e3c"); R(g, hx + 2, top + 12, 3, 5, "#fff"); R(g, hx + 2, top + 13, 1, 1, "#16a34a"); R(g, hx + 2, top + 15, 1, 1, "#16a34a"); }
}

// ---------- frame composition
function renderWorld(t) {
  const hr = etNow().h;
  if (Math.floor(hr * 12) !== bgStamp) drawBackground(hr);
  g.drawImage(bg, 0, 0);
  drawWallLive(t);
  drawRIStairs(t);
  const items = [];
  for (const f of FURN) items.push({ y: (f.y + f.h) * TS - (f.type === "tdesk" || f.type === "jdesk" || f.type === "gdesk" || f.type === "pdesk" || f.type === "kdesk" ? 0 : 1), f });
  for (const w of WALLS) items.push({ y: (w.y + 1) * TS - 1, w });
  for (const id in CHAIRS) items.push({ y: CHAIRS[id][1] * TS + 12, chair: CHAIRS[id], id });
  for (const s of BREAK) if (s[3] === "sit") items.push({ y: s[1] * TS + 11, stool: s });
  for (const id of ORDER) { const c = chars[id]; if (!c.hidden) items.push({ y: c.y + 6.5 + (c.pose === "couch" ? 10 : 0), c }); }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.f) DRAW[it.f.type](it.f, t);
    else if (it.w) drawWall(it.w);
    else if (it.chair) { const px = it.chair[0] * TS, py = it.chair[1] * TS; R(g, px + 3, py - 1, 10, 4, "#23232b"); R(g, px + 2, py + 3, 12, 6, "#30303a"); R(g, px + 7, py + 9, 2, 3, "#18181d"); R(g, px + 4, py + 12, 8, 1, "#18181d"); }
    else if (it.stool) { const px = it.stool[0] * TS, py = it.stool[1] * TS; R(g, px + 4, py + 5, 8, 4, "#b45309"); R(g, px + 7, py + 9, 2, 4, "#5b3a1e"); }
    else if (it.c) { drawChar(it.c, t); if (RI[it.c.id]) drawRIExtras(it.c, t); }
  }
  // lighting
  const n = nightFactor(etNow().h);
  const open = mktStatus() === "open";
  if (n > 0) { g.fillStyle = `rgba(10,14,36,${0.5 * n})`; g.fillRect(0, 3 * TS, LW, LH - 3 * TS); g.fillStyle = `rgba(10,14,36,${0.35 * n})`; g.fillRect(0, 0, LW, 3 * TS); }
  g.save(); g.globalCompositeOperation = "lighter";
  const lamps = [[9, 4.5], [13, 4.5], [9, 7.5], [13, 7.5], [9, 12.5], [13, 12.5], [17, 12.5], [22, 5], [21, 10.5], [16.5, 4.5], [4.5, 12.5], [3, 5], [2, 10.5], [10, 15.5]];
  for (const [lx, ly] of lamps) {
    const x = lx * TS + 8, y = ly * TS, r = 26 + n * 10;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    const a = (0.07 + 0.16 * n) * (open || n > 0 ? 1 : 0.8);
    gr.addColorStop(0, `rgba(255,190,110,${a})`); gr.addColorStop(1, "rgba(255,190,110,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
  // pendant lamps on the wall line
  for (const lx of [9, 13, 17, 22]) { R(g, lx * TS + 6, 3 * TS - 2, 4, 3, "#c79a3a"); R(g, lx * TS + 7, 3 * TS + 1, 2, 1, "#fff3c4"); }
}

// ============================================================== display canvas + overlay text (device pixels)
const cv = $("cv"), ctx = cv.getContext("2d");
let SC = 2, DPR = 1, ZOOM = 1, LP = 2;   // device px per logical px, label font px
function layout() {
  DPR = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
  const wrap = $("floorWrap");
  const side = matchMedia("(min-width:760px) and (min-aspect-ratio:1/1)").matches;
  const availW = (side ? wrap.clientWidth : document.documentElement.clientWidth) - (side ? 12 : 4);
  const availH = side ? wrap.clientHeight - 8 : Math.round(window.innerHeight * 0.62);
  const sFit = Math.min(availW / LW, availH / LH) * DPR;
  let s = Math.floor(sFit);
  if (s < 1 || s < sFit * 0.86) s = sFit;            // integer scaling when it doesn't waste much space
  s *= ZOOM;
  SC = s;
  cv.width = Math.round(LW * s); cv.height = Math.round(LH * s);
  cv.style.width = (cv.width / DPR) + "px"; cv.style.height = (cv.height / DPR) + "px";
  if (!side) wrap.style.height = (cv.height / DPR + (ZOOM > 1 ? 0 : 0)) + "px"; else wrap.style.height = "";
  LP = Math.max(2, Math.round(Math.max(DPR * 1.55, s * 0.62)));
  ctx.imageSmoothingEnabled = false;
}
function roundRect(c, x, y, w, h, r, fill, stroke, lw) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function wrapText(s, n) { const w = s.split(" "), out = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) out.push(cur); return out.slice(0, 3); }
let selected = null;
function drawOverlay() {
  const px = LP;
  const vis = ORDER.map((id) => chars[id]).filter((c) => !c.hidden).sort((a, b) => b.y - a.y);
  const placed = [], bubbles = [], bubbleQ = [];
  for (const c of vis) {
    const sitting = (c.pose === "sit" || c.pose === "feetup") && !c.moving && !c.path.length;
    const headY = (c.y + (sitting ? 3 : 6) - 26 - (CAST[c.id].acc === "jefe" ? 5 : 0)) * SC;
    const cx = c.x * SC;
    const name = CAST[c.id].name;
    const w = tw(name, px) + px * 4, h = px * 7;
    const tgw = RI[c.id] ? tw("RI", px) + px * 2 : 0;   // Research Inc. tag sits left of the name, inside the box
    const lx = Math.round(cx - (w - tgw) / 2);
    let ly = Math.round(headY - h - px);
    for (let guard = 0; guard < 8; guard++) {   // stack labels that would overlap (crowded break room)
      const hit = placed.find((r) => lx - tgw < r.x + r.w + px && lx + w + px > r.x && ly < r.y + r.h && ly + h > r.y);
      if (!hit) break;
      ly = hit.y - h - px;
    }
    placed.push({ x: lx - tgw, y: ly, w: w + tgw, h });
    ctx.fillStyle = selected === c.id ? "rgba(242,193,78,.95)" : "rgba(8,10,12,.78)";
    ctx.fillRect(lx, ly, w, h);
    ctx.fillStyle = COL[c.id]; ctx.fillRect(lx, ly + h - px, w, px);
    ptext(ctx, name, lx + px * 2, ly + px, selected === c.id ? "#1a1205" : "#f4efe0", px);
    if (tgw) { ctx.fillStyle = RI_TAG; ctx.fillRect(lx - tgw, ly, tgw, h); ptext(ctx, "RI", lx - tgw + px, ly + px, "#03262c", px); }
    let by = ly - px;
    if (c.emote && (c.emote === "!" || c.emote === "?" || c.emote === "thumb" || c.emote === "sweat")) {
      const sym = c.emote === "thumb" ? "OK" : c.emote === "sweat" ? ":(" : c.emote;
      const ew = tw(sym, px) + px * 4;
      ctx.fillStyle = c.emote === "!" ? "#dc2626" : c.emote === "thumb" ? "#16a34a" : c.emote === "sweat" ? "#2563eb" : "#7c3aed";
      ctx.fillRect(Math.round(lx + w + px), ly, ew, h);
      ptext(ctx, sym, lx + w + px * 3, ly + px, "#fff", px);
    }
    if (c.bubble) bubbleQ.push(() => {
      const lines = wrapText(c.bubble.text, 16);
      const bw = Math.max(...lines.map((l) => tw(l, px))) + px * 6, bh = lines.length * px * 7 + px * 3;
      let bx = Math.round(cx - bw / 2); bx = Math.max(2, Math.min(cv.width - bw - 2, bx));
      let byy = Math.round(by - bh - px * 3), down = false;
      const obst = bubbles.concat(placed, zoomR ? [zoomR] : []);
      const hitAt = (y) => obst.find((r) => bx < r.x + r.w + px && bx + bw + px > r.x && y < r.y + r.h + px && y + bh + px > r.y);
      let y = byy, ok = false;   // crowded spot: lift above other bubbles/labels, else hang below the feet, else overlap
      const maxUp = byy - bh - px * 12, y0 = Math.round((c.y + 8) * SC + px * 3);   // stay near the speaker
      for (let k = 0; k < 4 && y >= 2 && y >= maxUp; k++) { const hit = hitAt(y); if (!hit) { ok = true; break; } y = hit.y - bh - px * 2; }
      if (!ok) { y = y0; for (let k = 0; k < 3 && y + bh <= cv.height - 2 && y <= y0 + px * 10; k++) { const hit = hitAt(y); if (!hit) { ok = down = true; break; } y = hit.y + hit.h + px * 2; } }
      if (ok) byy = y;
      else if (Math.floor(T / 2.5) % 2 === 0) return;   // no room nearby: take turns with the bubble it would cover
      byy = Math.max(2, byy);
      bubbles.push({ x: bx, y: byy, w: bw, h: bh });
      const tx = Math.max(bx + px * 3, Math.min(bx + bw - px * 3, cx));
      roundRect(ctx, bx, byy, bw, bh, px * 2, "#fffdf3", "#1b1b1b", Math.max(1, px / 2));
      ctx.fillStyle = "#fffdf3"; ctx.beginPath();
      if (down) { ctx.moveTo(tx - px * 2, byy + 1); ctx.lineTo(tx + px * 2, byy + 1); ctx.lineTo(tx, byy - px * 3); }
      else { ctx.moveTo(tx - px * 2, byy + bh - 1); ctx.lineTo(tx + px * 2, byy + bh - 1); ctx.lineTo(tx, byy + bh + px * 3); }
      ctx.fill();
      const col = c.bubble.kind === "up" ? "#0f7a3a" : c.bubble.kind === "dn" ? "#b91c1c" : "#1b1b1b";
      lines.forEach((l, i) => ptext(ctx, l, bx + (bw - tw(l, px)) / 2, byy + px * 2 + i * px * 7, col, px));
    });
    if (c.emote === "cheer" || c.emote === "clap") { const sp = Math.floor(T * 8) % 2; ctx.fillStyle = "#ffd54a"; ctx.fillRect(lx - px * 2, ly + (sp ? 0 : px * 2), px, px); ctx.fillRect(lx + w + px, ly + (sp ? px * 2 : 0), px, px); }
  }
  let zoomR = null;   // the HTML ZOOM button floats over the canvas on phones: keep bubbles out from under it
  const zb = $("floorBtns"), zbtn = $("zoomBtn");
  if (bubbleQ.length && zb && zb.offsetWidth) { const a = zb.getBoundingClientRect(), b = cv.getBoundingClientRect(), k = cv.width / (b.width || 1); zoomR = { x: (a.left - b.left) * k, y: (a.top - b.top) * k, w: a.width * k, h: a.height * k }; }
  for (const f of bubbleQ) f();
}
function render(t) {
  renderWorld(t);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(off, 0, 0, LW, LH, 0, 0, cv.width, cv.height);
  drawOverlay();
}

// ============================================================== side panel (HTML)
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const money = (v, d = 2) => (v == null || isNaN(v) ? "-" : (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const sgn = (v, d = 2) => (v == null || isNaN(v) ? "-" : (v >= 0 ? "+" : "-") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v, d = 2) => (v == null || isNaN(v) ? "-" : (v >= 0 ? "+" : "") + (v * 100).toFixed(d) + "%");
const cls = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
const hhmm = (ts) => { try { return new Date(ts).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { return "--:--"; } };
function statusBadge(id) {
  const b = bot(id), c = chars[id];
  if (id === "indy") return `<span class="badge b-hold">HOLDING SPY</span>`;
  if (RI[id]) return c.hidden ? `<span class="badge b-home">DOWNSTAIRS</span>` : `<span class="badge b-act" style="color:${RI_TAG};border-color:${RI_TAG}">ON THE FLOOR</span>`;
  if (!b) return c.hidden ? `<span class="badge b-home">HOME</span>` : `<span class="badge b-act">ON DUTY</span>`;
  if (b.status === "benched") return `<span class="badge b-bench">BENCHED</span>`;
  if (b.status === "no edge") return `<span class="badge b-bench">NO EDGE</span>`;
  if (b.status === "unqualified") return `<span class="badge b-bench">UNQUALIFIED</span>`;
  if (deskSittingOut(DESK_OF[id])) return `<span class="badge b-sit">SITTING OUT</span>`;
  return mktStatus() === "open" ? `<span class="badge b-trade">TRADING</span>` : `<span class="badge b-act">QUALIFIED</span>`;
}
function whereIs(id) {
  const c = chars[id];
  if (c.hidden && RI[id]) return riQueue[id].length ? "on the way up" : "downstairs at Research Inc.";
  if (c.hidden) return "gone home";
  if (c.moving || c.path.length) return "walking" + (c.task && c.task.label ? ": " + c.task.label : "");
  const h = home(id);
  if (atSpot(c, h) && TRADERS.includes(id) && h.key.startsWith("chair")) {
    return "at the swing desk";
  }
  return areaOf(c.tx, c.ty);
}
const ROLE_SHORT = { scoop: "Research Inc. · News Desk", tape: "Research Inc. · Markets Desk", beats: "Research Inc. · Earnings & IPO Desk",
  sage: "Research Inc. · Analyst Desk", proof: "Research Inc. · Quality Desk", grok: "boss / risk manager", goldie: "front desk, award judge", pixel: "market data", knobs: "R&D self-tuner", indy: "SPY benchmark",
  dash: "laid off", vee: "laid off", zip: "swing: 52-week-high leaders", snap: "laid off",
  trek: "swing: 20d breakout trend", dip: "swing: RSI2 pullback", rota: "swing: relative-strength rotation",
  drift: "swing: post-earnings drift", owl: "swing: overnight SPY/QQQ close-to-open",
  snapback: "candidate: IBS reversion on index/sector ETFs", payday: "candidate: turn-of-the-month SPY" };
function botPnl(id) {
  if (id === "indy") { const a = S.accounts.bench; return a ? a.pnl_today : null; }
  const b = bot(id); if (b) return b.pnl_today;
  const lb = (S.awards && S.awards.week && S.awards.week.leaderboard) || []; const r = lb.find((x) => x.bot === id); return r ? r.score : null;
}

function dayAcctLive() {
  const d = S && S.accounts && S.accounts.day;
  if (!d || d.merged || d.retired) return null;
  return (+d.equity || 0) > 0.5 ? d : null;   // ignore $0 / missing day after the merge
}
function swingEquity() {
  const sw = (S && S.accounts && S.accounts.swing) || {};
  const d = dayAcctLive();
  return d ? (+d.equity || 0) + (+sw.equity || 0) : (+sw.equity || 0);
}
function swingWeekPnl() {
  const sw = (S && S.accounts && S.accounts.swing) || {};
  const d = dayAcctLive();
  const w = (a) => (a && a.week ? +a.week.week_pnl || 0 : 0);
  return d ? w(d) + w(sw) : w(sw);
}
function swingTodayPnl() {
  const sw = (S && S.accounts && S.accounts.swing) || {};
  const d = dayAcctLive();
  return d ? (+d.pnl_today || 0) + (+sw.pnl_today || 0) : (+sw.pnl_today || 0);
}
function sparkCanvas(el, curve) {
  const c = el.getContext("2d"), dpr = DPR, w = el.clientWidth * dpr, h = el.clientHeight * dpr;
  el.width = w; el.height = h; c.clearRect(0, 0, w, h);
  if (!curve || curve.length < 2) { c.fillStyle = "#56645b"; c.font = `${10 * dpr}px monospace`; c.fillText("equity curve fills in while the market is open", 6 * dpr, h / 2 + 3 * dpr); return; }
  const series = [["swing", "#52b788"], ["bench", "#4f8cff"]];
  let mn = 1e9, mx = -1e9;
  const rel = {};
  for (const [k] of series) { const b0 = curve[0][k] || 1; rel[k] = curve.map((p) => (p[k] / b0 - 1) * 100); for (const v of rel[k]) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
  mn = Math.min(mn, 0); mx = Math.max(mx, 0); const rg = mx - mn || 1;
  const y0 = h - 4 * dpr - ((0 - mn) / rg) * (h - 8 * dpr);
  c.strokeStyle = "#2a3a31"; c.setLineDash([3 * dpr, 3 * dpr]); c.beginPath(); c.moveTo(0, y0); c.lineTo(w, y0); c.stroke(); c.setLineDash([]);
  for (const [k, col] of series) {
    c.strokeStyle = col; c.lineWidth = 1.5 * dpr; c.beginPath();
    rel[k].forEach((v, i) => { const x = (i / (rel[k].length - 1)) * (w - 4 * dpr) + 2 * dpr, y = h - 4 * dpr - ((v - mn) / rg) * (h - 8 * dpr); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
  }
  c.font = `${9 * dpr}px monospace`; c.fillStyle = "#52b788"; c.fillText("SWING", 4 * dpr, 10 * dpr); c.fillStyle = "#4f8cff"; c.fillText("SPY", 40 * dpr, 10 * dpr);
}
function countdown() {
  const fc = S && S.week && S.week.friday_close; if (!fc) return "";
  let s = Math.max(0, (new Date(fc).getTime() - Date.now()) / 1000);
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60);
  return `FRI CLOSE IN ${d ? d + "D " : ""}${h}H ${String(m).padStart(2, "0")}M`;
}
// core-satellite (2026-10-10): idle cash sits in one index ETF ("CORE QQQ"); display only
function coreHtml(a) {
  const c = a && a.core;
  if (!c) return "";
  const ct = a.contrib || {}, wk = a.week || {};
  const trend = c.trend_on == null ? "trend check at the open" : c.trend_on ? `trend ON (${esc(c.symbol)} above ${c.trend_sma}-day avg)` : `trend OFF: in cash (${esc(c.symbol)} below ${c.trend_sma}-day avg)`;
  return `<div class="grid2">
        <div class="kv"><span>${esc(c.label || "CORE")}</span><b>${money(c.value || 0, 0)} (${((c.weight || 0) * 100).toFixed(0)}%)</b></div><div class="kv"><span>CORE P&amp;L</span><b class="${cls(c.pnl_total || 0)}">${sgn(c.pnl_total || 0)}</b></div>
        <div class="kv"><span>STRATEGIES P&amp;L</span><b class="${cls(ct.strategies || 0)}">${sgn(ct.strategies || 0)}</b></div><div class="kv"><span>STRAT WEEK</span><b class="${cls(+wk.week_pnl || 0)}">${sgn(+wk.week_pnl || 0)}</b></div>
      </div>
      <div class="gate">CORE ${esc(c.symbol)}: ${c.qty ? "holding " + (+c.qty).toFixed(2) + " sh" : "no shares yet" + (c.trades ? "" : " (first buy at the next open)")} · ${trend} · in trades ${money(c.strategy_value || 0, 0)} · cash ${money(c.cash || 0, 0)} · weekly rule = strategies only</div>`;
}
function renderPanel() {
  if (!S) return;
  const A = S.accounts, bench = A.bench;
  const nav = (A.day ? A.day.equity : 0) + (A.swing ? A.swing.equity : 0);
  const dpl = (A.day ? A.day.pnl_today : 0) + (A.swing ? A.swing.pnl_today : 0);
  const wkB = (a) => (a && a.week ? (a.week.book_week_pnl != null ? +a.week.book_week_pnl : +a.week.week_pnl || 0) : 0);   // book = strategies + core
  const wpl = wkB(A.day) + wkB(A.swing);
  $("nav").textContent = money(nav); $("dpl").textContent = sgn(dpl); $("dpl").className = cls(dpl); $("wpl").textContent = sgn(wpl); $("wpl").className = cls(wpl);
  const st = mktStatus();
  refreshMktPill();
  // ticker
  const tk = (S.tickers || []).map((x) => `<span>${esc(x.symbol)} ${x.price.toFixed(2)} <b class="${cls(x.chg_pct)}">${x.chg_pct >= 0 ? "▲" : "▼"}${Math.abs(x.chg_pct * 100).toFixed(2)}%</b></span>`).join("");
  const ti = $("tickInner"); if (ti.dataset.k !== tk) { ti.innerHTML = tk || "no quotes yet"; ti.dataset.k = tk; ti.style.animationDuration = Math.max(30, (S.tickers || []).length * 3.2) + "s"; }
  // one Swing Desk card (swing book; sum day+swing only while day still holds equity)
  let h = "";
  {
    const a = A.swing || {}, day = dayAcctLive(), wk = a.week || {}, gate = a.gate, al = a.allocator || {};
    const eq = swingEquity(), today = swingTodayPnl(), weekP = swingWeekPnl();
    const weekB = wk.book_week_pnl != null ? +wk.book_week_pnl : weekP;   // whole book incl. the core
    const monBase = wk.book_baseline != null ? +wk.book_baseline : wk.baseline != null ? +wk.baseline : (day ? null : eq - weekP);
    const vsSpy = (a.pnl_total || 0) + (day ? (day.pnl_total || 0) : 0) - (bench.pnl_total || 0);
    const sit = gate && gate.sit_out;
    const hiring = LAID_OFF.size > 0;
    const stBadge = st !== "open" ? `<span class="badge b-home">${st === "pre-market" ? "PRE-MARKET" : "MARKET CLOSED"}</span>` : sit ? `<span class="badge b-sit">SITTING OUT</span>` : a.halted ? `<span class="badge b-bench">HALTED</span>` : hiring ? `<span class="badge b-sit">HIRING</span>` : `<span class="badge b-trade">TRADING</span>`;
    const swingIds = TRADERS.filter((x) => DESK_OF[x] === "swing" && bot(x));
    const onDesk = swingIds.filter((x) => bot(x).status === "active").map((x) => bot(x).name || DISP(x));
    const nBench = swingIds.filter((x) => BENCHED.has(bot(x).status)).length;
    const who = esc(onDesk.join(" · ")) + (nBench ? ` <span class="mut">(${nBench} in the break room)</span>` : "") + (hiring ? " · Now hiring" : "");
    const posN = ((a.positions || []).length) + (day && day.positions ? day.positions.length : 0);
    const trades = (a.trades_today || 0) + (day ? (day.trades_today || 0) : 0);
    const todayPct = eq ? today / eq : 0;
    h += `<div class="desk"><h4><span>SWING DESK <span class="mut">(${who})</span></span>${stBadge}</h4>
      <div class="grid2">
        <div class="kv"><span>EQUITY</span><b>${money(eq)}</b></div><div class="kv"><span>TODAY</span><b class="${cls(today)}">${sgn(today)} (${pct(todayPct)})</b></div>
        <div class="kv"><span>WEEK vs MON</span><b class="${cls(weekB)}">${sgn(weekB)}</b></div><div class="kv"><span>MON BASE</span><b>${monBase != null ? money(monBase, 0) : "-"}</b></div>
        <div class="kv"><span>vs SPY</span><b class="${cls(vsSpy)}">${sgn(vsSpy)}</b></div><div class="kv"><span>GUARD</span><b>${esc(wk.mode || "-")}</b></div>
        <div class="kv"><span>POSITIONS</span><b>${posN}/${al.max_positions || "-"}</b></div><div class="kv"><span>TRADES TODAY</span><b>${trades}</b></div>
        <div class="kv"><span>OPEN RISK</span><b>${money(al.open_risk || 0, 0)} / ${money((al.max_open_risk_pct || 0) * (a.equity || eq || 0), 0)}</b></div><div class="kv"><span>SLOTS/BOT</span><b>${al.active && al.active.length ? al.slots_per_bot + " × " + al.active.length + " active" : "none active"}</b></div>
      </div>
      ${coreHtml(a)}
      <div class="gate">${sit ? "Sitting out: " + esc(gate.reason) : gate ? "Gate open" + (gate.at ? " since " + esc(gate.at) : "") : "Gate decides at the next open"}${wk.floor ? " · floor " + money(wk.floor, 0) : ""}${hiring ? " · " + LAID_OFF.size + " seats open (Now Hiring)" : ""}</div></div>`;
  }
  h += `<div class="desk"><h4><span>INDY · SPY BENCHMARK</span><span class="badge b-hold">BUY &amp; HOLD</span></h4><div class="grid2"><div class="kv"><span>EQUITY</span><b>${money(bench.equity)}</b></div><div class="kv"><span>TOTAL</span><b class="${cls(bench.pnl_total)}">${sgn(bench.pnl_total)}</b></div></div></div>`;
  const IN = S.interest;
  if (IN && IN.enabled) {
    const t = IN.today || {}, w = IN.week || {}, td = (t.day || 0) + (t.swing || 0), wd = (w.day || 0) + (w.swing || 0);
    h += `<div class="gate">CASH INTEREST ${(IN.apy * 100).toFixed(1)}% APY on idle cash · today ${sgn(td)} · week ${sgn(wd)}</div>`;
  }
  const RS = S.research;
  if (RS) h += `<div class="gate">RESEARCH FILTER: ${RS.live ? "live" : "off (" + esc(RS.status || "-") + ")"}${RS.live && RS.avoid && RS.avoid.length ? " · avoid " + esc(RS.avoid.join(", ")) : ""}${RS.live && RS.macro && RS.macro.length ? " · " + esc(RS.macro.map((m) => m.event + (m.time ? " " + m.time : "")).join(", ")) : ""}</div>`;
  h += `<canvas class="spark" id="spark"></canvas><div class="gate">${esc(countdown())} · regime ${S.regime ? (S.regime.block ? "BLOCK" : "x" + S.regime.mult) : "-"}${S.regime && S.regime.reasons && S.regime.reasons.length ? " (" + esc(S.regime.reasons.join("; ")) + ")" : ""}</div>`;
  $("desks").innerHTML = h; sparkCanvas($("spark"), S.curve);
  $("c-desks").textContent = st.toUpperCase();
  $("fri").textContent = countdown();
  // squawk
  const items = [];
  for (const e of S.events || []) items.push({ ts: e.ts, bot: e.bot, msg: e.msg, typ: e.type });
  for (const t of S.trades || []) items.push({ ts: t.ts, bot: t.bot, msg: `${t.side} ${t.symbol} x${+t.qty.toFixed(3)} @ ${t.price.toFixed(2)}${t.pnl != null ? " " + sgn(t.pnl) : ""} · ${t.reason}`, typ: "trade", pnl: t.pnl });
  for (const a of ambient) items.push({ ts: a.t.toISOString(), bot: a.bot, msg: a.msg, amb: 1 });
  for (const r of riFeed) items.push({ ts: r.ts, bot: r.who, msg: `[RESEARCH INC] ${r.type} -> ${CAST[r.to] ? DISP(r.to) : r.to}${r.note ? ": " + r.note : ""}` });
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  $("squawk").innerHTML = items.slice(0, 28).map((x) => `<div class="sq${x.amb ? " amb" : ""}"><span class="t">${hhmm(x.ts)}</span><span class="w" style="color:${COL[x.bot] || "#ccc"}">${esc(DISP(x.bot))}</span><span class="m ${x.pnl != null ? cls(x.pnl) : ""}">${esc(x.msg)}</span></div>`).join("") || `<div class="mut">quiet so far</div>`;
  $("c-squawk").textContent = items.length;
  // roster
  $("roster").innerHTML = ORDER.map((id) => {
    const b = bot(id), pnl = botPnl(id), w = b && b.watch && b.watch.length ? b.watch.slice(0, 4).join(" ") : "";
    return `<div class="row" data-bot="${id}" style="cursor:pointer"><span class="sw" style="background:${COL[id]}"></span><span class="nm">${esc(DISP(id))}</span>
      <span class="grow"><span class="mut">${esc(LAID_OFF.has(id) ? "laid off" : (ROLE_SHORT[id] || ""))}${id === "pixel" && S && S.data_source ? " · " + esc(S.data_source) : ""}</span><br>${LAID_OFF.has(id) ? `<span class="badge b-bench">LAID OFF</span>` : statusBadge(id)} <span class="mut">${LAID_OFF.has(id) ? "not on the floor" : esc(whereIs(id))}</span>${w ? ` <span class="watch">◎ ${esc(w)}</span>` : ""}</span>
      <span class="r ${cls(pnl)}">${pnl == null ? "" : sgn(pnl)}<br><span class="mut">${b && TRADERS.includes(id) ? b.wins + "W/" + b.losses + "L" : id === "indy" ? "today" : "wk score"}</span></span></div>`;
  }).join("");
  $("c-roster").textContent = ORDER.filter((id) => !chars[id].hidden).length + " in office";
  // positions + watchlist
  const pos = [];
  for (const d of ["day", "swing", "bench"]) for (const p of (A[d] && A[d].positions) || []) pos.push(Object.assign({ desk: d }, p));
  let ph = pos.length ? `<table><tr><th>SYM</th><th>BOT</th><th class="n">QTY</th><th class="n">ENTRY</th><th class="n">LAST</th><th class="n">P&amp;L</th><th class="n">STOP</th></tr>` +
    pos.map((p) => `<tr><td><b>${esc(p.symbol)}</b></td><td style="color:${COL[p.bot] || "#ccc"}">${esc(DISP(p.bot || (p.desk === "bench" ? "indy" : "?")))}</td><td class="n">${+(+p.qty).toFixed(2)}</td><td class="n">${p.entry.toFixed(2)}</td><td class="n">${p.last.toFixed(2)}</td><td class="n ${cls(p.upl)}">${sgn(p.upl)}</td><td class="n">${p.stop ? p.stop.toFixed(2) : "-"}</td></tr>`).join("") + "</table>" : `<div class="mut">no open positions</div>`;
  ph += `<div style="margin-top:6px;color:var(--gold);font-weight:800;letter-spacing:.08em">WATCHING / TARGETING</div>`;
  ph += TRADERS.map((id) => { const b = bot(id); const w = (b && b.watch) || []; return `<div class="row"><span class="sw" style="background:${COL[id]}"></span><span class="nm">${DISP(id)}</span><span class="grow watch">${w.length ? esc(w.join(" ")) : '<span class="mut">nothing close to a setup</span>'}</span><span class="r mut">${b && b.slots ? b.slots + " slot" + (b.slots > 1 ? "s" : "") : "no slot"}</span></div>`; }).join("");
  $("pos").innerHTML = ph; $("c-pos").textContent = pos.length + " open";
  // trades
  const tr = (S.trades || []).slice(-14).reverse();
  $("trades").innerHTML = tr.length ? `<table><tr><th>TIME</th><th>BOT</th><th></th><th>SYM</th><th class="n">PX</th><th class="n">P&amp;L</th></tr>` + tr.map((t) => `<tr title="${esc(t.reason)}"><td class="mut">${hhmm(t.ts)}</td><td style="color:${COL[t.bot] || "#ccc"}">${esc(DISP(t.bot))}</td><td class="${t.side === "BUY" ? "up" : "dn"}">${t.side}</td><td><b>${esc(t.symbol)}</b></td><td class="n">${t.price.toFixed(2)}</td><td class="n ${cls(t.pnl)}">${t.pnl == null ? "" : sgn(t.pnl)}</td></tr>`).join("") + "</table>" : `<div class="mut">no trades yet</div>`;
  $("c-trades").textContent = (S.trades || []).length;
  // awards
  const aw = S.awards || {};
  const board = (b, gold) => ((b && b.leaderboard) || []).slice(0, 12).map((r, i) => `<div class="row" title="${esc(r.detail)}"><span class="rank">${i + 1}</span>${i === 0 && r.score > 0 ? `<span class="medal ${gold ? "g" : "s"}"></span>` : ""}<span class="nm" style="color:${COL[r.bot] || "#ccc"}">${esc(DISP(r.bot))}</span><span class="grow mut">${esc(r.detail || "")}</span><span class="r ${cls(r.score)}">${sgn(r.score)}</span></div>`).join("");
  let ah = `<div style="font-weight:800;color:var(--silver)"><span class="medal s"></span>EMPLOYEE OF THE WEEK ${esc(aw.week && aw.week.period || "")} ${aw.week && aw.week.final ? "(FINAL)" : "(live)"}</div>${board(aw.week, false)}`;
  ah += `<div style="font-weight:800;color:var(--gold);margin-top:8px"><span class="medal g"></span>EMPLOYEE OF THE MONTH ${esc(aw.month && aw.month.period || "")} ${aw.month && aw.month.final ? "(FINAL)" : "(month to date)"}</div>${board(aw.month, true)}`;
  const lw = aw.last_week, lm = aw.last_month;
  ah += `<div class="gate">Last silver: ${lw ? esc(lw.winner ? DISP(lw.winner) + " " + sgn(+lw.score) + " (" + lw.period + ")" : lw.name) : "none yet (first after Fri close)"} · Last gold: ${lm ? esc(lm.winner ? DISP(lm.winner) + " " + sgn(+lm.score) + " (" + lm.period + ")" : lm.name) : "none yet (first after Oct 30 close)"}</div>`;
  ah += `<div style="margin-top:6px;color:var(--gold);font-weight:800">HALL OF FAME <span class="mut">(monthly winners only)</span></div><div class="hof">${(aw.hall || []).map((x) => `<span>${esc(x.period)} ${esc(x.winner ? DISP(x.winner) : x.name)}</span>`).join("") || '<span class="mut" style="border:0;background:none">empty until the first gold</span>'}</div>`;
  ah += `<div class="gate">Judge: Goldie. Score = dollars each bot added this week; silver weekly plaque, gold monthly portrait.</div>`;
  $("awards").innerHTML = ah;
  // R&D
  const tu = S.tuning || {};
  let rh = `<div class="gate">Last run ${tu.last_run ? esc(hhmm(tu.last_run)) + " " + esc((tu.last_run || "").slice(0, 10)) : "never"} (${esc(tu.last_mode || "-")})${tu.running ? " · <b class='up'>RUNNING</b>" : ""}</div><table><tr><th>BOT</th><th>QUALIFIED</th><th>NOTE</th></tr>`;
  rh += TRADERS.map((id) => { const r = (tu.results || {})[id] || {}; return `<tr><td style="color:${COL[id]}">${DISP(id)}</td><td class="${r.qualifies ? "up" : "dn"}">${r.qualifies ? "YES" : r.qualifies === false ? "NO" : "NOT RUN"}</td><td class="mut" style="white-space:normal">${esc((r.reason || "").slice(0, 90))}</td></tr>`; }).join("") + "</table>";
  const rc = tu.recent_changes || [];
  rh += `<div style="margin-top:6px;color:var(--gold);font-weight:800">RECENT CHANGES</div>` + (rc.length ? rc.slice().reverse().map((c) => `<div class="sq"><span class="t">${esc((c.ts || "").slice(5, 10))}</span><span class="w" style="color:${COL[c.bot]}">${DISP(c.bot)}</span><span class="m">${esc(c.param)} ${esc(c.old)} → ${esc(c.new)}</span></div>`).join("") : `<div class="mut">none</div>`);
  $("rd").innerHTML = rh;
  $("upd").textContent = "engine state " + (S.updated_et || "");
  if (selected) showCard(selected, true);
}

// ============================================================== info card
function showCard(id, refresh) {
  if (id === "research") return goB1();
  if (!S) return;
  const card = $("card"), body = $("cardBody");
  let h = "";
  if (CAST[id]) {
    const b = bot(id), lb = (S.awards && S.awards.week && S.awards.week.leaderboard) || [], r = lb.find((x) => x.bot === id);
    const mr = ((S.awards && S.awards.month && S.awards.month.leaderboard) || []).find((x) => x.bot === id);
    h += `<h3 style="color:${shade(COL[id], 0.6)}">${esc(DISP(id))}</h3><div class="mut">${esc(LAID_OFF.has(id) ? (ROLE_SHORT[id] || "") : ((b && b.role) || ROLE_SHORT[id]))}</div>`;
    h += `<div style="margin:4px 0">${statusBadge(id).replace("badge", "badge")} &middot; ${esc(whereIs(id))}</div>`;
    if (b && TRADERS.includes(id)) {
      h += `<div>Strategy: <b>${esc(b.strategy)}</b> · desk ${esc(b.desk)} · ${b.slots ? b.slots + " slot(s)" : "no slot (not trading)"}</div>`;
      h += `<div>Today ${sgn(b.pnl_today)} · realized ${sgn(b.realized)} · ${b.wins}W/${b.losses}L · streak ${b.streak}</div>`;
      if (b.bench_reason) h += `<div>Benched: ${esc(b.bench_reason)}</div>`;
      const q = (S.tuning && S.tuning.results && S.tuning.results[id]) || {};
      h += `<div class="mut">Tuner: ${q.qualifies ? "qualified" : "not qualified"} - ${esc((q.reason || "never run").slice(0, 110))}</div>`;
      h += `<div>Watching: ${b.watch && b.watch.length ? esc(b.watch.join(" ")) : '<span class="mut">nothing close</span>'}</div>`;
      if (b.positions && b.positions.length) h += `<table><tr><th>SYM</th><th>QTY</th><th>ENTRY</th><th>LAST</th><th>P&amp;L</th></tr>` + b.positions.map((p) => `<tr><td>${esc(p.symbol)}</td><td>${p.qty}</td><td>${p.entry}</td><td>${p.last}</td><td class="${cls(p.upl)}">${sgn(p.upl)}</td></tr>`).join("") + "</table>";
      if (b.last_trade) h += `<div class="mut">Last: ${esc(b.last_trade.side)} ${esc(b.last_trade.symbol)} @ ${b.last_trade.price} (${esc(b.last_trade.reason)})</div>`;
    } else if (id === "grok") {
      h += `<div>Mood: <b>${esc(S.boss.mood)}</b>${S.boss.below_baseline.length ? " · below Monday: " + esc(S.boss.below_baseline.join(", ")) : ""}${S.boss.green.length ? " · green: " + esc(S.boss.green.join(", ")) : ""}</div><div class="mut">Runs the weekly capital-protection rule, the daily sit-out gate and the desk allocator (one bot per symbol, slots split, open-risk cap).</div>`;
    } else if (id === "goldie") {
      h += `<div class="mut">Judge of Employee of the Week (silver) and Month (gold). Not eligible herself.</div>`;
    } else if (id === "pixel") {
      const f = S.feed || {}; h += `<div>Feed: <b class="${f.ok === false ? "dn" : "up"}">${f.ok === false ? "FAILING" : "OK"}</b> · ${esc(f.source)}${S.data_source ? " · data source: <b>" + esc(S.data_source) + "</b>" : ""} · last fetch ${esc(hhmm(f.last_fetch))}${f.data_age_min != null ? " · bars " + f.data_age_min + " min old" : ""}</div>${f.last_error ? `<div class="mut">${esc(f.last_error)}</div>` : ""}`;
    } else if (id === "knobs") {
      const tu = S.tuning || {}; h += `<div>Tuner ${tu.running ? "<b class='up'>running</b>" : "idle"} · last ${esc((tu.last_run || "never").slice(0, 16))} (${esc(tu.last_mode || "-")})</div>`;
    } else if (id === "indy") {
      const a = S.accounts.bench; h += `<div>SPY buy &amp; hold: ${money(a.equity)} (${sgn(a.pnl_total)} total, ${sgn(a.pnl_today)} today)</div>`;
    } else if (RI[id]) {
      const last = riFeed.slice().reverse().find((r) => r.group.includes(id));
      h += `<div><b style="color:#00838f">Research Inc.</b> (one floor below) · ${esc(RI[id].desk)}</div>` + (last ? `<div class="mut">Last: ${esc(hhmm(last.ts))} ${esc(last.type)} → ${esc(DISP(last.to))}${last.note ? ": " + esc(last.note) : ""}</div>` : `<div class="mut">No visits yet this session.</div>`);
    }
    if (r) h += `<div style="margin-top:4px"><span class="medal s"></span>Week score <b class="${cls(r.score)}">${sgn(r.score)}</b> <span class="mut">${esc(r.detail)}</span></div>`;
    if (mr) h += `<div><span class="medal g"></span>Month score <b class="${cls(mr.score)}">${sgn(mr.score)}</b></div>`;
  } else if (id === "research") {
    h += `<h3 style="color:#00838f">RESEARCH INC. (FLOOR BELOW)</h3><div class="mut">Market research for El Jefe: news, markets, earnings &amp; IPOs, analysis, quality. Staff come up these stairs to deliver research.</div>` +
      RI_IDS.map((r) => `<div><b style="color:${shade(COL[r], 0.6)}">${esc(DISP(r))}</b> ${esc(RI[r].desk)} · ${esc(whereIs(r))}</div>`).join("");
  } else if (id === "awardwall") {
    const w = winners();
    h += `<h3>AWARD WALL</h3><div><span class="medal s"></span>Employee of the Week: <b>${w.week ? esc(DISP(w.week.winner)) + " " + sgn(+w.week.score) + " (" + esc(w.week.period) + ")" : "not awarded yet"}</b></div><div><span class="medal g"></span>Employee of the Month: <b>${w.month ? esc(DISP(w.month.winner)) + " " + sgn(+w.month.score) + " (" + esc(w.month.period) + ")" : "first gold after the Oct 30 close"}</b></div><div class="mut">Hall of Fame (monthly only): ${((S.awards && S.awards.hall) || []).map((x) => esc(x.period + " " + DISP(x.winner))).join(", ") || "empty"}</div>`;
  } else if (id === "whiteboard") {
    const rc = (S.tuning && S.tuning.recent_changes) || [];
    h += `<h3>R&amp;D WHITEBOARD</h3>` + (rc.length ? rc.slice().reverse().map((c) => `<div>${esc((c.ts || "").slice(5, 16))} ${esc(DISP(c.bot))}: ${esc(c.param)} ${esc(c.old)} → ${esc(c.new)}</div>`).join("") : "<div class='mut'>no changes yet</div>");
  } else if (id === "day" || id === "swing") {
    const a = (S.accounts && S.accounts.swing) || {}, gt = a.gate;
    h += `<h3>SWING DESK</h3><div>Equity ${money(swingEquity())} · today ${sgn(swingTodayPnl())} · week ${sgn(swingWeekPnl())}</div><div>${gt && gt.sit_out ? "Sitting out: " + esc(gt.reason) : "Gate open"}</div><div class="mut">${esc(TRADERS.filter((x) => DESK_OF[x] === "swing" && bot(x) && bot(x).status === "active").map((x) => bot(x).name || DISP(x)).join(" · "))} · Now hiring</div>`;
  }
  if (!h) return;
  body.innerHTML = h; card.classList.remove("hidden");
  if (!refresh) selected = CAST[id] ? id : null;
}
$("cardX").onclick = () => { $("card").classList.add("hidden"); selected = null; };
const HOT = [ { id: "awardwall", x: 19 * TS, y: 7 * TS, w: 6 * TS, h: 2 * TS }, { id: "whiteboard", x: 15 * TS, y: 0, w: 4 * TS, h: 3 * TS },
  { id: "swing", x: 12 * TS - 10, y: 4 * TS, w: 36, h: 2 * TS } ];
HOT.push({ id: "research", x: 15 * TS, y: 16 * TS, w: 3 * TS, h: 2 * TS });
cv.addEventListener("click", (ev) => {
  const r = cv.getBoundingClientRect();
  const lx = (ev.clientX - r.left) * (cv.width / r.width) / SC, ly = (ev.clientY - r.top) * (cv.height / r.height) / SC;
  let best = null;
  for (const id of ORDER) { const c = chars[id]; if (c.hidden) continue; if (lx >= c.x - 9 && lx <= c.x + 9 && ly >= c.y - 22 && ly <= c.y + 8) if (!best || c.y > best.y) best = c; }
  if (best) return showCard(best.id);
  for (const h of HOT) if (lx >= h.x && lx <= h.x + h.w && ly >= h.y && ly <= h.y + h.h) return showCard(h.id);
  $("card").classList.add("hidden"); selected = null;
});
$("roster").addEventListener("click", (ev) => { const r = ev.target.closest("[data-bot]"); if (r) showCard(r.dataset.bot); });
$("zoomBtn").onclick = () => { ZOOM = ZOOM > 1 ? 1 : 1.7; $("floorWrap").classList.toggle("zoomed", ZOOM > 1); layout(); if (ZOOM > 1) { const w = $("floorWrap"); w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2; } };

// ============================================================== polling + main loop
let pollFails = 0;
async function poll() {
  try {
    const r = await fetch("state.json?ts=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const prev = S; S = await r.json(); pollFails = 0;
    if (!prev) initialPlace();
    processState(prev);
    renderPanel();
  } catch (e) { pollFails++; if (pollFails === 3) $("upd").textContent = "waiting for the engine..."; }
}
let _mktPillAt = 0;
function clockTick() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date());
  $("clock").textContent = p + " ET";
  if (S) $("fri").textContent = countdown();
  const now = Date.now();
  if (now - _mktPillAt >= 30000) { _mktPillAt = now; refreshMktPill(); }
  refreshAge();
}
// "updated X min ago" chip next to the market pill (display only): age of the engine's last state write.
function refreshAge() {
  const el = $("age"); if (!el) return;
  const t = S && Date.parse(S.updated || "");
  if (!t) { el.textContent = pollFails >= 3 ? "no data yet" : "loading..."; el.className = "age"; return; }
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  const txt = m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 2880 ? Math.floor(m / 60) + "h " + (m % 60) + "m ago" : Math.floor(m / 1440) + " days ago";
  el.textContent = "updated " + txt;
  const lim = (typeof mktStatus === "function" && mktStatus() === "open") ? 12 : 45;
  el.className = "age" + (m >= lim ? " stale" : "");
  el.title = "Engine data as of " + (S.updated_et || "") + (STATIC_HOST ? ". This always-on copy refreshes every few minutes while the engine is running; the live link is real-time." : "");
}
let lastFrame = performance.now(), acc = 0, rendered = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000); lastFrame = now;
  if (S && !STRESS) { acc += dt; while (acc >= 1 / 30) { step(1 / 30); acc -= 1 / 30; } }
  if (now - rendered > 32) { rendered = now; render(T); }
  requestAnimationFrame(loop);
}
addEventListener("resize", layout);
addEventListener("orientationchange", () => setTimeout(layout, 200));
if (matchMedia("(max-width:759px), (max-aspect-ratio:1/1)").matches) for (const id of ["s-roster", "s-pos", "s-trades", "s-awards"]) $(id).open = false;
layout(); clockTick(); setInterval(clockTick, 1000);
poll(); setInterval(poll, STATIC_HOST ? 45000 : 3000);
// ---- Research Inc. event feed (GET /research_events.json every 5 s; recent unplayed events replay once on load)
const RI_REPLAY_H = 3, RI_REPLAY_MAX = 4;
let riLastId = null;
const riStore = { get() { try { return +localStorage.getItem("riPlayedId") || 0; } catch (e) { return 0; } }, set(v) { try { localStorage.setItem("riPlayedId", String(v)); } catch (e) { /* private mode */ } } };
async function pollRI() {
  try {
    const r = await fetch("research_events.json?ts=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const evs = ((await r.json()).events || []).map((e, i, a) => Object.assign({}, e, { id: e.id != null ? +e.id : (i ? +(a[i - 1].id || 0) + 0.01 : 0.01) }));
    const maxId = evs.reduce((m, e) => Math.max(m, e.id), 0);
    if (riLastId === null) {                      // first load: replay recent events this browser hasn't played
      let played = riStore.get(); if (played > maxId) played = 0;   // file was reset
      const now = Date.now();
      const fresh = evs.filter((e) => e.id > played && (now - (Date.parse(e.ts) || now)) < RI_REPLAY_H * 3600e3).slice(-RI_REPLAY_MAX);
      for (const e of fresh) riEnqueue(e);
      for (const e of evs) if (!fresh.includes(e)) riFeed.push({ ts: e.ts, who: String(e.who).split(",")[0], group: String(e.who).split(","), type: e.type, to: e.to === "desk" ? "grok" : e.to, note: e.note || "" });
      riFeed.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)); while (riFeed.length > 30) riFeed.shift();
      riLastId = maxId;
    } else {
      if (maxId < riLastId) riLastId = 0;           // file was reset
      for (const e of evs.filter((x) => x.id > riLastId).slice(-6)) riEnqueue(e);
      riLastId = Math.max(riLastId, maxId);
    }
    riStore.set(riLastId);
    renderRIPanel();
  } catch (e) { /* server without the add-on: nothing to show */ }
}
function renderRIPanel() {
  const el = $("ri"); if (!el) return;
  let h = RI_IDS.map((id) => `<div class="row" data-bot="${id}" style="cursor:pointer"><span class="sw" style="background:${COL[id]}"></span><span class="nm">${esc(DISP(id))}</span><span class="grow"><span class="mut">${esc(RI[id].desk)}</span><br>${statusBadge(id)} <span class="mut">${esc(whereIs(id))}</span></span></div>`).join("");
  const rec = riFeed.slice(-6).reverse();
  h += `<div style="margin-top:6px;color:${RI_TAG};font-weight:800;letter-spacing:.08em">LATEST DELIVERIES</div>` + (rec.length ? rec.map((r) => `<div class="sq"><span class="t">${hhmm(r.ts)}</span><span class="w" style="color:${COL[r.who] || "#ccc"}">${esc(r.group.map(DISP).join("+"))}</span><span class="m">${esc(r.type)} → ${esc(CAST[r.to] ? DISP(r.to) : r.to)}${r.note ? ": " + esc(r.note) : ""}</span></div>`).join("") : `<div class="mut">nothing yet. Staff come up the stairs (bottom of the floor) when research lands.</div>`);
  el.innerHTML = h;
  const n = RI_IDS.filter((id) => !chars[id].hidden).length; $("c-ri").textContent = n ? n + " on the floor" : "downstairs";
}
if ($("ri")) { $("ri").addEventListener("click", (ev) => { const r = ev.target.closest("[data-bot]"); if (r) showCard(r.dataset.bot); }); if (matchMedia("(max-width:759px), (max-aspect-ratio:1/1)").matches) $("s-ri").open = false; }
pollRI(); setInterval(pollRI, STATIC_HOST ? 60000 : 5000); setInterval(renderRIPanel, 2000);
requestAnimationFrame(loop);

// ============================================================== automated collision check (used by tests/check_floor.py)
window.__floor = {
  chars, blocked, seat, GW, GH, TS, SPOTS, FURN, riEnqueue, riQueue,
  violations() {
    const out = [];
    const vis = ORDER.map((id) => chars[id]).filter((c) => !c.hidden);
    for (const c of vis) {
      const tx = Math.floor(c.x / TS), ty = Math.floor(c.y / TS);
      if (tx < 0 || ty < 0 || tx >= GW || ty >= GH || blocked[I(tx, ty)]) out.push({ kind: "blocked", id: c.id, tx, ty });
    }
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 12) out.push({ kind: "overlap", a: a.id, b: b.id });
    }
    return out;
  },
  // simulate `secs` seconds of a busy trading day: market open, everyone qualified, random trades, benchings, mood swings
  stress(secs, seed) {
    rngSeed = seed || 99991;
    STRESS = 1;
    const base = JSON.parse(JSON.stringify(S));
    base.market.status = "open";
    base.bots = base.bots || {};
    for (const id of TRADERS) { base.bots[id] = base.bots[id] || { desk: DESK_OF[id], pnl: 0 }; base.bots[id].status = "active"; }
    for (const d of ["day", "swing"]) if (base.accounts[d]) base.accounts[d].gate = { sit_out: false, reason: "" };
    S = base;
    const stats = { steps: 0, samples: 0, blocked: 0, overlap: 0, examples: [], moves: 0, maxVisible: 0 };
    let tid = (S.last_trade_id || 0) + 1000, eid = (S.last_event_id || 0) + 1000;
    const lastTile = {};
    for (let k = 0; k < secs * 30; k++) {
      if (k % 90 === 0) {   // every 3 s: a random trade
        const b = pick(TRADERS); const side = rnd() < 0.5 ? "BUY" : "SELL";
        onTrade({ id: ++tid, bot: b, side, symbol: pick(["NVDA", "SPY", "AAPL", "QQQ"]), qty: 5, price: 100, pnl: side === "SELL" ? (rnd() - 0.5) * 40 : null });
      }
      if (k % 600 === 300) { const b = pick(TRADERS); S.bots[b].status = S.bots[b].status === "active" ? pick(["benched", "no edge", "unqualified"]) : "active"; onEvent({ id: ++eid, type: "bench", bot: b, msg: "x" }); }
      if (k % 900 === 450) { S.boss.mood = pick(["worried", "relaxed", "neutral"]); }
      if (k % 1800 === 900) { S.feed.ok = !S.feed.ok; }
      if (k % 2400 === 1200) { S.tuning.running = !S.tuning.running; }
      if (k % 3000 === 1500) ceremony(false);
      if (k % 700 === 350) riEnqueue({ who: rnd() < 0.25 ? "sage,beats" : pick(RI_IDS), type: pick(["deliver", "visit", "meeting"]), to: pick(["grok", "dash", "knobs", "goldie", "center", "rota", "trek", "pixel"]), note: "STRESS TEST", ts: new Date().toISOString() });
      step(1 / 30); stats.steps++;
      if (k % 3 === 0) {
        stats.samples++;
        const v = this.violations();
        for (const x of v) { stats[x.kind]++; if (stats.examples.length < 8) stats.examples.push(Object.assign({ t: +T.toFixed(2) }, x)); }
        let nvis = 0;
        for (const id of ORDER) { const c = chars[id]; if (c.hidden) continue; nvis++; const key = c.tx + "," + c.ty; if (lastTile[id] && lastTile[id] !== key) stats.moves++; lastTile[id] = key; }
        stats.maxVisible = Math.max(stats.maxVisible, nvis);
      }
    }
    STRESS = 0;
    return stats;
  },
};

// ---- Research Inc. B1: stairwell / "B1" button / footer link go down; fade back in when arriving from B1
function riFade(top, sub, start) {
  let f = document.getElementById("riFade");
  if (!f) { f = document.createElement("div"); f.id = "riFade"; f.style.cssText = "position:fixed;inset:0;z-index:80;background:#05080a;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#00e5ff;font-weight:900;letter-spacing:.15em;font-size:15px;transition:opacity .35s;pointer-events:none;text-align:center"; document.body.appendChild(f); }
  f.innerHTML = top + '<small style="color:#7fbfc8;font-size:11px;letter-spacing:.1em">' + sub + "</small>";
  f.style.opacity = start; return f;
}
function goB1(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const f = riFade("&#9660; GOING DOWN", "RESEARCH INC. &middot; B1", "0"); f.offsetWidth; f.style.opacity = "1";
  setTimeout(() => { location.href = "b1.html"; }, 500);
}
(function () {
  const b = document.getElementById("b1Btn"); if (b) b.addEventListener("click", goB1);
  const l = document.getElementById("b1Link"); if (l) l.addEventListener("click", goB1);
  let from = null; try { from = sessionStorage.getItem("floorNav"); sessionStorage.removeItem("floorNav"); } catch (e) { /* private mode */ }
  if (from === "fromB1") { const f = riFade("&#9650; TRADING FLOOR", "UP FROM RESEARCH INC. B1", "1"); setTimeout(() => { f.style.opacity = "0"; setTimeout(() => f.remove(), 400); }, 300); }
  addEventListener("pageshow", (ev) => { if (ev.persisted) { const f = document.getElementById("riFade"); if (f) f.remove(); } });
})();
