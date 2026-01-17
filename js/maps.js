import { TILE } from './constants.js';

export const OVERWORLD_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 6, 6, 0, 1, 1, 1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 6, 6, 0, 1, 0, 1, 0, 0, 0, 2, 2, 0, 7, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 2, 2, 0, 7, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const INTERIOR_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 5, 5, 5, 5, 5, 5, 5, 5, 1],
  [1, 5, 1, 1, 1, 1, 1, 1, 5, 1],
  [1, 5, 1, 5, 5, 5, 5, 1, 5, 1],
  [1, 5, 1, 5, 5, 5, 5, 1, 5, 1],
  [1, 5, 1, 5, 5, 5, 5, 1, 5, 1],
  [1, 5, 5, 5, 5, 5, 5, 5, 5, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

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

export function placeInteriorEntrance(map, tiles) {
  map[6][1] = TILE.ENTRANCE;
  tiles[6][1].setTexture('entrance');
}
