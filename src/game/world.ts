// WARBOUND world bible: the Kingdom of Thalmar and the Veskar war.
// Flavor data only. No game logic. Imports only from ./rng.

import { pick } from "./rng";

export const GAME_TITLE = "STARWARD";

// Save-game key for localStorage.
export const SAVE_KEY = "warbound-save-v1";

// ---------------------------------------------------------------- towns

export interface Town {
  id: string;
  name: string;
  livelihood: string;
  details: string[];
}

export const TOWNS: Town[] = [
  {
    id: "evensbrook",
    name: "Evensbrook",
    livelihood: "Garrison town. The muster ground for the marches.",
    details: [
      "Maelis the cooper counts every barrel twice and will not say why.",
      "The old well in the square supposedly never runs dry. Soldiers swear the water tastes of iron before a battle.",
      "At the shrine of the Nameless King, mothers leave wooden swords for sons who march.",
      "Everyone over forty whistles the Crowfield lament.",
    ],
  },
  {
    id: "saltfield",
    name: "Saltfield",
    livelihood: "Salt pans along the flats.",
    details: [
      "The salt-workers say the drowned keep the pans clean, and nobody argues.",
      "It burned in the Veskar raid a hundred years ago. Some doorframes still show the char.",
    ],
  },
  {
    id: "eelbrook",
    name: "Eelbrook",
    livelihood: "Fishing. Eel weirs on the river.",
    details: [
      "The weir rights pass father to son. The town records settle one old dispute with the single word: fistfight.",
      "The Pike's standard is a silver eel on green. The weir-men made it themselves.",
    ],
  },
  {
    id: "millford",
    name: "Millford",
    livelihood: "Grain mills on the Old Kings' Road.",
    details: [
      "Its mills have burned twice. The miller rebuilt both times and charges double for flour.",
      "The miller keeps a ledger of every debt owed to him and reads it aloud at the winter fair.",
    ],
  },
  {
    id: "graywater",
    name: "Graywater",
    livelihood: "Grey stone quarries on a grey river.",
    details: [
      "Grey stone, grey river, grey jokes. The quarrymen are proud of all three.",
      "The standing joke in Graywater: everything here is grey, including the humor.",
    ],
  },
];

// ---------------------------------------------------------------- places

export interface Place {
  id: string;
  name: string;
  history: string;
  detail: string;
}

export const PLACES: Place[] = [
  {
    id: "crowfield-ford",
    name: "Crowfield Ford",
    history:
      "A hundred years ago the Veskar came over the Ashen Hills and burned Saltfield. King Aldric broke them here at the Battle of Crowfield, and died doing it.",
    detail:
      "Crows still gather every autumn. The old soldiers say they are watching.",
  },
  {
    id: "ashen-hills",
    name: "The Ashen Hills",
    history:
      "The Veskar clans come down from these hills when the passes clear. They have done it for longer than the Kingdom has kept records.",
    detail:
      "Grey from a distance, black up close. The ash is from fires nobody living remembers lighting.",
  },
  {
    id: "hollow-hill",
    name: "Hollow Hill",
    history:
      "Kethra's winter stores, held by her Wolf-Banner. Whoever holds Hollow Hill holds the clans through winter.",
    detail:
      "On still days the smoke from the store-chimneys is visible for miles.",
  },
  {
    id: "old-kings-road",
    name: "The Old Kings' Road",
    history:
      "The old campaign road from Evensbrook to the fords. Every army for two hundred years has marched it.",
    detail:
      "The mile stones are worn smooth where soldiers touch them for luck.",
  },
];

// ---------------------------------------------------------------- enemy regiments

export interface EnemyRegiment {
  id: string;
  name: string;
  commander: string;
  commanderQuirk: string;
  strength: number;
  detail: string;
  history: string;
}

export const ENEMY_REGIMENTS: EnemyRegiment[] = [
  {
    id: "blood-tusk",
    name: "The Blood-Tusk of Karzhol",
    commander: "Brakk of Karzhol",
    commanderQuirk:
      "Wears a necklace of boar teeth, one for each man he has killed, and can recite the battle of each.",
    strength: 2400,
    detail:
      "Boar-helmet infantry. They charge before dawn and never take prisoners before breakfast. That is their joke.",
    history:
      "The Blood-Tusk burned Saltfield a hundred years ago and have boasted of it ever since.",
  },
  {
    id: "dumak",
    name: "Dumak's Riders",
    commander: "Dumak",
    commanderQuirk:
      "Counts his arrows in threes and will halt a pursuit to recover a dropped bow.",
    strength: 900,
    detail:
      "Horse archers. They never camp in the same place twice and leave carved horse-totems where they camp.",
    history:
      "Dumak's father rode with the clans at Crowfield Ford and never came home.",
  },
  {
    id: "grey-sisters",
    name: "The Grey Sisters",
    commander: "Sister Vey",
    commanderQuirk:
      "Has not spoken aloud in eleven years. Commands by hand signals.",
    strength: 600,
    detail:
      "Oath-bound women of the Veskar. They fight in silence and braid their hair with the colors of sisters lost.",
    history:
      "The Sisters took their oath after Crowfield Ford, when half the Veskar war-widows chose the spear over the grave.",
  },
  {
    id: "wolf-banner",
    name: "The Wolf-Banner of Hollow Hill",
    commander: "Kethra One-Eye",
    commanderQuirk:
      "Remembers every dead Veskar by name and village. Recites them before a battle.",
    strength: 1200,
    detail:
      "Kethra's own guard. They hold the winter stores at Hollow Hill and die rather than yield the wolf-standard.",
    history:
      "The guard has kept Kethra alive since she was a girl at Crowfield Ford, where she lost the eye.",
  },
];

// ---------------------------------------------------------------- officer names

export const FIRST_NAMES: string[] = [
  "Odric",
  "Maelis",
  "Sarella",
  "Tam",
  "Kessa",
  "Borin",
  "Halla",
  "Joren",
  "Petra",
  "Silas",
  "Mira",
  "Dain",
  "Corvin",
  "Asha",
  "Dunstan",
  "Elowen",
  "Rurik",
  "Tilda",
  "Bran",
  "Liora",
  "Cormac",
  "Nessa",
  "Aldred",
  "Wenna",
];

export const LAST_NAMES: string[] = [
  "Eelbrook",
  "of Graywater",
  "Crowfield",
  "Ashen",
  "Millford",
  "Saltfield",
  "Wellborn",
  "Fordsworn",
  "Stoneward",
  "Reedcut",
  "Thresh",
  "Hollowfield",
  "Blackpan",
  "Oldrook",
  "Woldmar",
  "Kingless",
];

export function officerName(): string {
  return pick(FIRST_NAMES) + " " + pick(LAST_NAMES);
}

// ---------------------------------------------------------------- officer quirks

export interface Quirk {
  id: string;
  text: string;
}

export const QUIRKS: Quirk[] = [
  { id: "q1", text: "counts arrows in threes" },
  { id: "q2", text: "talks to their sword before battle" },
  { id: "q3", text: "keeps a crow that follows the regiment (named Pick)" },
  { id: "q4", text: "was a Saltfield salt-worker and knows the pans blindfolded" },
  { id: "q5", text: "afraid of horses, commands cavalry anyway" },
  { id: "q6", text: "whistles the Crowfield lament before every battle" },
  { id: "q7", text: "collects enemy helmets and labels each with the date" },
  { id: "q8", text: "eats the same meal every campaign day: oatcake and onion" },
  { id: "q9", text: "writes letters to a brother who died at Crowfield, never sends them" },
  { id: "q10", text: "can tell the weather by the smell of the hills" },
  { id: "q11", text: "refuses to sleep under a roof on campaign" },
  { id: "q12", text: "believes the Nameless King watches from the well" },
  { id: "q13", text: "oils their boots the night before every battle, no exceptions" },
  { id: "q14", text: "keeps a pebble from Crowfield Ford in their pocket" },
  { id: "q15", text: "sleeps with their back against a tree, never a wall" },
  { id: "q16", text: "names every horse in the squadron and remembers the dead ones" },
  { id: "q17", text: "counts their rations aloud at every mess" },
  { id: "q18", text: "carries their mother's wooden sword from the shrine, never drawn" },
  { id: "q19", text: "asks prisoners their names and writes them in a small book" },
  { id: "q20", text: "will not drink from a well before tasting it for iron" },
  { id: "q21", text: "sharpens their sword only at dawn, never at night" },
  { id: "q22", text: "keeps a chalk tally of crows seen each morning on their shield" },
  { id: "q23", text: "hums the same tune while cleaning their gun, always" },
  { id: "q24", text: "has refused promotion twice already, will not say why" },
];

// ---------------------------------------------------------------- personal hooks

export const HOOKS: string[] = [
  "owes three years' pay to the Millford miller",
  "swore an oath at the Nameless King's shrine",
  "is searching for a sister taken in the Saltfield burning",
  "promised their dying father they would bring the family name home from the war",
  "is secretly writing to a Veskar captive held at Graywater",
  "owes a Graywater quarryman for a horse that was never delivered",
  "deserted for three days in their first campaign and was brought back by their brother",
  "keeps a sealed levy order from King Aldric's last muster, addressed to no one",
  "is the cooper's eldest and ran from the barrel-counting",
  "lost a bet at the Eelbrook weirs and is working it off in fish",
  "swore revenge on the Blood-Tusk for an uncle burned at Saltfield",
  "is paying a Saltfield widow a pension in secret, and nobody knows why",
];

// ---------------------------------------------------------------- military traits

export interface Trait {
  id: string;
  name: string;
  desc: string;
}

export const TRAITS: Trait[] = [
  { id: "steady", name: "Steady", desc: "+2 on battle checks to hold the line. Does not panic when the flank breaks." },
  { id: "brave", name: "Brave", desc: "+2 on battle checks leading a charge. First over the wall, last to leave." },
  { id: "hothead", name: "Hothead", desc: "+2 on the first attack of a battle, -1 after. Leads from the front and forgets the plan." },
  { id: "methodical", name: "Methodical", desc: "+2 on supply checks and siege works. Counts wagons the way Maelis counts barrels." },
  { id: "charming", name: "Charming", desc: "+2 on parley checks. Can talk a Millford miller out of a debt. Almost." },
  { id: "superstitious", name: "Superstitious", desc: "+1 on scouting checks when the omens are read first, -1 when they are ignored." },
  { id: "loyal", name: "Loyal", desc: "+2 on rally checks. The men would follow this officer into the Ashen Hills." },
  { id: "reckless", name: "Reckless", desc: "+2 on risky flanking maneuvers, -2 on holding. Wins battles and loses regiments." },
  { id: "eagle-eyed", name: "Eagle-eyed", desc: "+2 on scouting checks. Spots dust on the Ashen passes before the lookouts do." },
  { id: "iron-stomach", name: "Iron-stomach", desc: "Halves supply loss on forced marches. Eats what the men eat, including the onion." },
  { id: "studied", name: "Studied", desc: "+2 on battle checks for a battle the officer has prepared for. Reads the old campaign rolls." },
  { id: "gambler", name: "Gambler", desc: "+3 on a gambit, -3 if it fails. Will stake the supply train on a single throw." },
];

// ---------------------------------------------------------------- doctrines

export interface Doctrine {
  id: string;
  name: string;
  desc: string;
  mult: number;
}

export const DOCTRINES: Doctrine[] = [
  {
    id: "cautious",
    name: "Cautious",
    desc: "Fewer battles sought, softer blows, spoils x0.9. The regiments come home.",
    mult: 0.9,
  },
  {
    id: "balanced",
    name: "Balanced",
    desc: "Standard risk and reward. Spoils x1.0.",
    mult: 1.0,
  },
  {
    id: "bold",
    name: "Bold",
    desc: "More battles, harder hits, spoils x1.35. Glory has teeth.",
    mult: 1.35,
  },
];

export function doctrineById(id: string): Doctrine {
  const d = DOCTRINES.find((x) => x.id === id);
  if (!d) throw new Error("unknown doctrine " + id);
  return d;
}

// ---------------------------------------------------------------- player regiments

export interface Regiment {
  id: string;
  name: string;
  specialty: string;
  colors: [string, string];
  emblem: "eel" | "wolf" | "crystal";
  flavor: string;
}

export const REGIMENTS: Regiment[] = [
  {
    id: "pike",
    name: "The Eelbrook Pike",
    specialty: "Infantry",
    colors: ["#3f6b4f", "#8a8f98"],
    emblem: "eel",
    flavor: "Pike square from Eelbrook. The standard is a silver eel on green.",
  },
  {
    id: "wolves",
    name: "The Grey Wolves",
    specialty: "Cavalry",
    colors: ["#5a5f6b", "#1a1c22"],
    emblem: "wolf",
    flavor: "Horse from the Crowfield levy. Named for the wolf-banner they took at Crowfield.",
  },
  {
    id: "gunners",
    name: "The Saltfield Gunners",
    specialty: "Artillery",
    colors: ["#e8e4d8", "#3d5a80"],
    emblem: "crystal",
    flavor: "Salt-workers who know powder the way they know salt.",
  },
];

// ---------------------------------------------------------------- gossip pool

export interface Gossip {
  text: string;
  kind: "town" | "regiment" | "rumor";
  mayBeTrue?: boolean;
}

export const GOSSIP_POOL: Gossip[] = [
  { text: "The cooper's daughter married a Saltfield salt-worker. Maelis counted the wedding barrels twice.", kind: "town" },
  { text: "The old well tasted of iron this morning. The square went quiet.", kind: "town" },
  { text: "The Millford miller raised flour prices again. Nobody blinked.", kind: "town" },
  { text: "Someone left a wooden sword at the Nameless King's shrine with no name on it.", kind: "town" },
  { text: "The Eelbrook weir-men are feuding over catch rights again. Last time it came to fists.", kind: "town" },
  { text: "A Graywater quarryman swears his grandfather's joke is still funny. It is not.", kind: "town" },
  { text: "Two pikemen of the Eelbrook Pike, friends since the weirs, got in a fistfight over a card debt and made up by dawn.", kind: "regiment" },
  { text: "A corporal of the Grey Wolves was promoted for holding a bridge alone for an hour.", kind: "regiment" },
  { text: "The Saltfield Gunners have a new gunner who can load blindfolded. The old hands are nervous.", kind: "regiment" },
  { text: "A sergeant of the Pike is teaching recruits the Crowfield lament. The recruits are terrible at it.", kind: "regiment" },
  { text: "A shepherd swears Dumak's Riders watered their horses at Graywater last week.", kind: "rumor", mayBeTrue: true },
  { text: "A trader from the north says Kethra has moved the winter stores deeper into Hollow Hill.", kind: "rumor", mayBeTrue: true },
  { text: "Word from the Ashen passes: the Blood-Tusk are sharpening boar-helmets. Or it was just thunder.", kind: "rumor" },
  { text: "The Grey Sisters were seen at the ford at dusk, standing in the water, not moving.", kind: "rumor" },
  { text: "Rumor says Kethra lost the eye at Crowfield Ford as a girl and has hated the Ford ever since.", kind: "rumor", mayBeTrue: true },
  { text: "A Millford carter claims the Wolf-Banner flies over Hollow Hill now. It always did, someone told him.", kind: "rumor" },
  { text: "The crows over Crowfield Ford flew in a circle at noon. The old soldiers went quiet.", kind: "rumor" },
  { text: "Someone is buying up every barrel in Evensbrook. Maelis counts them twice anyway.", kind: "rumor" },
];

// ---------------------------------------------------------------- omen lines

export const OMEN_LINES: string[] = [
  "Crows gather over Crowfield Ford, the way they do every autumn. The old soldiers go quiet.",
  "A crow landed on the muster standard this morning and would not be shooed away.",
  "The crows flew in a single black line toward the Ashen Hills at dusk.",
  "Three crows sat on the well rim at noon. Nobody drew water until they left.",
  "The quartermaster found a crow feather in the grain. He burned it without a word.",
  "At dawn the crows were gone from the Ford. Every last one.",
];

// ---------------------------------------------------------------- upgrades

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  cost: number;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "infirmary",
    name: "Infirmary",
    desc: "A stone ward behind the square. Wounded soldiers recover twice as fast.",
    cost: 300,
  },
  {
    id: "stables",
    name: "Stables",
    desc: "New stalls and a Graywater smith for shoeing. The Grey Wolves march one day farther each week.",
    cost: 250,
  },
  {
    id: "shrine",
    name: "Shrine of the Nameless King",
    desc: "A roofed shrine and an iron brazier that never goes out. Recruits arrive steadier. Desertions fall.",
    cost: 200,
  },
  {
    id: "veteran-cadre",
    name: "Veteran Cadre",
    desc: "A core of Crowfield veterans attached to a regiment. +2 on battle checks for that regiment.",
    cost: 350,
  },
  {
    id: "regimental-colors",
    name: "Regimental Colors",
    desc: "A proper painted standard, blessed at the shrine. The regiment rallies twice as fast.",
    cost: 150,
  },
  {
    id: "master-smith",
    name: "Master Smith",
    desc: "A smith from Millford who sharpens pikeheads and shoes gun carriages. Equipment breaks half as often.",
    cost: 200,
  },
];

// ---------------------------------------------------------------- advisor

export interface Advisor {
  name: string;
  title: string;
  lines: {
    muster: string;
    draft: string;
    assign: string;
    objective: string;
    doctrine: string;
    garrison: string;
  };
}

export const ADVISOR: Advisor = {
  name: "Marshal Odric",
  title: "one-eyed veteran of Crowfield",
  lines: {
    muster: "Pick three regiments and mean it. A half-mustered army is a dead one.",
    draft: "Take the farm boys and the weir-men. Soft hands break at the first charge.",
    assign: "Put your steady ones in the center and your brave ones where it will be worst. Officers, not ornaments.",
    objective: "The hills are the objective. Everything else is the road to them.",
    doctrine: "Attack at dawn and keep your powder dry. The Veskar respect only the spear and the cannon.",
    garrison: "Keep the men fed and the barrels counted. A garrison that drinks is a garrison that dies.",
  },
};
