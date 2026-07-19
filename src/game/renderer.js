import { COLS, ROWS, TILE, puzzleSolved, traceBeam } from './world.js';

function hash(x, y, seed = 0) {
  let value = Math.imul(x + seed * 17, 374761393) + Math.imul(y + seed * 31, 668265263);
  value = (value ^ (value >> 13)) * 1274126177;
  return ((value ^ (value >> 16)) >>> 0) / 4294967295;
}

const TERRAIN = {
  grass: 'grass',
  sand: 'sand',
  path: 'sand',
  stone: 'sandstone',
  mosaic: 'mosaic',
  sunstone: 'sunstone',
  darkStone: 'darkStone',
  darkPath: 'darkStone',
  water: 'water',
  bridge: 'bridge',
  wall: 'wall',
  cliff: 'cliffTop'
};

const OBJECT_SCALE = {
  tree: 2.15,
  cypress: 2.05,
  flower: 1.08,
  reeds: 1.15,
  pillar: 1.35,
  sunPillar: 1.35,
  pot: .9,
  note: .88,
  checkpoint: .94,
  npc: 1.18,
  emitter: 1.35,
  mirror: 1.35,
  receiver: 1.28,
  chest: .82,
  pickup: .78,
  crate: .9,
  plate: .88,
  brazier: 1.15,
  altar: 1.5,
  player: 1.55
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.darknessCanvas = document.createElement('canvas');
    this.darknessCanvas.width = canvas.width;
    this.darknessCanvas.height = canvas.height;
    this.darknessCtx = this.darknessCanvas.getContext('2d');
    this.terrainMaskCanvas = document.createElement('canvas');
    this.terrainMaskCanvas.width = canvas.width;
    this.terrainMaskCanvas.height = canvas.height;
    this.terrainMaskCtx = this.terrainMaskCanvas.getContext('2d');
    this.terrainLayerCanvas = document.createElement('canvas');
    this.terrainLayerCanvas.width = canvas.width;
    this.terrainLayerCanvas.height = canvas.height;
    this.terrainLayerCtx = this.terrainLayerCanvas.getContext('2d');
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCanvas.width = canvas.width;
    this.backgroundCanvas.height = canvas.height;
    this.backgroundCtx = this.backgroundCanvas.getContext('2d');
    this.backgroundRoomId = null;
    this.time = 0;
    this.atlas = null;
    this.tileset = new Image();
    this.landscapeAtlas = null;
    this.landscapeTileset = new Image();
    this.characterAtlas = null;
    this.characterTileset = new Image();
    this.terrainTextures = new Image();
    this.ready = false;
    this.failed = false;

    const imageReady = new Promise((resolve, reject) => {
      this.tileset.addEventListener('load', resolve, { once: true });
      this.tileset.addEventListener('error', reject, { once: true });
      this.tileset.src = '/assets/tileset.png';
    });
    const atlasReady = fetch('/assets/tileset.json').then((response) => {
      if (!response.ok) throw new Error(`Tileset metadata: ${response.status}`);
      return response.json();
    }).then((atlas) => { this.atlas = atlas; });
    const landscapeImageReady = new Promise((resolve, reject) => {
      this.landscapeTileset.addEventListener('load', resolve, { once: true });
      this.landscapeTileset.addEventListener('error', reject, { once: true });
      this.landscapeTileset.src = '/assets/landscape-atlas-light.png';
    });
    const landscapeAtlasReady = fetch('/assets/landscape-atlas.json').then((response) => {
      if (!response.ok) throw new Error(`Landschaftsmetadaten: ${response.status}`);
      return response.json();
    }).then((atlas) => { this.landscapeAtlas = atlas; });
    const characterImageReady = new Promise((resolve, reject) => {
      this.characterTileset.addEventListener('load', resolve, { once: true });
      this.characterTileset.addEventListener('error', reject, { once: true });
      this.characterTileset.src = '/assets/rokor-walk.png';
    });
    const characterAtlasReady = fetch('/assets/rokor-walk.json').then((response) => {
      if (!response.ok) throw new Error(`Figurenmetadaten: ${response.status}`);
      return response.json();
    }).then((atlas) => { this.characterAtlas = atlas; });
    const terrainTexturesReady = new Promise((resolve, reject) => {
      this.terrainTextures.addEventListener('load', resolve, { once: true });
      this.terrainTextures.addEventListener('error', reject, { once: true });
      this.terrainTextures.src = '/assets/terrain-textures-maritime.png';
    });

    Promise.all([
      imageReady,
      atlasReady,
      landscapeImageReady,
      landscapeAtlasReady,
      characterImageReady,
      characterAtlasReady,
      terrainTexturesReady
    ])
      .then(() => {
        this.ready = true;
        this.backgroundRoomId = null;
      })
      .catch((error) => {
        this.failed = true;
        console.error('Tileset konnte nicht geladen werden.', error);
      });
  }

  render(room, game, elapsed = 0) {
    this.time += elapsed;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.ready) {
      this.drawLoading();
      return;
    }

    if (this.backgroundRoomId !== room.id) this.buildRoomBackground(room);
    ctx.drawImage(this.backgroundCanvas, 0, 0);
    if (room.id === 'bridge') this.drawBeam(traceBeam(room).path);

    const playerVisual = game.playerVisual;
    const drawables = room.objects
      .filter((entry) => !entry.collected && !entry.dead)
      .map((entry) => ({ kind: 'object', y: entry.y, x: entry.x, value: entry }));
    drawables.push({ kind: 'player', y: playerVisual.y, x: playerVisual.x, value: playerVisual });
    drawables.sort((a, b) => (a.y - b.y) || (a.kind === 'player' ? 1 : -1));

    for (const drawable of drawables) {
      if (drawable.kind === 'player') this.drawPlayer(drawable.value, game.attackFlash);
      else this.drawObject(drawable.value, room, game);
    }

    if (room.dark) this.drawDarkness(room, game, playerVisual);
    this.drawAtmosphere(room);
  }

  buildRoomBackground(room) {
    const liveContext = this.ctx;
    this.ctx = this.backgroundCtx;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);

    try {
      this.drawGroundBase(room);
      this.drawTerrainLayers(room);
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) this.drawTile(room, x, y);
      }
      this.drawGroundDetails(room);
      this.backgroundRoomId = room.id;
    } finally {
      this.ctx = liveContext;
    }
  }

  drawLoading() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, '#183c3b');
    gradient.addColorStop(1, '#071e28');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = this.failed ? '#ff9b79' : '#f5d16d';
    ctx.font = '700 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.failed ? 'Tileset konnte nicht geladen werden' : 'Liora wird gezeichnet …', this.canvas.width / 2, this.canvas.height / 2);
  }

  cellRect(name) {
    const sprite = this.atlas.sprites[name];
    if (!sprite) return null;
    const x1 = Math.floor(sprite.col * this.tileset.width / this.atlas.columns);
    const y1 = Math.floor(sprite.row * this.tileset.height / this.atlas.rows);
    const x2 = Math.floor((sprite.col + 1) * this.tileset.width / this.atlas.columns);
    const y2 = Math.floor((sprite.row + 1) * this.tileset.height / this.atlas.rows);
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }

  drawTerrain(name, x, y, options = {}) {
    const sprite = this.atlas.sprites[name];
    if (!sprite) return;
    const source = sprite.crop
      ? { x: sprite.crop[0], y: sprite.crop[1], width: sprite.crop[2], height: sprite.crop[3] }
      : this.cellRect(name);
    const inset = sprite.crop ? (options.inset ?? 5) : 0;
    source.x += inset;
    source.y += inset;
    source.width -= inset * 2;
    source.height -= inset * 2;
    const dx = x * TILE;
    const dy = y * TILE;
    const drawSize = TILE + 1;
    const ctx = this.ctx;
    ctx.save();
    if (options.flip) {
      ctx.translate(dx + drawSize, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.tileset, source.x, source.y, source.width, source.height, 0, 0, drawSize, drawSize);
    } else {
      ctx.drawImage(this.tileset, source.x, source.y, source.width, source.height, dx, dy, drawSize, drawSize);
    }
    ctx.restore();
  }

  drawSprite(name, gridX, gridY, options = {}) {
    const source = this.cellRect(name);
    if (!source) return;
    const scale = options.scale ?? 1.5;
    const width = TILE * scale;
    const height = TILE * scale;
    const dx = Math.round(gridX * TILE + (TILE - width) / 2 + (options.offsetX || 0));
    const dy = Math.round((gridY + 1) * TILE - height + (options.offsetY || 0));
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.filter = options.filter || 'none';
    if (options.glow) {
      ctx.shadowColor = options.glow;
      ctx.shadowBlur = options.glowBlur || 18;
    }
    if (options.flip) {
      ctx.translate(dx + width, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.tileset, source.x, source.y, source.width, source.height, 0, 0, width, height);
    } else {
      ctx.drawImage(this.tileset, source.x, source.y, source.width, source.height, dx, dy, width, height);
    }
    ctx.restore();
  }

  characterCellRect(name) {
    const sprite = this.characterAtlas.sprites[name];
    if (!sprite) return null;
    const size = this.characterAtlas.tileSize;
    return { x: sprite.col * size, y: sprite.row * size, width: size, height: size };
  }

  drawCharacterSprite(name, gridX, gridY, options = {}) {
    const source = this.characterCellRect(name);
    if (!source) return;
    const scale = options.scale ?? OBJECT_SCALE.player;
    const width = TILE * scale;
    const height = TILE * scale;
    const dx = Math.round(gridX * TILE + (TILE - width) / 2 + (options.offsetX || 0));
    const dy = Math.round((gridY + 1) * TILE - height + (options.offsetY || 0));
    this.ctx.drawImage(
      this.characterTileset,
      source.x,
      source.y,
      source.width,
      source.height,
      dx,
      dy,
      width,
      height
    );
  }

  landscapeCellRect(name) {
    const sprite = this.landscapeAtlas.sprites[name];
    if (!sprite) return null;
    const size = this.landscapeAtlas.tileSize;
    return { x: sprite.col * size, y: sprite.row * size, width: size, height: size };
  }

  drawLandscape(name, x, y, options = {}) {
    const source = this.landscapeCellRect(name);
    if (!source) return;
    const ctx = this.ctx;
    const dx = x * TILE;
    const dy = y * TILE;
    const width = TILE + 1;
    const height = TILE + 1;
    ctx.save();
    ctx.translate(options.flipX ? dx + width : dx, options.flipY ? dy + height : dy);
    ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
    ctx.drawImage(this.landscapeTileset, source.x, source.y, source.width, source.height, 0, 0, width, height);
    ctx.restore();
  }

  neighborState(room, x, y, type) {
    const isType = (checkX, checkY) => room.grid[checkY]?.[checkX] === type;
    return {
      n: isType(x, y - 1),
      e: isType(x + 1, y),
      s: isType(x, y + 1),
      w: isType(x - 1, y)
    };
  }

  drawBoundary(room, x, y) {
    const same = this.neighborState(room, x, y, 'cliff');
    const open = { n: !same.n && y > 0, e: !same.e && x < COLS - 1, s: !same.s && y < ROWS - 1, w: !same.w && x > 0 };
    const openCount = Object.values(open).filter(Boolean).length;
    if (room.biome === 'forest') {
      let sprite = 'forestCenter';
      if (openCount >= 3) sprite = 'forestIsland';
      else if (open.s && open.e) sprite = 'forestNW';
      else if (open.s && open.w) sprite = 'forestNE';
      else if (open.n && open.w) sprite = 'forestSE';
      else if (open.n && open.e) sprite = 'forestSW';
      else if (open.s) sprite = 'forestN';
      else if (open.w) sprite = 'forestE';
      else if (open.n) sprite = 'forestS';
      else if (open.e) sprite = 'forestW';
      this.drawLandscape(sprite, x, y);
      return;
    }

    let sprite = 'cliffCenter';
    if (open.s) sprite = 'cliffN';
    else if (open.w) sprite = 'cliffE';
    else if (open.n) sprite = 'cliffS';
    else if (open.e) sprite = 'cliffW';
    this.drawLandscape(sprite, x, y);
  }

  drawWater(room, x, y) {
    const same = this.neighborState(room, x, y, 'water');
    let sprite = 'waterCenter';
    if (!same.n && y > 0) sprite = 'waterLandN';
    else if (!same.w && x > 0) sprite = 'waterLandW';
    else if (!same.s && y < ROWS - 1) sprite = 'waterLandS';
    else if (!same.e && x < COLS - 1) sprite = 'waterLandE';
    this.drawLandscape(sprite, x, y);

    const wave = Math.floor((this.time / 120 + x * 7 + y * 11) % TILE);
    this.ctx.fillStyle = 'rgba(220,255,226,.42)';
    this.ctx.fillRect(x * TILE + wave - 12, y * TILE + 16, 12, 1);
  }

  drawWall(room, x, y) {
    const same = this.neighborState(room, x, y, 'wall');
    let sprite = 'wallHorizontal';
    if ((same.n || same.s) && !(same.e || same.w)) sprite = 'wallVertical';
    else if (same.e && same.s) sprite = 'wallCornerNW';
    else if (same.w && same.s) sprite = 'wallCornerNE';
    else if ((same.n || same.s) && (same.e || same.w)) sprite = 'wallJunction';
    this.drawLandscape(sprite, x, y, {
      flipY: same.n && !same.s && (same.e || same.w)
    });
  }

  drawGroundBase(room) {
    const ctx = this.ctx;
    ctx.fillStyle = room.dark ? '#111827' : '#fffdf2';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (room.dark) return;
    this.drawTextureFill(ctx, 'ground', room, .82);
    ctx.fillStyle = 'rgba(255,250,224,.12)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  textureRect(name) {
    const panels = {
      ground: [0, 0], stone: [1, 0], water: [0, 1], forest: [1, 1]
    };
    const [col, row] = panels[name] || panels.ground;
    return { x: col * 512, y: row * 512, size: 512 };
  }

  drawTextureFill(ctx, name, room, alpha = 1) {
    const source = this.textureRect(name);
    const size = 512;
    const offsetX = -((room.seed * 37) % size);
    const offsetY = -((room.seed * 61) % size);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = name === 'water'
      ? 'saturate(1.16) brightness(1.06)'
      : name === 'forest'
        ? 'saturate(1.1) brightness(1.05)'
        : 'brightness(1.025)';
    for (let row = -1; row <= Math.ceil(this.canvas.height / size) + 1; row += 1) {
      for (let col = -1; col <= Math.ceil(this.canvas.width / size) + 1; col += 1) {
        const dx = offsetX + col * size;
        const dy = offsetY + row * size;
        const flipX = Math.abs(col) % 2 === 1;
        const flipY = Math.abs(row) % 2 === 1;
        ctx.save();
        ctx.translate(dx + (flipX ? size : 0), dy + (flipY ? size : 0));
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(this.terrainTextures, source.x, source.y, source.size, source.size, 0, 0, size, size);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  buildOrganicMask(room, predicate, { spread = 0, shape = 'soft' } = {}) {
    const ctx = this.terrainMaskCtx;
    ctx.clearRect(0, 0, this.terrainMaskCanvas.width, this.terrainMaskCanvas.height);
    ctx.fillStyle = '#fff';
    const matches = (x, y) => Boolean(room.grid[y]?.[x] && predicate(room.grid[y][x]));
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!matches(x, y)) continue;
        const dx = x * TILE;
        const dy = y * TILE;
        const roughness = shape === 'stone' ? 4 : 6;
        const margin = (shape === 'stone' ? 2 : -2) - spread;
        const radius = (shape === 'stone' ? 8 : 14)
          + Math.floor(hash(x * 7, y * 11, room.seed + 73) * roughness)
          + spread * .35;
        ctx.beginPath();
        ctx.roundRect(dx + margin, dy + margin, TILE - margin * 2, TILE - margin * 2, Math.max(3, radius));
        ctx.fill();

        if (matches(x + 1, y)) ctx.fillRect(dx + TILE / 2, dy + 5 - spread, TILE, TILE - 10 + spread * 2);
        if (matches(x, y + 1)) ctx.fillRect(dx + 5 - spread, dy + TILE / 2, TILE - 10 + spread * 2, TILE);

        const edgePosition = (edgeSeed) => .26 + hash(x * 13 + edgeSeed, y * 17, room.seed + 131) * .48;
        const bumps = [
          ['n', x * 2 + 1, y - 1, dx + TILE * edgePosition(1), dy - spread],
          ['s', x * 2 + 2, y + 1, dx + TILE * edgePosition(2), dy + TILE + spread],
          ['w', x - 1, y * 2 + 3, dx - spread, dy + TILE * edgePosition(3)],
          ['e', x + 1, y * 2 + 4, dx + TILE + spread, dy + TILE * edgePosition(4)]
        ];
        for (const [edge, hx, hy, cx, cy] of bumps) {
          const neighborX = edge === 'w' ? x - 1 : edge === 'e' ? x + 1 : x;
          const neighborY = edge === 'n' ? y - 1 : edge === 's' ? y + 1 : y;
          if (matches(neighborX, neighborY)) continue;
          const bump = (shape === 'stone' ? 5 : 9)
            + spread * .55
            + hash(hx, hy, room.seed + 101) * (shape === 'stone' ? 4 : 8);
          ctx.beginPath();
          ctx.arc(cx, cy, bump, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  compositeMaskColor(color, alpha = 1) {
    const ctx = this.terrainLayerCtx;
    ctx.clearRect(0, 0, this.terrainLayerCanvas.width, this.terrainLayerCanvas.height);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, this.terrainLayerCanvas.width, this.terrainLayerCanvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.terrainMaskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.terrainLayerCanvas, 0, 0);
  }

  compositeMaskTexture(name, room, alpha = 1) {
    const ctx = this.terrainLayerCtx;
    ctx.clearRect(0, 0, this.terrainLayerCanvas.width, this.terrainLayerCanvas.height);
    this.drawTextureFill(ctx, name, room, alpha);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.terrainMaskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.terrainLayerCanvas, 0, 0);
  }

  drawOrganicSurface(room, predicate, texture, {
    halo = '#eed9a2', haloAlpha = .6, haloSpread = 4, shape = 'soft', textureAlpha = 1
  } = {}) {
    if (haloAlpha > 0 && haloSpread > 0) {
      this.buildOrganicMask(room, predicate, { spread: haloSpread, shape });
      this.compositeMaskColor(halo, haloAlpha);
    }
    this.buildOrganicMask(room, predicate, { spread: 0, shape });
    this.compositeMaskTexture(texture, room, textureAlpha);
  }

  drawDecorativeSurface(room, type, color, lineColor) {
    const predicate = (tile) => tile === type;
    this.drawOrganicSurface(room, predicate, 'stone', {
      halo: '#efd59a', haloAlpha: .5, haloSpread: 3, shape: 'stone', textureAlpha: .78
    });
    this.buildOrganicMask(room, predicate, { spread: 0, shape: 'stone' });
    const ctx = this.terrainLayerCtx;
    ctx.clearRect(0, 0, this.terrainLayerCanvas.width, this.terrainLayerCanvas.height);
    ctx.fillStyle = color;
    ctx.globalAlpha = .34;
    ctx.fillRect(0, 0, this.terrainLayerCanvas.width, this.terrainLayerCanvas.height);
    ctx.globalAlpha = .55;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    const offset = room.seed % 23;
    for (let y = -24 + offset; y < this.canvas.height + 24; y += 28) {
      for (let x = -24 + offset; x < this.canvas.width + 24; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 7, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x - 7, y);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.terrainMaskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.terrainLayerCanvas, 0, 0);
  }

  drawWaterSparkles(room) {
    this.buildOrganicMask(room, (tile) => tile === 'water');
    const ctx = this.terrainLayerCtx;
    ctx.clearRect(0, 0, this.terrainLayerCanvas.width, this.terrainLayerCanvas.height);
    ctx.fillStyle = 'rgba(255,248,191,.46)';
    for (let index = 0; index < 42; index += 1) {
      const x = Math.floor(hash(index * 19, room.seed, 211) * this.canvas.width);
      const y = Math.floor(hash(index * 7, room.seed * 3, 223) * this.canvas.height);
      const drift = Math.floor((this.time / 130 + index * 13) % 18);
      const glintX = x + drift - 9;
      ctx.fillRect(glintX, y, 3 + (index % 4) * 2, 1);
      if (index % 9 === 0) ctx.fillRect(glintX + 2, y - 1, 1, 3);
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.terrainMaskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.terrainLayerCanvas, 0, 0);
  }

  drawTerrainLayers(room) {
    if (room.dark) {
      this.drawOrganicSurface(room, (tile) => ['darkStone', 'darkPath'].includes(tile), 'stone', {
        halo: '#101827', haloAlpha: 1, haloSpread: 3, shape: 'stone', textureAlpha: .18
      });
      return;
    }
    this.drawOrganicSurface(room, (tile) => tile === 'water', 'water', {
      halo: '#f1d28d', haloAlpha: .58, haloSpread: 4, shape: 'soft'
    });
    this.drawWaterSparkles(room);
    this.drawOrganicSurface(room, (tile) => tile === 'stone', 'stone', {
      halo: '#efd59a', haloAlpha: .5, haloSpread: 3, shape: 'stone', textureAlpha: .9
    });
    this.drawDecorativeSurface(room, 'mosaic', '#167f86', '#f1cb69');
    this.drawDecorativeSurface(room, 'sunstone', '#d89d35', '#fff0a0');
    this.drawOrganicSurface(room, (tile) => tile === 'cliff', 'forest', {
      haloAlpha: 0, haloSpread: 0, shape: 'soft', textureAlpha: .96
    });
  }

  drawOpenGround(type, x, y, seed) {
    const ctx = this.ctx;
    const isGrass = type === 'grass';
    const count = isGrass ? 4 : type === 'path' ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const localX = 4 + Math.floor(hash(x * 19 + index, y * 11, seed + 7) * (TILE - 8));
      const localY = 4 + Math.floor(hash(x * 7, y * 23 + index, seed + 17) * (TILE - 8));
      if (isGrass) {
        ctx.fillStyle = index % 2 ? 'rgba(83,148,75,.55)' : 'rgba(145,181,91,.5)';
        ctx.fillRect(x * TILE + localX, y * TILE + localY, 2, 4);
        ctx.fillRect(x * TILE + localX - 2, y * TILE + localY + 2, 2, 2);
      } else {
        ctx.fillStyle = index % 2 ? 'rgba(172,145,102,.34)' : 'rgba(164,143,181,.26)';
        ctx.fillRect(x * TILE + localX, y * TILE + localY, index === 0 ? 2 : 1, 1);
      }
    }
  }

  blendStoneEdge(room, x, y) {
    const ctx = this.ctx;
    const connected = new Set(['stone', 'mosaic', 'sunstone', 'bridge']);
    const sameSurface = (checkX, checkY) => connected.has(room.grid[checkY]?.[checkX]);
    const dx = x * TILE;
    const dy = y * TILE;
    ctx.fillStyle = '#fffdf0';
    const cutEdge = (edge) => {
      for (let segment = 0; segment < 6; segment += 1) {
        const depth = 2 + Math.floor(hash(x * 13 + segment, y * 17, room.seed + edge.length * 19) * 5);
        const offset = segment * 8;
        if (edge === 'n') ctx.fillRect(dx + offset, dy, 8, depth);
        else if (edge === 's') ctx.fillRect(dx + offset, dy + TILE - depth, 8, depth);
        else if (edge === 'w') ctx.fillRect(dx, dy + offset, depth, 8);
        else ctx.fillRect(dx + TILE - depth, dy + offset, depth, 8);
      }
    };
    if (!sameSurface(x, y - 1)) cutEdge('n');
    if (!sameSurface(x + 1, y)) cutEdge('e');
    if (!sameSurface(x, y + 1)) cutEdge('s');
    if (!sameSurface(x - 1, y)) cutEdge('w');
  }

  drawTile(room, x, y) {
    const type = room.grid[y][x];
    if (['grass', 'sand', 'path'].includes(type)) {
      this.drawOpenGround(type, x, y, room.seed);
      return;
    }
    if (['cliff', 'water', 'stone', 'mosaic', 'sunstone', 'darkStone', 'darkPath'].includes(type)) return;
    if (type === 'wall') {
      this.drawWall(room, x, y);
      return;
    }

    const n = hash(x, y, room.seed);
    let sprite = TERRAIN[type] || 'grass';
    if (type === 'grass' && n > .84) sprite = 'grassFlowers';
    if (type === 'stone' && n > .7) sprite = 'ruinFloor';
    this.drawTerrain(sprite, x, y, { flip: n > .5 && !['bridge', 'stairs', 'lightChannel'].includes(sprite) });
    if (type === 'stone') this.blendStoneEdge(room, x, y);
  }

  drawGroundDetails(room) {
    for (let y = 1; y < ROWS - 1; y += 1) {
      for (let x = 1; x < COLS - 1; x += 1) {
        const type = room.grid[y][x];
        const n = hash(x * 3, y * 5, room.seed + 19);
        if (type === 'grass' && n > .9) {
          this.drawSprite(n > .96 ? 'whiteFlowers' : 'grassTuft', x, y, { scale: .88, alpha: .78, flip: n > .94 });
        } else if (['stone', 'darkStone'].includes(type) && n > .965) {
          this.drawSprite('rubble', x, y, { scale: .7, alpha: .58, flip: n > .98 });
        }
      }
    }
  }

  drawShadow(entry, scale = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(37,56,46,.18)';
    ctx.beginPath();
    ctx.ellipse(entry.x * TILE + TILE / 2, entry.y * TILE + TILE - 5, TILE * .42 * scale, TILE * .15 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawObject(entry, room, game) {
    switch (entry.type) {
      case 'tree':
        this.drawShadow(entry, 1.4);
        this.drawSprite('tree', entry.x, entry.y, { scale: OBJECT_SCALE.tree, flip: entry.x % 2 === 0 });
        break;
      case 'cypress':
        this.drawShadow(entry, 1.1);
        this.drawSprite('cypress', entry.x, entry.y, { scale: OBJECT_SCALE.cypress, flip: entry.x % 2 === 1 });
        break;
      case 'flower':
        this.drawSprite(entry.x % 2 ? 'coralFlowers' : 'whiteFlowers', entry.x, entry.y, { scale: OBJECT_SCALE.flower });
        break;
      case 'reeds': this.drawSprite('reeds', entry.x, entry.y, { scale: OBJECT_SCALE.reeds }); break;
      case 'pillar':
        this.drawShadow(entry);
        this.drawSprite('pillar', entry.x, entry.y, { scale: OBJECT_SCALE.pillar });
        break;
      case 'sunPillar':
        this.drawShadow(entry);
        this.drawSprite('sunPillar', entry.x, entry.y, { scale: OBJECT_SCALE.sunPillar, glow: '#ffce59', glowBlur: 10 });
        break;
      case 'pot':
        this.drawShadow(entry, .7);
        this.drawSprite('pot', entry.x, entry.y, { scale: OBJECT_SCALE.pot });
        break;
      case 'note': this.drawSprite('note', entry.x, entry.y, { scale: OBJECT_SCALE.note }); break;
      case 'checkpoint':
        this.drawSprite('checkpoint', entry.x, entry.y, { scale: OBJECT_SCALE.checkpoint, glow: '#ffd66c', glowBlur: 8 });
        break;
      case 'npc':
        this.drawShadow(entry, .7);
        this.drawSprite('elia', entry.x, entry.y, { scale: OBJECT_SCALE.npc });
        break;
      case 'emitter':
        this.drawShadow(entry);
        this.drawSprite('emitter', entry.x, entry.y, { scale: OBJECT_SCALE.emitter, glow: '#ffd35d', glowBlur: 8 });
        break;
      case 'mirror':
        this.drawShadow(entry);
        this.drawSprite(entry.orientation === '/' ? 'mirrorSlash' : 'mirrorBackslash', entry.x, entry.y, { scale: OBJECT_SCALE.mirror });
        break;
      case 'receiver': {
        const powered = traceBeam(room).powered;
        this.drawShadow(entry);
        this.drawSprite(powered ? 'receiverOn' : 'receiverOff', entry.x, entry.y, {
          scale: OBJECT_SCALE.receiver,
          glow: powered ? '#fff09a' : null,
          glowBlur: 16
        });
        break;
      }
      case 'lightGate': this.drawLightGate(entry, room); break;
      case 'waterGate': this.drawWaterGate(entry, room); break;
      case 'chest':
        this.drawShadow(entry, .62);
        this.drawSprite(entry.opened ? 'chestOpen' : 'chestClosed', entry.x, entry.y, {
          scale: OBJECT_SCALE.chest,
          offsetY: 1,
          filter: 'saturate(.76) brightness(1.04)'
        });
        break;
      case 'pickup': {
        const bob = Math.round(Math.sin(this.time / 210 + entry.x) * 4);
        this.drawSprite(entry.item || 'nectar', entry.x, entry.y, {
          scale: OBJECT_SCALE.pickup,
          offsetY: bob - 8,
          glow: '#ffe079',
          glowBlur: 14
        });
        break;
      }
      case 'crate':
        this.drawShadow(entry, .72);
        this.drawSprite('crate', entry.x, entry.y, {
          scale: OBJECT_SCALE.crate,
          filter: 'saturate(.78) brightness(1.06)'
        });
        break;
      case 'plate':
        this.drawSprite('plate', entry.x, entry.y, {
          scale: OBJECT_SCALE.plate,
          glow: puzzleSolved(room, 'aqueduct') ? '#ffd66c' : null,
          glowBlur: 10
        });
        break;
      case 'brazier':
        this.drawSprite(entry.lit ? 'brazierOn' : 'brazierOff', entry.x, entry.y, {
          scale: OBJECT_SCALE.brazier,
          glow: entry.lit ? '#ff9a43' : null,
          glowBlur: 15
        });
        break;
      case 'altar':
        this.drawShadow(entry, 1.1);
        this.drawSprite(game.sealCount === 3 ? 'altarOn' : 'altarOff', entry.x, entry.y, {
          scale: OBJECT_SCALE.altar,
          glow: game.sealCount === 3 ? '#ffe77d' : null,
          glowBlur: 20
        });
        break;
      case 'enemy': this.drawEnemy(entry); break;
      default: this.drawSprite('rocks', entry.x, entry.y, { scale: 1.2 });
    }
  }

  drawLightGate(entry, room) {
    if (puzzleSolved(room, entry.puzzle) || entry.id.endsWith('-b')) return;
    this.drawBarrierGate(entry, 'light');
  }

  drawWaterGate(entry, room) {
    if (puzzleSolved(room, entry.puzzle) || entry.id.endsWith('-b')) return;
    this.drawWaterSluice(entry);
  }

  drawWaterSluice(entry) {
    const ctx = this.ctx;
    const left = entry.x * TILE;
    const top = entry.y * TILE;
    const height = TILE * 2;
    const leftEdge = [11, 8, 10, 7, 9, 8, 11, 8, 10];
    const rightEdge = [38, 40, 37, 41, 39, 40, 37, 39, 38];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left + leftEdge[0], top);
    leftEdge.forEach((edge, index) => ctx.lineTo(left + edge, top + index * 12));
    for (let index = rightEdge.length - 1; index >= 0; index -= 1) {
      ctx.lineTo(left + rightEdge[index], top + index * 12);
    }
    ctx.closePath();
    ctx.clip();
    this.drawLandscape('waterCenter', entry.x, entry.y);
    this.drawLandscape('waterCenter', entry.x, entry.y + 1);
    ctx.restore();

    ctx.save();
    leftEdge.forEach((edge, index) => {
      const y = top + index * 12 + 2;
      const shade = index % 2 ? '#a99872' : '#d7c592';
      ctx.fillStyle = '#786f57';
      ctx.fillRect(left + edge - 5, y + 2, 8, 7);
      ctx.fillRect(left + rightEdge[index] - 3, y + 2, 8, 7);
      ctx.fillStyle = shade;
      ctx.fillRect(left + edge - 4, y, 7, 6);
      ctx.fillRect(left + rightEdge[index] - 2, y, 7, 6);
      ctx.fillStyle = '#eee0b2';
      ctx.fillRect(left + edge - 3, y + 1, 4, 1);
      ctx.fillRect(left + rightEdge[index] - 1, y + 1, 4, 1);
    });

    for (let y = top + 10; y < top + height - 4; y += 18) {
      const wave = Math.round(Math.sin(this.time / 180 + y) * 3);
      ctx.fillStyle = 'rgba(220,255,230,.75)';
      ctx.fillRect(left + 14 + wave, y, 16, 2);
      ctx.fillStyle = 'rgba(47,144,151,.58)';
      ctx.fillRect(left + 18 - wave, y + 5, 13, 2);
    }

    ctx.fillStyle = '#725027';
    ctx.fillRect(left + 5, top + 3, TILE - 10, 6);
    ctx.fillRect(left + 5, top + height - 9, TILE - 10, 6);
    ctx.fillStyle = '#d7a449';
    ctx.fillRect(left + 8, top + 4, TILE - 16, 3);
    ctx.fillRect(left + 8, top + height - 8, TILE - 16, 3);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(left + 12, top + 4, TILE - 24, 1);
    ctx.fillRect(left + 12, top + height - 8, TILE - 24, 1);
    ctx.restore();
  }

  drawBarrierGate(entry, kind) {
    const ctx = this.ctx;
    const centerX = entry.x * TILE + TILE / 2;
    const top = entry.y * TILE + 3;
    const height = TILE * 2 - 6;
    const lightGate = kind === 'light';
    const stoneDark = lightGate ? '#92713b' : '#746d59';
    const stoneMid = lightGate ? '#d2ad62' : '#b9aa82';
    const stoneLight = lightGate ? '#ffe39a' : '#eee0b2';
    const metalDark = lightGate ? '#8e531c' : '#36575b';
    const metalMid = lightGate ? '#d99a32' : '#2f8c91';
    const metalLight = lightGate ? '#ffdc68' : '#7bd6c7';

    ctx.save();
    ctx.fillStyle = 'rgba(30,49,45,.2)';
    ctx.fillRect(centerX - 12, top + 7, 32, height - 2);

    ctx.fillStyle = stoneDark;
    ctx.fillRect(centerX - 16, top, 32, height);
    for (let y = top + 3, row = 0; y < top + height - 4; y += 17, row += 1) {
      ctx.fillStyle = stoneMid;
      ctx.fillRect(centerX - 13, y, 12, 14);
      ctx.fillRect(centerX + 2, y, 11, 14);
      ctx.fillStyle = stoneLight;
      ctx.fillRect(centerX - 12, y + 1, 10, 2);
      ctx.fillRect(centerX + 3, y + 1, 9, 2);
      ctx.fillStyle = stoneDark;
      ctx.fillRect(centerX - 1, y + (row % 2 ? 7 : 2), 3, 5);
    }

    ctx.fillStyle = metalDark;
    ctx.fillRect(centerX - 5, top + 5, 10, height - 10);
    ctx.fillStyle = metalMid;
    ctx.fillRect(centerX - 3, top + 6, 6, height - 12);
    ctx.fillStyle = metalLight;
    ctx.fillRect(centerX - 2, top + 7, 2, height - 14);
    for (const y of [top + 20, top + 45, top + 70]) {
      ctx.fillStyle = metalDark;
      ctx.fillRect(centerX - 7, y - 2, 14, 7);
      ctx.fillStyle = metalLight;
      ctx.fillRect(centerX - 3, y, 6, 3);
    }

    ctx.fillStyle = stoneDark;
    ctx.fillRect(centerX - 20, top - 2, 40, 10);
    ctx.fillRect(centerX - 20, top + height - 8, 40, 10);
    ctx.fillStyle = stoneMid;
    ctx.fillRect(centerX - 17, top, 34, 6);
    ctx.fillRect(centerX - 17, top + height - 6, 34, 6);
    ctx.fillStyle = stoneLight;
    ctx.fillRect(centerX - 15, top + 1, 30, 2);
    ctx.fillRect(centerX - 15, top + height - 5, 30, 2);

    if (lightGate) {
      ctx.shadowColor = '#ffd76a';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fff0a5';
      ctx.fillRect(centerX - 1, top + 10, 2, height - 20);
    }
    ctx.restore();
  }

  drawEnemy(entry) {
    this.drawShadow(entry, .8);
    const name = entry.enemy === 'scarab' ? 'scarab' : entry.enemy === 'shadow' ? 'shadow' : 'sentinel';
    const scale = entry.enemy === 'scarab' ? 1 : entry.enemy === 'shadow' ? 1.18 : 1.28;
    const bob = entry.enemy === 'shadow' ? Math.round(Math.sin(this.time / 150 + entry.x) * 4) - 4 : 0;
    this.drawSprite(name, entry.x, entry.y, {
      scale,
      offsetY: bob,
      flip: entry.x % 2 === 0,
      glow: entry.enemy === 'shadow' ? '#7e6ed2' : null,
      glowBlur: 10
    });
  }

  drawPlayer(player, attackFlash) {
    const progress = player.motionProgress ?? 1;
    this.drawShadow(player, .75);
    const direction = ['up', 'down', 'left', 'right'].includes(player.facing) ? player.facing : 'down';
    // The first walking pose appears on key-down, while the position itself
    // advances only by real held time. Releasing returns to the planted A pose.
    const phase = player.moving && progress < .5 ? 'B' : 'A';
    const frameOffsetY = phase === 'B' ? (['left', 'right'].includes(direction) ? 9 : 8) : 0;
    this.drawCharacterSprite(`${direction}${phase}`, player.x, player.y, {
      scale: OBJECT_SCALE.player,
      offsetX: 0,
      // The B artwork sits 7-8 source pixels higher than A. Aligning the feet
      // keeps Rokor planted on his shadow instead of bobbing between frames.
      offsetY: frameOffsetY
    });
    if (attackFlash > 0) this.drawAttack(player);
  }

  drawAttack(player) {
    const ctx = this.ctx;
    const cx = player.x * TILE + TILE / 2;
    const cy = player.y * TILE + TILE / 2;
    const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    const angle = angles[player.facing] || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = '#fff5b0';
    ctx.lineWidth = 7;
    ctx.shadowColor = '#ffd85c';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, TILE * .72, -.7, .7);
    ctx.stroke();
    ctx.restore();
  }

  drawBeam(path) {
    if (!path.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.shadowColor = '#ffe983';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = 'rgba(255,194,55,.34)';
    ctx.lineWidth = 19;
    ctx.beginPath();
    path.forEach((point, index) => {
      const x = point.x * TILE + TILE / 2;
      const y = point.y * TILE + TILE / 2;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.strokeStyle = '#fff4ad';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  drawDarkness(room, game, player = game.playerVisual) {
    const ctx = this.darknessCtx;
    const radius = game.inventory.includes('lantern') ? TILE * 5 : TILE * 2.6;
    ctx.clearRect(0, 0, this.darknessCanvas.width, this.darknessCanvas.height);
    ctx.fillStyle = 'rgba(2,8,20,.87)';
    ctx.fillRect(0, 0, this.darknessCanvas.width, this.darknessCanvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    const lights = [{ x: player.x * TILE + TILE / 2, y: player.y * TILE + TILE / 2, r: radius }];
    room.objects.filter((entry) => entry.type === 'brazier' && entry.lit).forEach((entry) => {
      lights.push({ x: entry.x * TILE + TILE / 2, y: entry.y * TILE + TILE / 2, r: TILE * 3.4 });
    });
    for (const light of lights) {
      const gradient = ctx.createRadialGradient(light.x, light.y, TILE / 3, light.x, light.y, light.r);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(.56, 'rgba(0,0,0,.94)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.darknessCanvas, 0, 0);
  }

  drawAtmosphere(room) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.save();
    const sunlight = ctx.createLinearGradient(0, 0, width, height);
    sunlight.addColorStop(0, room.dark ? 'rgba(39,63,91,.08)' : 'rgba(255,231,139,.17)');
    sunlight.addColorStop(.5, 'rgba(255,255,255,0)');
    sunlight.addColorStop(1, room.dark ? 'rgba(17,12,40,.2)' : 'rgba(73,129,125,.025)');
    ctx.fillStyle = sunlight;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(width / 2, height * .48, width * .22, width / 2, height * .48, width * .62);
    vignette.addColorStop(.65, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, room.dark ? 'rgba(0,5,14,.45)' : 'rgba(18,54,48,.09)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    if (!room.dark) {
      ctx.fillStyle = 'rgba(255,240,164,.7)';
      for (let i = 0; i < 11; i += 1) {
        const x = (room.seed * 43 + i * 211 + this.time / 38) % width;
        const y = (room.seed * 29 + i * 127) % (height - 60);
        ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
    }
    ctx.restore();
  }
}
