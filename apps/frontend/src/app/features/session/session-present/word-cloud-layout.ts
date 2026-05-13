export const MIN_WORD_CLOUD_LAYOUT_WIDTH = 280;
export const MOBILE_WORD_CLOUD_BREAKPOINT = 600;
export const MOBILE_WORD_CLOUD_LIMIT = 50;
export const DESKTOP_WORD_CLOUD_LIMIT = 100;
export const DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT = 150;

export function shouldUseWordCloudLayout(stageWidth: number, wordCount: number): boolean {
  return stageWidth >= MIN_WORD_CLOUD_LAYOUT_WIDTH && wordCount > 0;
}

export function getWordCloudLayoutWordCap(stageWidth: number, presentationMode = false): number {
  return stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT
    ? MOBILE_WORD_CLOUD_LIMIT
    : presentationMode
      ? DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT
      : DESKTOP_WORD_CLOUD_LIMIT;
}

export function getWordCloudLayoutHeight(
  stageWidth: number,
  wordCount: number,
  presentationMode = false,
): number {
  const count = Math.max(1, wordCount);
  if (stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT) {
    return presentationMode ? clamp(520, 380 + count * 8, 860) : clamp(440, 320 + count * 8, 760);
  }

  return presentationMode ? clamp(600, 420 + count * 5, 960) : clamp(340, 260 + count * 3, 560);
}

export function getWordCloudChipPadding(fontSize: number): number {
  return Math.max(12, Math.round(fontSize * 0.55));
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
