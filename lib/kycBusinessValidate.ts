import type { BusinessKycFieldDef, BusinessKycFormV1 } from './kycTypes.js';

export interface BusinessKycUploadRow {
  fieldId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ValidateResult {
  valid: boolean;
  errors: Record<string, string>;
}

function wholeMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

function evalShowIf(
  showIf: BusinessKycFieldDef['showIf'],
  answers: Record<string, unknown>,
): boolean {
  if (!showIf) return true;
  const v = answers[showIf.fieldId];
  if ('equals' in showIf) {
    return v === showIf.equals;
  }
  if ('in' in showIf && Array.isArray(showIf.in)) {
    return showIf.in.some((x) => x === v);
  }
  return true;
}

function categoryRequired(field: BusinessKycFieldDef, categories: string[]): boolean {
  if (!field.requiredForCategories?.length) return false;
  return categories.some((c) => field.requiredForCategories!.includes(c));
}

function uploadsForField(fieldId: string, uploads: BusinessKycUploadRow[]): BusinessKycUploadRow[] {
  return uploads.filter((u) => u.fieldId === fieldId);
}

function isEmptyValue(
  field: BusinessKycFieldDef,
  value: unknown,
  uploads: BusinessKycUploadRow[],
): boolean {
  if (field.type === 'file') {
    return uploadsForField(field.id, uploads).length === 0;
  }
  if (field.type === 'boolean') return value === undefined || value === null;
  if (field.type === 'multiselect') return !Array.isArray(value) || value.length === 0;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function mimeMatchesAccept(mime: string, accept: string[]): boolean {
  if (!accept.length) return true;
  const m = mime.toLowerCase();
  for (const a of accept) {
    const pat = a.trim().toLowerCase();
    if (!pat) continue;
    if (pat.endsWith('/*')) {
      const prefix = pat.slice(0, -2);
      if (m.startsWith(`${prefix}/`)) return true;
    } else if (m === pat) return true;
  }
  return false;
}

const LOOSE_E164 = /^\+?[1-9]\d{6,14}$/;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pure validation for business KYC (browser + Node). File checks use `uploads` metadata, not `File`.
 */
export function validateBusinessKycAnswers(
  schema: BusinessKycFormV1,
  answers: Record<string, unknown>,
  uploads: BusinessKycUploadRow[],
  categories: string[],
  now: Date = new Date(),
): ValidateResult {
  const errors: Record<string, string> = {};
  const sortedFields = [...schema.fields].sort((a, b) => a.order - b.order);

  for (const field of sortedFields) {
    if (!evalShowIf(field.showIf, answers)) continue;

    const need = field.required || categoryRequired(field, categories);
    const val = answers[field.id];
    if (need && isEmptyValue(field, val, uploads)) {
      errors[field.id] = 'This field is required';
      continue;
    }
    if (isEmptyValue(field, val, uploads) && !need) continue;

    if (field.type === 'file') {
      const list = uploadsForField(field.id, uploads);
      const maxF = field.maxFiles ?? 1;
      if (list.length > maxF) {
        errors[field.id] = `At most ${maxF} file(s)`;
        continue;
      }
      const maxMb = field.maxFileSizeMb;
      if (maxMb != null) {
        const maxBytes = maxMb * 1024 * 1024;
        for (const u of list) {
          if (u.sizeBytes > maxBytes) {
            errors[field.id] = `File exceeds ${maxMb} MB`;
            break;
          }
        }
      }
      if (field.accept?.length) {
        for (const u of list) {
          if (!mimeMatchesAccept(u.mimeType, field.accept)) {
            errors[field.id] = 'File type not allowed';
            break;
          }
        }
      }
      continue;
    }

    if (field.regex && ['text', 'textarea', 'email', 'phone', 'url'].includes(field.type)) {
      try {
        const re = new RegExp(field.regex);
        if (!re.test(String(val ?? ''))) {
          errors[field.id] = field.regexErrorMessage || 'Format invalid';
        }
      } catch {
        errors[field.id] = 'Invalid field pattern';
      }
    } else if (field.type === 'email' && val != null && val !== '') {
      if (!SIMPLE_EMAIL.test(String(val).trim())) {
        errors[field.id] = 'Invalid email';
      }
    } else if (field.type === 'phone' && val != null && val !== '') {
      const s = String(val).replace(/\s/g, '');
      if (!LOOSE_E164.test(s)) {
        errors[field.id] = 'Invalid phone number';
      }
    } else if (field.type === 'url' && val != null && val !== '') {
      try {
        const u = new URL(String(val));
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          errors[field.id] = 'URL must be http(s)';
        }
      } catch {
        errors[field.id] = 'Invalid URL';
      }
    }

    if (field.type === 'number' && val != null && val !== '') {
      const n = Number(val);
      if (Number.isNaN(n)) {
        errors[field.id] = 'Must be a number';
      } else {
        if (field.min != null && n < field.min) errors[field.id] = `Minimum ${field.min}`;
        if (field.max != null && n > field.max) errors[field.id] = `Maximum ${field.max}`;
      }
    }

    if (field.type === 'date' && val) {
      const d = new Date(String(val));
      if (!Number.isNaN(d.getTime())) {
        if (field.min != null) {
          const minD = new Date(field.min as unknown as string);
          if (!Number.isNaN(minD.getTime()) && d < minD) {
            errors[field.id] = `Not before ${minD.toLocaleDateString()}`;
          }
        }
        if (field.max != null) {
          const maxD = new Date(field.max as unknown as string);
          if (!Number.isNaN(maxD.getTime()) && d > maxD) {
            errors[field.id] = `Not after ${maxD.toLocaleDateString()}`;
          }
        }
        if (field.expiryMinMonths != null) {
          const mo = wholeMonthsBetween(now, d);
          if (mo < field.expiryMinMonths) {
            errors[field.id] = `Must be at least ${field.expiryMinMonths} month(s) in the future`;
          }
        }
      }
    }

    if (field.type === 'select' && field.options && val != null) {
      const ok = field.options.some((o) => o.value === String(val));
      if (!ok) errors[field.id] = 'Invalid option';
    }

    if (field.type === 'multiselect' && field.options && Array.isArray(val)) {
      for (const x of val) {
        const ok = field.options.some((o) => o.value === String(x));
        if (!ok) {
          errors[field.id] = 'Invalid option';
          break;
        }
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
