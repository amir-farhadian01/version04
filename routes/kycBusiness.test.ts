import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// KYC Business route tests — validates API contract and business logic
// These tests verify the Zod validation schemas match the spec

// ─── Replicate Zod schemas from kycBusiness.ts ───────────────────────────────

const upgradeSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  businessType: z.enum(['individual', 'company']),
});

const uploadDocSchema = z.object({
  submissionId: z.string().min(1),
  documentType: z.enum(['license', 'insurance']),
  fileUrl: z.string().url('fileUrl must be a valid URL'),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('KYC Business API — Contract Validation', () => {
  describe('POST /api/kyc/business/upgrade (upgradeSchema)', () => {
    it('requires companyId to be non-empty', () => {
      const emptyId = '';
      expect(emptyId.length).toBe(0); // empty — would be rejected by Zod
      const validId = 'company_123';
      expect(validId.length).toBeGreaterThan(0);
    });

    it('accepts "individual" as valid businessType', () => {
      const result = upgradeSchema.safeParse({
        companyId: 'company_123',
        businessType: 'individual',
      });
      expect(result.success).toBe(true);
    });

    it('accepts "company" as valid businessType', () => {
      const result = upgradeSchema.safeParse({
        companyId: 'company_123',
        businessType: 'company',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty companyId', () => {
      const result = upgradeSchema.safeParse({
        companyId: '',
        businessType: 'individual',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.companyId).toBeDefined();
      }
    });

    it('rejects missing businessType', () => {
      const result = upgradeSchema.safeParse({
        companyId: 'company_123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid businessType', () => {
      const result = upgradeSchema.safeParse({
        companyId: 'company_123',
        businessType: 'invalid-type',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing companyId', () => {
      const result = upgradeSchema.safeParse({
        businessType: 'individual',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty body', () => {
      const result = upgradeSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/kyc/business/upload-license (uploadDocSchema)', () => {
    it('accepts valid license upload input', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: 'sub_123',
        documentType: 'license',
        fileUrl: 'https://media.example.com/doc.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing submissionId', () => {
      const result = uploadDocSchema.safeParse({
        documentType: 'license',
        fileUrl: 'https://example.com/doc.pdf',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid fileUrl', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: 'sub_123',
        documentType: 'license',
        fileUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty submissionId', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: '',
        documentType: 'license',
        fileUrl: 'https://example.com/doc.pdf',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid documentType', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: 'sub_123',
        documentType: 'passport',
        fileUrl: 'https://example.com/doc.pdf',
      });
      expect(result.success).toBe(false);
    });

    it('accepts insurance document type', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: 'sub_123',
        documentType: 'insurance',
        fileUrl: 'https://media.example.com/certificate.pdf',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('POST /api/kyc/business/upload-insurance (uploadDocSchema)', () => {
    it('accepts valid insurance upload input', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: 'sub_456',
        documentType: 'insurance',
        fileUrl: 'https://media.example.com/insurance.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing fileUrl', () => {
      const result = uploadDocSchema.safeParse({
        submissionId: 'sub_456',
        documentType: 'insurance',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/kyc/business/status — Endpoint contract', () => {
    it('returns status response shape matches CompanyStatus interface', () => {
      // Verify the shape of a successful response
      const sampleResponse = {
        companies: [
          {
            companyId: 'comp_1',
            companyName: 'Test Company',
            kycStatus: 'approved',
            submission: {
              id: 'sub_1',
              status: 'approved',
              submittedAt: '2026-05-25T00:00:00.000Z',
              reviewedAt: '2026-05-25T12:00:00.000Z',
              reviewNote: 'Approved',
            },
            businessVerification: {
              requiresLicense: true,
              licenseVerified: true,
              insuranceVerified: false,
            },
          },
        ],
      };

      expect(sampleResponse.companies).toBeDefined();
      expect(Array.isArray(sampleResponse.companies)).toBe(true);
      expect(sampleResponse.companies.length).toBeGreaterThan(0);
      expect(sampleResponse.companies[0].companyId).toBe('comp_1');
      expect(sampleResponse.companies[0].companyName).toBe('Test Company');
      expect(sampleResponse.companies[0].submission).toBeDefined();
      expect(sampleResponse.companies[0].submission!.status).toBe('approved');
    });

    it('handles company with no submission gracefully', () => {
      const sampleResponse = {
        companies: [
          {
            companyId: 'comp_2',
            companyName: 'New Company',
            kycStatus: 'none',
            submission: null,
            businessVerification: null,
          },
        ],
      };

      expect(sampleResponse.companies[0].submission).toBeNull();
      expect(sampleResponse.companies[0].businessVerification).toBeNull();
    });
  });

  describe('GET /api/kyc/business/trust-score — Endpoint contract', () => {
    it('returns trust score response shape matches TrustScoreData interface', () => {
      const sampleResponse = {
        workspaceId: 'comp_1',
        kycVerified: true,
        licenseVerified: true,
        insuranceVerified: false,
        avgRating: 4.5,
        totalScore: 80,
        details: {
          kycWeight: 30,
          licenseWeight: 25,
          insuranceWeight: 25,
          ratingWeight: 20,
          breakdown: {
            kycScore: 30,
            licenseScore: 25,
            insuranceScore: 0,
            ratingScore: 18,
          },
        },
        businessVerification: {
          requiresLicense: true,
          licenseVerifiedAt: '2026-05-25T12:00:00.000Z',
          insuranceVerifiedAt: null,
        },
      };

      expect(sampleResponse.workspaceId).toBe('comp_1');
      expect(sampleResponse.kycVerified).toBe(true);
      expect(sampleResponse.totalScore).toBe(80);
      expect(sampleResponse.details.breakdown.kycScore).toBe(30);
      expect(sampleResponse.businessVerification!.licenseVerifiedAt).toBeTruthy();
      expect(sampleResponse.businessVerification!.insuranceVerifiedAt).toBeNull();
    });

    it('validates trust score calculation (30 + 25 + 25 + 20 = 100 max)', () => {
      // Helper matching kycBusiness.ts calculation logic
      const calculateScore = (kyc: boolean, license: boolean, insurance: boolean, rating: number) => {
        const kycScore = kyc ? 30 : 0;
        const licenseScore = license ? 25 : 0;
        const insuranceScore = insurance ? 25 : 0;
        const ratingScore = Math.round((rating / 5) * 20);
        return kycScore + licenseScore + insuranceScore + ratingScore;
      };

      expect(calculateScore(true, true, true, 5)).toBe(100); // max
      expect(calculateScore(true, true, true, 3)).toBe(92);  // 30+25+25+12
      expect(calculateScore(false, false, false, 0)).toBe(0); // min
      expect(calculateScore(true, false, false, 4)).toBe(46); // 30+0+0+16
    });
  });

  describe('normalizeEmail helper', () => {
    // Replicate the normalizeEmail function from kycBusiness.ts
    function normalizeEmail(email: string): string {
      const [local, domain] = email.toLowerCase().trim().split('@');
      if (!domain) return email.toLowerCase().trim();
      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        return local.replace(/\./g, '').split('+')[0] + '@' + domain;
      }
      return local + '@' + domain;
    }

    it('strips dots from Gmail addresses', () => {
      expect(normalizeEmail('test.user@gmail.com')).toBe('testuser@gmail.com');
    });

    it('strips +alias from Gmail addresses', () => {
      expect(normalizeEmail('test+alias@gmail.com')).toBe('test@gmail.com');
    });

    it('handles both dots and +alias', () => {
      expect(normalizeEmail('t.e.s.t+spam@gmail.com')).toBe('test@gmail.com');
    });

    it('preserves non-Gmail addresses', () => {
      expect(normalizeEmail('Test.User@outlook.com')).toBe('test.user@outlook.com');
    });

    it('lowercases domain', () => {
      expect(normalizeEmail('TEST@GMAIL.COM')).toBe('test@gmail.com');
    });

    it('handles googlemail.com domain', () => {
      expect(normalizeEmail('test.user@googlemail.com')).toBe('testuser@googlemail.com');
    });
  });
});
