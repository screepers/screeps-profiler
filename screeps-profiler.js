var usedOnStart = 0;
var enabled = false;
var depth = 0;

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
    reset: resetMemory
  };

  overloadCPUCalc();
}

function setupMemory(profileType, duration, filter) {
  resetMemory();
  if (!Memory.profiler) {
    Memory.profiler = {
      map: {},
      totalTime: 0,
      bucketSize: 0,
      enabledTick: Game.time + 1,
      disableTick: Game.time + duration,
      type: profileType,
      filter: filter
    };
  }
}

function resetMemory() {
  Memory.profiler = null;
}

function overloadCPUCalc() {
  if (Game.rooms.sim) {
    usedOnStart = 0; // This needs to be reset, but only in the sim.
    Game.getUsedCpu = function() {
      return performance.now() - usedOnStart;
    };
  }
}

function getFilter() {
  return Memory.profiler.filter;
}

function wrapFunction(name, originalFunction) {
  return function() {
    if (Profiler.isProfiling()) {
      var nameMatchesFilter = name === getFilter();
      var start = Game.getUsedCpu();
      if (nameMatchesFilter) {
        depth++;
      }
      var result = originalFunction.apply(this, arguments);
      if (depth > 0 || !getFilter()) {
        var end = Game.getUsedCpu();
        Profiler.record(name, end - start);
      }
      if (nameMatchesFilter) {
        depth--;
      }
      return result;
    } else {
      return originalFunction.apply(this, arguments);
    }
  };
}

function hookUpPrototypes() {
  Profiler.prototypes.forEach(function eachPrototype(proto) {
    profileObjectFunctions(proto.val, proto.name);
  });
}

function profileObjectFunctions(object, label) {
  const objectToWrap = object.prototype ? object.prototype : object;
  Object.keys(objectToWrap).forEach((functionName) => {
    try {
      if (typeof objectToWrap[functionName] === 'function' && functionName !== 'getUsedCpu') {
        var extendedLabel = `${label}.${functionName}`;
        var originalFunction = objectToWrap[functionName];
        objectToWrap[functionName] = profileFunction(originalFunction, extendedLabel);
      }
    } catch (ex) { }
  });

  return objectToWrap;
}

function profileFunction(fn, functionName) {
  let fnName = functionName ? functionName : fn.name;
  if (!fnName) {
    console.log('Couldn\'t find a function name for - ', fn);
    console.log('Will not profile this function.');
  } else {
    return wrapFunction(fnName, fn);
  }
}

var Profiler = {
  printProfile() {
    console.log(Profiler.output());
  },

  emailProfile() {
    Game.notify(Profiler.output());
  },

  output() {
    var elapsedTicks = Game.time - Memory.profiler.enabledTick + 1;
    var header = 'calls\t\ttime\t\tavg\t\tfunction';
    var footer = `Avg: ${(Memory.profiler.totalTime / elapsedTicks).toFixed(2)}\tTotal: ${Memory.profiler.totalTime.toFixed(2)} Ticks: ${elapsedTicks}`
    return  [].concat(header, Profiler.lines().slice(0, 20), footer).join('\n');
  },

  lines() {
    var stats = Object.keys(Memory.profiler.map).map(function(functionName) {
      var functionCalls = Memory.profiler.map[functionName];
      return {
        name: functionName,
        calls: functionCalls.calls,
        totalTime: functionCalls.time,
        averageTime: functionCalls.time / functionCalls.calls
      }
    }).sort(function(val1, val2) {
      return val2.totalTime - val1.totalTime;
    });
    var lines = stats.map(function(data) {
      return `${data.calls}\t\t${data.totalTime.toFixed(1)},\t\t${data.averageTime.toFixed(3)}\t\t${data.name}`;
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
    { name: 'Source', val: Source }
  ],

  record(functionName, time) {
    if (!Memory.profiler.map[functionName]) {
      Memory.profiler.map[functionName] = {
        time: 0,
        calls: 0
      };
    }
    Memory.profiler.map[functionName].calls++;
    Memory.profiler.map[functionName].time += time;
  },

  endTick() {
    if (Game.time >= Memory.profiler.enabledTick) {
      var cpuUsed = Game.getUsedCpu();
      Memory.profiler.totalTime += cpuUsed;
      Profiler.updateBucket(cpuUsed);
      Profiler.report();
    }
  },

  report() {
    if (Profiler.shouldPrint()){
      Profiler.printProfile();
    } else if (Profiler.shouldEmail()) {
      Profiler.emailProfile();
    }
  },

  updateBucket(cpuUsed) {
    var newBucketSize = Memory.profiler.bucketSize + 20 - cpuUsed;

    if (newBucketSize < 500) {
      newBucketSize = Math.min(Math.max(Game.cpuLimit - cpuUsed, newBucketSize), 10000);
    }
    Memory.profiler.bucketSize = newBucketSize;
  },

  isProfiling() {
    return enabled && !!Memory.profiler && Game.time <= Memory.profiler.disableTick;
  },

  type() {
    return Memory.profiler.type;
  },

  shouldPrint() {
    return Profiler.type() === 'stream' || (Profiler.type() === 'profile' && Memory.profiler.disableTick === Game.time);
  },

  shouldEmail() {
    return Profiler.type() === 'email' && Memory.profiler.disableTick === Game.time;
  }
};
module.exports = {
  wrap(callback) {
    if (enabled) {
      setupProfiler();
    }

    if (Profiler.isProfiling()) {
      usedOnStart = Game.getUsedCpu();

      // Commented lines are part of an on going experiment to keep the profiler
      // performant, and measure certain types of overhead.

      //var callbackStart = Game.getUsedCpu();
      var returnVal = callback();
      // var callbackEnd = Game.getUsedCpu();
      Profiler.endTick();
      // var end = Game.getUsedCpu();

      // var profilerTime = (end - start) - (callbackEnd - callbackStart);
      // var callbackTime = callbackEnd - callbackStart;
      // var unaccounted = end - profilerTime - callbackTime;
      //console.log('total-', end, 'profiler-', profilerTime, 'callbacktime-', callbackTime, 'start-', start, 'unaccounted', unaccounted);
      return returnVal;
    }

    return callback();
  },

  enable() {
    enabled = true;
    hookUpPrototypes();
  },

  registerObject(object, label) {
    return profileObjectFunctions(object, label)
  },

  registerFN(fn, functionName) {
    return profileFunction(fn, functionName)
  }
};
