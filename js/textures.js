import { TILE_SIZE } from './constants.js';

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

export function createTextures(scene) {
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
