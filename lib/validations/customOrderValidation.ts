import { z } from 'zod';

/**
 * Maximum number of fields allowed on a single custom intake form.
 */
export const MAX_INTAKE_FORM_FIELDS = 10;

/**
 * File upload constraints approved in ADR-0086:
 * - Maximum size: 10 MB
 * - Allowed MIME types: Images (JPEG, PNG, WebP) and PDF
 */
export const INTAKE_FILE_UPLOAD_LIMITS = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ] as const,
};

export const FormFieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'single_select',
  'multi_select',
  'file_upload',
]);

export const BaseOrderStatusSchema = z.enum([
  'Draft',
  'Submitted',
  'InReview',
  'Accepted',
  'InProgress',
  'Completed',
  'Cancelled',
]);

export type BaseOrderStatusValue = z.infer<typeof BaseOrderStatusSchema>;
export type FormFieldTypeValue = z.infer<typeof FormFieldTypeSchema>;

export const FormFieldInputSchema = z.object({
  label: z.string().trim().min(1, 'Field label is required').max(100),
  fieldType: FormFieldTypeSchema,
  isRequired: z.boolean().default(false),
  placeholder: z.string().trim().max(100).optional(),
  options: z.array(z.string().trim().min(1)).max(20).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const CustomIntakeFormSchema = z.object({
  name: z.string().trim().min(2, 'Form name is required').max(100),
  description: z.string().trim().max(500).optional(),
  serviceCatalogId: z.string().trim().min(1).optional(),
  isActive: z.boolean().default(true),
  fields: z
    .array(FormFieldInputSchema)
    .max(MAX_INTAKE_FORM_FIELDS, `Maximum ${MAX_INTAKE_FORM_FIELDS} fields allowed per form`)
    .refine(
      (fields) =>
        fields.every((field) => {
          if (field.fieldType === 'single_select' || field.fieldType === 'multi_select') {
            return Array.isArray(field.options) && field.options.length > 0;
          }
          return true;
        }),
      { message: 'Select fields must include at least one option' },
    ),
});

export const PipelineStageInputSchema = z.object({
  name: z.string().trim().min(1, 'Stage name is required').max(80),
  baseStatus: BaseOrderStatusSchema,
  sortOrder: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
});

export const WorkspacePipelineStagesSchema = z
  .object({
    stages: z
      .array(PipelineStageInputSchema)
      .min(1, 'At least one pipeline stage is required')
      .max(20, 'Maximum 20 pipeline stages allowed'),
  })
  .refine(
    (data) => {
      const names = data.stages.map((s) => s.name.toLowerCase());
      return new Set(names).size === names.length;
    },
    { message: 'Pipeline stage names must be unique within a workspace' },
  )
  .refine(
    (data) => data.stages.filter((s) => s.isDefault).length <= 1,
    { message: 'At most one pipeline stage may be marked as default' },
  );

export const LineItemInputSchema = z
  .object({
    packageId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1, 'Item title is required').max(150),
    quantity: z.number().int().positive().max(100).default(1),
    unitPriceCents: z.number().int().nonnegative(),
    scheduledStartAt: z.string().datetime().optional(),
    scheduledEndAt: z.string().datetime().optional(),
    sessionIndex: z.number().int().positive().optional(),
  })
  .refine(
    (item) => {
      if (item.scheduledStartAt && item.scheduledEndAt) {
        return new Date(item.scheduledEndAt) > new Date(item.scheduledStartAt);
      }
      return true;
    },
    { message: 'Item scheduledEndAt must be after scheduledStartAt' },
  );

export const CustomBundleOrderSchema = z.object({
  workspaceId: z.string().trim().min(1, 'workspaceId is required'),
  serviceCatalogId: z.string().trim().min(1).optional(),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(300).optional(),
  scheduleFlexibility: z.string().trim().max(50).default('flexible'),
  items: z
    .array(LineItemInputSchema)
    .min(1, 'Order must contain at least one line item')
    .max(15, 'Maximum 15 line items allowed per custom bundle'),
  intakeAnswers: z.record(z.string(), z.unknown()).optional(),
});

export const PipelineStageUpdateSchema = z.object({
  stageId: z.string().trim().min(1, 'stageId is required'),
  internalNote: z.string().trim().max(1000).optional(),
});

export const FileUploadMetadataSchema = z.object({
  sizeBytes: z
    .number()
    .int()
    .positive('File size must be greater than 0')
    .max(
      INTAKE_FILE_UPLOAD_LIMITS.maxSizeBytes,
      'File size exceeds maximum allowed 10MB limit',
    ),
  mimeType: z.enum(INTAKE_FILE_UPLOAD_LIMITS.allowedMimeTypes, {
    message: 'Only image (JPEG, PNG, WebP) and PDF files are allowed',
  }),
  fileUrl: z.string().trim().min(1).max(500).optional(),
});

export interface ScheduleWindow {
  overallStartAt: Date | null;
  overallEndAt: Date | null;
}

/**
 * Computes aggregate start and end timestamps from line-item schedules.
 */
export function computeOverallScheduleWindow(
  items: Array<{ scheduledStartAt?: string | Date | null; scheduledEndAt?: string | Date | null }>,
): ScheduleWindow {
  const startTimes: number[] = [];
  const endTimes: number[] = [];

  for (const item of items) {
    if (item.scheduledStartAt) {
      const t = new Date(item.scheduledStartAt).getTime();
      if (!Number.isNaN(t)) startTimes.push(t);
    }
    if (item.scheduledEndAt) {
      const t = new Date(item.scheduledEndAt).getTime();
      if (!Number.isNaN(t)) endTimes.push(t);
    }
  }

  return {
    overallStartAt: startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null,
    overallEndAt: endTimes.length > 0 ? new Date(Math.max(...endTimes)) : null,
  };
}

/**
 * Validates submitted intakeAnswers against an active form's field definitions.
 * Enforces required fields, type matching, and file upload size/MIME rules.
 */
export function validateIntakeAnswersAgainstFields(
  fields: Array<{
    id: string;
    label: string;
    fieldType: FormFieldTypeValue;
    isRequired: boolean;
    options?: unknown;
  }>,
  answers: Record<string, unknown> | undefined,
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  const safeAnswers = answers ?? {};

  for (const field of fields) {
    const val = safeAnswers[field.id] ?? safeAnswers[field.label];
    const isEmpty =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim() === '') ||
      (Array.isArray(val) && val.length === 0);

    if (field.isRequired && isEmpty) {
      errors.push(`Field "${field.label}" is required`);
      continue;
    }

    if (isEmpty) continue;

    if (field.fieldType === 'number' && (typeof val !== 'number' || Number.isNaN(val))) {
      errors.push(`Field "${field.label}" must be a valid number`);
    } else if (field.fieldType === 'date' && Number.isNaN(new Date(String(val)).getTime())) {
      errors.push(`Field "${field.label}" must be a valid date`);
    } else if (field.fieldType === 'file_upload') {
      const files = Array.isArray(val) ? val : [val];
      for (const file of files) {
        const parsed = FileUploadMetadataSchema.safeParse(file);
        if (!parsed.success) {
          errors.push(
            `Field "${field.label}": ${parsed.error.issues[0]?.message ?? 'Invalid file upload'}`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
