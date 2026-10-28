import { Play } from 'lucide-react';
import type { Clip } from '../../data/clips';

export function ClipChip({ clip, label }: { clip: Clip; label: string }) {
  return (
    <span className="clip-chip" aria-hidden="true" title={label}>
      <img src={clip.chip} alt="" width={240} height={240} />
      <span className="clip-chip-play">
        <Play size={8} fill="currentColor" strokeWidth={0} />
      </span>
    </span>
  );
}
