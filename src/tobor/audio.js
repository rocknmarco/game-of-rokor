const AUDIO_SETTING_KEY = 'rokor-tobor-audio-v1';

const EFFECT_FILES = {
  'charlie-step': '/audio/sfx/step-charlie.ogg',
  'tunnel-step': '/audio/sfx/step-tunnel.ogg',
  'robot-step': '/audio/sfx/step-robot.ogg',
  'dissolve-wall': '/audio/sfx/dissolve-wall.ogg',
  'pickup-misc': '/audio/sfx/pickup-misc.ogg',
  'pickup-key': '/audio/sfx/pickup-key.ogg',
  'pickup-gold': '/audio/sfx/pickup-gold.ogg',
  'use-garlic': '/audio/sfx/use-garlic.ogg',
  'drop-magnet': '/audio/sfx/drop-magnet.ogg',
  'open-door': '/audio/sfx/open-door.ogg',
  'explosion-player': '/audio/sfx/explosion.ogg',
  'explosion-enemy': '/audio/sfx/explosion-short.ogg',
  'shoot-bullet': '/audio/sfx/shoot-bullet.ogg',
  'doppelganger': '/audio/sfx/doppelganger.ogg',
  'hit-plant': '/audio/sfx/hit-plant.ogg',
  'jingle-0': '/audio/sfx/jingle-0.ogg',
  'jingle-1': '/audio/sfx/jingle-1.ogg',
  switch: '/audio/sfx/switch.ogg',
};

const MUSIC_FILES = {
  MUS_NATURE: '/audio/mus/nature.ogg',
};

const audioContextConstructor = () => globalThis.AudioContext ?? globalThis.webkitAudioContext;

export class ToborAudio {
  constructor() {
    this.enabled = this.loadEnabled();
    this.unlocked = false;
    this.currentRoom = null;
    this.currentMusicName = '';
    this.context = null;
    this.buffers = new Map();
    this.activeEffects = new Map();
    this.musicSource = null;
    this.musicGain = null;
    this.fallbackMusic = null;
    this.effectPools = new Map();
    this.preloadPromise = null;
  }

  loadEnabled() {
    try {
      const saved = JSON.parse(localStorage.getItem(AUDIO_SETTING_KEY) ?? '{}');
      return saved.enabled !== false;
    } catch {
      return true;
    }
  }

  saveEnabled() {
    try {
      localStorage.setItem(AUDIO_SETTING_KEY, JSON.stringify({ enabled: this.enabled }));
    } catch {
      // Audio remains usable when browser storage is unavailable.
    }
  }

  ensureContext() {
    if (this.context) return this.context;
    const Context = audioContextConstructor();
    if (!Context) return null;
    this.context = new Context({ latencyHint: 'interactive' });
    return this.context;
  }

  prepare() {
    if (this.preloadPromise) return this.preloadPromise;
    const context = this.ensureContext();
    if (!context) {
      this.prepareFallbackEffects();
      this.preloadPromise = Promise.resolve(false);
      return this.preloadPromise;
    }

    const files = [...Object.entries(EFFECT_FILES), ...Object.entries(MUSIC_FILES)];
    this.preloadPromise = Promise.allSettled(files.map(async ([name, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Audio konnte nicht geladen werden: ${url}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(name, buffer);
    })).then((results) => {
      if (results.some((result) => result.status === 'rejected')) this.prepareFallbackEffects();
      return this.buffers.size > 0;
    });
    return this.preloadPromise;
  }

  prepareFallbackEffects() {
    if (typeof Audio === 'undefined') return;
    for (const [name, url] of Object.entries(EFFECT_FILES)) {
      if (this.effectPools.has(name)) continue;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
      this.effectPools.set(name, [audio]);
    }
  }

  unlock() {
    this.unlocked = true;
    this.prepare();
    this.context?.resume().catch(() => {});
    if (this.enabled && this.currentRoom) this.setRoom(this.currentRoom, true);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.saveEnabled();
    if (!this.enabled) this.stopMusic();
    else if (this.unlocked && this.currentRoom) this.setRoom(this.currentRoom, true);
    return this.enabled;
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  play(name, { volume = 0.48 } = {}) {
    if (!this.enabled || !this.unlocked || !EFFECT_FILES[name]) return;
    const buffer = this.buffers.get(name);
    const context = this.context;
    if (!buffer || !context) {
      this.playFallback(name, volume);
      return;
    }
    if (context.state === 'suspended') context.resume().catch(() => {});

    const active = this.activeEffects.get(name) ?? new Set();
    if (active.size >= 3) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(context.destination);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    active.add(source);
    this.activeEffects.set(name, active);
    source.start(context.currentTime);
  }

  playFallback(name, volume) {
    if (typeof Audio === 'undefined') return;
    const pool = this.effectPools.get(name) ?? [];
    const available = pool.find((audio) => audio.paused || audio.ended);
    if (!available && pool.length >= 3) return;
    const audio = available ?? new Audio(EFFECT_FILES[name]);
    if (!available) {
      audio.preload = 'auto';
      pool.push(audio);
      this.effectPools.set(name, pool);
    }
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  roomMusic(room) {
    if (MUSIC_FILES[room?.music]) return room.music;
    const hasNature = room?.objects?.some((object) => object.alive !== false && object.id.startsWith('OBJ_WOOD'));
    return hasNature ? 'MUS_NATURE' : '';
  }

  setRoom(room, force = false) {
    this.currentRoom = room;
    if (!this.enabled || !this.unlocked) return;
    const name = this.roomMusic(room);
    if (!force && name === this.currentMusicName) return;
    if (!name) {
      this.stopMusic();
      return;
    }
    if (name === this.currentMusicName && (this.musicSource || this.fallbackMusic)) return;
    this.stopMusic();

    const context = this.context;
    const buffer = this.buffers.get(name);
    if (context && buffer) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0.22;
      source.connect(gain).connect(context.destination);
      source.start(context.currentTime);
      this.musicSource = source;
      this.musicGain = gain;
      this.currentMusicName = name;
      return;
    }

    if (typeof Audio !== 'undefined') {
      const audio = new Audio(MUSIC_FILES[name]);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.22;
      this.fallbackMusic = audio;
      this.currentMusicName = name;
      audio.play().catch(() => {});
    }
  }

  stopMusic() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // A source can already have ended while the room changes.
      }
      this.musicSource.disconnect();
      this.musicGain?.disconnect();
    }
    if (this.fallbackMusic) {
      this.fallbackMusic.pause();
      this.fallbackMusic.currentTime = 0;
    }
    this.musicSource = null;
    this.musicGain = null;
    this.fallbackMusic = null;
    this.currentMusicName = '';
  }
}
