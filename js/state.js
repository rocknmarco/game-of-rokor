import { OVERWORLD_MAP, INTERIOR_MAP } from './maps.js';

export const gameState = {
  inventory: {
    shovel: true,
    keyBlue: false,
    machete: false,
    raft: false,
    chip: false,
  },
  selected: 'shovel',
  health: 3,
  score: 0,
};

export const eventBus = new Phaser.Events.EventEmitter();

export const overworldItems = [
  { x: 16, y: 5, type: 'chip' },
];

export const interiorItems = [
  { x: 4, y: 4, type: 'raft' },
];

export const digSites = [
  { x: 4, y: 7, contains: 'keyBlue', dug: false },
];

export const overworldState = {
  map: OVERWORLD_MAP.map((row) => [...row]),
  items: overworldItems.map((item) => ({ ...item })),
};

export const interiorState = {
  map: INTERIOR_MAP.map((row) => [...row]),
  items: interiorItems.map((item) => ({ ...item })),
};
