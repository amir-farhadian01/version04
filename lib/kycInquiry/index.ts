/**
 * Inquiry providers for business KYC. Add real integrations here; swap is a single-file registry change.
 */

export type InquiryResultField = {
  success: boolean;
  raw: Record<string, unknown>;
  checkedAt: string;
  expiresAt?: string;
};

export type InquiryContext = {
  answers: Record<string, unknown>;
  payloadFieldIds: string[];
};

async function mockLicenseRegistry(ctx: InquiryContext): Promise<InquiryResultField> {
  const payload: Record<string, unknown> = {};
  for (const id of ctx.payloadFieldIds) {
    payload[id] = ctx.answers[id] ?? null;
  }
  const licenseExpiryRaw = ctx.answers.license_expiry ?? payload.license_expiry;
  let expiresAt: string | undefined;
  if (licenseExpiryRaw != null) {
    const d = new Date(String(licenseExpiryRaw));
    if (!Number.isNaN(d.getTime())) expiresAt = d.toISOString();
  }
  const checkedAt = new Date().toISOString();
  return {
    success: true,
    raw: {
      status: 'active',
      expiresAt: expiresAt ?? null,
      payload,
    },
    checkedAt,
    expiresAt,
  };
}

const providers: Record<string, (ctx: InquiryContext) => Promise<InquiryResultField>> = {
  'mock-license-registry': mockLicenseRegistry,
};

export async function runInquiryProvider(
  providerKey: string,
  ctx: InquiryContext,
): Promise<InquiryResultField> {
  const run = providers[providerKey];
  if (!run) {
    throw new Error(`Unknown inquiry provider: ${providerKey}`);
  }
  return run(ctx);
}
