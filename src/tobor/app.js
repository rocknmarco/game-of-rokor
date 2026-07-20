import { loadToborGame } from './game-loader.js';
import { SPEED_PRESETS, ToborEngine } from './engine.js';
import { ToborRenderer } from './renderer.js';
import { spriteFor } from './object-registry.js';
import { ToborAudio } from './audio.js';

const keyDirections = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const itemGroup = (id) => id.split('#')[0];

export class ToborApp {
  constructor() {
    this.elements = {};
    this.gameData = null;
    this.engine = null;
    this.renderer = null;
    this.audio = new ToborAudio();
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
    this.inventoryGroup = null;
    this.inventoryIndex = 0;
    this.inventoryActionIndex = 0;
    this.inventoryEntries = [];
    this.inventoryActions = [];
    this.returnToTitleAfterDialog = false;
  }

  async mount() {
    const ids = [
      'title-screen', 'game-shell', 'new-game', 'continue-game', 'clock-game', 'save-hint', 'menu-button', 'game-canvas',
      'movement-speed-title', 'movement-speed-game', 'loading-line', 'loading-progress', 'loading-text',
      'room-level', 'room-name', 'lives', 'gold', 'diamonds', 'points', 'ring-progress',
      'inventory', 'inventory-large', 'inventory-count', 'inventory-overlay', 'inventory-close',
      'inventory-back', 'inventory-actions', 'inventory-caption',
      'pack-button', 'mini-map', 'map-count', 'map-button', 'map-overlay', 'map-close', 'world-map',
      'level-tabs', 'room-coordinates', 'room-banner', 'banner-level', 'banner-name', 'toast',
      'dialog-backdrop', 'dialog-title', 'dialog-text', 'dialog-close',
      'inspect-overlay', 'inspect-cursor', 'inspect-hint',
      'audio-toggle', 'audio-toggle-title',
    ];
    for (const id of ids) this.elements[id] = document.getElementById(id);
    this.bindControls();
    this.syncAudioControls();

    const audioReady = this.audio.prepare();
    try {
      this.gameData = await loadToborGame('/games/insel-der-ruinen/game.json', (message, progress) => {
        this.elements['loading-text'].textContent = message;
        this.elements['loading-progress'].style.width = `${Math.round(progress * 100)}%`;
      });
      document.documentElement.style.setProperty('--inventory-tileset', `url("${this.gameData.assets.tilesetUrl}")`);
      this.engine = new ToborEngine(this.gameData, (event) => this.onEngineEvent(event));
      this.renderer = new ToborRenderer(this.elements['game-canvas'], this.gameData);
      await audioReady;
      this.syncSpeedControls();
      this.elements['new-game'].disabled = false;
      this.refreshSaveButtons();
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
    this.elements['new-game'].addEventListener('click', () => {
      this.audio.unlock();
      this.start('new');
    });
    this.elements['continue-game'].addEventListener('click', () => {
      this.audio.unlock();
      this.start('auto');
    });
    this.elements['clock-game'].addEventListener('click', () => {
      this.audio.unlock();
      this.start('clock');
    });
    this.elements['menu-button'].addEventListener('click', () => this.returnToTitle());
    this.elements['dialog-close'].addEventListener('click', () => this.closeDialog());
    this.elements['dialog-backdrop'].addEventListener('pointerdown', (event) => {
      if (event.target === this.elements['dialog-backdrop']) this.closeDialog();
    });
    this.elements['inventory-close'].addEventListener('click', () => this.toggleInventory(false));
    this.elements['inventory-back'].addEventListener('click', () => this.leaveInventoryGroup());
    this.elements['pack-button'].addEventListener('click', () => this.toggleInventory(true));
    this.elements['map-button'].addEventListener('click', () => this.toggleMap(true));
    this.elements['map-close'].addEventListener('click', () => this.toggleMap(false));
    for (const id of ['audio-toggle', 'audio-toggle-title']) {
      this.elements[id].addEventListener('click', () => {
        this.audio.unlock();
        this.audio.toggle();
        this.syncAudioControls();
      });
    }
    for (const id of ['movement-speed-title', 'movement-speed-game']) {
      this.elements[id].addEventListener('change', (event) => {
        this.engine?.setSpeedPreset(event.target.value);
        this.syncSpeedControls();
      });
    }

    window.addEventListener('keydown', (event) => this.onKeyDown(event), true);
    window.addEventListener('keyup', (event) => this.onKeyUp(event), true);
    window.addEventListener('blur', () => this.clearInput());
    window.addEventListener('pagehide', () => this.engine?.save());
    window.addEventListener('resize', () => this.positionInventoryActions());
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

  start(mode) {
    if (!this.engine) return;
    const loaded = mode === 'clock' ? this.engine.loadClockSave()
      : mode === 'auto' ? this.engine.load()
        : false;
    if (!loaded) this.engine.newGame();
    this.running = true;
    this.elements['title-screen'].hidden = true;
    this.elements['game-shell'].hidden = false;
    this.audio.setRoom(this.engine.currentRoom, true);
    this.updateUI();
  }

  returnToTitle() {
    if (!this.engine) return;
    this.engine.save();
    this.engine.clearInput();
    this.running = false;
    this.elements['game-shell'].hidden = true;
    this.elements['title-screen'].hidden = false;
    this.refreshSaveButtons();
    this.audio.stopMusic();
    this.closeAllOverlays();
  }

  refreshSaveButtons() {
    if (!this.engine) return;
    const hasAutosave = this.engine.hasSave();
    this.elements['continue-game'].disabled = !hasAutosave;
    this.elements['continue-game'].title = hasAutosave
      ? 'Den letzten automatischen Spielstand fortsetzen'
      : 'Noch kein automatischer Spielstand vorhanden';
    const hasClockSave = this.engine.hasClockSave();
    this.elements['clock-game'].disabled = !hasClockSave;
    this.elements['clock-game'].textContent = hasClockSave ? 'Uhr-Spielstand laden' : 'Noch kein Uhr-Spielstand';
    this.elements['clock-game'].title = hasClockSave
      ? 'Den zuletzt mit einer Uhr gespeicherten Spielstand laden'
      : 'Finde und benutze im Spiel zuerst eine Uhr';
    this.elements['save-hint'].textContent = hasClockSave
      ? 'Ein dauerhafter Uhr-Spielstand ist vorhanden und kann hier jederzeit geladen werden.'
      : 'Finde und benutze im Spiel eine Uhr, um einen dauerhaften Spielstand anzulegen.';
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
    if (!this.elements['dialog-backdrop'].hidden) {
      if (event.code === 'Enter' || event.code === 'Escape' || event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) this.closeDialog();
      }
      return;
    }
    if (!this.elements['inventory-overlay'].hidden) {
      this.handleInventoryKey(event);
      return;
    }
    if (!this.elements['map-overlay'].hidden) {
      if (event.code === 'Escape' || event.code === 'KeyM') {
        event.preventDefault();
        if (!event.repeat) this.toggleMap(false);
      }
      return;
    }
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

  handleInventoryKey(event) {
    const navigation = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (![...navigation, 'Enter', 'Space', 'Escape', 'KeyE'].includes(event.code)) return;
    event.preventDefault();
    if (event.repeat && !navigation.includes(event.code)) return;
    if (event.code === 'Escape' || event.code === 'KeyE') {
      if (this.inventoryGroup) this.leaveInventoryGroup();
      else this.toggleInventory(false);
      return;
    }
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      const delta = event.code === 'ArrowLeft' ? -1 : 1;
      this.inventoryIndex = Math.max(0, Math.min(this.inventoryEntries.length - 1, this.inventoryIndex + delta));
      this.inventoryActionIndex = 0;
      this.renderInventory();
      return;
    }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      const delta = event.code === 'ArrowUp' ? -1 : 1;
      this.inventoryActionIndex = Math.max(0, Math.min(this.inventoryActions.length - 1, this.inventoryActionIndex + delta));
      this.renderInventory();
      return;
    }
    this.activateInventorySelection();
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
    if (event.type === 'room') {
      if (event.firstVisit) this.showRoomBanner(event.room, event.name);
      this.audio.setRoom(event.room);
    }
    if (event.type === 'sound') this.audio.play(event.name, { volume: event.volume });
    if (event.type === 'status') this.showToast(event.message);
    if (event.type === 'inspect') this.startInspectMode();
    if (event.type === 'message' || event.type === 'win' || event.type === 'lose') {
      this.returnToTitleAfterDialog = event.type === 'lose';
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

  syncAudioControls() {
    for (const id of ['audio-toggle', 'audio-toggle-title']) {
      const button = this.elements[id];
      if (!button) continue;
      button.textContent = this.audio.enabled ? '🔊 Ton an' : '🔇 Ton aus';
      button.setAttribute('aria-pressed', String(this.audio.enabled));
      button.title = this.audio.enabled ? 'Ton ausschalten' : 'Ton einschalten';
    }
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
    const rawEntries = [...this.engine.inventory.values()];
    this.elements['inventory-count'].textContent = `${rawEntries.length} ${rawEntries.length === 1 ? 'Ding' : 'Dinge'}`;
    this.elements.inventory.innerHTML = rawEntries.slice(0, 18).map((item) => {
      const sprite = spriteFor(item.id);
      const label = this.itemLabel(item.id);
      return `<button class="inventory-slot" data-quick-inventory title="${escapeHtml(label)}"><span class="item-sprite" style="--sx:${-sprite.x * 2}px;--sy:${-sprite.y * 2}px"></span>${item.count > 1 ? `<b>${item.count}</b>` : ''}</button>`;
    }).join('') || '<p class="empty-note">Noch leer</p>';
    this.elements.inventory.querySelectorAll('[data-quick-inventory]').forEach((button) => {
      button.addEventListener('click', () => this.toggleInventory(true));
    });

    const groups = new Map();
    for (const item of rawEntries) {
      const group = itemGroup(item.id);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
    const groupItems = this.inventoryGroup ? groups.get(this.inventoryGroup) : null;
    if (this.inventoryGroup && !groupItems) this.inventoryGroup = null;
    this.inventoryEntries = this.inventoryGroup
      ? groupItems.map((item) => this.makeInventoryEntry(itemGroup(item.id), [item]))
      : [...groups.entries()].map(([group, items]) => this.makeInventoryEntry(group, items));

    this.inventoryIndex = Math.max(0, Math.min(this.inventoryIndex, this.inventoryEntries.length - 1));
    const selected = this.inventoryEntries[this.inventoryIndex];
    this.inventoryActions = this.actionsForInventoryEntry(selected);
    this.inventoryActionIndex = Math.max(0, Math.min(this.inventoryActionIndex, this.inventoryActions.length - 1));
    this.elements['inventory-caption'].textContent = this.inventoryGroup
      ? `${this.itemLabel(this.inventoryGroup)} · Untergruppe`
      : 'Rucksack';
    this.elements['inventory-back'].hidden = !this.inventoryGroup;

    this.elements['inventory-large'].innerHTML = this.inventoryEntries.map((entry, index) => {
      const sprite = this.inventorySprite(entry);
      const selectedClass = index === this.inventoryIndex ? ' is-selected' : '';
      const groupClass = entry.grouped ? ' is-group' : '';
      return `<button class="tobor-inventory-slot${selectedClass}${groupClass}" data-inventory-index="${index}" title="${escapeHtml(entry.label)}" aria-selected="${index === this.inventoryIndex}"><span class="item-sprite" style="--sx:${-sprite.x * 2}px;--sy:${-sprite.y * 2}px"></span>${entry.count > 1 ? `<b>${entry.count}</b>` : ''}</button>`;
    }).join('');
    this.elements['inventory-large'].querySelectorAll('[data-inventory-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.inventoryIndex);
        this.inventoryIndex = index;
        this.inventoryActionIndex = 0;
        const entry = this.inventoryEntries[index];
        if (entry.grouped) this.enterInventoryGroup(entry.group);
        else this.renderInventory();
      });
    });

    if (!selected) {
      this.elements['inventory-actions'].innerHTML = '';
      return;
    }
    const countLine = selected.count > 1 ? `<span class="inventory-action-count">${selected.count} Stück</span>` : '';
    this.elements['inventory-actions'].innerHTML = `<strong>${escapeHtml(selected.label)}</strong>${countLine}${this.inventoryActions.map((action, index) => `<button class="${index === this.inventoryActionIndex ? 'is-selected' : ''}" data-inventory-action="${index}">${escapeHtml(action.label)}</button>`).join('')}`;
    this.elements['inventory-actions'].querySelectorAll('[data-inventory-action]').forEach((button) => {
      button.addEventListener('click', () => {
        this.inventoryActionIndex = Number(button.dataset.inventoryAction);
        this.activateInventorySelection();
      });
    });
    requestAnimationFrame(() => this.positionInventoryActions());
  }

  itemLabel(id) {
    const group = itemGroup(id);
    const fallback = group.replace(/^OBJ_/, '').replaceAll('_', ' ');
    return this.gameData.text(id, this.gameData.text(group, fallback));
  }

  makeInventoryEntry(group, items) {
    const count = items.reduce((sum, item) => sum + item.count, 0);
    return {
      group,
      items,
      grouped: items.length > 1,
      item: items[0],
      count,
      label: this.itemLabel(items.length === 1 ? items[0].id : group),
    };
  }

  inventorySprite(entry) {
    if (entry.grouped && entry.group === 'OBJ_KEY') return { x: 224, y: 48 };
    if (entry.grouped && entry.group === 'OBJ_MUNITION') return { x: 224, y: 60 };
    return spriteFor(entry.item.id);
  }

  actionsForInventoryEntry(entry) {
    if (!entry) return [];
    if (entry.grouped) {
      const actions = [{ label: 'Auswählen', run: () => this.enterInventoryGroup(entry.group) }];
      if (entry.group === 'OBJ_MUNITION') {
        actions.push({ label: 'Alle ablegen', run: () => this.performInventoryAction(() => {
          for (const item of entry.items) this.dropAllOf(item.id);
        }) });
      }
      return actions;
    }
    const id = entry.item.id;
    const actions = [
      { label: 'Benutzen', run: () => this.performInventoryAction(() => this.engine.useItem(id)) },
      { label: 'Ablegen', run: () => this.performInventoryAction(() => this.engine.dropItem(id)) },
    ];
    if (entry.group === 'OBJ_MUNITION' && entry.count > 1) {
      actions.push({ label: 'Alle ablegen', run: () => this.performInventoryAction(() => this.dropAllOf(id)) });
    }
    if (this.engine.inventoryHas('OBJ_CLONE') && id !== 'OBJ_CLONE') {
      actions.push({ label: 'Klonen', run: () => this.performInventoryAction(() => this.engine.cloneItem(id)) });
    }
    if (this.engine.inventoryHas('OBJ_EXCLAMATION_MARK')) {
      actions.push({ label: 'Ansehen', run: () => this.performInventoryAction(() => this.engine.lookItem(id)) });
    }
    return actions;
  }

  dropAllOf(id) {
    const count = this.engine.inventoryCount(id);
    for (let index = 0; index < count; index += 1) {
      if (!this.engine.dropItem(id)) break;
    }
  }

  activateInventorySelection() {
    this.inventoryActions[this.inventoryActionIndex]?.run();
  }

  performInventoryAction(action) {
    this.toggleInventory(false);
    action();
    this.renderInventory();
  }

  enterInventoryGroup(group) {
    this.inventoryGroup = group;
    this.inventoryIndex = 0;
    this.inventoryActionIndex = 0;
    this.renderInventory();
  }

  leaveInventoryGroup() {
    if (!this.inventoryGroup) {
      this.toggleInventory(false);
      return;
    }
    this.inventoryGroup = null;
    this.inventoryIndex = 0;
    this.inventoryActionIndex = 0;
    this.renderInventory();
  }

  positionInventoryActions() {
    if (this.elements['inventory-overlay'].hidden) return;
    const selected = this.elements['inventory-large'].querySelector('.is-selected');
    if (!selected) return;
    const overlayRect = this.elements['inventory-overlay'].getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const menu = this.elements['inventory-actions'];
    const idealLeft = selectedRect.left - overlayRect.left + selectedRect.width / 2;
    const halfWidth = menu.offsetWidth / 2;
    const left = Math.max(halfWidth + 6, Math.min(overlayRect.width - halfWidth - 6, idealLeft));
    menu.style.left = `${left}px`;
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
    const returnToTitle = this.returnToTitleAfterDialog;
    this.returnToTitleAfterDialog = false;
    this.elements['dialog-backdrop'].hidden = true;
    if (returnToTitle) {
      this.returnToTitle();
      return;
    }
    if (this.engine) this.engine.paused = this.dialogWasPaused;
  }

  toggleInventory(open) {
    if (!this.engine) return;
    if (open && this.engine.motion) {
      this.showToast('Bleib kurz stehen, um den Rucksack zu öffnen.');
      return;
    }
    if (open && this.engine.inventory.size === 0) {
      this.showToast('Der Rucksack ist noch leer.');
      return;
    }
    this.clearInput();
    this.elements['inventory-overlay'].hidden = !open;
    this.engine.paused = open || !this.elements['map-overlay'].hidden || !this.elements['dialog-backdrop'].hidden;
    if (open) {
      this.inventoryGroup = null;
      this.inventoryIndex = 0;
      this.inventoryActionIndex = 0;
      this.renderInventory();
    }
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
    this.returnToTitleAfterDialog = false;
    if (this.engine) this.engine.paused = false;
  }
}
