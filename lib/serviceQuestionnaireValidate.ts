import type { ServiceFieldDef, ServiceQuestionnaireV1 } from './serviceDefinitionTypes.js';

export interface ServiceUploadRow {
  fieldId: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ValidateServiceResult {
  valid: boolean;
  errors: Record<string, string>;
}

function evalShowIf(
  showIf: ServiceFieldDef['showIf'],
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

function uploadsForField(fieldId: string, uploads: ServiceUploadRow[]): ServiceUploadRow[] {
  return uploads.filter((u) => u.fieldId === fieldId);
}

function isPhotoLike(t: ServiceFieldDef['type']): boolean {
  return t === 'photo';
}

function isEmptyValue(
  field: ServiceFieldDef,
  value: unknown,
  uploads: ServiceUploadRow[],
): boolean {
  if (isPhotoLike(field.type)) {
    return uploadsForField(field.id, uploads).length === 0;
  }
  if (field.type === 'boolean') return value === undefined || value === null;
  if (field.type === 'multiselect') return !Array.isArray(value) || value.length === 0;
  if (field.type === 'measurement_weight') {
    if (value != null && typeof value === 'object' && !Array.isArray(value) && 'weight' in (value as object)) {
      const w = (value as { weight?: unknown }).weight;
      return w === null || w === undefined || w === '' || (typeof w === 'number' && Number.isNaN(w));
    }
  }
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (field.type === 'measurement_color' && typeof value === 'object' && value !== null) return false;
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

const SIMPLE_TIME = /^\d{1,2}:\d{2}/;

/**
 * Validate answers for a `ServiceQuestionnaireV1` (F5 Order Wizard; callable without UI).
 * `files` is upload metadata, not `File` blobs.
 */
export function validateServiceAnswers(
  schema: ServiceQuestionnaireV1,
  answers: Record<string, unknown>,
  files: ServiceUploadRow[],
  _now: Date = new Date(),
): ValidateServiceResult {
  const errors: Record<string, string> = {};
  const sortedFields = [...schema.fields].sort((a, b) => a.order - b.order);

  for (const field of sortedFields) {
    if (!evalShowIf(field.showIf, answers)) continue;
    const need = field.required;
    const val = answers[field.id];
    if (need && isEmptyValue(field, val, files)) {
      errors[field.id] = 'This field is required';
      continue;
    }
    if (isEmptyValue(field, val, files) && !need) continue;

    if (isPhotoLike(field.type)) {
      const list = uploadsForField(field.id, files);
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

    if (field.regex && ['text', 'textarea', 'address', 'measurement_color'].includes(field.type)) {
      try {
        const re = new RegExp(field.regex);
        if (!re.test(String(val ?? ''))) {
          errors[field.id] = field.regexErrorMessage || 'Format invalid';
        }
      } catch {
        errors[field.id] = 'Invalid field pattern';
      }
    }

    if (field.type === 'address' && val != null && val !== '' && !field.regex) {
      if (String(val).trim().length < 3) {
        errors[field.id] = 'Address too short';
      }
    }

    if (field.type === 'measurement_dimensions' && val != null && val !== '') {
      const o = val && typeof val === 'object' && !Array.isArray(val) ? (val as { w?: unknown; h?: unknown; d?: unknown }) : {};
      for (const k of ['w', 'h', 'd'] as const) {
        const x = o[k];
        if (x === undefined || x === '') continue;
        const n = Number(x);
        if (Number.isNaN(n)) {
          errors[field.id] = 'Must be a number';
          break;
        }
        if (field.integerOnly && !Number.isInteger(n)) {
          errors[field.id] = 'Must be a whole number';
          break;
        }
        if (field.min != null && n < field.min) errors[field.id] = `Minimum ${field.min}`;
        if (field.max != null && n > field.max) errors[field.id] = `Maximum ${field.max}`;
      }
    } else if (field.type === 'number' || field.type === 'measurement_weight') {
      let numSource: unknown = val;
      if (field.type === 'measurement_weight' && val != null && typeof val === 'object' && !Array.isArray(val) && 'weight' in (val as object)) {
        numSource = (val as { weight?: unknown }).weight;
      }
      if (numSource != null && numSource !== '') {
        const n = Number(numSource);
        if (Number.isNaN(n)) {
          errors[field.id] = 'Must be a number';
        } else {
          if (field.integerOnly && !Number.isInteger(n)) {
            errors[field.id] = 'Must be a whole number';
          }
          if (field.min != null && n < field.min) errors[field.id] = `Minimum ${field.min}`;
          if (field.max != null && n > field.max) errors[field.id] = `Maximum ${field.max}`;
        }
      }
    }

    if ((field.type === 'text' || field.type === 'textarea') && field.maxLength != null && val != null) {
      if (String(val).length > field.maxLength) {
        errors[field.id] = `At most ${field.maxLength} characters`;
      }
    }

    if (field.type === 'date' && val) {
      const d = new Date(String(val));
      if (Number.isNaN(d.getTime())) {
        errors[field.id] = 'Invalid date';
      } else {
        if (field.min != null) {
          const minD = new Date(typeof field.min === 'number' ? field.min : (field.min as unknown as string));
          if (!Number.isNaN(minD.getTime()) && d < minD) {
            errors[field.id] = `Not before ${minD.toLocaleDateString()}`;
          }
        }
        if (field.max != null) {
          const maxD = new Date(typeof field.max === 'number' ? field.max : (field.max as unknown as string));
          if (!Number.isNaN(maxD.getTime()) && d > maxD) {
            errors[field.id] = `Not after ${maxD.toLocaleDateString()}`;
          }
        }
      }
    }

    if (field.type === 'time' && val != null && val !== '' && !SIMPLE_TIME.test(String(val).trim())) {
      errors[field.id] = 'Invalid time';
    }

    if (field.type === 'datetime' && val) {
      const d = new Date(String(val));
      if (Number.isNaN(d.getTime())) {
        errors[field.id] = 'Invalid date and time';
      }
    }

    if (field.type === 'select' && field.options && val != null) {
      const ok = field.options.some((o) => o.value === String(val));
      if (!ok) errors[field.id] = 'Invalid option';
    }

    if (field.type === 'multiselect' && field.options && Array.isArray(val)) {
      for (const x of val) {
        const ok = field.options!.some((o) => o.value === String(x));
        if (!ok) {
          errors[field.id] = 'Invalid option';
          break;
        }
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Smoke: empty questionnaire has no field errors
const _smoke = validateServiceAnswers(
  { version: 1, title: 'S', sections: [], fields: [] },
  {},
  [],
);
if (!_smoke.valid) {
  throw new Error('serviceQuestionnaireValidate smoke failed');
}
