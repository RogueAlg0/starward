// Procedural dives: each campaign is a sequence of 2-4 dives generated from
// the campaign seed. Every roll is shown to the player with what it means;
// never mystery meat. Difficulty and extraction pressure escalate per dive.
import type { Dive, DiveType } from "../types";
import { ENEMY_REGIMENTS } from "./world";
import { hashStr, mulberry32 } from "./rng";

export interface Terrain {
  id: string;
  name: string;
  desc: string;
  battle: number;
  supplyDrain: number;
  reportError: number;
}

export interface Weather {
  id: string;
  name: string;
  desc: string;
  battle: number;
  supplyDrain: number;
  reportError: number;
}

export interface Twist {
  id: string;
  name: string;
  desc: string;
  battle: number;
  supplyDrain: number;
  reportError: number;
  enemyMult: number;
}

export const TERRAINS: Terrain[] = [
  { id: "ford", name: "River ford", desc: "Pike hold the shallows well (+1 battle).", battle: 1, supplyDrain: 0, reportError: 0 },
  { id: "hills", name: "Ashen hills", desc: "The guns love the high ground (+1 battle); the wagons hate the mud (+1 supply drain).", battle: 1, supplyDrain: 1, reportError: 0 },
  { id: "field", name: "Open field", desc: "Clear sight lines. Reports run truer (-0.05 report error).", battle: 0, supplyDrain: 0, reportError: -0.05 },
  { id: "forest", name: "Pine forest", desc: "The trees eat scouts (+0.10 report error).", battle: 0, supplyDrain: 0, reportError: 0.1 },
  { id: "farmland", name: "Burned farmland", desc: "Nothing left to forage (+1 supply drain).", battle: 0, supplyDrain: 1, reportError: 0 },
];

export const WEATHERS: Weather[] = [
  { id: "ashen-winds", name: "Ashen winds", desc: "Cold clear air. The scouts see far (-0.10 report error).", battle: 0, supplyDrain: 0, reportError: -0.1 },
  { id: "march-rain", name: "Rain over the marches", desc: "Mud takes the roads (+1 supply drain).", battle: 0, supplyDrain: 1, reportError: 0 },
  { id: "cold-dawn", name: "Clear cold dawn", desc: "Frost hardens the ground and the men (+1 battle).", battle: 1, supplyDrain: 0, reportError: 0 },
];

export const TWISTS: Twist[] = [
  { id: "turncoat", name: "Turncoat guide", desc: "Their guide sells to both sides (+0.15 report error).", battle: 0, supplyDrain: 0, reportError: 0.15, enemyMult: 1 },
  { id: "burned-wells", name: "Burned wells", desc: "Every well for miles is fouled (+1 supply drain).", battle: 0, supplyDrain: 1, reportError: 0, enemyMult: 1 },
  { id: "deserters", name: "Veskar deserters", desc: "Their ranks are bleeding men (enemy x0.9).", battle: 0, supplyDrain: 0, reportError: 0, enemyMult: 0.9 },
  { id: "old-field", name: "Old battlefield", desc: "The crows remember this place. The men do too (morale swings harder).", battle: 0, supplyDrain: 0, reportError: 0, enemyMult: 1 },
  { id: "river-fog", name: "Fog off the river", desc: "The scouts come back guessing (+0.10 report error).", battle: 0, supplyDrain: 0, reportError: 0.1, enemyMult: 1 },
  { id: "warband", name: "Allied war band", desc: "A second banner marches with them (enemy x1.15).", battle: 0, supplyDrain: 0, reportError: 0, enemyMult: 1.15 },
];

const DIVE_VERBS: Record<DiveType, string> = {
  seize: "Seize",
  siege: "Break the siege of",
  raid: "Raid the supply line at",
  hold: "Hold",
};

const DIVE_PLACES: Record<DiveType, string[]> = {
  seize: ["crowfield-ford", "millford"],
  siege: ["saltfield", "graywater", "millford"],
  raid: ["hollow-hill", "crowfield-ford"],
  hold: ["saltfield", "graywater"],
};

const DIVE_TICKS: Record<DiveType, [number, number]> = {
  seize: [6, 8],
  siege: [7, 9],
  raid: [5, 6],
  hold: [7, 8],
};

const DIVE_RISK: Record<DiveType, Dive["risk"]> = {
  seize: "battle",
  siege: "battle",
  raid: "skirmish",
  hold: "battle",
};

const PLACE_NAMES: Record<string, string> = {
  "crowfield-ford": "Crowfield Ford",
  "hollow-hill": "Hollow Hill",
  saltfield: "Saltfield",
  millford: "Millford",
  graywater: "Graywater",
  evensbrook: "Evensbrook",
};

export function terrainById(id: string): Terrain {
  return TERRAINS.find((t) => t.id === id) ?? TERRAINS[0];
}
export function weatherById(id: string): Weather {
  return WEATHERS.find((w) => w.id === id) ?? WEATHERS[0];
}
export function twistById(id: string): Twist {
  return TWISTS.find((t) => t.id === id) ?? TWISTS[0];
}

/** Combined dive modifiers, all visible to the player in the briefing. */
export function diveMods(d: Dive): {
  battle: number;
  supplyDrain: number;
  reportError: number;
  enemyMult: number;
} {
  const t = terrainById(d.terrainId);
  const w = weatherById(d.weatherId);
  const tw = twistById(d.twistId);
  return {
    battle: t.battle + w.battle + tw.battle,
    supplyDrain: t.supplyDrain + w.supplyDrain + tw.supplyDrain,
    reportError: t.reportError + w.reportError + tw.reportError,
    enemyMult: tw.enemyMult * (1 + (d.difficulty - 1) * 0.1),
  };
}

/** Generate `count` dives from the campaign seed. Deterministic per seed. */
export function generateDives(seed: string, count: number): Dive[] {
  const rng = mulberry32(hashStr(seed));
  const types: DiveType[] = ["seize", "siege", "raid", "hold"];
  const dives: Dive[] = [];
  let lastType = "";
  for (let i = 0; i < count; i++) {
    let type = types[Math.floor(rng() * types.length)];
    if (type === lastType) type = types[Math.floor(rng() * types.length)];
    lastType = type;
    const places = DIVE_PLACES[type];
    const placeId = places[Math.floor(rng() * places.length)];
    const place = PLACE_NAMES[placeId] ?? placeId;
    const [lo, hi] = DIVE_TICKS[type];
    const ticks = lo + Math.floor(rng() * (hi - lo + 1));
    // enemy composition: 1 regiment, sometimes 2 on later dives
    const pool = [...ENEMY_REGIMENTS];
    const first = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const enemyIds = [first.id];
    if (rng() < 0.15 + i * 0.15) {
      enemyIds.push(pool[Math.floor(rng() * pool.length)].id);
    }
    const terrain = TERRAINS[Math.floor(rng() * TERRAINS.length)];
    const weather = WEATHERS[Math.floor(rng() * WEATHERS.length)];
    const twist = TWISTS[Math.floor(rng() * TWISTS.length)];
    dives.push({
      index: i,
      type,
      name: DIVE_VERBS[type] + " " + place,
      place,
      placeId,
      terrainId: terrain.id,
      weatherId: weather.id,
      enemyIds,
      twistId: twist.id,
      ticks,
      difficulty: i + 1,
      doctrine: "balanced",
      spoils: Math.round((120 + rng() * 80) * (1 + i * 0.25)),
      risk: DIVE_RISK[type],
    });
  }
  return dives;
}

/** Transparent briefing lines: what was rolled and why it matters. */
export function diveBriefing(d: Dive): string[] {
  const t = terrainById(d.terrainId);
  const w = weatherById(d.weatherId);
  const tw = twistById(d.twistId);
  const lines = [
    "DIVE " + (d.index + 1) + ": " + d.name.toUpperCase() + " (" + d.ticks + " days, " + d.risk + ").",
    "Terrain: " + t.name + ". " + t.desc,
    "Weather: " + w.name + ". " + w.desc,
    "Twist: " + tw.name + ". " + tw.desc,
  ];
  if (d.difficulty > 1) {
    lines.push(
      "Difficulty " + d.difficulty + ": the enemy is warier now (x" + diveMods(d).enemyMult.toFixed(2) + " strength) and extraction runs hotter."
    );
  }
  return lines;
}
