import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gameRoot = new URL('../public/games/insel-der-ruinen/', import.meta.url);

const sha256 = (name) => createHash('sha256').update(readFileSync(new URL(name, gameRoot))).digest('hex').toUpperCase();

test('the bundled source assets are byte-for-byte the original Insel der Ruinen 1.3 files', () => {
  assert.equal(sha256('rooms.json'), 'C5EC84B959AD559EAA95069EBB0BDC69D75E6949A3474221B1CCBFE4E4B5C801');
  assert.equal(sha256('translation.json'), '64DF9B5A98989134A33ACF51F7ED746C4DF06E5A2FF9B54AFB7A6B87311837EE');
  assert.equal(sha256('tileset.png'), '8FB4A7A460EFF73F51961A90D19937165E729E76154FF946FE412A75E9740621');
});

test('the exact Insel der Ruinen episode data is bundled without reducing the world', () => {
  const world = JSON.parse(readFileSync(new URL('rooms.json', gameRoot), 'utf8'));
  const rooms = Object.entries(world).filter(([id, room]) => /^ROOM_\d+$/.test(id) && Array.isArray(room?.data));
  const objectCount = rooms.reduce((sum, [, room]) => sum + room.data.length, 0);
  const start = rooms
    .flatMap(([roomId, room]) => room.data.map((object) => ({ roomId, object })))
    .find(({ object }) => object.id === 'OBJ_START_POSITION');

  assert.equal(rooms.length, 284);
  assert.equal(objectCount, 281_955);
  assert.equal(world.winType, 4);
  assert.deepEqual(world.flags, [false, false, false, false, false]);
  assert.equal(start.roomId, 'ROOM_592');
  assert.equal(start.object.x, 24);
  assert.equal(start.object.y, 17);
});

test('the episode keeps all German story and puzzle texts', () => {
  const translations = JSON.parse(readFileSync(new URL('translation.json', gameRoot), 'utf8'));
  assert.equal(Object.keys(translations).length, 444);
  assert.ok(translations.TXT_ROOM_592.de.includes('Schiffbruch'));
  assert.equal(typeof translations.TXT_EPISODE_WON.de, 'string');
});

test('the generic Tobor language layer supplies object descriptions and death hints', () => {
  const base = JSON.parse(readFileSync(new URL('../public/games/tobor-base-translation.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(base).length >= 440);
  assert.ok(base.OBJ_ACID_DESC?.de);
  assert.ok(base.KILLED_BY_ROBOT?.de);
  assert.ok(base.DIED_BY_WATER?.de);
});

test('every original staircase has the exact nearest counterpart on the matching world level', () => {
  const world = JSON.parse(readFileSync(new URL('rooms.json', gameRoot), 'utf8'));
  const rooms = Object.entries(world)
    .filter(([id, room]) => /^ROOM_\d+$/.test(id) && Array.isArray(room?.data))
    .map(([id, room]) => ({ id, ...room }));
  const stairs = rooms.flatMap((room) => room.data
    .filter((object) => object.id === 'OBJ_STAIRS_UP' || object.id === 'OBJ_STAIRS_DOWN')
    .map((object) => ({ room, object })));

  assert.equal(stairs.length, 422);
  for (const { room, object } of stairs) {
    const oppositeType = object.type === 0 ? 1 : 0;
    const candidates = rooms
      .filter((candidate) => candidate.x === room.x && candidate.y === room.y)
      .filter((candidate) => object.type === 0 ? candidate.z < room.z : candidate.z > room.z)
      .flatMap((candidate) => candidate.data
        .filter((target) => target.type === oppositeType && target.x === object.x && target.y === object.y)
        .filter((target) => target.id === 'OBJ_STAIRS_UP' || target.id === 'OBJ_STAIRS_DOWN')
        .map((target) => ({ room: candidate, target })));
    assert.ok(candidates.length > 0, `${room.id}: Treppe bei ${object.x},${object.y} hat kein Gegenstück`);
    const nearest = candidates.sort((a, b) => Math.abs(a.room.z - room.z) - Math.abs(b.room.z - room.z))[0];
    assert.equal(Math.sign(nearest.room.z - room.z), object.type === 0 ? -1 : 1);
  }
});

test('all functional tunnels are paired and the six-part goal plus all four rings remain present', () => {
  const world = JSON.parse(readFileSync(new URL('rooms.json', gameRoot), 'utf8'));
  const rooms = Object.entries(world)
    .filter(([id, room]) => /^ROOM_\d+$/.test(id) && Array.isArray(room?.data))
    .map(([id, room]) => ({ id, ...room }));
  const rules = {
    0: { axis: 'y', fixed: 'x', opposite: 1, sign: 1 },
    1: { axis: 'y', fixed: 'x', opposite: 0, sign: -1 },
    2: { axis: 'x', fixed: 'y', opposite: 3, sign: 1 },
    3: { axis: 'x', fixed: 'y', opposite: 2, sign: -1 },
  };

  for (const room of rooms) {
    for (const tunnel of room.data.filter((object) => object.id.startsWith('OBJ_TUNNEL#') && ![16, 17].includes(object.subType))) {
      const rule = rules[tunnel.type];
      const target = room.data.find((object) =>
        object.id.startsWith('OBJ_TUNNEL#')
        && object.type === rule.opposite
        && object[rule.fixed] === tunnel[rule.fixed]
        && Math.sign(object[rule.axis] - tunnel[rule.axis]) === rule.sign,
      );
      assert.ok(target, `${room.id}: Tunnel bei ${tunnel.x},${tunnel.y} hat keinen Ausgang`);
    }
  }

  const goal = rooms.flatMap((room) => room.data.filter((object) => object.id.startsWith('OBJ_GOAL_')));
  assert.deepEqual(goal.map((object) => object.type).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3].map((type) =>
    rooms.flatMap((room) => room.data.filter((object) => object.id === `OBJ_RING#${type}`)).length,
  ), [2, 2, 2, 2]);
});
