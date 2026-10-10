// Universe panel (additive add-on; wraps floor2d.js renderPanel). Reads state.json "universe" only.
// Handles any ticker: symbols are escaped, chips wrap, nothing assumes a fixed list. Phone-first layout.
(function () {
  if (typeof renderPanel !== "function") return;
  const css = document.createElement("style");
  css.textContent = ".uchips{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 2px}" +
    ".uchip{border:1px solid #2a3a32;border-radius:4px;padding:1px 5px;font-size:11px;white-space:nowrap;color:#d7e3dc}" +
    ".uchip i{font-style:normal;color:#9fd3ff;margin-left:3px;font-size:10px}.uchip.core{border-color:#4b5563;color:#9ca3af}" +
    ".uchip.ri{border-color:#00838f}.uchip.er{border-color:#b45309}.uchip.pos{border-color:#f2c14e}" +
    ".uline{font-size:11px;line-height:1.45}";
  document.head.appendChild(css);
  const E = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function tag(why) {   // short on-chip hint from the shortlist reason
    const w = String(why || "").split(",")[0].trim();
    let m;
    if (/^core/.test(w)) return ["", "core"];
    if (/^open position/.test(w)) return ["held", "pos"];
    if (/^Research Inc/.test(w)) return ["RI", "ri"];
    if (/^earnings/.test(w)) return ["ER", "er"];
    if ((m = w.match(/gap ([+-][\d.]+%)/))) return ["gap " + m[1], ""];
    if ((m = w.match(/relative volume ([\d.]+x)/))) return ["RV " + m[1], ""];
    if ((m = w.match(/move ([+-][\d.]+%)/))) return [m[1], ""];
    return ["", ""];
  }
  const hm = (iso) => (iso ? String(iso).slice(11, 16) : "");
  function renderUniverse() {
    const box = document.getElementById("uni"); if (!box || !S) return;
    const U = S.universe, D = S.data_source;
    if (!U) { box.innerHTML = '<div class="mut">universe not built yet</div>'; return; }
    const cnt = document.getElementById("c-uni"); if (cnt) cnt.textContent = U.size + " names";
    const rej = U.rejected ? Object.entries(U.rejected).map(([k, v]) => v + " " + k).join(" · ") : "";
    const html =
      `<div class="uline">${U.dynamic ? `<b>${U.size}</b> liquid US stocks &amp; ETFs (S&amp;P 500 + Nasdaq-100 + ETFs)` : `<b>${U.size}</b> names (fallback list)`}` +
      `${U.built_at ? ` · built ${E(hm(U.built_at))}` : ""}${U.source && !/wikipedia|fresh/.test(U.source) ? ` · <span class="mut">${E(U.source)}</span>` : ""}</div>` +
      (rej ? `<div class="uline mut">filtered out: ${E(rej)}</div>` : "") +
      `<div class="uline mut" style="margin-top:4px">SWING scans all ${U.size} on daily bars · ${U.focus || 0} close to a setup get live prices at the scan times</div>` +
      (D && D.label ? `<div class="uline" style="margin-top:4px"><b>DATA</b> <span class="${D.ok === false || D.fallback_active ? "dn" : "mut"}">${E(D.label)}${D.ok === false ? " · FAILING" : ""}${D.load && D.load.last_min != null ? ` · ${D.load.last_min} req/min` : ""}</span></div>` : "");
    if (box.dataset.k !== html) { box.innerHTML = html; box.dataset.k = html; }
  }
  const _rp = renderPanel;
  renderPanel = function () { _rp.apply(this, arguments); try { renderUniverse(); } catch (e) { /* never break the panel */ } };
})();
