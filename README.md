# Screeps Profiler [ ![Codeship Status for gdborton/screeps-profiler](https://codeship.com/projects/bd2a3c50-e9f2-0132-f68f-4602e60b2e9f/status?branch=master)](https://codeship.com/projects/83021)

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
var profiler = require('screeps-profiler');

// This line monkey patches the global prototypes.
profiler.enable();
module.exports.loop = function() {
  profiler.wrap(function() {
    // Main.js logic should go here.
  });
}
```

## Usage

You can make use of the profiler via the Screeps console.  Currently there are three commands that are available for use.

```javascript
Game.profiler.profile(ticks, [functionFilter]);
Game.profiler.stream(ticks, [functionFilter]);
Game.profiler.email(ticks, [functionFilter]);
```

**Note:** It can take up to 30 ticks if you're using `module.exports.loop` for these commands to work without issue.

`profile` - Will run for the given number of ticks then will output the gathered information to the console.

`stream` - Will run for the given number of ticks, and will output the gathered information each tick to the console.  The can sometimes be useful for seeing spikes in performance.

`email` - This will run for the given number of ticks, and will email the output to your registered Screeps email address.  Very useful for long running profiles.

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

**Note:** each function recorded here was part of a call stack with `Spawn.work` at the root.

## Registering functions

Many players in screeps do not utilitize the Global prototypes that are available.  The profiler supports arbitrary functional code as well, but takes a bit more work to setup.
In order to do it, you'll need to import the profiler wherever you want to register a function, then call the registerFN method.  This will take two parameters, the first is the function that you want to profile, the second is the name that you'd like to call the function in the output.

**Example:**

```javascript
var profiler = require('profiler');
function getAllScouts () {
  return Object.keys(Game.creeps).filter(function(creepName) {
    var creep = Game.creeps[creepName];
    return creep.memory.role === 'scout';
  });
}

// Be sure to reassign the function, we can't alter functions that are passed.
getAllScouts = profiler.registerFN(getAllScouts, 'mySemiOptionalName');
```

**Note:** the second param is optional if you pass a named function `function x() {}`, but required if you pass an anonymous function `var x = function(){}`.

## Potential Overhead

There is some work to setting up the functions for profiling.  While this work is kept to a minimum when the profiler is not in use, it may be beneficial to comment out or remove the `profiler.enable()` call when you know you aren't going to be using it.  This will revert the monkey patched functions to their original functions.
