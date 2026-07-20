import {
  ROOM_HEIGHT,
  ROOM_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
  isRoof,
  layerFor,
  spriteFor,
  subtypeSprite,
} from './object-registry.js';

const STATUS_HEIGHT = TILE_HEIGHT;
const WORLD_WIDTH = ROOM_WIDTH * TILE_WIDTH;
const WORLD_HEIGHT = ROOM_HEIGHT * TILE_HEIGHT;
const SCREEN_WIDTH = WORLD_WIDTH;
const SCREEN_HEIGHT = STATUS_HEIGHT + WORLD_HEIGHT;
const PLAYER_LAYER = 11;

const FONT_GLYPHS =
  'abcdefghijklmnopqrstuvwxyzäöüß_ '
  + 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ^° '
  + '0123456789.,!?\'"-+=/\\%()<>:;[]`´'
  + '$#&@*éúíóáýèùìòà';

const PALETTE = [
  '#000000', '#ffff00', '#00a84f', '#acacac', '#af00af', '#af0000', '#ff0000', '#ffac00',
  '#00ff52', '#afffaf', '#00a8af', '#0000ff', '#4f50ff', '#00004f', '#4f5000', '#ffffff',
];

const NPC_COLORS = [
  ['#ffff00', '#ffac00'],
  ['#ff0000', '#af0000'],
  ['#acff00', '#00a84f'],
  ['#00a8af', '#00004f'],
  ['#acacac', '#525252'],
];

const tile = (x, y, width = TILE_WIDTH, height = TILE_HEIGHT) => ({ x, y, width, height });

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function stableNumber(value) {
  let hash = 2166136261;
  for (const char of String(value ?? '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isHalfTile(id) {
  if (/^OBJ_(?:WALL|SAND_WALL)_(?:NE|NW|SE|SW)$/.test(id)) return true;
  if (/^OBJ_WATER_(?:NE|NW|SE|SW)$/.test(id)) return true;
  if (/^OBJ_TUNNEL#/.test(id)) return true;
  if (/^OBJ_WOOD_[1-4]$/.test(id)) return true;
  const mountain = id.match(/^OBJ_MOUNTAIN_(\d+)$/);
  return mountain ? Number(mountain[1]) >= 4 : false;
}

export class ToborRenderer {
  constructor(canvas, gameData) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.context.imageSmoothingEnabled = false;
    this.tileset = gameData.tileset;
    this.gameData = gameData;
    this.time = 0;
    this.tintCanvas = makeCanvas(TILE_WIDTH, TILE_HEIGHT);
    this.tintContext = this.tintCanvas.getContext('2d');
    this.fontCanvas = makeCanvas(8, 10);
    this.fontContext = this.fontCanvas.getContext('2d');
    this.lightCanvas = makeCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.lightContext = this.lightCanvas.getContext('2d');
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
  }

  render(engine, deltaSeconds) {
    this.time += deltaSeconds;
    if (!engine.currentRoom) return;

    this.canvas.dataset.playerX = engine.player.x.toFixed(3);
    this.canvas.dataset.playerY = engine.player.y.toFixed(3);
    this.canvas.dataset.playerMoving = String(engine.player.moving);

    const context = this.context;
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.drawRoom(context, engine);
    this.drawLighting(context, engine);
    this.drawStatusLine(context, engine);
  }

  drawRoom(context, engine) {
    const playerX = Math.round(engine.player.x);
    const playerY = Math.round(engine.player.y);
    const underRoof = engine.objectsAt(playerX, playerY).some((object) => isRoof(object.id));
    const objects = engine.roomObjects()
      .map((object, index) => ({ object, index, layer: layerFor(object.id) }))
      .sort((a, b) => a.layer - b.layer || a.index - b.index);

    let playerDrawn = false;
    for (const entry of objects) {
      if (!playerDrawn && entry.layer > PLAYER_LAYER) {
        this.drawPlayer(context, engine);
        playerDrawn = true;
      }
      if (underRoof && isRoof(entry.object.id)) continue;
      this.drawObject(context, entry.object, engine);
    }
    if (!playerDrawn) this.drawPlayer(context, engine);
  }

  drawAtlasAt(context, sprite, x, y, alpha = 1) {
    if (!sprite) return;
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(
      this.tileset,
      sprite.x,
      sprite.y,
      sprite.width,
      sprite.height,
      Math.round(x),
      Math.round(y),
      sprite.width,
      sprite.height,
    );
    context.restore();
  }

  drawSprite(context, sprite, gridX, gridY, alpha = 1) {
    this.drawAtlasAt(
      context,
      sprite,
      gridX * TILE_WIDTH,
      STATUS_HEIGHT + gridY * TILE_HEIGHT,
      alpha,
    );
  }

  drawTintedSprite(context, sprite, gridX, gridY, color) {
    const tint = this.tintContext;
    tint.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    tint.globalCompositeOperation = 'source-over';
    tint.drawImage(this.tileset, sprite.x, sprite.y, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height);
    tint.globalCompositeOperation = 'source-in';
    tint.fillStyle = color;
    tint.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    tint.globalCompositeOperation = 'source-over';
    context.drawImage(
      this.tintCanvas,
      Math.round(gridX * TILE_WIDTH),
      Math.round(STATUS_HEIGHT + gridY * TILE_HEIGHT),
    );
  }

  drawObject(context, object, engine) {
    if (object.visible === false || object.alive === false) return;
    if (object.id === 'OBJ_START_POSITION' || object.id.startsWith('OBJ_TELEPORT_END_')) return;
    if (object.id.startsWith('MARKER_') || object.id.startsWith('DRIFT_')) return;
    if (object.id === 'OBJ_SPOT') {
      if (engine.game.metadata.ringEffects && engine.inventoryHas('OBJ_RING#2')) {
        this.drawSprite(context, spriteFor(object.id), object.x, object.y);
      }
      return;
    }

    if (object.subType > 0 && isHalfTile(object.id)) {
      this.drawSprite(context, subtypeSprite(object.subType), object.x, object.y);
    }

    if (object.id.startsWith('OBJ_TELEPORT_START_')) {
      if (object.content == null) return;
      this.drawSprite(context, object.type === 0 ? tile(32, 312) : tile(80, 312), object.x, object.y);
      if (object.content) this.drawSprite(context, spriteFor(object.content), object.x, object.y);
      return;
    }

    if (object.id === 'OBJ_ROOM_EXIT' && (engine.roomRobotCount === 0 || engine.currentRoom.treeTimer > 0)) {
      const horizontal = object.x === 0 || object.x === ROOM_WIDTH - 1;
      this.drawSprite(context, horizontal ? tile(16, 12) : tile(32, 12), object.x, object.y);
      return;
    }

    if (object.id === 'OBJ_BARRIER' && (engine.roomRobotCount === 0 || engine.currentRoom.treeTimer > 0)) {
      this.drawSprite(context, tile(224, 96), object.x, object.y);
      return;
    }

    if (engine.inventoryHas('OBJ_COMPASS') && object.id === 'OBJ_MOUNTAIN_PATH') {
      this.drawSprite(context, tile(144, 264), object.x, object.y);
      return;
    }
    if (engine.inventoryHas('OBJ_COMPASS') && object.id === 'OBJ_WOOD_PATH') {
      this.drawSprite(context, tile(160, 252), object.x, object.y);
      return;
    }

    if (object.id === 'OBJ_ROBOT') {
      this.drawRobot(context, object);
      return;
    }
    if (object.id === 'OBJ_NPC' || object.id === 'OBJ_DEALER') {
      this.drawNpc(context, object);
      return;
    }
    if (object.id === 'OBJ_EXPLOSION') {
      const frame = Math.min(5, Math.floor((object._explosionTime ?? this.time) * 2.5) % 6);
      this.drawSprite(context, tile(64 + frame * 16, 0), object.renderX ?? object.x, object.renderY ?? object.y);
      return;
    }
    if (object.id.startsWith('OBJ_SHOOTER_') && (object._reload ?? 0) > 0) {
      this.drawSprite(context, tile(144 + object.type * 16, 336), object.x, object.y);
      return;
    }
    if (object.id === 'OBJ_PLANT_GROWING') {
      const sprites = [
        [112, 312], [176, 312], [96, 312], [128, 312], [192, 312], [96, 312],
        [144, 312], [208, 312], [96, 312], [160, 312], [224, 312], [96, 312],
      ];
      const [x, y] = sprites[object.type] ?? sprites[2];
      this.drawSprite(context, tile(x, y), object.x, object.y);
      return;
    }
    if (object.id === 'OBJ_ANDROID_EGG') {
      let sprite;
      if (object.type === 100) sprite = tile(240, 276);
      else if (object.type === 101) sprite = tile(240, 312);
      else sprite = tile(208 + Math.floor((object.type % 4) / 2) * 16, 216 + (object.type % 2) * 12);
      this.drawSprite(context, sprite, object.x, object.y);
      return;
    }
    if (object.id === 'OBJ_WATCHER') {
      this.drawSprite(context, tile(80 + (object._frame ?? 0) * 16, 60), object.x, object.y);
      return;
    }
    if (object.id === 'OBJ_TORCH') {
      const x = object.type === 0 ? 80 : 96 + (Math.floor(object._torchTime ?? 10) % 2 === 0 ? 0 : 16);
      this.drawSprite(context, tile(x, 348), object.x, object.y);
      return;
    }
    if (object.id === 'OBJ_WALL_DISSOLVE' || object.id === 'OBJ_WALL_SAND_DISSOLVE') {
      const frame = Math.min(4, Math.floor((1 - (object._dissolveTime ?? 5) / 5) * 5));
      const x = (object.id === 'OBJ_WALL_SAND_DISSOLVE' ? 64 : 0) + frame * 16;
      const y = object.id === 'OBJ_WALL_SAND_DISSOLVE' ? 168 : 60;
      this.drawSprite(context, tile(x, y), object.x, object.y);
      return;
    }
    if (object.id === 'OBJ_ANDROID') {
      this.drawSprite(context, tile(176 + object.type * 16, 120), object.renderX ?? object.x, object.renderY ?? object.y);
      return;
    }
    if (object.id === 'OBJ_SCORPION') {
      let sprite;
      if (object.type === 0) sprite = tile(208, 168);
      else {
        const right = (object._lastDirection?.x ?? 0) > 0;
        const secondFrame = (object._motion?.progress ?? 0) > 0.5;
        sprite = tile((right ? 144 : 176) + (secondFrame ? 16 : 0), 168);
      }
      this.drawSprite(context, sprite, object.renderX ?? object.x, object.renderY ?? object.y);
      return;
    }
    if (object.id === 'OBJ_SHARK') {
      const right = (object._lastDirection?.x ?? 0) > 0;
      const x = object._hunting ? (right ? 144 : 112) : (right ? 160 : 128);
      this.drawSprite(context, tile(x, 120), object.renderX ?? object.x, object.renderY ?? object.y);
      return;
    }
    if (object.id === 'OBJ_DOPPELGANGER') {
      const x = (object._motion?.progress ?? 0) > 0.5 ? 48 : 32;
      this.drawSprite(context, tile(x, 0), object.renderX ?? object.x, object.renderY ?? object.y);
      return;
    }

    this.drawSprite(context, spriteFor(object.id), object.renderX ?? object.x, object.renderY ?? object.y);
  }

  drawRobot(context, object) {
    const seed = stableNumber(object.runtimeId);
    const variant = seed % 7;
    const secondFrame = (object._motion?.progress ?? 0) > 0.5;
    const spriteX = variant * 32 + (secondFrame ? 16 : 0);
    const colors = [];
    for (let offset = 0; colors.length < 3; offset += 1) {
      const color = PALETTE[(seed + offset * 7) % 15];
      if (!colors.includes(color)) colors.push(color);
    }
    for (let layer = 0; layer < 3; layer += 1) {
      this.drawTintedSprite(
        context,
        tile(spriteX, 84 + layer * 12),
        object.renderX ?? object.x,
        object.renderY ?? object.y,
        colors[layer],
      );
    }
  }

  drawNpc(context, object) {
    const baseX = object.id === 'OBJ_DEALER' ? 64 : 128;
    const secondFrame = (object._motion?.progress ?? 0) > 0.5;
    const x = object.renderX ?? object.x;
    const y = object.renderY ?? object.y;
    const colorIndex = object.flag >= 0 && object.flag <= 4 ? object.flag : 4;
    this.drawSprite(context, tile(baseX + (secondFrame ? 16 : 0), 276), x, y);
    this.drawTintedSprite(context, tile(baseX + 32, 276), x, y, NPC_COLORS[colorIndex][0]);
    this.drawTintedSprite(context, tile(baseX + 48, 276), x, y, NPC_COLORS[colorIndex][1]);
  }

  drawPlayer(context, engine) {
    const player = engine.player;
    if (player.visible === false) return;
    const overall = engine.inventoryHas('OBJ_OVERALL');
    let sprite;
    if (!player.moving || !engine.motion) {
      sprite = overall ? tile(0, 156) : tile(16, 0);
    } else {
      const secondFrame = engine.motion.progress > 0.5;
      sprite = overall
        ? tile(16 + (secondFrame ? 16 : 0), 156)
        : tile(32 + (secondFrame ? 16 : 0), 0);
    }
    this.drawSprite(context, sprite, player.x, player.y);
  }

  drawStatusLine(context, engine) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, SCREEN_WIDTH, STATUS_HEIGHT);
    const isolator = tile(240, 0);
    for (let x = 0; x < 8; x += 1) {
      this.drawAtlasAt(context, isolator, x * TILE_WIDTH, 0);
      this.drawAtlasAt(context, isolator, (39 - x) * TILE_WIDTH, 0);
    }

    const statusCharlie = engine.motion?.tunnel
      ? tile(240, 120)
      : engine.inventoryHas('OBJ_OVERALL') ? tile(16, 156) : tile(32, 0);
    this.drawAtlasAt(context, statusCharlie, 8 * TILE_WIDTH + TILE_WIDTH / 2, 0);

    const garlic = Math.ceil(engine.garlic);
    if (garlic > 0) {
      if (garlic < 100) this.drawPixelText(context, 200, 0, String(garlic).padStart(2, '0'));
      else this.drawAtlasAt(context, tile(192, 24), 200, 0);
      this.drawAtlasAt(context, tile(192, 24), 184, 0);
    }

    const pointsLabel = this.gameData.text('TXT_STATUS_POINTS', 'Punkte');
    const livesLabel = this.gameData.text('TXT_STATUS_LIVES', 'Leben');
    this.drawPixelText(
      context,
      224,
      0,
      `${pointsLabel} ${String(Math.round(engine.points)).padStart(8, '0')} ${livesLabel} ${engine.lives}`,
    );

    if (engine.gold > 0) {
      this.drawAtlasAt(context, tile(96, 12), 416, 0);
      this.drawPixelText(context, 440, 0, String(engine.gold).padStart(3, ' '));
    }
    this.drawAtlasAt(context, tile(112, 12), 471, 0);
    this.drawPixelText(context, 488, 0, String(engine.inventory.size).padStart(2, ' '));
  }

  drawPixelText(context, x, y, value, color = '#000000') {
    let cursor = x;
    for (const character of String(value)) {
      const index = FONT_GLYPHS.indexOf(character);
      if (index >= 0) {
        const sourceX = (index % 16) * 8;
        const sourceY = 430 + Math.floor(index / 16) * 10;
        const font = this.fontContext;
        font.clearRect(0, 0, 8, 10);
        font.globalCompositeOperation = 'source-over';
        font.drawImage(this.tileset, sourceX, sourceY, 8, 10, 0, 0, 8, 10);
        font.globalCompositeOperation = 'source-in';
        font.fillStyle = color;
        font.fillRect(0, 0, 8, 10);
        font.globalCompositeOperation = 'source-over';
        context.drawImage(this.fontCanvas, cursor, y);
      }
      cursor += 8;
    }
  }

  drawLighting(context, engine) {
    const darkness = engine.currentRoom.darkness;
    if (darkness === 0) return;
    const light = this.lightContext;
    light.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    light.fillStyle = darkness === 1 ? 'rgba(0,0,0,.8)' : '#000000';
    light.fillRect(0, STATUS_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT);

    const cutLight = (gridX, gridY, radius) => {
      const centerX = gridX * TILE_WIDTH;
      const centerY = STATUS_HEIGHT + gridY * TILE_HEIGHT;
      light.save();
      light.globalCompositeOperation = 'destination-out';
      light.translate(centerX, centerY);
      light.scale(1, TILE_HEIGHT / TILE_WIDTH);
      const gradient = light.createRadialGradient(0, 0, 0, 0, 0, radius * TILE_WIDTH);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.72, 'rgba(0,0,0,.92)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      light.fillStyle = gradient;
      light.beginPath();
      light.arc(0, 0, radius * TILE_WIDTH, 0, Math.PI * 2);
      light.fill();
      light.restore();
    };

    if (engine.inventoryHas('OBJ_LAMP')) cutLight(engine.player.x + 0.5, engine.player.y + 0.5, 5);
    for (const object of engine.roomObjects()) {
      if (object.id === 'OBJ_TORCH' && object.type > 0) cutLight(object.x + 0.5, object.y + 0.5, 6 - object.type / 4);
      if (object.id === 'OBJ_LAMP') cutLight(object.x + 0.5, object.y + 0.5, 3);
    }
    context.drawImage(this.lightCanvas, 0, 0);
  }
}
