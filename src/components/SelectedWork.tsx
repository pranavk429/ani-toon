'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { PROJECTS, type Project } from '../showcase';
import { Stage } from './Stage';
import { SectionTag } from './SectionTag';

type Mode = 'brand' | 'studio';

export function SelectedWork({ onOpen }: { onOpen: (project: Project) => void }) {
  const [mode, setMode] = useState<Mode>('brand');
  const { time } = useClock(9000, true, true, 24);

  const projects = useMemo(() => PROJECTS.filter((project) => project.category === mode), [mode]);

  return (
    <section id="work" className="section" aria-label="Selected work">
      <div className="container">
        <div data-reveal>
          <SectionTag n="01" label="Selected work" />
        </div>

        <h2 className="section-head" data-reveal style={{ '--reveal-delay': '70ms' } as React.CSSProperties}>
          Characters I&apos;ve
          <br />
          brought to life.
        </h2>

        <p className="section-lede" data-reveal style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
          Four characters from four sentences. Each one has its own genome, its own score, and its own way of
          moving. Open one and change a single word.
        </p>

        <div
          className="work-toggle"
          role="tablist"
          aria-label="Character category"
          data-reveal
          style={{ '--reveal-delay': '210ms' } as React.CSSProperties}
        >
          <span
            className="work-toggle-thumb"
            style={{ width: 'calc(50% - 6px)', transform: `translateX(${mode === 'studio' ? '100%' : '0%'})` }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'brand'}
            className="work-tab"
            data-active={mode === 'brand'}
            onClick={() => setMode('brand')}
          >
            Brand mascots
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'studio'}
            className="work-tab"
            data-active={mode === 'studio'}
            onClick={() => setMode('studio')}
          >
            Studio cuts
          </button>
        </div>

        <div className="work-list">
          {projects.map((project, index) => (
            <ProjectRow key={project.id} project={project} time={(time + index * 1400) % project.compiled.score.duration} index={index} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectRow({
  project,
  time,
  index,
  onOpen,
}: {
  project: Project;
  time: number;
  index: number;
  onOpen: (project: Project) => void;
}) {
  const beats = project.compiled.score.beats.length;
  const seconds = (project.compiled.score.duration / 1000).toFixed(1);

  return (
    <article className="project-row rise" style={{ animationDelay: `${index * 80}ms` }}>
      <button
        type="button"
        className="project-media"
        onClick={() => onOpen(project)}
        aria-label={`Open ${project.title} in the studio`}
      >
        <span className="project-live">live vector</span>
        <span className="project-media-stage">
          <Stage compiled={project.compiled} time={time} />
        </span>
        <span className="project-meta">
          {beats} beats · {seconds}s
        </span>
        <span className="project-open">
          Open in studio <ArrowUpRight size={12} />
        </span>
      </button>

      <div className="project-info">
        <h3 className="project-title">{project.title}</h3>
        <p className="project-desc">{project.description}</p>
        <div className="project-stack">
          {project.chips.map((chip) => (
            <span key={chip} className="chip">
              <svg className="chip-star" viewBox="0 0 9 9" aria-hidden>
                <path d="M4.5 0 5.55 3.45 9 4.5 5.55 5.55 4.5 9 3.45 5.55 0 4.5 3.45 3.45Z" />
              </svg>
              {chip}
            </span>
          ))}
          <span className="chip">{beats} beats</span>
          <span className="chip">{seconds}s loop</span>
        </div>
        <button type="button" className="btn-quiet project-link" onClick={() => onOpen(project)}>
          Direct this character
          <ArrowUpRight size={12} />
        </button>
      </div>
    </article>
  );
}
