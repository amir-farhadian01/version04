import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { withSerializableRetry } from './transactions.js';

function conflict() {
  return new Prisma.PrismaClientKnownRequestError('serialization conflict', {
    code: 'P2034', clientVersion: Prisma.prismaVersion.client,
  });
}

describe('serializable transaction retries', () => {
  it('retries P2034 at most three times and returns the winning result', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce('won');
    const db = {
      $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>, options: unknown) => callback({ options })),
    } as unknown as PrismaClient;
    await expect(withSerializableRetry(db, operation)).resolves.toBe('won');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('does not retry a non-conflict error', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('validation failed'));
    const db = { $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback({})) } as unknown as PrismaClient;
    await expect(withSerializableRetry(db, operation)).rejects.toThrow('validation failed');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
