'use strict';

const ROOT_NAME = '(root)';
const TICK_NAME = '(tick)';

let usedOnStart = 0;
let enabled = false;
let depth = 0;
let parentFn = TICK_NAME;

class ProfilerError extends Error {}

// Hack to ensure the InterShardMemory constant exists in sim
try {
  InterShardMemory;
} catch {
  global.InterShardMemory = undefined;
}

function setupProfiler() {
  depth = 0; // reset depth, this needs to be done each tick.
  parentFn = TICK_NAME;

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
    callgrind(duration, filter) {
      setupMemory('callgrind', duration || 100, filter);
    },
    restart() {
      if (Profiler.isProfiling()) {
        const filter = Memory.profiler.filter;
        let duration = false;
        if (Memory.profiler.disableTick) {
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
    downloadCallgrind: Profiler.downloadCallgrind,
  };

  overloadCPUCalc();
}

function setupMemory(profileType, duration, filter) {
  const disableTick = Number.isInteger(duration) ? Game.time + duration : false;

  Memory.profiler = {
    map: {},
    totalTime: 0,
    totalIntents: 0,
    totalIntentCalls: 0,
    enabledTick: Game.time + 1,
    disableTick,
    type: profileType,
    filter,
  };

  console.log(`Profiling type ${profileType} started at ${Game.time + 1} for ${duration} ticks`);
}

function resetMemory() {
  delete Memory.profiler;
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

const commonProperties = ['length', 'name', 'arguments', 'caller', 'prototype'];

function wrapFunction(name, originalFunction) {
  // wrappedFunction.__profiler = Profiler;

  if (originalFunction.__profiler) {
    originalFunction.__profiler = Profiler;
    return originalFunction;
  }

  function wrappedFunction() {
    const profiler = wrappedFunction.__profiler;
    if (profiler.isProfiling()) {
      const nameMatchesFilter = name === getFilter();
      if (nameMatchesFilter) {
        depth++;
      }

      const curParent = parentFn;
      parentFn = name;

      const startIntents = Memory.profiler.totalIntents;
      const startIntentCalls = Memory.profiler.totalIntentCalls;
      const startT = Game.cpu.getUsed();

      let result;
      if (this && this.constructor === wrappedFunction) {
        result = new originalFunction(...arguments);
      } else {
        result = originalFunction.apply(this, arguments);
      }

      const endT = Game.cpu.getUsed();

      if (Profiler.intents.has(name)) {
        Memory.profiler.totalIntents += (result === 0) ? 1 : 0;
        Memory.profiler.totalIntentCalls++;
      }

      const endIntents = Memory.profiler.totalIntents;
      const endIntentCalls = Memory.profiler.totalIntentCalls;

      parentFn = curParent;

      if (depth > 0 || !getFilter()) {
        Profiler.record(
          name,
          endT - startT,
          endIntents - startIntents,
          endIntentCalls - startIntentCalls,
          parentFn,
        );
      }

      if (nameMatchesFilter) {
        depth--;
      }

      return result;
    }

    if (this && this.constructor === wrappedFunction) {
      return new originalFunction(...arguments);
    }

    return originalFunction.apply(this, arguments);
  }

  wrappedFunction.__profiler = Profiler;
  wrappedFunction.toString = () =>
    `// screeps-profiler wrapped function:\n${originalFunction.toString()}`;

  Object.getOwnPropertyNames(originalFunction).forEach(property => {
    if (!commonProperties.includes(property)) {
      wrappedFunction[property] = originalFunction[property];
    }
  });

  return wrappedFunction;
}

function hookUpPrototypes() {
  for (const { name, val } of Profiler.prototypes) {
    if (!val) {
      console.log(`skipping prototype hook ${name}, object appears to be missing`);
      continue;
    }
    profileObjectFunctions(val, name);
  }
}

function profileObjectFunctions(object, label) {
  if (!object || !(typeof object === 'object' || typeof object === 'function')) {
    throw new ProfilerError(`Asked to profile non-object ${object} for ${label}
     (${typeof object})`);
  }

  if (object.prototype) {
    profileObjectFunctions(object.prototype, label);
  }
  const objectToWrap = object;

  Object.getOwnPropertyNames(objectToWrap).forEach(functionName => {
    const extendedLabel = `${label}.${functionName}`;

    const isBlackListed = functionBlackList.indexOf(functionName) !== -1;
    if (isBlackListed) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(objectToWrap, functionName);
    // descriptor must always exist since we got the name from getOwnPropertyNames above
    const hasAccessor = descriptor.get || descriptor.set;
    if (hasAccessor) {
      const configurable = descriptor.configurable;
      if (!configurable) {
        return;
      }

      const profileDescriptor = {};

      if (descriptor.get) {
        const extendedLabelGet = `${extendedLabel}:get`;
        profileDescriptor.get = profileFunction(descriptor.get, extendedLabelGet);
      }

      if (descriptor.set) {
        const extendedLabelSet = `${extendedLabel}:set`;
        profileDescriptor.set = profileFunction(descriptor.set, extendedLabelSet);
      }

      Object.defineProperty(objectToWrap, functionName, profileDescriptor);
      return;
    }

    const isFunction = typeof descriptor.value === 'function';
    if (!isFunction || !descriptor.writable) {
      return;
    }
    const originalFunction = objectToWrap[functionName];
    objectToWrap[functionName] = profileFunction(originalFunction, extendedLabel);
  });
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

/** @type {import("./screeps-profiler").ScreepsProfilerStatic} */
const Profiler = {
  printProfile() {
    console.log(Profiler.output());
  },

  emailProfile() {
    Game.notify(Profiler.output(1000));
  },

  downloadCallgrind() {
    const id = `id${Math.random()}`;
    const shardId = Game.shard.name + (Game.shard.ptr ? '-ptr' : '');
    const filename = `callgrind.out.${shardId}.${Game.time}`;
    const data = Profiler.callgrind();
    if (!data) {
      console.log('No profile data to download');
      return;
    }
    const download = `
    <script>
    var element = document.getElementById('${id}');
    if (!element) {
      element = document.createElement('a');
      element.setAttribute('id', '${id}');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,${encodeURIComponent(data)}');
      element.setAttribute('download', '${filename}');

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();
    }
    </script>
    `;
    console.logUnsafe(
      download
      .split('\n')
      .map((s) => s.trim())
      .join('')
    );
  },

  callgrind() {
    if (!Memory.profiler || !Memory.profiler.enabledTick) return null;

    // A fake position indicator is used because the profiler currently does
    // not attempt to determine the original file names or line numbers of any
    // profiled code
    const POS = 1;

    const TIME_SCALE = 1_000_000;

    const elapsedTicks = Game.time - Memory.profiler.enabledTick + 1;
    const totalCpu = Memory.profiler.totalTime;
    const totalIntents = Memory.profiler.totalIntents;
    const totalIntentCalls = Memory.profiler.totalIntentCalls;

    Profiler.checkMapItem(TICK_NAME);
    Memory.profiler.map[TICK_NAME].calls = elapsedTicks;
    Memory.profiler.map[TICK_NAME].time = totalCpu;
    Memory.profiler.map[TICK_NAME].intents = totalIntents;
    Memory.profiler.map[TICK_NAME].intentCalls = totalIntentCalls;

    Profiler.checkMapItem(ROOT_NAME);
    Memory.profiler.map[ROOT_NAME].calls = 1;
    Memory.profiler.map[ROOT_NAME].time = totalCpu;
    Memory.profiler.map[ROOT_NAME].intents = totalIntents;
    Memory.profiler.map[ROOT_NAME].intentCalls = totalIntentCalls;

    Profiler.checkMapItem(TICK_NAME, Memory.profiler.map[ROOT_NAME].subs);
    Memory.profiler.map[ROOT_NAME].subs[TICK_NAME].calls = elapsedTicks;
    Memory.profiler.map[ROOT_NAME].subs[TICK_NAME].time = totalCpu;
    Memory.profiler.map[ROOT_NAME].subs[TICK_NAME].intents = totalIntents;
    Memory.profiler.map[ROOT_NAME].subs[TICK_NAME].intentCalls = totalIntentCalls;

    let body = '';
    for (const fnName in Memory.profiler.map) {
      // Get the total costs measured for each profiled function
      const fnCosts = Memory.profiler.map[fnName];
      let fnExcTime = fnCosts.time * TIME_SCALE;
      let fnExcIntents = fnCosts.intents;
      let fnExcIntentCalls = fnCosts.intentCalls;

      const calleesBody = [];
      for (const calleeFnName in fnCosts.subs) {
        // Costs added to caller by this function
        const callee = fnCosts.subs[calleeFnName];
        const time = callee.time * TIME_SCALE;
        const intents = callee.intents;
        const intentCalls = callee.intentCalls;

        // Exclude callee costs from caller costs
        fnExcTime -= time;
        fnExcIntents -= intents;
        fnExcIntentCalls -= intentCalls;

        calleesBody.push(
          `cfn=${calleeFnName}`,
          `calls=${callee.calls} ${POS}`,
          `${POS} ${Math.round(time)} ${Math.round(intents)} ${intentCalls}`,
        );
      }

      body += [
        `fn=${fnName}`,
        `${POS} ${Math.round(fnExcTime)} ${Math.round(fnExcIntents)} ${fnExcIntentCalls}`,
        ...calleesBody,
      ].join('\n') + '\n\n';
    }

    // A bug in q(k?)Cachegrind requires event names to start with different letters
    const totalTime = totalCpu * TIME_SCALE;
    const header = [
      '# callgrind format',
      'event: ns : Time (ns)',
      'event: i_ns = 200000 * ri : Intent Time (ns)',
      'event: o_ns = ns - i_ns: Overhead Time (ns)',
      'event: ri : Registered Intents',
      'event: fi : Intent Function Calls',
      'events: ns ri fi',
      `summary: ${Math.round(totalTime)} ${Math.round(totalIntents)} ${totalIntentCalls}`,
    ].join('\n') + '\n\n';

    return header + body;
  },

  output(passedOutputLengthLimit) {
    const outputLengthLimit = passedOutputLengthLimit || 1000;
    if (!Memory.profiler || !Memory.profiler.enabledTick) {
      return 'Profiler not active.';
    }

    const endTick = Math.min(Memory.profiler.disableTick || Game.time, Game.time);
    const startTick = Memory.profiler.enabledTick;
    const elapsedTicks = endTick - startTick + 1;
    const totalTime = Memory.profiler.totalTime
    const totalIntents = Memory.profiler.totalIntents;
    const overhead = (totalTime - totalIntents * 0.2) / totalTime;
    const header = 'calls\t\ttime\t\tavg\t\tintents\t\tfunction';
    const footer = [
      `Avg: ${(totalTime / elapsedTicks).toFixed(2)}`,
      `Total: ${totalTime.toFixed(2)}`,
      `Intents: ${totalIntents}`,
      `Overhead: ${(overhead * 100).toFixed(2)}%`,
      `Ticks: ${elapsedTicks}`,
    ].join('\t');

    const lines = [header];
    let currentLength = header.length + 1 + footer.length;
    const allLines = Profiler.lines();
    let done = false;
    while (!done && allLines.length) {
      const line = allLines.shift();
      // each line added adds the line length plus a new line character.
      if (currentLength + line.length + 1 < outputLengthLimit) {
        lines.push(line);
        currentLength += line.length + 1;
      } else {
        done = true;
      }
    }
    lines.push(footer);
    return lines.join('\n');
  },

  lines() {
    const stats = Object.keys(Memory.profiler.map).map(functionName => {
      const functionCalls = Memory.profiler.map[functionName];
      return {
        name: functionName,
        calls: functionCalls.calls,
        totalTime: functionCalls.time,
        totalIntents: functionCalls.intents,
        averageTime: functionCalls.time / functionCalls.calls,
      };
    }).sort((val1, val2) => val2.totalTime - val1.totalTime);

    const lines = stats.map(data => {
      return [
        data.calls,
        data.totalTime.toFixed(1),
        data.averageTime.toFixed(3),
        data.totalIntents,
        data.name,
      ].join('\t\t');
    });

    return lines;
  },

  prototypes: [
    { name: 'ConstructionSite', val: ConstructionSite },
    { name: 'Creep', val: Creep },
    { name: 'Deposit', val: Deposit },
    { name: 'Flag', val: Flag },
    { name: 'Game', val: Game },
    { name: 'InterShardMemory', val: InterShardMemory },
    { name: 'Mineral', val: Mineral },
    { name: 'Nuke', val: Nuke },
    { name: 'OwnedStructure', val: OwnedStructure },
    { name: 'PathFinder', val: PathFinder },
    { name: 'PowerCreep', val: PowerCreep },
    { name: 'RawMemory', val: RawMemory },
    { name: 'Resource', val: Resource },
    { name: 'Room', val: Room },
    { name: 'RoomObject', val: RoomObject },
    { name: 'RoomPosition', val: RoomPosition },
    { name: 'RoomVisual', val: RoomVisual },
    { name: 'Ruin', val: Ruin },
    { name: 'Source', val: Source },
    { name: 'Store', val: Store },
    { name: 'Structure', val: Structure },
    { name: 'StructureContainer', val: StructureContainer },
    { name: 'StructureController', val: StructureController },
    { name: 'StructureExtension', val: StructureExtension },
    { name: 'StructureExtractor', val: StructureExtractor },
    { name: 'StructureFactory', val: StructureFactory },
    { name: 'StructureInvaderCore', val: StructureInvaderCore },
    { name: 'StructureKeeperLair', val: StructureKeeperLair },
    { name: 'StructureLab', val: StructureLab },
    { name: 'StructureLink', val: StructureLink },
    { name: 'StructureNuker', val: StructureNuker },
    { name: 'StructureObserver', val: StructureObserver },
    { name: 'StructurePortal', val: StructurePortal },
    { name: 'StructurePowerBank', val: StructurePowerBank },
    { name: 'StructurePowerSpawn', val: StructurePowerSpawn },
    { name: 'StructureRampart', val: StructureRampart },
    { name: 'StructureRoad', val: StructureRoad },
    { name: 'StructureSpawn', val: StructureSpawn },
    // StructureSpawn.Spawning
    { name: 'StructureStorage', val: StructureStorage },
    { name: 'StructureTerminal', val: StructureTerminal },
    { name: 'StructureTower', val: StructureTower },
    { name: 'StructureWall', val: StructureWall },
    { name: 'Tombstone', val: Tombstone }
  ],

  intents: new Set([
    'Game.notify',
    'Market.cancelOrder',
    'Market.changeOrderPrice',
    'Market.createOrder',
    'Market.deal',
    'Market.extendOrder',
    'ConstructionSite.remove',
    'Creep.attack',
    'Creep.attackController',
    'Creep.build',
    'Creep.claimController',
    'Creep.dismantle',
    'Creep.drop',
    'Creep.generateSafeMode',
    'Creep.harvest',
    'Creep.heal',
    'Creep.move',
    'Creep.notifyWhenAttacked',
    'Creep.pickup',
    'Creep.rangedAttack',
    'Creep.rangedHeal',
    'Creep.rangedMassAttack',
    'Creep.repair',
    'Creep.reserveController',
    'Creep.signController',
    'Creep.suicide',
    'Creep.transfer',
    'Creep.upgradeController',
    'Creep.withdraw',
    'Flag.remove',
    'Flag.setColor',
    'Flag.setPosition',
    'OwnedStructure.destroy',
    'OwnedStructure.notifyWhenAttacked',
    'PowerCreep.delete',
    'PowerCreep.drop',
    'PowerCreep.enableRoom',
    'PowerCreep.move',
    'PowerCreep.notifyWhenAttacked',
    'PowerCreep.pickup',
    'PowerCreep.renew',
    'PowerCreep.spawn',
    'PowerCreep.suicide',
    'PowerCreep.transfer',
    'PowerCreep.upgrade',
    'PowerCreep.usePower',
    'PowerCreep.withdraw',
    'Room.createConstructionSite',
    'Room.createFlag',
    'RoomPosition.createConstructionSite',
    'RoomPosition.createFlag',
    'Structure.destroy',
    'Structure.notifyWhenAttacked',
    'StructureController.activateSafeMode',
    'StructureController.unclaim',
    'StructureExtension.destroy',
    'StructureExtension.notifyWhenAttacked',
    'StructureExtractor.destroy',
    'StructureExtractor.notifyWhenAttacked',
    'StructureFactory.destroy',
    'StructureFactory.notifyWhenAttacked',
    'StructureFactory.produce',
    'StructureInvaderCore.destroy',
    'StructureInvaderCore.notifyWhenAttacked',
    'StructureKeeperLair.destroy',
    'StructureKeeperLair.notifyWhenAttacked',
    'StructureLab.destroy',
    'StructureLab.notifyWhenAttacked',
    'StructureLab.boostCreep',
    'StructureLab.reverseReaction',
    'StructureLab.runReaction',
    'StructureLab.unboostCreep',
    'StructureLink.destroy',
    'StructureLink.notifyWhenAttacked',
    'StructureLink.transferEnergy',
    'StructureNuker.destroy',
    'StructureNuker.notifyWhenAttacked',
    'StructureNuker.launchNuke',
    'StructureObserver.destroy',
    'StructureObserver.notifyWhenAttacked',
    'StructureObserver.observe',
    'StructurePowerBank.destroy',
    'StructurePowerBank.notifyWhenAttacked',
    'StructurePowerSpawn.destroy',
    'StructurePowerSpawn.notifyWhenAttacked',
    'StructurePowerSpawn.processPower',
    'StructurePortal.destroy',
    'StructurePortal.notifyWhenAttacked',
    'StructureRampart.destroy',
    'StructureRampart.notifyWhenAttacked',
    'StructureRampart.setPublic',
    'StructureRoad.destroy',
    'StructureRoad.notifyWhenAttacked',
    'StructureSpawn.destroy',
    'StructureSpawn.notifyWhenAttacked',
    'StructureSpawn.createCreep',
    'StructureSpawn.spawnCreep',
    'StructureSpawn.recycleCreep',
    'StructureSpawn.renewCreep',
    'StructureSpawn.Spawning.cancel',
    'StructureSpawn.Spawning.setDirections',
    'StructureStorage.destroy',
    'StructureStorage.notifyWhenAttacked',
    'StructureTerminal.destroy',
    'StructureTerminal.notifyWhenAttacked',
    'StructureTerminal.send',
    'StructureTower.destroy',
    'StructureTower.notifyWhenAttacked',
    'StructureTower.heal',
    'StructureTower.attack',
    'StructureTower.repair',
    'StructureWall.destroy',
    'StructureWall.notifyWhenAttacked',
  ]),

  checkMapItem(functionName, map = Memory.profiler.map) {
    if (!map[functionName]) {
      map[functionName] = {
        time: 0,
        calls: 0,
        intents: 0,
        intentCalls: 0,
        subs: {},
      };
    }
  },

  record(functionName, time, intents, intentCalls, parent) {
    this.checkMapItem(functionName);
    Memory.profiler.map[functionName].calls++;
    Memory.profiler.map[functionName].time += time;
    Memory.profiler.map[functionName].intents += intents;
    Memory.profiler.map[functionName].intentCalls += intentCalls;
    if (parent) {
      this.checkMapItem(parent);
      this.checkMapItem(functionName, Memory.profiler.map[parent].subs);
      Memory.profiler.map[parent].subs[functionName].calls++;
      Memory.profiler.map[parent].subs[functionName].time += time;
      Memory.profiler.map[parent].subs[functionName].intents += intents;
      Memory.profiler.map[parent].subs[functionName].intentCalls += intentCalls;
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
    } else if (Profiler.shouldCallgrind()) {
      Profiler.downloadCallgrind();
    }
  },

  isProfiling() {
    if (!enabled || !Memory.profiler) {
      return false;
    }
    return Memory.profiler.type && (!Memory.profiler.disableTick || Game.time <= Memory.profiler.disableTick);
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

  shouldCallgrind() {
    return (
      Profiler.type() === 'callgrind' &&
      Memory.profiler.disableTick === Game.time
    );
  },
};

module.exports = {
  wrap(callback) {
    if (enabled) {
      setupProfiler();
    }

    if (Profiler.isProfiling()) {
      usedOnStart = Game.cpu.getUsed();

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

  isProfiling() {
    return Profiler.isProfiling();
  },

  output: Profiler.output,
  callgrind: Profiler.callgrind,

  registerObject: profileObjectFunctions,
  registerFN: profileFunction,
  registerClass: profileObjectFunctions,

  Error: ProfilerError,
};
