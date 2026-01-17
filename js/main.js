import { VIEW_HEIGHT, VIEW_WIDTH } from './constants.js';
import { InteriorScene } from './scenes/InteriorScene.js';
import { OverworldScene } from './scenes/OverworldScene.js';
import { UIScene } from './scenes/UIScene.js';

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
