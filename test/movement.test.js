import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';

function isolatedGame() {
  const game = new Game();
  game.setMovementSpeed('fast', { persist: false, announce: false });
  game.running = true;
  game.updateActionPrompt = () => {};
  game.save = () => {};
  game.sound = () => {};
  game.enemyTurn = () => {};
  return game;
}

test('movement configuration keeps the former speed as fastest tier', () => {
  const game = new Game();

  game.setMovementSpeed('fast', { persist: false, announce: false });
  assert.equal(game.moveDuration, 54);
  game.setMovementSpeed('normal', { persist: false, announce: false });
  assert.equal(game.moveDuration, 84);
  game.setMovementSpeed('slow', { persist: false, announce: false });
  assert.equal(game.moveDuration, 112);
});

test('player position is interpolated between logical grid cells', () => {
  const game = isolatedGame();
  game.player.x = 10;
  game.player.y = 7;
  game.beginPlayerMotion(10, 7, 11, 7);

  assert.equal(game.playerVisual.x, 10);
  game.updatePlayerMotion(27);
  assert.equal(game.playerVisual.x, 10.5);
  assert.equal(game.playerVisual.moving, true);
  game.updatePlayerMotion(27);
  assert.equal(game.playerVisual.x, 11);
  assert.equal(game.playerVisual.moving, false);
});

test('holding a direction chains steps without keyboard repeat pauses', () => {
  const game = isolatedGame();
  const startX = game.player.x;

  game.pressMovement('right', 'test-key');
  assert.equal(game.player.x, startX);
  assert.equal(game.playerMotion.active, true);

  game.updatePlayerMotion(60);
  assert.equal(game.player.x, startX + 1);
  assert.equal(game.playerMotion.active, true);
  assert.ok(game.playerVisual.x > startX + 1);

  game.releaseMovement('test-key');
  assert.equal(game.playerMotion.active, false);
  assert.equal(game.playerMotion.paused, true);
  const releaseX = game.playerVisual.x;
  game.updatePlayerMotion(200);
  assert.equal(game.playerVisual.x, releaseX);
});

test('a new movement is visible in the input event without a large position jump', () => {
  const game = isolatedGame();
  const startX = game.player.x;

  game.pressMovement('right', 'test-key');

  assert.equal(game.playerVisual.x, startX + 1 / 12);
  assert.equal(game.playerVisual.moving, true);
  assert.ok(Math.abs(game.playerMotion.elapsed - 54 / 12) < 1e-9);
  assert.equal(game.player.x, startX);
});

test('the first frame only advances time elapsed after the actual key press', () => {
  const game = isolatedGame();
  const startX = game.player.x;

  game.pressMovement('right', 'test-key');
  const pressedAt = game.playerMotion.lastTimestamp;
  game.updatePlayerMotion(16, pressedAt + 2);

  assert.ok(Math.abs(game.playerVisual.x - (startX + 1 / 12 + 2 / 54)) < 1e-9);
});

test('releasing a direction freezes the exact visual position immediately', () => {
  const game = isolatedGame();
  const startX = game.player.x;

  game.pressMovement('right', 'test-key');
  game.updatePlayerMotion(20);
  const releaseX = game.playerVisual.x;
  game.releaseMovement('test-key');

  assert.equal(game.pendingDirection, null);
  assert.equal(game.playerMotion.active, false);
  assert.equal(game.playerMotion.paused, true);
  assert.ok(Math.abs(releaseX - (startX + 1 / 12 + 20 / 54)) < 1e-9);
  assert.equal(game.playerVisual.x, releaseX);
  game.updatePlayerMotion(500);
  assert.equal(game.playerVisual.x, releaseX);
  assert.equal(game.player.x, startX);
});

test('pressing the same direction again resumes from the stopped position', () => {
  const game = isolatedGame();
  const startX = game.player.x;

  game.pressMovement('right', 'first-press');
  game.updatePlayerMotion(18);
  game.releaseMovement('first-press');
  const stoppedX = game.playerVisual.x;

  game.pressMovement('right', 'second-press');
  assert.equal(game.playerMotion.active, true);
  assert.ok(game.playerVisual.x > stoppedX);
  game.updatePlayerMotion(30);

  assert.equal(game.player.x, startX + 1);
  assert.equal(game.playerMotion.active, true);
  game.releaseMovement('second-press');
});

test('changing direction after stopping continues smoothly and responds immediately', () => {
  const game = isolatedGame();

  game.pressMovement('right', 'right-key');
  game.updatePlayerMotion(18);
  game.releaseMovement('right-key');
  const stopped = { x: game.playerVisual.x, y: game.playerVisual.y };

  game.pressMovement('up', 'up-key');

  assert.equal(game.playerMotion.active, true);
  assert.ok(game.playerVisual.x < stopped.x);
  assert.ok(game.playerVisual.y < stopped.y);
  assert.equal(game.playerMotion.toX, game.player.x);
  assert.equal(game.playerMotion.toY, game.player.y - 1);
});

test('a requested turn interrupts the old direction immediately', () => {
  const game = isolatedGame();
  game.player.facing = 'down';
  game.beginPlayerMotion(game.player.x, game.player.y, game.player.x, game.player.y + 1);

  game.pressMovement('right', 'turn-key');

  assert.equal(game.player.facing, 'right');
  assert.equal(game.playerMotion.direction, 'right');
  assert.equal(game.pendingDirection, null);
  assert.ok(game.playerVisual.x > game.player.x);
  assert.equal(game.playerVisual.y, game.player.y);
});

test('an old position inside the redesigned landscape is moved to a safe checkpoint', () => {
  const game = isolatedGame();
  game.player.x = 0;
  game.player.y = 0;

  game.ensurePlayerOnWalkableTile();

  assert.equal(game.state.roomId, game.state.checkpoint.roomId);
  assert.equal(game.player.x, game.state.checkpoint.x);
  assert.equal(game.player.y, game.state.checkpoint.y);
  assert.equal(game.canEnter(game.room, game.player.x, game.player.y), true);
});
