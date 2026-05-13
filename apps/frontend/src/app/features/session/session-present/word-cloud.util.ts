import { deu, eng, fra, ita, spa } from 'stopword';
import type { SupportedLocale } from '../../../core/locale-from-path';

export interface WordAggregate {
  word: string;
  count: number;
  groupKey: string;
  variants: string[];
}

export interface WeightedWordSource {
  text: string;
  weight?: number;
}

interface WordGrouping {
  readonly groupKey: string;
  readonly display: string;
  readonly preferredDisplay: string | null;
}

interface AggregateBucket {
  readonly groupKey: string;
  count: number;
  readonly variants: Map<string, number>;
  preferredDisplay: string | null;
}

interface ResponseGroupingBucket {
  readonly groupKey: string;
  readonly displays: Set<string>;
  preferredDisplay: string | null;
}

interface GroupingRule {
  readonly pattern: RegExp;
  readonly toGroupKey: (match: RegExpExecArray) => string;
  readonly toDisplay?: (match: RegExpExecArray) => string;
}

// Kurze Fachbegriffe wie "pi" oder "KI" sollen sichtbar bleiben.
// Ein-Zeichen-Rauschen wird nur fuer Nicht-Zahlen gefiltert.
const MIN_TEXT_TOKEN_LENGTH = 2;
const NUMBER_TOKEN_PATTERN = /^-?\d+(?:[.,]\d+)*$/;
const TOKEN_PATTERN = /-?\d+(?:[.,]\d+)*|[\p{L}\p{N}-]+/gu;
const DECIMAL_SEPARATOR_SPACING_PATTERN = /(\d)\s*([.,])\s*(?=\d)/g;
const COMBINING_MARK_PATTERN = /\p{M}+/gu;

const GERMAN_GROUPING_RULES: readonly GroupingRule[] = [
  {
    pattern: /^haeng(?:e|en|t|te|ten|tet|test|end|ende|endem|enden|ender|endes)$/u,
    toGroupKey: () => 'haengen',
    toDisplay: () => 'hängen',
  },
  {
    pattern: /^(.{3,})isierung(?:en)?$/u,
    toGroupKey: ([, stem]) => `${stem}isieren`,
    toDisplay: ([, stem]) => `${stem}isieren`,
  },
  {
    pattern: /^(.{3,})isiert(?:e|em|en|er|es|et|est)?$/u,
    toGroupKey: ([, stem]) => `${stem}isieren`,
    toDisplay: ([, stem]) => `${stem}isieren`,
  },
  {
    pattern: /^(.{3,})isierend(?:e|em|en|er|es)?$/u,
    toGroupKey: ([, stem]) => `${stem}isieren`,
    toDisplay: ([, stem]) => `${stem}isieren`,
  },
  {
    pattern: /^(.{3,})ierung(?:en)?$/u,
    toGroupKey: ([, stem]) => `${stem}ieren`,
    toDisplay: ([, stem]) => `${stem}ieren`,
  },
  {
    pattern: /^(.{3,})iert(?:e|em|en|er|es|et|est)?$/u,
    toGroupKey: ([, stem]) => `${stem}ieren`,
    toDisplay: ([, stem]) => `${stem}ieren`,
  },
  {
    pattern: /^(.{3,})ierend(?:e|em|en|er|es)?$/u,
    toGroupKey: ([, stem]) => `${stem}ieren`,
    toDisplay: ([, stem]) => `${stem}ieren`,
  },
];

const ENGLISH_GROUPING_RULES: readonly GroupingRule[] = [
  {
    pattern: /^(.{3,})izations?$/u,
    toGroupKey: ([, stem]) => `${stem}ize`,
    toDisplay: ([, stem]) => `${stem}ize`,
  },
  {
    pattern: /^(.{3,})iz(?:ed|es|ing|er|ers)$/u,
    toGroupKey: ([, stem]) => `${stem}ize`,
    toDisplay: ([, stem]) => `${stem}ize`,
  },
  {
    pattern: /^validat(?:ed|es|ing|ion|ions|or|ors|ory)$/u,
    toGroupKey: () => 'validate',
    toDisplay: () => 'validate',
  },
];

const GROUPING_RULES_BY_LOCALE: Partial<Record<SupportedLocale, readonly GroupingRule[]>> = {
  de: GERMAN_GROUPING_RULES,
  en: ENGLISH_GROUPING_RULES,
};

const STOPWORDS_BY_LOCALE: Record<SupportedLocale, ReadonlySet<string>> = {
  de: new Set(deu),
  en: new Set(eng),
  fr: new Set(fra),
  it: new Set(ita),
  es: new Set(spa),
};

export const DEFAULT_STOPWORDS = STOPWORDS_BY_LOCALE.de;

export function getStopwordsForLocale(locale: SupportedLocale): ReadonlySet<string> {
  return STOPWORDS_BY_LOCALE[locale] ?? DEFAULT_STOPWORDS;
}

export function createWordCloudStopwordLookup(
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
  locale: SupportedLocale = 'de',
): ReadonlySet<string> {
  return createStopwordLookup(stopwords, locale);
}

export function aggregateWords(
  responses: string[],
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
  locale: SupportedLocale = 'de',
): WordAggregate[] {
  return aggregateWeightedWords(
    responses.map((response) => ({ text: response })),
    stopwords,
    locale,
  );
}

export function aggregateWeightedWords(
  sources: WeightedWordSource[],
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
  locale: SupportedLocale = 'de',
): WordAggregate[] {
  const buckets = new Map<string, AggregateBucket>();
  const stopwordLookup = createWordCloudStopwordLookup(stopwords, locale);

  for (const source of sources) {
    const groupings = collectResponseGroupings(source.text, stopwordLookup, locale);
    const weight = normalizeWeight(source.weight);
    for (const grouping of groupings.values()) {
      const bucket = getOrCreateBucket(buckets, grouping.groupKey);
      bucket.count += weight;
      for (const display of grouping.displays) {
        bucket.variants.set(display, (bucket.variants.get(display) ?? 0) + weight);
      }
      if (grouping.preferredDisplay) {
        bucket.preferredDisplay = bucket.preferredDisplay ?? grouping.preferredDisplay;
      }
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const variants = sortVariantEntries(bucket.variants, locale).map(([variant]) => variant);
      return {
        word: bucket.preferredDisplay ?? variants[0] ?? bucket.groupKey,
        count: bucket.count,
        groupKey: bucket.groupKey,
        variants,
      };
    })
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export function normalizeFreeTextResponseForDisplay(value: string): string {
  const collapsed = collapseNumericSeparatorSpacing(value);
  if (isNumericToken(collapsed)) {
    return normalizeToken(collapsed);
  }

  return value.trim();
}

export function responseContainsWord(
  response: string,
  word: string,
  locale: SupportedLocale = 'de',
): boolean {
  const normalizedWord = normalizeLookupToken(word);
  if (!normalizedWord) {
    return false;
  }

  const targetGroupKey = getWordGrouping(normalizedWord, locale).groupKey;
  return collectResponseGroupings(response, new Set<string>(), locale).has(targetGroupKey);
}

export function extractResponseGroupKeys(
  response: string,
  stopwordLookup: ReadonlySet<string>,
  locale: SupportedLocale = 'de',
): string[] {
  return [...collectResponseGroupings(response, stopwordLookup, locale).keys()];
}

function normalizeWeight(weight?: number): number {
  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(1, Math.round(weight ?? 1));
}

function getOrCreateBucket(
  buckets: Map<string, AggregateBucket>,
  groupKey: string,
): AggregateBucket {
  const existing = buckets.get(groupKey);
  if (existing) {
    return existing;
  }

  const created: AggregateBucket = {
    groupKey,
    count: 0,
    variants: new Map<string, number>(),
    preferredDisplay: null,
  };
  buckets.set(groupKey, created);
  return created;
}

function collectResponseGroupings(
  response: string,
  stopwordLookup: ReadonlySet<string>,
  locale: SupportedLocale,
): Map<string, ResponseGroupingBucket> {
  const groupings = new Map<string, ResponseGroupingBucket>();

  for (const word of tokenize(response)) {
    if (!isNumericToken(word) && word.length < MIN_TEXT_TOKEN_LENGTH) continue;
    const grouping = getWordGrouping(word, locale);
    if (stopwordLookup.has(word) || stopwordLookup.has(grouping.groupKey)) continue;

    const bucket = getOrCreateResponseGroupingBucket(groupings, grouping.groupKey);
    bucket.displays.add(grouping.display);
    if (grouping.preferredDisplay) {
      bucket.preferredDisplay = bucket.preferredDisplay ?? grouping.preferredDisplay;
    }
  }

  return groupings;
}

function getOrCreateResponseGroupingBucket(
  groupings: Map<string, ResponseGroupingBucket>,
  groupKey: string,
): ResponseGroupingBucket {
  const existing = groupings.get(groupKey);
  if (existing) {
    return existing;
  }

  const created: ResponseGroupingBucket = {
    groupKey,
    displays: new Set<string>(),
    preferredDisplay: null,
  };
  groupings.set(groupKey, created);
  return created;
}

function tokenize(value: string): string[] {
  const normalizedInput = collapseNumericSeparatorSpacing(value).toLowerCase();
  return Array.from(normalizedInput.matchAll(TOKEN_PATTERN), (match) => normalizeToken(match[0]!));
}

function isNumericToken(value: string): boolean {
  return NUMBER_TOKEN_PATTERN.test(value);
}

function normalizeToken(value: string): string {
  if (isNumericToken(value)) {
    // "3,14" und "3.14" sollen in derselben Wolke zusammenlaufen.
    return value.replaceAll(',', '.');
  }

  return value;
}

function createStopwordLookup(
  stopwords: ReadonlySet<string>,
  locale: SupportedLocale,
): ReadonlySet<string> {
  const lookup = new Set<string>();
  for (const stopword of stopwords) {
    const normalized = normalizeLookupToken(stopword);
    if (!normalized) {
      continue;
    }

    lookup.add(normalized);
    lookup.add(getWordGrouping(normalized, locale).groupKey);
  }

  return lookup;
}

function normalizeLookupToken(value: string): string {
  return normalizeToken(collapseNumericSeparatorSpacing(value).trim().toLowerCase());
}

function getWordGrouping(token: string, locale: SupportedLocale): WordGrouping {
  if (isNumericToken(token)) {
    return {
      groupKey: token,
      display: token,
      preferredDisplay: token,
    };
  }

  const comparableToken = normalizeTokenForGrouping(token, locale);
  const rules = GROUPING_RULES_BY_LOCALE[locale] ?? [];
  for (const rule of rules) {
    const match = rule.pattern.exec(comparableToken);
    if (!match) {
      continue;
    }

    return {
      groupKey: rule.toGroupKey(match),
      display: token,
      preferredDisplay: rule.toDisplay?.(match) ?? null,
    };
  }

  return {
    groupKey: comparableToken,
    display: token,
    preferredDisplay: null,
  };
}

function normalizeTokenForGrouping(token: string, locale: SupportedLocale): string {
  if (isNumericToken(token)) {
    return token;
  }

  let comparable = token;
  if (locale === 'de') {
    comparable = comparable
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss');
  }

  return comparable.normalize('NFKD').replace(COMBINING_MARK_PATTERN, '');
}

function sortVariantEntries(
  variants: ReadonlyMap<string, number>,
  locale: SupportedLocale,
): Array<[string, number]> {
  return [...variants.entries()].sort(
    ([leftVariant, leftCount], [rightVariant, rightCount]) =>
      rightCount - leftCount ||
      scoreDisplayVariant(rightVariant, locale) - scoreDisplayVariant(leftVariant, locale) ||
      leftVariant.length - rightVariant.length ||
      leftVariant.localeCompare(rightVariant),
  );
}

function scoreDisplayVariant(value: string, locale: SupportedLocale): number {
  let score = isAscii(value) ? 0 : 2;
  if (locale === 'de' && /(ae|oe|ue)/u.test(value)) {
    score -= 1;
  }

  return score;
}

function isAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }

  return true;
}

function collapseNumericSeparatorSpacing(value: string): string {
  return value.trim().replace(DECIMAL_SEPARATOR_SPACING_PATTERN, '$1$2');
}
