// Starward shared types. The whole game state serializes to JSON as-is
// (minus the live voyage timer), which is what localStorage and the
// export/import save files carry.

export type Phase = "commission" | "voyage_setup" | "voyage" | "station" | "heir";
export type Screen = "ship" | "crew" | "voyage" | "log";
export type LogKind = "plain" | "good" | "bad" | "voyage" | "captain";
export type RelationType = "friends" | "rivals" | "romance" | "feud";

export interface Aptitudes {
  pilot: number;
  engineer: number;
  gunner: number;
  medic: number;
  quartermaster: number;
  navigator: number;
}

export interface Relation {
  with: number;
  type: RelationType;
}

export interface CrewMember {
  id: number;
  name: string;
  apt: Aptitudes;
  traits: string[];
  hook: string;
  age: number;
  morale: number;
  health: number;
  station: string | null;
  relations: Relation[];
  alive: boolean;
  /** station hiring fee; only present on hire-pool candidates */
  fee?: number;
}

export interface Captain {
  name: string;
  age: number;
  generation: number;
}

export interface Scar {
  name: string;
  story: string;
}

export interface Ship {
  name: string;
  hullId: string;
  condition: number;
  maxCondition: number;
  cargo: number;
  scars: Scar[];
  quirks: Scar[];
}

export interface Contract {
  id: number;
  name: string;
  from: string;
  to: string;
  risk: "safe" | "risky" | "perilous";
  ticks: number;
  pay: number;
}

export interface LogEntry {
  day: number;
  text: string;
  kind: LogKind;
  /** ASCII art entries render preformatted */
  ascii?: boolean;
}

export interface Drama {
  id: "feud" | "debt" | "retire" | "homesick" | "romance" | "memoir";
  a: number;
  b?: number;
}

export interface CommissionDraft {
  shipName: string;
  hullId: string | null;
  captainName: string;
  picked: number[];
}

export interface Hull {
  id: string;
  name: string;
  desc: string;
  cargo: number;
  hull: number;
  guns: number;
  scan: number;
  bonus: string;
}

export interface RoleStation {
  id: string;
  label: string;
  roles: string[];
}

export interface Trait {
  id: string;
  name: string;
  desc: string;
}

export interface Doctrine {
  id: string;
  name: string;
  desc: string;
  mult: number;
}

export interface GameState {
  version: number;
  phase: Phase;
  captain: Captain | null;
  ship: Ship | null;
  credits: number;
  crew: CrewMember[];
  candidates: CrewMember[];
  hirePool: CrewMember[];
  contracts: Contract[];
  dramas: Drama[];
  log: LogEntry[];
  day: number;
  voyageCount: number;
  doctrine: string;
  activeContract: number | null;
  tick: number;
  tickTotal: number;
  voyageTimer: number | null;
  voyageSpeed: number;
  screen: Screen;
  commission: CommissionDraft;
  logFilter?: string;
  guideDismissed?: boolean;
  needsNewHull?: boolean;
  shipLost?: boolean;
  fateKind?: "retire" | "die";
  /** internal voyage-view bookkeeping, not persisted meaningfully */
  _painted?: number;
  _warned?: boolean;
  _limped?: boolean;
  _station?: string | null;
  _lostName?: string;
  _newHullId?: string | null;
}

export interface VoyageContext {
  contract: Contract;
  doctrine: string;
  risk: "safe" | "risky" | "perilous";
}

export interface VoyageEvent {
  id: string;
  w: (ctx: VoyageContext) => number;
  run: (ctx: VoyageContext) => void;
}
