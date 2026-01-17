import { VIEW_HEIGHT, VIEW_WIDTH } from '../constants.js';
import { eventBus, gameState } from '../state.js';

export class UIScene extends Phaser.Scene {
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
