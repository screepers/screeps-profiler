var usedOnStart = 0;
var enabled = false;

function setupProfiler() {
  Game.profiler = {
    stream: function (duration, filter) {
      setupMemory('stream', duration || 10, filter);
    },
    email: function (duration, filter) {
      setupMemory('email', duration || 100, filter);
    },
    profile: function (duration, filter) {
      setupMemory('profile', duration || 100, filter);
    },
    reset: resetMemory
  };
}

function setupMemory(profileType, duration, filter) {
  overloadCPUCalc();
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
    Game.getUsedCpu = function() {
      return Game.rooms.sim ? performance.now() - usedOnStart : Game.getUsedCpu();
    };
  }
}

function getFilter() {
  return Memory.profiler.filter;
}

function hookUpPrototypes() {
  var depth = 0;
  Profiler.prototypes.forEach(function eachPrototype(proto) {
    var foundProto = proto.val.prototype ? proto.val.prototype : proto.val;
    Object.keys(foundProto).forEach(function eachKeyOnPrototype(prototypeFunctionName) {
      var key = `${proto.name}.${prototypeFunctionName}`;
      var keyMatchesFilter = key === getFilter();
      try {
        if (typeof foundProto[prototypeFunctionName] === 'function' && prototypeFunctionName !== 'getUsedCpu') {
          var originalFunction = foundProto[prototypeFunctionName];
          foundProto[prototypeFunctionName] = function() {
            if (Profiler.isProfiling()) {
              var start = Game.getUsedCpu();
              if (keyMatchesFilter) {
                depth++;
              }
              var result = originalFunction.apply(this, arguments);
              if (depth > 0 || !getFilter()) {
                var end = Game.getUsedCpu();
                Profiler.record(key, end - start);
              }
              if (keyMatchesFilter) {
                depth--;
              }
              return result;
            } else {
              return originalFunction.apply(this, arguments);
            }
          };
        }
      } catch (ex) { }
    });
  });
}

var Profiler = {
  printProfile() {
    console.log(Profiler.output());
  },

  emailProfile() {
    Game.notify(Profiler.output());
  },

  output(limit) {
    var elapsedTicks = Game.time - Memory.profiler.enabledTick + 1;
    var header = 'calls\t\ttime\t\tavg\t\tfunction';
    var footer = `Avg: ${(Memory.profiler.totalTime / elapsedTicks).toFixed(2)} Total: ${Memory.profiler.totalTime.toFixed(2)} Ticks: ${elapsedTicks} Est. Bucket (20 limit): ${Memory.profiler.bucketSize.toFixed(0)}`
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
    { name: 'RoomPosition', val: RoomPosition }
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
    } else {
      return callback();
    }
  },

  enable() {
    enabled = true;
    hookUpPrototypes();
  }
};
