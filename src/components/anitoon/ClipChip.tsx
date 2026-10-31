import { Play } from 'lucide-react';
import type { Clip } from '../../data/clips';

export function ClipChip({ clip, label }: { clip: Clip; label: string }) {
  return (
    <button
      type="button"
      className="clip-chip"
      data-clip={clip.id}
      aria-label={`Open ${label} preview`}
      title={label}
    >
      <img src={clip.chip} alt="" width={120} height={120} />
      <span className="clip-chip-play" aria-hidden="true">
        <Play size={7} fill="currentColor" strokeWidth={0} />
      </span>
    </button>
  );
}
