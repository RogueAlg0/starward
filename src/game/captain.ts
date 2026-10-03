// Captain aging, fate checks, and the heir handoff.
import { chance, pick, randInt } from "./rng";
import { getState } from "./state";
import { newCrewMember } from "./crew";
import { logAdd } from "./log";
import { saveGame } from "./state";
import { render } from "../ui/shell";

export function checkCaptainFate(): boolean {
  const S = getState();
  if (!S.captain) return false;
  const age = S.captain.age;
  if (age < 65) return false;
  const p = (age - 60) * 0.06;
  if (!chance(p)) return false;
  S.fateKind = chance(0.5) ? "retire" : "die";
  S.phase = "heir";
  S.screen = "ship";
  if (S.fateKind === "die") {
    const causes = [
      "in their sleep between stars, peacefully and without permission",
      "of a heart that finally kept its own schedule",
      "during a routine burn, quickly, the way spacers ask for",
      "of old wounds that chose an inconvenient moment to reopen",
    ];
    logAdd(
      "Captain " + S.captain.name + " has died " + pick(causes) + ", at age " + age +
        ". The flag flies at half mast until the next port. The chair is empty.",
      "captain"
    );
  } else {
    logAdd(
      "Captain " + S.captain.name + ", age " + age +
        ", announces their retirement. The crew lines the corridor in dress uniform. The chair is empty.",
      "captain"
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
  const m = S.crew.find((c) => c.id === id);
  if (!m || !m.alive || !S.captain) return;
  m.alive = false; // leaves the crew to take the chair
  m.station = null;
  const gen = S.captain.generation + 1;
  logAdd(
    m.name + " takes the chair as the " + ordinal(gen) + " captain of this chronicle. " +
      "The crew that served beside them now serves under them. It changes things, and it does not.",
    "captain"
  );
  S.captain = { name: m.name, age: m.age, generation: gen };
  S.phase = "station";
  S.screen = "voyage";
  saveGame(true);
  render();
}

export function chooseStranger(): void {
  const S = getState();
  if (!S.captain) return;
  const m = newCrewMember();
  m.age = randInt(28, 38);
  const gen = S.captain.generation + 1;
  logAdd(
    m.name + ", " + m.age + ", late of the outer lines, takes the chair as the " + ordinal(gen) +
      " captain. " + m.name.split(" ")[0] + " " + m.hook + ". The crew watches, and waits, and then gets to work.",
    "captain"
  );
  S.captain = { name: m.name, age: m.age, generation: gen };
  S.phase = "station";
  S.screen = "voyage";
  saveGame(true);
  render();
}
