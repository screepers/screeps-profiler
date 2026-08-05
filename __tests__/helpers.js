'use strict';

function resetGlobals(options = {}) {
  const getUsed = options.getUsed ?? (() => 0);

  global.Game = {
    cpu: { getUsed },
    notify(msg) {
      return msg;
    },
    shard: { name: 'test' },
    rooms: {},
    time: 10,
    map: {},
    market: {},
  };
  global.Memory = {};

  console.logUnsafe = jest.fn((...args) => {
    console.log(...args);
  });

  global.ConstructionSite = class {};
  global.Creep = class {};
  global.Deposit = class {};
  global.Flag = class {};
  global.InterShardMemory = class {};
  global.Mineral = class {};
  global.Nuke = class {};
  global.OwnedStructure = class {};
  global.PathFinder = class {};
  global.PowerCreep = class {};
  global.RawMemory = class {};
  global.Resource = class {};
  global.Room = class {};
  global.RoomObject = class {};
  global.RoomPosition = class {};
  global.RoomVisual = class {};
  global.Ruin = class {};
  global.Source = class {};
  global.Store = class {};
  global.Structure = class {};
  global.StructureContainer = class {};
  global.StructureController = class {};
  global.StructureExtension = class {};
  global.StructureExtractor = class {};
  global.StructureFactory = class {};
  global.StructureInvaderCore = class {};
  global.StructureKeeperLair = class {};
  global.StructureLab = class {};
  global.StructureLink = class {};
  global.StructureNuker = class {};
  global.StructureObserver = class {};
  global.StructurePortal = class {};
  global.StructurePowerBank = class {};
  global.StructurePowerSpawn = class {};
  global.StructureRampart = class {};
  global.StructureRoad = class {};
  global.StructureSpawn = class {};
  global.StructureStorage = class {};
  global.StructureTerminal = class {};
  global.StructureTower = class {};
  global.StructureWall = class {};
  global.Tombstone = class {};
}

module.exports = { resetGlobals };
