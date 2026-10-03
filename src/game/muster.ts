// Muster: name the general, draft six officers from nine candidates,
// give the three regiments their commanders. Guided first session:
// one verb per beat, the Marshal's counsel throughout, all skippable.
import { ADVISOR, ENEMY_REGIMENTS, REGIMENTS, officerName } from "./world";
import { randInt } from "./rng";
import { defaultState, getState, saveGame, setState } from "./state";
import { newOfficer, seedRelations } from "./officers";
import { logAdd } from "./log";
import { render } from "../ui/shell";
import { toast } from "../ui/helpers";
import { dealRecruits, dealGossip } from "./garrison";
import { startNewWar } from "./wars";

export { ADVISOR };

const MAX_STRENGTH: Record<string, number> = {
  Infantry: 300,
  Cavalry: 160,
  Artillery: 120,
};

export function startMuster(): void {
  setState(defaultState());
  const S = getState();
  S.muster.generalName = officerName();
  S.candidates = [];
  for (let i = 0; i < 9; i++) S.candidates.push(newOfficer());
  // seed a couple of relationships so the draft already has stories
  seedRelations(S.candidates, 2);
  S.guideStep = 0;
  render();
}

export function rerollGeneralName(): void {
  const S = getState();
  syncMusterInputs();
  S.muster.generalName = officerName();
  render();
}

export function syncMusterInputs(): void {
  const S = getState();
  const el = document.getElementById("genname") as HTMLInputElement | null;
  if (el) S.muster.generalName = el.value;
}

export function togglePick(id: number): void {
  const S = getState();
  const p = S.muster.picked;
  const i = p.indexOf(id);
  if (i >= 0) p.splice(i, 1);
  else if (p.length < 6) p.push(id);
  else {
    toast("Six officers only. Unpick someone first.");
    return;
  }
  if (S.guideStep === 0) S.guideStep = 1;
  if (S.guideStep === 1 && p.length === 6) S.guideStep = 2;
  saveGame(true);
  render();
}

export function assignCommander(regimentId: string, officerId: number): void {
  const S = getState();
  if (!S.muster.picked.includes(officerId)) return;
  // one officer, one regiment
  for (const r of Object.keys(S.muster.assignments)) {
    if (S.muster.assignments[r] === officerId) delete S.muster.assignments[r];
  }
  S.muster.assignments[regimentId] = officerId;
  if (
    S.guideStep === 2 &&
    REGIMENTS.every((r) => S.muster.assignments[r.id] != null)
  ) {
    S.guideStep = 3;
  }
  saveGame(true);
  render();
}

export function autoAssign(): void {
  const S = getState();
  const aptFor: Record<string, "infantry" | "cavalry" | "artillery"> = {
    pike: "infantry",
    wolves: "cavalry",
    gunners: "artillery",
  };
  const used = new Set<number>();
  for (const r of REGIMENTS) {
    let best: number | null = null;
    let bv = -1;
    for (const id of S.muster.picked) {
      if (used.has(id)) continue;
      const c = S.candidates.find((x) => x.id === id);
      if (!c) continue;
      const v = c.apt[aptFor[r.id]];
      if (v > bv) {
        bv = v;
        best = id;
      }
    }
    if (best != null) {
      S.muster.assignments[r.id] = best;
      used.add(best);
    }
  }
  if (REGIMENTS.every((r) => S.muster.assignments[r.id] != null)) S.guideStep = 3;
  saveGame(true);
  render();
}

export function finishMuster(): void {
  syncMusterInputs();
  const S = getState();
  const m = S.muster;
  if (m.picked.length !== 6) {
    toast("Draft six officers first.");
    return;
  }
  if (!REGIMENTS.every((r) => m.assignments[r.id] != null)) {
    toast("Every regiment needs a commander.");
    return;
  }
  const genName = (m.generalName || "").trim() || officerName();
  S.general = { name: genName, age: randInt(34, 44), generation: 1 };
  S.officers = S.candidates.filter((c) => m.picked.includes(c.id));
  S.candidates = [];
  // regiments take their commanders; the rest become staff
  const staffPosts = ["quartermaster", "scout", "surgeon"];
  let si = 0;
  for (const o of S.officers) {
    const regId = REGIMENTS.find((r) => m.assignments[r.id] === o.id)?.id || null;
    o.regiment = regId;
    o.staff = regId ? null : staffPosts[si++] || null;
  }
  S.regiments = REGIMENTS.map((r) => ({
    id: r.id,
    name: r.name,
    specialty: r.specialty,
    commander: m.assignments[r.id],
    strength: MAX_STRENGTH[r.specialty] || 200,
    maxStrength: MAX_STRENGTH[r.specialty] || 200,
    morale: randInt(60, 80),
    xp: 0,
    scars: [],
    honors: [],
    traditions: [],
  }));
  // the enemy endures between campaigns: same regiments, same grudges
  S.enemy = ENEMY_REGIMENTS.map((e) => ({
    id: e.id,
    name: e.name,
    commander: e.commander,
    commanderQuirk: e.commanderQuirk,
    strength: e.strength,
    maxStrength: e.strength,
    detail: e.detail,
    history: e.history,
  }));
  logAdd(
    "General " + genName + " takes command of the Evensbrook garrison, age " +
      S.general.age + ". Three regiments answer the muster roll. " +
      "Across the Ashen Hills, Warlord Kethra One-Eye is said to be counting her own spears. The chronicle begins.",
    "general"
  );
  for (const r of S.regiments) {
    const cmd = S.officers.find((o) => o.id === r.commander);
    logAdd(
      r.name + " (" + r.specialty.toLowerCase() + ", " + r.strength +
        " strong) musters under " + (cmd ? cmd.name : "no commander") + ". " + r.name.split(" ")[1] + " colors flying.",
      "plain"
    );
  }
  S.phase = "garrison";
  S.screen = "muster";
  S.ap = 4;
  dealRecruits();
  dealGossip(2);
  // name the war at the muster: the player gets the strategic context early
  startNewWar();
  saveGame(true);
  render();
}

export function dismissGuide(): void {
  const S = getState();
  S.guideDismissed = true;
  saveGame(true);
  render();
}
