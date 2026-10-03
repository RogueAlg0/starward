// Officers: generation, lookup, the skill-check engine, wounds.
// Every officer is a person first: a name, two traits, one strange quirk,
// one hook into the world. The quirk is what the diary remembers.
import type { Aptitudes, Officer, Relation } from "../types";
import { HOOKS, QUIRKS, TRAITS, officerName } from "./world";
import { chance, clamp, pick, randInt, shuffle } from "./rng";
import { getState, nextOfficerId } from "./state";
import { logAdd } from "./log";

export const APT_KEYS = [
  "infantry",
  "cavalry",
  "artillery",
  "scouts",
  "supply",
  "surgery",
] as const;

export function newOfficer(): Officer {
  const apt = {} as Aptitudes;
  for (const k of APT_KEYS) apt[k] = randInt(0, 4);
  // everyone is good at one thing, shaky at the rest
  const best = pick([...APT_KEYS]);
  apt[best] = randInt(3, 5);
  const traits = shuffle(TRAITS).slice(0, 2).map((t) => t.id);
  return {
    id: nextOfficerId(),
    name: officerName(),
    apt,
    traits,
    quirk: pick(QUIRKS).id,
    hook: pick(HOOKS),
    age: randInt(24, 58),
    morale: randInt(55, 85),
    health: randInt(70, 100),
    regiment: null,
    staff: null,
    relations: [],
    alive: true,
    memories: [],
  };
}

export function quirkText(id: string): string {
  const q = QUIRKS.find((x) => x.id === id);
  return q ? q.text : id;
}

/** named quirk ids used by campaign moments (world.ts uses q-numbers) */
export const QUIRK_IDS = {
  crow: "q3", // keeps a crow that follows the regiment (named Pick)
  saltborn: "q4", // was a Saltfield salt-worker
  horsefear: "q5", // afraid of horses, commands cavalry anyway
  lament: "q6", // whistles the Crowfield lament before every battle
};

export function traitById(id: string) {
  return TRAITS.find((t) => t.id === id);
}

export function officerById(id: number): Officer | undefined {
  return getState().officers.find((o) => o.id === id);
}

export function aliveOfficers(): Officer[] {
  return getState().officers.filter((o) => o.alive);
}

export function regimentCommander(regimentId: string): Officer | null {
  return (
    getState().officers.find(
      (o) => o.alive && o.regiment === regimentId
    ) || null
  );
}

export function staffOfficer(post: string): Officer | null {
  return (
    getState().officers.find((o) => o.alive && o.staff === post) || null
  );
}

// Skill check: d12 roll plus aptitude, trait and circumstance bonuses.
// Every consequential check is visible in the diary: attempt, odds, outcome.
export function skillCheck(
  officer: Officer | null,
  keys: Array<keyof Aptitudes>,
  bonus?: number
): number {
  let score = randInt(1, 12);
  if (officer) {
    let best = 0;
    for (const k of keys) best = Math.max(best, officer.apt[k] || 0);
    score += best * 2;
    if (officer.traits.includes("steady")) score += 2;
  }
  score += bonus || 0;
  return score;
}

export function hasTrait(
  officer: Officer | null | undefined,
  id: string
): boolean {
  return !!officer && officer.traits.includes(id);
}

export function hasQuirk(
  officer: Officer | null | undefined,
  id: string
): boolean {
  return !!officer && officer.quirk === id;
}

export function seedRelations(pool: Officer[], n: number): void {
  const alive = pool.filter((o) => o.alive);
  for (let i = 0; i < n; i++) {
    const a = pick(alive);
    const b = pick(alive);
    if (a === b) continue;
    if (a.relations.some((r) => r.with === b.id)) continue;
    const type = pick(["friends", "rivals", "romance", "feud"]) as Relation["type"];
    a.relations.push({ with: b.id, type });
    b.relations.push({ with: a.id, type });
  }
}

export function bestApt(officer: Officer): string {
  let best: keyof Aptitudes = "infantry";
  let bv = -1;
  for (const k of APT_KEYS) {
    if (officer.apt[k] > bv) {
      bv = officer.apt[k];
      best = k;
    }
  }
  return best;
}

export function randomOfficer(): Officer | null {
  const a = aliveOfficers();
  return a.length ? pick(a) : null;
}

export function moraleShift(
  officer: Officer | null | undefined,
  amount: number,
  reason?: string
): void {
  if (!officer || !officer.alive) return;
  officer.morale = clamp(officer.morale + amount, 0, 100);
  if (reason)
    logAdd(
      officer.name + "'s morale " + (amount >= 0 ? "lifts" : "sinks") + ". " + reason,
      amount >= 0 ? "good" : "plain"
    );
}

export function addMemory(officer: Officer | null | undefined, text: string): void {
  if (!officer || !officer.alive) return;
  if (!officer.memories.includes(text)) officer.memories.push(text);
}

// Wounds and death. Death is never silent: the diary records the name,
// the quirk the regiment will remember, and the cost.
export function wound(
  officer: Officer | null | undefined,
  amount: number,
  causeText: string
): void {
  if (!officer || !officer.alive) return;
  officer.health = clamp(officer.health - amount, 0, 100);
  officer.morale = clamp(officer.morale - 6, 0, 100);
  if (officer.health <= 0) {
    officer.alive = false;
    officer.regiment = null;
    officer.staff = null;
    logAdd(
      officer.name + " is dead. " + causeText +
        " The regiment will remember " + quirkText(officer.quirk) + ". " +
        "Their name goes into the diary, and stays there.",
      "bad"
    );
  } else if (officer.health < 30) {
    logAdd(
      officer.name + " is badly wounded. " + causeText +
        " The surgeon says they will carry this campaign in their body for years.",
      "bad"
    );
  } else {
    logAdd(officer.name + " is wounded. " + causeText, "bad");
  }
}

export function coolFeud(
  A: Officer | null | undefined,
  B: Officer | null | undefined
): void {
  if (!A || !B) return;
  for (const m of [A, B]) {
    const other = m === A ? B : A;
    const r = m.relations.find((x) => x.with === other.id);
    if (r && (r.type === "feud" || r.type === "rivals")) r.type = "rivals";
  }
}

export function makeFriends(
  A: Officer | null | undefined,
  B: Officer | null | undefined
): void {
  if (!A || !B) return;
  for (const m of [A, B]) {
    const other = m === A ? B : A;
    const r = m.relations.find((x) => x.with === other.id);
    if (!r) {
      m.relations.push({ with: other.id, type: "friends" });
    } else {
      r.type = "friends";
    }
  }
  A.morale = clamp(A.morale + 6, 0, 100);
  B.morale = clamp(B.morale + 6, 0, 100);
}

export { chance };

/* ------------------------------------------------------------------ */
/* Last letters: officers write home between dives. If one falls, the  */
/* unsent letter reaches the player in the aftermath. One paragraph,   */
/* specific and human.                                                 */
/* ------------------------------------------------------------------ */

const LETTER_HOMES = ["Evensbrook", "Saltfield", "Millford", "Graywater", "Eelbrook"];

export function writeLetter(o: Officer): void {
  const home = pick(LETTER_HOMES);
  const mate = officerName().split(" ")[0];
  const first = o.name.split(" ")[0];
  const templates = [
    `${first} writes by firelight: "Dear ${home}, we march again tomorrow and my boots are finally dry. ${mate} says the crows follow us because we drop biscuit crumbs, and I let them believe it. ${quirkText(o.quirk)} — you always laughed at that. If the next dive goes badly, know the regiment ate well tonight."`,
    `${first} writes on the back of a supply tally: "Dear ${home}, do not worry when the casualty lists come; the clerks spell every name wrong. ${mate} owes me three coppers and I intend to collect. Tell mother ${quirkText(o.quirk)}, same as always. We are as ready as men get."`,
    `${first} writes quickly, before the light goes: "Dear ${home}, I saw ${mate} laughing today for the first time since the ford, and it was worth the whole campaign. My hands remember the drill even when my head does not. ${quirkText(o.quirk)}. Keep the lamp lit."`,
  ];
  o.letter = pick(templates);
}

/** Between dives, some officers put pen to paper. */
export function writeLetters(): void {
  for (const o of aliveOfficers()) {
    if (!o.letter && chance(0.45)) writeLetter(o);
  }
}

/** Deliver the unsent letters of the fallen. Returns the diary lines. */
export function deliverLetters(): string[] {
  const S = getState();
  const lines: string[] = [];
  for (const o of S.officers) {
    if (!o.alive && o.letter) {
      lines.push("UNSENT LETTER, found in " + o.name + "'s kit: " + o.letter);
      o.letter = undefined;
    }
  }
  return lines;
}
