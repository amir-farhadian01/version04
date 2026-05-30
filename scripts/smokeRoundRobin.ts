/**
 * Sprint J — round-robin smoke (backend API only).
 *
 * Required for a full run:
 *   API_BASE (default http://localhost:8080)
 *   SERVICE_CATALOG_ID — negotiation-capable catalog with ≥2 eligible provider packages
 *   Auth: CUSTOMER_TOKEN (Bearer) OR CUSTOMER_EMAIL + CUSTOMER_PASSWORD
 *   PROVIDER_TOKENS — comma-separated customer/provider JWTs (each user must see their invite in workspace inbox)
 *   ADMIN_TOKEN — optional; for GET /api/admin/orders/:id/round-robin-state
 *
 * Optional:
 *   DRAFT_PREFILL_JSON — JSON string merged into POST /api/orders/draft body.prefill (answers, photos, etc.)
 *   SUBMIT_BODY_JSON — JSON string for POST /api/orders/draft/:id/submit body
 *
 * Exits 0 after printing responses; exits 1 only on unexpected throws.
 * Missing tokens / 4xx responses are printed — script does not hard-fail the repo.
 */
import 'dotenv/config';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:8080').replace(/\/$/, '');
const SERVICE_CATALOG_ID = process.env.SERVICE_CATALOG_ID ?? '';

async function api(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<{ status: number; json: unknown; text: string }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json, text };
}

async function customerToken(): Promise<string | null> {
  const t = process.env.CUSTOMER_TOKEN?.trim();
  if (t) return t;
  const email = process.env.CUSTOMER_EMAIL?.trim();
  const password = process.env.CUSTOMER_PASSWORD?.trim();
  if (!email || !password) {
    console.log('Skip auth: set CUSTOMER_TOKEN or CUSTOMER_EMAIL + CUSTOMER_PASSWORD');
    return null;
  }
  const { status, json } = await api('POST', '/api/auth/login', null, { email, password });
  console.log('POST /api/auth/login', status, JSON.stringify(json, null, 2));
  if (status !== 200 || !json || typeof json !== 'object') return null;
  const tok = (json as Record<string, unknown>).accessToken;
  return typeof tok === 'string' ? tok : null;
}

function mergePrefill(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    address: '100 Smoke Test Street, Testville',
    description: 'Smoke test job description with enough characters for validation rules.',
    scheduleFlexibility: 'asap',
    locationLat: 43.6532,
    locationLng: -79.3832,
    answers: {},
  };
  const raw = process.env.DRAFT_PREFILL_JSON?.trim();
  if (!raw) return base;
  try {
    const extra = JSON.parse(raw) as Record<string, unknown>;
    return { ...base, ...extra };
  } catch {
    console.warn('DRAFT_PREFILL_JSON parse failed, using defaults');
    return base;
  }
}

async function main(): Promise<void> {
  console.log('API_BASE', API_BASE);
  if (!SERVICE_CATALOG_ID) {
    console.log('Set SERVICE_CATALOG_ID to a negotiation catalog id.');
    return;
  }

  const token = await customerToken();
  if (!token) return;

  const prefill = mergePrefill();
  const draftRes = await api('POST', '/api/orders/draft', token, {
    serviceCatalogId: SERVICE_CATALOG_ID,
    entryPoint: 'direct',
    prefill,
  });
  console.log('POST /api/orders/draft', draftRes.status, JSON.stringify(draftRes.json, null, 2));
  if (draftRes.status !== 201 && draftRes.status !== 200) return;
  const draftId =
    draftRes.json && typeof draftRes.json === 'object' && 'id' in draftRes.json
      ? String((draftRes.json as Record<string, unknown>).id)
      : '';
  if (!draftId) return;

  let submitBody: Record<string, unknown> = {};
  const sb = process.env.SUBMIT_BODY_JSON?.trim();
  if (sb) {
    try {
      submitBody = JSON.parse(sb) as Record<string, unknown>;
    } catch {
      console.warn('SUBMIT_BODY_JSON invalid');
    }
  }

  const submitRes = await api('POST', `/api/orders/draft/${draftId}/submit`, token, submitBody);
  console.log('POST /api/orders/draft/.../submit', submitRes.status, JSON.stringify(submitRes.json, null, 2));
  const orderId =
    submitRes.json && typeof submitRes.json === 'object' && 'id' in submitRes.json
      ? String((submitRes.json as Record<string, unknown>).id)
      : '';
  if (!orderId) return;

  const matchOutcome =
    submitRes.json && typeof submitRes.json === 'object' && 'matchOutcome' in submitRes.json
      ? (submitRes.json as Record<string, unknown>).matchOutcome
      : null;
  console.log('matchOutcome', JSON.stringify(matchOutcome, null, 2));

  const providerTokens = (process.env.PROVIDER_TOKENS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = 0; i < providerTokens.length; i++) {
    const pt = providerTokens[i];
    const me = await api('GET', '/api/workspaces/me', pt, undefined);
    console.log(`Provider[${i}] GET /api/workspaces/me`, me.status);
    const workspaces = Array.isArray(me.json) ? me.json : [];
    const wsId =
      workspaces[0] &&
      typeof workspaces[0] === 'object' &&
      workspaces[0] != null &&
      'id' in workspaces[0]
        ? String((workspaces[0] as Record<string, unknown>).id)
        : '';
    if (!wsId) continue;
    const inbox = await api('GET', `/api/workspaces/${wsId}/inbox-attempts?segment=awaiting`, pt, undefined);
    console.log(`Provider[${i}] inbox`, inbox.status);
    const items =
      inbox.json && typeof inbox.json === 'object' && 'items' in inbox.json
        ? (inbox.json as Record<string, unknown>).items
        : [];
    const row =
      Array.isArray(items) &&
      items.find(
        (x) =>
          x &&
          typeof x === 'object' &&
          (x as Record<string, unknown>).order &&
          typeof (x as Record<string, unknown>).order === 'object' &&
          ((x as Record<string, unknown>).order as Record<string, unknown>).id === orderId,
      );
    if (!row || typeof row !== 'object') continue;
    const attemptId = String((row as Record<string, unknown>).id);
    const action = i === 0 ? 'acknowledge' : 'decline';
    if (action === 'acknowledge') {
      const acc = await api('POST', `/api/workspaces/${wsId}/inbox/${attemptId}/acknowledge`, pt, {});
      console.log(`Provider[${i}] acknowledge`, acc.status, JSON.stringify(acc.json, null, 2));
    } else {
      const dec = await api('POST', `/api/workspaces/${wsId}/inbox/${attemptId}/decline`, pt, {
        reason: 'busy next 2 days for smoke decline path',
      });
      console.log(`Provider[${i}] decline`, dec.status, JSON.stringify(dec.json, null, 2));
    }
  }

  const cand = await api('GET', `/api/orders/${orderId}/candidates`, token, undefined);
  console.log('GET /api/orders/.../candidates', cand.status, JSON.stringify(cand.json, null, 2));
  const candidates =
    cand.json && typeof cand.json === 'object' && 'candidates' in cand.json
      ? (cand.json as Record<string, unknown>).candidates
      : [];
  const first =
    Array.isArray(candidates) && candidates[0] && typeof candidates[0] === 'object'
      ? (candidates[0] as Record<string, unknown>)
      : null;
  const pickAttempt = first && typeof first.attemptId === 'string' ? first.attemptId : '';
  if (pickAttempt) {
    const sel = await api('POST', `/api/orders/${orderId}/select-provider`, token, {
      attemptId: pickAttempt,
      savePriorityTemplate: true,
      priorityTemplate: {
        weights: { distance: 1, rating: 5, price: 0.01 },
      },
    });
    console.log('POST select-provider', sel.status, JSON.stringify(sel.json, null, 2));
  }

  const adminTok = process.env.ADMIN_TOKEN?.trim();
  if (adminTok) {
    const st = await api('GET', `/api/admin/orders/${orderId}/round-robin-state`, adminTok, undefined);
    console.log('GET round-robin-state', st.status, JSON.stringify(st.json, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
