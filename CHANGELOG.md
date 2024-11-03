## 3.0.0

 - Feat: Added more game objects. ([#32](https://github.com/screepers/screeps-profiler/pull/32))
 - Feat: Added call stack profiling and output in callgrind format. ([#29](https://github.com/screepers/screeps-profiler/pull/29))
 - Breaking: Removed `AlreadyWrappedException`; now repoints the wrapped function profiler object if it's already a wrapper. ([#32](https://github.com/screepers/screeps-profiler/pull/32))
 - Breaking: Throw on invalid registration as soon as possible. ([#32](https://github.com/screepers/screeps-profiler/pull/32))
 - Fix: Resolved CostMatrix registering issues. ([#28](https://github.com/screepers/screeps-profiler/pull/28))
 - Fix: Corrected tick calculation to ensure output is accurate. ([#30](https://github.com/screepers/screeps-profiler/pull/30))
 - Internal: Added additional tests, increasing coverage. ([#32](https://github.com/screepers/screeps-profiler/pull/32))
 - Internal: Switched to GitHub Actions instead of Travis. ([#32](https://github.com/screepers/screeps-profiler/pull/32))
 - Internal: Added logging on profiler start or empty profile. ([#32](https://github.com/screepers/screeps-profiler/pull/32))

## 2.0.1

 - Fix: `profiler.output()` will no longer throw when there are very few functions that have been profiled. ([#26](https://github.com/screepers/screeps-profiler/pull/26))

## 2.0.0

 - Breaking: Profiler now throws if you attempt to wrap an already wrapped function. ([#24](https://github.com/gdborton/screeps-profiler/pull/24))
 - Breaking: Changed `profiler.output()` to take a character limit (1000 default) instead of a line limit. This should make `.email` more consistent. ([#24](https://github.com/gdborton/screeps-profiler/pull/24))
 - Internal: Added tests. This has been missing for a while, and is needed to keep the profiler healthy. ([#24](https://github.com/gdborton/screeps-profiler/pull/24))

## 1.3.0

 - New: Added this change log.
 - New: Added support for profiling getter/setter methods. ([#11](https://github.com/gdborton/screeps-profiler/pull/11))
 - New: Wrapper functions now expose wrapped functions' `toString()` results. ([#9](https://github.com/gdborton/screeps-profiler/pull/9))
 - Fix: Corrected the tick count for profiles that have ended. ([#19](https://github.com/gdborton/screeps-profiler/pull/19))
 - Doc: Corrected library name in the example code.
