// Card schema:
// {
//   id: string,              unique instance id
//   definitionId: string,
//   name: string,
//   type: 'creature' | 'spell' | 'land' | 'enchantment' | 'artifact',
//   subtype: string[],
//   colors: string[],
//   cost: { white, blue, black, red, green, colorless } | null,
//   produces: string | null,  lands only
//   power: number | null,
//   toughness: number | null,
//   text: string,
//   keywords: string[],       'haste','trample','deathtouch','indestructible','vigilance',
//                             'reach','mana_ability','unblockable_by_small'
//   tapped: boolean,
//   summoningSickness: boolean,
//   damage: number,
//   counters: {},
// }

const { generateId } = require('./GameState');

const CARD_DEFINITIONS = {

  // ── BASIC LANDS ────────────────────────────────────────────────────────────
  mountain: {
    definitionId: 'mountain', name: 'Mountain', type: 'land',
    subtype: ['Mountain'], colors: [], cost: null, produces: 'red',
    text: '{T}: Add {R}.', keywords: [],
  },
  forest: {
    definitionId: 'forest', name: 'Forest', type: 'land',
    subtype: ['Forest'], colors: [], cost: null, produces: 'green',
    text: '{T}: Add {G}.', keywords: [],
  },

  // ── MONO RED BURN ─────────────────────────────────────────────────────────

  goblin_guide: {
    definitionId: 'goblin_guide', name: 'Goblin Guide',
    type: 'creature', subtype: ['Goblin', 'Scout'],
    colors: ['red'], cost: { red: 1 },
    power: 2, toughness: 2,
    keywords: ['haste'],
    text: 'Haste. Whenever Goblin Guide attacks, defending player reveals the top card of their library. If it\'s a land card, that player puts it into their hand.',
  },
  monastery_swiftspear: {
    definitionId: 'monastery_swiftspear', name: 'Monastery Swiftspear',
    type: 'creature', subtype: ['Human', 'Monk'],
    colors: ['red'], cost: { red: 1 },
    power: 1, toughness: 2,
    keywords: ['haste'],
    text: 'Haste. Prowess — Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn. (Prowess not yet implemented.)',
  },
  eidolon_of_the_great_revel: {
    definitionId: 'eidolon_of_the_great_revel', name: 'Eidolon of the Great Revel',
    type: 'creature', subtype: ['Spirit'],
    colors: ['red'], cost: { red: 2 },
    power: 2, toughness: 2,
    keywords: [],
    text: 'Whenever a player casts a spell with mana value 3 or less, Eidolon of the Great Revel deals 2 damage to that player. (Trigger not yet implemented.)',
  },
  lightning_bolt: {
    definitionId: 'lightning_bolt', name: 'Lightning Bolt',
    type: 'spell', subtype: ['Instant'],
    colors: ['red'], cost: { red: 1 },
    keywords: [],
    text: 'Lightning Bolt deals 3 damage to any target.',
  },
  lava_spike: {
    definitionId: 'lava_spike', name: 'Lava Spike',
    type: 'spell', subtype: ['Sorcery'],
    colors: ['red'], cost: { red: 1 },
    keywords: [],
    text: 'Lava Spike deals 3 damage to target player or planeswalker.',
  },
  rift_bolt: {
    definitionId: 'rift_bolt', name: 'Rift Bolt',
    type: 'spell', subtype: ['Sorcery'],
    colors: ['red'], cost: { colorless: 2, red: 1 },
    keywords: [],
    text: 'Rift Bolt deals 3 damage to any target. (Suspend not implemented.)',
  },
  shard_volley: {
    definitionId: 'shard_volley', name: 'Shard Volley',
    type: 'spell', subtype: ['Instant'],
    colors: ['red'], cost: { red: 1 },
    keywords: [],
    text: 'As an additional cost, sacrifice a land. (Land sac not enforced.) Shard Volley deals 3 damage to any target.',
  },
  skullcrack: {
    definitionId: 'skullcrack', name: 'Skullcrack',
    type: 'spell', subtype: ['Instant'],
    colors: ['red'], cost: { colorless: 1, red: 1 },
    keywords: [],
    text: 'Players can\'t gain life this turn. Damage can\'t be prevented this turn. Skullcrack deals 3 damage to any target.',
  },
  searing_blaze: {
    definitionId: 'searing_blaze', name: 'Searing Blaze',
    type: 'spell', subtype: ['Instant'],
    colors: ['red'], cost: { red: 2 },
    keywords: [],
    text: 'Searing Blaze deals 1 damage to target player and 3 damage to target creature that player controls.',
  },
  light_up_the_stage: {
    definitionId: 'light_up_the_stage', name: 'Light Up the Stage',
    type: 'spell', subtype: ['Sorcery'],
    colors: ['red'], cost: { colorless: 2, red: 1 },
    keywords: [],
    text: 'Spectacle {R}. Exile the top two cards of your library. Draw 2 cards. (Exile-until-next-turn simplified to draw 2.)',
  },

  // ── MONO GREEN STOMPY ─────────────────────────────────────────────────────

  llanowar_elves: {
    definitionId: 'llanowar_elves', name: 'Llanowar Elves',
    type: 'creature', subtype: ['Elf', 'Druid'],
    colors: ['green'], cost: { green: 1 },
    power: 1, toughness: 1,
    keywords: ['mana_ability'],
    produces: 'green',
    text: '{T}: Add {G}.',
  },
  pelt_collector: {
    definitionId: 'pelt_collector', name: 'Pelt Collector',
    type: 'creature', subtype: ['Elf', 'Warrior'],
    colors: ['green'], cost: { green: 1 },
    power: 1, toughness: 1,
    keywords: [],
    text: 'Whenever another creature you control enters the battlefield, if that creature\'s power is greater than Pelt Collector\'s power, put a +1/+1 counter on Pelt Collector. (Counter trigger not yet implemented.)',
  },
  burning_tree_emissary: {
    definitionId: 'burning_tree_emissary', name: 'Burning-Tree Emissary',
    type: 'creature', subtype: ['Human', 'Shaman'],
    colors: ['red', 'green'], cost: { red: 1, green: 1 },
    power: 2, toughness: 2,
    keywords: [],
    text: 'When Burning-Tree Emissary enters the battlefield, add {R}{G}.',
  },
  steel_leaf_champion: {
    definitionId: 'steel_leaf_champion', name: 'Steel Leaf Champion',
    type: 'creature', subtype: ['Elf', 'Knight'],
    colors: ['green'], cost: { green: 3 },
    power: 5, toughness: 4,
    keywords: ['unblockable_by_small'],
    text: 'Steel Leaf Champion can\'t be blocked by creatures with power 2 or less.',
  },
  avatar_of_the_resolute: {
    definitionId: 'avatar_of_the_resolute', name: 'Avatar of the Resolute',
    type: 'creature', subtype: ['Avatar'],
    colors: ['green'], cost: { green: 2 },
    power: 3, toughness: 2,
    keywords: ['reach', 'trample'],
    text: 'Reach, trample.',
  },
  rhonas_the_indomitable: {
    definitionId: 'rhonas_the_indomitable', name: 'Rhonas the Indomitable',
    type: 'creature', subtype: ['God', 'Snake'],
    colors: ['green'], cost: { colorless: 2, green: 1 },
    power: 5, toughness: 5,
    keywords: ['deathtouch', 'indestructible'],
    text: 'Deathtouch, indestructible. Rhonas can\'t attack or block unless you control another creature with power 4 or greater. (Attack restriction not yet enforced.)',
  },
  aspect_of_hydra: {
    definitionId: 'aspect_of_hydra', name: 'Aspect of Hydra',
    type: 'spell', subtype: ['Instant'],
    colors: ['green'], cost: { green: 1 },
    keywords: [],
    text: 'Target creature gets +X/+X until end of turn, where X is your devotion to green.',
  },
  vines_of_vastwood: {
    definitionId: 'vines_of_vastwood', name: 'Vines of Vastwood',
    type: 'spell', subtype: ['Instant'],
    colors: ['green'], cost: { green: 2 },
    keywords: [],
    text: 'Target creature can\'t be the target of spells or abilities your opponents control this turn. That creature gets +4/+4 until end of turn. (Hexproof not enforced.)',
  },
  giant_growth: {
    definitionId: 'giant_growth', name: 'Giant Growth',
    type: 'spell', subtype: ['Instant'],
    colors: ['green'], cost: { green: 1 },
    keywords: [],
    text: 'Target creature gets +3/+3 until end of turn.',
  },
};

function instantiateCard(definitionId) {
  const def = CARD_DEFINITIONS[definitionId];
  if (!def) throw new Error(`Unknown card definition: ${definitionId}`);
  return {
    ...def,
    id: generateId(),
    tapped: false,
    summoningSickness: false,
    damage: 0,
    counters: {},
  };
}

function repeat(defId, n) {
  return Array.from({ length: n }, () => instantiateCard(defId));
}

// Classic Mono Red Burn (Modern) — 60 cards
function buildMonoRedDeck() {
  return [
    ...repeat('mountain', 20),
    ...repeat('goblin_guide', 4),
    ...repeat('monastery_swiftspear', 4),
    ...repeat('eidolon_of_the_great_revel', 4),
    ...repeat('lightning_bolt', 4),
    ...repeat('lava_spike', 4),
    ...repeat('rift_bolt', 4),
    ...repeat('shard_volley', 4),
    ...repeat('skullcrack', 4),
    ...repeat('searing_blaze', 4),
    ...repeat('light_up_the_stage', 4),
  ];
}

// Classic Mono Green Stompy (Modern) — 60 cards
function buildMonoGreenDeck() {
  return [
    ...repeat('forest', 20),
    ...repeat('llanowar_elves', 4),
    ...repeat('pelt_collector', 4),
    ...repeat('burning_tree_emissary', 4),
    ...repeat('steel_leaf_champion', 4),
    ...repeat('avatar_of_the_resolute', 4),
    ...repeat('rhonas_the_indomitable', 4),
    ...repeat('aspect_of_hydra', 4),
    ...repeat('vines_of_vastwood', 4),
    ...repeat('giant_growth', 4),
    ...repeat('lightning_bolt', 4), // splashed via Emissary's red mana
  ];
}

function buildDeck(name) {
  switch (name) {
    case 'mono_red': return buildMonoRedDeck();
    case 'mono_green': return buildMonoGreenDeck();
    default: throw new Error(`Unknown deck: ${name}`);
  }
}

module.exports = { CARD_DEFINITIONS, instantiateCard, buildDeck };
