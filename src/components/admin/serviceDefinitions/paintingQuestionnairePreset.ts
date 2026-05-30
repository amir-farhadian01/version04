/**
 * Preset questionnaire schema for residential painting services.
 * Used by seed-provider-inventory.ts to populate dynamicFieldsSchema.
 */
export const PAINTING_SERVICE_QUESTIONNAIRE = {
  version: "1.0",
  title: "Residential Painting Questionnaire",
  description: "Please provide details about your painting project.",
  fields: [
    {
      id: "room_type",
      type: "select",
      label: "Room Type",
      required: true,
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
      placeholder: "e.g. 500",
    },
    {
      id: "paint_type",
      type: "select",
      label: "Paint Type Preferred",
      required: false,
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
    },
    {
      id: "furniture_moving",
      type: "boolean",
      label: "Do you need help moving furniture?",
      required: false,
    },
    {
      id: "preferred_schedule",
      type: "date",
      label: "Preferred Start Date",
      required: false,
    },
    {
      id: "additional_notes",
      type: "textarea",
      label: "Additional Notes",
      required: false,
      placeholder: "Any special requirements or details...",
    },
  ],
};
