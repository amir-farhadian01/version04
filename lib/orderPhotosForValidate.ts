import type { ServiceQuestionnaireV1 } from './serviceDefinitionTypes.js';
import type { ServiceUploadRow } from './serviceQuestionnaireValidate.js';

/**
 * Maps stored order `photos` JSON to rows expected by `validateServiceAnswers`.
 * Accepts `{ url, fileName, mimeType, sizeBytes, fieldId? }[]`; when there is
 * exactly one `photo` field in the schema, `fieldId` may be omitted.
 */
export function photosJsonToUploadRows(
  photos: unknown,
  schema: ServiceQuestionnaireV1,
): { ok: true; rows: ServiceUploadRow[] } | { ok: false; error: string } {
  if (!Array.isArray(photos)) {
    return { ok: false, error: 'photos must be an array' };
  }
  const photoFields = schema.fields.filter((f) => f.type === 'photo');
  const rows: ServiceUploadRow[] = [];
  for (const p of photos) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url : '';
    const fileName = typeof o.fileName === 'string' ? o.fileName : '';
    const mimeType =
      typeof o.mimeType === 'string' ? o.mimeType : 'application/octet-stream';
    const sizeBytes =
      typeof o.sizeBytes === 'number' && Number.isFinite(o.sizeBytes) ? o.sizeBytes : 0;
    let fieldId = typeof o.fieldId === 'string' ? o.fieldId : '';
    if (!fieldId) {
      if (photoFields.length === 1) fieldId = photoFields[0]!.id;
      else {
        return {
          ok: false,
          error: 'fieldId is required on each photo when the schema has multiple photo fields',
        };
      }
    }
    if (!url.trim()) {
      return { ok: false, error: 'Each photo must have a non-empty url' };
    }
    rows.push({ fieldId, url, fileName, mimeType, sizeBytes });
  }
  return { ok: true, rows };
}
