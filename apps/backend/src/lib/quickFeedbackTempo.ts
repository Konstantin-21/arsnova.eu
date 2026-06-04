import type {
  QuickFeedbackResult,
  TempoTrend,
  TempoTrendStatus,
  TempoValue,
} from '@arsnova/shared-types';

const TEMPO_VALUES = [
  'SPEED_UP',
  'FOLLOWING',
  'SLOW_DOWN',
  'LOST',
] as const satisfies readonly TempoValue[];

export const TEMPO_BUCKET_SECONDS = 15;
export const TEMPO_WINDOW_SECONDS = 60;
const TEMPO_BUCKET_MS = TEMPO_BUCKET_SECONDS * 1000;
const TEMPO_WINDOW_MS = TEMPO_WINDOW_SECONDS * 1000;
const TEMPO_MIN_REQUIRED_VOTES = 8;

export interface TempoBucketSnapshot {
  bucketMs: number;
  distribution: Record<string, number>;
  totalVotes: number;
}

interface CalculateTempoTrendInput {
  distribution: Record<string, number>;
  totalVotes: number;
  activeParticipants: number;
  snapshots?: readonly TempoBucketSnapshot[];
}

function positiveNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function count(distribution: Record<string, number>, value: TempoValue): number {
  return positiveNumber(distribution[value]);
}

function tempoRatio(
  distribution: Record<string, number>,
  value: TempoValue,
  activeParticipants: number,
): number {
  return activeParticipants > 0 ? count(distribution, value) / activeParticipants : 0;
}

function problemRatio(distribution: Record<string, number>, activeParticipants: number): number {
  return activeParticipants > 0
    ? (count(distribution, 'SLOW_DOWN') + count(distribution, 'LOST')) / activeParticipants
    : 0;
}

function deriveTempoStatus(
  distribution: Record<string, number>,
  activeParticipants: number,
): TempoTrendStatus {
  const lost = tempoRatio(distribution, 'LOST', activeParticipants);
  const problems = problemRatio(distribution, activeParticipants);
  const speedUp = tempoRatio(distribution, 'SPEED_UP', activeParticipants);
  const following = tempoRatio(distribution, 'FOLLOWING', activeParticipants);

  if (lost >= 0.12) {
    return 'LOST';
  }
  if (problems >= 0.22) {
    return 'TOO_FAST';
  }
  if (speedUp >= 0.22 && problems < 0.1) {
    return 'TOO_SLOW';
  }
  if (following >= 0.5 && problems < 0.15) {
    return 'FOLLOWING';
  }
  return 'HETEROGENEOUS';
}

function hasClearTempoMargin(
  distribution: Record<string, number>,
  activeParticipants: number,
  status: TempoTrendStatus,
): boolean {
  const lost = tempoRatio(distribution, 'LOST', activeParticipants);
  const problems = problemRatio(distribution, activeParticipants);
  const speedUp = tempoRatio(distribution, 'SPEED_UP', activeParticipants);
  const following = tempoRatio(distribution, 'FOLLOWING', activeParticipants);

  switch (status) {
    case 'LOST':
      return lost >= 0.18;
    case 'TOO_FAST':
      return problems >= 0.32;
    case 'TOO_SLOW':
      return speedUp >= 0.32 && problems < 0.08;
    case 'FOLLOWING':
      return following >= 0.65 && problems < 0.1;
    case 'HETEROGENEOUS':
      return true;
    default:
      return false;
  }
}

function averageTempoDistribution(
  currentDistribution: Record<string, number>,
  snapshots: readonly TempoBucketSnapshot[],
): Record<string, number> {
  const source = snapshots.length > 0 ? snapshots : [{ distribution: currentDistribution }];
  const averaged: Record<string, number> = Object.fromEntries(
    TEMPO_VALUES.map((value) => [value, 0]),
  );

  for (const snapshot of source) {
    for (const value of TEMPO_VALUES) {
      averaged[value] += count(snapshot.distribution, value) / source.length;
    }
  }

  return averaged;
}

function stableBucketStatus(
  snapshots: readonly TempoBucketSnapshot[],
  activeParticipants: number,
  requiredVotes: number,
): TempoTrendStatus | null {
  const recent = snapshots
    .filter((snapshot) => snapshot.totalVotes >= requiredVotes)
    .slice(-2)
    .map((snapshot) => deriveTempoStatus(snapshot.distribution, activeParticipants));

  if (recent.length < 2) {
    return null;
  }

  return recent[0] === recent[1] ? recent[0] : null;
}

export function tempoBucketStartMs(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / TEMPO_BUCKET_MS) * TEMPO_BUCKET_MS;
}

export function buildTempoBucketPayload(
  result: Pick<QuickFeedbackResult, 'distribution' | 'totalVotes'>,
): string {
  return JSON.stringify({
    distribution: Object.fromEntries(
      TEMPO_VALUES.map((value) => [
        value,
        Math.max(0, Math.round(result.distribution[value] ?? 0)),
      ]),
    ),
    totalVotes: Math.max(0, Math.round(result.totalVotes)),
  });
}

export function parseTempoBucketPayloads(
  raw: Record<string, string>,
  nowMs: number = Date.now(),
): readonly TempoBucketSnapshot[] {
  const cutoff = nowMs - TEMPO_WINDOW_MS;
  return Object.entries(raw)
    .map(([bucket, payload]) => {
      const bucketMs = Number.parseInt(bucket, 10);
      if (!Number.isFinite(bucketMs) || bucketMs < cutoff) {
        return null;
      }
      try {
        const parsed = JSON.parse(payload) as {
          distribution?: Record<string, number>;
          totalVotes?: number;
        };
        return {
          bucketMs,
          distribution: parsed.distribution ?? {},
          totalVotes: positiveNumber(parsed.totalVotes),
        };
      } catch {
        return null;
      }
    })
    .filter((snapshot): snapshot is TempoBucketSnapshot => snapshot !== null)
    .sort((a, b) => a.bucketMs - b.bucketMs);
}

export function calculateTempoTrend(input: CalculateTempoTrendInput): TempoTrend {
  const tempoVotes = Math.max(0, Math.round(input.totalVotes));
  const activeParticipants = Math.max(0, Math.round(input.activeParticipants), tempoVotes);
  const requiredVotes = Math.max(TEMPO_MIN_REQUIRED_VOTES, Math.ceil(activeParticipants * 0.1));

  if (tempoVotes < requiredVotes) {
    return {
      status: 'NEUTRAL',
      active: false,
      activeParticipants,
      tempoVotes,
      requiredVotes,
      windowSeconds: TEMPO_WINDOW_SECONDS,
      bucketSeconds: TEMPO_BUCKET_SECONDS,
    };
  }

  const snapshots = input.snapshots ?? [];
  const smoothedDistribution = averageTempoDistribution(input.distribution, snapshots);
  const smoothedStatus = deriveTempoStatus(smoothedDistribution, activeParticipants);
  const stableStatus = stableBucketStatus(snapshots, activeParticipants, requiredVotes);
  const status =
    stableStatus ??
    (hasClearTempoMargin(smoothedDistribution, activeParticipants, smoothedStatus)
      ? smoothedStatus
      : 'HETEROGENEOUS');

  return {
    status,
    active: true,
    activeParticipants,
    tempoVotes,
    requiredVotes,
    windowSeconds: TEMPO_WINDOW_SECONDS,
    bucketSeconds: TEMPO_BUCKET_SECONDS,
  };
}
