import { eventBus, gameState } from '../state.js';

export class BaseScene extends Phaser.Scene {
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
