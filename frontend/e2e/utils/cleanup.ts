import { APIRequestContext } from '@playwright/test'

/**
 * Cleanup utilities for E2E tests.
 * Each test should clean up created data in afterAll/afterEach hooks.
 */

const API_BASE = 'http://localhost:8080/api'

/**
 * Delete a test user by ID using a privileged auth token.
 * The token should be from the OWNER/ADMIN user.
 */
export async function deleteUserById(
  request: APIRequestContext,
  adminToken: string,
  userId: string,
): Promise<boolean> {
  try {
    const res = await request.delete(`${API_BASE}/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    return res.ok()
  } catch {
    return false
  }
}

/**
 * Delete an order by ID using an authenticated token.
 */
export async function deleteOrderById(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<boolean> {
  try {
    const res = await request.delete(`${API_BASE}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok()
  } catch {
    return false
  }
}

/**
 * Delete a test user by email (find first then delete).
 */
export async function deleteUserByEmail(
  request: APIRequestContext,
  adminToken: string,
  email: string,
): Promise<boolean> {
  try {
    // Find the user by listing admin users and filtering
    const res = await request.get(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      params: { search: email, page: 1, pageSize: 10 },
    })
    if (!res.ok()) return false

    const body = await res.json() as { items?: Array<{ id: string; email: string }> }
    const user = body.items?.find((u: { email: string }) => u.email === email)
    if (!user) return false

    return await deleteUserById(request, adminToken, user.id)
  } catch {
    return false
  }
}

/**
 * Reset a KYC status back to 'pending' for a user.
 */
export async function resetKycStatus(
  request: APIRequestContext,
  adminToken: string,
  userId: string,
): Promise<boolean> {
  try {
    const res = await request.patch(`${API_BASE}/admin/kyc/personal/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'pending', reviewedBy: null, notes: 'Reset by E2E test cleanup' },
    })
    return res.ok()
  } catch {
    return false
  }
}

/**
 * Clean up all test users matching a prefix.
 * Useful for cleaning up any leftover test users from previous runs.
 */
export async function cleanupTestUsersByPrefix(
  request: APIRequestContext,
  adminToken: string,
  prefix = 'e2e-test-',
): Promise<number> {
  let cleaned = 0
  try {
    const res = await request.get(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      params: { search: prefix, page: 1, pageSize: 50 },
    })
    if (!res.ok()) return 0

    const body = await res.json() as { items?: Array<{ id: string; email: string }> }
    const testUsers = body.items?.filter((u: { email: string }) => u.email.startsWith(prefix)) ?? []

    for (const user of testUsers) {
      const deleted = await deleteUserById(request, adminToken, user.id)
      if (deleted) cleaned++
    }
  } catch {
    // Best effort cleanup
  }
  return cleaned
}

export { API_BASE }