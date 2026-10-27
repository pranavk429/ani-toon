'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { direct, applyEdit, type DirectorResult } from '../director';
import { analyzeImage } from '../director/image';
import { compileScore } from '../motion/score';
import { genomeFor, SPECIES, type SpeciesKey } from '../mascot/genome';
import type { Genome, MotionScore } from '../mascot/types';
import { readLogo } from '../lib/images';
import type { Showcase } from '../showcase';
import type { ChatMessage } from './Studio';
import { Studio } from './Studio';
import { Hero } from './Hero';
import { Nav } from './Nav';
import { HowItWorks } from './HowItWorks';
import { Gallery } from './Gallery';
import { WhyCode } from './WhyCode';
import { Footer } from './Footer';

const DEFAULT_BRIEF = 'A cozy bear barista named Mochi for Ember Coffee. Warm, a little sleepy, waves hello and sips a latte.';

const first = direct(DEFAULT_BRIEF, { seed: 1207 });

export function Landing() {
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [result, setResult] = useState<DirectorResult>(first);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'hello',
      role: 'assistant',
      text: "I'll invent the character and write its first performance. Start with a feeling, a job, or a reference — then tweak it by talking.",
    },
    {
      id: 'first',
      role: 'assistant',
      text: first.reply,
      notes: first.notes,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const refUrl = useRef<string | null>(null);

  const compiled = useMemo(() => compileScore(result.score, result.genome), [result]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (refUrl.current) URL.revokeObjectURL(refUrl.current);
    };
  }, []);

  // A shared mascot is encoded in the hash; no server round-trip. Listening to
  // hashchange also makes same-tab paste/navigation behave like a fresh link.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#m=')) return;
      try {
        const decoded = JSON.parse(decode(hash.slice(3)));
        if (decoded?.genome && decoded?.score) {
          // Hydrate a shared mascot from the URL, outside the render path.
          setResult({ genome: decoded.genome, score: decoded.score, reply: decoded.reply ?? 'Shared mascot loaded.', notes: decoded.notes ?? [], intent: 'edit' });
          if (decoded.brief) setBrief(decoded.brief);
          setShareUrl(null);
          setMessages([
            {
              id: `shared-${Date.now()}`,
              role: 'assistant',
              text: `Loaded **${decoded.genome.name}** from a shared link. Ask for a change, or remix a new performance.`,
              notes: ['shared genome', `${decoded.score.beats?.length ?? 0} beats`],
            },
          ]);
          window.requestAnimationFrame(() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      } catch {
        /* a broken link just starts the default demo */
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const think = (fn: () => void, delay = 380) => {
    if (timer.current) window.clearTimeout(timer.current);
    setBusy(true);
    timer.current = window.setTimeout(() => {
      fn();
      setBusy(false);
    }, delay);
  };

  const add = (role: ChatMessage['role'], text: string, notes?: string[]) => {
    setMessages((m) => [...m, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text, notes }]);
  };

  const scrollToStudio = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const generate = (text: string, opts: { image?: boolean; scroll?: boolean } = {}) => {
    const clean = text.trim();
    if (!clean) return;
    setBrief(clean);
    add('user', opts.image ? `${clean}\n(reference image attached)` : clean);
    think(() => {
      const next = direct(clean, { seed: Date.now() % 100000, image: opts.image && imageSignal ? imageSignal : undefined });
      setResult(next);
      add('assistant', next.reply, next.notes);
    }, 520);
    if (opts.scroll) scrollToStudio();
  };

  const [imageSignal, setImageSignal] = useState<Awaited<ReturnType<typeof analyzeImage>> | null>(null);

  const command = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    add('user', clean);
    think(() => {
      const next = applyEdit(clean, result.genome, result.score);
      setResult(next);
      add('assistant', next.reply, next.notes);
    }, 320);
  };

  const pick = (s: Showcase) => {
    const next: DirectorResult = {
      genome: s.compiled.genome,
      score: s.compiled.score,
      reply: `Loaded **${s.compiled.genome.name}** — ${s.compiled.genome.concept}.`,
      notes: [`${s.compiled.score.beats.length} beats`, s.tags.join(' · ')],
      intent: 'edit',
    };
    setBrief(s.brief);
    setResult({ ...next, score: { ...s.compiled.score, duration: 9000 } });
    setMessages([
      {
        id: `pick-${Date.now()}`,
        role: 'assistant',
        text: `Loaded **${s.compiled.genome.name}** — ${s.compiled.genome.concept}. This one is already moving; ask for a change, or remix the score.`,
        notes: [`${s.compiled.score.beats.length} beats`, ...s.tags],
      },
    ]);
    scrollToStudio();
  };

  const uploadImage = async (file: File) => {
    setBusy(true);
    try {
      if (refUrl.current) URL.revokeObjectURL(refUrl.current);
      const url = URL.createObjectURL(file);
      refUrl.current = url;
      setReference(url);
      const signal = await analyzeImage(file);
      setImageSignal(signal);
      const text = brief.trim() || 'A mascot inspired by this reference image.';
      add('user', `Read this reference → make an original mascot from it.`);
      const next = direct(text, { seed: Date.now() % 100000, image: signal });
      setResult(next);
      add(
        'assistant',
        `I read the image as **${signal.species}** energy — ${Math.round(signal.saturation * 100)}% chroma, ${signal.warmth > 0 ? 'warm' : 'cool'} light. I built an original vector character, not a trace. ${next.reply}`,
        [...next.notes, 'image: palette + vibe'],
      );
    } catch {
      add('assistant', 'I could not read that image. Try a PNG, JPG or SVG with visible colour.');
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const data = await readLogo(file);
      setResult((r) => ({ ...r, genome: { ...r.genome, logo: { ...r.genome.logo, image: data } } }));
      add('assistant', 'Logo placed on the chest badge — it scales with the character and stays crisp in the SVG.', ['logo badge']);
    } catch {
      add('assistant', 'That logo could not be read. Try a PNG or SVG.');
    }
  };

  const species = (key: SpeciesKey) => {
    const nextGenome = genomeFor(key, {
      id: result.genome.id,
      name: result.genome.name,
      brand: result.genome.brand,
      tagline: result.genome.tagline,
      concept: `a ${SPECIES[key].label.toLowerCase()} ${result.genome.concept.split(' ').slice(-1)[0] ?? ''}`.trim(),
      palette: result.genome.palette,
      personality: result.genome.personality,
      outfit: result.genome.outfit,
      accessory: result.genome.accessory,
      prop: result.genome.prop,
      logo: result.genome.logo,
    });
    setResult((r) => ({ ...r, genome: nextGenome }));
    add('assistant', `Rebuilt **${result.genome.name}** around ${SPECIES[key].label.toLowerCase()} anatomy. Same soul, new silhouette.`);
  };

  const genome = (next: Genome) => setResult((r) => ({ ...r, genome: next }));
  const score = (next: MotionScore) => setResult((r) => ({ ...r, score: next }));

  const remix = () => {
    add('user', 'Remix a new variation.');
    think(() => {
      const fresh = direct(brief || result.genome.concept, { seed: Date.now() % 100000 });
      const nextGenome = {
        ...fresh.genome,
        name: result.genome.name,
        brand: result.genome.brand,
        tagline: result.genome.tagline,
        palette: result.genome.palette,
        logo: result.genome.logo,
      };
      setResult({ ...fresh, genome: nextGenome });
      add('assistant', `New performance for **${nextGenome.name}**. Same character, different acting.`, ['remixed score']);
    }, 420);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, genome: result.genome, score: result.score }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(result.genome.name)}.ani.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const share = async () => {
    const payload = {
      brief,
      genome: { ...result.genome, logo: { ...result.genome.logo, image: '' } },
      score: result.score,
      reply: result.reply,
      notes: result.notes,
    };
    const url = `${window.location.origin}${window.location.pathname}#m=${encode(payload)}`;
    setShareUrl(url);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      /* fall through to the legacy path */
    }
    if (!copied) {
      try {
        const area = document.createElement('textarea');
        area.value = url;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand('copy');
        area.remove();
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 1800);
    }
  };

  return (
    <>
      <Nav />
      <Hero onGenerate={(text) => generate(text, { scroll: true })} onPick={pick} />

      <section id="studio" className="scroll-mt-24 border-t border-line/70 bg-[#ebe6db] py-16 sm:py-24">
        <div className="mx-auto max-w-[1140px] px-5">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono-label mb-3">00 / live studio</p>
              <h2 className="max-w-[860px] font-hand text-[clamp(2.1rem,4.6vw,3.7rem)] font-bold leading-[1.02] tracking-[-0.03em]">
                One brief. One character.
                <br />
                One <span className="text-accent">performance.</span>
              </h2>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4f8f5b]" />
                running locally · no key
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">chat to edit · scrub the score</span>
            </div>
          </div>

          <Studio
            result={result}
            compiled={compiled}
            brief={brief}
            setBrief={setBrief}
            messages={messages}
            busy={busy}
            reference={reference}
            shareState={shareState}
        shareUrl={shareUrl}
            onGenerate={(text) => generate(text, { scroll: false })}
            onCommand={command}
            onImage={uploadImage}
            onLogo={uploadLogo}
            onSpecies={species}
            onGenome={genome}
            onScore={score}
            onRemix={remix}
            onClearReference={() => {
              setReference(null);
              setImageSignal(null);
              if (refUrl.current) URL.revokeObjectURL(refUrl.current);
              refUrl.current = null;
            }}
            onShare={share}
            onExportJson={exportJson}
          />

          <p className="mt-4 text-center font-hand text-[12px] text-muted">
            Try a change in the chat — “more playful”, “add a scarf”, “make it wave”. Or upload a reference and let the director read its palette.
          </p>
        </div>
      </section>
      <HowItWorks />
      <Gallery onPick={pick} />
      <WhyCode />
      <Footer />
    </>
  );
}

function encode(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ani';
}
