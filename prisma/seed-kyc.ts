import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { BusinessKycFormV1 } from "../lib/kycTypes.js";

const prisma = new PrismaClient();

/** Idempotent default Business KYC form (version 1, active). */
export function buildDefaultBusinessKycFormV1(): BusinessKycFormV1 {
  return {
    version: 1,
    title: "Business KYC",
    description: "Default seeded questionnaire",
    sections: [
      { id: "general", title: "General", order: 1 },
      { id: "compliance", title: "Compliance", order: 2 },
      { id: "documents", title: "Documents", order: 3 },
    ],
    fields: [
      {
        id: "company_type",
        label: "Company type",
        type: "select",
        required: true,
        order: 1,
        section: "general",
        options: [
          { value: "legal", label: "Legal entity" },
          { value: "natural", label: "Natural person" },
        ],
      },
      {
        id: "company_name",
        label: "Company name",
        type: "text",
        required: true,
        order: 2,
        section: "general",
        regex: "^.{2,120}$",
        regexErrorMessage: "Between 2 and 120 characters",
      },
      {
        id: "registration_number",
        label: "Registration number",
        type: "text",
        required: true,
        order: 3,
        section: "general",
        regex: "^\\d{6,16}$",
        regexErrorMessage: "6–16 digits",
      },
      {
        id: "license_number",
        label: "License number",
        type: "text",
        required: true,
        order: 4,
        section: "general",
        regex: "^[A-Z0-9-]{4,32}$",
        regexErrorMessage: "4–32 uppercase letters, digits, or hyphens",
        inquiry: {
          providerKey: "mock-license-registry",
          payloadFields: ["license_number", "license_expiry"],
        },
      },
      {
        id: "license_expiry",
        label: "License expiry",
        type: "date",
        required: true,
        order: 5,
        section: "general",
        expiryMinMonths: 3,
      },
      {
        id: "business_address",
        label: "Business address",
        type: "address",
        required: true,
        order: 6,
        section: "general",
      },
      {
        id: "business_phone",
        label: "Business phone",
        type: "phone",
        required: true,
        order: 7,
        section: "general",
      },
      {
        id: "has_liability_insurance",
        label: "Liability insurance",
        type: "boolean",
        required: true,
        order: 8,
        section: "compliance",
        requiredForCategories: ["construction", "installation", "plumbing"],
      },
      {
        id: "insurance_expiry",
        label: "Insurance expiry",
        type: "date",
        required: false,
        order: 9,
        section: "compliance",
        showIf: { fieldId: "has_liability_insurance", equals: true },
        expiryMinMonths: 3,
      },
      {
        id: "insurance_document",
        label: "Insurance document",
        type: "file",
        required: false,
        order: 10,
        section: "compliance",
        showIf: { fieldId: "has_liability_insurance", equals: true },
        accept: ["application/pdf", "image/*"],
        maxFileSizeMb: 10,
        maxFiles: 1,
      },
      {
        id: "business_registration_doc",
        label: "Business registration",
        type: "file",
        required: true,
        order: 11,
        section: "documents",
        accept: ["application/pdf", "image/*"],
        maxFiles: 1,
      },
      {
        id: "owner_id_doc",
        label: "Owner ID",
        type: "file",
        required: true,
        order: 12,
        section: "documents",
        accept: ["application/pdf", "image/*"],
        maxFiles: 1,
      },
    ],
  };
}

export async function runSeedKyc(client: PrismaClient = prisma): Promise<void> {
  const defaultForm = buildDefaultBusinessKycFormV1();

  await client.businessKycFormSchema.updateMany({
    data: { isActive: false },
  });

  await client.businessKycFormSchema.upsert({
    where: { version: 1 },
    create: {
      version: 1,
      isActive: true,
      schema: JSON.parse(JSON.stringify(defaultForm)),
      description: "Default (seed)",
      publishedAt: new Date(),
    },
    update: {
      isActive: true,
      schema: JSON.parse(JSON.stringify(defaultForm)),
      description: "Default (seed)",
      publishedAt: new Date(),
    },
  });

  await client.businessKycFormSchema.updateMany({
    where: { version: { not: 1 } },
    data: { isActive: false },
  });
}

async function main() {
  await runSeedKyc();
  console.log("KYC form schema seed complete (version 1 active).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
