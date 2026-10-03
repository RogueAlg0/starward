// Campaign: the tick engine under fog of war.
// Reports arrive delayed and sometimes wrong. Supply, morale, personalities
// and fog collide: stories emerge from the systems, not from a script.
// 2-3 dilemmas per campaign force real choices with no clean answer.
import type {
  CampaignContext,
  CampaignEvent,
  CampaignOutcome,
  CampaignRecord,
  Dilemma,
  Dive,
  EnemyRegiment,
  Objective,
  Officer,
} from "../types";
import { OMEN_LINES, officerName } from "./world";
import { chance, clamp, pick, randInt, shuffle } from "./rng";
import { getState, saveGame } from "./state";
import {
  QUIRK_IDS,
  aliveOfficers,
  hasQuirk,
  hasTrait,
  moraleShift,
  quirkText,
  randomOfficer,
  regimentCommander,
  skillCheck,
  staffOfficer,
  wound,
  addMemory,
  writeLetters,
  deliverLetters,
} from "./officers";
import { logAdd, logCampaignHeader } from "./log";
import { render, updateCampaignView } from "../ui/shell";
import { checkGeneralFate } from "./general";
import { dealGossip, dealRecruits, upgradeOwned } from "./garrison";
import { advanceLivingWar } from "./livingwar";
import { checkWarEnd, endWar, scoreCampaign, startNewWar } from "./wars";
import { diveBriefing, diveMods, generateDives } from "./dives";
import { MARCH_PLACES } from "../art/pixel";

/* ------------------------------------------------------------------ */
/* Fog of war                                                           */
/* ------------------------------------------------------------------ */

function scoutBonus(): number {
  const sc = staffOfficer("scout");
  let b = 0;
  if (sc) b += Math.floor(sc.apt.scouts / 2);
  if (sc && hasTrait(sc, "eagle-eyed")) b += 1;
  return b;
}

function intelKnown(): boolean {
  return !!(getState() as unknown as { _intel?: boolean })._intel;
}

function reportDelay(): number {
  return Math.max(1, randInt(2, 4) - scoutBonus());
}

function reportErrorChance(): number {
  const S = getState();
  // Dispatch Scouts: for three ticks the reports are true
  if (S.war && S.tick < S.war.scoutedUntil) return 0.08;
  let c = 0.3 - scoutBonus() * 0.06;
  if (intelKnown()) c /= 2;
  const d = activeDiveOf();
  if (d) c += diveMods(d).reportError;
  // the rival learns your habits: repeated doctrines get read
  const seen = S.warRecord?.rival.doctrineSeen[S.doctrine] ?? 0;
  if (seen >= 2) c += 0.05;
  return clamp(c, 0.05, 0.5);
}

export function queueReport(text: string, kind: "plain" | "good" | "bad", correct = true): void {
  const S = getState();
  if (!S.war) return;
  S.war.reports.push({
    deliverAt: S.tick + reportDelay(),
    text,
    kind,
    correct,
  });
}

function deliverReports(): void {
  const S = getState();
  if (!S.war) return;
  const due = S.war.reports.filter((r) => r.deliverAt <= S.tick);
  S.war.reports = S.war.reports.filter((r) => r.deliverAt > S.tick);
  for (const r of due) {
    const age = S.tick - (r.deliverAt - reportDelay());
    logAdd(
      "Rider reports (" + Math.max(1, reportDelay()) + " days old): " + r.text,
      r.kind
    );
    if (!r.correct) {
      // the truth surfaces later: fog correcting itself
      S.war.reports.push({
        deliverAt: S.tick + 2,
        text: "Correction to the earlier report: it was wrong. The scouts are certain this time.",
        kind: "plain",
        correct: true,
      });
    }
    void age;
  }
}

function enemyOf(war: { enemyId: string }): EnemyRegiment {
  return getState().enemy.find((e) => e.id === war.enemyId)!;
}

/* ------------------------------------------------------------------ */
/* Launch / tick / speed / skip                                         */
/* ------------------------------------------------------------------ */

/** A dive as the event engine sees it. */
export function diveObjective(d: Dive): Objective {
  return {
    id: d.index,
    name: d.name,
    place: d.place,
    placeId: d.placeId,
    enemyId: d.enemyIds[0],
    why: "",
    weird: "",
    ticks: d.ticks,
    spoils: d.spoils,
    risk: d.risk,
  };
}

export function activeDiveOf(): Dive | null {
  const S = getState();
  if (S.activeDive < 0 || S.activeDive >= S.dives.length) return null;
  return S.dives[S.activeDive];
}

function diveCtx(): CampaignContext {
  const d = activeDiveOf()!;
  return { objective: diveObjective(d), doctrine: d.doctrine, risk: d.risk };
}

/** Which leg of the dive we are on: insertion, objectives, or extraction. */
export function campaignLeg(): "INSERTION" | "OBJECTIVES" | "EXTRACTION" {
  const S = getState();
  if (!S.war) return "OBJECTIVES";
  if (S.war.extraction) return "EXTRACTION";
  if (S.tick <= 1) return "INSERTION";
  return "OBJECTIVES";
}

function campaignNameFor(dives: Dive[]): string {
  return "The " + dives[0].place + " Campaign";
}

/** March to war: the Marshal lays out the campaign plan, dive by dive. */
export function toCampaignSetup(): void {
  const S = getState();
  if (!S.warRecord) startNewWar();
  const seed = "war" + S.warRecord!.campaigns.length + "-c" + S.campaignCount + "-d" + S.day;
  const count = randInt(2, 4);
  S.dives = generateDives(seed, count);
  S.activeDive = -1;
  S.diveResults = [];
  S.campaignName = campaignNameFor(S.dives);
  S.phase = "campaign_setup";
  S.screen = "campaign";
  logAdd(
    "CAMPAIGN PLAN: " + S.campaignName + ", " + count + " dives, rolled from seed \"" + seed + "\". " +
      "Doctrine is chosen per dive. Withdrawal between dives costs 5 war score.",
    "campaign"
  );
  for (const d of S.dives) {
    for (const line of diveBriefing(d)) logAdd(line, "campaign");
    const foes = d.enemyIds
      .map((id) => {
        const e = S.enemy.find((x) => x.id === id);
        return e ? e.name + " under " + e.commander : id;
      })
      .join(" and ");
    logAdd("Enemy: " + foes + ". Spoils if taken: " + d.spoils + ".", "campaign");
  }
  saveGame(true);
  render();
}

/** Launch one dive of the campaign plan. */
export function launchDive(diveIndex: number): void {
  const S = getState();
  const d = S.dives[diveIndex];
  if (!d) return;
  const o = diveObjective(d);
  const mods = diveMods(d);
  const primary = S.enemy.find((e) => e.id === d.enemyIds[0])!;
  const secondary = d.enemyIds[1] ? S.enemy.find((e) => e.id === d.enemyIds[1]) : null;
  S.doctrine = d.doctrine;
  S.phase = "campaign";
  S.screen = "campaign";
  S.activeDive = diveIndex;
  S.tick = 0;
  S.tickTotal = o.ticks;
  S.campaignSpeed = 1;
  S.supply = 80;
  S.convoyIn = randInt(4, 6);
  const nDilemmas = o.ticks >= 15 ? 3 : 2;
  const at: number[] = [];
  for (let i = 1; i <= nDilemmas; i++) {
    at.push(Math.round((o.ticks * i) / (nDilemmas + 1)));
  }
  const place = MARCH_PLACES.find((m) => m.id === o.placeId);
  let strength = primary.strength / 6 + (secondary ? secondary.strength / 8 : 0);
  strength *= mods.enemyMult;
  S.war = {
    objectiveId: o.id,
    enemyId: primary.id,
    enemyStrength: Math.max(120, Math.round(strength * (0.85 + Math.random() * 0.3))),
    enemyPosture: pick(["entrenched", "restless", "overconfident", "hungry"]),
    reports: [],
    dilemmaAt: at,
    dilemmasDone: [],
    momentsDone: [],
    omen: false,
    oddsLogged: false,
    doctrine: d.doctrine,
    weatherId: d.weatherId,
    terrainId: d.terrainId,
    twistId: d.twistId,
    enemyX: place ? place.x : 500,
    enemyY: place ? place.y : 500,
    ordersUsed: { scouts: false, council: false },
    scoutedUntil: 0,
    extraction: null,
    diveIndex,
    seed: "war" + (S.warRecord ? S.warRecord.campaigns.length : 0) + "-c" + S.campaignCount + "-d" + S.day,
    battleResult: null,
  };
  S.campaignCount++;
  logCampaignHeader(o);
  logAdd(
    "DIVE " + (diveIndex + 1) + " OF " + S.dives.length + ": " + d.name + ". " +
      "The regiments march out of Evensbrook on the Old Kings' Road. " +
      "What the riders bring back will be days old, and sometimes wrong. Plan accordingly.",
    "campaign"
  );
  // INSERTION: did the column get in unseen?
  const sc = staffOfficer("scout");
  const insRoll = randInt(1, 20) + (sc ? sc.apt.scouts : 2);
  if (insRoll >= 14) {
    S.war.enemyStrength = Math.round(S.war.enemyStrength * 0.95);
    logAdd(
      "INSERTION: the column came in along the dry gullies, unseen" +
        (sc ? ", " + sc.name.split(" ")[0] + " reading the ground like a letter" : "") +
        ". Their pickets never knew.",
      "battle",
      0,
      "good"
    );
  } else {
    S.war.enemyStrength = Math.round(S.war.enemyStrength * 1.05);
    logAdd("INSERTION: Veskar pickets spotted the dust of the column. They will be ready.", "battle", 0, "bad");
  }
  queueReport(primary.name + " holds " + o.place + " in strength. The count is uncertain.", "plain", true);
  S._painted = S.log.length;
  render();
  S.campaignTimer = window.setInterval(campaignTick, 1000);
}

/** Kept for the test hooks: launches the first dive. */
export function launchCampaign(): void {
  if (getState().dives.length) launchDive(0);
}

export function campaignTick(): void {
  const S = getState();
  if (S.phase !== "campaign" || !S.war) {
    if (S.campaignTimer) clearInterval(S.campaignTimer);
    return;
  }
  // a pending dilemma pauses the war: decide first
  if (S.dilemmas.length) return;
  S.tick++;
  S.day++;
  // EXTRACTION: the return journey, under escalating pressure
  if (S.war.extraction) {
    extractionTick();
    saveGame(true);
    if (!S.dilemmas.length) updateCampaignView();
    return;
  }
  const ctx = diveCtx();
  const o = ctx.objective;
  const dive = activeDiveOf()!;
  const mods = diveMods(dive);

  // supply: the quiet killer
  S.supply = clamp(S.supply - randInt(4, 7) - mods.supplyDrain, 0, 100);
  S.convoyIn--;
  if (S.convoyIn <= 0) {
    S.supply = clamp(S.supply + 40, 0, 100);
    S.convoyIn = randInt(4, 6);
    logAdd(
      "The supply convoy reaches camp: grain, powder, boots. +" + 40 + " supply. The quartermaster weeps, briefly.",
      "good"
    );
  }
  if (S.supply < 25) {
    for (const r of S.regiments) r.morale = clamp(r.morale - 2, 0, 100);
    if (!S._warned) {
      S._warned = true;
      logAdd("Supply is running thin. The men are counting biscuit crumbs. This cannot go on.", "bad");
    }
  } else {
    S._warned = false;
  }

  deliverReports();
  quirkMoments(ctx);

  // scheduled dilemmas
  if (S.war.dilemmaAt.includes(S.tick)) {
    fireDilemma(ctx);
    updateCampaignView();
    return;
  }

  // the pre-battle assessment: visible odds, named stakes
  if (S.tick === S.tickTotal - 2 && !S.war.oddsLogged) {
    S.war.oddsLogged = true;
    logOdds(ctx);
  }

  const riskMult = { skirmish: 0.8, battle: 1.0, gamble: 1.25 }[o.risk];
  const docMult = { cautious: 0.7, balanced: 1.0, bold: 1.35 }[S.doctrine] ?? 1;
  const eventChance = clamp(0.42 * riskMult * docMult, 0.15, 0.75);
  if (chance(eventChance)) runCampaignEvent(ctx);
  else logAdd(quietLine(), "plain");

  // surgeons tend the worst hurt each day
  const surg = staffOfficer("surgeon");
  if (surg) {
    let worst: Officer | null = null;
    for (const m of aliveOfficers()) {
      if (m.health < 100 && (!worst || m.health < worst.health)) worst = m;
    }
    if (worst) {
      const amt = (2 + surg.apt.surgery) * (upgradeOwned("infirmary") ? 2 : 1) + (S.supply < 25 ? -1 : 0);
      worst.health = clamp(worst.health + Math.max(1, amt), 0, 100);
    }
  }

  updateCampaignView();
  if (S.tick >= S.tickTotal) resolveBattle(ctx);
}

/* Orders: one verb per campaign, each usable once, each with a price. */
export function orderScouts(): void {
  const S = getState();
  if (!S.war || S.phase !== "campaign" || S.dilemmas.length) return;
  if (S.war.ordersUsed.scouts || S.supply < 12) return;
  S.supply -= 12;
  S.war.ordersUsed.scouts = true;
  S.war.scoutedUntil = S.tick + 3;
  logAdd("Riders out under sealed orders. For three days the reports will be true.", "supply", S.tick);
  saveGame(true);
  render();
}

export function orderCouncil(): void {
  const S = getState();
  if (!S.war || S.phase !== "campaign" || S.dilemmas.length) return;
  if (S.war.ordersUsed.council || S.supply < 8) return;
  S.supply -= 8;
  S.war.ordersUsed.council = true;
  for (const r of S.regiments) r.morale = clamp(r.morale + 6, 0, 100);
  for (const o of aliveOfficers()) o.morale = clamp(o.morale + 6, 0, 100);
  logAdd(
    "The general calls the officers to the fire. No speeches, just the plan said plainly. The army stands a little straighter.",
    "officer",
    S.tick
  );
  saveGame(true);
  render();
}

export function toggleSpeed(): void {
  const S = getState();
  S.campaignSpeed = S.campaignSpeed === 1 ? 4 : 1;
  if (S.campaignTimer) clearInterval(S.campaignTimer);
  S.campaignTimer = window.setInterval(campaignTick, 1000 / S.campaignSpeed);
  updateCampaignView();
}

export function skipCampaign(): void {
  const S = getState();
  if (S.campaignTimer) clearInterval(S.campaignTimer);
  let guard = 0;
  while (getState().phase === "campaign" && guard < 500) {
    // auto-resolve dilemmas on skip: the Marshal decides, conservatively
    if (getState().dilemmas.length) dilemmaChoice(0, 1);
    campaignTick();
    guard++;
  }
  render();
}

/* ------------------------------------------------------------------ */
/* Visible odds: the anti-random-text-generator rule                     */
/* ------------------------------------------------------------------ */

export function ourPower(): number {
  const S = getState();
  const docMult = ({ cautious: 0.85, balanced: 1.0, bold: 1.25 } as Record<string, number>)[S.doctrine] ?? 1;
  const supplyF = S.supply > 50 ? 1 : 0.6 + S.supply / 125;
  let p = 0;
  for (const r of S.regiments) {
    let share = r.strength * (0.5 + r.morale / 200) * (1 + r.xp / 50) * supplyF;
    if (r.id === "wolves" && upgradeOwned("stables")) share *= 1.1;
    if (upgradeOwned("veteran-cadre")) share *= 1.05;
    p += share;
  }
  return p * docMult;
}

function reportedEnemyStrength(): number {
  const S = getState();
  if (!S.war) return 0;
  const err = chance(reportErrorChance());
  const true_ = S.war.enemyStrength;
  if (err) return Math.round(true_ * (0.6 + Math.random() * 0.8));
  return Math.round(true_ * (0.9 + Math.random() * 0.2));
}

function logOdds(ctx: CampaignContext): void {
  const S = getState();
  const enemy = enemyOf(S.war!);
  const ours = Math.round(ourPower());
  const theirs = reportedEnemyStrength();
  const ratio = ours / Math.max(1, theirs);
  const assessment =
    ratio > 1.3 ? "in our favor" : ratio > 0.8 ? "roughly even" : "against us";
  const cmd = regimentCommander("pike");
  logAdd(
    "The Marshal's assessment, two days from " + ctx.objective.place + ": " +
      "our three regiments field about " + ours + " effective spears. " +
      enemy.name + " is reported at " + theirs + " (rider's count, days old, " +
      S.war!.enemyPosture + "). Odds: " + assessment + ". " +
      (cmd ? cmd.name + " has read it twice. " : "") +
      "There is still time to be afraid. Use it.",
    "campaign"
  );
}

/* ------------------------------------------------------------------ */
/* Dilemmas: real choices, no clean answers                             */
/* ------------------------------------------------------------------ */

const DILEMMA_DEFS: Record<string, (ctx: CampaignContext) => Dilemma> = {
  millford_plea: () => ({
    id: "millford_plea",
    title: "The Millford Plea",
    text:
      "An elder of Millford rides into camp at dusk, half dead from the ride. " +
      "Veskar scouts have been seen on the mill road. He begs for a company of spears. " +
      "Your objective needs every spear you have. Millford has old people and a miller who rebuilt twice.",
    choices: [
      "Detach a company (40 pike for the rest of the campaign)",
      "Refuse (the objective needs every spear)",
    ],
  }),
  parley: () => {
    const S = getState();
    const enemy = enemyOf(S.war!);
    return {
      id: "parley",
      title: "The White Cloth",
      text:
        enemy.commander + " of " + enemy.name + " sends a rider under a white cloth. " +
        "Parley, at noon, between the lines. It could be a trap. It could be the first honest " +
        "conversation of this war. Your officers are split down the middle, which tells you nothing.",
      choices: ["Meet under truce", "Refuse the parley"],
    };
  },
  convoy_ambush: () => ({
    id: "convoy_ambush",
    title: "Ambush on the Old Kings' Road",
    text:
      "Word comes up the road: the supply convoy is ambushed two miles back, fighting in a ditch. " +
      "Turn the column around and the convoy lives, but the enemy gains two days to dig in. " +
      "Press on and the objective stays in reach, but the wagons burn.",
    choices: [
      "Turn back to save the convoy (lose 2 days)",
      "Press on (the objective first)",
    ],
  }),
  saltfield_rite: () => ({
    id: "saltfield_rite",
    title: "The Drowned of Saltfield",
    text:
      "The salt-workers will not touch the pans. The drowned, they say, keep the pans clean, " +
      "and the drowned must be honored before strangers work their salt. Honor them and lose a day. " +
      "Force the pans and the workers walk, taking their knowledge of the ground with them.",
    choices: [
      "Hold the rite for the drowned (lose a day, gain local guides)",
      "Force the pans (duty first)",
    ],
  }),
  deserter: () => {
    const S = getState();
    const low = S.regiments.slice().sort((a, b) => a.morale - b.morale)[0];
    return {
      id: "deserter",
      title: "The Deserter",
      text:
        "The watch catches a deserter from " + (low ? low.name : "the ranks") +
        " trying to slip home to Evensbrook. He is nineteen. He cries. The regiment wants mercy. " +
        "The Marshal's code wants the lash. Whatever you choose, the whole camp will hear about it by supper.",
      choices: ["Mercy (the lash stays sheathed)", "The lash, by the code"],
    };
  },
  extraction_wounded: () => {
    const S = getState();
    const hurt = S.regiments.reduce((a, r) => a + (r.maxStrength - r.strength), 0);
    return {
      id: "extraction_wounded",
      title: "The Wounded Slow the Column",
      text:
        "The road home is three days and the wagons carry " + hurt + " empty places where soldiers walked. " +
        "The surgeons say a dozen will not survive a forced march. Carry them, whatever it costs in grain and time, " +
        "or leave the worst cases with the surgeons and a guard, and march for home.",
      choices: [
        "Carry them, whatever it costs (supply, but the army comes home whole)",
        "Leave the worst cases and march (faster, and the men will remember)",
      ],
    };
  },
};

function dilemmaPool(ctx: CampaignContext): string[] {
  const S = getState();
  const pool = ["parley", "convoy_ambush", "deserter"];
  if (ctx.objective.placeId === "saltfield") pool.push("saltfield_rite");
  else pool.push("millford_plea");
  return pool.filter((id) => !S.war!.dilemmasDone.includes(id));
}

function fireDilemma(ctx: CampaignContext): void {
  const S = getState();
  if (S.campaignTimer) {
    clearInterval(S.campaignTimer);
    S.campaignTimer = null;
  }
  const pool = dilemmaPool(ctx);
  if (!pool.length) return;
  const id = pick(pool);
  S.war!.dilemmasDone.push(id);
  S.dilemmas.push(DILEMMA_DEFS[id](ctx));
  logAdd("A decision cannot wait. The war pauses while you choose.", "campaign");
  saveGame(true);
  render();
}

/** Fire one specific dilemma by id (used for the extraction dilemma). */
function fireDilemmaById(id: string, ctx: CampaignContext): void {
  const S = getState();
  if (S.campaignTimer) {
    clearInterval(S.campaignTimer);
    S.campaignTimer = null;
  }
  if (!DILEMMA_DEFS[id]) return;
  S.dilemmas.push(DILEMMA_DEFS[id](ctx));
  logAdd("A decision cannot wait. The war pauses while you choose.", "campaign");
  saveGame(true);
  render();
}

export function dilemmaChoice(idx: number, choice: number): void {
  const S = getState();
  const d = S.dilemmas[idx];
  if (!d || !S.war) return;
  const enemy = enemyOf(S.war);
  const pike = S.regiments.find((r) => r.id === "pike")!;
  const qm = staffOfficer("quartermaster");
  switch (d.id) {
    case "millford_plea":
      if (choice === 0) {
        pike.strength = Math.max(20, pike.strength - 40);
        logAdd(
          "Forty pike march for Millford under a sergeant's command. They will not be back for this campaign. " +
            "The elder weeps into his hands. Millford will remember this, and so will the muster rolls.",
          "good"
        );
        S.gossip.unshift({
          kind: "town",
          text: "Millford stands because forty pike stood in front of it. The miller charges the regiments half price for flour, forever.",
        });
      } else if (chance(0.5)) {
        for (const r of S.regiments) r.morale = clamp(r.morale - 8, 0, 100);
        logAdd(
          "Millford burns. The smoke is visible from the camp. The men drill in silence for two days. " +
            "Every spear was needed, and everyone knows what it cost.",
          "bad"
        );
        S.gossip.unshift({
          kind: "town",
          text: "Millford burned while the army marched past. The miller sifts ash where his mills stood. He does not speak of it.",
        });
      } else {
        logAdd(
          "The Veskar scouts never came to Millford after all. The elder's terror was real and the danger was not. " +
            "The men are relieved, and a little ashamed of the relief.",
          "plain"
        );
      }
      break;
    case "parley":
      if (choice === 0 && chance(0.5)) {
        const r = pick(S.regiments);
        const loss = randInt(10, 20);
        r.strength = Math.max(10, r.strength - loss);
        const cmd = regimentCommander(r.id);
        if (cmd && chance(0.5)) wound(cmd, randInt(10, 25), "Cut down in the treachery at the parley ground.");
        logAdd(
          "It was a trap. " + enemy.commander + "'s white cloth covered a killing plan. " +
            r.name + " loses " + loss + " buying the retreat. " +
            "The men will not speak of parleys again for a long time.",
          "bad"
        );
      } else if (choice === 0) {
        S.war.reports = [];
        queueReport(
          enemy.name + "'s true strength is " + S.war.enemyStrength + ". " +
            enemy.commander + " spoke plainly, soldier to soldier, and the count is certain.",
          "good",
          true
        );
        logAdd(
          "The parley was genuine. " + enemy.commander + " talked of the war like a farmer talks of weather: " +
            "something to be endured. You leave knowing their true strength, and liking them slightly, which is worse.",
          "good"
        );
      } else {
        for (const o of aliveOfficers()) o.morale = clamp(o.morale - 2, 0, 100);
        logAdd(
          "The white cloth is turned away. Safe, and correct, and the men spend the evening wondering what " +
            enemy.commander + " wanted to say. Some doors, once closed, stay closed.",
          "plain"
        );
      }
      break;
    case "convoy_ambush":
      if (choice === 0) {
        S.tickTotal += 2;
        S.supply = clamp(S.supply + 20, 0, 100);
        S.war.enemyStrength = Math.round(S.war.enemyStrength * 1.05);
        logAdd(
          "The column turns back and saves the convoy: grain, powder, boots, and six drivers who will tell this story forever. " +
            "Cost: two days. The enemy used them to dig in deeper.",
          "good"
        );
      } else {
        S.supply = clamp(S.supply - 30, 0, 100);
        logAdd(
          "The column presses on. Behind it, the wagons burn. The quartermaster" +
            (qm ? " " + qm.name : "") + " does the arithmetic in silence: thirty supply, gone. " +
            "The objective is closer. So is hunger.",
          "bad"
        );
        moraleShift(qm, -6, "watched the wagons burn");
      }
      break;
    case "saltfield_rite":
      if (choice === 0) {
        S.tickTotal += 1;
        S.war.enemyStrength = Math.round(S.war.enemyStrength * 0.95);
        logAdd(
          "The rite is held at the pans at dusk. The salt-workers weep and then work, showing your gunners " +
            "every ditch and causeway. Local guides are worth more than a day.",
          "good"
        );
      } else {
        for (const r of S.regiments) {
          if (r.id === "pike" || r.id === "gunners") {
            r.morale = clamp(r.morale - 6, 0, 100);
            r.strength = Math.max(10, r.strength - 10);
          }
        }
        logAdd(
          "The pans are forced. The salt-workers walk, all of them, taking their knowledge with them. " +
            "Ten men from each regiment slip away in the night to follow their kin. Duty was done. It tasted of ash.",
          "bad"
        );
      }
      break;
    case "deserter":
      if (choice === 0) {
        for (const r of S.regiments) r.morale = clamp(r.morale + 4, 0, 100);
        logAdd(
          "Mercy. The boy is put back in the ranks and the camp breathes out. " +
            "The Marshal notes, privately, that mercy is a coin you can only spend so many times.",
          "good"
        );
      } else {
        for (const r of S.regiments) r.morale = clamp(r.morale - 4, 0, 100);
        logAdd(
          "The lash, by the code. The camp watches because it must. Discipline holds. " +
            "Something else, thinner and harder to name, does not.",
          "bad"
        );
      }
      break;
    case "extraction_wounded": {
      if (choice === 0) {
        S.supply = Math.max(0, S.supply - 12);
        for (const r of S.regiments) r.morale = clamp(r.morale + 4, 0, 100);
        for (const o of aliveOfficers()) {
          if (o.alive) addMemory(o, "Carried the wounded home from " + diveCtx().objective.place + ".");
        }
        logAdd(
          "The column slows to the wagons' pace. Grain goes to the wounded first, and nobody argues. " +
            "It costs twelve supply and three days of fear, and the army comes home looking like an army.",
          "officer",
          S.tick,
          "good"
        );
      } else {
        for (const r of S.regiments) r.morale = clamp(r.morale - 6, 0, 100);
        const rg = pick(S.regiments);
        const loss = Math.min(rg.strength - 10, randInt(8, 16));
        rg.strength -= loss;
        logAdd(
          "The worst cases stay with the surgeons and a rear guard. The column marches. " + loss + " of " +
            rg.name + " buy the miles with their lives, and the men will remember who ordered the march.",
          "officer",
          S.tick,
          "bad"
        );
      }
      break;
    }
    default:
      break;
  }
  S.dilemmas.splice(idx, 1);
  saveGame(true);
  // resume the war
  if (S.phase === "campaign") {
    S.campaignTimer = window.setInterval(campaignTick, 1000 / S.campaignSpeed);
  }
  render();
}

/* ------------------------------------------------------------------ */
/* Quirk moments: personalities colliding with circumstance              */
/* ------------------------------------------------------------------ */

function moment(id: string): boolean {
  const S = getState();
  if (!S.war || S.war.momentsDone.includes(id)) return false;
  S.war.momentsDone.push(id);
  return true;
}

function quirkMoments(ctx: CampaignContext): void {
  const S = getState();
  if (!S.war) return;
  // crows gather: the omen
  if (!S.war.omen && chance(0.12)) {
    S.war.omen = true;
    logAdd(pick(OMEN_LINES), "plain");
    const keeper = aliveOfficers().find((o) => hasQuirk(o, QUIRK_IDS.crow));
    if (keeper && moment("crow_omen")) {
      const r = S.regiments.find((x) => x.id === keeper.regiment);
      logAdd(
        keeper.name + " looks up and grins: Pick has called his cousins. " +
          (r ? "The men of " + r.name + " take it as a blessing. " : "") +
        "The old soldiers touch their hilts and say nothing, which is its own kind of agreement.",
        "good"
      );
      if (r) r.morale = clamp(r.morale + 6, 0, 100);
    }
  }
  // salt-born quartermaster finds the old cache near Saltfield
  const qm = staffOfficer("quartermaster");
  if (
    qm && hasQuirk(qm, QUIRK_IDS.saltborn) &&
    ctx.objective.placeId === "saltfield" && moment("salt_cache")
  ) {
    S.supply = clamp(S.supply + 25, 0, 100);
    logAdd(
      qm.name + " was a Saltfield salt-worker and knows the pans blindfolded. " +
        "Behind a collapsed drying shed: the old workers' cache, salt pork and dry powder, untouched since the burning. " +
        "+25 supply. " + qm.name.split(" ")[0] + " will not say how they knew. They knew.",
      "good"
    );
  }
  // afraid of horses, commands cavalry anyway
  const wolfCmd = regimentCommander("wolves");
  if (wolfCmd && hasQuirk(wolfCmd, QUIRK_IDS.horsefear) && moment("horsefear")) {
    const r = S.regiments.find((x) => x.id === "wolves")!;
    r.morale = clamp(r.morale - 2, 0, 100);
    for (const x of S.regiments) if (x.id !== "wolves") x.morale = clamp(x.morale + 2, 0, 100);
    logAdd(
      wolfCmd.name + " is afraid of horses and commands cavalry anyway. " +
        "The Wolves lost two points of swagger watching their commander mount like a man defusing a bomb. " +
        "The other regiments love them for it. Courage is not the absence of fear; the men have the quote now.",
      "plain"
    );
  }
  // the lament before battle at Crowfield
  const lamenter = aliveOfficers().find((o) => hasQuirk(o, QUIRK_IDS.lament));
  if (
    lamenter && ctx.objective.placeId === "crowfield" &&
    S.tick >= S.tickTotal - 4 && moment("lament_crowfield")
  ) {
    for (const r of S.regiments) r.morale = clamp(r.morale + 3, 0, 100);
    logAdd(
      lamenter.name + " whistles the Crowfield lament, here, where the old king died. " +
        "The whole column goes quiet. Then the drums start. Morale steadies like a held breath.",
      "good"
    );
  }
}

/* ------------------------------------------------------------------ */
/* Quiet ticks: never a dead tick. Every quiet day names someone.        */
/* ------------------------------------------------------------------ */

const QUIET: Array<() => string> = [
  () => { const m = randomOfficer()!; return m.name + " mends a pike shaft by the fire, testing the flex the way a musician tests a string."; },
  () => { const m = randomOfficer()!; return "Rain on canvas. " + m.name + " teaches the new levies the words to the Crowfield lament. Half of them already know it."; },
  () => { const m = randomOfficer()!; return m.name + " walks the picket line twice. The second round is just for comfort."; },
  () => { const m = randomOfficer()!; return "The cook serves something grey. " + m.name + " eats it without complaint and earns quiet respect."; },
  () => { const m = randomOfficer()!; return m.name + " tells the story of Crowfield, the real one, with the king's last order. The young ones listen like it is scripture."; },
  () => { const m = randomOfficer()!; return "A letter from Evensbrook. " + m.name + " reads it three times, then gets back to work."; },
  () => { const m = randomOfficer()!; return m.name + " reorganizes the baggage train by a system only they understand. Marching order improves anyway."; },
  () => { const m = randomOfficer()!; return "Cold dawn. " + m.name + " is already up, checking every horse's shoes in the Wolves' lines."; },
  () => { const m = randomOfficer()!; return m.name + " and a Grey Sister's abandoned totem, found on the trail. They leave it standing. Some things you do not touch."; },
  () => { const m = randomOfficer()!; return "Night watch. " + m.name + " counts the campfires and finds them all where they should be, which is its own small victory."; },
  () => { const m = randomOfficer()!; return m.name + " sharpens a sword that is already sharp. The whetstone sings."; },
  () => { const m = randomOfficer()!; return "The column passes an old king's milestone, worn smooth by a hundred years of hands. " + m.name + " touches it without breaking stride."; },
];

export function quietLine(): string {
  return pick(QUIET)();
}

/* ------------------------------------------------------------------ */
/* Campaign events                                                       */
/* ------------------------------------------------------------------ */

function loseStrength(regId: string, amount: number, cause: string): void {
  const S = getState();
  const r = S.regiments.find((x) => x.id === regId)!;
  const loss = Math.min(r.strength - 10, upgradeOwned("master-smith") ? Math.round(amount * 0.8) : amount);
  r.strength -= Math.max(0, loss);
  r.morale = clamp(r.morale - 3, 0, 100);
  if (loss > 0) {
    const cmd = regimentCommander(regId);
    if (cmd && chance(0.35)) wound(cmd, randInt(6, 18), cause);
  }
}

export function runCampaignEvent(ctx: CampaignContext): void {
  const bag: Array<[number, CampaignEvent]> = [];
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

const EVENTS: CampaignEvent[] = [
  {
    id: "skirmish",
    w: (c) => ({ skirmish: 4, battle: 3, gamble: 3 })[c.risk],
    run() {
      const S = getState();
      const enemy = enemyOf(S.war!);
      const cmd = regimentCommander("pike");
      const bonus =
        (cmd && hasTrait(cmd, "brave") ? 2 : 0) +
        (S.doctrine === "bold" ? 2 : 0) -
        (S.supply < 25 ? 2 : 0);
      const roll = skillCheck(cmd, ["infantry"], bonus);
      const need = 12;
      const ename = cmd ? cmd.name : "the vanguard";
      if (roll >= need) {
        const dmg = randInt(15, 30);
        S.war!.enemyStrength = Math.max(20, S.war!.enemyStrength - dmg);
        const r = S.regiments.find((x) => x.id === "pike")!;
        r.xp += 1;
        logAdd(
          "Vanguard clash at " + pick(["a stream crossing", "a burnt farmstead", "the edge of a pine wood"]) + ". " +
            ename + " reads the ground (check " + roll + " vs " + need + ") and rolls up the enemy flank. " +
            enemy.name + " loses about " + dmg + ". Ours: a few bruises and a story.",
          "good"
        );
        moraleShift(cmd, 4, "won the vanguard clash");
      } else {
        const loss = randInt(8, 18);
        loseStrength("pike", loss, "Cut down in the vanguard clash.");
        logAdd(
          "Vanguard clash goes wrong (check " + roll + " vs " + need + "). " +
            enemy.name + " was waiting in the treeline. The Eelbrook Pike gives " + loss +
            " and falls back in good order. " + ename + " takes it personally.",
          "bad"
        );
      }
    },
  },
  {
    id: "scouting",
    w: () => 3,
    run() {
      const S = getState();
      const enemy = enemyOf(S.war!);
      const sc = staffOfficer("scout");
      const roll = skillCheck(sc, ["scouts"], hasTrait(sc, "eagle-eyed") ? 2 : 0);
      const sname = sc ? sc.name : "the scouts";
      if (roll >= 12) {
        queueReport(
          enemy.name + " numbers near " + S.war!.enemyStrength + ", " + S.war!.enemyPosture + ". " +
            sname + " counted banners twice to be sure.",
          "good",
          true
        );
        logAdd(sname + " slips through the enemy pickets and back (check " + roll + " vs 12). A good report is coming up the road.", "good");
      } else {
        const wrong = Math.round(S.war!.enemyStrength * (0.5 + Math.random() * 1.2));
        queueReport(enemy.name + " numbers near " + wrong + ". " + sname + " is guessing; the fog was thick.", "plain", false);
        logAdd(sname + " comes back with half a count and both boots full of mud (check " + roll + " vs 12). The report will be late and doubtful.", "plain");
      }
    },
  },
  {
    id: "camp_fever",
    w: () => 2,
    run() {
      const S = getState();
      const surg = staffOfficer("surgeon");
      const roll = skillCheck(surg, ["surgery"], S.supply < 25 ? -2 : 0);
      const sname = surg ? surg.name : "the surgeon";
      if (roll >= 12) {
        logAdd(sname + " catches the camp fever early: boiled water, separated blankets, no nonsense (check " + roll + " vs 12). Three men sick, none dying.", "good");
      } else {
        const r = pick(S.regiments);
        const loss = randInt(5, 12);
        r.strength = Math.max(10, r.strength - loss);
        logAdd("Camp fever in " + r.name + " (check " + roll + " vs 12). " + sname + " works through the nights. " + loss + " too weak to march.", "bad");
      }
    },
  },
  {
    id: "desertion",
    w: () => 1.5,
    run() {
      const S = getState();
      const low = S.regiments.slice().sort((a, b) => a.morale - b.morale)[0];
      if (!low || low.morale > 40) {
        logAdd(quietLine(), "plain");
        return;
      }
      const loss = randInt(4, 10);
      low.strength = Math.max(10, low.strength - loss);
      logAdd(loss + " men slip away from " + low.name + " in the night, home to Evensbrook. Morale is at " + low.morale + "; the Marshal does not order a pursuit. You cannot whip men into wanting to stay.", "bad");
    },
  },
  {
    id: "night_alarm",
    w: () => 2,
    run() {
      const S = getState();
      const enemy = enemyOf(S.war!);
      if (chance(0.4)) {
        const loss = randInt(5, 12);
        loseStrength(pick(["pike", "wolves", "gunners"]), loss, "Killed in the night probe.");
        logAdd("A real probe at midnight: " + enemy.name + " tests the pickets and melts back. " + loss + " dead in the dark. The camp does not sleep again that night.", "bad");
      } else {
        for (const r of S.regiments) r.morale = clamp(r.morale - 2, 0, 100);
        logAdd("False alarm at the third watch: a deer, a snapping branch, and two hundred men standing to arms in their smallclothes. Nobody admits to laughing. Everyone is tired.", "plain");
      }
    },
  },
  {
    id: "hero_moment",
    w: () => 2,
    run() {
      const m = randomOfficer();
      if (!m) return;
      const feats = [
        m.name + " spots the weak plank in the ford before anyone's boots find it. The column crosses dry. The Marshal notes it twice.",
        m.name + " holds a collapsing gun team together with voice alone when a wheel shatters on the march. Their throat bleeds; the guns roll on.",
        m.name + " talks a panicking levy company back into line after a false rout cry, standing in front of them, unarmed, furious.",
        m.name + " finds water where the guides swore there was none, reading the hills " + quirkText(m.quirk) + ". The column drinks.",
      ];
      logAdd(pick(feats), "good");
      moraleShift(m, 6, "named in the diary");
      addMemory(m, "Held the line when it mattered, on the march to " + diveCtx().objective.place + ".");
    },
  },
  {
    id: "quarrel",
    w: () => 2,
    run() {
      const pool = shuffle(aliveOfficers());
      if (pool.length < 2) return;
      const a = pool[0];
      const b = pool[1];
      const peacemaker = aliveOfficers().find((m) => m !== a && m !== b && hasTrait(m, "charming"));
      if (peacemaker && chance(0.6)) {
        logAdd(a.name + " and " + b.name + " nearly come to blows over the watch rota. " + peacemaker.name + " talks them down and buys the wine. The camp settles.", "good");
        moraleShift(peacemaker, 3, "kept the peace");
      } else {
        logAdd(a.name + " and " + b.name + " have a screaming row in front of the men. Doors close. The Marshal logs it and assigns them opposite ends of the column.", "bad");
        a.morale = clamp(a.morale - 6, 0, 100);
        b.morale = clamp(b.morale - 6, 0, 100);
      }
    },
  },
  {
    id: "foragers",
    w: () => 2,
    run() {
      const S = getState();
      const qm = staffOfficer("quartermaster");
      const roll = skillCheck(qm, ["supply"], hasTrait(qm, "methodical") ? 2 : 0);
      if (roll >= 11) {
        const gain = randInt(8, 16);
        S.supply = clamp(S.supply + gain, 0, 100);
        logAdd((qm ? qm.name : "The foragers") + " work the countryside properly (check " + roll + " vs 11): grain, eggs, a farmer's goodwill. +" + gain + " supply.", "good");
      } else {
        logAdd("The foraging party finds thin pickings and one very angry beekeeper (check " + roll + " vs 11). The men itch for days. The beekeeper is unrepentant.", "plain");
      }
    },
  },
  {
    id: "old_battlefield",
    w: (ctx) => (ctx.objective.placeId === "crowfield" ? 4 : 1.2),
    run() {
      const S = getState();
      const m = randomOfficer();
      if (!m) return;
      logAdd(
        "The column crosses old Crowfield, where King Aldric died a hundred years ago. " +
          (m ? m.name + " picks up a rusted arrowhead and puts it down again. " : "") +
        "Nobody talks until the ground is behind them. Then everyone talks at once.",
        "plain"
      );
      for (const r of S.regiments) r.morale = clamp(r.morale + 2, 0, 100);
      if (m) addMemory(m, "Walked old Crowfield and felt the weight of it.");
    },
  },
  {
    id: "totem",
    w: (ctx) => (ctx.objective.enemyId === "dumak" ? 3 : 1),
    run() {
      const S = getState();
      const enemy = enemyOf(S.war!);
      logAdd(
        "The scouts find a carved horse-totem where " + enemy.name + " camped: fresh chips, still smelling of pine. " +
          "They were here yesterday. They are never here today. Dumak's old habit, and old habits are intelligence.",
        "plain"
      );
      queueReport("Fresh horse-totems found. " + enemy.name + " is close, moving, never twice in the same camp.", "plain", true);
    },
  },
];

/* ------------------------------------------------------------------ */
/* The final engagement: visible odds, named costs                       */
/* ------------------------------------------------------------------ */

function fallenName(): string {
  const first = pick(["Tam", "Kessa", "Borin", "Halla", "Joren", "Petra", "Silas", "Mira", "Dain", "Odric", "Sarella", "Fen"]);
  const last = pick(["Eelbrook", "of Graywater", "Millford", "Ashen", "Saltfield", "Crowfield", "Thal", "Vess", "Marsh"]);
  return first + " " + last;
}

function fallenLine(): string {
  return pick([
    "owed three years' pay to the Millford miller; the regiment will pay it",
    "whistled the lament the whole march, and died singing",
    "was nineteen, and brave past all sense",
    "carried the standard when the bearer fell, and did not put it down",
    "had a sweetheart in Graywater who will hear it from the Marshal himself",
    "joked at breakfast; the joke is now regimental scripture",
    "saved two levies at the ford before the arrow found them",
    "never missed a drill in four years",
  ]);
}

export function resolveBattle(ctx: CampaignContext): void {
  const S = getState();
  if (S.campaignTimer) {
    clearInterval(S.campaignTimer);
    S.campaignTimer = null;
  }
  if (S.phase !== "campaign" || !S.war) return;
  const enemy = enemyOf(S.war);
  const ours = ourPower();
  const theirs = S.war.enemyStrength * (0.9 + Math.random() * 0.2);
  const cmd = regimentCommander("pike") || regimentCommander("wolves") || regimentCommander("gunners");
  const cmdBonus = cmd ? Math.floor((cmd.apt.infantry + cmd.apt.cavalry + cmd.apt.artillery) / 3) : 0;
  const roll = randInt(1, 20) + Math.round(ours / 60) + cmdBonus;
  const need = 10 + Math.round(theirs / 60);
  const dive = activeDiveOf();
  const mods = dive ? diveMods(dive) : { battle: 0, supplyDrain: 0, reportError: 0, enemyMult: 1 };
  const tradBonus = S.regiments.reduce((a, r) => a + r.traditions.length * 2, 0);
  const margin = roll - need + mods.battle + tradBonus;

  let summary: string;
  if (margin >= 5) {
    summary = "A clean victory. " + enemy.name + " breaks and runs.";
  } else if (margin >= 0) {
    summary = "Victory, at a price the diary will list by name.";
  } else if (margin >= -5) {
    summary = "A defeat, but the regiments come off the field in order. The objective slips away; the army does not.";
  } else {
    summary = "A hard defeat. The field belongs to " + enemy.name + ".";
  }
  // elastic failure: cautious doctrine never shatters a regiment
  const lossMult = ({ cautious: 0.6, balanced: 1.0, bold: 1.5 } as Record<string, number>)[S.doctrine] ?? 1;
  const won = margin >= 0;
  const baseLoss = won ? randInt(8, 18) : randInt(20, 40);
  const dead: { name: string; regiment: string; line: string }[] = [];
  const wounded: string[] = [];
  for (const r of S.regiments) {
    const share = r.strength / Math.max(1, S.regiments.reduce((a, x) => a + x.strength, 0));
    let loss = Math.round(baseLoss * share * 3 * lossMult);
    loss = Math.min(loss, r.strength - 10);
    if (loss > 0) {
      r.strength -= loss;
      for (let i = 0; i < loss; i++) {
        dead.push({ name: fallenName(), regiment: r.name, line: fallenLine() });
      }
      r.morale = clamp(r.morale + (won ? 6 : -10), 0, 100);
      r.xp += won ? 3 : 1;
      const rc = regimentCommander(r.id);
      if (rc) {
        if (chance(won ? 0.2 : 0.45)) wound(rc, randInt(10, 30), "In the final engagement at " + ctx.objective.place + ".");
        else if (rc.alive) wounded.push(rc.name + " (" + r.name + ") walks off the field under their own power.");
        if (rc.alive && won) addMemory(rc, "Won the field at " + ctx.objective.place + ".");
      }
    }
  }
  // the enemy bleeds too, and remembers
  const enemyLoss = Math.round(S.war!.enemyStrength * (won ? randInt(35, 50) / 100 : randInt(10, 20) / 100));
  enemy.strength = Math.max(30, enemy.strength - enemyLoss * 2);
  logAdd(
    "THE FINAL ENGAGEMENT at " + ctx.objective.place + ": " +
      (cmd ? cmd.name + " commits the regiments " : "the regiments are committed ") +
      "(roll " + roll + " vs " + need + "). " + summary +
      " Our dead: " + dead.length + ". Theirs: about " + enemyLoss + ".",
    "battle",
    S.tick,
    won ? "good" : "bad"
  );
  if (won) S.stats.victories++;
  else S.stats.defeats++;
  const spoils = won ? ctx.objective.spoils : Math.round(ctx.objective.spoils * 0.25);
  S.spoils += spoils;
  // the result rides through extraction to the debrief
  S.war.battleResult = { won, margin, summary, dead, wounded, enemyLoss, spoils };
  // EXTRACTION begins: the return journey, under escalating pressure.
  // This is the tensest part of the dive, not an afterthought.
  S.war.extraction = { ticksLeft: 3, pressure: 1 + S.war.diveIndex, dilemmaFired: false };
  logAdd(
    "EXTRACTION. The objective is " + (won ? "taken" : "lost") + "; now the column has to get home. " +
      "This is the part the songs skip: three days of road with " + enemy.name + " behind it.",
    "campaign",
    S.tick
  );
  S._painted = S.log.length;
  saveGame(true);
  updateCampaignView();
}

/** The extraction leg: pursuit, the wounded, rising pressure. */
function extractionTick(): void {
  const S = getState();
  const war = S.war!;
  const ex = war.extraction!;
  const ctx = diveCtx();
  const enemy = enemyOf(war);
  // the extraction dilemma fires once, on the first extraction tick
  if (!ex.dilemmaFired) {
    ex.dilemmaFired = true;
    fireDilemmaById("extraction_wounded", ctx);
    updateCampaignView();
    return;
  }
  const dayNo = 4 - ex.ticksLeft;
  ex.pressure = 1 + war.diveIndex + (3 - ex.ticksLeft);
  // pursuit: the enemy harries the column, harder each day
  const reg = pick(S.regiments);
  const loss = Math.min(reg.strength - 10, randInt(3, 7) * ex.pressure);
  if (loss > 0) {
    reg.strength -= loss;
    const br = war.battleResult!;
    for (let i = 0; i < loss; i++) {
      br.dead.push({ name: fallenName(), regiment: reg.name, line: fallenLine() + ", on the road home" });
    }
    logAdd(
      "PURSUIT, day " + dayNo + " of the road home. " + enemy.name + " harries the rear guard; the " +
        reg.name + " pays for every mile (" + loss + " lost). Pressure rising.",
      "battle",
      S.tick,
      "bad"
    );
    reg.morale = clamp(reg.morale - 3, 0, 100);
  } else {
    logAdd(
      "Day " + dayNo + " of the road home: no contact. The rear guard walks backward half the march, watching.",
      "plain",
      S.tick
    );
  }
  // the wounded slow the column: wagons, grain, time
  if (S.supply > 0) {
    const burn = Math.min(S.supply, 3 + ex.pressure);
    S.supply -= burn;
    logAdd("The wagons carry the wounded. It costs grain and time (-" + burn + " supply).", "supply", S.tick);
  }
  ex.ticksLeft--;
  if (ex.ticksLeft <= 0) {
    war.extraction = null;
    finalizeDive(ctx);
    return;
  }
  saveGame(true);
  updateCampaignView();
}

/** The dive debrief: honors, scars, traditions, unsent letters, the memorial. */
function finalizeDive(ctx: CampaignContext): void {
  const S = getState();
  const war = S.war!;
  const br = war.battleResult!;
  const dive = activeDiveOf()!;
  const won = br.won;
  if (S.campaignTimer) {
    clearInterval(S.campaignTimer);
    S.campaignTimer = null;
  }
  // war score moves per dive
  const delta = won ? 10 + 5 * war.diveIndex : -(4 + 2 * war.diveIndex);
  S.warScore += delta;
  S.diveResults.push({ won, margin: br.margin });
  // honors, scars, and earned traditions
  for (const r of S.regiments) {
    if (won) {
      r.honors.push(ctx.objective.place);
      r.scars.push({
        name: ctx.objective.place + " ribbon",
        story: "A ribbon in the regiment's colors, tied on the standard for " + ctx.objective.place + ".",
      });
      // TRADITIONS: regiments that come through together earn names, a small
      // bonus, and a mark on the standard
      if (r.morale >= 60 && r.strength > r.maxStrength / 2 && r.traditions.length < 3 && chance(0.5)) {
        const tname =
          dive.type === "hold" || dive.type === "seize"
            ? "the Ones Who Held " + ctx.objective.place
            : dive.type === "siege"
              ? "the Breakers of " + ctx.objective.place
              : "the Ghosts of " + ctx.objective.place;
        r.traditions.push(tname);
        logAdd(
          r.name + " are now called \"" + tname + "\" by the other regiments. Earned, not given: +2 battle henceforth, and a mark on the standard.",
          "officer",
          S.tick,
          "good"
        );
      }
    } else if (br.dead.length > 0) {
      r.scars.push({
        name: "Black ribbon of " + ctx.objective.place,
        story:
          "A black ribbon for the " + br.dead.filter((d) => d.regiment === r.name).length +
          " of " + r.name + " who did not come home.",
      });
    }
    r.xp += won ? 3 : 1;
  }
  // LAST LETTERS: the fallen officers' unsent letters reach the player
  for (const line of deliverLetters()) {
    logAdd(line, "officer", S.tick);
  }
  S.aftermath = {
    objectiveName: ctx.objective.name,
    place: ctx.objective.place,
    enemyName: enemyOf(war).name,
    outcome: won ? (br.margin >= 5 ? "victory" : "costly") : br.margin >= -5 ? "costly" : "defeat",
    summary: br.summary,
    dead: br.dead,
    wounded: br.wounded,
    honors: [],
    spoilsGained: br.spoils,
    diveIndex: war.diveIndex,
    divesTotal: S.dives.length,
    warScoreDelta: delta,
  };
  S.war = null;
  S.phase = "aftermath";
  S.screen = "campaign";
  S._painted = S.log.length;
  dealRecruits();
  dealGossip(2);
  saveGame(true);
  if (checkGeneralFate()) {
    render();
    return;
  }
  render();
}

/** Push to the next dive: letters home are written, then the column marches. */
export function pushDive(): void {
  const S = getState();
  if (S.activeDive + 1 >= S.dives.length) return;
  S.aftermath = null;
  writeLetters();
  logAdd("The general studies the plan and nods. The column marches for the next dive.", "campaign");
  launchDive(S.activeDive + 1);
}

/** Withdraw between dives: the campaign ends at a cost to war score. */
export function withdrawDive(): void {
  const S = getState();
  S.warScore -= 5;
  S.aftermath = null;
  logAdd(
    "The general calls off the campaign. The regiments march home with what they have. War score -5.",
    "war"
  );
  endCampaign("withdrawn");
}

function campaignOutcome(): CampaignOutcome {
  const S = getState();
  const r = S.diveResults;
  const won = r.filter((x) => x.won).length;
  const lost = r.length - won;
  if (r.length > 0 && won === r.length) return r[r.length - 1].margin >= 5 ? "decisive" : "pyrrhic";
  if (won > lost) return "pyrrhic";
  if (won === lost) return "stalemate";
  return "defeat";
}

function outcomeNote(outcome: CampaignOutcome): string {
  const S = getState();
  const won = S.diveResults.filter((x) => x.won).length;
  return won + " of " + S.diveResults.length + " dives taken (" + outcome + ")";
}

/** Close out the campaign: the war layer scores it, the world keeps score. */
export function endCampaign(outcome: CampaignOutcome): void {
  const S = getState();
  const sector = S.dives.length ? S.dives[S.dives.length - 1].place : "Evensbrook";
  const foeId = S.dives.length ? S.dives[0].enemyIds[0] : "";
  const rec: CampaignRecord = {
    name: S.campaignName || "An unnamed campaign",
    dives: S.dives.length,
    divesWon: S.diveResults.filter((x) => x.won).length,
    outcome,
    note: outcomeNote(outcome),
    foeId,
  };
  const lines = scoreCampaign(rec, sector);
  for (const l of lines) logAdd(l, "war");
  // the wider war moves while you were gone (but not the sector you just decided)
  advanceLivingWar(sector);
  // the years mark everyone
  if (S.general) S.general.age += 1;
  for (const o of S.officers) if (o.alive) o.age += 1;
  const end = checkWarEnd();
  if (end) endWar(end);
  S.war = null;
  S.activeDive = -1;
  toGarrison();
}

/** Leave the debrief after the final dive: the campaign is scored. */
export function endCampaignFromDebrief(): void {
  const S = getState();
  S.aftermath = null;
  endCampaign(campaignOutcome());
}

/** Leave the aftermath: back to Evensbrook, four action points, the war goes on. */
export function toGarrison(): void {
  const S = getState();
  // the enemy replenishes: the war goes on
  for (const e of S.enemy) {
    e.strength = Math.min(e.maxStrength, Math.round(e.strength * 1.1) + 10);
  }
  if (S.aftermath) {
    S.stats.fallen += S.aftermath.dead.length;
    S.stats.spoilsEarned += S.aftermath.spoilsGained;
  }
  // letters that were never needed are sent home
  for (const o of S.officers) o.letter = undefined;
  S.phase = "garrison";
  S.screen = "muster";
  S.ap = 4;
  S.aftermath = null;
  (S as unknown as { _intel?: boolean })._intel = false;
  if (!S.warRecord) startNewWar();
  dealRecruits();
  dealGossip(2);
  saveGame(true);
  render();
}

export { officerName };
