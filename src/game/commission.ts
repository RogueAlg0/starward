// Commission flow: name the ship and captain, pick a hull,
// draft six crew from nine candidates, sign the commission.
import { HULLS, hullById, personName, shipName } from "./data";
import { randInt } from "./rng";
import { defaultState, getState, saveGame, setState } from "./state";
import { autoAssign, newCrewMember, seedRelations } from "./crew";
import { logAdd } from "./log";
import { dealContracts } from "./contracts";
import { render } from "../ui/shell";
import { toast } from "../ui/helpers";

export function startCommission(): void {
  setState(defaultState());
  const S = getState();
  S.commission.shipName = shipName();
  S.commission.captainName = personName();
  S.candidates = [];
  for (let i = 0; i < 9; i++) S.candidates.push(newCrewMember());
  // seed a couple of relationships so the draft already has stories
  seedRelations(S.candidates, 2);
  render();
}

export function pickHull(id: string): void {
  const S = getState();
  S.commission.hullId = id;
  syncCommissionInputs();
  render();
}

export function togglePick(id: number): void {
  const S = getState();
  const p = S.commission.picked;
  const i = p.indexOf(id);
  if (i >= 0) p.splice(i, 1);
  else if (p.length < 6) p.push(id);
  else {
    toast("Six crew only. Unpick someone first.");
    return;
  }
  syncCommissionInputs();
  render();
}

export function rerollShipName(): void {
  const S = getState();
  syncCommissionInputs();
  S.commission.shipName = shipName();
  render();
}

export function rerollCapName(): void {
  const S = getState();
  syncCommissionInputs();
  S.commission.captainName = personName();
  render();
}

export function syncCommissionInputs(): void {
  // preserve typed names across re-renders
  const S = getState();
  const sn = document.getElementById("shipname") as HTMLInputElement | null;
  const cn = document.getElementById("capname") as HTMLInputElement | null;
  if (sn) S.commission.shipName = sn.value;
  if (cn) S.commission.captainName = cn.value;
}

export function finishCommission(): void {
  syncCommissionInputs();
  const S = getState();
  const c = S.commission;
  if (!c.hullId || c.picked.length !== 6) return;
  const hull = hullById(c.hullId);
  const shipNameFinal = (c.shipName || "").trim() || shipName();
  const capNameFinal = (c.captainName || "").trim() || personName();
  S.ship = {
    name: shipNameFinal,
    hullId: hull.id,
    condition: hull.hull,
    maxCondition: hull.hull,
    cargo: hull.cargo,
    scars: [],
    quirks: [],
  };
  S.captain = { name: capNameFinal, age: randInt(34, 40), generation: 1 };
  S.crew = S.candidates.filter((cd) => c.picked.includes(cd.id));
  S.candidates = [];
  autoAssign();
  logAdd(
    "Captain " +
      S.captain.name +
      " signs the commission of the " +
      S.ship.name +
      " (" +
      hull.name +
      " class), age " +
      S.captain.age +
      ". Six souls ship out. The chronicle begins.",
    "captain"
  );
  S.phase = "voyage_setup";
  S.screen = "voyage";
  dealContracts();
  saveGame(true);
  render();
}

export { HULLS };
