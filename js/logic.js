import { TILE } from './constants.js';
import { gameState } from './state.js';

export function isPassable(tile) {
  if (tile === TILE.WALL) return false;
  if (tile === TILE.DOOR) return false;
  if (tile === TILE.BUSH) return gameState.inventory.machete;
  if (tile === TILE.WATER) return gameState.inventory.raft;
  return true;
}
