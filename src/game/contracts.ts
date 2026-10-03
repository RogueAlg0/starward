// Contract offers for the voyage setup screen.
import { PORTS } from "./data";
import { pick, randInt, shuffle } from "./rng";
import { getState } from "./state";

function contractName(): string {
  const a = pick(["Amber", "Silent", "Gilded", "Hollow", "Vigilant", "Pale", "Crimson"]);
  const b = pick(["Run", "Crossing", "Haul", "Passage", "Relay", "Circuit"]);
  return a + " " + b;
}

export function riskDesc(r: string): string {
  return {
    safe: "patrolled lanes, thin margins",
    risky: "open space, real money",
    perilous: "nobody patrols out there",
  }[r] as string;
}

export function dealContracts(): void {
  const S = getState();
  S.contracts = [];
  const risks = shuffle(["safe", "risky", "perilous"] as const);
  for (let i = 0; i < 3; i++) {
    const risk = risks[i];
    const from = pick(PORTS);
    let to = pick(PORTS);
    if (to === from) to = pick(PORTS);
    const base = { safe: [45, 220], risky: [60, 420], perilous: [75, 700] }[risk];
    const ticks = base[0] + randInt(-5, 5);
    const pay = Math.round(
      (base[1] + randInt(0, 120)) * (S.ship && S.ship.hullId === "hauler" ? 1.15 : 1)
    );
    S.contracts.push({
      id: i,
      name: contractName(),
      from,
      to,
      risk,
      ticks,
      pay,
    });
  }
}
