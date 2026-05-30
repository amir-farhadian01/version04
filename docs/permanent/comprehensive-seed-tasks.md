# Comprehensive Seed Data for Neighborly UI Testing

> Created: 2026-05-30T21:59:15.899Z
> Total tasks: 10

---

## TASK 1: Create 10 business owners + 2 customer users

Create 10 unique provider users (one per business) and 2 customer users. All with password '12345678' hashed via bcrypt. Properties: email, displayName, firstName, lastName, role, password, isVerified, status, bio, location (Toronto).

---

## TASK 2: Create 10 Companies with full profiles

Create 10 Company records: Metro Hair Studio, QuickFix Auto Repair, Elite Insurance Brokers, Natural CanaGas Fuel, CleanHome Plumbing, Toronto Wellness Spa, Canary Logistics, TrueStay Legal Services, EcoPower Solar, Simply Home Services. Each with: name, slug, slogan, about, logoUrl, coverImageUrl, address, city, postalCode, phone, email, website, type, kycStatus. Link ownerId to corresponding provider user. Set companyId on users.

---

## TASK 3: Create BusinessPortfolios, BusinessHours, BusinessVerification, BusinessTrustScore

For each of the 10 companies, create: BusinessPortfolio (history, mission, galleryUrls, businessHours JSON, tags), BusinessHours records (7 days per company with open/close times), BusinessVerification (licenseNumber, licenseVerifiedAt, hasLiabilityInsurance, insuranceVerifiedAt), BusinessTrustScore (kycVerified, avgRating 4.0-5.0, reviewCount, totalScore).

---

## TASK 4: Create Categories, ServiceCatalogs, Products, and ServicePackages

Upsert 10 business categories under 'Business Services' parent. Create 2-3 ServiceCatalogs per business (e.g., 'Men's Haircut', 'Women's Styling', 'Color Treatment' for hair studio). Create inventory Products. Create ProviderServicePackages with BOM lines using existing upsert patterns from seed-provider-inventory.ts.

---

## TASK 5: Create 30 Business Posts in Explorer

Create 3 posts per business (30 total) with varied types: Fixed Price, Negotiable, Appointment. Each post: authorId=business owner, categoryId=matching category, isBusinessPost=true, caption (English+Persian), images (Unsplash URLs), locationId (Toronto), moderationStatus=approved, publishedAt=now.

---

## TASK 6: Create 15 General Posts in Explorer

Create 15 general posts in 5 groups: Community (3), Sports (3), Events (3), News (3), Skills/Barter (3). Each: authorId=customer user, categoryId=General child category, isBusinessPost=false, caption (English+Persian), images, location, moderationStatus=approved, publishedAt=now.

---

## TASK 7: Create 10 Demo Orders

Create 10 orders with statuses: 2 pending, 2 accepted, 2 in-progress, 2 completed, 2 cancelled. Link customerId and serviceCatalogId. Set matchedWorkspaceId to business companies. Include scheduledAt, address, amount/price data.

---

## TASK 8: Create 15 Demo Notifications

Create 15 notifications across users with types: order-status, new-message, business-update, event-reminder, review-request. Include title, message, isRead=false, createdAt spread across recent days.

---

## TASK 9: Create 10 Demo Reviews

Create 10 OrderReview records for completed orders. Ratings 3-5. Include reviewText (realistic reviews). Link to orders that have matchedWorkspaceId.

---

## TASK 10: Wire into main seed.ts and run verification

Add seedComprehensive() call to prisma/seed.ts. Run npx prisma db seed. Verify all data exists via database queries. Verify /biz/[companyId] loads correctly.

---

