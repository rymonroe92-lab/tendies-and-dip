"use strict";
/* Tendies and Dip - SEASONS, HOLIDAYS & LIVING DECOR (shared by the trading floor and Research Inc. B1).
   Cosmetic only, 100% client-side, zero tokens; never writes engine state. Loaded last on both pages (one script line each);
   wraps a few draw/director functions instead of editing floor2d.js / b1.js.
   Everything is chosen by the ET date (same for every viewer). Dev overrides (screenshots):
     ?date=2026-12-20  ?theme=december|halloween|newyear|valentine|stpatrick|spring|summer|july|fall|thanksgiving...
     ?hour=21 (sky/lighting)  ?weather=rain|snow|clear  ?event=birthday,copier,plant,pizza,firedrill  ?flair=green|red|friday
   Decor sits on walls, desktops, counters or already-blocked tiles. The only floor prop is December's tree, placed on a
   dead-end tile and added to the A* grid (main 12,16 / B1 1,12). */
(function () {
const MAIN = typeof drawWallLive === "function" && typeof WALLS !== "undefined";
const ON_B1 = !MAIN && typeof window.__b1 === "object";
if (!MAIN && !ON_B1) return;

// ---------------------------------------------------------------- date, overrides
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
const realKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const Q = new URLSearchParams(location.search);
const THEME_DATE = { january: "01-12", newyear: "01-01", winter: "01-20", february: "02-14", valentine: "02-14", march: "03-17", stpatrick: "03-17",
  april: "04-15", spring: "04-15", may: "05-20", june: "06-15", july: "07-04", fourth: "07-04", august: "08-10", summer: "08-10",
  september: "09-10", fall: "09-24", october: "10-20", halloween: "10-31", november: "11-26", thanksgiving: "11-26", december: "12-20", holidays: "12-20" };
let ovDate = /^\d{4}-\d{2}-\d{2}$/.test(Q.get("date") || "") ? Q.get("date") : null;
if (!ovDate && Q.get("theme") && THEME_DATE[Q.get("theme").toLowerCase()]) ovDate = realKey().slice(0, 4) + "-" + THEME_DATE[Q.get("theme").toLowerCase()];
const ovHour = Q.has("hour") && isFinite(+Q.get("hour")) ? +Q.get("hour") : null;
const ovWeather = Q.get("weather"), ovFlair = Q.get("flair");
const ovEvents = new Set(String(Q.get("event") || "").toLowerCase().split(",").filter(Boolean));
window.TND = { dayKey: () => ovDate || realKey(), override: !!(ovDate || ovHour != null) };
const WDN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const _etNow = etNow;
etNow = function () {
  const e = _etNow();
  if (ovDate) { const [y, m, d] = ovDate.split("-").map(Number); e.wd = WDN[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
  if (ovHour != null) { e.h = ovHour; e.hh = Math.floor(ovHour); e.mm = Math.round((ovHour % 1) * 60); }
  return e;
};
let dCache = null;
function D() {
  const k = window.TND.dayKey();
  if (dCache && dCache.k === k) return dCache;
  const [y, m, d] = k.split("-").map(Number), wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const idx = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
  return (dCache = { k, y, m, d, wd, idx, theme: themeOf(y, m, d, wd), weather: weatherOf(k, m), ev: null });
}
function themeOf(y, m, d, wd) {
  if (m === 1) return d <= 7 ? { id: "newyear", k: 1 - (d - 1) / 7 } : { id: "winter" };
  if (m === 2) return { id: "valentine", k: d <= 14 ? 0.5 + d / 28 : 0.5 };
  if (m === 3) return { id: "stpat", k: d <= 17 ? 0.5 + d / 34 : 0.4 };
  if (m === 4) return { id: "spring" };
  if (m === 5 || m === 6) return { id: "summerstart" };
  if (m === 7) return { id: "july4", k: d <= 7 ? 1 : 0.4 };
  if (m === 8) return { id: "summer" };
  if (m === 9) return { id: "fall" };
  if (m === 10) return { id: "halloween", lvl: d >= 31 ? 4 : d >= 21 ? 3 : d >= 10 ? 2 : 1 };
  if (m === 11) { const first = new Date(Date.UTC(y, 10, 1)).getUTCDay(), tg = 1 + ((4 - first + 7) % 7) + 21; return { id: "harvest", tday: d >= tg - 3 && d <= tg + 1 }; }
  return { id: "holiday", party: d >= 18 && d <= 26 };
}
function weatherOf(k, m) {
  if (ovWeather) return ovWeather;
  const r = fnv(k + ":wx");
  if (m === 12 || m === 1 || m === 2) return r < 0.45 ? "snow" : m === 12 ? "flurries" : "clear";
  return r < (m === 4 ? 0.22 : 0.12) ? "rain" : "clear";
}
const MAIN_PEOPLE = ["dash", "vee", "zip", "snap", "trek", "dip", "rota", "drift", "knobs", "pixel", "goldie", "grok"];
const B1_PEOPLE = ["scoop", "tape", "beats", "sage", "proof", "nancy"];
function events() {
  const dt = D(); if (dt.ev) return dt.ev;
  const salt = MAIN ? "main" : "b1", r = (s) => fnv(dt.k + ":" + salt + ":" + s), ppl = MAIN ? MAIN_PEOPLE : B1_PEOPLE, weekday = dt.wd >= 1 && dt.wd <= 5;
  const ev = {};
  if (r("bday") < 0.09 || ovEvents.has("birthday")) ev.birthday = ppl[Math.floor(r("bwho") * ppl.length)];
  if (r("plant") < 0.08 || ovEvents.has("plant")) ev.plant = ppl.filter((p) => p !== "goldie" && p !== "grok")[Math.floor(r("pwho") * (ppl.length - (MAIN ? 2 : 0)))];
  if (r("pizza") < 0.12 || ovEvents.has("pizza")) ev.pizza = true;
  if (MAIN && ((weekday && r("copier") < 0.07) || ovEvents.has("copier"))) ev.copier = { t0: ovEvents.has("copier") ? null : 10.5 + r("ct") * 4 };
  if (MAIN && ((weekday && r("fire") < 0.025) || ovEvents.has("firedrill"))) ev.fire = { t0: ovEvents.has("firedrill") ? null : 10 + r("ft") * 5 };
  return (dt.ev = ev);
}
const hourNow = () => etNow().h;
function nightF(h) { if (h >= 7.5 && h <= 17) return 0; if (h > 17 && h < 19.5) return (h - 17) / 2.5; if (h >= 5.5 && h < 7.5) return 1 - (h - 5.5) / 2; return 1; }
const dark = () => (MAIN ? nightF(hourNow()) : Math.max(0.35, nightF(hourNow())));   // B1 is a basement: always a bit dim for glows
const vis = (id) => chars[id] && !chars[id].hidden;
const nowS = () => performance.now() / 1000;

// ---------------------------------------------------------------- tiny sprite kit (local coords, y up from a baseline)
function P(x0, yb, s) { return (x, y, w, h, col) => R(g, x0 + x * s, yb + y * s, w * s, h * s, col); }
const glows = [];   // [x, y, r, col] collected per frame, painted additively after the lighting pass
function pumpkin(p, x0, yb, s, carved) {
  p(0, -4, 5, 4, "#f97316"); p(1, -5, 3, 1, "#fb923c"); p(2, -6, 1, 1, "#15803d"); p(1, -4, 1, 4, "#ea6a0c"); p(3, -4, 1, 4, "#ea6a0c");
  if (carved) {
    const fl = 0.6 + 0.4 * Math.sin(nowS() * 13 + x0) * Math.sin(nowS() * 7.3 + yb), col = fl > 0.55 ? "#fde047" : "#f59e0b";
    p(1, -3, 1, 1, col); p(3, -3, 1, 1, col); p(1, -2, 3, 1, col);
    glows.push([x0 + 2.5 * s, yb - 2.5 * s, 5 + 3 * s * fl, "255,170,40"]);
  }
}
function seasonalItem(p, x0, yb, s, id) {
  const th = D().theme;
  switch (th.id) {
    case "halloween": pumpkin(p, x0, yb, s, dark() > 0.25); break;
    case "harvest": if (id % 2) { p(0, -3, 4, 3, "#d97706"); p(1, -4, 1, 1, "#65a30d"); p(3, -2, 2, 2, "#facc15"); } else { p(0, -2, 5, 2, "#b45309"); p(0, -3, 5, 1, "#f59e0b"); p(1, -4, 3, 1, "#fbbf24"); } break;   // gourds / pie
    case "holiday": if (id % 2) { p(2, -7, 1, 1, "#fde047"); p(1, -6, 3, 2, "#15803d"); p(0, -4, 5, 3, "#166534"); p(2, -1, 1, 1, "#78350f"); p(1, -5, 1, 1, "#ef4444"); p(3, -3, 1, 1, "#60a5fa"); }
      else { p(0, -4, 5, 4, "#dc2626"); p(2, -4, 1, 4, "#fde047"); p(0, -3, 5, 1, "#fde047"); p(1, -5, 1, 1, "#fde047"); p(3, -5, 1, 1, "#fde047"); } break;   // mini tree / gift
    case "newyear": p(2, -7, 1, 1, "#fde047"); p(1, -6, 3, 2, "#a855f7"); p(0, -4, 5, 4, "#ec4899"); p(1, -3, 1, 1, "#fde047"); break;   // party hat
    case "winter": p(0, -4, 4, 4, "#e5e7eb"); p(1, -4, 2, 1, "#7c2d12"); p(1, -5, 1, 1, "#ffffff"); p(4, -3, 1, 2, "#e5e7eb"); break;   // cocoa
    case "valentine": p(0, -5, 2, 2, "#e11d48"); p(3, -5, 2, 2, "#e11d48"); p(0, -4, 5, 1, "#e11d48"); p(1, -3, 3, 1, "#e11d48"); p(2, -2, 1, 1, "#e11d48"); p(1, -5, 1, 1, "#fb7185"); break;
    case "stpat": p(0, -5, 2, 2, "#16a34a"); p(3, -5, 2, 2, "#16a34a"); p(1, -7, 2, 2, "#22c55e"); p(2, -3, 1, 3, "#15803d"); break;
    case "spring": p(1, -2, 3, 2, "#b8733d"); p(2, -5, 1, 3, "#16a34a"); p(1, -7, 3, 2, ["#f472b6", "#facc15", "#ef4444"][id % 3]); break;   // tulip
    case "summerstart": p(0, -5, 3, 5, "#fde68a"); p(0, -5, 3, 1, "#fffbeb"); p(2, -7, 1, 3, "#ef4444"); break;   // lemonade
    case "july4": p(0, -7, 1, 7, "#9ca3af"); p(1, -7, 4, 1, "#dc2626"); p(1, -6, 4, 1, "#f8fafc"); p(1, -5, 4, 1, "#dc2626"); p(1, -7, 2, 2, "#1d4ed8"); break;   // flag
    case "summer": p(0, -4, 2, 2, "#ef4444"); p(2, -4, 2, 2, "#facc15"); p(0, -2, 2, 2, "#3b82f6"); p(2, -2, 2, 2, "#f8fafc"); break;   // beach ball
    case "fall": p(1, -4, 3, 3, "#dc2626"); p(2, -5, 1, 1, "#78350f"); p(3, -6, 1, 1, "#16a34a"); p(1, -4, 1, 1, "#f87171"); break;   // apple
  }
}
function showSeasonal(id, salt) {   // which desks get a seasonal item (Halloween ramps up)
  const th = D().theme, r = fnv(D().k.slice(0, 7) + ":" + id + ":" + (salt || ""));
  if (th.id === "halloween") return r < [0, 0.4, 0.7, 1, 1][th.lvl];
  return r < 0.65;
}
// ---- personal clutter
const PERSONAL = { dash: ["can", "stopwatch"], vee: ["tea", "succulent"], zip: ["ring", "merch"], snap: ["stressball", "bobble"], trek: ["mountain", "bobble"],
  dip: ["chips", "can"], rota: ["globe", "spinner"], drift: ["coconut", "surf"], scoop: ["newspaper", "tea"], tape: ["tapecurl", "can"], beats: ["calendar", "tea"],
  sage: ["knight", "succulent"], proof: ["pens", "stressball"] };
function item(name, x, yb, id) {
  const p = P(x, yb, 1), c = COL[id] || "#ccc";
  switch (name) {
    case "can": p(0, -5, 3, 5, id === "dash" ? "#e63946" : "#22c55e"); p(0, -5, 3, 1, "#d1d5db"); p(1, -3, 1, 1, "#111"); break;
    case "stopwatch": p(0, -4, 4, 4, "#e5e7eb"); p(1, -3, 2, 2, "#111827"); p(1, -5, 2, 1, "#9ca3af"); break;
    case "tea": p(0, -4, 3, 4, "#f1f1f1"); p(3, -3, 1, 2, "#f1f1f1"); p(1, -5, 1, 1, "#facc15"); p(1, -4, 1, 1, "#a16207"); break;
    case "succulent": p(0, -2, 4, 2, "#a16207"); p(0, -4, 1, 2, "#4ade80"); p(1, -5, 2, 3, "#22c55e"); p(3, -4, 1, 2, "#4ade80"); break;
    case "ring": { const t = nowS(), on = Math.floor(t * 0.5) % 6 !== 0; p(1, -13, 6, 1, on ? "#fff6c2" : "#9ca3af"); p(1, -7, 6, 1, on ? "#fff6c2" : "#9ca3af"); p(0, -12, 1, 5, on ? "#fff6c2" : "#9ca3af"); p(7, -12, 1, 5, on ? "#fff6c2" : "#9ca3af"); p(3, -6, 1, 6, "#4b5563"); p(1, 0, 5, 1, "#4b5563"); if (on) glows.push([x + 4, yb - 10, 6, "255,246,194"]); break; }   // Meet Kevin's ring light
    case "merch": for (let i = 0; i < 3; i++) { p(0, -3 - i * 3, 4, 3, i % 2 ? "#111827" : "#facc15"); p(1, -2 - i * 3, 2, 1, i % 2 ? "#facc15" : "#111827"); } break;   // stack of his own merch
    case "stressball": p(0, -3, 3, 3, "#ef4444"); p(0, -3, 1, 1, "#fca5a5"); break;
    case "bobble": p(1, -2, 2, 2, c); p(0, -6, 4, 4, "#f1c27d"); p(0, -6, 4, 1, "#3a2a1a"); p(1, -4, 1, 1, "#111"); p(3 - 1, -4, 1, 1, "#111"); break;
    case "mountain": p(0, -3, 5, 3, "#6b7280"); p(1, -5, 3, 2, "#9ca3af"); p(2, -6, 1, 1, "#f8fafc"); break;
    case "chips": p(0, -5, 4, 5, "#facc15"); p(0, -5, 4, 1, "#ca8a04"); p(1, -3, 2, 1, "#dc2626"); break;
    case "globe": p(0, -5, 4, 4, "#3b82f6"); p(1, -4, 2, 1, "#22c55e"); p(1, -1, 2, 1, "#78350f"); break;
    case "spinner": p(0, -2, 1, 1, c); p(2, -2, 1, 1, c); p(1, -3, 1, 1, c); p(1, -2, 1, 1, "#d1d5db"); break;
    case "coconut": p(0, -3, 4, 3, "#78350f"); p(2, -6, 1, 3, "#f472b6"); p(1, -4, 2, 1, "#fef3c7"); break;
    case "surf": p(1, -7, 2, 7, "#38bdf8"); p(1, -4, 2, 1, "#f8fafc"); break;
    case "newspaper": p(0, -2, 5, 2, "#e5e7eb"); p(0, -3, 5, 1, "#d1d5db"); p(1, -2, 3, 1, "#6b7280"); break;
    case "tapecurl": p(0, -2, 5, 1, "#f8fafc"); p(1, -4, 3, 1, "#f8fafc"); p(3, -3, 1, 1, "#f8fafc"); p(1, -4, 1, 1, "#22c55e"); break;
    case "calendar": p(0, -5, 4, 5, "#f8fafc"); p(0, -5, 4, 1, "#dc2626"); p(1, -3, 2, 1, "#111"); break;
    case "knight": p(1, -1, 3, 1, "#111"); p(1, -4, 2, 3, "#111"); p(2, -5, 2, 1, "#111"); break;
    case "pens": p(0, -3, 3, 3, "#374151"); p(0, -6, 1, 3, "#dc2626"); p(2, -5, 1, 2, "#1d4ed8"); break;
  }
}
function plant(x, yb, id, isNew) {   // grows over the weeks, then gets repotted (date seed)
  const p = P(x, yb, 1);
  const stage = isNew ? 6 : Math.floor((D().idx + fnv("pl:" + id) * 70) / 7) % 7;
  p(0, -3, 4, 3, isNew ? "#f9a8d4" : "#b8733d"); p(0, -3, 4, 1, isNew ? "#fbcfe8" : "#d08a50");
  const h = 2 + stage; p(1, -3 - h, 2, h, "#2f8f4e");
  for (let i = 0; i < Math.min(stage, 5); i++) p(i % 2 ? -1 : 3, -4 - i, 2, 1, "#3cb36a");
  if (isNew) { p(4, -4, 2, 1, "#ec4899"); p(-1, -4, 2, 1, "#ec4899"); }
}
function stickies(x, y, id) { const n = Math.floor(fnv(D().k + ":st:" + id) * 4), cs = ["#fde047", "#f9a8d4", "#86efac", "#7dd3fc"]; for (let i = 0; i < n; i++) R(g, x + i * 3, y, 2, 2, cs[(i + Math.floor(fnv(id) * 4)) % 4]); }
function photo(x, yb, id) { R(g, x, yb - 5, 4, 5, "#c79a3a"); R(g, x + 1, yb - 4, 2, 3, ["#7dd3fc", "#86efac", "#fca5a5", "#fde68a"][Math.floor(fnv("ph" + id) * 4)]); R(g, x + 1, yb - 2, 2, 1, "#374151"); }
function mugState(x, y, id) {   // existing mug pixel at (x,y): full in the morning (steam), half later, empty by the evening
  const h = hourNow(), r = fnv(D().k + ":mug:" + id), st = h < 10 + r * 2 ? 2 : h < 15 + r * 2 ? 1 : 0;
  if (st === 0) R(g, x, y, 1, 1, "#f1f1f1");
  if (st === 2 && Math.floor(nowS() * 2 + r * 4) % 2) R(g, x, y - 3, 1, 2, "rgba(255,255,255,.5)");
}
function balloons(x, yb) {
  const t = nowS(), cols = ["#ef4444", "#3b82f6", "#facc15"];
  for (let i = 0; i < 3; i++) { const bx = x + i * 3 - 3, by = yb - 20 - (i % 2) * 4 + Math.round(Math.sin(t * 1.5 + i) * 1); R(g, bx + 1, by + 4, 1, yb - by - 4, "rgba(255,255,255,.55)"); R(g, bx, by, 3, 4, cols[i]); R(g, bx, by, 1, 1, "rgba(255,255,255,.7)"); }
}
function deskClutter(id, px, py) {   // 46-wide desk (main trader desks + B1 desks)
  const it = PERSONAL[id] || ["can", "tea"], ev = events();
  stickies(px + 4, py - 14, id);
  if (it[0] === "ring") { item("ring", px + 18, py - 3, id); item("merch", px + 26, py - 3, id); }
  else { item(it[0], px + 19, py - 3, id); item(it[1], px + 25, py - 3, id); }
  plant(px + 1, py + 8, id, ev.plant === id);
  photo(px + 32, py + 8, id);
  mugState(px + 39, py + 3, id);
  if (showSeasonal(id)) seasonalItem(P(px + 42, py + 8, 1), px + 42, py + 8, 1, Math.floor(fnv(id) * 10));
  if (ev.birthday === id) balloons(px + 45, py - 3);
}

// ---------------------------------------------------------------- desk + furniture wrappers
function wrapDraw(type, after) { const orig = DRAW[type]; if (!orig) return; DRAW[type] = function (f, t) { orig(f, t); try { after(f, t); } catch (e) { /* never break a frame */ } }; }
if (MAIN) {
  wrapDraw("tdesk", (f) => deskClutter(f.bot, f.x * TS, f.y * TS));
  wrapDraw("jdesk", (f) => {   // El Jefe: cactus, cowboy boots parked against the desk
    const px = f.x * TS, py = f.y * TS, p = P(px + 11, py - 4, 1), ev = events();
    p(0, -2, 4, 2, "#b45309"); p(1, -8, 2, 6, "#15803d"); p(0, -6, 1, 2, "#15803d"); p(3, -7, 1, 3, "#15803d"); p(2, -9, 1, 1, "#f472b6");
    const b = P(px + 39, py + 15, 1); b(0, -6, 3, 6, "#5b3a1e"); b(0, -1, 4, 1, "#2b1a0c"); b(4, -6, 3, 6, "#6b4423"); b(4, -1, 4, 1, "#2b1a0c"); b(0, -6, 3, 1, "#c79a3a"); b(4, -6, 3, 1, "#c79a3a");
    if (showSeasonal("grok", "j")) seasonalItem(P(px + 17, py - 4, 1), px + 17, py - 4, 1, 3);
    if (ev.birthday === "grok") balloons(px + 6, py - 6);
  });
  wrapDraw("gdesk", (f) => {   // reception: candy jar + seasonal centerpiece (big)
    const px = f.x * TS, py = f.y * TS, j = P(px + 43, py - 4, 1), ev = events();
    j(0, -6, 4, 6, "rgba(220,240,255,.55)"); j(0, -7, 4, 1, "#c79a3a"); j(1, -3, 1, 1, "#ef4444"); j(2, -2, 1, 1, "#22c55e"); j(1, -1, 2, 1, "#facc15"); j(2, -4, 1, 1, "#3b82f6");
    const th = D().theme;
    if (th.id === "valentine" || th.id === "newyear") balloons(px + 20, py - 4); else seasonalItem(P(px + 15, py - 4, 2), px + 15, py - 4, 2, 2);
    if (ev.birthday === "goldie") balloons(px + 32, py - 4);
  });
  wrapDraw("pdesk", (f) => {
    const px = f.x * TS, py = f.y * TS, n = 1 + Math.floor(fnv(D().k + ":cans") * 3), ev = events();
    for (let i = 0; i < n; i++) { R(g, px + 1 + i * 3, py + 1, 2, 4, i % 2 ? "#22c55e" : "#38bdf8"); R(g, px + 1 + i * 3, py + 1, 2, 1, "#d1d5db"); }   // energy drinks
    R(g, px + 22, py - 15, 3, 2, "#facc15"); R(g, px + 25, py - 14, 1, 1, "#f97316"); R(g, px + 22, py - 16, 2, 1, "#facc15");   // rubber duck on the monitor
    stickies(px + 2, py - 14, "pixel"); plant(px + 26, py + 9, "pixel", ev.plant === "pixel");
    if (showSeasonal("pixel")) seasonalItem(P(px + 13, py - 3, 1), px + 13, py - 3, 1, 5);
    if (ev.birthday === "pixel") balloons(px + 28, py - 3);
  });
  wrapDraw("kdesk", (f) => {
    const px = f.x * TS, py = f.y * TS, r = P(px + 3, py + 7, 1), ev = events();
    r(0, -3, 3, 3, "#ef4444"); r(1, -3, 2, 1, "#facc15"); r(0, -1, 1, 1, "#3b82f6"); r(2, -2, 1, 1, "#22c55e");   // rubik's cube
    stickies(px + 4, py - 14, "knobs");
    if (showSeasonal("knobs")) seasonalItem(P(px + 9, py + 7, 1), px + 9, py + 7, 1, 7);
    if (ev.birthday === "knobs") balloons(px + 28, py - 3);
  });
  wrapDraw("plant", (f) => {   // entrance/lounge plants get jack-o'-lanterns (Halloween lvl 2+) / harvest gourds
    const th = D().theme, key = f.x + "," + f.y;
    if (!(key === "22,16" || key === "18,16" || key === "7,16")) return;
    const px = f.x * TS, py = f.y * TS;
    if (th.id === "halloween" && th.lvl >= 2) pumpkin(P(px + 0, py + 15, 1.4), px, py + 15, 1.4, dark() > 0.25);
    else if (th.id === "harvest") { R(g, px, py + 11, 5, 4, "#d97706"); R(g, px + 2, py + 10, 1, 1, "#65a30d"); }
  });
  wrapDraw("btable", (f) => {   // break table: skeleton (Halloween 3+), birthday cake, leftover pizza box
    const px = f.x * TS, py = f.y * TS, ev = events(), lu = window.__social && window.__social.lunch && window.__social.lunch(), eating = lu && lu.phase === "eating";
    if (!eating && ev.pizza) { R(g, px + 17, py + 3, 11, 8, "#e8d3a8"); R(g, px + 18, py + 4, 9, 6, "#d9bf8c"); R(g, px + 20, py + 6, 3, 2, "#c99a5b"); R(g, px + 24, py + 5, 1, 1, "#b45309"); }   // empty box with a grease stain
    if (!eating && ev.birthday) cake(px + 6, py + 10);
  });
  wrapDraw("kitchen", (f) => {   // a skeleton sits on the break-room counter, back against the wall (Halloween 3+)
    const th = D().theme;
    if (th.id === "halloween" && th.lvl >= 3) skeleton(f.x * TS + 24, f.y * TS - 1);
  });
  wrapDraw("copier", (f) => {   // broken-copier day: blinking red, paper jam
    if (!copierBroken()) return;
    const px = f.x * TS, py = f.y * TS, on = Math.floor(nowS() * 3) % 2;
    R(g, px + 23, py - 1, 3, 1, on ? "#ef4444" : "#7f1d1d"); R(g, px + 6, py - 9, 5, 3, "#f8fafc"); R(g, px + 9, py - 10, 4, 2, "#e5e7eb"); R(g, px + 12, py - 8, 3, 2, "#f8fafc");
    if (on) glows.push([px + 24, py - 1, 5, "255,60,60"]);
  });
} else {
  wrapDraw("desk", (f) => deskClutter(f.who, f.x * TS, f.y * TS));
  wrapDraw("ndesk", (f) => {   // Nancy: pearls dish + stock-chart mug
    const px = f.x * TS, py = f.y * TS, p = P(px + 2, py + 8, 1), ev = events();
    p(0, -2, 7, 2, "#e5e7eb"); p(1, -3, 5, 1, "#f3f4f6"); for (let i = 0; i < 4; i++) p(1 + i, -3 + (i % 2), 1, 1, "#fffaf0");
    const m = P(px + 14, py + 7, 1); m(0, -4, 3, 4, "#ffffff"); m(3, -3, 1, 2, "#ffffff"); m(0, -2, 1, 1, "#16a34a"); m(1, -3, 1, 1, "#16a34a"); m(2, -4, 1, 1, "#16a34a");
    if (showSeasonal("nancy")) seasonalItem(P(px + 24, py - 3, 1), px + 24, py - 3, 1, 4);
    if (ev.birthday === "nancy") balloons(px + 27, py - 3);
  });
  wrapDraw("table", (f) => {   // huddle table: centerpiece, birthday cake, leftover pizza box
    const px = f.x * TS, py = f.y * TS, ev = events();
    seasonalItem(P(px + 18, py + 10, 2), px + 18, py + 10, 2, 6);
    if (ev.birthday) cake(px + 30, py + 12);
    if (ev.pizza) { R(g, px + 4, py + 12, 11, 8, "#e8d3a8"); R(g, px + 5, py + 13, 9, 6, "#d9bf8c"); R(g, px + 7, py + 15, 3, 2, "#c99a5b"); }
  });
}
function cake(x, yb) { const p = P(x, yb, 1); p(0, -4, 9, 4, "#fef3c7"); p(0, -5, 9, 1, "#f9a8d4"); p(0, -2, 9, 1, "#f472b6"); for (let i = 0; i < 3; i++) { p(1 + i * 3, -7, 1, 2, "#93c5fd"); if (Math.floor(nowS() * 6 + i) % 3) p(1 + i * 3, -8, 1, 1, "#fde047"); } }
function skeleton(x, yb) {   // seated: yb = counter top; legs dangle over the counter front
  const p = P(x, yb, 1), W = "#f1f5f9", Dk = "#94a3b8";
  p(1, -17, 5, 4, W); p(2, -15, 1, 1, "#111"); p(4, -15, 1, 1, "#111"); p(2, -13, 3, 1, Dk);   // skull
  p(3, -12, 1, 10, W); for (let i = 0; i < 3; i++) p(1, -11 + i * 2, 5, 1, W);   // spine + ribs
  p(0, -10, 1, 5, W); p(1, -1, 5, 1, W); p(1, 0, 1, 9, W); p(4, 0, 1, 9, W); p(0, 9, 2, 1, W); p(4, 9, 2, 1, W);   // arm, pelvis, dangling legs
  const wave = Math.floor(nowS() * 0.7) % 5 === 0; p(6, wave ? -14 : -10, 1, 5, W);   // other arm waves now and then
}

// ---------------------------------------------------------------- the December tree (only floor prop: dead-end tile, added to A*)
const TREE = MAIN ? [12, 16] : [1, 12];
if (D().theme.id === "holiday") F("xtree", TREE[0], TREE[1]);
DRAW.xtree = function (f, t) {
  const px = f.x * TS, py = f.y * TS, p = P(px, py + 15, 1);
  p(6, -3, 4, 3, "#7c2d12");
  for (let r = 0; r < 6; r++) { const w = 4 + r * 2; p(8 - w / 2, -27 + r * 4, w, 4, r % 2 ? "#166534" : "#15803d"); }
  p(7, -30, 2, 3, "#fde047"); glows.push([px + 8, py - 14, 6, "255,230,120"]);
  const cols = ["#ef4444", "#facc15", "#60a5fa", "#f472b6", "#f8fafc"];
  for (let i = 0; i < 12; i++) { const bx = 4 + ((i * 5) % 9), by = -24 + i * 2; if ((Math.floor(t * 2) + i) % 3) { p(bx, by, 1, 1, cols[i % 5]); if (i % 3 === 0) glows.push([px + bx, py + 15 + by, 3, "255,220,150"]); } }
  if (D().theme.party) { p(0, -3, 5, 3, "#dc2626"); p(2, -3, 1, 3, "#fde047"); p(11, -4, 5, 4, "#2563eb"); p(13, -4, 1, 4, "#f8fafc"); }   // gifts near the holidays
};

// ---------------------------------------------------------------- walls: static decor (cached background) + live bits
const WINDOWS = MAIN ? [[20, 8, 26, 22], [210, 8, 28, 24], [322, 6, 60, 28]] : [];
function garland(c) {
  const th = D().theme, y = 34;
  const pen = (cols) => { R(c, 0, y, LW, 1, "rgba(30,20,10,.6)"); for (let x = 4, i = 0; x < LW; x += 9, i++) { const col = cols[i % cols.length]; R(c, x, y + 1, 6, 1, col); R(c, x + 1, y + 2, 4, 1, col); R(c, x + 2, y + 3, 2, 1, col); } };
  switch (th.id) {
    case "halloween": pen(th.lvl >= 2 ? ["#f97316", "#7c3aed", "#111827"] : ["#f97316", "#7c3aed"]); break;
    case "harvest": for (let x = 2, i = 0; x < LW; x += 7, i++) { R(c, x, y + (i % 2), 4, 3, ["#c2410c", "#b45309", "#ca8a04", "#991b1b"][i % 4]); R(c, x + 1, y + 3 + (i % 2), 1, 1, "#78350f"); } break;
    case "holiday": for (let x = 0; x < LW; x += 2) R(c, x, y + Math.round(Math.sin(x / 9) * 1.5), 2, 3, x % 4 ? "#166534" : "#15803d"); for (let x = 10, i = 0; x < LW; x += 20, i++) R(c, x, y + 3, 2, 2, ["#dc2626", "#facc15"][i % 2]); break;
    case "newyear": pen(["#facc15", "#d1d5db", "#fde68a"]); break;
    case "winter": for (let x = 8; x < LW; x += 18) { R(c, x + 1, y, 1, 5, "#e0f2fe"); R(c, x - 1, y + 2, 5, 1, "#e0f2fe"); R(c, x, y + 1, 1, 1, "#bae6fd"); R(c, x + 2, y + 3, 1, 1, "#bae6fd"); } break;
    case "valentine": for (let x = 6, i = 0; x < LW; x += 12, i++) { const col = i % 2 ? "#e11d48" : "#f472b6"; R(c, x, y, 2, 2, col); R(c, x + 3, y, 2, 2, col); R(c, x, y + 1, 5, 1, col); R(c, x + 1, y + 2, 3, 1, col); R(c, x + 2, y + 3, 1, 1, col); } R(c, 0, y, LW, 1, "rgba(244,114,182,.5)"); break;
    case "stpat": pen(["#16a34a", "#f8fafc", "#f59e0b"]); break;
    case "spring": R(c, 0, y + 1, LW, 1, "#4d7c0f"); for (let x = 5, i = 0; x < LW; x += 10, i++) { R(c, x, y, 3, 3, ["#f9a8d4", "#fde68a", "#c4b5fd", "#fca5a5"][i % 4]); R(c, x + 1, y + 1, 1, 1, "#facc15"); } break;
    case "summerstart": case "summer": pen(["#facc15", "#2dd4bf", "#fb7185", "#38bdf8"]); break;
    case "july4": pen(["#dc2626", "#f8fafc", "#1d4ed8"]); break;
    case "fall": for (let x = 3, i = 0; x < LW; x += 9, i++) R(c, x, y + (i % 2), 4, 3, ["#eab308", "#f97316", "#dc2626"][i % 3]); R(c, 0, y + 1, LW, 1, "rgba(120,53,15,.6)"); break;
  }
}
function cobweb(c, x, y, fx, fy, s) {
  c.strokeStyle = "rgba(230,230,240,.45)"; c.lineWidth = 1; c.beginPath();
  for (let a = 0; a <= 4; a++) { const ang = (a / 4) * Math.PI / 2; c.moveTo(x + 0.5, y + 0.5); c.lineTo(x + fx * Math.cos(ang) * s + 0.5, y + fy * Math.sin(ang) * s + 0.5); }
  for (let r = 4; r <= s; r += 4) { c.moveTo(x + fx * r + 0.5, y + 0.5); for (let a = 1; a <= 4; a++) { const ang = (a / 4) * Math.PI / 2; c.lineTo(x + fx * Math.cos(ang) * r + 0.5, y + fy * Math.sin(ang) * r + 0.5); } }
  c.stroke();
}
function staticDecor(c) {
  const th = D().theme, wx = D().weather;
  garland(c);
  if (th.id === "halloween" && th.lvl >= 2) {
    cobweb(c, 0, 0, 1, 1, 14); cobweb(c, LW - 1, 0, -1, 1, 14);
    if (MAIN) { cobweb(c, 320, 4, 1, 1, 10); cobweb(c, 48, 6, -1, 1, 8); cobweb(c, TS, 3 * TS, 1, 1, 10); cobweb(c, 19 * TS, 3 * TS, -1, 1, 10); }
    else { cobweb(c, 12, 2, 1, 1, 10); cobweb(c, 384, 4, -1, 1, 10); cobweb(c, TS, 3 * TS, 1, 1, 10); cobweb(c, LW - TS, 3 * TS, -1, 1, 10); }
  }
  for (const [x, y, w, h] of WINDOWS) {
    if (wx === "rain") { c.fillStyle = "rgba(70,80,100,.45)"; c.fillRect(x, y, w, h); }
    if (wx === "snow" || wx === "flurries" || th.id === "holiday") { c.fillStyle = "rgba(225,235,245,.18)"; c.fillRect(x, y, w, h); R(c, x, y + h - 2, w, 2, "#f1f5f9"); R(c, x + 2, y + h - 3, w - 4, 1, "#e2e8f0"); }
    if (th.id === "winter" || th.id === "holiday") { R(c, x + 3, y + 3, 1, 3, "rgba(255,255,255,.6)"); R(c, x + 2, y + 4, 3, 1, "rgba(255,255,255,.6)"); }   // window decal
    if (th.id === "holiday" && w >= 40) { R(c, x + w / 2 - 6, y - 4, 12, 3, "#166534"); R(c, x + w / 2 - 1, y - 3, 2, 3, "#dc2626"); }   // wreath on El Jefe's window
  }
}
if (MAIN) { const _bg = drawBackground; drawBackground = function (hr) { _bg(hr); try { staticDecor(gb); } catch (e) { /* ignore */ } }; }
else { const _bg = drawBackground; drawBackground = function () { _bg(); try { staticDecor(gb); } catch (e) { /* ignore */ } }; }
let decorKey = null;
function refreshBg() { const k = D().k; if (k === decorKey) return; decorKey = k; if (MAIN) bgStamp = -1; else bgDone = false; }

const BULBS = { halloween: ["#f97316", "#a855f7"], holiday: ["#ef4444", "#22c55e", "#facc15", "#60a5fa", "#f472b6"], newyear: ["#fde68a", "#f8fafc"], winter: ["#e0f2fe"],
  valentine: ["#f472b6", "#ef4444"], stpat: ["#22c55e", "#facc15"], july4: ["#ef4444", "#f8fafc", "#3b82f6"] };
let bulbPts = [];
function liveWall(t) {
  const th = D().theme, wx = D().weather;
  // string lights along the molding
  bulbPts = [];
  const cols = th.id === "halloween" && th.lvl < 2 ? null : BULBS[th.id];
  if (cols) {
    R(g, 0, 41, LW, 1, "rgba(20,20,20,.55)");
    for (let x = 6, i = 0; x < LW; x += 12, i++) { const on = (Math.floor(t * 1.5) + i) % 4 !== 0 || th.id === "winter"; R(g, x, 42, 2, 2, on ? cols[i % cols.length] : "#3f3f46"); if (on) bulbPts.push([x + 1, 43, cols[i % cols.length]]); }
  }
  // weather in the windows
  const flakes = wx === "snow" ? 1 : wx === "flurries" || th.id === "holiday" ? 0.45 : 0;
  for (const [x, y, w, h] of WINDOWS) {
    if (wx === "rain") for (let i = 0; i < w * h / 70; i++) { const rx = x + ((i * 37 + 11) % w), ry = y + ((i * 53 + t * 90) % (h + 4)) - 4; if (ry >= y && ry + 3 <= y + h) R(g, rx, ry, 1, 3, "rgba(190,215,240,.55)"); }
    if (flakes) for (let i = 0; i < w * h / 55 * flakes; i++) { const sx = x + ((i * 41 + Math.sin(t + i) * 2 + 7) % w + w) % w, sy = y + ((i * 29 + t * (8 + (i % 3) * 3)) % h); R(g, sx, sy, 1, 1, "rgba(255,255,255,.9)"); }
    if (th.id === "july4" && (th.k === 1 || nightF(hourNow()) > 0.6) && nightF(hourNow()) > 0.5) {
      const k = Math.floor(t / 1.6 + x), ph = (t / 1.6 + x) % 1, cx = x + 4 + (fnv("fw" + k) * (w - 8)), cy = y + 4 + fnv("fy" + k) * (h / 2), col = ["#ef4444", "#f8fafc", "#60a5fa", "#facc15"][k % 4];
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4, rr = ph * 6; const px2 = cx + Math.cos(ang) * rr, py2 = cy + Math.sin(ang) * rr; if (px2 > x && px2 < x + w && py2 > y && py2 < y + h) R(g, px2, py2, 1, 1, col); }
    }
  }
  // bats (Halloween), butterflies (spring)
  const nb = th.id === "halloween" ? [0, 0, 1, 3, 6][th.lvl] : 0;
  for (let i = 0; i < nb; i++) {
    const bx = ((t * (20 + i * 4) + i * 137) % (LW + 40)) - 20, by = 8 + (i * 7) % 18 + Math.sin(t * 3 + i) * 4, up = Math.floor(t * 8 + i) % 2;
    R(g, bx, by, 3, 2, "#111827"); R(g, bx - 3, by - (up ? 2 : 0), 3, 1, "#111827"); R(g, bx + 3, by - (up ? 2 : 0), 3, 1, "#111827"); R(g, bx - 2, by + (up ? -1 : 1), 2, 1, "#1f2937"); R(g, bx + 3, by + (up ? -1 : 1), 2, 1, "#1f2937");
  }
  if (th.id === "spring") for (let i = 0; i < 2; i++) { const bx = ((t * 9 + i * 211) % (LW + 20)) - 10, by = 14 + Math.sin(t * 2 + i * 3) * 8, up = Math.floor(t * 10 + i) % 2; R(g, bx - 2, by - up, 2, 2, i ? "#f472b6" : "#facc15"); R(g, bx + 1, by - up, 2, 2, i ? "#f472b6" : "#facc15"); R(g, bx, by, 1, 2, "#111"); }
  // fire-drill strobe
  if (drill) { const on = Math.floor(nowS() * 4) % 2; R(g, MAIN ? 300 : 0, 36, 6, 4, on ? "#ef4444" : "#7f1d1d"); }
}
const _dwl = drawWallLive;
drawWallLive = function (t) { _dwl(t); try { refreshBg(); liveWall(t); } catch (e) { /* ignore */ } };

// ---------------------------------------------------------------- after lighting: glows, market tint, confetti, strobe
const confetti = [];
let lastPost = nowS(), nextBurst = 0;
function spawnConfetti(n, cols) { for (let i = 0; i < n && confetti.length < 90; i++) confetti.push({ x: Math.random() * LW, y: -4 - Math.random() * 30, vy: 18 + Math.random() * 22, vx: (Math.random() - 0.5) * 10, c: cols[i % cols.length], life: 6 + Math.random() * 3 }); }
function flair() {
  if (!MAIN || typeof S === "undefined" || !S || !S.accounts) return { pnl: 0, week: 0, friday: false };
  const A = S.accounts, pnl = ((A.day || {}).pnl_today || 0) + ((A.swing || {}).pnl_today || 0);
  const week = ((A.day && A.day.week && A.day.week.week_pnl) || 0) + ((A.swing && A.swing.week && A.swing.week.week_pnl) || 0);
  const e = etNow(), below = S.boss && S.boss.below_baseline && S.boss.below_baseline.length;
  let friday = e.wd === "Fri" && e.h >= 16 && week >= 0 && !below;
  let p = pnl;
  if (ovFlair === "green") p = 400; else if (ovFlair === "red") p = -400; else if (ovFlair === "friday") friday = true;
  return { pnl: p, week, friday };
}
function post(t) {
  const now = nowS(), dt = Math.min(0.1, now - lastPost); lastPost = now;
  const th = D().theme, n = dark();
  // additive glows (jack-o'-lanterns, ring light, tree, string lights) - stronger after dark
  if (glows.length || bulbPts.length) {
    g.save(); g.globalCompositeOperation = "lighter";
    const k = 0.25 + 0.75 * n;
    for (const [x, y, r, rgb] of glows) { g.fillStyle = `rgba(${rgb},${0.10 * k})`; g.fillRect(x - r, y - r, r * 2, r * 2); g.fillStyle = `rgba(${rgb},${0.12 * k})`; g.fillRect(x - r / 2, y - r / 2, r, r); }
    if (n > 0.2) for (const [x, y, col] of bulbPts) { g.fillStyle = col; g.globalAlpha = 0.25 * n; g.fillRect(x - 3, y - 3, 6, 6); }
    g.restore();
  }
  glows.length = 0;
  if (MAIN) {
    const f = flair();
    if (Math.abs(f.pnl) >= 5) { const a = Math.min(1, Math.abs(f.pnl) / 400) * 0.055; g.fillStyle = f.pnl > 0 ? `rgba(40,220,110,${a})` : `rgba(235,60,60,${a})`; g.fillRect(0, 3 * TS, LW, LH - 3 * TS); }
    if (now > nextBurst) {
      if (f.friday) { spawnConfetti(45, ["#facc15", "#fde68a", "#22c55e", "#f8fafc"]); nextBurst = now + 18; fridayCheer(); }
      else if (f.pnl >= 150) { spawnConfetti(40, ["#22c55e", "#86efac", "#facc15", "#f8fafc"]); nextBurst = now + 25; }
      else if (th.id === "newyear") { spawnConfetti(Math.round(30 * th.k) + 4, ["#facc15", "#f472b6", "#60a5fa", "#a855f7", "#f8fafc"]); nextBurst = now + 9 + (1 - th.k) * 20; }
      else if (th.id === "holiday" && th.party && nightF(hourNow()) < 1) { spawnConfetti(12, ["#ef4444", "#22c55e", "#facc15", "#f8fafc"]); nextBurst = now + 30; }
      else nextBurst = now + 5;
    }
    if (drill && Math.floor(now * 4) % 2) { g.fillStyle = "rgba(255,40,40,.08)"; g.fillRect(0, 0, LW, LH); }
  }
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i]; p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(now * 3 + i) * 0.2; p.life -= dt;
    if (p.life <= 0 || p.y > LH) { confetti.splice(i, 1); continue; }
    R(g, p.x, p.y, Math.floor(now * 6 + i) % 2 ? 2 : 1, 1, p.c);
  }
}
const _rw = renderWorld;
renderWorld = function (t) { _rw(t); try { post(t); } catch (e) { /* ignore */ } };

// ---------------------------------------------------------------- costumes (Oct 31: everyone; El Jefe keeps his hat) + B1 staff
if (MAIN && window.__social && window.__social.addOutfitHook) window.__social.addOutfitHook((id, o, day) => {
  if (id === "tech" || id === "courier") return;
  const m = +day.slice(5, 7), d = +day.slice(8, 10);
  if (m !== 10) return;
  if (d === 31) {
    if (id === "grok") { o.top = "cape"; return; }
    if (RI[id]) { o.top = "cape"; o.costume = null; return; }
    const cs = c31(day)[id] || "witch";
    o.costume = HAT_COSTUMES.has(cs) ? cs : null;
    if (cs === "vampire" && !o.dress) o.top = "cape";
    if (cs === "hero" && !o.dress) o.top = null;
  }
});
// Oct 31 costume spread: date-seeded permutation, at most 2 of each
const HAT_COSTUMES = new Set(["witch", "pumpkin", "horns", "catears", "vampire"]);
const COSTUMES31 = ["witch", "pumpkin", "horns", "catears", "vampire", "ghost", "pirate", "hero", "skeleton"];
let c31Day = null, c31Map = {};
function c31(day) {
  if (c31Day === day) return c31Map;
  const ids = ORDER.filter((id) => id !== "grok" && id !== "tech" && id !== "courier" && !RI[id] && !(CAST[id] && CAST[id].visitor))
    .sort((x, y) => fnv(day + ":" + x + ":c31") - fnv(day + ":" + y + ":c31"));
  const off = Math.floor(fnv(day + ":c31o") * COSTUMES31.length);
  c31Map = {}; ids.forEach((id, i) => { c31Map[id] = COSTUMES31[(off + i) % COSTUMES31.length]; }); c31Day = day;
  return c31Map;
}
if (MAIN) {   // full-body costumes drawn over the character (Oct 31 only)
  const _dcc = drawChar;
  drawChar = function (c, t) {
    _dcc(c, t);
    const dt = D(); if (dt.m !== 10 || dt.d !== 31 || c.hidden) return;
    const sitting = (c.pose === "sit" || c.pose === "feetup") && !c.moving && !c.path.length, couch = c.pose === "couch" && !c.moving && !c.path.length;
    const fx = Math.round(c.x), fy = Math.round(c.y + (sitting ? 3 : couch ? 4 : 6)), x0 = fx - 7, top = fy - 24, N = c.face === "N";
    if (RI[c.id]) { if (!N) { R(g, x0 + 1, top + 4, 12, 2, "#111"); R(g, x0 + 3, top + 5, 2, 1, "#f1c27d"); R(g, x0 + 9, top + 5, 2, 1, "#f1c27d"); } return; }
    const cs = c31(dt.k)[c.id];
    if (cs === "ghost") {
      R(g, x0 + 2, top - 2, 10, 2, "#f8fafc"); R(g, x0 + 1, top, 12, sitting ? 18 : 21, "#f1f5f9");
      for (let i = 0; i < 4; i++) R(g, x0 + 1 + i * 3, top + (sitting ? 18 : 21), 2, 1, "#e2e8f0");
      if (!N) { R(g, x0 + 4, top + 4, 2, 2, "#111"); R(g, x0 + 8, top + 4, 2, 2, "#111"); R(g, x0 + 6, top + 8, 2, 2, "#334155"); }
    } else if (cs === "pirate") {
      R(g, x0 + 1, top - 1, 12, 3, "#dc2626"); R(g, x0 + 3, top, 1, 1, "#fff"); R(g, x0 + 8, top, 1, 1, "#fff");
      if (!N) { R(g, x0 + 2, top + 4, 10, 1, "#111"); R(g, c.face === "W" ? x0 + 3 : x0 + 8, top + 4, 3, 3, "#111"); }
      else R(g, x0 + 12, top, 2, 4, "#dc2626");
    } else if (cs === "hero") {
      if (!N) { R(g, x0 + 2, top + 4, 10, 2, "#1d4ed8"); R(g, x0 + 3, top + 5, 2, 1, "#fff"); R(g, x0 + 9, top + 5, 2, 1, "#fff"); R(g, x0 + 5, top + 12, 4, 3, "#facc15"); R(g, x0 + 6, top + 13, 2, 1, "#dc2626"); }
      R(g, x0, top + 10, 14, 1, "#dc2626"); if (N) R(g, x0 + 1, top + 11, 12, 10, "#dc2626");
    } else if (cs === "skeleton") {
      R(g, x0 + 2, top + 11, 10, 8, "#111"); if (!N) { R(g, x0 + 6, top + 11, 2, 8, "#f1f5f9"); for (let i = 0; i < 3; i++) R(g, x0 + 3, top + 12 + i * 2, 8, 1, "#f1f5f9"); }
      if (!N) { R(g, x0 + 4, top + 4, 2, 2, "#111"); R(g, x0 + 8, top + 4, 2, 2, "#111"); R(g, x0 + 5, top + 8, 4, 1, "#f8fafc"); }
    }
  };
}
if (ON_B1) {
  const _dc = drawChar;
  drawChar = function (c, t) {
    _dc(c, t);
    if (c.id === "nancy") return;
    const dt = D(); if (dt.m !== 10) return;
    const p = dt.d === 31 ? 1 : dt.d >= 24 ? 0.3 : 0;
    if (fnv(dt.k + ":" + c.id + ":b1c") >= p) return;
    const sitting = c.pose === "sit" && !c.moving && !c.path.length, fx = Math.round(c.x), fy = Math.round(c.y + (sitting ? 3 : 6)), x0 = fx - 7, top = fy - 24;
    if (c.face !== "N") { R(g, x0 + 1, top + 4, 12, 2, "#111"); R(g, x0 + 3, top + 5, 2, 1, "#f1c27d"); R(g, x0 + 9, top + 5, 2, 1, "#f1c27d"); }   // masquerade mask
    R(g, x0, top + 10, 14, 1, "#7f1d1d"); if (c.face === "N") R(g, x0 + 1, top + 11, 12, 9, "#111");   // cape
  };
}

// ---------------------------------------------------------------- office events with characters (main): copier tech, fire drill
let drill = null, stressT0 = null, sawStress = false;
function hoursIn(t0, len) { const h = hourNow(); return t0 != null && h >= t0 && h < t0 + len; }
function copierBroken() { const ev = events(); return !!ev.copier && !(chars.tech && chars.tech.fixedDay === D().k); }
if (MAIN) {
  CAST.tech = { name: "TECH", skin: "#8d5524", hair: "#222", shirt: "#4b6584", pants: "#3c5070", acc: "tech", visitor: 1 };
  COL.tech = "#9fb3c8"; ROLE_SHORT.tech = "copier technician (cosmetic)";
  chars.tech = { id: "tech", tx: 0, ty: 0, x: 0, y: 0, path: [], moving: false, from: null, goal: null, task: null, face: "S", pose: "stand", hidden: true, wait: 0, walkT: 0,
    bubble: null, emote: null, emoteUntil: 0, jumpUntil: 0, nextErrand: 0, homeKey: null, idleSince: 0, speed: 3.4, placed: false, arrivedAt: 0 };
  ORDER.push("tech");
  if (window.__social && window.__social.addOutfitHook) window.__social.addOutfitHook((id, o) => { if (id === "tech") { Object.assign(o, CAST.tech); delete o.top; delete o.hat2; delete o.costume; delete o.inner; } });
  const techWanted = () => {
    if (STRESS) return stressT0 != null && T - stressT0 > 30 && T - stressT0 < 140;
    const ev = events(); if (!ev.copier || chars.tech.fixedDay === D().k) return false;
    if (ev.copier.t0 == null) ev.copier.t0 = hourNow() - 1e-4;   // forced via ?event=copier: arrives right away (works with a frozen ?hour too)
    return hoursIn(ev.copier.t0, 0.2);
  };
  const copierSpot = () => !spotBusy("copier", "tech") ? SPOTS.copier : !spotBusy("copier_2", "tech") ? SPOTS.copier_2 : riNearSpot(SPOTS.copier, "tech");
  function techDirector(c) {
    const want = techWanted();
    if (c.hidden) {
      if (!want) return;
      const d = SPOTS.door; if (occ.has(I(d.x, d.y))) return;
      c.hidden = false; place(c, d.x, d.y); c.task = null; c.goal = null; c.pose = "stand"; c.since = T;
      const sp = copierSpot(); if (sp) setTask("tech", [{ spot: sp, dur: 60, say: "COPIER REPAIR. ONE SEC" }], "fixes the copier");
      amb("tech", "copier technician arrives (cosmetic)"); return;
    }
    if (!want || T - c.since > 900) {
      if (!(c.task && c.task.label === "leave")) { setTask("tech", [{ spot: SPOTS.door, dur: 0, leave: true, say: "ALL FIXED!" }], "leave"); if (!STRESS) c.fixedDay = D().k; }
    } else if (!c.task) { const sp = copierSpot(); if (sp) setTask("tech", [{ spot: sp, dur: 60 }], "fixes the copier"); }
    if (c.task) runTask(c);
  }
  const _dir = director;
  director = function (c) { if (c.id === "tech") return techDirector(c); return _dir(c); };
  const _pres = present;
  present = function (id) { return id === "tech" ? false : _pres(id); };
  const _amb = amb;
  amb = function (id, msg) { if (id === "tech" && msg === "heads home") msg = "copier fixed, technician leaves"; _amb(id, msg); };
  const _where = whereIs;
  whereIs = function (id) { if (id === "tech") return chars.tech.hidden ? "not here" : "fixing the copier"; return _where(id); };
  const _rp = renderPanel;
  renderPanel = function () { _rp(); const r = $("roster"); if (r) { const x = r.querySelector('[data-bot="tech"]'); if (x) x.remove(); } };
  const _dch = drawChar;
  drawChar = function (c, t) {
    _dch(c, t);
    if (c.id !== "tech") return;
    const fx = Math.round(c.x), fy = Math.round(c.y + 6), x0 = fx - 7, top = fy - 24, hx = c.face === "W" ? x0 - 4 : x0 + 12;
    R(g, x0 + 1, top - 2, 12, 4, "#6b7280"); R(g, hx, top + 14, 6, 4, "#dc2626"); R(g, hx + 2, top + 13, 2, 1, "#111");   // cap + toolbox
  };
  // fire drill: alarm strobe, everyone files out the door, comes back ~1.5 min later (cosmetic only)
  function startDrill() {
    drill = { until: T + (STRESS ? 50 : 90) };
    amb("goldie", "fire drill! everyone walks out (cosmetic only)");
    const who = ORDER.filter((id) => vis(id) && !RI[id] && id !== "courier" && id !== "tech");
    who.forEach((id, i) => {
      const c = chars[id]; c.awayUntil = drill.until + i * 1.2; c.awayWhy = "walks out for the fire drill";
      setTask(id, [{ spot: SPOTS.door, dur: 0, leave: true, say: i < 3 ? ["FIRE DRILL! WALK, DON'T RUN", "GRAB NOTHING. JUST WALK", "DRILL ONLY, FOLKS. CALM"][i] : null }], "fire drill");
    });
  }
  function seasonTick() {
    if (STRESS && !sawStress) { sawStress = true; stressT0 = T; drill = null; }
    if (!STRESS && sawStress) { sawStress = false; stressT0 = null; }
    if (drill && T > drill.until) drill = null;
    if (!drill) {
      if (STRESS) { if (stressT0 != null && Math.abs(T - stressT0 - 200) < 0.02) startDrill(); }
      else { const ev = events(); if (ev.fire && ev.fire.done !== D().k) { if (ev.fire.t0 == null) ev.fire.t0 = hourNow() - 1e-4; if (hoursIn(ev.fire.t0, 0.03)) { ev.fire.done = D().k; startDrill(); } } }
    }
  }
  const _step = step;
  step = function (dt) { _step(dt); try { seasonTick(); } catch (e) { /* ignore */ } };
}
let fridayAt = -1e9;
function fridayCheer() {
  if (!MAIN || T - fridayAt < 120) return; fridayAt = T;
  for (const id of ORDER) if (vis(id) && typeof emote === "function" && !RI[id] && id !== "tech") { emote(id, "cheer", 3); chars[id].jumpUntil = T + 1.2; }
}

// ---------------------------------------------------------------- voice lines (banter reacts to the decor/events/weather)
const SL = {
  halloween: ["Who put a pumpkin on my desk?", "This pumpkin has better risk mgmt", "Spooky season, spooky charts", "My portfolio is the scariest costume",
    "Trick or trade?", "Candy corn is a value trap", "I'm dressing up as a green candle", "Pumpkin spice alpha, baby", "Ghost of trades past says hi",
    "Witching hour is 3:30 PM", "No tricks. Only stop losses", "Count candy, not trades", "Is that a bat or a bear?"],
  halloween2: ["Cobwebs on the copier again", "Those lights are so orange", "Bats near the windows. Normal", "Who carved this one? Cute"],
  halloween3: ["The skeleton is joining lunch", "That skeleton held through 2008", "Skeleton has diamond bones", "Even the skeleton is long SPY"],
  halloween31: ["Happy Halloween, everyone!", "Costume contest at 4. Goldie judges", "Nobody recognizes me. Perfect", "Best costume gets a plaque!", "I came as a bull market"],
  hwchar: { zip: ["Pumpkins to zero! 100%. Again", "My costume? A correct call"], grok: ["Costume? This hat IS the costume", "Scariest thing? Below Monday"],
    goldie: ["Best costume gets a plaque, hon", "Candy jar is full. Take one!"], knobs: ["Overfit costume detected", "I tuned the pumpkin to 92%"],
    pixel: ["My costume: a 404 error", "Bats in the server rack again"], indy: ["Costume: buy-and-hold zombie", "Index funds don't scare"], nancy: ["Lucky guess on the candy, dear"] },
  harvest: ["Thankful for green days", "Pie chart? I prefer pie", "Gobble gobble, bull bull", "Leaves fall. Prices too?", "Stuffing my watchlist", "Gourds on every desk. Cozy"],
  thanksgiving: ["Short week, long naps", "Who's bringing the pie?", "Thankful for stop losses"],
  holiday: ["Tree looks great this year", "Secret gift swap at 3!", "Ugly sweater, pretty P&L", "Snow outside, green inside", "Who keeps eating the cookies?", "Happy holidays, team!", "Look at those lights!"],
  party: ["Holiday party vibes!", "Santa rally? Fingers crossed", "Gifts under the tree. Mine?", "Cocoa and confetti!"],
  newyear: ["Happy New Year, team!", "New year, same stop losses", "Confetti in my keyboard still", "Resolution: fewer hail marys"],
  winter: ["Winter mode. Cocoa engaged", "Cold outside. Hot coffee", "Snowflakes on the windows. Nice"],
  valentine: ["Who left chocolates on my desk?", "Roses are red, so was Tuesday", "Be my valentine, VWAP", "Hearts on the wall. Cute"],
  stpat: ["Feeling lucky. Shamrock lucky", "Pot of gold? Paper gold", "Wear green or get pinched", "Green candles only today"],
  spring: ["Spring flowers, spring rally?", "Something's blooming on my desk", "Allergy season. Achoo!", "Butterflies by the window!"],
  summerstart: ["Summer's almost here!", "Sunglasses on, risk off", "Lemonade: very liquid"],
  july4: ["Happy Fourth, everyone!", "Fireworks tonight!", "Red, white and green candles"],
  summer: ["Too hot. Market's sleepy too", "Beach ball in the office? Bold", "August volume. Vacation mode"],
  fall: ["Back to school! New notebook", "Apple on my desk. Not the stock", "Fall vibes. Pumpkin spice soon"],
  rain: ["Rainy day. Perfect for charts", "Forgot my umbrella again", "Raining outside, red inside?"],
  snow: ["Snow day! Still at work though", "Look at all that snow!", "Snowball fight after the close?"],
  birthday: ["Happy birthday, {X}!", "Cake in the break room! {X}'s day", "Make a wish, {X}!", "Balloons on {X}'s desk!"],
  birthdayMe: ["Thanks for the cake, team!", "Birthday trade: cake. Long cake"],
  copier: ["Copier's broken. Again", "Paper jam. Classic", "I'll just print... oh no", "Tech is coming for the copier"],
  plant: ["New plant! I'll name it Alpha", "Who brought the new plant?", "Nice new plant, {X}"],
  pizza: ["Who left this pizza box?", "Empty pizza box. So sad", "Pizza box from yesterday? Gross"],
  green: ["Big green day! Confetti!", "Somebody ring the bell!", "Floor feels green today"],
  red: ["Rough day. Even the lights look red", "Red day. Deep breaths"],
  friday: ["Weekly rule passed! Tacos!", "Green week! El Jefe is smiling", "Friday close: we did it!"],
};
function linesFor(id) {
  const dt = D(), th = dt.theme, ev = events(), out = [];
  const add = (a) => { if (a) for (const x of a) out.push(x); };
  add(SL[th.id] && th.id !== "halloween" ? SL[th.id] : null);
  if (th.id === "halloween") { add(SL.halloween); if (th.lvl >= 2) add(SL.halloween2); if (th.lvl >= 3) add(SL.halloween3); if (th.lvl >= 4) { add(SL.halloween31); add(SL.halloween31); } add(SL.hwchar[id]); }
  if (th.id === "harvest" && th.tday) add(SL.thanksgiving);
  if (th.id === "holiday" && th.party) add(SL.party);
  if (dt.weather === "rain") add(SL.rain); if (dt.weather === "snow") add(SL.snow);
  const nm = (p) => (CAST[p] ? CAST[p].name : String(p).toUpperCase());
  if (ev.birthday) add(ev.birthday === id ? SL.birthdayMe : SL.birthday.map((s) => s.replace(/\{X\}/g, nm(ev.birthday))));
  if (ev.plant && ev.plant !== id) add(SL.plant.map((s) => s.replace(/\{X\}/g, nm(ev.plant))));
  if (ev.pizza) add(SL.pizza.slice(0, 2));
  if (MAIN && copierBroken()) add(SL.copier);
  if (MAIN) { const f = flair(); if (f.friday) { add(SL.friday); add(SL.friday); } else if (f.pnl >= 150) add(SL.green); else if (f.pnl <= -150) add(SL.red); }
  return out;
}
if (MAIN && window.__social && window.__social.addLineHook) window.__social.addLineHook(linesFor);
if (ON_B1 && typeof IDLE !== "undefined") {   // B1 has no banter engine: seasonal lines join its idle chatter
  const base = IDLE.slice(); let k = null;
  const refresh = () => { const kk = D().k; if (kk === k) return; k = kk; IDLE.length = 0; for (const x of base) IDLE.push(x); for (const x of linesFor("scoop").slice(0, 10)) IDLE.push(x); };
  refresh(); setInterval(refresh, 60000);
}
window.__seasons = { D, events, linesFor, themeOf, LINES: SL, override: window.TND.override };
})();
