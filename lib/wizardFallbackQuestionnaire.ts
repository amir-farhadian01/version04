import type { ServiceQuestionnaireV1 } from './serviceDefinitionTypes.js';

/**
 * When a ServiceCatalog has no `dynamicFieldsSchema` (or JSON is invalid),
 * order submit and the wizard still use a minimal valid questionnaire so
 * customers are not blocked.
 *
 * TODO: Admin must add custom questionnaire fields to this catalog in the admin panel.
 */
export function minimalFallbackQuestionnaire(): ServiceQuestionnaireV1 {
  return {
    version: 1,
    title: 'Service details',
    description: 'A few optional details while this service type has no custom questionnaire yet.',
    sections: [{ id: 'basics', title: 'Basics', order: 0 }],
    fields: [
      {
        id: 'fallback_service_address',
        label: 'Service address (if different from the address you entered earlier)',
        type: 'text',
        required: false,
        order: 1,
        section: 'basics',
      },
      {
        id: 'fallback_job_notes',
        label: 'Notes for the provider',
        type: 'textarea',
        required: false,
        order: 2,
        section: 'basics',
      },
    ],
  };
}
