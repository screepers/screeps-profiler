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
  });
});

