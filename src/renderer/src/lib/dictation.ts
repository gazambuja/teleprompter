// Vosk returns lowercase words with no punctuation. Dictated phrases are spliced in at the
// caret, spaced from their neighbours and capitalized where a sentence starts.

const SENTENCE_END = /[.!?…]\s*$|\n\s*$|^\s*$/;

export function insertDictation(
  value: string,
  selStart: number,
  selEnd: number,
  spoken: string
): { value: string; caret: number } {
  let phrase = spoken.trim().replace(/\s+/g, ' ');
  if (!phrase) return { value, caret: selEnd };
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  if (SENTENCE_END.test(before)) phrase = phrase.charAt(0).toLocaleUpperCase() + phrase.slice(1);
  if (before && !/\s$/.test(before)) phrase = ' ' + phrase;
  if (after && !/^[\s.,;:!?)]/.test(after)) phrase += ' ';
  return { value: before + phrase + after, caret: before.length + phrase.length };
}
