import profiler, { ProfilerError } from '../screeps-profiler';
import { profile } from '../decorator';

const _profiler: typeof profiler = profiler;
const _enable: typeof profiler["enable"] = profiler.enable;
const _wrap: typeof profiler["wrap"] = profiler.wrap;
const _error: typeof ProfilerError = ProfilerError;
const _profile: typeof profile = profile;

@profile
class Matcher {
  run() {
    return 1;
  }
}

class Example {
  @profile
  run() {
    return 1;
  }
}

void _profiler;
void _enable;
void _wrap;
void _error;
void _profile;
void Matcher;
void Example;
