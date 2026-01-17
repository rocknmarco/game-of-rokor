import { TILE } from './constants.js';
import { gameState } from './state.js';

export function tileToTexture(tile) {
  switch (tile) {
    case TILE.GRASS:
      return 'grass';
    case TILE.SAND:
      return 'sand';
    case TILE.WATER:
      return 'water';
    case TILE.WALL:
      return 'wall';
    case TILE.HOLE:
      return 'hole';
    case TILE.FLOOR:
      return 'floor';
    case TILE.BUSH:
      return 'bush';
    case TILE.SPIKES:
      return 'spikes';
    case TILE.DOOR:
      return 'door';
    case TILE.ENTRANCE:
      return 'entrance';
    default:
      return 'grass';
  }
}

export function isPassable(tile) {
  if (tile === TILE.WALL) return false;
  if (tile === TILE.DOOR) return false;
  if (tile === TILE.BUSH) return gameState.inventory.machete;
  if (tile === TILE.WATER) return gameState.inventory.raft;
  return true;
}
