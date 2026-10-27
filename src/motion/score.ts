import type {
  Beat,
  CompiledScore,
  Genome,
  Idle,
  MotionScore,
  Pose,
} from '../mascot/types';
import { blinkKeys, clamp, flow, type FlowKey, type Keys } from './engine';

type TrackChannel = keyof CompiledScore['tracks'];
type FaceChannel = keyof CompiledScore['face'];

const REST: Record<TrackChannel, number> = {
  lift: 0,
  sx: 1,
  sy: 1,
  lean: 0,
  shift: 0,
  yaw: 0,
  head: 0,
  armLA: 16,
  armLE: 16,
  armRA: 16,
  armRE: 16,
  legL: 3,
  legR: 3,
  tail: 0,
  earL: 0,
  earR: 0,
  gazeX: 0,
  gazeY: 0,
  propTilt: 0,
  propLift: 0,
};

const FACE_REST: Record<FaceChannel, number> = { lid: 0, lidR: 0, cheek: 0, mouth: 8, brow: 0 };

type KeysByChannel = Partial<Record<TrackChannel, Array<[number, number]>>>;
type FaceKeys = Partial<Record<FaceChannel, Array<[number, number]>>>;

type RawAction = {
  dur: number;
  keys: KeysByChannel;
  face?: FaceKeys;
  gaze?: Array<[number, number, number]>;
  /** extra time to hold the final pose before settling */
  hold?: number;
};

const A = {
  wake: {
    dur: 1000,
    keys: {
      head: [[0, 7], [400, 4], [1000, 0]],
      lean: [[0, 3], [600, 1], [1000, 0]],
      armLA: [[0, 8], [1000, 12]],
      armRA: [[0, 8], [1000, 12]],
      lift: [[0, 0], [500, 2], [1000, 0]],
    },
    face: { lid: [[0, 0.55], [500, 0.25], [900, 0]], mouth: [[0, 5], [600, 6], [1000, 8]] },
  },
  perk: {
    dur: 800,
    keys: {
      lift: [[0, 0], [180, 5], [420, 8], [800, 0]],
      sy: [[0, 1], [180, 0.97], [420, 1.04], [800, 1]],
      sx: [[0, 1], [180, 1.02], [420, 0.98], [800, 1]],
      head: [[0, -5], [220, 5], [480, 3], [800, 0]],
      lean: [[0, -2], [300, 2], [800, 0]],
      earL: [[0, -8], [220, 8], [800, 0]],
      earR: [[0, -8], [240, 9], [800, 0]],
      armLA: [[0, 12], [300, 24], [800, 12]],
      armRA: [[0, 12], [320, 24], [800, 12]],
      tail: [[0, 0], [260, 10], [560, -6], [800, 0]],
    },
    face: { lid: [[0, 0.25], [200, 0], [800, 0]], mouth: [[0, 8], [260, 15], [600, 13], [800, 9]], cheek: [[0, 0.15], [300, 0.45], [800, 0.2]] },
  },
  wave: {
    dur: 1900,
    keys: {
      armRA: [[0, 12], [220, 64], [380, 62], [540, 67], [700, 60], [860, 67], [1020, 61], [1250, 58], [1900, 12]],
      armRE: [[0, 6], [220, 108], [380, 126], [540, 100], [700, 128], [860, 100], [1020, 126], [1250, 104], [1900, 6]],
      armLA: [[0, 12], [300, 18], [1300, 18], [1900, 12]],
      armLE: [[0, 6], [300, 10], [1900, 6]],
      lean: [[0, 0], [250, -2.5], [1200, -2], [1900, 0]],
      shift: [[0, 0], [300, -2], [1200, -2], [1900, 0]],
      head: [[0, 0], [260, 5], [600, 3], [1000, 5], [1400, 2], [1900, 0]],
      earR: [[0, 0], [300, 7], [700, 4], [1200, 7], [1900, 0]],
      earL: [[0, 0], [340, -4], [1200, -3], [1900, 0]],
      tail: [[0, 0], [350, 8], [900, -5], [1400, 6], [1900, 0]],
    },
    face: {
      mouth: [[0, 8], [260, 16], [600, 18], [1100, 15], [1900, 9]],
      cheek: [[0, 0], [300, 0.55], [1400, 0.45], [1900, 0.1]],
      lid: [[0, 0], [1900, 0]],
    },
  },
  point: {
    dur: 1400,
    keys: {
      armRA: [[0, 12], [260, 82], [1000, 80], [1400, 12]],
      armRE: [[0, 6], [260, 2], [1000, 3], [1400, 6]],
      armLA: [[0, 12], [300, 22], [1000, 22], [1400, 12]],
      head: [[0, 0], [300, -5], [1000, -4], [1400, 0]],
      lean: [[0, 0], [300, 2.5], [1000, 2], [1400, 0]],
      shift: [[0, 0], [300, 2], [1000, 2], [1400, 0]],
      gazeX: [[0, 0], [260, 5], [1100, 5], [1400, 0]],
      gazeY: [[0, 0], [260, 0], [1400, 0]],
    },
    face: { mouth: [[0, 8], [300, 13], [1000, 12], [1400, 9]], cheek: [[0, 0], [300, 0.35], [1400, 0]] },
  },
  present: {
    dur: 1600,
    keys: {
      armRA: [[0, 12], [300, 70], [1200, 68], [1600, 12]],
      armRE: [[0, 6], [300, 24], [1200, 22], [1600, 6]],
      armLA: [[0, 12], [360, 52], [1200, 50], [1600, 12]],
      armLE: [[0, 6], [360, 18], [1200, 20], [1600, 6]],
      lean: [[0, 0], [400, -2], [1200, -1], [1600, 0]],
      head: [[0, 0], [400, -3], [900, 2], [1600, 0]],
      lift: [[0, 0], [400, 3], [1200, 2], [1600, 0]],
    },
    face: { mouth: [[0, 8], [350, 16], [1200, 15], [1600, 9]], cheek: [[0, 0], [400, 0.45], [1600, 0]] },
  },
  sip: {
    dur: 2000,
    keys: {
      armRA: [[0, 12], [350, 34], [650, 30], [1100, 30], [1500, 36], [2000, 12]],
      armRE: [[0, 6], [350, 112], [650, 132], [1100, 130], [1500, 110], [2000, 6]],
      head: [[0, 0], [350, -4], [650, -9], [1100, -8], [1500, -3], [2000, 0]],
      lean: [[0, 0], [400, -1], [1500, -1], [2000, 0]],
      propTilt: [[0, 0], [350, -8], [650, -22], [1100, -20], [1500, -6], [2000, 0]],
    },
    face: {
      mouth: [[0, 8], [350, 5], [650, 4], [1000, 4], [1200, 8], [1500, 12], [2000, 9]],
      lid: [[0, 0], [650, 0.25], [1100, 0.2], [1400, 0], [2000, 0]],
      cheek: [[0, 0], [650, 0.3], [1500, 0.4], [2000, 0]],
    },
  },
  nod: {
    dur: 1000,
    keys: {
      head: [[0, 0], [180, 9], [380, -1], [620, 5], [1000, 0]],
      lift: [[0, 0], [200, 1], [500, 0], [1000, 0]],
      earL: [[0, 0], [220, -5], [500, 3], [1000, 0]],
      earR: [[0, 0], [250, -6], [520, 4], [1000, 0]],
    },
    face: { lid: [[0, 0], [330, 0.75], [520, 0], [1000, 0]], mouth: [[0, 8], [250, 11], [700, 9], [1000, 8]], cheek: [[0, 0], [300, 0.4], [1000, 0]] },
  },
  shake: {
    dur: 1000,
    keys: {
      head: [[0, 0], [140, -7], [340, 7], [540, -7], [740, 5], [1000, 0]],
      yaw: [[0, 0], [140, -0.4], [340, 0.4], [540, -0.4], [740, 0.3], [1000, 0]],
      earL: [[0, 0], [140, 6], [340, -6], [540, 5], [1000, 0]],
      earR: [[0, 0], [160, -6], [360, 6], [560, -5], [1000, 0]],
    },
    face: { mouth: [[0, 8], [200, 6], [600, 7], [1000, 8]], lid: [[0, 0], [400, 0.3], [600, 0], [1000, 0]] },
  },
  shrug: {
    dur: 1200,
    keys: {
      armLA: [[0, 12], [300, 52], [900, 54], [1200, 12]],
      armLE: [[0, 6], [300, 38], [900, 42], [1200, 6]],
      armRA: [[0, 12], [300, 52], [900, 54], [1200, 12]],
      armRE: [[0, 6], [300, 38], [900, 42], [1200, 6]],
      lift: [[0, 0], [300, 3], [900, 2], [1200, 0]],
      head: [[0, 0], [300, 5], [900, 4], [1200, 0]],
      lean: [[0, 0], [300, -2], [900, -1], [1200, 0]],
    },
    face: { mouth: [[0, 8], [300, 5], [900, 6], [1200, 9]], brow: [[0, 0], [300, -0.35], [900, -0.3], [1200, 0]] },
  },
  think: {
    dur: 1800,
    keys: {
      armRA: [[0, 12], [400, 38], [1300, 36], [1800, 12]],
      armRE: [[0, 6], [400, 118], [1300, 124], [1800, 6]],
      armLA: [[0, 12], [500, 16], [1300, 16], [1800, 12]],
      head: [[0, 0], [400, -6], [900, -4], [1300, -6], [1800, 0]],
      lean: [[0, 0], [400, -1.5], [1300, -1], [1800, 0]],
      shift: [[0, 0], [400, -1.5], [1300, -1], [1800, 0]],
      gazeX: [[0, 0], [400, -4], [900, -3], [1300, -4], [1600, 0], [1800, 0]],
      gazeY: [[0, 0], [400, -5], [900, -4], [1300, -5], [1600, 0], [1800, 0]],
    },
    face: { mouth: [[0, 8], [400, 5], [1300, 5], [1800, 9]], brow: [[0, 0], [400, 0.35], [1300, 0.3], [1800, 0]], cheek: [[0, 0], [900, 0.2], [1800, 0]] },
  },
  cheer: {
    dur: 1800,
    keys: {
      armLA: [[0, 12], [260, 150], [900, 146], [1300, 152], [1800, 12]],
      armLE: [[0, 6], [260, 8], [900, 12], [1300, 6], [1800, 6]],
      armRA: [[0, 12], [280, 150], [900, 144], [1300, 150], [1800, 12]],
      armRE: [[0, 6], [280, 10], [900, 14], [1300, 8], [1800, 6]],
      lift: [[0, 0], [220, 0], [340, 12], [520, 22], [700, 8], [820, 0], [940, 3], [1100, 0], [1800, 0]],
      sy: [[0, 1], [200, 0.94], [340, 1.08], [620, 1.04], [820, 0.9], [940, 1.03], [1100, 1], [1800, 1]],
      sx: [[0, 1], [200, 1.04], [340, 0.96], [620, 0.98], [820, 1.06], [940, 0.99], [1100, 1], [1800, 1]],
      head: [[0, 0], [260, -5], [700, -3], [900, 0], [1800, 0]],
      legL: [[0, 3], [340, 10], [620, 8], [900, 3], [1800, 3]],
      legR: [[0, 3], [340, 9], [620, 8], [900, 3], [1800, 3]],
      earL: [[0, 0], [280, -8], [700, -5], [900, 0], [1800, 0]],
      earR: [[0, 0], [300, -9], [700, -6], [900, 0], [1800, 0]],
      tail: [[0, 0], [300, 12], [700, -6], [1000, 5], [1800, 0]],
    },
    face: { mouth: [[0, 8], [280, 21], [700, 20], [1000, 16], [1800, 9]], cheek: [[0, 0], [280, 1], [1000, 0.8], [1800, 0]], lid: [[0, 0], [300, 0.15], [700, 0.1], [1000, 0], [1800, 0]] },
  },
  hop: {
    dur: 1000,
    keys: {
      lift: [[0, 0], [140, 0], [220, 4], [420, 18], [620, 4], [760, 0], [1000, 0]],
      sy: [[0, 1], [140, 0.93], [220, 1.06], [420, 1.03], [620, 1.06], [760, 0.9], [900, 1.02], [1000, 1]],
      sx: [[0, 1], [140, 1.05], [220, 0.97], [420, 0.99], [620, 0.98], [760, 1.07], [900, 0.99], [1000, 1]],
      head: [[0, 0], [140, 3], [420, -3], [760, 3], [1000, 0]],
      armLA: [[0, 12], [140, 20], [420, 120], [760, 30], [1000, 12]],
      armLE: [[0, 6], [140, 10], [420, 20], [760, 12], [1000, 6]],
      armRA: [[0, 12], [160, 20], [420, 120], [760, 30], [1000, 12]],
      armRE: [[0, 6], [160, 10], [420, 20], [760, 12], [1000, 6]],
      legL: [[0, 3], [140, 2], [420, 12], [760, 5], [1000, 3]],
      legR: [[0, 3], [160, 2], [420, 11], [760, 5], [1000, 3]],
    },
    face: { mouth: [[0, 8], [140, 10], [420, 17], [760, 12], [1000, 9]], cheek: [[0, 0], [420, 0.5], [1000, 0]] },
  },
  dance: {
    dur: 2600,
    keys: {
      shift: [[0, 0], [350, 6], [750, -6], [1150, 6], [1550, -6], [1950, 5], [2300, 0], [2600, 0]],
      lean: [[0, 0], [350, 4], [750, -4], [1150, 4], [1550, -4], [1950, 3], [2300, 0], [2600, 0]],
      head: [[0, 0], [350, 6], [750, -6], [1150, 6], [1550, -6], [1950, 5], [2300, 0], [2600, 0]],
      armLA: [[0, 12], [350, 70], [750, 20], [1150, 80], [1550, 20], [1950, 60], [2300, 12], [2600, 12]],
      armLE: [[0, 6], [350, 70], [750, 20], [1150, 80], [1550, 20], [1950, 60], [2300, 6], [2600, 6]],
      armRA: [[0, 12], [350, 20], [750, 80], [1150, 20], [1550, 80], [1950, 20], [2300, 12], [2600, 12]],
      armRE: [[0, 6], [350, 20], [750, 80], [1150, 20], [1550, 80], [1950, 20], [2300, 6], [2600, 6]],
      lift: [[0, 0], [350, 3], [750, 0], [1150, 3], [1550, 0], [1950, 2], [2300, 0], [2600, 0]],
      legL: [[0, 3], [350, 8], [750, 3], [1150, 8], [1550, 3], [2300, 3], [2600, 3]],
      legR: [[0, 3], [350, 3], [750, 8], [1150, 3], [1550, 8], [2300, 3], [2600, 3]],
      tail: [[0, 0], [350, 10], [750, -10], [1150, 10], [1550, -10], [1950, 8], [2300, 0], [2600, 0]],
      earL: [[0, 0], [350, -6], [750, 6], [1150, -6], [1550, 6], [1950, -4], [2300, 0], [2600, 0]],
      earR: [[0, 0], [350, 6], [750, -6], [1150, 6], [1550, -6], [1950, 4], [2300, 0], [2600, 0]],
    },
    face: {
      mouth: [[0, 8], [350, 16], [750, 14], [1150, 17], [1550, 14], [1950, 15], [2300, 9], [2600, 9]],
      cheek: [[0, 0], [350, 0.7], [1550, 0.6], [2300, 0.1], [2600, 0.1]],
      lid: [[0, 0], [700, 0.15], [1100, 0], [1500, 0.15], [1900, 0], [2600, 0]],
    },
  },
  laugh: {
    dur: 1600,
    keys: {
      head: [[0, 0], [200, -9], [500, -12], [800, -7], [1100, -10], [1400, -3], [1600, 0]],
      lean: [[0, 0], [300, -3], [900, -2], [1600, 0]],
      lift: [[0, 0], [300, 2], [600, 0], [900, 2], [1200, 0], [1600, 0]],
      sy: [[0, 1], [300, 1.02], [600, 0.99], [900, 1.02], [1200, 1], [1600, 1]],
      armLA: [[0, 12], [300, 30], [900, 26], [1600, 12]],
      armRA: [[0, 12], [320, 30], [900, 26], [1600, 12]],
      earL: [[0, 0], [250, -8], [800, 5], [1600, 0]],
      earR: [[0, 0], [270, -8], [820, 5], [1600, 0]],
      tail: [[0, 0], [300, 8], [700, -6], [1200, 5], [1600, 0]],
    },
    face: {
      mouth: [[0, 8], [180, 22], [500, 25], [800, 22], [1100, 24], [1400, 14], [1600, 9]],
      cheek: [[0, 0], [200, 1], [1400, 0.9], [1600, 0]],
      lid: [[0, 0], [200, 0.65], [1400, 0.5], [1600, 0]],
    },
  },
  recoil: {
    dur: 1000,
    keys: {
      lean: [[0, 0], [160, -8], [500, -6], [1000, 0]],
      head: [[0, 0], [160, 7], [500, 5], [1000, 0]],
      shift: [[0, 0], [160, -3], [500, -2], [1000, 0]],
      lift: [[0, 0], [160, 3], [500, 1], [1000, 0]],
      armLA: [[0, 12], [160, 78], [500, 70], [1000, 12]],
      armLE: [[0, 6], [160, 18], [500, 22], [1000, 6]],
      armRA: [[0, 12], [180, 78], [520, 70], [1000, 12]],
      armRE: [[0, 6], [180, 18], [520, 22], [1000, 6]],
      earL: [[0, 0], [160, -12], [600, -6], [1000, 0]],
      earR: [[0, 0], [180, -12], [620, -6], [1000, 0]],
    },
    face: { mouth: [[0, 8], [160, 20], [500, 16], [1000, 9]], lid: [[0, 0], [160, 0], [500, 0.2], [800, 0], [1000, 0]], brow: [[0, 0], [180, -0.5], [600, -0.3], [1000, 0]] },
  },
  sleepy: {
    dur: 1800,
    keys: {
      head: [[0, 0], [400, 7], [1000, 9], [1500, 5], [1800, 2]],
      lean: [[0, 0], [400, 2], [1400, 2], [1800, 0]],
      lift: [[0, 0], [600, -2], [1200, -1], [1800, 0]],
      armLA: [[0, 12], [400, 8], [1400, 8], [1800, 12]],
      armRA: [[0, 12], [420, 8], [1400, 8], [1800, 12]],
      earL: [[0, 0], [500, -5], [1400, -4], [1800, 0]],
      earR: [[0, 0], [520, -5], [1420, -4], [1800, 0]],
    },
    face: { lid: [[0, 0], [300, 0.45], [1200, 0.62], [1600, 0.3], [1800, 0.15]], mouth: [[0, 8], [600, 5], [1400, 5], [1800, 8]], cheek: [[0, 0], [600, 0.25], [1800, 0]] },
  },
  stretch: {
    dur: 1900,
    keys: {
      armLA: [[0, 12], [350, 148], [900, 150], [1300, 145], [1900, 12]],
      armLE: [[0, 6], [350, 8], [900, 10], [1300, 8], [1900, 6]],
      armRA: [[0, 12], [380, 148], [900, 150], [1300, 145], [1900, 12]],
      armRE: [[0, 6], [380, 8], [900, 10], [1300, 8], [1900, 6]],
      lift: [[0, 0], [400, 4], [1000, 3], [1500, 0], [1900, 0]],
      sy: [[0, 1], [400, 1.05], [1000, 1.04], [1500, 1], [1900, 1]],
      sx: [[0, 1], [400, 0.98], [1000, 0.99], [1500, 1], [1900, 1]],
      head: [[0, 0], [400, -5], [1000, -4], [1500, 2], [1900, 0]],
    },
    face: { mouth: [[0, 8], [400, 20], [1000, 18], [1500, 10], [1900, 9]], lid: [[0, 0], [400, 0.35], [1000, 0.25], [1500, 0], [1900, 0]], cheek: [[0, 0], [800, 0.3], [1900, 0]] },
  },
  listen: {
    dur: 1400,
    keys: {
      head: [[0, 0], [400, 6], [1000, 4], [1400, 0]],
      lean: [[0, 0], [400, 2], [1000, 1.5], [1400, 0]],
      shift: [[0, 0], [400, 1.5], [1000, 1], [1400, 0]],
      earL: [[0, 0], [300, 8], [1000, 5], [1400, 0]],
      earR: [[0, 0], [320, 8], [1020, 5], [1400, 0]],
      armLA: [[0, 12], [400, 16], [1000, 15], [1400, 12]],
      armRA: [[0, 12], [420, 16], [1000, 15], [1400, 12]],
    },
    face: { mouth: [[0, 8], [300, 10], [1000, 9], [1400, 8]], cheek: [[0, 0], [500, 0.35], [1400, 0]], lid: [[0, 0], [700, 0.1], [900, 0], [1400, 0]] },
  },
  wink: {
    dur: 800,
    keys: {
      head: [[0, 0], [180, 4], [600, 3], [800, 0]],
      lean: [[0, 0], [200, 1.5], [600, 1], [800, 0]],
      earL: [[0, 0], [200, 5], [600, 3], [800, 0]],
    },
    face: { lidR: [[0, 0], [160, 1], [380, 1], [620, 0]], cheek: [[0, 0], [200, 0.7], [700, 0.4], [800, 0]], mouth: [[0, 8], [200, 15], [600, 13], [800, 9]] },
  },
  look: {
    dur: 1200,
    keys: {
      head: [[0, 0], [300, 3], [900, 2], [1200, 0]],
      yaw: [[0, 0], [300, 0.25], [900, 0.2], [1200, 0]],
    },
    face: { mouth: [[0, 8], [300, 10], [900, 9], [1200, 8]], lid: [[0, 0], [1200, 0]] },
  },
  tap: {
    dur: 900,
    keys: {
      legR: [[0, 3], [160, 10], [320, 3], [480, 10], [640, 3], [900, 3]],
      shift: [[0, 0], [160, 2], [320, 0], [480, 2], [640, 0], [900, 0]],
      head: [[0, 0], [240, 3], [600, 1], [900, 0]],
    },
    face: { mouth: [[0, 8], [300, 10], [900, 8]] },
  },
  settle: {
    dur: 1200,
    keys: {
      lean: [[0, 0], [400, 0], [1200, 0]],
      lift: [[0, 0], [500, 1], [1000, 0], [1200, 0]],
      head: [[0, 0], [400, 2], [1200, 0]],
      armLA: [[0, 12], [400, 14], [1200, 12]],
      armRA: [[0, 12], [400, 14], [1200, 12]],
    },
    face: { mouth: [[0, 8], [500, 10], [1200, 8]], cheek: [[0, 0.1], [1200, 0]] },
  },
  bow: {
    dur: 1500,
    keys: {
      lean: [[0, 0], [400, 16], [900, 16], [1500, 0]],
      head: [[0, 0], [400, 8], [900, 8], [1500, 0]],
      armLA: [[0, 12], [400, 8], [900, 8], [1500, 12]],
      armRA: [[0, 12], [420, 8], [900, 8], [1500, 12]],
      lift: [[0, 0], [400, -2], [900, -2], [1500, 0]],
    },
    face: { mouth: [[0, 8], [400, 11], [900, 10], [1500, 9]], cheek: [[0, 0], [400, 0.3], [1500, 0]] },
  },
} satisfies Record<string, RawAction>;

export type ActionKey = keyof typeof A;

function mirror(action: RawAction): RawAction {
  const keys: KeysByChannel = {};
  const swap: Record<string, string> = {
    armLA: 'armRA',
    armRA: 'armLA',
    armLE: 'armRE',
    armRE: 'armLE',
    legL: 'legR',
    legR: 'legL',
    earL: 'earR',
    earR: 'earL',
  };
  const negate = new Set(['lean', 'shift', 'head', 'gazeX', 'yaw']);
  for (const [k, v] of Object.entries(action.keys)) {
    const target = swap[k] ?? k;
    keys[target as TrackChannel] = negate.has(k) ? v!.map(([t, val]) => [t, -val]) : v;
  }
  const face = action.face
    ? Object.fromEntries(Object.entries(action.face).map(([k, v]) => [k, k === 'lidR' ? v : v]))
    : undefined;
  const gaze = action.gaze?.map(([t, x, y]) => [t, -x, y] as [number, number, number]);
  return { ...action, keys, face, gaze };
}

function scaleKeys(v: Array<[number, number]>, rest: number, k: number): Array<[number, number]> {
  return v.map(([t, val]) => [t, rest + (val - rest) * k]);
}

function mergeSorted(a: FlowKey[], b: FlowKey[]): FlowKey[] {
  const map = new Map<number, number>();
  for (const [t, v] of a) map.set(t, v);
  for (const [t, v] of b) map.set(t, v);
  return [...map.entries()].sort((x, y) => x[0] - y[0]);
}

function valueAt(keys: FlowKey[], t: number): number {
  return flow(t, keys);
}

const HEAD_ACTIONS = new Set(['perk', 'wave', 'point', 'look', 'nod', 'shake', 'recoil', 'cheer']);

export function compileScore(score: MotionScore, genome: Genome): CompiledScore {
  const duration = Math.max(2200, Math.round(score.duration));
  const personality = genome.personality;
  const energy = 0.62 + personality.energy * 0.75;
  const calm = 1 - personality.calm * 0.3;
  const snappy = 0.78 + personality.snappiness * 0.45;
  const amp = energy * calm;

  const tracks: Record<TrackChannel, FlowKey[]> = {} as Record<TrackChannel, FlowKey[]>;
  for (const ch of Object.keys(REST) as TrackChannel[]) {
    tracks[ch] = [
      [0, REST[ch]],
      [duration, REST[ch]],
    ];
  }

  const face: Record<FaceChannel, Keys> = {
    lid: [[0, 0], [duration, 0]],
    lidR: [[0, 0], [duration, 0]],
    cheek: [[0, 0], [duration, 0]],
    mouth: [[0, 8], [duration, 8]],
    brow: [[0, 0], [duration, 0]],
  };

  const beats = [...score.beats].sort((a, b) => a.t - b.t);
  const blinks = new Set((score.blinks ?? []).filter((b) => b > 0 && b < duration));

  for (const beat of beats) {
    const raw0 = A[beat.action as keyof typeof A] as RawAction | undefined;
    if (!raw0) continue;
    const raw = beat.side === -1 ? mirror(raw0) : raw0;
    const k = (beat.intensity ?? 0.8) * amp;
    const start = clamp(beat.t, 0, duration - 200);
    const stretch = (1 / snappy) * (0.75 + (beat.intensity ?? 0.8) * 0.35);
    const actionDur = Math.min(raw.dur * stretch, duration - start);
    const hold = (beat.hold ?? 180) * (1 / snappy);
    const end = Math.min(duration, start + actionDur + hold);

    // For every channel the action touches, pin the value it had at the start,
    // so overlapping beats flow from where the body actually is.
    for (const [ch, rawVals] of Object.entries(raw.keys) as Array<[TrackChannel, Array<[number, number]>]>) {
      const existing = tracks[ch];
      const scaled = scaleKeys(rawVals, REST[ch], k).map(
        ([dt, val]) => [start + (dt / raw.dur) * actionDur, val] as [number, number],
      );
      const pinned: FlowKey[] = [[start, valueAt(existing, start)], ...scaled, [end, REST[ch]]];
      tracks[ch] = mergeSorted(existing, pinned);
    }

    for (const [ch, rawVals] of Object.entries(raw.face ?? {}) as Array<[FaceChannel, Array<[number, number]>]>) {
      const rest = FACE_REST[ch];
      const scaled = scaleKeys(rawVals, rest, k).map(
        ([dt, val]) => [start + (dt / raw.dur) * actionDur, val] as [number, number],
      );
      const keys: Keys = [...face[ch], [start, trackAt(face[ch], start)], ...scaled.map(([t, v]) => [t, v] as const), [end, rest]];
      face[ch] = sortKeys(keys);
    }

    if (raw.gaze) {
      const gz: FlowKey[] = raw.gaze.map(
        ([dt, x]) => [start + (dt / raw.dur) * actionDur, x] as FlowKey,
      );
      tracks.gazeX = mergeSorted(tracks.gazeX, [[start, valueAt(tracks.gazeX, start)], ...gz, [end, 0]]);
      const gy: FlowKey[] = raw.gaze.map(
        ([dt, , y]) => [start + (dt / raw.dur) * actionDur, y] as FlowKey,
      );
      tracks.gazeY = mergeSorted(tracks.gazeY, [[start, valueAt(tracks.gazeY, start)], ...gy, [end, 0]]);
    }

    // Blink on the turn: a head-led action gets a blink shortly after it starts.
    if (HEAD_ACTIONS.has(beat.action) && !hasBlinkNear(blinks, start + 260, 700)) {
      blinks.add(start + 260);
    }

    // Raw pose overrides from the director win over the action's keys.
    if (beat.pose) {
      for (const [ch, val] of Object.entries(beat.pose) as Array<[TrackChannel, number]>) {
        if (!(ch in REST)) continue;
        tracks[ch] = mergeSorted(tracks[ch], [[start, val], [end, val]]);
      }
    }
  }

  // Gaze script: absolute glances. Idle wander is layered later.
  for (const g of score.gazes ?? []) {
    const t = clamp(g.t, 0, duration);
    const end = Math.min(duration, t + (g.hold ?? 900));
    tracks.gazeX = mergeSorted(tracks.gazeX, [[t, g.x], [end, valueAt(tracks.gazeX, end)]]);
    tracks.gazeY = mergeSorted(tracks.gazeY, [[t, g.y], [end, valueAt(tracks.gazeY, end)]]);
  }

  // Loop closure for acting channels: end exactly where the loop began.
  for (const ch of Object.keys(REST) as TrackChannel[]) {
    const first = tracks[ch][0]?.[1] ?? REST[ch];
    if (score.loop) {
      tracks[ch] = mergeSorted(tracks[ch].filter(([t]) => t < duration), [[duration, first]]);
    } else {
      const last = tracks[ch][tracks[ch].length - 1]?.[1] ?? REST[ch];
      tracks[ch] = mergeSorted(tracks[ch].filter(([t]) => t < duration), [[duration, last]]);
    }
  }

  const idleBase: Idle = {
    breath: 1,
    sway: 1,
    blinkEvery: 3600 - personality.playfulness * 500,
    gazeWander: 0.8,
    earFlick: 0.6,
  };
  const idle: Idle = { ...idleBase, ...(score.idle ?? {}) };

  const blinkList = [...blinks].sort((a, b) => a - b);
  const automatic = makeBlinkSchedule(duration, idle.blinkEvery, blinkList);
  // Acting lids (a squint during a laugh, a sleepy droop) and involuntary blinks
  // are two different layers. Combine them by max so neither erases the other.
  // The right eye closes ~24ms later: real blinks are never perfectly in sync.
  const actL = face.lid;
  const actR = face.lidR;
  const blinkL = blinkKeys(automatic, duration);
  const blinkR = blinkKeys(automatic.map((b) => b + 24), duration);
  face.lid = combineMax(actL, blinkL);
  face.lidR = combineMax(actR, blinkR);

  return {
    score: { ...score, duration },
    genome,
    tracks,
    face,
    idle,
    personality,
  };
}

function trackAt(keys: Keys, t: number): number {
  // Local ease-in-out read for face keys (mirrors engine.track without the import cycle).
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const span = k1[0] - k0[0];
      const p = span > 0 ? (t - k0[0]) / span : 1;
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      return k0[1] + (k1[1] - k0[1]) * e;
    }
  }
  return keys[keys.length - 1][1];
}

function sortKeys(keys: Keys): Keys {
  const map = new Map<number, (typeof keys)[number]>();
  for (const k of keys) map.set(k[0], k);
  return [...map.values()].sort((a, b) => a[0] - b[0]);
}

/** Pointwise maximum of two key tracks, sampled at the union of their times. */
function combineMax(a: Keys, b: Keys): Keys {
  const times = [...new Set([...a.map((k) => k[0]), ...b.map((k) => k[0])])].sort((x, y) => x - y);
  return times.map((t) => [t, Math.max(trackAt(a, t), trackAt(b, t))] as const);
}

function hasBlinkNear(blinks: Set<number>, t: number, window: number): boolean {
  for (const b of blinks) if (Math.abs(b - t) < window) return true;
  return false;
}

function makeBlinkSchedule(duration: number, every: number, explicit: number[]): number[] {
  const out = [...explicit];
  let t = 1200 + (duration % 700);
  let i = 0;
  while (t < duration - 400) {
    if (!hasBlinkNear(new Set(out), t, 650)) out.push(t);
    i++;
    t += every * (0.82 + ((i * 37) % 100) / 240);
  }
  return out.sort((a, b) => a - b);
}

/** The neutral pose a character rests in before any acting. */
export function basePose(): Pose {
  return {
    lift: 0,
    sx: 1,
    sy: 1,
    lean: 0,
    shift: 0,
    yaw: 0,
    head: 0,
    armL: { a: 16, e: 16 },
    armR: { a: 16, e: 16 },
    legL: 3,
    legR: 3,
    tail: 0,
    earL: 0,
    earR: 0,
    gazeX: 0,
    gazeY: 0,
    lid: 0,
    lidR: 0,
    cheek: 0,
    mouth: 8,
    brow: 0,
    propTilt: 0,
    propLift: 0,
  };
}

export function actionDuration(action: Beat['action']): number {
  return (A[action as keyof typeof A] as RawAction | undefined)?.dur ?? 1000;
}

export const ACTION_NAMES = Object.keys(A) as Array<keyof typeof A>;
