/**
 * AI Form Generator — ADR-0071
 *
 * Generates a dynamic order intake form schema using Gemini API.
 * Output: array of DynamicFieldSpec compatible with ServiceCatalog.dynamicFieldsSchema.
 *
 * Field types supported:
 *   text | textarea | number | currency | date | datetime | time |
 *   select | multiselect | boolean | file | photo | location | range | rating
 */

import { GoogleGenAI } from '@google/genai';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DynamicFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'file'
  | 'photo'
  | 'location'
  | 'range'
  | 'rating';

export interface DynamicFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface ConditionalRule {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in';
  value: unknown;
}

export interface DynamicFieldSpec {
  key: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  validation?: DynamicFieldValidation;
  /** For select / multiselect */
  options?: string[];
  /** For range */
  rangeMin?: number;
  rangeMax?: number;
  rangeStep?: number;
  rangeUnit?: string;
  /** For photo */
  maxPhotos?: number;
  /** Conditionally show this field based on another field's value */
  conditionalOn?: ConditionalRule;
  /** UI sort order */
  sortOrder?: number;
}

export interface GeneratedFormSchema {
  fields: DynamicFieldSpec[];
  generatedByAi: true;
  aiModel: string;
  aiPromptHash: string;
}

export interface FormGenerationInput {
  serviceName: string;
  category: string;
  description: string;
  businessType: string;
  /** Optional existing schema to improve upon */
  existingSchema?: DynamicFieldSpec[];
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a UX form designer for a local services marketplace called Neighborly.
Your task is to generate a minimal, complete intake form for customers ordering a service.

STRICT RULES:
1. Output ONLY valid JSON — no markdown, no explanation, no code fences
2. Maximum 12 fields total
3. Mark 3-5 fields as required: true
4. Always include these 2 fields (at the end): 
   - key: "service_date", label: "Preferred Date & Time", type: "datetime", required: false
   - key: "special_instructions", label: "Special Instructions", type: "textarea", required: false
5. NEVER include contact information fields (phone, email, home address) — the platform handles this
6. Use conditional logic where natural (e.g., show "pet_breed" only when "has_pets" = true)
7. Field types allowed: text | textarea | number | currency | date | datetime | select | multiselect | boolean | photo | range | rating

OUTPUT FORMAT (JSON array of field objects):
[
  {
    "key": "string (snake_case unique key)",
    "label": "string (displayed to user)",
    "type": "FieldType",
    "required": boolean,
    "placeholder": "string (optional)",
    "helpText": "string (optional hint)",
    "options": ["option1", "option2"] (only for select/multiselect),
    "rangeMin": number (only for range),
    "rangeMax": number (only for range),
    "rangeUnit": "string" (only for range, e.g. "sq ft"),
    "maxPhotos": number (only for photo, default 5),
    "conditionalOn": { "field": "key", "operator": "eq", "value": "value" } (optional),
    "sortOrder": number (0-indexed)
  }
]`;
}

function buildUserPrompt(input: FormGenerationInput): string {
  const existingContext = input.existingSchema
    ? `\n\nExisting schema to improve upon:\n${JSON.stringify(input.existingSchema, null, 2)}`
    : '';

  return `Service: ${input.serviceName}
Category: ${input.category}
Business Type: ${input.businessType}
Description: ${input.description}${existingContext}

Generate the intake form fields JSON array now:`;
}

// ─── Simple hash for audit ────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ─── Validation of AI output ─────────────────────────────────────────────────

const ALLOWED_TYPES: Set<string> = new Set([
  'text', 'textarea', 'number', 'currency', 'date', 'datetime', 'time',
  'select', 'multiselect', 'boolean', 'file', 'photo', 'location', 'range', 'rating',
]);

const FORBIDDEN_KEYS = new Set(['phone', 'email', 'address', 'password', 'credit_card', 'ssn', 'sin']);

function validateAndSanitizeSchema(raw: unknown): DynamicFieldSpec[] {
  if (!Array.isArray(raw)) {
    throw new Error('AI output is not an array');
  }

  const validated: DynamicFieldSpec[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const field = raw[i] as Record<string, unknown>;

    if (typeof field.key !== 'string' || !field.key) continue;
    if (typeof field.label !== 'string' || !field.label) continue;
    if (typeof field.type !== 'string' || !ALLOWED_TYPES.has(field.type)) continue;

    const key = field.key.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Security: block forbidden field keys
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const spec: DynamicFieldSpec = {
      key,
      label: String(field.label).slice(0, 100),
      type: field.type as DynamicFieldType,
      required: Boolean(field.required),
      sortOrder: i,
    };

    if (field.placeholder && typeof field.placeholder === 'string') {
      spec.placeholder = field.placeholder.slice(0, 200);
    }
    if (field.helpText && typeof field.helpText === 'string') {
      spec.helpText = field.helpText.slice(0, 300);
    }
    if (Array.isArray(field.options)) {
      spec.options = (field.options as unknown[])
        .filter((o) => typeof o === 'string')
        .map((o) => String(o).slice(0, 100))
        .slice(0, 20);
    }
    if (typeof field.rangeMin === 'number') spec.rangeMin = field.rangeMin;
    if (typeof field.rangeMax === 'number') spec.rangeMax = field.rangeMax;
    if (typeof field.rangeStep === 'number') spec.rangeStep = field.rangeStep;
    if (typeof field.rangeUnit === 'string') spec.rangeUnit = field.rangeUnit.slice(0, 20);
    if (typeof field.maxPhotos === 'number') spec.maxPhotos = Math.min(field.maxPhotos, 10);

    if (field.conditionalOn && typeof field.conditionalOn === 'object') {
      const cond = field.conditionalOn as Record<string, unknown>;
      if (typeof cond.field === 'string' && typeof cond.operator === 'string') {
        spec.conditionalOn = {
          field: cond.field,
          operator: cond.operator as ConditionalRule['operator'],
          value: cond.value,
        };
      }
    }

    validated.push(spec);
  }

  return validated;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function generateFormSchema(input: FormGenerationInput): Promise<GeneratedFormSchema> {
  const apiKey = process.env['GEMINI_API_KEY'] ?? process.env['VITE_GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenAI({ apiKey });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: fullPrompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });
  const responseText = (result.text ?? '').trim();

  // Parse JSON — handle potential markdown wrapping
  let parsed: unknown;
  try {
    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${responseText.slice(0, 200)}`);
  }

  const fields = validateAndSanitizeSchema(parsed);

  if (fields.length === 0) {
    throw new Error('AI returned empty or invalid schema');
  }

  return {
    fields,
    generatedByAi: true,
    aiModel: 'gemini-2.0-flash',
    aiPromptHash: simpleHash(fullPrompt),
  };
}
