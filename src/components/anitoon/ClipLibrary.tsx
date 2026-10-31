import { ArrowUpRight, Play } from 'lucide-react';
import { CLIPS } from '../../data/clips';

export function ClipLibrary() {
  return (
    <section className="library" id="library" aria-labelledby="library-title">
      <div className="shell">
        <div className="library-head" data-reveal>
          <div>
            <h2 id="library-title" className="h2">
              The first drop.
            </h2>
            <p>Four clips. Four specs. Every frame at 60fps.</p>
          </div>
          <span className="library-count">04 clips / 04 specs</span>
        </div>

        <div className="library-grid">
          {CLIPS.map((clip, index) => (
            <button
              key={clip.id}
              type="button"
              className="clip-card"
              data-clip={clip.id}
              aria-label={`Open ${clip.title}`}
              data-reveal
              data-delay={index === 0 ? undefined : String(index)}
            >
              <span className="clip-media">
                <img src={clip.poster} alt={`${clip.title} poster`} width={720} height={720} loading="lazy" />
                <span className="clip-badge">60fps</span>
                <span className="clip-category">{clip.category}</span>
                <span className="clip-play">
                  <Play size={18} fill="currentColor" strokeWidth={0} />
                </span>
              </span>

              <span className="clip-body">
                <span className="clip-top">
                  <span className="clip-title">{clip.title}</span>
                  <span className="clip-duration">{clip.duration}</span>
                </span>
                <span className="clip-character">
                  {clip.character} · {clip.scene}
                </span>
                <span className="clip-desc">{clip.description}</span>
                <span className="clip-tags">
                  {clip.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </span>
                <span className="clip-foot">
                  <span>{clip.resolution}</span>
                  <span className="clip-open">
                    Open clip
                    <ArrowUpRight size={13} strokeWidth={1.9} />
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
