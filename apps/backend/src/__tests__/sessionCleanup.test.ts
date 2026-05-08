import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, platformStatisticMocks, loggerMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    quiz: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    bonusToken: {
      deleteMany: vi.fn(),
    },
  },
  platformStatisticMocks: {
    incrementCompletedSessionsTotal: vi.fn(),
  },
  loggerMocks: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/platformStatistic', () => ({
  incrementCompletedSessionsTotal: platformStatisticMocks.incrementCompletedSessionsTotal,
}));

vi.mock('../lib/logger', () => ({
  logger: loggerMocks,
}));

import { cleanupStaleSessions } from '../lib/sessionCleanup';

describe('sessionCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inkrementiert den completedSessionsCounter fuer automatisch beendete verwaiste Sessions', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 3 });

    const result = await cleanupStaleSessions();

    expect(result).toBe(3);
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith(3);
  });

  it('inkrementiert den completedSessionsCounter nicht, wenn keine Session beendet wurde', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 });

    const result = await cleanupStaleSessions();

    expect(result).toBe(0);
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).not.toHaveBeenCalled();
  });
});
