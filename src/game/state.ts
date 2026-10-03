// Game state singleton and the save system.
// Save key is warbound-specific so the spaceship saves never leak in.
import type { GameState } from "../types";
import { SAVE_KEY } from "./world";
import { randInt } from "./rng";
import { toast } from "../ui/helpers";

let S: GameState | null = null;
let officerSeq = 1;

export function getState(): GameState {
  if (!S) throw new Error("game state not initialized");
  return S;
}

export function setState(v: GameState | null): void {
  S = v;
}

export function nextOfficerId(): number {
  return officerSeq++;
}

export function defaultState(): GameState {
  return {
    version: 1,
    phase: "muster",
    general: null,
    spoils: 120,
    officers: [],
    candidates: [],
    recruitPool: [],
    regiments: [],
    enemy: [],
    dilemmas: [],
    gossip: [],
    upgrades: [],
    log: [],
    day: 1,
    campaignCount: 0,
    doctrine: "balanced",
    war: null,
    supply: 100,
    convoyIn: 0,
    tick: 0,
    tickTotal: 0,
    campaignTimer: null,
    campaignSpeed: 1,
    screen: "muster",
    muster: { generalName: "", picked: [], assignments: {} },
    ap: 0,
    aftermath: null,
    dives: [],
    activeDive: -1,
    warScore: 0,
    warRecord: null,
    campaignName: "",
    diveResults: [],
    relations: { allies: [], rivals: [], favors: [] },
    stats: { victories: 0, defeats: 0, fallen: 0, spoilsEarned: 0 },
    fronts: [
      { sector: "Crowfield Ford", holder: "Veskar" },
      { sector: "Hollow Hill", holder: "Veskar" },
      { sector: "Saltfield", holder: "Thalmar" },
      { sector: "Millford", holder: "Thalmar" },
      { sector: "Graywater", holder: "Thalmar" },
    ],
  };
}

export function saveGame(silent?: boolean): void {
  if (!S) return;
  try {
    const copy: Record<string, unknown> = { ...S };
    delete copy.campaignTimer; // timers do not serialize
    localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
    if (!silent) toast("Progress saved.");
  } catch {
    if (!silent) toast("Save failed: storage unavailable.");
  }
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as GameState | null;
    if (!data || data.version !== 1) return false;
    S = data;
    S.campaignTimer = null;
    if (!S.stats) S.stats = { victories: 0, defeats: 0, fallen: 0, spoilsEarned: 0 };
    if (!S.fronts)
      S.fronts = [
        { sector: "Crowfield Ford", holder: "Veskar" },
        { sector: "Hollow Hill", holder: "Veskar" },
        { sector: "Saltfield", holder: "Thalmar" },
        { sector: "Millford", holder: "Thalmar" },
        { sector: "Graywater", holder: "Thalmar" },
      ];
    if (!S.dives) S.dives = [];
    if (S.activeDive == null) S.activeDive = -1;
    if (!S.diveResults) S.diveResults = [];
    if (S.campaignName == null) S.campaignName = "";
    if (!S.relations) S.relations = { allies: [], rivals: [], favors: [] };
    if (S.warScore == null) S.warScore = 0;
    if ((S.screen as string) === "army" || (S.screen as string) === "officers") S.screen = "muster";
    if (S._painted == null) S._painted = 0;
    officerSeq = 1000 + S.officers.length + randInt(1, 500);
    return true;
  } catch {
    return false;
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable; nothing to wipe */
  }
}

export function exportSave(): void {
  if (!S || !S.general) {
    toast("Nothing to export yet.");
    return;
  }
  const copy: Record<string, unknown> = { ...S };
  delete copy.campaignTimer;
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "warbound-chronicle.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export function importSave(file: File, render: () => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result)) as GameState | null;
      if (!data || data.version !== 1 || !data.general) {
        toast("That file is not a Warbound chronicle.");
        return;
      }
      if (S && S.campaignTimer) clearInterval(S.campaignTimer);
      S = data;
      S.campaignTimer = null;
      S.phase = "garrison";
      S.screen = "muster";
      officerSeq = 1000 + S.officers.length + randInt(1, 500);
      saveGame(true);
      render();
      toast("Chronicle imported. The war goes on.");
    } catch {
      toast("Could not read that file.");
    }
  };
  reader.readAsText(file);
}
