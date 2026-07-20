import { loadToborGame } from './game-loader.js';
import { SPEED_PRESETS, ToborEngine } from './engine.js';
import { ToborRenderer } from './renderer.js';
import { spriteFor } from './object-registry.js';

const keyDirections = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export class ToborApp {
  constructor() {
    this.elements = {};
    this.gameData = null;
    this.engine = null;
    this.renderer = null;
    this.running = false;
    this.lastFrame = 0;
    this.dialogWasPaused = false;
    this.mapLevel = 0;
    this.toastTimer = 0;
    this.bannerTimer = 0;
    this.pressedCodes = new Map();
    this.inspectMode = false;
    this.inspectX = 0;
    this.inspectY = 0;
  }

  async mount() {
    const ids = [
      'title-screen', 'game-shell', 'new-game', 'continue-game', 'menu-button', 'game-canvas',
      'movement-speed-title', 'movement-speed-game', 'loading-line', 'loading-progress', 'loading-text',
      'room-level', 'room-name', 'lives', 'gold', 'diamonds', 'points', 'ring-progress',
      'inventory', 'inventory-large', 'inventory-count', 'inventory-overlay', 'inventory-close',
      'pack-button', 'mini-map', 'map-count', 'map-button', 'map-overlay', 'map-close', 'world-map',
      'level-tabs', 'room-coordinates', 'room-banner', 'banner-level', 'banner-name', 'toast',
      'dialog-backdrop', 'dialog-title', 'dialog-text', 'dialog-close',
      'inspect-overlay', 'inspect-cursor', 'inspect-hint',
    ];
    for (const id of ids) this.elements[id] = document.getElementById(id);
    this.bindControls();

    try {
      this.gameData = await loadToborGame('/games/insel-der-ruinen/game.json', (message, progress) => {
        this.elements['loading-text'].textContent = message;
        this.elements['loading-progress'].style.width = `${Math.round(progress * 100)}%`;
      });
      document.documentElement.style.setProperty('--inventory-tileset', `url("${this.gameData.assets.tilesetUrl}")`);
      this.engine = new ToborEngine(this.gameData, (event) => this.onEngineEvent(event));
      this.renderer = new ToborRenderer(this.elements['game-canvas'], this.gameData);
      this.syncSpeedControls();
      this.elements['new-game'].disabled = false;
      this.elements['continue-game'].disabled = !this.engine.hasSave();
      this.elements['loading-text'].textContent = `${this.gameData.rooms.size} Räume · bereit für die Expedition`;
      this.elements['loading-line'].classList.add('is-ready');
    } catch (error) {
      this.elements['loading-text'].textContent = error.message;
      this.elements['loading-line'].classList.add('has-error');
      console.error(error);
    }
    requestAnimationFrame((time) => this.loop(time));
  }

  bindControls() {
    this.elements['new-game'].addEventListener('click', () => this.start(false));
    this.elements['continue-game'].addEventListener('click', () => this.start(true));
    this.elements['menu-button'].addEventListener('click', () => this.returnToTitle());
    this.elements['dialog-close'].addEventListener('click', () => this.closeDialog());
    this.elements['inventory-close'].addEventListener('click', () => this.toggleInventory(false));
    this.elements['pack-button'].addEventListener('click', () => this.toggleInventory(true));
    this.elements['map-button'].addEventListener('click', () => this.toggleMap(true));
    this.elements['map-close'].addEventListener('click', () => this.toggleMap(false));
    for (const id of ['movement-speed-title', 'movement-speed-game']) {
      this.elements[id].addEventListener('change', (event) => {
        this.engine?.setSpeedPreset(event.target.value);
        this.syncSpeedControls();
      });
    }

    window.addEventListener('keydown', (event) => this.onKeyDown(event), true);
    window.addEventListener('keyup', (event) => this.onKeyUp(event), true);
    window.addEventListener('blur', () => this.clearInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearInput();
    });

    document.querySelectorAll('[data-move]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        this.engine?.pressDirection(button.dataset.move);
      });
      const release = (event) => {
        event.preventDefault();
        this.engine?.releaseDirection(button.dataset.move);
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
    this.elements['inspect-overlay'].addEventListener('pointermove', (event) => this.moveInspectFromPointer(event));
    this.elements['inspect-overlay'].addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.moveInspectFromPointer(event);
      this.inspectSelection();
    });
  }

  start(continueGame) {
    if (!this.engine) return;
    if (!continueGame || !this.engine.load()) this.engine.newGame();
    this.running = true;
    this.elements['title-screen'].hidden = true;
    this.elements['game-shell'].hidden = false;
    this.updateUI();
  }

  returnToTitle() {
    if (!this.engine) return;
    this.engine.save();
    this.engine.clearInput();
    this.running = false;
    this.elements['game-shell'].hidden = true;
    this.elements['title-screen'].hidden = false;
    this.elements['continue-game'].disabled = !this.engine.hasSave();
    this.closeAllOverlays();
  }

  loop(time) {
    const deltaSeconds = Math.min(0.04, Math.max(0, (time - this.lastFrame) / 1000 || 0.016));
    this.lastFrame = time;
    if (this.running && this.engine && this.renderer) {
      this.engine.update(deltaSeconds);
      this.renderer.render(this.engine, deltaSeconds);
    }
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  onKeyDown(event) {
    if (!this.running || !this.engine) return;
    if (this.inspectMode) {
      event.preventDefault();
      if (event.repeat) return;
      const direction = keyDirections[event.code];
      if (direction) {
        const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [dx, dy] = vectors[direction];
        this.inspectX = Math.max(0, Math.min(39, this.inspectX + dx));
        this.inspectY = Math.max(0, Math.min(27, this.inspectY + dy));
        this.updateInspectCursor();
      } else if (event.code === 'Enter' || event.code === 'Space') this.inspectSelection();
      else if (event.code === 'Escape') this.stopInspectMode();
      return;
    }
    const direction = keyDirections[event.code];
    if (direction) {
      event.preventDefault();
      if (this.pressedCodes.has(event.code)) return;
      this.pressedCodes.set(event.code, direction);
      this.engine.pressDirection(direction);
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE' || event.code === 'Enter') {
      event.preventDefault();
      this.toggleInventory(this.elements['inventory-overlay'].hidden);
    } else if (event.code === 'KeyM') {
      event.preventDefault();
      this.toggleMap(this.elements['map-overlay'].hidden);
    } else if (event.code === 'Escape') {
      event.preventDefault();
      if (!this.elements['dialog-backdrop'].hidden) this.closeDialog();
      else if (!this.elements['inventory-overlay'].hidden) this.toggleInventory(false);
      else if (!this.elements['map-overlay'].hidden) this.toggleMap(false);
      else this.returnToTitle();
    }
  }

  onKeyUp(event) {
    const direction = this.pressedCodes.get(event.code);
    if (!direction) return;
    event.preventDefault();
    this.pressedCodes.delete(event.code);
    if (![...this.pressedCodes.values()].includes(direction)) this.engine?.releaseDirection(direction);
  }

  clearInput() {
    this.pressedCodes.clear();
    this.engine?.clearInput();
  }

  onEngineEvent(event) {
    if (event.type === 'room') this.showRoomBanner(event.room, event.name);
    if (event.type === 'status') this.showToast(event.message);
    if (event.type === 'inspect') this.startInspectMode();
    if (event.type === 'message' || event.type === 'win' || event.type === 'lose') {
      this.openDialog(event.title, event.text);
    }
    if (event.type === 'state' || event.type === 'room' || event.type === 'win' || event.type === 'lose') {
      this.updateUI();
    }
  }

  syncSpeedControls() {
    const value = this.engine?.speedPreset ?? 'normal';
    this.elements['movement-speed-title'].value = value;
    this.elements['movement-speed-game'].value = value;
    this.elements['movement-speed-title'].title = `${SPEED_PRESETS[value].tilesPerSecond} Felder pro Sekunde`;
  }

  updateUI() {
    if (!this.engine?.currentRoom) return;
    const room = this.engine.currentRoom;
    this.elements['room-level'].textContent = `Ebene ${room.z}`;
    this.elements['room-name'].textContent = this.gameData.roomName(room);
    this.elements.lives.textContent = this.engine.lives;
    this.elements.gold.textContent = this.engine.gold;
    this.elements.diamonds.textContent = this.engine.diamonds;
    this.elements.points.textContent = String(this.engine.points).padStart(8, '0');
    this.elements['room-coordinates'].textContent = `${room.x} · ${room.y} · ${room.z}`;
    const rings = [0, 1, 2, 3].map((index) => this.engine.inventoryHas(`OBJ_RING#${index}`));
    this.elements['ring-progress'].innerHTML = rings.map((found, index) => `<span class="${found ? 'is-found' : ''}" title="Ring ${index + 1}">◆</span>`).join('');
    this.renderInventory();
    this.renderMiniMap();
  }

  renderInventory() {
    const entries = [...this.engine.inventory.values()];
    this.elements['inventory-count'].textContent = `${entries.length} ${entries.length === 1 ? 'Ding' : 'Dinge'}`;
    const renderEntry = (item, large = false) => {
      const sprite = spriteFor(item.id);
      const label = this.gameData.text(item.id, item.id.replace(/^OBJ_/, '').replaceAll('_', ' '));
      const iconStyle = `--sx:${-sprite.x * 2}px;--sy:${-sprite.y * 2}px`;
      if (!large) return `<button class="inventory-slot" data-item="${item.id}" title="${label}"><span class="item-sprite" style="${iconStyle}"></span>${item.count > 1 ? `<b>${item.count}</b>` : ''}</button>`;
      const look = this.engine.inventoryHas('OBJ_EXCLAMATION_MARK') ? `<button data-look-item="${item.id}">Ansehen</button>` : '';
      const clone = this.engine.inventoryHas('OBJ_CLONE') && item.id !== 'OBJ_CLONE' ? `<button data-clone-item="${item.id}">Klonen</button>` : '';
      return `<article class="inventory-item"><span class="item-sprite item-sprite--large" style="${iconStyle}"></span><div><strong>${label}</strong><small>${item.count}× im Rucksack</small></div><div class="inventory-actions"><button data-use-item="${item.id}">Benutzen</button><button data-drop-item="${item.id}">Ablegen</button>${look}${clone}</div></article>`;
    };
    this.elements.inventory.innerHTML = entries.slice(0, 18).map((item) => renderEntry(item)).join('') || '<p class="empty-note">Noch leer</p>';
    this.elements['inventory-large'].innerHTML = entries.map((item) => renderEntry(item, true)).join('') || '<p class="empty-note">Der Rucksack ist noch leer.</p>';
    this.elements.inventory.querySelectorAll('[data-item]').forEach((button) => button.addEventListener('click', () => this.toggleInventory(true)));
    const bindAction = (attribute, action) => {
      this.elements['inventory-large'].querySelectorAll(`[${attribute}]`).forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.getAttribute(attribute);
          this.toggleInventory(false);
          action(id);
          this.renderInventory();
        });
      });
    };
    bindAction('data-use-item', (id) => this.engine.useItem(id));
    bindAction('data-drop-item', (id) => this.engine.dropItem(id));
    bindAction('data-look-item', (id) => this.engine.lookItem(id));
    bindAction('data-clone-item', (id) => this.engine.cloneItem(id));
  }

  renderMiniMap() {
    const room = this.engine.currentRoom;
    const cells = [];
    for (let y = Math.max(0, room.y - 2); y <= Math.min(9, room.y + 2); y += 1) {
      for (let x = Math.max(0, room.x - 2); x <= Math.min(9, room.x + 2); x += 1) {
        const target = this.gameData.roomAt(x, y, room.z);
        if (!target) cells.push('<span class="mini-room is-empty"></span>');
        else {
          const classes = ['mini-room'];
          if (this.engine.visitedRooms.has(target.id)) classes.push('is-visited');
          if (target.id === room.id) classes.push('is-current');
          cells.push(`<span class="${classes.join(' ')}" title="${this.gameData.roomName(target)}">${target.id === room.id ? '●' : ''}</span>`);
        }
      }
    }
    this.elements['mini-map'].innerHTML = cells.join('');
    this.elements['map-count'].textContent = `${this.engine.visitedRooms.size} Räume`;
  }

  renderWorldMap() {
    const levels = [...new Set([...this.gameData.rooms.values()].map((room) => room.z))].sort((a, b) => a - b);
    this.elements['level-tabs'].innerHTML = levels.map((level) => `<button data-level="${level}" class="${level === this.mapLevel ? 'is-active' : ''}">Ebene ${level}</button>`).join('');
    this.elements['level-tabs'].querySelectorAll('[data-level]').forEach((button) => button.addEventListener('click', () => {
      this.mapLevel = Number(button.dataset.level);
      this.renderWorldMap();
    }));
    const cells = [];
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        const room = this.gameData.roomAt(x, y, this.mapLevel);
        if (!room) cells.push('<span class="world-room is-empty"></span>');
        else {
          const visited = this.engine.visitedRooms.has(room.id);
          const current = this.engine.currentRoom.id === room.id;
          cells.push(`<span class="world-room ${visited ? 'is-visited' : ''} ${current ? 'is-current' : ''}" title="${visited ? this.gameData.roomName(room) : 'Unentdeckt'}">${current ? '●' : visited ? room.numericId : ''}</span>`);
        }
      }
    }
    this.elements['world-map'].innerHTML = cells.join('');
  }

  showRoomBanner(room, name) {
    this.elements['banner-level'].textContent = `Ebene ${room.z} · Raum ${room.numericId}`;
    this.elements['banner-name'].textContent = name;
    this.elements['room-banner'].classList.add('is-visible');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.elements['room-banner'].classList.remove('is-visible'), 1800);
  }

  showToast(message) {
    if (!message) return;
    this.elements.toast.textContent = message;
    this.elements.toast.classList.add('is-visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.elements.toast.classList.remove('is-visible'), 2200);
  }

  startInspectMode() {
    if (!this.engine) return;
    this.clearInput();
    this.inspectMode = true;
    this.inspectX = Math.max(0, Math.min(39, Math.round(this.engine.player.x)));
    this.inspectY = Math.max(0, Math.min(27, Math.round(this.engine.player.y)));
    this.engine.paused = true;
    this.elements['inspect-overlay'].hidden = false;
    this.updateInspectCursor();
  }

  stopInspectMode() {
    this.inspectMode = false;
    this.elements['inspect-overlay'].hidden = true;
    if (this.engine) {
      this.engine.paused = !this.elements['inventory-overlay'].hidden
        || !this.elements['map-overlay'].hidden || !this.elements['dialog-backdrop'].hidden;
    }
  }

  updateInspectCursor() {
    this.elements['inspect-cursor'].style.left = `${this.inspectX * 2.5}%`;
    this.elements['inspect-cursor'].style.top = `${((this.inspectY + 1) * 12 / 348) * 100}%`;
  }

  moveInspectFromPointer(event) {
    if (!this.inspectMode) return;
    const rect = this.elements['inspect-overlay'].getBoundingClientRect();
    this.inspectX = Math.max(0, Math.min(39, Math.floor((event.clientX - rect.left) / rect.width * 40)));
    const internalY = (event.clientY - rect.top) / rect.height * 348 - 12;
    this.inspectY = Math.max(0, Math.min(27, Math.floor(internalY / 12)));
    this.updateInspectCursor();
  }

  inspectSelection() {
    if (!this.inspectMode) return;
    const x = this.inspectX;
    const y = this.inspectY;
    this.stopInspectMode();
    this.engine.inspectAt(x, y);
  }

  openDialog(title, text) {
    this.dialogWasPaused = this.engine.paused;
    this.engine.paused = true;
    this.clearInput();
    this.elements['dialog-title'].textContent = title;
    this.elements['dialog-text'].textContent = text;
    this.elements['dialog-backdrop'].hidden = false;
  }

  closeDialog() {
    this.elements['dialog-backdrop'].hidden = true;
    if (this.engine) this.engine.paused = this.dialogWasPaused;
  }

  toggleInventory(open) {
    if (!this.engine) return;
    this.clearInput();
    this.elements['inventory-overlay'].hidden = !open;
    this.engine.paused = open || !this.elements['map-overlay'].hidden || !this.elements['dialog-backdrop'].hidden;
    if (open) this.renderInventory();
  }

  toggleMap(open) {
    if (!this.engine) return;
    this.clearInput();
    this.elements['map-overlay'].hidden = !open;
    this.engine.paused = open || !this.elements['inventory-overlay'].hidden || !this.elements['dialog-backdrop'].hidden;
    if (open) {
      this.mapLevel = this.engine.currentRoom.z;
      this.renderWorldMap();
    }
  }

  closeAllOverlays() {
    this.elements['dialog-backdrop'].hidden = true;
    this.elements['inventory-overlay'].hidden = true;
    this.elements['map-overlay'].hidden = true;
    this.elements['inspect-overlay'].hidden = true;
    this.inspectMode = false;
    if (this.engine) this.engine.paused = false;
  }
}
