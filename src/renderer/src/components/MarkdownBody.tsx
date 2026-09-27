import type { CSSProperties, ReactNode } from 'react';
import type { Block, MarkdownDoc, Run } from '../lib/markdown';

/**
 * Which teleprompter layer is rendering. All three lay out the same boxes so their
 * scrollTop stays in sync; they differ only in what is visible:
 * base = everything (muted), spoken = only text before `spokenEnd`,
 * highlight = only text from `spokenEnd` on.
 */
export type Layer = 'base' | 'spoken' | 'highlight';

interface Props {
  doc: MarkdownDoc;
  layer: Layer;
  spokenEnd: number;
  fontWeight: number;
}

const HEADING_SIZE = [1.6, 1.35, 1.15, 1, 1, 1];

function runStyle(run: Run, fontWeight: number, layer: Layer): CSSProperties {
  return {
    fontWeight: run.bold ? Math.min(900, fontWeight + 300) : undefined,
    fontStyle: run.italic ? 'italic' : undefined,
    textDecoration: run.strike ? 'line-through' : run.link ? 'underline' : undefined,
    textDecorationThickness: run.link ? '0.06em' : undefined,
    textUnderlineOffset: run.link ? '0.15em' : undefined,
    ...(run.code && {
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      fontSize: '0.82em',
      padding: '0 0.25em',
      borderRadius: '0.2em',
      background: layer === 'base' ? 'rgb(var(--paper) / 0.08)' : undefined
    })
  };
}

function renderRuns(runs: Run[], layer: Layer, spokenEnd: number, fontWeight: number, lastSpoken: number): ReactNode[] {
  const out: ReactNode[] = [];
  runs.forEach((run, i) => {
    const style = runStyle(run, fontWeight, layer);
    if (layer === 'base') {
      out.push(<span key={i} style={style}>{run.text}</span>);
      return;
    }
    const cut = Math.max(0, Math.min(run.text.length, spokenEnd - run.start));
    const before = run.text.slice(0, cut);
    const after = run.text.slice(cut);
    if (layer === 'spoken') {
      if (before) out.push(<span key={`${i}a`} style={style} data-spoken={run.start === lastSpoken ? '' : undefined}>{before}</span>);
      if (after) out.push(<span key={`${i}b`} style={{ ...style, visibility: 'hidden' }}>{after}</span>);
    } else {
      if (before) out.push(<span key={`${i}a`} style={{ ...style, color: 'transparent' }}>{before}</span>);
      if (after) out.push(<span key={`${i}b`} style={style}>{after}</span>);
    }
  });
  return out;
}

export function MarkdownBody({ doc, layer, spokenEnd, fontWeight }: Props) {
  // The last run that holds spoken text — its line boxes tell App which line the voice is on.
  let lastSpoken = -1;
  for (const b of doc.blocks) {
    if (b.kind === 'rule') continue;
    for (const r of b.runs) if (r.start < spokenEnd) lastSpoken = r.start;
  }

  // Decorations (markers, rules, quote bars) belong to the text they sit beside: shown
  // where that text is shown, invisible (but still taking space) elsewhere.
  const decoVisible = (b: Block) => {
    if (layer === 'base') return true;
    const start = b.kind === 'rule' ? Infinity : b.runs[0]?.start ?? 0;
    return layer === 'spoken' ? start < spokenEnd : !(start < spokenEnd);
  };

  return (
    <>
      {doc.blocks.map((b, i) => {
        const deco = decoVisible(b);
        const first = i === 0;
        switch (b.kind) {
          case 'rule':
            return (
              <div
                key={i}
                style={{
                  height: 0,
                  margin: '0.5em 0',
                  borderTop: '0.06em solid',
                  borderColor: deco ? 'rgb(var(--paper) / 0.2)' : 'transparent'
                }}
              />
            );
          case 'heading':
            return (
              <div
                key={i}
                style={{
                  fontSize: `${HEADING_SIZE[b.level - 1]}em`,
                  fontWeight: Math.min(900, fontWeight + 200),
                  lineHeight: 1.2,
                  marginTop: first ? 0 : '0.6em',
                  marginBottom: '0.25em'
                }}
              >
                {renderRuns(b.runs, layer, spokenEnd, fontWeight + 200, lastSpoken)}
              </div>
            );
          case 'item':
            return (
              <div key={i} style={{ display: 'flex', gap: '0.45em', paddingLeft: `${b.depth * 1.1}em`, marginTop: '0.1em' }}>
                <span style={{ flex: 'none', opacity: deco ? 0.6 : 0, visibility: deco ? undefined : 'hidden' }}>
                  {b.marker}
                </span>
                <div style={{ minWidth: 0 }}>{renderRuns(b.runs, layer, spokenEnd, fontWeight, lastSpoken)}</div>
              </div>
            );
          case 'quote':
            return (
              <div
                key={i}
                style={{
                  borderLeft: '0.08em solid',
                  borderColor: deco ? 'rgb(var(--accent) / 0.5)' : 'transparent',
                  paddingLeft: '0.6em',
                  fontStyle: 'italic',
                  margin: first ? '0 0 0.4em' : '0.4em 0'
                }}
              >
                {renderRuns(b.runs, layer, spokenEnd, fontWeight, lastSpoken)}
              </div>
            );
          case 'code':
            return (
              <div key={i} style={{ whiteSpace: 'pre-wrap', margin: first ? '0 0 0.4em' : '0.4em 0', lineHeight: 1.3 }}>
                {renderRuns(b.runs, layer, spokenEnd, fontWeight, lastSpoken)}
              </div>
            );
          default:
            return (
              <p key={i} style={{ margin: first ? '0 0 0.5em' : '0.5em 0' }}>
                {renderRuns(b.runs, layer, spokenEnd, fontWeight, lastSpoken)}
              </p>
            );
        }
      })}
    </>
  );
}
