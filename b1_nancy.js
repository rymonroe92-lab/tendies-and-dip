"use strict";
/* Research Inc. B1 - NANCY'S CORNER OFFICE (additive add-on; b1.js is Research Inc.'s and is not edited).
   Loaded after b1.js. Cosmetic only, client-side, zero tokens, reads nothing new.
   - Boss's glass corner office in the bottom-right corner (the nicest spot on B1: two real walls, glass on the other two,
     big plant, rug, bookshelf). The archive cabinets that stood there move to the west side (same spots, same use).
   - Nancy mostly stays on B1: calls staff into her office, strolls to the boards/coffee now and then.
   - She goes up the stairs only for team lunch (~noon ET) and her daily meeting with El Jefe; the date-seeded schedule
     is identical to the trading floor's (social.js), so both views agree. */
(function () {
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
const dayKey = () => (window.TND && window.TND.dayKey ? window.TND.dayKey() : new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()));

// ---------------------------------------------------------------- map: move the archive west, build the corner office
const ai = FURN.findIndex((f) => f.type === "archive");
if (ai >= 0) { const a = FURN[ai]; B(a.x, a.y, a.x + a.w - 1, a.y + a.h - 1, 0); FURN.splice(ai, 1); }
F("archive", 5, 12, 4, 1);
S_("archive_1", 5, 13, "N"); S_("archive_2", 6, 13, "N"); S_("archive_3", 7, 13, "N");
// office: interior x 20..24, y 13..16 (corner = east wall + south wall); glass north wall on row 12 with a door at (21,12),
// glass west wall on column 19 (rows 13..15; the pneumatic tube at (19,16) closes it off)
F("nglassH", 19, 12, 2, 1); F("nglassH", 22, 12, 3, 1); F("nglassV", 19, 13, 1, 3);
F("ndesk", 21, 15, 2, 1); F("nshelf", 24, 13, 1, 2); F("nplant", 20, 13);
S_("chair_nancy", 21, 14, "S", "sit"); seat[I(21, 14)] = 1; CHAIRS.nancy = [21, 14];
S_("front_nancy", 22, 16, "N"); S_("visit_nancy", 23, 15, "W"); S_("ndoor", 21, 11, "S");
AREAS.unshift([20, 12, 24, 16, "Nancy's corner office"], [5, 12, 8, 13, "the archive"]);

// ---------------------------------------------------------------- cast
const PASTEL = ["#f7b8d0", "#b8d8f7", "#c8f7c5", "#f7e3b8", "#d9c2f7", "#f7c9b8"];
function look() {           // same daily look as upstairs: pastel suit (same seed), Friday jeans, pearls always
  const day = dayKey(), [y, m, d] = day.split("-").map(Number), wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const sh = PASTEL[Math.floor(fnv(day + ":nancy:s") * PASTEL.length)];
  let costume = null;
  if (m === 10) { const p = d === 31 ? 1 : d >= 24 ? 0.25 : 0.12; if (fnv(day + ":nancy:cost") < p) costume = ["witch", "pumpkin", "horns", "catears", "vampire"][Math.floor(fnv(day + ":nancy:ck") * 5)]; }
  return { shirt: sh, pants: wd === 5 ? "#3b5b8c" : sh, blazer: wd !== 5, costume };
}
CAST.nancy = { name: "NANCY", desk: "Boss · corner office", skin: "#f1d0b5", hair: "#c9a27a", shirt: "#f7b8d0", pants: "#f7b8d0", long: 1 };
COL.nancy = "#f7a8c8";
ORDER.push("nancy");
chars.nancy = { id: "nancy", tx: 0, ty: 0, x: 0, y: 0, path: [], moving: false, from: null, goal: null, task: null, face: "S", pose: "stand",
  hidden: true, wait: 0, walkT: 0, bubble: null, emote: null, emoteUntil: 0, jumpUntil: 0, nextErrand: 0, homeKey: null, speed: 3.2, trip: null, carry: false };
trips.nancy = [];
UPSTAIRS.nancy = "NANCY";

const N = {
  line: ["Oh, I just had a feeling.", "Lucky guess, dear.", "Just a hunch, sweetie.", "I simply read the newspaper. Early.",
    "Coincidence is my favorite indicator", "Pearls stay on. Risk stays off.", "Timing? I don't know what you mean.",
    "I'm a long-term investor. Ish.", "Every trade is a hunch, dear", "Perfectly timed, as usual", "Disclosure? Darling, it's paper money"],
  call: { sage: "Sage, dear? A moment, please.", beats: "Beats! Earnings chat. Now.", tape: "Tape, my office. Bring charts.",
    scoop: "Scoop, any news? Early news?", proof: "Proof, grade my hunches." },
  report: ["You rang, boss?", "Report, as asked", "Here's the macro brief", "Earnings calendar, boss", "Hunch confirmed? Kidding"],
  reply: ["Perfect. As I suspected.", "Leave it on the desk, dear.", "Hm. I already knew. Thanks!", "Wonderful. Not a word.", "Splendid. Off you go."],
  phone: ["Hello? Yes, buy. I mean, bye.", "My broker? Never heard of him.", "Tell Jefe I'll be up later"],
  up: { lunch: "Team lunch upstairs. Back soon", jefe: "Meeting with El Jefe, dears" },
  back: ["Back! Jefe sends his regards", "Lovely lunch. Back to work", "Did I miss anything? No."],
};
const _line = line;
line = function (id) { return id === "nancy" ? pick(N.line) : _line(id); };

// ---------------------------------------------------------------- schedule (shared with social.js on the trading floor)
function meetH(day) { let mt = 10 + fnv(day + ":nj") * 5.25; if (Math.abs(mt - 12.05) < 0.5) mt += 1.2; return mt; }
function upNow() {
  if (STRESS) { const k = T % 150; return k >= 60 && k < 85 ? { why: k < 72 ? "lunch" : "jefe" } : null; }
  const e = etNow(); if (e.wd === "Sat" || e.wd === "Sun") return null;
  const day = dayKey(), h = e.h, ls = 11.9 + fnv(day + ":lt") * 0.15;
  if (h >= ls + 0.02 && h < ls + 0.13) return { why: "lunch" };
  const mt = meetH(day); if (h >= mt - 0.004 && h < mt + 0.06) return { why: "jefe" };
  return null;
}

// ---------------------------------------------------------------- behaviour
function staffFree(o) { const c = chars[o]; return o !== "nancy" && !c.hidden && !c.task && !isAway(o) && !activeTrip(o) && atSpot(c, home(o)); }
function errandN(c) {
  c.nextErrand = T + (STRESS ? 4 + rnd() * 6 : 30 + rnd() * 40);
  const r = rnd();
  if (r < 0.5) {             // call someone into the office
    const free = ORDER.filter(staffFree);
    if (!free.length) return;
    const o = pick(free), sp = !spotBusy("front_nancy", o) ? SPOTS.front_nancy : !spotBusy("visit_nancy", o) ? SPOTS.visit_nancy : null;
    if (!sp) return;
    say("nancy", N.call[o] || "My office, please.", 4);
    setTask(o, [{ spot: sp, dur: 8, say: pick(N.report), onArrive: () => setTimeoutSim(() => say("nancy", pick(N.reply), 3.5), 2.4) }, { spot: home(o), dur: 0 }], "boss");
    amb(o, "is called into Nancy's office");
  } else if (r < 0.72) {     // a stroll around B1
    const k = freeSpot(["ideas_1", "ideas_2", "earn_1", "earn_2", "coffee_1", "coffee_2", "coffee_3", "huddle_3", "score_1"], "nancy");
    if (!k) return;
    setTask("nancy", [{ spot: SPOTS[k], dur: 6, say: pick(N.line) }, { spot: home("nancy"), dur: 0 }], "errand");
    amb("nancy", "strolls over to " + areaOf(SPOTS[k].x, SPOTS[k].y));
  } else say("nancy", pick(rnd() < 0.5 ? N.phone : N.line), 4);
}
function nancyDirector(c) {
  const up = upNow();
  if (c.hidden) {
    if (up) return;          // upstairs on the trading floor
    if (firstPlace) return;
    const s = SPOTS[freeSpot(STAIRS, "nancy") || "up_1"]; if (occ.has(I(s.x, s.y))) return;
    c.hidden = false; place(c, s.x, s.y); c.face = "N"; c.pose = "stand"; c.run = false;
    if (c.upWhy) { say("nancy", pick(N.back), 3.5); amb("nancy", "is back from the trading floor"); }
    c.upWhy = null; c.trip = null; setTask("nancy", [{ spot: home("nancy"), dur: 0 }], "home"); return;
  }
  if (up && !(c.task && c.task.label === "goingup")) {
    c.upWhy = up.why; c.trip = { to: up.why === "jefe" ? "grok" : "center" };
    setTask("nancy", [{ spot: SPOTS[freeSpot(STAIRS, "nancy") || "up_1"], dur: 0, say: N.up[up.why], leave: true }], "goingup");
  }
  if (c.task) return runTask(c);
  if (!atSpot(c, home("nancy"))) { setTask("nancy", [{ spot: home("nancy"), dur: 0 }], "home"); return; }
  c.pose = "sit"; c.face = "S";
  if (T >= c.nextErrand) errandN(c);
}
const _director = director;
director = function (c) { return c.id === "nancy" ? nancyDirector(c) : _director(c); };
const _initialPlace = initialPlace;
initialPlace = function () {
  _initialPlace();
  const c = chars.nancy;
  if (upNow()) { c.hidden = true; c.upWhy = upNow().why; return; }
  const s = home("nancy"); c.hidden = false; place(c, s.x, s.y); c.pose = "sit"; c.face = "S"; c.nextErrand = T + 5 + rnd() * 10;
};
const _status = status;
status = function (id) {
  if (id !== "nancy") return _status(id);
  const c = chars.nancy;
  if (c.hidden) return ["UPSTAIRS", c.upWhy === "jefe" ? "meeting El Jefe" : c.upWhy === "lunch" ? "team lunch" : "trading floor"];
  if (c.task && c.task.label === "goingup") return ["HEADING UP", c.upWhy === "jefe" ? "to El Jefe" : "to team lunch"];
  if (atSpot(c, home("nancy"))) return ["IN OFFICE", "corner office"];
  return ["ON B1", areaOf(c.tx, c.ty)];
};

// ---------------------------------------------------------------- drawing
const _drawBackground = drawBackground;
drawBackground = function () {
  _drawBackground();
  const c = gb;
  for (let y = 12; y <= 16; y++) for (let x = 19; x <= 24; x++) R(c, x * TS, y * TS, 16, 16, (x + y) % 2 ? "#2c3e46" : "#31444d");   // cover the old archive mat
  for (let y = 13; y <= 16; y++) for (let x = 20; x <= 24; x++) { R(c, x * TS, y * TS, 16, 16, (x + y) % 2 ? "#e8d9c4" : "#efe2cf"); R(c, x * TS, y * TS + 15, 16, 1, "#d6c4ab"); }   // pale oak floor
  R(c, 20 * TS + 6, 14 * TS + 2, 4 * TS - 4, 3 * TS - 6, "#c9a9d6"); R(c, 20 * TS + 8, 14 * TS + 4, 4 * TS - 8, 3 * TS - 10, "#dcc3e6");   // lilac rug
  c.strokeStyle = "#c79a3a"; c.lineWidth = 1; c.strokeRect(20 * TS + 9.5, 14 * TS + 5.5, 4 * TS - 11, 3 * TS - 13);
  R(c, 21 * TS + 2, 12 * TS + 2, 12, 12, "#c9b48a"); R(c, 21 * TS + 3, 12 * TS + 3, 10, 10, "#d9c7a0");   // door threshold
  R(c, 4 * TS + 4, 12 * TS + 4, 5 * TS - 8, 2 * TS - 6, "#3a3328");   // archive mat (new spot)
  R(c, 21 * TS - 1, (GH - 1) * TS + 4, 50, 9, "#c79a3a"); R(c, 21 * TS, (GH - 1) * TS + 5, 48, 7, "#1a2226");
  ptextC(c, "N. OFFICE", 21 * TS + 24, (GH - 1) * TS + 6, "#f7c6dc", 1);   // brass plaque on the south wall
};
bgDone = false;
DRAW.nglassH = function (f) {
  const px = f.x * TS, py = f.y * TS, w = f.w * TS;
  R(g, px, py - 6, w, 18, "rgba(200,235,255,.22)"); R(g, px, py - 6, w, 1, "#c79a3a"); R(g, px, py + 11, w, 1, "#c79a3a");
  R(g, px, py + 12, w, 3, "#8aa1ad"); for (let x = px + 3; x < px + w; x += 12) R(g, x, py - 3, 4, 1, "rgba(255,255,255,.7)");
  for (let x = px; x <= px + w; x += 16) R(g, x, py - 6, 1, 21, "#b08a35");
};
DRAW.nglassV = function (f) {
  const px = f.x * TS, py = f.y * TS, h = f.h * TS;
  R(g, px + 5, py - 6, 6, h + 4, "rgba(200,235,255,.25)"); R(g, px + 5, py - 6, 1, h + 4, "#c79a3a"); R(g, px + 10, py - 6, 1, h + 4, "#c79a3a");
  for (let y = py; y < py + h; y += 14) R(g, px + 7, y, 1, 4, "rgba(255,255,255,.7)");
};
DRAW.ndesk = function (f, t) {
  const px = f.x * TS, py = f.y * TS, c = chars.nancy;
  R(g, px + 1, py - 3, 30, 13, "#f3e1ea"); R(g, px + 1, py - 3, 30, 2, "#fff6fa"); R(g, px + 1, py + 10, 30, 5, "#c9a9bb"); R(g, px + 1, py + 10, 30, 1, "#c79a3a");
  R(g, px + 4, py - 13, 14, 10, "#2b2d42"); R(g, px + 5, py - 12, 12, 7, c.hidden ? "#0b0d14" : "#0b1f17"); R(g, px + 10, py - 3, 2, 1, "#2b2d42");
  if (!c.hidden) for (let i = 0; i < 6; i++) R(g, px + 6 + i * 2, py - 7 - i, 2, 1, "#22c55e");   // the "perfect timing" chart: only goes up
  R(g, px + 22, py, 4, 3, "#ffffff"); R(g, px + 26, py + 1, 1, 1, "#ffffff"); if (Math.floor(t * 2) % 2 && !c.hidden) R(g, px + 23, py - 3, 1, 2, "rgba(255,255,255,.6)");
  R(g, px + 20, py + 5, 8, 3, "#c79a3a"); R(g, px + 21, py + 6, 6, 1, "#7a5a12");   // brass nameplate
  if (c.hidden) { R(g, px + 13, py - 2, 11, 8, "#fff3a0"); ptextC(g, "UP", px + 19, py - 1, "#b45309", 1); }
};
DRAW.nshelf = function (f) {
  const px = f.x * TS, py = f.y * TS;
  R(g, px + 1, py - 10, 14, 40, "#6b4a2e"); R(g, px + 2, py - 9, 12, 38, "#4a3020");
  const cols = ["#c1121f", "#1d3557", "#f2c14e", "#2a9d8f", "#f7b8d0", "#6a4c93"];
  for (let s = 0; s < 4; s++) { R(g, px + 2, py - 1 + s * 9, 12, 1, "#8a6440"); for (let i = 0; i < 4; i++) R(g, px + 3 + i * 3, py - 7 + s * 9, 2, 6, cols[(s * 2 + i) % cols.length]); }
};
DRAW.nplant = function (f) { const px = f.x * TS, py = f.y * TS; R(g, px + 4, py + 6, 8, 8, "#f3e1ea"); R(g, px + 4, py + 6, 8, 1, "#c79a3a"); R(g, px + 3, py - 8, 10, 14, "#2f7d3a"); R(g, px, py - 3, 5, 6, "#3c9a48"); R(g, px + 11, py - 4, 5, 6, "#3c9a48"); R(g, px + 6, py - 11, 2, 3, "#f7a8c8"); R(g, px + 9, py - 9, 2, 2, "#f7a8c8"); };
const _drawChar = drawChar;
drawChar = function (c, t) {
  if (c.id !== "nancy") return _drawChar(c, t);
  const k = look(), base = CAST.nancy, keep = { shirt: base.shirt, pants: base.pants };
  base.shirt = k.shirt; base.pants = k.pants;
  try { _drawChar(c, t); } finally { Object.assign(base, keep); }
  const sitting = c.pose === "sit" && !c.moving && !c.path.length, fx = Math.round(c.x), fy = Math.round(c.y + (sitting ? 3 : 6)), x0 = fx - 7, top = fy - 24, face = c.face;
  if (face !== "N") {
    if (k.blazer) { R(g, x0 + 2, top + 11, 2, 7, shade(k.shirt, 0.85)); R(g, x0 + 10, top + 11, 2, 7, shade(k.shirt, 0.85)); }
    for (let i = 0; i < 5; i++) R(g, x0 + 3 + i * 2, top + 11 + (i === 0 || i === 4 ? 0 : 1), 1, 1, "#fffaf0");   // pearls
  }
  if (k.costume === "catears") { R(g, x0 + 1, top - 3, 3, 3, "#111"); R(g, x0 + 10, top - 3, 3, 3, "#111"); R(g, x0 + 2, top - 2, 1, 1, "#f9a8d4"); R(g, x0 + 11, top - 2, 1, 1, "#f9a8d4"); }
  else if (k.costume === "witch") { R(g, x0 - 2, top + 1, 18, 2, "#4c1d95"); R(g, x0 + 3, top - 4, 8, 5, "#4c1d95"); R(g, x0 + 5, top - 8, 4, 4, "#4c1d95"); }
  else if (k.costume === "pumpkin") { R(g, x0 + 1, top - 3, 12, 5, "#f97316"); R(g, x0 + 6, top - 5, 2, 2, "#15803d"); }
  else if (k.costume === "horns") { R(g, x0 + 1, top - 3, 2, 3, "#dc2626"); R(g, x0 + 11, top - 3, 2, 3, "#dc2626"); }
};
HOT.push({ id: "s-staff", x: 20 * TS, y: 12 * TS, w: 5 * TS, h: 5 * TS });
window.__b1.nancy = { upNow, meetH, look };
})();
