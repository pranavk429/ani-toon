'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { asset } from '../../lib/asset';
import { compile } from '../../toon/compile';
import { ToonFrame, ToonPlayer } from '../../toon/ToonScene';

// /toon?spec=NAME            live loop
// /toon?spec=NAME&t=1200     one deterministic frame
// /toon?spec=NAME&sheet=0,9000,500   contact sheet: from,to,step (ms)

function Inner() {
  const q = useSearchParams();
  const name = q.get('spec') ?? 'chef-demo';
  const tParam = q.get('t');
  const sheet = q.get('sheet');
  const [raw, setRaw] = useState<unknown>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch(asset(`/specs/${name}.json`)).then((r) => r.json()).then(setRaw).catch((e) => setErr(String(e)));
  }, [name]);
  const compiled = useMemo(() => (raw ? compile(raw) : null), [raw]);
  if (err) return <pre>{err}</pre>;
  if (!compiled) return <div id="loading" />;

  if (sheet) {
    const [a, b, step] = sheet.split(',').map(Number);
    const ts: number[] = [];
    for (let t = a; t < b; t += step) ts.push(t);
    const cols = Number(q.get('cols') ?? 6);
    return (
      <div id="ready" style={{ background: '#222', padding: 8, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, width: cols * 260 }}>
        {ts.map((t) => (
          <div key={t} style={{ position: 'relative', aspectRatio: '9/16', borderRadius: 16, overflow: 'hidden' }}>
            <ToonFrame compiled={compiled} t={t} />
            <span style={{ position: 'absolute', left: 6, bottom: 4, font: '11px monospace', color: '#000', background: '#fffc', padding: '0 4px' }}>{t}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id="ready" style={{ width: 405, height: 720, margin: '0 auto', borderRadius: 36, overflow: 'hidden', boxShadow: '0 8px 40px #0004' }}>
      {tParam ? <ToonFrame compiled={compiled} t={Number(tParam)} /> : <ToonPlayer rawSpec={raw} />}
      <pre style={{ display: 'none' }} id="warnings">{JSON.stringify(compiled.warnings)}</pre>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
