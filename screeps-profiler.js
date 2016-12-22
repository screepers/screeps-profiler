let usedOnStart = 0;
let enabled = false;
let depth = 0;
let parent = 'root';

function setupProfiler() {
  depth = 0; // reset depth, this needs to be done each tick.
  Game.profiler = {
    stream(duration, filter) {
      setupMemory('stream', duration || 10, filter);
    },
    email(duration, filter) {
      setupMemory('email', duration || 100, filter);
    },
    profile(duration, filter) {
      setupMemory('profile', duration || 100, filter);
    },
    background(filter) {
      setupMemory('background', false, filter);
    },
    restart() {
      if (Profiler.isProfiling()) {
        const filter = Memory.profiler.filter;
        let duration = false;
        if (!!Memory.profiler.disableTick) {
          // Calculate the original duration, profile is enabled on the tick after the first call,
          // so add 1.
          duration = Memory.profiler.disableTick - Memory.profiler.enabledTick + 1;
        }
        const type = Memory.profiler.type;
        setupMemory(type, duration, filter);
      }
    },
    reset: resetMemory,
    output: Profiler.output,
  };

  overloadCPUCalc();
}

function setupMemory(profileType, duration, filter) {
  resetMemory();
  const disableTick = Number.isInteger(duration) ? Game.time + duration : false;
  if (!Memory.profiler) {
    Memory.profiler = {
      map: {},
      totalTime: 0,
      initTime: 0,
      timeSpend: 0,
      enabledTick: Game.time + 1,
      disableTick,
      type: profileType,
      filter,
      lastTotal: 0,
      lastSum: 0,
      lastInit: 0,
    };
  }
}

function resetMemory() {
  Memory.profiler = null;
}

function overloadCPUCalc() {
  if (Game.rooms.sim) {
    usedOnStart = 0; // This needs to be reset, but only in the sim.
    Game.cpu.getUsed = function getUsed() {
      return performance.now() - usedOnStart;
    };
  }
}

function getFilter() {
  return Memory.profiler.filter;
}

const functionBlackList = [
  'getUsed', // Let's avoid wrapping this... may lead to recursion issues and should be inexpensive.
  'constructor', // es6 class constructors need to be called with `new`
];

function wrapFunction(name, originalFunction) {
  return function wrappedFunction() {
    if (Profiler.isProfiling()) {
      const nameMatchesFilter = name === getFilter();
      const start = Game.cpu.getUsed();
      const initialSpend = Memory.profiler.timeSpend;
      const myParent = parent;
      parent = name;
      if (nameMatchesFilter) {
        depth++;
      }
      const result = originalFunction.apply(this, arguments);
      if (depth > 0 || !getFilter()) {
        const end = Game.cpu.getUsed();
        const endSpend = Memory.profiler.timeSpend;
        Profiler.record(myParent, name, end - start - (endSpend - initialSpend));
      }
      parent = myParent;
      if (nameMatchesFilter) {
        depth--;
      }
      return result;
    }

    return originalFunction.apply(this, arguments);
  };
}

function hookUpPrototypes() {
  Profiler.prototypes.forEach(proto => {
    profileObjectFunctions(proto.val, proto.name);
  });
}

function profileObjectFunctions(object, label) {
  const objectToWrap = object.prototype ? object.prototype : object;

  Object.getOwnPropertyNames(objectToWrap).forEach(functionName => {
    const extendedLabel = `${label}.${functionName}`;
    try {
      const isFunction = typeof objectToWrap[functionName] === 'function';
      const notBlackListed = functionBlackList.indexOf(functionName) === -1;
      if (isFunction && notBlackListed) {
        const originalFunction = objectToWrap[functionName];
        objectToWrap[functionName] = profileFunction(originalFunction, extendedLabel);
      }
    } catch (e) { } /* eslint no-empty:0 */
  });

  return objectToWrap;
}

function profileFunction(fn, functionName) {
  const fnName = functionName || fn.name;
  if (!fnName) {
    console.log('Couldn\'t find a function name for - ', fn);
    console.log('Will not profile this function.');
    return fn;
  }

  return wrapFunction(fnName, fn);
}

const Profiler = {
  printProfile() {
    console.log(Profiler.output());
  },

  emailProfile() {
    Game.notify(Profiler.output());
  },

  output(numresults) {
    const displayresults = !!numresults ? numresults : 20;
    if (!Memory.profiler || !Memory.profiler.enabledTick) {
      return 'Profiler not active.';
    }
    const elapsedTicks = Game.time - Memory.profiler.enabledTick + 1;
    const header = 'calls\t\ttime\t\tavg\t\tmax\t\tfunction';
    const stats = Profiler.stats(Memory.profiler.map);
    const timeSum = Array.from(stats).reduce((pv, cv) => pv + cv.totalTime, 0);
    const footer = [
      `Avg: ${(Memory.profiler.totalTime / elapsedTicks).toFixed(2)}`,
      `Sum: ${timeSum.toFixed(2)} +${(timeSum - Memory.profiler.lastSum).toFixed(2)}`,
      `Init: ${Memory.profiler.initTime.toFixed(2)} +${(Memory.profiler.initTime -
      Memory.profiler.lastInit).toFixed(2)}`,
      `Total: ${Memory.profiler.totalTime.toFixed(2)} +${(Memory.profiler.totalTime -
      Memory.profiler.lastTotal).toFixed(2)}`,
      `Ticks: ${elapsedTicks}`,
    ].join('\t');
    Memory.profiler.lastTotal = Memory.profiler.totalTime;
    Memory.profiler.lastSum = timeSum;
    Memory.profiler.lastInit = Memory.profiler.initTime;
    return [].concat(header, Profiler.lines(stats).slice(0, displayresults), footer).join('\n');
  },

  stats(myMap) {
    const stats = Object.keys(myMap).map(functionName => {
      const functionCalls = myMap[functionName];
      return {
        name: functionName,
        calls: functionCalls.calls,
        totalTime: functionCalls.time.reduce((pv, cv) => pv + cv, 0),
        averageTime: functionCalls.time.reduce((pv, cv) => pv + cv, 0) /
        functionCalls.time.length,
        maxTime: functionCalls.time.reduce((pv, cv) => Math.max(pv, cv), Number.NEGATIVE_INFINITY),
        subStats: (functionCalls.parentMap === undefined || Object.keys(functionCalls.parentMap).length < 2)
        ? null : Profiler.stats(functionCalls.parentMap),
      };
    }).sort((val1, val2) => {
      return val2.totalTime - val1.totalTime;
    });
    return stats;
  },

  lines(stats) {
    const lines = stats.map(data => {
      return [
        data.calls,
        data.totalTime.toFixed(1),
        data.averageTime.toFixed(3),
        data.maxTime.toFixed(3),
        data.name,
        data.subStats === null ? '' : '\n' + Profiler.lines(data.subStats).join('\n'),
      ].join('\t\t');
    });
    return lines;
  },

  prototypes: [
    { name: 'Game', val: Game },
    { name: 'Room', val: Room },
    { name: 'Structure', val: Structure },
    { name: 'Spawn', val: Spawn },
    { name: 'Creep', val: Creep },
    { name: 'RoomPosition', val: RoomPosition },
    { name: 'Source', val: Source },
    { name: 'Flag', val: Flag },
    { name: 'Market', val: Game.market },
  ],

  record(myparent, functionName, time) {
    if (!Memory.profiler.map[functionName]) {
      Memory.profiler.map[functionName] = {
        time: [],
        calls: 0,
        parentMap: {},
      };
    }
    Memory.profiler.map[functionName].calls++;
    Memory.profiler.map[functionName].time.push(time);
    Memory.profiler.timeSpend += time;
    if (myparent !== null) {
      const parentString = '  by ' + myparent;
      if (!Memory.profiler.map[functionName].parentMap[parentString]) {
        Memory.profiler.map[functionName].parentMap[parentString] = {
          time: [],
          calls: 0,
        };
      }
      Memory.profiler.map[functionName].parentMap[parentString].calls++;
      Memory.profiler.map[functionName].parentMap[parentString].time.push(time);
    }
  },

  endTick() {
    if (Game.time >= Memory.profiler.enabledTick) {
      const cpuUsed = Game.cpu.getUsed();
      Memory.profiler.totalTime += cpuUsed;
      Profiler.report();
    }
  },

  report() {
    if (Profiler.shouldPrint()) {
      Profiler.printProfile();
    } else if (Profiler.shouldEmail()) {
      Profiler.emailProfile();
    }
  },

  isProfiling() {
    if (!enabled || !Memory.profiler) {
      return false;
    }
    return !Memory.profiler.disableTick || Game.time <= Memory.profiler.disableTick;
  },

  type() {
    return Memory.profiler.type;
  },

  shouldPrint() {
    const streaming = Profiler.type() === 'stream';
    const profiling = Profiler.type() === 'profile';
    const onEndingTick = Memory.profiler.disableTick === Game.time;
    return streaming || (profiling && onEndingTick);
  },

  shouldEmail() {
    return Profiler.type() === 'email' && Memory.profiler.disableTick === Game.time;
  },
};

module.exports = {
  wrap(callback) {
    if (enabled) {
      setupProfiler();
    }

    if (Profiler.isProfiling()) {
      usedOnStart = Game.cpu.getUsed();
      Memory.profiler.initTime += Game.cpu.getUsed();
      // Commented lines are part of an on going experiment to keep the profiler
      // performant, and measure certain types of overhead.

      // var callbackStart = Game.cpu.getUsed();
      const returnVal = callback();
      // var callbackEnd = Game.cpu.getUsed();
      Profiler.endTick();
      // var end = Game.cpu.getUsed();

      // var profilerTime = (end - start) - (callbackEnd - callbackStart);
      // var callbackTime = callbackEnd - callbackStart;
      // var unaccounted = end - profilerTime - callbackTime;
      // console.log('total-', end, 'profiler-', profilerTime, 'callbacktime-',
      // callbackTime, 'start-', start, 'unaccounted', unaccounted);
      return returnVal;
    }

    return callback();
  },

  enable() {
    enabled = true;
    hookUpPrototypes();
  },

  output: Profiler.output,

  registerObject: profileObjectFunctions,
  registerFN: profileFunction,
  registerClass: profileObjectFunctions,
};
