// WARBOUND shared types. The whole game state serializes to JSON as-is
// (minus the live campaign timer), which is what localStorage and the
// export/import save files carry.

export type Phase =
  | "muster" // name the general, draft 6 officers, assign 3 regiments
  | "garrison" // action-point town phase between campaigns
  | "campaign_setup" // the campaign plan: dive sequence + doctrine per dive
  | "campaign" // ticks play out under fog of war
  | "aftermath" // memorial casualty report
  | "heir"; // succession

export type Screen = "muster" | "garrison" | "campaign" | "diary";
export type LogKind =
  | "plain"
  | "good"
  | "bad"
  | "battle"
  | "officer"
  | "supply"
  | "weather"
  | "war"
  | "campaign"
  | "general";
export type RelationType = "friends" | "rivals" | "romance" | "feud";

export interface Aptitudes {
  infantry: number;
  cavalry: number;
  artillery: number;
  scouts: number;
  supply: number;
  surgery: number;
}

export interface Relation {
  with: number;
  type: RelationType;
}

export interface Officer {
  id: number;
  name: string;
  apt: Aptitudes;
  traits: string[];
  /** strange memorable quirk id from world.ts QUIRKS */
  quirk: string;
  hook: string;
  age: number;
  morale: number;
  health: number;
  /** regiment id when commanding, else null */
  regiment: string | null;
  /** staff post when not commanding: quartermaster | scout | surgeon */
  staff: string | null;
  relations: Relation[];
  alive: boolean;
  /** earned memories, read aloud in the aftermath */
  memories: string[];
  /** recruit-pool hiring fee; only present on recruits */
  fee?: number;
  /** unsent letter home, written between dives; delivered if they fall */
  letter?: string;
}

export interface General {
  name: string;
  age: number;
  generation: number;
}

export interface Scar {
  name: string;
  story: string;
}

export interface Regiment {
  id: string;
  name: string;
  specialty: string;
  commander: number | null;
  strength: number;
  maxStrength: number;
  morale: number;
  xp: number;
  scars: Scar[];
  honors: string[];
  /** earned names like "the Ones Who Held Redford", each +2 battle */
  traditions: string[];
}

export interface EnemyRegiment {
  id: string;
  name: string;
  commander: string;
  commanderQuirk: string;
  strength: number;
  maxStrength: number;
  detail: string;
  history: string;
}

export interface Objective {
  id: number;
  name: string;
  place: string;
  placeId: string;
  enemyId: string;
  why: string;
  weird: string;
  ticks: number;
  spoils: number;
  risk: "skirmish" | "battle" | "gamble";
}

/** a fog-of-war report, delivered late and sometimes wrong */
export interface PendingReport {
  deliverAt: number;
  text: string;
  kind: LogKind;
  correct: boolean;
}

export type DiveType = "seize" | "siege" | "raid" | "hold";

export interface Dive {
  index: number;
  type: DiveType;
  name: string;
  place: string;
  placeId: string;
  terrainId: string;
  weatherId: string;
  enemyIds: string[];
  twistId: string;
  ticks: number;
  /** 1-based; difficulty and extraction pressure escalate per dive */
  difficulty: number;
  doctrine: string;
  spoils: number;
  risk: "skirmish" | "battle" | "gamble";
}

export type CampaignOutcome =
  | "decisive"
  | "pyrrhic"
  | "stalemate"
  | "defeat"
  | "withdrawn";

export interface CampaignRecord {
  name: string;
  dives: number;
  divesWon: number;
  outcome: CampaignOutcome;
  note: string;
  foeId: string;
}

export interface RivalCommander {
  name: string;
  title: string;
  personality: "brash" | "cold" | "cunning";
  quirk: string;
  /** what the rival remembers about you, carried across campaigns */
  grudges: string[];
  /** doctrines the rival has seen you use, and how often */
  doctrineSeen: Record<string, number>;
}

export interface WarRecord {
  name: string;
  casusBelli: string;
  thalmarScore: number;
  veskarScore: number;
  campaigns: CampaignRecord[];
  active: boolean;
  rival: RivalCommander;
}

export interface WarState {
  objectiveId: number;
  enemyId: string;
  /** true enemy strength, hidden from the player */
  enemyStrength: number;
  enemyPosture: string;
  reports: PendingReport[];
  /** ticks at which dilemmas fire */
  dilemmaAt: number[];
  dilemmasDone: string[];
  /** one-shot quirk moments already fired */
  momentsDone: string[];
  omen: boolean;
  /** visible pre-battle assessment logged before the final engagement */
  oddsLogged: boolean;
  doctrine: string;
  weatherId: string;
  terrainId: string;
  twistId: string;
  /** 0-1000 tactical grid position of the enemy (true) */
  enemyX: number;
  enemyY: number;
  ordersUsed: { scouts: boolean; council: boolean };
  /** tick until which reports are accurate (Dispatch Scouts order) */
  scoutedUntil: number;
  /** the extraction leg: the return journey, under escalating pressure */
  extraction: { ticksLeft: number; pressure: number; dilemmaFired: boolean } | null;
  /** the final engagement's result, carried through extraction to the debrief */
  battleResult: {
    won: boolean;
    margin: number;
    summary: string;
    dead: { name: string; regiment: string; line: string }[];
    wounded: string[];
    enemyLoss: number;
    spoils: number;
  } | null;
  diveIndex: number;
  /** campaign seed this dive was generated from (shown, never hidden) */
  seed: string;
}

export interface Dilemma {
  id: string;
  title: string;
  text: string;
  choices: string[];
}

export interface Gossip {
  text: string;
  kind: "town" | "regiment" | "rumor";
}

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  cost: number;
  owned: boolean;
}

export interface Fallen {
  name: string;
  regiment: string;
  line: string;
}

export interface AftermathData {
  objectiveName: string;
  place: string;
  enemyName: string;
  outcome: "victory" | "defeat" | "costly";
  summary: string;
  dead: Fallen[];
  wounded: string[];
  honors: string[];
  spoilsGained: number;
  /** dive context: which dive of the campaign this debriefs */
  diveIndex: number;
  divesTotal: number;
  warScoreDelta: number;
}

export interface LogEntry {
  day: number;
  /** campaign tick stamp, for situation logs */
  tick?: number;
  text: string;
  kind: LogKind;
  /** good/bad coloring independent of the category kind */
  tone?: "good" | "bad";
  /** ASCII art entries render preformatted */
  ascii?: boolean;
}

export interface MusterDraft {
  generalName: string;
  picked: number[];
  /** regiment id -> officer id */
  assignments: Record<string, number>;
}

export interface GameState {
  version: number;
  phase: Phase;
  general: General | null;
  /** war chest: spoils of war, spent on recruits and upgrades */
  spoils: number;
  officers: Officer[];
  candidates: Officer[];
  recruitPool: Officer[];
  regiments: Regiment[];
  /** persistent foes: the same enemy regiments across campaigns */
  enemy: EnemyRegiment[];
  /** dilemmas waiting on the player's decision (pauses the campaign) */
  dilemmas: Dilemma[];
  gossip: Gossip[];
  upgrades: Upgrade[];
  log: LogEntry[];
  day: number;
  campaignCount: number;
  doctrine: string;
  /** live campaign state; null outside campaigns */
  war: WarState | null;
  supply: number;
  convoyIn: number;
  tick: number;
  tickTotal: number;
  campaignTimer: number | null;
  campaignSpeed: number;
  screen: Screen;
  muster: MusterDraft;
  /** garrison action points */
  ap: number;
  aftermath: AftermathData | null;
  /** the campaign plan: 2-4 procedurally generated dives */
  dives: Dive[];
  /** index of the dive currently being fought, -1 between dives */
  activeDive: number;
  /** the player's strategic standing across campaigns */
  warScore: number;
  /** the war layer: named war, scores, campaign history */
  warRecord: WarRecord | null;
  /** name of the current campaign (the dive sequence) */
  campaignName: string;
  /** per-dive results of the current campaign */
  diveResults: Array<{ won: boolean; margin: number }>;
  /** relationships that outlive any one general: allies, rivals, owed favors */
  relations: { allies: string[]; rivals: string[]; favors: string[] };
  stats: { victories: number; defeats: number; fallen: number; spoilsEarned: number };
  fronts: Array<{ sector: string; holder: "Thalmar" | "Veskar" }>;
  logFilter?: string;
  guideDismissed?: boolean;
  guideStep?: number;
  fateKind?: "retire" | "die";
  /** internal bookkeeping, not persisted meaningfully */
  _painted?: number;
  _warned?: boolean;
}

export interface CampaignContext {
  objective: Objective;
  doctrine: string;
  risk: "skirmish" | "battle" | "gamble";
}

export interface CampaignEvent {
  id: string;
  w: (ctx: CampaignContext) => number;
  run: (ctx: CampaignContext) => void;
}
