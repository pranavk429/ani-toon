import { asset } from '../lib/asset';

export type ClipCategory = 'Character' | 'Scene' | 'Reveal';

export type Clip = {
  id: string;
  title: string;
  character: string;
  category: ClipCategory;
  scene: string;
  description: string;
  poster: string;
  chip: string;
  video: string;
  preview: string;
  specFile: string;
  liveSpec: string;
  fps: number;
  duration: string;
  durationMs: number;
  resolution: string;
  tags: string[];
  accent: string;
};

export const CLIPS: Clip[] = [
  {
    id: 'chef',
    title: 'Pancake Catch',
    character: 'Marco',
    category: 'Character',
    scene: 'Kitchen',
    description:
      'A chef flips a pancake, catches it on his hat, and lands a satisfied nod. Weight, steam and follow-through are all in the score.',
    poster: asset('/images/chef-poster.webp'),
    chip: asset('/images/clip-chef.jpg'),
    video: asset('/videos/chef.mp4'),
    preview: asset('/videos/chef-preview.mp4'),
    specFile: asset('/specs/chef-demo.json'),
    liveSpec: 'chef-demo',
    fps: 60,
    duration: '9.6s',
    durationMs: 9600,
    resolution: '1080 × 1080',
    tags: ['Food', 'Physics', 'Character'],
    accent: '#F7CF78',
  },
  {
    id: 'garden',
    title: 'Garden Bloom',
    character: 'Maya',
    category: 'Scene',
    scene: 'Garden',
    description:
      'A gardener waters a potted sprout. The plant grows, the character breathes, blinks and leans into the light — all on one 60fps clock.',
    poster: asset('/images/garden-poster.webp'),
    chip: asset('/images/clip-garden.jpg'),
    video: asset('/videos/garden.mp4'),
    preview: asset('/videos/garden-preview.mp4'),
    specFile: asset('/specs/garden-demo.json'),
    liveSpec: 'garden-demo',
    fps: 60,
    duration: '10.0s',
    durationMs: 10000,
    resolution: '1080 × 1080',
    tags: ['Nature', 'Growth', 'Scene'],
    accent: '#FFC6D3',
  },
  {
    id: 'reveal',
    title: 'Champion Reveal',
    character: 'Leo',
    category: 'Reveal',
    scene: 'Sky',
    description:
      'A mystery silhouette drops into a football celebration. Anticipation, squash and stretch, a kick, and a clean hero pose for the last frame.',
    poster: asset('/images/reveal-poster.webp'),
    chip: asset('/images/clip-reveal.jpg'),
    video: asset('/videos/reveal.mp4'),
    preview: asset('/videos/reveal-preview.mp4'),
    specFile: asset('/specs/reveal-demo.json'),
    liveSpec: 'reveal-demo',
    fps: 60,
    duration: '9.0s',
    durationMs: 9000,
    resolution: '1080 × 1080',
    tags: ['Sport', 'Reveal', 'UI'],
    accent: '#FF4B4B',
  },
];

export const getClip = (id: string | null | undefined) => CLIPS.find((clip) => clip.id === id);
