// The unit is a SCENE, not a character.
//
// A horse is one actor (quadruped). A cowboy is one actor (biped). A cowboy on
// a horse is two actors, with the rider's root attached to the horse's `back`
// bone. A centaur is one custom skeleton. The compiler never assumes a humanoid.
//
// Skeleton space: x right, y up, origin at the actor's ground point (between
// the feet). Every bone's local frame starts at its joint; +x runs along the
// bone. `rot` is degrees CCW from the parent's +x. The renderer converts to
// SVG by flipping y.

export type BodyPlan = 'biped' | 'quadruped' | 'octopod' | 'blob' | 'custom';

// ---------------------------------------------------------------------------
// Human look. Only meaningful on a biped; presentation is shape language, not
// a costume code. Every field is data so the same 16-bone rig carries the cast.

export type Presentation = 'feminine' | 'masculine' | 'androgynous';

export type HairStyle =
  | 'short'
  | 'bob'
  | 'ponytail'
  | 'bun'
  | 'long'
  | 'curly'
  | 'afro'
  | 'braids'
  | 'bald';

export type Fringe = 'none' | 'straight' | 'side' | 'curtain';

export type FacialHair = 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard';

export type Top =
  | 'tee'
  | 'hoodie'
  | 'shirt'
  | 'blouse'
  | 'dress'
  | 'suit'
  | 'apron'
  | 'coat'
  | 'sport';

export type Bottom = 'jeans' | 'chinos' | 'shorts' | 'skirt' | 'leggings' | 'none';

export type Shoes = 'sneakers' | 'boots' | 'flats' | 'barefoot';

export type HumanLook = {
  presentation: Presentation;
  hair: { style: HairStyle; fringe: Fringe; volume: number };
  facialHair: FacialHair;
  body: { shoulders: number; hips: number; waist: number; height: number };
  outfit: { top: Top; bottom: Bottom; shoes: Shoes };
  face: {
    jaw: 'soft' | 'square';
    lashes: boolean;
    brow: 'soft' | 'strong';
    nose: 'small' | 'medium' | 'broad';
  };
};

export type Expression =
  | 'neutral'
  | 'happy'
  | 'surprised'
  | 'thinking'
  | 'shy'
  | 'laugh'
  | 'sleepy'
  | 'wink';

/** The fallback look for a biped that predates the human genome. Keeping this
 * stable means old scenes and share links still render. */
export const DEFAULT_HUMAN: HumanLook = {
  presentation: 'androgynous',
  hair: { style: 'short', fringe: 'side', volume: 1 },
  facialHair: 'none',
  body: { shoulders: 1, hips: 1, waist: 1, height: 1 },
  outfit: { top: 'shirt', bottom: 'jeans', shoes: 'boots' },
  face: { jaw: 'soft', lashes: false, brow: 'soft', nose: 'medium' },
};

export type BoneRole =
  | 'root'
  | 'spine'
  | 'neck'
  | 'head'
  | 'tail'
  | 'handL'
  | 'handR'
  | 'footL'
  | 'footR'
  | 'footBL'
  | 'footBR'
  | 'wingL'
  | 'wingR'
  | 'tentacle'
  | 'eyeL'
  | 'eyeR'
  | 'mouth'
  | 'back'
  | 'accessory';

export type BoneShape = 'capsule' | 'tapered' | 'blob' | 'fin' | 'plate';

export type Palette = {
  skin: string;
  belly: string;
  accent: string;
  detail: string;
  eye: string;
  mouth: string;
  /** garment colour; falls back to accent */
  cloth?: string;
  /** collar/cuff colour; falls back to belly */
  trim?: string;
  /** mane/fringe colour; falls back to detail */
  hair?: string;
  /** trousers colour; falls back to detail */
  pants?: string;
};

/** The six slots a bone is allowed to use. Keeps optional garment slots out
 * of the skeleton grammar. */
export type BoneColor = 'skin' | 'belly' | 'accent' | 'detail' | 'eye' | 'mouth';

export type FaceSpec = {
  eyes: number;
  eyeSize: number;
  eyeSpacing: number;
  pupil: 'round' | 'slit' | 'star';
  mouth: 'smile' | 'grin' | 'fang' | 'beak' | 'none';
  brows: boolean;
};

export type SurfaceKind = 'fur' | 'feathers' | 'scales' | 'skin' | 'metal' | 'goo';
export type SurfacePattern = 'none' | 'spots' | 'stripes' | 'plates';

export type AccessoryKind =
  | 'cowboy-hat'
  | 'chef-hat'
  | 'beanie'
  | 'cap'
  | 'glasses'
  | 'scarf'
  | 'saddle'
  | 'reins'
  | 'leaf-ears'
  | 'tennis-racket'
  | 'none';

export type AccessorySpec = {
  kind: AccessoryKind;
  color: string;
  /** bone id or role */
  attach: string;
};

export type Bone = {
  id: string;
  parent: string | null;
  role: BoneRole;
  /** rest position in the parent's local space */
  x: number;
  y: number;
  /** rest rotation in degrees CCW, relative to the parent's +x */
  rot: number;
  /** length along the bone's local +x */
  len: number;
  /** base width */
  w: number;
  /** 0 = same width at the tip, 1 = a point */
  taper: number;
  shape: BoneShape;
  color: BoneColor;
  /** draw order inside the actor: lower is behind */
  depth: number;
  /** chain id for secondary motion (tentacle0, legFL, tail, armL…) */
  chain?: string;
  /** 0..1 phase offset for gaits and tentacle ripples */
  phase?: number;
};

export type FaceAnchor = {
  bone: string;
  x: number;
  y: number;
  /** rotation of the face's local frame (+x right, +y down) inside the head bone */
  rot: number;
};

export type Skeleton = {
  bones: Bone[];
  /** bone id of the primary head */
  head: string;
  face: FaceSpec;
  faceAt: FaceAnchor;
  /** saddle / rider anchor, when the body plan has one */
  back?: string;
};

export type Genome = {
  id: string;
  name: string;
  species: string;
  bodyPlan: BodyPlan;
  palette: Palette;
  proportions: {
    head: number;
    torso: number;
    limbLength: number;
    limbWidth: number;
    limbCount: number;
    taper: number;
    neck: number;
  };
  face: FaceSpec;
  surface: { kind: SurfaceKind; pattern: SurfacePattern };
  accessories: AccessorySpec[];
  /** humans only; ignored by non-biped body plans */
  human?: HumanLook;
  /** required when bodyPlan is 'custom' */
  customBones?: Bone[];
  /** Illustration system identity. Generated characters use the shared style. */
  styleId?: string;
  /** Deterministic identity seed. */
  seed?: number;
};

export type Attachment = {
  /** parent actor id */
  actor: string;
  /** parent bone id */
  bone: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
};

export type ActorPose = 'stand' | 'ride' | 'sit' | 'float' | 'lie';

export type Actor = {
  id: string;
  genome: Genome;
  skeleton: Skeleton;
  attach?: Attachment;
  pose?: ActorPose;
  /** ground placement for actors that are not attached to another actor */
  place?: { x: number; y: number; scale?: number };
  /** draw order across actors: lower is behind */
  depth: number;
};

export type Verb =
  | 'idle'
  | 'look'
  | 'greet'
  | 'move'
  | 'reach'
  | 'celebrate'
  | 'hide'
  | 'interact'
  | 'emote'
  | 'walk'
  | 'trot'
  | 'gallop'
  | 'rear'
  | 'peek'
  | 'wave'
  | 'nod'
  | 'shake'
  | 'jump'
  | 'swing'
  | 'point'
  | 'think'
  | 'shrug'
  | 'clap'
  | 'laugh'
  | 'dance'
  | 'bow'
  | 'run'
  | 'stretch'
  | 'yawn'
  | 'wink'
  | 'stir';

export type Beat = {
  actor: string;
  verb: Verb;
  at: number;
  dur: number;
  target?: 'viewer' | 'left' | 'right' | 'up' | 'down' | 'prop' | 'self';
  /** 0..1; scales the amplitude of the program */
  intensity?: number;
  /**
   * A base layer runs continuously under actions (walk, idle, breathe).
   * Actions may not overlap each other; a base may run under them.
   */
  layer?: 'base' | 'action';
};

export type Score = {
  duration: number;
  mood: string;
  beats: Beat[];
};

export type WorldPreset =
  | 'sky'
  | 'garden'
  | 'kitchen'
  | 'night'
  | 'studio'
  | 'court'
  | 'meadow'
  | 'forest'
  | 'sunset'
  | 'desert'
  | 'winter'
  | 'ocean'
  | 'autumn'
  | 'rain'
  | 'sakura';

/** Free-standing vector props that can be animated independently of a bone. */
export type SceneObjectKind =
  | 'ball'
  | 'star'
  | 'plant'
  | 'flower'
  | 'cup'
  | 'gift'
  | 'heart'
  | 'watering-can'
  | 'pancake'
  | 'racket'
  | 'sparkle'
  | 'cloud'
  | 'orb'
  | 'flower-pot'
  | 'rocket'
  | 'note';

export type SceneObject = {
  id: string;
  kind: SceneObjectKind;
  label?: string;
  color: string;
  /** Centre in the 720x720 stage frame, y down. */
  x: number;
  y: number;
  scale?: number;
  /** Degrees, clockwise in stage space. */
  rotation?: number;
  /** back renders behind actors; front renders above them. */
  layer?: 'back' | 'front';
  opacity?: number;
};

export type Scene = {
  title: string;
  world: { preset: WorldPreset; accent: string };
  actors: Actor[];
  /** Independent props. Optional so every existing scene/share link still loads. */
  objects?: SceneObject[];
  score: Score;
  /** Illustration system identity, when generated by the studio. */
  styleId?: string;
};

export const DEFAULT_PROPORTIONS: Genome['proportions'] = {
  head: 1,
  torso: 1,
  limbLength: 1,
  limbWidth: 1,
  limbCount: 4,
  taper: 0.2,
  neck: 1,
};

export const DEFAULT_FACE: FaceSpec = {
  eyes: 2,
  eyeSize: 1,
  eyeSpacing: 1,
  pupil: 'round',
  mouth: 'smile',
  brows: true,
};
