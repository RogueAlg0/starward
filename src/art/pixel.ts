// Procedural 16-bit pixel art for WARBOUND. Officer portraits, regimental
// standards, and the campaign march map, all generated in code at runtime on
// canvas and returned as PNG data URLs. No external assets, no image files.
// Self contained: own seeded PRNG, no imports. Renders never throw.

const BG = "#0a0c10";
const PANEL = "#11141a";
const GOLD = "#d8a94e";
const CYAN = "#7fd4c1";
const SKIN_LIGHT = "#e8b88a";
const SKIN_MID = "#c98f5f";
const SKIN_DARK = "#8a5a3a";
const HAIR_DARK = "#2a2a2e";
const HAIR_BROWN = "#5a3a22";
const HAIR_SANDY = "#8a6a3a";
const HAIR_GREY = "#b8b0a0";
const THALMAR = "#3f6b4f";
const GREY = "#5a5f6b";
const SALTBLUE = "#3d5a80";
const STEEL = "#9aa0aa";
const BLOOD = "#a03a3a";
const BONE = "#d8d0c0";
const DARKMOSS = "#1d2b1f";
const DIRT = "#4a3a28";

// 1x1 transparent PNG, returned if canvas is ever unavailable.
const FALLBACK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" +
  "AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// ---------------------------------------------------------------- PRNG

function hashString(s: string): number {
  // FNV-1a, 32 bit.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Rng {
  next(): number;
  int(lo: number, hi: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

function makeRng(seedStr: string): Rng {
  // mulberry32 over the string hash.
  let a = hashString(seedStr) >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number): number =>
      lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number): boolean => next() < p,
  };
}

// ---------------------------------------------------------------- canvas

type Plot = (x: number, y: number, color: string) => void;

function clampScale(scale: number | undefined, fallback: number): number {
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) {
    return fallback;
  }
  return Math.min(16, Math.max(1, Math.floor(scale)));
}

function paint(
  gridW: number,
  gridH: number,
  pixel: number,
  draw: (px: Plot) => void,
): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = gridW * pixel;
    canvas.height = gridH * pixel;
    const ctx = canvas.getContext("2d");
    if (!ctx) return FALLBACK_PNG;
    ctx.imageSmoothingEnabled = false;
    const px: Plot = (x, y, color) => {
      if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
    };
    draw(px);
    return canvas.toDataURL("image/png");
  } catch {
    return FALLBACK_PNG;
  }
}

function frame(px: Plot, w: number, h: number): void {
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) px(x, y, BG);
  }
  for (let x = 0; x < w; x++) {
    px(x, 0, PANEL);
    px(x, h - 1, PANEL);
  }
  for (let y = 0; y < h; y++) {
    px(0, y, PANEL);
    px(w - 1, y, PANEL);
  }
}

// ---------------------------------------------------------------- portraits

const SKINS = [SKIN_LIGHT, SKIN_MID, SKIN_DARK] as const;
const HAIR_COLORS = [HAIR_DARK, HAIR_BROWN, HAIR_SANDY, HAIR_GREY] as const;
const COATS = [THALMAR, GREY, SALTBLUE] as const;
const TRIMS = [GOLD, CYAN, BONE] as const;

// Face mask: [row, x0, x1].
const FACE_ROWS: ReadonlyArray<readonly [number, number, number]> = [
  [4, 6, 9],
  [5, 5, 10],
  [6, 5, 10],
  [7, 5, 10],
  [8, 5, 10],
  [9, 5, 10],
  [10, 5, 10],
  [11, 5, 10],
  [12, 5, 10],
  [13, 6, 9],
];

function drawHair(px: Plot, style: number, hair: string): void {
  const row = (y: number, x0: number, x1: number): void => {
    for (let x = x0; x <= x1; x++) px(x, y, hair);
  };
  if (style === 0) {
    // bald: side wisps only
    px(5, 6, hair);
    px(10, 6, hair);
  } else if (style === 1) {
    // crop
    row(4, 5, 10);
    row(5, 5, 10);
  } else if (style === 2) {
    // shaggy
    row(3, 4, 11);
    row(4, 4, 11);
    for (let y = 5; y <= 7; y++) {
      px(4, y, hair);
      px(11, y, hair);
    }
  } else if (style === 3) {
    // long
    row(3, 5, 10);
    row(4, 4, 11);
    for (let y = 5; y <= 12; y++) {
      px(4, y, hair);
      px(11, y, hair);
    }
  } else if (style === 4) {
    // topknot: crop plus bun
    row(4, 5, 10);
    row(5, 5, 10);
    px(7, 2, hair);
    px(8, 2, hair);
    row(3, 7, 8);
  } else {
    // swept fringe
    row(3, 5, 9);
    row(4, 4, 10);
  }
}

function drawHeadgear(px: Plot, gear: number, hair: string): void {
  if (gear === 0) return;
  if (gear === 1) {
    // steel helm band across the forehead
    for (let x = 5; x <= 10; x++) px(x, 5, STEEL);
    px(5, 5, GREY);
    px(10, 5, GREY);
    px(7, 5, BONE);
    px(8, 5, BONE);
  } else if (gear === 2) {
    // officer cap with gold badge
    for (let x = 4; x <= 11; x++) {
      px(x, 2, GREY);
      px(x, 3, GREY);
    }
    for (let x = 5; x <= 10; x++) px(x, 4, GREY);
    px(7, 3, GOLD);
    px(8, 3, GOLD);
    px(7, 2, hair);
    px(8, 2, hair);
  } else {
    // hood
    for (let x = 4; x <= 11; x++) {
      px(x, 3, DARKMOSS);
      px(x, 4, DARKMOSS);
    }
    for (let y = 5; y <= 12; y++) {
      px(4, y, DARKMOSS);
      px(11, y, DARKMOSS);
    }
  }
}

function drawPortrait(px: Plot, seed: string): void {
  const rng = makeRng("portrait:" + seed);
  const skin = rng.pick(SKINS);
  const shade = skin === SKIN_LIGHT ? SKIN_MID : SKIN_DARK;
  const light = skin === SKIN_DARK ? SKIN_MID : SKIN_LIGHT;
  const hair = rng.pick(HAIR_COLORS);
  const style = rng.int(0, 5);
  const gear = rng.int(0, 3);
  const beard = rng.chance(0.45);
  const goatee = beard && rng.chance(0.4);
  const heavyBrow = rng.chance(0.5);
  const scar = rng.chance(0.14);
  const coat = rng.pick(COATS);
  const trim = rng.pick(TRIMS);
  const pips = rng.int(0, 3);

  // face
  for (const [y, x0, x1] of FACE_ROWS) {
    for (let x = x0; x <= x1; x++) px(x, y, skin);
    px(x1, y, shade);
    px(x0, y, light);
  }

  drawHair(px, style, hair);
  drawHeadgear(px, gear, hair);

  // features
  if (heavyBrow) {
    for (let x = 5; x <= 7; x++) px(x, 7, hair);
    for (let x = 8; x <= 10; x++) px(x, 7, hair);
  }
  px(6, 8, BG);
  px(9, 8, BG);
  px(7, 10, shade);
  px(8, 10, shade);
  px(7, 11, shade);
  px(8, 11, shade);
  if (scar) {
    if (rng.chance(0.5)) px(5, 9, BLOOD);
    else px(10, 10, BLOOD);
  }
  if (beard) {
    if (goatee) {
      px(7, 12, hair);
      px(8, 12, hair);
      px(7, 13, hair);
      px(8, 13, hair);
    } else {
      for (let x = 5; x <= 10; x++) px(x, 12, hair);
      for (let x = 6; x <= 9; x++) px(x, 13, hair);
    }
  }

  // neck
  for (let x = 6; x <= 9; x++) {
    px(x, 14, shade);
  }

  // uniform
  for (let x = 2; x <= 13; x++) {
    px(x, 15, coat);
    for (let y = 16; y <= 19; y++) px(x, y, coat);
  }
  // collar
  for (let x = 6; x <= 9; x++) px(x, 15, trim);
  px(7, 16, trim);
  px(8, 16, trim);
  // shoulder boards
  px(2, 15, trim);
  px(3, 15, trim);
  px(12, 15, trim);
  px(13, 15, trim);
  // rank pips
  if (pips >= 1) px(7, 17, GOLD);
  if (pips >= 2) px(8, 17, GOLD);
  if (pips >= 3) px(6, 17, GOLD);
}

/** Officer portrait: 16x20 pixel grid, scaled up with smoothing off. */
export function portraitURL(seed: string, scale?: number): string {
  return paint(16, 20, clampScale(scale, 4), (px) => {
    frame(px, 16, 20);
    drawPortrait(px, String(seed));
  });
}

// ---------------------------------------------------------------- standards

export type StandardEmblem = "eel" | "wolf" | "crystal";

function drawEel(px: Plot, ink: string): void {
  const pts: ReadonlyArray<readonly [number, number]> = [
    [8, 6],
    [7, 7],
    [8, 8],
    [9, 9],
    [8, 10],
    [7, 11],
    [8, 12],
  ];
  for (const [x, y] of pts) px(x, y, ink);
}

function drawWolf(px: Plot, ink: string): void {
  // angular wolf head: wide triangle with ears
  for (let x = 5; x <= 11; x++) px(x, 6, ink);
  px(5, 7, ink);
  px(6, 7, ink);
  px(10, 7, ink);
  px(11, 7, ink);
  px(6, 8, ink);
  px(10, 8, ink);
  px(6, 9, ink);
  px(7, 9, ink);
  px(9, 9, ink);
  px(10, 9, ink);
  px(7, 10, ink);
  px(9, 10, ink);
  px(7, 11, ink);
  px(8, 11, ink);
  px(9, 11, ink);
  px(8, 12, ink);
}

function drawCrystal(px: Plot, ink: string): void {
  const outline: ReadonlyArray<readonly [number, number]> = [
    [8, 6],
    [7, 7],
    [9, 7],
    [6, 8],
    [10, 8],
    [7, 9],
    [9, 9],
    [8, 10],
  ];
  for (const [x, y] of outline) px(x, y, ink);
  px(8, 8, BONE);
}

function drawStandard(
  px: Plot,
  seed: string,
  colors: [string, string],
  emblem: StandardEmblem,
): void {
  const rng = makeRng("standard:" + seed + ":" + emblem);
  const field = String(colors[0]);
  const border = String(colors[1]);
  const ribbons = rng.int(0, 2);

  // pole and finial
  for (let y = 0; y <= 19; y++) px(1, y, HAIR_BROWN);
  px(1, 0, GOLD);
  px(0, 1, GOLD);
  px(2, 1, GOLD);

  // crossbar
  for (let x = 1; x <= 14; x++) px(x, 2, HAIR_BROWN);

  // cloth with border, notched bottom
  for (let x = 3; x <= 13; x++) {
    for (let y = 3; y <= 16; y++) {
      const isBorder = x === 3 || x === 13 || y === 3 || y === 16;
      const isNotch = (y === 16 && x >= 7 && x <= 9) || (y === 15 && x === 8);
      if (isNotch) continue;
      px(x, y, isBorder ? border : field);
    }
  }

  // emblem
  if (emblem === "eel") drawEel(px, BONE);
  else if (emblem === "wolf") drawWolf(px, GOLD);
  else drawCrystal(px, CYAN);

  // battle ribbons hanging from the crossbar
  for (let i = 0; i < ribbons; i++) {
    const rx = rng.int(4, 12);
    const rc = rng.chance(0.5) ? GOLD : BLOOD;
    for (let y = 3; y <= 5; y++) px(rx, y, rc);
  }
}

/** Regimental war banner: 16x20 grid, pole, crossbar, bordered cloth, emblem. */
export function standardURL(
  seed: string,
  colors: [string, string],
  emblem: StandardEmblem,
  scale?: number,
): string {
  return paint(16, 20, clampScale(scale, 4), (px) => {
    frame(px, 16, 20);
    drawStandard(px, String(seed), colors, emblem);
  });
}

// ---------------------------------------------------------------- march map

export interface MarchPlace {
  id: string;
  name: string;
  x: number;
  y: number;
}

// Base town tiles (tx, ty) on the 30x20 grid; labels use the same base on a
// 0-1000 scale. Rendered towns jitter at most 1 tile from these anchors.
const TOWN_BASE: ReadonlyArray<readonly [string, string, number, number]> = [
  ["evensbrook", "Evensbrook", 15, 10],
  ["saltfield", "Saltfield", 23, 11],
  ["crowfield-ford", "Crowfield Ford", 20, 3],
  ["hollow-hill", "Hollow Hill", 7, 3],
  ["millford", "Millford", 5, 11],
  ["graywater", "Graywater", 16, 16],
];

export const MARCH_PLACES: MarchPlace[] = TOWN_BASE.map(([id, name, tx, ty]) => ({
  id,
  name,
  x: Math.round((tx / 30) * 1000),
  y: Math.round((ty / 20) * 1000),
}));

function nearTown(tx: number, ty: number): boolean {
  for (const [, , bx, by] of TOWN_BASE) {
    if (Math.abs(tx - bx) <= 2 && Math.abs(ty - by) <= 2) return true;
  }
  return false;
}

function drawMarchMap(px: Plot, seed: string): void {
  const rng = makeRng("march:" + seed);
  const tile = (tx: number, ty: number, color: string): void => {
    if (tx < 0 || ty < 0 || tx >= 30 || ty >= 20) return;
    for (let dx = 0; dx < 8; dx++) {
      for (let dy = 0; dy < 8; dy++) px(tx * 8 + dx, ty * 8 + dy, color);
    }
  };
  const clamp = (v: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, v));

  // dark moss base
  for (let tx = 0; tx < 30; tx++) {
    for (let ty = 0; ty < 20; ty++) tile(tx, ty, DARKMOSS);
  }

  // Ashen Hills: grey clusters across the north
  for (let i = 0; i < 14; i++) {
    const cx = rng.int(2, 27);
    const cy = rng.int(0, 5);
    const n = rng.int(2, 4);
    for (let k = 0; k < n; k++) {
      tile(
        cx + rng.int(-1, 1),
        cy + rng.int(-1, 1),
        rng.chance(0.25) ? STEEL : GREY,
      );
    }
  }

  // forest blobs
  for (let i = 0; i < 8; i++) {
    const cx = rng.int(2, 27);
    const cy = rng.int(4, 18);
    if (nearTown(cx, cy)) continue;
    const n = rng.int(3, 6);
    for (let k = 0; k < n; k++) {
      tile(cx + rng.int(-1, 1), cy + rng.int(-1, 1), THALMAR);
    }
  }

  // Old Kings' Road: dirt path west to east
  let ry = 12;
  for (let x = 2; x <= 27; x++) {
    tile(x, ry, DIRT);
    if (rng.chance(0.25)) ry = clamp(ry + rng.int(-1, 1), 10, 14);
  }

  // river: winds north to south
  let rx = 20 + rng.int(-2, 2);
  const riverX: number[] = [];
  for (let y = 0; y < 20; y++) {
    riverX.push(rx);
    tile(rx, y, SALTBLUE);
    if (rng.chance(0.3)) tile(rx + 1, y, SALTBLUE);
    rx = clamp(rx + rng.int(-1, 1), 3, 26);
  }
  // ford crossing
  const fordX = riverX[9];
  for (let dx = -1; dx <= 1; dx++) tile(fordX + dx, 9, DIRT);

  // towns: 3x3 buildings with lit gold windows, slight seeded jitter
  const drawTown = (bx: number, by: number, onRiver: boolean): void => {
    let tx = clamp(bx + rng.int(-1, 1), 1, 28);
    let ty = clamp(by + rng.int(-1, 1), 1, 18);
    if (onRiver) tx = clamp(riverX[3], 1, 28);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) tile(tx + dx, ty + dy, GREY);
    }
    tile(tx, ty, GOLD);
    tile(tx, ty - 1, GOLD);
    if (rng.chance(0.5)) tile(tx + 1, ty, GOLD);
  };
  drawTown(15, 10, false); // Evensbrook
  drawTown(23, 11, false); // Saltfield
  drawTown(20, 3, true); // Crowfield Ford, on the river
  drawTown(7, 3, false); // Hollow Hill
  drawTown(5, 11, false); // Millford
  drawTown(16, 16, false); // Graywater
}

/** Campaign map: 30x20 tiles at 8px, 240x160 canvas, PNG data URL. */
export function marchMapURL(seed?: string): string {
  return paint(240, 160, 1, (px) => {
    drawMarchMap(px, String(seed ?? ""));
  });
}

export interface TacticalOpts {
  enemyX: number; // 0-1000 grid position (true)
  enemyY: number;
  enemyKnown: boolean; // false: blip is jittered and hollow (fog)
  seed?: string;
}

/**
 * Tactical grid map: the march terrain under a 6x8 sector grid (A-F, 1-8),
 * three friendly blips advancing from Evensbrook, one hostile blip.
 * Fog: an un-scouted enemy blip is offset and drawn hollow.
 */
export function tacticalMapURL(opts: TacticalOpts): string {
  return paint(240, 160, 1, (px) => {
    drawMarchMap(px, String(opts.seed ?? ""));
    const rng = makeRng("tac:" + String(opts.seed ?? ""));
    const gridCol = "rgba(255,176,0,0.16)";
    for (let c = 0; c <= 6; c++) {
      const x = Math.round((c * 240) / 6);
      for (let y = 0; y < 160; y++) px(x, y, gridCol);
    }
    for (let r = 0; r <= 8; r++) {
      const y = Math.round((r * 160) / 8);
      for (let x = 0; x < 240; x++) px(x, y, gridCol);
    }
    const dot = (cx: number, cy: number, color: string, size: number): void => {
      for (let dx = -size; dx <= size; dx++) {
        for (let dy = -size; dy <= size; dy++) px(cx + dx, cy + dy, color);
      }
    };
    const ring = (cx: number, cy: number, color: string, size: number): void => {
      for (let d = -size; d <= size; d++) {
        px(cx + d, cy - size, color);
        px(cx + d, cy + size, color);
        px(cx - size, cy + d, color);
        px(cx + size, cy + d, color);
      }
    };
    // friendlies: three regiments advancing from Evensbrook toward the enemy
    const ex = (opts.enemyX / 1000) * 240;
    const ey = (opts.enemyY / 1000) * 160;
    const fx = 120;
    const fy = 84;
    const steps: Array<[number, number]> = [
      [0.3, -4],
      [0.55, 3],
      [0.8, -2],
    ];
    for (const [t, off] of steps) {
      const bx = Math.round(fx + (ex - fx) * t + off);
      const by = Math.round(fy + (ey - fy) * t + off);
      dot(bx, by, "#ffb000", 1);
      px(bx, by, "#05070a");
    }
    // hostile blip
    let hx = Math.round(ex);
    let hy = Math.round(ey);
    if (opts.enemyKnown) {
      dot(hx, hy, "#ff6b6b", 2);
      px(hx, hy, "#05070a");
    } else {
      hx += rng.int(-40, 40);
      hy += rng.int(-30, 30);
      ring(hx, hy, "#ff6b6b", 3);
    }
  });
}
