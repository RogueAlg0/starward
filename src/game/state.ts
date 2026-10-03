// Game state singleton and the save system.
// Save format key "starward.save.v1" matches the vanilla prototype, so
// saves carry over between versions.
import type { GameState } from "../types";
import { SAVE_KEY, personName, shipName } from "./data";
import { randInt } from "./rng";
import { toast } from "../ui/helpers";

let S: GameState | null = null;
let crewSeq = 1;

export function getState(): GameState {
  if (!S) throw new Error("game state not initialized");
  return S;
}

export function setState(v: GameState | null): void {
  S = v;
}

export function nextCrewId(): number {
  return crewSeq++;
}

export function defaultState(): GameState {
  return {
    version: 1,
    phase: "commission", // commission | voyage_setup | voyage | station | heir
    captain: null,
    ship: null,
    credits: 400,
    crew: [],
    candidates: [],
    hirePool: [],
    contracts: [],
    dramas: [],
    log: [],
    day: 1,
    voyageCount: 0,
    doctrine: "balanced",
    activeContract: null,
    tick: 0,
    tickTotal: 0,
    voyageTimer: null,
    voyageSpeed: 1,
    screen: "ship", // tab: ship | crew | voyage | log
    commission: { shipName: shipName(), hullId: null, captainName: personName(), picked: [] },
  };
}

export function saveGame(silent?: boolean): void {
  if (!S) return;
  try {
    const copy: Record<string, unknown> = { ...S };
    delete copy.voyageTimer; // timers do not serialize
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
    S.voyageTimer = null;
    crewSeq = 1000 + S.crew.length + randInt(1, 500);
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
  if (!S || !S.captain) {
    toast("Nothing to export yet.");
    return;
  }
  const copy: Record<string, unknown> = { ...S };
  delete copy.voyageTimer;
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "starward-dynasty.json";
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
      if (!data || data.version !== 1 || !data.captain) {
        toast("That file is not a Starward save.");
        return;
      }
      if (S && S.voyageTimer) clearInterval(S.voyageTimer);
      S = data;
      S.voyageTimer = null;
      S.phase = "station";
      S.screen = "ship";
      crewSeq = 1000 + S.crew.length + randInt(1, 500);
      saveGame(true);
      render();
      toast("Dynasty imported. The chronicle continues.");
    } catch {
      toast("Could not read that file.");
    }
  };
  reader.readAsText(file);
}
