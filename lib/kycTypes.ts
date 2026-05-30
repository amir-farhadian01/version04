/**
 * Shared KYC / business form types (backend + frontend).
 * @see src/services/geminiService.ts — client AI output shape
 */
export interface KycAiAnalysis {
  isLikelyFraud: boolean;
  fraudReasoning: string;
  isEdited: boolean;
  isInternetDownloaded: boolean;
  ocrName: string;
  nameMatchesProfile: boolean;
  dataMismatchDetails: string;
  recommendation: 'approve' | 'reject' | 'manual_review';
  confidence: number;
}

export type BusinessKycFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date'
  | 'address'
  | 'file';

export interface BusinessKycFieldDef {
  id: string;
  label: string;
  helpText?: string;
  type: BusinessKycFieldType;
  required: boolean;
  order: number;
  section?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  regex?: string;
  regexErrorMessage?: string;
  min?: number;
  max?: number;
  accept?: string[];
  maxFileSizeMb?: number;
  maxFiles?: number;
  expiryMinMonths?: number;
  inquiry?: {
    providerKey: string;
    payloadFields: string[];
  };
  showIf?: { fieldId: string; equals: unknown } | { fieldId: string; in: unknown[] };
  requiredForCategories?: string[];
}

export interface BusinessKycFormV1 {
  version: 1;
  title: string;
  description?: string;
  sections: { id: string; title: string; order: number }[];
  fields: BusinessKycFieldDef[];
}

const FIELD_TYPES: Set<string> = new Set([
  'text',
  'textarea',
  'number',
  'email',
  'phone',
  'url',
  'select',
  'multiselect',
  'boolean',
  'date',
  'address',
  'file',
]);

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

function isOptionalString(x: unknown): x is string | undefined {
  return x === undefined || typeof x === 'string';
}

function isBusinessKycFieldDef(x: unknown): x is BusinessKycFieldDef {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (!isNonEmptyString(o.id)) return false;
  if (!isNonEmptyString(o.label)) return false;
  if (typeof o.type !== 'string' || !FIELD_TYPES.has(o.type)) return false;
  if (typeof o.required !== 'boolean') return false;
  if (typeof o.order !== 'number' || !Number.isFinite(o.order)) return false;
  if (!isOptionalString(o.helpText)) return false;
  if (!isOptionalString(o.section)) return false;
  if (!isOptionalString(o.placeholder)) return false;
  if (o.options !== undefined) {
    if (!Array.isArray(o.options)) return false;
    for (const opt of o.options) {
      if (!opt || typeof opt !== 'object') return false;
      const op = opt as Record<string, unknown>;
      if (typeof op.value !== 'string' || typeof op.label !== 'string') return false;
    }
  }
  if (o.regex !== undefined && typeof o.regex !== 'string') return false;
  if (o.regexErrorMessage !== undefined && typeof o.regexErrorMessage !== 'string') return false;
  if (o.min !== undefined && typeof o.min !== 'number') return false;
  if (o.max !== undefined && typeof o.max !== 'number') return false;
  if (o.accept !== undefined) {
    if (!Array.isArray(o.accept)) return false;
    for (const a of o.accept) {
      if (typeof a !== 'string') return false;
    }
  }
  if (o.maxFileSizeMb !== undefined && typeof o.maxFileSizeMb !== 'number') return false;
  if (o.maxFiles !== undefined && typeof o.maxFiles !== 'number') return false;
  if (o.expiryMinMonths !== undefined && typeof o.expiryMinMonths !== 'number') return false;
  if (o.inquiry !== undefined) {
    if (!o.inquiry || typeof o.inquiry !== 'object') return false;
    const inq = o.inquiry as Record<string, unknown>;
    if (typeof inq.providerKey !== 'string' || !inq.providerKey) return false;
    if (!Array.isArray(inq.payloadFields)) return false;
    for (const f of inq.payloadFields) {
      if (typeof f !== 'string') return false;
    }
  }
  if (o.showIf !== undefined) {
    if (!o.showIf || typeof o.showIf !== 'object') return false;
    const s = o.showIf as Record<string, unknown>;
    if (typeof s.fieldId !== 'string' || !s.fieldId) return false;
    if ('equals' in s) {
      /* equals can be any JSON-compatible value */
    } else if ('in' in s) {
      if (!Array.isArray(s.in)) return false;
    } else return false;
  }
  if (o.requiredForCategories !== undefined) {
    if (!Array.isArray(o.requiredForCategories)) return false;
    for (const c of o.requiredForCategories) {
      if (typeof c !== 'string') return false;
    }
  }
  return true;
}

export function isBusinessKycFormV1(x: unknown): x is BusinessKycFormV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.title !== 'string' || !o.title.trim()) return false;
  if (o.description !== undefined && typeof o.description !== 'string') return false;
  if (!Array.isArray(o.sections)) return false;
  for (const s of o.sections) {
    if (!s || typeof s !== 'object') return false;
    const sec = s as Record<string, unknown>;
    if (typeof sec.id !== 'string' || !sec.id) return false;
    if (typeof sec.title !== 'string' || !sec.title) return false;
    if (typeof sec.order !== 'number' || !Number.isFinite(sec.order)) return false;
  }
  if (!Array.isArray(o.fields)) return false;
  if (!o.fields.every(isBusinessKycFieldDef)) return false;
  const fieldIds = new Set<string>();
  for (const f of o.fields as BusinessKycFieldDef[]) {
    if (fieldIds.has(f.id)) return false;
    fieldIds.add(f.id);
  }
  return true;
}
