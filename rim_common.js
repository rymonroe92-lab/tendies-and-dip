"use strict";
/* RimWorld-inspired high-res vector renderer, shared by the trading floor (floor2d.js) and Research Inc. B1 (b1.js).
   DRAWING LAYER ONLY: replaces render()/layout() of the pixel engine; simulation, pathfinding, events, data feeds,
   social.js and seasons.js behaviour are untouched (they keep running and we read their state).
   All art is original canvas vector drawing (no external assets). Loaded after the floor script + add-ons, before rim_floor.js / rim_b1.js. */
(function () {
window.RIM = { on: true };
const R_ = window.RIM;
const INK = "#2a2620", RIC = "#3fd0dc";
R_.INK = INK; R_.RIC = RIC;
let x = null;   // current 2D context (display ctx or the static cache ctx); all coordinates in logical px (16 per tile)
R_.use = (c) => { x = c; };
// ---------------------------------------------------------------- primitives
function rr(a, b, w, h, r) { x.beginPath(); x.roundRect(a, b, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function shadow(fn, blur = 1.6, oy = 0.9, al = 0.3) { x.save(); x.shadowColor = `rgba(20,14,8,${al})`; x.shadowBlur = blur * R_.k; x.shadowOffsetY = oy * R_.k; fn(); x.restore(); }
function box(a, b, w, h, r, fill, o = {}) {
  if (o.shadow !== false) shadow(() => { rr(a, b, w, h, r); x.fillStyle = fill; x.fill(); }, o.blur || 1.6, o.oy == null ? 0.9 : o.oy, o.sa || 0.3);
  rr(a, b, w, h, r); x.fillStyle = fill; x.fill();
  if (o.shade !== false) { const gr = x.createLinearGradient(a, b, a, b + h); gr.addColorStop(0, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(0,0,0,.12)"); x.fillStyle = gr; rr(a, b, w, h, r); x.fill(); }
  if (o.stroke !== false) { x.lineWidth = o.lw || 0.42; x.strokeStyle = o.stroke || INK; rr(a, b, w, h, r); x.stroke(); }
}
function circ(a, b, r, fill, o = {}) {
  if (o.shadow !== false) shadow(() => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fillStyle = fill; x.fill(); }, o.blur || 1.3, o.oy == null ? 0.6 : o.oy);
  x.beginPath(); x.arc(a, b, r, 0, 7); x.fillStyle = fill; x.fill();
  if (o.shade !== false) { const gr = x.createRadialGradient(a - r * 0.35, b - r * 0.4, r * 0.1, a, b, r); gr.addColorStop(0, "rgba(255,255,255,.24)"); gr.addColorStop(1, "rgba(0,0,0,.14)"); x.fillStyle = gr; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  if (o.stroke !== false) { x.lineWidth = o.lw || 0.42; x.strokeStyle = o.stroke || INK; x.beginPath(); x.arc(a, b, r, 0, 7); x.stroke(); }
}
function ell(a, b, rx, ry, rot, fill, o = {}) {
  if (o.shadow) shadow(() => { x.beginPath(); x.ellipse(a, b, rx, ry, rot, 0, 7); x.fillStyle = fill; x.fill(); }, 1.3, 0.6);
  x.beginPath(); x.ellipse(a, b, rx, ry, rot, 0, 7); x.fillStyle = fill; x.fill();
  if (o.stroke !== false) { x.lineWidth = o.lw || 0.42; x.strokeStyle = o.stroke || INK; x.stroke(); }
}
function line(pts, col, lw = 0.45) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.strokeStyle = col; x.lineWidth = lw; x.stroke(); }
function poly(pts, fill, o = {}) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fillStyle = fill; x.fill(); if (o.stroke !== false) { x.lineWidth = o.lw || 0.42; x.strokeStyle = o.stroke || INK; x.stroke(); } }
function hex(h, f) { if (!h || h[0] !== "#") return h; let s = h.slice(1); if (s.length === 3) s = s.split("").map((c) => c + c).join(""); const n = parseInt(s, 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f)))); return `rgb(${c})`; }
function mute(h, amt = 0.22) {   // desaturate toward grey, the soft RimWorld palette
  if (!h || h[0] !== "#") return h; let s = h.slice(1); if (s.length === 3) s = s.split("").map((c) => c + c).join(""); const n = parseInt(s, 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255], gy = (c[0] + c[1] + c[2]) / 3; return `rgb(${c.map((v) => Math.round(v + (gy - v) * amt))})`;
}
// planks / tiles / concrete fills for the static layer (logical px rect)
function planks(a, b, w, h, base, seam, rnd) {
  x.fillStyle = base; x.fillRect(a, b, w, h); const ph = 4;
  for (let r = 0, yy = b; yy < b + h - 0.01; r++, yy += ph) {
    let xx = a - (r % 3) * 9;
    while (xx < a + w) { const len = 22 + rnd() * 26, x0 = Math.max(a, xx), ww = Math.min(len, a + w - x0); x.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "0,0,0"},${0.025 + rnd() * 0.04})`; x.fillRect(x0, yy, ww, ph); if (xx > a) { x.fillStyle = seam; x.fillRect(xx, yy + 0.3, 0.3, ph - 0.6); } xx += len; }
    x.fillStyle = seam; x.fillRect(a, yy + ph - 0.18, w, 0.18);
  }
}
function tiles(a, b, w, h, c1, c2, seam, s = 8) {
  for (let yy = b, j = 0; yy < b + h - 0.01; yy += s, j++) for (let xx = a, i = 0; xx < a + w - 0.01; xx += s, i++) { x.fillStyle = (i + j) % 2 ? c1 : c2; x.fillRect(xx, yy, Math.min(s, a + w - xx), Math.min(s, b + h - yy)); }
  x.strokeStyle = seam; x.lineWidth = 0.18; x.beginPath(); for (let xx = a; xx <= a + w + 0.01; xx += s) { x.moveTo(xx, b); x.lineTo(xx, b + h); } for (let yy = b; yy <= b + h + 0.01; yy += s) { x.moveTo(a, yy); x.lineTo(a + w, yy); } x.stroke();
}
function speckle(a, b, w, h, base, n, rnd, grid) {
  x.fillStyle = base; x.fillRect(a, b, w, h);
  for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "40,30,20"},${0.03 + rnd() * 0.05})`; x.beginPath(); x.arc(a + rnd() * w, b + rnd() * h, 0.2 + rnd() * 0.55, 0, 7); x.fill(); }
  if (grid) { x.strokeStyle = grid; x.lineWidth = 0.2; x.beginPath(); for (let xx = a; xx <= a + w + 0.01; xx += 16) { x.moveTo(xx, b); x.lineTo(xx, b + h); } for (let yy = b; yy <= b + h + 0.01; yy += 16) { x.moveTo(a, yy); x.lineTo(a + w, yy); } x.stroke(); }
}
function rug(a, b, w, h, fill, edge) { box(a, b, w, h, 1.6, fill, { shadow: false, shade: false, stroke: edge, lw: 0.35 }); x.save(); x.globalAlpha = 0.55; x.strokeStyle = edge; x.lineWidth = 0.3; rr(a + 1.4, b + 1.4, w - 2.8, h - 2.8, 1); x.stroke(); x.restore(); }
function wallSeg(a, b, w, h, col = "#4b463f") {   // thick dark wall block with bevel + course lines
  shadow(() => { x.fillStyle = col; x.fillRect(a, b, w, h); }, 2.2, 1.1, 0.42);
  x.fillStyle = col; x.fillRect(a, b, w, h); x.fillStyle = hex(col, 1.18); x.fillRect(a + 0.8, b + 0.8, w - 1.6, h - 1.6);
  x.strokeStyle = "rgba(0,0,0,.16)"; x.lineWidth = 0.22; for (let yy = b + 3.6; yy < b + h - 0.8; yy += 2.8) { x.beginPath(); x.moveTo(a + 0.8, yy); x.lineTo(a + w - 0.8, yy); x.stroke(); }
  x.lineWidth = 0.45; x.strokeStyle = "#221e19"; x.strokeRect(a + 0.22, b + 0.22, w - 0.44, h - 0.44);
}
function glassSeg(x1, y1, x2, y2) { x.lineCap = "butt"; line([x1, y1, x2, y2], INK, 1.9); line([x1, y1, x2, y2], "#a9cbd6", 1.2); line([x1 + (x2 > x1 ? 1 : 0), y1 + (y2 > y1 ? 1 : 0), x2 - (x2 > x1 ? 1 : 0), y2 - (y2 > y1 ? 1 : 0)], "rgba(255,255,255,.7)", 0.28); x.lineCap = "round"; }
function plant(a, b, s = 1, leaf = "#6f8f5a", pot = "#8a6248") {
  circ(a, b + 0.8 * s, 2.3 * s, pot, { blur: 1.2 });
  const n = 7; for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + 0.3; ell(a + Math.cos(an) * 1.8 * s, b - 0.6 * s + Math.sin(an) * 1.5 * s, 2.3 * s, 1.15 * s, an, i % 2 ? leaf : hex(leaf, 1.14), { stroke: "#33402a", lw: 0.3 }); }
  circ(a, b - 0.6 * s, 1.1 * s, hex(leaf, 1.25), { stroke: "#33402a", lw: 0.3, shadow: false });
}
function chair(a, b, rot = 0, col = "#4b5560") { x.save(); x.translate(a, b); x.rotate(rot); circ(0, 3.6, 2.6, "rgba(30,30,34,.55)", { shadow: false, stroke: false, shade: false }); box(-4.2, -2.6, 8.4, 6.6, 2.4, col, { blur: 1.4 }); box(-3.2, -1.6, 6.4, 4.4, 1.8, hex(col, 1.22), { shadow: false, lw: 0.25 }); box(-5, -5, 10, 2.6, 1.3, hex(col, 0.78), { blur: 0.9, oy: 0.5 }); x.restore(); }
function screen(a, b, w, on, col = RIC) {   // monitor seen from above; glowing edge faces the sitter (north)
  box(a - 0.8, b + 1, 1.6, 1.5, 0.5, "#3a3d42", { shadow: false, lw: 0.3 }); box(a - w / 2, b - 0.8, w, 1.9, 0.7, "#2e3136", { blur: 1, oy: 0.5, lw: 0.35 });
  x.fillStyle = on ? col : "#56606a"; x.globalAlpha = on ? 0.95 : 0.6; rr(a - w / 2 + 0.5, b - 0.7, w - 1, 0.6, 0.3); x.fill(); x.globalAlpha = 1;
}
Object.assign(R_, { rr, shadow, box, circ, ell, line, poly, hex, mute, planks, tiles, speckle, rug, wallSeg, glassSeg, plant, chair, screen, ctx: () => x });
R_.rng = (s) => { let v = s; return () => ((v = (v * 16807) % 2147483647) / 2147483647); };
R_.fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
R_.season = () => { const S5 = window.__seasons; if (!S5) return { theme: { id: "" }, weather: "clear", ev: {}, m: 0, d: 0 }; const d = S5.D(); return { theme: d.theme, weather: d.weather, ev: S5.events(), m: d.m, d: d.d, k: d.k }; };

// ---------------------------------------------------------------- pawns: round head + simple hair on a rounded torso, no limbs; S/N/E/W views
// ---------------------------------------------------------------- per-character look variety (deterministic per id; drawing only)
// build: bw = body width, bh = body length (height top-down), hs = head size, hw/hh = head shape; style = hairstyle; beard optional.
const SKINS = ["#f6dccb", "#f1c9a5", "#e8b48a", "#d29a6a", "#b97b4f", "#9a5f3a", "#6e3f24", "#4a2a18"];
const TRAITS = {
  grok:   { skin: "#b97b4f", hair: "#1b1b1b", style: "short",   bw: 1.16, bh: 1.08, hs: 1.04, hw: 1.06, hh: 0.97 },
  goldie: { skin: "#f3cfb0", hair: "#f2cf5b", style: "wavy",    bw: 0.96, bh: 0.92, hs: 0.97, hw: 0.95, hh: 1.04 },
  dash:   { skin: "#e8b48a", hair: "#7a3b12", style: "sidepart", bw: 0.86, bh: 1.1, hs: 0.97, hw: 0.94, hh: 1.06 },
  vee:    { skin: "#6e3f24", hair: "#1b120c", style: "bun",     bw: 0.98, bh: 1.0, hs: 1.0, hw: 0.95, hh: 1.05 },
  zip:    { skin: "#f1c9a5", hair: "#3a2618", style: "spiky",   bw: 0.92, bh: 1.08, hs: 1.0, hw: 0.97, hh: 1.03 },
  snap:   { skin: "#9a5f3a", hair: "#151515", style: "curly",   bw: 1.24, bh: 0.92, hs: 1.06, hw: 1.06, hh: 0.96 },
  trek:   { skin: "#d29a6a", hair: "#5c3a1e", style: "ponytail", bw: 1.12, bh: 1.1, hs: 1.0, hw: 1.0, hh: 1.0 },
  dip:    { skin: "#f6dccb", hair: "#b8482a", style: "bob",     bw: 0.85, bh: 0.9, hs: 0.95, hw: 0.96, hh: 1.04 },
  rota:   { skin: "#4a2a18", hair: "#121212", style: "afro",    bw: 1.0, bh: 1.08, hs: 1.0, hw: 0.98, hh: 1.02 },
  drift:  { skin: "#e0ac69", hair: "#4a3020", style: "locs",    bw: 1.2, bh: 1.0, hs: 1.04, hw: 1.04, hh: 0.98 },
  pixel:  { skin: "#c98e5e", hair: "#3d348b", style: "bob",     bw: 0.86, bh: 0.92, hs: 0.97, hw: 0.97, hh: 1.03 },
  knobs:  { skin: "#f1c9a5", hair: "#c7c7c7", style: "receding", bw: 1.2, bh: 0.98, hs: 1.06, hw: 1.04, hh: 0.98, beard: "stubble" },
  indy:   { skin: "#8a5232", hair: "#a8a8a8", style: "crop",    bw: 0.88, bh: 1.1, hs: 0.98, hw: 0.94, hh: 1.06, beard: "full" },
  nancy:  { skin: "#f6dccb", hair: "#8a6a4a", style: "bob",     bw: 0.88, bh: 0.9, hs: 0.96, hw: 0.97, hh: 1.03 },
  scoop:  { skin: "#f1c9a5", hair: "#6b4423", style: "short",   bw: 1.0, bh: 1.08, hs: 1.0, hw: 1.0, hh: 1.0 },
  tape:   { skin: "#6e3f24", hair: "#1b1b1b", style: "bun",     bw: 0.86, bh: 1.0, hs: 0.97, hw: 0.95, hh: 1.05 },
  beats:  { skin: "#e8b48a", hair: "#b5651d", style: "curlylong", bw: 1.18, bh: 0.92, hs: 1.02, hw: 1.03, hh: 0.98 },
  sage:   { skin: "#a86b42", hair: "#d9d9d9", style: "short",   bw: 1.12, bh: 1.0, hs: 1.02, hw: 1.04, hh: 0.98, beard: "full" },
  proof:  { skin: "#fbe3d0", hair: "#3a2a1a", style: "bald",    bw: 1.0, bh: 0.92, hs: 1.0, hw: 1.02, hh: 0.99 },
};
const STYLES = ["short", "crop", "curly", "bob", "ponytail", "bald", "sidepart", "bun", "wavy"], HAIRS = ["#1b1b1b", "#3a2618", "#6b4423", "#a0703a", "#d8b46a", "#9a9a9a", "#7a2e1a"];
function traitsOf(id) {
  if (TRAITS[id]) return TRAITS[id];
  const f = (s) => R_.fnv(id + ":" + s), b = [0.88, 1, 1.12, 1.22][Math.floor(f("b") * 4)];
  return (TRAITS[id] = { skin: SKINS[Math.floor(f("s") * SKINS.length)], hair: HAIRS[Math.floor(f("h") * HAIRS.length)], style: STYLES[Math.floor(f("y") * STYLES.length)], bw: b, bh: 0.9 + f("t") * 0.2, hs: 0.96 + f("z") * 0.08, hw: 0.95 + f("w") * 0.1, hh: 0.95 + f("v") * 0.1 });
}
function hairBack(k, hx, hy, r, view, dir, hair) {   // hair that sits behind the head (drawn before it)
  const st = k.style, sx = view === "E" || view === "W" ? -dir * 0.8 : 0;
  if (st === "afro") circ(hx + sx * 0.6, hy - 0.6, r * 1.42, hair, { shadow: false, lw: 0.4 });
  else if (st === "curly") for (let i = 0; i < 9; i++) { const an = Math.PI * (0.95 + i * 0.137); circ(hx + Math.cos(an) * r * 0.98, hy + Math.sin(an) * r * 0.98, r * 0.34, hair, { shadow: false, lw: 0.25 }); }
  else if (st === "curlylong") { for (let i = 0; i < 12; i++) { const an = Math.PI * (0.62 + i * 0.16); circ(hx + Math.cos(an) * r * 1.05 + sx, hy + 0.6 + Math.sin(an) * r * 1.05, r * 0.42, hair, { shadow: false, lw: 0.25 }); } }
  else if (st === "long" || st === "wavy" || st === "locs") { ell(hx + sx, hy + (st === "wavy" ? 1.2 : 1.6), r * 1.12, r * (st === "wavy" ? 1.3 : 1.45), 0, hair, { lw: 0.4 }); if (st === "locs") for (let i = -2; i <= 2; i++) line([hx + sx + i * 1.4, hy + 1, hx + sx + i * 1.5, hy + r * 1.9], "rgba(0,0,0,.25)", 0.35); if (st === "wavy") for (let i = -1; i <= 1; i += 2) circ(hx + sx + i * r * 0.95, hy + r * 1.05, r * 0.32, hair, { shadow: false, stroke: false, shade: false }); }
  else if (st === "bob") ell(hx + sx, hy + 0.6, r * 1.14, r * 1.08, 0, hair, { lw: 0.4 });
  else if (st === "ponytail" && view !== "S") { const px = view === "N" ? hx : hx - dir * r * 1.05; ell(px, hy + (view === "N" ? r * 1.15 : 0.8), r * 0.42, r * 0.85, view === "N" ? 0 : dir * 0.5, hair, { lw: 0.3 }); }
}
function hairFront(k, hx, hy, r, view, dir, hair) {   // hair on top of the head
  const st = k.style, side = view === "E" || view === "W";
  if (st === "bald") { if (view === "N") ell(hx, hy + r * 0.55, r * 0.8, r * 0.3, 0, "rgba(0,0,0,.06)", { stroke: false }); else ell(hx - r * 0.3, hy - r * 0.45, r * 0.32, r * 0.18, -0.4, "rgba(255,255,255,.22)", { stroke: false }); return; }
  if (st === "receding") { const x2 = x; if (view === "N") { x2.beginPath(); x2.arc(hx, hy, r + 0.2, 0.15, Math.PI - 0.15); x2.closePath(); x2.fillStyle = hair; x2.fill(); return; } for (const s of side ? [-dir] : [-1, 1]) ell(hx + s * r * 0.86, hy - r * 0.05, r * 0.28, r * 0.55, 0, hair, { lw: 0.25 }); return; }
  if (st === "crop") { x.save(); x.globalAlpha = 0.85; hairCap(hx, hy, r - 0.15, hair, view, dir); x.restore(); return; }
  hairCap(hx, hy, r, hair, view, dir);
  if (st === "sidepart" && view !== "N") line([hx - r * 0.35, hy - r * 0.95, hx - r * 0.15, hy - r * 0.45], "rgba(0,0,0,.35)", 0.3);
  if (st === "bun" && !(k.ri === "bun")) circ(hx + (side ? -dir * r * 0.4 : 0), hy - r * 0.95, r * 0.42, hair, { shadow: false, lw: 0.35 });
  if (st === "curly" || st === "curlylong" || st === "afro") for (let i = 0; i < 5; i++) circ(hx - r * 0.6 + i * r * 0.3, hy - r * 0.78 - (i % 2) * 0.3, r * 0.24, hair, { shadow: false, stroke: false, shade: false });
  if (st === "ponytail" && view === "S") circ(hx, hy - r * 0.98, r * 0.2, hex(hair, 0.8), { shadow: false, stroke: false, shade: false });
}
function beardOn(k, hx, hy, r, view, dir, hair) {
  if (!k.beard || view === "N") return; const side = view !== "S", cxb = side ? hx + dir * r * 0.35 : hx;
  if (k.beard === "stubble") { x.save(); x.globalAlpha = 0.3; ell(cxb, hy + r * 0.62, r * (side ? 0.5 : 0.72), r * 0.36, 0, hair, { stroke: false }); x.restore(); return; }
  x.beginPath(); x.ellipse(cxb, hy + r * 0.45, r * (side ? 0.62 : 0.86), r * 0.62, 0, 0.05 * Math.PI, 0.95 * Math.PI); x.closePath(); x.fillStyle = hair; x.fill(); x.lineWidth = 0.3; x.strokeStyle = INK; x.stroke();
}
const RI_HATS = { fedora: 1, bun: 1, bowtie: 1, beret: 1, hardhat: 1 };
function lookOf(c) {
  let k = CAST[c.id] || {};
  if (window.__social && window.__social.outfitOf) { try { const o = window.__social.outfitOf(c.id); if (o) k = o; } catch (e) { /* keep base */ } }
  { const tr = traitsOf(c.id); k = Object.assign({}, k, tr, { long: tr.style === "long" ? 1 : 0, puff: 0, spiky: tr.style === "spiky" ? 1 : 0 }); }
  if (c.id === "nancy" && window.__b1 && window.__b1.nancy) { try { const n = window.__b1.nancy.look(); k = Object.assign({}, k, { shirt: n.shirt, pants: n.pants, blazer: n.blazer, costume: k.costume || n.costume, acc: "pearls" }); } catch (e) { /* ignore */ } }
  return k;
}
function hairCap(cx, hy, r, col, view, dir) {
  if (view === "N") { circ(cx, hy, r + 0.25, col, { shadow: false, lw: 0.4 }); return; }
  if (view === "S") { x.beginPath(); x.arc(cx, hy, r + 0.25, Math.PI + 0.12, -0.12); x.quadraticCurveTo(cx, hy - r * 0.35, cx - (r + 0.25) * Math.cos(0.12), hy - (r + 0.25) * Math.sin(0.12)); x.closePath(); }
  else { x.beginPath(); x.arc(cx, hy, r + 0.25, dir > 0 ? Math.PI * 0.55 : -Math.PI * 0.45, dir > 0 ? Math.PI * 1.95 : Math.PI * 0.95); x.closePath(); }
  x.fillStyle = col; x.fill(); x.lineWidth = 0.4; x.strokeStyle = INK; x.stroke();
}
function capDome(cx, hy, r, col, view, dir, bill = true) {
  x.beginPath(); x.arc(cx, hy - 0.2, r + 0.35, Math.PI + 0.05, -0.05); x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 0.4; x.strokeStyle = INK; x.stroke();
  if (!bill) return;
  if (view === "S") ell(cx, hy - r * 0.18, r * 0.95, r * 0.32, 0, hex(col, 0.82), { lw: 0.35 });
  else if (view !== "N") ell(cx + dir * r * 1.05, hy - r * 0.2, r * 0.75, r * 0.28, 0, hex(col, 0.82), { lw: 0.35 });
}
function headwear(c, k, cx, hy, r, view, dir) {
  const front = view === "S", side = view === "E" || view === "W";
  const acc = k.costume ? "costume:" + k.costume : k.ri && RI_HATS[k.ri] ? "ri:" + k.ri : k.acc;
  switch (acc) {
    case "jefe": ell(cx, hy - r * 0.3, r * 1.95, r * 0.78, 0, "#7a5030", { lw: 0.45 }); ell(cx, hy - r * 0.55, r * 1.02, r * 0.66, 0, "#8d6038", { lw: 0.45 });
      line([cx - r * 0.55, hy - r * 0.6, cx + r * 0.55, hy - r * 0.6], "rgba(40,24,10,.6)", 0.35); x.fillStyle = "#3b2414"; x.fillRect(cx - r * 1.0, hy - r * 0.3, r * 2.0, 0.55); break;
    case "bow": { const bx = cx + r * 0.65, by = hy - r * 0.8; poly([bx, by, bx - 2.2, by - 1.3, bx - 2.2, by + 1.3], "#7c3aed", { lw: 0.3 }); poly([bx, by, bx + 2.2, by - 1.3, bx + 2.2, by + 1.3], "#7c3aed", { lw: 0.3 }); circ(bx, by, 0.75, "#fde047", { shadow: false, lw: 0.25 }); break; }
    case "headband": if (!side || true) { x.save(); x.beginPath(); x.arc(cx, hy, r + 0.05, 0, 7); x.clip(); x.fillStyle = "#f4f4f0"; x.fillRect(cx - r - 1, hy - r * 0.62, r * 2 + 2, 1.5); x.fillStyle = "#d94a4a"; x.fillRect(cx - r - 1, hy - r * 0.62 + 0.55, r * 2 + 2, 0.45); x.restore(); } break;
    case "beanie": capDome(cx, hy, r + 0.2, mute(k.hat || "#ff6b6b"), view, dir, false); x.fillStyle = hex(mute(k.hat || "#ff6b6b"), 0.82); rr(cx - r - 0.4, hy - 0.9, r * 2 + 0.8, 1.2, 0.5); x.fill(); circ(cx, hy - r - 0.9, 1.1, "#f4f1ea", { shadow: false, lw: 0.3 }); break;
    case "cap": case "courier": case "tech": capDome(cx, hy, r, mute(acc === "courier" ? "#ef3e36" : acc === "tech" ? "#4b6584" : k.hat || "#95d5b2"), view, dir); break;
    case "visor": { const col = mute(k.hat || "#fde047"); x.save(); x.beginPath(); x.arc(cx, hy, r + 0.3, 0, 7); x.clip(); x.fillStyle = col; x.fillRect(cx - r - 1, hy - r * 0.75, r * 2 + 2, 1.5); x.restore(); if (front) ell(cx, hy - r * 0.35, r * 0.9, r * 0.3, 0, hex(col, 0.85), { lw: 0.3 }); else if (side) ell(cx + dir * r * 1.05, hy - r * 0.45, r * 0.7, r * 0.26, 0, hex(col, 0.85), { lw: 0.3 }); break; }
    case "headset": x.beginPath(); x.arc(cx, hy, r + 0.6, Math.PI * 1.05, Math.PI * 1.95); x.strokeStyle = "#222"; x.lineWidth = 0.75; x.stroke(); if (!side || dir < 0) circ(cx - r - 0.3, hy + 0.3, 1, "#2b2b2b", { shadow: false, lw: 0.3 }); if (!side || dir > 0) circ(cx + r + 0.3, hy + 0.3, 1, "#2b2b2b", { shadow: false, lw: 0.3 }); if (front) line([cx + r + 0.3, hy + 0.8, cx + 1.6, hy + r * 0.9], "#222", 0.4); break;
    case "headphones": x.beginPath(); x.arc(cx, hy, r + 0.7, Math.PI * 1.05, Math.PI * 1.95); x.strokeStyle = "#ff4fa3"; x.lineWidth = 0.8; x.stroke(); if (!side || dir < 0) ell(cx - r - 0.4, hy + 0.2, 1.1, 1.5, 0, "#ff4fa3", { lw: 0.3 }); if (!side || dir > 0) ell(cx + r + 0.4, hy + 0.2, 1.1, 1.5, 0, "#ff4fa3", { lw: 0.3 }); break;
    case "goggles": if (view !== "N") { x.save(); x.beginPath(); x.arc(cx, hy, r + 0.2, 0, 7); x.clip(); x.fillStyle = "#2b3a44"; x.fillRect(cx - r - 1, hy - r * 0.78, r * 2 + 2, 0.7); x.restore(); for (const s of side ? [dir] : [-1, 1]) circ(cx + s * r * 0.42 + (side ? dir * 0.5 : 0), hy - r * 0.62, 0.95, "#5ec8f2", { shadow: false, lw: 0.3 }); } break;
    case "ri:fedora": ell(cx, hy - r * 0.42, r * 1.5, r * 0.58, 0, "#5a4836", { lw: 0.42 }); ell(cx, hy - r * 0.62, r * 0.88, r * 0.5, 0, "#6e5a44", { lw: 0.42 }); x.fillStyle = "#3a2e22"; x.fillRect(cx - r * 0.88, hy - r * 0.45, r * 1.76, 0.5); if (view !== "N") box(cx + r * 0.15, hy - r * 1.0, 1.6, 1.3, 0.25, "#f4f1e8", { shadow: false, lw: 0.22 }); break;
    case "ri:bun": circ(cx, hy - r * 1.02, r * 0.42, k.hair, { shadow: false, lw: 0.35 }); break;
    case "ri:beret": ell(cx - 0.5, hy - r * 0.72, r * 1.05, r * 0.5, -0.18, "#2f3348", { lw: 0.4 }); circ(cx - 0.5, hy - r * 1.12, 0.45, "#2f3348", { shadow: false, lw: 0.25 }); break;
    case "ri:hardhat": ell(cx, hy - r * 0.25, r * 1.25, r * 0.5, 0, "#d9b23a", { lw: 0.4 }); x.beginPath(); x.arc(cx, hy - r * 0.2, r * 0.97, Math.PI, 0); x.closePath(); x.fillStyle = "#e9c44c"; x.fill(); x.lineWidth = 0.4; x.strokeStyle = INK; x.stroke(); x.fillStyle = "rgba(255,255,255,.45)"; x.fillRect(cx - 0.3, hy - r * 1.12, 0.6, r * 0.85); break;
    case "costume:witch": ell(cx, hy - r * 0.45, r * 1.8, r * 0.62, 0, "#4c1d95", { lw: 0.4 }); poly([cx - r * 0.8, hy - r * 0.6, cx + r * 0.8, hy - r * 0.6, cx + 1.2, hy - r * 2.3], "#5b21b6", { lw: 0.4 }); break;
    case "costume:pumpkin": ell(cx, hy - r * 0.55, r * 1.15, r * 0.7, 0, "#f97316", { lw: 0.4 }); line([cx, hy - r * 1.2, cx, hy + 0.1 - r * 0.05], "rgba(160,60,10,.6)", 0.3); line([cx, hy - r * 1.2, cx + 0.6, hy - r * 1.6], "#15803d", 0.6); break;
    case "costume:horns": poly([cx - r * 0.75, hy - r * 0.55, cx - r * 0.35, hy - r * 0.8, cx - r * 0.9, hy - r * 1.55], "#dc2626", { lw: 0.3 }); poly([cx + r * 0.75, hy - r * 0.55, cx + r * 0.35, hy - r * 0.8, cx + r * 0.9, hy - r * 1.55], "#dc2626", { lw: 0.3 }); break;
    case "costume:catears": for (const s of [-1, 1]) { poly([cx + s * r * 0.85, hy - r * 0.5, cx + s * r * 0.25, hy - r * 0.95, cx + s * r * 0.9, hy - r * 1.55], "#1f1f1f", { lw: 0.3 }); poly([cx + s * r * 0.75, hy - r * 0.68, cx + s * r * 0.42, hy - r * 0.92, cx + s * r * 0.8, hy - r * 1.3], "#f9a8d4", { stroke: false }); } break;
  }
  if (k.hat2 && !k.costume && acc !== "jefe" && !(k.ri && RI_HATS[k.ri])) capDome(cx, hy, r, mute(k.hat2), view, dir);
}
function face(c, k, cx, hy, r, view, dir) {
  if (view === "N") return;
  const side = view !== "S", ex = side ? [cx + dir * r * 0.5] : [cx - r * 0.38, cx + r * 0.38];
  if (k.acc === "jefe") {   // shades + mustache
    if (side) box(dir > 0 ? cx + r * 0.05 : cx - r * 1.0, hy - 0.4, r * 0.95, 1.5, 0.5, "#111", { shadow: false, lw: 0.2, shade: false });
    else { box(cx - r * 0.82, hy - 0.5, r * 1.64, 1.6, 0.6, "#111", { shadow: false, lw: 0.2, shade: false }); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(cx - r * 0.6, hy - 0.3, 0.9, 0.35); }
    x.beginPath(); const mx = side ? cx + dir * r * 0.45 : cx; x.ellipse(mx, hy + r * 0.48, side ? 1.3 : 2.1, 0.62, 0, 0, 7); x.fillStyle = "#2b1a10"; x.fill(); return;
  }
  x.fillStyle = "#2a2620"; for (const e of ex) { x.beginPath(); x.arc(e, hy + 0.35, 0.42, 0, 7); x.fill(); }
  const gl = k.acc === "glasses" ? "#c9a7ff" : k.ri === "bun" ? mute(k.shirt) : null;
  if (gl) { x.strokeStyle = gl; x.lineWidth = 0.35; for (const e of ex) { x.beginPath(); x.arc(e, hy + 0.35, 0.95, 0, 7); x.stroke(); } if (!side) line([ex[0] + 0.95, hy + 0.35, ex[1] - 0.95, hy + 0.35], gl, 0.3); }
}
function drawPawn(c, t) {
  const k = lookOf(c), view = c.face === "N" ? "N" : c.face === "E" || c.face === "W" ? c.face : "S", dir = c.face === "W" ? -1 : 1, side = view === "E" || view === "W";
  const moving = c.moving || (c.path && c.path.length);
  const sitting = !moving && (c.pose === "sit" || c.pose === "feetup" || c.pose === "couch");
  let cx = c.x, cy = c.y - (sitting ? (c.pose === "couch" ? 8 : 1.2) : 0.4);   // couch sitters sink into the cushions
  if (moving) cy -= Math.abs(Math.sin((c.walkT || 0) * 9)) * 0.7;
  if (c.jumpUntil > T) cy -= Math.abs(Math.sin(T * 12)) * 2.2;
  const bw = k.bw || 1, bh = k.bh || 1, r = 3.9 * (k.hs || 1), body = mute(k.dress || k.shirt || "#888", 0.18), skin = k.skin || "#e0ac69", hair = mute(k.hair || "#333", 0.1);
  // drop shadow
  x.fillStyle = "rgba(20,14,8,.26)"; x.beginPath(); x.ellipse(c.x, c.y + 5.2, 4.8 * bw, 1.5, 0, 0, 7); x.fill();
  const bx = cx, by = cy + 1.8 - (bh - 1) * 2.2, brx = (side ? 4.4 : 5.1) * (side ? 0.6 + bw * 0.4 : bw), bry = 4.4 * bh * (bw > 1.18 ? 1.05 : 1);
  if (k.top === "cape" || (k.costume && window.__seasons && false)) ell(bx, by + 0.6, brx + 0.8, bry + 0.6, 0, "#1f1f1f", { lw: 0.4 });
  const hy = cy - 2.3 - (bh - 1) * 4.6, hx = cx + (side ? dir * 0.7 : 0), hatOnly = k.costume === "witch" || k.costume === "pumpkin" || k.acc === "jefe" || k.ri === "fedora" || k.ri === "hardhat";
  if (view !== "S") hairBack(k, hx, hy, r, view, dir, hair);
  // torso
  x.beginPath(); if (k.dress) { x.moveTo(bx - brx * 0.7, by - bry * 0.85); x.quadraticCurveTo(bx, by - bry * 1.2, bx + brx * 0.7, by - bry * 0.85); x.quadraticCurveTo(bx + brx * 1.25, by + bry * 0.9, bx, by + bry * 1.02); x.quadraticCurveTo(bx - brx * 1.25, by + bry * 0.9, bx - brx * 0.7, by - bry * 0.85); }
  else x.ellipse(bx, by, brx, bry, 0, 0, 7);
  shadow(() => { x.fillStyle = body; x.fill(); }, 1.4, 0.7, 0.3); x.fillStyle = body; x.fill();
  const gr = x.createRadialGradient(bx - 1.4, by - 1.6, 0.4, bx, by, brx * 1.1); gr.addColorStop(0, "rgba(255,255,255,.2)"); gr.addColorStop(1, "rgba(0,0,0,.2)"); x.fillStyle = gr; x.fill();
  x.lineWidth = 0.45; x.strokeStyle = INK; x.stroke();
  // torso details
  if (view !== "N") {
    if (k.dress && k.dots) { x.fillStyle = mute(k.dots, 0.1); for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(bx - 3 + ((i * 5) % 7), by - 1.5 + ((i * 3) % 5), 0.42, 0, 7); x.fill(); } }
    const top = k.top || (k.coat ? "coat" : k.tie ? "tie" : k.blazer ? "blazer" : "");
    if (top === "tie" || (k.tie && !k.top)) { poly([bx - 1.1, by - bry + 0.6, bx + 1.1, by - bry + 0.6, bx, by - bry + 1.5], "#f5f5f0", { lw: 0.2 }); poly([bx - 0.55, by - bry + 1.3, bx + 0.55, by - bry + 1.3, bx + 0.4, by + 1.6, bx, by + 2.3, bx - 0.4, by + 1.6], mute(k.tc || k.tie || "#7f1d1d"), { lw: 0.22 }); }
    else if (top === "coat" || top === "suit" || top === "jacket" || top === "blazer") { poly([bx - 1.6, by - bry + 0.5, bx, by + 1.5, bx + 1.6, by - bry + 0.5], k.inner || k.jk || (top === "coat" ? "#cfd6dc" : "#eceae4"), { lw: 0.25 }); if (top === "suit") line([bx, by - bry + 1.2, bx, by + 1.2], "#7f1d1d", 0.5); }
    else if (top === "hoodie") { x.strokeStyle = hex(body, 0.78); x.lineWidth = 0.6; x.beginPath(); x.arc(bx, by - bry + 0.6, 2.2, 0.1, Math.PI - 0.1); x.stroke(); }
    else if (top === "sweater" || top === "ugly") { x.strokeStyle = top === "ugly" ? "#15803d" : hex(body, 0.8); x.lineWidth = 0.4; line([bx - brx * 0.8, by + 0.5, bx + brx * 0.8, by + 0.5], x.strokeStyle, 0.45); if (top === "ugly") { circ(bx - 1.8, by - 1.2, 0.4, "#fff", { shadow: false, stroke: false, shade: false }); circ(bx + 1.6, by + 1.8, 0.4, "#fde047", { shadow: false, stroke: false, shade: false }); } }
    else if (top === "polo") { poly([bx - 1.4, by - bry + 0.5, bx, by - bry + 1.4, bx + 1.4, by - bry + 0.5], hex(body, 1.4), { lw: 0.25 }); }
    if (k.acc === "jefe") { x.strokeStyle = "#e3b23c"; x.lineWidth = 0.55; x.beginPath(); x.arc(bx, by - bry + 0.4, 2.4, 0.25, Math.PI - 0.25); x.stroke(); circ(bx, by - bry + 2.9, 0.75, "#f2c14e", { shadow: false, lw: 0.25 }); }
    if (k.acc === "pearls") for (let i = -2; i <= 2; i++) circ(bx + i * 0.95, by - bry + 1.1 + Math.abs(i) * -0.2 + 0.4, 0.42, "#fbf7ee", { shadow: false, lw: 0.15, shade: false });
    if (k.acc === "ri" || RI_LIKE(c.id)) { if (k.ri === "bowtie" && view === "S") { poly([bx, by - bry + 1.6, bx - 1.7, by - bry + 0.8, bx - 1.7, by - bry + 2.4], "#2b2d42", { lw: 0.2 }); poly([bx, by - bry + 1.6, bx + 1.7, by - bry + 0.8, bx + 1.7, by - bry + 2.4], "#2b2d42", { lw: 0.2 }); }
      line([bx - 1.6, by - bry + 0.7, bx, by + 0.6, bx + 1.6, by - bry + 0.7], RIC, 0.42); box(bx - 0.9, by + 0.3, 1.8, 1.6, 0.3, "#f6f4ee", { shadow: false, lw: 0.2, shade: false }); x.fillStyle = RIC; x.fillRect(bx - 0.5, by + 0.9, 1, 0.35); }
  } else if (k.acc === "ri" || RI_LIKE(c.id)) line([bx - 1.8, by - bry + 0.9, bx + 1.8, by - bry + 0.9], RIC, 0.5);
  // head
  if (view === "S") hairBack(k, hx, hy, r, view, dir, hair);
  shadow(() => ell(hx, hy, r * (k.hw || 1), r * (k.hh || 1), 0, mute(skin, 0.08), { stroke: false }), 0.9, 0.3); ell(hx, hy, r * (k.hw || 1), r * (k.hh || 1), 0, mute(skin, 0.08), { lw: 0.42 });
  { const g2 = x.createRadialGradient(hx - r * 0.35, hy - r * 0.4, r * 0.1, hx, hy, r); g2.addColorStop(0, "rgba(255,255,255,.2)"); g2.addColorStop(1, "rgba(0,0,0,.12)"); x.fillStyle = g2; x.beginPath(); x.ellipse(hx, hy, r * (k.hw || 1), r * (k.hh || 1), 0, 0, 7); x.fill(); }
  beardOn(k, hx, hy, r, view, dir, hair);
  face(c, k, hx, hy, r, view, dir);
  if (!(hatOnly && view === "N")) hairFront(k, hx, hy, r, view, dir, hair);
  if (k.spiky && !k.costume) for (let i = -2; i <= 2; i++) poly([hx + i * 1.4 - 0.8, hy - r * 0.7, hx + i * 1.4 + 0.8, hy - r * 0.7, hx + i * 1.5, hy - r - 1.4 - (i % 2 ? 0 : 0.6)], hair, { lw: 0.3 });
  headwear(c, k, hx, hy, r, view, dir);
  props(c, k, cx, cy, view, dir, sitting, t);
  if (R_.pawnHook) try { R_.pawnHook(c, k, hx, hy, r, view, dir); } catch (e) { /* decor only */ }
}
const RI_LIKE = (id) => typeof RI_IDS !== "undefined" ? RI_IDS.includes(id) : ["scoop", "tape", "beats", "sage", "proof"].includes(id);
function props(c, k, cx, cy, view, dir, sitting, t) {
  const hx = cx + (view === "W" ? -5.6 : 5.6), hy2 = cy + 1.6;
  if (c.carry) { box(hx - 1.6, hy2 - 1.4, 3.4, 2.8, 0.4, "#e9c46a", { lw: 0.3, blur: 0.6 }); line([hx - 1, hy2, hx + 1.2, hy2], "#7a5a12", 0.25); }
  if ((k.acc === "kevin" || c.id === "zip") && view !== "N") { box(hx - 0.8, hy2 - 1.8, 1.7, 3, 0.4, "#111", { lw: 0.2, shadow: false }); x.fillStyle = "#7dd3fc"; x.fillRect(hx - 0.45, hy2 - 1.4, 1, 2.1); }
  if (k.acc === "paper" && sitting) { box(cx - 3.6, cy + 0.2, 7.2, 4.4, 0.4, "#f2efe6", { lw: 0.3, blur: 0.6 }); for (let i = 0; i < 3; i++) line([cx - 2.8, cy + 1.2 + i * 1.1, cx + 2.6, cy + 1.2 + i * 1.1], "#9a968c", 0.25); }
  if (c.phoneUntil > T) box(cx + (view === "W" ? -4.6 : 3.4), cy - 3.4, 1.4, 2.4, 0.3, "#111", { lw: 0.2, shadow: false });
  if (c.eatUntil > T) circ(hx, hy2, 1.3, "#e8c27a", { lw: 0.3 });
  if (c.slumpUntil > T) { ell(cx, cy - 10.5, 3.2, 1.4, 0, "#94a3b8", { lw: 0.3 }); ell(cx - 1.4, cy - 11.2, 1.6, 1.1, 0, "#a8b4c4", { stroke: false }); if (Math.floor(t * 4) % 2) { line([cx - 1.2, cy - 8.8, cx - 1.5, cy - 7.8], "#60a5fa", 0.35); line([cx + 1.2, cy - 8.8, cx + 0.9, cy - 7.8], "#60a5fa", 0.35); } }
  if (k.acc === "courier" && c.task && window.__social) { const L = window.__social.lunch(); if (L && L.phase === "delivery") { if (L.food === "pizza") for (let i = 0; i < 3; i++) box(cx - 3.6, cy - 0.6 - i * 1.1, 7.2, 1.2, 0.3, i % 2 ? "#e8d3a8" : "#f2e2bf", { lw: 0.25, shadow: i === 0 }); else box(hx - 1.6, hy2 - 2, 3.2, 3.8, 0.4, "#b08968", { lw: 0.3 }); } }
  if (k.acc === "tech" && !sitting) box(hx - 1.6, hy2 - 0.8, 3.4, 2.4, 0.4, "#c0392b", { lw: 0.3 });
}
R_.drawPawn = drawPawn; R_.lookOf = lookOf;

// ---------------------------------------------------------------- overlay: RimWorld-style name tags under pawns + speech bubbles (real fonts)
const FONT = '"Segoe UI","DejaVu Sans","Helvetica Neue",Arial,sans-serif';
const KEEP = new Set(["SPY", "QQQ", "IWM", "IPO", "CPI", "FOMC", "ET", "AM", "PM", "RI", "B1", "OK", "PNL", "ETF", "VWAP", "RSI", "RSI2", "ATR", "OOS", "IS", "R&D", "BB", "AI", "BTC", "USD", "NYSE", "CEO", "EPS", "GDP", "FED", "OR", "TV", "DJ", "VIP", "PB&J", "BLT", "NFL", "MVP", "ATH", "YOLO", "LOL", "HODL", "FOMO", "IV", "DD", "TA", "PDT", "EOD", "ASAP", "NAV", "UP", "Q1", "Q2", "Q3", "Q4"]);
let NAMES = null;
function names() { if (NAMES) return NAMES; NAMES = new Set(); for (const id in CAST) for (const w of String(CAST[id].name || "").split(/\s+/)) if (w) NAMES.add(w.toUpperCase()); for (const w of ["NANCY", "KEVIN", "JEFE", "GOLDIE", "FRIDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY", "SUNDAY", "OCTOBER", "DECEMBER", "NOVEMBER", "JANUARY", "HALLOWEEN", "THANKSGIVING", "CHRISTMAS"]) NAMES.add(w); return NAMES; }
function tickSet() { const s = new Set(); for (const src of [typeof S !== "undefined" ? S : null, typeof ST !== "undefined" ? ST : null]) for (const tk of (src && src.tickers) || []) s.add(String(tk.symbol).toUpperCase()); return s; }
function niceCase(txt) {
  const s = String(txt || ""); if (/[a-z]/.test(s)) return s;   // already mixed case
  const nm = names(), tk = tickSet(); let start = true;
  return s.split(/(\s+)/).map((w) => {
    if (/^\s+$/.test(w)) return w;
    const core = w.replace(/[^A-Z0-9&$%]/g, ""), keep = KEEP.has(core) || tk.has(core) || /\d/.test(core) || /^\$/.test(w) || (core.length === 1 && core === "I");
    let out = keep ? w : nm.has(core) ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase();
    if (start && !keep) out = out.replace(/^([^A-Za-z]*)([a-z])/, (m, p1, p2) => p1 + p2.toUpperCase());
    start = /[.!?]$/.test(w); return out;
  }).join("");
}
const title = (s) => String(s || "").toLowerCase().replace(/(^|[\s.-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bRi\b/g, "RI");
function wrapLines(c2, txt, maxW) { const ws = txt.split(" "), out = []; let cur = ""; for (const w of ws) { const t2 = cur ? cur + " " + w : w; if (c2.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; } if (cur) out.push(cur); if (out.length > 3) { out.length = 3; out[2] = out[2].replace(/\s*\S*$/, "") + "…"; } return out; }
function rrD(c2, a, b, w, h, r) { c2.beginPath(); c2.roundRect(a, b, w, h, r); }
function overlay() {
  const c2 = ctx, D2 = DPR, cssK = SC / D2;
  const tagPx = Math.round(D2 * Math.max(8, Math.min(11, cssK * 4.7))), bubPx = Math.round(D2 * Math.max(8.5, Math.min(12, cssK * 5)));
  c2.setTransform(1, 0, 0, 1, 0, 0); c2.textBaseline = "middle";
  const vis = ORDER.map((id) => chars[id]).filter((c) => c && !c.hidden).sort((a, b) => a.y - b.y);
  const placed = [], bubbles = [], q = [];
  let btnR = null; const fb = document.getElementById("floorBtns");
  if (fb && fb.offsetWidth) { const a = fb.getBoundingClientRect(), b = cv.getBoundingClientRect(), k = cv.width / (b.width || 1); btnR = { x: (a.left - b.left) * k, y: (a.top - b.top) * k, w: a.width * k, h: a.height * k }; }
  for (const c of vis) {
    const nm = title(CAST[c.id] ? CAST[c.id].name : c.id), ri = RI_LIKE(c.id);
    c2.font = `600 ${tagPx}px ${FONT}`; const tw = c2.measureText(nm).width, pad = tagPx * 0.38, tag = ri ? tagPx * 1.35 : 0, h = tagPx * 1.35, w = tw + pad * 2 + tag;
    const cx = c.x * SC; let lx = Math.round(cx - w / 2), ly = Math.round((c.y + 6.3) * SC);
    for (let g2 = 0; g2 < 4; g2++) { const hit = placed.find((r) => lx < r.x + r.w + 2 && lx + w + 2 > r.x && ly < r.y + r.h + 1 && ly + h + 1 > r.y); if (!hit) break; ly = hit.y + hit.h + 2; }
    placed.push({ x: lx, y: ly, w, h });
    const sel = typeof selected !== "undefined" && selected === c.id;
    c2.fillStyle = sel ? "rgba(242,193,78,.95)" : "rgba(18,16,13,.66)"; rrD(c2, lx, ly, w, h, h * 0.28); c2.fill();
    c2.fillStyle = COL[c.id] || "#999"; c2.fillRect(lx + h * 0.28, ly + h - Math.max(1.5, D2), w - h * 0.56, Math.max(1.5, D2));
    if (ri) { c2.fillStyle = RIC; rrD(c2, lx + 2 * D2 * 0.6, ly + h * 0.16, tag - D2, h * 0.68, h * 0.18); c2.fill(); c2.font = `800 ${Math.round(tagPx * 0.72)}px ${FONT}`; c2.fillStyle = "#0d2a2e"; c2.textAlign = "center"; c2.fillText("RI", lx + 1.2 * D2 + (tag - D2) / 2, ly + h / 2 + 0.5); }
    c2.font = `600 ${tagPx}px ${FONT}`; c2.textAlign = "left"; c2.fillStyle = sel ? "#1a1205" : "#f3efe6"; c2.fillText(nm, lx + tag + pad, ly + h / 2 + 0.5);
    if (c.emote && ({ "!": 1, "?": 1, thumb: 1, sweat: 1 })[c.emote]) {
      const sym = c.emote === "thumb" ? "OK" : c.emote === "sweat" ? ":(" : c.emote, bg = c.emote === "!" ? "#c94a3e" : c.emote === "thumb" ? "#3f9a5a" : c.emote === "sweat" ? "#4a74c9" : "#7d5bc4";
      c2.font = `800 ${tagPx}px ${FONT}`; const ew = c2.measureText(sym).width + pad * 2; c2.fillStyle = bg; rrD(c2, lx + w + 2 * D2, ly, ew, h, h / 2); c2.fill(); c2.fillStyle = "#fff"; c2.textAlign = "center"; c2.fillText(sym, lx + w + 2 * D2 + ew / 2, ly + h / 2 + 0.5);
    }
    if (c.emote === "cheer" || c.emote === "clap") { const sp = Math.floor(T * 8) % 2; c2.fillStyle = "#ffd54a"; for (let i = 0; i < 4; i++) { const an = i * 1.57 + (sp ? 0.6 : 0), rr2 = 8.5 * SC / 1; c2.beginPath(); c2.arc(cx + Math.cos(an) * rr2 * 0.9, (c.y - 3) * SC + Math.sin(an) * rr2 * 0.7, 1.4 * D2, 0, 7); c2.fill(); } }
    if (c.bubble) q.push([c, cx]);
  }
  for (const [c, cx] of q) {
    c2.font = `600 ${bubPx}px ${FONT}`;
    const txt = niceCase(c.bubble.text), lines = wrapLines(c2, txt, bubPx * 9.5), lh = bubPx * 1.22;
    const bw = Math.max(...lines.map((l) => c2.measureText(l).width)) + bubPx * 1.1, bh = lines.length * lh + bubPx * 0.6, gap = bubPx * 0.5;
    let bx = Math.round(cx - bw / 2); bx = Math.max(2, Math.min(cv.width - bw - 2, bx));
    const headTop = (c.y - 9.5) * SC; let by = Math.round(headTop - bh - gap), down = false;
    const obst = bubbles.concat(placed, btnR ? [btnR] : []);
    const hitAt = (y) => obst.find((r) => bx < r.x + r.w + 2 && bx + bw + 2 > r.x && y < r.y + r.h + 2 && y + bh + 2 > r.y);
    let y = by, ok = false; const maxUp = by - bh * 2.2, y0 = Math.round((c.y + 6.3) * SC + tagPx * 1.6);
    for (let k = 0; k < 4 && y >= 2 && y >= maxUp; k++) { const hit = hitAt(y); if (!hit) { ok = true; break; } y = hit.y - bh - gap; }
    if (!ok) { y = y0; for (let k = 0; k < 3 && y + bh <= cv.height - 2; k++) { const hit = hitAt(y); if (!hit) { ok = down = true; break; } y = hit.y + hit.h + gap; } }
    if (ok) by = y; else if (Math.floor(T / 2.5) % 2 === 0) continue;
    by = Math.max(2, by); bubbles.push({ x: bx, y: by, w: bw, h: bh });
    const tx = Math.max(bx + bubPx, Math.min(bx + bw - bubPx, cx));
    c2.save(); c2.shadowColor = "rgba(0,0,0,.28)"; c2.shadowBlur = 3 * D2; c2.shadowOffsetY = 1.2 * D2; c2.fillStyle = "#fffdf5"; rrD(c2, bx, by, bw, bh, bubPx * 0.5); c2.fill(); c2.restore();
    c2.beginPath(); if (down) { c2.moveTo(tx - bubPx * 0.45, by + 1); c2.lineTo(tx + bubPx * 0.45, by + 1); c2.lineTo(tx, by - bubPx * 0.6); } else { c2.moveTo(tx - bubPx * 0.45, by + bh - 1); c2.lineTo(tx + bubPx * 0.45, by + bh - 1); c2.lineTo(tx, by + bh + bubPx * 0.6); }
    c2.fillStyle = "#fffdf5"; c2.fill(); c2.lineWidth = Math.max(1, D2 * 0.7); c2.strokeStyle = "#2a2620"; c2.stroke();
    rrD(c2, bx, by, bw, bh, bubPx * 0.5); c2.stroke();
    c2.fillStyle = "#fffdf5"; c2.fillRect(tx - bubPx * 0.4, down ? by + 0.5 : by + bh - 1.5 * D2, bubPx * 0.8, 1.6 * D2);
    c2.fillStyle = c.bubble.kind === "up" ? "#1f7a43" : c.bubble.kind === "dn" ? "#b3261e" : "#2a2620"; c2.textAlign = "center";
    lines.forEach((l, i) => c2.fillText(l, bx + bw / 2, by + bubPx * 0.3 + lh * (i + 0.5) + 0.5));
  }
  R_.lastOverlay = { labels: placed.length, bubbles: bubbles.length, tagPx, bubPx };
}
R_.niceCase = niceCase;

// ---------------------------------------------------------------- layout (2x DPR minimum), static cache, render pipeline
layout = function () {
  DPR = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
  const wrap = $("floorWrap"), side = matchMedia("(min-width:760px) and (min-aspect-ratio:1/1)").matches;
  const availW = (side ? wrap.clientWidth : document.documentElement.clientWidth) - (side ? 12 : 4);
  const availH = side ? wrap.clientHeight - 8 : Math.round(window.innerHeight * 0.62);
  SC = Math.min(availW / LW, availH / LH) * DPR * ZOOM;
  cv.width = Math.round(LW * SC); cv.height = Math.round(LH * SC);
  cv.style.width = (cv.width / DPR) + "px"; cv.style.height = (cv.height / DPR) + "px";
  wrap.style.height = side ? "" : (cv.height / DPR) + "px";
  LP = Math.max(2, Math.round(SC * 0.62)); ctx.imageSmoothingEnabled = true; R_.cacheKey = null;
};
const cache = document.createElement("canvas"), cctx = cache.getContext("2d");
R_.cacheKey = null; R_.frames = 0;
render = function (t) {
  const F = R_.floor; if (!F) return;
  if (F.pre) try { F.pre(t); } catch (e) { /* side-effect pass only */ }
  const key = cv.width + "x" + cv.height + "|" + (F.staticKey ? F.staticKey() : "");
  if (key !== R_.cacheKey) {
    cache.width = cv.width; cache.height = cv.height; cctx.setTransform(SC, 0, 0, SC, 0, 0); cctx.lineJoin = "round"; cctx.lineCap = "round";
    R_.k = SC; x = cctx; try { F.drawStatic(t); } catch (e) { console.warn("rim static", e); } R_.cacheKey = key;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(cache, 0, 0);
  ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.lineJoin = "round"; ctx.lineCap = "round"; R_.k = SC; x = ctx;
  if (F.drawDynamic) F.drawDynamic(t);
  const vis = ORDER.map((id) => chars[id]).filter((c) => c && !c.hidden).sort((a, b) => a.y - b.y);
  for (const c of vis) { try { drawPawn(c, t); } catch (e) { if (!R_.pawnErr) { R_.pawnErr = 1; console.warn("rim pawn", c.id, e); } } }
  if (F.drawPost) F.drawPost(t);
  overlay(); R_.frames++;
};
R_.overlay = overlay;

// ---------------------------------------------------------------- shared decor helpers (both floors)
const X = () => x;
function frame(a, b, w, h, fill, edge = "#5b4330") { box(a - 1.2, b - 1.2, w + 2.4, h + 2.4, 1.2, edge, { blur: 1.4, oy: 0.8 }); box(a, b, w, h, 0.6, fill, { shadow: false, lw: 0.3 }); }
function icoMagnifier(cx, cy, s, col) { const x = X(); x.strokeStyle = col; x.lineWidth = 1.1 * s; x.beginPath(); x.arc(cx - 0.8 * s, cy - 0.8 * s, 2.4 * s, 0, 7); x.stroke(); line([cx + 1 * s, cy + 1 * s, cx + 3 * s, cy + 3 * s], col, 1.3 * s); }
function icoArrowUp(cx, cy, s, col) { poly([cx, cy - 3 * s, cx + 3 * s, cy + 0.4 * s, cx + 1.1 * s, cy + 0.4 * s, cx + 1.1 * s, cy + 3 * s, cx - 1.1 * s, cy + 3 * s, cx - 1.1 * s, cy + 0.4 * s, cx - 3 * s, cy + 0.4 * s], col, { lw: 0.3 }); }
function scribble(a, b, w, rows, col, rnd, gap = 2.6) { for (let i = 0; i < rows; i++) line([a, b + i * gap, a + w * (0.45 + rnd() * 0.55), b + i * gap], col, 0.45); }
function bunting(theme, y) {
  const x = X(), sets = { holiday: ["#c0392b", "#2e8b57", "#e5b33b"], halloween: ["#e8792b", "#6b3fa0", "#2b2b2b"], valentine: ["#e05a8a", "#f4a6c0", "#fff"], stpat: ["#2e9b4f", "#7bc96f", "#e5b33b"],
    july4: ["#c0392b", "#f4f1ea", "#2f5aa8"], harvest: ["#c2410c", "#b45309", "#ca8a04"], fall: ["#c2410c", "#d97706", "#a16207"], newyear: ["#e5b33b", "#c9ced6", "#2b2b2b"], spring: ["#f4a6c0", "#a7d9a0", "#f7e08a"], summerstart: ["#4fb3d9", "#f7e08a", "#f08a5d"], winter: ["#bfe3f2", "#ffffff", "#8ab6d6"] };
  const cols = sets[theme]; if (!cols) return;
  x.strokeStyle = theme === "holiday" ? "#2f6b3a" : "rgba(60,50,40,.7)"; x.lineWidth = theme === "holiday" ? 1.6 : 0.35; x.beginPath();
  for (let a = 14; a <= LW - 14; a += 1) { const yy = y + Math.sin((a - 14) / (LW - 28) * Math.PI * 9) * 1.6 + 1.6; a === 14 ? x.moveTo(a, yy) : x.lineTo(a, yy); } x.stroke();
  for (let a = 18, i = 0; a < LW - 14; a += 9, i++) { const yy = y + Math.sin((a - 14) / (LW - 28) * Math.PI * 9) * 1.6 + 1.6, c = cols[i % cols.length];
    if (theme === "holiday" || theme === "newyear" || theme === "winter") circ(a, yy + 1.6, 1.15, c, { lw: 0.25, blur: 0.6 });
    else if (theme === "valentine") { poly([a - 1.6, yy + 0.4, a, yy + 3, a + 1.6, yy + 0.4, a + 0.8, yy - 0.4, a, yy + 0.3, a - 0.8, yy - 0.4], c, { lw: 0.25 }); }
    else poly([a - 2, yy, a + 2, yy, a, yy + 3.6], c, { lw: 0.25 }); }
}
const WOOD = "#a27b53";
function deskTop(px, py, w, col = WOOD) { box(px + 1, py + 1, w - 2, 13, 1.6, col, { blur: 1.8 }); const x = X(); x.fillStyle = hex(col, 0.72); rr(px + 1, py + 11.5, w - 2, 2.5, 1); x.fill(); }
function mug(a, b, col = "#f4f1ea") { circ(a, b, 1.5, col, { lw: 0.3, blur: 0.7 }); circ(a, b, 0.9, "#6b4a2e", { shadow: false, stroke: false, shade: false }); }
function balloons(a, b, t) { const cols = ["#e5534b", "#4a8fe0", "#f2c94c"]; for (let i = 0; i < 3; i++) { const bx = a + (i - 1) * 3.2, by = b - 15 - (i % 2) * 3 + Math.sin(t * 1.5 + i) * 0.8; line([bx, by + 2.6, a, b], "rgba(255,255,255,.7)", 0.25); ell(bx, by, 2.1, 2.6, 0, cols[i], { lw: 0.3, shadow: true }); } }
function upNote(a, b) { box(a, b, 9, 8, 0.6, "#fde68a", { lw: 0.3, blur: 0.8 }); icoArrowUp(a + 4.5, b + 4, 0.9, "#c2410c"); }
// ---------------------------------------------------------------- wall-board text (logical px, crisp at any DPR). R_.small(): phone-size view -> titles only, bigger
const MONO = '"DejaVu Sans Mono","Menlo","Consolas",monospace';
R_.small = () => SC / DPR < 1.6;
function fitText(str, maxW) { str = String(str == null ? "" : str); if (!maxW || x.measureText(str).width <= maxW) return str; let s = str; while (s.length > 1 && x.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s.trimEnd() + "…"; }
function wtext(str, a, b, o = {}) {   // o: size, col, w (weight), align, maxW, mono, shrink (min size before ellipsis), base
  let size = o.size || 3.6; const fam = o.mono ? MONO : FONT, wt = o.w || 700;
  x.font = `${wt} ${size}px ${fam}`;
  if (o.maxW && o.shrink) while (size > o.shrink && x.measureText(String(str)).width > o.maxW) { size -= 0.2; x.font = `${wt} ${size}px ${fam}`; }
  x.textAlign = o.align || "left"; x.textBaseline = o.base || "top"; x.fillStyle = o.col || INK;
  const s = fitText(str, o.maxW); x.fillText(s, a, b); return x.measureText(s).width;
}
function marquee(str, a, b, w, o = {}, t = 0, speed = 9) {   // scrolls when it doesn't fit
  const size = o.size || 3.4; x.font = `${o.w || 700} ${size}px ${o.mono ? MONO : FONT}`; const tw = x.measureText(str).width;
  x.save(); x.beginPath(); x.rect(a, b - size * 0.2, w, size * 1.5); x.clip();
  if (tw <= w) wtext(str, a + (o.center ? w / 2 : 0), b, Object.assign({}, o, { align: o.center ? "center" : "left" }));
  else { const off = (t * speed) % (tw + 12); wtext(str, a - off, b, o); wtext(str, a - off + tw + 12, b, o); }
  x.restore();
}
const short = (v, n) => { const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); return n && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const money0 = (v) => (v == null || isNaN(v) ? "-" : (v >= 0 ? "+$" : "-$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 }));
// hover affordance: pointer cursor over clickable spots (HOT areas, pawns); floors read R_.hover for highlights
R_.hover = null;
cv.addEventListener("mousemove", (ev) => { const r = cv.getBoundingClientRect(), lx = (ev.clientX - r.left) * (cv.width / r.width) / SC, ly = (ev.clientY - r.top) * (cv.height / r.height) / SC; R_.hover = { x: lx, y: ly };
  let hot = false; try { for (const h of HOT) if (lx >= h.x && lx <= h.x + h.w && ly >= h.y && ly <= h.y + h.h) { hot = true; break; } for (const id of ORDER) { const c = chars[id]; if (!c.hidden && lx >= c.x - 9 && lx <= c.x + 9 && ly >= c.y - 22 && ly <= c.y + 8) { hot = true; break; } } } catch (e) { /* */ }
  cv.style.cursor = hot ? "pointer" : ""; });
cv.addEventListener("mouseleave", () => { R_.hover = null; cv.style.cursor = ""; });
R_.hoverIn = (a, b, w, h) => !!R_.hover && R_.hover.x >= a && R_.hover.x <= a + w && R_.hover.y >= b && R_.hover.y <= b + h;
function stairSign(a, b, w, h, lines, arrowUp, t) {   // cyan clickable stair sign with arrow, pulse + hover glow
  const hov = R_.hoverIn(a - 2, b - 2, w + 4, h + 4), pulse = 0.35 + 0.3 * Math.sin(t * 3);
  x.save(); x.shadowColor = "rgba(63,208,220," + (hov ? 0.95 : pulse) + ")"; x.shadowBlur = (hov ? 5 : 3) * R_.k; rr(a, b, w, h, 1.6); x.fillStyle = hov ? "#22707c" : "#17525c"; x.fill(); x.restore();
  rr(a, b, w, h, 1.6); x.lineWidth = hov ? 0.8 : 0.5; x.strokeStyle = RIC; x.stroke();
  const sm = R_.small(), ax = a + 6, sz = sm ? 1.25 : 1.05; x.save(); x.translate(ax, b + h / 2); if (!arrowUp) x.rotate(Math.PI); icoArrowUp(0, 0, sz, RIC); x.restore();
  const tx0 = a + 12, tw = w - 14;
  if (sm) wtext(lines[2] || lines[0], tx0 + tw / 2, b + h / 2 + 0.3, { size: 6.4, col: "#dffbff", align: "center", base: "middle", maxW: tw, shrink: 4.5, w: 800 });
  else { wtext(lines[0], tx0 + tw / 2, b + h / 2 - 0.5, { size: 3.6, col: RIC, align: "center", base: "bottom", maxW: tw, shrink: 2.8, w: 800 }); wtext(lines[1], tx0 + tw / 2, b + h / 2 + 0.6, { size: 3.6, col: "#dffbff", align: "center", base: "top", maxW: tw, shrink: 2.6, w: 800 }); }
}
// ---------------------------------------------------------------- office life + daily happenings (shared drawing; data comes from office_life.js)
const LFE = () => window.LIFE || null;
function balloonsAt(a, b, t, n = 4) { const cols = ["#e5534b", "#4a8fe0", "#f2c94c", "#5fb37a", "#c77ddb"]; for (let i = 0; i < n; i++) { const bx = a + (i - (n - 1) / 2) * 3.4, by = b - 14 - (i % 2) * 3.4 + Math.sin(t * 1.4 + i) * 0.8; line([bx, by + 2.6, a, b], "rgba(255,255,255,.75)", 0.25); ell(bx, by, 2.2, 2.7, 0, cols[i % cols.length], { lw: 0.3, shadow: true }); ell(bx - 0.7, by - 0.9, 0.5, 0.8, -0.4, "rgba(255,255,255,.5)", { stroke: false }); } }
function cake(a, b) { circ(a, b, 4.4, "#fbf5ea", { lw: 0.35 }); circ(a, b, 3.2, "#f4a6c0", { shadow: false, lw: 0.25 }); for (let i = 0; i < 5; i++) { const an = i * 1.256, cx = a + Math.cos(an) * 2, cy = b + Math.sin(an) * 2; box(cx - 0.3, cy - 1.6, 0.6, 1.8, 0.2, ["#4a8fe0", "#f2c94c", "#5fb37a"][i % 3], { shadow: false, stroke: false }); circ(cx, cy - 1.9, 0.45, "#ffcf5a", { shadow: false, stroke: false, shade: false }); } }
function pizzaBox(a, b, open) { box(a, b, 10, 9, 0.6, "#d9b98a", { lw: 0.3 }); if (open) { circ(a + 5, b + 4.5, 3.6, "#e8b04b", { lw: 0.25, shadow: false }); for (let i = 0; i < 5; i++) circ(a + 3.4 + (i % 3) * 1.6, b + 3.4 + (i >> 1) * 1.4, 0.5, "#c0392b", { shadow: false, stroke: false, shade: false }); } else line([a + 2, b + 4.5, a + 8, b + 4.5], "rgba(120,80,40,.4)", 0.4); }
const confettiL = []; let lastConf = 0;
let confC = null;
function confettiBurst(n) { const c0 = confC || [LW / 2, LH / 2]; for (let i = 0; i < n && confettiL.length < 90; i++) confettiL.push({ x: c0[0] + (Math.random() - 0.5) * 70, y: c0[1] - 30 - Math.random() * 14, vx: (Math.random() - 0.5) * 16, vy: 8 + Math.random() * 12, r: Math.random() * 6, vr: (Math.random() - 0.5) * 9, life: 4.5, c: ["#facc15", "#f472b6", "#60a5fa", "#4ade80", "#f8fafc"][i % 5] }); }
function drawPet(p, t) {
  const s = (p.big || 1) * 1.3, walking = p.path && p.path.length, nap = p.mode === "nap" && !walking, fd = p.face || 1;
  let a = p.x, b = p.y + 2; if (p.mode === "desk" && !walking) { b = p.y - TS + 0.5; }
  if (walking) b -= Math.abs(Math.sin((p.walkT || 0) * 12)) * 0.6;
  x.fillStyle = "rgba(20,14,8,.25)"; x.beginPath(); x.ellipse(a, b + 2.4 * s, 4.6 * s, 1.4 * s, 0, 0, 7); x.fill();
  const c1 = mute(p.col, 0.12), c2 = p.col2 ? mute(p.col2, 0.1) : hex(c1, 0.85);
  if (nap) {   // curled up, tail around, Zzz
    circ(a, b, (p.kind === "dog" ? 3.8 : 3) * s, c1, { lw: 0.35 }); if (p.col2) ell(a + 0.8 * s, b + 0.6 * s, 1.8 * s, 1.2 * s, 0.4, c2, { stroke: false });
    circ(a + fd * 2.2 * s, b - 1 * s, (p.kind === "dog" ? 1.9 : 1.5) * s, c1, { lw: 0.3 }); x.strokeStyle = c2; x.lineWidth = 1 * s; x.beginPath(); x.arc(a, b, 3.4 * s, 0.6, 2.4); x.stroke();
    const k = (t * 0.6) % 1; x.save(); x.globalAlpha = 1 - k; wtext("z", a + 3 * s + k * 3, b - 6 - k * 5, { size: 3 + k * 1.5, col: "#e8f1ff", w: 800 }); x.restore(); return;
  }
  const wag = Math.sin(t * (p.kind === "dog" ? 14 : 3)) * (p.kind === "dog" ? 0.6 : 0.3);
  x.save(); x.translate(a, b); x.scale(fd, 1);
  x.strokeStyle = p.kind === "cat" ? c2 : c1; x.lineWidth = (p.kind === "cat" ? 0.9 : 1.1) * s; x.beginPath(); x.moveTo(-3.6 * s, 0); x.quadraticCurveTo(-6 * s, -2 * s + wag * 3, -6.6 * s, -3.8 * s + wag * 4); x.stroke();   // tail
  ell(0, 0, (p.kind === "dog" ? 4.6 : 3.5) * s, (p.kind === "dog" ? 2.5 : 1.9) * s, 0, c1, { lw: 0.5, shadow: true });
  if (p.col2 && p.breed === "dalmatian") for (let i = 0; i < 6; i++) circ(-3 * s + i * 1.2 * s, ((i * 7) % 3 - 1) * s, 0.45 * s, c2, { shadow: false, stroke: false, shade: false });
  else if (p.col2 && (p.breed === "beagle" || p.breed === "calico" || p.breed === "tuxedo cat")) ell(-0.6 * s, -0.4 * s, 2.2 * s, 1.3 * s, 0, c2, { stroke: false });
  else if (p.col2 && p.kind === "cat") for (let i = 0; i < 3; i++) line([-2 * s + i * 1.4 * s, -1.6 * s, -2.3 * s + i * 1.4 * s, 1.6 * s], c2, 0.4 * s);
  const hx = (p.kind === "dog" ? 4.6 : 3.4) * s, hr = (p.kind === "dog" ? 2.2 : 1.8) * s;
  circ(hx, -0.4 * s, hr, c1, { lw: 0.35 });
  if (p.kind === "dog") { ell(hx + 1.9 * s, 0, 1.1 * s, 0.85 * s, 0, p.col2 && p.breed !== "dalmatian" ? c2 : hex(c1, 1.1), { lw: 0.25 }); circ(hx + 2.8 * s, -0.1 * s, 0.4 * s, "#1b1b1b", { shadow: false, stroke: false, shade: false });
    ell(hx - 0.6 * s, -2 * s, 0.9 * s, 1.4 * s, 0.5, hex(c1, 0.78), { lw: 0.25 }); }
  else { poly([hx - 1.4 * s, -1.4 * s, hx - 0.6 * s, -3.4 * s, hx + 0.2 * s, -1.6 * s], hex(c1, 0.9), { lw: 0.25 }); poly([hx + 0.2 * s, -1.6 * s, hx + 1.2 * s, -3.2 * s, hx + 1.6 * s, -1.2 * s], hex(c1, 0.9), { lw: 0.25 }); if (p.breed === "siamese") circ(hx + 0.6 * s, 0, 1 * s, c2, { shadow: false, stroke: false, shade: false }); }
  circ(hx + 0.7 * s, -0.8 * s, 0.35 * s, p.kind === "cat" ? "#7bc96f" : "#1b1b1b", { shadow: false, stroke: false, shade: false });
  x.restore();
  if (p.mode === "visit" && !walking) { const k = (t * 0.8) % 1; x.save(); x.globalAlpha = 1 - k; poly([a, b - 7 - k * 4, a - 1.5, b - 8.5 - k * 4, a, b - 7.6 - k * 4, a + 1.5, b - 8.5 - k * 4], "#ff6b8a", { stroke: false }); x.restore(); }
}
// cfg: { table:[x,y,w,h], balloons:[x,y], banner:[x,y,w], cardSpots:[keys], partySpots:[keys] }
R_.lifeUnder = function (t, cfg) {
  const L = LFE(); if (!L) return; const H = L.happen || { list: [] }, has = (k) => H.list.includes(k), [tx0, ty0, tw, th] = cfg.table, cx = tx0 + tw / 2, cy = ty0 + th / 2; confC = [cx, cy];
  if (H.banner && cfg.banner) { const [ba, bb, bw] = cfg.banner; line([ba - 2, bb - 1, ba + bw + 2, bb - 1], "#5a4a3a", 0.4); box(ba, bb, bw, 7.4, 0.8, "#fbf3dc", { lw: 0.35, blur: 1 }); for (let i = 0; i < bw; i += 6) poly([ba + i, bb + 7.4, ba + i + 3, bb + 9.6, ba + i + 6, bb + 7.4], ["#e5534b", "#4a8fe0", "#f2c94c", "#5fb37a"][(i / 6) % 4], { stroke: false });
    wtext(H.banner, ba + bw / 2, bb + 3.8, { size: R_.small() ? 5 : 4.2, col: "#b3261e", align: "center", base: "middle", w: 800, maxW: bw - 4, shrink: 3 }); }
  if (has("anniversary") || has("bigwin")) balloonsAt(cfg.balloons[0], cfg.balloons[1], t, 5);
  if (has("anniversary")) cake(cx, cy);
  if (has("bigwin")) { box(cx - 2, cy - 4, 4, 7, 1.2, "#3f7d4c", { lw: 0.3 }); for (let i = 0; i < 4; i++) circ(cx - 7 + i * 4.6, cy + 4, 1.1, "#f4e7b0", { lw: 0.25, shadow: false }); }
  if (has("potluck")) [["#e5734b", -9, -2], ["#f2c94c", -2, -3], ["#7bbf5a", 5, -2], ["#c77ddb", -6, 4], ["#e8d3a8", 3, 4]].forEach(([c, dx, dy]) => { circ(cx + dx, cy + dy, 2.6, "#f6f3ec", { lw: 0.3 }); circ(cx + dx, cy + dy, 1.8, c, { shadow: false, stroke: false }); });
  if (has("pizzafri")) { pizzaBox(cx - 12, cy - 4.5, false); pizzaBox(cx - 1, cy - 5.5, true); pizzaBox(cx + 3, cy - 1, false); }
  if (L.on("cards") && cfg.cardSpots && cfg.cardSpots.filter((k) => L.user([k])).length >= 2) { for (let i = 0; i < 5; i++) { x.save(); x.translate(cx - 4 + i * 2, cy); x.rotate((i - 2) * 0.25); box(-1.4, -2, 2.8, 4, 0.4, "#fbfaf6", { lw: 0.25, shadow: false }); circ(0, 0, 0.5, i % 2 ? "#c0392b" : "#1b1b1b", { shadow: false, stroke: false, shade: false }); x.restore(); }
    for (let i = 0; i < 6; i++) circ(cx + 7 + (i % 2) * 1.6, cy - 2 + (i >> 1) * 1.6, 0.8, ["#e5534b", "#4a8fe0", "#f4f1ea"][i % 3], { lw: 0.2, shadow: false }); }
  const kn = L.on("knock"); if (kn && kn.data && SPOTS["front_" + kn.data.who]) { const f = SPOTS["front_" + kn.data.who], k = L.prog("knock"), a = f.x * TS + 12, b = (f.y - 1) * TS + 4 + k * 14; x.save(); x.translate(a, b); x.rotate(k * 7); box(-2.2, -0.4, 4.4, 0.8, 0.3, "#f2c94c", { lw: 0.2, shadow: false }); x.restore(); }
  for (const p of L.pets || []) if (p.tx != null) drawPet(p, t);
};
R_.lifeOver = function (t) {
  const L = LFE(); if (!L) return; const now = performance.now() / 1000, dt = Math.min(0.1, now - (lastConf || now)); lastConf = now;
  if (L.on("party") && Math.random() < 0.05) confettiBurst(8);
  for (let i = confettiL.length - 1; i >= 0; i--) { const p = confettiL[i]; p.y += p.vy * dt; p.x += p.vx * dt; p.r += p.vr * dt; p.life -= dt; if (p.life <= 0 || p.y > LH) { confettiL.splice(i, 1); continue; } x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-1, -0.5, 2, 1); x.restore(); }
  const pl = L.on("planes"); if (pl && pl.data && pl.data.from) pl.data.from.forEach((id, n) => { const c = chars[id]; if (!c || c.hidden) return; const k = ((T - pl.t0) / 4 + n * 0.37) % 1, dir = n % 2 ? -1 : 1, a = c.x + dir * k * 130, b = c.y - 10 - Math.sin(k * Math.PI) * 26 + k * 18;
    if (a < 18 || a > LW - 18) return; x.save(); x.translate(a, b); x.scale(dir, 1); x.rotate(0.15 - k * 0.3); poly([3.4, 0, -2.6, -1.8, -1.4, 0, -2.6, 1.8], "#fbfaf6", { lw: 0.3 }); line([3.4, 0, -1.4, 0], "rgba(0,0,0,.25)", 0.25); x.restore(); });
};
R_.D = { wtext, marquee, short, money0, stairSign, MONO, frame, icoMagnifier, icoArrowUp, scribble, bunting, deskTop, mug, balloons, upNote, WOOD };
R_.P = { rr, shadow, box, circ, ell, line, poly, hex, mute, planks, tiles, speckle, rug, wallSeg, glassSeg, plant, chair, screen, FONT, INK, RIC, ctx: () => x };
// the engines bound resize to the original layout(); re-run ours afterwards so DPR >= 2 sticks
addEventListener("resize", () => layout()); addEventListener("orientationchange", () => setTimeout(() => layout(), 260));
})();
