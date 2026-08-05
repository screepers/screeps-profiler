type ProfileType = "stream" | "email" | "profile" | "background" | "callgrind";

interface Memory {
  profiler: {
    map: {};
    totalTime: number;
    enabledTick: number;
    disableTick: number;
    type: ProfileType;
    filter: string;
  }
}

declare var Memory: Memory;