'use strict';

const profiler = require('./screeps-profiler');

let profileDecoratorEnabled = true;

function isEnabled() {
  return typeof profileDecoratorEnabled === 'function'
    ? profileDecoratorEnabled()
    : profileDecoratorEnabled;
}

function configureProfileDecorator(options) {
  if (options && Object.prototype.hasOwnProperty.call(options, 'enabled')) {
    profileDecoratorEnabled = options.enabled;
  }
}

function isDecoratorContext(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.kind === 'string'
  );
}

function profile(target, propertyKeyOrContext, descriptor) {
  if (isDecoratorContext(propertyKeyOrContext)) {
    if (!isEnabled()) {
      return target;
    }

    const context = propertyKeyOrContext;
    if (context.kind === 'class') {
      if (typeof target === 'function') {
        profiler.registerClass(target, target.name);
      }
      return target;
    }

    if (context.kind === 'method' || context.kind === 'function') {
      const fnName = String(context.name);
      return profiler.registerFN(target, fnName);
    }

    return target;
  }

  if (!isEnabled()) {
    return;
  }

  if (propertyKeyOrContext !== undefined) {
    if (descriptor && typeof descriptor.value === 'function') {
      const fnName = String(propertyKeyOrContext);
      descriptor.value = profiler.registerFN(descriptor.value, fnName);
    }
    return;
  }

  if (typeof target === 'function' && target.prototype) {
    profiler.registerClass(target, target.name);
  }
}

module.exports = {
  profile,
  configureProfileDecorator,
};
