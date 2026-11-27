import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPhotoFieldMapping,
  clearDraft,
  extractAnswers,
  extractPhotos,
  loadDraft,
  parseBudgetDollars,
  resolvePhotoFieldId,
  saveDraftLocally,
  saveDraftToApi,
  startAutoSave,
  type OrderDraft,
} from './orderDraft.js';
import { useAuthStore } from '../store/authStore.js';

vi.mock('../lib/api.js', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
  },
}));

import api from '../lib/api.js';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

function makeDraft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    step: 4,
    updatedAt: new Date().toISOString(),
    serviceCatalogId: 'catalog_1',
    description: 'Interior painting for a two-bedroom apartment.',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useAuthStore.setState({ token: 'test-token' } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseBudgetDollars — dollar→cents conversion', () => {
  it('converts whole dollars to cents (55 → 5500)', () => {
    expect(parseBudgetDollars('55')).toBe(5500);
  });

  it('rounds fractional dollars to the nearest cent (55.5 → 5550)', () => {
    expect(parseBudgetDollars('55.5')).toBe(5550);
  });

  it('rejects negative, non-numeric and empty input (no budget sent)', () => {
    expect(parseBudgetDollars('-1')).toBeUndefined();
    expect(parseBudgetDollars('abc')).toBeUndefined();
    expect(parseBudgetDollars('')).toBeUndefined();
    expect(parseBudgetDollars(undefined)).toBeUndefined();
  });
});

describe('draft build/update — server draft creation and orderId preservation', () => {
  it('creates a server draft with POST /orders/draft when no orderId exists yet', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'draft_1' } });
    const draft = makeDraft({ budgetCents: 5500 });

    const id = await saveDraftToApi(draft);

    expect(id).toBe('draft_1');
    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/orders/draft',
      expect.objectContaining({ serviceCatalogId: 'catalog_1', entryPoint: 'wizard' }),
    );
    // budget travels as cents on the wire
    const payload = mockedApi.post.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.prefill).toEqual(expect.objectContaining({ budget: 5500 }));
  });

  it('updates the SAME draft via PUT when orderId is already set (no duplicate drafts)', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'draft_1' } });
    const draft = makeDraft({ orderId: 'draft_1' });

    const id = await saveDraftToApi(draft);

    expect(id).toBe('draft_1');
    expect(mockedApi.put).toHaveBeenCalledWith('/orders/draft/draft_1', expect.anything());
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});

describe('orderId kept across autosaves', () => {
  it('autosave PUTs the existing draft and reports its id back', async () => {
    vi.useFakeTimers();
    mockedApi.put.mockResolvedValue({ data: { id: 'draft_1' } });
    const draft = makeDraft({ orderId: 'draft_1' });
    saveDraftLocally(draft);

    const onSaved = vi.fn();
    const stop = startAutoSave(() => loadDraft() ?? draft, onSaved);

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    stop();

    expect(mockedApi.put).toHaveBeenCalledTimes(2);
    expect(mockedApi.put.mock.calls.every((c) => c[0] === '/orders/draft/draft_1')).toBe(true);
    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith('draft_1');
  });
});

describe('save failure must not submit or redirect', () => {
  it('returns null (caller shows an error) when the draft API fails — no throw, no navigation', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('network down'));
    const before = window.location.href;

    const id = await saveDraftToApi(makeDraft());

    expect(id).toBeNull();
    expect(window.location.href).toBe(before);
  });

  it('returns null for unauthenticated users without touching the API', async () => {
    useAuthStore.setState({ token: null } as never);
    const id = await saveDraftToApi(makeDraft());
    expect(id).toBeNull();
    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(mockedApi.put).not.toHaveBeenCalled();
  });
});

describe('photo mapping to questionnaire photo fields', () => {
  it('maps photos to the single declared photo field', () => {
    const rows = extractPhotos(makeDraft({ photoUrls: ['/uploads/a.png'] }));
    expect(applyPhotoFieldMapping(rows, 'project_photos')).toEqual([
      { url: '/uploads/a.png', fileName: '', mimeType: 'image/jpeg', sizeBytes: 0, fieldId: 'project_photos' },
    ]);
  });

  it('resolves the first photo field when several are declared', () => {
    expect(
      resolvePhotoFieldId([{ id: 'before', type: 'photo' }, { id: 'after', type: 'photo' }]),
    ).toBe('before');
  });

  it('returns null when the questionnaire has no photo field', () => {
    expect(resolvePhotoFieldId([{ id: 'room_type', type: 'select' }])).toBeNull();
    expect(resolvePhotoFieldId(null)).toBeNull();
  });

  it('drops photos entirely when the questionnaire declares no photo field', () => {
    const rows = extractPhotos(makeDraft({ photoUrls: ['/uploads/a.png', '/uploads/b.png'] }));
    expect(applyPhotoFieldMapping(rows, null)).toEqual([]);
  });
});

describe('draft local persistence', () => {
  it('round-trips saveDraftLocally → loadDraft and clearDraft removes it', () => {
    const draft = makeDraft({ orderId: 'draft_1' });
    saveDraftLocally(draft);
    expect(loadDraft()).toEqual(expect.objectContaining({ orderId: 'draft_1', step: 4 }));
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});

describe('answers extraction', () => {
  it('collects questionnaire answers by field id and excludes wizard metadata', () => {
    const draft = {
      ...makeDraft({ categoryId: 'cat_1', description: 'paint it', budgetCents: 5500 }),
      room_type: 'multiple',
      square_footage: '850',
    } as OrderDraft;
    expect(extractAnswers(draft)).toEqual({ room_type: 'multiple', square_footage: '850' });
  });
});
