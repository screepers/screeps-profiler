'use strict';

const { resetGlobals } = require('./helpers');

let start = Date.now();
resetGlobals({ getUsed: () => Date.now() - start }); // needs to be called before requiring the profiler.
const profiler = require('../screeps-profiler');

beforeEach(() => {
  start = Date.now();
  resetGlobals({ getUsed: () => Date.now() - start });
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

      it('should record constructor calls while profiling', () => {
        Game.profiler.profile(10);
        class SomeClass {}
        const ResultClass = profiler.registerFN(SomeClass, 'SomeClass');
        expect(new ResultClass() instanceof SomeClass).toBe(true);
        expect(Memory.profiler.map.SomeClass.calls).toBe(1);
      });

      it('does not wrap anonymous functions without a name', () => {
        // Comma expression avoids ES6 name inference from the binding.
        const fn = (0, function () {});
        expect(fn.name).toBe('');
        const result = profiler.registerFN(fn);
        expect(result).toBe(fn);
        expect(result.__profiler).toBeUndefined();
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

      it('wraps getter-only accessors', () => {
        const obj = {
          get onlyGet() {
            return 1;
          },
        };

        profiler.registerObject(obj, 'obj');
        const descriptor = Object.getOwnPropertyDescriptor(obj, 'onlyGet');
        expect(descriptor.get.__profiler).not.toBeNull();
        expect(descriptor.set).toBeUndefined();
      });

      it('wraps setter-only accessors', () => {
        const obj = {
          set onlySet(value) {
            this._value = value;
          },
        };

        profiler.registerObject(obj, 'obj');
        const descriptor = Object.getOwnPropertyDescriptor(obj, 'onlySet');
        expect(descriptor.set.__profiler).not.toBeNull();
        expect(descriptor.get).toBeUndefined();
      });

      it('throws when registering an invalid object', () => {
        expect(() => {
          profiler.registerObject(undefined);
        }).toThrow(profiler.Error);
        expect(() => {
          profiler.registerObject('yo');
        }).toThrow(profiler.Error);
      });

      it('skips non-configurable accessors', () => {
        const obj = {};
        Object.defineProperty(obj, 'locked', {
          get() {
            return 1;
          },
          configurable: false,
        });
        const originalGetter = Object.getOwnPropertyDescriptor(obj, 'locked').get;

        profiler.registerObject(obj, 'obj');

        expect(Object.getOwnPropertyDescriptor(obj, 'locked').get).toBe(originalGetter);
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
      it('reports when the profiler is not active', () => {
        Game.profiler.reset();
        expect(profiler.output()).toBe('Profiler not active.');
      });

      it('does not explode if there are no profiled functions', () => {
        Game.profiler.profile(10);
        expect(profiler.output).not.toThrow();
      });

      it('does not explode if there are no duration set', () => {
        Game.profiler.profile();
        expect(profiler.output).not.toThrow();
      });

      it('uses Game.time when outputting a background profile', () => {
        Game.profiler.background();
        expect(profiler.output()).toContain('Ticks:');
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

      it('can record a function without a parent', () => {
        Game.profiler.profile(10);
        const fn = profiler.registerFN(() => {}, 'orphan');
        fn.__profiler.record('orphan', 1.5);
        expect(Memory.profiler.map.orphan.calls).toBe(1);
        expect(Memory.profiler.map.orphan.time).toBe(1.5);
        expect(Memory.profiler.map.orphan.subs).toEqual({});
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

      it('only records the filtered function and its nested calls', () => {
        Game.profiler.profile(10, 'target');
        const nested = profiler.registerFN(() => {}, 'nested');
        const target = profiler.registerFN(() => nested(), 'target');
        const other = profiler.registerFN(() => {}, 'other');

        other();
        target();

        expect(Memory.profiler.map.other).toBeUndefined();
        expect(Memory.profiler.map.target.calls).toBe(1);
        expect(Memory.profiler.map.nested.calls).toBe(1);
        expect(Memory.profiler.map.target.subs.nested.calls).toBe(1);
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

      it('uses default durations when omitted', () => {
        Game.profiler.stream();
        expect(Memory.profiler.disableTick - Memory.profiler.enabledTick + 1).toBe(10);

        Game.profiler.email();
        expect(Memory.profiler.disableTick - Memory.profiler.enabledTick + 1).toBe(100);

        Game.profiler.callgrind();
        expect(Memory.profiler.disableTick - Memory.profiler.enabledTick + 1).toBe(100);
      });
    });

    describe('restart', () => {
      it('restarts a timed profile with the original duration and filter', () => {
        Game.profiler.profile(10, 'target');
        const duration =
          Memory.profiler.disableTick - Memory.profiler.enabledTick + 1;

        Game.profiler.restart();

        expect(Memory.profiler.type).toBe('profile');
        expect(Memory.profiler.filter).toBe('target');
        expect(Memory.profiler.disableTick - Memory.profiler.enabledTick + 1).toBe(
          duration
        );
      });

      it('restarts a background profile without a duration', () => {
        Game.profiler.background('target');
        Game.profiler.restart();

        expect(Memory.profiler.type).toBe('background');
        expect(Memory.profiler.filter).toBe('target');
        expect(Memory.profiler.disableTick).toBe(false);
      });

      it('does nothing when the profiler is not running', () => {
        Game.profiler.reset();
        Game.profiler.restart();
        expect(Memory.profiler).toBeNull();
      });
    });

    describe('isProfiling', () => {
      it('reflects whether profiling is currently active', () => {
        expect(profiler.isProfiling()).toBe(false);
        Game.profiler.profile(10);
        expect(profiler.isProfiling()).toBe(true);
      });
    });

    describe('sim cpu', () => {
      it('overrides Game.cpu.getUsed in the simulator', () => {
        Game.rooms.sim = {};
        Game.profiler.profile(10);
        const originalGetUsed = Game.cpu.getUsed;

        profiler.wrap(() => {});

        expect(Game.cpu.getUsed).not.toBe(originalGetUsed);
        expect(typeof Game.cpu.getUsed()).toBe('number');
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

      it('includes -ptr in the download filename on PTR shards', () => {
        Game.shard.ptr = true;
        Game.profiler.profile(1);
        tick(1);
        Game.profiler.downloadCallgrind();
        expect(console.logUnsafe).toHaveBeenCalledWith(
          expect.stringContaining('callgrind.out.test-ptr.')
        );
      });
    });
  });

  describe('module load edge cases', () => {
    it('defines InterShardMemory when it is missing', () => {
      jest.isolateModules(() => {
        resetGlobals();
        delete global.InterShardMemory;
        require('../screeps-profiler');
        expect(global.InterShardMemory).toBeUndefined();
      });
    });

    it('skips prototype hooks when the object is missing', () => {
      jest.isolateModules(() => {
        resetGlobals();
        global.PowerCreep = undefined;
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const isolatedProfiler = require('../screeps-profiler');
        isolatedProfiler.enable();
        expect(log).toHaveBeenCalledWith(
          'skipping prototype hook PowerCreep, object appears to be missing'
        );
        log.mockRestore();
      });
    });

    it('wraps callbacks without enabling the profiler', () => {
      jest.isolateModules(() => {
        resetGlobals();
        const isolatedProfiler = require('../screeps-profiler');
        expect(isolatedProfiler.wrap(() => 42)).toBe(42);
        expect(Game.profiler).toBeUndefined();
        expect(isolatedProfiler.isProfiling()).toBe(false);
      });
    });
  });
});

