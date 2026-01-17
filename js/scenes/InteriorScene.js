import { TILE_SIZE, TILE, VIEW_HEIGHT, VIEW_WIDTH } from '../constants.js';
import { eventBus, gameState } from '../state.js';
import { playBeep } from '../audio.js';
import { createTextures } from '../textures.js';
import { interiorState, placeInteriorEntrance } from '../maps.js';
import { isPassable, tileToTexture } from '../tileUtils.js';
import { BaseScene } from './BaseScene.js';

export class InteriorScene extends BaseScene {
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

    placeInteriorEntrance(this.map, this.tiles);

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
