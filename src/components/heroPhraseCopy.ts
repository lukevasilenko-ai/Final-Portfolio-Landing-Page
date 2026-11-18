/**
 * Words of the hero statement, kept in the hero's existing title fields so they can be changed in
 * the visual editor: titleLine1 and titleLine2 are the first two lines, titleLine3 holds the words
 * the last line cycles through, separated by "/". A line still holding the old headline's default
 * text counts as unset (that headline was replaced by this statement).
 */
export const PHRASE_KEYS = ['titleLine1', 'titleLine2', 'titleLine3'] as const;
export type PhraseKey = (typeof PHRASE_KEYS)[number];

export const PHRASE_DEFAULTS: Record<PhraseKey, string> = {
  titleLine1: 'ვქმნი დიზაინს,',
  titleLine2: 'რომელიც',
  titleLine3: 'ყიდის / ჩანს / ახსოვთ / მუშაობს',
};

const OLD_DEFAULTS: Record<PhraseKey, string> = {
  titleLine1: 'ესთეტიკა,',
  titleLine2: 'იდეა და ხასიათი',
  titleLine3: 'ერთ დიზაინში',
};

export const PHRASE_FIELD_LABELS: Record<PhraseKey, { title: string; hint?: string }> = {
  titleLine1: { title: 'ფრაზის პირველი სტრიქონი' },
  titleLine2: { title: 'ფრაზის მეორე სტრიქონი' },
  titleLine3: { title: 'ცვალებადი სიტყვები', hint: 'გამოყავით „/“-ით, მაგ.: ყიდის / ჩანს / ახსოვთ' },
};

export const isPhraseKey = (key: string): key is PhraseKey => (PHRASE_KEYS as readonly string[]).includes(key);

/** The text to use for one line: the saved text, or the default when unset or still the old default. */
export function phraseLine(key: PhraseKey, saved: string | undefined) {
  const text = saved?.trim();
  return !text || text === OLD_DEFAULTS[key] ? PHRASE_DEFAULTS[key] : text;
}

/** Each cycling word with its full stop (unless it already ends in punctuation). */
export function phraseWords(line: string) {
  const words = line.split('/').map((word) => word.trim()).filter(Boolean);
  return (words.length ? words : [line.trim()]).map((word) => (/[.!?…]$/.test(word) ? word : `${word}.`));
}
