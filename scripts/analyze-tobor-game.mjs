import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [roomsPath, translationsPath, outputPath] = process.argv.slice(2);

if (!roomsPath || !translationsPath || !outputPath) {
  console.error(
    'Usage: node scripts/analyze-tobor-game.mjs <rooms.json> <translation.json> <output.json>',
  );
  process.exit(1);
}

const gameData = JSON.parse(readFileSync(resolve(roomsPath), 'utf8'));
const rooms = Object.fromEntries(
  Object.entries(gameData).filter(([key, value]) =>
    /^ROOM_\d+$/.test(key) && value && Array.isArray(value.data),
  ),
);
const metadata = Object.fromEntries(
  Object.entries(gameData).filter(([key]) => !Object.hasOwn(rooms, key)),
);
const translations = JSON.parse(readFileSync(resolve(translationsPath), 'utf8'));

const histogram = () => new Map();
const add = (map, value, amount = 1) => {
  const key = String(value);
  map.set(key, (map.get(key) ?? 0) + amount);
};
const sortedHistogram = (map) =>
  Object.fromEntries(
    [...map.entries()].sort(([aKey, aCount], [bKey, bCount]) =>
      bCount - aCount || aKey.localeCompare(bKey, 'en', { numeric: true }),
    ),
  );
const sortedValues = (values) =>
  [...values].sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true }));

const roomPropertyCounts = histogram();
const objectPropertyCounts = histogram();
const roomObjectCounts = histogram();
const roomIdsByCoordinate = new Map();
const roomIdsByWorldCoordinate = new Map();
const roomLevelCounts = histogram();
const objectStats = new Map();
const referencedFlags = histogram();
const dimensions = {
  roomX: { min: Infinity, max: -Infinity },
  roomY: { min: Infinity, max: -Infinity },
  objectX: { min: Infinity, max: -Infinity },
  objectY: { min: Infinity, max: -Infinity },
};
let objectCount = 0;

for (const [roomId, room] of Object.entries(rooms)) {
  Object.keys(room).forEach((key) => add(roomPropertyCounts, key));
  dimensions.roomX.min = Math.min(dimensions.roomX.min, room.x);
  dimensions.roomX.max = Math.max(dimensions.roomX.max, room.x);
  dimensions.roomY.min = Math.min(dimensions.roomY.min, room.y);
  dimensions.roomY.max = Math.max(dimensions.roomY.max, room.y);
  add(roomLevelCounts, room.z);

  const coordinate = `${room.x},${room.y}`;
  if (!roomIdsByCoordinate.has(coordinate)) roomIdsByCoordinate.set(coordinate, []);
  roomIdsByCoordinate.get(coordinate).push(roomId);
  const worldCoordinate = `${room.x},${room.y},${room.z}`;
  if (!roomIdsByWorldCoordinate.has(worldCoordinate)) roomIdsByWorldCoordinate.set(worldCoordinate, []);
  roomIdsByWorldCoordinate.get(worldCoordinate).push(roomId);

  const data = Array.isArray(room.data) ? room.data : [];
  add(roomObjectCounts, roomId, data.length);

  for (const object of data) {
    objectCount += 1;
    Object.keys(object).forEach((key) => add(objectPropertyCounts, key));
    dimensions.objectX.min = Math.min(dimensions.objectX.min, object.x);
    dimensions.objectX.max = Math.max(dimensions.objectX.max, object.x);
    dimensions.objectY.min = Math.min(dimensions.objectY.min, object.y);
    dimensions.objectY.max = Math.max(dimensions.objectY.max, object.y);
    if (object.flag !== undefined && object.flag !== -1) add(referencedFlags, object.flag);

    const id = object.id ?? '<missing-id>';
    if (!objectStats.has(id)) {
      objectStats.set(id, {
        count: 0,
        rooms: new Set(),
        propertySignatures: histogram(),
        propertyCounts: histogram(),
        types: histogram(),
        subTypes: histogram(),
        drifts: histogram(),
        flags: histogram(),
        examples: [],
      });
    }
    const stats = objectStats.get(id);
    stats.count += 1;
    stats.rooms.add(roomId);
    Object.keys(object).forEach((key) => add(stats.propertyCounts, key));
    add(stats.propertySignatures, Object.keys(object).sort().join(','));
    add(stats.types, object.type);
    add(stats.subTypes, object.subType);
    add(stats.drifts, object.drift);
    add(stats.flags, object.flag);
    if (stats.examples.length < 5) stats.examples.push({ roomId, ...object });
  }
}

const objectCatalog = Object.fromEntries(
  [...objectStats.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, stats]) => [
      id,
      {
        count: stats.count,
        roomCount: stats.rooms.size,
        rooms: sortedValues(stats.rooms),
        propertySignatures: sortedHistogram(stats.propertySignatures),
        propertyCounts: sortedHistogram(stats.propertyCounts),
        types: sortedHistogram(stats.types),
        subTypes: sortedHistogram(stats.subTypes),
        drifts: sortedHistogram(stats.drifts),
        flags: sortedHistogram(stats.flags),
        examples: stats.examples,
      },
    ]),
);

const translationPrefixCounts = histogram();
const missingGermanTranslations = [];
for (const [key, value] of Object.entries(translations)) {
  const prefix = key.match(/^[A-Z]+(?:_[A-Z]+)*/)?.[0] ?? '<other>';
  add(translationPrefixCounts, prefix);
  if (!value || typeof value.de !== 'string' || value.de.trim() === '') {
    missingGermanTranslations.push(key);
  }
}

const interestingPattern =
  /(CHARLIE|ROBOT|START|EXIT|GOAL|DIAMOND|GEM|STAIR|LADDER|TELE|PORTAL|DOOR|KEY|LOCK|SWITCH|BUTTON|CHEST|CRATE|ENEMY|MONSTER|WATER|SWIM|FIN|GARLIC|ALTAR|GOLD|LAMP|LIGHT|DARK|HOLE|PIT|SECRET|WALL|BULLET|BOMB|MAGNET|DOPPEL|PLANT|SHIP)/i;
const interestingObjects = Object.fromEntries(
  Object.entries(objectCatalog).filter(([id]) => interestingPattern.test(id)),
);

const report = {
  source: {
    roomsPath: resolve(roomsPath),
    translationsPath: resolve(translationsPath),
  },
  metadata,
  summary: {
    roomCount: Object.keys(rooms).length,
    objectCount,
    objectIdCount: objectStats.size,
    translationCount: Object.keys(translations).length,
    dimensions,
  },
  roomPropertyCounts: sortedHistogram(roomPropertyCounts),
  roomLevelCounts: sortedHistogram(roomLevelCounts),
  objectPropertyCounts: sortedHistogram(objectPropertyCounts),
  duplicateRoomCoordinates: Object.fromEntries(
    [...roomIdsByCoordinate.entries()]
      .filter(([, ids]) => ids.length > 1)
      .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  ),
  duplicateWorldCoordinates: Object.fromEntries(
    [...roomIdsByWorldCoordinate.entries()]
      .filter(([, ids]) => ids.length > 1)
      .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  ),
  roomObjectCounts: sortedHistogram(roomObjectCounts),
  referencedFlags: sortedHistogram(referencedFlags),
  translationPrefixCounts: sortedHistogram(translationPrefixCounts),
  missingGermanTranslations,
  interestingObjects,
  objectCatalog,
};

const destination = resolve(outputPath);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Analyzed ${report.summary.roomCount} rooms, ${objectCount} objects and ${objectStats.size} object IDs.`,
);
console.log(`Report: ${destination}`);
