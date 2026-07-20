export const TILE_WIDTH = 16;
export const TILE_HEIGHT = 12;
export const ROOM_WIDTH = 40;
export const ROOM_HEIGHT = 28;

const tile = (x, y, width = TILE_WIDTH, height = TILE_HEIGHT) => ({ x, y, width, height });
const numberAfter = (id, marker) => Number(id.slice(marker.length));
const numberAfterHash = (id) => Number(id.split('#')[1]);

const exactSprites = new Map([
  ['OBJ_CHARLIE', tile(16, 0)],
  ['OBJ_BULLET', tile(144, 60)],
  ['OBJ_EXPLOSION', tile(64, 0)],
  ['OBJ_BRIDGE', tile(176, 156)],
  ['OBJ_START_POSITION', tile(128, 156)],
  ['OBJ_ROBOT', tile(0, 120)],
  ['OBJ_ANDROID_EGG', tile(208, 216)],
  ['OBJ_ANDROID', tile(176, 120)],
  ['OBJ_SHARK', tile(126, 120)],
  ['OBJ_GROUND_NEST', tile(240, 24)],
  ['OBJ_WATCHER', tile(80, 60)],
  ['OBJ_ISOLATOR', tile(240, 0)],
  ['OBJ_ISOLATOR_SOFT', tile(128, 132)],
  ['OBJ_ISOLATOR_WATER', tile(112, 156)],
  ['OBJ_WATER_PLANT', tile(144, 72)],
  ['OBJ_ELECTRIC_FENCE', tile(64, 12)],
  ['OBJ_ELECTRIC_FENCE_OFF', tile(96, 156)],
  ['OBJ_SKULL', tile(80, 12)],
  ['OBJ_WALL', tile(160, 0)],
  ['OBJ_WALL_NE', tile(176, 0)],
  ['OBJ_WALL_SW', tile(192, 0)],
  ['OBJ_WALL_SE', tile(208, 0)],
  ['OBJ_WALL_NW', tile(224, 0)],
  ['OBJ_WALL_BLACK', tile(48, 132)],
  ['OBJ_WALL_BLACK_NE', tile(64, 132)],
  ['OBJ_WALL_BLACK_SW', tile(80, 132)],
  ['OBJ_WALL_BLACK_SE', tile(96, 132)],
  ['OBJ_WALL_BLACK_NW', tile(112, 132)],
  ['OBJ_WALL_HARD', tile(160, 12)],
  ['OBJ_ROOM_EXIT', tile(0, 12)],
  ['OBJ_BANK', tile(48, 12)],
  ['OBJ_GOLD', tile(96, 12)],
  ['OBJ_PLATIN', tile(128, 12)],
  ['OBJ_CLOCK', tile(176, 12)],
  ['OBJ_NOTICE', tile(208, 12)],
  ['OBJ_TREE', tile(80, 24)],
  ['OBJ_CLONE', tile(128, 60)],
  ['OBJ_DOPPELGANGER_ITEM', tile(160, 132)],
  ['OBJ_DOPPELGANGER', tile(16, 0)],
  ['OBJ_DIAMOND#0', tile(160, 24)],
  ['OBJ_DIAMOND#1', tile(176, 24)],
  ['OBJ_SLING', tile(240, 60)],
  ['OBJ_MOUNTAIN_PATH', tile(160, 264)],
  ['OBJ_BARRIER', tile(240, 96)],
  ['OBJ_ELEXIR', tile(224, 24)],
  ['OBJ_GARLIC', tile(192, 24)],
  ['OBJ_NPC', tile(128, 276)],
  ['OBJ_DEALER', tile(64, 276)],
  ['OBJ_STAIRS_UP', tile(224, 108)],
  ['OBJ_STAIRS_DOWN', tile(240, 108)],
  ['OBJ_ACID', tile(208, 24)],
  ['OBJ_WALL_DISSOLVE', tile(64, 60)],
  ['OBJ_WALL_SAND_DISSOLVE', tile(128, 168)],
  ['OBJ_SAND_WALL', tile(32, 120)],
  ['OBJ_SAND_WALL_NE', tile(48, 120)],
  ['OBJ_SAND_WALL_SW', tile(64, 120)],
  ['OBJ_SAND_WALL_SE', tile(80, 120)],
  ['OBJ_SAND_WALL_NW', tile(96, 120)],
  ['OBJ_SAND_WALL_HARD', tile(160, 72)],
  ['OBJ_SCORPION', tile(176, 168)],
  ['OBJ_SHOVEL', tile(192, 132)],
  ['OBJ_SPOT', tile(224, 84)],
  ['OBJ_LAMP', tile(144, 132)],
  ['OBJ_TORCH', tile(80, 348)],
  ['OBJ_KNIFE', tile(48, 168)],
  ['OBJ_SICKLE', tile(240, 228)],
  ['OBJ_SEED', tile(240, 216)],
  ['OBJ_PLANT', tile(96, 312)],
  ['OBJ_PLANT_GROWING', tile(96, 312)],
  ['OBJ_GRATE', tile(240, 84)],
  ['OBJ_EXCLAMATION_MARK', tile(192, 12)],
  ['OBJ_OVERALL', tile(176, 132)],
  ['OBJ_FLIPPERS', tile(96, 144)],
  ['OBJ_WATER_SHALLOW', tile(0, 72)],
  ['OBJ_WATER_DEEP', tile(16, 72)],
  ['OBJ_WATER_NW', tile(80, 72)],
  ['OBJ_WATER_SW', tile(96, 72)],
  ['OBJ_WATER_NE', tile(112, 72)],
  ['OBJ_WATER_SE', tile(128, 72)],
  ['OBJ_WATER_DEADLY', tile(48, 72)],
  ['OBJ_ICE_DEADLY', tile(0, 180)],
  ['OBJ_ICE_BLOCK', tile(144, 324)],
  ['OBJ_WOOD_PATH', tile(112, 252)],
  ['OBJ_SHOES', tile(112, 144)],
  ['OBJ_COMPASS', tile(176, 252)],
  ['OBJ_BEDROCK_PATH', tile(240, 180)],
  ['OBJ_PATH', tile(224, 120)],
  ['OBJ_ELECTRIC_DOOR_0', tile(0, 336)],
  ['OBJ_ELECTRIC_DOOR_1', tile(16, 336)],
  ['OBJ_ELECTRIC_FLOOR_PLATE_0', tile(32, 336)],
  ['OBJ_ELECTRIC_FLOOR_PLATE_1', tile(48, 336)],
  ['OBJ_ROBOT_FACTORY_0', tile(0, 324)],
  ['OBJ_ROBOT_FACTORY_1', tile(16, 324)],
  ['OBJ_TARGET', tile(64, 336)],
  ['OBJ_MIRROR_0', tile(32, 324)],
  ['OBJ_MIRROR_1', tile(48, 324)],
]);

export function spriteFor(id) {
  if (exactSprites.has(id)) return exactSprites.get(id);
  if (id.startsWith('OBJ_DOOR#')) return tile(numberAfterHash(id) * 16, 36);
  if (id.startsWith('OBJ_KEY#')) return tile(numberAfterHash(id) * 16, 48);
  if (id.startsWith('OBJ_MAGNET#')) return tile(224 + numberAfterHash(id) * 16, 12);
  if (id.startsWith('OBJ_MUNITION#')) return tile(144 + numberAfterHash(id) * 16, 60);
  if (id.startsWith('OBJ_GOAL_')) {
    const index = numberAfter(id, 'OBJ_GOAL_');
    return tile(160 + (index % 3) * 16, 216 + Math.floor(index / 3) * 12);
  }
  if (id.startsWith('OBJ_ROOF_')) {
    const index = numberAfter(id, 'OBJ_ROOF_');
    if (index <= 8) {
      const coords = [[0,132],[0,144],[16,132],[16,144],[32,132],[32,144],[48,144],[64,144],[80,144]];
      return tile(...coords[index]);
    }
    const roofIndex = index - 9;
    return tile(208 + (roofIndex % 3) * 16, 324 + Math.floor(roofIndex / 3) * 12);
  }
  if (id.startsWith('OBJ_SHADOW#')) return tile(48 + numberAfterHash(id) * 16, 156);
  if (id.startsWith('OBJ_SAND#')) return tile(numberAfterHash(id) * 16, 24);
  if (id.startsWith('OBJ_TUNNEL#')) return tile(192 + numberAfterHash(id) * 16, 72);
  if (id.startsWith('OBJ_HARD_SAND_')) {
    const index = numberAfter(id, 'OBJ_HARD_SAND_');
    const coords = [[208,144],[224,144],[240,144],[208,156],[224,156],[240,156],[224,168],[240,168]];
    return tile(...coords[index]);
  }
  if (id.startsWith('OBJ_SAND_DECO_')) return tile(208 + numberAfter(id, 'OBJ_SAND_DECO_') * 16, 132);
  if (id.startsWith('OBJ_SAND_PLANT_')) return tile(numberAfter(id, 'OBJ_SAND_PLANT_') * 16, 168);
  if (id.startsWith('OBJ_RING#')) return tile(numberAfterHash(id) * 16, 276);
  if (id.startsWith('OBJ_ARROW_')) return tile(96 + numberAfter(id, 'OBJ_ARROW_') * 16, 24);
  if (id.startsWith('OBJ_BAGPACK#')) return tile(128 + numberAfterHash(id) * 16, 144);
  if (id.startsWith('OBJ_FOOD#')) return tile(192 + numberAfterHash(id) * 16, 252);
  if (id.startsWith('OBJ_TELEPORT_START_')) return tile(numberAfter(id, 'OBJ_TELEPORT_START_') * 48, 312);
  if (id.startsWith('OBJ_TELEPORT_END_')) return tile(16 + numberAfter(id, 'OBJ_TELEPORT_END_') * 48, 312);
  if (id.startsWith('OBJ_BUCKET#')) return tile(144 + numberAfterHash(id) * 16, 156);
  if (id.startsWith('OBJ_ICE_')) return tile(64 + numberAfter(id, 'OBJ_ICE_') * 16, 324);
  if (id.startsWith('OBJ_THERMOPLATE_')) return tile(160 + numberAfter(id, 'OBJ_THERMOPLATE_') * 16, 324);
  if (id.startsWith('OBJ_WOOD_')) return tile(numberAfter(id, 'OBJ_WOOD_') * 16, 252);
  if (id.startsWith('OBJ_GRASS_')) return tile(128 + numberAfter(id, 'OBJ_GRASS_') * 16, 252);
  if (id.startsWith('OBJ_CAVE_')) return tile(32 + numberAfter(id, 'OBJ_CAVE_') * 16, 180);
  if (id.startsWith('OBJ_BEDROCK_')) {
    const index = numberAfter(id, 'OBJ_BEDROCK_');
    return index < 9 ? tile(index * 16, 264) : tile(240, 264);
  }
  if (id.startsWith('OBJ_MOUNTAIN_')) {
    const index = numberAfter(id, 'OBJ_MOUNTAIN_');
    if (index < 4) return tile(176 + index * 16, 264);
    if (index < 12) return tile(128 + (index - 4) * 16, 288);
    return tile(128 + (index - 12) * 16, 300);
  }
  if (id.startsWith('OBJ_SHOOTER_')) return tile(80 + numberAfter(id, 'OBJ_SHOOTER_') * 16, 336);
  return tile(0, 0);
}

export function subtypeSprite(subType) {
  const sprites = {
    1: tile(0, 24),
    2: tile(0, 252),
    3: tile(80, 252),
    4: tile(96, 252),
    5: tile(144, 252),
    6: tile(176, 264),
    7: tile(192, 264),
    8: tile(208, 264),
    9: tile(224, 264),
    10: tile(224, 120),
    11: tile(160, 0),
    12: tile(48, 132),
    13: tile(160, 12),
    14: tile(32, 120),
    15: tile(160, 72),
    16: tile(0, 72),
    17: tile(16, 72),
    18: tile(144, 264),
  };
  return sprites[subType] ?? null;
}

const floorPatterns = [
  /^OBJ_(?:WALL|SAND_WALL)/,
  /^OBJ_(?:MOUNTAIN|HARD_SAND|SAND_DECO|SAND#|TUNNEL#|WATER_|ICE_|WOOD_|GRASS_|CAVE_|BEDROCK_)/,
  /^OBJ_(?:MOUNTAIN_PATH|BEDROCK_PATH|WOOD_PATH|PATH|SHADOW#|ELECTRIC_FLOOR_PLATE|THERMOPLATE)/,
];

export function layerFor(id) {
  if (id.startsWith('OBJ_ROOF_')) return 30;
  if (id === 'OBJ_BRIDGE') return 20;
  if (id === 'OBJ_WATCHER' || id.startsWith('OBJ_SHOOTER_')) return 15;
  if (floorPatterns.some((pattern) => pattern.test(id))) return 0;
  if (['OBJ_CHARLIE', 'OBJ_ROBOT', 'OBJ_ANDROID', 'OBJ_SHARK', 'OBJ_SCORPION', 'OBJ_NPC', 'OBJ_DEALER'].includes(id)) return 11;
  return 10;
}

const collectiblePatterns = [
  /^OBJ_(?:ACID|BAGPACK#|BUCKET#|CLOCK|CLONE$|COMPASS|ELEXIR|EXCLAMATION_MARK|FLIPPERS|FOOD#|GARLIC|KEY#|KNIFE|LAMP|MAGNET#|MUNITION#|OVERALL|RING#|SEED|SHOES|SHOVEL|SICKLE|SLING|TREE$)/,
  /^OBJ_(?:DIAMOND#|DOPPELGANGER_ITEM|GOLD$|NOTICE$|PLATIN$)/,
];

export function isCollectible(id) {
  return collectiblePatterns.some((pattern) => pattern.test(id));
}

export function isTerrain(id) {
  return layerFor(id) === 0;
}

export function isRoof(id) {
  return id.startsWith('OBJ_ROOF_');
}

export function isEnemy(id) {
  return ['OBJ_ROBOT', 'OBJ_ANDROID', 'OBJ_SHARK', 'OBJ_SCORPION'].includes(id);
}

export function isPushable(id) {
  return id === 'OBJ_ISOLATOR' || id === 'OBJ_ICE_BLOCK';
}

export function isEntityPushable(id) {
  return [
    'OBJ_ISOLATOR', 'OBJ_ISOLATOR_SOFT', 'OBJ_ICE_BLOCK',
    'OBJ_ELECTRIC_FENCE', 'OBJ_ELECTRIC_FENCE_OFF',
  ].includes(id);
}

export function isPassThroughDynamic(id) {
  return id === 'OBJ_BULLET'
    || id === 'OBJ_EXPLOSION'
    || id === 'OBJ_PLANT_GROWING'
    || id === 'OBJ_TORCH'
    || id === 'OBJ_WATCHER'
    || id.startsWith('OBJ_SHOOTER_');
}

export function isWater(id) {
  return [
    'OBJ_WATER_SHALLOW', 'OBJ_WATER_DEEP', 'OBJ_WATER_NW', 'OBJ_WATER_SW',
    'OBJ_WATER_NE', 'OBJ_WATER_SE', 'OBJ_WATER_DEADLY',
  ].includes(id);
}

export function isBlockingTerrain(id, subType = 0) {
  if (subType >= 2 && subType <= 4) return true;
  if (subType >= 6 && subType <= 9) return true;
  if (subType >= 11 && subType <= 16) return true;
  return /^(OBJ_(?:WALL|SAND_WALL|MOUNTAIN_|HARD_SAND_|WOOD_|CAVE_|BEDROCK_))/.test(id)
    && !/(?:_PATH)$/.test(id);
}

export function isStaticBlocker(id, object, state) {
  if (isBlockingTerrain(id, object.subType)) return true;
  if (id === 'OBJ_PLANT' || id === 'OBJ_SAND_PLANT_0') return true;
  if (id.startsWith('OBJ_DOOR#')) return !state.inventory.has(`OBJ_KEY#${object.type}`);
  if (id === 'OBJ_ELECTRIC_DOOR_0') return true;
  if (id === 'OBJ_ELECTRIC_DOOR_1') return false;
  if (id === 'OBJ_BARRIER' || id === 'OBJ_ROOM_EXIT') {
    return (state.roomRobotCount ?? state.roomEnemyCount) > 0 && (state.treeTimer ?? 0) <= 0;
  }
  if (['OBJ_ANDROID_EGG', 'OBJ_GRATE', 'OBJ_MIRROR_0', 'OBJ_MIRROR_1', 'OBJ_ROBOT_FACTORY_0', 'OBJ_ROBOT_FACTORY_1', 'OBJ_TARGET', 'OBJ_WALL_DISSOLVE', 'OBJ_WALL_SAND_DISSOLVE'].includes(id)) return true;
  if (id === 'OBJ_BANK') return state.gold <= 0;
  if (id === 'OBJ_ISOLATOR' || id === 'OBJ_ICE_BLOCK') return true;
  if (id.startsWith('OBJ_GOAL_')) return false;
  return false;
}

export function inventoryLabel(id, text) {
  const group = id.split('#')[0];
  return text(id, text(group, group.replace(/^OBJ_/, '').replaceAll('_', ' ')));
}
