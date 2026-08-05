const js = require('@eslint/js');
const globals = require('globals');

const screepsGlobals = {
  ConstructionSite: 'readonly',
  Creep: 'readonly',
  Deposit: 'readonly',
  Flag: 'readonly',
  Game: 'readonly',
  InterShardMemory: 'readonly',
  Memory: 'readonly',
  Mineral: 'readonly',
  Nuke: 'readonly',
  OwnedStructure: 'readonly',
  PathFinder: 'readonly',
  PowerCreep: 'readonly',
  RawMemory: 'readonly',
  Resource: 'readonly',
  Room: 'readonly',
  RoomObject: 'readonly',
  RoomPosition: 'readonly',
  RoomVisual: 'readonly',
  Ruin: 'readonly',
  Source: 'readonly',
  Store: 'readonly',
  Structure: 'readonly',
  StructureContainer: 'readonly',
  StructureController: 'readonly',
  StructureExtension: 'readonly',
  StructureExtractor: 'readonly',
  StructureFactory: 'readonly',
  StructureInvaderCore: 'readonly',
  StructureKeeperLair: 'readonly',
  StructureLab: 'readonly',
  StructureLink: 'readonly',
  StructureNuker: 'readonly',
  StructureObserver: 'readonly',
  StructurePortal: 'readonly',
  StructurePowerBank: 'readonly',
  StructurePowerSpawn: 'readonly',
  StructureRampart: 'readonly',
  StructureRoad: 'readonly',
  StructureSpawn: 'readonly',
  StructureStorage: 'readonly',
  StructureTerminal: 'readonly',
  StructureTower: 'readonly',
  StructureWall: 'readonly',
  Tombstone: 'readonly',
};

const sharedRules = {
  'no-console': 'off',
  'arrow-body-style': 'off',
  'prefer-rest-params': 'off',
  'no-use-before-define': 'off',
  strict: 'off',
};

module.exports = [
  {
    ignores: ['coverage/**', '**/*.d.ts', 'tsconfig.json'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...screepsGlobals,
      },
    },
    rules: sharedRules,
  },
  {
    files: ['__tests__/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...screepsGlobals,
      },
    },
  },
];
