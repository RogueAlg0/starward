// The general ages; the chronicle outlives them. Succession, kept light:
// at 65 the fate check begins, and the chair passes to a chosen officer
// or a stranger. The regiments, scars, spoils, and diary carry on.
import { chance, pick, randInt } from "./rng";
import { getState, saveGame } from "./state";
import { aliveOfficers, newOfficer } from "./officers";
import { logAdd } from "./log";
import { render } from "../ui/shell";

export function checkGeneralFate(): boolean {
  const S = getState();
  if (!S.general) return false;
  const age = S.general.age;
  if (age < 65) return false;
  const p = (age - 60) * 0.06;
  if (!chance(p)) return false;
  S.fateKind = chance(0.5) ? "retire" : "die";
  S.phase = "heir";
  S.screen = "muster";
  if (S.fateKind === "die") {
    const causes = [
      "in their sleep in the command tent, peacefully and without permission",
      "of a heart that finally kept its own schedule",
      "of old wounds that chose an inconvenient winter to reopen",
      "on the road to Graywater, quickly, the way soldiers ask for",
    ];
    logAdd(
      "General " + S.general.name + " has died " + pick(causes) + ", at age " + age +
        ". The standards dip until the next muster. The chair is empty.",
      "general"
    );
  } else {
    logAdd(
      "General " + S.general.name + ", age " + age +
        ", announces their retirement. The regiments line the square in dress uniform. The chair is empty.",
      "general"
    );
  }
  return true;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function chooseHeir(id: number): void {
  const S = getState();
  const m = S.officers.find((o) => o.id === id);
  if (!m || !m.alive || !S.general) return;
  const oldName = S.general.name;
  m.alive = false; // leaves the regiment to take the chair
  m.regiment = null;
  m.staff = null;
  const gen = S.general.generation + 1;
  // succession with teeth: the heir inherits grudges, debts, and reputation
  const inherit: string[] = [];
  if (S.relations.rivals.length)
    inherit.push("rivals: " + S.relations.rivals.slice(0, 3).join(", "));
  if (S.relations.allies.length)
    inherit.push("allies: " + S.relations.allies.slice(0, 3).join(", "));
  if (S.relations.favors.length)
    inherit.push("owed favors: " + S.relations.favors.slice(0, 2).join(", "));
  const rival = S.warRecord?.rival;
  if (rival) {
    rival.grudges.push("outlived " + oldName + "; the chair holds " + m.name + " now");
  }
  logAdd(
    m.name + " takes the chair as the " + ordinal(gen) + " general of this chronicle. " +
      "The officers who served beside them now serve under them. It changes things, and it does not." +
      (inherit.length ? " What comes with the chair: " + inherit.join("; ") + "." : " The chair comes clean, for once.") +
      (rival ? " Across the hills, " + rival.name + " makes a note of the new name." : ""),
    "general"
  );
  S.general = { name: m.name, age: m.age, generation: gen };
  S.phase = "garrison";
  S.screen = "muster";
  saveGame(true);
  render();
}

export function chooseStranger(): void {
  const S = getState();
  if (!S.general) return;
  const m = newOfficer();
  m.age = randInt(30, 40);
  const gen = S.general.generation + 1;
  logAdd(
    m.name + ", " + m.age + ", late of the southern marches, takes the chair as the " + ordinal(gen) +
      " general. " + m.name.split(" ")[0] + " " + m.hook + ". The regiments watch, and wait, and then get to work.",
    "general"
  );
  S.general = { name: m.name, age: m.age, generation: gen };
  S.phase = "garrison";
  S.screen = "muster";
  saveGame(true);
  render();
}

export { aliveOfficers };
