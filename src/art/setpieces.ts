// Signature set pieces: the SVG star map, the SVG ship schematic, and
// ASCII sector charts. Every piece is seeded, geometric, restrained, and
// stays in the phosphor-gold/cyan terminal palette.
import type { Contract, Ship } from "../types";
import { PORTS } from "../game/data";
import { hashStr, mulberry32 } from "../game/rng";
import { esc } from "../game/rng";

export const VOYAGE_DIVIDER = ".  .   · ─ ─ ─ ·   .  .";

const RISK_COLOR: Record<string, string> = {
  safe: "#7dffa8",
  risky: "#ffb46f",
  perilous: "#ff8d7d",
};

const HULL_PAL: Record<string, [string, string]> = {
  hauler: ["#ffd36f", "#8a6f3f"],
  frigate: ["#6fd3ff", "#3f6d8a"],
  explorer: ["#9f7dff", "#5d548a"],
};

/* ------------------------------------------------------------------ */
/* Star map: contract selection board                                  */
/* ------------------------------------------------------------------ */

interface Pt {
  x: number;
  y: number;
}

function portPositions(): Map<string, Pt> {
  // Fixed seed: the chart of known space does not rearrange itself.
  const rng = mulberry32(hashStr("starmap-layout"));
  const pts: Pt[] = [];
  for (let n = 0; n < PORTS.length; n++) {
    let p: Pt = { x: 0, y: 0 };
    for (let tries = 0; tries < 60; tries++) {
      p = { x: 70 + rng() * 540, y: 60 + rng() * 260 };
      const ok = pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 95);
      if (ok) break;
    }
    pts.push(p);
  }
  const map = new Map<string, Pt>();
  PORTS.forEach((n, i) => map.set(n, pts[i]));
  return map;
}

export function starMapSVG(contracts: Contract[], activeId: number | null): string {
  const W = 680;
  const H = 380;
  const ports = portPositions();
  const rng = mulberry32(hashStr("starmap-stars"));
  let s =
    '<svg viewBox="0 0 ' + W + " " + H + '" class="starmap" role="img" aria-label="star map of known space">';
  // backdrop: dim seeded dust
  for (let i = 0; i < 90; i++) {
    const x = (rng() * W).toFixed(1);
    const y = (rng() * H).toFixed(1);
    const r = (0.4 + rng() * 1.1).toFixed(2);
    const a = (0.12 + rng() * 0.3).toFixed(2);
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#d7def5" opacity="' + a + '"/>';
  }
  // faint graticule
  for (let gx = 0; gx <= W; gx += 68) {
    s += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="#2a3354" stroke-width="1" opacity="0.35"/>';
  }
  for (let gy = 0; gy <= H; gy += 76) {
    s += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="#2a3354" stroke-width="1" opacity="0.35"/>';
  }
  // routes first, so ports draw over them
  const selected = contracts.find((c) => c.id === activeId) || null;
  contracts.forEach((c) => {
    const a = ports.get(c.from);
    const b = ports.get(c.to);
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // lift the control point perpendicular for an arc
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const lift = Math.min(70, len * 0.25);
    const cxp = mx - (dy / len) * lift;
    const cyp = my + (dx / len) * lift;
    const col = RISK_COLOR[c.risk] || "#8b94b8";
    const isSel = selected !== null && selected.id === c.id;
    const op = isSel ? "1" : "0.32";
    if (isSel) {
      s +=
        '<path d="M ' + a.x.toFixed(1) + " " + a.y.toFixed(1) + " Q " + cxp.toFixed(1) + " " + cyp.toFixed(1) +
        " " + b.x.toFixed(1) + " " + b.y.toFixed(1) + '" fill="none" stroke="' + col +
        '" stroke-width="7" opacity="0.14"/>';
    }
    s +=
      '<path d="M ' + a.x.toFixed(1) + " " + a.y.toFixed(1) + " Q " + cxp.toFixed(1) + " " + cyp.toFixed(1) +
      " " + b.x.toFixed(1) + " " + b.y.toFixed(1) + '" fill="none" stroke="' + col +
      '" stroke-width="' + (isSel ? "2.5" : "1.5") + '" opacity="' + op + '"' +
      (isSel ? "" : ' stroke-dasharray="5 4"') + "/>";
    // contract name at the arc apex
    s +=
      '<text x="' + cxp.toFixed(1) + '" y="' + (cyp - 8).toFixed(1) + '" text-anchor="middle" font-size="10" ' +
      'fill="' + col + '" opacity="' + op + '" font-family="monospace" letter-spacing="1">' +
      esc(c.name.toUpperCase()) + "</text>";
  });
  // ports over the routes
  for (const name of PORTS) {
    const p = ports.get(name)!;
    const isEndpoint = contracts.some((c) => c.from === name || c.to === name);
    const isOrigin = selected !== null && selected.from === name;
    const isDest = selected !== null && selected.to === name;
    if (isOrigin) {
      // you-are-here diamond
      s +=
        '<polygon points="' + p.x + "," + (p.y - 9) + " " + (p.x + 9) + "," + p.y + " " + p.x + "," +
        (p.y + 9) + " " + (p.x - 9) + "," + p.y + '" fill="none" stroke="#ffd36f" stroke-width="2"/>';
      s +=
        '<text x="' + p.x + '" y="' + (p.y - 14) + '" text-anchor="middle" font-size="9" fill="#ffd36f" ' +
        'font-family="monospace" letter-spacing="2">YOU</text>';
    }
    if (isDest) {
      s +=
        '<circle cx="' + p.x + '" cy="' + p.y + '" r="8" fill="none" stroke="#ffd36f" stroke-width="1.5" ' +
        'stroke-dasharray="3 2"/>';
    }
    s +=
      '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.5" fill="' +
      (isEndpoint ? "#6fd3ff" : "#3f4a6e") + '" opacity="' + (isEndpoint ? "1" : "0.7") + '"/>';
    s +=
      '<text x="' + p.x + '" y="' + (p.y + 16) + '" text-anchor="middle" font-size="9" fill="#8b94b8" ' +
      'font-family="monospace">' + esc(name.toUpperCase()) + "</text>";
  }
  // legend
  const legend: Array<[string, string]> = [
    ["#7dffa8", "SAFE"],
    ["#ffb46f", "RISKY"],
    ["#ff8d7d", "PERILOUS"],
  ];
  legend.forEach(([col, label], i) => {
    const lx = 14 + i * 110;
    s += '<line x1="' + lx + '" y1="' + (H - 12) + '" x2="' + (lx + 26) + '" y2="' + (H - 12) +
      '" stroke="' + col + '" stroke-width="2.5"/>';
    s += '<text x="' + (lx + 32) + '" y="' + (H - 8) + '" font-size="9" fill="#8b94b8" font-family="monospace">' +
      label + "</text>";
  });
  s += "</svg>";
  return s;
}

/* ------------------------------------------------------------------ */
/* Ship schematic: hull plan with scars and quirks marked              */
/* ------------------------------------------------------------------ */

export function shipSchematicSVG(ship: Ship): string {
  const W = 460;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const pal = HULL_PAL[ship.hullId] || HULL_PAL.frigate;
  const main = pal[0];
  const dim = pal[1];
  const rng = mulberry32(hashStr("schematic|" + ship.name + "|" + ship.hullId));
  let s =
    '<svg viewBox="0 0 ' + W + " " + H + '" class="schematic" role="img" aria-label="ship schematic">';
  // corner registration marks
  const cm = 14;
  const corners: Array<[number, number, number, number]> = [
    [8, 8, 1, 1],
    [W - 8, 8, -1, 1],
    [8, H - 8, 1, -1],
    [W - 8, H - 8, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    s += '<path d="M ' + x + " " + (y + cm * sy) + " L " + x + " " + y + " L " + (x + cm * sx) + " " + y +
      '" fill="none" stroke="' + dim + '" stroke-width="1.5" opacity="0.8"/>';
  }
  // hull plan per class
  if (ship.hullId === "hauler") {
    const w = 130;
    const hh = 62;
    s +=
      '<polygon points="' + cx + "," + (cy - hh - 22) + " " + (cx + w) + "," + (cy - hh) + " " +
      (cx + w) + "," + (cy + hh) + " " + cx + "," + (cy + hh + 22) + " " + (cx - w) + "," + (cy + hh) +
      " " + (cx - w) + "," + (cy - hh) + '" fill="none" stroke="' + main + '" stroke-width="2"/>';
    for (let i = -2; i <= 2; i++) {
      s += '<rect x="' + (cx + i * 34 - 13) + '" y="' + (cy - 10) + '" width="26" height="20" fill="' +
        main + '" opacity="0.28"/>';
    }
    s += '<line x1="' + cx + '" y1="' + (cy - hh - 22) + '" x2="' + cx + '" y2="' + (cy + hh + 22) +
      '" stroke="' + dim + '" stroke-width="1" stroke-dasharray="6 4" opacity="0.7"/>';
  } else if (ship.hullId === "frigate") {
    const nose = 105;
    const tail = 88;
    s +=
      '<polygon points="' + cx + "," + (cy - nose) + " " + (cx + 52) + "," + (cy + tail) + " " + cx + "," +
      (cy + tail - 30) + " " + (cx - 52) + "," + (cy + tail) + '" fill="none" stroke="' + main +
      '" stroke-width="2"/>';
    s += '<line x1="' + cx + '" y1="' + (cy - nose) + '" x2="' + cx + '" y2="' + (cy + tail) +
      '" stroke="' + dim + '" stroke-width="1" stroke-dasharray="6 4" opacity="0.7"/>';
    for (const sx of [-1, 1]) {
      s += '<polygon points="' + (cx + sx * 52) + "," + (cy + tail - 40) + " " + (cx + sx * 86) + "," +
        (cy + tail + 6) + " " + (cx + sx * 52) + "," + (cy + tail + 6) +
        '" fill="none" stroke="' + main + '" stroke-width="1.5" opacity="0.85"/>';
    }
  } else {
    const r1 = 52;
    const r2 = 88;
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1 + '" fill="none" stroke="' + main + '" stroke-width="2"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2 + '" fill="none" stroke="' + dim + '" stroke-width="1"/>';
    s += '<line x1="' + (cx - r2 - 26) + '" y1="' + cy + '" x2="' + (cx + r2 + 26) + '" y2="' + cy +
      '" stroke="' + dim + '" stroke-width="1" opacity="0.8"/>';
    s += '<line x1="' + cx + '" y1="' + (cy - r2 - 26) + '" x2="' + cx + '" y2="' + (cy + r2 + 26) +
      '" stroke="' + dim + '" stroke-width="1" opacity="0.8"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + main + '" opacity="0.9"/>';
  }
  // scar markers: numbered fracture glyphs
  const scars = ship.scars.slice(0, 6);
  scars.forEach((sc, i) => {
    const r2 = mulberry32(hashStr("scar|" + ship.name + "|" + i + "|" + sc.name));
    const ax = cx + (r2() - 0.5) * 200;
    const ay = cy + (r2() - 0.5) * 170;
    const a = r2() * Math.PI;
    const len = 9;
    const x2 = ax + Math.cos(a) * len;
    const y2 = ay + Math.sin(a) * len;
    s += '<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + x2.toFixed(1) +
      '" y2="' + y2.toFixed(1) + '" stroke="#ff8d7d" stroke-width="2.5"/>';
    s += '<line x1="' + (ax + 3).toFixed(1) + '" y1="' + (ay - 4).toFixed(1) + '" x2="' + (x2 - 3).toFixed(1) +
      '" y2="' + (y2 + 4).toFixed(1) + '" stroke="#ff8d7d" stroke-width="1.5" opacity="0.8"/>';
    s += '<circle cx="' + (ax + 12).toFixed(1) + '" cy="' + (ay - 12).toFixed(1) + '" r="8" fill="#0b0e1a" stroke="#ff8d7d" stroke-width="1.5"/>';
    s += '<text x="' + (ax + 12).toFixed(1) + '" y="' + (ay - 8.5).toFixed(1) + '" text-anchor="middle" font-size="9" ' +
      'fill="#ff8d7d" font-family="monospace">' + (i + 1) + "</text>";
  });
  // quirk markers: gold sparks
  const quirks = ship.quirks.slice(0, 6);
  quirks.forEach((q, i) => {
    const r2 = mulberry32(hashStr("quirk|" + ship.name + "|" + i + "|" + q.name));
    const ax = cx + (r2() - 0.5) * 220;
    const ay = cy + (r2() - 0.5) * 190;
    s += '<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="3.5" fill="#ffd36f"/>';
    for (let k = 0; k < 4; k++) {
      const aa = (k / 4) * Math.PI * 2 + r2();
      const x1 = ax + Math.cos(aa) * 6;
      const y1 = ay + Math.sin(aa) * 6;
      const x2 = ax + Math.cos(aa) * 10;
      const y2 = ay + Math.sin(aa) * 10;
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="#ffd36f" stroke-width="1.2" opacity="0.85"/>';
    }
  });
  // hull integrity: segmented bar
  const segs = 12;
  const filled = Math.round((ship.condition / ship.maxCondition) * segs);
  const bw = 300;
  const bx = cx - bw / 2;
  const by = H - 34;
  s += '<text x="' + bx + '" y="' + (by - 8) + '" font-size="9" fill="#8b94b8" font-family="monospace" letter-spacing="2">HULL INTEGRITY</text>';
  for (let i = 0; i < segs; i++) {
    const sx = bx + i * (bw / segs);
    const on = i < filled;
    s += '<rect x="' + (sx + 1.5).toFixed(1) + '" y="' + by + '" width="' + (bw / segs - 3).toFixed(1) +
      '" height="10" fill="' + (on ? main : "#1a2138") + '" stroke="' + dim + '" stroke-width="1" opacity="' +
      (on ? "0.9" : "0.6") + '"/>';
  }
  const reg = "NX-" + (1000 + Math.floor(rng() * 9000));
  s += '<text x="' + (W - 14) + '" y="' + (H - 14) + '" text-anchor="end" font-size="9" fill="' + dim +
    '" font-family="monospace" letter-spacing="2">' + reg + "</text>";
  s += "</svg>";
  return s;
}

/* ------------------------------------------------------------------ */
/* ASCII set pieces                                                     */
/* ------------------------------------------------------------------ */

const HAZARDS = [
  "pirate activity",
  "drift ice",
  "old minefields",
  "solar flares",
  "dead relays",
  "unmapped mass",
  "signal ghosts",
];

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function sectorChartASCII(c: Contract): string {
  const rng = mulberry32(hashStr("chart|" + c.name + "|" + c.from + "|" + c.to));
  const h1 = HAZARDS[Math.floor(rng() * HAZARDS.length)];
  let h2 = HAZARDS[Math.floor(rng() * HAZARDS.length)];
  if (h2 === h1) h2 = HAZARDS[(HAZARDS.indexOf(h1) + 3) % HAZARDS.length];
  const from = trunc(c.from.toUpperCase(), 20).padEnd(20, " ");
  const to = trunc(c.to.toUpperCase(), 20).padStart(20, " ");
  const lines = [
    VOYAGE_DIVIDER,
    'SECTOR CHART - "' + c.name.toUpperCase() + '"',
    from + " ─── · ─── " + to,
    "EST. " + c.ticks + " DAYS · RISK: " + c.risk.toUpperCase(),
    "NOTED HAZARDS: " + h1 + " · " + h2,
    VOYAGE_DIVIDER,
  ];
  return lines.join("\n");
}

export function asciiRule(): string {
  return "─── ◆ ───";
}
