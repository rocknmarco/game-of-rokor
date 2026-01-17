export const gameState = {
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

export const eventBus = new Phaser.Events.EventEmitter();
