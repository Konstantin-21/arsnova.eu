#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { deu } from 'stopword';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const DATASET_PATH = resolve(REPO_ROOT, 'docs/examples/quiz-import/word-cloud-responses-komplex.txt');
const D3_CLOUD_BUILD_PATH = resolve(REPO_ROOT, 'node_modules/d3-cloud/build/d3.layout.cloud.js');
const LOCAL_BROWSER_CANDIDATES = [
  '/opt/homebrew/bin/chromium',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const STOPWORDS = new Set(deu);
const MIN_TEXT_TOKEN_LENGTH = 2;
const NUMBER_TOKEN_PATTERN = /^-?\d+(?:[.,]\d+)*$/;
const TOKEN_PATTERN = /-?\d+(?:[.,]\d+)*|[\p{L}\p{N}-]+/gu;
const DECIMAL_SEPARATOR_SPACING_PATTERN = /(\d)\s*([.,])\s*(?=\d)/g;

const DEFAULT_LIMITS = [25, 50, 100, 200, 300];
const DEFAULT_ITERATIONS = 5;
const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
];
const TIME_SLICE_MODES = [
  { label: 'blocking', value: null },
  { label: 'sliced-8ms', value: 8 },
];

function parseIntegerList(value, fallback) {
  if (!value) return fallback;
  const parsed = value
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
  return parsed.length > 0 ? parsed : fallback;
}

function parseIterations(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function collapseNumericSeparatorSpacing(value) {
  return value.trim().replace(DECIMAL_SEPARATOR_SPACING_PATTERN, '$1$2');
}

function isNumericToken(value) {
  return NUMBER_TOKEN_PATTERN.test(value);
}

function normalizeToken(value) {
  if (isNumericToken(value)) {
    return value.replaceAll(',', '.');
  }
  return value;
}

function tokenize(value) {
  const normalizedInput = collapseNumericSeparatorSpacing(value).toLowerCase();
  return Array.from(normalizedInput.matchAll(TOKEN_PATTERN), (match) => normalizeToken(match[0]));
}

function aggregateWords(responses) {
  const counts = new Map();

  for (const response of responses) {
    for (const word of tokenize(response)) {
      if (!isNumericToken(word) && word.length < MIN_TEXT_TOKEN_LENGTH) continue;
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

function scaleWords(entries, limit) {
  const subset = entries.slice(0, limit);
  const maxCount = subset[0]?.count ?? 1;
  return subset.map((entry) => ({
    text: entry.word,
    value: entry.count,
    size: 14 + Math.round((entry.count / maxCount) * 26),
  }));
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function summarize(values) {
  if (values.length === 0) {
    return { avg: 0, p95: 0, max: 0 };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    avg: sum / values.length,
    p95: percentile(values, 0.95),
    max: Math.max(...values),
  };
}

function formatMs(value) {
  return value.toFixed(1).padStart(7);
}

function formatRatio(value) {
  return `${(value * 100).toFixed(0).padStart(3)}%`;
}

function layoutSizeForViewport(viewport) {
  const horizontalPadding = viewport.width < 600 ? 28 : 160;
  const width = Math.max(280, viewport.width - horizontalPadding);
  const height = viewport.width < 600 ? 900 : 560;
  return { width, height };
}

async function launchBrowser() {
  for (const executablePath of LOCAL_BROWSER_CANDIDATES) {
    try {
      await access(executablePath);
      return await chromium.launch({ executablePath, headless: true });
    } catch {
      // Try next local browser candidate.
    }
  }

  try {
    return await chromium.launch({ headless: true });
  } catch {
    return await webkit.launch({ headless: true });
  }
}

async function preparePage(page) {
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({ path: D3_CLOUD_BUILD_PATH });
  const cloudReady = await page.evaluate(() => Boolean(window.d3?.layout?.cloud));
  if (!cloudReady) {
    throw new Error('d3-cloud konnte im Browser-Kontext nicht geladen werden.');
  }
}

async function runLayoutBenchmark(page, words, layoutSize, timeSliceMs, seed) {
  return page.evaluate(
    ({ words: inputWords, layoutSize: size, timeSliceMs: sliceMs, seed: randomSeed }) =>
      new Promise((resolve) => {
        const createRandom = (seedValue) => {
          let state = seedValue >>> 0;
          return () => {
            state += 0x6d2b79f5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
          };
        };

        const start = performance.now();
        const longTaskDurations = [];
        let observer = null;
        let settled = false;

        try {
          if ('PerformanceObserver' in window) {
            observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                longTaskDurations.push(entry.duration);
              }
            });
            observer.observe({ entryTypes: ['longtask'] });
          }
        } catch {
          observer = null;
        }

        const finish = (result) => {
          if (settled) return;
          settled = true;
          observer?.disconnect();
          clearTimeout(timeoutId);
          resolve({
            durationMs: performance.now() - start,
            longTaskCount: longTaskDurations.length,
            maxLongTaskMs: longTaskDurations.length > 0 ? Math.max(...longTaskDurations) : 0,
            ...result,
          });
        };

        const layout = window.d3.layout
          .cloud()
          .size([size.width, size.height])
          .words(inputWords.map((word) => ({ ...word })))
          .font('Arial')
          .padding(2)
          .rotate(() => 0)
          .fontSize((word) => word.size)
          .random(createRandom(randomSeed));

        if (sliceMs !== null) {
          layout.timeInterval(sliceMs);
        }

        layout.on('end', (placed) => {
          finish({
            placedCount: placed.length,
            requestedCount: inputWords.length,
            timedOut: false,
          });
        });

        const timeoutId = setTimeout(() => {
          try {
            layout.stop();
          } catch {
            // no-op
          }
          finish({
            placedCount: 0,
            requestedCount: inputWords.length,
            timedOut: true,
          });
        }, 30000);

        try {
          layout.start();
        } catch (error) {
          finish({
            placedCount: 0,
            requestedCount: inputWords.length,
            timedOut: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    { words, layoutSize, timeSliceMs, seed }
  );
}

function printAggregationSummary(summary, responseCount, uniqueCount) {
  console.log('Dataset');
  console.log(`  responses: ${responseCount}`);
  console.log(`  unique words after stopwords: ${uniqueCount}`);
  console.log(
    `  aggregation (node): avg ${summary.avg.toFixed(2)} ms, p95 ${summary.p95.toFixed(2)} ms, max ${summary.max.toFixed(2)} ms`
  );
  console.log('');
}

function printHeader() {
  console.log('Layout');
  console.log(
    [
      'viewport'.padEnd(9),
      'words'.padStart(5),
      'mode'.padEnd(11),
      'avg ms'.padStart(8),
      'p95 ms'.padStart(8),
      'max ms'.padStart(8),
      'max long'.padStart(10),
      'placed'.padStart(8),
      'timeouts'.padStart(9),
    ].join(' ')
  );
}

function printResultRow(result) {
  console.log(
    [
      result.viewport.padEnd(9),
      String(result.wordCount).padStart(5),
      result.mode.padEnd(11),
      formatMs(result.duration.avg),
      formatMs(result.duration.p95),
      formatMs(result.duration.max),
      formatMs(result.maxLongTask.avg),
      formatRatio(result.placedRatio.avg).padStart(8),
      String(result.timeouts).padStart(9),
    ].join(' ')
  );
}

async function main() {
  const iterations = parseIterations(process.env.WORD_CLOUD_ITERATIONS, DEFAULT_ITERATIONS);
  const limits = parseIntegerList(process.env.WORD_CLOUD_LIMITS, DEFAULT_LIMITS);
  const datasetRaw = await readFile(DATASET_PATH, 'utf8');
  const responses = datasetRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const aggregationSamples = [];
  let aggregated = [];
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    aggregated = aggregateWords(responses);
    aggregationSamples.push(performance.now() - start);
  }

  printAggregationSummary(summarize(aggregationSamples), responses.length, aggregated.length);

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await preparePage(page);

    printHeader();

    for (const viewport of DEFAULT_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const layoutSize = layoutSizeForViewport(viewport);

      for (const limit of limits) {
        const words = scaleWords(aggregated, limit);

        for (const mode of TIME_SLICE_MODES) {
          const samples = [];

          // Warm-up run so font metrics and canvas init do not distort the first measured sample too much.
          await runLayoutBenchmark(page, words, layoutSize, mode.value, 1000 + limit);

          for (let iteration = 0; iteration < iterations; iteration += 1) {
            samples.push(
              await runLayoutBenchmark(
                page,
                words,
                layoutSize,
                mode.value,
                10_000 + limit * 31 + iteration * 97
              )
            );
          }

          const durations = summarize(samples.map((sample) => sample.durationMs));
          const maxLongTask = summarize(samples.map((sample) => sample.maxLongTaskMs));
          const placedRatio = summarize(
            samples.map((sample) => sample.placedCount / Math.max(1, sample.requestedCount))
          );
          const timeouts = samples.filter((sample) => sample.timedOut).length;
          const errors = samples.filter((sample) => sample.error);

          printResultRow({
            viewport: viewport.name,
            wordCount: words.length,
            mode: mode.label,
            duration: durations,
            maxLongTask,
            placedRatio,
            timeouts,
          });

          if (errors.length > 0) {
            console.log(`  errors: ${errors.map((sample) => sample.error).join(' | ')}`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
