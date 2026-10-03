// Crew generation, lookup, and the skill-check engine.
import type { Aptitudes, CrewMember, RoleStation } from "../types";
import { HOOKS, REL_TYPES, ROLES, STATIONS, TRAITS, personName } from "./data";
import { chance, clamp, pick, randInt, shuffle } from "./rng";
import { getState, nextCrewId } from "./state";
import { logAdd } from "./log";

export function newCrewMember(): CrewMember {
  const apt = {} as Aptitudes;
  for (const r of ROLES) apt[r as keyof Aptitudes] = randInt(0, 4);
  // everyone is decent at one thing, shaky at the rest
  const best = pick(ROLES) as keyof Aptitudes;
  apt[best] = randInt(3, 5);
  const traits = shuffle(TRAITS).slice(0, 2).map((t) => t.id);
  return {
    id: nextCrewId(),
    name: personName(),
    apt,
    traits,
    hook: pick(HOOKS),
    age: randInt(22, 58),
    morale: randInt(55, 85),
    health: randInt(70, 100),
    station: null, // assigned later
    relations: [],
    alive: true,
  };
}

export function traitById(id: string) {
  return TRAITS.find((t) => t.id === id);
}

export function crewById(id: number): CrewMember | undefined {
  return getState().crew.find((c) => c.id === id);
}

export function aliveCrew(): CrewMember[] {
  return getState().crew.filter((c) => c.alive);
}

export function stationCrew(stationId: string): CrewMember | null {
  return getState().crew.find((c) => c.alive && c.station === stationId) || null;
}

export function officer(stationId: string): CrewMember | null {
  return stationCrew(stationId);
}

// Skill check: d12-ish roll plus aptitude, trait and station bonuses.
export function skillCheck(crew: CrewMember | null, roles: string[], bonus?: number): number {
  let score = randInt(1, 12);
  if (crew) {
    let best = 0;
    for (const r of roles) best = Math.max(best, crew.apt[r as keyof Aptitudes] || 0);
    score += best * 2;
    if (crew.traits.includes("steady")) score += 2;
  }
  score += bonus || 0;
  return score;
}

export function hasTrait(crew: CrewMember | null | undefined, id: string): boolean {
  return !!crew && crew.traits.includes(id);
}

export function seedRelations(pool: CrewMember[], n: number): void {
  const alive = pool.filter((c) => c.alive);
  for (let i = 0; i < n; i++) {
    const a = pick(alive);
    const b = pick(alive);
    if (a === b) continue;
    if (a.relations.some((r) => r.with === b.id)) continue;
    const type = pick(REL_TYPES) as CrewMember["relations"][number]["type"];
    a.relations.push({ with: b.id, type });
    b.relations.push({ with: a.id, type });
  }
}

export function bestRole(crew: CrewMember): string {
  let best = ROLES[0];
  let bv = -1;
  for (const r of ROLES) {
    if (crew.apt[r as keyof Aptitudes] > bv) {
      bv = crew.apt[r as keyof Aptitudes];
      best = r;
    }
  }
  return best;
}

export function stationName(id: string | null): string {
  if (!id) return "off duty";
  const st: RoleStation | undefined = STATIONS.find((s) => s.id === id);
  return st ? st.label : id;
}

export function autoAssign(): void {
  const used = new Set<number>();
  for (const st of STATIONS) {
    let best: CrewMember | null = null;
    let bv = -1;
    for (const m of aliveCrew()) {
      if (used.has(m.id)) continue;
      let score = 0;
      for (const r of st.roles) score = Math.max(score, m.apt[r as keyof Aptitudes]);
      if (score > bv) {
        bv = score;
        best = m;
      }
    }
    if (best) {
      best.station = st.id;
      used.add(best.id);
    }
  }
}

export function randomCrew(): CrewMember | null {
  const a = aliveCrew();
  return a.length ? pick(a) : null;
}

// Injury and death. Death is never silent: the log records the name.
export function injure(
  crew: CrewMember | null | undefined,
  amount: number,
  causeText: string
): void {
  if (!crew || !crew.alive) return;
  crew.health = clamp(crew.health - amount, 0, 100);
  crew.morale = clamp(crew.morale - 6, 0, 100);
  if (crew.health <= 0) {
    crew.alive = false;
    crew.station = null;
    logAdd(
      crew.name +
        " has died. " +
        causeText +
        " The crew gathers in the mess for a short, quiet service. Their name goes into the log, and stays there.",
      "bad"
    );
  } else if (crew.health < 30) {
    logAdd(
      crew.name +
        " is badly hurt. " +
        causeText +
        " They will carry this voyage in their body for a long while.",
      "bad"
    );
  } else {
    logAdd(crew.name + " is injured. " + causeText, "bad");
  }
}

export function coolFeud(A: CrewMember | null | undefined, B: CrewMember | null | undefined): void {
  if (!A || !B) return;
  for (const m of [A, B]) {
    const other = m === A ? B : A;
    const r = m.relations.find((x) => x.with === other.id);
    if (r && (r.type === "feud" || r.type === "rivals")) r.type = "rivals";
  }
}

export function makeFriends(A: CrewMember | null | undefined, B: CrewMember | null | undefined): void {
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
