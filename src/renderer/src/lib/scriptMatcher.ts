export interface ScriptWord {
  raw: string;
  normalized: string;
  start: number;
  end: number;
}

const wordRe = /\S+/g;

export function tokenize(text: string): ScriptWord[] {
  const out: ScriptWord[] = [];
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    out.push({
      raw: m[0],
      normalized: normalize(m[0]),
      start: m.index,
      end: m.index + m[0].length
    });
  }
  return out;
}

export function normalize(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\sáéíóúñü]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) v0[j] = j;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  const d = levenshtein(a, b);
  const allowed = minLen <= 2 ? 0 : Math.max(1, Math.floor(minLen / 4));
  return d <= allowed;
}

export interface MatchResult {
  newSpokenIndex: number;
  matched: number;
  unmatched: number;
}

// Vosk regularly misses script words (names, English words through a Spanish model,
// numbers). A strictly greedy matcher stalls forever on the first miss, so recognized
// words may skip ahead: short words only match in place (too ambiguous), longer words
// within LOOKAHEAD, and further jumps (reader skipped a sentence) need two consecutive hits.
const LOOKAHEAD = 6;
const RESYNC_WINDOW = 40;

export function matchRecognition(
  recognized: string,
  expected: ScriptWord[],
  fromIndex: number
): MatchResult {
  const recWords = recognized
    .split(/\s+/)
    .map(normalize)
    .filter((w) => w.length > 0);
  let i = fromIndex;
  let matched = 0;
  let unmatched = 0;
  const find = (w: string, from: number, to: number): number => {
    for (let k = from; k < Math.min(expected.length, to); k++) {
      if (fuzzyMatch(w, expected[k].normalized)) return k;
    }
    return -1;
  };
  for (let j = 0; j < recWords.length; j++) {
    const w = recWords[j];
    if (i >= expected.length) {
      unmatched++;
      continue;
    }
    let hit = find(w, i, i + (w.length >= 4 ? LOOKAHEAD : 1));
    if (hit < 0 && w.length >= 4 && j + 1 < recWords.length) {
      for (let k = find(w, i + LOOKAHEAD, i + RESYNC_WINDOW); k >= 0; k = find(w, k + 1, i + RESYNC_WINDOW)) {
        if (k + 1 < expected.length && fuzzyMatch(recWords[j + 1], expected[k + 1].normalized)) {
          hit = k;
          break;
        }
      }
    }
    if (hit >= 0) {
      i = hit + 1;
      matched++;
    } else {
      unmatched++;
    }
  }
  return { newSpokenIndex: i, matched, unmatched };
}
