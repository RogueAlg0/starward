// Voyage resolution: the tick engine and every voyage event.
// Every event names crew and moves the story; quiet ticks never repeat a
// dead tick, every quiet day names someone.
import type { Contract, CrewMember, VoyageContext, VoyageEvent } from "../types";
import { doctrineById, hullById } from "./data";
import { chance, clamp, pick, randInt, shuffle } from "./rng";
import { getState, saveGame } from "./state";
import {
  aliveCrew,
  crewById,
  hasTrait,
  injure,
  officer,
  randomCrew,
  skillCheck,
  stationName,
} from "./crew";
import { logAdd, logAscii, logVoyageHeader } from "./log";
import { sectorChartASCII } from "../art/setpieces";
import { render, updateVoyageView } from "../ui/shell";
import { dealDramas, dealHirePool } from "./station";
import { checkCaptainFate } from "./captain";

export function damageShip(amount: number, causeText: string): "limp" | "destroyed" | "ok" {
  const S = getState();
  if (!S.ship) return "ok";
  const before = S.ship.condition;
  S.ship.condition = clamp(S.ship.condition - amount, 0, S.ship.maxCondition);
  if (S.ship.condition <= 0 && S.doctrine !== "bold") {
    // Elastic failure: non-bold doctrines never lose the ship to a bad roll.
    S.ship.condition = 4;
    if (!S._limped) {
      S._limped = true;
      logAdd(
        "The " +
          S.ship.name +
          " is barely holding together. " +
          causeText +
          " Damage control parties work through the smoke. She will make port, but only just.",
        "bad"
      );
    }
    return "limp";
  }
  if (S.ship.condition <= 0) {
    destroyShip(causeText);
    return "destroyed";
  }
  if (before > 25 && S.ship.condition <= 25 && !S._warned) {
    S._warned = true;
    logAdd("Hull integrity critical. The captain orders all hands to brace.", "bad");
  }
  return "ok";
}

export { injure } from "./crew";

function healTick(): void {
  // medbay officer tends the worst hurt each day
  const doc = officer("medbay");
  if (!doc) return;
  let worst: CrewMember | null = null;
  for (const m of aliveCrew()) {
    if (m.health < 100 && (!worst || m.health < worst.health)) worst = m;
  }
  if (worst) {
    const amt = 2 + (doc.apt.medic || 0);
    worst.health = clamp(worst.health + amt, 0, 100);
  }
}

function restTick(): void {
  // off-duty crew recover a little morale
  for (const m of aliveCrew()) {
    if (!m.station) m.morale = clamp(m.morale + 1, 0, 100);
  }
}

export function moraleShift(
  crew: CrewMember | null | undefined,
  amount: number,
  reason?: string
): void {
  if (!crew || !crew.alive) return;
  crew.morale = clamp(crew.morale + amount, 0, 100);
  if (reason)
    logAdd(
      crew.name + "'s morale " + (amount >= 0 ? "lifts" : "sinks") + ". " + reason,
      amount >= 0 ? "good" : "plain"
    );
}

export function addScar(name: string, story: string): void {
  const S = getState();
  if (!S.ship) return;
  S.ship.scars.push({ name, story });
  logAdd("The " + S.ship.name + " earns a scar: " + name + ". " + story, "bad");
}

export function addQuirk(name: string, story: string): void {
  const S = getState();
  if (!S.ship) return;
  S.ship.quirks.push({ name, story });
  logAdd("The " + S.ship.name + " earns a quirk: " + name + ". " + story, "good");
}

/* Quiet ticks: never a dead tick. Every quiet day names someone. */
const QUIET: Array<() => string> = [
  () => { const m = randomCrew()!; return m.name + " hums an old mining song on the " + stationName(m.station) + " shift. Nobody asks them to stop."; },
  () => { const m = randomCrew()!; return "Night cycle. " + m.name + " beats the quartermaster at cards and is insufferable about it for days."; },
  () => { const m = randomCrew()!; return m.name + " runs diagnostics twice. The second time is just for comfort."; },
  () => { const m = randomCrew()!; return "The galley serves something gray. " + m.name + " eats it without complaint and earns quiet respect."; },
  () => { const m = randomCrew()!; return m.name + " tells the story of the mutiny they survived. The new hands listen like it is scripture."; },
  () => { const m = randomCrew()!; return "Drift ice pings off the hull like rain. " + m.name + " watches it from the viewport and says nothing."; },
  () => { const m = randomCrew()!; return m.name + " reorganizes the tool locker by a system only they understand. Efficiency rises anyway."; },
  () => { const m = randomCrew()!; return "A message buoy from home. " + m.name + " reads it three times, then gets back to work."; },
  () => { const m = randomCrew()!; return m.name + " and the ship's cat (unauthorized, beloved) hold a staring contest. The cat wins."; },
  () => { const m = randomCrew()!; return "Quiet dark between stars. " + m.name + " logs an extra hour on watch without being asked."; },
  () => { const m = randomCrew()!; return m.name + " teaches a card trick to anyone who will sit still. Morale, briefly, is a magic show."; },
  () => { const m = randomCrew()!; return "The engines settle into their cruising hum. " + m.name + " calls it the ship breathing."; },
];

export function quietLine(): string {
  return pick(QUIET)();
}

export function launchVoyage(): void {
  const S = getState();
  const c = S.contracts.find((x) => x.id === S.activeContract);
  if (!c) return;
  S.phase = "voyage";
  S.screen = "voyage";
  S.tick = 0;
  S.tickTotal = c.ticks;
  S.voyageSpeed = 1;
  logVoyageHeader(c);
  logAscii(sectorChartASCII(c));
  S._painted = S.log.length; // live view streams only new entries
  S._warned = false;
  S._limped = false;
  render();
  // start the tick loop
  S.voyageTimer = window.setInterval(voyageTick, 1000);
}

export function voyageTick(): void {
  const S = getState();
  if (S.phase !== "voyage") {
    if (S.voyageTimer) clearInterval(S.voyageTimer);
    return;
  }
  S.tick++;
  S.day++;
  const c = S.contracts.find((x) => x.id === S.activeContract) as Contract;
  const riskMult: Record<string, number> = { safe: 0.8, risky: 1.0, perilous: 1.25 };
  const docMult: Record<string, number> = { cautious: 0.7, balanced: 1.0, bold: 1.35 };
  const eventChance = clamp(0.42 * riskMult[c.risk] * docMult[S.doctrine], 0.15, 0.75);

  if (chance(eventChance)) {
    runVoyageEvent(c);
  } else {
    logAdd(quietLine(), "plain");
  }
  healTick();
  restTick();
  updateVoyageView();

  if (S.shipLost) return; // destroyShip ended things
  if (S.tick >= S.tickTotal) endVoyage();
}

export function toggleSpeed(): void {
  const S = getState();
  S.voyageSpeed = S.voyageSpeed === 1 ? 4 : 1;
  if (S.voyageTimer) clearInterval(S.voyageTimer);
  S.voyageTimer = window.setInterval(voyageTick, 1000 / S.voyageSpeed);
  updateVoyageView();
}

export function skipVoyage(): void {
  const S = getState();
  if (S.voyageTimer) clearInterval(S.voyageTimer);
  let guard = 0;
  while (getState().phase === "voyage" && guard < 500) {
    voyageTick();
    guard++;
  }
  render();
}

/* ------------------------------------------------------------------ */
/* Voyage events                                                        */
/* ------------------------------------------------------------------ */

export function runVoyageEvent(contract: Contract): void {
  const S = getState();
  const ctx: VoyageContext = { contract, doctrine: S.doctrine, risk: contract.risk };
  const bag: Array<[number, VoyageEvent]> = [];
  for (const ev of EVENTS) {
    const w = ev.w(ctx);
    if (w > 0) bag.push([w, ev]);
  }
  let total = 0;
  for (const [w] of bag) total += w;
  let roll = Math.random() * total;
  for (const [w, ev] of bag) {
    roll -= w;
    if (roll <= 0) {
      ev.run(ctx);
      return;
    }
  }
  logAdd(quietLine(), "plain");
}

const EVENTS: VoyageEvent[] = [
  {
    id: "pirate_ambush",
    w: (c) => ({ safe: 1, risky: 3, perilous: 5 })[c.risk] * (c.doctrine === "bold" ? 1.4 : 1),
    run(c) {
      const S = getState();
      const gunner = officer("guns");
      const hull = hullById(S.ship!.hullId);
      const spot = officer("bridge");
      // cautious doctrine may slip away before the fight
      if (c.doctrine === "cautious" && spot) {
        const ev = skillCheck(spot, ["pilot", "navigator"], hasTrait(spot, "eagleeyed") ? 2 : 0);
        if (ev >= 12) {
          logAdd(
            spot.name + " reads the drive signatures early and " + S.ship!.name +
              " ghosts past the ambush point in silence. Per standing orders, no engagement.",
            "good"
          );
          moraleShift(spot, 4, "clean work, no shots fired");
          return;
        }
      }
      const roll = skillCheck(gunner, ["gunner"], hull.guns + (gunner && hasTrait(gunner, "brave") ? 2 : 0));
      const need = c.doctrine === "bold" ? 11 : 14;
      if (roll >= need) {
        const gname = gunner ? gunner.name : "the gun crews";
        logAdd(
          "Pirates burn in fast off the port bow. " + gname +
            " answers with a full broadside and the raiders break off trailing atmosphere. The mess cheers.",
          "good"
        );
        if (gunner) moraleShift(gunner, 6);
        S.credits += randInt(20, 60);
        logAdd("The pirates abandon a cargo pod in their hurry. Sold at the next port: welcome money.", "good");
      } else {
        const gname = gunner ? gunner.name : "the gun crews";
        logAdd(
          "Pirate ambush. " + gname +
            " fights them off, but the " + S.ship!.name + " takes hits getting clear.",
          "bad"
        );
        const r = damageShip(randInt(8, 16), "Pirate cannon fire chews the outer hull.");
        if (gunner && chance(0.5)) injure(gunner, randInt(8, 20), "A console explodes beside them during the exchange.");
        if (r === "ok" && chance(0.35)) addScar("Raider's kiss", "Scorch marks along the port flank from a pirate ambush that got too close.");
        if (r === "ok") for (const m of aliveCrew()) m.morale = clamp(m.morale - 3, 0, 100);
      }
    },
  },
  {
    id: "anomaly",
    w: () => 3 + (getState().ship!.hullId === "explorer" ? 3 : 0),
    run() {
      const S = getState();
      const eng = officer("engineering");
      const bonus =
        (S.ship!.hullId === "explorer" ? 2 : 0) +
        (eng && hasTrait(eng, "methodical") ? 2 : 0) +
        (eng && hasTrait(eng, "bookish") ? 2 : 0);
      const roll = skillCheck(eng, ["engineer", "navigator"], bonus);
      const ename = eng ? eng.name : "the duty engineer";
      if (roll >= 13) {
        const prize = randInt(60, 160);
        S.credits += prize;
        logAdd(
          ename + " coaxes the sensors through a gravitational anomaly and pulls out clean survey data. " +
            "Sold to a university barge for " + prize + " credits.",
          "good"
        );
        if (chance(0.3)) addQuirk("Lucky coil", "The overhauled drive hums a half tone higher ever since " + ename + " tuned it inside that anomaly.");
        moraleShift(eng, 5, "a genuine discovery");
      } else {
        logAdd(
          "A spatial anomaly grabs the " + S.ship!.name + " by the keel. " + ename +
            " wrestles the ship free, but the hull complains about it for days.",
          "bad"
        );
        damageShip(randInt(5, 12), "Anomaly shear stresses the frame.");
      }
    },
  },
  {
    id: "distress_call",
    w: () => 3,
    run(c) {
      const S = getState();
      if (c.doctrine === "cautious") {
        logAdd(
          "A distress call crackles in and dies. Per standing orders, the " + S.ship!.name +
            " does not answer unknown beacons. The bridge is quieter than usual at dinner.",
          "plain"
        );
        for (const m of aliveCrew()) if (hasTrait(m, "loyal")) m.morale = clamp(m.morale - 2, 0, 100);
        return;
      }
      const medic = officer("medbay");
      const roll = skillCheck(medic, ["medic", "pilot"], c.doctrine === "bold" ? 2 : 0);
      const mname = medic ? medic.name : "the med team";
      if (roll >= 12) {
        logAdd(
          "The " + S.ship!.name + " answers a distress call: a freighter with a blown reactor. " + mname +
            " stabilizes three survivors and the freighter's captain presses a reward into our hands.",
          "good"
        );
        const prize = randInt(40, 110);
        S.credits += prize;
        logAdd("Reward banked: " + prize + " credits, and a story the crew will dine out on for months.", "good");
        for (const m of aliveCrew()) m.morale = clamp(m.morale + 4, 0, 100);
      } else {
        logAdd("The distress call was bait. Raiders drop their mask as the " + S.ship!.name + " closes in.", "bad");
        damageShip(randInt(8, 15), "Raiders hiding behind a fake beacon rake the ship.");
        if (medic && chance(0.4)) injure(medic, randInt(6, 16), "Shrapnel finds them in the corridor during the escape burn.");
      }
    },
  },
  {
    id: "stowaway",
    w: () => 2,
    run() {
      const S = getState();
      const cargo = officer("cargo");
      const roll = skillCheck(cargo, ["quartermaster"], hasTrait(cargo, "eagleeyed") ? 2 : 0);
      const cname = cargo ? cargo.name : "the cargo crew";
      if (roll >= 12) {
        logAdd(
          cname + " finds a stowaway in the grain hold on day two: a runaway apprentice with clever hands. " +
            "Put to work, fed, and logged as supernumerary. They weep with relief.",
          "good"
        );
        moraleShift(cargo, 5, "a good deed, well hidden from the manifest");
      } else {
        const loss = randInt(30, 90);
        S.credits = Math.max(0, S.credits - loss);
        logAdd(
          "A stowaway is found only after they have been through the stores. " + cname +
            " is furious. Missing goods worth " + loss + " credits.",
          "bad"
        );
        moraleShift(cargo, -4, "embarrassed in front of the captain");
      }
    },
  },
  {
    id: "engine_trouble",
    w: (c) => (c.doctrine === "cautious" ? 1.5 : 3),
    run() {
      const S = getState();
      const eng = officer("engineering");
      const bonus = (S.ship!.hullId === "hauler" ? 3 : 0) + (eng && hasTrait(eng, "methodical") ? 2 : 0);
      const roll = skillCheck(eng, ["engineer"], bonus);
      const ename = eng ? eng.name : "the engineers";
      if (roll >= 12) {
        logAdd(
          "A coolant fault blooms in the drive. " + ename +
            " has it isolated before the alarms finish their first cycle. Textbook work.",
          "good"
        );
        moraleShift(eng, 4, "professional pride");
      } else {
        logAdd(
          "The main drive coughs and drops to half power. " + ename +
            " spends two days in the guts of the machine, coming out scorched and victorious.",
          "bad"
        );
        const r = damageShip(randInt(6, 12), "Drive fault shakes loose half the aft plating.");
        if (eng && chance(0.35)) injure(eng, randInt(5, 14), "A coolant line bursts during the repair.");
        if (r === "ok" && chance(0.25)) addScar("Drive cough", "The aft plating was re-welded in a hurry after a drive fault mid-voyage.");
      }
    },
  },
  {
    id: "crew_dispute",
    w: () => 2.5,
    run() {
      // prefer a real feud, else a hothead, else any two crew
      let a: CrewMember | null = null;
      let b: CrewMember | null = null;
      for (const m of aliveCrew()) {
        const f = m.relations.find((r) => {
          const other = crewById(r.with);
          return other && other.alive && (r.type === "feud" || r.type === "rivals");
        });
        if (f) {
          a = m;
          b = crewById(f.with)!;
          break;
        }
      }
      if (!a) {
        const hot = aliveCrew().find((m) => hasTrait(m, "hothead"));
        const others = aliveCrew().filter((m) => m !== hot);
        if (hot && others.length) {
          a = hot;
          b = pick(others);
        }
      }
      if (!a) {
        const pool = shuffle(aliveCrew());
        if (pool.length < 2) {
          logAdd(quietLine(), "plain");
          return;
        }
        a = pool[0];
        b = pool[1];
      }
      const bCrew = b as CrewMember;
      const peacemaker = aliveCrew().find((m) => m !== a && m !== bCrew && (hasTrait(m, "charming") || hasTrait(m, "loyal")));
      if (peacemaker && chance(0.6)) {
        logAdd(
          a.name + " and " + bCrew.name + " nearly come to blows over a card game. " + peacemaker.name +
            " talks them down with the patience of a saint and buys the next round.",
          "good"
        );
        moraleShift(peacemaker, 3, "the crew respects a peacemaker");
        a.morale = clamp(a.morale + 2, 0, 100);
        bCrew.morale = clamp(bCrew.morale + 2, 0, 100);
      } else {
        logAdd(
          a.name + " and " + bCrew.name + " have a screaming row in the corridor. Doors close. " +
            "The captain logs it and assigns them opposite shifts.",
          "bad"
        );
        a.morale = clamp(a.morale - 8, 0, 100);
        bCrew.morale = clamp(bCrew.morale - 8, 0, 100);
      }
    },
  },
  {
    id: "micrometeorites",
    w: () => 2.5,
    run(c) {
      const S = getState();
      const bridge = officer("bridge");
      const roll = skillCheck(bridge, ["pilot", "navigator"], hasTrait(bridge, "eagleeyed") ? 3 : 0);
      const bname = bridge ? bridge.name : "the watch officer";
      if (roll >= 13) {
        logAdd(
          "Micrometeorite storm on the plot. " + bname +
            " threads the " + S.ship!.name + " through the worst of it like a needle. The hull rings, but holds.",
          "good"
        );
        moraleShift(bridge, 4, "fine flying");
      } else {
        logAdd(
          "A micrometeorite storm sandpapers the " + S.ship!.name + ". " + bname +
            " does what they can, but the ship takes the weather full in the face.",
          "bad"
        );
        const r = damageShip(randInt(5, 11), "Micrometeorites pit the hull plating.");
        if (r === "ok" && c.doctrine === "bold" && chance(0.4))
          addScar("Sandblasted bow", "The bow plating is pitted and dull from flying a storm at full burn.");
      }
    },
  },
  {
    id: "trade_opportunity",
    w: () => 2 + (getState().ship!.hullId === "hauler" ? 2 : 0),
    run() {
      const S = getState();
      const cargo = officer("cargo");
      const bonus = (S.ship!.hullId === "hauler" ? 2 : 0) + (cargo && hasTrait(cargo, "charming") ? 2 : 0);
      const roll = skillCheck(cargo, ["quartermaster"], bonus);
      const cname = cargo ? cargo.name : "the cargo crew";
      if (roll >= 12) {
        let prize = randInt(50, 130);
        if (cargo && hasTrait(cargo, "gambler")) prize = Math.round(prize * 1.4);
        S.credits += prize;
        logAdd(
          "A drifting trade barge, desperate to offload. " + cname +
            " haggles like a dockside legend and flips the cargo at the next port for " + prize + " credits.",
          "good"
        );
        moraleShift(cargo, 5, "the thrill of the deal");
      } else {
        logAdd(
          "A trade barge hails with what sounds like a fortune in rare goods. " + cname +
            " smells the con one broadcast too late. Nothing lost but pride, and some pride.",
          "plain"
        );
        moraleShift(cargo, -3, "out-haggled");
      }
    },
  },
  {
    id: "strange_signal",
    w: () => 2 + (getState().ship!.hullId === "explorer" ? 2 : 0),
    run() {
      const S = getState();
      const bridge = officer("bridge");
      const bonus =
        (S.ship!.hullId === "explorer" ? 3 : 0) +
        (bridge && hasTrait(bridge, "bookish") ? 2 : 0) +
        (bridge && hasTrait(bridge, "superstitious") ? 1 : 0);
      const roll = skillCheck(bridge, ["navigator"], bonus);
      const bname = bridge ? bridge.name : "the watch officer";
      if (roll >= 13) {
        const prize = randInt(70, 170);
        S.credits += prize;
        logAdd(
          bname + " triangulates a strange repeating signal to a dead relay station. Its data cores are intact. " +
            "Archivists pay " + prize + " credits and ask no questions about the personal logs.",
          "good"
        );
        if (chance(0.3)) addQuirk("Whisper dish", "The comm array was retuned to that dead relay's frequency and never quite tuned back. It picks up odd harmonics.");
      } else {
        logAdd(
          "A strange signal resolves into a century-old emergency beacon, long since answered. " + bname +
            " logs it anyway. Someone should remember.",
          "plain"
        );
      }
    },
  },
  {
    id: "accident",
    w: () => 2,
    run() {
      const m = randomCrew();
      if (!m) return;
      if (hasTrait(m, "ironstomach") && chance(0.5)) {
        logAdd(
          "A deck plate gives way under " + m.name + ". They land hard, stand up harder, and refuse the medbay. Legend grows.",
          "good"
        );
        moraleShift(m, 4, "unbreakable");
        return;
      }
      injure(m, randInt(6, 16), "A loose cargo strap in zero-g does what loose cargo straps do.");
      const medic = officer("medbay");
      if (medic && medic !== m && m.alive) {
        logAdd(medic.name + " patches them up and files a furious report about strap discipline.", "plain");
      }
    },
  },
  {
    id: "morale_moment",
    w: () => 2,
    run() {
      const low = aliveCrew().slice().sort((a, b) => a.morale - b.morale)[0];
      if (!low) return;
      if (low.morale < 45) {
        logAdd(
          low.name + " has been quiet for days. The captain finds them in the observation blister, " +
            "talks about home, about why anyone ships out at all. They come back to dinner. It is not fixed, but it is better.",
          "good"
        );
        low.morale = clamp(low.morale + 12, 0, 100);
      } else {
        const m = randomCrew()!;
        logAdd(
          m.name + " declares it the anniversary of their first voyage and breaks out the good rations. " +
            "The crew toasts absent friends. Morale, for one bright evening, is not a number.",
          "good"
        );
        for (const x of aliveCrew()) x.morale = clamp(x.morale + 3, 0, 100);
      }
    },
  },
  {
    id: "ruins",
    w: () => 1.2 + (getState().ship!.hullId === "explorer" ? 1.5 : 0),
    run() {
      const S = getState();
      const bridge = officer("bridge");
      const bonus = S.ship!.hullId === "explorer" ? 3 : 0;
      const roll = skillCheck(bridge, ["navigator"], bonus);
      const bname = bridge ? bridge.name : "the survey team";
      if (roll >= 14) {
        const prize = randInt(150, 300);
        S.credits += prize;
        logAdd(
          bname + " finds it first: a pre-collapse relay tomb, cold and perfect. The salvage rights alone are worth " +
            prize + " credits. This voyage just paid for itself twice over.",
          "good"
        );
        if (chance(0.4)) addQuirk("Tomb-touched", "Something from that relay tomb was bolted to the hull as a trophy. The crew touches it for luck before every burn.");
        for (const x of aliveCrew()) x.morale = clamp(x.morale + 5, 0, 100);
      } else {
        logAdd(
          "Long-range scopes catch the glint of old wreckage, but the burn to reach it would cost more than it could pay. " +
            bname + " marks it on the charts for someone luckier.",
          "plain"
        );
      }
    },
  },
  {
    id: "pirate_hail",
    w: (c) => ({ safe: 0.5, risky: 2, perilous: 3.5 })[c.risk],
    run() {
      const S = getState();
      const cargo = officer("cargo");
      if (cargo && hasTrait(cargo, "charming") && chance(0.6)) {
        logAdd(
          "A pirate cutter hails, demanding tribute. " + cargo.name +
            " talks them into taking a case of engine wine and a story instead of blood. Crisis averted with charm.",
          "good"
        );
        moraleShift(cargo, 6, "talked down pirates");
        return;
      }
      const gunner = officer("guns");
      const hull = hullById(S.ship!.hullId);
      const roll = skillCheck(gunner, ["gunner"], hull.guns);
      if (roll >= 13) {
        logAdd(
          "Pirates demand tribute on an open channel. The " + S.ship!.name +
            " answers by running out the guns. The pirates reconsider their life choices and burn away.",
          "good"
        );
        if (gunner) moraleShift(gunner, 5, "intimidation as a service");
      } else {
        const toll = Math.min(S.credits, randInt(60, 150));
        S.credits -= toll;
        logAdd(
          "Outgunned and honest about it, the captain pays the pirates' toll: " + toll +
            " credits. Pride is expensive; the alternative was more expensive.",
          "bad"
        );
        for (const m of aliveCrew()) m.morale = clamp(m.morale - 4, 0, 100);
      }
    },
  },
  {
    id: "hero_moment",
    w: () => 2,
    run() {
      const m = randomCrew();
      if (!m) return;
      const feats = [
        m.name + " spots a fault in the reactor shielding that the diagnostics missed. Quietly. Before it mattered. The captain notes it in the log with emphasis.",
        "During a burn correction, " + m.name + " holds a manual attitude lock for forty minutes when the gyros stutter. Their hands do not shake until after.",
        m.name + " rigs a water recycler from spare parts and spite, cutting ration strain for the rest of the voyage.",
        m.name + " talks a panicking passenger transport through a debris field over an open channel, voice steady as stone.",
      ];
      logAdd(pick(feats), "good");
      moraleShift(m, 8, "recognized in the log");
      for (const x of aliveCrew()) if (x !== m) x.morale = clamp(x.morale + 2, 0, 100);
    },
  },
  {
    id: "bonding",
    w: () => 2,
    run() {
      const pool = shuffle(aliveCrew());
      if (pool.length < 2) return;
      const a = pool[0];
      const b = pool[1];
      const existing = a.relations.find((r) => r.with === b.id);
      if (existing && (existing.type === "feud" || existing.type === "rivals")) {
        existing.type = "friends";
        const rb = b.relations.find((r) => r.with === a.id);
        if (rb) rb.type = "friends";
        logAdd(
          "Somewhere past the halfway mark, " + a.name + " and " + b.name +
            " bury whatever it was. They are seen laughing in the mess. The whole ship breathes easier.",
          "good"
        );
        a.morale = clamp(a.morale + 6, 0, 100);
        b.morale = clamp(b.morale + 6, 0, 100);
      } else if (!existing && chance(0.5)) {
        const type = pick(["friends", "romance"] as const);
        a.relations.push({ with: b.id, type });
        b.relations.push({ with: a.id, type });
        if (type === "romance") {
          logAdd(
            a.name + " and " + b.name + " are spending a lot of time in the observation blister. " +
              "The crew pretends not to notice. The log notices.",
            "good"
          );
        } else {
          logAdd(
            a.name + " and " + b.name + " have become inseparable off-shift. Fast friends, the kind the dark makes.",
            "good"
          );
        }
        a.morale = clamp(a.morale + 5, 0, 100);
        b.morale = clamp(b.morale + 5, 0, 100);
      } else {
        logAdd(quietLine(), "plain");
      }
    },
  },
];

/* ------------------------------------------------------------------ */
/* End of voyage, ship loss                                             */
/* ------------------------------------------------------------------ */

export function endVoyage(): void {
  const S = getState();
  if (S.voyageTimer) {
    clearInterval(S.voyageTimer);
    S.voyageTimer = null;
  }
  if (S.phase !== "voyage") return;
  const c = S.contracts.find((x) => x.id === S.activeContract) as Contract;
  const pay = Math.round(c.pay * doctrineById(S.doctrine).mult);
  S.credits += pay;
  S.voyageCount++;
  logAdd(
    "Arrived at " + c.to + " after " + c.ticks + " days. Contract paid: " + pay +
      " credits under " + doctrineById(S.doctrine).name.toLowerCase() + " doctrine. The crew has earned shore leave.",
    "voyage"
  );
  if (S.captain) S.captain.age += 2;
  for (const m of S.crew) if (m.alive) m.age += 2;
  S.phase = "station";
  S.screen = "voyage";
  S.activeContract = null;
  S._warned = false;
  dealHirePool();
  dealDramas();
  saveGame(true);
  if (checkCaptainFate()) {
    render();
    return;
  }
  render();
}

export function destroyShip(causeText: string): void {
  const S = getState();
  if (S.voyageTimer) {
    clearInterval(S.voyageTimer);
    S.voyageTimer = null;
  }
  const oldName = S.ship ? S.ship.name : "the ship";
  logAdd(
    "The " + oldName + " is breaking up. " + causeText +
      " Abandon ship is called. Escape pods scatter into the dark.",
    "bad"
  );
  // elastic to the end: the injured go first, the lucky walk away
  const victims = shuffle(aliveCrew().filter((m) => m.health < 70));
  const dead = victims.slice(0, randInt(1, 2));
  for (const m of dead) {
    m.alive = false;
    m.station = null;
    logAdd(m.name + " does not make it to a pod. Their name is read aloud at the memorial, and written here.", "bad");
  }
  for (const m of aliveCrew()) {
    m.health = clamp(m.health - 25, 5, 100);
    m.morale = clamp(m.morale - 15, 0, 100);
    m.station = null;
  }
  logAdd(
    "The " + oldName + " dies with her lights on. The survivors watch from the pods in silence. " +
      "Insurance and salvage will cover a new hull. Nothing covers this.",
    "captain"
  );
  S._lostName = oldName;
  S.ship = null;
  S.needsNewHull = true;
  S.shipLost = true;
  S.phase = "station";
  S.screen = "voyage";
  S.activeContract = null;
  S._warned = false;
  if (S.captain) S.captain.age += 2;
  dealHirePool();
  dealDramas();
  saveGame(true);
  render();
}
