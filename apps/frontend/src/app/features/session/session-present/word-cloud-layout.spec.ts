import { describe, expect, it } from 'vitest';
import {
  DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT,
  DESKTOP_WORD_CLOUD_LIMIT,
  MIN_WORD_CLOUD_LAYOUT_WIDTH,
  MOBILE_WORD_CLOUD_LIMIT,
  getWordCloudChipPadding,
  getWordCloudLayoutHeight,
  getWordCloudLayoutWordCap,
  shouldUseWordCloudLayout,
} from './word-cloud-layout';

describe('word-cloud layout helpers', () => {
  it('aktiviert das echte Cloud-Layout erst ab sinnvoller Mindestbreite', () => {
    expect(shouldUseWordCloudLayout(MIN_WORD_CLOUD_LAYOUT_WIDTH - 1, 10)).toBe(false);
    expect(shouldUseWordCloudLayout(MIN_WORD_CLOUD_LAYOUT_WIDTH, 10)).toBe(true);
    expect(shouldUseWordCloudLayout(900, 0)).toBe(false);
  });

  it('begrenzt die Wortmenge fuer mobile und breite Ansichten unterschiedlich', () => {
    expect(getWordCloudLayoutWordCap(390)).toBe(MOBILE_WORD_CLOUD_LIMIT);
    expect(getWordCloudLayoutWordCap(900)).toBe(DESKTOP_WORD_CLOUD_LIMIT);
    expect(getWordCloudLayoutWordCap(900, true)).toBe(DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT);
  });

  it('waehlt grosszuegige, aber gedeckelte Layout-Hoehen fuer mobile und Desktop', () => {
    expect(getWordCloudLayoutHeight(390, 10)).toBe(440);
    expect(getWordCloudLayoutHeight(390, 50)).toBe(720);
    expect(getWordCloudLayoutHeight(1280, 10)).toBe(340);
    expect(getWordCloudLayoutHeight(1280, 100)).toBe(560);
    expect(getWordCloudLayoutHeight(1280, 10, true)).toBe(600);
    expect(getWordCloudLayoutHeight(1280, 100, true)).toBe(920);
  });

  it('rechnet fuer Chips ein paddingsicheres Mindestmass aus', () => {
    expect(getWordCloudChipPadding(14)).toBe(12);
    expect(getWordCloudChipPadding(40)).toBe(22);
  });
});
