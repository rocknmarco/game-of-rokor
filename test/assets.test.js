import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const assetUrl = new URL('../public/assets/', import.meta.url);
const audioUrl = new URL('../public/audio/', import.meta.url);

test('the sprite atlas contains every renderer-facing asset group', async () => {
  await access(new URL('tileset.png', assetUrl));

  const atlas = JSON.parse(await readFile(new URL('tileset.json', assetUrl), 'utf8'));
  assert.equal(atlas.columns, 8);
  assert.equal(atlas.rows, 8);
  assert.equal(atlas.tileSize, 48);

  for (const required of [
    'grass', 'sand', 'water', 'bridge', 'cliffTop', 'ruinFloor',
    'tree', 'cypress', 'pillar', 'emitter', 'mirrorSlash', 'receiverOff',
    'chestClosed', 'brazierOn', 'rokorDown', 'scarab', 'sentinel',
    'sigilDawn', 'sigilTide', 'sigilDusk', 'altarOn'
  ]) {
    assert.ok(atlas.sprites[required], `missing sprite: ${required}`);
  }
});

test('the landscape atlas provides connected outdoor terrain variants', async () => {
  const atlas = JSON.parse(await readFile(new URL('landscape-atlas.json', assetUrl), 'utf8'));
  await access(new URL(atlas.image, assetUrl));

  assert.equal(atlas.columns, 5);
  assert.equal(atlas.rows, 5);
  assert.equal(atlas.tileSize, 48);
  for (const required of [
    'forestN', 'forestE', 'forestS', 'forestW', 'forestCenter',
    'waterLandN', 'waterLandE', 'waterLandS', 'waterLandW', 'waterCenter',
    'wallHorizontal', 'wallVertical', 'wallJunction',
    'cliffN', 'cliffE', 'cliffS', 'cliffW', 'cliffCenter'
  ]) {
    assert.ok(atlas.sprites[required], `missing landscape sprite: ${required}`);
  }
});

test('the maritime terrain atlas has four production-size texture panels', async () => {
  const png = await readFile(new URL('terrain-textures-maritime.png', assetUrl));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
});

test('Rokor has two unmistakable walk frames in every direction', async () => {
  const atlas = JSON.parse(await readFile(new URL('rokor-walk.json', assetUrl), 'utf8'));
  await access(new URL(atlas.image, assetUrl));
  assert.equal(atlas.columns, 4);
  assert.equal(atlas.rows, 2);
  for (const direction of ['down', 'up', 'left', 'right']) {
    assert.ok(atlas.sprites[`${direction}A`]);
    assert.ok(atlas.sprites[`${direction}B`]);
  }
});

test('the web edition bundles the original Tobor action sounds and nature music', async () => {
  for (const file of [
    'dissolve-wall.ogg', 'drop-magnet.ogg', 'explosion-short.ogg', 'explosion.ogg',
    'jingle-0.ogg', 'jingle-1.ogg', 'open-door.ogg', 'pickup-gold.ogg',
    'pickup-key.ogg', 'pickup-misc.ogg', 'shoot-bullet.ogg', 'doppelganger.ogg', 'hit-plant.ogg', 'step-charlie.ogg',
    'step-robot.ogg', 'step-tunnel.ogg', 'switch.ogg', 'use-garlic.ogg',
  ]) {
    const sound = await readFile(new URL(`sfx/${file}`, audioUrl));
    assert.ok(sound.length > 1_000, `${file} is unexpectedly small`);
  }
  const nature = await readFile(new URL('mus/nature.ogg', audioUrl));
  assert.ok(nature.length > 100_000);
});
