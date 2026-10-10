"use strict";
/* Research Inc. B1 - RimWorld-inspired vector art for the basement office (drawing layer only; b1.js simulation untouched).
   Needs rim_common.js. Nothing readable in the room except speech bubbles + name tags: boards, TVs, signs and plaques are
   decorative shapes/icons; the real content lives in the side panel. Original art, no external assets. */
(function () {
if (!window.RIM || !window.RIM.on) return;
const R_ = window.RIM, P = R_.P;
const { rr, shadow, box, circ, ell, line, poly, hex, mute, planks, tiles, speckle, rug, wallSeg, glassSeg, plant, chair, screen, INK, RIC } = P;
const X = () => P.ctx();
const T16 = TS, tx = (n) => n * T16;
const S5 = () => R_.season();
const { wtext, marquee, short, money0, stairSign, frame, icoMagnifier, icoArrowUp, scribble, bunting, deskTop, mug, balloons, upNote, WOOD } = R_.D;
const isUp = (id) => { const c = chars[id]; if (!c || !c.hidden) return false; if (id === "nancy") return true; try { return !!activeTrip(id); } catch (e) { return false; } };

// ---------------------------------------------------------------- decorative wall pieces (no text)

// ---------------------------------------------------------------- static layer
function drawStatic() {
  const x = X(), rnd = R_.rng(1337), se = S5(), th = se.theme.id, ev = se.ev || {};
  // floors
  speckle(16, 48, LW - 32, LH - 64, "#56686c", 1500, rnd, "rgba(20,30,34,.10)");
  planks(tx(6), tx(4), tx(9), tx(6), "#8c6b4a", "rgba(40,24,10,.38)", rnd); planks(tx(18), tx(4), tx(7), tx(5), "#8c6b4a", "rgba(40,24,10,.38)", rnd);
  x.strokeStyle = "rgba(63,208,220,.55)"; x.lineWidth = 0.6; x.strokeRect(tx(6) + 0.5, tx(4) + 0.5, tx(9) - 1, tx(6) - 1); x.strokeRect(tx(18) + 0.5, tx(4) + 0.5, tx(7) - 1, tx(5) - 1);
  tiles(16, tx(13), tx(4), tx(4), "#ece6d8", "#d9d0bd", "rgba(60,50,40,.16)", 8);
  rug(tx(9) + 5, tx(10) + 5, tx(7) - 10, tx(4) - 10, "#35626c", "#a8dbe0");
  box(tx(4) + 4, tx(12) + 4, tx(5) - 8, tx(2) - 7, 1, "#5d503f", { shadow: false, shade: false, stroke: "rgba(0,0,0,.35)", lw: 0.3 });
  rug(tx(1) + 2, tx(4) + 3, tx(5) - 3, tx(5) - 5, "#6e4a78", "#e6bde9");   // game corner rug with confetti dots
  for (let i = 0; i < 26; i++) circ(tx(1) + 5 + rnd() * (tx(5) - 12), tx(4) + 6 + rnd() * (tx(5) - 12), 0.55, ["#f7e08a", "#8fd3e8", "#f4a6c0"][i % 3], { shadow: false, stroke: false, shade: false });
  // Nancy's corner office: pale oak, lilac rug with gold edge, door threshold
  planks(tx(20), tx(13), tx(5), tx(4), "#e3cfb2", "rgba(120,90,50,.25)", rnd);
  rug(tx(20) + 6, tx(14) + 2, tx(4) - 4, tx(3) - 6, "#cdb0da", "#c79a3a");
  box(tx(21) + 2, tx(12) + 3, 12, 11, 0.8, "#cdb98f", { shadow: false, lw: 0.3 });
  // stair landing mat (icon only)
  // walls: tall north wall with boards, side + south walls, stairs cut into the south wall
  const wcol = "#4a5559";
  x.fillStyle = "#6b7b80"; x.fillRect(0, 0, LW, 48); x.fillStyle = "rgba(0,0,0,.06)"; for (let a = 0; a < LW; a += 12) x.fillRect(a, 3, 0.5, 33);
  x.fillStyle = "#3d3329"; x.fillRect(0, 36, LW, 12); x.fillStyle = "#5c4d3d"; x.fillRect(0, 36, LW, 1.6); x.fillStyle = RIC; x.fillRect(0, 37.4, LW, 0.7);
  x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, 46.6, LW, 1.4);
  wallSeg(0, 0, LW, 3.2, "#2f383b"); wallSeg(0, 0, 16, LH, wcol); wallSeg(LW - 16, 0, 16, LH, wcol);
  wallSeg(0, LH - 16, tx(15) - 1, 16, wcol); wallSeg(tx(18) + 1, LH - 16, LW - tx(18) - 1, 16, wcol);
  for (let i = 0; i < 4; i++) { const yy = LH - 4 - i * 4; box(tx(15), yy - 3.6, 48, 4, 0.4, hex("#7d929b", 1 - i * 0.12), { shadow: false, lw: 0.3 }); }
  line([tx(15) - 0.5, LH - 18, tx(15) - 0.5, LH], "#c79a3a", 1.2); line([tx(18) + 0.5, LH - 18, tx(18) + 0.5, LH], "#c79a3a", 1.2);
  // north wall boards (decorative)
  frame(14, 5, 84, 30, "#1a1f24", "#33302c");                                         // news wall: 6 TVs (animated in dynamic)
  frame(102, 10, 18, 14, "#174a54", "#2a3c40"); wtext("B1", 111, 11, { size: 6, col: RIC, align: "center", w: 800 }); wtext("RI", 111, 18, { size: 4, col: "#bff8ff", align: "center", w: 800 });   // B1 / RI sign
  frame(126, 7, 60, 26, "#2b4636", "#6a4a2c");                                        // earnings chalkboard: calendar grid + bars
  frame(198, 7, 66, 26, "#b48a56", "#6a4a2c");                                         // ideas corkboard (sticky notes in dynamic)
  for (let i = 0; i < 60; i++) { x.fillStyle = "rgba(90,60,30,.25)"; x.fillRect(199 + rnd() * 64, 8 + rnd() * 24, 0.6, 0.6); }
  // clerestory window (ground-level basement window) - sky in dynamic
  frame(268, 8, 26, 16, "#9fc6d8", "#3b3a38");
  frame(300, 7, 82, 26, "#f4f6f2", "#8f989d");                                          // Proof's whiteboard: scribbles + checkmarks
  box(310, 32.5, 50, 1.6, 0.5, "#7a8288", { shadow: false, lw: 0.2 });
  circ(394, 18, 6.2, "#efe8d2", { lw: 0.6 });   // wall clock (hands in dynamic)
  frame(132, LH - 13, 100, 9, "#0b0f12", "#2b2b2b");   // LED strip on the south wall (dots animate)
  frame(tx(21) + 1, LH - 12, 46, 7, "#c79a3a", "#7a5a12"); wtext("N. OFFICE", tx(21) + 24, LH - 8.5, { size: 4.2, col: "#5a1e3a", align: "center", base: "middle", w: 800, maxW: 42 });   // Nancy's brass plaque
  // wall art: small framed prints on the side walls
  frame(3, 70, 9, 13, "#e9c46a", "#4a3a2c"); poly([4.5, 81, 7.5, 74, 10.5, 81], "#2a9d8f", { lw: 0.25 });
  frame(LW - 12, 100, 9, 13, "#f4a6c0", "#4a3a2c"); circ(LW - 7.5, 106.5, 2.4, "#e76f51", { lw: 0.25, shadow: false });
  if (th) bunting(th, 39.5);
  // furniture (static parts), chairs
  for (const id in CHAIRS) { const [cx, cy] = CHAIRS[id]; chair(tx(cx) + 8, tx(cy) + 9, 0, id === "nancy" ? "#e9d6e0" : "#4b5a63"); }
  for (const f of FURN) { const fn = ART[f.type]; try { if (fn && fn.s) fn.s(f, ev); else if (!fn) box(tx(f.x) + 1, tx(f.y) + 1, tx(f.w) - 2, tx(f.h) - 2, 1.4, "#8b8f94"); } catch (e) { console.warn("rim b1 art", f.type, e); } }
}

// ---------------------------------------------------------------- furniture art: s = static (cached), d = per-frame bits
const ART = {
  desk: { s(f, ev) { const px = tx(f.x), py = tx(f.y), id = f.who; deskTop(px, py, 48);
      box(px + 16, py + 2.2, 15, 3.2, 0.6, "#d9dde0", { shadow: false, lw: 0.28 }); screen(px + 24, py + 7.2, 17, false);
      box(px + 4, py + 3, 8, 6, 0.4, "#f4f1e8", { lw: 0.25, blur: 0.6 }); box(px + 5.2, py + 4.2, 8, 6, 0.4, "#fbfaf4", { lw: 0.25, blur: 0.6 });
      box(px + 34.5, py + 3, 6, 7.5, 0.6, COL[id] || "#999", { lw: 0.25, blur: 0.6 }); mug(px + 43, py + 5.5);
      plant(px + 43.5, py + 11.5, 0.7, "#6f8f5a", ev.plant === id ? "#f2a7c8" : "#8a6248"); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), c = chars[f.who]; if (!c) return; const on = !c.hidden && atSpot(c, home(f.who)), work = c.workUntil > T;
      if (on || work) { const x = X(); x.save(); x.globalAlpha = 0.9; screen(px + 24, py + 7.2, 17, true); x.globalCompositeOperation = "lighter"; const gr = x.createRadialGradient(px + 24, py + 5, 0.5, px + 24, py + 3, 12); gr.addColorStop(0, "rgba(120,230,255,.35)"); gr.addColorStop(1, "rgba(120,230,255,0)"); x.fillStyle = gr; x.fillRect(px + 10, py - 9, 28, 16); x.restore(); }
      if (work && Math.floor(t * 6) % 2) circ(px + 20 + ((t * 13) % 8), py + 3.8, 0.45, "#5c6670", { shadow: false, stroke: false, shade: false });
      if (isUp(f.who)) upNote(px + 15, py + 3);
      const se = S5(); if (se.ev && se.ev.birthday === f.who) balloons(px + 45, py + 2, t); } },
  podsign: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 3, py + 1, 10, 13, 1.4, "#2b3a40", { blur: 1.6 }); circ(px + 8, py + 6.5, 3.8, "#174a54", { shadow: false, stroke: RIC, lw: 0.4 }); icoMagnifier(px + 8.4, py + 6.8, 0.8, RIC); } },
  podplant: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1.5, py + 3, 13, 10, 1.4, "#6b5644", { blur: 1.6 }); plant(px + 5, py + 7, 0.9, "#5f8f52"); plant(px + 11, py + 8, 0.8, "#7aa060"); } },
  cred: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1, py + 1, 14, 13, 1.2, "#7a5a3c", { blur: 1.6 }); for (let i = 0; i < 2; i++) { box(px + 2.5, py + 2.5 + i * 5.5, 11, 4.4, 0.6, "#3d4246", { shadow: false, lw: 0.25 }); box(px + 3.5, py + 3 + i * 5.5, 9, 2.6, 0.3, i ? "#f4c9c4" : "#c9ecd2", { shadow: false, lw: 0.2 }); } } },
  score: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 2, py + 1, 28, 12, 1, "#2e3a40", { blur: 1.8 }); box(px + 3.5, py + 2.5, 25, 9, 0.6, "#f4f6f2", { shadow: false, lw: 0.25 });
    },
    d(f) { const px = tx(f.x), py = tx(f.y), cl = LV("calls", DATA && DATA.calls) || {}, sm = R_.small(), v = cl.hit_rate != null ? Math.round(cl.hit_rate * 100) + "% HIT" : cl.total ? cl.open + " OPEN" : "NONE YET";
      wtext("CALLS", px + 16, py + 3, { size: sm ? 4.4 : 3.4, col: "#a8761c", align: "center", w: 800 }); wtext(v, px + 16, py + (sm ? 7.4 : 7), { size: sm ? 3.8 : 3.3, col: cl.hit_rate != null ? "#1f7a43" : "#55626a", align: "center", maxW: 24, shrink: 2.6 }); } },
  table: { s(f, ev) { const px = tx(f.x), py = tx(f.y), w = tx(f.w), h = tx(f.h); box(px + 2, py + 1, w - 4, h - 4, 7, "#8a6340", { blur: 2.2, oy: 1.2 }); box(px + 4, py + 3, w - 8, h - 8, 5, "#9c7249", { shadow: false, stroke: "rgba(40,24,10,.4)", lw: 0.3 });
      box(px + 10, py + 9, 9, 6, 0.6, "#2f3438", { lw: 0.25 }); box(px + 10.6, py + 9.6, 7.8, 4, 0.4, "#9fd6dc", { shadow: false, stroke: false }); box(px + 26, py + 12, 6, 8, 0.4, "#f4f1e8", { lw: 0.25 }); mug(px + 36, py + 9);
      if (ev.pizza) { box(px + 18, py + 16, 11, 9, 0.6, "#d9b98a", { lw: 0.3 }); circ(px + 23.5, py + 20.5, 3.6, "#e8b04b", { lw: 0.25, shadow: false }); for (let i = 0; i < 4; i++) circ(px + 22 + (i % 2) * 3, py + 19.5 + (i >> 1) * 2.2, 0.55, "#c0392b", { shadow: false, stroke: false, shade: false }); }
      if (ev.birthday) { circ(px + 40, py + 19, 3.2, "#f4f1ea", { lw: 0.3 }); circ(px + 40, py + 19, 2.2, "#f4a6c0", { shadow: false, stroke: false }); line([px + 40, py + 15.6, px + 40, py + 13.6], "#f2c94c", 0.5); } } },
  coffee: { s(f) { const px = tx(f.x), py = tx(f.y), w = tx(f.w); box(px, py - 2, w, 15, 1, "#cfc8b8", { blur: 1.8 }); X().fillStyle = "#8f877a"; X().fillRect(px, py + 10.5, w, 2.5);
      box(px + 3, py - 4, 12, 10, 1.4, "#3b3f44", { lw: 0.35 }); circ(px + 9, py + 1, 2.2, "#22262a", { shadow: false, lw: 0.3 }); box(px + 7, py + 5, 4, 2, 0.4, "#9aa3a8", { shadow: false, lw: 0.2 });
      box(px + 19, py + 0, 10, 7, 1.4, "#b8c4cc", { lw: 0.3 }); ell(px + 24, py + 3.5, 3.4, 2.2, 0, "#7f8b93", { lw: 0.25 });   // sink
      ell(px + 37, py + 4, 4.2, 3, 0, "#e9dfc9", { lw: 0.3 }); circ(px + 35.5, py + 3.6, 1.3, "#e55d4b", { lw: 0.2, shadow: false }); circ(px + 38.4, py + 4.4, 1.3, "#f2c94c", { lw: 0.2, shadow: false }); circ(px + 37, py + 2.6, 1.1, "#7bbf5a", { lw: 0.2, shadow: false });
      for (let i = 0; i < 3; i++) mug(px + 32 + i * 4, py + 9, ["#f4f1ea", RIC, "#f2c94c"][i]); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), x = X(); x.save(); x.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2); for (let i = 0; i < 2; i++) { const yy = py - 7 - ((t * 5 + i * 3) % 6); ell(px + 8 + i * 2, yy, 1.1, 1.7, 0, "#ffffff", { stroke: false }); } x.restore(); } },
  rack: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1, py - 4, 14, tx(f.h) + 2, 1.2, "#2a2f33", { blur: 2 }); for (let i = 0; i < 7; i++) box(px + 2.5, py - 2 + i * 6.8, 11, 5.4, 0.5, "#3a4146", { shadow: false, lw: 0.25 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y); for (let i = 0; i < 7; i++) for (let k = 0; k < 3; k++) { const on = Math.floor(t * 3 + i * 1.7 + k * 2.3) % 4 !== 0; circ(px + 5 + k * 2.4, py + 0.7 + i * 6.8, 0.5, on ? (k === 2 ? "#f2c94c" : "#5fe08a") : "#24402c", { shadow: false, stroke: false, shade: false }); } } },
  cooler: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 3.5, py - 1, 9, 14, 1.4, "#e7ecef", { blur: 1.6 }); circ(px + 8, py - 3, 4, "#8fd3f2", { lw: 0.35 }); ell(px + 6.8, py - 4.2, 1, 1.6, 0.4, "rgba(255,255,255,.6)", { stroke: false }); circ(px + 6, py + 4, 0.8, "#3b82f6", { shadow: false, lw: 0.2 }); circ(px + 10, py + 4, 0.8, "#e5534b", { shadow: false, lw: 0.2 }); } },
  archive: { s(f) { const px = tx(f.x), py = tx(f.y); for (let i = 0; i < f.w; i++) { box(px + i * 16 + 1, py - 2, 14, 15, 1, "#7c868c", { blur: 1.6 }); for (let k = 0; k < 3; k++) { box(px + i * 16 + 2.5, py - 0.6 + k * 4.4, 11, 3.6, 0.4, "#9aa4aa", { shadow: false, lw: 0.22 }); box(px + i * 16 + 6.5, py + 0.4 + k * 4.4, 3, 1, 0.3, ["#e9c46a", "#8fd3e8", "#f4a6c0"][(i + k) % 3], { shadow: false, stroke: false }); } } } },
  tube: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 5, py - 6, 6, 20, 2.5, "#b8c7ce", { blur: 1.6, lw: 0.35 }); box(px + 3, py + 4, 10, 9, 1.4, "#7a8a92", { lw: 0.35 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), k = (t * 0.6) % 1; if (k < 0.5) box(px + 6, py + 8 - k * 26, 4, 5, 1.6, "#e9c46a", { lw: 0.25, shadow: false }); } },
  printer: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 2, py - 3, 28, 15, 1.6, "#d4d8db", { blur: 1.8 }); box(px + 6, py - 6, 20, 5, 0.6, "#fbfaf6", { lw: 0.3 }); box(px + 4, py + 6.5, 24, 3, 0.6, "#3a3d44", { shadow: false, lw: 0.25 }); },
    d(f, t) { circ(tx(f.x) + 26, tx(f.y) + 0.5, 0.8, Math.floor(t * 1.5) % 2 ? "#5fe08a" : "#2c6b45", { shadow: false, lw: 0.2 }); } },
  plant: { s(f) { const px = tx(f.x), py = tx(f.y); plant(px + 8, py + 8, f.big ? 2.1 : 1.6, f.big ? "#5f8f52" : "#6f9a5a"); } },
  pingpong: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 2, py + 2, 44, 27, 1.4, "#2f7d66", { blur: 2.2 }); const x = X(); x.strokeStyle = "#eef5f2"; x.lineWidth = 0.6; x.strokeRect(px + 3.5, py + 3.5, 41, 24); line([px + 3.5, py + 15.5, px + 44.5, py + 15.5], "rgba(238,245,242,.7)", 0.35); box(px + 23, py + 0.5, 2, 30, 0.5, "#e8ecef", { lw: 0.3, blur: 0.8 }); },
    d(f, t) { const a = chars && Object.values(chars).find((c) => !c.hidden && atSpot(c, SPOTS.pong_1)), b = Object.values(chars).find((c) => !c.hidden && atSpot(c, SPOTS.pong_2)); if (!a || !b) return;
      const k = (t * 1.2) % 2, u = k < 1 ? k : 2 - k, bx = tx(f.x) + 5 + u * 38, by = tx(f.y) + 15 + Math.sin(u * Math.PI * 3) * 6 - Math.abs(Math.sin(u * Math.PI * 2)) * 3; circ(bx, by, 1, "#fbfaf4", { lw: 0.25, blur: 1 }); } },
  arcade: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 2, py - 7, 12, 20, 1.6, "#4a347e", { blur: 2 }); box(px + 3, py - 5, 10, 8, 0.6, "#0b1020", { shadow: false, lw: 0.3 }); box(px + 3, py + 5, 10, 4, 0.6, "#2c2c48", { shadow: false, lw: 0.25 }); circ(px + 6, py + 7, 1, "#e5534b", { shadow: false, lw: 0.2 }); circ(px + 10, py + 7, 0.8, RIC, { shadow: false, lw: 0.2 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), x = X(); for (let i = 0; i < 3; i++) { x.fillStyle = ["#ff4fa3", "#5fe08a", "#f2c94c"][i]; x.fillRect(px + 4 + ((t * 7 + i * 3) % 8), py - 4 + i * 2.2, 1.2, 1.2); } } },
  nglassH: { s(f) { const px = tx(f.x), py = tx(f.y); X().fillStyle = "rgba(200,235,255,.16)"; X().fillRect(px, py + 6, tx(f.w), 8); glassSeg(px, py + 12, px + tx(f.w), py + 12); for (let a = px; a <= px + tx(f.w); a += 16) circ(a, py + 12, 0.9, "#c79a3a", { shadow: false, lw: 0.25 }); } },
  nglassV: { s(f) { const px = tx(f.x), py = tx(f.y); X().fillStyle = "rgba(200,235,255,.16)"; X().fillRect(px + 4, py, 8, tx(f.h)); glassSeg(px + 8, py - 4, px + 8, py + tx(f.h)); for (let b = py; b <= py + tx(f.h); b += 16) circ(px + 8, b, 0.9, "#c79a3a", { shadow: false, lw: 0.25 }); } },
  ndesk: { s(f) { const px = tx(f.x), py = tx(f.y); deskTop(px, py, 32, "#f1dfe8"); X().fillStyle = "#c79a3a"; X().fillRect(px + 1, py + 11.2, 30, 0.6);
      box(px + 6, py + 2.2, 11, 3, 0.6, "#e7e2ea", { shadow: false, lw: 0.25 }); screen(px + 12, py + 7.2, 13, false); box(px + 21, py + 8, 7, 2.4, 0.5, "#c79a3a", { lw: 0.25 }); mug(px + 26, py + 4, "#fff"); for (let i = 0; i < 4; i++) circ(px + 3 + i * 1.2, py + 9.5, 0.45, "#fbf7ee", { shadow: false, lw: 0.12 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), c = chars.nancy; if (!c) return; if (!c.hidden) { screen(px + 12, py + 7.2, 13, true, "#5fe08a"); line([px + 7, py + 1, px + 10, py - 0.2, px + 13, py - 0.8, px + 17, py - 2.4], "rgba(95,224,138,.8)", 0.5); } else upNote(px + 15, py + 1); } },
  nshelf: { s(f) { const px = tx(f.x), py = tx(f.y), cols = ["#c1121f", "#1d3557", "#e5b33b", "#2a9d8f", "#f7b8d0", "#6a4c93"]; box(px + 1, py - 6, 14, 37, 1.2, "#6b4a2e", { blur: 2 });
      for (let s = 0; s < 4; s++) { box(px + 2.2, py - 4.6 + s * 8.8, 11.6, 7.6, 0.4, "#4a3020", { shadow: false, stroke: false }); for (let i = 0; i < 4; i++) box(px + 2.8 + i * 2.8, py - 3.8 + s * 8.8, 2.2, 6.6, 0.3, cols[(s * 2 + i) % 6], { shadow: false, lw: 0.15 }); } } },
  nplant: { s(f) { const px = tx(f.x), py = tx(f.y); plant(px + 8, py + 7, 1.8, "#4f8f5a", "#f3e1ea"); } },
  xtree: { s(f) { const px = tx(f.x) + 8, py = tx(f.y) + 10; box(px - 3, py, 6, 4, 0.6, "#b23a3a", { lw: 0.3 }); for (let i = 0; i < 3; i++) poly([px - 8 + i * 2, py - i * 6, px + 8 - i * 2, py - i * 6, px, py - 9 - i * 6], i % 2 ? "#3f7d4c" : "#356b41", { lw: 0.35 }); poly([px, py - 24, px + 1, py - 21.6, px - 1.6, py - 23, px + 1.6, py - 23, px - 1, py - 21.6], "#f2c94c", { lw: 0.2 }); },
    d(f, t) { const px = tx(f.x) + 8, py = tx(f.y) + 10, cols = ["#e5534b", "#f2c94c", "#4a8fe0", "#ffffff"]; for (let i = 0; i < 9; i++) { const yy = py - 2 - (i % 3) * 6 - 2, xx = px + ((i * 37) % 9) - 4.5 + (i % 3); if (Math.floor(t * 2 + i) % 3) circ(xx, yy, 0.8, cols[i % 4], { shadow: false, stroke: false, shade: false }); } } },
};

// ---------------------------------------------------------------- per frame: animated wall pieces, furniture bits
function drawDynamic(t) {
  const x = X(), sig0 = LV("signals", typeof sig === "function" ? sig() : {}) || {};
  const sm = R_.small(), briefs = (DATA && DATA.briefs) || [], evs = (DATA && DATA.events) || [];
  // ---- news wall: 6 TVs with the same real feeds as the pixel version (title + short live line)
  const b0 = LV("brief", briefs[0] || null), tvs = [["BRIEF", b0 ? short(b0.headline || b0.shift || b0.name, 70) : "No briefs yet", "#ffd166"]];
  for (const sym of ["SPY", "QQQ"]) { const k = typeof tick === "function" ? tick(sym) : null; tvs.push([sym, k ? `${k.price.toFixed(2)} ${k.chg_pct >= 0 ? "+" : ""}${(k.chg_pct * 100).toFixed(2)}%` : "No quote", k && k.chg_pct < 0 ? "#ff7b7b" : "#5fe08a"]); }
  tvs.push(["MARKET", short((typeof ST !== "undefined" && ST && ST.market && ST.market.status) || "-").toUpperCase(), "#9ad1ff"]);
  { const n = nextShift(); tvs.push(["NEXT", n ? h12(n.time_et) : "-", "#bff8ff"]); }
  { const le = evs[evs.length - 1]; tvs.push(["SQUAWK", le ? short(le.note || le.type, 60) : "Quiet", "#f4efe0"]); }
  tvs.forEach(([hd, body, col], i) => {
    const a = 16 + (i % 3) * 27, b = 7 + ((i / 3) | 0) * 14; box(a, b, 25, 12, 0.6, "#15181d", { shadow: false, lw: 0.3 }); x.fillStyle = "#081820"; x.fillRect(a + 1, b + 1, 23, 10);
    if (sm) { wtext(hd, a + 12.5, b + 6.2, { size: 4.6, col: RIC, align: "center", base: "middle", maxW: 22, shrink: 3.4, w: 800 }); return; }
    wtext(hd, a + 2, b + 1.6, { size: 3, col: RIC, w: 800, maxW: 21 }); marquee(body, a + 1.6, b + 6.2, 21.8, { size: body.length <= 14 ? 2.6 : 3.2, col, mono: true }, t + i * 3, 8);
  });
  // ---- earnings + macro board
  { const sg = sig0; let er = sg.earnings; if (er && !Array.isArray(er) && typeof er === "object") er = Object.keys(er).map((k) => Object.assign({ ticker: k }, typeof er[k] === "object" ? er[k] : { date: er[k] })); er = Array.isArray(er) ? er : [];
    const mc = Array.isArray(sg.macro_events) ? sg.macro_events : Array.isArray(sg.macro) ? sg.macro : [];
    if (sm) { wtext("EARNINGS", 156, 10, { size: 5, col: "#f2c14e", align: "center", w: 800, maxW: 56 }); wtext("MACRO", 156, 20, { size: 5, col: "#f2c14e", align: "center", w: 800 }); }
    else {
      wtext("EARNINGS", 129, 9, { size: 3.4, col: "#f2c14e", w: 800 });
      if (!er.length) wtext("None yet", 129, 13.4, { size: 3.1, col: "#9fb3a6" });
      er.slice(0, 2).forEach((e, k) => wtext(`${short(e.ticker, 6)} ${short(e.date || "").slice(5)}`, 129, 13.4 + k * 3.9, { size: 3.1, col: "#e8e2cf", mono: true, maxW: 55 }));
      wtext("MACRO", 129, 22.6, { size: 3.4, col: "#f2c14e", w: 800 });
      wtext(mc.length ? short(`${mc[0].time_et || ""} ${mc[0].event || ""}`) : "-", 129, 27, { size: 3.1, col: mc.length && mc[0].impact === "high" ? "#ff8a8a" : "#c9d3cc", maxW: 55 }); } }
  // ---- ideas corkboard: title tab + up to 5 notes (ticker + direction/confidence; AVOID in pink)
  { const notes = (sig0.ideas || []).slice(0, 4).map((v) => [short(v.ticker, 6), v.direction ? short(v.direction, 6).toUpperCase() : v.confidence != null ? String(v.confidence).slice(0, 4) : "", "#fff1a0"])
      .concat((sig0.avoid || []).slice(0, 2).map((v) => [short(v.ticker, 6), "AVOID", "#f8b4b4"]));
    box(201, 8.4, 19, 11, 0.4, "#f4efe0", { lw: 0.25, blur: 0.6, oy: 0.4 }); wtext("IDEAS", 210.5, 13.9, { size: sm ? 4.4 : 3.6, col: "#7a4a1c", align: "center", base: "middle", w: 800, maxW: 18, shrink: 3 });
    if (!notes.length) { box(222, 9, 38, 10, 0.4, "#f4efe0", { lw: 0.25, blur: 0.8, oy: 0.5 }); circ(241, 9.4, 0.9, "#d03030", { lw: 0.2, shadow: false }); wtext(sm ? "NONE" : "No ideas yet", 241, 14.2, { size: sm ? 4.2 : 3.3, col: "#555", align: "center", base: "middle" }); }
    notes.slice(0, 5).forEach(([tk, d, col], i) => { const k = i + 1, a = 201 + (k % 3) * 21, bb = k < 3 ? 8.4 : 20.6;
      box(a, bb, 19, 11, 0.4, col, { lw: 0.25, blur: 0.8, oy: 0.5 }); circ(a + 9.5, bb + 0.4, 0.9, "#d03030", { lw: 0.2, shadow: false });
      wtext(tk, a + 9.5, bb + 2, { size: sm ? 4.4 : 3.6, col: "#222", align: "center", w: 800, maxW: 18, shrink: 3 }); if (!sm) wtext(d, a + 9.5, bb + 6.4, { size: 3, col: d === "AVOID" ? "#b91c1c" : "#555", align: "center", maxW: 18 }); }); }
  // ---- Proof's lessons whiteboard: title + count + first lines
  { const ls = (LV("lessons", DATA && DATA.lessons) || {}).items || [];
    wtext("LESSONS", 304, 9.4, { size: sm ? 5 : 3.6, col: "#2f6fdb", w: 800 }); wtext(ls.length ? ls.length + " LOGGED" : "NONE YET", 378, 9.4, { size: sm ? 4.4 : 3.3, col: "#d03030", align: "right", w: 800 });
    if (!sm) for (let k = 0; k < 2; k++) wtext(ls[k] ? short(ls[k]) : "", 304, 15.4 + k * 4.8, { size: 3.2, col: k === 0 ? "#222" : "#555", w: 600, maxW: 75 }); }
  // clerestory window: sky + weather at ground level
  const se = S5(), h = typeof etNow === "function" ? etNow().h : 12, night = h < 6.5 || h > 19.5 ? 1 : h < 8 ? (8 - h) / 1.5 : h > 18 ? (h - 18) / 1.5 : 0;
  const skyT = night > 0.5 ? "#1f2a44" : se.weather === "rain" ? "#8e9aa6" : "#9fd0ea";
  x.save(); x.beginPath(); x.rect(268, 8, 26, 16); x.clip(); x.fillStyle = skyT; x.fillRect(268, 8, 26, 16);
  x.fillStyle = se.weather === "snow" || se.weather === "flurries" || se.m === 12 || se.m === 1 ? "#eef3f6" : "#6f9a5a"; x.fillRect(268, 20, 26, 4);
  if (se.weather === "rain") { x.strokeStyle = "rgba(220,235,255,.7)"; x.lineWidth = 0.35; for (let i = 0; i < 9; i++) { const rx = 268 + ((i * 7 + t * 30) % 28), ry = 8 + ((i * 5 + t * 60) % 14); x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 1, ry + 2.2); x.stroke(); } }
  if (se.weather === "snow" || se.weather === "flurries") for (let i = 0; i < (se.weather === "snow" ? 12 : 5); i++) circ(268 + ((i * 7 + Math.sin(t + i) * 2) % 26), 8 + ((i * 3.3 + t * 6) % 13), 0.55, "#fff", { shadow: false, stroke: false, shade: false });
  x.restore(); line([281, 8, 281, 24], "#3b3a38", 0.8);
  // wall clock hands (no numerals)
  { const et = typeof etNow === "function" ? etNow() : { hh: 12, mm: 0 }, hh = et.hh != null ? et.hh : et.h, mm = et.mm != null ? et.mm : 0, a1 = ((hh % 12) + mm / 60) / 12 * Math.PI * 2, a2 = mm / 60 * Math.PI * 2;
    line([394, 18, 394 + Math.sin(a1) * 3.2, 18 - Math.cos(a1) * 3.2], "#2a2620", 0.8); line([394, 18, 394 + Math.sin(a2) * 4.8, 18 - Math.cos(a2) * 4.8], "#b3261e", 0.45); circ(394, 18, 0.6, "#2a2620", { shadow: false, stroke: false, shade: false }); }
  // LED strip: travelling dots (decorative, no text)
  { const nx = nextShift(); marquee(nx ? `${nextShiftShort()} ${nx.day === "today" ? "" : String(nx.day).toUpperCase()} - IN ${cd(nx.mins)}`.replace(/\s+/g, " ") : "NO SHIFT SCHEDULED", 134, LH - 10.9, 96, { size: sm ? 4.6 : 4, col: "#ff9d3b", mono: true, center: true }, t, 12); }
  stairSign(tx(15) + 1, tx(16) + 1.5, 46, 13, ["UP TO", "TENDIES AND DIP", "▲ UP"], true, t);   // clickable stairs (HOT "up" unchanged)
  // stair light
  const going = ORDER.some((id) => chars[id].task && chars[id].task.label === "goingup");
  circ(tx(16) + 13, tx(17) + 2, 1.1, going || Math.floor(t * 2) % 2 ? RIC : "#0b3b44", { shadow: false, lw: 0.25 });
  for (const f of FURN) { const fn = ART[f.type]; if (fn && fn.d) try { fn.d(f, t); } catch (e) { /* decor only */ } }
  try { lifeFx(t); } catch (e) { /* decor only */ }
}
// ---- office life: props react to real B1 events (office_life.js sets LIFE.fx / LIFE.held) + daily happenings
const LV = (k, v) => (window.LIFE ? window.LIFE.view(k, v) : v);
function lifeFx(t) {
  const L = window.LIFE; if (!L) return; const x = X(), U = (k) => L.user(k), pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const glowRect = (a, b, w, h, col) => { x.save(); x.globalAlpha = 0.35 + 0.5 * pulse; x.strokeStyle = col; x.lineWidth = 0.9; x.strokeRect(a, b, w, h); x.restore(); };
  if (L.on("tv")) { const k = L.prog("tv"); for (let i = 0; i < 6; i++) { if (k > 0.15 + i * 0.1) continue; const a = 17 + (i % 3) * 27, b = 8 + ((i / 3) | 0) * 14; for (let n = 0; n < 26; n++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; x.fillRect(a + Math.random() * 22, b + Math.random() * 9, 1.2, 0.6); } } }
  circ(94, 9, 0.8, Math.floor(t * 1.5) % 2 ? "#ff4a4a" : "#5a1414", { shadow: false, stroke: false, shade: false });   // LIVE dot
  if (L.on("cork") || L.held.signals) glowRect(199.5, 7, 63, 26, "#f2c14e");
  if (L.on("cork")) { const k = L.prog("cork"); circ(222 + (k * 40) % 38, 8 + Math.min(1, k * 3) * 10, 0.9, "#d03030", { lw: 0.2 }); }
  if (L.on("marker") || L.held.lessons) { glowRect(300, 6, 82, 22, "#2f6fdb"); const k = L.prog("marker"); if (k >= 0) { const mx = 304 + ((k * 4) % 1) * 70, my = 25 - Math.floor(k * 4) % 2 * 4.8; box(mx, my - 3, 1.4, 4.4, 0.5, "#2f6fdb", { lw: 0.2 }); line([304, my + 1, mx, my + 1], "rgba(47,111,219,.55)", 0.35); } }
  if (L.on("callsboard") || L.held.calls) glowRect(tx(23) + 1.5, tx(6) + 0.5, 29, 13, "#5fe08a");
  if (L.on("shift")) glowRect(132, LH - 13.5, 100, 6, "#ff9d3b");
  if (U(["printer_1", "printer_2"])) { const k = (t * 0.7) % 1; box(tx(5) + 8, tx(16) + 6 + k * 6, 14, 6, 0.4, "#fbfaf6", { lw: 0.25 }); for (let i = 0; i < 2; i++) line([tx(5) + 10, tx(16) + 8 + k * 6 + i * 1.6, tx(5) + 19, tx(16) + 8 + k * 6 + i * 1.6], "#9aa3ad", 0.3);
    circ(tx(5) + 27, tx(16) - 1, 0.8, Math.floor(t * 6) % 2 ? "#5fe08a" : "#1d4d2c", { shadow: false, stroke: false, shade: false }); }
  if (L.on("staple") || U(["archive_1", "archive_2", "archive_3"])) { const i = Math.floor(t) % 4; box(tx(5) + i * 16 + 2, tx(12) + 3, 12, 4, 0.5, "#9aa4aa", { lw: 0.3, oy: 1 }); if (L.on("staple")) { const k = L.prog("staple"); if (k > 0.5 && k < 0.7) for (let n = 0; n < 5; n++) line([tx(7), tx(12) - 2, tx(7) + Math.cos(n * 1.3) * 4, tx(12) - 2 + Math.sin(n * 1.3) * 4], "#ffe28a", 0.35); } }
  if (L.on("tube")) { const k = L.prog("tube"); x.save(); x.globalAlpha = 1 - k; box(tx(19) + 5.5, tx(16) + 6 - k * 18, 5, 6, 2, "#c99b3c", { lw: 0.3 }); x.restore(); }
  for (const c of ORDER.map((id) => chars[id])) { if (!c || c.hidden || c.moving) continue;
    if (c.ty === 15 && c.tx >= 1 && c.tx <= 3) { for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i * 0.33) % 1; x.save(); x.globalAlpha = 0.5 * (1 - k); circ(tx(c.tx) + 8 + Math.sin(t * 2 + i) * 1.2, tx(14) - 2 - k * 8, 1.3 + k, "#f4f1ea", { shadow: false, stroke: false, shade: false }); x.restore(); } }
    if (c.tx === 4 && c.ty === 10) for (let i = 0; i < 3; i++) circ(tx(4) + 7 + i, tx(9) - 3 + 3 - ((t * 3 + i * 0.4) % 1) * 4, 0.45, "rgba(255,255,255,.85)", { shadow: false, stroke: false, shade: false }); }
  const H = L.happen || { list: [] };
  if (H.list.includes("darts")) { const a = 8, b = 74; circ(a, b, 5.2, "#1b1b1b", { lw: 0.3 }); circ(a, b, 4, "#e9dfc6", { shadow: false, stroke: false }); circ(a, b, 2.6, "#c0392b", { shadow: false, stroke: false }); circ(a, b, 1.3, "#2e7d4f", { shadow: false, stroke: false }); circ(a, b, 0.5, "#c0392b", { shadow: false, stroke: false, shade: false });
    if (L.on("darts") && U(["dart_1"])) { const k = (t * 0.6) % 1, c = U(["dart_1"]), sx = c ? c.x : tx(3) + 8, sy = c ? c.y - 6 : b; line([sx + (a - sx) * k, sy + (b - sy) * k, sx + (a - sx) * k + 2, sy + (b - sy) * k], "#f2c14e", 0.6); } }
  if (H.list.includes("arcade")) { const px = tx(1), py = tx(7); if (L.on("arcade") || U(["arcade_1", "arcade_2"])) { for (let i = 0; i < 4; i++) { x.fillStyle = ["#ff4fd8", "#4fd8ff", "#ffe14f", "#4fff8a"][(i + Math.floor(t * 4)) % 4]; x.fillRect(px + 4 + i * 2, py - 4 + ((t * 9 + i * 3) % 6), 1.6, 1.6); } }
    box(px + 5, py - 11, 6, 3, 0.6, "#f2c14e", { lw: 0.25 }); }
  R_.lifeUnder(t, { table: [180, 178, 40, 24], balloons: [229, 196], banner: [150, 38.5, 120], cardSpots: ["huddle_1", "huddle_2", "huddle_3", "huddle_4"] });
}
const LIGHTS = [[4, 5], [9, 5], [14, 5], [19, 5], [23, 5], [6, 11], [12, 11], [18, 11], [3, 15], [12, 15], [22, 15]];
function drawPost(t) {
  const x = X(); x.save(); x.globalCompositeOperation = "lighter";
  for (const [lx, ly] of LIGHTS) { const a = tx(lx), b = tx(ly), gr = x.createRadialGradient(a, b, 2, a, b, 34); gr.addColorStop(0, "rgba(255,244,220,.10)"); gr.addColorStop(1, "rgba(255,244,220,0)"); x.fillStyle = gr; x.fillRect(a - 34, b - 34, 68, 68); }
  x.restore();
  try { R_.lifeOver(t); } catch (e) { /* */ }
  const gr = x.createRadialGradient(LW / 2, LH / 2, LH * 0.35, LW / 2, LH / 2, LW * 0.62); gr.addColorStop(0, "rgba(10,14,18,0)"); gr.addColorStop(1, "rgba(10,14,18,.22)"); x.fillStyle = gr; x.fillRect(0, 0, LW, LH);
}
// B1 Halloween: masquerade masks + capes for RI staff (same seeded odds as seasons.js)
R_.pawnHook = function (c, k, hx, hy, r, view, dir) {
  if (c.id === "nancy" || !window.__seasons) return; const dt = window.__seasons.D(); if (dt.m !== 10) return;
  const p = dt.d === 31 ? 1 : dt.d >= 24 ? 0.3 : 0; if (R_.fnv(dt.k + ":" + c.id + ":b1c") >= p) return;
  if (view === "N") ell(c.x, hy + r + 4.5, 5, 4.4, 0, "#5a1414", { lw: 0.4 });
  else { const w = view === "S" ? r * 1.7 : r * 1.1, ax = view === "S" ? hx - w / 2 : dir > 0 ? hx - r * 0.1 : hx - w + r * 0.1; box(ax, hy - 0.6, w, 1.9, 0.9, "#141414", { shadow: false, lw: 0.2, shade: false }); line([hx - r * 0.9, hy + r + 1.2, hx + r * 0.9, hy + r + 1.2], "#7f1d1d", 0.8); }
};
R_.floor = { drawStatic, drawDynamic, drawPost, staticKey: () => { const s = S5(); return [s.k, s.theme.id, JSON.stringify(s.ev || {})].join("|"); } };
R_.ART = ART;
layout();
})();
