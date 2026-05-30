import type { ContractTemplateDefinition } from './contractTemplateCatalog.js';

/** Matches `{{tokenName}}` with optional internal spaces. */
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export type OrderShapeForContractTemplate = {
  description: string | null;
  answers: unknown;
  address: string | null;
  scheduledAt: Date | null;
  scheduleFlexibility: string | null;
  customer: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  matchedProvider: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  matchedPackage: {
    name: string;
    finalPrice: number | null;
    currency: string | null;
  } | null;
  matchedWorkspace: { name: string } | null;
};

function displayName(u: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  return u.email;
}

function formatPackagePrice(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return 'TBD';
  return amount.toFixed(2);
}

/**
 * Builds a flat string map used to replace `{{keys}}` in template Markdown.
 * Only declared keys are filled; unknown tokens in templates remain visible.
 */
export function buildContractTemplateContext(
  order: OrderShapeForContractTemplate,
  chatSummary: string,
): Record<string, string> {
  const pkg = order.matchedPackage;
  const currency = (pkg?.currency ?? 'CAD').toUpperCase();
  const priceNum = pkg?.finalPrice != null && Number.isFinite(pkg.finalPrice) ? pkg.finalPrice : null;
  const scheduleLine =
    order.scheduledAt != null
      ? `${order.scheduledAt.toISOString()} (${order.scheduleFlexibility ?? 'flexibility unspecified'})`
      : (order.scheduleFlexibility ?? 'To be scheduled with the customer.');

  let answersText = '';
  try {
    answersText =
      typeof order.answers === 'object' && order.answers !== null
        ? JSON.stringify(order.answers)
        : typeof order.answers === 'string'
          ? order.answers
          : '';
  } catch {
    answersText = '';
  }

  return {
    customerName: displayName(order.customer),
    providerName: order.matchedProvider ? displayName(order.matchedProvider) : 'Provider',
    workspaceName: order.matchedWorkspace?.name?.trim() || 'Workspace',
    packageName: pkg?.name?.trim() || 'Matched package',
    packagePrice: formatPackagePrice(priceNum),
    packageCurrency: currency,
    orderDescription: order.description?.trim() || '_No additional description._',
    orderAnswersSummary: answersText.length > 8000 ? `${answersText.slice(0, 8000)}…` : answersText || '{}',
    address: order.address?.trim() || '_Address on file in the order._',
    scheduleLine,
    chatExcerpt: chatSummary.trim() || '_No chat messages yet._',
  };
}

function applyPlaceholders(template: string, ctx: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_full, key: string) => {
    const v = ctx[key];
    return v !== undefined ? v : `{{${key}}}`;
  });
}

export type RenderedContractTemplate = {
  title: string;
  termsMarkdown: string;
  policiesMarkdown: string;
  scopeSummary: string;
};

export function renderContractTemplate(
  def: ContractTemplateDefinition,
  ctx: Record<string, string>,
): RenderedContractTemplate {
  return {
    title: applyPlaceholders(def.titleTemplate, ctx).slice(0, 200),
    termsMarkdown: applyPlaceholders(def.termsMarkdownTemplate, ctx),
    policiesMarkdown: applyPlaceholders(def.policiesMarkdownTemplate, ctx),
    scopeSummary: applyPlaceholders(def.scopeSummaryTemplate, ctx).slice(0, 4000),
  };
}
