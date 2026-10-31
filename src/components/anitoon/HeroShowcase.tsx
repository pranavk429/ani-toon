'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import { CLIPS } from '../../data/clips';
import { AnitoonMark } from './Brand';

export function HeroShowcase() {
  const [selectedId, setSelectedId] = useState(CLIPS[0].id);
  const reduced = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
  const selected = CLIPS.find((clip) => clip.id === selectedId) ?? CLIPS[0];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedId, reduced]);

  return (
    <section className="showcase" aria-labelledby="showcase-title">
      <div className="shell">
        <h2 id="showcase-title" className="sr-only">
          The Anitoon clip library
        </h2>

        <div className="showcase-frame">
          <div className="showcase-window">
            <div className="showcase-bar">
              <span className="showcase-brand">
                <AnitoonMark size={22} />
                Anitoon
                <span>library</span>
              </span>
              <span className="showcase-bar-sep" aria-hidden="true" />
              <span className="showcase-bar-title">First drop · 4 clips</span>
              <span className="showcase-fps">
                <i aria-hidden="true" />
                60 fps
              </span>
            </div>

            <div className="showcase-body">
              <div className="showcase-feature">
                <div className="showcase-poster">
                  {reduced ? (
                    <img src={selected.poster} alt={`${selected.title} clip poster`} width={720} height={720} />
                  ) : (
                    <video
                      ref={videoRef}
                      key={selected.id}
                      className="showcase-video"
                      src={selected.preview}
                      poster={selected.poster}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-label={`${selected.title} clip preview`}
                    />
                  )}
                  <button
                    type="button"
                    className="showcase-play"
                    data-clip={selected.id}
                    aria-label={`Play ${selected.title}`}
                  >
                    <Play size={22} fill="currentColor" strokeWidth={0} />
                  </button>
                  <span className="showcase-badge">60fps</span>
                </div>

                <div className="showcase-caption">
                  <div>
                    <span className="showcase-title">{selected.title}</span>
                    <span className="showcase-meta">
                      {selected.character} · {selected.scene} · {selected.duration}
                    </span>
                  </div>
                  <span className="tag">{selected.resolution}</span>
                </div>
              </div>

              <div className="showcase-side">
                <div className="showcase-side-head">
                  <span>Clips</span>
                  <span>03</span>
                </div>

                <div className="showcase-list">
                  {CLIPS.map((clip) => {
                    const active = clip.id === selected.id;
                    return (
                      <button
                        key={clip.id}
                        type="button"
                        className={`showcase-row${active ? ' is-active' : ''}`}
                        onClick={() => setSelectedId(clip.id)}
                        aria-pressed={active}
                      >
                        <img src={clip.poster} alt="" width={720} height={720} loading="lazy" />
                        <span className="showcase-row-copy">
                          <strong>{clip.title}</strong>
                          <small>
                            {clip.category} · {clip.duration}
                          </small>
                        </span>
                        <span className="showcase-row-fps">60</span>
                      </button>
                    );
                  })}
                </div>

                <div className="showcase-about">
                  <span className="showcase-about-label">About this clip</span>
                  <p>{selected.description}</p>
                  <div className="showcase-about-tags">
                    {selected.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="showcase-side-foot">
                  <span>Every clip ships with its spec.</span>
                  <button type="button" className="btn btn-dark btn-sm" data-clip={selected.id}>
                    Play clip
                    <ArrowUpRight size={14} strokeWidth={1.9} />
                  </button>
                </div>
              </div>
            </div>

            <div className="showcase-foot">
              <span className="showcase-foot-item">
                <i aria-hidden="true" />
                60 fps
              </span>
              <span className="showcase-foot-item">1080 × 1080</span>
              <span className="showcase-foot-item">Spec included</span>
              <span className="showcase-foot-note">Select a clip · play to open the viewer</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
