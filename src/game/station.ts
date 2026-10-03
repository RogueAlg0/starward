// Station phase: hiring, repair, crew drama events, replacement hulls.
import type { CrewMember, Drama } from "../types";
import { PORTS, hullById } from "./data";
import { chance, clamp, pick, randInt, shuffle } from "./rng";
import { getState, saveGame } from "./state";
import { aliveCrew, autoAssign, coolFeud, crewById, injure, makeFriends, newCrewMember } from "./crew";
import { logAdd } from "./log";
import { toast } from "../ui/helpers";
import { render } from "../ui/shell";
import { dealContracts } from "./contracts";

export function dealHirePool(): void {
  const S = getState();
  S.hirePool = [];
  for (let i = 0; i < 3; i++) {
    const m = newCrewMember();
    m.fee = randInt(50, 150);
    S.hirePool.push(m);
  }
}

/* Station drama: 1-2 events per cycle, each a real choice. */
export function dealDramas(): void {
  const S = getState();
  S.dramas = [];
  const pool: Drama[] = [];
  // feud drama needs a feud/rival pair
  for (const m of aliveCrew()) {
    const f = m.relations.find(
      (r) =>
        (r.type === "feud" || r.type === "rivals") &&
        crewById(r.with) &&
        crewById(r.with)!.alive
    );
    if (f) {
      pool.push({ id: "feud", a: m.id, b: f.with });
      break;
    }
  }
  const debtor = aliveCrew().find((m) => m.hook.indexOf("debt") >= 0);
  if (debtor && chance(0.6)) pool.push({ id: "debt", a: debtor.id });
  const elder = aliveCrew()
    .filter((m) => m.age >= 60)
    .sort((a, b) => b.age - a.age)[0];
  if (elder && chance(0.6)) pool.push({ id: "retire", a: elder.id });
  const low = aliveCrew()
    .filter((m) => m.morale < 40)
    .sort((a, b) => a.morale - b.morale)[0];
  if (low && chance(0.6)) pool.push({ id: "homesick", a: low.id });
  const lovers: Array<[number, number]> = [];
  for (const m of aliveCrew()) {
    const r = m.relations.find(
      (x) => x.type === "romance" && crewById(x.with) && crewById(x.with)!.alive
    );
    if (r) {
      lovers.push([m.id, r.with]);
      break;
    }
  }
  if (lovers.length && chance(0.6))
    pool.push({ id: "romance", a: lovers[0][0], b: lovers[0][1] });
  const memoirist = aliveCrew().find((m) => m.hook.indexOf("memoir") >= 0);
  if (memoirist && chance(0.5)) pool.push({ id: "memoir", a: memoirist.id });
  S.dramas = shuffle(pool).slice(0, 2);
}

export function dramaText(d: Drama): string {
  const A = crewById(d.a);
  const B = d.b != null ? crewById(d.b) : null;
  const an = A ? A.name : "someone";
  const bn = B ? B.name : "someone";
  switch (d.id) {
    case "feud":
      return an + " and " + bn + " are barely speaking. The tension is poisoning the mess. Intervene?";
    case "debt":
      return (
        "A station boss's collector finds " +
        an +
        " on the docks. The gambling debt has come due: 80 credits, or the crew hears about it."
      );
    case "retire":
      return (
        an +
        ", " +
        (A ? A.age : "?") +
        " years old, asks for a quiet word. Their hands are not what they were. They are thinking of retiring."
      );
    case "homesick":
      return an + " has been staring at the departure boards. They miss home the way drowning people miss air.";
    case "romance":
      return an + " and " + bn + " want shore leave together at the next port. The crew is taking bets on how this ends.";
    case "memoir":
      return an + " wants permission to publish the tell-all memoir. Chapter three is titled after the captain.";
    default:
      return "Something needs the captain's attention.";
  }
}

export function dramaChoices(d: Drama): string[] {
  switch (d.id) {
    case "feud":
      return ["Separate their shifts (order, -morale)", "Let them settle it (risky)"];
    case "debt":
      return ["Pay the 80 credits", "Refuse (crew morale suffers)"];
    case "retire":
      return ["Honor them with a bonus (60 cr, they leave)", "Persuade them to stay"];
    case "homesick":
      return ["Grant shore leave (30 cr)", "Deny it (duty first)"];
    case "romance":
      return ["Grant the leave", "Keep it professional"];
    case "memoir":
      return ["Allow it (flattered, wary)", "Forbid it (order)"];
    default:
      return ["Noted"];
  }
}

export function dramaChoice(idx: number, choice: number): void {
  const S = getState();
  const d = S.dramas[idx];
  if (!d) return;
  const A = crewById(d.a);
  const B = d.b != null ? crewById(d.b) : null;
  const an = A ? A.name : "they";
  switch (d.id) {
    case "feud":
      if (choice === 0) {
        logAdd(
          "The captain separates " +
            an +
            " and " +
            (B ? B.name : "them") +
            " onto opposite shifts by direct order. The feud cools to a cold professional dislike.",
          "plain"
        );
        if (A) A.morale = clamp(A.morale - 5, 0, 100);
        if (B) B.morale = clamp(B.morale - 5, 0, 100);
        coolFeud(A, B);
      } else {
        if (chance(0.5)) {
          logAdd(
            an +
              " and " +
              (B ? B.name : "them") +
              " settle it the old way: a long talk and a longer drink. " +
              "They come out of it friends, or close enough.",
            "good"
          );
          makeFriends(A, B);
        } else {
          logAdd(
            "It comes to blows in the corridor. " +
              an +
              " takes the worst of it. The captain logs the incident and doubles their shifts apart.",
            "bad"
          );
          if (A) injure(A, randInt(10, 22), "A fistfight with a crewmate, broken up too late.");
        }
      }
      break;
    case "debt":
      if (choice === 0 && S.credits >= 80) {
        S.credits -= 80;
        logAdd(
          "The captain pays " + an + "'s debt in full, 80 credits, no lecture. " + an +
            " is quietly, fiercely grateful.",
          "good"
        );
        if (A) {
          A.morale = clamp(A.morale + 10, 0, 100);
          A.hook = "owes the captain a life debt, and knows it";
        }
      } else if (choice === 0) {
        toast("Not enough credits.");
        return;
      } else {
        logAdd(
          "The captain refuses to pay a crew debt. The collector makes a scene on the docks. " +
            an +
            " walks back aboard to a silent mess.",
          "bad"
        );
        for (const m of aliveCrew()) m.morale = clamp(m.morale - 6, 0, 100);
      }
      break;
    case "retire":
      if (choice === 0 && S.credits >= 60) {
        S.credits -= 60;
        if (A) {
          A.alive = false;
          A.station = null;
        }
        logAdd(
          an +
            " retires with a 60 credit bonus and a full crew salute. Their bunk stays empty for a week out of respect. " +
            "The log records " +
            (A ? A.age - 20 : "?") +
            " years of service.",
          "captain"
        );
      } else if (choice === 0) {
        toast("Not enough credits.");
        return;
      } else {
        if (A && chance(0.6)) {
          logAdd(
            "The captain talks " + an + " into one more voyage. There are tears, then laughter. One more.",
            "good"
          );
          A.morale = clamp(A.morale + 10, 0, 100);
        } else {
          if (A) {
            A.alive = false;
            A.station = null;
          }
          logAdd(an + " retires anyway, gently and finally. Some decisions are not the captain's to make.", "captain");
        }
      }
      break;
    case "homesick":
      if (choice === 0 && S.credits >= 30) {
        S.credits -= 30;
        logAdd(an + " gets a week of shore leave and comes back sunburnt and grinning. Home will keep.", "good");
        if (A) A.morale = clamp(A.morale + 14, 0, 100);
      } else if (choice === 0) {
        toast("Not enough credits.");
        return;
      } else {
        logAdd(
          "Shore leave denied: the schedule is the schedule. " +
            an +
            " accepts it like a professional and hates it like a person.",
          "bad"
        );
        if (A) A.morale = clamp(A.morale - 8, 0, 100);
      }
      break;
    case "romance":
      if (choice === 0) {
        logAdd(
          an +
            " and " +
            (B ? B.name : "them") +
            " get their shore leave. They return holding hands and pretending not to. " +
            "The crew's betting pool pays out.",
          "good"
        );
        if (A) A.morale = clamp(A.morale + 8, 0, 100);
        if (B) B.morale = clamp(B.morale + 8, 0, 100);
      } else {
        logAdd(
          "The captain keeps it professional: staggered leave, no exceptions. " +
            an +
            " understands. Understanding is not the same as forgiving.",
          "plain"
        );
        if (A) A.morale = clamp(A.morale - 4, 0, 100);
        if (B) B.morale = clamp(B.morale - 4, 0, 100);
      }
      break;
    case "memoir":
      if (choice === 0) {
        logAdd(
          "Permission granted. " + an + "'s memoir becomes a minor dockside hit. Chapter three is, the captain admits privately, fair.",
          "good"
        );
        if (A) A.morale = clamp(A.morale + 8, 0, 100);
        S.credits += 25;
      } else {
        logAdd(
          "Forbidden by direct order. " + an + " burns the draft in the galley incinerator, dramatically, where everyone can see.",
          "bad"
        );
        if (A) A.morale = clamp(A.morale - 8, 0, 100);
      }
      break;
    default:
      break;
  }
  S.dramas.splice(idx, 1);
  saveGame(true);
  render();
}

export function hireCrew(id: number): void {
  const S = getState();
  const i = S.hirePool.findIndex((m) => m.id === id);
  if (i < 0) return;
  const m: CrewMember = S.hirePool[i];
  if (S.credits < (m.fee || 0) || aliveCrew().length >= 8) return;
  S.credits -= m.fee || 0;
  S.hirePool.splice(i, 1);
  S.crew.push(m);
  logAdd(
    m.name + " signs on (" + m.fee + " credits). " + m.name.split(" ")[0] + " " +
      m.hook + ", and the crew makes room in the mess.",
    "good"
  );
  saveGame(true);
  render();
}

export function releaseCrew(id: number): void {
  const S = getState();
  const m = crewById(id);
  if (!m || !m.alive || aliveCrew().length <= 1) return;
  if (!window.confirm("Release " + m.name + " from the crew?")) return;
  m.alive = false;
  m.station = null;
  logAdd(
    m.name + " is released with pay and thanks. They stand on the dock a long time, watching the " +
      (S.ship ? S.ship.name : "ship") + " until she is a light among lights.",
    "captain"
  );
  saveGame(true);
  render();
}

export function repairShip(): void {
  const S = getState();
  if (!S.ship) return;
  const cost = Math.ceil((S.ship.maxCondition - S.ship.condition) * 2);
  if (cost <= 0 || S.credits < cost) return;
  if (cost > 150 && !window.confirm("Spend " + cost + " credits on a full overhaul?")) return;
  S.credits -= cost;
  S.ship.condition = S.ship.maxCondition;
  logAdd(
    "The " + S.ship.name + " takes a full yard overhaul: " + cost +
      " credits. She gleams like a promise.",
    "good"
  );
  saveGame(true);
  render();
}

export function restock(): void {
  const S = getState();
  if (S.credits < 40) return;
  S.credits -= 40;
  for (const m of aliveCrew()) m.morale = clamp(m.morale + 10, 0, 100);
  logAdd("Shore leave, real food, and a night the crew will talk about for voyages to come.", "good");
  saveGame(true);
  render();
}

export function pickStation(): string {
  const S = getState();
  if (!S._station) S._station = pick(PORTS);
  return S._station;
}

export function pickNewHull(id: string): void {
  const S = getState();
  S._newHullId = id;
  render();
}

export function commissionReplacement(shipNameInput: string): void {
  const S = getState();
  const nm = shipNameInput.trim() || (S._lostName || "Starward") + " II";
  const hull = hullById(S._newHullId || "frigate");
  S.ship = {
    name: nm,
    hullId: hull.id,
    condition: hull.hull,
    maxCondition: hull.hull,
    cargo: hull.cargo,
    scars: [],
    quirks: [],
  };
  logAdd(
    "A new hull slides out of the yards: the " + nm + " (" + hull.name +
      " class). The survivors touch her flank for luck before boarding. The chronicle continues.",
    "captain"
  );
  S.needsNewHull = false;
  S.shipLost = false;
  S._newHullId = null;
  autoAssign();
  saveGame(true);
  render();
}

export function toVoyageSetup(): void {
  const S = getState();
  S._station = null;
  S.phase = "voyage_setup";
  S.screen = "voyage";
  S.activeContract = null;
  dealContracts();
  saveGame(true);
  render();
}
