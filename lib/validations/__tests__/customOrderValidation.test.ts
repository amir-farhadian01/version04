import { describe, expect, it } from 'vitest';
import {
  computeOverallScheduleWindow,
  CustomBundleOrderSchema,
  CustomIntakeFormSchema,
  FileUploadMetadataSchema,
  validateIntakeAnswersAgainstFields,
  WorkspacePipelineStagesSchema,
} from '../customOrderValidation.js';
import {
  invalidIntakeFormWithElevenFields,
  invalidMimeFileUploadMeta,
  invalidOversizedFileUploadMeta,
  invalidSchedulingBundle,
  validCustomBundleWithTwoItems,
  validFileUploadMeta,
  validIntakeFormWithTenFields,
  validPipelineStagesFixture,
} from '../../../tests/fixtures/offersOrdersJobsFixtures.js';

describe('CustomOrderValidation Zod schemas & helpers', () => {
  it('accepts an intake form with exactly 10 fields covering all 6 types', () => {
    const result = CustomIntakeFormSchema.safeParse(validIntakeFormWithTenFields);
    expect(result.success).toBe(true);
  });

  it('rejects an intake form exceeding the 10-field cap', () => {
    const result = CustomIntakeFormSchema.safeParse(invalidIntakeFormWithElevenFields);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('10');
    }
  });

  it('rejects select fields without options', () => {
    const result = CustomIntakeFormSchema.safeParse({
      name: 'Invalid Select Form',
      fields: [
        {
          label: 'نوع سرویس',
          fieldType: 'single_select',
          isRequired: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('validates file upload size (<=10MB) and MIME types (images & PDF)', () => {
    expect(FileUploadMetadataSchema.safeParse(validFileUploadMeta).success).toBe(true);
    expect(FileUploadMetadataSchema.safeParse(invalidOversizedFileUploadMeta).success).toBe(false);
    expect(FileUploadMetadataSchema.safeParse(invalidMimeFileUploadMeta).success).toBe(false);
  });

  it('accepts valid pipeline stages mapped to the 7 base statuses and rejects duplicate names', () => {
    const valid = WorkspacePipelineStagesSchema.safeParse({
      stages: validPipelineStagesFixture,
    });
    expect(valid.success).toBe(true);

    const duplicate = WorkspacePipelineStagesSchema.safeParse({
      stages: [
        { name: 'تأیید اولیه', baseStatus: 'InReview', sortOrder: 0, isDefault: true },
        { name: 'تأیید اولیه', baseStatus: 'Accepted', sortOrder: 1, isDefault: false },
      ],
    });
    expect(duplicate.success).toBe(false);
  });

  it('accepts a custom bundle order and rejects items where scheduledEndAt <= scheduledStartAt', () => {
    expect(CustomBundleOrderSchema.safeParse(validCustomBundleWithTwoItems).success).toBe(true);
    expect(CustomBundleOrderSchema.safeParse(invalidSchedulingBundle).success).toBe(false);
  });

  it('computes aggregate overallStartAt and overallEndAt from line items', () => {
    const window = computeOverallScheduleWindow(validCustomBundleWithTwoItems.items);
    expect(window.overallStartAt?.toISOString()).toBe('2026-12-01T10:00:00.000Z');
    expect(window.overallEndAt?.toISOString()).toBe('2026-12-02T16:00:00.000Z');
  });

  it('validates submitted intakeAnswers against form fields including required & file checks', () => {
    const ok = validateIntakeAnswersAgainstFields(
      validIntakeFormWithTenFields.fields,
      validCustomBundleWithTwoItems.intakeAnswers,
    );
    expect(ok.valid).toBe(true);

    const missingRequired = validateIntakeAnswersAgainstFields(
      validIntakeFormWithTenFields.fields,
      { f2: 50 },
    );
    expect(missingRequired.valid).toBe(false);
  });
});
