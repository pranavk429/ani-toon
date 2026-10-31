// The scene spec is the ONLY thing an AI Director is allowed to write.
// It is data, not code: the compiler turns it into motion with rossark rules
// (flow through poses, idle layers, follow-through, volume-preserving squash).

export type HairStyle = 'quiff' | 'short' | 'bun' | 'long' | 'bald' | 'curly';
export type Accessory =
  | 'none'
  | 'chef-hat'
  | 'sun-hat'
  | 'beanie'
  | 'cap'
  | 'glasses'
  | 'headband'
  | 'mustache'
  | 'cat-ears'
  | 'bear-ears'
  | 'bunny-ears'
  | 'antenna'
  | 'horns';
export type Pattern = 'none' | 'stripes' | 'badge' | 'apron' | 'overalls' | 'chef' | 'tennis';
export type WorldPreset = 'sky' | 'garden' | 'kitchen' | 'night' | 'studio';
export type PropKind = 'none' | 'ball' | 'pancake' | 'watering-can' | 'gift' | 'star' | 'jar' | 'cup' | 'heart' | 'racket';
export type Verb =
  | 'mystery'
  | 'drop-in'
  | 'wave'
  | 'kick'
  | 'toss'
  | 'hat-catch'
  | 'pour'
  | 'bloom'
  | 'cheer'
  | 'hop'
  | 'look'
  | 'nod'
  | 'shrug'
  | 'hip'
  | 'point'
  | 'wink'
  | 'peer'
  | 'gasp'
  | 'star-catch'
  | 'hug'
  | 'tennis-shot'
  | 'swing';

export type LookTarget = 'viewer' | 'left' | 'right' | 'up' | 'down' | 'prop';

export type CharacterSpec = {
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  accessory: Accessory;
  accessoryColor: string;
  top: string;
  topShade: string;
  bottom: string;
  shoe: string;
  pattern: Pattern;
};

export type BeatSpec = {
  at: number; // ms. For kick: the moment of contact. Otherwise the start.
  verb: Verb;
  dur?: number; // ms
  target?: LookTarget;
};

export type SceneSpec = {
  title: string;
  duration: number; // ms, one loop
  character: CharacterSpec;
  world: { preset: WorldPreset; accent: string };
  prop: { kind: PropKind; color: string };
  beats: BeatSpec[];
};

/** One arm: `a` the upper-arm outward angle (0 hangs down), `e` the elbow bend. */
export type ArmPose = { a: number; e: number };

export type Pose = {
  lift: number;
  sx: number;
  sy: number;
  lean: number;
  shift: number;
  yaw: number;
  head: number;
  headDy: number;
  armL: ArmPose;
  armR: ArmPose;
  legL: number;
  legR: number;
  toeR: number;
  float: number; // 0..1, legs hang limp
  pedal: number; // -1..1, which knee is folded
  lookX: number;
  lookY: number;
  lid: number;
  lidR: number;
  cheek: number;
  mouth: number;
  mouthW: number;
  browL: number;
  browR: number;
  widen: number;
  hatTilt: number;
  hatSy: number;
  hairSwing: number;
  hairUp: number;
  tilt: number; // watering can / held prop tilt in degrees
};
