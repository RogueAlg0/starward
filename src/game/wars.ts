// The WAR layer above campaigns: a named war with a casus belli, two
// sides, a rival commander with a personality, and a running score.
// Campaign outcomes move the front line, change sector control, kill or
// promote named characters on both sides, and write history. Between wars
// the world keeps its scars.
import type { CampaignOutcome, CampaignRecord, RivalCommander } from "../types";
import { chance, pick } from "./rng";
import { getState, saveGame } from "./state";
import { logAdd } from "./log";
import { aliveOfficers } from "./officers";

const WAR_NAMES = [
  "The Ashen War",
  "The Ford War",
  "The Salt War",
  "The Crow War",
  "The Winter War",
  "The Wolf War",
  "The Graywater War",
];

const CASUS_BELLI = [
  "Kethra's riders burned the Saltfield pans and sowed the fields with salt.",
  "The Blood-Tusk raised their boar standard over Crowfield Ford.",
  "Veskar raiders took the Graywater tithe convoy and hanged the drivers.",
  "Sister Vey's oath-women crossed the ford at dusk and did not leave.",
  "Dumak's riders fired the Millford granaries and rode off laughing.",
];

const RIVALS: Array<Omit<RivalCommander, "grudges" | "doctrineSeen">> = [
  {
    name: "Kethra One-Eye",
    title: "Warlord of the Veskar",
    personality: "cold",
    quirk: "Remembers every dead Veskar by name and village. Recites them before a battle.",
  },
  {
    name: "Brakk of Karzhol",
    title: "Boar-helm of the Blood-Tusk",
    personality: "brash",
    quirk: "Wears a necklace of boar teeth, one for each man he has killed, and can recite the battle of each.",
  },
  {
    name: "Sister Vey",
    title: "First Oath of the Grey Sisters",
    personality: "cunning",
    quirk: "Has not spoken aloud in eleven years. Commands by hand signals.",
  },
];

export function startNewWar(): void {
  const S = getState();
  const rival = pick(RIVALS);
  S.warRecord = {
    name: pick(WAR_NAMES),
    casusBelli: pick(CASUS_BELLI),
    thalmarScore: 100,
    veskarScore: 100,
    campaigns: [],
    active: true,
    rival: { ...rival, grudges: [], doctrineSeen: {} },
  };
  S.warScore = 0;
  logAdd(
    "A new war is named: " + S.warRecord.name + ". " + S.warRecord.casusBelli +
      " Against us: " + rival.name + ", " + rival.title + ".",
    "war"
  );
  saveGame(true);
}

/** The rival watches your doctrines and adapts. Brash taunts, cold notes, cunning counters. */
export function rivalDispatch(campaignName: string, outcome: CampaignOutcome): string | null {
  const S = getState();
  const wr = S.warRecord;
  if (!wr) return null;
  const r = wr.rival;
  // count doctrines seen across the war
  for (const d of S.dives) {
    r.doctrineSeen[d.doctrine] = (r.doctrineSeen[d.doctrine] ?? 0) + 1;
  }
  const top = Object.entries(r.doctrineSeen).sort((a, b) => b[1] - a[1])[0];
  const adapted = top && top[1] >= 2;
  let line: string;
  if (adapted) {
    r.grudges.push("learned your " + top[0] + " ways at " + campaignName);
    if (r.personality === "brash") {
      line = r.name + " laughs across the field: \"Again the " + top[0] + " game? My grandmother saw through that.\" The enemy will be ready for it next time.";
    } else if (r.personality === "cold") {
      line = "A rider delivers a note in a plain hand: \"" + top[0] + " again. Noted.\" It is signed with a single eye.";
    } else {
      line = r.name + " has studied your " + top[0] + " campaigns the way a miser studies coin. Expect counters.";
    }
    return line;
  }
  if (r.personality === "brash") {
    const taunts = [
      r.name + " sends a boar's head to your pickets with a note: \"Come and take the ford, little general.\"",
      "\"Tell your crow it flies over my hills now,\" " + r.name + " shouts across the parley field.",
    ];
    line = pick(taunts);
  } else if (r.personality === "cold") {
    line = "No word from " + r.name + ". That is worse than taunts, the veterans say.";
  } else {
    line = r.name + "'s riders probe a different ford every night. Never the same one twice.";
  }
  if (outcome === "decisive") {
    r.grudges.push("humiliated at " + campaignName);
    line += " But something in the Veskar camp has gone quiet since " + campaignName + ".";
  }
  return line;
}

/** Apply a campaign outcome: scores, front line, named characters, history. */
export function scoreCampaign(rec: CampaignRecord, sector: string): string[] {
  const S = getState();
  const wr = S.warRecord;
  const lines: string[] = [];
  if (!wr) return lines;
  wr.campaigns.push(rec);

  const delta: Record<CampaignOutcome, [number, number]> = {
    decisive: [8, -25],
    pyrrhic: [-4, -12],
    stalemate: [-5, -5],
    defeat: [-18, 5],
    withdrawn: [-6, 0],
  };
  const [td, vd] = delta[rec.outcome];
  wr.thalmarScore = Math.max(0, Math.min(120, wr.thalmarScore + td));
  wr.veskarScore = Math.max(0, Math.min(120, wr.veskarScore + vd));
  S.warScore += Math.round((td - vd) / 2);

  // front line moves
  const front = S.fronts.find((f) => f.sector === sector);
  if ((rec.outcome === "decisive" || rec.outcome === "pyrrhic") && front && front.holder === "Veskar") {
    front.holder = "Thalmar";
    lines.push(sector + " flies Thalmar colors this morning. The line moves.");
  } else if (rec.outcome === "defeat") {
    const ours = S.fronts.filter((f) => f.holder === "Thalmar" && f.sector !== sector);
    if (ours.length) {
      const lost = pick(ours);
      lost.holder = "Veskar";
      lines.push("While you bled at " + sector + ", " + lost.sector + " fell. The war does not wait.");
    }
  }

  // named characters: the enemy bleeds commanders, we raise officers
  if (rec.outcome === "decisive" && chance(0.5)) {
    const foe = S.enemy.find((e) => e.id === rec.foeId);
    if (foe) {
      const successor = pick(["Hakkar", "Ruz", "Veyla", "Dumak's get Bor"]) + " takes up " + foe.name;
      lines.push(foe.commander + " of " + foe.name + " died at " + sector + ". " + successor + ", who has sworn the death be answered.");
      foe.commander = successor.split(" takes up ")[0];
      foe.commanderQuirk = "Swore a blood-oath over the predecessor's grave. Remembers your name.";
      if (!S.relations.rivals.includes(foe.commander)) S.relations.rivals.push(foe.commander);
    }
  }
  if ((rec.outcome === "decisive" || rec.outcome === "pyrrhic") && chance(0.6)) {
    const alive = aliveOfficers();
    if (alive.length) {
      const o = pick(alive);
      const mem = "promoted in the field after " + rec.name;
      if (!o.memories.includes(mem)) o.memories.push(mem);
      o.morale = Math.min(100, o.morale + 5);
      lines.push(o.name + " was promoted in the field after " + rec.name + ". The army approves.");
      const allyTag = o.name + " (field promotion)";
      if (!S.relations.allies.includes(allyTag)) S.relations.allies.push(allyTag);
    }
  }

  // the rival's dispatch
  const dispatch = rivalDispatch(rec.name, rec.outcome);
  if (dispatch) lines.push(dispatch);

  lines.push(
    "WAR SCORE: Thalmar " + wr.thalmarScore + " / Veskar " + wr.veskarScore + "."
  );
  saveGame(true);
  return lines;
}

/** The war ends when a side's score collapses. Returns the winner, if any. */
export function checkWarEnd(): "thalmar" | "veskar" | null {
  const S = getState();
  const wr = S.warRecord;
  if (!wr || !wr.active) return null;
  if (wr.veskarScore <= 0) return "thalmar";
  if (wr.thalmarScore <= 0) return "veskar";
  return null;
}

/** Close out a finished war and name the next one. The world keeps its scars. */
export function endWar(winner: "thalmar" | "veskar"): void {
  const S = getState();
  const wr = S.warRecord;
  if (!wr) return;
  wr.active = false;
  if (winner === "thalmar") {
    logAdd(
      wr.name + " is over. The Veskar sue for peace at Crowfield Ford, and the terms are read aloud in the square. " +
        wr.rival.name + " is gone into the hills; the grudges remain. Evensbrook drinks for a week.",
      "war"
    );
  } else {
    logAdd(
      wr.name + " is over, and not in our favor. Thalmar sues for peace. The terms are read aloud and nobody meets anyone's eyes. " +
        "The regiments keep their standards. The dead keep their names.",
      "war"
    );
  }
  // a season passes; wounds close into scars
  S.day += 30;
  for (const o of S.officers) {
    if (o.alive && o.health < 100) o.health = Math.min(100, o.health + 20);
  }
  startNewWar();
  logAdd("The peace was never going to hold. It never does.", "war");
}

export function warSummary(): string {
  const S = getState();
  const wr = S.warRecord;
  if (!wr) return "No war named yet.";
  return wr.name + " — Thalmar " + wr.thalmarScore + " / Veskar " + wr.veskarScore;
}
