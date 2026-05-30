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

export async function saveDraftToApi(draft: OrderDraft): Promise<string | null> {
  const token = useAuthStore.getState().token;
  if (!token) return null; // skip API save for unauthenticated users

  try {
    const payload: Record<string, unknown> = {
      status: 'draft',
      categoryId: draft.categoryId,
      serviceCatalogId: draft.serviceCatalogId,
      description: draft.description,
      scheduledDate: draft.scheduledDate,
      urgency: draft.urgency,
    };
    if (draft.address) {
      payload.address = draft.address;
    }
    if (draft.budgetCents && draft.budgetCents > 0) {
      payload.budgetCents = draft.budgetCents;
    }
    const res = await api.post('/orders', payload);
    return (res.data?.data?.id as string) ?? null;
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