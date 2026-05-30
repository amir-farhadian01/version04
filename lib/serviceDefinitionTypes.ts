/**
 * Service catalog / order-wizard dynamic questionnaire (shared backend + F5 UI).
 * Mirrors `BusinessKycFormV1` / `BusinessKycFieldDef` where sensible (ADR-0012).
 */
export type ServiceFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'address'
  | 'photo'
  | 'measurement_dimensions'
  | 'measurement_weight'
  | 'measurement_color';

export interface ServiceFieldDef {
  id: string;
  label: string;
  helpText?: string;
  type: ServiceFieldType;
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
  /** Optional labels for boolean toggle in UI / preview. */
  trueLabel?: string;
  falseLabel?: string;
  /** `measurement_weight` only. */
  weightUnit?: 'kg' | 'lb';
  /** `measurement_dimensions` only — unit label in customer UIs. */
  dimensionUnit?: 'cm' | 'in';
  /** `text` / `textarea` — max character length. */
  maxLength?: number;
  /** `number` — restrict to whole numbers in UI + validation. */
  integerOnly?: boolean;
  showIf?: { fieldId: string; equals: unknown } | { fieldId: string; in: unknown[] };
}

export interface ServiceQuestionnaireV1 {
  version: 1;
  title: string;
  description?: string;
  sections: { id: string; title: string; order: number }[];
  fields: ServiceFieldDef[];
  /** Shown to client-side AI when helping the user describe the job. */
  aiAssistPrompt?: string;
}

const FIELD_TYPES: Set<string> = new Set([
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'boolean',
  'date',
  'time',
  'datetime',
  'address',
  'photo',
  'measurement_dimensions',
  'measurement_weight',
  'measurement_color',
]);

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

function isOptionalString(x: unknown): x is string | undefined {
  return x === undefined || typeof x === 'string';
}

function isServiceFieldDef(x: unknown): x is ServiceFieldDef {
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
  if (o.trueLabel !== undefined && typeof o.trueLabel !== 'string') return false;
  if (o.falseLabel !== undefined && typeof o.falseLabel !== 'string') return false;
  if (o.weightUnit !== undefined) {
    if (o.weightUnit !== 'kg' && o.weightUnit !== 'lb') return false;
  }
  if (o.dimensionUnit !== undefined) {
    if (o.dimensionUnit !== 'cm' && o.dimensionUnit !== 'in') return false;
  }
  if (o.maxLength !== undefined) {
    if (typeof o.maxLength !== 'number' || !Number.isFinite(o.maxLength) || o.maxLength < 0) return false;
  }
  if (o.integerOnly !== undefined && typeof o.integerOnly !== 'boolean') return false;
  if (o.showIf !== undefined) {
    if (!o.showIf || typeof o.showIf !== 'object') return false;
    const s = o.showIf as Record<string, unknown>;
    if (typeof s.fieldId !== 'string' || !s.fieldId) return false;
    if ('equals' in s) {
      /* any */
    } else if ('in' in s) {
      if (!Array.isArray(s.in)) return false;
    } else return false;
  }
  return true;
}

export function isServiceQuestionnaireV1(x: unknown): x is ServiceQuestionnaireV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.title !== 'string' || !o.title.trim()) return false;
  if (o.description !== undefined && typeof o.description !== 'string') return false;
  if (o.aiAssistPrompt !== undefined && typeof o.aiAssistPrompt !== 'string') return false;
  if (!Array.isArray(o.sections)) return false;
  for (const s of o.sections) {
    if (!s || typeof s !== 'object') return false;
    const sec = s as Record<string, unknown>;
    if (typeof sec.id !== 'string' || !sec.id) return false;
    if (typeof sec.title !== 'string' || !sec.title) return false;
    if (typeof sec.order !== 'number' || !Number.isFinite(sec.order)) return false;
  }
  if (!Array.isArray(o.fields)) return false;
  if (!o.fields.every(isServiceFieldDef)) return false;
  const fieldIds = new Set<string>();
  for (const f of o.fields as ServiceFieldDef[]) {
    if (fieldIds.has(f.id)) return false;
    fieldIds.add(f.id);
  }
  return true;
}
