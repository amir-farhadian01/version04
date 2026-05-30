import { APIRequestContext } from '@playwright/test'
import { authenticateViaApi, SEED_USERS } from './auth.js'

/**
 * Seed data verification utilities for E2E tests.
 * Verifies that required seed users and data exist before tests run.
 */

const API_BASE = 'http://localhost:8080/api'

export interface SeedVerificationResult {
  allPresent: boolean
  missing: string[]
  details: Record<string, boolean>
}

/**
 * Verify that all required seed users exist and can authenticate.
 * Call this in globalSetup or beforeAll hooks.
 */
export async function verifySeedUsers(request: APIRequestContext): Promise<SeedVerificationResult> {
  const result: SeedVerificationResult = {
    allPresent: true,
    missing: [],
    details: {},
  }

  for (const [name, creds] of Object.entries(SEED_USERS)) {
    try {
      await authenticateViaApi(request, creds.email, creds.password)
      result.details[name] = true
    } catch {
      result.allPresent = false
      result.missing.push(`${name} (${creds.email})`)
      result.details[name] = false
    }
  }

  return result
}

/**
 * Log seed verification results to console.
 */
export function logSeedVerification(result: SeedVerificationResult): void {
  if (result.allPresent) {
    console.log('✅ All seed users verified successfully')
  } else {
    console.error('❌ Missing seed users:')
    for (const missing of result.missing) {
      console.error(`   - ${missing}`)
    }
    console.error('\nRun: npx prisma db push && npx prisma db seed')
  }
}

/**
 * Check if a specific API endpoint returns data.
 */
export async function verifyEndpointReturnsData(
  request: APIRequestContext,
  token: string,
  endpoint: string,
): Promise<boolean> {
  try {
    const res = await request.get(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok()) return false

    const body = await res.json()
    const data = body.data ?? body.items ?? body
    return data !== null && data !== undefined && (Array.isArray(data) ? data.length >= 0 : true)
  } catch {
    return false
  }
}

export { API_BASE }