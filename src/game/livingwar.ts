// The living war: the wider Thalmar-Veskar war goes on around the player.
// Between campaigns, fronts move and other commanders win and lose. The
// player's own victories move the line too. Kept light: a ticker, a few
// named actors, the occasional tithe or shortfall that lands in camp.
import { chance, pick, randInt } from "./rng";
import { getState, saveGame } from "./state";
import { logAdd } from "./log";

const THALMAR_COMMANDERS = [
  "General Maren",
  "Commander Ysolde",
  "General Pell",
  "Captain Harrow",
  "Commander Sella",
];

const VESKAR_COMMANDERS = [
  "Brakk of Karzhol",
  "Dumak",
  "Sister Vey",
  "Kethra One-Eye",
  "War-Captain Rhuz",
];

const NEWS: Array<(sector: string, holder: "Thalmar" | "Veskar") => string> = [
  (s) => "Skirmishers traded arrows outside " + s + " for three days. Nothing decided.",
  (s) => "A Veskar supply train was burned on the road to " + s + ". Both sides claim it.",
  (s) => "Refugees from " + s + " reached Evensbrook with nothing but the clothes they marched in.",
  (s, h) =>
    h === "Thalmar"
      ? "The levy at " + s + " drilled through the rain. The sergeants are pleased, which worries everyone."
      : "Veskar war-drums were heard past " + s + " at dusk. The pickets doubled.",
  (s) => "A crow-count of " + s + ": too many crows. The old soldiers went quiet.",
  (s, h) =>
    h === "Thalmar"
      ? "A tithe arrived from " + s + ": grain, salt, and a barrel of something the quartermaster refuses to name."
      : "Raiders out of " + s + " took three wagons on the Graywater road. The drivers walked home.",
];

export function advanceLivingWar(protectedSector?: string): void {
  const S = getState();
  const lines: string[] = [];

  for (const f of S.fronts) {
    if (protectedSector === f.sector) continue; // the player just decided this one
    if (chance(0.22)) {
      // the sector changes hands, with named actors on both sides
      if (f.holder === "Thalmar") {
        const v = pick(VESKAR_COMMANDERS);
        f.holder = "Veskar";
        lines.push(f.sector + " has fallen. " + v + " raised the wolf-banner over it at dusk.");
        if (chance(0.4)) {
          const m = randInt(1, 4);
          for (const r of S.regiments) r.morale = Math.max(0, r.morale - m);
          lines.push("The news runs through the camp like cold water. Morale -" + m + ".");
        }
      } else {
        const t = pick(THALMAR_COMMANDERS);
        f.holder = "Thalmar";
        lines.push(t + " retook " + f.sector + " in a dawn attack. The bells rang in Evensbrook.");
        if (chance(0.4)) {
          const tithe = randInt(15, 40);
          S.spoils += tithe;
          lines.push(t.split(" ")[0] + " " + t.split(" ")[1] + " sent a tithe of the spoils: +" + tithe + " spoils.");
        }
      }
    } else if (chance(0.35)) {
      lines.push(pick(NEWS)(f.sector, f.holder));
    }
  }

  // 2-4 lines, newest first in the diary
  for (const line of lines.slice(0, 4)) logAdd(line, "war");
  saveGame(true);
}

/** One-line summary of the front for the garrison screen. */
export function frontSummary(): string {
  const S = getState();
  const ours = S.fronts.filter((f) => f.holder === "Thalmar").length;
  return ours + " of " + S.fronts.length + " sectors hold for Thalmar";
}
