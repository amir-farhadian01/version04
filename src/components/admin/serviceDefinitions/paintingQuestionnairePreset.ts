/**
 * Preset questionnaire schema for residential painting services.
 * Used by seed-provider-inventory.ts to populate dynamicFieldsSchema.
 *
 * MUST satisfy `isServiceQuestionnaireV1` (lib/serviceDefinitionTypes.ts):
 * numeric `version: 1`, a `sections` array, and every field carrying
 * `order` (+ `section`). The single `photo` field lets the wizard's
 * generic photo uploader map uploads to a schema field on submit.
 */
export const PAINTING_SERVICE_QUESTIONNAIRE = {
  version: 1,
  title: "Residential Painting Questionnaire",
  description: "Please provide details about your painting project.",
  sections: [{ id: "project", title: "Project Details", order: 0 }],
  fields: [
    {
      id: "room_type",
      type: "select",
      label: "Room Type",
      required: true,
      order: 1,
      section: "project",
      options: [
        { value: "living_room", label: "Living Room" },
        { value: "bedroom", label: "Bedroom" },
        { value: "kitchen", label: "Kitchen" },
        { value: "bathroom", label: "Bathroom" },
        { value: "hallway", label: "Hallway" },
        { value: "exterior", label: "Exterior" },
        { value: "multiple", label: "Multiple Rooms" },
      ],
    },
    {
      id: "square_footage",
      type: "number",
      label: "Approximate Square Footage",
      required: true,
      order: 2,
      section: "project",
      placeholder: "e.g. 500",
    },
    {
      id: "project_photos",
      type: "photo",
      label: "Photos of the space",
      required: false,
      order: 3,
      section: "project",
      maxFiles: 5,
      accept: ["image/png", "image/jpeg", "image/webp"],
    },
    {
      id: "paint_type",
      type: "select",
      label: "Paint Type Preferred",
      required: false,
      order: 4,
      section: "project",
      options: [
        { value: "matte", label: "Matte" },
        { value: "eggshell", label: "Eggshell" },
        { value: "satin", label: "Satin" },
        { value: "semi_gloss", label: "Semi-Gloss" },
        { value: "gloss", label: "Gloss" },
      ],
    },
    {
      id: "ceiling_height",
      type: "select",
      label: "Ceiling Height",
      required: false,
      order: 5,
      section: "project",
      options: [
        { value: "standard", label: "Standard (8-9 ft)" },
        { value: "high", label: "High (10-12 ft)" },
        { value: "cathedral", label: "Cathedral / Vaulted" },
      ],
    },
    {
      id: "needs_repair",
      type: "boolean",
      label: "Are there any wall repairs needed before painting?",
      required: false,
      order: 6,
      section: "project",
    },
    {
      id: "furniture_moving",
      type: "boolean",
      label: "Do you need help moving furniture?",
      required: false,
      order: 7,
      section: "project",
    },
    {
      id: "preferred_schedule",
      type: "date",
      label: "Preferred Start Date",
      required: false,
      order: 8,
      section: "project",
    },
    {
      id: "additional_notes",
      type: "textarea",
      label: "Additional Notes",
      required: false,
      order: 9,
      section: "project",
      placeholder: "Any special requirements or details...",
    },
  ],
} as const;
;
