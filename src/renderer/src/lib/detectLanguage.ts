import type { SttLang } from '../../../shared/stt';

// Function words are the most frequent tokens in any text and barely overlap between
// the two languages, so counting them is a reliable detector for a script-length text.
const ES = new Set(
  'el la los las un una unos unas de del al y o que en es son por para con sin se su sus lo le les mi tu te me nos pero como más muy ya este esta estos estas ese esa eso hay está están fue ser no sí cuando donde porque también todo todos'.split(' ')
);
const EN = new Set(
  'the a an of and or that in is are was were to for with without it its this these those be been by on at from as but not you your we our they their he she his her i my me do does did have has there what when where which who will would can if so also all'.split(' ')
);

/** Best guess at the script's language; Spanish on a tie (no signal either way). */
export function detectLanguage(text: string): SttLang {
  let es = 0;
  let en = 0;
  for (const raw of text.toLowerCase().split(/[^\p{L}']+/u)) {
    if (!raw) continue;
    if (ES.has(raw)) es++;
    if (EN.has(raw)) en++;
    if (/[ñ¿¡áéíóú]/.test(raw)) es++;
  }
  return en > es ? 'en' : 'es';
}
