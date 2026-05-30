import prisma from './db.js';
import type { ServiceQuestionnaireV1 } from './serviceDefinitionTypes.js';
import { isServiceQuestionnaireV1 } from './serviceDefinitionTypes.js';
import { minimalFallbackQuestionnaire } from './wizardFallbackQuestionnaire.js';

type OrderTraceShape = {
  id: string;
  jobRecord?: { id: string } | null;
};

/**
 * Attach canonical analytics aliases for the offer -> order -> job chain.
 */
export function withOrderTraceIds<T extends Record<string, unknown>>(
  snapshot: T,
  order: OrderTraceShape,
): T & { offerId: string; orderId: string; jobId: string | null } {
  return {
    ...snapshot,
    offerId: order.id,
    orderId: order.id,
    jobId: order.jobRecord?.id ?? null,
  };
}

/**
 * Canonical F0 questionnaire JSON to store on the order at submit time.
 * Missing or invalid catalog JSON falls back to a minimal questionnaire so
 * customers can still submit (admin can attach a full schema later).
 */
export async function snapshotSchemaForOrder(
  serviceCatalogId: string,
): Promise<ServiceQuestionnaireV1> {
  const cat = await prisma.serviceCatalog.findUnique({
    where: { id: serviceCatalogId },
    select: { dynamicFieldsSchema: true, isActive: true },
  });
  if (!cat?.isActive) {
    throw new Error('Service catalog not found or inactive');
  }
  const raw = cat.dynamicFieldsSchema;
  if (raw == null || !isServiceQuestionnaireV1(raw)) {
    return minimalFallbackQuestionnaire();
  }
  return raw;
}
