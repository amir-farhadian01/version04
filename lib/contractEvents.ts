import { ContractActionType, Prisma } from '@prisma/client';

export async function createContractEvent(
  tx: Prisma.TransactionClient,
  input: {
    contractId: string;
    versionId: string | null;
    actorId: string;
    actorRole: string;
    actionType: ContractActionType;
    note?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.contractEvent.create({
    data: {
      contractId: input.contractId,
      versionId: input.versionId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actionType: input.actionType,
      note: input.note ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
