// Garrison: the action-point town phase between campaigns.
// Evensbrook is the cozy exhale. Drill, Rest, Listen, Inspect: four
// action points, each one a verb. The Listen feed is the town's social
// life: friendships, rivalries, rumors, promotions. Some rumors are true,
// and true rumors become intelligence.
import type { Gossip } from "../types";
import { GOSSIP_POOL, UPGRADES } from "./world";
import { chance, clamp, pick, randInt, shuffle } from "./rng";
import { getState, saveGame } from "./state";
import {
  aliveOfficers,
  newOfficer,
  officerById,
  quirkText,
} from "./officers";
import { logAdd } from "./log";
import { toast } from "../ui/helpers";
import { render } from "../ui/shell";

export function dealRecruits(): void {
  const S = getState();
  // Tristram's horn: the pool churns every garrison, hired or not
  S.recruitPool = [];
  for (let i = 0; i < 3; i++) {
    const m = newOfficer();
    m.fee = randInt(40, 120);
    S.recruitPool.push(m);
  }
}

function dynamicGossip(): Gossip[] {
  const S = getState();
  const out: Gossip[] = [];
  const alive = aliveOfficers();
  // regiment gossip: a named friendship or feud surfaces
  for (const o of shuffle(alive).slice(0, 2)) {
    const rel = o.relations.find((r) => {
      const other = officerById(r.with);
      return other && other.alive;
    });
    if (rel) {
      const other = officerById(rel.with)!;
      if (rel.type === "friends" || rel.type === "romance") {
        out.push({
          kind: "regiment",
          text:
            o.name.split(" ")[0] + " and " + other.name.split(" ")[0] +
            " were seen sharing a wineskin behind the barracks. Fast " +
            (rel.type === "romance" ? "lovers" : "friends") + ", the town says.",
        });
      } else {
        out.push({
          kind: "regiment",
          text:
            o.name.split(" ")[0] + " and " + other.name.split(" ")[0] +
            " crossed the square without a word. Whatever it is, it is not over.",
        });
      }
    }
  }
  // town news with a named actor
  const o = pick(alive);
  if (o && chance(0.6)) {
    out.push({
      kind: "town",
      text:
        "The cooper Maelis counted " + o.name.split(" ")[0] + "'s barrels twice, " +
        "as is his custom, and found them honest. High praise from Maelis.",
    });
  }
  // a rumor that may be true: true ones become campaign intelligence
  if (chance(0.5)) {
    const rumors = GOSSIP_POOL.filter((g) => g.kind === "rumor" && g.mayBeTrue);
    if (rumors.length) {
      const r = pick(rumors);
      out.push({ kind: "rumor", text: r.text });
      if (chance(0.5)) {
        (S as unknown as { _intel?: boolean })._intel = true;
        logAdd(
          "The rumor checks out: a scout confirms it. It will be remembered when the reports come in.",
          "good"
        );
      }
    }
  }
  return out;
}

/** The town mirrors the war: celebrations after victories, refugees after defeats. */
export function townMood(): "celebration" | "refugees" | "quiet" {
  const S = getState();
  const camps = S.warRecord?.campaigns ?? [];
  const last = camps[camps.length - 1];
  if (last && (last.outcome === "decisive" || last.outcome === "pyrrhic")) return "celebration";
  if (last && last.outcome === "defeat") return "refugees";
  if ((S.warRecord?.thalmarScore ?? 100) < 60) return "refugees";
  return "quiet";
}

export function seasonOf(day: number): string {
  return ["spring", "summer", "autumn", "winter"][Math.floor(day / 90) % 4];
}

function moodGossip(): { text: string; kind: "town" | "regiment" | "rumor" }[] {
  const S = getState();
  const mood = townMood();
  const season = seasonOf(S.day);
  const out: { text: string; kind: "town" | "regiment" | "rumor" }[] = [];
  if (mood === "celebration") {
    out.push({
      kind: "town",
      text: "Evensbrook celebrates: the bells rang till midnight and Maelis opened a barrel he swore he would never open. It is " + season + ", and the town dares to hope.",
    });
  } else if (mood === "refugees") {
    const sector = pick(["Millford", "Graywater", "Saltfield"]);
    out.push({
      kind: "town",
      text: "Refugees from " + sector + " crowd the square, wrapped in blankets and bad news. The shrine hands out soup. It is " + season + ", and nobody is celebrating.",
    });
  } else {
    out.push({
      kind: "town",
      text: "A quiet " + season + " evening in Evensbrook. The well tastes of iron, as always. The town waits.",
    });
  }
  return out;
}

export function dealGossip(n: number): void {
  const S = getState();
  const pool = shuffle(GOSSIP_POOL.filter((g) => g.kind !== "rumor" || !g.mayBeTrue));
  const items: Gossip[] = pool.slice(0, n).map((g) => ({ text: g.text, kind: g.kind }));
  for (const d of dynamicGossip()) items.push(d);
  for (const m of moodGossip()) items.unshift(m);
  S.gossip = shuffle(items).slice(0, Math.max(n, 3));
}

function spendAP(): boolean {
  const S = getState();
  if (S.ap <= 0) {
    toast("No action points left. March when ready.");
    return false;
  }
  S.ap--;
  return true;
}

export function upgradeOwned(id: string): boolean {
  return getState().upgrades.some((u) => u.id === id && u.owned);
}

/** Drill: a regiment drills. XP rises, morale steadies. */
export function drill(regimentId: string): void {
  const S = getState();
  if (!spendAP()) return;
  const r = S.regiments.find((x) => x.id === regimentId);
  if (!r) return;
  const cmd = officerById(r.commander || -1);
  const gain = upgradeOwned("veteran-cadre") ? 3 : 2;
  r.xp += gain;
  r.morale = clamp(r.morale + 2, 0, 100);
  logAdd(
    r.name + " drills on the north field" +
      (cmd ? " under " + cmd.name : "") + ". " + gain +
      " seasons of hard practice in an afternoon. The lines are straighter than they were.",
    "good"
  );
  if (cmd) cmd.morale = clamp(cmd.morale + 2, 0, 100);
  saveGame(true);
  render();
}

/** Rest: the town rests its soldiers. Morale and wounds mend. */
export function rest(): void {
  const S = getState();
  if (!spendAP()) return;
  const shrine = upgradeOwned("shrine") ? 2 : 0;
  const ward = upgradeOwned("infirmary") ? 6 : 0;
  for (const r of S.regiments) r.morale = clamp(r.morale + 8 + shrine, 0, 100);
  for (const o of aliveOfficers()) {
    o.morale = clamp(o.morale + 8 + shrine, 0, 100);
    if (o.health < 100) o.health = clamp(o.health + 8 + ward, 0, 100);
  }
  logAdd(
    "A rest day in Evensbrook. Hot food, the well water, nobody drilling. " +
      "The soldiers sleep past dawn and wake up kinder.",
    "good"
  );
  saveGame(true);
  render();
}

/** Listen: the gossip feed. The town talks; sometimes it tells the truth. */
export function listen(): void {
  const S = getState();
  if (!spendAP()) return;
  dealGossip(3);
  const r = pick(S.gossip);
  logAdd("Heard in Evensbrook: " + (r ? r.text : "nothing worth repeating."), "plain");
  saveGame(true);
  render();
}

/** Inspect: see your troops. A named detail, never a stat block. */
export function inspect(regimentId: string): void {
  const S = getState();
  if (!spendAP()) return;
  const r = S.regiments.find((x) => x.id === regimentId);
  if (!r) return;
  const cmd = officerById(r.commander || -1);
  const details = [
    "the pike shafts are oiled and racked in perfect rows",
    "a young soldier is teaching an old one to read, slowly",
    "someone has chalked a crow on the barracks door, for luck",
    "the cook swears the stew is better when " + (cmd ? cmd.name.split(" ")[0] : "the commander") + " eats with the men",
    "boots are being resoled in a line that stretches around the yard",
    "a dice game is going badly for everyone except a quiet farrier",
  ];
  logAdd(
    "Inspection of " + r.name + ": " + r.strength + " strong, morale " + r.morale +
      ". " + (cmd ? cmd.name + " (" + quirkText(cmd.quirk) + ") " : "") +
      "reports all well. In the yard, " + pick(details) + ".",
    "plain"
  );
  saveGame(true);
  render();
}

/** Muster levies: spend spoils to refill a regiment's ranks. */
export function levy(regimentId: string): void {
  const S = getState();
  const r = S.regiments.find((x) => x.id === regimentId);
  if (!r) return;
  const missing = r.maxStrength - r.strength;
  if (missing <= 0) {
    toast(r.name + " is at full strength.");
    return;
  }
  const cost = Math.min(S.spoils, Math.ceil(missing / 4));
  if (cost <= 0) {
    toast("The war chest is empty.");
    return;
  }
  const men = Math.min(missing, cost * 4);
  S.spoils -= cost;
  r.strength += men;
  logAdd(
    men + " levies from " + pick(["Eelbrook", "Millford", "Graywater", "Saltfield"]) +
      " join " + r.name + " (" + cost + " spoils). Farm boys, mostly. They will learn.",
    "good"
  );
  saveGame(true);
  render();
}

/** Hire a replacement officer from the churn. */
export function hireRecruit(id: number): void {
  const S = getState();
  const i = S.recruitPool.findIndex((m) => m.id === id);
  if (i < 0) return;
  const m = S.recruitPool[i];
  if (S.spoils < (m.fee || 0)) {
    toast("Not enough spoils.");
    return;
  }
  // a dead officer's post can be filled; the living keep theirs
  const deadPost = S.officers.find(
    (o) => !o.alive && (o.regiment || o.staff) && !S.officers.some((x) => x.alive && (x.regiment === o.regiment && o.regiment || x.staff === o.staff && o.staff))
  );
  S.spoils -= m.fee || 0;
  S.recruitPool.splice(i, 1);
  S.officers.push(m);
  if (deadPost) {
    m.regiment = deadPost.regiment;
    m.staff = deadPost.staff;
    const r = S.regiments.find((x) => x.id === deadPost.regiment);
    if (r) r.commander = m.id;
    logAdd(
      m.name + " takes up the fallen's post (" + (m.fee || 0) + " spoils signing fee). " +
        m.name.split(" ")[0] + " " + m.hook + ". The regiment watches, and then gets to work.",
      "good"
    );
  } else {
    logAdd(
      m.name + " signs on (" + (m.fee || 0) + " spoils). " + m.name.split(" ")[0] + " " +
        m.hook + ", and waits for a post to open.",
      "good"
    );
  }
  saveGame(true);
  render();
}

export function buyUpgrade(id: string): void {
  const S = getState();
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || S.upgrades.some((u) => u.id === id && u.owned)) return;
  if (S.spoils < def.cost) {
    toast("Not enough spoils.");
    return;
  }
  S.spoils -= def.cost;
  S.upgrades.push({ ...def, owned: true });
  logAdd("Evensbrook gains: " + def.name + ". " + def.desc, "good");
  if (id === "regimental-colors") {
    for (const r of S.regiments) r.morale = clamp(r.morale + 4, 0, 100);
  }
  saveGame(true);
  render();
}
