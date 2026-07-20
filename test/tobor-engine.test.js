import assert from 'node:assert/strict';
import test from 'node:test';
import { SPEED_PRESETS, ToborEngine } from '../src/tobor/engine.js';

const ENTER_CELL_SECONDS = (1 / SPEED_PRESETS.normal.tilesPerSecond) + 0.01;

function object(id, x, y, overrides = {}) {
  return { id, x, y, type: 0, subType: 0, drift: -1, flag: -1, alive: true, ...overrides };
}

function fakeGame(roomObjects = []) {
  const room = {
    id: 'ROOM_000', numericId: '000', x: 0, y: 0, z: 0, darkness: 0, music: '',
    objects: [object('OBJ_START_POSITION', 2, 2), ...roomObjects],
  };
  const rooms = new Map([[room.id, room]]);
  return {
    rooms,
    metadata: { winType: 4 },
    text: (key, fallback) => fallback ?? key,
    roomName: () => 'Test Room',
    roomAt: (x, y, z) => [...rooms.values()].find((entry) => entry.x === x && entry.y === y && entry.z === z) ?? null,
  };
}

test('movement starts on key down and finishes the current Tobor grid step after key up', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.pressDirection('right');
  engine.update(0.05);
  const movingX = engine.player.x;
  assert.ok(movingX > 2 && movingX < 3);
  engine.releaseDirection('right');
  engine.update(ENTER_CELL_SECONDS);
  assert.equal(engine.player.x, 3);
  assert.equal(engine.player.moving, false);
  engine.pressDirection('right');
  engine.update(0.05);
  assert.ok(engine.player.x > 3);
});

test('movement presets reproduce all five original Tobor speed factors', () => {
  assert.equal(SPEED_PRESETS.verySlow.tilesPerSecond, 4);
  assert.equal(SPEED_PRESETS.slow.tilesPerSecond, 6);
  assert.equal(SPEED_PRESETS.normal.tilesPerSecond, 8);
  assert.equal(SPEED_PRESETS.fast.tilesPerSecond, 10);
  assert.equal(SPEED_PRESETS.veryFast.tilesPerSecond, 12);
  assert.ok(SPEED_PRESETS.verySlow.tilesPerSecond < SPEED_PRESETS.slow.tilesPerSecond);
  assert.ok(SPEED_PRESETS.slow.tilesPerSecond < SPEED_PRESETS.normal.tilesPerSecond);
  assert.ok(SPEED_PRESETS.normal.tilesPerSecond < SPEED_PRESETS.fast.tilesPerSecond);
  assert.ok(SPEED_PRESETS.fast.tilesPerSecond < SPEED_PRESETS.veryFast.tilesPerSecond);
});

test('solid Tobor terrain blocks movement while floors remain walkable', () => {
  const wallEngine = new ToborEngine(fakeGame([object('OBJ_WALL_HARD', 3, 2)]));
  wallEngine.newGame();
  wallEngine.pressDirection('right');
  wallEngine.update(1);
  assert.equal(wallEngine.player.x, 2);

  const pathEngine = new ToborEngine(fakeGame([object('OBJ_PATH', 3, 2)]));
  pathEngine.newGame();
  pathEngine.pressDirection('right');
  pathEngine.update(ENTER_CELL_SECONDS);
  assert.equal(pathEngine.player.x, 3);
});

test('all four rings are required by the episode goal', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  for (let index = 0; index < 3; index += 1) engine.addInventory(`OBJ_RING#${index}`);
  assert.equal(engine.checkWinCondition(), false);
  engine.addInventory('OBJ_RING#3');
  assert.equal(engine.checkWinCondition(), true);
  assert.equal(engine.won, true);
});

test('munition uses Tobor stack values and never exceeds 21 shots', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();

  assert.equal(engine.addAmmunition(6), 0);
  assert.equal(engine.ammunitionCount(), 6);
  assert.equal(engine.inventoryCount('OBJ_MUNITION#5'), 1);
  assert.equal(engine.addAmmunition(17), 2);
  assert.equal(engine.ammunitionCount(), 21);
  assert.equal(engine.removeAmmunition(1), true);
  assert.equal(engine.ammunitionCount(), 20);
});

test('walking onto a sling consumes one shot and leaves the sling in the room', () => {
  const sling = object('OBJ_SLING', 3, 2);
  const engine = new ToborEngine(fakeGame([sling]));
  engine.newGame();
  engine.addAmmunition(3);

  engine.pressDirection('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.ammunitionCount(), 2);
  assert.equal(engine.roomObjects().find((entry) => entry.id === 'OBJ_SLING')?.alive, true);
  assert.equal(engine.roomObjects().filter((entry) => entry.id === 'OBJ_BULLET').length, 1);
});

test('a target hit by a bullet switches matching electric objects', () => {
  const target = object('OBJ_TARGET', 3, 2, { flag: 4 });
  const door = object('OBJ_ELECTRIC_DOOR_0', 5, 5, { flag: 4 });
  const engine = new ToborEngine(fakeGame([target, door]));
  engine.newGame();
  engine.speedPreset = 'fast';
  engine.fireBullet(2, 2, 'right');

  engine.update(0.26);

  assert.equal(engine.roomObjects().find((entry) => entry.x === 5 && entry.y === 5)?.id, 'OBJ_ELECTRIC_DOOR_1');
  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_BULLET'), false);
});

test('mirror type zero reflects an eastbound bullet to the north', () => {
  const mirror = object('OBJ_MIRROR_0', 3, 2, { type: 0 });
  const engine = new ToborEngine(fakeGame([mirror]));
  engine.newGame();
  engine.speedPreset = 'fast';
  engine.fireBullet(2, 2, 'right');

  engine.update(0.26);

  const reflected = engine.roomObjects().find((entry) => entry.id === 'OBJ_BULLET');
  assert.deepEqual(reflected._direction, { x: 0, y: -1 });
  assert.equal(reflected.x, 3);
  assert.equal(reflected.y, 2);
});

test('bullets pass water-floor objects and push soft isolators like Tobor', () => {
  const waterPlantEngine = new ToborEngine(fakeGame([object('OBJ_WATER_PLANT', 3, 2)]));
  waterPlantEngine.newGame();
  waterPlantEngine.speedPreset = 'fast';
  const passingBullet = waterPlantEngine.fireBullet(2, 2, 'right');
  passingBullet._maxDistance = 10;
  waterPlantEngine.update(0.3);
  assert.equal(passingBullet.alive, true);
  assert.equal(passingBullet.x, 3);

  const soft = object('OBJ_ISOLATOR_SOFT', 3, 2);
  const pushEngine = new ToborEngine(fakeGame([soft]));
  pushEngine.newGame();
  pushEngine.speedPreset = 'fast';
  const pushingBullet = pushEngine.fireBullet(2, 2, 'right');
  pushingBullet._maxDistance = 10;
  pushEngine.update(0.3);
  assert.equal(pushingBullet.alive, false);
  assert.equal(pushEngine.roomObjects().find((entry) => entry.id === 'OBJ_ISOLATOR_SOFT').x, 4);
});

test('Tobor floor rules block pushables on paths, sand and collectibles but permit chain pushing on empty ground', () => {
  for (const obstacle of [object('OBJ_PATH', 4, 2), object('OBJ_SAND#0', 4, 2), object('OBJ_KEY#0', 4, 2)]) {
    const isolator = object('OBJ_ISOLATOR', 3, 2);
    const engine = new ToborEngine(fakeGame([isolator, obstacle]));
    engine.newGame();
    assert.equal(engine.pushObject(isolator, 'right'), false);
    assert.equal(isolator.x, 3);
  }

  const first = object('OBJ_ISOLATOR', 3, 2);
  const second = object('OBJ_ISOLATOR', 4, 2);
  const chainEngine = new ToborEngine(fakeGame([first, second]));
  chainEngine.newGame();
  const runtimeFirst = chainEngine.objectsAt(3, 2).find((entry) => entry.id === 'OBJ_ISOLATOR');
  assert.equal(chainEngine.pushObject(runtimeFirst, 'right'), true);
  assert.equal(runtimeFirst.x, 4);
  assert.equal(chainEngine.objectsAt(5, 2).some((entry) => entry.id === 'OBJ_ISOLATOR'), true);
});

test('shoes, knife and sickle reproduce the original path and plant gates', () => {
  const shoesEngine = new ToborEngine(fakeGame([object('OBJ_MOUNTAIN_PATH', 3, 2)]));
  shoesEngine.newGame();
  assert.equal(shoesEngine.tryStartMove('right'), false);
  shoesEngine.addInventory('OBJ_SHOES');
  assert.equal(shoesEngine.tryStartMove('right'), true);

  const knifeEngine = new ToborEngine(fakeGame([object('OBJ_SAND_PLANT_0', 3, 2)]));
  knifeEngine.newGame();
  assert.equal(knifeEngine.tryStartMove('right'), false);
  knifeEngine.addInventory('OBJ_KNIFE');
  assert.equal(knifeEngine.tryStartMove('right'), true);

  const sickleEngine = new ToborEngine(fakeGame([object('OBJ_PLANT', 3, 2)]));
  sickleEngine.newGame();
  assert.equal(sickleEngine.tryStartMove('right'), false);
  sickleEngine.addInventory('OBJ_SICKLE');
  assert.equal(sickleEngine.tryStartMove('right'), true);
});

test('dynamic Tobor entities remain pass-through for players, AI, bullets, pushables and dropped items', () => {
  for (const id of ['OBJ_PLANT_GROWING', 'OBJ_TORCH', 'OBJ_WATCHER', 'OBJ_SHOOTER_0']) {
    const engine = new ToborEngine(fakeGame([object(id, 3, 2)]));
    engine.newGame();
    assert.equal(engine.tryStartMove('right'), true, `${id} blockiert Charlie`);

    const robot = object('OBJ_ROBOT', 2, 3);
    engine.currentRoom.objects.push(robot);
    assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: -1 }), true, `${id} blockiert KI`);
    assert.equal(engine.canDropAt(3, 2), true, `${id} blockiert Gegenstände`);
    assert.equal(engine.canPushableEnterObject(object('OBJ_ISOLATOR', 2, 2), object(id, 3, 2)), true, `${id} blockiert Isolatoren`);
  }

  const bulletEngine = new ToborEngine(fakeGame([object('OBJ_SHOOTER_0', 3, 2)]));
  bulletEngine.newGame();
  bulletEngine.speedPreset = 'fast';
  const bullet = bulletEngine.fireBullet(2, 2, 'right');
  bullet._maxDistance = 10;
  bulletEngine.update(0.3);
  assert.equal(bullet.alive, true);
  assert.equal(bullet.x, 3);
});

test('growing plants are harmless without a sickle and are cut only when Charlie carries one', () => {
  const untouched = object('OBJ_PLANT_GROWING', 3, 2, { type: 4 });
  const engine = new ToborEngine(fakeGame([untouched]));
  engine.newGame();
  engine.tryStartMove('right');
  engine.update(ENTER_CELL_SECONDS);
  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_PLANT_GROWING'), true);

  const cutEngine = new ToborEngine(fakeGame([object('OBJ_PLANT_GROWING', 3, 2, { type: 4 })]));
  cutEngine.newGame();
  cutEngine.addInventory('OBJ_SICKLE');
  cutEngine.tryStartMove('right');
  cutEngine.update(ENTER_CELL_SECONDS);
  assert.equal(cutEngine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_PLANT_GROWING'), false);
});

test('AI obeys arrows and plants, while Charlie standing on an arrow releases it like Tobor', () => {
  const robot = object('OBJ_ROBOT', 2, 2);
  const engine = new ToborEngine(fakeGame([
    robot,
    object('OBJ_ARROW_1', 3, 2, { type: 1 }),
    object('OBJ_PLANT', 2, 3),
    object('OBJ_SAND_PLANT_0', 1, 2),
  ]));
  engine.newGame();

  assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: 0 }), false);
  assert.equal(engine.canActorEnter(robot, 2, 3, { x: 0, y: 1 }), false);
  assert.equal(engine.canActorEnter(robot, 1, 2, { x: -1, y: 0 }), false);
  engine.player.x = 3;
  engine.player.y = 2;
  assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: 0 }), true);

  robot.id = 'OBJ_ANDROID';
  assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: 0 }), true);
});

test('enemy terrain rules match Tobor for water edges, ice, thermo plates, nests and goals', () => {
  const robot = object('OBJ_ROBOT', 2, 2);
  const android = object('OBJ_ANDROID', 2, 2);
  const scorpion = object('OBJ_SCORPION', 2, 2, { type: 1 });
  const engine = new ToborEngine(fakeGame([
    robot,
    object('OBJ_WATER_NW', 3, 2, { type: 2, subType: 1 }),
    object('OBJ_ICE_0', 2, 3),
    object('OBJ_THERMOPLATE_1', 1, 2, { type: 1 }),
    object('OBJ_GROUND_NEST', 2, 1),
    object('OBJ_GOAL_0', 3, 3),
  ]));
  engine.newGame();

  assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: 0 }), true);
  assert.equal(engine.canActorEnter(scorpion, 2, 3, { x: 0, y: 1 }), false);
  assert.equal(engine.canActorEnter(robot, 2, 3, { x: 0, y: 1 }), true);
  assert.equal(engine.canActorEnter(robot, 1, 2, { x: -1, y: 0 }), true);
  assert.equal(engine.canActorEnter(android, 1, 2, { x: -1, y: 0 }), false);
  assert.equal(engine.canActorEnter(android, 2, 1, { x: 0, y: -1 }), false);
  assert.equal(engine.canActorEnter(robot, 3, 3, { x: 1, y: 1 }), false);
});

test('sharks require full water and respect other blockers on the target cell', () => {
  const shark = object('OBJ_SHARK', 2, 2);
  const cornerEngine = new ToborEngine(fakeGame([shark, object('OBJ_WATER_NW', 3, 2, { type: 2, subType: 1 })]));
  cornerEngine.newGame();
  assert.equal(cornerEngine.canActorEnter(shark, 3, 2, { x: 1, y: 0 }), false);

  const blockedShark = object('OBJ_SHARK', 2, 2);
  const blockedEngine = new ToborEngine(fakeGame([
    blockedShark,
    object('OBJ_WATER_SHALLOW', 3, 2),
    object('OBJ_WATER_PLANT', 3, 2),
  ]));
  blockedEngine.newGame();
  assert.equal(blockedEngine.canActorEnter(blockedShark, 3, 2, { x: 1, y: 0 }), false);

  const freeShark = object('OBJ_SHARK', 2, 2);
  const freeEngine = new ToborEngine(fakeGame([freeShark, object('OBJ_WATER_DEEP', 3, 2)]));
  freeEngine.newGame();
  assert.equal(freeEngine.canActorEnter(freeShark, 3, 2, { x: 1, y: 0 }), true);
});

test('robots hesitate at electric fences unless Charlie is already standing there', () => {
  const robot = object('OBJ_ROBOT', 2, 2);
  const engine = new ToborEngine(fakeGame([robot, object('OBJ_ELECTRIC_FENCE', 3, 2)]));
  engine.newGame();
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: 0 }), false);
    engine.player.x = 3;
    engine.player.y = 2;
    assert.equal(engine.canActorEnter(robot, 3, 2, { x: 1, y: 0 }), true);
  } finally {
    Math.random = originalRandom;
  }
});

test('barriers and room exits reproduce Tobor robot and tree-timer rules for every mover', () => {
  const blockedEngine = new ToborEngine(fakeGame([
    object('OBJ_BARRIER', 3, 2),
    object('OBJ_ROBOT', 8, 8),
  ]));
  blockedEngine.newGame();
  assert.equal(blockedEngine.tryStartMove('right'), false);

  blockedEngine.currentRoom.treeTimer = 5;
  assert.equal(blockedEngine.tryStartMove('right'), true);

  const actor = object('OBJ_NPC', 2, 3);
  const actorEngine = new ToborEngine(fakeGame([
    actor,
    object('OBJ_ROOM_EXIT', 3, 3),
    object('OBJ_ROBOT', 8, 8),
  ]));
  actorEngine.newGame();
  assert.equal(actorEngine.canActorEnter(actor, 3, 3, { x: 1, y: 0 }), false);
  actorEngine.currentRoom.treeTimer = 5;
  assert.equal(actorEngine.canActorEnter(actor, 3, 3, { x: 1, y: 0 }), true);

  const openEngine = new ToborEngine(fakeGame([
    actor,
    object('OBJ_ROOM_EXIT', 3, 3),
  ]));
  openEngine.newGame();
  assert.equal(openEngine.canActorEnter(actor, 3, 3, { x: 1, y: 0 }), true);

  const utilityEngine = new ToborEngine(fakeGame([object('OBJ_BARRIER', 2, 2)]));
  utilityEngine.newGame();
  const barrier = utilityEngine.objectsAt(2, 2).find((entry) => entry.id === 'OBJ_BARRIER');
  assert.equal(utilityEngine.canPushableEnterObject(object('OBJ_ISOLATOR', 1, 2), barrier), false);
  assert.equal(utilityEngine.canDropAt(2, 2), false);
  utilityEngine.currentRoom.treeTimer = 5;
  assert.equal(utilityEngine.canPushableEnterObject(object('OBJ_ISOLATOR', 1, 2), barrier), true);
  assert.equal(utilityEngine.canDropAt(2, 2), true);
});

test('only Charlie can enter a skull tile before the trap triggers', () => {
  const robot = object('OBJ_ROBOT', 2, 3);
  const engine = new ToborEngine(fakeGame([robot, object('OBJ_SKULL', 3, 3)]));
  engine.newGame();

  assert.equal(engine.canActorEnter(robot, 3, 3, { x: 1, y: 0 }), false);
  assert.equal(engine.tryStartMove('southeast'), true);
});

test('robots use Tobor garlic and doppelganger targeting before their single weighted dodge', () => {
  const robot = object('OBJ_ROBOT', 5, 5);
  const engine = new ToborEngine(fakeGame([
    robot,
    object('OBJ_DOPPELGANGER', 3, 3),
    object('OBJ_WALL_HARD', 4, 4),
    object('OBJ_WALL_HARD', 5, 4),
    object('OBJ_WALL_HARD', 4, 5),
    object('OBJ_WALL_HARD', 6, 6),
  ]));
  engine.newGame();
  engine.garlic = 10;
  const runtimeRobot = engine.roomObjects().find((entry) => entry.id === 'OBJ_ROBOT');

  assert.deepEqual(engine.getActorTargetDirection(runtimeRobot), { x: -1, y: -1 });

  const originalRandom = Math.random;
  const randomValues = [0, 0];
  Math.random = () => randomValues.shift() ?? 0;
  try {
    engine.startActorMove(runtimeRobot);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(runtimeRobot._motion, undefined);
  assert.equal(runtimeRobot._stress, 1);
});

test('androids stop after Tobor three-step dodging instead of searching every free direction', () => {
  const android = object('OBJ_ANDROID', 5, 5);
  const engine = new ToborEngine(fakeGame([
    android,
    object('OBJ_WALL_HARD', 4, 4),
    object('OBJ_WALL_HARD', 5, 4),
    object('OBJ_WALL_HARD', 4, 5),
    object('OBJ_WALL_HARD', 5, 6),
  ]));
  engine.newGame();
  const runtimeAndroid = engine.roomObjects().find((entry) => entry.id === 'OBJ_ANDROID');

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    engine.startActorMove(runtimeAndroid);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(runtimeAndroid.alive, true);
  assert.equal(runtimeAndroid._motion, undefined);
});

test('doppelgangers mirror held keys in Tobor priority order', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_DOPPELGANGER', 10, 10)]));
  engine.newGame();
  engine.heldDirections = ['right', 'left'];
  const doppelganger = engine.roomObjects().find((entry) => entry.id === 'OBJ_DOPPELGANGER');

  engine.startActorMove(doppelganger);

  assert.equal(doppelganger._motion.toX, 11);
  assert.equal(doppelganger._motion.toY, 10);
});

test('NPCs may start moving immediately and Tobor random movement includes diagonals', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_NPC', 10, 10)]));
  engine.newGame();
  const npc = engine.roomObjects().find((entry) => entry.id === 'OBJ_NPC');

  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    engine.update(0.01);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(npc._motion.toX, 9);
  assert.equal(npc._motion.toY, 9);
});

test('monster footsteps sound when movement starts instead of one tile late', () => {
  const events = [];
  const engine = new ToborEngine(fakeGame([object('OBJ_ROBOT', 5, 2)]), (event) => events.push(event));
  engine.newGame();
  events.length = 0;
  const robot = engine.objectsAt(5, 2)[0];

  assert.equal(engine.startActorMotion(robot, { x: 1, y: 0 }, 2), true);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'robot-step').length, 1);
  engine.update(1);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'robot-step').length, 1);
});

test('NPCs never hurt Charlie and dealers release typed contents once after their cooldown', () => {
  const npc = object('OBJ_NPC', 2, 2, { flag: -1, _interactionCooldown: 0 });
  const dealer = object('OBJ_DEALER', 3, 2, { content: 'OBJ_KEY#7', _interactionCooldown: 0 });
  const engine = new ToborEngine(fakeGame([npc, dealer]));
  engine.newGame();

  engine.onActorEntered(npc);
  assert.equal(engine.lives, 3);
  assert.equal(engine.interactWithNpc(dealer), true);
  const released = engine.objectsAt(3, 2).find((entry) => entry.id === 'OBJ_KEY#7');
  assert.equal(released?.type, 7);
  assert.equal(dealer.content, null);
  assert.equal(engine.interactWithNpc(dealer), false);
});

test('dealers inherit the NPC rule and never trigger ammunition', () => {
  const dealer = object('OBJ_DEALER', 3, 2, { _lastDirection: { x: 1, y: 0 } });
  const ammunition = object('OBJ_MUNITION#2', 3, 2, { type: 2 });
  const engine = new ToborEngine(fakeGame([dealer, ammunition]));
  engine.newGame();
  engine.onActorEntered(dealer);
  assert.equal(ammunition.type, 2);
  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_BULLET'), false);
});

test('items can be stacked on valid floors but not dropped into water or a teleporter', () => {
  const validEngine = new ToborEngine(fakeGame([object('OBJ_PATH', 2, 2), object('OBJ_KEY#0', 2, 2)]));
  validEngine.newGame();
  assert.equal(validEngine.canDropAt(2, 2), true);

  const waterEngine = new ToborEngine(fakeGame([object('OBJ_WATER_SHALLOW', 2, 2)]));
  waterEngine.newGame();
  assert.equal(waterEngine.canDropAt(2, 2), false);

  const teleportEngine = new ToborEngine(fakeGame([object('OBJ_TELEPORT_END_1', 2, 2)]));
  teleportEngine.newGame();
  assert.equal(teleportEngine.canDropAt(2, 2), false);
});

test('the editor-only start marker disappears before gameplay and no longer blocks planting there', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_START_POSITION'), false);
  engine.addInventory('OBJ_SEED');
  assert.equal(engine.useItem('OBJ_SEED'), true);
  assert.equal(engine.objectsAt(2, 2).some((entry) => entry.id === 'OBJ_PLANT'), true);
});

test('an active factory spawns one robot while no robot or android is alive', () => {
  const factory = object('OBJ_ROBOT_FACTORY_1', 7, 7, { type: 1 });
  const engine = new ToborEngine(fakeGame([factory]));
  engine.newGame();

  engine.update(0.01);
  assert.equal(engine.roomRobotCount, 1);
  engine.update(0.01);
  assert.equal(engine.roomRobotCount, 1);
});

test('room exits count robots and androids, not sharks or scorpions', () => {
  const engine = new ToborEngine(fakeGame([
    object('OBJ_SHARK', 10, 10),
    object('OBJ_SCORPION', 11, 10, { type: 1 }),
  ]));
  engine.newGame();

  assert.equal(engine.roomEnemyCount, 2);
  assert.equal(engine.roomRobotCount, 0);
});

test('a floor plate stays active only while a heavy entity holds it down', () => {
  const plate = object('OBJ_ELECTRIC_FLOOR_PLATE_0', 2, 2, { type: 0, flag: 7 });
  const door = object('OBJ_ELECTRIC_DOOR_0', 6, 6, { type: 0, flag: 7 });
  const engine = new ToborEngine(fakeGame([plate, door]));

  engine.newGame();
  assert.equal(engine.objectsAt(2, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')).type, 1);
  assert.equal(engine.objectsAt(6, 6)[0].type, 1);

  engine.pressDirection('right');
  assert.equal(engine.objectsAt(2, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')).type, 0);
  assert.equal(engine.objectsAt(6, 6)[0].type, 0);
});

test('a filled bucket, but not an empty one, keeps a floor plate pressed after Charlie leaves', () => {
  const lightEngine = new ToborEngine(fakeGame([
    object('OBJ_ELECTRIC_FLOOR_PLATE_0', 2, 2, { type: 0, flag: 7 }),
  ]));
  lightEngine.newGame();
  lightEngine.addInventory('OBJ_BUCKET#0');
  assert.equal(lightEngine.dropItem('OBJ_BUCKET#0'), true);
  lightEngine.pressDirection('right');
  assert.equal(lightEngine.objectsAt(2, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')).type, 0);

  const heavyEngine = new ToborEngine(fakeGame([
    object('OBJ_ELECTRIC_FLOOR_PLATE_0', 2, 2, { type: 0, flag: 7 }),
  ]));
  heavyEngine.newGame();
  heavyEngine.addInventory('OBJ_BUCKET#1');
  assert.equal(heavyEngine.dropItem('OBJ_BUCKET#1'), true);
  heavyEngine.pressDirection('right');
  assert.equal(heavyEngine.objectsAt(2, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_')).type, 1);
});

test('soft isolators are weightless while hard isolators activate floor plates', () => {
  const softPlate = object('OBJ_ELECTRIC_FLOOR_PLATE_0', 5, 2, { type: 0, flag: 7 });
  const softDoor = object('OBJ_ELECTRIC_DOOR_0', 8, 8, { type: 0, flag: 7 });
  const hard = object('OBJ_ISOLATOR', 3, 2);
  const soft = object('OBJ_ISOLATOR_SOFT', 4, 2);
  const softEngine = new ToborEngine(fakeGame([hard, soft, softPlate, softDoor]));
  softEngine.newGame();
  const runtimeSoftPlate = softEngine.objectsAt(5, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_'));
  const runtimeSoftDoor = softEngine.objectsAt(8, 8)[0];

  assert.equal(softEngine.pushObject(softEngine.objectsAt(3, 2)[0], 'right'), true);
  assert.equal(softEngine.objectsAt(5, 2).some((entry) => entry.id === 'OBJ_ISOLATOR_SOFT'), true);
  assert.equal(runtimeSoftPlate.type, 0);
  assert.equal(runtimeSoftDoor.type, 0);

  const hardPlate = object('OBJ_ELECTRIC_FLOOR_PLATE_0', 4, 2, { type: 0, flag: 7 });
  const hardDoor = object('OBJ_ELECTRIC_DOOR_0', 8, 8, { type: 0, flag: 7 });
  const hardEngine = new ToborEngine(fakeGame([object('OBJ_ISOLATOR', 3, 2), hardPlate, hardDoor]));
  hardEngine.newGame();
  const runtimeHardPlate = hardEngine.objectsAt(4, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_'));
  const runtimeHardDoor = hardEngine.objectsAt(8, 8)[0];

  assert.equal(hardEngine.pushObject(hardEngine.objectsAt(3, 2)[0], 'right'), true);
  assert.equal(runtimeHardPlate.type, 1);
  assert.equal(runtimeHardDoor.type, 1);
});

test('an ice block melting in place releases the floor plate below it', () => {
  const floorPlate = object('OBJ_ELECTRIC_FLOOR_PLATE_0', 4, 2, { type: 0, flag: 7 });
  const door = object('OBJ_ELECTRIC_DOOR_0', 8, 8, { type: 0, flag: 7 });
  const ice = object('OBJ_ICE_BLOCK', 3, 2, { flag: 9 });
  const target = object('OBJ_TARGET', 1, 1, { flag: 9 });
  const thermoPlate = object('OBJ_THERMOPLATE_1', 10, 10, { type: 1, flag: 9 });
  const engine = new ToborEngine(fakeGame([ice, floorPlate, door, target, thermoPlate]));
  engine.newGame();
  const runtimeIce = engine.objectsAt(3, 2)[0];
  const runtimeFloorPlate = engine.objectsAt(4, 2).find((entry) => entry.id.startsWith('OBJ_ELECTRIC_FLOOR_PLATE_'));
  const runtimeDoor = engine.objectsAt(8, 8)[0];
  const runtimeTarget = engine.objectsAt(1, 1)[0];

  assert.equal(engine.pushObject(runtimeIce, 'right'), true);
  assert.equal(runtimeFloorPlate.type, 1);
  assert.equal(runtimeDoor.type, 1);

  engine.switchFlag(9, runtimeTarget);
  assert.equal(runtimeIce.alive, false);
  assert.equal(runtimeFloorPlate.type, 0);
  assert.equal(runtimeDoor.type, 0);
});

test('an electric thermo plate creates and removes its flagged ice block', () => {
  const trigger = object('OBJ_TARGET', 1, 1, { flag: 3 });
  const plate = object('OBJ_THERMOPLATE_0', 8, 8, { type: 0, flag: 3 });
  const engine = new ToborEngine(fakeGame([trigger, plate]));
  engine.newGame();

  engine.switchFlag(3, trigger);
  assert.equal(engine.objectsAt(8, 8).some((entry) => entry.id === 'OBJ_ICE_BLOCK'), true);
  assert.equal(engine.objectsAt(8, 8).find((entry) => entry.id.startsWith('OBJ_THERMOPLATE_')).type, 1);

  engine.switchFlag(3, trigger);
  assert.equal(engine.objectsAt(8, 8).some((entry) => entry.id === 'OBJ_ICE_BLOCK'), false);
  assert.equal(engine.objectsAt(8, 8).find((entry) => entry.id.startsWith('OBJ_THERMOPLATE_')).type, 0);
});

test('a water bucket consumes on a cold thermo plate but spawns ice only on a free plate', () => {
  const blockedEngine = new ToborEngine(fakeGame([
    object('OBJ_THERMOPLATE_1', 3, 2, { type: 1, flag: 3 }),
    object('OBJ_KEY#0', 3, 2),
  ]));
  blockedEngine.newGame();
  blockedEngine.addInventory('OBJ_BUCKET#1');
  assert.equal(blockedEngine.useItem('OBJ_BUCKET#1'), true);
  assert.equal(blockedEngine.inventoryHas('OBJ_BUCKET#0'), true);
  assert.equal(blockedEngine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_ICE_BLOCK'), false);

  const freeEngine = new ToborEngine(fakeGame([
    object('OBJ_THERMOPLATE_1', 3, 2, { type: 1, flag: 3 }),
  ]));
  freeEngine.newGame();
  freeEngine.addInventory('OBJ_BUCKET#1');
  assert.equal(freeEngine.useItem('OBJ_BUCKET#1'), true);
  assert.equal(freeEngine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_ICE_BLOCK'), true);
});

test('seed growth draws two free directions in Tobor west-east-north-south order', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.addInventory('OBJ_SEED');

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.equal(engine.useItem('OBJ_SEED'), true);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(engine.objectsAt(1, 2).some((entry) => entry.id === 'OBJ_PLANT_GROWING' && entry.type === 0), true);
  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_PLANT_GROWING' && entry.type === 6), true);
});

test('growing plants never branch into Charlie cell', () => {
  const engine = new ToborEngine(fakeGame([
    object('OBJ_PLANT_GROWING', 3, 2, { type: 2, _growTime: 0 }),
  ]));
  engine.newGame();

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    engine.update(0.01);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(engine.objectsAt(2, 2).some((entry) => entry.id === 'OBJ_PLANT_GROWING'), false);
});

test('a ground nest hatches a robot when Charlie enters it', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_GROUND_NEST', 3, 2)]));
  engine.newGame();
  engine.pressDirection('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_GROUND_NEST'), false);
  assert.equal(engine.roomRobotCount, 1);
});

test('stepping onto a skull surrounds the area with electric fences', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_SKULL', 3, 2)]));
  engine.newGame();
  engine.pressDirection('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_SKULL'), false);
  assert.ok(engine.roomObjects().filter((entry) => entry.id === 'OBJ_ELECTRIC_FENCE').length >= 7);
});

test('a skull fence avoids Charlie and walls but may trap AI on valid Tobor floors', () => {
  const engine = new ToborEngine(fakeGame([
    object('OBJ_SKULL', 3, 2),
    object('OBJ_ROBOT', 4, 2),
    object('OBJ_WALL_HARD', 2, 1),
    object('OBJ_SAND#0', 3, 1),
  ]));
  engine.newGame();
  engine.player.x = 3;
  engine.player.y = 2;
  const skull = engine.objectsAt(3, 2).find((entry) => entry.id === 'OBJ_SKULL');

  engine.triggerSkull(skull);

  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_ELECTRIC_FENCE'), false);
  assert.equal(engine.objectsAt(4, 2).some((entry) => entry.id === 'OBJ_ELECTRIC_FENCE'), true);
  assert.equal(engine.objectsAt(2, 1).some((entry) => entry.id === 'OBJ_ELECTRIC_FENCE'), false);
  assert.equal(engine.objectsAt(3, 1).some((entry) => entry.id === 'OBJ_ELECTRIC_FENCE'), true);
});

test('a watcher reveals itself nearby and becomes a robot at close range', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_WATCHER', 4, 2)]));
  engine.newGame();
  engine.update(0.01);
  const watcher = engine.roomObjects().find((entry) => entry.id === 'OBJ_WATCHER');
  assert.equal(watcher.visible, true);

  engine.player.x = 3;
  engine.update(0.5);
  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_WATCHER'), false);
  assert.equal(engine.roomRobotCount, 1);
});

test('ordinary inventory items can be dropped back into the current room', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.addInventory('OBJ_SHOES');

  assert.equal(engine.dropItem('OBJ_SHOES'), true);
  assert.equal(engine.inventoryHas('OBJ_SHOES'), false);
  assert.equal(engine.objectsAt(2, 2).some((entry) => entry.id === 'OBJ_SHOES'), true);
});

test('the exclamation mark opens world inspection and a clock is consumed by saving', (t) => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  t.after(() => { globalThis.localStorage = originalStorage; });
  const events = [];
  const engine = new ToborEngine(fakeGame([object('OBJ_WALL_HARD', 4, 2)]), (event) => events.push(event));
  engine.newGame();
  engine.addInventory('OBJ_EXCLAMATION_MARK');
  engine.addInventory('OBJ_CLOCK');

  assert.equal(engine.useItem('OBJ_EXCLAMATION_MARK'), true);
  assert.equal(events.at(-1).type, 'inspect');
  assert.equal(engine.inspectAt(4, 2), true);
  assert.equal(events.at(-1).type, 'message');
  assert.equal(engine.useItem('OBJ_CLOCK'), true);
  assert.equal(engine.inventoryHas('OBJ_CLOCK'), false);
});

test('a clock creates a durable checkpoint that later autosaves do not overwrite', (t) => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  t.after(() => { globalThis.localStorage = originalStorage; });

  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.gold = 7;
  engine.addInventory('OBJ_CLOCK');
  assert.equal(engine.useItem('OBJ_CLOCK'), true);
  assert.equal(engine.hasClockSave(), true);

  engine.gold = 99;
  engine.save();
  const restored = new ToborEngine(fakeGame());
  assert.equal(restored.loadClockSave(), true);
  assert.equal(restored.gold, 7);
  assert.equal(restored.inventoryHas('OBJ_CLOCK'), false);
});

test('a clock is returned to the inventory when browser storage is unavailable', (t) => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('storage disabled'); },
  };
  t.after(() => { globalThis.localStorage = originalStorage; });

  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.addInventory('OBJ_CLOCK');
  assert.equal(engine.useItem('OBJ_CLOCK'), false);
  assert.equal(engine.inventoryHas('OBJ_CLOCK'), true);
});

test('an unlocked door and the original first footstep both sound as movement starts', () => {
  const events = [];
  const engine = new ToborEngine(fakeGame([object('OBJ_DOOR#0', 3, 2, { type: 0 })]), (event) => events.push(event));
  engine.newGame();
  engine.addInventory('OBJ_KEY#0');
  events.length = 0;

  assert.equal(engine.tryStartMove('right'), true);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'open-door').length, 1);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'charlie-step').length, 1);
  engine.update(ENTER_CELL_SECONDS);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'open-door').length, 1);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'charlie-step').length, 2);
});

test('colliding with a monster immediately shows and sounds the original six-frame explosion', () => {
  const events = [];
  const robot = object('OBJ_ROBOT', 3, 2, { _moveCooldown: 999 });
  const engine = new ToborEngine(fakeGame([robot]), (event) => events.push(event));
  engine.newGame();
  events.length = 0;

  engine.tryStartMove('right');
  engine.update(ENTER_CELL_SECONDS);

  const explosion = engine.objectsAt(3, 2).find((entry) => entry.id === 'OBJ_EXPLOSION');
  assert.ok(explosion);
  assert.equal(explosion._explosionDuration, 2.5);
  assert.equal(engine.player.visible, false);
  assert.equal(engine.death.cause, 'OBJ_ROBOT');
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'explosion-player').length, 1);

  engine.update(2.49);
  assert.equal(explosion.alive, true);
  engine.update(0.02);
  assert.equal(explosion.alive, false);
  assert.equal(engine.player.visible, true);
  assert.equal(engine.player.x, 2);
});

test('losing a life is committed to autosave immediately', (t) => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  t.after(() => { globalThis.localStorage = originalStorage; });

  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.killPlayer('OBJ_ROBOT');
  assert.equal(engine.lives, 2);
  assert.equal(engine.player.visible, false);

  const restored = new ToborEngine(fakeGame());
  assert.equal(restored.load(), true);
  assert.equal(restored.lives, 2);
  assert.equal(restored.player.visible, true);
  assert.equal(restored.player.x, 2);
});

test('game over removes autosave but preserves the last clock checkpoint', (t) => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  t.after(() => { globalThis.localStorage = originalStorage; });

  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.addInventory('OBJ_CLOCK');
  assert.equal(engine.useItem('OBJ_CLOCK'), true);
  for (let life = 0; life < 3; life += 1) {
    engine.killPlayer('OBJ_ROBOT');
    engine.update(2.51);
  }

  assert.equal(engine.lost, true);
  assert.equal(engine.hasSave(), false);
  assert.equal(engine.hasClockSave(), true);
  const restored = new ToborEngine(fakeGame());
  assert.equal(restored.loadClockSave(), true);
  assert.equal(restored.lives, 3);
});

test('a clone duplicates the selected item and is consumed', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  engine.addInventory('OBJ_CLONE');
  engine.addInventory('OBJ_FOOD#0');

  assert.equal(engine.cloneItem('OBJ_FOOD#0'), true);
  assert.equal(engine.inventoryHas('OBJ_CLONE'), false);
  assert.equal(engine.inventoryCount('OBJ_FOOD#0'), 2);
});

test('the doppelganger pickup spawns an actor, awards its first-use points, and is never inventoried', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_DOPPELGANGER_ITEM', 3, 2)]));
  engine.newGame();
  engine.tryStartMove('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_DOPPELGANGER'), true);
  assert.equal(engine.inventoryHas('OBJ_DOPPELGANGER_ITEM'), false);
  assert.equal(engine.points, 500);
});

test('dropping and collecting a magnet applies Tobor arrow rotations', () => {
  const arrow = object('OBJ_ARROW_0', 3, 2, { type: 0 });
  const engine = new ToborEngine(fakeGame([arrow]));
  engine.newGame();
  engine.addInventory('OBJ_MAGNET#0');

  assert.equal(engine.dropItem('OBJ_MAGNET#0'), true);
  assert.equal(engine.objectsAt(3, 2).find((entry) => entry.id.startsWith('OBJ_ARROW_')).type, 0);
  const magnet = engine.objectsAt(2, 2).find((entry) => entry.id === 'OBJ_MAGNET#0');
  engine.collect(magnet);
  assert.equal(engine.objectsAt(3, 2).find((entry) => entry.id.startsWith('OBJ_ARROW_')).type, 3);
});

test('acid replaces a wall with the original five-second dissolve phase', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_WALL', 3, 2)]));
  engine.newGame();
  engine.addInventory('OBJ_ACID');

  assert.equal(engine.useItem('OBJ_ACID'), true);
  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_WALL'), false);
  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_WALL_DISSOLVE'), true);
  engine.update(5.1);
  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_WALL_DISSOLVE'), false);
});

test('a mature android egg hatches into an android', () => {
  const egg = object('OBJ_ANDROID_EGG', 8, 8, { type: 101, _eggTime: 0 });
  const engine = new ToborEngine(fakeGame([egg]));
  engine.newGame();

  engine.update(0.01);
  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_ANDROID_EGG'), false);
  assert.equal(engine.roomObjects().some((entry) => entry.id === 'OBJ_ANDROID'), true);
});

test('water drift indices retain Tobor diagonal directions', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  assert.equal(engine.directionFromDrift(4, 'right'), 'northwest');
  assert.equal(engine.directionFromDrift(6, 'right'), 'southwest');
  assert.equal(engine.directionFromDrift(7, 'left'), 'southeast');
});

test('water without a configured drift rolls three independent Tobor drift phases', () => {
  const engine = new ToborEngine(fakeGame());
  engine.newGame();
  const originalRandom = Math.random;
  const values = [0.2, 0.4, 0.6, 0.8, 0.3, 0.7, 0.5, 0.1, 0.95];
  Math.random = () => values.shift() ?? 0.5;
  try {
    const candidates = engine.waterMovementCandidates(object('OBJ_WATER_SHALLOW', 2, 2, { drift: -1 }), null);
    assert.deepEqual(candidates.slice(0, 3), ['up', 'right', 'northwest']);
  } finally {
    Math.random = originalRandom;
  }
});

test('water plants are ordinary floor objects and never start water drift', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_WATER_PLANT', 3, 2)]));
  engine.newGame();
  engine.tryStartMove('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.player.x, 3);
  assert.equal(engine.motion, null);
});

test('an empty bucket fills immediately when Charlie enters ordinary water', () => {
  const engine = new ToborEngine(fakeGame([
    object('OBJ_WATER_SHALLOW', 3, 2),
    object('OBJ_WALL_HARD', 4, 2),
  ]));
  engine.newGame();
  engine.addInventory('OBJ_BUCKET#0');
  engine.tryStartMove('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.inventoryCount('OBJ_BUCKET#0'), 0);
  assert.equal(engine.inventoryCount('OBJ_BUCKET#1'), 1);
});

test('deadly water kills without starting a forced move from the respawn point', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_WATER_DEADLY', 3, 2)]));
  engine.newGame();
  engine.tryStartMove('right');
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.lives, 2);
  assert.equal(engine.player.x, 3);
  assert.equal(engine.player.visible, false);
  assert.equal(engine.objectsAt(3, 2).some((entry) => entry.id === 'OBJ_EXPLOSION'), true);
  assert.equal(engine.motion, null);
  engine.update(2.51);
  assert.equal(engine.player.x, 2);
  assert.equal(engine.player.visible, true);
});

test('robots and androids die on deadly ice and slide over ordinary ice', () => {
  const doomed = object('OBJ_ROBOT', 5, 2);
  const deadlyEngine = new ToborEngine(fakeGame([object('OBJ_ICE_DEADLY', 5, 2), doomed]));
  deadlyEngine.newGame();
  const doomedRobot = deadlyEngine.roomObjects().find((entry) => entry.id === 'OBJ_ROBOT');
  deadlyEngine.onActorEntered(doomedRobot);
  assert.equal(doomedRobot.alive, false);

  const slider = object('OBJ_ANDROID', 5, 2, { _lastDirection: { x: 1, y: 0 } });
  const iceEngine = new ToborEngine(fakeGame([
    object('OBJ_ICE_0', 5, 2),
    object('OBJ_PATH', 6, 2),
    slider,
  ]));
  iceEngine.newGame();
  const android = iceEngine.roomObjects().find((entry) => entry.id === 'OBJ_ANDROID');
  iceEngine.onActorEntered(android);
  assert.equal(android._motion.toX, 6);
  assert.equal(android._motion.speed, 0.75);
});

test('ice keeps sliding at half speed after the movement key is released', () => {
  const engine = new ToborEngine(fakeGame([
    object('OBJ_ICE_0', 3, 2),
    object('OBJ_PATH', 4, 2),
  ]));
  engine.newGame();
  engine.pressDirection('right');
  engine.update(ENTER_CELL_SECONDS);
  assert.equal(engine.motion.forced, true);
  assert.equal(engine.motion.speedFactor, 0.5);
  engine.releaseDirection('right');
  assert.equal(engine.motion.paused, false);
  engine.update((2 / SPEED_PRESETS.normal.tilesPerSecond) + 0.01);
  assert.equal(engine.player.x, 4);
});

test('lit torches age in the original ten-second stages', () => {
  const engine = new ToborEngine(fakeGame([object('OBJ_TORCH', 8, 8, { type: 1, _torchTime: 0.01 })]));
  engine.newGame();
  engine.update(0.02);
  assert.equal(engine.objectsAt(8, 8)[0].type, 2);
  engine.update(10.01);
  assert.equal(engine.objectsAt(8, 8)[0].type, 3);
});

test('tunnels carry Charlie invisibly and tap at entry, every tile and exit like Tobor', () => {
  const events = [];
  const engine = new ToborEngine(fakeGame([
    object('OBJ_TUNNEL#2', 3, 2, { type: 2 }),
    object('OBJ_TUNNEL#3', 7, 2, { type: 3 }),
  ]), (event) => events.push(event));
  engine.newGame();
  events.length = 0;
  engine.pressDirection('right');
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'charlie-step').length, 1);
  engine.update(ENTER_CELL_SECONDS);

  assert.equal(engine.player.visible, false);
  assert.equal(engine.motion.tunnel, true);
  assert.equal(engine.motion.forced, true);
  assert.equal(engine.motion.speedFactor, 0.5);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'tunnel-step').length, 1);
  engine.releaseDirection('right');
  engine.update((4 / (SPEED_PRESETS.normal.tilesPerSecond * 0.5)) + 0.01);

  assert.equal(engine.player.x, 7);
  assert.equal(engine.player.y, 2);
  assert.equal(engine.player.visible, true);
  assert.equal(engine.motion, null);
  assert.equal(events.filter((event) => event.type === 'sound' && event.name === 'tunnel-step').length, 6);
});
