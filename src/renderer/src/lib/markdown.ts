// Minimal Markdown → blocks parser for the display view. Every run of rendered text keeps
// its [start, end) offset into `plain` (the script with the syntax stripped), so STT
// matching and the spoken/highlight overlays work on what is actually read aloud.

export interface Run {
  text: string;
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: boolean;
}

export type Block =
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'quote'; runs: Run[] }
  | { kind: 'item'; marker: string; depth: number; runs: Run[] }
  | { kind: 'code'; runs: Run[] }
  | { kind: 'rule' };

export interface MarkdownDoc {
  blocks: Block[];
  plain: string;
}

const MD_EXT = /\.(md|markdown|mdown|mkd|mkdn)$/i;

export function isMarkdownPath(path: string): boolean {
  return MD_EXT.test(path);
}

/** For unsaved scripts: headings, lists or emphasis on their own lines. */
export function looksLikeMarkdown(text: string): boolean {
  return /^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|>\s|```)/m.test(text) || /\*\*[^*\n]+\*\*/.test(text);
}

type Style = Omit<Run, 'text' | 'start' | 'end'>;
type Piece = { text: string; style: Style };

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~>|]/;
const EMPHASIS = [['**', 'bold'], ['__', 'bold'], ['~~', 'strike'], ['*', 'italic'], ['_', 'italic']] as const;

function findClose(s: string, delim: string, from: number): number {
  for (let k = s.indexOf(delim, from); k >= 0; k = s.indexOf(delim, k + 1)) {
    if (s[k - 1] === '\\' || /\s/.test(s[k - 1] ?? ' ')) continue;
    // A single * or _ must not be half of a double delimiter.
    if (delim.length === 1 && (s[k + 1] === delim || s[k - 1] === delim)) continue;
    if (delim === '_' && /\w/.test(s[k + 1] ?? '')) continue;
    return k;
  }
  return -1;
}

function parseInline(s: string, style: Style = {}): Piece[] {
  const out: Piece[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ text: buf, style });
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const rest = s.slice(i);
    if (c === '\\' && ESCAPABLE.test(s[i + 1] ?? '')) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (c === '`') {
      const ticks = /^`+/.exec(rest)![0];
      const close = s.indexOf(ticks, i + ticks.length);
      if (close > 0) {
        flush();
        out.push({ text: s.slice(i + ticks.length, close).trim(), style: { ...style, code: true } });
        i = close + ticks.length;
        continue;
      }
    }
    // Images carry nothing to read aloud; links read as their label.
    const img = /^!\[([^\]]*)\]\([^)]*\)/.exec(rest);
    if (img) {
      i += img[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\([^)]*\)/.exec(rest);
    if (link) {
      flush();
      out.push(...parseInline(link[1], { ...style, link: true }));
      i += link[0].length;
      continue;
    }
    const auto = /^<(https?:\/\/[^>\s]+)>/.exec(rest);
    if (auto) {
      flush();
      out.push({ text: auto[1], style: { ...style, link: true } });
      i += auto[0].length;
      continue;
    }
    const html = /^<!--[\s\S]*?-->|^<\/?[a-zA-Z][^>]*>/.exec(rest);
    if (html) {
      i += html[0].length;
      continue;
    }
    const from = i;
    for (const [delim, key] of EMPHASIS) {
      if (!rest.startsWith(delim) || /\s/.test(s[i + delim.length] ?? ' ')) continue;
      if (delim[0] === '_' && /\w/.test(s[i - 1] ?? '')) continue; // snake_case
      const close = findClose(s, delim, i + delim.length + 1);
      if (close < 0) continue;
      flush();
      out.push(...parseInline(s.slice(i + delim.length, close), { ...style, [key]: true }));
      i = close + delim.length;
      break;
    }
    if (i === from) {
      buf += c;
      i++;
    }
  }
  flush();
  return out;
}

type RawBlock =
  | { kind: 'heading'; level: number; src: string }
  | { kind: 'paragraph' | 'quote'; src: string }
  | { kind: 'item'; marker: string; depth: number; src: string }
  | { kind: 'code'; src: string }
  | { kind: 'rule' };

function parseBlocks(md: string): RawBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: RawBlock[] = [];
  let open: RawBlock | null = null;
  const close = () => {
    open = null;
  };
  let i = 0;
  // YAML front matter (Obsidian, Jekyll…) is metadata, not script.
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      close();
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      if (body.length) out.push({ kind: 'code', src: body.join('\n') });
      continue;
    }
    if (!line.trim()) {
      close();
      continue;
    }
    // Setext headings: a paragraph underlined with === or ---.
    const cur = open as RawBlock | null;
    if (cur?.kind === 'paragraph' && /^\s*(=+|-+)\s*$/.test(line)) {
      out[out.length - 1] = { kind: 'heading', level: line.trim()[0] === '=' ? 1 : 2, src: cur.src };
      close();
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      close();
      out.push({ kind: 'rule' });
      continue;
    }
    const h = /^\s{0,3}(#{1,6})\s+(.*?)(\s+#+)?\s*$/.exec(line);
    if (h) {
      close();
      out.push({ kind: 'heading', level: h[1].length, src: h[2] });
      continue;
    }
    const q = /^\s{0,3}>\s?(.*)$/.exec(line);
    if (q) {
      if (cur?.kind === 'quote') cur.src += (q[1].trim() ? ' ' : '') + q[1];
      else {
        open = { kind: 'quote', src: q[1] };
        out.push(open);
      }
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      let src = li[3];
      let marker = /\d/.test(li[2]) ? li[2].replace(')', '.') : '•';
      const task = /^\[([ xX])\]\s+(.*)$/.exec(src);
      if (task) {
        marker = task[1] === ' ' ? '☐' : '☑';
        src = task[2];
      }
      open = { kind: 'item', marker, depth: Math.floor(li[1].replace(/\t/g, '  ').length / 2), src };
      out.push(open);
      continue;
    }
    // Lazy continuation of a paragraph, quote or list item.
    if (cur && cur.kind !== 'heading' && cur.kind !== 'rule' && cur.kind !== 'code') {
      cur.src += ' ' + line.trim();
      continue;
    }
    open = { kind: 'paragraph', src: line.trim() };
    out.push(open);
  }
  return out;
}

export function parseMarkdown(md: string): MarkdownDoc {
  let plain = '';
  const toRuns = (pieces: Piece[]): Run[] =>
    pieces.map(({ text, style }) => {
      const start = plain.length;
      plain += text;
      return { text, start, end: plain.length, ...style };
    });
  const blocks: Block[] = [];
  for (const raw of parseBlocks(md)) {
    if (raw.kind === 'rule') {
      blocks.push(raw);
      continue;
    }
    if (plain) plain += '\n';
    const runs = raw.kind === 'code' ? toRuns([{ text: raw.src, style: { code: true } }]) : toRuns(parseInline(raw.src.trim()));
    if (raw.kind === 'heading') blocks.push({ kind: 'heading', level: raw.level, runs });
    else if (raw.kind === 'item') blocks.push({ kind: 'item', marker: raw.marker, depth: raw.depth, runs });
    else blocks.push({ kind: raw.kind, runs });
  }
  return { blocks, plain };
}
