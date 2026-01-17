const TILE_SIZE = 32;
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 200;

const gameState = {
  inventory: {
    shovel: true,
    keyBlue: false,
    machete: false,
    raft: false,
    chip: false,
  },
  selected: 'shovel',
  health: 3,
  score: 0,
};

const eventBus = new Phaser.Events.EventEmitter();

const TILE = {
  GRASS: 0,
  WALL: 1,
  WATER: 2,
  SAND: 3,
  HOLE: 4,
  FLOOR: 5,
  BUSH: 6,
  SPIKES: 7,
  ENTRANCE: 8,
  DOOR: 9,
};

const OVERWORLD_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 6, 6, 0, 1, 1, 1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 6, 6, 0, 1, 0, 1, 0, 0, 0, 2, 2, 0, 7, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 9, 1, 0, 0, 0, 2, 2, 0, 7, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const INTERIOR_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 5, 5, 5, 5, 5, 5, 5, 5, 1],
  [1, 5, 1, 1, 1, 1, 1, 1, 5, 1],
  [1, 5, 1, 5, 5, 5, 5, 1, 5, 1],
  [1, 5, 1, 5, 5, 5, 5, 1, 5, 1],
  [1, 5, 1, 5, 5, 5, 5, 1, 5, 1],
  [1, 5, 5, 5, 5, 5, 5, 5, 5, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const overworldItems = [
  { x: 16, y: 5, type: 'chip' },
];

const interiorItems = [
  { x: 4, y: 4, type: 'raft' },
];

const digSites = [
  { x: 4, y: 7, contains: 'keyBlue', dug: false },
];

const overworldState = {
  map: OVERWORLD_MAP.map((row) => [...row]),
  items: overworldItems.map((item) => ({ ...item })),
};

const interiorState = {
  map: INTERIOR_MAP.map((row) => [...row]),
  items: interiorItems.map((item) => ({ ...item })),
};

function createCanvas(size, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  return canvas.toDataURL();
}

function addBase64Texture(scene, key, size, drawFn) {
  const dataUrl = createCanvas(size, drawFn);
  scene.textures.addBase64(key, dataUrl);
}

function createTextures(scene) {
  if (scene.textures.exists('grass')) {
    return;
  }
  const colors = {
    black: '#000000',
    white: '#f8f8f8',
    grass1: '#00aa00',
    grass2: '#007700',
    sand1: '#d8b24c',
    sand2: '#b88a2a',
    water1: '#1e5cff',
    water2: '#0b2f99',
    brick: '#aa2222',
    brickDark: '#661111',
    doorBlue: '#3ac2ff',
    bush1: '#228833',
    bush2: '#116622',
    spike: '#ff44aa',
    floor: '#444444',
    hole: '#221100',
  };

  const dither = (ctx, size, colorA, colorB) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const useA = (x + y) % 2 === 0;
        ctx.fillStyle = useA ? colorA : colorB;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  addBase64Texture(scene, 'grass', TILE_SIZE, (ctx, size) => {
    dither(ctx, size, colors.grass1, colors.grass2);
  });

  addBase64Texture(scene, 'sand', TILE_SIZE, (ctx, size) => {
    dither(ctx, size, colors.sand1, colors.sand2);
  });

  addBase64Texture(scene, 'water', TILE_SIZE, (ctx, size) => {
    dither(ctx, size, colors.water1, colors.water2);
    ctx.strokeStyle = '#7ad7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.7);
    ctx.lineTo(size, size * 0.6);
    ctx.stroke();
  });

  addBase64Texture(scene, 'wall', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = colors.brick;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = colors.brickDark;
    ctx.lineWidth = 2;
    for (let y = 0; y < size; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (let x = 0; x < size; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  });

  addBase64Texture(scene, 'floor', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = colors.floor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#555555';
    ctx.fillRect(4, 4, size - 8, size - 8);
  });

  addBase64Texture(scene, 'hole', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = colors.hole;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#110800';
    ctx.fillRect(6, 6, size - 12, size - 12);
  });

  addBase64Texture(scene, 'bush', TILE_SIZE, (ctx, size) => {
    dither(ctx, size, colors.bush1, colors.bush2);
    ctx.fillStyle = '#55ff55';
    ctx.fillRect(10, 10, 12, 12);
  });

  addBase64Texture(scene, 'spikes', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = colors.spike;
    for (let x = 4; x < size; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, size - 4);
      ctx.lineTo(x + 4, 8);
      ctx.lineTo(x + 8, size - 4);
      ctx.closePath();
      ctx.fill();
    }
  });

  addBase64Texture(scene, 'door', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = colors.doorBlue;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = colors.black;
    ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);
  });

  addBase64Texture(scene, 'entrance', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = '#555577';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111111';
    ctx.fillRect(6, 4, size - 12, size - 8);
  });

  addBase64Texture(scene, 'player', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(6, 4, 20, 24);
    ctx.fillStyle = '#00ffcc';
    ctx.fillRect(10, 8, 12, 10);
    ctx.fillStyle = '#333333';
    ctx.fillRect(12, 20, 8, 6);
  });

  addBase64Texture(scene, 'bot', TILE_SIZE, (ctx, size) => {
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(6, 6, 20, 20);
    ctx.fillStyle = '#000000';
    ctx.fillRect(10, 10, 4, 4);
    ctx.fillRect(18, 10, 4, 4);
  });

  addBase64Texture(scene, 'icon-shovel', 16, (ctx, size) => {
    ctx.fillStyle = '#bbbbbb';
    ctx.fillRect(7, 2, 2, 10);
    ctx.fillStyle = '#885533';
    ctx.fillRect(6, 10, 4, 6);
  });

  addBase64Texture(scene, 'icon-key', 16, (ctx, size) => {
    ctx.fillStyle = '#4bd9ff';
    ctx.fillRect(2, 6, 8, 4);
    ctx.fillRect(8, 4, 6, 2);
    ctx.fillRect(10, 8, 4, 2);
  });

  addBase64Texture(scene, 'icon-machete', 16, (ctx, size) => {
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(3, 3, 10, 3);
    ctx.fillStyle = '#884422';
    ctx.fillRect(10, 6, 3, 7);
  });

  addBase64Texture(scene, 'icon-raft', 16, (ctx, size) => {
    ctx.fillStyle = '#aa7733';
    ctx.fillRect(2, 8, 12, 4);
    ctx.fillRect(4, 6, 8, 2);
  });

  addBase64Texture(scene, 'icon-chip', 16, (ctx, size) => {
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(4, 4, 8, 8);
    ctx.strokeStyle = '#004422';
    ctx.strokeRect(4, 4, 8, 8);
  });
}

function playBeep(frequency = 440, duration = 0.08, type = 'square') {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = playBeep.context || new AudioContext();
  playBeep.context = context;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function tileToTexture(tile) {
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

function isPassable(tile) {
  if (tile === TILE.WALL) return false;
  if (tile === TILE.DOOR) return false;
  if (tile === TILE.BUSH) return gameState.inventory.machete;
  if (tile === TILE.WATER) return gameState.inventory.raft;
  return true;
}

class BaseScene extends Phaser.Scene {
  createSelectionKeys() {
    this.selectionKeys = this.input.keyboard.addKeys({
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
    });
  }

  handleSelectionInput() {
    if (Phaser.Input.Keyboard.JustDown(this.selectionKeys.one)) {
      this.selectItem('shovel');
    }
    if (Phaser.Input.Keyboard.JustDown(this.selectionKeys.two)) {
      this.selectItem('keyBlue');
    }
    if (Phaser.Input.Keyboard.JustDown(this.selectionKeys.three)) {
      this.selectItem('machete');
    }
    if (Phaser.Input.Keyboard.JustDown(this.selectionKeys.four)) {
      this.selectItem('raft');
    }
    if (Phaser.Input.Keyboard.JustDown(this.selectionKeys.five)) {
      this.selectItem('chip');
    }
  }

  selectItem(item) {
    if (!gameState.inventory[item]) return;
    gameState.selected = item;
    eventBus.emit('selectionChanged', item);
  }
}

class OverworldScene extends BaseScene {
  constructor() {
    super('Overworld');
    this.map = overworldState.map;
    this.items = overworldState.items;
    this.playerTile = { x: 2, y: 10 };
    this.returnTile = { x: 6, y: 5 };
  }

  init(data) {
    if (data?.returnTile) {
      this.playerTile = { ...data.returnTile };
    }
  }

  create() {
    createTextures(this);
    this.createSelectionKeys();
    this.cameras.main.setBounds(0, 0, this.map[0].length * TILE_SIZE, this.map.length * TILE_SIZE);
    this.scene.launch('UI');

    this.tiles = [];
    for (let y = 0; y < this.map.length; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.map[y].length; x++) {
        const tile = this.map[y][x];
        const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, tileToTexture(tile));
        sprite.setOrigin(0.5, 0.5);
        this.tiles[y][x] = sprite;
      }
    }

    this.player = this.add.image(this.playerTile.x * TILE_SIZE + TILE_SIZE / 2, this.playerTile.y * TILE_SIZE + TILE_SIZE / 2, 'player');
    this.player.setDepth(10);

    this.itemSprites = new Map();
    this.items.forEach((item) => {
      const sprite = this.add.image(item.x * TILE_SIZE + TILE_SIZE / 2, item.y * TILE_SIZE + TILE_SIZE / 2, `icon-${item.type}`);
      sprite.setDepth(9);
      this.itemSprites.set(item, sprite);
    });

    this.bot = {
      x: 9,
      y: 3,
      dir: 1,
      sprite: this.add.image(9 * TILE_SIZE + TILE_SIZE / 2, 3 * TILE_SIZE + TILE_SIZE / 2, 'bot'),
    };
    this.bot.sprite.setDepth(9);

    this.moving = false;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.actionKeys = this.input.keyboard.addKeys({
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
    });

    this.cameras.main.startFollow(this.player, true, 0.25, 0.25);

    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => this.moveBot(),
    });
  }

  update() {
    this.handleSelectionInput();
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.space) || Phaser.Input.Keyboard.JustDown(this.actionKeys.enter)) {
      this.handleAction();
    }

    if (this.moving) return;

    if (this.cursors.left.isDown) this.tryMove(-1, 0);
    else if (this.cursors.right.isDown) this.tryMove(1, 0);
    else if (this.cursors.up.isDown) this.tryMove(0, -1);
    else if (this.cursors.down.isDown) this.tryMove(0, 1);
  }

  tryMove(dx, dy) {
    const targetX = this.playerTile.x + dx;
    const targetY = this.playerTile.y + dy;
    const row = this.map[targetY];
    if (!row) return;
    const tile = row[targetX];
    if (tile === undefined || !isPassable(tile)) return;

    this.moving = true;
    playBeep(220, 0.06, 'square');
    this.playerTile = { x: targetX, y: targetY };
    this.tweens.add({
      targets: this.player,
      x: targetX * TILE_SIZE + TILE_SIZE / 2,
      y: targetY * TILE_SIZE + TILE_SIZE / 2,
      duration: 120,
      onComplete: () => {
        this.moving = false;
        this.onPlayerStep();
      },
    });
  }

  onPlayerStep() {
    const tile = this.map[this.playerTile.y][this.playerTile.x];
    if (tile === TILE.SPIKES) {
      this.damagePlayer();
    }
    if (tile === TILE.ENTRANCE) {
      this.transitionToInterior();
      return;
    }

    const item = this.items.find((entry) => entry.x === this.playerTile.x && entry.y === this.playerTile.y);
    if (item) {
      this.collectItem(item);
    }
  }

  handleAction() {
    const { x, y } = this.playerTile;

    if (gameState.selected === 'shovel') {
      const digSite = digSites.find((site) => site.x === x && site.y === y && !site.dug);
      if (digSite && this.map[y][x] === TILE.SAND) {
        digSite.dug = true;
        this.map[y][x] = TILE.HOLE;
        this.tiles[y][x].setTexture(tileToTexture(TILE.HOLE));
        playBeep(520, 0.12, 'triangle');
        this.spawnItem({ x, y, type: digSite.contains });
        return;
      }
    }

    if (gameState.selected === 'keyBlue') {
      const doorPosition = this.findAdjacentTile(TILE.DOOR);
      if (doorPosition) {
        const { x: doorX, y: doorY } = doorPosition;
        this.map[doorY][doorX] = TILE.ENTRANCE;
        this.tiles[doorY][doorX].setTexture(tileToTexture(TILE.ENTRANCE));
        playBeep(660, 0.1, 'square');
        return;
      }
    }

    if (gameState.selected === 'machete') {
      const bush = this.findAdjacentTile(TILE.BUSH);
      if (bush) {
        const { x: bushX, y: bushY } = bush;
        this.map[bushY][bushX] = TILE.GRASS;
        this.tiles[bushY][bushX].setTexture(tileToTexture(TILE.GRASS));
        playBeep(300, 0.1, 'sawtooth');
      }
    }
  }

  findAdjacentTile(tileType) {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    return dirs
      .map((dir) => ({ x: this.playerTile.x + dir.x, y: this.playerTile.y + dir.y }))
      .find((pos) => this.map[pos.y] && this.map[pos.y][pos.x] === tileType);
  }

  spawnItem(item) {
    this.items.push(item);
    const sprite = this.add.image(item.x * TILE_SIZE + TILE_SIZE / 2, item.y * TILE_SIZE + TILE_SIZE / 2, `icon-${item.type}`);
    sprite.setDepth(9);
    this.itemSprites.set(item, sprite);
  }

  collectItem(item) {
    gameState.inventory[item.type] = true;
    gameState.score += 50;
    eventBus.emit('inventoryUpdated');
    eventBus.emit('scoreUpdated', gameState.score);
    const sprite = this.itemSprites.get(item);
    if (sprite) sprite.destroy();
    this.items = this.items.filter((entry) => entry !== item);
  }

  damagePlayer() {
    gameState.health = Math.max(0, gameState.health - 1);
    eventBus.emit('healthUpdated', gameState.health);
    playBeep(120, 0.2, 'sawtooth');
    if (gameState.health === 0) {
      this.resetPlayer();
    }
  }

  resetPlayer() {
    gameState.health = 3;
    eventBus.emit('healthUpdated', gameState.health);
    this.playerTile = { x: 2, y: 10 };
    this.player.setPosition(this.playerTile.x * TILE_SIZE + TILE_SIZE / 2, this.playerTile.y * TILE_SIZE + TILE_SIZE / 2);
  }

  transitionToInterior() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Interior', { returnTile: { x: 6, y: 5 } });
    });
  }

  moveBot() {
    const nextX = this.bot.x + this.bot.dir;
    if (!isPassable(this.map[this.bot.y][nextX])) {
      this.bot.dir *= -1;
      return;
    }
    this.bot.x = nextX;
    this.bot.sprite.x = this.bot.x * TILE_SIZE + TILE_SIZE / 2;
    if (this.bot.x === this.playerTile.x && this.bot.y === this.playerTile.y) {
      this.damagePlayer();
    }
  }
}

class InteriorScene extends BaseScene {
  constructor() {
    super('Interior');
    this.map = interiorState.map;
    this.items = interiorState.items;
    this.playerTile = { x: 2, y: 6 };
  }

  init(data) {
    if (data?.returnTile) {
      this.returnTile = data.returnTile;
    }
  }

  create() {
    createTextures(this);
    this.createSelectionKeys();
    this.cameras.main.setBounds(0, 0, this.map[0].length * TILE_SIZE, this.map.length * TILE_SIZE);

    this.tiles = [];
    for (let y = 0; y < this.map.length; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.map[y].length; x++) {
        const tile = this.map[y][x];
        const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, tileToTexture(tile));
        sprite.setOrigin(0.5, 0.5);
        this.tiles[y][x] = sprite;
      }
    }

    this.map[6][1] = TILE.ENTRANCE;
    this.tiles[6][1].setTexture(tileToTexture(TILE.ENTRANCE));

    this.player = this.add.image(this.playerTile.x * TILE_SIZE + TILE_SIZE / 2, this.playerTile.y * TILE_SIZE + TILE_SIZE / 2, 'player');
    this.player.setDepth(10);

    this.itemSprites = new Map();
    this.items.forEach((item) => {
      const sprite = this.add.image(item.x * TILE_SIZE + TILE_SIZE / 2, item.y * TILE_SIZE + TILE_SIZE / 2, `icon-${item.type}`);
      sprite.setDepth(9);
      this.itemSprites.set(item, sprite);
    });

    this.moving = false;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.actionKeys = this.input.keyboard.addKeys({
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
    });

    this.createFog();
    this.cameras.main.startFollow(this.player, true, 0.25, 0.25);
  }

  update() {
    this.handleSelectionInput();
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.space) || Phaser.Input.Keyboard.JustDown(this.actionKeys.enter)) {
      this.handleAction();
    }

    if (this.moving) return;

    if (this.cursors.left.isDown) this.tryMove(-1, 0);
    else if (this.cursors.right.isDown) this.tryMove(1, 0);
    else if (this.cursors.up.isDown) this.tryMove(0, -1);
    else if (this.cursors.down.isDown) this.tryMove(0, 1);

    this.updateFog();
  }

  tryMove(dx, dy) {
    const targetX = this.playerTile.x + dx;
    const targetY = this.playerTile.y + dy;
    const row = this.map[targetY];
    if (!row) return;
    const tile = row[targetX];
    if (tile === undefined || !isPassable(tile)) return;

    this.moving = true;
    playBeep(240, 0.06, 'square');
    this.playerTile = { x: targetX, y: targetY };
    this.tweens.add({
      targets: this.player,
      x: targetX * TILE_SIZE + TILE_SIZE / 2,
      y: targetY * TILE_SIZE + TILE_SIZE / 2,
      duration: 120,
      onComplete: () => {
        this.moving = false;
        this.onPlayerStep();
      },
    });
  }

  onPlayerStep() {
    const tile = this.map[this.playerTile.y][this.playerTile.x];
    if (tile === TILE.ENTRANCE) {
      this.transitionToOverworld();
      return;
    }

    const item = this.items.find((entry) => entry.x === this.playerTile.x && entry.y === this.playerTile.y);
    if (item) {
      this.collectItem(item);
    }
  }

  handleAction() {
    if (gameState.selected === 'shovel') {
      playBeep(480, 0.08, 'triangle');
    }
  }

  collectItem(item) {
    gameState.inventory[item.type] = true;
    gameState.score += 75;
    eventBus.emit('inventoryUpdated');
    eventBus.emit('scoreUpdated', gameState.score);
    const sprite = this.itemSprites.get(item);
    if (sprite) sprite.destroy();
    this.items = this.items.filter((entry) => entry !== item);
  }

  transitionToOverworld() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Overworld', { returnTile: this.returnTile || { x: 6, y: 5 } });
    });
  }

  createFog() {
    this.fog = this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.6).setOrigin(0);
    this.fog.setScrollFactor(0);
    this.fogMaskShape = this.make.graphics({ x: 0, y: 0, add: false });
    this.fogMask = this.fogMaskShape.createGeometryMask();
    this.fogMask.invertAlpha = true;
    this.fog.setMask(this.fogMask);
    this.updateFog();
  }

  updateFog() {
    if (!this.fogMaskShape) return;
    this.fogMaskShape.clear();
    this.fogMaskShape.fillStyle(0xffffff);
    const radius = 70;
    this.fogMaskShape.fillCircle(this.player.x, this.player.y, radius);
  }
}

class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.registry.set('score', gameState.score);
    this.bar = this.add.rectangle(0, 0, VIEW_WIDTH, 28, 0x0b0b0b, 0.9).setOrigin(0);
    this.bar.setScrollFactor(0);
    this.statusText = this.add.text(8, 6, 'Punkte 000000  Leben 3', {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: '#ffffff',
    });
    this.statusText.setScrollFactor(0);

    this.inventoryGroup = this.add.group();
    this.renderInventory();

    eventBus.on('inventoryUpdated', () => this.renderInventory());
    eventBus.on('selectionChanged', () => this.renderInventory());
    eventBus.on('healthUpdated', () => this.updateStatus());
    eventBus.on('scoreUpdated', () => this.updateStatus());
  }

  updateStatus() {
    const score = String(gameState.score).padStart(6, '0');
    this.statusText.setText(`Punkte ${score}  Leben ${gameState.health}`);
  }

  renderInventory() {
    this.inventoryGroup.clear(true, true);
    const entries = [
      { key: 'shovel', label: 'Schaufel', texture: 'icon-shovel' },
      { key: 'keyBlue', label: 'Blau Schlüssel', texture: 'icon-key' },
      { key: 'machete', label: 'Machete', texture: 'icon-machete' },
      { key: 'raft', label: 'Floß', texture: 'icon-raft' },
      { key: 'chip', label: 'Chip', texture: 'icon-chip' },
    ];

    let x = 10;
    const y = VIEW_HEIGHT - 30;
    entries.forEach((entry) => {
      const owned = gameState.inventory[entry.key];
      const frame = this.add.rectangle(x, y, 24, 24, owned ? 0x222222 : 0x111111, 0.9);
      frame.setOrigin(0, 0);
      frame.setScrollFactor(0);
      if (gameState.selected === entry.key) {
        frame.setStrokeStyle(2, 0x00ffcc);
      } else {
        frame.setStrokeStyle(1, 0x555555);
      }
      this.inventoryGroup.add(frame);
      if (owned) {
        const icon = this.add.image(x + 12, y + 12, entry.texture);
        icon.setScrollFactor(0);
        this.inventoryGroup.add(icon);
      }
      const label = this.add.text(x + 28, y + 4, entry.label, {
        fontFamily: 'Courier New',
        fontSize: '10px',
        color: owned ? '#dddddd' : '#666666',
      });
      label.setScrollFactor(0);
      this.inventoryGroup.add(label);
      x += 100;
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  scene: [OverworldScene, InteriorScene, UIScene],
};

new Phaser.Game(config);
