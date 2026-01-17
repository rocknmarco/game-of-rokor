import { TILE_SIZE, TILE } from '../constants.js';
import { eventBus, gameState } from '../state.js';
import { playBeep } from '../audio.js';
import { createTextures } from '../textures.js';
import { digSites, overworldState } from '../maps.js';
import { isPassable, tileToTexture } from '../tileUtils.js';
import { BaseScene } from './BaseScene.js';

export class OverworldScene extends BaseScene {
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
