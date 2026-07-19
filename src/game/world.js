export const COLS = 30;
export const ROWS = 18;
// World coordinates stay grid-based, while the renderer now uses a higher-resolution
// 48px atlas tile. This keeps the room logic simple and gives every sprite enough
// pixel detail to match the title artwork.
export const TILE = 48;

export const ITEMS = {
  lens: { name: 'Bernsteinlinse', icon: '◉', description: 'Bündelt das alte Sonnenlicht.' },
  lantern: { name: 'Dämmerlaterne', icon: '♨', description: 'Hält die Schatten im Gewölbe fern.' },
  sigilDawn: { name: 'Siegel der Morgenröte', icon: '◆', description: 'Ein warm pulsierendes Sonnensiegel.' },
  sigilTide: { name: 'Siegel der Gezeiten', icon: '◆', description: 'Riecht nach Salz und Regen.' },
  sigilDusk: { name: 'Siegel der Dämmerung', icon: '◆', description: 'Glüht selbst im tiefsten Schatten.' },
  nectar: { name: 'Sonnennektar', icon: '●', description: 'Stellt ein Herz wieder her.' }
};

export const ROOM_DEFS = [
  { id: 'grove', x: 0, y: 0, name: 'Zypressenhain', subtitle: 'Wo der Wind Geschichten trägt', base: 'grass', biome: 'forest', seed: 13 },
  { id: 'bridge', x: 1, y: 0, name: 'Lichtbrücke', subtitle: 'Ein Weg aus gebündelter Sonne', base: 'sand', biome: 'coast', seed: 27, seal: true },
  { id: 'archive', x: 2, y: 0, name: 'Archivhof', subtitle: 'Stille Seiten unter freiem Himmel', base: 'grass', biome: 'ruins', seed: 39 },
  { id: 'garden', x: 0, y: 1, name: 'Sonnengarten', subtitle: 'Der letzte bewohnte Winkel Lioras', base: 'grass', biome: 'forest', seed: 51 },
  { id: 'canal', x: 1, y: 1, name: 'Spiegelkanal', subtitle: 'Wasser erinnert sich an jedes Licht', base: 'grass', biome: 'coast', seed: 68 },
  { id: 'watch', x: 2, y: 1, name: 'Wachtplateau', subtitle: 'Messing und Moos auf alten Mauern', base: 'grass', biome: 'ruins', seed: 74 },
  { id: 'aqueduct', x: 0, y: 2, name: 'Unteres Aquädukt', subtitle: 'Die Flutkammern der Erbauer', base: 'sand', biome: 'coast', seed: 86, seal: true },
  { id: 'vault', x: 1, y: 2, name: 'Dämmergewölbe', subtitle: 'Drei Flammen gegen die Nacht', base: 'darkStone', biome: 'vault', seed: 97, seal: true, dark: true },
  { id: 'observatory', x: 2, y: 2, name: 'Die Sonnenwarte', subtitle: 'Das schlafende Herz von Liora', base: 'grass', biome: 'ruins', seed: 111 }
];

export const ROOM_BY_ID = Object.fromEntries(ROOM_DEFS.map((room) => [room.id, room]));

export function roomAt(x, y) {
  return ROOM_DEFS.find((room) => room.x === x && room.y === y) || null;
}

function makeGrid(fill) {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
}

function fillRect(grid, x, y, width, height, tile) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) grid[row][col] = tile;
    }
  }
}

function fillEllipse(grid, cx, cy, rx, ry, tile) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      if (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1 && grid[y]?.[x]) grid[y][x] = tile;
    }
  }
}

function paintLine(grid, points, tile, radius = 1.08) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [startX, startY] = points[index];
    const [endX, endY] = points[index + 1];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) * 2));
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const x = Math.round(startX + (endX - startX) * progress);
      const y = Math.round(startY + (endY - startY) * progress);
      fillEllipse(grid, x, y, radius, radius, tile);
    }
  }
}

function pathCross(grid, tile = 'path', seed = 0) {
  const bend = seed % 2 === 0 ? 1 : -1;
  paintLine(grid, [[0, 8], [5, 8 + bend], [10, 8], [15, 9], [21, 8 - bend], [26, 9], [29, 8]], tile);
  paintLine(grid, [[14, 0], [15, 4], [14, 8], [15, 12], [14, 17]], tile);
}

function borderDepth(position, seed, salt) {
  const value = Math.sin((position + 1) * 1.73 + seed * .37 + salt) * .5 + .5;
  return value > .82 ? 3 : value > .42 ? 2 : 1;
}

function borderRoom(grid, def) {
  for (let x = 0; x < COLS; x += 1) {
    const topDepth = borderDepth(x, def.seed, 1);
    const bottomDepth = borderDepth(x, def.seed, 7);
    for (let depth = 0; depth < topDepth; depth += 1) grid[depth][x] = 'cliff';
    for (let depth = 0; depth < bottomDepth; depth += 1) grid[ROWS - 1 - depth][x] = 'cliff';
  }
  for (let y = 0; y < ROWS; y += 1) {
    const leftDepth = borderDepth(y, def.seed, 13);
    const rightDepth = borderDepth(y, def.seed, 19);
    for (let depth = 0; depth < leftDepth; depth += 1) grid[y][depth] = 'cliff';
    for (let depth = 0; depth < rightDepth; depth += 1) grid[y][COLS - 1 - depth] = 'cliff';
  }

  const exitTile = def.dark ? 'darkPath' : def.biome === 'ruins' ? 'stone' : 'path';
  if (roomAt(def.x, def.y - 1)) fillRect(grid, 13, 0, 4, 4, exitTile);
  if (roomAt(def.x, def.y + 1)) fillRect(grid, 13, ROWS - 4, 4, 4, exitTile);
  if (roomAt(def.x - 1, def.y)) fillRect(grid, 0, 7, 4, 4, exitTile);
  if (roomAt(def.x + 1, def.y)) fillRect(grid, COLS - 4, 7, 4, 4, exitTile);
}

const object = (id, type, x, y, extra = {}) => ({ id, type, x, y, ...extra });

function gardenRoom(grid) {
  fillEllipse(grid, 2, 3, 3.5, 3, 'cliff');
  fillEllipse(grid, 27, 4, 3.5, 3.5, 'cliff');
  fillEllipse(grid, 25, 16, 4, 2.6, 'cliff');
  pathCross(grid, 'path', 51);
  fillEllipse(grid, 5, 13, 4.5, 3.2, 'water');
  fillEllipse(grid, 2, 14, 2.4, 1.8, 'water');
  fillRect(grid, 4, 8, 4, 2, 'bridge');
  return [
    object('elia', 'npc', 12, 7, { name: 'Archivistin Elia', icon: 'E' }),
    object('garden-note', 'note', 18, 11, { title: 'Eine sonnengebleichte Karte', text: 'Drei Zeichen umringen die Warte: Morgenröte, Gezeiten und Dämmerung. Erst wenn alle drei im zentralen Prisma ruhen, soll der Mechanismus wieder atmen.' }),
    object('garden-checkpoint', 'checkpoint', 16, 10),
    object('garden-nectar', 'pickup', 11, 12, { item: 'nectar' }),
    ...[[7,4],[21,3],[5,6],[23,12],[19,14],[10,3]].map((p, i) => object(`garden-tree-${i}`, 'tree', ...p, { blocking: true })),
    ...[[10,4],[11,4],[19,5],[20,5],[12,11],[22,12]].map((p, i) => object(`garden-flower-${i}`, 'flower', ...p))
  ];
}

function groveRoom(grid) {
  fillEllipse(grid, 3, 3, 4.5, 3.5, 'cliff');
  fillEllipse(grid, 8, 16, 5.5, 3.4, 'cliff');
  fillEllipse(grid, 27, 4, 4, 4.5, 'cliff');
  fillEllipse(grid, 26, 16, 4.5, 3.2, 'cliff');
  pathCross(grid, 'path', 13);
  paintLine(grid, [[22, 0], [21, 4], [22, 8], [21, 13], [22, 17]], 'water', 1.7);
  fillRect(grid, 19, 8, 5, 2, 'bridge');
  return [
    object('grove-note', 'note', 7, 6, { title: 'In die Rinde geritzt', text: 'Der Kanal zeigt den Weg zum Archiv. Doch ohne die Bernsteinlinse bleibt die Lichtbrücke nur kalter Stein.' }),
    object('grove-nectar', 'pickup', 25, 12, { item: 'nectar' }),
    ...[[7,6],[10,5],[5,12],[12,13],[26,7],[24,11],[17,3],[17,14]].map((p, i) => object(`grove-tree-${i}`, 'cypress', ...p, { blocking: true })),
    ...[[13,4],[15,4],[6,11],[11,12],[26,11]].map((p, i) => object(`grove-flower-${i}`, 'flower', ...p))
  ];
}

function bridgeRoom(grid) {
  pathCross(grid, 'stone', 27);
  paintLine(grid, [[24, 0], [23, 5], [24, 9], [23, 13], [24, 17]], 'water', 2.15);
  fillRect(grid, 21, 8, 6, 2, 'bridge');
  fillEllipse(grid, 9, 3, 6, 2.7, 'stone');
  paintLine(grid, [[12, 3], [13, 6], [13, 10]], 'stone', 1.35);
  return [
    object('bridge-emitter', 'emitter', 5, 9, { direction: 'E' }),
    object('bridge-mirror', 'mirror', 13, 9, { orientation: '\\' }),
    object('bridge-receiver', 'receiver', 13, 3),
    object('bridge-gate-a', 'lightGate', 23, 8, { puzzle: 'bridge' }),
    object('bridge-gate-b', 'lightGate', 23, 9, { puzzle: 'bridge' }),
    object('bridge-chest', 'chest', 27, 8, { reward: 'sigilDawn', requires: 'bridge' }),
    object('bridge-note', 'note', 8, 12, { title: 'Tafel der Erbauer', text: 'Messing folgt der Hand. Licht folgt dem Spiegel. Die Morgenröte wartet nördlich des Strahls.' }),
    ...[[3,3],[18,3],[18,13],[8,14],[27,4],[27,14]].map((p, i) => object(`bridge-pillar-${i}`, 'pillar', ...p, { blocking: true }))
  ];
}

function archiveRoom(grid) {
  fillEllipse(grid, 15, 8, 11, 6.5, 'stone');
  fillEllipse(grid, 7, 5, 5, 3, 'stone');
  fillEllipse(grid, 23, 12, 5, 3, 'stone');
  pathCross(grid, 'mosaic', 39);
  fillRect(grid, 4, 3, 8, 1, 'wall');
  fillRect(grid, 4, 3, 1, 5, 'wall');
  fillRect(grid, 19, 13, 7, 1, 'wall');
  fillRect(grid, 25, 10, 1, 4, 'wall');
  return [
    object('archive-lens', 'chest', 23, 6, { reward: 'lens' }),
    object('archive-note', 'note', 8, 5, { title: 'Protokoll der Lichtmeisterin', text: 'Die Warte wurde nicht verlassen. Sie wurde versiegelt. Unterhalb der Insel antwortete etwas auf jeden Sonnenimpuls – erst leise, dann hungrig.' }),
    object('archive-scarab-1', 'enemy', 17, 6, { enemy: 'scarab', hp: 2, homeX: 17, homeY: 6 }),
    object('archive-scarab-2', 'enemy', 20, 11, { enemy: 'scarab', hp: 2, homeX: 20, homeY: 11 }),
    ...[[4,3],[13,3],[26,3],[4,14],[13,14],[26,14]].map((p, i) => object(`archive-pillar-${i}`, 'pillar', ...p, { blocking: true })),
    ...[[6,12],[7,12],[24,10]].map((p, i) => object(`archive-pot-${i}`, 'pot', ...p, { blocking: true }))
  ];
}

function canalRoom(grid) {
  pathCross(grid, 'path', 68);
  paintLine(grid, [[0, 4], [7, 5], [14, 4], [22, 5], [29, 4]], 'water', 1.75);
  paintLine(grid, [[0, 13], [7, 12], [15, 13], [23, 12], [29, 13]], 'water', 1.75);
  fillRect(grid, 14, 2, 2, 14, 'bridge');
  paintLine(grid, [[0, 8], [8, 9], [15, 8], [22, 9], [29, 8]], 'stone', 1.1);
  return [
    object('canal-note', 'note', 9, 7, { title: 'Die drei Wege', text: 'Im Westen singt der Hain. Im Norden wartet das Licht. Im Osten schläft die Laterne. Jeder Weg führt zur Warte – aber keiner allein.' }),
    object('canal-checkpoint', 'checkpoint', 17, 10),
    object('canal-scarab', 'enemy', 22, 8, { enemy: 'scarab', hp: 2, homeX: 22, homeY: 8 }),
    ...[[4,7],[4,10],[25,7],[25,10],[11,7],[19,10]].map((p, i) => object(`canal-reed-${i}`, 'reeds', ...p))
  ];
}

function watchRoom(grid) {
  fillEllipse(grid, 16, 8, 11, 6.5, 'stone');
  fillEllipse(grid, 24, 5, 5, 4, 'mosaic');
  pathCross(grid, 'path', 74);
  fillRect(grid, 20, 2, 7, 1, 'wall');
  fillRect(grid, 26, 2, 1, 6, 'wall');
  fillRect(grid, 20, 7, 4, 1, 'wall');
  return [
    object('watch-lantern', 'chest', 24, 5, { reward: 'lantern' }),
    object('watch-note', 'note', 7, 12, { title: 'Wachbuch, letzter Eintrag', text: 'Das Gewölbe reagiert auf lebendiges Feuer. Drei Becken, drei Flammen. Die Laterne muss zur ersten getragen werden.' }),
    object('watch-sentinel', 'enemy', 17, 8, { enemy: 'sentinel', hp: 3, homeX: 17, homeY: 8 }),
    object('watch-scarab', 'enemy', 9, 6, { enemy: 'scarab', hp: 2, homeX: 9, homeY: 6 }),
    ...[[4,4],[12,3],[26,12],[21,13]].map((p, i) => object(`watch-pillar-${i}`, 'pillar', ...p, { blocking: true }))
  ];
}

function aqueductRoom(grid) {
  fillEllipse(grid, 7, 4, 7, 3.2, 'water');
  fillEllipse(grid, 23, 13, 7, 3.4, 'water');
  paintLine(grid, [[0, 9], [8, 8], [16, 9], [23, 8], [29, 9]], 'stone', 1.15);
  paintLine(grid, [[15, 0], [14, 5], [15, 10], [14, 17]], 'stone', 1.15);
  fillEllipse(grid, 7, 5, 4, 1.6, 'stone');
  fillEllipse(grid, 24, 12, 3.5, 2, 'stone');
  return [
    object('aqueduct-crate', 'crate', 8, 8, { blocking: true }),
    object('aqueduct-plate', 'plate', 17, 8),
    object('aqueduct-gate-a', 'waterGate', 20, 8, { puzzle: 'aqueduct' }),
    object('aqueduct-gate-b', 'waterGate', 20, 9, { puzzle: 'aqueduct' }),
    object('aqueduct-chest', 'chest', 25, 8, { reward: 'sigilTide', requires: 'aqueduct' }),
    object('aqueduct-note', 'note', 6, 6, { title: 'Wasserstand: kritisch', text: 'Das Gegengewicht rastet auf der Sonnenplatte ein. Danach gibt das Ostschott den Weg zur Gezeitenkapsel frei.' }),
    ...[[4,12],[7,13],[24,5],[27,4]].map((p, i) => object(`aqueduct-reed-${i}`, 'reeds', ...p))
  ];
}

function vaultRoom(grid) {
  fillRect(grid, 1, 1, COLS - 2, ROWS - 2, 'darkStone');
  pathCross(grid, 'darkPath', 97);
  fillRect(grid, 5, 4, 1, 9, 'wall');
  fillRect(grid, 23, 4, 1, 9, 'wall');
  fillRect(grid, 10, 3, 10, 1, 'wall');
  return [
    object('vault-brazier-1', 'brazier', 8, 8, { lit: false }),
    object('vault-brazier-2', 'brazier', 15, 6, { lit: false }),
    object('vault-brazier-3', 'brazier', 21, 10, { lit: false }),
    object('vault-chest', 'chest', 15, 13, { reward: 'sigilDusk', requires: 'vault' }),
    object('vault-note', 'note', 8, 13, { title: 'Eine Stimme im Stein', text: 'Du hörst kein Flüstern. Du erinnerst dich nur plötzlich an eines: „Licht ist eine Tür. Jede Tür kann von zwei Seiten geöffnet werden.“' }),
    object('vault-shadow-1', 'enemy', 11, 11, { enemy: 'shadow', hp: 2, homeX: 11, homeY: 11 }),
    object('vault-shadow-2', 'enemy', 19, 5, { enemy: 'shadow', hp: 2, homeX: 19, homeY: 5 })
  ];
}

function observatoryRoom(grid) {
  pathCross(grid, 'stone', 111);
  fillEllipse(grid, 15, 8, 8, 6, 'mosaic');
  fillEllipse(grid, 15, 8, 5, 4, 'sunstone');
  return [
    object('observatory-altar', 'altar', 15, 7, { blocking: true }),
    object('observatory-note', 'note', 8, 13, { title: 'Widmung der Erbauer', text: 'Nicht um die Sonne zu beherrschen, sondern um ihr Licht dorthin zu tragen, wo keines hinfällt.' }),
    ...[[8,4],[22,4],[8,12],[22,12]].map((p, i) => object(`observatory-pillar-${i}`, 'sunPillar', ...p, { blocking: true }))
  ];
}

const builders = {
  garden: gardenRoom,
  grove: groveRoom,
  bridge: bridgeRoom,
  archive: archiveRoom,
  canal: canalRoom,
  watch: watchRoom,
  aqueduct: aqueductRoom,
  vault: vaultRoom,
  observatory: observatoryRoom
};

export function createWorld() {
  const rooms = {};
  for (const def of ROOM_DEFS) {
    const grid = makeGrid(def.base);
    const objects = builders[def.id](grid);
    borderRoom(grid, def);
    rooms[def.id] = { ...def, grid, objects, solved: false };
  }
  return rooms;
}

export function findObject(room, id) {
  return room.objects.find((entry) => entry.id === id);
}

export function isAqueductSolved(room) {
  const crate = findObject(room, 'aqueduct-crate');
  const plate = findObject(room, 'aqueduct-plate');
  return Boolean(crate && plate && crate.x === plate.x && crate.y === plate.y);
}

const reflect = {
  '/': { N: 'E', E: 'N', S: 'W', W: 'S' },
  '\\': { N: 'W', W: 'N', S: 'E', E: 'S' }
};
const delta = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export function traceBeam(room) {
  const emitter = room.objects.find((entry) => entry.type === 'emitter');
  if (!emitter) return { path: [], powered: false };
  let direction = emitter.direction;
  let x = emitter.x;
  let y = emitter.y;
  const path = [];
  const seen = new Set();

  for (let step = 0; step < 120; step += 1) {
    const [dx, dy] = delta[direction];
    x += dx;
    y += dy;
    const key = `${x},${y},${direction}`;
    if (seen.has(key) || x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
    seen.add(key);
    path.push({ x, y, direction });
    const hit = room.objects.find((entry) => !entry.collected && entry.x === x && entry.y === y);
    if (hit?.type === 'receiver') return { path, powered: true };
    if (hit?.type === 'mirror') direction = reflect[hit.orientation][direction];
    else if (hit?.blocking || ['cliff', 'wall'].includes(room.grid[y][x])) break;
  }
  return { path, powered: false };
}

export function puzzleSolved(room, puzzle) {
  if (puzzle === 'bridge') return traceBeam(room).powered;
  if (puzzle === 'aqueduct') return isAqueductSolved(room);
  if (puzzle === 'vault') return room.objects.filter((entry) => entry.type === 'brazier').every((entry) => entry.lit);
  return true;
}

export function defaultSaveState() {
  return {
    version: 2,
    roomId: 'garden',
    player: { x: 15, y: 9, facing: 'down', hp: 5, maxHp: 5 },
    checkpoint: { roomId: 'garden', x: 16, y: 11 },
    score: 0,
    inventory: [],
    visited: ['garden'],
    journal: [{ title: 'Ankunft im Sonnengarten', text: 'Elia wartet bei den alten Beeten. Sie weiß, warum die Sonnenwarte verstummt ist.' }],
    objectState: {},
    won: false
  };
}
