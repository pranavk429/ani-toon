'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

import { AnitoonMark } from '@/components/anitoon/Brand';
import { ScenePlayer } from '@/creature/ScenePlayer';
import { HUMAN_CAST } from '@/creature/examples';
import { localScene } from '@/creature/local';
import { decodeScene, sceneSpec, shareUrl } from '@/creature/share';
import type { Scene } from '@/creature/types';

type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }>>;
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type Preset = {
  id: string;
  label: string;
  prompt: string;
  scene: Scene;
};

const PRESETS: Preset[] = HUMAN_CAST.map((member) => ({
  id: member.id,
  label: member.label,
  prompt: member.prompt,
  scene: member.scene,
}));

const STARTER = PRESETS[0];

type TraceLine = {
  label: string;
  detail: string;
};

const EDIT_RE =
  /^(make|change|turn|add|remove|delete|drop|keep|set|rename|switch|swap|replace|give|slower|faster|more|less|without|now|can you (make|change|turn)|please (make|change|turn))\b/i;

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'anitoon-scene'
  );
}

function compactScene(scene: Scene) {
  return {
    title: scene.title,
    world: scene.world,
    actors: scene.actors.map((a) => ({
      id: a.id,
      genome: a.genome,
      attach: a.attach,
      pose: a.pose,
    })),
    score: scene.score,
  };
}

function lookLine(scene: Scene): string {
  const human = scene.actors.find((a) => a.genome.human)?.genome.human;
  if (!human) {
    return scene.actors.map((a) => a.genome.bodyPlan).join(' + ');
  }
  const beard = human.facialHair !== 'none' ? ` + ${human.facialHair}` : '';
  return `${human.presentation} · ${human.hair.style}${beard} · ${human.outfit.top}/${human.outfit.bottom}`;
}

export default function CreaturePage() {
  const [scene, setScene] = useState<Scene>(STARTER.scene);
  const [prompt, setPrompt] = useState(STARTER.prompt);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [trace, setTrace] = useState<TraceLine[]>([
    { label: 'brief', detail: 'A warm, proud chef with a thick mustache…' },
    { label: 'director', detail: 'cast fixture · local' },
    { label: 'look', detail: 'masculine · short + mustache · apron/jeans' },
    { label: 'rig', detail: 'biped 16 bones' },
    { label: 'compiler', detail: '5 beats · 9.6s loop · 60 fps' },
  ]);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [ready, setReady] = useState(false);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      speechRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    const w = window as SpeechWindow;
    queueMicrotask(() => {
      setVoiceReady(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
      setReady(true);
    });
  }, []);

  const copy = useCallback(
    async (text: string, message: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notify(message);
      } catch {
        notify('Clipboard is blocked. Select the spec text and copy it manually.');
      }
    },
    [notify],
  );

  const copySpec = useCallback(() => {
    void copy(JSON.stringify(sceneSpec(scene), null, 2), 'Scene spec copied.');
  }, [copy, scene]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(sceneSpec(scene), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(scene.title)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify('Scene JSON downloaded.');
  }, [notify, scene]);

  const share = useCallback(async () => {
    const url = shareUrl(scene);
    window.history.replaceState(null, '', url);
    await copy(url, 'Share link copied — it replays this exact scene.');
  }, [copy, scene]);

  const startVoice = useCallback(() => {
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      notify('Voice input is not supported in this browser. Type the brief or use Wispr Flow.');
      return;
    }
    if (listening) {
      speechRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => {
        return event.results[i]?.[0]?.transcript ?? '';
      })
        .join(' ')
        .trim();
      if (transcript) {
        setPrompt((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      notify(
        event.error === 'not-allowed'
          ? 'Microphone permission was denied. Wispr Flow still works.'
          : 'Voice input stopped. You can type the brief.',
      );
    };
    recognition.onend = () => setListening(false);
    speechRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      notify('Voice input is already running.');
    }
  }, [listening, notify]);

  const actorChips = useMemo(
    () =>
      scene.actors.map((actor) => {
        const attach = actor.attach;
        const parent = attach ? scene.actors.find((p) => p.id === attach.actor) : undefined;
        return {
          id: actor.id,
          name: actor.genome.name,
          plan: actor.genome.bodyPlan,
          bones: actor.skeleton.bones.length,
          attach: attach
            ? `→ ${parent?.genome.name ?? attach.actor}.${attach.bone}`
            : null,
        };
      }),
    [scene],
  );

  const lookChips = useMemo(() => {
    const actor = scene.actors.find((a) => a.genome.human) ?? scene.actors[0];
    const human = actor?.genome.human;
    const actions = [
      ...new Set(
        scene.score.beats
          .filter((beat) => beat.layer !== 'base')
          .map((beat) => (beat.verb === 'greet' ? 'wave' : beat.verb)),
      ),
    ].slice(0, 4);
    return [
      human && human.presentation,
      human &&
        `${human.hair.style}${human.facialHair !== 'none' ? ` + ${human.facialHair}` : ''}`,
      human && `${human.outfit.top} / ${human.outfit.bottom}`,
      scene.world.preset,
      actions.length ? actions.join(' · ') : null,
    ].filter((chip): chip is string => Boolean(chip));
  }, [scene]);

  const choosePreset = useCallback((preset: Preset) => {
    setScene(preset.scene);
    setPrompt(preset.prompt);
    setFresh(false);
    setNotice(null);
    setTrace([
      { label: 'brief', detail: `${preset.prompt.slice(0, 78)}…` },
      { label: 'director', detail: 'cast fixture · local' },
      { label: 'look', detail: lookLine(preset.scene) },
      {
        label: 'rig',
        detail: preset.scene.actors
          .map((a) => `${a.genome.bodyPlan} ${a.skeleton.bones.length} bones`)
          .join(' · '),
      },
      {
        label: 'compiler',
        detail: `${preset.scene.score.beats.length} beats · ${(preset.scene.score.duration / 1000).toFixed(1)}s loop`,
      },
    ]);
  }, []);

  const startNew = useCallback(() => {
    setPrompt('');
    setFresh(true);
    setNotice(null);
    setTrace([{ label: 'brief', detail: 'New creature — waiting for your idea.' }]);
  }, []);

  const direct = useCallback(async (raw?: string, startFresh = false) => {
    const brief = (raw ?? prompt).trim();
    if (!brief || busy) return;
    setBusy(true);
    setNotice(null);
    setTrace([{ label: 'brief', detail: `${brief.slice(0, 86)}${brief.length > 86 ? '…' : ''}` }]);

    try {
      const isEdit =
        !startFresh && !fresh && EDIT_RE.test(brief) && brief.split(/\s+/).length < 18;
      const res = await fetch('/api/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: brief,
          previous: isEdit ? compactScene(scene) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Director ${res.status}`);
      const data = (await res.json()) as {
        scene: Scene;
        meta: { source: string; model: string; ms: number };
      };
      const next = data.scene;
      setScene(next);
      setTrace([
        { label: 'brief', detail: `${brief.slice(0, 86)}${brief.length > 86 ? '…' : ''}` },
        {
          label: 'director',
          detail: `${data.meta.source} · ${data.meta.model} · ${(data.meta.ms / 1000).toFixed(1)}s`,
        },
        { label: 'look', detail: lookLine(next) },
        {
          label: 'rig',
          detail: next.actors
            .map((a) => {
              const attach = a.attach;
              const parent = attach
                ? next.actors.find((p) => p.id === attach.actor)
                : undefined;
              return `${a.genome.name}:${a.genome.bodyPlan} ${a.skeleton.bones.length} bones${
                attach
                  ? ` → ${parent?.genome.name ?? attach.actor}.${attach.bone}`
                  : ''
              }`;
            })
            .join(' · '),
        },
        {
          label: 'score',
          detail: `${next.score.beats.length} beats · ${(next.score.duration / 1000).toFixed(1)}s · ${next.score.mood}`,
        },
        {
          label: 'stage',
          detail: `${next.actors.reduce((n, a) => n + a.skeleton.bones.length, 0)} bones · 60 fps · live SVG`,
        },
      ]);
    } catch (error) {
      // The route itself falls back to the local grammar; this only runs if the
      // route is unreachable. Keep the demo alive.
      const next = localScene(brief);
      setScene(next);
      setNotice('Network unavailable — the local grammar directed this scene.');
      setTrace([
        { label: 'brief', detail: `${brief.slice(0, 86)}…` },
        { label: 'director', detail: 'local grammar · offline fallback' },
        { label: 'look', detail: lookLine(next) },
        {
          label: 'rig',
          detail: next.actors
            .map((a) => `${a.genome.bodyPlan} ${a.skeleton.bones.length} bones`)
            .join(' · '),
        },
        {
          label: 'compiler',
          detail: `${next.score.beats.length} beats · ${(next.score.duration / 1000).toFixed(1)}s loop`,
        },
      ]);
      console.warn(error);
    } finally {
      setBusy(false);
      setFresh(false);
    }
  }, [busy, fresh, prompt, scene]);

  // A starter card on the landing opens /creature?prompt=… and should arrive
  // ready to direct, not as a blank form. A share link (#s=…) loads the exact
  // scene instead.
  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('skeleton') === '1') setShowSkeleton(true);

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const token = hash.get('s');
      if (token) {
        const shared = decodeScene(token);
        if (shared) {
          setScene(shared);
          setPrompt(shared.title);
          setNotice(null);
          setTrace([
            { label: 'scene', detail: `shared link · ${shared.title}` },
            {
              label: 'rig',
              detail: shared.actors
                .map((a) => `${a.genome.name}:${a.genome.bodyPlan} ${a.skeleton.bones.length} bones`)
                .join(' · '),
            },
            {
              label: 'score',
              detail: `${shared.score.beats.length} beats · ${(shared.score.duration / 1000).toFixed(1)}s · ${shared.score.mood}`,
            },
          ]);
          notify('Shared scene loaded from the link.');
          return;
        }
        notify('That share link is damaged — showing the starter scene.');
      }

      const p = params.get('prompt');
      if (!p) return;
      setPrompt(p);
      void direct(p, true);
    });
    // One-shot entry point; do not re-run when the scene changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#141414]">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <AnitoonMark size={28} />
          <span className="flex flex-col leading-none">
            <strong className="text-[14px] font-semibold tracking-[-0.02em]">Anitoon</strong>
            <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-black/40">
              human compiler
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-black/10 px-3 py-1.5 text-[11px] text-black/50 sm:inline">
            genome → skeleton → motion
          </span>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-[#141414] px-4 text-[12px] font-semibold text-white"
            style={{ color: '#FFFFFF' }}
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-8 px-5 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
        <section className="flex flex-col items-center">
          <div className="relative aspect-square w-full max-w-[560px] overflow-hidden rounded-[30px] bg-[#0B0B10] shadow-[0_30px_80px_-30px_rgba(20,20,20,0.55)]">
            <ScenePlayer scene={scene} showSkeleton={showSkeleton} />

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-[#141414] backdrop-blur">
              <i className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
              60 FPS
              <span className="text-black/35">·</span>
              <span className="font-normal text-black/55">live SVG</span>
            </div>

            <div className="absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-medium text-white/85 backdrop-blur">
              {showSkeleton ? 'skeleton' : scene.world.preset}
            </div>

            <div className="absolute inset-x-3 bottom-3">
              <div className="mb-2 flex items-end justify-between gap-3 rounded-2xl bg-black/35 px-3 py-2 backdrop-blur-sm">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    scene
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold leading-tight text-white">
                    {scene.title}
                  </div>
                </div>
                <div className="rounded-full bg-black/40 px-2.5 py-1 text-[9px] text-white/65 backdrop-blur">
                  {(scene.score.duration / 1000).toFixed(1)}s loop
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {actorChips.map((actor) => (
                  <span
                    key={actor.id}
                    className="rounded-full bg-black/50 px-2.5 py-1 text-[9px] leading-none text-white/90 backdrop-blur"
                  >
                    <b className="font-semibold">{actor.name}</b>
                    <span className="text-white/45"> · </span>
                    {actor.plan}
                    <span className="text-white/45"> · </span>
                    {actor.bones} bones
                    {actor.attach && (
                      <>
                        <span className="text-white/45"> · </span>
                        {actor.attach}
                      </>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex w-full max-w-[560px] flex-wrap justify-center gap-1.5">
            {lookChips.map((chip, index) => (
              <span
                key={`${chip}-${index}`}
                className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white/70 px-2.5 text-[10px] font-medium text-black/55"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-4 flex w-full max-w-[560px] flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const active = preset.id === PRESETS.find((p) => p.scene === scene)?.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => choosePreset(preset)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[11px] transition ${
                    active
                      ? 'border-[#141414] bg-[#141414] text-white'
                      : 'border-black/10 bg-white/60 text-black/65 hover:border-black/25 hover:text-black'
                  }`}
                  style={active ? { color: '#FFFFFF' } : undefined}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowSkeleton((v) => !v)}
              className={`ml-auto inline-flex min-h-11 items-center rounded-full border px-3.5 text-[11px] transition ${
                showSkeleton
                  ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#0E7490]'
                  : 'border-black/10 bg-white/60 text-black/65 hover:border-black/25'
              }`}
              style={showSkeleton ? { color: '#0E7490' } : undefined}
            >
              {showSkeleton ? 'Hide skeleton' : 'Show skeleton'}
            </button>
          </div>

          <p className="mt-4 max-w-[560px] text-center text-[11px] leading-relaxed text-black/40">
            Same art direction, different person. Presentation, hair, face, body and outfit are
            genome data. The skeleton is the same 16-bone rig under every one of them.
          </p>
        </section>

        <aside className="lg:sticky lg:top-6">
          <div className="rounded-[26px] border border-black/8 bg-white/70 p-5 shadow-[0_20px_60px_-40px_rgba(20,20,20,0.4)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35">
                  Director
                </div>
                <h1 className="mt-1 text-[23px] font-semibold leading-[1.05] tracking-[-0.035em]">
                  Describe a person.
                  <br />
                  The compiler builds them.
                </h1>
              </div>
              <div className="rounded-full bg-[#141414] px-2.5 py-1 text-[9px] font-medium text-white">
                Track 2
              </div>
            </div>

            <form
              className="mt-4"
              data-ready={ready ? 'true' : 'false'}
              onSubmit={(event) => {
                event.preventDefault();
                void direct();
              }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="brief"
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40"
                >
                  Brief
                </label>
                <div className="flex items-center gap-2">
                  {fresh && (
                    <span className="text-[9px] font-medium text-[#0E7490]">starting fresh</span>
                  )}
                  <button
                    type="button"
                    onClick={startNew}
                    title="Clear this brief and start a brand-new creature"
                    className="inline-flex min-h-11 items-center px-2 text-[10px] font-semibold text-[#0E7490] underline-offset-2 hover:underline"
                  >
                    New creature
                  </button>
                </div>
              </div>
              <textarea
                id="brief"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void direct();
                  }
                }}
                rows={3}
                className="w-full resize-none rounded-[16px] border border-black/10 bg-white px-3.5 py-3 text-[13px] leading-relaxed outline-none transition focus:border-black/30"
                placeholder="A warm, proud chef with a thick mustache, laughs, stirs, and waves…"
                autoComplete="off"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!ready || busy || !prompt.trim()}
                  className="h-11 rounded-full bg-[#141414] px-5 text-[12px] font-semibold text-white transition hover:bg-black disabled:opacity-35"
                  style={{ color: '#FFFFFF' }}
                >
                  {busy ? 'Directing…' : 'Direct it'}
                </button>
                <button
                  type="button"
                  disabled={busy || !prompt.trim()}
                  onClick={() => void direct()}
                  title="Generate another direction from the same brief"
                  className="h-11 rounded-full border border-black/12 px-4 text-[12px] font-medium text-black/65 transition hover:border-black/30 hover:text-black disabled:opacity-35"
                >
                  Retry brief
                </button>
                <span className="ml-auto text-[9px] text-black/35">
                  {busy ? 'writing the scene…' : 'Enter to direct'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startVoice}
                  aria-pressed={listening}
                  title={
                    voiceReady
                      ? 'Dictate the brief with the browser microphone'
                      : 'Speech recognition is not supported in this browser'
                  }
                  className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[11px] font-medium transition ${
                    listening
                      ? 'border-[#0E7490] bg-[#22D3EE]/15 text-[#0E7490]'
                      : 'border-black/10 bg-white text-black/65 hover:border-black/30 hover:text-black'
                  }`}
                  style={listening ? { color: '#0E7490' } : undefined}
                >
                  <Mic size={14} />
                  {listening ? 'Listening…' : 'Speak'}
                </button>
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 text-[9px] font-medium text-[#047857]">
                  <i className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  Wispr Flow ready — speak the brief
                </span>
              </div>
            </form>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35">
                  Generation trace
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpec((v) => !v)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3 text-[9px] transition ${
                    showSpec
                      ? 'border-[#141414] bg-[#141414] text-white'
                      : 'border-black/10 text-black/50 hover:border-black/30'
                  }`}
                  style={showSpec ? { color: '#FFFFFF' } : undefined}
                >
                  {showSpec ? 'Hide spec' : 'View spec'}
                </button>
              </div>

              <div className="mt-2">
                {trace.map((line, index) => (
                  <div
                    key={`${line.label}-${index}`}
                    className="flex gap-3 border-t border-black/5 py-2 first:border-t-0"
                  >
                    <span className="w-[76px] shrink-0 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-black/35">
                      {line.label}
                    </span>
                    <span className="text-[11px] leading-relaxed text-black/70">
                      {line.detail}
                    </span>
                  </div>
                ))}
              </div>

              {notice && (
                <div className="mt-2 rounded-[10px] bg-[#FEF3C7] px-3 py-2 text-[10px] leading-relaxed text-[#92400E]">
                  {notice}
                </div>
              )}

              {showSpec && (
                <pre className="mt-3 max-h-[220px] overflow-auto rounded-[14px] bg-[#141414] p-3 text-[9px] leading-relaxed text-[#B7F7D8]">
                  {JSON.stringify(
                    {
                      title: scene.title,
                      world: scene.world,
                      actors: scene.actors.map((a) => ({
                        id: a.id,
                        name: a.genome.name,
                        species: a.genome.species,
                        bodyPlan: a.genome.bodyPlan,
                        bones: a.skeleton.bones.length,
                        human: a.genome.human ?? null,
                        attach: a.attach ?? null,
                      })),
                      score: scene.score,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                <button
                  type="button"
                  onClick={copySpec}
                  className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/65 transition hover:border-black/30 hover:text-black"
                >
                  Copy spec
                </button>
                <button
                  type="button"
                  onClick={downloadJson}
                  className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/65 transition hover:border-black/30 hover:text-black"
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={() => void share()}
                  className="inline-flex h-11 items-center rounded-full bg-[#141414] px-4 text-[11px] font-semibold text-white transition hover:bg-black"
                  style={{ color: '#FFFFFF' }}
                >
                  Share link
                </button>
                <span className="w-full text-[9px] leading-tight text-black/35">
                  The link replays the genome + score, not a video.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-black/8 bg-[#141414] p-5 text-white">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
              What just happened
            </div>
            <ol className="mt-3 space-y-3">
              {[
                {
                  n: '01',
                  title: 'The director writes data',
                  body: 'A human genome (presentation, hair, face, body, outfit, palette) and a score (beats). Not pixels.',
                },
                {
                  n: '02',
                  title: 'The rig builder builds anatomy',
                  body: 'The same 16 bones carry every person. Hair, outfits and expressions are renderer layers, not new skeletons.',
                },
                {
                  n: '03',
                  title: 'The compiler performs it',
                  body: 'Breathing, blinks, waves, points, shrugs, dances, bows and world particles. Same style on every person.',
                },
              ].map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[9px] text-white/35">{step.n}</span>
                  <div>
                    <div className="text-[11px] font-semibold text-white/90">{step.title}</div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-white/50">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-white/35">
              Hosted director: Claude Haiku via Experiential. Offline: the local grammar. The
              compiler always runs locally.
            </div>
          </div>
        </aside>
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-[#141414] px-4 py-2.5 text-center text-[11px] font-medium text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]"
          style={{ color: '#FFFFFF' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
