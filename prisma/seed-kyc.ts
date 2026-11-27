import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { BusinessKycFormV1 } from "../lib/kycTypes.js";

const prisma = new PrismaClient();

/** Idempotent Canada-first Business KYC form (database version 2, active). */
export function buildDefaultBusinessKycFormV1(): BusinessKycFormV1 {
  return {
    version: 1,
    title: "Business KYC",
    description: "Canada-first, versioned Level 3 questionnaire",
    sections: [
      { id: "general", title: "General", order: 1 },
      { id: "compliance", title: "Compliance", order: 2 },
      { id: "documents", title: "Documents", order: 3 },
    ],
    fields: [
      {
        id: "businessCategory",
        label: "Business category",
        type: "select",
        required: true,
        order: 1,
        section: "general",
        options: [
          { value: "construction", label: "Construction" },
          { value: "installation", label: "Installation" },
          { value: "plumbing", label: "Plumbing" },
          { value: "professional_services", label: "Professional services" },
          { value: "retail", label: "Retail" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "entityType",
        label: "Entity type",
        type: "select",
        required: true,
        order: 2,
        section: "general",
        options: [
          { value: "sole_proprietorship", label: "Sole proprietorship" },
          { value: "partnership", label: "Partnership" },
          { value: "corporation", label: "Corporation" },
          { value: "cooperative", label: "Cooperative" },
          { value: "non_profit", label: "Non-profit" },
        ],
      },
      {
        id: "jurisdiction",
        label: "Registration jurisdiction",
        type: "select",
        required: true,
        order: 3,
        section: "general",
        options: ["FEDERAL", "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].map((value) => ({ value, label: value })),
      },
      {
        id: "businessNumber",
        label: "Federal Business Number",
        type: "text",
        required: true,
        order: 4,
        section: "general",
        regex: "^\\d{9}$",
        regexErrorMessage: "Business Number must be exactly 9 digits",
      },
      {
        id: "registrationNumber",
        label: "Corporation/registration number",
        type: "text",
        required: false,
        order: 5,
        section: "general",
        requiredForCategories: ["partnership", "corporation", "cooperative", "non_profit"],
        regex: "^[A-Z0-9][A-Z0-9 -]{2,30}$",
        regexErrorMessage: "Use the format shown on the registration document",
      },
      {
        id: "businessAddress",
        label: "Business address",
        type: "address",
        required: true,
        order: 6,
        section: "general",
      },
      {
        id: "businessPhone",
        label: "Business phone",
        type: "phone",
        required: true,
        order: 7,
        section: "general",
      },
      {
        id: "insuranceStatus",
        label: "Liability insurance status",
        type: "select",
        required: true,
        order: 8,
        section: "compliance",
        options: [
          { value: "insured", label: "Insured" },
          { value: "uninsured", label: "Uninsured" },
          { value: "not_required", label: "Not required" },
        ],
      },
      {
        id: "insurancePolicyNumber",
        label: "Insurance policy number",
        type: "text",
        required: false,
        order: 9,
        section: "compliance",
        showIf: { fieldId: "insuranceStatus", equals: "insured" },
      },
      {
        id: "insurerName",
        label: "Insurance company",
        type: "text",
        required: false,
        order: 10,
        section: "compliance",
        showIf: { fieldId: "insuranceStatus", equals: "insured" },
      },
      {
        id: "insuranceExpiry",
        label: "Insurance expiry",
        type: "date",
        required: false,
        order: 11,
        section: "compliance",
        showIf: { fieldId: "insuranceStatus", equals: "insured" },
        expiryMinMonths: 3,
      },
      {
        id: "insuranceCertificate",
        label: "Insurance certificate",
        type: "file",
        required: false,
        order: 12,
        section: "compliance",
        showIf: { fieldId: "insuranceStatus", equals: "insured" },
        accept: ["application/pdf", "image/*"],
        maxFileSizeMb: 10,
        maxFiles: 1,
      },
      {
        id: "businessRegistrationDocument",
        label: "Business registration",
        type: "file",
        required: true,
        order: 13,
        section: "documents",
        accept: ["application/pdf", "image/*"],
        maxFiles: 1,
      },
      {
        id: "ownerIdentityDocument",
        label: "Owner ID",
        type: "file",
        required: true,
        order: 14,
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

  const existing = await client.businessKycFormSchema.findUnique({ where: { version: 2 } });
  if (!existing) {
    await client.businessKycFormSchema.create({ data: {
      version: 2,
      isActive: true,
      schema: JSON.parse(JSON.stringify(defaultForm)),
      description: "Canada-first Level 3 (immutable seed)",
      publishedAt: new Date(),
    } });
  } else {
    await client.businessKycFormSchema.update({
      where: { version: 2 }, data: {
      isActive: true,
    } });
  }

  await client.businessKycFormSchema.updateMany({
    where: { version: { not: 2 } },
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
