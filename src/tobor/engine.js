import {
  ROOM_HEIGHT,
  ROOM_WIDTH,
  isBlockingTerrain,
  isCollectible,
  isEntityPushable,
  isEnemy,
  isPassThroughDynamic,
  isPushable,
  isRoof,
  isStaticBlocker,
  isTerrain,
  isWater,
} from './object-registry.js';

const SAVE_KEY = 'rokor-tobor-save-v2';
const CLOCK_SAVE_KEY = 'rokor-tobor-clock-save-v1';
const SETTINGS_KEY = 'rokor-tobor-settings-v2';
const EXPLOSION_DURATION = 2.5;

export const SPEED_PRESETS = {
  verySlow: { label: 'Sehr langsam', tilesPerSecond: 4 },
  slow: { label: 'Langsam', tilesPerSecond: 6 },
  normal: { label: 'Normal', tilesPerSecond: 8 },
  fast: { label: 'Schnell', tilesPerSecond: 10 },
  veryFast: { label: 'Sehr schnell', tilesPerSecond: 12 },
};

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIAGONAL_DIRECTIONS = {
  northwest: { x: -1, y: -1 },
  northeast: { x: 1, y: -1 },
  southwest: { x: -1, y: 1 },
  southeast: { x: 1, y: 1 },
};
const ALL_MOVEMENT_DIRECTIONS = { ...DIRECTIONS, ...DIAGONAL_DIRECTIONS };
const DRIFT_DIRECTIONS = ['down', 'up', 'left', 'right', 'northwest', 'northeast', 'southwest', 'southeast'];
const PLANT_DIRECTIONS = [
  ['left', DIRECTIONS.left],
  ['right', DIRECTIONS.right],
  ['up', DIRECTIONS.up],
  ['down', DIRECTIONS.down],
];
const AI_DIRECTIONS = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
];
const isDiagonalDirection = (direction) => direction.x !== 0 && direction.y !== 0;
const directionParts = (direction) => {
  if (!isDiagonalDirection(direction)) return [];
  return [
    direction.y < 0 ? DIRECTIONS.up : DIRECTIONS.down,
    direction.x < 0 ? DIRECTIONS.left : DIRECTIONS.right,
  ];
};
const rotateAiDirection = (direction, steps) => {
  const index = AI_DIRECTIONS.findIndex((entry) => entry.x === direction.x && entry.y === direction.y);
  if (index < 0) return { x: 0, y: 0 };
  return AI_DIRECTIONS[(index + steps + 80) % AI_DIRECTIONS.length];
};
const randomAiDirection = () => AI_DIRECTIONS[Math.floor(Math.random() * AI_DIRECTIONS.length)];
const weightedDodgeDirection = (direction) => {
  const chance = Math.random() * 100;
  const rotation = chance < 40 ? 4
    : chance < 50 ? 3
      : chance < 60 ? -3
        : chance < 70 ? 2
          : chance < 80 ? -2
            : chance < 90 ? 1
              : -1;
  return rotateAiDirection(direction, rotation);
};
const pickTwoRandom = (values) => {
  if (values.length <= 1) return values.slice();
  const remaining = values.slice();
  const first = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
  const second = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
  return [first, second];
};
const VECTOR_TO_DIRECTION = new Map([
  ['0,-1', 'up'],
  ['0,1', 'down'],
  ['-1,0', 'left'],
  ['1,0', 'right'],
]);
const SHOOTER_DIRECTIONS = ['down', 'left', 'up', 'right'];
const BULLET_SPEED = 4;
const MAX_MUNITION = 21;
const PICKUP_POINTS = {
  OBJ_ACID: 200,
  OBJ_BUCKET: 1000,
  OBJ_CLOCK: 200,
  OBJ_CLONE: 100,
  OBJ_COMPASS: 1500,
  OBJ_ELEXIR: 100,
  OBJ_EXCLAMATION_MARK: 1500,
  OBJ_FLIPPERS: 3000,
  OBJ_FOOD: 500,
  OBJ_GARLIC: 100,
  OBJ_KEY: 500,
  OBJ_LAMP: 2000,
  OBJ_MAGNET: 500,
  OBJ_OVERALL: 1500,
  OBJ_SEED: 500,
  OBJ_SHOES: 1500,
  OBJ_SHOVEL: 200,
  OBJ_SICKLE: 1500,
  OBJ_SLING: 1500,
  OBJ_TREE: 100,
};

const deepClone = (value) => structuredClone(value);
const cellKey = (x, y) => `${x},${y}`;

export class ToborEngine {
  constructor(gameData, eventSink = () => {}) {
    this.game = gameData;
    this.eventSink = eventSink;
    this.rooms = new Map();
    this.currentRoom = null;
    this.player = { x: 0, y: 0, facing: 'down', moving: false, visible: true, walkPhase: 0 };
    this.inventory = new Map();
    this.visitedRooms = new Set();
    this.firstUse = new Set();
    this.gold = 0;
    this.points = 0;
    this.lives = 3;
    this.diamonds = 0;
    this.garlic = 0;
    this.food = 0;
    this.won = false;
    this.lost = false;
    this.paused = false;
    this.heldDirections = [];
    this.speedPreset = this.loadSpeedPreset();
    this.motion = null;
    this.death = null;
    this.lastDirection = null;
    this.inputLockedUntil = 0;
    this.roomVersion = 0;
    this.time = 0;
    this.respawn = null;
    this.spawnSequence = 0;
    this.switchSequence = 0;
    this.autosaveTimer = null;
    this.resetRooms();
  }

  resetRooms() {
    this.rooms.clear();
    for (const [id, source] of this.game.rooms) {
      const room = {
        ...source,
        treeTimer: 0,
        objects: source.objects.map((object) => ({ ...deepClone(object), alive: true })),
      };
      this.rooms.set(id, room);
    }
  }

  loadSpeedPreset() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').speedPreset;
      if (SPEED_PRESETS[value]) return value;
    } catch {
      // Storage is optional.
    }
    return 'normal';
  }

  setSpeedPreset(preset) {
    if (!SPEED_PRESETS[preset]) return;
    this.speedPreset = preset;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ speedPreset: preset }));
    } catch {
      // Storage is optional.
    }
    this.emit('status', { message: `Bewegung: ${SPEED_PRESETS[preset].label}` });
  }

  newGame() {
    this.resetRooms();
    this.inventory.clear();
    this.visitedRooms.clear();
    this.firstUse.clear();
    this.gold = 0;
    this.points = 0;
    this.lives = 3;
    this.diamonds = 0;
    this.garlic = 0;
    this.food = 0;
    this.won = false;
    this.lost = false;
    this.motion = null;
    this.death = null;
    this.heldDirections = [];

    const start = [...this.rooms.values()]
      .flatMap((room) => room.objects.map((object) => ({ room, object })))
      .find(({ object }) => object.id === 'OBJ_START_POSITION');
    if (!start) throw new Error('OBJ_START_POSITION fehlt in rooms.json.');

    this.currentRoom = start.room;
    this.player.x = start.object.x;
    this.player.y = start.object.y;
    this.player.facing = 'down';
    this.player.moving = false;
    this.player.visible = true;
    start.object.alive = false;
    this.enterRoom(start.room, { announce: true });
    this.save();
  }

  hasSave() {
    return this.hasStoredSave(SAVE_KEY);
  }

  hasClockSave() {
    return this.hasStoredSave(CLOCK_SAVE_KEY);
  }

  hasStoredSave(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return key !== SAVE_KEY || (!data.lost && Number(data.lives ?? 1) > 0);
    } catch {
      return false;
    }
  }

  clearAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // The game can still end normally when browser storage is unavailable.
    }
  }

  save({ clock = false } = {}) {
    if (!this.currentRoom) return false;
    if (this.lost && !clock) {
      this.clearAutosave();
      return false;
    }
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    const changedRooms = {};
    for (const [id, room] of this.rooms) {
      const source = this.game.rooms.get(id);
      const persistentObjects = room.objects.filter((object) => object.id !== 'OBJ_EXPLOSION');
      const changed = persistentObjects.some((object, index) => {
        const original = source.objects[index];
        return !original || object.alive !== original.alive || object.id !== original.id
          || object.type !== original.type || object.flag !== original.flag
          || object.subType !== original.subType || object.drift !== original.drift
          || object.content !== original.content || object.x !== original.x || object.y !== original.y;
      });
      if (changed || room.treeTimer > 0) changedRooms[id] = { objects: persistentObjects, treeTimer: room.treeTimer };
    }
    const savedPlayer = this.death && this.respawn?.roomId === this.currentRoom.id
      ? { ...this.player, x: this.respawn.x, y: this.respawn.y, moving: false, visible: true }
      : this.player;
    const data = {
      version: 4,
      savedAt: Date.now(),
      saveType: clock ? 'clock' : 'auto',
      roomId: this.currentRoom.id,
      player: savedPlayer,
      inventory: [...this.inventory.entries()],
      visitedRooms: [...this.visitedRooms],
      firstUse: [...this.firstUse],
      gold: this.gold,
      points: this.points,
      lives: this.lives,
      diamonds: this.diamonds,
      garlic: this.garlic,
      food: this.food,
      won: this.won,
      lost: this.lost,
      changedRooms,
    };
    try {
      const serialized = JSON.stringify(data);
      if (clock) localStorage.setItem(CLOCK_SAVE_KEY, serialized);
      localStorage.setItem(SAVE_KEY, serialized);
      return true;
    } catch {
      // The running game remains usable without storage.
      return false;
    }
  }

  scheduleAutosave() {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      this.save();
    }, 220);
    this.autosaveTimer.unref?.();
  }

  load() {
    return this.loadStoredSave(SAVE_KEY);
  }

  loadClockSave() {
    return this.loadStoredSave(CLOCK_SAVE_KEY);
  }

  loadStoredSave(key) {
    let data;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch {
      return false;
    }
    if (![2, 3, 4].includes(data.version) || !this.rooms.has(data.roomId)) return false;
    if (key === SAVE_KEY && (data.lost || Number(data.lives ?? 1) <= 0)) {
      this.clearAutosave();
      return false;
    }
    this.resetRooms();
    for (const [roomId, savedRoom] of Object.entries(data.changedRooms ?? {})) {
      if (!this.rooms.has(roomId)) continue;
      const room = this.rooms.get(roomId);
      if (Array.isArray(savedRoom)) room.objects = savedRoom;
      else {
        room.objects = savedRoom.objects ?? room.objects;
        room.treeTimer = savedRoom.treeTimer ?? 0;
      }
    }
    for (const room of this.rooms.values()) {
      for (const object of room.objects) {
        if (object.id === 'OBJ_START_POSITION') object.alive = false;
      }
    }
    this.currentRoom = this.rooms.get(data.roomId);
    this.player = { ...this.player, ...data.player, moving: false, visible: true };
    this.inventory = new Map(data.inventory ?? []);
    this.visitedRooms = new Set(data.visitedRooms ?? []);
    this.firstUse = new Set(data.firstUse ?? []);
    this.gold = data.gold ?? 0;
    this.points = data.points ?? 0;
    this.lives = data.lives ?? 3;
    this.diamonds = data.diamonds ?? 0;
    this.garlic = data.garlic ?? 0;
    this.food = data.food ?? 0;
    this.won = Boolean(data.won);
    this.lost = Boolean(data.lost);
    this.motion = null;
    this.death = null;
    this.enterRoom(this.currentRoom, { announce: true, processCell: false });
    return true;
  }

  emit(type, detail = {}) {
    this.eventSink({ type, ...detail });
  }

  text(key, fallback = key) {
    return this.game.text(key, fallback);
  }

  roomObjects(room = this.currentRoom) {
    return room.objects.filter((object) => object.alive !== false);
  }

  objectsAt(x, y, room = this.currentRoom) {
    return this.roomObjects(room).filter((object) => object.x === x && object.y === y);
  }

  get roomEnemyCount() {
    return this.roomObjects().filter((object) => isEnemy(object.id)).length;
  }

  get roomRobotCount() {
    return this.roomObjects().filter((object) => object.id === 'OBJ_ROBOT' || object.id === 'OBJ_ANDROID').length;
  }

  inventoryHas(id) {
    return this.inventory.has(id);
  }

  inventoryCount(id) {
    return this.inventory.get(id)?.count ?? 0;
  }

  addInventory(id, content = null, count = 1) {
    const current = this.inventory.get(id) ?? { id, count: 0, content };
    current.count += count;
    if (content != null) current.content = content;
    this.inventory.set(id, current);
  }

  removeInventory(id, count = 1) {
    const item = this.inventory.get(id);
    if (!item) return false;
    item.count -= count;
    if (item.count <= 0) this.inventory.delete(id);
    return true;
  }

  ammunitionCount() {
    let total = 0;
    for (const [id, item] of this.inventory) {
      if (!id.startsWith('OBJ_MUNITION#')) continue;
      total += item.count * (Number(id.split('#')[1]) + 1);
    }
    return total;
  }

  setAmmunitionCount(requestedCount) {
    for (const id of [...this.inventory.keys()]) {
      if (id.startsWith('OBJ_MUNITION#')) this.inventory.delete(id);
    }
    const rest = Math.max(0, requestedCount - MAX_MUNITION);
    let count = Math.min(MAX_MUNITION, Math.max(0, requestedCount));
    for (let stackSize = 6; stackSize >= 1; stackSize -= 1) {
      const stackCount = Math.floor(count / stackSize);
      if (!stackCount) continue;
      this.addInventory(`OBJ_MUNITION#${stackSize - 1}`, null, stackCount);
      count -= stackCount * stackSize;
    }
    return rest;
  }

  addAmmunition(count) {
    return this.setAmmunitionCount(this.ammunitionCount() + count);
  }

  removeAmmunition(count = 1) {
    const available = this.ammunitionCount();
    if (available < count) return false;
    this.setAmmunitionCount(available - count);
    return true;
  }

  pressDirection(direction) {
    if (!DIRECTIONS[direction] || this.paused || this.won || this.lost) return;
    if (!this.heldDirections.includes(direction)) this.heldDirections.push(direction);
    if (!this.motion) this.tryStartMove(this.preferredHeldDirection());
  }

  releaseDirection(direction) {
    this.heldDirections = this.heldDirections.filter((entry) => entry !== direction);
  }

  clearInput() {
    this.heldDirections = [];
  }

  preferredHeldDirection() {
    return ['left', 'right', 'up', 'down'].find((direction) => this.heldDirections.includes(direction)) ?? null;
  }

  update(deltaSeconds) {
    this.time += deltaSeconds;
    if (this.death) {
      this.updatePlayerDeath(deltaSeconds);
      return;
    }
    if (this.paused || this.won || this.lost || !this.currentRoom) return;
    this.garlic = Math.max(0, this.garlic - deltaSeconds);
    this.food = Math.max(0, this.food - deltaSeconds);
    if (this.currentRoom.treeTimer > 0) {
      this.currentRoom.treeTimer = Math.max(0, this.currentRoom.treeTimer - deltaSeconds);
      if (this.currentRoom.treeTimer === 0) this.roomVersion += 1;
    }
    this.updateSystems(deltaSeconds);
    this.updateActors(deltaSeconds);
    if (!this.motion) {
      const direction = this.preferredHeldDirection();
      if (direction) this.tryStartMove(direction);
      return;
    }
    if (this.motion.paused) return;

    const baseSpeed = SPEED_PRESETS[this.speedPreset].tilesPerSecond;
    const distance = deltaSeconds * baseSpeed * this.motion.speedFactor;
    this.motion.progress = Math.min(1, this.motion.progress + distance / (this.motion.distance ?? 1));
    const { fromX, fromY, toX, toY, progress } = this.motion;
    this.player.x = fromX + (toX - fromX) * progress;
    this.player.y = fromY + (toY - fromY) * progress;
    this.player.walkPhase += distance;

    if (this.motion.tunnel) {
      const remaining = (this.motion.distance ?? 0) * (1 - progress);
      const step = Math.floor(Math.max(0, remaining));
      while (step < this.motion.tunnelLastStep) {
        this.motion.tunnelLastStep -= 1;
        this.emit('sound', { name: 'tunnel-step', volume: 0.34 });
      }
    }

    if (progress >= 1) this.finishMove();
  }

  updateSystems(deltaSeconds) {
    const objectsAtStart = [...this.roomObjects()];
    const robotCountAtStart = objectsAtStart.filter((object) => object.id === 'OBJ_ROBOT' || object.id === 'OBJ_ANDROID').length;

    for (const object of objectsAtStart) {
      if (object.id.startsWith('OBJ_SHOOTER_') && object._reload > 0) {
        object._reload = Math.max(0, object._reload - deltaSeconds);
      }
      if (object.id === 'OBJ_ROBOT_FACTORY_1' && robotCountAtStart === 0) {
        this.spawnObject('OBJ_ROBOT', object.x, object.y, { justSpawned: true });
        this.roomVersion += 1;
      }
      if (object.id === 'OBJ_PLANT_GROWING') this.updateGrowingPlant(object, deltaSeconds);
      if (object.id === 'OBJ_ANDROID_EGG') this.updateAndroidEgg(object, deltaSeconds);
      if (object.id === 'OBJ_WATCHER') this.updateWatcher(object, deltaSeconds);
      if (object.id === 'OBJ_TORCH') this.updateTorch(object, deltaSeconds);
      if (object.id === 'OBJ_EXPLOSION') this.updateExplosion(object, deltaSeconds);
      if (object.id === 'OBJ_WALL_DISSOLVE' || object.id === 'OBJ_WALL_SAND_DISSOLVE') {
        object._dissolveTime = (object._dissolveTime ?? 5) - deltaSeconds;
        if (object._dissolveTime <= 0) {
          object.alive = false;
          this.roomVersion += 1;
        }
      }
    }
    this.updateBullets(deltaSeconds);
  }

  updateGrowingPlant(plant, deltaSeconds) {
    const speedScale = SPEED_PRESETS[this.speedPreset].tilesPerSecond / 8;
    const growInterval = Math.max(0.25, 2 - speedScale);
    plant._growTime = (plant._growTime ?? growInterval) - deltaSeconds;
    while (plant.alive && plant._growTime <= 0) {
      plant._growTime += growInterval;
      if ([0, 1, 3, 4, 6, 7, 9, 10].includes(plant.type)) {
        plant.type += 1;
      } else if ([2, 5, 8, 11].includes(plant.type)) {
        this.finishGrowingPlant(plant);
      } else {
        plant.alive = false;
      }
    }
  }

  finishGrowingPlant(plant) {
    const { x, y } = plant;
    plant.alive = false;
    this.spawnObject('OBJ_PLANT', x, y);
    const openDirections = pickTwoRandom(this.openPlantDirections(x, y));
    const startTypes = { left: 0, up: 3, right: 6, down: 9 };
    for (const target of openDirections) {
      this.spawnObject('OBJ_PLANT_GROWING', target.x, target.y, { type: startTypes[target.name] });
    }
    this.roomVersion += 1;
  }

  spawnPlantShoots(x, y) {
    const startTypes = { left: 0, up: 3, right: 6, down: 9 };
    const openDirections = pickTwoRandom(this.openPlantDirections(x, y));
    for (const target of openDirections) {
      this.spawnObject('OBJ_PLANT_GROWING', target.x, target.y, { type: startTypes[target.name] });
    }
  }

  openPlantDirections(x, y) {
    const playerX = Math.round(this.player.x);
    const playerY = Math.round(this.player.y);
    return PLANT_DIRECTIONS
      .map(([name, direction]) => ({ name, x: x + direction.x, y: y + direction.y }))
      .filter((target) => target.x >= 0 && target.x < ROOM_WIDTH && target.y >= 0 && target.y < ROOM_HEIGHT)
      .filter((target) => this.objectsAt(target.x, target.y).length === 0)
      .filter((target) => target.x !== playerX || target.y !== playerY);
  }

  updateAndroidEgg(egg, deltaSeconds) {
    egg._eggTime = (egg._eggTime ?? 1) - deltaSeconds;
    while (egg.alive && egg._eggTime < 0) {
      egg._eggTime += 1;
      if (egg.type > 30 + Math.floor(Math.random() * 10) && egg.type < 100) egg.type = 100;
      else if (egg.type === 100) egg.type = 101;
      else if (egg.type === 101) {
        this.spawnObject('OBJ_ANDROID', egg.x, egg.y, { justSpawned: true });
        egg.alive = false;
        this.roomVersion += 1;
      } else egg.type += 1;
    }
  }

  updateWatcher(watcher, deltaSeconds) {
    watcher._watchTimer = (watcher._watchTimer ?? 0) - deltaSeconds;
    if (watcher._watchTimer <= 0.5) {
      const distance = Math.hypot(this.player.x - watcher.x, this.player.y - watcher.y);
      const sharesCell = this.objectsAt(watcher.x, watcher.y).some((object) => object !== watcher);
      if (!sharesCell) watcher.visible = distance <= 4;
      if (distance <= 1.5) {
        this.spawnObject('OBJ_ROBOT', watcher.x, watcher.y, { justSpawned: true });
        watcher.alive = false;
        this.roomVersion += 1;
        return;
      }
    }
    if (watcher._watchTimer <= 0) {
      watcher._watchTimer += 1;
      watcher._frame = Math.floor(Math.random() * 3);
    }
  }

  updateTorch(torch, deltaSeconds) {
    torch._torchTime = (torch._torchTime ?? 10) - deltaSeconds;
    while (torch._torchTime < 0) {
      torch._torchTime += 10;
      if (torch.type > 0 && torch.type < 10) torch.type += 1;
    }
  }

  updateExplosion(explosion, deltaSeconds) {
    if (explosion.alive === false) return false;
    explosion._explosionTime = (explosion._explosionTime ?? 0) + deltaSeconds;
    if (explosion._explosionTime < (explosion._explosionDuration ?? EXPLOSION_DURATION)) return true;
    explosion.alive = false;
    this.roomVersion += 1;
    return false;
  }

  spawnExplosion(x, y, overrides = {}) {
    return this.spawnObject('OBJ_EXPLOSION', x, y, {
      _explosionTime: 0,
      _explosionDuration: EXPLOSION_DURATION,
      ...overrides,
    });
  }

  updateBullets(deltaSeconds) {
    const speedScale = SPEED_PRESETS[this.speedPreset].tilesPerSecond / 8;
    for (const bullet of [...this.roomObjects()].filter((object) => object.id === 'OBJ_BULLET')) {
      let distance = deltaSeconds * (bullet._bulletSpeed ?? BULLET_SPEED) * speedScale;
      while (bullet.alive && distance > 0) {
        const remaining = 1 - (bullet._bulletProgress ?? 0);
        const step = Math.min(distance, remaining);
        bullet._bulletProgress = (bullet._bulletProgress ?? 0) + step;
        bullet.renderX = bullet.x + bullet._direction.x * bullet._bulletProgress;
        bullet.renderY = bullet.y + bullet._direction.y * bullet._bulletProgress;
        distance -= step;
        if (bullet._bulletProgress < 1) continue;

        bullet.x += bullet._direction.x;
        bullet.y += bullet._direction.y;
        bullet.renderX = bullet.x;
        bullet.renderY = bullet.y;
        bullet._bulletProgress = 0;
        bullet._traveled = (bullet._traveled ?? 0) + 1;
        if (bullet.x < 0 || bullet.x >= ROOM_WIDTH || bullet.y < 0 || bullet.y >= ROOM_HEIGHT) {
          bullet.alive = false;
          break;
        }
        this.resolveBulletCell(bullet);
        if (bullet.alive && bullet._traveled >= bullet._maxDistance) this.dropBullet(bullet);
      }
    }
  }

  fireBullet(x, y, direction, speed = BULLET_SPEED) {
    const vector = typeof direction === 'string' ? DIRECTIONS[direction] : direction;
    if (!vector) return null;
    this.emit('sound', { name: 'shoot-bullet', volume: 0.34 });
    return this.spawnObject('OBJ_BULLET', x, y, {
      _direction: { x: vector.x, y: vector.y },
      _bulletSpeed: speed,
      _bulletProgress: 0,
      _traveled: 0,
      _maxDistance: 10 + Math.floor(Math.random() * 10),
      renderX: x,
      renderY: y,
    });
  }

  resolveBulletCell(bullet) {
    const objects = this.objectsAt(bullet.x, bullet.y).filter((object) => object !== bullet);
    const actors = objects.filter((object) => isEnemy(object.id) || ['OBJ_NPC', 'OBJ_DEALER', 'OBJ_DOPPELGANGER'].includes(object.id));
    if (bullet._traveled >= 1) {
      for (const actor of actors) {
        if (actor.id === 'OBJ_SCORPION' && actor.type <= 0) continue;
        actor.alive = false;
        this.spawnExplosion(actor.x, actor.y);
        bullet.alive = false;
      }
      if (!bullet.alive) {
        this.emit('sound', { name: 'explosion-enemy', volume: 0.42 });
        this.roomVersion += 1;
        return;
      }
    }

    for (const object of objects) {
      if (!bullet.alive || actors.includes(object)) continue;
      if (object.id === 'OBJ_BULLET' || object.id.startsWith('OBJ_MUNITION#')
        || ['OBJ_GRATE', 'OBJ_WATER_PLANT', 'OBJ_ISOLATOR_WATER'].includes(object.id)) continue;
      if (isPassThroughDynamic(object.id)) continue;
      if (isPushable(object.id) || object.id === 'OBJ_ISOLATOR_SOFT') {
        const direction = VECTOR_TO_DIRECTION.get(`${bullet._direction.x},${bullet._direction.y}`);
        if (direction) this.pushObject(object, direction);
        bullet.alive = false;
      } else if (object.id.startsWith('OBJ_TUNNEL#')) {
        bullet.alive = false;
      } else if (object.id === 'OBJ_ELECTRIC_FENCE' || object.id === 'OBJ_ELECTRIC_FENCE_OFF' || object.id === 'OBJ_SKULL') {
        object.alive = false;
        this.spawnExplosion(object.x, object.y);
        bullet.alive = false;
        this.roomVersion += 1;
      } else if (object.id === 'OBJ_TARGET') {
        this.switchFlag(object.flag, object);
        bullet.alive = false;
      } else if (object.id === 'OBJ_MIRROR_0' || object.id === 'OBJ_MIRROR_1') {
        const reflected = this.reflectBullet(bullet._direction, object.type === 1);
        this.fireBullet(bullet.x, bullet.y, reflected);
        bullet.alive = false;
      } else if (object.id === 'OBJ_ANDROID_EGG') {
        object.alive = false;
        this.spawnObject('OBJ_ROBOT', object.x, object.y, { justSpawned: true });
        bullet.alive = false;
        this.roomVersion += 1;
      } else if (isWater(object.id)) {
        if (object.subType > 0 && isBlockingTerrain('', object.subType)) bullet.alive = false;
      } else if (isTerrain(object.id)) {
        if (isBlockingTerrain(object.id, object.subType)) bullet.alive = false;
      } else {
        bullet.alive = false;
      }
    }
  }

  reflectBullet(direction, clockwise = true) {
    const { x, y } = direction;
    if (x === 0 && y === -1) return clockwise ? DIRECTIONS.left : DIRECTIONS.right;
    if (x === 0 && y === 1) return clockwise ? DIRECTIONS.right : DIRECTIONS.left;
    if (x === -1 && y === 0) return clockwise ? DIRECTIONS.up : DIRECTIONS.down;
    if (x === 1 && y === 0) return clockwise ? DIRECTIONS.down : DIRECTIONS.up;
    return null;
  }

  dropBullet(bullet) {
    const ammunition = this.objectsAt(bullet.x, bullet.y).find((object) => object.id.startsWith('OBJ_MUNITION#'));
    if (ammunition) {
      if (ammunition.type < 5) {
        ammunition.type += 1;
        ammunition.id = `OBJ_MUNITION#${ammunition.type}`;
      } else {
        this.spawnObject('OBJ_MUNITION#0', bullet.x, bullet.y, { type: 0 });
      }
    } else if (this.objectsAt(bullet.x, bullet.y).filter((object) => object !== bullet).length === 0) {
      this.spawnObject('OBJ_MUNITION#0', bullet.x, bullet.y, { type: 0 });
    }
    bullet.alive = false;
    this.roomVersion += 1;
  }

  updateActors(deltaSeconds) {
    const speedScale = SPEED_PRESETS[this.speedPreset].tilesPerSecond / 8;
    for (const actor of this.roomObjects().filter((object) => isEnemy(object.id) || ['OBJ_NPC', 'OBJ_DEALER', 'OBJ_DOPPELGANGER'].includes(object.id))) {
      if (actor.id === 'OBJ_NPC' || actor.id === 'OBJ_DEALER') {
        actor._interactionCooldown = Math.max(0, (actor._interactionCooldown ?? 2) - deltaSeconds);
      }
      if (actor.id === 'OBJ_SCORPION' && actor.type === 0) {
        actor._buriedTime = (actor._buriedTime ?? 5) - deltaSeconds;
        if (actor._buriedTime <= 0) actor.type = 1;
        else continue;
      }
      if (actor._motion) {
        actor._motion.progress = Math.min(1, actor._motion.progress + deltaSeconds * actor._motion.speed * speedScale);
        actor.renderX = actor._motion.fromX + (actor._motion.toX - actor._motion.fromX) * actor._motion.progress;
        actor.renderY = actor._motion.fromY + (actor._motion.toY - actor._motion.fromY) * actor._motion.progress;
        if (actor._motion.progress >= 1) {
          this.onLeaveCell(actor.x, actor.y, actor);
          actor.x = actor._motion.toX;
          actor.y = actor._motion.toY;
          actor.renderX = actor.x;
          actor.renderY = actor.y;
          actor._motion = null;
          this.onActorEntered(actor);
        }
        continue;
      }
      this.startActorMove(actor);
    }
  }

  startActorMove(actor) {
    if (actor.id === 'OBJ_SCORPION' && actor.type === 1
      && this.objectsAt(actor.x, actor.y).some((object) => object.id.startsWith('OBJ_SAND#'))
      && Math.random() < 0.25) {
      actor.type = 0;
      actor._buriedTime = 5 + Math.floor(Math.random() * 10);
      return;
    }

    if (actor.id === 'OBJ_DOPPELGANGER') {
      let direction = randomAiDirection();
      if (this.heldDirections.includes('left')) direction = DIRECTIONS.right;
      else if (this.heldDirections.includes('right')) direction = DIRECTIONS.left;
      else if (this.heldDirections.includes('up')) direction = DIRECTIONS.down;
      else if (this.heldDirections.includes('down')) direction = DIRECTIONS.up;
      this.startActorMotion(actor, direction, 4);
      return;
    }

    if (actor.id === 'OBJ_NPC' || actor.id === 'OBJ_DEALER') {
      if (Math.random() < 0.5) return;
      const direction = this.garlic > 0 ? this.getNpcDirection(actor) : randomAiDirection();
      this.startActorMotion(actor, direction, 0.75);
      return;
    }

    if (actor.id === 'OBJ_ROBOT' || actor.id === 'OBJ_SCORPION') {
      actor._baseSpeed ??= 1.5 + Math.random();
      let direction = this.getActorTargetDirection(actor);
      direction = this.preferOnlyOpenAxis(actor, direction);
      if (this.startActorMotion(actor, direction, actor._baseSpeed)) return;

      const moved = this.startActorMotion(actor, weightedDodgeDirection(direction), actor._baseSpeed);
      if (actor.id === 'OBJ_ROBOT') {
        actor._stress = (actor._stress ?? 0) + (moved ? -1 : 1);
        if (actor._stress > 150) {
          actor.alive = false;
          this.spawnExplosion(actor.x, actor.y);
          this.emit('sound', { name: 'explosion-enemy', volume: 0.38 });
          this.roomVersion += 1;
        }
      }
      return;
    }

    if (actor.id === 'OBJ_ANDROID') {
      const freeTiles = AI_DIRECTIONS.filter((direction) => this.actorCanEnter(actor, direction)).length;
      if (freeTiles === 0) {
        actor.alive = false;
        this.spawnExplosion(actor.x, actor.y);
        this.emit('sound', { name: 'explosion-enemy', volume: 0.38 });
        this.roomVersion += 1;
        return;
      }

      const distance = Math.hypot(this.player.x - actor.x, this.player.y - actor.y);
      actor._hunting = distance <= 12;
      const speed = actor._hunting ? 3 : 1.5;
      let direction = actor._hunting ? this.getActorTargetDirection(actor, true) : randomAiDirection();
      direction = this.preferOnlyOpenAxis(actor, direction);
      if (this.startActorMotion(actor, direction, speed)) return;

      const dodge = isDiagonalDirection(direction)
        ? directionParts(direction)[Math.floor(Math.random() * 2)]
        : rotateAiDirection(direction, 4);
      if (this.startActorMotion(actor, dodge, speed)) return;
      this.startActorMotion(actor, weightedDodgeDirection(dodge), speed);
      return;
    }

    if (actor.id === 'OBJ_SHARK') {
      const playerInWater = this.objectsAt(Math.round(this.player.x), Math.round(this.player.y)).some((object) =>
        object.id !== 'OBJ_WATER_DEADLY' && isWater(object.id),
      );
      const distance = Math.hypot(this.player.x - actor.x, this.player.y - actor.y);
      actor._hunting = this.player.visible && playerInWater && distance <= 12;
      const speed = actor._hunting ? 2 : 1;
      let direction = actor._hunting ? this.getSharkDirection(actor) : randomAiDirection();
      direction = this.preferOnlyOpenAxis(actor, direction);
      if (this.startActorMotion(actor, direction, speed)) return;

      const dodge = isDiagonalDirection(direction)
        ? directionParts(direction)[Math.floor(Math.random() * 2)]
        : rotateAiDirection(direction, 4);
      if (this.startActorMotion(actor, dodge, speed)) return;
      this.startActorMotion(actor, weightedDodgeDirection(dodge), speed);
    }
  }

  actorCanEnter(actor, direction) {
    if (!direction || (direction.x === 0 && direction.y === 0)) return false;
    return this.canActorEnter(actor, actor.x + direction.x, actor.y + direction.y, direction);
  }

  preferOnlyOpenAxis(actor, direction) {
    if (!isDiagonalDirection(direction)) return direction;
    const freeParts = directionParts(direction).filter((part) => this.actorCanEnter(actor, part));
    return freeParts.length === 1 ? freeParts[0] : direction;
  }

  startActorMotion(actor, direction, speed) {
    if (!this.actorCanEnter(actor, direction)) return false;
    const distance = Math.hypot(direction.x, direction.y);
    actor._motion = {
      fromX: actor.x,
      fromY: actor.y,
      toX: actor.x + direction.x,
      toY: actor.y + direction.y,
      progress: 0,
      speed: speed / distance,
    };
    if (actor.id === 'OBJ_ANDROID') actor.type = (actor.type + 1) % 3;
    actor._lastDirection = { x: direction.x, y: direction.y };
    if (actor.id === 'OBJ_DOPPELGANGER') {
      this.emit('sound', { name: 'charlie-step', volume: 0.2 });
    } else if (actor.id !== 'OBJ_SHARK') {
      this.emit('sound', { name: 'robot-step', volume: 0.2 });
    }
    return true;
  }

  getActorTargetDirection(actor, ignoreGarlic = false) {
    const direction = { x: 0, y: 0 };
    const playerX = Math.round(this.player.x);
    const playerY = Math.round(this.player.y);
    if (playerX < actor.x) direction.x = -1;
    else if (playerX > actor.x) direction.x = 1;
    if (playerY < actor.y) direction.y = -1;
    else if (playerY > actor.y) direction.y = 1;

    let distance = Math.hypot(this.player.x - actor.x, this.player.y - actor.y);
    if (!ignoreGarlic && this.garlic > 0 && distance < 4) {
      direction.x *= -1;
      direction.y *= -1;
    }

    for (const doppelganger of this.roomObjects().filter((object) => object.id === 'OBJ_DOPPELGANGER')) {
      const doppelDistance = Math.hypot(doppelganger.x - actor.x, doppelganger.y - actor.y);
      if (doppelDistance >= distance) continue;
      if (doppelganger.x < actor.x) direction.x = -1;
      else if (doppelganger.x > actor.x) direction.x = 1;
      if (doppelganger.y < actor.y) direction.y = -1;
      else if (doppelganger.y > actor.y) direction.y = 1;
      distance = doppelDistance;
    }

    return direction.x === 0 && direction.y === 0 ? randomAiDirection() : direction;
  }

  getNpcDirection(actor) {
    const distance = Math.hypot(this.player.x - actor.x, this.player.y - actor.y);
    if (distance >= 5) return randomAiDirection();
    const direction = {
      x: -Math.sign(Math.round(this.player.x) - actor.x),
      y: -Math.sign(Math.round(this.player.y) - actor.y),
    };
    return direction.x === 0 && direction.y === 0 ? randomAiDirection() : direction;
  }

  getSharkDirection(actor) {
    if (!this.player.visible) return randomAiDirection();
    const direction = {
      x: Math.sign(Math.round(this.player.x) - actor.x),
      y: Math.sign(Math.round(this.player.y) - actor.y),
    };
    if (direction.x === 0 && direction.y === 0) return randomAiDirection();
    return direction;
  }

  canActorEnter(actor, x, y, direction) {
    if (x < 0 || x >= ROOM_WIDTH || y < 0 || y >= ROOM_HEIGHT) return false;
    const objects = this.objectsAt(x, y).filter((object) => object !== actor);
    if (actor.id === 'OBJ_SHARK' && !objects.some((object) =>
      object.id === 'OBJ_WATER_SHALLOW' || object.id === 'OBJ_WATER_DEEP' || object.id === 'OBJ_WATER_DEADLY',
    )) return false;
    const state = {
      inventory: this.inventory,
      roomRobotCount: this.roomRobotCount,
      treeTimer: this.currentRoom.treeTimer,
      gold: 0,
    };
    for (const object of objects) {
      if (isEnemy(object.id) || ['OBJ_NPC', 'OBJ_DEALER', 'OBJ_DOPPELGANGER'].includes(object.id)) {
        if (!this.canActorEnterActor(actor, object)) return false;
        continue;
      }
      if (object.id.startsWith('OBJ_TUNNEL#')) return false;
      if (object.id === 'OBJ_WATER_PLANT') return false;
      if (isWater(object.id)) {
        if (actor.id === 'OBJ_SHARK') {
          if (object.subType > 0 && isBlockingTerrain('', object.subType)) return false;
          continue;
        }
        if (['OBJ_WATER_NW', 'OBJ_WATER_SW', 'OBJ_WATER_NE', 'OBJ_WATER_SE'].includes(object.id)
          && object.subType > 0 && !isBlockingTerrain('', object.subType)) continue;
        return false;
      }
      if (object.id === 'OBJ_MOUNTAIN_PATH' || object.id === 'OBJ_WOOD_PATH') continue;
      if (object.id.startsWith('OBJ_ARROW_')) {
        if (Math.round(this.player.x) === x && Math.round(this.player.y) === y) continue;
        if (actor.id === 'OBJ_ANDROID') return false;
        const allowed = [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }][object.type];
        if (!allowed || allowed.x !== direction.x || allowed.y !== direction.y) return false;
        continue;
      }
      if (object.id.startsWith('OBJ_DOOR#')) {
        if (actor.id === 'OBJ_ANDROID') continue;
        if (actor.id === 'OBJ_ROBOT' && Math.round(this.player.x) === x && Math.round(this.player.y) === y) continue;
        return false;
      }
      if (object.id === 'OBJ_ELECTRIC_FENCE' || object.id === 'OBJ_ELECTRIC_FENCE_OFF') {
        if (actor.id === 'OBJ_ANDROID') return false;
        if (actor.id === 'OBJ_ROBOT'
          && !(Math.round(this.player.x) === x && Math.round(this.player.y) === y)
          && Math.random() < 0.85) return false;
        continue;
      }
      if (object.id.startsWith('OBJ_SAND_PLANT_')) {
        if (object.type > 0) continue;
        return false;
      }
      if (object.id === 'OBJ_PLANT') return false;
      if (object.id === 'OBJ_GROUND_NEST' && actor.id === 'OBJ_ANDROID') return false;
      if (/^OBJ_ICE_\d+$/.test(object.id) || object.id === 'OBJ_ICE_DEADLY') {
        if (actor.id === 'OBJ_ROBOT' || actor.id === 'OBJ_ANDROID') continue;
        return false;
      }
      if (object.id.startsWith('OBJ_THERMOPLATE_')) {
        if (actor.id === 'OBJ_ROBOT') continue;
        return false;
      }
      if (object.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) continue;
      if (object.id.startsWith('OBJ_GOAL_')) return false;
      if (object.id === 'OBJ_SKULL') return false;
      if (isStaticBlocker(object.id, object, state)) return false;
    }
    return true;
  }

  canActorEnterActor(actor, target) {
    if (target.id === 'OBJ_NPC' || target.id === 'OBJ_DEALER' || target.id === 'OBJ_SHARK') return false;
    if (target.id === 'OBJ_DOPPELGANGER') return actor.id === 'OBJ_ROBOT' || actor.id === 'OBJ_ANDROID';
    if (target.id === 'OBJ_ROBOT') {
      if (actor.id === 'OBJ_ANDROID' || actor.id === 'OBJ_DOPPELGANGER') return true;
      if (actor.id === 'OBJ_ROBOT') return Math.random() < 0.1;
      return false;
    }
    if (target.id === 'OBJ_ANDROID') {
      if (actor.id === 'OBJ_DOPPELGANGER') return true;
      if (actor.id === 'OBJ_ROBOT') return Math.random() < 0.1;
      return false;
    }
    if (target.id === 'OBJ_SCORPION') {
      if (actor.id === 'OBJ_ANDROID') return true;
      if (actor.id === 'OBJ_ROBOT') return Math.random() < 0.1;
      return false;
    }
    return false;
  }

  onActorEntered(actor) {
    const objects = this.objectsAt(actor.x, actor.y).filter((object) => object !== actor);
    if (Math.round(this.player.x) === actor.x && Math.round(this.player.y) === actor.y) {
      if (actor.id === 'OBJ_NPC' || actor.id === 'OBJ_DEALER') this.interactWithNpc(actor);
      else if (actor.id !== 'OBJ_DOPPELGANGER') this.killPlayer(actor.id);
    }
    for (const object of objects) {
      if ((object.id === 'OBJ_ANDROID' || object.id === 'OBJ_SCORPION') && actor.id === 'OBJ_ROBOT') actor.alive = false;
      if (object.id === 'OBJ_SCORPION' && actor.id === 'OBJ_ANDROID') actor.alive = false;
      if (object.id === 'OBJ_ELECTRIC_FENCE' && object.type === 0 && actor.id !== 'OBJ_ANDROID') {
        object.alive = false;
        actor.alive = false;
      }
      if (object.id === 'OBJ_DOPPELGANGER' && isEnemy(actor.id) && object.alive !== false) {
        object.alive = false;
        this.spawnExplosion(object.x, object.y);
        this.emit('sound', { name: 'explosion-enemy', volume: 0.38 });
      }
      if (object.id === 'OBJ_ICE_DEADLY' && (actor.id === 'OBJ_ROBOT' || actor.id === 'OBJ_ANDROID')) actor.alive = false;
      if (object.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) this.pressFloorPlate(object, actor);
      if (object.id === 'OBJ_GROUND_NEST' && actor.id !== 'OBJ_ANDROID') {
        this.spawnObject('OBJ_ROBOT', object.x, object.y, { justSpawned: true });
        object.alive = false;
      }
      if (object.id.startsWith('OBJ_MUNITION#') && actor.id !== 'OBJ_NPC' && actor.id !== 'OBJ_DEALER') {
        const direction = actor._lastDirection;
        if (direction) this.fireBullet(object.x, object.y, direction, 3);
        object.type -= 1;
        if (object.type < 0) object.alive = false;
        else object.id = `OBJ_MUNITION#${object.type}`;
      }
    }
    const ice = objects.find((object) => object.id.startsWith('OBJ_ICE_') && object.id !== 'OBJ_ICE_DEADLY');
    if (actor.alive && ice && (actor.id === 'OBJ_ROBOT' || actor.id === 'OBJ_ANDROID')) {
      const direction = actor._lastDirection;
      if (direction && this.canActorEnter(actor, actor.x + direction.x, actor.y + direction.y, direction)) {
        const iceSpeed = 0.75;
        const distance = Math.hypot(direction.x, direction.y);
        actor._motion = {
          fromX: actor.x,
          fromY: actor.y,
          toX: actor.x + direction.x,
          toY: actor.y + direction.y,
          progress: 0,
          speed: iceSpeed / distance,
        };
      }
    }
    if (!actor.alive) {
      this.spawnExplosion(actor.x, actor.y);
      this.emit('sound', { name: 'explosion-enemy', volume: 0.38 });
      this.roomVersion += 1;
      this.emit('state');
    }
  }

  interactWithNpc(actor) {
    const cooldown = actor._interactionCooldown ?? 2;
    if (cooldown > 0) return false;
    if (actor.id === 'OBJ_DEALER') {
      if (actor.content) {
        this.spawnObject(actor.content, actor.x, actor.y);
        actor.content = null;
        this.roomVersion += 1;
      }
    } else if (actor.flag !== -1) {
      this.showMessage(`TXT_${this.currentRoom.id}_NPC_NR_${actor.flag}`);
    }
    actor._interactionCooldown = 2;
    return true;
  }

  tryStartMove(direction, { forced = false, speedFactor = null } = {}) {
    if (this.motion || !ALL_MOVEMENT_DIRECTIONS[direction]) return false;
    const vector = ALL_MOVEMENT_DIRECTIONS[direction];
    const fromX = Math.round(this.player.x);
    const fromY = Math.round(this.player.y);
    const targetX = fromX + vector.x;
    const targetY = fromY + vector.y;

    if (targetX < 0 || targetX >= ROOM_WIDTH || targetY < 0 || targetY >= ROOM_HEIGHT) {
      if (!DIRECTIONS[direction]) return false;
      return this.changeRoom(direction);
    }

    const targetObjects = this.objectsAt(targetX, targetY);
    const state = {
      inventory: this.inventory,
      roomRobotCount: this.roomRobotCount,
      treeTimer: this.currentRoom.treeTimer,
      gold: this.gold,
    };
    for (const object of targetObjects) {
      if (isPushable(object.id)) {
        if (!DIRECTIONS[direction]) return false;
        if (!this.pushObject(object, direction)) return false;
        continue;
      }
      if (object.id.startsWith('OBJ_TELEPORT_START_') && object.content != null) {
        const required = this.inventoryHas(object.content);
        const allowed = object.type === 0 ? !required : required;
        if (!allowed) return false;
      }
      if (object.id === 'OBJ_ROOM_EXIT' && this.roomRobotCount > 0 && this.currentRoom.treeTimer <= 0) return false;
      if (object.id === 'OBJ_BARRIER' && this.roomRobotCount > 0 && this.currentRoom.treeTimer <= 0) return false;
      if (object.id === 'OBJ_MOUNTAIN_PATH' || object.id === 'OBJ_WOOD_PATH') {
        if (!this.inventoryHas('OBJ_SHOES')) return false;
        continue;
      }
      if (object.id.startsWith('OBJ_ARROW_')) {
        const allowedDirections = ['right', 'up', 'left', 'down'];
        if (allowedDirections[object.type] !== direction) return false;
      }
      if (object.id === 'OBJ_SAND_PLANT_0') {
        if (!this.inventoryHas('OBJ_KNIFE')) return false;
        continue;
      }
      if (object.id === 'OBJ_PLANT') {
        if (!this.inventoryHas('OBJ_SICKLE')) return false;
        continue;
      }
      if (object.id === 'OBJ_THERMOPLATE_0' && !(this.game.metadata.ringEffects && this.inventoryHas('OBJ_RING#0'))) return false;
      if (isStaticBlocker(object.id, object, state)) return false;
    }

    const onWater = targetObjects.some((object) => isWater(object.id));
    const onSand = targetObjects.some((object) => object.id.startsWith('OBJ_SAND#') || object.id.startsWith('OBJ_SAND_DECO_') || object.id.startsWith('OBJ_SAND_PLANT_'));
    const protectedFromSand = this.food > 0 || (this.game.metadata.ringEffects && this.inventoryHas('OBJ_RING#3'));
    const waterSlow = onWater && (forced || this.inventoryHas('OBJ_FLIPPERS'));
    this.motion = {
      direction,
      fromX,
      fromY,
      toX: targetX,
      toY: targetY,
      progress: 0,
      paused: false,
      forced,
      water: onWater,
      speedFactor: speedFactor ?? (waterSlow ? 0.5 : onSand && !protectedFromSand ? 0.5 : 1),
    };
    this.player.facing = direction;
    this.player.moving = true;
    this.lastDirection = direction;
    const startsInWater = this.objectsAt(fromX, fromY).some((object) => isWater(object.id));
    if (!startsInWater) this.emit('sound', { name: 'charlie-step', volume: 0.34 });
    if (targetObjects.some((object) => object.id.startsWith('OBJ_DOOR#') && this.inventoryHas(`OBJ_KEY#${object.type}`))) {
      this.emit('sound', { name: 'open-door', volume: 0.46 });
    }
    this.onLeaveCell(fromX, fromY);
    return true;
  }

  finishMove() {
    const completed = this.motion;
    this.player.x = completed.toX;
    this.player.y = completed.toY;
    this.motion = null;
    this.player.moving = false;
    if (completed.tunnel) {
      this.player.visible = true;
      this.emit('sound', { name: 'tunnel-step', volume: 0.34 });
    }
    this.onEnterCell(completed.toX, completed.toY, completed.direction);
    if (completed.tunnel && !this.motion) {
      this.roomVersion += 1;
      this.save();
      this.emit('state');
    }
    if (!completed.tunnel && !this.motion) {
      const endsInWater = this.objectsAt(completed.toX, completed.toY).some((object) => isWater(object.id));
      if (!endsInWater) this.emit('sound', { name: 'charlie-step', volume: 0.34 });
    }
    if (!this.currentRoom || this.paused || this.won || this.lost || this.motion) return;
    const held = this.preferredHeldDirection();
    if (held) this.tryStartMove(held);
  }

  onLeaveCell(x, y, mover = null) {
    for (const object of this.objectsAt(x, y)) {
      if (object.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) this.releaseFloorPlate(object, mover);
    }
  }

  isHeavyObject(object) {
    return object.id === 'OBJ_ISOLATOR'
      || object.id === 'OBJ_ICE_BLOCK'
      || object.id === 'OBJ_BUCKET#1'
      || isEnemy(object.id)
      || ['OBJ_NPC', 'OBJ_DEALER', 'OBJ_DOPPELGANGER'].includes(object.id);
  }

  pressFloorPlate(plate, mover = this.player) {
    if (mover !== this.player && (mover?.alive === false || !this.isHeavyObject(mover))) return;
    if (plate.flag == null || plate.flag < 0 || plate.type === 1) return;
    plate.type = 1;
    plate.id = 'OBJ_ELECTRIC_FLOOR_PLATE_1';
    this.switchFlag(plate.flag, plate);
  }

  destroyIceBlock(ice) {
    if (!ice || ice.id !== 'OBJ_ICE_BLOCK' || ice.alive === false) return false;
    // Tobor informs every object below a dying ice block that it has left the
    // cell. This is what releases a floor plate when the block melts in place.
    ice.alive = false;
    this.onLeaveCell(ice.x, ice.y, ice);
    return true;
  }

  releaseFloorPlate(plate, mover = null) {
    if (plate.flag == null || plate.flag < 0 || plate.type !== 1) return;
    const otherHeavyObject = this.objectsAt(plate.x, plate.y)
      .some((object) => object !== plate && object !== mover && this.isHeavyObject(object));
    const playerStillOnPlate = mover != null
      && Math.round(this.player.x) === plate.x && Math.round(this.player.y) === plate.y;
    if (otherHeavyObject || playerStillOnPlate) return;
    plate.type = 0;
    plate.id = 'OBJ_ELECTRIC_FLOOR_PLATE_0';
    this.switchFlag(plate.flag, plate);
  }

  onEnterCell(x, y, direction) {
    const objects = [...this.objectsAt(x, y)];
    let forcedDirections = [];
    let forcedSpeedFactor = null;
    for (const object of objects) {
      if (!object.alive) continue;
      if (object.id === 'OBJ_SLING' && this.ammunitionCount() > 0) {
        this.removeAmmunition(1);
        this.fireBullet(x, y, direction);
        if (!this.firstUse.has('USED_SLING')) {
          this.firstUse.add('USED_SLING');
          this.points += 3000;
          this.emit('status', { message: this.text('OBJ_SLING_USE', 'Die Schleuder feuert ein Geschoss ab.') });
        }
      } else if (object.id.startsWith('OBJ_BAGPACK#') && this.inventoryHas(object.id)) {
        // Tobor permits only one backpack of the same kind at a time.
      } else if (isCollectible(object.id)) this.collect(object);
      if (object.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) this.pressFloorPlate(object, this.player);
      if ((object.id === 'OBJ_WATER_DEADLY' && !(this.game.metadata.ringEffects && this.inventoryHas('OBJ_RING#1'))) || object.id === 'OBJ_ICE_DEADLY') {
        this.killPlayer(object.id);
        return;
      }
      if (object.id === 'OBJ_ELECTRIC_FENCE' && object.type === 0 && !this.inventoryHas('OBJ_OVERALL')) {
        object.alive = false;
        this.killPlayer(object.id);
        return;
      }
      if (isEnemy(object.id)) {
        this.killPlayer(object.id);
        return;
      }
      if (object.id === 'OBJ_BANK' && this.gold > 0) {
        const deposited = Math.min(40, this.gold);
        this.gold -= deposited;
        this.points += deposited * 100;
        object.alive = false;
        this.emit('status', { message: `${deposited} Gold geopfert · ${deposited * 100} Punkte` });
      }
      if (object.id.startsWith('OBJ_DOOR#') && this.inventoryHas(`OBJ_KEY#${object.type}`) && !this.firstUse.has('USED_KEY')) {
        this.firstUse.add('USED_KEY');
        this.points += 2500;
        this.emit('message', {
          title: 'Schlüssel',
          text: this.text('OBJ_KEY_USE', 'Der Schlüssel öffnet die passende Tür.'),
        });
      }
      if (object.id === 'OBJ_GRASS_0') {
        object.id = 'OBJ_GRASS_1';
        object.type = 1;
      }
      if (object.id === 'OBJ_SAND_PLANT_0' && this.inventoryHas('OBJ_KNIFE')) {
        object.alive = false;
        this.emit('sound', { name: 'hit-plant', volume: 0.4 });
      }
      if (object.id === 'OBJ_SAND_PLANT_1') {
        object.id = 'OBJ_SAND_PLANT_2';
        object.type = 2;
        this.emit('sound', { name: 'hit-plant', volume: 0.4 });
      }
      if (object.id === 'OBJ_PLANT' && this.inventoryHas('OBJ_SICKLE')) {
        object.alive = false;
        this.emit('sound', { name: 'hit-plant', volume: 0.4 });
        if (Math.random() < 0.25) this.spawnPlantShoots(object.x, object.y);
      }
      if (object.id === 'OBJ_PLANT_GROWING' && this.inventoryHas('OBJ_SICKLE')) {
        object.alive = false;
        this.emit('sound', { name: 'hit-plant', volume: 0.4 });
      }
      if (object.id.startsWith('OBJ_STAIRS_')) {
        this.useStairs(object);
        return;
      }
      if (object.id.startsWith('OBJ_TELEPORT_START_')) {
        this.useTeleport(object);
        return;
      }
      if (object.id.startsWith('OBJ_TUNNEL#')) {
        this.useTunnel(object, direction);
        return;
      }
      if (object.id.startsWith('OBJ_GOAL_')) this.checkWinCondition();
      if (object.id === 'OBJ_NOTICE' && object.flag !== -1) {
        this.showMessage(`TXT_${this.currentRoom.id}_NOTICE_NR_${object.flag}`);
      }
      if (object.id === 'OBJ_NPC' || object.id === 'OBJ_DEALER') this.interactWithNpc(object);
      if (object.id === 'OBJ_GROUND_NEST') {
        this.spawnObject('OBJ_ROBOT', object.x, object.y, { justSpawned: true });
        object.alive = false;
      }
      if (object.id === 'OBJ_SKULL') this.triggerSkull(object);
      if (isWater(object.id) && object.id !== 'OBJ_WATER_DEADLY' && this.inventoryHas('OBJ_BUCKET#0')) {
        const count = this.inventoryCount('OBJ_BUCKET#0');
        this.removeInventory('OBJ_BUCKET#0', count);
        this.addInventory('OBJ_BUCKET#1', null, count);
      }
      if (object.id.startsWith('OBJ_ICE_') && object.id !== 'OBJ_ICE_DEADLY') {
        forcedDirections = [direction];
        forcedSpeedFactor = 0.5;
      }
      if (isWater(object.id) && !(this.game.metadata.ringEffects && this.inventoryHas('OBJ_RING#1'))) {
        forcedDirections = this.waterMovementCandidates(object, direction);
        forcedSpeedFactor = null;
      }
    }
    if (!this.motion && !this.paused && !this.won && !this.lost) {
      for (const forcedDirection of forcedDirections) {
        if (this.tryStartMove(forcedDirection, { forced: true, speedFactor: forcedSpeedFactor })) break;
      }
    }
    this.roomVersion += 1;
    this.scheduleAutosave();
    this.emit('state');
  }

  triggerSkull(skull) {
    for (let x = skull.x - 1; x <= skull.x + 1; x += 1) {
      for (let y = skull.y - 1; y <= skull.y + 1; y += 1) {
        if (x < 0 || x >= ROOM_WIDTH || y < 0 || y >= ROOM_HEIGHT) continue;
        if (this.canSkullSpawnFenceAt(x, y, skull)) this.spawnObject('OBJ_ELECTRIC_FENCE', x, y, { type: 0 });
      }
    }
    skull.alive = false;
    this.roomVersion += 1;
  }

  canSkullSpawnFenceAt(x, y, skull) {
    if (Math.round(this.player.x) === x && Math.round(this.player.y) === y) return false;
    return this.objectsAt(x, y).every((object) => {
      if (object === skull || isRoof(object.id)) return true;
      if (isEnemy(object.id) || ['OBJ_NPC', 'OBJ_DEALER', 'OBJ_DOPPELGANGER'].includes(object.id)) return true;
      if (object.id.startsWith('OBJ_SHADOW#') || object.id.startsWith('OBJ_SAND#')) return true;
      if (object.id.startsWith('OBJ_SAND_DECO_') || object.id.startsWith('OBJ_GRASS_')) return true;
      if (['OBJ_PATH', 'OBJ_MOUNTAIN_PATH', 'OBJ_WOOD_PATH'].includes(object.id)) return true;
      if (/^OBJ_ICE_\d+$/.test(object.id)) return true;
      if (object.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) return true;
      return false;
    });
  }

  canPushableEnterObject(mover, target) {
    if (target.id.startsWith('OBJ_ROOF_') || target.id.startsWith('MARKER_') || target.id === 'OBJ_START_POSITION') return true;
    if (isPassThroughDynamic(target.id)) return true;
    if (target.id === 'OBJ_BARRIER' || target.id === 'OBJ_ROOM_EXIT') return this.currentRoom.treeTimer > 0;
    if (target.id === 'OBJ_SPOT' || target.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) return true;
    if (target.id === 'OBJ_SAND_DECO_0' || target.id === 'OBJ_SAND_DECO_1' || target.id === 'OBJ_SAND_DECO_2') return true;
    if (target.id.startsWith('OBJ_SHADOW#')) return true;
    if (target.id.startsWith('OBJ_THERMOPLATE_')) return mover.id === 'OBJ_ICE_BLOCK';
    if (target.id === 'OBJ_ISOLATOR_WATER') return mover.id === 'OBJ_ISOLATOR' || mover.id === 'OBJ_ISOLATOR_SOFT';
    if (isWater(target.id)) {
      if (target.id === 'OBJ_WATER_DEADLY') return false;
      if (target.subType > 0) return !isBlockingTerrain('', target.subType);
      return target.id === 'OBJ_WATER_SHALLOW' || target.id === 'OBJ_WATER_DEEP';
    }
    if (isCollectible(target.id)) return false;
    return false;
  }

  canPushableMoveEntity(mover, target) {
    if (!isEntityPushable(target.id)) return false;
    if (target.id === 'OBJ_ICE_BLOCK') return false;
    if (target.id === 'OBJ_ISOLATOR' && mover.id === 'OBJ_ICE_BLOCK') return false;
    if ((target.id === 'OBJ_ELECTRIC_FENCE' || target.id === 'OBJ_ELECTRIC_FENCE_OFF') && mover.id === 'OBJ_ICE_BLOCK') return false;
    return true;
  }

  pushObject(object, direction, visited = new Set()) {
    if (visited.has(object)) return false;
    visited.add(object);
    const vector = DIRECTIONS[direction];
    const targetX = object.x + vector.x;
    const targetY = object.y + vector.y;
    if (targetX < 0 || targetX >= ROOM_WIDTH || targetY < 0 || targetY >= ROOM_HEIGHT) return false;
    const targetObjects = this.objectsAt(targetX, targetY).filter((entry) => entry !== object);
    for (const entry of targetObjects) {
      if (isEntityPushable(entry.id)) {
        if (!this.canPushableMoveEntity(object, entry)) return false;
        if (!this.pushObject(entry, direction, visited)) return false;
      } else if (!this.canPushableEnterObject(object, entry)) return false;
    }

    this.onLeaveCell(object.x, object.y, object);
    object.x = targetX;
    object.y = targetY;
    const water = targetObjects.find((entry) => entry.id === 'OBJ_WATER_SHALLOW' || entry.id === 'OBJ_WATER_DEEP');
    if (water) {
      if (object.id === 'OBJ_ISOLATOR' && water.id === 'OBJ_WATER_SHALLOW') {
        object.alive = false;
        water.alive = false;
        this.spawnObject('OBJ_ISOLATOR_WATER', targetX, targetY);
      } else if (object.id === 'OBJ_ICE_BLOCK') {
        this.destroyIceBlock(object);
      } else {
        object.alive = false;
      }
    }
    if (targetObjects.some((entry) => entry.id === 'OBJ_THERMOPLATE_0') && object.id === 'OBJ_ICE_BLOCK') {
      this.destroyIceBlock(object);
    }
    if (object.alive !== false) {
      for (const entry of targetObjects) {
        if (entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')) this.pressFloorPlate(entry, object);
      }
    }
    this.roomVersion += 1;
    return true;
  }

  collect(object) {
    const id = object.id;
    if (id.startsWith('OBJ_MUNITION#')) {
      this.emit('sound', { name: 'pickup-misc' });
      const rest = this.addAmmunition(Number(id.split('#')[1]) + 1);
      if (!this.firstUse.has('OBJ_MUNITION_PICKUP')) {
        this.firstUse.add('OBJ_MUNITION_PICKUP');
        this.points += 100;
        this.emit('message', {
          title: 'Gefunden',
          text: this.text('OBJ_MUNITION_PICKUP', 'Munition aufgenommen.'),
        });
      }
      if (rest > 0) {
        object.type = rest - 1;
        object.id = `OBJ_MUNITION#${object.type}`;
      } else object.alive = false;
      return;
    }
    if (id === 'OBJ_GOLD') {
      if (this.gold >= 150) return;
      this.gold += 1;
      this.emit('sound', { name: 'pickup-gold', volume: 0.4 });
    } else if (id.startsWith('OBJ_DIAMOND#')) {
      this.emit('sound', { name: 'pickup-misc' });
      this.diamonds += 1;
      this.points += 5000;
      this.emit('status', { message: 'Diamant gefunden · 5.000 Punkte' });
      if (!this.firstUse.has('COLLECT_DIAMOND')) {
        this.firstUse.add('COLLECT_DIAMOND');
        this.points += 1000;
        this.emit('message', {
          title: 'Gefunden',
          text: this.text('OBJ_DIAMOND_PICKUP', 'Du hast einen Diamanten gefunden.'),
        });
      }
    } else if (id === 'OBJ_NOTICE') {
      // Notes are consumed and displayed by onEnterCell.
    } else if (id === 'OBJ_PLATIN') {
      // Platin is a score/collection object without inventory entry in Tobor.
    } else if (id === 'OBJ_DOPPELGANGER_ITEM') {
      this.emit('sound', { name: 'doppelganger', volume: 0.42 });
      this.spawnObject('OBJ_DOPPELGANGER', object.x, object.y);
      if (!this.firstUse.has('USED_DOPPELGANGER')) {
        this.firstUse.add('USED_DOPPELGANGER');
        this.points += 500;
        this.emit('message', {
          title: 'Doppelgänger',
          text: this.text('USED_DOPPELGANGER', 'Ein Doppelgänger ist erschienen.'),
        });
      }
    } else if (id.startsWith('OBJ_KEY#')) {
      this.emit('sound', { name: this.firstUse.has('OBJ_KEY_PICKUP') ? 'pickup-key' : 'jingle-1', volume: 0.42 });
      this.addInventory(id, object.content);
      if (!this.firstUse.has('OBJ_KEY_PICKUP')) {
        this.firstUse.add('OBJ_KEY_PICKUP');
        this.points += PICKUP_POINTS.OBJ_KEY;
        this.emit('message', {
          title: 'Gefunden',
          text: this.text('OBJ_KEY_PICKUP', 'Schlüssel gefunden.'),
        });
      }
    } else if (id.startsWith('OBJ_DIAMOND#')) {
      // handled above
    } else if (!id.startsWith('OBJ_DIAMOND#')) {
      const pickupKey = `${id.split('#')[0]}_PICKUP`;
      const firstPickup = !this.firstUse.has(pickupKey);
      this.emit('sound', {
        name: firstPickup && (id === 'OBJ_SHOES' || id.startsWith('OBJ_RING#')) ? 'jingle-1' : 'pickup-misc',
        volume: 0.44,
      });
      this.addInventory(id, object.content);
      if (id.startsWith('OBJ_MAGNET#')) this.rotateArrowsForMagnet(object.type, object.x, object.y, true);
      const message = this.text(pickupKey, 'Gegenstand aufgenommen');
      if (!this.firstUse.has(pickupKey)) {
        this.firstUse.add(pickupKey);
        this.points += PICKUP_POINTS[id.split('#')[0]] ?? 0;
        this.emit('message', { title: 'Gefunden', text: message });
      }
    }
    object.alive = false;
  }

  spawnObject(id, x, y, overrides = {}) {
    const object = {
      runtimeId: `${this.currentRoom.id}:spawn:${this.spawnSequence += 1}`,
      id,
      x,
      y,
      type: this.typeFromItemId(id),
      subType: 0,
      drift: -1,
      flag: -1,
      alive: true,
      ...overrides,
    };
    this.currentRoom.objects.push(object);
    return object;
  }

  directionFromDrift(drift, fallback) {
    if (drift >= 0) return DRIFT_DIRECTIONS[drift] ?? fallback;
    return DRIFT_DIRECTIONS[Math.floor(Math.random() * DRIFT_DIRECTIONS.length)] ?? fallback;
  }

  waterMovementCandidates(water, entryDirection) {
    const candidates = [];
    const held = this.preferredHeldDirection();
    if (this.inventoryHas('OBJ_FLIPPERS') && held && Math.random() < 0.9) candidates.push(held);
    if (entryDirection && Math.random() < 0.75) candidates.push(entryDirection);
    const cornerDrifts = {
      2: ['southeast', 'down', 'right'],
      3: ['northeast', 'up', 'right'],
      4: ['southwest', 'down', 'left'],
      5: ['northwest', 'up', 'left'],
    };
    const drifts = cornerDrifts[water.type] ?? [
      this.directionFromDrift(water.drift, entryDirection),
      this.directionFromDrift(water.drift, entryDirection),
      this.directionFromDrift(water.drift, entryDirection),
    ];
    candidates.push(...drifts);
    candidates.push(...DRIFT_DIRECTIONS.slice().sort(() => Math.random() - 0.5));
    return [...new Set(candidates.filter(Boolean))];
  }

  switchFlag(flag, source) {
    if (flag == null || flag < 0) return;
    this.emit('sound', { name: 'switch', volume: 0.38 });
    const activationId = this.switchSequence += 1;
    for (const object of this.roomObjects()) {
      if (object === source || object.flag !== flag) continue;
      if (object.id.startsWith('OBJ_SHOOTER_')) {
        if ((object._reload ?? 0) > 0) continue;
        this.fireBullet(object.x, object.y, SHOOTER_DIRECTIONS[object.type]);
        object._reload = 8 / 15;
      } else if (object.id === 'OBJ_ELECTRIC_DOOR_0') {
        object.id = 'OBJ_ELECTRIC_DOOR_1';
        object.type = 1;
      } else if (object.id === 'OBJ_ELECTRIC_DOOR_1') {
        object.id = 'OBJ_ELECTRIC_DOOR_0';
        object.type = 0;
      } else if (object.id === 'OBJ_ELECTRIC_FENCE') {
        object.id = 'OBJ_ELECTRIC_FENCE_OFF';
        object.type = 1;
      } else if (object.id === 'OBJ_ELECTRIC_FENCE_OFF') {
        object.id = 'OBJ_ELECTRIC_FENCE';
        object.type = 0;
      } else if (object.id === 'OBJ_MIRROR_0') {
        object.id = 'OBJ_MIRROR_1';
        object.type = 1;
      } else if (object.id === 'OBJ_MIRROR_1') {
        object.id = 'OBJ_MIRROR_0';
        object.type = 0;
      } else if (object.id.startsWith('OBJ_THERMOPLATE_')) {
        if (object.type === 0) {
          object.type = 1;
          object.id = 'OBJ_THERMOPLATE_1';
          if (this.objectsAt(object.x, object.y).every((entry) => entry === object)) {
            this.spawnObject('OBJ_ICE_BLOCK', object.x, object.y, {
              flag: object.flag,
              _electricActivation: activationId,
            });
          }
        } else {
          object.type = 0;
          object.id = 'OBJ_THERMOPLATE_0';
          for (const ice of this.roomObjects().filter((entry) => entry.id === 'OBJ_ICE_BLOCK')) {
            if ((ice.flag === object.flag && ice._electricActivation !== activationId)
              || (ice.x === object.x && ice.y === object.y)) this.destroyIceBlock(ice);
          }
        }
      } else if (object.id.startsWith('OBJ_WATER_') && object.drift >= 0) {
        const reversed = [1, 0, 3, 2, 7, 6, 5, 4];
        object.drift = reversed[object.drift] ?? object.drift;
      } else if (object.id === 'OBJ_ROBOT_FACTORY_0') {
        object.id = 'OBJ_ROBOT_FACTORY_1';
        object.type = 1;
      } else if (object.id === 'OBJ_ROBOT_FACTORY_1') {
        object.id = 'OBJ_ROBOT_FACTORY_0';
        object.type = 0;
      }
    }
    this.roomVersion += 1;
  }

  changeRoom(direction) {
    const vector = DIRECTIONS[direction];
    const target = this.game.roomAt(
      this.currentRoom.x + vector.x,
      this.currentRoom.y + vector.y,
      this.currentRoom.z,
    );
    if (!target) return false;
    const runtimeTarget = this.rooms.get(target.id);
    if (direction === 'left') this.player.x = ROOM_WIDTH - 1;
    if (direction === 'right') this.player.x = 0;
    if (direction === 'up') this.player.y = ROOM_HEIGHT - 1;
    if (direction === 'down') this.player.y = 0;
    this.motion = null;
    this.enterRoom(runtimeTarget, { announce: true });
    return true;
  }

  enterRoom(room, { announce = false, processCell = true } = {}) {
    if (this.currentRoom && this.currentRoom !== room) {
      this.currentRoom.treeTimer = 0;
      for (const bullet of this.roomObjects(this.currentRoom).filter((object) => object.id === 'OBJ_BULLET')) {
        bullet.alive = false;
      }
    }
    this.currentRoom = room;
    this.respawn = { roomId: room.id, x: this.player.x, y: this.player.y };
    const firstVisit = !this.visitedRooms.has(room.id);
    this.visitedRooms.add(room.id);
    this.roomVersion += 1;
    if (announce) this.emit('room', { room, name: this.game.roomName(room), firstVisit });
    if (processCell) this.onEnterCell(Math.round(this.player.x), Math.round(this.player.y), this.player.facing);
    this.emit('state');
  }

  useStairs(stairs) {
    const candidates = [...this.rooms.values()].filter((room) =>
      room.x === this.currentRoom.x && room.y === this.currentRoom.y && room.id !== this.currentRoom.id,
    );
    const targetType = stairs.type === 0 ? 'OBJ_STAIRS_DOWN' : 'OBJ_STAIRS_UP';
    const valid = candidates
      .filter((room) => stairs.type === 0 ? room.z < this.currentRoom.z : room.z > this.currentRoom.z)
      .map((room) => ({
        room,
        target: room.objects.find((object) =>
          object.alive !== false && object.id === targetType && object.x === stairs.x && object.y === stairs.y,
        ),
      }))
      .filter(({ target }) => target)
      .sort((a, b) => Math.abs(a.room.z - this.currentRoom.z) - Math.abs(b.room.z - this.currentRoom.z));
    if (!valid.length) return;
    this.player.x = valid[0].target.x;
    this.player.y = valid[0].target.y;
    this.motion = null;
    this.enterRoom(valid[0].room, { announce: true, processCell: false });
  }

  useTeleport(teleporter) {
    if (teleporter.content != null) {
      const hasItem = this.inventoryHas(teleporter.content);
      if ((teleporter.type === 0 && hasItem) || (teleporter.type === 1 && !hasItem)) return;
    }
    const rooms = teleporter.content == null
      ? [this.currentRoom]
      : [this.currentRoom, ...[...this.rooms.values()].filter((room) => room !== this.currentRoom)];
    for (const room of rooms) {
      const target = room.objects.find((object) =>
        object.alive !== false
        && object.id === `OBJ_TELEPORT_END_${teleporter.type}`
        && (teleporter.content == null || object.content === teleporter.content),
      );
      if (!target) continue;
      this.player.x = target.x;
      this.player.y = target.y;
      this.motion = null;
      if (room !== this.currentRoom) this.enterRoom(room, { announce: true, processCell: false });
      return;
    }
  }

  useTunnel(tunnel, direction) {
    const rules = {
      0: { direction: 'down', opposite: 1, axis: 'x', sign: 1 },
      1: { direction: 'up', opposite: 0, axis: 'x', sign: -1 },
      2: { direction: 'right', opposite: 3, axis: 'y', sign: 1 },
      3: { direction: 'left', opposite: 2, axis: 'y', sign: -1 },
    };
    const rule = rules[tunnel.type];
    if (!rule || rule.direction !== direction) return false;
    const coordinate = rule.axis === 'x' ? tunnel.x : tunnel.y;
    const distanceAxis = rule.axis === 'x' ? 'y' : 'x';
    const target = this.roomObjects()
      .filter((object) => object.id === `OBJ_TUNNEL#${rule.opposite}` && object[rule.axis] === coordinate)
      .filter((object) => Math.sign(object[distanceAxis] - tunnel[distanceAxis]) === rule.sign)
      .sort((a, b) => Math.abs(a[distanceAxis] - tunnel[distanceAxis]) - Math.abs(b[distanceAxis] - tunnel[distanceAxis]))[0];
    if (!target) return false;
    const distance = Math.hypot(target.x - tunnel.x, target.y - tunnel.y);
    this.motion = {
      direction,
      fromX: tunnel.x,
      fromY: tunnel.y,
      toX: target.x,
      toY: target.y,
      distance,
      progress: 0,
      paused: false,
      forced: true,
      tunnel: true,
      tunnelLastStep: Math.floor(distance),
      water: false,
      speedFactor: 0.5,
    };
    this.player.visible = false;
    this.player.moving = true;
    this.emit('sound', { name: 'tunnel-step', volume: 0.34 });
    return true;
  }

  checkWinCondition() {
    const rings = [0, 1, 2, 3].filter((index) => this.inventoryHas(`OBJ_RING#${index}`)).length;
    if (rings < Number(this.game.metadata.winType ?? 0)) {
      this.emit('status', { message: `${rings}/4 Ringe – das Ziel bleibt verschlossen.` });
      return false;
    }
    this.won = true;
    this.clearInput();
    this.emit('win', {
      title: 'Insel der Ruinen geschafft!',
      text: this.text('TXT_EPISODE_WON', 'Du hast die Episode gewonnen.'),
    });
    this.save();
    return true;
  }

  killPlayer(cause) {
    if (this.lost || this.death) return;
    const explosion = this.spawnExplosion(Math.round(this.player.x), Math.round(this.player.y), { _playerDeath: true });
    this.emit('sound', { name: 'explosion-player', volume: 0.52 });
    this.lives -= 1;
    this.clearInput();
    this.motion = null;
    this.player.moving = false;
    this.player.visible = false;
    this.death = { cause, explosion };
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.roomVersion += 1;
    if (this.lives <= 0) this.clearAutosave();
    else this.save();
    this.emit('state');
  }

  updatePlayerDeath(deltaSeconds) {
    if (this.updateExplosion(this.death.explosion, deltaSeconds)) return;
    const { cause } = this.death;
    this.death = null;
    if (this.lives <= 0) {
      this.lost = true;
      this.clearAutosave();
      this.emit('state');
      this.emit('lose', {
        title: 'Episode verloren',
        text: `${this.text('TXT_EPISODE_LOST', 'Versuche es noch einmal.')}\n\nLade einen Uhr-Spielstand oder beginne ein neues Abenteuer.`,
      });
      return;
    }
    if (this.respawn?.roomId === this.currentRoom.id) {
      this.player.x = this.respawn.x;
      this.player.y = this.respawn.y;
    } else {
      const start = this.currentRoom.objects.find((object) => object.id === 'OBJ_START_POSITION');
      if (start) {
        this.player.x = start.x;
        this.player.y = start.y;
      }
    }
    this.player.visible = true;
    this.player.moving = false;
    this.save();
    this.emit('state');
    this.emit('status', { message: `Ein Leben verloren (${cause.replace(/^OBJ_/, '')})` });
  }

  showMessage(key) {
    const value = this.text(key, '');
    if (!value || value === key) return;
    this.clearInput();
    this.emit('message', { title: this.game.roomName(this.currentRoom), text: value });
  }

  canDropAt(x, y) {
    return this.objectsAt(x, y).every((object) => {
      if (object.id.startsWith('OBJ_ROOF_') || object.id.startsWith('MARKER_') || object.id === 'OBJ_START_POSITION') return true;
      if (isPassThroughDynamic(object.id)) return true;
      if (object.id === 'OBJ_BARRIER' || object.id === 'OBJ_ROOM_EXIT') return this.currentRoom.treeTimer > 0;
      if (object.id === 'OBJ_SPOT' || object.id.startsWith('OBJ_SHADOW#')) return true;
      if (isCollectible(object.id)) return true;
      if (object.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_') || object.id.startsWith('OBJ_THERMOPLATE_')) return true;
      if (object.id.startsWith('OBJ_SAND#') || object.id.startsWith('OBJ_SAND_DECO_') || object.id.startsWith('OBJ_GRASS_')) return true;
      if (['OBJ_PATH', 'OBJ_MOUNTAIN_PATH', 'OBJ_WOOD_PATH', 'OBJ_BEDROCK_PATH'].includes(object.id)) return true;
      if (isWater(object.id) && object.subType > 0) return !isBlockingTerrain('', object.subType);
      return false;
    });
  }

  typeFromItemId(id) {
    if (id.includes('#')) return Number(id.split('#')[1]) || 0;
    const match = id.match(/_(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  rotateArrowsForMagnet(type, x, y, pickingUp = false) {
    let rotated = 0;
    for (const arrow of this.roomObjects().filter((object) =>
      object.id.startsWith('OBJ_ARROW_')
      && Math.abs(object.x - x) <= 1 && Math.abs(object.y - y) <= 1
      && (object.x === x || object.y === y),
    )) {
      rotated += 1;
      if (pickingUp) arrow.type = (arrow.type + (type === 0 ? 3 : 1)) % 4;
      else if (type === 0) {
        if (arrow.y < y) arrow.type = 1;
        if (arrow.y > y) arrow.type = 3;
        if (arrow.x < x) arrow.type = 2;
        if (arrow.x > x) arrow.type = 0;
      } else {
        if (arrow.y < y) arrow.type = 3;
        if (arrow.y > y) arrow.type = 1;
        if (arrow.x < x) arrow.type = 0;
        if (arrow.x > x) arrow.type = 2;
      }
      arrow.id = `OBJ_ARROW_${arrow.type}`;
    }
    return rotated;
  }

  dropItem(id) {
    const item = this.inventory.get(id);
    if (!item) return false;
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (!this.canDropAt(x, y)) {
      this.emit('status', { message: 'Hier ist kein Platz zum Ablegen.' });
      return false;
    }
    const type = this.typeFromItemId(id);
    this.spawnObject(id, x, y, { type, content: item.content });
    this.removeInventory(id);
    if (id.startsWith('OBJ_MAGNET#')) {
      this.emit('sound', { name: 'drop-magnet', volume: 0.42 });
      const rotated = this.rotateArrowsForMagnet(type, x, y, false);
      if (rotated > 0 && !this.firstUse.has('USED_MAGNET')) {
        this.firstUse.add('USED_MAGNET');
        this.points += 5000;
        this.emit('message', {
          title: 'Magnetfeld',
          text: this.text('OBJ_MAGNET_USE', 'Der Magnet richtet die Pfeile in seiner Nähe neu aus.'),
        });
      }
    }
    this.roomVersion += 1;
    this.save();
    this.emit('state');
    return true;
  }

  lookItem(id) {
    if (!this.inventoryHas(id)) return false;
    const group = id.split('#')[0];
    const description = this.text(`${group}_DESC`, this.text(`${id}_DESC`, 'Dazu gibt es keine weitere Beschreibung.'));
    this.emit('message', {
      title: this.game.text(id, this.game.text(group, group.replace(/^OBJ_/, '').replaceAll('_', ' '))),
      text: description,
    });
    return true;
  }

  inspectAt(x, y) {
    const target = this.objectsAt(x, y).find((object) =>
      object.visible !== false && object.id !== 'OBJ_START_POSITION' && !object.id.startsWith('MARKER_'),
    );
    if (!target) {
      this.emit('status', { message: 'Hier ist nichts Besonderes zu erkennen.' });
      return false;
    }
    const group = target.id.split('#')[0];
    const description = this.text(`${target.id}_DESC`, this.text(`${group}_DESC`, 'Dazu gibt es keine weitere Beschreibung.'));
    this.emit('message', {
      title: this.text(target.id, this.text(group, group.replace(/^OBJ_/, '').replaceAll('_', ' '))),
      text: description,
    });
    return true;
  }

  cloneItem(id) {
    const item = this.inventory.get(id);
    if (!item || id === 'OBJ_CLONE' || !this.inventoryHas('OBJ_CLONE')) return false;
    this.removeInventory('OBJ_CLONE');
    if (id.startsWith('OBJ_MUNITION#')) {
      const rest = this.addAmmunition(this.typeFromItemId(id) + 1);
      if (rest > 0) this.spawnObject(`OBJ_MUNITION#${rest - 1}`, Math.round(this.player.x), Math.round(this.player.y), { type: rest - 1 });
    } else this.addInventory(id, item.content);
    this.roomVersion += 1;
    this.save();
    this.emit('state');
    return true;
  }

  useItem(id) {
    const item = this.inventory.get(id);
    if (!item) return false;
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (id === 'OBJ_EXCLAMATION_MARK') {
      this.emit('inspect');
      return true;
    }
    if (id === 'OBJ_ACID') {
      const walls = this.roomObjects().filter((object) =>
        Math.abs(object.x - x) <= 1 && Math.abs(object.y - y) <= 1
        && (object.id === 'OBJ_WALL' || object.id === 'OBJ_SAND_WALL'),
      );
      if (!walls.length) return false;
      walls.forEach((wall) => {
        wall.alive = false;
        this.spawnObject(wall.id === 'OBJ_SAND_WALL' ? 'OBJ_WALL_SAND_DISSOLVE' : 'OBJ_WALL_DISSOLVE', wall.x, wall.y, { _dissolveTime: 5 });
      });
      this.emit('sound', { name: 'dissolve-wall', volume: 0.44 });
      this.removeInventory(id);
      this.points += this.firstUse.has('USED_ACID') ? 0 : 1500;
      this.firstUse.add('USED_ACID');
      this.emit('status', { message: `${walls.length} Mauerteil${walls.length === 1 ? '' : 'e'} aufgelöst.` });
    } else if (id === 'OBJ_BUCKET#1') {
      const plates = this.roomObjects().filter((object) =>
        Math.abs(object.x - x) <= 1 && Math.abs(object.y - y) <= 1 && object.id.startsWith('OBJ_THERMOPLATE_'),
      );
      if (!plates.length) return false;
      for (const plate of plates) {
        if (plate.type === 0) {
          plate.id = 'OBJ_THERMOPLATE_2';
          plate.type = 2;
        } else if (plate.type === 1 && this.objectsAt(plate.x, plate.y).every((object) => object === plate)) {
          this.spawnObject('OBJ_ICE_BLOCK', plate.x, plate.y, { flag: plate.flag });
        }
      }
      this.removeInventory(id);
      this.addInventory('OBJ_BUCKET#0');
    } else if (id === 'OBJ_GARLIC') {
      this.emit('sound', { name: 'use-garlic', volume: 0.46 });
      this.removeInventory(id);
      this.garlic += 60;
      if (!this.firstUse.has('USED_GARLIC')) this.points += 1000;
      this.firstUse.add('USED_GARLIC');
      this.emit('status', { message: 'Knoblauchduft vertreibt Gegner in deiner Nähe.' });
    } else if (id === 'OBJ_FOOD#0' || id === 'OBJ_FOOD#1') {
      this.removeInventory(id);
      this.food += 60;
      this.emit('status', { message: 'Du stärkst dich für den Weg.' });
    } else if (id === 'OBJ_ELEXIR') {
      if (this.lives >= 3) return false;
      this.removeInventory(id);
      this.lives += 1;
      if (!this.firstUse.has('USED_ELEXIR')) this.points += 4500;
      this.firstUse.add('USED_ELEXIR');
    } else if (id === 'OBJ_SHOVEL') {
      const spots = this.objectsAt(x, y).filter((object) => object.id === 'OBJ_SPOT');
      const filledSpots = spots.filter((spot) => spot.content);
      if (!filledSpots.length) return false;
      for (const spot of spots) {
        if (spot.content) this.spawnObject(spot.content, x, y);
        spot.alive = false;
      }
      if (!this.firstUse.has('USED_SHOVEL')) this.points += 1500;
      this.firstUse.add('USED_SHOVEL');
    } else if (id === 'OBJ_SEED') {
      const occupied = this.objectsAt(x, y).length > 0;
      if (occupied) return false;
      this.removeInventory(id);
      this.spawnObject('OBJ_PLANT', x, y);
      const startTypes = { left: 0, up: 3, right: 6, down: 9 };
      pickTwoRandom(this.openPlantDirections(x, y))
        .forEach((target) => this.spawnObject('OBJ_PLANT_GROWING', target.x, target.y, { type: startTypes[target.name] }));
      if (!this.firstUse.has('USED_SEED')) this.points += 1500;
      this.firstUse.add('USED_SEED');
    } else if (id === 'OBJ_LAMP') {
      const torches = this.roomObjects().filter((object) =>
        object.id === 'OBJ_TORCH' && Math.abs(object.x - x) <= 1 && Math.abs(object.y - y) <= 1,
      );
      if (!torches.length) return false;
      torches.forEach((torch) => { torch.type = 1; });
      if (!this.firstUse.has('USED_LAMP')) this.points += 1500;
      this.firstUse.add('USED_LAMP');
      this.emit('status', { message: `${torches.length} Fackel${torches.length === 1 ? '' : 'n'} entzündet.` });
    } else if (id === 'OBJ_TREE') {
      this.removeInventory(id);
      this.currentRoom.treeTimer = 15;
      if (!this.firstUse.has('USED_TREE')) this.points += 3000;
      this.firstUse.add('USED_TREE');
      this.emit('status', { message: 'Der Baum öffnet die Sperren für kurze Zeit.' });
    } else if (id.startsWith('OBJ_BAGPACK#')) {
      if (item.content) this.spawnObject(item.content, x, y);
      this.removeInventory(id);
    } else if (id.startsWith('OBJ_MAGNET#')) {
      return this.dropItem(id);
    } else if (id === 'OBJ_CLOCK') {
      this.removeInventory(id);
      if (!this.save({ clock: true })) {
        this.addInventory(id, item.content);
        this.emit('status', { message: 'Der Spielstand konnte nicht gespeichert werden.' });
        this.emit('state');
        return false;
      }
      this.emit('sound', { name: 'jingle-0', volume: 0.38 });
      this.emit('status', { message: 'Uhr-Spielstand dauerhaft gespeichert.' });
      this.emit('state');
      return true;
    } else {
      return this.dropItem(id);
    }
    this.roomVersion += 1;
    this.save();
    this.emit('state');
    return true;
  }
}
