'use strict';

let start = Date.now();
resetGlobals(); // needs to be called before requiring the profiler.
const profiler = require('../screeps-profiler');

beforeEach(() => {
  resetGlobals();
  start = Date.now();
});

function add(a, b) {
  return a + b;
}

function returnsScope() {
  return this;
}

describe('screeps-profiler', () => {
  describe('profiling', () => {
    beforeEach(() => {
      // setup the profiler.
      if (Game.profiler) Game.profiler.reset();
      profiler.enable();
      profiler.wrap(() => {});
    });

    describe('registerFN', () => {
      it('returns a wrapped function', () => {
        const result = profiler.registerFN(add);
        expect(typeof result).toBe('function');
        expect(result.profilerWrapped).toBe(true);
      });

      it('returns a function with the same scope as the one passed in', () => {
        const passedScope = { test: 1 };
        const result = profiler.registerFN(returnsScope.bind(passedScope));
        expect(result()).toBe(passedScope);
      });

      it('throws an error if you attempt to double wrap a function', () => {
        const result = profiler.registerFN(add);
        expect(() => {
          profiler.registerFN(result);
        }).toThrow();
      });

      it('should attempt some toString() preservation', () => {
        const result = profiler.registerFN(add);
        expect(result.toString().includes(add.toString())).toBe(true);
      });

      it('should preserve properties', () => {
        const func1 = function func1() {};
        func1.prop1 = 1;
        const result1 = profiler.registerFN(func1);
        expect(result1.prop1).toBe(func1.prop1);

        const func2 = () => {};
        func2.prop2 = 2;
        const result2 = profiler.registerFN(func2);
        expect(result2.prop2).toBe(func2.prop2);
      });

      it('should preserve constructor behavior', () => {
        class SomeClass {}
        const ResultClass = profiler.registerFN(SomeClass);
        expect(new ResultClass() instanceof SomeClass).toBe(true);
      });
    });

    describe('registerObject', () => {
      it('wraps each function on an object', () => {
        const myObject = {
          add,
          returnsScope,
          doesNotCauseError: 3,
          doesNotCauseError2: {},
        };

        profiler.registerObject(myObject);
        expect(myObject.add.profilerWrapped).toBe(true);
        expect(myObject.returnsScope.profilerWrapped).toBe(true);
      });

      it('correctly wraps getter/setter functions', () => {
        let myValue = 5;
        const myObj = {
          get someValue() {
            return myValue;
          },
          set someValue(value) {
            myValue = value;
          },
        };

        profiler.registerObject(myObj);
        const descriptors = Object.getOwnPropertyDescriptor(myObj, 'someValue');
        expect(descriptors.get.profilerWrapped).toBe(true);
        expect(descriptors.set.profilerWrapped).toBe(true);
        expect(myObj.someValue).toBe(5);
        myObj.someValue = 7;
        expect(myObj.someValue).toBe(7);
      });
    });

    describe('registerClass', () => {
      it('wraps each prototype function on a class', () => {
        class MyFakeClass {
          someFakeMethod() {
          }
        }
        profiler.registerClass(MyFakeClass);
        expect(MyFakeClass.prototype.someFakeMethod.profilerWrapped).toBe(true);
      });

      it('wraps each static function on a class', () => {
        class MyFakeClass {
          static someFakeStaticMethod() {
          }
        }
        profiler.registerClass(MyFakeClass);
        expect(MyFakeClass.someFakeStaticMethod.profilerWrapped).toBe(true);
      });
    });

    describe('output', () => {
      it('does not explode if there are no profiled functions', () => {
        Game.profiler.profile(10);
        expect(profiler.output).not.toThrow();
      });

      it('correctly limits the length of the output', () => {
        Game.profiler.profile(10);
        let functionsWrappedAndRan = 0;
        while (functionsWrappedAndRan < 1000) {
          const fn = profiler.registerFN(() => {}, `someFakeName${functionsWrappedAndRan}`);
          fn();
          functionsWrappedAndRan++;
        }
        const output = profiler.output();
        expect(output.length > 500).toBe(true);
        expect(output.length <= 1000).toBe(true);
        const smallerOutput = profiler.output(300);
        expect(smallerOutput.length > 100).toBe(true);
        expect(smallerOutput.length <= 300).toBe(true);
      });
    });
  });
});

function resetGlobals() {
  global.Game = {
    cpu: {
      getUsed() {
        return Date.now() - start;
      },
    },
    rooms: {},
    time: 10,
    map: {},
    market: {},
  };
  global.Memory = {};
  global.PathFinder = {};
  global.RawMemory = {};
  global.ConstructionSite = {};
  global.Creep = {};
  global.Flag = {};
  global.Mineral = {};
  global.Nuke = {};
  global.OwnedStructure = {};
  global.PathFinder.CostMatrix = {};
  global.Resource = {};
  global.Room = {};
  global.RoomObject = {};
  global.RoomPosition = {};
  global.RoomVisual = {};
  global.Source = {};
  global.Structure = {};
  global.StructureContainer = {};
  global.StructureController = {};
  global.StructureExtension = {};
  global.StructureExtractor = {};
  global.StructureKeeperLair = {};
  global.StructureLab = {};
  global.StructureLink = {};
  global.StructureNuker = {};
  global.StructureObserver = {};
  global.StructurePowerBank = {};
  global.StructurePowerSpawn = {};
  global.StructurePortal = {};
  global.StructureRampart = {};
  global.StructureRoad = {};
  global.StructureSpawn = {};
  global.StructureStorage = {};
  global.StructureTerminal = {};
  global.StructureTower = {};
  global.StructureWall = {};
}
