const ROOM_ID_PATTERN = /^ROOM_(\d+)$/;

function resolveAsset(manifestUrl, relativePath) {
  return new URL(relativePath, new URL(manifestUrl, window.location.href)).href;
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} konnte nicht geladen werden (${response.status}).`);
  return response.json();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Grafik konnte nicht geladen werden: ${url}`));
    image.src = url;
  });
}

async function loadStyleAssets(manifestUrl, files) {
  if (!files) return null;
  const urls = Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, resolveAsset(manifestUrl, value)]),
  );
  const [objects, objectsMap, landscape, landscapeMap, textures, stoneTexture, waterTexture, player, playerMap] = await Promise.all([
    loadImage(urls.objects),
    fetchJson(urls.objectsMap, 'Rokor-Objektatlas'),
    loadImage(urls.landscape),
    fetchJson(urls.landscapeMap, 'Rokor-Landschaftsatlas'),
    loadImage(urls.textures),
    urls.stoneTexture ? loadImage(urls.stoneTexture) : null,
    urls.waterTexture ? loadImage(urls.waterTexture) : null,
    loadImage(urls.player),
    fetchJson(urls.playerMap, 'Rokor-Laufanimation'),
  ]);
  return {
    images: { objects, landscape, textures, stoneTexture, waterTexture, player },
    maps: { objects: objectsMap, landscape: landscapeMap, player: playerMap },
    urls,
  };
}

function normalizeTranslations(raw, locale) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : value?.[locale] ?? value?.de ?? key,
    ]),
  );
}

function normalizeRoom(id, source) {
  const match = id.match(ROOM_ID_PATTERN);
  return {
    id,
    numericId: match?.[1] ?? id,
    x: Number(source.x),
    y: Number(source.y),
    z: Number(source.z),
    darkness: Number(source.darkness ?? 0),
    music: source.music ?? '',
    source,
    objects: source.data.map((object, index) => ({
      ...object,
      runtimeId: `${id}:${index}`,
      alive: true,
    })),
  };
}

export async function loadToborGame(manifestUrl = '/games/insel-der-ruinen/game.json', onProgress) {
  onProgress?.('Manifest wird geladen …', 0.05);
  const manifest = await fetchJson(manifestUrl, 'Spielmanifest');
  const roomsUrl = resolveAsset(manifestUrl, manifest.files.rooms);
  const translationsUrl = resolveAsset(manifestUrl, manifest.files.translations);
  const baseTranslationsUrl = manifest.files.baseTranslations
    ? resolveAsset(manifestUrl, manifest.files.baseTranslations)
    : null;
  const tilesetUrl = resolveAsset(manifestUrl, manifest.files.tileset);

  onProgress?.('Räume werden gelesen …', 0.18);
  const [rawWorld, rawTranslations, rawBaseTranslations, tileset, style] = await Promise.all([
    fetchJson(roomsUrl, 'rooms.json'),
    fetchJson(translationsUrl, 'translation.json'),
    baseTranslationsUrl ? fetchJson(baseTranslationsUrl, 'Tobor-Basisübersetzung') : {},
    loadImage(tilesetUrl),
    loadStyleAssets(manifestUrl, manifest.presentation?.styleAssets),
  ]);

  const rooms = new Map();
  const roomsByCoordinate = new Map();
  const metadata = {};

  for (const [key, value] of Object.entries(rawWorld)) {
    if (ROOM_ID_PATTERN.test(key) && value && Array.isArray(value.data)) {
      const room = normalizeRoom(key, value);
      rooms.set(key, room);
      roomsByCoordinate.set(`${room.x},${room.y},${room.z}`, room);
    } else {
      metadata[key] = value;
    }
  }

  const locale = manifest.presentation?.locale ?? 'de';
  const translations = {
    ...normalizeTranslations(rawBaseTranslations, locale),
    ...normalizeTranslations(rawTranslations, locale),
  };
  const text = (key, fallback = key) => translations[key] ?? fallback;

  onProgress?.('Insel ist bereit', 1);
  return {
    manifest,
    metadata,
    rooms,
    roomsByCoordinate,
    translations,
    tileset,
    style,
    assets: { roomsUrl, translationsUrl, baseTranslationsUrl, tilesetUrl },
    text,
    roomAt(x, y, z) {
      return roomsByCoordinate.get(`${x},${y},${z}`) ?? null;
    },
    roomName(room) {
      return text(`TXT_${room.id}`, `Raum ${room.numericId}`);
    },
  };
}
