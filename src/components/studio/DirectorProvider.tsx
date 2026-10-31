'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  direct,
  directAsync,
  directVariants,
  replayFromSpec,
  STARTER_PROMPTS,
  type Directed,
} from '@/toon/director';
import { shareUrlFor, specFromLocation } from '@/toon/share';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  detail?: string;
  tag?: string;
};

type DirectorContextValue = {
  current: Directed;
  messages: ChatMessage[];
  auditions: Directed[] | null;
  busy: boolean;
  input: string;
  setInput: (value: string) => void;
  submit: (prompt?: string) => void;
  chooseAudition: (direction: Directed, index: number) => void;
  regenerate: () => void;
  reset: () => void;
  share: () => Promise<void>;
  copied: boolean;
  shareFallback: string | null;
  exportSvg: () => void;
  exportSpec: () => void;
  specOpen: boolean;
  setSpecOpen: (open: boolean) => void;
  notice: string | null;
  studioRef: RefObject<HTMLDivElement | null>;
  promptRef: RefObject<HTMLInputElement | null>;
  focusPrompt: () => void;
};

const DirectorContext = createContext<DirectorContextValue | null>(null);

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `m${messageCounter}`;
}

function openingMessages(direction: Directed): ChatMessage[] {
  return [
    {
      id: nextId(),
      role: 'assistant',
      tag: 'DIRECTOR',
      text: 'I write the scene spec. The engine performs every frame. Here is an opening direction — type a new brief, or change this one.',
    },
    { id: nextId(), role: 'user', text: direction.prompt },
    {
      id: nextId(),
      role: 'assistant',
      tag: 'DIRECTION',
      text: direction.interpretation,
      detail: direction.story,
    },
  ];
}

function shortChange(direction: Directed): string {
  if (direction.kind === 'edit' && direction.change) {
    return direction.change.charAt(0).toUpperCase() + direction.change.slice(1) + '.';
  }
  return direction.story;
}

const starter = direct(STARTER_PROMPTS[0].prompt);

export function DirectorProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Directed>(starter);
  const [messages, setMessages] = useState<ChatMessage[]>(() => openingMessages(starter));
  const [auditions, setAuditions] = useState<Directed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState<string | null>(null);
  const [specOpen, setSpecOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentRef = useRef(current);
  const busyRef = useRef(false);
  const inputRef = useRef(input);
  const basePromptRef = useRef(starter.prompt);
  const studioRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLInputElement | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  }, []);

  const scrollToStudio = useCallback(() => {
    const node = studioRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < 64 || rect.bottom > window.innerHeight + 40) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }
  }, []);

  // A shared link wins over the opening scene, but only after hydration so the
  // server and client render the same first frame.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const spec = specFromLocation();
    if (!spec) return;
    const shared = replayFromSpec(spec, 'A shared performance');
    currentRef.current = shared;
    // Restoring the URL's scene is a deliberate one-time sync with an external
    // system (the address bar), not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(shared);
    setMessages([
      {
        id: nextId(),
        role: 'assistant',
        tag: 'SHARED',
        text: 'This performance arrived as a link. The whole scene was in the URL.',
        detail: shared.story,
      },
      {
        id: nextId(),
        role: 'user',
        text: 'How was this made?',
      },
      {
        id: nextId(),
        role: 'assistant',
        tag: 'DIRECTOR',
        text: shared.interpretation,
        detail: shared.story,
      },
    ]);
  }, []);

  const submit = useCallback(
    (raw?: string) => {
      const text = (raw ?? inputRef.current).trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setInput('');
      setAuditions(null);
      setShareFallback(null);
      setCopied(false);
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
      scrollToStudio();

      const run = async () => {
        // One paint of the thinking state beats a frozen input. Local work is
        // ~0.03ms, so this is purely a legibility cue, not fake latency.
        await new Promise((resolve) => setTimeout(resolve, 130));
        const previous = currentRef.current;
        const next = await directAsync(text, { previous });

        let chosen = next;
        if (next.kind === 'new') {
          // A is always the direction the chat just described. B and C are
          // genuinely different takes (alt world / extra beat), so the message,
          // the stage and all three auditions can never disagree.
          const alternatives = directVariants(text, 2, 1);
          chosen = next;
          setAuditions([next, ...alternatives]);
          basePromptRef.current = text;
        } else {
          setAuditions(null);
        }

        currentRef.current = chosen;
        setCurrent(chosen);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            tag: chosen.kind === 'edit' ? 'EDIT' : 'DIRECTION',
            text: chosen.kind === 'edit' ? shortChange(chosen) : chosen.interpretation,
            detail:
              chosen.kind === 'edit'
                ? `${chosen.interpretation} · ${chosen.story}`
                : `Story · ${chosen.story}`,
          },
        ]);
        busyRef.current = false;
        setBusy(false);
      };

      void run();
    },
    [scrollToStudio],
  );

  const chooseAudition = useCallback((direction: Directed, index: number) => {
    currentRef.current = direction;
    setCurrent(direction);
    setAuditions(null);
    basePromptRef.current = direction.prompt;
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'assistant',
        tag: `DIRECTION ${String.fromCharCode(65 + index)}`,
        text: direction.interpretation,
        detail: `Locked · ${direction.story}`,
      },
    ]);
  }, []);

  const regenerate = useCallback(() => {
    if (busyRef.current) return;
    const seed = currentRef.current.seed + 37;
    const next = direct(basePromptRef.current, { seed });
    currentRef.current = next;
    setCurrent(next);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'assistant',
        tag: 'ANOTHER TAKE',
        text: next.interpretation,
        detail: `New seed · ${next.story}`,
      },
    ]);
    const alternatives = directVariants(basePromptRef.current, 3, 1)
      .filter((direction) => direction.seed !== next.seed)
      .slice(0, 2);
    setAuditions([next, ...alternatives]);
  }, []);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    const fresh = direct(STARTER_PROMPTS[0].prompt, { seed: Date.now() >>> 0 });
    currentRef.current = fresh;
    setCurrent(fresh);
    setAuditions(null);
    setMessages(openingMessages(fresh));
    basePromptRef.current = STARTER_PROMPTS[0].prompt;
    setInput('');
    setSpecOpen(false);
    setShareFallback(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    flash('Back to the opening direction');
  }, [flash]);

  const share = useCallback(async () => {
    const url = shareUrlFor(currentRef.current.spec);
    setShareFallback(null);
    // Put the scene in the address bar before touching the clipboard. A denied
    // or stalled clipboard must never cost the user their share link.
    try {
      const next = `${window.location.pathname}#s=${url.split('#s=')[1] ?? ''}`;
      window.history.replaceState(null, '', next);
    } catch {
      // History can be unavailable in a sandboxed preview. The link still works.
    }
    try {
      // Clipboard permission prompts can hang in embedded previews; never let
      // that hold the toast hostage.
      const write = navigator.clipboard?.writeText(url) ?? Promise.reject(new Error('no clipboard'));
      const ok = await Promise.race([
        write.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1200)),
      ]);
      if (!ok) throw new Error('clipboard timed out');
      setCopied(true);
      flash('Share link copied');
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2600);
    } catch {
      setShareFallback(url);
      flash('Copy the link below');
    }
  }, [flash]);

  const exportSvg = useCallback(() => {
    const svg = document.querySelector<SVGSVGElement>('#director-stage svg');
    if (!svg) {
      flash('The stage is still warming up');
      return;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '720');
    clone.setAttribute('height', '1280');
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${slug(currentRef.current.spec.title)}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1200);
    flash('SVG frame exported');
  }, [flash]);

  const exportSpec = useCallback(() => {
    const blob = new Blob([JSON.stringify(currentRef.current.spec, null, 2)], {
      type: 'application/json',
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${slug(currentRef.current.spec.title)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1200);
    flash('Scene spec downloaded');
  }, [flash]);

  const focusPrompt = useCallback(() => {
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const value = useMemo<DirectorContextValue>(
    () => ({
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
      focusPrompt,
    }),
    [
      current,
      messages,
      auditions,
      busy,
      input,
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
      notice,
      focusPrompt,
    ],
  );

  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>;
}

export function useDirector() {
  const value = useContext(DirectorContext);
  if (!value) throw new Error('useDirector must be used inside DirectorProvider');
  return value;
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'anitoon-scene'
  );
}
