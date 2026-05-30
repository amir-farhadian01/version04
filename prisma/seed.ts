import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { runSeedKyc } from "./seed-kyc.js";
import { seedProviderInventoryAndPackages } from "./seed-provider-inventory.js";
import { seedPosts } from "./seed-posts.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("12345678", 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@neighborly.local" },
    update: { displayName: "Owner Admin", role: "owner", password: passwordHash, isVerified: true },
    create: {
      email: "owner@neighborly.local",
      displayName: "Owner Admin",
      role: "owner",
      password: passwordHash,
      isVerified: true,
      status: "active",
    },
  });

  const provider = await prisma.user.upsert({
    where: { email: "provider@neighborly.local" },
    update: { displayName: "Sample Provider", role: "provider", password: passwordHash, isVerified: true },
    create: {
      email: "provider@neighborly.local",
      displayName: "Sample Provider",
      role: "provider",
      password: passwordHash,
      isVerified: true,
      status: "active",
      bio: "Experienced provider for home services.",
      location: "Vancouver",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@neighborly.local" },
    update: { displayName: "Sample Customer", role: "customer", password: passwordHash },
    create: {
      email: "customer@neighborly.local",
      displayName: "Sample Customer",
      role: "customer",
      password: passwordHash,
      status: "active",
      location: "Vancouver",
    },
  });

  await prisma.user.upsert({
    where: { email: "support@neighborly.local" },
    update: { displayName: "Support Team", role: "support", password: passwordHash },
    create: {
      email: "support@neighborly.local",
      displayName: "Support Team",
      role: "support",
      password: passwordHash,
      status: "active",
    },
  });

  const company = await prisma.company.upsert({
    where: { ownerId: provider.id },
    update: {
      name: "Neighborly Prime Services",
      slogan: "Trusted local help, fast.",
      about: "Sample company seeded for dashboard demos.",
      slug: "neighborly-prime",
      type: "business",
      kycStatus: "verified",
    },
    create: {
      ownerId: provider.id,
      name: "Neighborly Prime Services",
      slogan: "Trusted local help, fast.",
      about: "Sample company seeded for dashboard demos.",
      slug: "neighborly-prime",
      type: "business",
      kycStatus: "verified",
    },
  });

  await prisma.user.update({ where: { id: provider.id }, data: { companyId: company.id } });

  await seedProviderInventoryAndPackages(prisma, provider.id, company.id, passwordHash);

  const categoriesCount = await prisma.category.count();
  if (categoriesCount === 0) {
    const home = await prisma.category.create({ data: { name: "Home", description: "Household services" } });
    const tech = await prisma.category.create({ data: { name: "Tech", description: "Tech and device support" } });
    await prisma.category.createMany({
      data: [
        { name: "Cleaning", parentId: home.id },
        { name: "Plumbing", parentId: home.id },
        { name: "Electrical", parentId: home.id },
        { name: "Gardening", parentId: home.id },
        { name: "PC Repair", parentId: tech.id },
        { name: "Network Setup", parentId: tech.id },
      ],
    });
  }

  let serviceA = await prisma.service.findFirst({ where: { title: "Deep Home Cleaning", providerId: provider.id } });
  if (!serviceA) {
    serviceA = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: "Deep Home Cleaning",
        category: "cleaning",
        price: 89,
        description: "Full apartment deep-clean with eco products.",
        rating: 4.8,
        reviewsCount: 37,
      },
    });
  }

  let serviceB = await prisma.service.findFirst({ where: { title: "Express Plumbing Fix", providerId: provider.id } });
  if (!serviceB) {
    serviceB = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: "Express Plumbing Fix",
        category: "plumbing",
        price: 120,
        description: "Fast diagnostics and leak fix.",
        rating: 4.7,
        reviewsCount: 22,
      },
    });
  }

  const requestExists = await prisma.request.findFirst({ where: { customerId: customer.id, serviceId: serviceA.id } });
  let request = requestExists;
  if (!request) {
    request = await prisma.request.create({
      data: {
        customerId: customer.id,
        providerId: provider.id,
        serviceId: serviceA.id,
        status: "pending",
        details: "Need cleaning this weekend.",
      },
    });
  }

  const contractExists = await prisma.contract.findFirst({ where: { requestId: request.id } });
  if (!contractExists) {
    await prisma.contract.create({
      data: {
        requestId: request.id,
        customerId: customer.id,
        providerId: provider.id,
        amount: 89,
        status: "pending",
        terms: "Sample seeded contract.",
      },
    });
  }

  // Seed 45 demo posts (30 business + 15 general) for feed/explorer UI testing
  await seedPosts(prisma, provider.id);

  const ticketCount = await prisma.ticket.count({ where: { creatorId: customer.id } });
  if (ticketCount === 0) {
    await prisma.ticket.create({
      data: {
        creatorId: customer.id,
        recipientId: provider.id,
        type: "client_to_provider",
        subject: "Question about schedule",
        status: "open",
        messages: [
          { from: "customer", text: "Can we move the job to Sunday?", at: new Date().toISOString() },
        ],
      },
    });
  }

  const notifCount = await prisma.notification.count({ where: { userId: provider.id } });
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: provider.id,
          title: "New request",
          message: "You have a new service request",
          type: "request",
          link: "/dashboard?tab=requests",
        },
        {
          userId: customer.id,
          title: "Welcome",
          message: "Your account is ready.",
          type: "system",
          link: "/dashboard",
        },
      ],
    });
  }

  // KYC model is named `KYC` in Prisma schema and may map to `kYC` client field.
  // To keep seed robust across client naming differences, create via raw SQL upsert.
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "KYC" ("id","userId","type","status","details","createdAt")
      VALUES ($3, $1, 'business', 'verified', $2::jsonb, NOW())
      ON CONFLICT ("userId")
      DO UPDATE SET "type"='business',"status"='verified',"details"=$2::jsonb
    `,
    provider.id,
    JSON.stringify({ level: 2, reviewedBy: owner.id }),
    `seed-kyc-${provider.id}`,
  );

  await prisma.systemConfig.upsert({
    where: { key: "global" },
    update: {
      taxRate: 5,
      commissionRate: 10,
      defaultCreditLimit: 300,
      paymentMethods: ["platform", "cash", "card"],
    },
    create: {
      key: "global",
      taxRate: 5,
      commissionRate: 10,
      defaultCreditLimit: 300,
      paymentMethods: ["platform", "cash", "card"],
    },
  });

  await prisma.page.upsert({
    where: { slug: "about" },
    update: { title: "About Neighborly", content: "Seeded page content", status: "published" },
    create: {
      title: "About Neighborly",
      slug: "about",
      content: "Seeded page content",
      status: "published",
    },
  });

  await prisma.legalPolicy.upsert({
    where: { id: "seed-terms-v1" },
    update: { title: "Terms of Service", content: "Seed policy text", version: "v1" },
    create: { id: "seed-terms-v1", title: "Terms of Service", content: "Seed policy text", version: "v1" },
  });

  await runSeedKyc(prisma);

  console.log("Seed complete.");
  console.log("Owner: owner@neighborly.local / 12345678");
  console.log("Provider: provider@neighborly.local / 12345678");
  console.log("Customer: customer@neighborly.local / 12345678");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
