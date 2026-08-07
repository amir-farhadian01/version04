# Quick-Start Package — Onboarding, Social Feed & Order Workflow

> Created: 2026-08-06T06:14:05.989Z
> Total tasks: 14

---

## TASK 1: Backend: Add Google & Apple OAuth endpoints

Add POST /auth/google and POST /auth/apple endpoints to routes/auth.ts.

Requirements:
- POST /auth/google: Accept { idToken: string } from Google Sign-In, verify token with Google's tokeninfo endpoint, find or create user by email (normalized), return JWT { accessToken, user }
- POST /auth/apple: Accept { identityToken: string, fullName?: { givenName, familyName } }, verify with Apple's public keys (JWKS), find or create user, return JWT
- Both endpoints MUST normalize email (lowercase, strip dots for Gmail, strip +alias)
- If email already exists, link the social provider (store googleId on User model — already exists)
- Return standard format: { data: { accessToken, user } }
- Add input validation with Zod schemas

Files to modify:
- routes/auth.ts (add two new POST routes)
- lib/jwt.ts (may need new sign method for OAuth users)

Owner: backend

---

## TASK 2: Backend: Add onboarding wizard endpoints

Add POST /auth/onboarding/complete endpoint that saves onboarding data after registration.

Requirements:
- Accept { interests: string[] (category IDs), locationLat, locationLng, address, avatarUrl? }
- Update User record with selected interests (store as JSON on accountPreferences), location, avatar
- Create UserAddress record with tag 'home'
- Mark onboardingComplete = true on User (add field to schema if needed)
- Return updated user profile

Owner: backend

---

## TASK 3: Flutter: Add Google & Apple Sign-In buttons to AuthScreen

Transform auth_screen.dart into an Instagram-style onboarding screen.

Requirements:
- Top section: App logo + "Welcome to NeighborHub" (keep existing)
- Middle: Large Google Sign-In button (styled per Google brand guidelines: white bg, Google 'G' logo, "Continue with Google" text)
- Middle: Apple Sign-In button (black bg, Apple logo, "Continue with Apple" text) — only show on iOS/macOS
- Divider: "or" with horizontal lines
- Bottom: Email login/signup tabs (keep existing, but make them secondary)
- Use google_sign_in Flutter package for Google
- Use sign_in_with_apple Flutter package for Apple
- On success: if first login (new user), navigate to onboarding wizard; if returning user, navigate to /home
- Update AuthService with loginWithGoogle(token) and loginWithApple(token) methods

Files to modify:
- flutter_project/lib/screens/auth_screen.dart (major redesign)
- flutter_project/lib/services/auth_service.dart (add methods)
- flutter_project/pubspec.yaml (add dependencies)

Owner: flutter

---

## TASK 4: Flutter: Build Onboarding Wizard (3 screens)

Create a 3-screen onboarding flow shown after first login.

Screen 1 — Interests:
- Show category tree (from GET /api/categories/tree)
- Multi-select chips with nice animation
- "Continue" button at bottom (enabled when ≥3 selected)
- Instagram-style: each category has an emoji icon

Screen 2 — Location:
- Ask for location permission
- Show map with pin at detected location
- Address field pre-filled from reverse geocode
- "Use my current location" button + manual address entry fallback

Screen 3 — Profile Photo:
- Camera capture or gallery pick
- Circular crop preview
- "Skip" option (can add later)
- "Get Started!" button → calls POST /auth/onboarding/complete → navigates to /home

Progress indicator: 3 dots at top showing current step

Files to create:
- flutter_project/lib/screens/onboarding/onboarding_screen.dart (main wrapper with PageView)
- flutter_project/lib/screens/onboarding/interests_screen.dart
- flutter_project/lib/screens/onboarding/location_screen.dart
- flutter_project/lib/screens/onboarding/photo_screen.dart

Owner: flutter

---

## TASK 5: Flutter: Polish Stories Row (Instagram-level)

Enhance the existing stories_row.dart widget.

Requirements:
- Circular avatar (68dp) with gradient ring (3 colors: pink→orange→purple for unseen, gray for seen)
- Add story indicator: your own story shows a '+' badge for creating new story
- Smooth horizontal scrolling with snap-to-item behavior
- Tap story → full-screen story viewer with:
  - Progress bar at top (segments for multiple stories)
  - Auto-advance after 5 seconds
  - Tap left/right to navigate between stories
  - Swipe down to dismiss
  - Hold to pause
- Stories expire after 24h (backend already handles this)

Files to modify:
- flutter_project/lib/features/feed/widgets/stories_row.dart (enhance)
- flutter_project/lib/screens/explorer/story_screen.dart (enhance viewer)

Owner: flutter

---

## TASK 6: Flutter: Polish Post Card (double-tap like, video, comments)

Enhance the existing post_card.dart widget.

Requirements:
- Video auto-play when visible (muted, with mute/unmute toggle)
- Double-tap anywhere on media → heart animation (scale up + fade out, like Instagram)
- Single tap → pause video or show/hide UI overlay
- Bottom action bar: Like (heart with count), Comment (bubble with count), Direct message, Save (bookmark), Order (if business post with linked service)
- Comment sheet: bottom sheet with comments list + input field
- Save: toggle bookmark, stored to user's saved posts
- Order CTA button (orange gradient, prominent) for business posts with linkedService
- Username/avatar at top → tap to go to profile
- Three-dot menu → Report, Block (for own posts: Edit, Delete, Archive)

Files to modify:
- flutter_project/lib/features/feed/widgets/post_card.dart (major enhancement)
- flutter_project/lib/screens/explorer/comments_screen.dart (enhance)

Owner: flutter

---

## TASK 7: Flutter: Create Post Flow (camera → category → publish)

Build the post creation flow accessible from FAB or top-right camera icon.

Flow:
1. Media picker screen: Camera capture or gallery selection (multiple photos, video)
2. Edit screen: Crop, filters (basic), reorder media, add caption
3. Category selection screen: MUST select a category before publishing (mandatory per spec)
4. Publish: Upload to backend, show progress, navigate to feed

Requirements:
- Use image_picker or wechat_assets_picker for media selection
- Category tree from GET /api/categories/tree
- Business accounts: toggle "Link to service" to attach a bookable service
- Post to POST /api/posts with multipart form data
- After publish: navigate to feed with new post visible at top

Files to create:
- flutter_project/lib/screens/post/create_post_screen.dart
- flutter_project/lib/screens/post/category_picker_screen.dart

Owner: flutter

---

## TASK 8: Flutter: Post → Order Bridge (Book Now CTA)

Implement the bridge between social discovery and ordering.

Requirements:
- On business posts with linkedService (serviceCatalogId), show a prominent "Book Now" button below the post
- Tapping "Book Now" → navigate to NewOrderScreen with service pre-selected and description pre-filled from post caption
- The OrderWizard experience should be streamlined to 3 screens:
  1. Service details (pre-filled from post) + date/time picker
  2. Location confirmation + budget (optional)
  3. Review & Submit
- Backend already supports postId on Order creation — pass postId for analytics
- After order submission: show success animation, navigate to order detail

Files to modify:
- flutter_project/lib/features/feed/widgets/post_card.dart (add Book Now button)
- flutter_project/lib/screens/customer/new_order_screen.dart (streamline to 3 screens)

Owner: flutter

---

## TASK 9: Flutter: One-Tap Reorder from History

Add reorder functionality to order history.

Requirements:
- On order detail screen (completed orders), add "Reorder" button
- Tapping reorder → navigates to NewOrderScreen with ALL fields pre-filled from original order (service, provider, description, address, BOM)
- Only pre-fill; user can edit before submitting
- Backend already supports originalOrderId — pass it to track reorder chain
- After checkout: success toast "Order placed! Same provider, same great service."

Files to modify:
- flutter_project/lib/screens/customer/order_detail_screen.dart (add Reorder button)
- flutter_project/lib/screens/customer/new_order_screen.dart (accept prefill params)

Owner: flutter

---

## TASK 10: Flutter: Commission Visibility in Payment Flow

Show platform commission transparently during payment.

Requirements:
- On payment confirmation screen (before final pay), show breakdown:
  - Service price: $X.XX
  - Platform commission (X%): -$Y.YY
  - Provider receives: $Z.ZZ
- Use existing commission calculation from lib/commissionTracking.ts
- For client view (customer): show total they pay + note "includes platform service fee"
- For provider view (in order detail after completion): show full breakdown
- Add GET /api/orders/:id/commission-breakdown endpoint if not exists

Files to modify:
- flutter_project/lib/screens/customer/new_order_screen.dart (add breakdown before submit)
- flutter_project/lib/screens/customer/order_detail_screen.dart (show breakdown after completion)
- routes/orders.ts or routes/adminOrders.ts (add endpoint if needed)

Owner: flutter + backend

---

## TASK 11: Flutter: Feed Algorithm Integration (location + interests)

Connect the social feed to the backend feed algorithm.

Requirements:
- GET /api/feed returns posts filtered by:
  1. User's location (nearby posts first)
  2. User's selected interests (category matches)
  3. Recency (newer posts first)
  4. Engagement (higher like/comment count boosts score)
- Flutter FeedScreen should call this endpoint on load and on pull-to-refresh
- Infinite scroll with cursor-based pagination
- Implement empty state: "No posts nearby yet. Explore categories or create your first post!"
- Implement loading state: skeleton cards (grey shimmer placeholders)

Files to modify:
- flutter_project/lib/features/feed/feed_screen.dart (use new endpoint)
- flutter_project/lib/services/api_service.dart (add getFeed method)
- routes/feed.ts (create if not exists, or enhance existing)

Owner: flutter + backend

---

## TASK 12: Database: Add onboarding fields + Google/Apple OAuth support

Add necessary database fields.

Requirements:
- Add onboardingCompletedAt DateTime? to User model
- Add onboardingInterests String[] to User model (category IDs)
- googleId field already exists on User model ✅
- Add appleId String? @unique to User model
- Create migration: npx prisma migrate dev --name add_onboarding_and_apple_auth
- Seed test data for categories with emoji icons

Files to modify:
- prisma/schema.prisma

Owner: backend

---

## TASK 13: Testing: Playwright UI Verification for all surfaces

Full Playwright verification across all surfaces.

Test plan:
1. Flutter Web (port 7357):
   - Open auth screen → verify Google/Apple buttons visible
   - Complete email login → verify onboarding wizard appears (3 screens)
   - Complete onboarding → verify home feed loads
   - Open feed → verify stories row, post cards, double-tap like
   - Create post → verify category picker mandatory
   - Tap Book Now on business post → verify order wizard opens
   - Complete order → verify success flow

2. React Frontend (port 5173):
   - Verify Home page loads with banner + utilities + news
   - Verify Explorer page loads with posts
   - Verify login still works with email/password

3. Admin Panel (port 9090):
   - Verify admin login works
   - Verify KYC queue accessible

Screenshots: Save to screenshots/ with descriptive names
Console errors: Must be zero
Mobile viewport: Test all at 375px width

Owner: qa

---

## TASK 14: Documentation: Update ROADMAP, FEATURES, DECISIONS, memory files

Update all documentation to reflect completed work.

Requirements:
- docs/ROADMAP.md: Mark Phase 2 (Social Feed) items as ✅ Done where completed
- docs/FEATURES.md: Update social feed section with new UX specs
- docs/memory/decision-history.md: Log this ADR and all key decisions
- docs/memory/lessons-learned.md: Log lessons from this package implementation
- docs/memory/goal-log.md: Create entry for this goal
- AGENTS.md (root + docs): No changes needed unless new rules

Owner: memory-manager

---

