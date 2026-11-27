import api from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

export interface OrderDraft {
  categoryId?: string;
  categoryName?: string;
  serviceCatalogId?: string;
  serviceId?: string;
  serviceName?: string;
  packageId?: string;
  packageName?: string;
  businessId?: string;
  description?: string;
  photoUrls?: string[];
  address?: string;
  scheduledDate?: string;
  urgency?: 'normal' | 'high';
  budgetCents?: number;
  /** Server-side draft order id once the draft has been persisted via POST /orders/draft */
  orderId?: string;
  step: number;
  updatedAt: string;
}

const DRAFT_KEY = 'orderDraft';
const AUTOSAVE_INTERVAL_MS = 30_000;

export function loadDraft(): OrderDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OrderDraft;
    // Expire drafts older than 7 days
    const age = Date.now() - new Date(draft.updatedAt).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    clearDraft();
    return null;
  }
}

export function saveDraftLocally(draft: OrderDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Draft keys that are wizard metadata, not questionnaire answers. */
const RESERVED_ANSWER_KEYS = new Set([
  'categoryId',
  'categoryName',
  'serviceCatalogId',
  'serviceId',
  'serviceName',
  'packageId',
  'packageName',
  'businessId',
  'description',
  'photoUrls',
  'address',
  'scheduledDate',
  'urgency',
  'budgetCents',
  'orderId',
  'step',
  'updatedAt',
]);

/**
 * DetailsStep stores questionnaire answers under their schema field ids as
 * top-level draft keys; extract them for the backend `answers` record.
 */
export function extractAnswers(draft: OrderDraft): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (RESERVED_ANSWER_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * Photo uploads are stored as bare URL strings in the draft; the backend
 * expects `{ url, fileName, mimeType, sizeBytes, fieldId? }` objects. When
 * the service schema has exactly one photo field the backend assigns its
 * fieldId; for zero or multiple photo fields the submit flow maps (or drops)
 * photos explicitly via `applyPhotoFieldMapping`.
 */
export interface OrderPhotoRow {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fieldId?: string;
}

export function extractPhotos(draft: OrderDraft): OrderPhotoRow[] {
  return (draft.photoUrls ?? [])
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .map((url) => ({ url, fileName: '', mimeType: 'image/jpeg', sizeBytes: 0 }));
}

/**
 * Budget input (dollars, e.g. "55" or "55.5") → integer cents for
 * `Order.budget`. Mirrors the historical wizard logic: NaN, negative and
 * empty inputs yield `undefined` (no budget sent); values round to the
 * nearest cent (55.5 → 5550).
 */
export function parseBudgetDollars(input: string | number | null | undefined): number | undefined {
  const parsed = typeof input === 'number' ? input : parseFloat(input ?? '');
  if (Number.isNaN(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

/** Returns the first `photo` field id of a questionnaire, or null when it has none. */
export function resolvePhotoFieldId(
  fields: Array<{ id?: string; type?: string }> | null | undefined,
): string | null {
  const photoField = (fields ?? []).find((f) => f && f.type === 'photo' && typeof f.id === 'string');
  return photoField ? (photoField.id as string) : null;
}

/**
 * Backend rule (lib/orderPhotosForValidate.ts): when the questionnaire has
 * exactly one photo field, fieldId may be omitted; otherwise every photo
 * needs an explicit fieldId, and photos are not accepted at all when the
 * schema declares no photo field. `null` fieldId therefore drops the photos.
 */
export function applyPhotoFieldMapping(
  photos: OrderPhotoRow[],
  photoFieldId: string | null,
): OrderPhotoRow[] {
  if (!photoFieldId) return [];
  return photos.map((p) => ({ ...p, fieldId: photoFieldId }));
}

export async function saveDraftToApi(draft: OrderDraft): Promise<string | null> {
  const token = useAuthStore.getState().token;
  if (!token) return null; // skip API save for unauthenticated users

  const serviceCatalogId = draft.serviceCatalogId ?? draft.serviceId;
  if (!serviceCatalogId) return null; // backend draft endpoints require a concrete service type

  try {
    const fields: Record<string, unknown> = {
      description: draft.description || undefined,
      address: draft.address || undefined,
      scheduledAt: draft.scheduledDate || undefined,
      photos: extractPhotos(draft),
      answers: extractAnswers(draft),
    };
    if (draft.budgetCents && draft.budgetCents > 0) fields.budget = draft.budgetCents;

    if (draft.orderId) {
      const res = await api.put<{ id?: string }>(`/orders/draft/${draft.orderId}`, fields);
      return res.data?.id ?? draft.orderId;
    }

    const res = await api.post<{ id?: string }>('/orders/draft', {
      serviceCatalogId,
      entryPoint: draft.packageId || draft.businessId ? 'direct' : 'wizard',
      prefill: fields,
    });
    return res.data?.id ?? null;
  } catch {
    // API save failure is non-blocking for draft auto-save
    return null;
  }
}

export function startAutoSave(
  getDraft: () => OrderDraft,
  onSaved: (orderId: string | null) => void,
): () => void {
  const interval = setInterval(() => {
    const draft = getDraft();
    draft.updatedAt = new Date().toISOString();
    saveDraftLocally(draft);
    saveDraftToApi(draft).then(onSaved).catch(() => {});
  }, AUTOSAVE_INTERVAL_MS);

  return () => clearInterval(interval);
}