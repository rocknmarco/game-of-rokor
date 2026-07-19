import {
  COLS,
  ITEMS,
  ROOM_BY_ID,
  ROOM_DEFS,
  ROWS,
  createWorld,
  defaultSaveState,
  puzzleSolved,
  roomAt,
  traceBeam
} from './world.js';
import { Renderer } from './renderer.js';

const SAVE_KEY = 'rokor-light-archive-save-v1';
const SETTINGS_KEY = 'rokor-light-archive-settings-v1';
const MOVEMENT_SPEEDS = {
  slow: { label: 'Langsam', duration: 112 },
  normal: { label: 'Normal', duration: 84 },
  fast: { label: 'Schnell', duration: 54 }
};
const IMMEDIATE_START_DISTANCE = 1 / 12;
const directions = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

const keyDirections = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

const codeDirections = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right'
};

const interactionLabels = {
  npc: 'Sprechen', note: 'Lesen', checkpoint: 'Rasten', mirror: 'Spiegel drehen',
  chest: 'Truhe öffnen', brazier: 'Entzünden', altar: 'Siegel einsetzen'
};

export class Game {
  constructor() {
    this.world = createWorld();
    this.state = defaultSaveState();
    this.renderer = null;
    this.running = false;
    this.paused = false;
    this.soundEnabled = true;
    this.audioContext = null;
    this.lastFrame = 0;
    this.moveCount = 0;
    this.attackFlash = 0;
    this.toastTimer = 0;
    this.bannerTimer = 0;
    this.gamepadCooldown = 0;
    this.dialogCallback = null;
    this.elements = {};
    this.heldMovementKeys = new Map();
    this.heldDirectionOrder = [];
    this.pendingDirection = null;
    this.blockedDirection = null;
    this.movementSpeed = 'normal';
    this.playerMotion = {
      active: false,
      paused: false,
      elapsed: 0,
      duration: this.moveDuration,
      fromX: this.player.x,
      fromY: this.player.y,
      toX: this.player.x,
      toY: this.player.y,
      direction: null,
      crateMove: null,
      lastTimestamp: null
    };
  }

  get room() { return this.world[this.state.roomId]; }
  get player() { return this.state.player; }
  get inventory() { return this.state.inventory; }
  get sealCount() { return this.inventory.filter((id) => id.startsWith('sigil')).length; }
  get moveDuration() { return MOVEMENT_SPEEDS[this.movementSpeed]?.duration || MOVEMENT_SPEEDS.normal.duration; }
  get playerVisual() {
    const motion = this.playerMotion;
    if (!motion.active && !motion.paused) {
      return { ...this.player, moving: false, motionProgress: 1, walkCycle: this.moveCount };
    }
    const progress = motion.active ? Math.min(1, motion.elapsed / motion.duration) : 0;
    return {
      ...this.player,
      x: motion.fromX + (motion.toX - motion.fromX) * progress,
      y: motion.fromY + (motion.toY - motion.fromY) * progress,
      moving: motion.active,
      motionProgress: progress,
      walkCycle: this.moveCount
    };
  }

  mount() {
    const ids = [
      'title-screen', 'game-shell', 'new-game', 'continue-game', 'menu-button', 'game-canvas',
      'room-name', 'room-kicker', 'health', 'score', 'seals', 'objective-title', 'objective-text',
      'objective-progress', 'inventory', 'inventory-count', 'mini-map', 'map-count', 'journal',
      'journal-count', 'toast', 'room-banner', 'action-prompt', 'sound-toggle', 'dialog-backdrop',
      'dialog-speaker', 'dialog-title', 'dialog-text', 'dialog-portrait', 'dialog-close', 'map-overlay',
      'map-close', 'world-map', 'movement-speed-title', 'movement-speed-game'
    ];
    ids.forEach((id) => { this.elements[id] = document.getElementById(id); });
    this.loadSettings();
    this.syncMovementSpeedControls();
    this.renderer = new Renderer(this.elements['game-canvas']);

    this.elements['continue-game'].disabled = !this.hasSave();
    this.elements['new-game'].addEventListener('click', () => this.start(false));
    this.elements['continue-game'].addEventListener('click', () => this.start(true));
    this.elements['menu-button'].addEventListener('click', () => this.returnToTitle());
    this.elements['dialog-close'].addEventListener('click', () => this.closeDialog());
    this.elements['map-close'].addEventListener('click', () => this.toggleMap(false));
    this.elements['sound-toggle'].addEventListener('click', () => this.toggleSound());
    this.elements['action-prompt'].addEventListener('click', () => this.interact());
    ['movement-speed-title', 'movement-speed-game'].forEach((id) => {
      this.elements[id].addEventListener('change', (event) => this.setMovementSpeed(event.target.value));
    });

    document.querySelectorAll('[data-move]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        this.pressMovement(button.dataset.move, `pointer-${event.pointerId}`, event.timeStamp);
      });
      const release = (event) => this.releaseMovement(`pointer-${event.pointerId}`, event.timeStamp);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (button.dataset.action === 'interact') this.interact(); else this.attack();
      });
    });

    window.addEventListener('keydown', (event) => this.onKeyDown(event), true);
    window.addEventListener('keyup', (event) => this.onKeyUp(event), true);
    window.addEventListener('blur', () => this.clearMovementInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearMovementInput();
    });
    requestAnimationFrame((time) => this.loop(time));
  }

  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (MOVEMENT_SPEEDS[settings.movementSpeed]) this.movementSpeed = settings.movementSpeed;
    } catch {
      this.movementSpeed = 'normal';
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ movementSpeed: this.movementSpeed }));
    } catch {
      // The game remains usable when storage is unavailable.
    }
  }

  syncMovementSpeedControls() {
    ['movement-speed-title', 'movement-speed-game'].forEach((id) => {
      if (this.elements[id]) this.elements[id].value = this.movementSpeed;
    });
  }

  setMovementSpeed(speed, { persist = true, announce = true } = {}) {
    if (!MOVEMENT_SPEEDS[speed]) return false;
    if (this.running) this.clearMovementInput();
    this.movementSpeed = speed;
    if (this.playerMotion.paused) {
      const remaining = Math.hypot(
        this.playerMotion.toX - this.playerMotion.fromX,
        this.playerMotion.toY - this.playerMotion.fromY
      );
      this.playerMotion.duration = Math.max(1, this.moveDuration * remaining);
      this.playerMotion.elapsed = 0;
    }
    this.syncMovementSpeedControls();
    if (persist) this.saveSettings();
    if (announce && this.running) this.toast(`Bewegungstempo: ${MOVEMENT_SPEEDS[speed].label}`);
    return true;
  }

  start(continueGame) {
    this.world = createWorld();
    if (continueGame && this.hasSave()) this.load();
    else this.state = defaultSaveState();
    this.running = true;
    this.paused = false;
    this.clearMovementInput();
    this.elements['title-screen'].hidden = true;
    this.elements['game-shell'].hidden = false;
    this.applyObjectState();
    this.ensurePlayerOnWalkableTile();
    this.syncPlayerMotion();
    this.showRoomBanner();
    this.updateUI();
    this.save();
    if (!continueGame) {
      this.showDialog({
        speaker: 'Archivistin Elia',
        title: 'Das Licht ist verstummt',
        portrait: 'E',
        text: 'Rokor, die Sonnenwarte hat heute zum ersten Mal seit dreihundert Jahren ihr Licht verloren. Drei Siegel halten ihr Herz geschlossen.\n\nFinde sie – aber geh behutsam. In den Ruinen bewegen sich Dinge, die gestern noch Stein waren.'
      });
    } else {
      this.toast('Expedition fortgesetzt');
    }
  }

  returnToTitle() {
    if (!this.running) return;
    this.save();
    this.running = false;
    this.paused = false;
    this.clearMovementInput();
    this.elements['map-overlay'].hidden = true;
    this.elements['dialog-backdrop'].hidden = true;
    this.elements['game-shell'].hidden = true;
    this.elements['title-screen'].hidden = false;
    this.elements['continue-game'].disabled = !this.hasSave();
  }

  loop(time) {
    const elapsed = Math.min(40, time - this.lastFrame || 16);
    this.lastFrame = time;
    if (this.running) {
      this.attackFlash = Math.max(0, this.attackFlash - elapsed);
      this.gamepadCooldown = Math.max(0, this.gamepadCooldown - elapsed);
      this.updatePlayerMotion(elapsed, time);
      this.pollGamepad();
      this.renderer.render(this.room, this, elapsed);
    }
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  onKeyDown(event) {
    if (!this.running) return;
    if (event.key === 'Escape') {
      if (!this.elements['dialog-backdrop'].hidden) this.closeDialog();
      else if (!this.elements['map-overlay'].hidden) this.toggleMap(false);
      else this.returnToTitle();
      return;
    }
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      this.toggleMap();
      return;
    }
    if (this.paused) return;
    const direction = codeDirections[event.code] || keyDirections[event.key];
    if (direction) {
      event.preventDefault();
      this.pressMovement(direction, `key-${event.code}`, event.timeStamp);
    } else if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
      event.preventDefault();
      this.interact();
    } else if (event.code === 'Space') {
      event.preventDefault();
      this.attack();
    }
  }

  onKeyUp(event) {
    const source = `key-${event.code}`;
    if (this.heldMovementKeys.has(source)) {
      event.preventDefault();
      this.releaseMovement(source, event.timeStamp);
    }
  }

  pressMovement(direction, source, inputTimestamp = null) {
    if (!directions[direction] || this.heldMovementKeys.has(source)) return;
    this.settlePlayerMotion(inputTimestamp);
    this.player.facing = direction;
    this.heldMovementKeys.set(source, direction);
    this.heldDirectionOrder = this.heldDirectionOrder.filter((entry) => entry !== direction);
    this.heldDirectionOrder.push(direction);
    this.blockedDirection = null;
    const started = this.requestMove(direction);
    if (started) this.showImmediateMovement();
    this.renderImmediately();
  }

  releaseMovement(source, inputTimestamp = null) {
    const direction = this.heldMovementKeys.get(source);
    if (!direction) return;
    this.settlePlayerMotion(inputTimestamp);
    this.heldMovementKeys.delete(source);
    if (![...this.heldMovementKeys.values()].includes(direction)) {
      this.heldDirectionOrder = this.heldDirectionOrder.filter((entry) => entry !== direction);
      if (this.blockedDirection === direction) this.blockedDirection = null;
    }
    if (this.pendingDirection === direction) this.pendingDirection = null;
    if (this.heldMovementKeys.size === 0) {
      this.pendingDirection = null;
      this.pausePlayerMotion();
    } else {
      const nextDirection = this.heldDirection();
      if (nextDirection && this.playerMotion.active && this.playerMotion.direction === direction) {
        const started = this.requestMove(nextDirection);
        if (started) this.showImmediateMovement();
      }
    }
    this.renderImmediately();
  }

  clearMovementInput() {
    this.pausePlayerMotion();
    this.heldMovementKeys.clear();
    this.heldDirectionOrder = [];
    this.pendingDirection = null;
    this.blockedDirection = null;
  }

  heldDirection() {
    return this.heldDirectionOrder.at(-1) || null;
  }

  requestMove(direction) {
    if (!this.running || this.paused || !directions[direction]) return false;
    if (this.playerMotion.paused) {
      if (this.playerMotion.direction === direction) {
        this.resumePlayerMotion();
        return true;
      }
      const visualStart = { x: this.playerMotion.fromX, y: this.playerMotion.fromY };
      this.syncPlayerMotion();
      const moved = this.move(direction, visualStart);
      if (!moved) this.blockedDirection = direction;
      return moved;
    }
    if (this.playerMotion.active) {
      if (this.playerMotion.direction !== direction) {
        const visualStart = this.interruptPlayerMotion();
        const moved = this.move(direction, visualStart);
        if (!moved) this.blockedDirection = direction;
        return moved;
      }
      this.pendingDirection = direction;
      return false;
    }
    const moved = this.move(direction);
    if (!moved) this.blockedDirection = direction;
    return moved;
  }

  syncPlayerMotion() {
    Object.assign(this.playerMotion, {
      active: false,
      paused: false,
      elapsed: 0,
      fromX: this.player.x,
      fromY: this.player.y,
      toX: this.player.x,
      toY: this.player.y,
      direction: null,
      crateMove: null,
      lastTimestamp: null
    });
  }

  beginPlayerMotion(fromX, fromY, toX, toY, options = {}) {
    const distance = Math.hypot(toX - fromX, toY - fromY);
    Object.assign(this.playerMotion, {
      active: true,
      paused: false,
      elapsed: 0,
      duration: Math.max(1, this.moveDuration * distance),
      fromX,
      fromY,
      toX,
      toY,
      direction: options.direction || this.player.facing,
      crateMove: options.crateMove || null,
      lastTimestamp: globalThis.performance?.now?.() ?? null
    });
  }

  pausePlayerMotion() {
    const motion = this.playerMotion;
    if (!motion.active) return;
    const progress = Math.min(1, motion.elapsed / motion.duration);
    const currentX = motion.fromX + (motion.toX - motion.fromX) * progress;
    const currentY = motion.fromY + (motion.toY - motion.fromY) * progress;
    const remaining = Math.hypot(motion.toX - currentX, motion.toY - currentY);
    Object.assign(motion, {
      active: false,
      paused: remaining > .001,
      elapsed: 0,
      duration: Math.max(1, this.moveDuration * remaining),
      fromX: currentX,
      fromY: currentY,
      lastTimestamp: null
    });
  }

  resumePlayerMotion() {
    if (!this.playerMotion.paused) return;
    this.playerMotion.active = true;
    this.playerMotion.paused = false;
    this.playerMotion.elapsed = 0;
    this.playerMotion.lastTimestamp = globalThis.performance?.now?.() ?? null;
  }

  interruptPlayerMotion() {
    const motion = this.playerMotion;
    const progress = Math.min(1, motion.elapsed / motion.duration);
    const visualStart = {
      x: motion.fromX + (motion.toX - motion.fromX) * progress,
      y: motion.fromY + (motion.toY - motion.fromY) * progress
    };
    if (progress >= 0.5) this.completePlayerMotion();
    else this.syncPlayerMotion();
    return visualStart;
  }

  settlePlayerMotion(timestamp) {
    if (!this.playerMotion.active || !Number.isFinite(timestamp)
      || !Number.isFinite(this.playerMotion.lastTimestamp)) return;
    const elapsed = Math.max(0, Math.min(40, timestamp - this.playerMotion.lastTimestamp));
    if (elapsed > 0) this.updatePlayerMotion(elapsed, timestamp);
  }

  showImmediateMovement() {
    const motion = this.playerMotion;
    if (!motion.active || motion.duration <= 0) return;
    const distance = Math.hypot(motion.toX - motion.fromX, motion.toY - motion.fromY);
    if (distance <= 0) return;
    const progress = Math.min(0.12, IMMEDIATE_START_DISTANCE / distance);
    motion.elapsed = Math.min(motion.duration - 0.001, motion.elapsed + motion.duration * progress);
  }

  renderImmediately() {
    if (!this.renderer || !this.room) return;
    this.renderer.render(this.room, this, 0);
  }

  completePlayerMotion() {
    const motion = this.playerMotion;
    const crateMove = motion.crateMove;
    if (crateMove) {
      crateMove.crate.x = crateMove.x;
      crateMove.crate.y = crateMove.y;
      if (puzzleSolved(this.room, 'aqueduct')) {
        crateMove.crate.anchored = true;
        this.toast('Die Sonnenplatte rastet ein. Das Ostschott öffnet sich!');
        this.addJournal('Das Gegengewicht', 'Im Aquädukt ist das Ostschott nun geöffnet.');
        this.sound('solve');
      } else this.sound('push');
    }
    this.player.x = motion.toX;
    this.player.y = motion.toY;
    this.blockedDirection = null;
    this.collectAtPlayer();
    this.moveCount += 1;
    if (this.moveCount % 2 === 0) this.enemyTurn();
    this.updateActionPrompt();
    this.save();
    this.syncPlayerMotion();
  }

  updatePlayerMotion(elapsed, timestamp = null) {
    let remainingElapsed = this.playerMotion.active
      && Number.isFinite(timestamp) && Number.isFinite(this.playerMotion.lastTimestamp)
      ? Math.max(0, Math.min(elapsed, timestamp - this.playerMotion.lastTimestamp))
      : elapsed;

    for (let segment = 0; segment < 4; segment += 1) {
      if (this.playerMotion.active) {
        const remainingDuration = this.playerMotion.duration - this.playerMotion.elapsed;
        const used = Math.min(remainingElapsed, remainingDuration);
        this.playerMotion.elapsed += used;
        remainingElapsed -= used;
        this.playerMotion.lastTimestamp = Number.isFinite(timestamp) ? timestamp : null;
        if (this.playerMotion.elapsed < this.playerMotion.duration) return;
        this.completePlayerMotion();
      }

      if (this.paused) return;
      const direction = this.pendingDirection || this.heldDirection();
      this.pendingDirection = null;
      if (!direction || direction === this.blockedDirection) return;
      const moved = this.move(direction);
      if (!moved) {
        this.blockedDirection = direction;
        return;
      }
      if (remainingElapsed <= 0) return;
    }
  }

  pollGamepad() {
    if (this.paused || this.gamepadCooldown > 0 || !navigator.getGamepads) return;
    const pad = [...navigator.getGamepads()].find(Boolean);
    if (!pad) return;
    let action = null;
    if (pad.axes[1] < -.55 || pad.buttons[12]?.pressed) action = 'up';
    else if (pad.axes[1] > .55 || pad.buttons[13]?.pressed) action = 'down';
    else if (pad.axes[0] < -.55 || pad.buttons[14]?.pressed) action = 'left';
    else if (pad.axes[0] > .55 || pad.buttons[15]?.pressed) action = 'right';
    if (action) {
      this.requestMove(action);
      this.gamepadCooldown = 96;
    } else if (pad.buttons[0]?.pressed) {
      this.interact();
      this.gamepadCooldown = 220;
    } else if (pad.buttons[1]?.pressed) {
      this.attack();
      this.gamepadCooldown = 220;
    }
  }

  move(direction, visualStart = null) {
    if (!this.running || this.paused || !directions[direction]
      || this.playerMotion.active || this.playerMotion.paused) return false;
    const { dx, dy } = directions[direction];
    this.player.facing = direction;
    const fromX = visualStart?.x ?? this.player.x;
    const fromY = visualStart?.y ?? this.player.y;
    let nextX = this.player.x + dx;
    let nextY = this.player.y + dy;

    if (nextX < 0 || nextX >= COLS || nextY < 0 || nextY >= ROWS) {
      return this.transition(dx, dy);
    }

    const enemy = this.objectAt(nextX, nextY, (entry) => entry.type === 'enemy' && !entry.dead);
    if (enemy) {
      this.damagePlayer(enemy.enemy === 'sentinel' ? 2 : 1);
      this.toast('Der Weg ist versperrt – wehre dich mit der Leertaste!');
      return false;
    }

    const crate = this.objectAt(nextX, nextY, (entry) => entry.type === 'crate');
    let crateMove = null;
    if (crate) {
      if (crate.anchored) {
        this.toast('Die Kiste ist in der Sonnenplatte eingerastet.');
        return false;
      }
      const crateX = crate.x + dx;
      const crateY = crate.y + dy;
      if (!this.canEnter(this.room, crateX, crateY, { ignoreCrate: true })) {
        this.sound('blocked');
        return false;
      }
      crateMove = { crate, x: crateX, y: crateY };
    } else if (!this.canEnter(this.room, nextX, nextY)) {
      this.sound('blocked');
      return false;
    }

    this.blockedDirection = null;
    this.beginPlayerMotion(fromX, fromY, nextX, nextY, {
      direction,
      crateMove
    });
    return true;
  }

  transition(dx, dy) {
    const currentDef = ROOM_BY_ID[this.state.roomId];
    const targetDef = roomAt(currentDef.x + dx, currentDef.y + dy);
    if (!targetDef) {
      this.sound('blocked');
      return false;
    }
    let x = this.player.x;
    let y = this.player.y;
    if (dx === 1) x = 1;
    if (dx === -1) x = COLS - 2;
    if (dy === 1) y = 1;
    if (dy === -1) y = ROWS - 2;
    const targetRoom = this.world[targetDef.id];
    if (!this.canEnter(targetRoom, x, y)) {
      this.sound('blocked');
      return false;
    }
    this.state.roomId = targetDef.id;
    this.player.x = x;
    this.player.y = y;
    this.blockedDirection = null;
    this.syncPlayerMotion();
    if (!this.state.visited.includes(targetDef.id)) {
      this.state.visited.push(targetDef.id);
      this.addJournal(targetDef.name, targetDef.subtitle);
    }
    this.showRoomBanner();
    this.updateUI();
    this.updateActionPrompt();
    this.sound('step');
    this.save();
    return true;
  }

  canEnter(room, x, y, options = {}) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (['cliff', 'wall', 'water'].includes(room.grid[y][x])) return false;
    return !room.objects.some((entry) => {
      if (entry.collected || entry.dead || entry.x !== x || entry.y !== y) return false;
      if (entry.type === 'crate' && options.ignoreCrate) return false;
      if (entry.type === 'lightGate' || entry.type === 'waterGate') return !puzzleSolved(room, entry.puzzle);
      return entry.blocking || ['crate', 'altar'].includes(entry.type);
    });
  }

  objectAt(x, y, predicate = () => true) {
    return this.room.objects.find((entry) => !entry.collected && !entry.dead && entry.x === x && entry.y === y && predicate(entry));
  }

  collectAtPlayer() {
    const pickup = this.objectAt(this.player.x, this.player.y, (entry) => entry.type === 'pickup');
    if (!pickup) return;
    pickup.collected = true;
    if (pickup.item === 'nectar') {
      if (this.player.hp < this.player.maxHp) {
        this.player.hp += 1;
        this.toast('Sonnennektar: ein Herz wiederhergestellt');
      } else {
        this.state.score += 25;
        this.toast('Sonnennektar: +25 Lichtfunken');
      }
    }
    this.sound('pickup');
    this.updateUI();
  }

  nearestInteractive() {
    const priority = ['npc', 'altar', 'chest', 'mirror', 'brazier', 'note', 'checkpoint'];
    return this.room.objects
      .filter((entry) => !entry.collected && !entry.dead && Math.abs(entry.x - this.player.x) + Math.abs(entry.y - this.player.y) <= 1 && priority.includes(entry.type))
      .sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type))[0] || null;
  }

  interact() {
    if (!this.running || this.paused) return;
    const entry = this.nearestInteractive();
    if (!entry) {
      this.toast('Hier gibt es nichts zu untersuchen.');
      return;
    }
    switch (entry.type) {
      case 'npc': this.talkToNpc(entry); break;
      case 'note': this.readNote(entry); break;
      case 'checkpoint': this.useCheckpoint(entry); break;
      case 'mirror': this.rotateMirror(entry); break;
      case 'chest': this.openChest(entry); break;
      case 'brazier': this.lightBrazier(entry); break;
      case 'altar': this.useAltar(); break;
      default: break;
    }
    this.updateActionPrompt();
    this.updateUI();
    this.save();
  }

  talkToNpc(entry) {
    const hasAll = this.sealCount === 3;
    this.showDialog({
      speaker: entry.name,
      title: hasAll ? 'Die Warte wartet auf dich' : 'Drei Wege, drei Prüfungen',
      portrait: entry.icon,
      text: hasAll
        ? 'Alle drei Siegel singen wieder. Geh zur Sonnenwarte im Südosten und setze sie in das zentrale Prisma. Was auch immer danach geschieht – Liora hat dich gewählt.'
        : 'Die Bernsteinlinse liegt im Archivhof im Nordosten. Mit ihr kannst du die Spiegel der Lichtbrücke wecken.\n\nFür das Dämmergewölbe brauchst du die alte Laterne vom Wachtplateau. Im Aquädukt wiederum hilft nur ein wenig Muskelkraft.'
    });
    if (!entry.talked) {
      entry.talked = true;
      this.addJournal('Elias Rat', 'Linse: Archivhof · Laterne: Wachtplateau · Kraftprobe: Aquädukt');
    }
    this.sound('talk');
  }

  readNote(entry) {
    this.showDialog({ speaker: 'Gefundene Notiz', title: entry.title, portrait: '✎', text: entry.text });
    if (!entry.read) {
      entry.read = true;
      this.addJournal(entry.title, entry.text.split('\n')[0].slice(0, 100));
      this.state.score += 15;
    }
    this.sound('paper');
  }

  useCheckpoint(entry) {
    this.state.checkpoint = { roomId: this.state.roomId, x: entry.x, y: Math.min(ROWS - 2, entry.y + 1) };
    this.player.hp = this.player.maxHp;
    this.toast('Sonnenuhr aktiviert · Herzen aufgefüllt');
    this.sound('checkpoint');
  }

  rotateMirror(entry) {
    if (!this.inventory.includes('lens')) {
      this.toast('Der Mechanismus braucht eine passende Linse.');
      this.sound('blocked');
      return;
    }
    entry.orientation = entry.orientation === '/' ? '\\' : '/';
    this.sound('mirror');
    if (traceBeam(this.room).powered) {
      this.toast('Der Lichtfänger antwortet – die Brücke ist offen!');
      this.addJournal('Der gebündelte Strahl', 'Die Lichtbrücke führt nun zur Kapsel der Morgenröte.');
      this.sound('solve');
    } else this.toast('Der Spiegel dreht sich mit einem schweren Klicken.');
  }

  openChest(entry) {
    if (entry.opened) {
      this.toast('Die Truhe ist leer.');
      return;
    }
    if (entry.requires && !puzzleSolved(this.room, entry.requires)) {
      const messages = {
        bridge: 'Kein Licht erreicht das Schloss der Truhe.',
        aqueduct: 'Das Ostschott hält die Kapsel unter Verschluss.',
        vault: 'Drei kalte Vertiefungen umgeben das Schloss.'
      };
      this.toast(messages[entry.requires]);
      this.sound('blocked');
      return;
    }
    entry.opened = true;
    const item = ITEMS[entry.reward];
    if (!this.inventory.includes(entry.reward)) this.inventory.push(entry.reward);
    this.state.score += entry.reward.startsWith('sigil') ? 300 : 100;
    this.showDialog({
      speaker: entry.reward.startsWith('sigil') ? 'Sonnensiegel geborgen' : 'Fundstück',
      title: item.name,
      portrait: item.icon,
      text: `${item.description}\n\nDer Gegenstand wurde deinem Reisegepäck hinzugefügt.`
    });
    this.addJournal(item.name, item.description);
    this.sound(entry.reward.startsWith('sigil') ? 'seal' : 'pickup');
  }

  lightBrazier(entry) {
    if (!this.inventory.includes('lantern')) {
      this.toast('Die Luft ist zu kalt. Du brauchst eine geschützte Flamme.');
      this.sound('blocked');
      return;
    }
    if (entry.lit) {
      this.toast('Die Flamme brennt ruhig.');
      return;
    }
    entry.lit = true;
    const lit = this.room.objects.filter((object) => object.type === 'brazier' && object.lit).length;
    this.toast(`Dämmerbecken entzündet · ${lit}/3`);
    this.sound(lit === 3 ? 'solve' : 'flame');
    if (lit === 3) this.addJournal('Drei Flammen', 'Das Siegel der Dämmerung ist aus dem Schatten getreten.');
  }

  useAltar() {
    if (this.sealCount < 3) {
      this.toast(`Dem Prisma fehlen noch ${3 - this.sealCount} Sonnensiegel.`);
      this.sound('blocked');
      return;
    }
    if (this.state.won) {
      this.toast('Das Lichtarchiv leuchtet wieder.');
      return;
    }
    this.state.won = true;
    this.state.score += 1000;
    this.sound('victory');
    this.showDialog({
      speaker: 'Das Lichtarchiv',
      title: 'Liora erwacht',
      portrait: '☀',
      text: 'Die drei Siegel sinken in das Prisma. Goldene Linien jagen durch die Insel, über Brücken, durch Kanäle und tief hinab in das Gewölbe.\n\nFür einen Augenblick siehst du unter Liora ein zweites, dunkles Archiv seine Augen öffnen. Dann schließt sich der Stein darüber.\n\nDu hast die Sonnenwarte erweckt – und etwas viel Älteres entdeckt. Ende von Kapitel I.'
    });
    this.addJournal('Das Lichtarchiv erwacht', 'Kapitel I abgeschlossen. Unter Liora wartet ein zweites Archiv.');
    this.updateUI();
    this.save();
  }

  attack() {
    if (!this.running || this.paused || this.attackFlash > 0) return;
    this.attackFlash = 150;
    const { dx, dy } = directions[this.player.facing];
    const target = this.objectAt(this.player.x + dx, this.player.y + dy, (entry) => entry.type === 'enemy');
    this.sound(target ? 'hit' : 'swing');
    if (!target) return;
    target.hp -= 1;
    if (target.hp <= 0) {
      target.dead = true;
      this.state.score += target.enemy === 'sentinel' ? 150 : 75;
      this.toast(target.enemy === 'shadow' ? 'Der Schatten zerfällt im Laternenlicht.' : 'Wächter ausgeschaltet · Lichtfunken geborgen');
      if (Math.random() < .3 && this.player.hp < this.player.maxHp) this.player.hp += 1;
      this.sound('enemyDown');
      this.updateUI();
    } else this.toast('Treffer!');
    this.save();
  }

  enemyTurn() {
    const enemies = this.room.objects.filter((entry) => entry.type === 'enemy' && !entry.dead);
    for (const enemy of enemies) {
      const distance = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
      if (distance > (enemy.enemy === 'shadow' ? 8 : 6)) continue;
      const xFirst = Math.abs(enemy.x - this.player.x) >= Math.abs(enemy.y - this.player.y);
      const options = xFirst
        ? [[Math.sign(this.player.x - enemy.x), 0], [0, Math.sign(this.player.y - enemy.y)]]
        : [[0, Math.sign(this.player.y - enemy.y)], [Math.sign(this.player.x - enemy.x), 0]];
      for (const [dx, dy] of options) {
        if (dx === 0 && dy === 0) continue;
        const nextX = enemy.x + dx;
        const nextY = enemy.y + dy;
        if (nextX === this.player.x && nextY === this.player.y) {
          this.damagePlayer(enemy.enemy === 'sentinel' ? 2 : 1);
          break;
        }
        const occupied = this.room.objects.some((entry) => entry !== enemy && !entry.collected && !entry.dead && entry.x === nextX && entry.y === nextY && (entry.blocking || ['enemy', 'crate', 'altar'].includes(entry.type)));
        if (!occupied && this.canEnter(this.room, nextX, nextY)) {
          enemy.x = nextX;
          enemy.y = nextY;
          break;
        }
      }
    }
  }

  damagePlayer(amount) {
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.sound('hurt');
    this.updateUI();
    if (this.player.hp <= 0) {
      this.showDialog({
        speaker: 'Die Sonnenuhr ruft dich zurück',
        title: 'Im Schatten gestrauchelt',
        portrait: '◷',
        text: 'Liora lässt dich noch nicht gehen. Du erwachst an der zuletzt berührten Sonnenuhr – mit klarem Kopf und gefüllten Herzen.',
        onClose: () => this.respawn()
      });
    }
  }

  respawn() {
    const checkpoint = this.state.checkpoint;
    this.state.roomId = checkpoint.roomId;
    this.player.x = checkpoint.x;
    this.player.y = checkpoint.y;
    this.player.hp = this.player.maxHp;
    this.clearMovementInput();
    this.syncPlayerMotion();
    this.showRoomBanner();
    this.updateUI();
    this.save();
  }

  showDialog({ speaker, title, text, portrait = '✦', onClose = null }) {
    this.paused = true;
    this.dialogCallback = onClose;
    this.elements['dialog-speaker'].textContent = speaker;
    this.elements['dialog-title'].textContent = title;
    this.elements['dialog-text'].textContent = text;
    this.elements['dialog-portrait'].textContent = portrait;
    this.elements['dialog-backdrop'].hidden = false;
    this.elements['dialog-close'].focus();
  }

  closeDialog() {
    if (this.elements['dialog-backdrop'].hidden) return;
    this.elements['dialog-backdrop'].hidden = true;
    this.paused = !this.elements['map-overlay'].hidden;
    const callback = this.dialogCallback;
    this.dialogCallback = null;
    if (callback) callback();
    this.updateActionPrompt();
  }

  toggleMap(force) {
    if (!this.running || !this.elements['dialog-backdrop'].hidden) return;
    const open = force ?? this.elements['map-overlay'].hidden;
    this.elements['map-overlay'].hidden = !open;
    this.paused = open;
    if (open) this.renderMaps();
  }

  toast(message) {
    clearTimeout(this.toastTimer);
    this.elements['toast'].textContent = message;
    this.elements['toast'].classList.add('is-visible');
    this.toastTimer = setTimeout(() => this.elements['toast'].classList.remove('is-visible'), 2600);
  }

  showRoomBanner() {
    clearTimeout(this.bannerTimer);
    const room = this.room;
    this.elements['room-banner'].innerHTML = `<span>${room.subtitle}</span><strong>${room.name}</strong>`;
    this.elements['room-banner'].classList.add('is-visible');
    this.bannerTimer = setTimeout(() => this.elements['room-banner'].classList.remove('is-visible'), 2100);
  }

  addJournal(title, text) {
    if (this.state.journal.some((entry) => entry.title === title)) return;
    this.state.journal.unshift({ title, text });
    this.updateUI();
  }

  updateActionPrompt() {
    const entry = this.nearestInteractive();
    this.elements['action-prompt'].hidden = !entry;
    if (entry) this.elements['action-prompt'].querySelector('span').textContent = interactionLabels[entry.type] || 'Untersuchen';
  }

  updateUI() {
    const room = this.room;
    this.elements['room-name'].textContent = room.name;
    this.elements['room-kicker'].textContent = room.subtitle;
    this.elements.health.textContent = `${this.player.hp}/${this.player.maxHp}`;
    this.elements.score.textContent = this.state.score.toLocaleString('de-DE');
    this.elements.seals.textContent = `${this.sealCount}/3`;

    if (this.state.won) {
      this.elements['objective-title'].textContent = 'Kapitel I abgeschlossen';
      this.elements['objective-text'].textContent = 'Das Lichtarchiv leuchtet – doch unter Liora wartet etwas.';
    } else if (this.sealCount === 3) {
      this.elements['objective-title'].textContent = 'Erwecke die Sonnenwarte';
      this.elements['objective-text'].textContent = 'Bringe alle drei Siegel zum zentralen Prisma im Südosten.';
    } else {
      const missingSeals = 3 - this.sealCount;
      this.elements['objective-title'].textContent = 'Finde die drei Sonnensiegel';
      this.elements['objective-text'].textContent = `${missingSeals} ${missingSeals === 1 ? 'Siegel fehlt' : 'Siegel fehlen'} noch. Hinweise findest du in alten Notizen.`;
    }
    this.elements['objective-progress'].style.width = `${this.state.won ? 100 : this.sealCount * 30}%`;

    const inventoryEntries = this.inventory.slice(0, 6);
    this.elements.inventory.innerHTML = Array.from({ length: 6 }, (_, index) => {
      const item = ITEMS[inventoryEntries[index]];
      return `<div class="inventory-slot ${item ? 'is-filled' : ''}" ${item ? `title="${item.description}"` : ''}>${item ? `<span class="item-icon">${item.icon}</span><small>${item.name}</small>` : ''}</div>`;
    }).join('');
    this.elements['inventory-count'].textContent = `${this.inventory.length} / 6`;

    this.elements.journal.innerHTML = this.state.journal.slice(0, 8).map((entry) => `<div class="journal-entry"><b>${entry.title}</b><small>${entry.text}</small></div>`).join('');
    this.elements['journal-count'].textContent = this.state.journal.length;
    this.renderMaps();
    this.updateActionPrompt();
  }

  renderMaps() {
    const visited = new Set(this.state.visited);
    const cell = (def, large) => {
      const classes = [large ? 'world-room' : 'mini-room'];
      if (visited.has(def.id)) classes.push('is-visited');
      if (def.id === this.state.roomId) classes.push('is-current');
      if (def.seal && !this.inventory.some((id) => id.startsWith('sigil') && this.sealForRoom(def.id) === id)) classes.push('has-seal');
      const label = visited.has(def.id) ? def.name : 'Unentdeckt';
      return `<div class="${classes.join(' ')}" title="${label}">${large ? `${label}${visited.has(def.id) ? `<small>${def.subtitle}</small>` : ''}` : (def.id === this.state.roomId ? '●' : '')}</div>`;
    };
    this.elements['mini-map'].innerHTML = ROOM_DEFS.map((def) => cell(def, false)).join('');
    this.elements['world-map'].innerHTML = ROOM_DEFS.map((def) => cell(def, true)).join('');
    this.elements['map-count'].textContent = `${visited.size} / ${ROOM_DEFS.length}`;
  }

  sealForRoom(roomId) {
    return { bridge: 'sigilDawn', aqueduct: 'sigilTide', vault: 'sigilDusk' }[roomId];
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.elements['sound-toggle'].classList.toggle('is-off', !this.soundEnabled);
    if (this.soundEnabled) this.sound('pickup');
  }

  sound(type) {
    if (!this.soundEnabled) return;
    try {
      this.audioContext ??= new AudioContext();
      const now = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const settings = {
        blocked: [100, .035, .07], step: [220, .025, .035], pickup: [620, .06, .12],
        talk: [330, .035, .08], paper: [420, .025, .06], push: [130, .04, .09],
        mirror: [280, .04, .1], solve: [760, .07, .22], checkpoint: [520, .06, .18],
        flame: [440, .05, .15], swing: [190, .035, .07], hit: [110, .06, .1],
        hurt: [85, .08, .16], enemyDown: [260, .07, .18], seal: [880, .08, .3], victory: [980, .09, .5]
      };
      const [frequency, volume, duration] = settings[type] || settings.step;
      oscillator.type = ['blocked', 'hurt', 'hit'].includes(type) ? 'square' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now);
      if (['solve', 'seal', 'victory'].includes(type)) oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.55, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch { /* Audio is an enhancement; gameplay stays available without it. */ }
  }

  hasSave() {
    try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; }
  }

  save() {
    if (!this.running) return;
    const objectState = {};
    for (const room of Object.values(this.world)) {
      for (const entry of room.objects) {
        const snapshot = {};
        ['x', 'y', 'orientation', 'lit', 'collected', 'opened', 'dead', 'hp', 'talked', 'read', 'anchored'].forEach((key) => {
          if (entry[key] !== undefined) snapshot[key] = entry[key];
        });
        objectState[entry.id] = snapshot;
      }
    }
    this.state.objectState = objectState;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* private mode */ }
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      const defaults = defaultSaveState();
      const objectState = saved.version === defaults.version ? saved.objectState : {};
      this.state = {
        ...defaults,
        ...saved,
        version: defaults.version,
        objectState,
        player: { ...defaults.player, ...saved.player }
      };
    } catch {
      this.state = defaultSaveState();
    }
  }

  ensurePlayerOnWalkableTile() {
    if (this.room && this.canEnter(this.room, this.player.x, this.player.y)) return;
    const checkpoint = this.state.checkpoint;
    const checkpointRoom = this.world[checkpoint?.roomId];
    if (checkpointRoom && this.canEnter(checkpointRoom, checkpoint.x, checkpoint.y)) {
      this.state.roomId = checkpoint.roomId;
      this.player.x = checkpoint.x;
      this.player.y = checkpoint.y;
      return;
    }
    const defaults = defaultSaveState();
    this.state.roomId = defaults.roomId;
    this.state.player = { ...defaults.player };
    this.state.checkpoint = { ...defaults.checkpoint };
  }

  applyObjectState() {
    for (const room of Object.values(this.world)) {
      for (const entry of room.objects) Object.assign(entry, this.state.objectState?.[entry.id] || {});
    }
  }
}
