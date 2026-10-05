export type InsuranceStatus = 'insured' | 'uninsured' | 'not_required';

const POSTAL_CODE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ][ -]?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i;
const PROVINCES = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT','FEDERAL']);
const ENTITY_TYPES = new Set(['sole_proprietorship','partnership','corporation','cooperative','non_profit']);

export function normalizeCanadianPostalCode(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/[ -]/g, '');
  if (!POSTAL_CODE.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export function validateCanadianAddress(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'address must be structured';
  const a = value as Record<string, unknown>;
  for (const field of ['line1', 'city', 'province', 'postalCode', 'country']) {
    if (typeof a[field] !== 'string' || !a[field].trim()) return `address.${field} is required`;
  }
  if (String(a.country).toUpperCase() !== 'CA') return 'address.country must be CA';
  if (!PROVINCES.has(String(a.province).toUpperCase()) || String(a.province).toUpperCase() === 'FEDERAL') return 'invalid Canadian province';
  if (!normalizeCanadianPostalCode(String(a.postalCode))) return 'invalid Canadian postal code';
  return null;
}

export function validateCanadaBusinessAnswers(answers: Record<string, unknown>, uploads: { fieldId: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const bn = String(answers.businessNumber ?? '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(bn)) errors.businessNumber = 'Federal Business Number must be exactly 9 digits';
  const jurisdiction = String(answers.jurisdiction ?? '').toUpperCase();
  if (!PROVINCES.has(jurisdiction)) errors.jurisdiction = 'Invalid Canadian jurisdiction';
  const entityType = String(answers.entityType ?? '');
  if (!ENTITY_TYPES.has(entityType)) errors.entityType = 'Invalid entity type';
  if (entityType !== 'sole_proprietorship' && !String(answers.registrationNumber ?? '').trim()) {
    errors.registrationNumber = 'Registration number is required for this entity type';
  } else if (String(answers.registrationNumber ?? '').trim() && !/^[A-Z0-9][A-Z0-9 -]{2,30}$/i.test(String(answers.registrationNumber))) {
    errors.registrationNumber = 'Registration number format is invalid';
  }
  const insurance = answers.insuranceStatus as InsuranceStatus;
  if (!['insured', 'uninsured', 'not_required'].includes(String(insurance))) errors.insuranceStatus = 'Explicit insurance status is required';
  if (insurance === 'insured') {
    if (!String(answers.insurancePolicyNumber ?? '').trim()) errors.insurancePolicyNumber = 'Policy number is required';
    if (!String(answers.insurerName ?? '').trim()) errors.insurerName = 'Insurer name is required';
    const expiry = new Date(String(answers.insuranceExpiry ?? ''));
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) errors.insuranceExpiry = 'A future insurance expiry is required';
    if (!uploads.some((u) => u.fieldId === 'insuranceCertificate')) errors.insuranceCertificate = 'Insurance certificate is required';
  }
  return errors;
}
