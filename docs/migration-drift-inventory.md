# Migration Drift Inventory — Orphaned Snapshot Tables

> Generated: 2026-08-14 · Updated: 2026-08-16 (resolved — migrations added)
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

## Resolution (2026-08-16)

All 8 orphaned tables now have incremental migrations (commit
`fix(prisma): add migrations for 8 active orphaned models`):

| table | migration |
|---|---|
| UserAddress | `20260816000000_add_user_address` |
| BusinessVerification | `20260816010000_add_business_verification` |
| MediaAsset | `20260816020000_add_media_asset` |
| Invoice | `20260816030000_add_invoice` |
| WorkspaceSocialRole | `20260816040000_add_workspace_social_role` |
| stories | `20260816050000_add_story` (model `Story` via `@@map("stories")`) |
| story_viewers | `20260816060000_add_story_viewer` (model `StoryViewer` via `@@map("story_viewers")`) |
| follows | `20260816070000_add_follow` (model `Follow` via `@@map("follows")`) |

## Drift observations

- **Schema/history divergence (resolved):** `BusinessVerification`, `Invoice`,
  `MediaAsset`, `UserAddress`, and `WorkspaceSocialRole` were models in
  `prisma/schema.prisma` with no migration path — now migrated.
- **Social-layer redesign (resolved):** `stories`, `story_viewers`, and `follows` are
  the mapped table names of the current `Story` / `StoryViewer` / `Follow` models
  (`@@map`), not legacy tables. The snapshot defined an older column shape for these
  names; the new migrations create the current schema shape.
- **Enums also recovered:** `ModerationStatus`, `InvoiceStatus`, `PostMediaType`, and
  `StoryVisibility` were defined only in the snapshot; they are now created by the
  migrations above (folded into `add_media_asset`, `add_invoice`, and `add_story`).
- **Missing FK recovered:** `Post.mediaAssetId -> MediaAsset.id`
  (`Post_mediaAssetId_fkey`) existed only in the snapshot; now added by
  `20260816020000_add_media_asset`.
