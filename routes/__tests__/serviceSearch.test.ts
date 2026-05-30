import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { router as serviceSearchRoutes } from '../serviceSearch.js';

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/api/services/search', serviceSearchRoutes);

describe('GET /api/services/search', () => {
  // Test 1: Valid search with at least 2 chars
  it('returns 200 with services and packages for valid query (q=hair)', async () => {
    const res = await request(app).get('/api/services/search').query({ q: 'hair' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.services).toBeDefined();
    expect(Array.isArray(res.body.data.services)).toBe(true);
    expect(res.body.data.packages).toBeDefined();
    expect(Array.isArray(res.body.data.packages)).toBe(true);
    expect(typeof res.body.data.totalServices).toBe('number');
    expect(typeof res.body.data.totalPackages).toBe('number');
    expect(res.body.data.page).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.data.pageSize).toBe('number');
  });

  // Test 2: No results for nonsense query
  it('returns 200 with empty results for nonsense query (q=xxxyyyzzz123)', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'xxxyyyzzz123' });
    expect(res.status).toBe(200);
    expect(res.body.data.services).toHaveLength(0);
    expect(res.body.data.packages).toHaveLength(0);
    expect(res.body.data.totalServices).toBe(0);
    expect(res.body.data.totalPackages).toBe(0);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBeGreaterThan(0);
  });

  // Test 3: Query too short (min 2 chars required)
  it('returns 400 for query shorter than 2 characters', async () => {
    const res = await request(app).get('/api/services/search').query({ q: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain('at least 2 characters');
  });

  // Test 4: Missing query entirely
  it('returns 400 for missing q parameter', async () => {
    const res = await request(app).get('/api/services/search');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // Test 5: Pagination parameters work
  it('returns paginated results with limit and offset', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'at', limit: 5, offset: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.services.length).toBeLessThanOrEqual(5);
    expect(res.body.data.packages.length).toBeLessThanOrEqual(5);
    expect(res.body.data.pageSize).toBe(5);
    expect(res.body.data.page).toBe(1);
  });

  // Test 6: limit > 50 is rejected by Zod schema validation
  it('rejects limit greater than max 50 via Zod schema', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'at', limit: 100, offset: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // Test 7: XSS sanitization — malicious script tag should not break
  it('returns 200 for XSS script tag query without breaking', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: '<script>alert("xss")</script>' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // The query may match nothing, but should not error
    expect(res.body.data.services).toBeDefined();
    expect(res.body.data.packages).toBeDefined();
  });

  // Test 8: SQL injection attempt should not break
  it('returns 200 for SQL injection attempt without breaking', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: "' OR 1=1 --" });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.services)).toBe(true);
  });

  // Test 9: Service result shape validation
  it('returns services with correct shape', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'hair', limit: 1 });
    expect(res.status).toBe(200);
    if (res.body.data.services.length > 0) {
      const service = res.body.data.services[0];
      expect(service).toHaveProperty('id');
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('description');
      expect(service).toHaveProperty('categoryId');
      expect(service).toHaveProperty('categoryName');
      expect(service).toHaveProperty('breadcrumb');
      expect(service).toHaveProperty('thumbnailUrl');
      expect(service).toHaveProperty('businessId');
      expect(service).toHaveProperty('businessName');
      expect(service).toHaveProperty('businessAvatarUrl');
      expect(service).toHaveProperty('bookingMode');
      expect(service).toHaveProperty('startingPrice');
      expect(service).toHaveProperty('rating');
      expect(service).toHaveProperty('location');
      expect(Array.isArray(service.breadcrumb)).toBe(true);
    }
  });

  // Test 10: Package result shape validation
  it('returns packages with correct shape', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'basic', limit: 1 });
    expect(res.status).toBe(200);
    if (res.body.data.packages.length > 0) {
      const pkg = res.body.data.packages[0];
      expect(pkg).toHaveProperty('id');
      expect(pkg).toHaveProperty('name');
      expect(pkg).toHaveProperty('description');
      expect(pkg).toHaveProperty('serviceId');
      expect(pkg).toHaveProperty('serviceName');
      expect(pkg).toHaveProperty('businessId');
      expect(pkg).toHaveProperty('businessName');
      expect(pkg).toHaveProperty('price');
      expect(pkg).toHaveProperty('bookingMode');
      expect(pkg).toHaveProperty('duration');
      expect(typeof pkg.price).toBe('number');
    }
  });

  // Test 11: Query with special characters handled gracefully
  it('handles special characters in query', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'painting & cleaning' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.services)).toBe(true);
  });

  // Test 12: Empty string after trim should fail validation
  it('returns 400 for whitespace-only query', async () => {
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // Test 13: Fast response time
  it('responds within 2000ms (performance check)', async () => {
    const start = Date.now();
    const res = await request(app)
      .get('/api/services/search')
      .query({ q: 'test', limit: 5 });
    const duration = Date.now() - start;
    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(2000);
  });
});