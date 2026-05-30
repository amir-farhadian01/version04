/**
 * Code-defined contract templates (F8 foundation). Explicit IDs and Markdown
 * bodies with `{{placeholderKey}}` tokens. Future AI-generated drafts can write
 * into the same `ContractVersion` workflow without changing this shape.
 */

export type ContractTemplatePlaceholder = {
  /** Token name inside `{{doubleBraces}}` (ASCII identifier). */
  key: string;
  /** Human-readable description for admin/provider UI. */
  label: string;
};

export type ContractTemplateDefinition = {
  /** Stable id used in APIs and `generationContext.templateId`. */
  id: string;
  /** Increments when prose changes materially (audit / migration hints). */
  version: number;
  /** Short label for pickers. */
  title: string;
  /** One-line summary for pickers. */
  description: string;
  /** Markdown; may include `{{placeholders}}`. */
  titleTemplate: string;
  termsMarkdownTemplate: string;
  policiesMarkdownTemplate: string;
  scopeSummaryTemplate: string;
  /** Declares expected placeholders for predictable rendering. */
  placeholders: ContractTemplatePlaceholder[];
};

const STANDARD_PLACEHOLDERS: ContractTemplatePlaceholder[] = [
  { key: 'customerName', label: 'Customer display name' },
  { key: 'providerName', label: 'Matched provider display name' },
  { key: 'workspaceName', label: 'Matched workspace / company name' },
  { key: 'packageName', label: 'Matched package title' },
  { key: 'packagePrice', label: 'Package price (formatted)' },
  { key: 'packageCurrency', label: 'Currency code' },
  { key: 'orderDescription', label: 'Order description' },
  { key: 'orderAnswersSummary', label: 'Structured answers (JSON text)' },
  { key: 'address', label: 'Service address' },
  { key: 'scheduleLine', label: 'Schedule line (date + flexibility)' },
  { key: 'chatExcerpt', label: 'Recent chat excerpt' },
];

export const CONTRACT_TEMPLATE_DEFINITIONS: ContractTemplateDefinition[] = [
  {
    id: 'standard-service-v1',
    version: 1,
    title: 'Standard service agreement',
    description:
      'Balanced Markdown layout with parties, scope from the order, package, schedule, and optional chat excerpt.',
    titleTemplate: 'Service agreement — {{packageName}}',
    termsMarkdownTemplate: [
      '# {{packageName}} — Service agreement',
      '',
      '## Parties',
      '- **Customer:** {{customerName}}',
      '- **Provider:** {{providerName}} ({{workspaceName}})',
      '',
      '## Scope of work',
      '{{orderDescription}}',
      '',
      '### Booking details',
      '- **Structured answers:** {{orderAnswersSummary}}',
      '- **Location:** {{address}}',
      '',
      '## Selected package',
      '{{packageName}} — **{{packagePrice}} {{packageCurrency}}**',
      '',
      '## Schedule',
      '{{scheduleLine}}',
      '',
      '## Recent discussion (reference only)',
      '{{chatExcerpt}}',
      '',
      '## Execution',
      'The provider will perform the work above professionally and in line with applicable laws and safety practices.',
    ].join('\n'),
    policiesMarkdownTemplate: [
      '## Policies',
      '',
      '- Payment and cancellation follow Neighborly platform rules in effect at booking time.',
      '- Raise disputes in order chat or with platform support.',
      '- Either party may request revisions before approval.',
    ].join('\n'),
    scopeSummaryTemplate:
      'Service for {{customerName}} with {{providerName}}: {{packageName}} at {{address}}.',
    placeholders: STANDARD_PLACEHOLDERS,
  },
  {
    id: 'minimal-scope-v1',
    version: 1,
    title: 'Minimal scope letter',
    description: 'Short letter-style draft when you only need parties, package, and schedule.',
    titleTemplate: 'Scope letter — {{packageName}}',
    termsMarkdownTemplate: [
      '**Customer:** {{customerName}}',
      '',
      '**Provider:** {{providerName}}',
      '',
      '**Work:** {{orderDescription}}',
      '',
      '**Package:** {{packageName}} ({{packagePrice}} {{packageCurrency}})',
      '',
      '**When / where:** {{scheduleLine}} · {{address}}',
      '',
      '_Chat reference:_ {{chatExcerpt}}',
    ].join('\n'),
    policiesMarkdownTemplate: 'Neighborly platform terms apply.',
    scopeSummaryTemplate: '{{packageName}} for {{customerName}} — {{scheduleLine}}',
    placeholders: STANDARD_PLACEHOLDERS,
  },
];

const BY_ID = new Map(CONTRACT_TEMPLATE_DEFINITIONS.map((d) => [d.id, d]));

export function listContractTemplateDefinitions(): ContractTemplateDefinition[] {
  return [...CONTRACT_TEMPLATE_DEFINITIONS];
}

export function getContractTemplateDefinition(id: string): ContractTemplateDefinition | undefined {
  return BY_ID.get(id);
}
