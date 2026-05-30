import type { ServiceFieldDef, ServiceQuestionnaireV1 } from './serviceDefinitionTypes.js';

export type BuilderValidation = {
  errors: string[];
  fieldErrors: Record<string, string>;
};

/**
 * Validates a draft `ServiceQuestionnaireV1` in the admin builder (before `isServiceQuestionnaireV1` / save).
 * Keeps the editor "Save" disabled when structural rules fail.
 */
export function validateBuilderSchema(
  nameTrimmed: string,
  categoryId: string | null,
  form: ServiceQuestionnaireV1
): BuilderValidation {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const push = (msg: string) => {
    if (!errors.includes(msg)) errors.push(msg);
  };
  const pushField = (fieldId: string, msg: string) => {
    fieldErrors[fieldId] = msg;
  };

  if (!nameTrimmed) push('Name is required');
  if (!categoryId) push('Category is required');
  if (!form.title?.trim()) push('Schema title is required');
  if (!form.sections.length) push('At least one section is required');
  if (!form.fields.length) push('At least one field is required');

  const ids = form.fields.map((f) => f.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    push('Field ids must be unique');
    const count = new Map<string, number>();
    for (const id of ids) {
      count.set(id, (count.get(id) ?? 0) + 1);
    }
    for (const f of form.fields) {
      if ((count.get(f.id) ?? 0) > 1) {
        pushField(f.id, 'This id is used more than once');
      }
    }
  }

  for (const f of form.fields) {
    if (f.regex && ['text', 'textarea', 'address', 'measurement_color'].includes(f.type)) {
      try {
        new RegExp(f.regex);
      } catch {
        const msg = `Invalid regex on field “${f.id}”`;
        push(msg);
        pushField(f.id, 'Invalid regular expression');
      }
    }
    if (f.showIf) {
      if (!f.showIf.fieldId?.trim() || f.showIf.fieldId === f.id) {
        const msg = `showIf on “${f.id}” needs a different controlling field`;
        push(msg);
        pushField(f.id, 'showIf: pick another field');
      } else if (!idSet.has(f.showIf.fieldId)) {
        const msg = `showIf on “${f.id}” references missing field “${f.showIf.fieldId}”`;
        push(msg);
        pushField(f.id, 'showIf references a missing id');
      }
    }
    if (f.section && !form.sections.some((s) => s.id === f.section)) {
      push(`Field “${f.id}” references unknown section`);
      pushField(f.id, 'Unknown section');
    }
    if (f.type === 'select' || f.type === 'multiselect') {
      const rawOpts = f.options ?? [];
      const byVal = new Map<string, number>();
      for (const o of rawOpts) {
        const v = o.value?.trim() ?? '';
        if (!v) continue;
        byVal.set(v, (byVal.get(v) ?? 0) + 1);
      }
      for (const [v, n] of byVal) {
        if (n > 1) {
          push(`Duplicate option value “${v}” on field “${f.id}”`);
          pushField(f.id, 'Option values must be unique');
          break;
        }
      }
      const nonEmpty = rawOpts.filter((o) => (o.value?.trim() ?? '') !== '');
      if (f.required && nonEmpty.length === 0) {
        push(`Field “${f.id}” needs options when required`);
        pushField(f.id, 'Add at least one option');
      }
    }
  }

  return { errors, fieldErrors };
}
