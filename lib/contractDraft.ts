import { GoogleGenAI } from '@google/genai';
import { analyzeMismatch } from './contractMismatchGuard.js';

export type ContractDraftInput = {
  orderSummary: string;
  packageLabel: string;
  packagePrice: number | null;
  packageCurrency: string | null;
  chatSummary: string;
  customerName: string;
  providerName: string;
  scheduleLine: string | null;
};

export type ContractDraftOutput = {
  title: string;
  termsMarkdown: string;
  policiesMarkdown: string;
  scopeSummary: string;
  amount: number | null;
  currency: string;
  mismatchWarnings: string[];
};

function escapeMd(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/`/g, '\\`').trim();
}

function templateDraft(input: ContractDraftInput): Omit<ContractDraftOutput, 'mismatchWarnings'> {
  const currency = (input.packageCurrency || 'CAD').toUpperCase();
  const amount =
    input.packagePrice != null && Number.isFinite(input.packagePrice) ? input.packagePrice : null;
  const title = `Service agreement — ${input.packageLabel}`.slice(0, 200);
  const schedule = input.scheduleLine?.trim() || 'To be scheduled with the customer.';
  const scopeSummary = escapeMd(input.orderSummary).slice(0, 2000);
  const termsMarkdown = [
    `# ${title}`,
    '',
    '## Parties',
    `- **Customer:** ${escapeMd(input.customerName)}`,
    `- **Provider:** ${escapeMd(input.providerName)}`,
    '',
    '## Scope of work',
    escapeMd(input.orderSummary) || '_No additional description._',
    '',
    '## Selected package',
    escapeMd(input.packageLabel),
    '',
    '## Schedule',
    escapeMd(schedule),
    '',
    '## Price',
    amount != null ? `**${currency} ${amount.toFixed(2)}** (from matched package)` : '_Amount to be confirmed._',
    '',
    '## Execution',
    'The provider will perform the work described above in a professional manner, following applicable laws and safety practices.',
  ].join('\n');

  const policiesMarkdown = [
    '## Policies',
    '',
    '- Payment and cancellation terms follow the Neighborly platform rules in effect at booking time.',
    '- Disputes should first be raised in order chat or with platform support.',
    '- Either party may request contract revisions before approval.',
  ].join('\n');

  return { title, termsMarkdown, policiesMarkdown, scopeSummary, amount, currency };
}

async function tryGeminiDraft(input: ContractDraftInput): Promise<Omit<ContractDraftOutput, 'mismatchWarnings'> | null> {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return null;

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = [
    'You draft a short service contract for a local marketplace order.',
    'Return JSON only with keys: title (string), termsMarkdown (string), policiesMarkdown (string),',
    'scopeSummary (string, one paragraph), amount (number or null), currency (string, ISO like CAD).',
    'Use clear Markdown headings in termsMarkdown and policiesMarkdown.',
    'Do not invent facts; if unsure, say "TBD" in prose.',
    '',
    `Customer: ${input.customerName}`,
    `Provider: ${input.providerName}`,
    `Package: ${input.packageLabel}`,
    `Package price hint: ${input.packagePrice ?? 'unknown'} ${input.packageCurrency ?? ''}`,
    `Schedule: ${input.scheduleLine ?? 'unknown'}`,
    '',
    'Order summary:',
    input.orderSummary.slice(0, 8000),
    '',
    'Recent chat (sanitized):',
    input.chatSummary.slice(0, 8000),
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    const raw = response.text?.trim();
    if (!raw) return null;
    let jsonStr = raw;
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null;
    const termsMarkdown =
      typeof parsed.termsMarkdown === 'string' && parsed.termsMarkdown.trim()
        ? parsed.termsMarkdown.trim()
        : null;
    const policiesMarkdown =
      typeof parsed.policiesMarkdown === 'string' && parsed.policiesMarkdown.trim()
        ? parsed.policiesMarkdown.trim()
        : null;
    const scopeSummary =
      typeof parsed.scopeSummary === 'string' && parsed.scopeSummary.trim()
        ? parsed.scopeSummary.trim()
        : null;
    const amount =
      typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : null;
    const currency =
      typeof parsed.currency === 'string' && parsed.currency.trim()
        ? parsed.currency.trim().toUpperCase()
        : (input.packageCurrency || 'CAD').toUpperCase();
    if (!title || !termsMarkdown) return null;
    return {
      title: title.slice(0, 200),
      termsMarkdown,
      policiesMarkdown: policiesMarkdown ?? '',
      scopeSummary: (scopeSummary ?? input.orderSummary).slice(0, 4000),
      amount,
      currency,
    };
  } catch {
    return null;
  }
}

/**
 * Builds contract draft text from order + chat context. Uses Gemini when configured;
 * otherwise a deterministic Markdown template. Always returns valid markdown strings.
 */
export async function generateContractDraft(input: ContractDraftInput): Promise<ContractDraftOutput> {
  const fromAi = await tryGeminiDraft(input);
  const base = fromAi ?? templateDraft(input);
  const mismatchWarnings = analyzeMismatch({
    chatSummary: input.chatSummary,
    termsMarkdown: base.termsMarkdown,
    scopeSummary: base.scopeSummary,
    amount: base.amount,
  });
  return { ...base, mismatchWarnings };
}
