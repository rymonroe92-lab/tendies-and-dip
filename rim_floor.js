"use strict";
/* Tendies and Dip trading floor - RimWorld-inspired vector art (drawing layer only; floor2d.js / social.js / seasons.js
   simulation untouched). Needs rim_common.js. Nothing readable in the room except speech bubbles + name tags: the floor
   monitor, R&D whiteboard, menu board, signs and plaques are decorative; numbers/trades/targets stay in the side panel. */
(function () {
if (!window.RIM || !window.RIM.on) return;
const R_ = window.RIM, P = R_.P;
const { rr, shadow, box, circ, ell, line, poly, hex, mute, planks, tiles, speckle, rug, wallSeg, glassSeg, plant, chair, screen, INK, RIC } = P;
const { wtext, marquee, short, money0, stairSign, frame, icoMagnifier, icoArrowUp, scribble, bunting, deskTop, mug, balloons, upNote } = R_.D;
const X = () => P.ctx(), tx = (n) => n * TS, S5 = () => R_.season();
const hourF = () => { try { return etNow().h; } catch (e) { return 12; } };
const wins = () => { try { return winners(); } catch (e) { return {}; } };
function windowGlass(a, b, w, h, t) {   // city view, sky by hour, weather
  const x = X(), hr = hourF(), [top, bot] = skyCols(hr), n = nightFactor(hr), se = S5();
  x.save(); x.beginPath(); x.rect(a, b, w, h); x.clip();
  const gr = x.createLinearGradient(0, b, 0, b + h); gr.addColorStop(0, se.weather === "rain" && n < 0.5 ? "#7d8c9a" : top); gr.addColorStop(1, se.weather === "rain" && n < 0.5 ? "#b6c0c8" : bot); x.fillStyle = gr; x.fillRect(a, b, w, h);
  if (hr >= 7 && hr < 18 && se.weather === "clear") circ(a + w * 0.78, b + 4, 2, "#fff3c0", { shadow: false, stroke: false });
  else if (n > 0.6) circ(a + w * 0.22, b + 4, 1.6, "#f4f1d0", { shadow: false, stroke: false });
  for (let i = 0; i < 6; i++) { const bw = w / 6, bh = h * (0.28 + ((i * 37) % 10) / 22); x.fillStyle = n > 0.5 ? "#1a2036" : "#6f8496"; x.fillRect(a + i * bw, b + h - bh, bw - 0.6, bh);
    if (n > 0.3) for (let k = 0; k < 3; k++) { x.fillStyle = `rgba(255,220,140,${0.5 * n})`; x.fillRect(a + i * bw + 1 + k * 1.6, b + h - bh + 2 + ((i + k) % 3) * 2.4, 0.8, 1); } }
  if (se.weather === "rain") { x.strokeStyle = "rgba(220,235,255,.65)"; x.lineWidth = 0.35; for (let i = 0; i < 10; i++) { const rx = a + ((i * 7 + t * 30) % (w + 4)), ry = b + ((i * 5 + t * 55) % h); x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 1, ry + 2.4); x.stroke(); } }
  if (se.weather === "snow" || se.weather === "flurries") for (let i = 0; i < (se.weather === "snow" ? 14 : 6); i++) circ(a + ((i * 7.3 + Math.sin(t + i) * 2) % w), b + ((i * 3.7 + t * 6) % h), 0.55, "#fff", { shadow: false, stroke: false, shade: false });
  x.restore(); x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.moveTo(a + 2, b + h); x.lineTo(a + w * 0.35, b); x.lineTo(a + w * 0.45, b); x.lineTo(a + 6, b + h); x.fill();
  line([a + w / 2, b, a + w / 2, b + h], "#3b3127", 0.8);
}
function miniHead(cx, cy, s, id) {   // tiny portrait for plaques/frames (no text)
  const k = (R_.lookOf ? R_.lookOf({ id }) : CAST[id]) || {};
  ell(cx, cy + 4.2 * s, 4.2 * s, 2.8 * s, 0, mute(k.dress || k.shirt || "#888", 0.18), { lw: 0.3 * s });
  circ(cx, cy, 3 * s, mute(k.skin || "#e0ac69", 0.08), { lw: 0.3 * s, shadow: false });
  if (k.acc === "jefe") { ell(cx, cy - 1.6 * s, 4.6 * s, 1.4 * s, 0, "#7a5030", { lw: 0.25 * s }); ell(cx, cy - 2.2 * s, 2.4 * s, 1.4 * s, 0, "#8d6038", { lw: 0.25 * s }); box(cx - 2.2 * s, cy - 0.4 * s, 4.4 * s, 1.2 * s, 0.4, "#111", { shadow: false, stroke: false, shade: false }); }
  else { const x = X(); x.beginPath(); x.arc(cx, cy, 3.1 * s, Math.PI + 0.2, -0.2); x.fillStyle = mute(k.hair || "#333", 0.1); x.fill(); circ(cx - 1.1 * s, cy + 0.4 * s, 0.4 * s, "#2a2620", { shadow: false, stroke: false, shade: false }); circ(cx + 1.1 * s, cy + 0.4 * s, 0.4 * s, "#2a2620", { shadow: false, stroke: false, shade: false }); }
}
function trophy(a, b, gold, big) { const s = big ? 1.3 : 1, m = gold ? "#f2c94c" : "#d5dde5", d = gold ? "#a87b00" : "#7d8a99";
  box(a - 2.4 * s, b + 2.6 * s, 4.8 * s, 1.6 * s, 0.4, "#3a2a1a", { lw: 0.2, blur: 0.6 }); box(a - 0.6 * s, b + 1 * s, 1.2 * s, 1.8 * s, 0.2, d, { shadow: false, lw: 0.15 });
  x_cup(a, b, s, m); }
function x_cup(a, b, s, m) { const x = X(); x.beginPath(); x.moveTo(a - 2.2 * s, b - 2.6 * s); x.lineTo(a + 2.2 * s, b - 2.6 * s); x.quadraticCurveTo(a + 2 * s, b + 1.2 * s, a, b + 1.2 * s); x.quadraticCurveTo(a - 2 * s, b + 1.2 * s, a - 2.2 * s, b - 2.6 * s); x.fillStyle = m; x.fill(); x.lineWidth = 0.25; x.strokeStyle = INK; x.stroke();
  x.beginPath(); x.arc(a - 2.3 * s, b - 1.4 * s, 0.9 * s, Math.PI * 0.5, Math.PI * 1.5); x.arc(a + 2.3 * s, b - 1.4 * s, 0.9 * s, -Math.PI * 0.5, Math.PI * 0.5); x.strokeStyle = m; x.lineWidth = 0.45; x.stroke(); }
function pumpkin(a, b, s = 1, lit) { ell(a, b, 2.4 * s, 1.9 * s, 0, "#e8792b", { lw: 0.3 }); line([a, b - 1.9 * s, a + 0.4 * s, b - 2.8 * s], "#3f7d4c", 0.5); if (lit) { X().fillStyle = "#ffd36b"; X().fillRect(a - 1.2 * s, b - 0.6 * s, 0.7 * s, 0.6 * s); X().fillRect(a + 0.5 * s, b - 0.6 * s, 0.7 * s, 0.6 * s); X().fillRect(a - 0.9 * s, b + 0.5 * s, 1.8 * s, 0.4 * s); } }

// ---------------------------------------------------------------- static layer
function drawStatic() {
  const x = X(), rnd = R_.rng(4242), se = S5(), th = se.theme.id, ev = se.ev || {};
  planks(16, 48, LW - 32, LH - 64, "#9c7650", "rgba(50,30,14,.35)", rnd);                                   // warm trading-floor oak
  tiles(16, tx(3), tx(5), tx(5), "#e8e0c8", "#9cc2b2", "rgba(40,60,50,.18)", 8);                             // break room
  tiles(16, tx(9), tx(3), tx(3), "#ece6d8", "#3a3a40", "rgba(0,0,0,.2)", 8);                                 // espresso corner
  box(tx(20), tx(3), tx(5), tx(5), 0, "#6e2633", { shadow: false, shade: false, stroke: false });           // El Jefe's carpet
  x.strokeStyle = "#c79a3a"; x.lineWidth = 0.7; x.strokeRect(tx(20) + 3.5, tx(3) + 3.5, tx(5) - 7, tx(5) - 7); for (let yy = tx(3) + 8; yy < tx(8) - 4; yy += 8) for (let xx = tx(20) + 8; xx < tx(25) - 4; xx += 8) circ(xx, yy, 0.45, "#8a3644", { shadow: false, stroke: false, shade: false });
  speckle(tx(15), tx(3), tx(4), tx(4), "#56636e", 260, rnd, "rgba(0,0,0,.12)");                              // R&D carpet tiles
  rug(tx(7) + 4, tx(4) + 2, tx(7) - 8, tx(2) + 6, "#2d4f72", "#d9b45a");                                     // back lounge rug
  rug(tx(20) + 2, tx(9) + 2, tx(5) - 6, tx(4) - 4, "#246a63", "#e7c56a");                                   // reception rug
  rug(tx(7) - 2, tx(9) - 4, tx(13) + 4, tx(6) + 2, "rgba(0,0,0,0)", "rgba(255,240,200,.18)");               // subtle Swing Desk zone outline
  for (const ay of [tx(11) + 3, tx(15) + 3]) for (let ax = tx(6) + 4; ax < tx(21) - 4; ax += 9) box(ax, ay + 4, 4, 1, 0.4, "rgba(255,240,200,.16)", { shadow: false, stroke: false, shade: false });   // aisle runner dashes
  for (let ay = tx(8) + 4; ay < tx(16); ay += 9) box(tx(13) + 7.5, ay, 1, 4, 0.4, "rgba(255,240,200,.16)", { shadow: false, stroke: false, shade: false });   // main aisle (stairs -> back lounge)
  box(tx(23) + 1, tx(16) + 2, tx(2) - 2, 13, 1.6, "#4a3b33", { shadow: false, lw: 0.35 }); wtext("WELCOME", tx(24), tx(16) + 8.5, { size: R_.small() ? 5 : 4.2, col: "#d9b45a", align: "center", base: "middle", w: 800, maxW: 28 });   // entrance mat
  // RI stairwell (icon only): landing mat with magnifier + down chevrons, steps into the south wall
  // walls
  x.fillStyle = "#3f5a4b"; x.fillRect(0, 0, LW, 48); x.fillStyle = "rgba(0,0,0,.06)"; for (let a = 0; a < LW; a += 12) x.fillRect(a, 3, 0.5, 33);
  x.fillStyle = "#5a3a24"; x.fillRect(0, 36, LW, 12); x.fillStyle = "#8a5f3a"; x.fillRect(0, 36, LW, 1.6); x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, 46.6, LW, 1.4);
  const wc = "#3c4a42"; wallSeg(0, 0, LW, 3.2, "#26302b"); wallSeg(0, 0, 16, LH, wc); wallSeg(LW - 16, 0, 16, LH, wc);
  wallSeg(0, LH - 16, tx(15) - 1, 16, wc); wallSeg(tx(18) + 1, LH - 16, tx(23) - tx(18) - 2, 16, wc); wallSeg(tx(25) + 1, LH - 16, LW - tx(25) - 1, 16, wc);
  for (let i = 0; i < 4; i++) box(tx(15), LH - 7.6 - i * 4 + 4, 48, 4, 0.4, hex("#6d8794", 1 - i * 0.14), { shadow: false, lw: 0.3 });
  line([tx(15) - 0.5, LH - 18, tx(15) - 0.5, LH], "#c79a3a", 1.2); line([tx(18) + 0.5, LH - 18, tx(18) + 0.5, LH], "#c79a3a", 1.2);
  box(tx(23), LH - 16, tx(2), 16, 0, "#8a6440", { shadow: false, lw: 0.3 }); line([tx(23) - 0.5, LH - 17, tx(23) - 0.5, LH], "#c79a3a", 1.4); line([tx(25) + 0.5, LH - 17, tx(25) + 0.5, LH], "#c79a3a", 1.4);   // entrance door
  // north wall pieces (frames; glass + screens animate in dynamic)
  frame(20, 8, 26, 22, "#9fc6d8", "#3b3127"); frame(108, 6, 36, 28, "#16261e", "#5a3b22"); frame(210, 8, 28, 24, "#9fc6d8", "#3b3127");   // 108: STRATEGY wall board frame(322, 6, 60, 28, "#9fc6d8", "#2a1e14");
  frame(54, 9, 26, 20, "#24302a", "#5a3b22");   // menu board: cup icon + chalk lines
  if (R_.small()) wtext("MENU", 67, 19, { size: 5.6, col: "#f2c14e", align: "center", base: "middle", w: 800 }); else { wtext("MENU", 67, 10.4, { size: 3.8, col: "#f2c14e", align: "center", w: 800 }); wtext("LATTE", 56.5, 16.4, { size: 3.3, col: "#e8e2cf" }); wtext("DECAF", 56.5, 22, { size: 3.3, col: "#8f9a8f" }); box(73, 17, 4, 3.4, 0.8, "#f4efe0", { shadow: false, lw: 0.25 }); }
  frame(84, 10, 22, 18, "#f2e6c9", "#4a3a2c"); poly([86, 26, 93, 15, 98, 21, 101, 17, 104, 26], "#5f8f52", { lw: 0.3 }); circ(100, 14, 2, "#e9a03b", { shadow: false, lw: 0.25 });   // landscape art
  frame(146, 6, 60, 28, "#0d1512", "#2b2b2b");   // floor monitor (decorative chart + risk light)
  frame(244, 6, 58, 28, "#f4f6f2", "#8f989d"); box(252, 32.5, 42, 1.6, 0.5, "#7a8288", { shadow: false, lw: 0.2 });
  circ(390, 18, 6, "#efe8d2", { lw: 0.6 });
  box(345, 37, 14, 7, 1, "#e7c56a", { lw: 0.35 }); line([348, 40.5, 356, 40.5], "#8a6a2a", 0.5);   // brass sign (no text)
  if (th) bunting(th, 39.5);
  // walls inside: break-room partitions, El Jefe glass, award wall
  for (let y = 3; y <= 8; y++) if (y !== 7) wallSeg(tx(6) + 5, tx(y) - (y === 3 ? 0 : 2), 6, 18, "#4e6a5b");
  wallSeg(16, tx(8) - 2, tx(5), 12, "#4e6a5b"); wtext("BREAK", tx(3) + 8, tx(8) + 4, { size: R_.small() ? 5.4 : 4.4, col: "#dff0e4", align: "center", base: "middle", w: 800 });
  x.fillStyle = "rgba(190,230,255,.16)"; x.fillRect(tx(19) + 4, tx(3), 8, tx(5)); glassSeg(tx(19) + 8, tx(3), tx(19) + 8, tx(6)); glassSeg(tx(19) + 8, tx(7), tx(19) + 8, tx(8));
  for (let y = 3; y <= 8; y++) if (y !== 6) circ(tx(19) + 8, tx(y), 0.9, "#c79a3a", { shadow: false, lw: 0.25 });
  drawAward(tx(19), tx(8));
  // chairs, break stools, furniture
  for (const id in CHAIRS) { const [cx, cy] = CHAIRS[id]; chair(tx(cx) + 8, tx(cy) + 9, 0, id === "grok" ? "#5a2a1e" : id === "goldie" ? "#c2477e" : "#3f4a55"); }
  for (const s of BREAK) if (s[3] === "sit") { circ(tx(s[0]) + 8, tx(s[1]) + 9, 3.6, "#b8743a", { lw: 0.35 }); circ(tx(s[0]) + 8, tx(s[1]) + 9, 2.4, "#cf8a4a", { shadow: false, stroke: false }); }
  for (const f of FURN) { const fn = ART[f.type]; try { if (fn && fn.s) fn.s(f, ev); else if (!fn) box(tx(f.x) + 1, tx(f.y) + 1, tx(f.w) - 2, tx(f.h) - 2, 1.4, "#8b8f94"); } catch (e) { console.warn("rim floor art", f.type, e); } }
}
function drawAward(px, py) {   // award wall: silver weekly plaque, gold monthly portrait, Hall of Fame (monthly winners only)
  const w = tx(6), wn = wins(), hall = ((typeof S !== "undefined" && S && S.awards && S.awards.hall) || []).filter((h) => h && h.winner);
  wallSeg(px, py - 2, w, 14, "#5a3a24");
  box(px + 6, py - 9, 20, 18, 1, "#c9d1d9", { blur: 1.4, lw: 0.4 }); box(px + 8, py - 7, 16, 12, 0.6, "#2a3340", { shadow: false, lw: 0.3 }); if (wn.week) miniHead(px + 16, py - 2.4, 1, wn.week.winner); else circ(px + 16, py - 1, 2, "#556070", { shadow: false, stroke: false });
  box(px + 7, py + 5.6, 18, 3.6, 0.5, "#e5ebf1", { shadow: false, lw: 0.2 });
  box(px + 34, py - 12, 26, 23, 1.2, "#f2c94c", { blur: 1.8, lw: 0.45 }); box(px + 36.5, py - 9.5, 21, 18, 0.6, "#3a2c0a", { shadow: false, lw: 0.3 }); if (wn.month) miniHead(px + 47, py - 3, 1.4, wn.month.winner); else circ(px + 47, py - 1, 2.4, "#6b5520", { shadow: false, stroke: false });
  if (!R_.small()) { wtext("WEEK", px + 16, py + 6.1, { size: 2.6, col: "#3a4350", align: "center", w: 800 }); wtext("MONTH", px + 47, py + 9.4, { size: 2.8, col: "#f2c94c", align: "center", w: 800 }); wtext("HALL OF FAME", px + 79.5, py + 9.2, { size: 2.8, col: "#f2c94c", align: "center", w: 800, maxW: 28 }); }
  for (let i = 0; i < 6; i++) { const hx = px + 66 + (i % 3) * 9, hy = py - 10 + Math.floor(i / 3) * 10, h = hall[i]; box(hx, hy, 7.4, 8.4, 0.6, "#c9a23a", { blur: 0.8, lw: 0.3 }); box(hx + 1, hy + 1, 5.4, 6.4, 0.4, h ? mute(COL[h.winner] || "#777", 0.3) : "#2a210a", { shadow: false, stroke: false }); if (h) miniHead(hx + 3.7, hy + 3.8, 0.55, h.winner); }
}

// ---------------------------------------------------------------- furniture art
const seated = (id) => { const c = chars[id]; return c && !c.hidden && atSpotF(c, SPOTS["chair_" + id]); };
const atSpotF = (c, s) => s && c.tx === s.x && c.ty === s.y && !c.moving && !(c.path && c.path.length);
function glowAt(a, b, r, rgba) { const x = X(); x.save(); x.globalCompositeOperation = "lighter"; const gr = x.createRadialGradient(a, b, 0.5, a, b, r); gr.addColorStop(0, rgba); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(a - r, b - r, r * 2, r * 2); x.restore(); }
function deskTrophies(id, a, b) { const w = wins(); if (w.month && w.month.winner === id) trophy(a, b, true, true); if (w.week && w.week.winner === id) trophy(a + (w.month && w.month.winner === id ? 6 : 0), b + 0.6, false, false); }
function bdayOn(id, a, b, t) { const se = S5(); if (se.ev && se.ev.birthday === id) balloons(a, b, t); }
function plantS(a, b, s, isNew) { plant(a, b, s, "#6f8f5a", isNew ? "#f2a7c8" : "#8a6248"); }
const hallo = () => { const se = S5(); return se.theme.id === "halloween" ? (se.theme.lvl || 1) : 0; };
const ART = {
  tdesk: { s(f, ev) { const px = tx(f.x), py = tx(f.y), id = f.bot; deskTop(px, py, 48);
      box(px + 17, py + 2.2, 14, 3, 0.6, "#d9dde0", { shadow: false, lw: 0.28 }); screen(px + 17, py + 7.4, 12, false, "#5fe08a"); screen(px + 31, py + 7.4, 12, false, "#5fe08a");
      box(px + 3.5, py + 3, 8, 6, 0.4, "#f4f1e8", { lw: 0.25, blur: 0.6 }); box(px + 36.5, py + 2.6, 5, 6.5, 0.6, COL[id] || "#999", { lw: 0.25, blur: 0.6 }); mug(px + 44, py + 4.5);
      plantS(px + 44, py + 11.2, 0.65, ev.plant === id); deskTrophies(id, px + 7, py + 8.5); if (hallo() >= 2) pumpkin(px + 26, py + 11, 0.8, false); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), id = f.bot; let mode = "off", vacant = false; try { mode = deskMode(id); vacant = typeof LAID_OFF !== "undefined" && LAID_OFF.has(id); } catch (e) { /* */ }
      if (vacant) { box(px + 10, py - 6, 28, 6.2, 1, "#3a1d06", { lw: 0.35, blur: 1 }); wtext("NOW HIRING", px + 24, py - 3, { size: R_.small() ? 4 : 3.2, col: "#ff9f1c", align: "center", base: "middle", w: 800 }); box(px + 18, py + 3, 12, 4.2, 0.6, "#1b1b1b", { lw: 0.25, shadow: false }); wtext("OPEN", px + 24, py + 5.1, { size: 3, col: "#ffb84d", align: "center", base: "middle", w: 800 }); }
      else if (mode !== "off" && seated(id)) { const up = (() => { try { return deskUp(id); } catch (e) { return true; } })(), col = mode === "saver" ? "#6b8cff" : up ? "#5fe08a" : "#ff6b6b";
        screen(px + 17, py + 7.4, 12, true, col); screen(px + 31, py + 7.4, 12, true, col); glowAt(px + 24, py + 4, 12, mode === "saver" ? "rgba(90,120,255,.22)" : up ? "rgba(80,230,140,.26)" : "rgba(255,90,90,.26)"); }
      bdayOn(id, px + 46, py + 2, t); } },
  pdesk: { s(f, ev) { const px = tx(f.x), py = tx(f.y); deskTop(px, py, 32, "#8f7a62"); for (let i = 0; i < 3; i++) screen(px + 7 + i * 9, py + 7, 8, false); box(px + 10, py + 2.2, 12, 3, 0.6, "#d9dde0", { shadow: false, lw: 0.25 });
      for (let i = 0; i < 3; i++) box(px + 2 + i * 2.6, py + 10, 2.2, 2.2, 0.2, ["#fde047", "#f9a8d4", "#86efac"][i], { shadow: false, lw: 0.15 }); plantS(px + 28.5, py + 11.2, 0.6, ev.plant === "pixel"); deskTrophies("pixel", px + 4, py + 6); },
    d(f, t) { const px = tx(f.x), py = tx(f.y); if (!seated("pixel")) return; for (let i = 0; i < 3; i++) screen(px + 7 + i * 9, py + 7, 8, true, i === 1 ? "#f2c94c" : RIC); glowAt(px + 16, py + 4, 13, "rgba(80,220,255,.22)"); bdayOn("pixel", px + 30, py + 2, t); } },
  kdesk: { s(f, ev) { const px = tx(f.x), py = tx(f.y); deskTop(px, py, 32, "#7d858c"); box(px + 4, py + 3, 10, 7, 0.6, "#2f6b3a", { lw: 0.3 }); for (let i = 0; i < 4; i++) line([px + 5 + i * 2.3, py + 4, px + 5 + i * 2.3, py + 9], "#d9b45a", 0.3);
      screen(px + 22, py + 7.2, 12, false, "#f2c94c"); circ(px + 28.5, py + 3.5, 1.6, "#e5534b", { lw: 0.25 }); plantS(px + 16, py + 11.5, 0.55, ev.plant === "knobs"); deskTrophies("knobs", px + 4, py + 11); },
    d(f, t) { const px = tx(f.x), py = tx(f.y); if (seated("knobs")) { screen(px + 22, py + 7.2, 12, true, "#f2c94c"); glowAt(px + 22, py + 4, 11, "rgba(255,210,90,.22)"); } if (Math.floor(t * 3) % 2) circ(px + 13, py + 4, 0.6, "#ff5c5c", { shadow: false, stroke: false, shade: false }); bdayOn("knobs", px + 30, py + 2, t); } },
  jdesk: { s(f, ev) { const px = tx(f.x), py = tx(f.y); box(px, py, 48, 15, 2, "#5a2f1c", { blur: 2.4, oy: 1.2 }); box(px + 2, py + 1.5, 44, 10, 1.4, "#6e3a22", { shadow: false, stroke: "rgba(0,0,0,.35)", lw: 0.3 }); X().fillStyle = "#c79a3a"; X().fillRect(px + 1, py + 13, 46, 0.7);
      screen(px + 24, py + 7.4, 16, false, "#f2c94c"); box(px + 15, py + 2.2, 18, 3, 0.6, "#2b2b2b", { shadow: false, lw: 0.25 });
      box(px + 34, py + 8.5, 9, 3, 0.6, "#e7c56a", { lw: 0.3 });                                                               // gold nameplate (no text)
      box(px + 4, py + 3, 8, 5, 0.6, "#3f8f4e", { lw: 0.25 }); box(px + 5, py + 4, 8, 5, 0.6, "#4fa65d", { lw: 0.25 });          // stacks of cash
      circ(px + 41, py + 4, 2.2, "#c2703a", { lw: 0.3 }); box(px + 40.2, py - 1.4, 1.8, 5, 0.9, "#5f9a52", { lw: 0.25, shadow: false }); box(px + 38.4, py + 0.6, 1.2, 2.6, 0.6, "#5f9a52", { lw: 0.2, shadow: false });   // cactus
      box(px + 44.5, py + 12, 3, 4.5, 0.8, "#6b4423", { lw: 0.25 }); box(px + 47.6, py + 12, 3, 4.5, 0.8, "#5b3a1e", { lw: 0.25 });   // boots
      deskTrophies("grok", px + 9, py + 10); },
    d(f, t) { const px = tx(f.x), py = tx(f.y); if (seated("grok")) { screen(px + 24, py + 7.4, 16, true, "#f2c94c"); glowAt(px + 24, py + 4, 14, "rgba(255,210,90,.24)"); } bdayOn("grok", px + 8, py, t); } },
  gdesk: { s(f, ev) { const px = tx(f.x), py = tx(f.y); const x = X(); shadow(() => { x.beginPath(); x.moveTo(px, py + 1); x.lineTo(px + 48, py + 1); x.lineTo(px + 48, py + 11); x.quadraticCurveTo(px + 24, py + 18, px, py + 11); x.closePath(); x.fillStyle = "#f4eef2"; x.fill(); }, 2, 1);
      x.lineWidth = 0.45; x.strokeStyle = INK; x.stroke(); x.fillStyle = "#e08ab5"; x.beginPath(); x.moveTo(px, py + 11); x.quadraticCurveTo(px + 24, py + 18, px + 48, py + 11); x.lineTo(px + 48, py + 12.6); x.quadraticCurveTo(px + 24, py + 19.6, px, py + 12.6); x.fill();
      screen(px + 24, py + 6.6, 13, false, "#ff8ac6"); circ(px + 7, py + 5, 2.6, "rgba(220,240,255,.75)", { lw: 0.3 }); for (let i = 0; i < 5; i++) circ(px + 6 + (i % 3) * 1.3, py + 4.4 + (i >> 1) * 1.2, 0.55, ["#e5534b", "#f2c94c", "#4a8fe0", "#5fe08a", "#ff8ac6"][i], { shadow: false, stroke: false, shade: false });   // candy jar
      box(px + 36, py + 4, 4, 4, 1.4, "#c7d3e0", { lw: 0.25 }); for (let i = 0; i < 4; i++) circ(px + 38 + Math.cos(i * 1.57) * 1.6, py + 3 + Math.sin(i * 1.57) * 1.6, 1.1, ["#f472b6", "#fde047", "#f472b6", "#a78bfa"][i], { lw: 0.2, shadow: false });   // flowers
      circ(px + 43.5, py + 7.5, 1.4, "#e7c56a", { lw: 0.3 }); deskTrophies("goldie", px + 15, py + 9); if (hallo() >= 1) pumpkin(px + 30, py + 10, 1, false); },
    d(f, t) { const px = tx(f.x), py = tx(f.y); if (seated("goldie")) { screen(px + 24, py + 6.6, 13, true, "#ff8ac6"); glowAt(px + 24, py + 3.5, 11, "rgba(255,120,190,.2)"); } bdayOn("goldie", px + 34, py, t); } },
  vending: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1, py - 2, 14, 15, 1.4, "#c0392b", { blur: 2 }); box(px + 2.5, py - 0.6, 8, 11, 0.6, "#1d2730", { shadow: false, lw: 0.3 }); for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) circ(px + 4 + k * 2.4, py + 1.2 + i * 2.6, 0.75, ["#f2c94c", "#5fe08a", "#4a8fe0", "#ff8ac6"][(i + k) % 4], { shadow: false, stroke: false, shade: false }); box(px + 11.5, py + 1, 2.4, 5, 0.4, "#ddd", { shadow: false, lw: 0.2 }); },
    d(f, t) { glowAt(tx(f.x) + 7, tx(f.y) + 5, 9, "rgba(120,200,255,.14)"); } },
  fridge: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1.5, py - 2, 13, 15, 1.6, "#eef1f3", { blur: 2 }); line([px + 1.5, py + 3, px + 14.5, py + 3], "#b8c0c6", 0.35); box(px + 11.5, py - 0.5, 1.2, 3, 0.4, "#9aa3a8", { shadow: false, stroke: false }); box(px + 11.5, py + 5, 1.2, 4, 0.4, "#9aa3a8", { shadow: false, stroke: false });
      circ(px + 4.5, py + 6, 0.9, "#e5534b", { shadow: false, lw: 0.2 }); circ(px + 7.5, py + 8, 0.9, "#4a8fe0", { shadow: false, lw: 0.2 }); box(px + 4, py + 9.6, 3.4, 2.4, 0.2, "#fde68a", { shadow: false, lw: 0.15 }); } },
  kitchen: { s(f) { const px = tx(f.x), py = tx(f.y); box(px, py - 2, 32, 15, 1, "#d8d1c0", { blur: 1.8 }); X().fillStyle = "#8f877a"; X().fillRect(px, py + 10.5, 32, 2.5);
      box(px + 2, py - 1, 12, 8, 1.2, "#3a3d42", { lw: 0.3 }); box(px + 3, py, 7.4, 6, 0.6, "#1d2228", { shadow: false, lw: 0.2 }); circ(px + 12, py + 1.6, 0.7, "#5fe08a", { shadow: false, stroke: false, shade: false });   // microwave
      box(px + 18, py, 11, 7, 1.4, "#b8c4cc", { lw: 0.3 }); ell(px + 23.5, py + 3.5, 3.6, 2.2, 0, "#7f8b93", { lw: 0.25 }); line([px + 23.5, py - 0.4, px + 23.5, py + 1.6], "#9aa3a8", 0.6); } },
  cooler: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 3.5, py - 1, 9, 14, 1.4, "#e7ecef", { blur: 1.6 }); circ(px + 8, py - 3, 4, "#8fd3f2", { lw: 0.35 }); ell(px + 6.8, py - 4.2, 1, 1.6, 0.4, "rgba(255,255,255,.6)", { stroke: false }); circ(px + 6, py + 4, 0.8, "#3b82f6", { shadow: false, lw: 0.2 }); circ(px + 10, py + 4, 0.8, "#e5534b", { shadow: false, lw: 0.2 }); } },
  btable: { s(f, ev) { const px = tx(f.x), py = tx(f.y); box(px + 1, py + 1, 30, 13, 6, "#c79a6a", { blur: 2 }); box(px + 3, py + 3, 26, 9, 4.4, "#d6aa78", { shadow: false, stroke: "rgba(60,40,20,.3)", lw: 0.3 }); mug(px + 8, py + 6); box(px + 18, py + 4, 6, 5, 0.4, "#f4f1e8", { lw: 0.2, shadow: false });
      if (ev.pizza) { box(px + 11, py + 4, 11, 8, 0.6, "#d9b98a", { lw: 0.3 }); circ(px + 16.5, py + 8, 3.4, "#e8b04b", { lw: 0.25, shadow: false }); for (let i = 0; i < 4; i++) circ(px + 15 + (i % 2) * 3, py + 7 + (i >> 1) * 2.2, 0.55, "#c0392b", { shadow: false, stroke: false, shade: false }); }
      if (ev.birthday) { circ(px + 25, py + 7, 3, "#f4f1ea", { lw: 0.3 }); circ(px + 25, py + 7, 2, "#f4a6c0", { shadow: false, stroke: false }); line([px + 25, py + 4, px + 25, py + 2.2], "#f2c94c", 0.5); }
      if (hallo() >= 3) { circ(px + 4, py + 4, 2, "#f1efe6", { lw: 0.3 }); } } },
  coffee: { s(f) { const px = tx(f.x), py = tx(f.y), w = tx(f.w); box(px, py - 2, w, 15, 1, "#3a2e26", { blur: 1.8 }); X().fillStyle = "#c79a3a"; X().fillRect(px, py + 10.5, w, 0.8);
      box(px + 4, py - 4, 16, 11, 1.6, "#c9ced3", { lw: 0.35 }); box(px + 6, py - 2.6, 12, 4, 0.8, "#8f979e", { shadow: false, lw: 0.25 }); circ(px + 8.5, py + 4.5, 1.3, "#2a2a2a", { shadow: false, lw: 0.25 }); circ(px + 15.5, py + 4.5, 1.3, "#2a2a2a", { shadow: false, lw: 0.25 });
      for (let i = 0; i < 4; i++) mug(px + 26 + (i % 2) * 4.4, py + 1 + (i >> 1) * 4.6, ["#f4f1ea", "#e5534b", "#f2c94c", "#4a8fe0"][i]); box(px + 37, py, 8, 6, 1, "#7a5a3c", { lw: 0.25 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), x = X(); x.save(); x.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2); for (let i = 0; i < 2; i++) ell(px + 8.5 + i * 7, py - 7 - ((t * 5 + i * 3) % 6), 1.1, 1.7, 0, "#ffffff", { stroke: false }); x.restore(); } },
  rack: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1, py - 4, 14, tx(f.h) + 2, 1.2, "#2a2f33", { blur: 2 }); for (let i = 0; i < 7; i++) box(px + 2.5, py - 2 + i * 6.8, 11, 5.4, 0.5, "#3a4146", { shadow: false, lw: 0.25 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y); for (let i = 0; i < 7; i++) for (let k = 0; k < 3; k++) { const on = Math.floor(t * 3 + i * 1.7 + k * 2.3) % 4 !== 0; circ(px + 5 + k * 2.4, py + 0.7 + i * 6.8, 0.5, on ? (k === 2 ? "#f2c94c" : "#5fe08a") : "#24402c", { shadow: false, stroke: false, shade: false }); } } },
  copier: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1, py - 4, 30, 16, 1.6, "#d4d8db", { blur: 2 }); box(px + 4, py - 6.5, 22, 5, 0.6, "#3a3d44", { lw: 0.3 }); box(px + 5, py + 6, 22, 3, 0.6, "#fbfaf6", { lw: 0.25 }); box(px + 22, py - 1, 6, 3.6, 0.6, "#9fb3c0", { shadow: false, lw: 0.25 }); },
    d(f, t) { const px = tx(f.x), py = tx(f.y), se = S5(), h = hourF(), cp = se.ev && se.ev.copier, broke = !!cp && !(chars.tech && chars.tech.fixedDay === se.k);
      circ(px + 27, py - 4, 0.9, broke ? (Math.floor(t * 4) % 2 ? "#ff3b3b" : "#5a1010") : (Math.floor(t * 1.5) % 2 ? "#5fe08a" : "#2c6b45"), { shadow: false, lw: 0.2 });
      if (broke) { const x = X(); x.save(); x.translate(px + 10, py + 9.5); x.rotate(0.3); box(-3, -1.5, 7, 4, 0.3, "#fbfaf6", { lw: 0.25, shadow: false }); x.restore(); } } },
  plant: { s(f) { const px = tx(f.x), py = tx(f.y); plant(px + 8, py + 8, f.big ? 2.1 : 1.6, f.big ? "#5f8f52" : "#6f9a5a"); const h = hallo(); if (h >= 2) pumpkin(px + 12, py + 13, 1.1, false); const se = S5(); if (se.theme.id === "harvest") { circ(px + 3.5, py + 13, 1.6, "#ca8a04", { lw: 0.25 }); circ(px + 12.5, py + 13.5, 1.4, "#c2410c", { lw: 0.25 }); } },
    d(f, t) { const h = hallo(); if (h >= 2 && nightFactor(hourF()) > 0.2) { pumpkin(tx(f.x) + 12, tx(f.y) + 13, 1.1, true); glowAt(tx(f.x) + 12, tx(f.y) + 13, 7, "rgba(255,170,60,.3)"); } } },
  shelf: { s(f) { const px = tx(f.x), py = tx(f.y), cols = ["#7f1d1d", "#1d3557", "#e5b33b", "#2a9d8f", "#6a4c93"]; box(px + 1, py - 2, 14, 15, 1, "#5a3a24", { blur: 2 });
      for (let s = 0; s < 2; s++) { box(px + 2.2, py - 0.8 + s * 6.6, 11.6, 5.6, 0.3, "#3d2716", { shadow: false, stroke: false }); for (let i = 0; i < 4; i++) box(px + 2.8 + i * 2.8, py - 0.3 + s * 6.6, 2.2, 4.8, 0.3, cols[(s * 2 + i) % 5], { shadow: false, lw: 0.15 }); } x_cup(px + 12, py + 1.6, 0.6, "#f2c94c"); } },
  cabinet: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 1.5, py - 1, 13, 14, 1, "#3a3f45", { blur: 2 }); circ(px + 8, py + 5.5, 3.2, "#9aa3a8", { lw: 0.35 }); circ(px + 8, py + 5.5, 1.2, "#c79a3a", { shadow: false, lw: 0.2 }); for (let i = 0; i < 6; i++) line([px + 8, py + 5.5, px + 8 + Math.cos(i * 1.05) * 2.6, py + 5.5 + Math.sin(i * 1.05) * 2.6], "#5a6066", 0.25); } },   // El Jefe's safe
  indysign: { s(f) { const px = tx(f.x), py = tx(f.y); line([px + 4, py + 4, px + 3, py + 15], "#5a3a24", 0.8); line([px + 12, py + 4, px + 13, py + 15], "#5a3a24", 0.8); box(px - 2, py - 7, 20, 12, 1, "#f5ecd5", { blur: 1.4, lw: 0.35 }); },
    d(f) { const px = tx(f.x), py = tx(f.y), St = typeof S !== "undefined" ? S : null, a = St && St.accounts && St.accounts.bench, v = a ? a.pnl_total || 0 : 0, sm = R_.small();
      wtext("SPY", px + 8, py - 6, { size: sm ? 4.2 : 3.4, col: "#333", align: "center", w: 800 }); wtext(money0(v), px + 8, py - 1.6, { size: sm ? 3.8 : 3.2, col: v >= 0 ? "#15803d" : "#b91c1c", align: "center", w: 800, maxW: 18, shrink: 2.6 }); } },
  couch: { s(f) { const px = tx(f.x), py = tx(f.y), w = tx(f.w); box(px, py + 2, w, 22, 3.4, "#33557a", { blur: 2.4, oy: 1.2 }); box(px + 1.5, py + 3, w - 3, 7, 2.4, "#3d6690", { shadow: false, lw: 0.35 }); box(px - 1, py + 6, 5, 17, 2, "#2c4a6b", { lw: 0.35, blur: 1 }); box(px + w - 4, py + 6, 5, 17, 2, "#2c4a6b", { lw: 0.35, blur: 1 });
      for (let i = 0; i < 3; i++) box(px + 4.5 + i * (w - 9) / 3, py + 11, (w - 9) / 3 - 1, 11, 2, "#4572a0", { shadow: false, lw: 0.3 }); } },
  bull: { s(f) { const px = tx(f.x), py = tx(f.y); box(px + 2, py + 6, 28, 22, 2, "#4a4f55", { blur: 2.4, oy: 1.2 }); box(px + 4, py + 8, 24, 18, 1.4, "#5b6168", { shadow: false, lw: 0.3 });
      ell(px + 15, py + 15, 9.5, 5.5, 0, "#a8762f", { lw: 0.45, shadow: true }); ell(px + 13, py + 13.6, 6, 2.4, 0, "rgba(255,230,170,.35)", { stroke: false }); circ(px + 25.5, py + 13, 4, "#9a6a28", { lw: 0.4 });
      const x = X(); x.strokeStyle = "#e8d6a8"; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px + 24, py + 10); x.quadraticCurveTo(px + 26, py + 4.5, px + 30, py + 6); x.moveTo(px + 24, py + 16); x.quadraticCurveTo(px + 26, py + 21.5, px + 30, py + 20); x.stroke();
      line([px + 5.5, py + 15, px + 2.5, py + 11], "#8a5a20", 0.7); wtext("BULLS", px + 16, py + 24.2, { size: 3.4, col: "#e7c56a", align: "center", base: "middle", w: 800 }); } },
  trash: { s(f) { const px = tx(f.x), py = tx(f.y); circ(px + 8, py + 8, 4.4, "#5b646c", { lw: 0.4 }); circ(px + 8, py + 8, 3.4, "#3a4046", { shadow: false, lw: 0.25 }); box(px + 6.4, py + 6.4, 3.6, 2.6, 0.3, "#f4f1e8", { shadow: false, lw: 0.15 }); } },
  xtree: { s(f) { const px = tx(f.x) + 8, py = tx(f.y) + 10; box(px - 3, py, 6, 4, 0.6, "#b23a3a", { lw: 0.3 }); for (let i = 0; i < 3; i++) poly([px - 8 + i * 2, py - i * 6, px + 8 - i * 2, py - i * 6, px, py - 9 - i * 6], i % 2 ? "#3f7d4c" : "#356b41", { lw: 0.35 }); poly([px, py - 24, px + 1, py - 21.6, px - 1.6, py - 23, px + 1.6, py - 23, px - 1, py - 21.6], "#f2c94c", { lw: 0.2 }); for (let i = 0; i < 3; i++) box(px - 9 + i * 6, py + 1.5, 4.4, 3.4, 0.4, ["#4a8fe0", "#e5534b", "#f2c94c"][i], { lw: 0.25 }); },
    d(f, t) { const px = tx(f.x) + 8, py = tx(f.y) + 10, cols = ["#e5534b", "#f2c94c", "#4a8fe0", "#ffffff"]; for (let i = 0; i < 9; i++) { const yy = py - 4 - (i % 3) * 6, xx = px + ((i * 37) % 9) - 4.5 + (i % 3); if (Math.floor(t * 2 + i) % 3) circ(xx, yy, 0.8, cols[i % 4], { shadow: false, stroke: false, shade: false }); } glowAt(px, py - 10, 16, "rgba(255,220,140,.12)"); } },
};

// ---------------------------------------------------------------- per frame
function drawDynamic(t) {
  const x = X();
  windowGlass(20, 8, 26, 22, t); windowGlass(210, 8, 28, 24, t); windowGlass(322, 6, 29, 28, t); windowGlass(353, 6, 29, 28, t);
  // floor monitor: equity-curve shape + risk light + ticker heat dots (colours only, no numbers)
  { const St = typeof S !== "undefined" ? S : null, curve = (St && St.curve) || [], pts = curve.length > 1 ? curve.map((p) => (p.day || 0) + (p.swing || 0)) : Array.from({ length: 24 }, (_, i) => Math.sin(i * 0.7 + t * 0.6) + Math.sin(i * 0.23 + t * 0.2) * 2);
    const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1, sm = R_.small(); x.fillStyle = "#0d1512"; x.fillRect(147, 7, 58, 26);
    wtext("FLOOR MONITOR", 149, 7.8, { size: sm ? 4.2 : 3.3, col: "#f2c14e", w: 800, maxW: sm ? 54 : 34 });
    x.strokeStyle = "rgba(95,224,138,.18)"; x.lineWidth = 0.25; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(149, 11 + i * 5); x.lineTo(180, 11 + i * 5); x.stroke(); }
    x.strokeStyle = "#5fe08a"; x.lineWidth = 0.7; x.beginPath(); pts.forEach((v, i) => { const xx = 149 + (i / (pts.length - 1)) * 31, yy = 30 - ((v - mn) / rg) * (sm ? 12 : 15); i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); }); x.stroke();
    const reg = St && St.regime, on = reg && !reg.block && (reg.mult || 0) >= 1; box(182, 13, 22, 13, 1, on ? "#14532d" : "#5b1414", { shadow: false, lw: 0.35 }); glowAt(193, 19.5, 9, on ? "rgba(80,230,140,.22)" : "rgba(255,80,80,.22)");
    wtext("RISK", 193, 14.2, { size: sm ? 4.4 : 3.6, col: on ? "#86efac" : "#fca5a5", align: "center", w: 800 }); wtext(on ? "ON" : "OFF", 193, 19.6, { size: sm ? 4.6 : 3.8, col: on ? "#86efac" : "#fca5a5", align: "center", w: 800 });
    const tk = (St && St.tickers) || []; for (let i = 0; i < 7; i++) { const k = tk[i]; circ(184 + i * 3, 28, 1.1, !k ? "#333" : k.chg_pct >= 0.01 ? "#22c55e" : k.chg_pct >= 0 ? "#166534" : k.chg_pct > -0.01 ? "#7f1d1d" : "#ef4444", { shadow: false, stroke: false, shade: false }); } }
  { let et = { hh: 12, mm: 0 }; try { et = etNow(); } catch (e) { /* */ } const a1 = ((et.hh % 12) + et.mm / 60) / 12 * Math.PI * 2, a2 = et.mm / 60 * Math.PI * 2;
    line([390, 18, 390 + Math.sin(a1) * 3, 18 - Math.cos(a1) * 3], "#2a2620", 0.8); line([390, 18, 390 + Math.sin(a2) * 4.6, 18 - Math.cos(a2) * 4.6], "#b3261e", 0.45); }
  // STRATEGY wall board (replaces the old free-standing desk sign): title + one short live readout (week P&L, gate light)
  { const sm = R_.small(); let st = "closed", sit = false, wk = 0; try { st = mktStatus(); sit = deskSittingOut("swing"); wk = typeof swingWeekPnl === "function" ? swingWeekPnl() : 0; } catch (e) { /* */ }
    x.fillStyle = "#16261e"; x.fillRect(108.4, 6.4, 35.2, 27.2);
    wtext("STRATEGY", 126, 8, { size: sm ? 4.2 : 3.3, col: "#f2c14e", align: "center", w: 800, maxW: 33, shrink: 2.8 });
    wtext("SWING TRADING", 126, sm ? 13.4 : 13, { size: sm ? 4.8 : 4, col: "#eef3ea", align: "center", w: 800, maxW: 33, shrink: 2.8 });
    line([111, 21, 141, 21], "rgba(242,193,78,.45)", 0.4);
    circ(113.6, 27.4, 1.2, st !== "open" ? "#666" : sit ? "#f59e0b" : "#22c55e", { shadow: false, lw: 0.25 });
    wtext("WK " + money0(wk), 128, 27.4, { size: sm ? 4.4 : 3.4, col: wk >= 0 ? "#5fe08a" : "#ff6b6b", align: "center", base: "middle", w: 800, maxW: 26, shrink: 2.6 }); }
  // R&D whiteboard: Knobs' recent tuning changes (same readout as the pixel version)
  { const St = typeof S !== "undefined" ? S : null, tu = (St && St.tuning) || {}, ch = tu.recent_changes || [], sm = R_.small();
    const AL = { position_scale: "SIZE", risk_per_trade_pct: "RISK", breakout_lookback_days: "LOOKBK", trail_atr: "TRAIL", rsi_max: "RSI MAX", max_hold_days: "HOLD", rsi_entry: "RSI IN", rsi_exit: "RSI OUT", stop_atr: "STOP", target_atr: "TGT", reward_risk: "R:R", max_stop_pct: "STOP%", opening_range_minutes: "OR MIN", min_trend_pct: "TREND", min_gap_pct: "GAP", bb_k: "BB K", lookback_days: "LOOKBK", top_n: "TOP N", exit_rank: "EXIT#" };
    wtext("R&D", 248, 9, { size: sm ? 5.2 : 3.8, col: "#2f6fdb", w: 800 }); wtext(tu.running ? "TUNING" : "OOS > IS", 298, 9, { size: sm ? 4.4 : 3.4, col: "#d03030", align: "right", w: 800 });
    if (!sm) for (let i = 0; i < 2; i++) { const c = ch[ch.length - 1 - i]; wtext(c ? `${String(c.bot || "").toUpperCase()} ${AL[c.param] || String(c.param || "").replace(/_/g, " ").toUpperCase()}` : ["SHARPE - DD", "WALK FORWARD"][i], 248, 15.6 + i * 5, { size: 3.3, col: i === 0 ? "#222" : "#555", maxW: 50 }); } }
  stairSign(tx(15) + 1, tx(16) + 1, 46, 14, ["RESEARCH INC.", "B1", "B1 ▼"], false, t);   // clickable stairwell (HOT unchanged)
  // RI stair light: solid while Research Inc. staff are up here, blinking otherwise
  const vis = RI_IDS.some((id) => chars[id] && !chars[id].hidden); circ(tx(15) + 45, tx(17) + 2, 1.1, vis || Math.floor(t * 2) % 2 ? RIC : "#0b3b44", { shadow: false, lw: 0.25 });
  for (const lx of [9, 13, 17, 22]) { box(tx(lx) + 5, 45, 6, 3, 1, "#c79a3a", { shadow: false, lw: 0.25 }); }   // pendant lamps
  for (const f of FURN) { const fn = ART[f.type]; if (fn && fn.d) try { fn.d(f, t); } catch (e) { /* decor only */ } }
  try { lifeFx(t); } catch (e) { /* decor only */ }
}
// ---- office life: props react to real floor events (office_life.js) + daily happenings
function lifeFx(t) {
  const L = window.LIFE; if (!L) return; const x = X(), U = (k) => L.user(k), pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const glowRect = (a, b, w, h, col) => { x.save(); x.globalAlpha = 0.35 + 0.5 * pulse; x.strokeStyle = col; x.lineWidth = 0.9; x.strokeRect(a, b, w, h); x.restore(); };
  const mk = L.on("mkt"); if (mk) glowRect(146, 6, 60, 28, mk.data && mk.data.to === "open" ? "#5fe08a" : "#f2c14e");
  const rk = L.on("risk"); if (rk) glowRect(181, 12, 24, 15, rk.data && rk.data.on ? "#86efac" : "#fca5a5");
  if (L.on("rdwrite")) { glowRect(244, 6, 58, 22, "#2f6fdb"); const k = L.prog("rdwrite"), mx = 248 + ((k * 3) % 1) * 46, my = 24 - (Math.floor(k * 3) % 2) * 4.6; box(mx, my - 3, 1.4, 4.4, 0.5, "#2f6fdb", { lw: 0.2 }); }
  { const g = L.glow.swing || L.glow.day; if (g && T < g.until) glowRect(107, 5, 38, 30, g.up ? "#5fe08a" : "#ff6b6b"); }   // big swing P&L move: strategy board flashes
  if (L.on("ticket")) { const k = L.prog("ticket"), px = tx(21), py = tx(5); box(px + 20, py + 2, 8, 10, 0.4, "#fbfaf6", { lw: 0.25 }); if (k > 0.3) { x.save(); x.globalAlpha = Math.min(1, (k - 0.3) * 4); circ(px + 24, py + 8, 2.2, "rgba(190,30,30,.0)", { stroke: false, shadow: false }); x.strokeStyle = "#c0392b"; x.lineWidth = 0.5; x.beginPath(); x.arc(px + 24, py + 8, 2, 0, 7); x.stroke(); x.restore(); } }
  if (U(["copier", "copier_2"]) && !L.on("jam")) { const k = (t * 0.7) % 1; box(tx(4) + 8, tx(16) + 6 + k * 6, 14, 6, 0.4, "#fbfaf6", { lw: 0.25 }); }
  if (L.on("jam")) { circ(tx(4) + 28, tx(16) - 1, 1, Math.floor(t * 5) % 2 ? "#ff4a4a" : "#5a1414", { shadow: false, lw: 0.2 }); for (let i = 0; i < 3; i++) circ(tx(4) + 6 + i * 4, tx(16) + 13 + (i % 2), 1.2, "#f4f1ea", { lw: 0.2 }); }
  if (L.on("phone") && chars.goldie && !chars.goldie.hidden) { const g = chars.goldie, k = (t * 2) % 1; x.save(); x.globalAlpha = 1 - k; x.strokeStyle = "#f2c14e"; x.lineWidth = 0.5; for (let i = 0; i < 2; i++) { x.beginPath(); x.arc(g.x + 7, g.y - 10, 2 + k * 3 + i * 2, -0.8, 0.8); x.stroke(); } x.restore(); }
  for (const id of ORDER) { const c = chars[id]; if (!c || c.hidden || c.moving) continue;
    if (c.ty === 11 && c.tx >= 1 && c.tx <= 3) for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i * 0.33) % 1; x.save(); x.globalAlpha = 0.5 * (1 - k); circ(tx(c.tx) + 8 + Math.sin(t * 2 + i) * 1.2, tx(10) - 2 - k * 8, 1.3 + k, "#f4f1ea", { shadow: false, stroke: false, shade: false }); x.restore(); }
    if (c.tx === 5 && c.ty === 4) for (let i = 0; i < 3; i++) circ(tx(5) + 7 + i, tx(3) - ((t * 3 + i * 0.4) % 1) * 4, 0.45, "rgba(255,255,255,.85)", { shadow: false, stroke: false, shade: false });
    if (c.tx === 1 && c.ty === 4) circ(tx(1) + 8, tx(3) + 10, 1, Math.floor(t * 3) % 2 ? "#5fe08a" : "#1d4d2c", { shadow: false, stroke: false, shade: false }); }
  R_.lifeUnder(t, { table: [34, 81, 28, 13], balloons: [70, 92], banner: [104, 38.5, 100], cardSpots: ["break_0", "break_1", "break_2", "break_3"] });
}
const LAMPS = [[9, 4.5], [13, 4.5], [8.5, 9.5], [11.5, 9.5], [15.5, 9.5], [18.5, 9.5], [8.5, 13.5], [11.5, 13.5], [15.5, 13.5], [18.5, 13.5], [22, 5], [22, 10.5], [16.5, 4.5], [4.5, 12.5], [3, 5], [2, 10.5]];
const confetti = []; let lastPost = 0, cheerSeen = 0, nextNY = 0;
function drawPost(t) {
  const x = X(), n = nightFactor(hourF()), now = performance.now() / 1000, dt = Math.min(0.1, now - (lastPost || now)); lastPost = now;
  if (n > 0) { x.fillStyle = `rgba(10,14,36,${0.42 * n})`; x.fillRect(0, 48, LW, LH - 48); x.fillStyle = `rgba(10,14,36,${0.3 * n})`; x.fillRect(0, 0, LW, 48); }
  x.save(); x.globalCompositeOperation = "lighter";
  for (const [lx, ly] of LAMPS) { const a = tx(lx) + 8, b = tx(ly), r = 28 + n * 10, gr = x.createRadialGradient(a, b, 2, a, b, r), al = 0.06 + 0.15 * n; gr.addColorStop(0, `rgba(255,200,130,${al})`); gr.addColorStop(1, "rgba(255,200,130,0)"); x.fillStyle = gr; x.fillRect(a - r, b - r, r * 2, r * 2); }
  x.restore();
  // confetti: cheers (Friday cheer, award ceremonies) and New Year's
  const cheering = ORDER.filter((id) => chars[id] && !chars[id].hidden && chars[id].emote === "cheer").length, th = S5().theme;
  if (cheering >= 3 && now - cheerSeen > 8) { cheerSeen = now; spawn(40, ["#facc15", "#fde68a", "#22c55e", "#f8fafc", "#f472b6"]); }
  if (th.id === "newyear" && now > nextNY) { nextNY = now + 10; spawn(24, ["#facc15", "#f472b6", "#60a5fa", "#a855f7", "#f8fafc"]); }
  for (let i = confetti.length - 1; i >= 0; i--) { const p = confetti[i]; p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(now * 3 + i) * 0.15; p.r += p.vr * dt; p.life -= dt; if (p.life <= 0 || p.y > LH) { confetti.splice(i, 1); continue; }
    x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-1, -0.5, 2, 1); x.restore(); }
  try { R_.lifeOver(t); } catch (e) { /* */ }
}
function spawn(nc, cols) { for (let i = 0; i < nc && confetti.length < 120; i++) confetti.push({ x: Math.random() * LW, y: -4 - Math.random() * 30, vy: 18 + Math.random() * 22, vx: (Math.random() - 0.5) * 10, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, life: 9, c: cols[i % cols.length] }); }
// Oct 31 full-body costumes (same date-seeded spread as seasons.js) + RI masks; hat costumes come through social outfits already
const C31 = ["witch", "pumpkin", "horns", "catears", "vampire", "ghost", "pirate", "hero", "skeleton"]; let c31k = null, c31m = {};
function c31(day) { if (c31k === day) return c31m; const ids = ORDER.filter((id) => id !== "grok" && id !== "tech" && id !== "courier" && !RI[id] && !(CAST[id] && CAST[id].visitor)).sort((a, b) => R_.fnv(day + ":" + a + ":c31") - R_.fnv(day + ":" + b + ":c31"));
  const off = Math.floor(R_.fnv(day + ":c31o") * C31.length); c31m = {}; ids.forEach((id, i) => { c31m[id] = C31[(off + i) % C31.length]; }); c31k = day; return c31m; }
R_.pawnHook = function (c, k, hx, hy, r, view, dir) {
  if (!window.__seasons) return; const dt = window.__seasons.D(); if (dt.m !== 10 || dt.d !== 31) return;
  const mask = (col) => { if (view === "N") return; const w = view === "S" ? r * 1.7 : r * 1.1, ax = view === "S" ? hx - w / 2 : dir > 0 ? hx - r * 0.1 : hx - w + r * 0.1; box(ax, hy - 0.6, w, 1.9, 0.9, col, { shadow: false, lw: 0.2, shade: false }); };
  if (RI[c.id]) { mask("#141414"); return; }
  const cs = c31(dt.k)[c.id];
  if (cs === "ghost") { ell(c.x, hy + 3, r * 1.45, r * 2.1, 0, "rgba(248,248,252,.96)", { lw: 0.4 }); if (view !== "N") { circ(hx - 1.3, hy, 0.75, "#1b1b1b", { shadow: false, stroke: false, shade: false }); circ(hx + 1.3, hy, 0.75, "#1b1b1b", { shadow: false, stroke: false, shade: false }); } }
  else if (cs === "skeleton" && view !== "N") { for (let i = 0; i < 3; i++) line([hx - 2.6, hy + r + 2 + i * 1.5, hx + 2.6, hy + r + 2 + i * 1.5], "#f4f1e8", 0.55); line([hx, hy + r + 1.2, hx, hy + r + 6], "#f4f1e8", 0.55); }
  else if (cs === "pirate") { const x = X(); x.beginPath(); x.arc(hx, hy, r + 0.3, Math.PI, 0); x.closePath(); x.fillStyle = "#c0392b"; x.fill(); if (view !== "N") { const ex = view === "S" ? hx + r * 0.38 : hx + dir * r * 0.5; circ(ex, hy + 0.35, 1, "#111", { shadow: false, stroke: false, shade: false }); line([hx - r, hy - 1.4, hx + r, hy - 1.4], "#111", 0.3); } }
  else if (cs === "hero") { mask("#2f5aa8"); if (view === "N") ell(c.x, hy + r + 4.5, 5, 4.4, 0, "#c0392b", { lw: 0.4 }); }
};
const _rw = renderWorld;   // keep the pixel pipeline's render-time side effects (seasons decor refresh, Friday cheer) running off-screen
R_.floor = { pre: (t) => _rw(t), drawStatic, drawDynamic, drawPost, staticKey: () => { const s = S5(), w = wins(), St = typeof S !== "undefined" ? S : null, hall = (St && St.awards && St.awards.hall) || [];
  return [s.k, s.theme.id, s.theme.lvl || "", JSON.stringify(s.ev || {}), w.week ? w.week.winner : "", w.month ? w.month.winner : "", hall.map((h) => h && h.winner).join(",")].join("|"); } };
R_.ART = ART;
layout();
})();
