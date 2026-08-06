# Screeps Profiler [![Build Status](https://github.com/screepers/screeps-profiler/actions/workflows/check.yml/badge.svg?branch=master)](https://github.com/screepers/screeps-profiler/actions/workflows/check.yml) [![Coverage Status](https://coveralls.io/repos/github/screepers/screeps-profiler/badge.svg)](https://coveralls.io/github/screepers/screeps-profiler)

The Screeps Profiler is a library that helps to understand where your CPU is being spent in the game of [Screeps](https://screeps.com).

It works by monkey patching functions on the Global game object prototypes, with a function that record how long each function takes.  The primary benefit of using this profiler is that you can get a clear picture of where your CPU is being used over time, and optimize some of the heavier functions.  While it works best for players that heavily employ prototypes in their code, it should work to some degree for all players.

## Setup

### Installation

You have two options for installing this script.  You can either use npm and a compiler like webpack, or you can copy/paste the `screeps-profiler.js` file and use the provided screeps require function.

### Main.js

Your main.js will will need to be configured like so.

```javascript
// Any modules that you use that modify the game's prototypes should be require'd
// before you require the profiler.
const profiler = require('screeps-profiler');

// This line monkey patches the global prototypes.
profiler.enable();
module.exports.loop = function() {
  profiler.wrap(function() {
    // Main.js logic should go here.
  });
}
```

## Console API

You can make use of the profiler via the Screeps console.

```javascript
Game.profiler.profile(ticks, [functionFilter]);
Game.profiler.stream(ticks, [functionFilter]);
Game.profiler.email(ticks, [functionFilter]);
Game.profiler.background([functionFilter]);
Game.profiler.callgrind(ticks, [functionFilter]);

// Output current profile data.
Game.profiler.output([lineCount]);
Game.profiler.downloadCallgrind();

// Reset the profiler, disabling any profiling in the process.
Game.profiler.reset();

Game.profiler.restart();
```

**Note:** It can take up to 30 ticks if you're using `module.exports.loop` for these commands to work without issue.

`profile` - Will run for the given number of ticks then will output the gathered information to the console.

`stream` - Will run for the given number of ticks, and will output the gathered information each tick to the console.  The can sometimes be useful for seeing spikes in performance.

`email` - This will run for the given number of ticks, and will email the output to your registered Screeps email address.  Very useful for long running profiles.

`background` - This will run indefinitely, and will only output data when the `output` console command is run.  Very useful for long running profiles with lots of function calls.

`callgrind` - Will run for the given number of ticks, and will download a file in Callgrind format which can be viewed in KCachegrind program.

`output` - Print a report based on the current tick.  The profiler will continue to operate normally.

`downloadCallgrind` - Download the callgrind report at the current tick.  The profiler will continue to operate normally.

`reset` - Stops the profiler and resets its memory.  This is currently the only way to stop a `background` profile.

`restart` - Restarts the profiler using the same options previously used to start it.

In each case, `ticks` controls how long the profiler should run before stopping, and the optional `functionFilter` parameter will limit the scope of the profiler to a specific function.

## Example output

Below is a sample output of `Game.profiler.profile(1000)`

```
calls    time        avg       function
2000     12293.9,    6.147     Room.work
10914    6025.0,     0.552     Creep.work
2000     3534.5,     1.767     Spawn.work
70000    1949.3,     0.028     Structure.work
2832     1733.8,     0.612     Creep.moveTo
3727     1093.7,     0.293     Creep.moveToAndHarvest
1659     886.0,      0.534     Creep.takeEnergyFrom
8466     871.9,      0.103     Room.createConstructionSite
3500     852.7,      0.244     Creep.harvest
975      745.8,      0.765     Creep.deliverEnergyTo
2615     741.1,      0.283     Room.needsCouriers
278      700.5,      2.520     RoomPosition.findPathTo
278      673.6,      2.423     Room.findPath
21342    575.4,      0.027     Spawn.availableEnergy
2805     535.1,      0.191     Room.getStorage
2108     511.7,      0.243     Creep.move
1830     487.1,      0.266     Creep.moveByPath
1439     483.9,      0.336     Creep.moveToAndUpgrade
26596    454.5,      0.017     Room.find
4247     443.1,      0.104     Room.droppedControllerEnergy
Avg: 15.43 Total: 15425.31 Ticks: 1000 Est. Bucket (20 limit): 5055
```

Seeing that `Spawn.work` is high, we might run `Game.profiler.profile(200, 'Spawn.work')` to see what about `Spawn.work` is taking so long.  From that we would get:

```
calls    time        avg        function
62       137.7,      2.221      Spawn.work
103      25.8,       0.251      Room.needsCouriers
41       23.9,       0.583      Room.needsUpgraders
41       18.6,       0.452      Room.needsHarvesters
41       17.6,       0.429      Room.getSourcesNeedingHarvesters
105      16.1,       0.154      Room.getStorage
548      14.9,       0.027      Spawn.availableEnergy
341      12.1,       0.035      Room.find
62       8.4,        0.135      Room.harvesterCount
48       8.3,        0.174      Spawn.extend
211      7.9,        0.037      Room.getExtensions
41       7.3,        0.178      Room.droppedControllerEnergy
103      7.1,        0.069      Room.courierCount
62       7.1,        0.115      Room.getHarvesters
41       6.5,        0.158      Room.needsBuilders
12       6.1,        0.509      Spawn.buildBuilder
62       5.8,        0.094      Room.setupFlags
103      5.6,        0.055      Room.getCouriers
15       5.0,        0.330      Room.upgraderWorkParts
41       4.8,        0.116      Room.builderCount
Avg: 13.54 Total: 2707.90 Ticks: 200 Est. Bucket (20 limit): 1774
```

**Note:** Each function recorded here was part of a call stack with `Spawn.work` at the root.

## Example callgrind visualisation

![KCachegrind screenshot](callgrind.jpg)

**Note:** In callgrind format time will be saved in nanoseconds. `1 Screeps CPU unit = 1 ms = 1'000'000 ns`.

## Using the `@profile` decorator

If you use TypeScript (or JavaScript with decorator support), you can register classes and individual methods with the `@profile` decorator from `screeps-profiler/decorator`. This is equivalent to calling `registerClass` or `registerFN`, but keeps registration next to the code being profiled.

Load any module that uses `@profile` before calling `profiler.enable()`, the same as with manual registration.

TypeScript supports `@profile` in two modes:

- **Legacy decorators** — set `"experimentalDecorators": true` in your `tsconfig.json`
- **Standard decorators (TypeScript 5+)** — leave `experimentalDecorators` off (the default in newer TypeScript). Standalone functions can be registered with the same `profile` helper programmatically (see below).

### Class decorator

Every method on the class is registered under the class name (for example, `SuperOmegaCreep.work`).

```typescript
import { profile } from 'screeps-profiler/decorator';

@profile
class SuperOmegaCreep {
  work() {
    hiddenManagersPlaybook.delegate();
  }
}
```

### Method decorator

Only the decorated method is registered, using the method name as the label.

```typescript
import { profile } from 'screeps-profiler/decorator';

class GameHandler {
  @profile
  handleGame() {
    // do some work
  }
}
```

### Standalone functions

TypeScript does not allow `@` decorators on function declarations. Use the same `profile` helper programmatically instead:

```typescript
import { profile } from 'screeps-profiler/decorator';

export const getAllScouts = profile(
  function getAllScouts() {
    return Object.keys(Game.creeps).filter((creepName) => {
      return Game.creeps[creepName].memory.role === 'scout';
    });
  },
  { kind: 'function', name: 'getAllScouts' },
);
```

With legacy decorators (`experimentalDecorators: true`), use `profiler.registerFN()` instead.

### Disabling decorator registration

Call `configureProfileDecorator` before your decorated classes are defined to skip wrapping at decoration time. This is useful when you want decorators in source code but no registration overhead in production builds.

```typescript
import { configureProfileDecorator } from 'screeps-profiler/decorator';

configureProfileDecorator({ enabled: false });

// Or use a callback for dynamic control:
configureProfileDecorator({ enabled: () => Memory.profiling === true });
```

**Note:** `configureProfileDecorator` only controls whether `@profile` registers functions when a class is defined. You still call `profiler.enable()` in `main.js` for the profiler to instrument whatever was registered.

## Registering additional code

The profiler automatically registers many of the built in functions in Screeps, but not every player extends the provided prototypes.  The profiler supports arbitrary registration of objects and functions as well. If you are not using the `@profile` decorator, you can register code manually by importing the profiler and calling `registerClass`, `registerObject`, or `registerFN`.

**Example:**

```javascript
const profiler = require('screeps-profiler');

class SuperOmegaCreep {
  work() {
    hiddenManagersPlaybook.delegate();
  }
}

// Each of the functions on this class will be replaced with a profiler wrapper. The second parameter
// is a required label.
profiler.registerClass(SuperOmegaCreep, 'SuperOmegaCreep');

const gameHandlerObject = {
  handleGame: () => {
    // do some work.
  }
};

// Each of the functions on this object will be replaced with a profiler wrapper. The second parameter
// is a required label.
profiler.registerObject(gameHandlerObject, 'gameHandlerObject');

function getAllScouts() {
  return Object.keys(Game.creeps).filter(creepName => {
    const creep = Game.creeps[creepName];
    return creep.memory.role === 'scout';
  });
}

// Be sure to reassign the function, we can't alter functions that are passed.
getAllScouts = profiler.registerFN(getAllScouts, 'mySemiOptionalName');
```

**Note:** The second param is optional if you pass a named function `function x() {}`, but required if you pass an anonymous function `var x = function(){}`.

## Potential Overhead

There is some work to setting up the functions for profiling.  While this work is kept to a minimum when the profiler is not in use, it may be beneficial to comment out or remove the `profiler.enable()` call when you know you aren't going to be using it.  This will revert the monkey patched functions to their original functions.
