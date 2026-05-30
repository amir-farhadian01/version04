/**
 * Idempotent seed: ServiceCatalog tiles, workspace inventory (Product), and
 * ProviderServicePackage rows with BOM (ProductInPackage) for demo workspaces.
 *
 * BookingMode in schema: booking | direct_booking | hybrid | quote_first | walk_in | inherit_from_catalog
 * (see ADR-0026/0027). Margin is derived on read via lib/packageMargin.ts (ADR-0030).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { BookingMode } from "@prisma/client";
import { computePackageMargin } from "../lib/packageMargin.js";
import { PAINTING_RESIDENTIAL_QUESTIONNAIRE } from "../lib/paintingResidentialQuestionnaire.js";

async function ensureCategory(
  prisma: PrismaClient,
  name: string,
  parentId: string | null,
  description?: string,
): Promise<{ id: string }> {
  const existing = await prisma.category.findFirst({
    where: { name, parentId: parentId === null ? null : parentId },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      name,
      parentId,
      ...(description != null ? { description } : {}),
    },
  });
}

async function upsertServiceCatalog(
  prisma: PrismaClient,
  args: {
    slug: string;
    name: string;
    categoryId: string;
    category: string;
    subcategory?: string;
    description?: string;
    lockedBookingMode?: string | null;
    dynamicFieldsSchema?: Prisma.InputJsonValue | null;
  },
) {
  const existing = await prisma.serviceCatalog.findFirst({ where: { slug: args.slug } });
  const schemaData =
    args.dynamicFieldsSchema !== undefined
      ? { dynamicFieldsSchema: args.dynamicFieldsSchema }
      : {};
  if (existing) {
    return prisma.serviceCatalog.update({
      where: { id: existing.id },
      data: {
        name: args.name,
        categoryId: args.categoryId,
        category: args.category,
        subcategory: args.subcategory,
        description: args.description,
        lockedBookingMode: args.lockedBookingMode ?? null,
        isActive: true,
        archivedAt: null,
        ...schemaData,
      },
    });
  }
  return prisma.serviceCatalog.create({
    data: {
      slug: args.slug,
      name: args.name,
      categoryId: args.categoryId,
      category: args.category,
      subcategory: args.subcategory,
      description: args.description,
      lockedBookingMode: args.lockedBookingMode ?? null,
      isActive: true,
      ...schemaData,
    },
  });
}

async function upsertProduct(
  prisma: PrismaClient,
  workspaceId: string,
  sku: string,
  data: {
    name: string;
    description?: string;
    category?: string;
    unit: string;
    unitPrice: number;
    currency?: string;
    stockQuantity: number | null;
  },
) {
  return prisma.product.upsert({
    where: { workspaceId_sku: { workspaceId, sku } },
    create: {
      workspaceId,
      sku,
      name: data.name,
      description: data.description,
      category: data.category,
      unit: data.unit,
      unitPrice: data.unitPrice,
      currency: data.currency ?? "CAD",
      stockQuantity: data.stockQuantity,
      isActive: true,
      archivedAt: null,
    },
    update: {
      name: data.name,
      description: data.description,
      category: data.category,
      unit: data.unit,
      unitPrice: data.unitPrice,
      currency: data.currency ?? "CAD",
      stockQuantity: data.stockQuantity,
      isActive: true,
      archivedAt: null,
    },
  });
}

async function upsertProviderPackage(
  prisma: PrismaClient,
  args: {
    providerId: string;
    workspaceId: string;
    serviceCatalogId: string;
    name: string;
    description?: string | null;
    finalPrice: number;
    currency?: string;
    bookingMode: BookingMode;
    durationMinutes?: number | null;
  },
) {
  const existing = await prisma.providerServicePackage.findFirst({
    where: {
      workspaceId: args.workspaceId,
      serviceCatalogId: args.serviceCatalogId,
      name: args.name,
    },
  });
  const base = {
    providerId: args.providerId,
    workspaceId: args.workspaceId,
    serviceCatalogId: args.serviceCatalogId,
    name: args.name,
    description: args.description ?? undefined,
    finalPrice: args.finalPrice,
    currency: args.currency ?? "CAD",
    bookingMode: args.bookingMode,
    durationMinutes: args.durationMinutes ?? undefined,
    isActive: true,
    archivedAt: null,
  };
  if (existing) {
    return prisma.providerServicePackage.update({
      where: { id: existing.id },
      data: base,
    });
  }
  return prisma.providerServicePackage.create({ data: base });
}

async function replaceBom(
  prisma: PrismaClient,
  packageId: string,
  lines: Array<{
    productId: string;
    quantity: number;
    notes?: string | null;
    sortOrder: number;
  }>,
) {
  if (!lines.length) {
    throw new Error(`Package ${packageId}: BOM must have at least one line`);
  }
  await prisma.productInPackage.deleteMany({ where: { packageId } });
  for (const line of lines) {
    const product = await prisma.product.findUnique({ where: { id: line.productId } });
    if (!product) throw new Error(`Missing product ${line.productId}`);
    await prisma.productInPackage.create({
      data: {
        packageId,
        productId: product.id,
        quantity: line.quantity,
        notes: line.notes ?? undefined,
        sortOrder: line.sortOrder,
        snapshotUnitPrice: product.unitPrice,
        snapshotCurrency: product.currency,
        snapshotProductName: product.name,
        snapshotUnit: product.unit,
      },
    });
  }
}

function logMargin(label: string, pkg: { finalPrice: number; currency: string }, bom: { quantity: number; snapshotUnitPrice: number; snapshotCurrency: string }[]) {
  const m = computePackageMargin(pkg, bom);
  console.log(
    `[seed packages] ${label}: finalPrice=${pkg.finalPrice} ${pkg.currency} bomCost=${m.bomCost.toFixed(2)} margin=${m.margin.toFixed(2)} marginPercent=${m.marginPercent.toFixed(1)}%`,
  );
}

export async function seedProviderInventoryAndPackages(
  prisma: PrismaClient,
  providerId: string,
  workspaceId: string,
  passwordHash: string,
): Promise<void> {
  const autoRoot = await ensureCategory(prisma, "Automotive", null, "Vehicle maintenance and repair");
  const autoMaintenance = await ensureCategory(prisma, "Maintenance", autoRoot.id, "Scheduled and preventive maintenance");

  const homeRoot = await ensureCategory(prisma, "Home", null, "Household services");
  const paintingCat = await ensureCategory(prisma, "Painting and Power", homeRoot.id, "Interior painting and related trades");

  const personalRoot = await ensureCategory(prisma, "Personal Care", null, "Beauty and personal services");
  const barberCat = await ensureCategory(prisma, "Barbering", personalRoot.id, "Haircuts and grooming");

  const catalogHaircut = await upsertServiceCatalog(prisma, {
    slug: "seed-catalog-haircut-quick",
    name: "Men's Haircut",
    categoryId: barberCat.id,
    category: "Personal Care",
    subcategory: "Barbering",
    description: "Standard haircut service type for marketplace discovery.",
  });

  const catalogPainting = await upsertServiceCatalog(prisma, {
    slug: "seed-catalog-residential-painting",
    name: "Residential Interior Painting",
    categoryId: paintingCat.id,
    category: "Home",
    subcategory: "Painting and Power",
    description: "Interior painting estimates and scheduled jobs.",
    dynamicFieldsSchema: JSON.parse(JSON.stringify(PAINTING_RESIDENTIAL_QUESTIONNAIRE)) as Prisma.InputJsonValue,
  });

  const catalogOilChange = await upsertServiceCatalog(prisma, {
    slug: "seed-catalog-oil-change-toyota",
    name: "Toyota SUV Oil Change",
    categoryId: autoMaintenance.id,
    category: "Automotive",
    subcategory: "Maintenance",
    description: "Synthetic oil change packages for Toyota Highlander-class vehicles.",
  });

  const catalogMaintenanceBundle = await upsertServiceCatalog(prisma, {
    slug: "seed-catalog-maintenance-bundle",
    name: "Vehicle Maintenance Bundle",
    categoryId: autoMaintenance.id,
    category: "Automotive",
    subcategory: "Maintenance",
    description: "Bundled oil service plus air filter inspection.",
  });

  const laborHour = await upsertProduct(prisma, workspaceId, "SEED-LABOR-HR", {
    name: "Labor Hour",
    description: "Billable labor hour (virtual stock).",
    category: "Labor",
    unit: "hour",
    unitPrice: 25,
    stockQuantity: null,
  });

  const laborOil = await upsertProduct(prisma, workspaceId, "SEED-LABOR-OIL", {
    name: "Labor - Oil Change",
    description: "Technician time for oil and filter service.",
    category: "Labor",
    unit: "hour",
    unitPrice: 30,
    stockQuantity: null,
  });

  const oil5w30 = await upsertProduct(prisma, workspaceId, "SEED-OIL-5W30", {
    name: "Synthetic Motor Oil 5W-30",
    description: "4L bottle synthetic blend.",
    category: "Fluids",
    unit: "bottle",
    unitPrice: 32,
    stockQuantity: 50,
  });

  const filterToyota = await upsertProduct(prisma, workspaceId, "SEED-FILTER-TOYOTA", {
    name: "Oil Filter - Toyota OEM",
    description: "OEM-spec spin-on filter.",
    category: "Parts",
    unit: "each",
    unitPrice: 18,
    stockQuantity: 30,
  });

  const airFilter = await upsertProduct(prisma, workspaceId, "SEED-AIR-FILTER", {
    name: "Air Filter",
    description: "Engine air filter element.",
    category: "Parts",
    unit: "each",
    unitPrice: 14,
    stockQuantity: 40,
  });

  const paintPremium = await upsertProduct(prisma, workspaceId, "SEED-PAINT-PREMIUM", {
    name: "Premium Interior Paint",
    description: "One gallon premium interior latex.",
    category: "Materials",
    unit: "gallon",
    unitPrice: 45,
    stockQuantity: 20,
  });

  const brushSet = await upsertProduct(prisma, workspaceId, "SEED-BRUSH-SET", {
    name: "Professional Brush Set",
    description: "Assorted brushes for trim and cutting in.",
    category: "Materials",
    unit: "each",
    unitPrice: 22,
    stockQuantity: 15,
  });

  const inspectionLine = await upsertProduct(prisma, workspaceId, "SEED-VEHICLE-INSPECT", {
    name: "Courtesy Multi-Point Inspection",
    description: "Visual inspection including air filter housing.",
    category: "Labor",
    unit: "flat",
    unitPrice: 20,
    stockQuantity: null,
  });

  const pkgHaircut = await upsertProviderPackage(prisma, {
    providerId,
    workspaceId,
    serviceCatalogId: catalogHaircut.id,
    name: "Haircut - Quick",
    description: "Walk-in friendly haircut with standard finish.",
    finalPrice: 25,
    bookingMode: BookingMode.direct_booking,
    durationMinutes: 30,
  });
  await replaceBom(prisma, pkgHaircut.id, [
    { productId: laborHour.id, quantity: 1, sortOrder: 0 },
  ]);
  const bomHair = await prisma.productInPackage.findMany({
    where: { packageId: pkgHaircut.id },
    select: { quantity: true, snapshotUnitPrice: true, snapshotCurrency: true },
  });
  logMargin("Haircut - Quick", { finalPrice: pkgHaircut.finalPrice, currency: pkgHaircut.currency }, bomHair);

  const paintingNotes =
    "Estimate starting point in CAD. Final price confirmed after on-site visit.";
  const pkgPainting = await upsertProviderPackage(prisma, {
    providerId,
    workspaceId,
    serviceCatalogId: catalogPainting.id,
    name: "Residential Painting",
    description: paintingNotes,
    finalPrice: 150,
    bookingMode: BookingMode.inherit_from_catalog,
    durationMinutes: 240,
  });
  await replaceBom(prisma, pkgPainting.id, [
    { productId: laborHour.id, quantity: 4, sortOrder: 0 },
    {
      productId: paintPremium.id,
      quantity: 0.5,
      notes: "Approximately 2L material from one gallon unit",
      sortOrder: 1,
    },
    { productId: brushSet.id, quantity: 1, sortOrder: 2 },
  ]);
  const bomPaint = await prisma.productInPackage.findMany({
    where: { packageId: pkgPainting.id },
    select: { quantity: true, snapshotUnitPrice: true, snapshotCurrency: true },
  });
  logMargin("Residential Painting", { finalPrice: pkgPainting.finalPrice, currency: pkgPainting.currency }, bomPaint);

  const oilBomSum =
    oil5w30.unitPrice * 1 +
    filterToyota.unitPrice * 1 +
    airFilter.unitPrice * 1 +
    laborOil.unitPrice * 0.5;
  const pkgOil = await upsertProviderPackage(prisma, {
    providerId,
    workspaceId,
    serviceCatalogId: catalogOilChange.id,
    name: "Engine Oil Change - Toyota Highlander",
    description:
      "Negotiated scope using synthetic oil, OEM filter, and engine air filter. Typical basket cost drives list price; customer-facing quote may differ (suggested anchor 85 CAD).",
    finalPrice: Math.round(oilBomSum * 100) / 100,
    bookingMode: BookingMode.quote_first,
    durationMinutes: 60,
  });
  await replaceBom(prisma, pkgOil.id, [
    { productId: oil5w30.id, quantity: 1, sortOrder: 0 },
    { productId: filterToyota.id, quantity: 1, sortOrder: 1 },
    { productId: airFilter.id, quantity: 1, sortOrder: 2 },
    { productId: laborOil.id, quantity: 0.5, sortOrder: 3 },
  ]);
  const bomOil = await prisma.productInPackage.findMany({
    where: { packageId: pkgOil.id },
    select: { quantity: true, snapshotUnitPrice: true, snapshotCurrency: true },
  });
  logMargin("Engine Oil Change", { finalPrice: pkgOil.finalPrice, currency: pkgOil.currency }, bomOil);

  const bundleBomTarget = 99;
  const bundleSnapshots =
    oil5w30.unitPrice * 1 +
    filterToyota.unitPrice * 1 +
    laborOil.unitPrice * 0.5 +
    airFilter.unitPrice * 1 +
    inspectionLine.unitPrice * 1;
  if (Math.abs(bundleSnapshots - bundleBomTarget) > 0.01) {
    throw new Error(`Maintenance bundle BOM snapshot sum expected ${bundleBomTarget}, got ${bundleSnapshots}`);
  }
  const pkgBundle = await upsertProviderPackage(prisma, {
    providerId,
    workspaceId,
    serviceCatalogId: catalogMaintenanceBundle.id,
    name: "Maintenance Package",
    description: "Oil and filter change plus air filter inspection. Promotional bundle price.",
    finalPrice: 80,
    bookingMode: BookingMode.quote_first,
    durationMinutes: 75,
  });
  await replaceBom(prisma, pkgBundle.id, [
    { productId: oil5w30.id, quantity: 1, sortOrder: 0 },
    { productId: filterToyota.id, quantity: 1, sortOrder: 1 },
    { productId: laborOil.id, quantity: 0.5, sortOrder: 2 },
    { productId: airFilter.id, quantity: 1, notes: "Includes housing inspection", sortOrder: 3 },
    { productId: inspectionLine.id, quantity: 1, sortOrder: 4 },
  ]);
  const bomBundle = await prisma.productInPackage.findMany({
    where: { packageId: pkgBundle.id },
    select: { quantity: true, snapshotUnitPrice: true, snapshotCurrency: true },
  });
  logMargin("Maintenance Package", { finalPrice: pkgBundle.finalPrice, currency: pkgBundle.currency }, bomBundle);

  const barberUser = await prisma.user.upsert({
    where: { email: "barber-provider@neighborly.local" },
    update: {
      displayName: "Barber Sample Provider",
      role: "provider",
      password: passwordHash,
      isVerified: true,
      status: "active",
    },
    create: {
      email: "barber-provider@neighborly.local",
      displayName: "Barber Sample Provider",
      role: "provider",
      password: passwordHash,
      isVerified: true,
      status: "active",
      bio: "Seeded barber workspace for inventory demos.",
      location: "Vancouver",
    },
  });

  const barberCompany = await prisma.company.upsert({
    where: { ownerId: barberUser.id },
    update: {
      name: "Barber Sample Studio",
      slug: "barber-sample-studio",
      type: "solo",
      kycStatus: "verified",
    },
    create: {
      ownerId: barberUser.id,
      name: "Barber Sample Studio",
      slug: "barber-sample-studio",
      type: "solo",
      kycStatus: "verified",
    },
  });

  await prisma.user.update({ where: { id: barberUser.id }, data: { companyId: barberCompany.id } });

  await upsertProduct(prisma, barberCompany.id, "SEED-BARB-HAIRCUT", {
    name: "Haircut Service",
    description: "Virtual haircut labor line.",
    category: "Labor",
    unit: "flat",
    unitPrice: 25,
    stockQuantity: null,
  });

  await upsertProduct(prisma, barberCompany.id, "SEED-BARB-RETAIL", {
    name: "Hair Product Retail",
    description: "Retail styling SKUs.",
    category: "Retail",
    unit: "each",
    unitPrice: 15,
    stockQuantity: 40,
  });

  console.log(
    "[seed packages] ServiceCatalog slugs: seed-catalog-haircut-quick, seed-catalog-residential-painting, seed-catalog-oil-change-toyota, seed-catalog-maintenance-bundle",
  );
}
