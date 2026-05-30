/**
 * P1.1 — API Integration Tests
 * Run: npx tsx scripts/p1.1-api-test.ts
 */
const BASE = 'http://localhost:8080/api';
let passed = 0;
let failed = 0;

function assert(desc: string, ok: boolean, detail: string = '') {
  if (ok) { passed++; console.log(`✅ ${desc} ${detail}`); }
  else { failed++; console.log(`❌ ${desc} ${detail}`); }
}

async function post(path: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { headers });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

async function put(path: string, body: Record<string, unknown>, token: string) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

async function main() {
  console.log('=== P1.1 API TEST SUITE ===\n');

  // Test 1: Health check
  const h = await get('/health');
  assert('1. Health check', h.status === 200 && h.data.status === 'ok');

  // Test 2: Invalid login
  const badLogin = await post('/auth/login', { login: 'bad@b.com', password: 'x' });
  assert('2. Invalid login → error', badLogin.status >= 400 && badLogin.status < 500, `HTTP ${badLogin.status}`);

  // Test 3: GET /services without auth
  const noAuth = await get('/services');
  assert('3. GET /services no auth → 401', noAuth.status === 401, `HTTP ${noAuth.status}`);

  // Register test user
  const ts = Date.now();
  const reg = await post('/auth/register', {
    email: `test${ts}@t.com`,
    password: 'Test123!',
    login: `test${ts}@t.com`,
    displayName: `Test ${ts}`,
  });
  const token = typeof reg.data === 'object' && reg.data ? (reg.data as Record<string, unknown>).accessToken as string : '';
  assert('REGISTER', typeof token === 'string' && token.length > 10, token ? 'got token' : 'FAILED');
  if (!token) { console.log(`\n${passed} passed, ${failed} failed\n`); process.exit(1); }

  // Test 4: GET /services with auth
  const svc = await get('/services', token);
  const count = typeof svc.data === 'object' && svc.data && 'data' in (svc.data as object) ? ((svc.data as Record<string, unknown>).data as unknown[])?.length : -1;
  assert('4. GET /services with auth', svc.status === 200, `HTTP ${svc.status}, items: ${count}`);

  // Test 5: CREATE service (5000 cents)
  const create = await post('/services', {
    title: 'P1.1 API Test Service',
    category: 'test',
    price: 5000,
    description: 'Integration test',
  }, token);
  const createData = typeof create.data === 'object' && create.data && 'data' in (create.data as object)
    ? ((create.data as Record<string, unknown>).data as Record<string, unknown>)
    : (create.data as Record<string, unknown>) ?? {};
  const sid = createData.id as string || '';
  const price = (createData.price as number) || 0;
  assert('5. CREATE service (5000 cents)', (create.status >= 200 && create.status < 300) && !!sid && price === 5000, `HTTP ${create.status}, id=${sid?.substring(0,12)}, price=${price}`);
  if (!sid) { console.log(`\n${passed} passed, ${failed} failed\n`); process.exit(1); }

  // Test 6: UPDATE service (7500 cents)
  const update = await put(`/services/${sid}`, { title: 'Updated P1.1', price: 7500 }, token);
  const updData = typeof update.data === 'object' && update.data && 'data' in (update.data as object)
    ? ((update.data as Record<string, unknown>).data as Record<string, unknown>)
    : (update.data as Record<string, unknown>) ?? {};
  const newPrice = (updData.price as number) || 0;
  assert('6. UPDATE service (7500 cents)', newPrice === 7500, `price=${newPrice}`);

  // Test 7: ARCHIVE (soft-delete)
  const archive = await post(`/services/${sid}/archive`, {}, token);
  const archData = typeof archive.data === 'object' && archive.data && 'data' in (archive.data as object)
    ? ((archive.data as Record<string, unknown>).data as Record<string, unknown>)
    : (archive.data as Record<string, unknown>) ?? {};
  const archived = archData.archived === true;
  assert('7. ARCHIVE (soft-delete)', archived === true, `archived=${archived}`);

  // Test 8: UNARCHIVE
  const unarchive = await post(`/services/${sid}/unarchive`, {}, token);
  const unArchData = typeof unarchive.data === 'object' && unarchive.data && 'data' in (unarchive.data as object)
    ? ((unarchive.data as Record<string, unknown>).data as Record<string, unknown>)
    : (unarchive.data as Record<string, unknown>) ?? {};
  const unarchived = unArchData.archived === false || unArchData.archived === null || unArchData.archived === undefined;
  assert('8. UNARCHIVE', unarchived, `archived=${unArchData.archived}`);

  // Test 9: Zod validation
  const val = await post('/services', { title: '', price: -100 }, token);
  const valData = typeof val.data === 'object' && val.data ? (val.data as Record<string, unknown>) : {};
  const code = valData.code as string || '';
  assert('9. Zod validation (empty title)', code === 'VALIDATION_ERROR', `code=${code}, msg=${valData.message}`);

  console.log(`\n========================================`);
  console.log(` RESULTS: ${passed}/9 passed, ${failed}/9 failed`);
  console.log(`========================================`);
  if (failed === 0) console.log('✅ ALL 9 TESTS PASSED — P1.1 APPROVED');
  else { console.log('❌ TESTS FAILED'); process.exit(1); }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });