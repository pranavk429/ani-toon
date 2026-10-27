/* eslint-disable @next/next/no-img-element -- previews use local blob/data URLs */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Download,
  ImagePlus,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Send,
  SkipBack,
  SkipForward,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import type { ActionName, CompiledScore, Genome, MotionScore, Personality } from '../mascot/types';
import type { DirectorResult } from '../director';
import { SPECIES, type SpeciesKey } from '../mascot/genome';
import { actionDuration } from '../motion/score';
import { useClock } from '../hooks/useClock';
import { Stage } from './Stage';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  notes?: string[];
};

type Props = {
  result: DirectorResult;
  compiled: CompiledScore;
  brief: string;
  setBrief: (brief: string) => void;
  messages: ChatMessage[];
  busy: boolean;
  reference: string | null;
  shareState: 'idle' | 'copied';
  shareUrl: string | null;
  onGenerate: (brief: string) => void;
  onCommand: (command: string) => void;
  onImage: (file: File) => void;
  onLogo: (file: File) => void;
  onSpecies: (key: SpeciesKey) => void;
  onGenome: (genome: Genome) => void;
  onScore: (score: MotionScore) => void;
  onRemix: () => void;
  onClearReference: () => void;
  onShare: () => void;
  onExportJson: () => void;
};

const ACTION_COLOR: Record<ActionName, string> = {
  wake: '#b9b2a5',
  perk: '#f0b429',
  wave: '#4b63ff',
  point: '#4b63ff',
  present: '#4b63ff',
  sip: '#d98a52',
  nod: '#8c9a5b',
  shake: '#c56b5b',
  shrug: '#8c9a5b',
  think: '#8b7bb5',
  cheer: '#e15b64',
  hop: '#e15b64',
  dance: '#e15b64',
  laugh: '#e15b64',
  recoil: '#c56b5b',
  sleepy: '#7e93b8',
  stretch: '#7e93b8',
  listen: '#7e93b8',
  wink: '#4b63ff',
  look: '#8c9a5b',
  tap: '#f0b429',
  settle: '#b9b2a5',
  spin: '#e15b64',
  bow: '#8c9a5b',
};

export function Studio(props: Props) {
  const { result, compiled } = props;
  const key = `${result.genome.id}:${result.score.duration}:${result.score.beats.length}:${result.score.loop ? 1 : 0}`;
  return (
    <div className="overflow-hidden rounded-[30px] border border-line bg-surface shadow-[var(--shadow-lg)]">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_306px]">
        <div className="order-2 flex h-[560px] min-h-0 flex-col border-t border-line lg:order-1 lg:h-[792px] lg:border-r lg:border-t-0">
          <ChatPanel {...props} />
        </div>
        <div className="order-1 min-w-0 bg-[#f6f2e9] lg:order-2 h-[650px] sm:h-[720px] lg:h-[792px]">
          <StudioStage key={key} compiled={compiled} result={result} onRemix={props.onRemix} onShare={props.onShare} onExportJson={props.onExportJson} shareState={props.shareState} />
        </div>
        <div className="order-3 min-h-[520px] border-t border-line lg:h-[792px] lg:border-l lg:border-t-0">
          <Inspector {...props} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// stage, timeline and code views

function StudioStage({
  compiled,
  result,
  onRemix,
  onShare,
  onExportJson,
  shareState,
}: {
  compiled: CompiledScore;
  result: DirectorResult;
  onRemix: () => void;
  onShare: () => void;
  onExportJson: () => void;
  shareState: 'idle' | 'copied';
}) {
  const { time, playing, toggle, seek } = useClock(compiled.score.duration, compiled.score.loop, true, 60);
  const [view, setView] = useState<'stage' | 'score' | 'genome'>('stage');
  const stageRef = useRef<HTMLDivElement>(null);

  const exportSvg = () => {
    const svg = stageRef.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '400');
    clone.setAttribute('height', '400');
    clone.removeAttribute('class');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    downloadBlob(blob, `${slug(compiled.genome.name)}.svg`);
  };

  return (
    <div className="flex h-full flex-col p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center rounded-full border border-line bg-surface/80 p-1 shadow-[var(--shadow-sm)]">
          {(['stage', 'score', 'genome'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] transition ${
                view === v ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onShare} className="hidden h-8 w-8 place-items-center rounded-full border border-line bg-surface text-ink/75 transition hover:text-ink sm:grid" aria-label="Copy share link" title="Copy share link">
            {shareState === 'copied' ? <Check size={14} className="text-[#3f7049]" /> : <Copy size={13} />}
          </button>
          <button onClick={exportSvg} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-ink/75 transition hover:text-ink" aria-label="Download SVG" title="Download current frame as SVG">
            <Download size={13} />
          </button>
          <button onClick={onExportJson} className="hidden h-8 w-8 place-items-center rounded-full border border-line bg-surface text-ink/75 transition hover:text-ink sm:grid" aria-label="Download motion JSON" title="Download genome + score JSON">
            <Code2 size={14} />
          </button>
          <button onClick={onRemix} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 font-hand text-[11.5px] font-semibold text-paper transition hover:bg-ink-2 sm:px-3 sm:text-[12px]" title="New variation">
            <RefreshCw size={12} className="text-accent" />
            Remix
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {view === 'stage' ? (
          <div ref={stageRef} className="absolute inset-0">
            <Stage compiled={compiled} time={time} meta />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-[#17150f]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                {view === 'score' ? 'motion.score.json' : 'creature.genome.json'}
              </span>
              <CopyJson data={view === 'score' ? compiled.score : compiled.genome} />
            </div>
            <pre className="ani-scroll flex-1 overflow-auto p-4 font-mono text-[10px] leading-[1.6] text-[#cfd6c4]">
              {JSON.stringify(view === 'score' ? compiled.score : compiled.genome, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-surface p-2.5 shadow-[var(--shadow-sm)]">
        <Transport compiled={compiled} time={time} playing={playing} toggle={toggle} seek={seek} />
        <Timeline compiled={compiled} time={time} seek={seek} />
      </div>

      <p className="mt-2.5 line-clamp-1 px-1 font-hand text-[12px] text-muted">
        {result.score.story ? `story: ${result.score.story}` : 'A performance written for this character.'}
        <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{result.score.beats.length} beats · generated</span>
      </p>
    </div>
  );
}

function Transport({ compiled, time, playing, toggle, seek }: { compiled: CompiledScore; time: number; playing: boolean; toggle: () => void; seek: (t: number) => void }) {
  return (
    <div className="flex items-center gap-2.5 px-1 pb-2">
      <button onClick={() => seek(time - 1000)} className="grid h-7 w-7 place-items-center rounded-full text-ink/70 transition hover:bg-paper hover:text-ink" aria-label="Back one second">
        <SkipBack size={13} />
      </button>
      <button onClick={toggle} className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper transition hover:scale-105 active:scale-95" aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="translate-x-[1px]" />}
      </button>
      <button onClick={() => seek(time + 1000)} className="grid h-7 w-7 place-items-center rounded-full text-ink/70 transition hover:bg-paper hover:text-ink" aria-label="Forward one second">
        <SkipForward size={13} />
      </button>
      <span className="ml-1 font-mono text-[10px] tabular-nums text-ink/75">
        {(time / 1000).toFixed(1)} <span className="text-muted">/ {(compiled.score.duration / 1000).toFixed(1)}s</span>
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${compiled.score.loop ? 'bg-[#4f8f5b]' : 'bg-muted'}`} />
        {compiled.score.loop ? 'looping' : 'one-shot'}
      </span>
    </div>
  );
}

function Timeline({ compiled, time, seek }: { compiled: CompiledScore; time: number; seek: (t: number) => void }) {
  const duration = compiled.score.duration;
  const beats = compiled.score.beats;
  const lanes: number[] = [];
  const blocks = beats.map((b, i) => {
    const w = Math.max(7, (actionDuration(b.action) / duration) * 100);
    const left = Math.min(95, (b.t / duration) * 100);
    let lane = 0;
    while (lanes[lane] !== undefined && lanes[lane] > left - w * 0.55) lane++;
    lanes[lane] = left + w;
    return { b, i, left, w, lane: lane % 2 };
  });

  const onTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * duration);
  };

  return (
    <div className="select-none">
      <div className="flex items-end justify-between pb-1 pl-0.5 pr-1">
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">motion score</span>
        <span className="font-mono text-[8px] text-muted">{(duration / 1000).toFixed(0)}s</span>
      </div>
      <div className="relative h-[68px] cursor-crosshair overflow-hidden rounded-xl border border-line/80 bg-[#f7f3ea]" onClick={onTrack} role="presentation">
        <div className="absolute inset-x-0 top-0 flex justify-between px-1 pt-0.5">
          {Array.from({ length: Math.ceil(duration / 1000) + 1 }).map((_, i) => (
            <span key={i} className="font-mono text-[7px] text-muted">
              {i}s
            </span>
          ))}
        </div>
        <div className="absolute inset-x-0 top-4 bottom-0.5">
          {Array.from({ length: Math.ceil(duration / 500) + 1 }).map((_, i) => (
            <span key={i} className={`absolute top-0 bottom-0 w-px ${i % 2 === 0 ? 'bg-ink/10' : 'bg-ink/[0.04]'}`} style={{ left: `${(i * 500 * 100) / duration}%` }} />
          ))}
          {blocks.map(({ b, i, left, w, lane }) => (
            <button
              key={`${b.action}-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                seek(b.t);
              }}
              className="absolute flex h-6 min-w-[26px] items-center overflow-hidden rounded-[5px] px-1.5 text-left font-mono text-[8px] uppercase tracking-[0.04em] shadow-sm transition hover:brightness-110"
              style={{ left: `${left}%`, width: `${w}%`, top: lane * 26, background: ACTION_COLOR[b.action] ?? '#4b63ff', color: textOn(ACTION_COLOR[b.action] ?? '#4b63ff') }}
              title={`${b.action} at ${(b.t / 1000).toFixed(1)}s`}
            >
              <span className="truncate">{b.action}</span>
            </button>
          ))}
          <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-ink" style={{ left: `${(time / duration) * 100}%` }}>
            <span className="absolute -left-[3px] -top-[1px] h-[7px] w-[7px] rounded-full bg-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// chat

function ChatPanel({ brief, messages, busy, result, reference, onGenerate, onCommand, onImage, onClearReference }: Props) {
  const [value, setValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onCommand(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-accent">
              <Sparkles size={12} />
            </span>
            <span className="font-hand text-[16px] font-bold">Director</span>
          </div>
          <p className="mt-0.5 pl-8 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">local · no key needed</p>
        </div>
        <span className="rounded-full border border-line px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">{result.intent === 'image' ? 'image read' : 'brief read'}</span>
      </div>

      <div className="ani-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[92%] ${m.role === 'user' ? 'rounded-2xl rounded-br-md bg-accent-soft/70 px-3 py-2' : ''}`}>
              <p className={`whitespace-pre-wrap text-[12.5px] leading-[1.55] ${m.role === 'user' ? 'text-ink/80' : 'text-ink/75'}`}>{rich(m.text)}</p>
              {m.notes && m.notes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.notes.map((n) => (
                    <span key={n} className="rounded-full border border-line bg-paper/70 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-muted">
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1.5 px-1 py-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
            <span className="ml-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">writing a performance</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line px-3.5 pb-2 pt-2.5">
        <div className="mb-2 flex flex-wrap gap-1">
          {['More playful', 'Add a scarf', 'Make it wave', 'Warmer colors', 'Remove the prop'].map((s) => (
            <button
              key={s}
              onClick={() => onCommand(s)}
              className="inline-flex min-h-6 items-center rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.05em] text-muted transition hover:border-accent/40 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>

        {reference ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-paper/70 p-1.5">
            <img src={reference} alt="Reference" className="h-9 w-9 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[8px] uppercase tracking-[0.08em] text-muted">reference read · palette + vibe</p>
              <p className="truncate font-hand text-[11px] text-ink/70">interpreted, never traced</p>
            </div>
            <button onClick={onClearReference} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:text-ink" aria-label="Remove reference">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mb-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line bg-paper/50 px-2.5 py-1.5 text-left transition hover:border-accent/40 hover:bg-paper"
          >
            <ImagePlus size={13} className="text-accent" />
            <span className="font-hand text-[11.5px] text-ink/75">Use a reference image or logo</span>
            <span className="ml-auto font-mono text-[7.5px] uppercase tracking-[0.1em] text-muted">optional</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImage(f);
            e.currentTarget.value = '';
          }}
        />

        <form onSubmit={submit} className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1 pl-3 shadow-[var(--shadow-sm)] focus-within:border-accent/40">
          <Wand2 size={13} className="shrink-0 text-accent" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask for a change…"
            className="min-w-0 flex-1 bg-transparent py-2 text-[12.5px] outline-none placeholder:text-muted"
            aria-label="Ask the director for a change"
          />
          <button type="submit" disabled={!value.trim() || busy} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-paper transition disabled:opacity-30" aria-label="Send">
            <Send size={11} />
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button onClick={() => onGenerate(brief)} className="min-h-6 px-1 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted transition hover:text-ink" disabled={busy}>
            {busy ? 'thinking…' : 'regenerate brief'}
          </button>
          <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">tweak by chatting</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// inspector

function Inspector({ compiled, result, onSpecies, onGenome, onScore, onLogo, onShare, onExportJson, shareState, shareUrl }: Props) {
  const [tab, setTab] = useState<'mascot' | 'motion' | 'brand'>('mascot');
  const g = compiled.genome;
  const logoRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-0.5 border-b border-line px-3 py-2.5">
        {(['mascot', 'motion', 'brand'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition ${
              tab === t ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ani-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        {tab === 'mascot' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Field label="Name">
                <input
                  value={g.name}
                  onChange={(e) => onGenome({ ...g, name: e.target.value.slice(0, 26) })}
                  className="min-h-7 w-full border-b border-line bg-transparent pb-1 font-hand text-[21px] font-extrabold tracking-[0.84px] text-ink outline-none focus:border-accent"
                />
              </Field>
              <Field label="Brand">
                <input
                  value={g.brand}
                  onChange={(e) => onGenome({ ...g, brand: e.target.value.slice(0, 36) })}
                  className="min-h-6 w-full border-b border-line bg-transparent pb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/70 outline-none focus:border-accent"
                />
              </Field>
            </div>

            <Section label="Species seed">
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(SPECIES) as SpeciesKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => onSpecies(k)}
                    className={`rounded-lg border px-1.5 py-1.5 font-mono text-[7.5px] uppercase tracking-[0.04em] transition ${
                      g.speciesKey === k ? 'border-accent bg-accent-soft/70 text-[#2f43d9]' : 'border-line text-muted hover:border-ink/30 hover:text-ink'
                    }`}
                  >
                    {SPECIES[k].label}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Palette">
              <div className="grid grid-cols-3 gap-2">
                {([['Fur', 'fur'], ['Outfit', 'outfit'], ['Accent', 'accent']] as const).map(([label, key]) => (
                  <label key={key} className="group cursor-pointer">
                    <span className="relative block h-10 rounded-xl border border-line" style={{ background: g.palette[key] }}>
                      <input
                        type="color"
                        value={g.palette[key]}
                        onChange={(e) => {
                          const next = { ...g.palette, [key]: e.target.value };
                          onGenome({ ...g, palette: next });
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={`${label} color`}
                      />
                    </span>
                    <span className="mt-1 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">{label}</span>
                  </label>
                ))}
              </div>
            </Section>

            <Section label="Personality">
              <Slider label="Energy" value={g.personality.energy} onChange={(v) => onGenome(withPersonality(g, { energy: v }))} />
              <Slider label="Warmth" value={g.personality.warmth} onChange={(v) => onGenome(withPersonality(g, { warmth: v }))} />
              <Slider label="Playfulness" value={g.personality.playfulness} onChange={(v) => onGenome(withPersonality(g, { playfulness: v }))} />
              <Slider label="Snap" value={g.personality.snappiness} onChange={(v) => onGenome(withPersonality(g, { snappiness: v }))} />
            </Section>

            <Section label="Dressing">
              <div className="space-y-1.5">
                <Select label="Outfit" value={g.outfit} options={['none', 'scarf', 'apron', 'hoodie', 'collar', 'bowtie']} onChange={(v) => onGenome({ ...g, outfit: v as Genome['outfit'] })} />
                <Select label="Held prop" value={g.prop} options={['none', 'cup', 'laptop', 'phone', 'package', 'plant', 'star', 'heart', 'megaphone', 'book', 'bag']} onChange={(v) => onGenome({ ...g, prop: v as Genome['prop'] })} />
                <Select label="Accessory" value={g.accessory} options={['none', 'beanie', 'cap', 'glasses', 'headphones', 'flower', 'badge', 'crown']} onChange={(v) => onGenome({ ...g, accessory: v as Genome['accessory'] })} />
              </div>
            </Section>
          </div>
        )}

        {tab === 'motion' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-paper/60 p-3">
              <p className="font-hand text-[15px] font-bold leading-tight">{result.score.title}</p>
              <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted">
                {(compiled.score.duration / 1000).toFixed(1)}s · {compiled.score.beats.length} beats · {compiled.score.loop ? 'loops' : 'one-shot'}
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink/75">{result.score.story}</p>
            </div>
            <Section label="Beat sheet">
              <div className="space-y-1">
                {[...compiled.score.beats]
                  .sort((a, b) => a.t - b.t)
                  .map((b, i) => (
                    <div key={`${b.action}-${i}`} className="flex items-center gap-2 rounded-lg border border-transparent px-1 py-1 hover:border-line hover:bg-paper/60">
                      <span className="h-2 w-2 rounded-full" style={{ background: ACTION_COLOR[b.action] ?? '#4b63ff' }} />
                      <span className="font-mono text-[9px] tabular-nums text-muted">{(b.t / 1000).toFixed(1)}s</span>
                      <span className="font-hand text-[13px] capitalize">{b.action}</span>
                      <span className="ml-auto font-mono text-[7.5px] uppercase tracking-[0.06em] text-muted">{(b.intensity ?? 0.8).toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            </Section>
            <Section label="Clock">
              <div className="flex items-center justify-between rounded-lg border border-line px-2.5 py-2">
                <span className="font-hand text-[13px]">Loop the performance</span>
                <button
                  onClick={() => onScore({ ...result.score, loop: !result.score.loop })}
                  className={`relative h-5 w-9 rounded-full transition ${result.score.loop ? 'bg-accent' : 'bg-line'}`}
                  aria-label="Toggle loop"
                  aria-pressed={result.score.loop}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${result.score.loop ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
            </Section>
            <div className="rounded-xl border border-dashed border-line bg-paper/40 p-3">
              <p className="font-hand text-[13px] leading-snug text-ink/70">
                Every beat is a pose, not a clip. The compiler adds breath, weight shift, follow-through and blinks around it.
              </p>
            </div>
          </div>
        )}

        {tab === 'brand' && (
          <div className="space-y-4">
            <Section label="Logo on chest">
              {g.logo.image ? (
                <div className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                  <img src={g.logo.image} alt="Brand logo" className="h-11 w-11 rounded-lg border border-line object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="font-hand text-[13px] font-bold">badge placed</p>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">exact, vector-scaled</p>
                  </div>
                  <button onClick={() => onGenome({ ...g, logo: { ...g.logo, image: '' } })} className="text-muted hover:text-ink" aria-label="Remove logo">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button onClick={() => logoRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line bg-paper/50 px-3 py-3 text-left transition hover:border-accent/40 hover:bg-paper">
                  <ImagePlus size={14} className="text-accent" />
                  <span className="font-hand text-[12px] text-ink/70">Upload a logo</span>
                  <span className="ml-auto font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">png / svg</span>
                </button>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogo(f);
                  e.currentTarget.value = '';
                }}
              />
              <p className="mt-1.5 font-mono text-[7.5px] leading-relaxed text-muted">No logo? The generated mark uses the brand initial and a small shape.</p>
            </Section>

            <Section label="Export">
              <button onClick={onExportJson} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper/40 px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-paper">
                <span>
                  <span className="block font-hand text-[13px] font-bold">genome + score</span>
                  <span className="block font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">.json · portable</span>
                </span>
                <Download size={13} className="text-muted" />
              </button>
              <button onClick={onShare} className="mt-1.5 flex w-full items-center justify-between rounded-xl border border-line bg-paper/40 px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-paper">
                <span>
                  <span className="block font-hand text-[13px] font-bold">{shareState === 'copied' ? 'link copied' : 'share this mascot'}</span>
                  <span className="block font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">url · no server</span>
                </span>
                {shareState === 'copied' ? <Check size={13} className="text-[#3f7049]" /> : <ArrowUpRight size={13} className="text-muted" />}
              </button>
              {shareUrl && (
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-2 py-1.5 font-mono text-[7.5px] text-muted outline-none"
                  aria-label="Share URL"
                />
              )}
            </Section>

            <Section label="Built with">
              <div className="flex flex-wrap gap-1.5">
                {['vector genome', 'motion compiler', 'Wispr Flow'].map((t) => (
                  <span key={t} className="rounded-full border border-line bg-paper/60 px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </Section>

            <div className="rounded-xl bg-ink p-3 text-paper">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-accent" />
                <span className="font-hand text-[13px] font-bold">No frame library</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-paper/65">This character has no preset moves. The score you see is written for this genome, then compiled into poses.</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line px-3.5 py-2.5">
        <div className="flex items-center justify-between font-mono text-[7.5px] uppercase tracking-[0.1em] text-muted">
          <span>{g.speciesKey ?? 'custom'} genome</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// small pieces

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted">{label}</p>
      {children}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-2 block">
      <span className="mb-0.5 flex items-center justify-between">
        <span className="font-hand text-[11.5px] text-ink/75">{label}</span>
        <span className="font-mono text-[8px] tabular-nums text-muted">{Math.round(value * 100)}</span>
      </span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="ani-range w-full cursor-pointer appearance-none" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-2 py-1.5">
      <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[140px] bg-transparent text-right font-hand text-[11.5px] text-ink outline-none">
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyJson({ data }: { data: unknown }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(JSON.stringify(data, null, 2)).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-white/70 transition hover:text-white"
    >
      {done ? <Check size={11} className="text-[#9fd6a7]" /> : <Copy size={10} />}
      {done ? 'copied' : 'copy'}
    </button>
  );
}

function withPersonality(g: Genome, patch: Partial<Personality>): Genome {
  return { ...g, personality: { ...g.personality, ...patch } };
}

function rich(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-ink">{p}</strong> : <span key={i}>{p}</span>));
}

function textOn(hex: string): string {
  const s = hex.replace('#', '');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.42 ? '#111111' : '#fffdf8';
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ani';
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
