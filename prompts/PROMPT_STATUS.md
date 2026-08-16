# Prompt Status Dashboard

> Auto-updated by QualityGuard agent. Last reviewed: 2026-08-16

---

## `prompts/flutter-feed/` — Flutter Feed Feature

| # | Prompt File | Topic | Status | Evidence |
|---|-------------|-------|--------|----------|
| 01 | `01-merge-duplicate-feeds.md` | Merge duplicate Feed screens | ✅ **DONE** | `flutter_project/lib/features/feed/feed_screen.dart` exists. Widgets extracted to `features/feed/widgets/` (post_card, stories_row, business_card, feed_skeleton). `explorer_screen.dart` removed from explorer/. `social_screen.dart` — needs verification. |
| 02 | `02-post-creation-screen.md` | Post creation screen | ⚠️ **PARTIAL** | `create_post_screen.dart` exists but at wrong path: `screens/post/` instead of `features/post/`. FAB connection to feed screen — unverified. Upload logic uses `Future.delayed` (simulated, not real API). |
| 03 | `03-post-detail-comments.md` | Post detail + comments | ⏳ **PENDING** | `post_detail_screen.dart` exists in `screens/` root but appears to be old. No `features/post/` version. Needs verification. |
| 04 | `04-story-creation.md` | Story creation screen | ⏳ **PENDING** | `story_screen.dart` exists in `screens/explorer/` — this is story *viewer*, not creator. No `create_story_screen.dart` found. |
| 05 | `05-qa-verification.md` | Full QA verification pass | ❌ **BLOCKED** | Cannot run until prompts 02–04 are fully complete. QA checklist items unverified. |

---

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ **DONE** | Implementation found, matches prompt requirements |
| ⚠️ **PARTIAL** | Implementation started but incomplete or at wrong path |
| ⏳ **PENDING** | Not yet started |
| ❌ **BLOCKED** | Depends on other incomplete prompts |

---

## Next Actions (Priority Order)

1. **[PARTIAL → DONE]** Move `create_post_screen.dart` from `screens/post/` → `features/post/`
   - Wire real upload API (remove `Future.delayed` stub)
   - Add FAB to `features/feed/feed_screen.dart`
   - Update route in `main.dart`

2. **[PENDING → DONE]** Implement `03-post-detail-comments.md`
   - Create `flutter_project/lib/features/post/post_detail_screen.dart`
   - Real comments API connection

3. **[PENDING → DONE]** Implement `04-story-creation.md`
   - Create `flutter_project/lib/features/stories/create_story_screen.dart`

4. **[BLOCKED → DONE]** Run `05-qa-verification.md` after above complete

---

## Files to Clean Up (Identified by QualityGuard)

### Duplicate/Conflicting Files
- [ ] `PORTS.md` in root AND `docs/PORTS.md` — keep only `docs/PORTS.md`
- [ ] `AGENTS.md` in root AND `docs/AGENTS.md` — keep only `docs/AGENTS.md`
- [ ] `flutter_project/lib/main.dart<` — directory with `<` in name, likely git artifact
- [ ] `docs/m` — file with no extension and single-char name, likely accidental

### Temp/Runtime Files (should not be in repo)
- [ ] `.start-all-pids` — PID file, add to `.gitignore`
- [ ] `start-commands.txt` — move content to README or `.clinerules`
- [ ] `uploads/` — add to `.gitignore`, remove from repo

### Verify These
- [ ] `infra/` vs `docker/` — check for overlap
- [ ] `lib/` (root) vs `flutter_project/lib/` — why is there a root `lib/`?
- [ ] `metadata.json` — what is this for?
- [ ] `index.html` (root) — duplicate of `frontend/index.html`?

---

_This file is maintained by QualityGuard. Update status manually or run the prompt-checker script._
