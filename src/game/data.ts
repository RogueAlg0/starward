// Static data tables and name generators.
import type { Doctrine, Hull, RoleStation, Trait } from "../types";
import { pick } from "./rng";

const FIRST_A = ["Ka", "Ze", "Mi", "Tor", "Ve", "Al", "Ri", "Do", "Sa", "Ny",
  "Bel", "Cor", "Fen", "Hal", "I", "Ju", "Kel", "Lo", "Mar", "Ne"];
const FIRST_B = ["ra", "len", "shi", "vik", "na", "dor", "mi", "sek", "tia", "ron",
  "gan", "pel", "dra", "vin", "sor", "quin", "beth", "mar", "los", "fin"];
const LAST_A = ["Vey", "Kar", "Sol", "Dra", "Mor", "Tal", "Rho", "Cas", "Bel", "Ost"];
const LAST_B = ["mont", "wick", "ren", "ford", "grave", "holm", "shire", "brand", "more", "land"];

export function personName(): string {
  return pick(FIRST_A) + pick(FIRST_B) + " " + pick(LAST_A) + pick(LAST_B);
}

const SHIP_A = ["Meridian", "Vigil", "Halcyon", "Argent", "Cobalt", "Sable",
  "Wayward", "Resolute", "Pale", "Cinder", "Gilded", "Silent", "Broken", "Far"];
const SHIP_B = ["Star", "Drift", "Lantern", "Oath", "Tide", "Crown", "Requiem",
  "Horizon", "Thorn", "Veil", "Compass", "Ember", "Sparrow", "Anvil"];

export function shipName(): string {
  return pick(SHIP_A) + " " + pick(SHIP_B);
}

export const PORTS = ["Vega Prime", "Kepler's Drift", "New Anchorage", "Tarsus",
  "The Gallowglass Reach", "Port Sable", "Meridian Gate", "Halloway",
  "Cinderfall", "The Pale Expanse", "Ostwick", "Lantern Row"];

export const HULLS: Hull[] = [
  {
    id: "hauler",
    name: "Hauler",
    desc: "Fat holds, patient engines. Built to carry, not to fight.",
    cargo: 120, hull: 70, guns: 2, scan: 2,
    bonus: "Cargo contracts pay +40%. Shrugs off engine wear.",
  },
  {
    id: "frigate",
    name: "Frigate",
    desc: "A lean hunter with teeth. Thin skin, sharp bite.",
    cargo: 60, hull: 55, guns: 5, scan: 3,
    bonus: "Combat events tilt your way. Pirate ambushes fear you.",
  },
  {
    id: "explorer",
    name: "Explorer",
    desc: "Long-range sensors and a curious heart. Fragile, lucky.",
    cargo: 70, hull: 50, guns: 2, scan: 5,
    bonus: "Anomalies and discoveries favor you. Finds what others miss.",
  },
];

export const ROLES = ["pilot", "engineer", "gunner", "medic", "quartermaster", "navigator"];

// Stations map to the role skill they draw on.
export const STATIONS: RoleStation[] = [
  { id: "bridge", label: "Bridge", roles: ["pilot", "navigator"] },
  { id: "engineering", label: "Engineering", roles: ["engineer"] },
  { id: "guns", label: "Guns", roles: ["gunner"] },
  { id: "medbay", label: "Medbay", roles: ["medic"] },
  { id: "cargo", label: "Cargo", roles: ["quartermaster"] },
];

export const TRAITS: Trait[] = [
  { id: "steady", name: "Steady Hands", desc: "+2 on crisis checks." },
  { id: "brave", name: "Brave", desc: "Better in combat events, worse at retreating." },
  { id: "hothead", name: "Hothead", desc: "Strong in a fight, starts disputes." },
  { id: "methodical", name: "Methodical", desc: "+2 on engineering and anomaly checks." },
  { id: "charming", name: "Charming", desc: "+2 on negotiation and hiring." },
  { id: "superstitious", name: "Superstitious", desc: "Morale swings wider, lucky in anomalies." },
  { id: "loyal", name: "Loyal", desc: "Never quits, steadies others nearby." },
  { id: "reckless", name: "Reckless", desc: "Bold doctrine hits harder for them." },
  { id: "eagleeyed", name: "Eagle-Eyed", desc: "+2 on scan and pirate spotting." },
  { id: "ironstomach", name: "Iron Stomach", desc: "Resists injury and hardship." },
  { id: "bookish", name: "Bookish", desc: "+2 on anomaly and first contact." },
  { id: "gambler", name: "Gambler", desc: "Risky events pay more for them." },
];

export const HOOKS = [
  "owes a gambling debt to a station boss",
  "is searching for a lost sibling",
  "is haunted by a mutiny they survived",
  "sends half their pay to family back home",
  "was once a pirate, trying to go straight",
  "keeps a forbidden pet in the vents",
  "is writing a tell-all memoir",
  "swore an oath to a dead captain",
  "is secretly nobility in hiding",
  "collects pre-collapse coins",
  "never takes off an old flight jacket",
  "dreams of buying a farm dome",
];

export const DOCTRINES: Doctrine[] = [
  { id: "cautious", name: "Cautious", desc: "Fewer events, softer blows, pay x0.9. The ship comes home.", mult: 0.9 },
  { id: "balanced", name: "Balanced", desc: "Standard risk and reward. Pay x1.0.", mult: 1.0 },
  { id: "bold", name: "Bold", desc: "More events, harder hits, pay x1.35. Glory has teeth.", mult: 1.35 },
];

export const REL_TYPES = ["friends", "rivals", "romance", "feud"];

export const SAVE_KEY = "starward.save.v1";

export function doctrineById(id: string): Doctrine {
  const d = DOCTRINES.find((x) => x.id === id);
  if (!d) throw new Error("unknown doctrine " + id);
  return d;
}

export function hullById(id: string): Hull {
  const h = HULLS.find((x) => x.id === id);
  if (!h) throw new Error("unknown hull " + id);
  return h;
}
