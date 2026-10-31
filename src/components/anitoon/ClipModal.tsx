'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileJson, MonitorPlay, Play, X } from 'lucide-react';
import { getClip } from '../../data/clips';
import { AnitoonMark } from './Brand';

const LivePlayer = dynamic(() => import('../../toon/ToonScene').then((mod) => mod.ToonPlayer), {
  ssr: false,
  loading: () => <div className="clip-loading">Loading the live render…</div>,
});

type Tab = 'preview' | 'spec' | 'live';

export function ClipModal() {
  const [clipId, setClipId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('preview');
  const [specs, setSpecs] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const requested = useRef<Record<string, boolean>>({});

  const clip = getClip(clipId);
  const spec = clip ? specs[clip.id] : null;
  const specError = clip ? errors[clip.id] ?? '' : '';

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const trigger = target?.closest('[data-clip]');
      if (!trigger) return;
      const id = trigger.getAttribute('data-clip');
      if (!id || !getClip(id)) return;
      event.preventDefault();
      lastFocus.current = document.activeElement as HTMLElement | null;
      setTab('preview');
      setCopied(false);
      setClipId(id);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!clip) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setClipId(null);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
  }, [clip]);

  useEffect(() => {
    if (!clip || requested.current[clip.id]) return;
    requested.current[clip.id] = true;
    let cancelled = false;
    fetch(clip.specFile)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the spec');
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setSpecs((current) => ({ ...current, [clip.id]: data }));
      })
      .catch(() => {
        if (!cancelled) {
          setErrors((current) => ({
            ...current,
            [clip.id]: 'The spec could not be loaded. Try the MP4 or the live render.',
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clip]);

  if (!clip) return null;

  const copySpec = async () => {
    if (!spec) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      if (clip) {
        setErrors((current) => ({
          ...current,
          [clip.id]: 'Clipboard is unavailable. Open the JSON file directly instead.',
        }));
      }
    }
  };

  return (
    <div
      className="clip-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setClipId(null);
      }}
    >
      <div className="clip-dialog" role="dialog" aria-modal="true" aria-labelledby="clip-dialog-title">
        <div className="clip-dialog-head">
          <span className="clip-dialog-brand">
            <AnitoonMark size={22} />
            Anitoon <span>/ clip</span>
          </span>
          <button ref={closeRef} type="button" className="clip-close" onClick={() => setClipId(null)}>
            <X size={16} strokeWidth={1.9} />
            Esc
          </button>
        </div>

        <div className="clip-dialog-body">
          <div className="clip-media-panel">
            <div className="clip-tabs" role="tablist" aria-label="Clip view">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'preview'}
                className={tab === 'preview' ? 'is-active' : ''}
                onClick={() => setTab('preview')}
              >
                <Play size={13} strokeWidth={1.9} />
                Preview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'spec'}
                className={tab === 'spec' ? 'is-active' : ''}
                onClick={() => setTab('spec')}
              >
                <FileJson size={13} strokeWidth={1.9} />
                Spec
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'live'}
                className={tab === 'live' ? 'is-active' : ''}
                onClick={() => setTab('live')}
              >
                <MonitorPlay size={13} strokeWidth={1.9} />
                Live SVG
              </button>
            </div>

            <div className="clip-stage">
              {tab === 'preview' && (
                <video
                  key={clip.id}
                  className="clip-video"
                  src={clip.video}
                  poster={clip.poster}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              )}

              {tab === 'spec' && (
                <div className="clip-spec">
                  <div className="clip-spec-bar">
                    <span>{clip.liveSpec}.json</span>
                    <button type="button" onClick={copySpec} disabled={!spec}>
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {specError ? (
                    <p className="clip-spec-error">{specError}</p>
                  ) : spec ? (
                    <pre>{JSON.stringify(spec, null, 2)}</pre>
                  ) : (
                    <p className="clip-spec-error">Loading the spec…</p>
                  )}
                </div>
              )}

              {tab === 'live' && (
                <div className="clip-live">
                  {specError ? (
                    <p className="clip-spec-error">{specError}</p>
                  ) : spec ? (
                    <div className="clip-live-frame">
                      <LivePlayer rawSpec={spec} />
                    </div>
                  ) : (
                    <div className="clip-loading">Loading the live render…</div>
                  )}
                  <span className="clip-live-note">The same JSON, rendered live at 60fps.</span>
                </div>
              )}
            </div>
          </div>

          <aside className="clip-info">
            <span className="tag">{clip.category}</span>
            <h2 id="clip-dialog-title">{clip.title}</h2>
            <p className="clip-info-char">
              {clip.character} · {clip.scene}
            </p>
            <p className="clip-info-desc">{clip.description}</p>

            <div className="clip-meta">
              <div>
                <span>Frame rate</span>
                <strong>60 fps</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{clip.duration}</strong>
              </div>
              <div>
                <span>Resolution</span>
                <strong>{clip.resolution}</strong>
              </div>
              <div>
                <span>Format</span>
                <strong>MP4 + JSON</strong>
              </div>
            </div>

            <div className="clip-info-tags">
              {clip.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>

            <div className="clip-actions">
              <a href={clip.video} download={`anitoon-${clip.id}.mp4`} className="btn btn-dark">
                Download MP4
                <Download size={15} strokeWidth={1.9} />
              </a>
              <button type="button" className="btn btn-light" onClick={copySpec} disabled={!spec}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Spec copied' : 'Copy spec'}
              </button>
            </div>

            <p className="clip-note">
              Every clip ships with its spec. No account, no upload, no stock footage.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
