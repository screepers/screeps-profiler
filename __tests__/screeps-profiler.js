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

function tick(times = 1) {
  let _times = times;
  while (_times > 0) {
    profiler.wrap(() => {});
    Game.time++;
    _times--;
  }
}

describe('screeps-profiler', () => {
  describe('profiling', () => {
    beforeEach(() => {
      // setup the profiler.
      if (Game.profiler) Game.profiler.reset();
      profiler.enable();
      tick();
    });

    describe('registerFN', () => {
      it('returns a wrapped function', () => {
        const result = profiler.registerFN(add);
        expect(typeof result).toBe('function');
        expect(result.__profiler).not.toBeNull();
      });

      it('returns a function with the same scope as the one passed in', () => {
        const passedScope = { test: 1 };
        const result = profiler.registerFN(returnsScope.bind(passedScope));
        expect(result()).toBe(passedScope);
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
        expect(myObject.add.__profiler).not.toBeNull();
        expect(myObject.returnsScope.__profiler).not.toBeNull();
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
        expect(descriptors.get.__profiler).not.toBeNull();
        expect(descriptors.set.__profiler).not.toBeNull();
        expect(myObj.someValue).toBe(5);
        myObj.someValue = 7;
        expect(myObj.someValue).toBe(7);
      });

      it('throws when registering an invalid object', () => {
        expect(() => {
          profiler.registerObject(undefined);
        }).toThrow(profiler.Error);
        expect(() => {
          profiler.registerObject('yo');
        }).toThrow(profiler.Error);
      });
    });

    describe('registerClass', () => {
      it('wraps each prototype function on a class', () => {
        class MyFakeClass {
          someFakeMethod() {
          }
        }
        profiler.registerClass(MyFakeClass);
        expect(MyFakeClass.prototype.someFakeMethod).not.toBeNull();
      });

      it('wraps each static function on a class', () => {
        class MyFakeClass {
          static someFakeStaticMethod() {
          }
        }
        profiler.registerClass(MyFakeClass);
        expect(MyFakeClass.someFakeStaticMethod.__profiler).not.toBeNull();
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

      it('can be in callgrind format', () => {
        Game.profiler.callgrind(10);
        const N = 5;
        const someFakeFunction = profiler.registerFN(() => {}, 'someFakeFunction');
        const someFakeParent = profiler.registerFN(() => someFakeFunction(), 'someFakeParent');
        for (let i = 0; i < N; ++i) {
          someFakeFunction();
          someFakeParent();
        }
        const format = profiler.callgrind();
        expect(format).toMatch(/fn=someFakeParent/);
        expect(format).toMatch(/cfn=someFakeFunction/);
        expect(format).toMatch(/fn=someFakeFunction/);
      });
    });

    describe('callCounting', () => {
      it('correctly count function calls', () => {
        Game.profiler.profile(10);
        const N = 5;
        const someFakeFunction = profiler.registerFN(() => {}, 'someFakeFunction');
        for (let i = 0; i < N; ++i) {
          someFakeFunction();
        }
        expect(Memory.profiler.map.someFakeFunction.calls).toBe(N);
      });

      it('correctly count parent function calls', () => {
        Game.profiler.profile(10);
        const N = 5;
        const someFakeFunction = profiler.registerFN(() => {}, 'someFakeFunction');
        const someFakeParent = profiler.registerFN(() => someFakeFunction(), 'someFakeParent');
        for (let i = 0; i < N; ++i) {
          someFakeFunction();
          someFakeParent();
        }
        expect(Memory.profiler.map.someFakeParent.calls).toBe(N);
        expect(Memory.profiler.map.someFakeParent.subs.someFakeFunction.calls).toBe(N);
        expect(Memory.profiler.map.someFakeFunction.calls).toBe(2 * N);
      });
    });

    describe('starting', () => {
      it('can start in streaming mode', () => {
        Game.profiler.stream(1);
        tick(2);
      });

      it('can start in email mode', () => {
        Game.profiler.email(1);
        tick(2);
      });

      it('can start in profile mode', () => {
        Game.profiler.profile(1);
        tick(2);
      });

      it('can start in background mode', () => {
        Game.profiler.background(1);
        tick(2);
      });

      it('can start in callgrind mode', () => {
        Game.profiler.callgrind(1);
        tick(2);
      });
    });

    describe('callgrind output', () => {
      it('logs an error if not profiling', () => {
        Game.profiler.downloadCallgrind();
      });

      it('can be downloaded', () => {
        Game.profiler.profile(1);
        tick(2);
        Game.profiler.downloadCallgrind();
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
