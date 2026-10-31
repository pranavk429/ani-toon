'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  Code2,
  Copy,
  Download,
  Link2,
  Mic,
  RotateCcw,
  X,
} from 'lucide-react';
import { AnitoonMark } from '../anitoon/Brand';
import { useDirector } from './DirectorProvider';
import { DirectorStage } from './DirectorStage';
import { MiniFrame } from './MiniFrame';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function Studio() {
  const {
    current,
    messages,
    auditions,
    busy,
    input,
    setInput,
    submit,
    chooseAudition,
    regenerate,
    reset,
    share,
    copied,
    shareFallback,
    exportSvg,
    exportSpec,
    specOpen,
    setSpecOpen,
    notice,
    studioRef,
    promptRef,
  } = useDirector();

  const chatRef = useRef<HTMLDivElement | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [messages, auditions, busy]);

  useEffect(() => {
    if (!specOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpecOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [specOpen, setSpecOpen]);

  const startVoice = () => {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const Speech = getRecognition();
    if (!Speech) {
      setVoiceNote('Browser voice is not available here. Use Wispr Flow — Fn + Space — in any field.');
      return;
    }
    try {
      const rec = new Speech();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          for (let j = 0; j < result.length; j++) text += result[j].transcript;
        }
        setInput(text.trim());
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => {
        setListening(false);
        setVoiceNote('Voice input was blocked. Use Wispr Flow — Fn + Space — in any field.');
      };
      recognition.current = rec;
      rec.start();
      setVoiceNote(null);
      setListening(true);
    } catch {
      setVoiceNote('Voice input could not start. Use Wispr Flow — Fn + Space — in any field.');
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(current.spec, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      setVoiceNote('Clipboard is unavailable; use Download JSON instead.');
    }
  };

  return (
    <div className="hero-studio" id="studio">
      <div className="studio" ref={studioRef}>
          <div className="studio-bar">
            <div className="studio-brand">
              <AnitoonMark size={24} tone="paper" />
              <strong>Anitoon Studio</strong>
              <span>motion compiler</span>
            </div>
            <div className="studio-status">
              <span className="status-dot">
                <i aria-hidden="true" />
                local director
              </span>
              <span className="status-sep" aria-hidden="true" />
              <span>0.03ms compile</span>
              <span className="status-sep" aria-hidden="true" />
              <span>60 fps</span>
            </div>
            <div className="studio-bar-actions">
              <button type="button" className="studio-action" onClick={() => setSpecOpen(true)}>
                <Code2 size={13} strokeWidth={1.9} />
                <span>Spec</span>
              </button>
              <button type="button" className="studio-action" onClick={exportSvg}>
                <Download size={13} strokeWidth={1.9} />
                <span>SVG</span>
              </button>
              <button
                type="button"
                className={`studio-action studio-action-primary${copied ? ' is-copied' : ''}`}
                onClick={() => void share()}
              >
                {copied ? <Check size={13} strokeWidth={2.2} /> : <Link2 size={13} strokeWidth={1.9} />}
                <span>{copied ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>

          <div className="studio-body">
            <div className="studio-visual">
              <DirectorStage />
              <div className="receipts" aria-label="Scene receipts">
                <span>
                  <b>Character</b> {current.spec.character.name}
                </span>
                <span>
                  <b>World</b> {current.spec.world.preset}
                </span>
                <span>
                  <b>Beats</b> {current.spec.beats.length}
                </span>
                <span>
                  <b>Length</b> {seconds(current.spec.duration)}
                </span>
              </div>
            </div>

            <aside className="studio-chat" aria-label="Director chat">
              <div className="chat-head">
                <div className="chat-head-copy">
                  <span className="chat-title">
                    <i aria-hidden="true" />
                    Director
                  </span>
                  <span className="chat-sub">brief → spec → performance</span>
                </div>
                <div className="chat-head-actions">
                  <button type="button" onClick={regenerate} disabled={busy} title="Another take">
                    <RotateCcw size={13} strokeWidth={2} />
                    <span>Another take</span>
                  </button>
                  <button type="button" onClick={reset} disabled={busy} title="Reset the studio">
                    <X size={13} strokeWidth={2} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="chat-scroll" ref={chatRef}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-msg chat-msg-${message.role}`}
                  >
                    {message.tag && <span className="chat-tag">{message.tag}</span>}
                    <p>{message.text}</p>
                    {message.detail && <p className="chat-detail">{message.detail}</p>}
                  </div>
                ))}

                {busy && (
                  <div className="chat-msg chat-msg-assistant chat-thinking">
                    <span className="chat-tag">DIRECTOR</span>
                    <p>
                      Writing the spec
                      <span className="thinking-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </p>
                  </div>
                )}

                {auditions && (
                  <div className="auditions">
                    <div className="auditions-head">
                      <span>3 directions</span>
                      <small>Pick one. The stage already plays A.</small>
                    </div>
                    <div className="auditions-grid">
                      {auditions.map((direction, index) => (
                        <button
                          key={`${direction.seed}-${index}`}
                          type="button"
                          className="audition"
                          onClick={() => chooseAudition(direction, index)}
                        >
                          <span className="audition-frame">
                            <MiniFrame spec={direction.spec} at={0.44} />
                          </span>
                          <span className="audition-name">
                            <b>{String.fromCharCode(65 + index)}</b>
                            {direction.spec.character.name}
                          </span>
                          <span className="audition-meta">
                            {direction.spec.world.preset} · {direction.spec.beats.length} beats
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!busy && !auditions && messages.length <= 7 && (
                  <div className="chat-suggestions">
                    <span>Try a follow-up</span>
                    <div className="chat-suggestion-list">
                      {['make it night', 'add a beanie', 'more playful', 'make it faster'].map(
                        (suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => submit(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>

              {shareFallback && (
                <div className="share-fallback">
                  <label htmlFor="share-url">Copy this link</label>
                  <input
                    id="share-url"
                    readOnly
                    value={shareFallback}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </div>
              )}

              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <div className={`composer-field${listening ? ' is-listening' : ''}`}>
                  <Mic size={16} strokeWidth={1.9} className="composer-mic-icon" aria-hidden="true" />
                  <input
                    ref={promptRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="A nervous robot for a developer tool, looks around, shrugs, waves…"
                    aria-label="Describe a character or an edit"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={`composer-mic${listening ? ' is-listening' : ''}`}
                    onClick={startVoice}
                    aria-label={listening ? 'Stop dictation' : 'Dictate a brief'}
                    title="Dictate a brief"
                  >
                    <Mic size={15} strokeWidth={1.9} />
                  </button>
                  <button type="submit" className="composer-send" disabled={busy || !input.trim()}>
                    <ArrowUp size={16} strokeWidth={2.1} />
                    <span className="sr-only">Direct it</span>
                  </button>
                </div>
                <div className="composer-foot">
                  <span>
                    {listening ? 'Listening… speak the brief' : 'Enter to direct · follow-ups become edits'}
                  </span>
                  <span className="composer-wispr">
                    <Mic size={11} strokeWidth={2} />
                    Wispr Flow ready
                  </span>
                </div>
                {voiceNote && <p className="composer-note">{voiceNote}</p>}
              </form>
            </aside>
          </div>
        </div>

      {specOpen && (
        <div className="spec-overlay" role="dialog" aria-modal="true" aria-label="Scene spec">
          <div className="spec-panel">
            <div className="spec-head">
              <div>
                <span className="spec-kicker">Scene spec · the whole performance</span>
                <strong>{current.spec.title}</strong>
              </div>
              <button type="button" className="spec-close" onClick={() => setSpecOpen(false)}>
                <X size={17} strokeWidth={2} />
                <span className="sr-only">Close spec</span>
              </button>
            </div>
            <div className="spec-meta">
              <span>{current.spec.beats.length} beats</span>
              <span>{seconds(current.spec.duration)}</span>
              <span>{current.spec.world.preset}</span>
              <span>{current.spec.character.accessory}</span>
            </div>
            <p className="spec-story">{current.story}</p>
            <pre className="spec-code">{JSON.stringify(current.spec, null, 2)}</pre>
            <div className="spec-actions">
              <button type="button" onClick={() => void copyJson()}>
                {copiedJson ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={1.9} />}
                {copiedJson ? 'Copied JSON' : 'Copy JSON'}
              </button>
              <button type="button" onClick={exportSpec}>
                <Download size={14} strokeWidth={1.9} />
                Download .json
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="studio-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
