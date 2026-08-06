'use strict';

const { resetGlobals } = require('./helpers');

resetGlobals();
const { profile, configureProfileDecorator } = require('../decorator');
const profiler = require('../screeps-profiler');

beforeEach(() => {
  configureProfileDecorator({ enabled: true });
  resetGlobals();
  if (Game.profiler) Game.profiler.reset();
  profiler.enable();
});

describe('decorator', () => {
  describe('configureProfileDecorator', () => {
    it('ignores calls without an enabled option', () => {
      configureProfileDecorator({ enabled: false });
      configureProfileDecorator();
      configureProfileDecorator({});

      class Example {
        run() {
          return 1;
        }
      }

      profile(Example);
      expect(Example.prototype.run.__profiler).toBeUndefined();
    });
  });

  describe('profile class decorator', () => {
    it('registers class methods with the profiler', () => {
      class Example {
        run() {
          return 1;
        }
      }

      profile(Example);

      expect(typeof Example.prototype.run).toBe('function');
      expect(Example.prototype.run.__profiler).toBeDefined();
    });

    it('does nothing when disabled via configureProfileDecorator', () => {
      class Example {
        run() {
          return 1;
        }
      }

      configureProfileDecorator({ enabled: false });
      profile(Example);

      expect(Example.prototype.run.__profiler).toBeUndefined();
    });

    it('supports a dynamic enabled callback', () => {
      class Example {
        run() {
          return 1;
        }
      }

      let enabled = false;
      configureProfileDecorator({ enabled: () => enabled });

      profile(Example);
      expect(Example.prototype.run.__profiler).toBeUndefined();

      enabled = true;
      profile(Example);
      expect(Example.prototype.run.__profiler).toBeDefined();
    });

    it('ignores non-constructible targets', () => {
      expect(() => profile(() => {})).not.toThrow();
      expect(() => profile(null)).not.toThrow();
    });
  });

  describe('profile method decorator', () => {
    it('registers a single method with the profiler', () => {
      class Example {
        run() {
          return 1;
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(Example.prototype, 'run');
      profile(Example.prototype, 'run', descriptor);
      Object.defineProperty(Example.prototype, 'run', descriptor);

      expect(Example.prototype.run.__profiler).toBeDefined();
    });

    it('skips non-function descriptors', () => {
      const obj = {
        get value() {
          return 1;
        },
      };
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'value');
      const originalGet = descriptor.get;

      profile(obj, 'value', descriptor);
      expect(descriptor.get).toBe(originalGet);
      expect(descriptor.value).toBeUndefined();
    });

    it('skips missing descriptors', () => {
      const obj = { run() { return 1; } };
      profile(obj, 'run');
      expect(obj.run.__profiler).toBeUndefined();
    });
  });

  describe('stage 3 decorators', () => {
    it('registers class methods with the profiler', () => {
      class Example {
        run() {
          return 1;
        }
      }

      profile(Example, { kind: 'class', name: 'Example' });

      expect(Example.prototype.run.__profiler).toBeDefined();
    });

    it('ignores class decoration when the target is not a function', () => {
      const target = { run() { return 1; } };
      const result = profile(target, { kind: 'class', name: 'Example' });
      expect(result).toBe(target);
      expect(target.run.__profiler).toBeUndefined();
    });

    it('registers a method with the profiler', () => {
      function run() {
        return 1;
      }

      const wrapped = profile(run, { kind: 'method', name: 'run' });

      expect(wrapped.__profiler).toBeDefined();
    });

    it('registers a standalone function with the profiler', () => {
      function getAllScouts() {
        return [];
      }

      const wrapped = profile(getAllScouts, { kind: 'function', name: 'getAllScouts' });

      expect(wrapped.__profiler).toBeDefined();
    });

    it('returns the original target when disabled', () => {
      function run() {
        return 1;
      }

      configureProfileDecorator({ enabled: false });
      const wrapped = profile(run, { kind: 'method', name: 'run' });

      expect(wrapped).toBe(run);
      expect(wrapped.__profiler).toBeUndefined();
    });

    it('returns the original target for unsupported kinds', () => {
      const initializer = () => 1;
      const result = profile(initializer, { kind: 'field', name: 'count' });
      expect(result).toBe(initializer);
    });
  });
});

