import { profile } from '../decorator';

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

const getAllScouts = profile(function getAllScouts() {
  return [];
}, { kind: 'function', name: 'getAllScouts' });

void Matcher;
void Example;
void getAllScouts;
