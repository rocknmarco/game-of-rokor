import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS,
  ROOM_DEFS,
  createWorld,
  isAqueductSolved,
  puzzleSolved,
  roomAt,
  traceBeam
} from '../src/game/world.js';

test('all nine room coordinates are unique and form a 3x3 world', () => {
  assert.equal(ROOM_DEFS.length, 9);
  assert.equal(new Set(ROOM_DEFS.map((room) => `${room.x},${room.y}`)).size, 9);
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) assert.ok(roomAt(x, y));
  }
});

test('neighboring room exits line up on every shared edge', () => {
  const world = createWorld();
  for (const definition of ROOM_DEFS) {
    const room = world[definition.id];
    const east = roomAt(definition.x + 1, definition.y);
    if (east) {
      assert.notEqual(room.grid[8][COLS - 1], 'cliff');
      assert.notEqual(world[east.id].grid[8][0], 'cliff');
    }
    const south = roomAt(definition.x, definition.y + 1);
    if (south) {
      assert.notEqual(room.grid[room.grid.length - 1][14], 'cliff');
      assert.notEqual(world[south.id].grid[0][14], 'cliff');
    }
  }
});

test('light bridge is solved by rotating its mirror toward the receiver', () => {
  const room = createWorld().bridge;
  assert.equal(traceBeam(room).powered, false);
  room.objects.find((entry) => entry.type === 'mirror').orientation = '/';
  assert.equal(traceBeam(room).powered, true);
  assert.equal(puzzleSolved(room, 'bridge'), true);
});

test('aqueduct plate and vault braziers report their puzzle state', () => {
  const world = createWorld();
  const crate = world.aqueduct.objects.find((entry) => entry.type === 'crate');
  const plate = world.aqueduct.objects.find((entry) => entry.type === 'plate');
  assert.equal(isAqueductSolved(world.aqueduct), false);
  crate.x = plate.x;
  crate.y = plate.y;
  assert.equal(isAqueductSolved(world.aqueduct), true);
  assert.equal(puzzleSolved(world.vault, 'vault'), false);
  world.vault.objects.filter((entry) => entry.type === 'brazier').forEach((entry) => { entry.lit = true; });
  assert.equal(puzzleSolved(world.vault, 'vault'), true);
});
