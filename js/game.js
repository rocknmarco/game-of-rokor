/* global Phaser */
const GAME_WIDTH = 320;
const GAME_HEIGHT = 200;
const TILE_SIZE = 32;

const TILE = {
  GRASS: 0,
  WALL: 1,
  WATER: 2,
  SAND: 3,
  HOLE: 4,
  BUSH: 5,
  SPIKES: 6,
  FLOOR: 7,
  EXIT: 8,
  DOOR: 9
};

const GameState = {
  inventory: ["shovel"],
  selectedIndex: 0,
  health: 3,
  maxHealth: 3,
  raftActive: false,
  flags: {
    doorUnlocked: false,
    sandDug: false
  },
  message: "Suche im Sand nach Geheimnissen."
};

const gameEvents = new Phaser.Events.EventEmitter();

const overworldMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 3, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 9, 0, 1, 2, 2, 0, 1],
  [1, 0, 0, 5, 5, 0, 0, 0, 1, 1, 1, 1, 2, 2, 0, 1],
  [1, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 3, 0, 0, 0, 6, 0, 0, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

const interiorMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 7, 7, 7, 7, 7, 7, 7, 7, 1],
  [1, 7, 7, 7, 7, 7, 7, 7, 7, 1],
  [1, 7, 7, 7, 7, 7, 7, 7, 7, 1],
  [1, 7, 7, 7, 7, 7, 7, 7, 7, 1],
  [1, 7, 7, 7, 7, 7, 7, 7, 7, 1],
  [1, 7, 7, 7, 7, 7, 7, 7, 8, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

const tileTextures = {
  [TILE.GRASS]: "tile_grass",
  [TILE.WALL]: "tile_wall",
  [TILE.WATER]: "tile_water",
  [TILE.SAND]: "tile_sand",
  [TILE.HOLE]: "tile_hole",
  [TILE.BUSH]: "tile_bush",
  [TILE.SPIKES]: "tile_spikes",
  [TILE.FLOOR]: "tile_floor",
  [TILE.EXIT]: "tile_exit",
  [TILE.DOOR]: "tile_door"
};

function createAudio() {
  if (createAudio.context) return createAudio.context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  createAudio.context = new AudioContext();
  return createAudio.context;
}

function playBeep(freq = 440, duration = 0.08, volume = 0.05) {
  const context = createAudio();
  if (context.state === "suspended") {
    context.resume();
  }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = freq;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function generateTextureData(drawFn) {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  drawFn(ctx);
  return canvas.toDataURL();
}

function drawChecker(ctx, colorA, colorB, size = 4) {
  for (let y = 0; y < TILE_SIZE; y += size) {
    for (let x = 0; x < TILE_SIZE; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x, y, size, size);
    }
  }
}

function createTextures(scene) {
  if (scene.textures.exists("tile_grass")) return;

  scene.textures.addBase64(
    "tile_grass",
    generateTextureData((ctx) => {
      drawChecker(ctx, "#1aa043", "#0b6b2c", 4);
      ctx.fillStyle = "#2fe85a";
      ctx.fillRect(0, 0, TILE_SIZE, 2);
    })
  );

  scene.textures.addBase64(
    "tile_sand",
    generateTextureData((ctx) => {
      drawChecker(ctx, "#d7b14a", "#b98c2e", 4);
      ctx.fillStyle = "#f6da7b";
      ctx.fillRect(0, 0, TILE_SIZE, 2);
    })
  );

  scene.textures.addBase64(
    "tile_water",
    generateTextureData((ctx) => {
      drawChecker(ctx, "#1b4bd6", "#0a2a8a", 4);
      ctx.fillStyle = "#57b7ff";
      ctx.fillRect(0, 0, TILE_SIZE, 2);
      ctx.fillRect(0, TILE_SIZE - 2, TILE_SIZE, 2);
    })
  );

  scene.textures.addBase64(
    "tile_wall",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#4a0b0b";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#b12d2d";
      for (let y = 2; y < TILE_SIZE; y += 8) {
        for (let x = (y / 8) % 2 === 0 ? 2 : 6; x < TILE_SIZE; x += 8) {
          ctx.fillRect(x, y, 6, 3);
        }
      }
    })
  );

  scene.textures.addBase64(
    "tile_hole",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#3a1d0a";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#1b0c06";
      ctx.fillRect(6, 6, TILE_SIZE - 12, TILE_SIZE - 12);
    })
  );

  scene.textures.addBase64(
    "tile_bush",
    generateTextureData((ctx) => {
      drawChecker(ctx, "#0f7b2d", "#0a4b1a", 4);
      ctx.fillStyle = "#3cff6e";
      ctx.fillRect(6, 6, 6, 6);
      ctx.fillRect(18, 10, 6, 6);
    })
  );

  scene.textures.addBase64(
    "tile_spikes",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#3b3b3b";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#b9b9b9";
      for (let x = 0; x < TILE_SIZE; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, TILE_SIZE);
        ctx.lineTo(x + 3, 6);
        ctx.lineTo(x + 6, TILE_SIZE);
        ctx.fill();
      }
    })
  );

  scene.textures.addBase64(
    "tile_floor",
    generateTextureData((ctx) => {
      drawChecker(ctx, "#3b3b3b", "#1d1d1d", 4);
      ctx.fillStyle = "#555";
      ctx.fillRect(0, 0, TILE_SIZE, 2);
    })
  );

  scene.textures.addBase64(
    "tile_exit",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#1d1d1d";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#ffde59";
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
    })
  );

  scene.textures.addBase64(
    "tile_door",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#7c1fb8";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#ffde59";
      ctx.fillRect(TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 2, 4, 4);
    })
  );

  scene.textures.addBase64(
    "player",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#9efcff";
      ctx.fillRect(8, 6, 16, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 10, 4, 4);
      ctx.fillRect(18, 10, 4, 4);
      ctx.fillStyle = "#ff4dff";
      ctx.fillRect(12, 18, 8, 4);
    })
  );

  scene.textures.addBase64(
    "enemy_bot",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#ff3c3c";
      ctx.fillRect(6, 6, 20, 20);
      ctx.fillStyle = "#fff";
      ctx.fillRect(10, 10, 4, 4);
      ctx.fillRect(18, 10, 4, 4);
    })
  );

  scene.textures.addBase64(
    "item_shovel",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#7c4a1d";
      ctx.fillRect(14, 6, 4, 16);
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(10, 20, 12, 6);
    })
  );

  scene.textures.addBase64(
    "item_key_blue",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#3cc0ff";
      ctx.fillRect(6, 14, 8, 6);
      ctx.fillRect(14, 14, 10, 4);
      ctx.fillRect(22, 18, 2, 4);
    })
  );

  scene.textures.addBase64(
    "item_raft",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#b47d3c";
      ctx.fillRect(6, 16, 20, 8);
      ctx.fillStyle = "#7c4a1d";
      ctx.fillRect(8, 12, 4, 4);
      ctx.fillRect(20, 12, 4, 4);
    })
  );

  scene.textures.addBase64(
    "item_machete",
    generateTextureData((ctx) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#7c4a1d";
      ctx.fillRect(8, 18, 6, 4);
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(12, 10, 14, 4);
    })
  );
}

function getSelectedItem() {
  return GameState.inventory[GameState.selectedIndex] || null;
}

function setMessage(text) {
  GameState.message = text;
  gameEvents.emit("message");
}

class SceneOverworld extends Phaser.Scene {
  constructor() {
    super("Overworld");
    this.mapData = overworldMap.map((row) => row.slice());
    this.tileSprites = [];
    this.items = [];
    this.player = null;
    this.bot = null;
    this.lastDir = { x: 0, y: 1 };
    this.damageCooldown = false;
  }

  create(data) {
    createTextures(this);
    if (!this.scene.isActive("UI")) {
      this.scene.launch("UI");
    }

    this.createMap();
    const entry = data && data.entry ? data.entry : { x: 2, y: 9 };
    this.player = this.add.image(entry.x * TILE_SIZE + 16, entry.y * TILE_SIZE + 16, "player");
    this.player.setDepth(2);

    this.spawnItem("machete", 6, 5);

    this.bot = this.add.image(TILE_SIZE * 10 + 16, TILE_SIZE * 6 + 16, "enemy_bot");
    this.bot.setDepth(2);
    this.botDir = 1;

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const nextX = this.bot.x + this.botDir * TILE_SIZE;
        const gridX = Math.round(nextX / TILE_SIZE - 0.5);
        const gridY = Math.round(this.bot.y / TILE_SIZE - 0.5);
        if (this.isWalkable(gridX, gridY, true)) {
          this.bot.x = nextX;
        } else {
          this.botDir *= -1;
        }
        this.checkBotCollision();
      }
    });

    this.input.keyboard.on("keydown", (event) => this.handleInput(event));

    this.cameras.main.setBounds(0, 0, this.mapData[0].length * TILE_SIZE, this.mapData.length * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.cameras.main.roundPixels = true;

    setMessage("Nutze die Schaufel im Sand. Blaues Schloss im Norden.");
  }

  createMap() {
    for (let y = 0; y < this.mapData.length; y += 1) {
      this.tileSprites[y] = [];
      for (let x = 0; x < this.mapData[y].length; x += 1) {
        const tile = this.mapData[y][x];
        const sprite = this.add.image(x * TILE_SIZE + 16, y * TILE_SIZE + 16, tileTextures[tile]);
        sprite.setDepth(0);
        this.tileSprites[y][x] = sprite;
      }
    }
  }

  spawnItem(type, x, y) {
    const texture = `item_${type}`;
    const sprite = this.add.image(x * TILE_SIZE + 16, y * TILE_SIZE + 16, texture);
    sprite.setDepth(1);
    this.items.push({ type, x, y, sprite });
  }

  handleInput(event) {
    switch (event.key) {
      case "ArrowUp":
        this.lastDir = { x: 0, y: -1 };
        this.attemptMove(0, -1);
        break;
      case "ArrowDown":
        this.lastDir = { x: 0, y: 1 };
        this.attemptMove(0, 1);
        break;
      case "ArrowLeft":
        this.lastDir = { x: -1, y: 0 };
        this.attemptMove(-1, 0);
        break;
      case "ArrowRight":
        this.lastDir = { x: 1, y: 0 };
        this.attemptMove(1, 0);
        break;
      case " ":
      case "Enter":
        this.handleAction();
        break;
      case "q":
      case "Q":
        this.cycleItem(-1);
        break;
      case "e":
      case "E":
        this.cycleItem(1);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        this.selectItem(Number(event.key) - 1);
        break;
      default:
        break;
    }
  }

  cycleItem(direction) {
    if (!GameState.inventory.length) return;
    GameState.selectedIndex = (GameState.selectedIndex + direction + GameState.inventory.length) % GameState.inventory.length;
    gameEvents.emit("inventoryChanged");
  }

  selectItem(index) {
    if (index < GameState.inventory.length) {
      GameState.selectedIndex = index;
      gameEvents.emit("inventoryChanged");
    }
  }

  attemptMove(dx, dy) {
    const targetX = Math.round(this.player.x / TILE_SIZE - 0.5) + dx;
    const targetY = Math.round(this.player.y / TILE_SIZE - 0.5) + dy;
    if (!this.isWalkable(targetX, targetY)) return;

    this.player.x += dx * TILE_SIZE;
    this.player.y += dy * TILE_SIZE;
    playBeep(420, 0.05, 0.04);
    this.checkPickup();
    this.checkHazard();
    this.checkDoorTransition();
  }

  isWalkable(x, y, ignoreWater = false) {
    const tile = this.mapData[y] && this.mapData[y][x];
    if (tile === undefined) return false;
    if (tile === TILE.WALL || tile === TILE.BUSH) return false;
    if (tile === TILE.DOOR && !GameState.flags.doorUnlocked) return false;
    if (tile === TILE.WATER && !ignoreWater) {
      return GameState.raftActive && getSelectedItem() === "raft";
    }
    return true;
  }

  handleAction() {
    const selected = getSelectedItem();
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);

    if (selected === "shovel") {
      const tile = this.mapData[playerY][playerX];
      if (tile === TILE.SAND) {
        this.mapData[playerY][playerX] = TILE.HOLE;
        this.tileSprites[playerY][playerX].setTexture(tileTextures[TILE.HOLE]);
        if (!GameState.flags.sandDug) {
          GameState.flags.sandDug = true;
          this.spawnItem("key_blue", playerX, playerY);
          setMessage("Du hast einen blauen Schlüssel gefunden!");
        } else {
          setMessage("Der Sand ist schon umgegraben.");
        }
        playBeep(240, 0.12, 0.06);
        return;
      }
    }

    if (selected === "key_blue") {
      const targetX = playerX + this.lastDir.x;
      const targetY = playerY + this.lastDir.y;
      const tile = this.mapData[targetY] && this.mapData[targetY][targetX];
      if (tile === TILE.DOOR) {
        GameState.flags.doorUnlocked = true;
        this.mapData[targetY][targetX] = TILE.GRASS;
        this.tileSprites[targetY][targetX].setTexture(tileTextures[TILE.GRASS]);
        GameState.inventory = GameState.inventory.filter((item) => item !== "key_blue");
        GameState.selectedIndex = Math.max(0, Math.min(GameState.selectedIndex, GameState.inventory.length - 1));
        gameEvents.emit("inventoryChanged");
        setMessage("Das Schloss klickt. Die Tür ist offen.");
        playBeep(520, 0.08, 0.05);
        return;
      }
    }

    if (selected === "machete") {
      const targetX = playerX + this.lastDir.x;
      const targetY = playerY + this.lastDir.y;
      const tile = this.mapData[targetY] && this.mapData[targetY][targetX];
      if (tile === TILE.BUSH) {
        this.mapData[targetY][targetX] = TILE.GRASS;
        this.tileSprites[targetY][targetX].setTexture(tileTextures[TILE.GRASS]);
        setMessage("Du schlägst dich durch das Dickicht.");
        playBeep(300, 0.06, 0.05);
        return;
      }
    }

    if (selected === "raft") {
      GameState.raftActive = !GameState.raftActive;
      setMessage(GameState.raftActive ? "Du setzt das Floß ein." : "Du packst das Floß weg.");
      playBeep(180, 0.06, 0.04);
      return;
    }

    setMessage("Nichts passiert...");
  }

  checkPickup() {
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);
    const itemIndex = this.items.findIndex((item) => item.x === playerX && item.y === playerY);
    if (itemIndex >= 0) {
      const item = this.items.splice(itemIndex, 1)[0];
      item.sprite.destroy();
      GameState.inventory.push(item.type);
      GameState.selectedIndex = GameState.inventory.length - 1;
      gameEvents.emit("inventoryChanged");
      setMessage(`Du hast ${item.type} aufgenommen.`);
      playBeep(640, 0.08, 0.05);
    }
  }

  checkHazard() {
    if (this.damageCooldown) return;
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);
    if (this.mapData[playerY][playerX] === TILE.SPIKES) {
      this.applyDamage("Autsch! Stacheln.");
    }
  }

  checkBotCollision() {
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);
    const botX = Math.round(this.bot.x / TILE_SIZE - 0.5);
    const botY = Math.round(this.bot.y / TILE_SIZE - 0.5);
    if (playerX === botX && playerY === botY) {
      this.applyDamage("Patrouillen-Bot trifft dich!");
    }
  }

  applyDamage(message) {
    if (this.damageCooldown) return;
    GameState.health = Math.max(0, GameState.health - 1);
    gameEvents.emit("healthChanged");
    setMessage(message);
    playBeep(120, 0.1, 0.08);
    this.damageCooldown = true;
    this.time.delayedCall(600, () => {
      this.damageCooldown = false;
    });
  }

  checkDoorTransition() {
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);
    if (playerX === 9 && playerY === 3 && GameState.flags.doorUnlocked) {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("Interior", { entry: { x: 8, y: 6 } });
      });
    }
  }
}

class SceneInterior extends Phaser.Scene {
  constructor() {
    super("Interior");
    this.mapData = interiorMap.map((row) => row.slice());
    this.tileSprites = [];
    this.items = [];
    this.player = null;
    this.darkness = null;
  }

  create(data) {
    createTextures(this);
    if (!this.scene.isActive("UI")) {
      this.scene.launch("UI");
    }

    this.createMap();
    const entry = data.entry || { x: 8, y: 6 };
    this.player = this.add.image(entry.x * TILE_SIZE + 16, entry.y * TILE_SIZE + 16, "player");
    this.player.setDepth(2);

    this.spawnItem("raft", 4, 3);

    this.input.keyboard.on("keydown", (event) => this.handleInput(event));

    this.cameras.main.setBounds(0, 0, this.mapData[0].length * TILE_SIZE, this.mapData.length * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.cameras.main.roundPixels = true;

    this.createDarkness();
    setMessage("Der Raum ist dunkel... Finde das Floß.");
  }

  createMap() {
    for (let y = 0; y < this.mapData.length; y += 1) {
      this.tileSprites[y] = [];
      for (let x = 0; x < this.mapData[y].length; x += 1) {
        const tile = this.mapData[y][x];
        const sprite = this.add.image(x * TILE_SIZE + 16, y * TILE_SIZE + 16, tileTextures[tile]);
        sprite.setDepth(0);
        this.tileSprites[y][x] = sprite;
      }
    }
  }

  createDarkness() {
    this.darkness = this.add.graphics();
    this.darkness.fillStyle(0x000000, 0.75);
    this.darkness.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.darkness.setScrollFactor(0);
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  update() {
    if (!this.darkness) return;
    this.darkness.clear();
    this.darkness.fillStyle(0x000000, 0.75);
    this.darkness.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const screenX = this.player.x - this.cameras.main.scrollX;
    const screenY = this.player.y - this.cameras.main.scrollY;
    this.darkness.fillStyle(0x000000, 0.0);
    this.darkness.fillCircle(screenX, screenY, 70);
  }

  spawnItem(type, x, y) {
    const texture = `item_${type}`;
    const sprite = this.add.image(x * TILE_SIZE + 16, y * TILE_SIZE + 16, texture);
    sprite.setDepth(1);
    this.items.push({ type, x, y, sprite });
  }

  handleInput(event) {
    switch (event.key) {
      case "ArrowUp":
        this.attemptMove(0, -1);
        break;
      case "ArrowDown":
        this.attemptMove(0, 1);
        break;
      case "ArrowLeft":
        this.attemptMove(-1, 0);
        break;
      case "ArrowRight":
        this.attemptMove(1, 0);
        break;
      case " ":
      case "Enter":
        this.handleAction();
        break;
      case "q":
      case "Q":
        this.cycleItem(-1);
        break;
      case "e":
      case "E":
        this.cycleItem(1);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        this.selectItem(Number(event.key) - 1);
        break;
      default:
        break;
    }
  }

  cycleItem(direction) {
    if (!GameState.inventory.length) return;
    GameState.selectedIndex = (GameState.selectedIndex + direction + GameState.inventory.length) % GameState.inventory.length;
    gameEvents.emit("inventoryChanged");
  }

  selectItem(index) {
    if (index < GameState.inventory.length) {
      GameState.selectedIndex = index;
      gameEvents.emit("inventoryChanged");
    }
  }

  attemptMove(dx, dy) {
    const targetX = Math.round(this.player.x / TILE_SIZE - 0.5) + dx;
    const targetY = Math.round(this.player.y / TILE_SIZE - 0.5) + dy;
    const tile = this.mapData[targetY] && this.mapData[targetY][targetX];
    if (tile === undefined || tile === TILE.WALL) return;
    this.player.x += dx * TILE_SIZE;
    this.player.y += dy * TILE_SIZE;
    playBeep(380, 0.05, 0.04);
    this.checkPickup();
    this.checkExit();
  }

  handleAction() {
    if (getSelectedItem() === "raft") {
      GameState.raftActive = !GameState.raftActive;
      setMessage(GameState.raftActive ? "Du hältst das Floß bereit." : "Du verstaust das Floß.");
      playBeep(180, 0.06, 0.04);
    }
  }

  checkPickup() {
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);
    const itemIndex = this.items.findIndex((item) => item.x === playerX && item.y === playerY);
    if (itemIndex >= 0) {
      const item = this.items.splice(itemIndex, 1)[0];
      item.sprite.destroy();
      GameState.inventory.push(item.type);
      GameState.selectedIndex = GameState.inventory.length - 1;
      gameEvents.emit("inventoryChanged");
      setMessage(`Du hast ${item.type} aufgenommen.`);
      playBeep(640, 0.08, 0.05);
    }
  }

  checkExit() {
    const playerX = Math.round(this.player.x / TILE_SIZE - 0.5);
    const playerY = Math.round(this.player.y / TILE_SIZE - 0.5);
    if (this.mapData[playerY][playerX] === TILE.EXIT) {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("Overworld", { entry: { x: 9, y: 4 } });
      });
    }
  }
}

class SceneUI extends Phaser.Scene {
  constructor() {
    super({ key: "UI", active: false });
    this.container = null;
    this.messageText = null;
  }

  create() {
    this.container = this.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.messageText = this.add.text(8, 4, "", {
      fontFamily: "Courier New",
      fontSize: "10px",
      color: "#ffffff"
    });
    this.container.add(this.messageText);

    gameEvents.on("inventoryChanged", () => this.render());
    gameEvents.on("healthChanged", () => this.render());
    gameEvents.on("message", () => this.render());

    this.render();
  }

  render() {
    this.container.removeAll(true);

    const bar = this.add.rectangle(0, 0, GAME_WIDTH, 28, 0x111111).setOrigin(0, 0);
    this.container.add(bar);

    const healthText = this.add.text(8, 6, `Leben ${GameState.health}/${GameState.maxHealth}`, {
      fontFamily: "Courier New",
      fontSize: "10px",
      color: "#ffde59"
    });
    this.container.add(healthText);

    const itemLabel = this.add.text(110, 6, "Rucksack:", {
      fontFamily: "Courier New",
      fontSize: "10px",
      color: "#ffffff"
    });
    this.container.add(itemLabel);

    GameState.inventory.forEach((item, index) => {
      const icon = this.add.image(170 + index * 22, 14, `item_${item}`);
      icon.setScale(0.5);
      this.container.add(icon);
      if (index === GameState.selectedIndex) {
        const highlight = this.add.rectangle(170 + index * 22, 14, 20, 20);
        highlight.setStrokeStyle(1, 0x57b7ff);
        highlight.setFillStyle(0x000000, 0);
        this.container.add(highlight);
      }
    });

    const activeItem = getSelectedItem();
    const itemText = this.add.text(8, 40, `Aktiv: ${activeItem || "-"} ${GameState.raftActive ? "(Floß bereit)" : ""}`, {
      fontFamily: "Courier New",
      fontSize: "10px",
      color: "#9efcff"
    });
    this.container.add(itemText);

    const messageText = this.add.text(8, 56, GameState.message, {
      fontFamily: "Courier New",
      fontSize: "10px",
      color: "#ffffff",
      wordWrap: { width: GAME_WIDTH - 16 }
    });
    this.container.add(messageText);

    this.container.setDepth(10);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "gameContainer",
  pixelArt: true,
  backgroundColor: "#000000",
  scene: [SceneOverworld, SceneInterior, SceneUI],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
