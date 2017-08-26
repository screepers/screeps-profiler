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
      class MyFakeClass {
        someFakeMethod() {

        }
      }
      profiler.registerClass(MyFakeClass);
      expect(MyFakeClass.prototype.someFakeMethod.profilerWrapped).toBe(true);
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

      it('callgrind format', () => {
        Game.profiler.profile(10);
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
  };
  global.Memory = {};
  global.Room = {};
  global.Structure = {};
  global.Spawn = {};
  global.Creep = {};
  global.RoomPosition = {};
  global.Source = {};
  global.Flag = {};
}
