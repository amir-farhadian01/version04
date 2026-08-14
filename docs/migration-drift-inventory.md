# Migration Drift Inventory — Orphaned Snapshot Tables

> Generated: 2026-08-14
> Source snapshot: `prisma/migrations/20260525180000_social_layer.sql`
> Branch: `fix/security-critical`

## Context

`prisma/migrations/20260525180000_social_layer.sql` is a full-schema snapshot (a loose
`.sql` file in the migrations root, unlike the proper directory-based migrations). It
defines 54 tables. Cross-referencing each against the `migration.sql` files in all
migration directories shows that 8 tables have **no corresponding migration directory**
(i.e. no incremental migration issues a `CREATE TABLE` for them). These are orphaned
snapshot tables.

## Orphaned snapshot tables

| table name | columns | reason |
|---|---|---|
| BusinessVerification | id, workspaceId, requiresLicense, licenseNumber, licenseDocUrl, licenseVerifiedAt, hasLiabilityInsurance, insuranceDocUrl, insuranceVerifiedAt, verifiedByAdminId, notes, updatedAt | orphaned snapshot |
| Invoice | id, workspaceId, customerId, orderId, status, lineItems, subtotal, tax, total, dueDate, sentAt, paidAt, pdfUrl, notes, createdAt, updatedAt, archivedAt | orphaned snapshot |
| MediaAsset | id, uploaderId, url, thumbnailUrl, mimeType, sizeBytes, duration, moderationStatus, moderationNote, moderatedById, moderatedAt, views, flagCount, createdAt, archivedAt | orphaned snapshot |
| UserAddress | id, userId, label, street, city, province, postalCode, country, latitude, longitude, categoryTags, isDefault, createdAt, archivedAt | orphaned snapshot |
| WorkspaceSocialRole | id, workspaceId, userId, grantedById, createdAt, archivedAt | orphaned snapshot |
| follows | id, followerId, followeeId, createdAt | orphaned snapshot |
| stories | id, authorId, mediaUrl, thumbnailUrl, caption, linkUrl, linkLabel, visibility, views, expiresAt, createdAt, archivedAt | orphaned snapshot |
| story_viewers | id, storyId, userId, viewedAt | orphaned snapshot |

## Drift observations

- **Schema/history divergence:** `BusinessVerification`, `Invoice`, `MediaAsset`,
  `UserAddress`, and `WorkspaceSocialRole` are still models in `prisma/schema.prisma`,
  but no migration directory creates them. These tables exist in the schema without a
  migration path in the incremental history.
- **Legacy social tables:** `follows`, `stories`, and `story_viewers` are absent from
  `prisma/schema.prisma`. They were superseded by the social-feed redesign introduced in
  `20260526190000_add_social_feed_models` (`PostLike`, `PostMedia`, etc.).
