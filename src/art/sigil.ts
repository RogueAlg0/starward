// Seeded SVG ship sigil: dashed range ring, tick marks, a hull-specific
// core, mirrored wing flourishes, and a registry number. Same name + hull
// always yields the same sigil.
import { hashStr, mulberry32 } from "../game/rng";

const PALETTES: Record<string, [string, string]> = {
  hauler: ["#ffd36f", "#8a6f3f"],
  frigate: ["#6fd3ff", "#3f6d8a"],
  explorer: ["#9f7dff", "#5d548a"],
};

export function shipSigil(name: string, hullId: string, size?: number): string {
  size = size || 120;
  const rng = mulberry32(hashStr("sigil|" + name + "|" + hullId));
  const pal = PALETTES[hullId] || PALETTES.frigate;
  const main = pal[0];
  const dim = pal[1];
  const C = 60;
  let s =
    '<svg viewBox="0 0 120 120" width="' + size + '" height="' + size +
    '" class="sigil" role="img" aria-label="ship sigil">';
  // outer dashed range ring
  const R = 52;
  s +=
    '<circle cx="' + C + '" cy="' + C + '" r="' + R + '" fill="none" stroke="' + dim +
    '" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>';
  // tick marks around the ring
  const ticks = 12 + Math.floor(rng() * 12);
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const x1 = C + Math.cos(a) * (R - 3);
    const y1 = C + Math.sin(a) * (R - 3);
    const x2 = C + Math.cos(a) * (R - 8);
    const y2 = C + Math.sin(a) * (R - 8);
    s +=
      '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
      '" y2="' + y2.toFixed(1) + '" stroke="' + dim + '" stroke-width="1" opacity="0.8"/>';
  }
  // hull-specific core
  if (hullId === "hauler") {
    // broad hex hull with cargo bars
    const w = 26 + rng() * 6;
    const hh = 13 + rng() * 4;
    s +=
      '<polygon points="' + C + "," + (C - hh - 8) + " " + (C + w) + "," + (C - hh) + " " +
      (C + w) + "," + (C + hh) + " " + C + "," + (C + hh + 8) + " " + (C - w) + "," + (C + hh) +
      " " + (C - w) + "," + (C - hh) + '" fill="none" stroke="' + main + '" stroke-width="2"/>';
    for (let i = -1; i <= 1; i++) {
      s +=
        '<rect x="' + (C + i * 12 - 5) + '" y="' + (C - 4) + '" width="10" height="8" fill="' +
        main + '" opacity="0.55"/>';
    }
  } else if (hullId === "frigate") {
    // sharp dart
    const nose = 26 + rng() * 8;
    const tail = 20 + rng() * 6;
    s +=
      '<polygon points="' + C + "," + (C - nose) + " " + (C + 12) + "," + (C + tail) + " " +
      C + "," + (C + tail - 8) + " " + (C - 12) + "," + (C + tail) + '" fill="' + main +
      '" opacity="0.85"/>';
    s +=
      '<line x1="' + C + '" y1="' + (C - nose) + '" x2="' + C + '" y2="' + (C + tail) +
      '" stroke="#0b0e1a" stroke-width="1.5" opacity="0.7"/>';
  } else {
    // explorer: sensor rings and crosshair
    const r1 = 14 + rng() * 4;
    const r2 = r1 + 9 + rng() * 4;
    s +=
      '<circle cx="' + C + '" cy="' + C + '" r="' + r1.toFixed(1) + '" fill="none" stroke="' +
      main + '" stroke-width="2"/>';
    s +=
      '<circle cx="' + C + '" cy="' + C + '" r="' + r2.toFixed(1) + '" fill="none" stroke="' +
      dim + '" stroke-width="1"/>';
    s +=
      '<line x1="' + (C - r2 - 6) + '" y1="' + C + '" x2="' + (C + r2 + 6) + '" y2="' + C +
      '" stroke="' + dim + '" stroke-width="1"/>';
    s +=
      '<line x1="' + C + '" y1="' + (C - r2 - 6) + '" x2="' + C + '" y2="' + (C + r2 + 6) +
      '" stroke="' + dim + '" stroke-width="1"/>';
    s += '<circle cx="' + C + '" cy="' + C + '" r="3" fill="' + main + '"/>';
  }
  // mirrored wing flourishes (symmetry is the whole aesthetic)
  const wingStyle = Math.floor(rng() * 3);
  if (wingStyle > 0) {
    const wy = C + 6 + rng() * 14;
    const wx = 30 + rng() * 8;
    const ww = 10 + rng() * 8;
    let left: string;
    if (wingStyle === 1) {
      left =
        '<polygon points="' + (C - wx) + "," + wy.toFixed(1) + " " + (C - wx - ww).toFixed(1) + "," +
        (wy + 12).toFixed(1) + " " + (C - wx + 4).toFixed(1) + "," + (wy + 12).toFixed(1) +
        '" fill="none" stroke="' + main + '" stroke-width="1.5"/>';
    } else {
      left =
        '<path d="M ' + (C - wx).toFixed(1) + " " + wy.toFixed(1) + " Q " +
        (C - wx - ww).toFixed(1) + " " + wy.toFixed(1) + " " + (C - wx - ww + 4).toFixed(1) + " " +
        (wy + 12).toFixed(1) + '" fill="none" stroke="' + main + '" stroke-width="1.5"/>';
    }
    // mirror across the vertical center line
    const right = left.replace(/(\d+\.?\d*),/g, (_m, x) => (2 * C - parseFloat(x)).toFixed(1) + ",");
    s += left + right;
  }
  // registry number, monospace, technical-readout flavor
  const reg = "NX-" + (1000 + Math.floor(rng() * 9000));
  s +=
    '<text x="' + C + '" y="112" text-anchor="middle" font-size="8" fill="' + dim +
    '" font-family="monospace" letter-spacing="2">' + reg + "</text>";
  s += "</svg>";
  return s;
}
