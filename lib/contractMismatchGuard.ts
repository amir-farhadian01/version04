/**
 * Non-blocking heuristics: compare chat summary to draft contract fields.
 * Returns human-readable warning strings (may be empty).
 */

export type MismatchInput = {
  chatSummary: string;
  termsMarkdown: string;
  scopeSummary: string | null | undefined;
  amount: number | null | undefined;
};

function normalizeMoney(s: string): number[] {
  const out: number[] = [];
  const re = /\$\s*([\d,]+(?:\.\d{1,2})?)|(?:CAD|USD)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const raw = (m[1] || m[2] || '').replace(/,/g, '');
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function extractVisitCounts(text: string): number[] {
  const out: number[] = [];
  const re =
    /(\d+)\s*(?:visit|visits|appointment|appointments|session|sessions|trip|trips|time|times)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0 && n < 100) out.push(n);
  }
  return out;
}

function maxVisitMentionedInContract(terms: string, scope: string): number | null {
  const blob = `${terms}\n${scope || ''}`;
  const counts = extractVisitCounts(blob);
  if (!counts.length) return null;
  return Math.max(...counts);
}

function maxVisitMentionedInChat(chat: string): number | null {
  const counts = extractVisitCounts(chat);
  if (!counts.length) return null;
  return Math.max(...counts);
}

export function analyzeMismatch(input: MismatchInput): string[] {
  const warnings: string[] = [];
  const chat = (input.chatSummary || '').trim();
  const terms = (input.termsMarkdown || '').trim();
  const scope = (input.scopeSummary || '').trim();

  if (chat.length > 20) {
    const chatVisits = maxVisitMentionedInChat(chat);
    const contractVisits = maxVisitMentionedInContract(terms, scope);
    if (chatVisits != null && contractVisits != null && chatVisits !== contractVisits) {
      warnings.push(
        `Chat mentions ${chatVisits} visit(s) but contract text suggests ${contractVisits}.`,
      );
    } else if (chatVisits != null && contractVisits == null && /\bvisit/i.test(chat)) {
      warnings.push(
        `Chat mentions ${chatVisits} visit(s) but the contract does not clearly state a visit count.`,
      );
    }
  }

  const chatPrices = normalizeMoney(chat);
  const contractPrices = normalizeMoney(`${terms}\n${scope}`);
  if (input.amount != null && Number.isFinite(input.amount) && chatPrices.length) {
    const nearest = chatPrices.reduce((a, b) =>
      Math.abs(b - input.amount!) < Math.abs(a - input.amount!) ? b : a,
    );
    if (Math.abs(nearest - input.amount) > 0.5 && Math.abs(nearest - input.amount) / input.amount > 0.05) {
      warnings.push(
        `Price mentioned in chat (≈$${nearest.toFixed(0)}) differs from contract amount ($${input.amount.toFixed(2)}).`,
      );
    }
  } else if (chatPrices.length && contractPrices.length) {
    const ca = chatPrices[0];
    const cb = contractPrices[0];
    if (Math.abs(ca - cb) > 0.5 && Math.abs(ca - cb) / Math.max(ca, cb, 1) > 0.05) {
      warnings.push(
        `Dollar amounts in chat (≈$${ca.toFixed(0)}) differ from amounts in contract text (≈$${cb.toFixed(0)}).`,
      );
    }
  }

  return warnings;
}
