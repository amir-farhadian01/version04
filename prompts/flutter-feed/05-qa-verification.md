# Flutter: Feed Screen Final QA — Playwright Verification

## ROLE
You are a QA Engineer for Neighborly. You verify EVERYTHING before marking done.
You test in the REAL browser, not via API calls. Screenshots are mandatory.

## PROJECT CONTEXT
- Flutter Web: http://localhost:7357
- Backend API: http://localhost:8080
- Test credentials: email=admin@neighborly.com, password=admin123 (check .env or ask)
- Screenshots dir: /home/amir/version04/screenshots/

## INVIOLABLE RULES
1. Test ONLY in the browser — never call APIs directly
2. Take screenshots of EVERY step
3. Check browser console for errors
4. Report ALL failures — no partial passes

## PREREQUISITES
Before testing, ensure ALL services are running:
```bash
# Terminal 1 — Backend
cd /home/amir/version04 && npx tsx server.ts
# → http://localhost:8080

# Terminal 2 — Flutter Web
cd /home/amir/version04/flutter_project && flutter run -d web-server --web-port 7357
# → http://localhost:7357
```

## STEP 1: Verify Feed Page Loads
1. Open http://localhost:7357 in Playwright
2. Login with test credentials (go to /auth, enter email+password)
3. Navigate to Social/Explorer tab
4. Wait for feed to load (up to 10 seconds)
5. Take screenshot: `flutter-feed-01-initial.png`
6. CHECK:
   □ Page loads without JavaScript errors
   □ Feed posts display with images, captions, like/comment counts
   □ Stories row shows at top with gradient rings
   □ Location bar shows city name
   □ Search bar is visible
   □ Bottom navigation bar is visible
   □ No blank/white screen

## STEP 2: Verify Infinite Scroll & Pull-to-Refresh
1. Scroll down to bottom of feed
2. Wait for loading spinner to appear and more posts to load
3. Take screenshot: `flutter-feed-02-scroll.png`
4. Pull down from top to trigger refresh
5. Wait for refresh indicator to complete
6. Take screenshot: `flutter-feed-03-refresh.png`
7. CHECK:
   □ More posts load when scrolling down
   □ Loading indicator shows at bottom
   □ Pull-to-refresh shows spinner
   □ Feed refreshes with updated content

## STEP 3: Verify Stories Row
1. Look at stories row at top of feed
2. Check that story avatars have gradient rings (if unseen)
3. Tap on a story
4. Verify story viewer opens
5. Take screenshot: `flutter-feed-04-story-viewer.png`
6. Close story viewer
7. CHECK:
   □ Stories display with circular avatars
   □ Author names show below avatars
   □ Gradient rings on unseen stories
   □ Story viewer opens on tap
   □ Story viewer can be closed

## STEP 4: Verify Post Interactions
1. Find a post with like button
2. Tap like icon (heart)
3. Verify heart fills with color
4. Take screenshot: `flutter-feed-05-like.png`
5. Tap like again — verify it unlikes
6. Tap comment icon — verify comments screen opens
7. Take screenshot: `flutter-feed-06-comments.png`
8. Tap save/bookmark icon — verify it fills
9. Tap follow button on a post author — verify it changes to "Following"
10. Take screenshot: `flutter-feed-07-save-follow.png`
11. CHECK:
    □ Like toggles between filled/outline heart
    □ Like count increments/decrements
    □ Comments screen opens with back button
    □ Save/bookmark toggles states
    □ Follow toggles between Follow/Following
    □ Loading spinner shows during toggle (if slow network)

## STEP 5: Verify Tab Switching
1. Tap "Business Hub" tab (second tab)
2. Verify business posts display
3. Verify business cards show if any
4. Take screenshot: `flutter-feed-08-business-hub.png`
5. Tap "Explorer" tab to switch back
6. CHECK:
    □ Tabs switch smoothly
    □ Explorer shows all posts
    □ Business Hub shows only business posts
    □ Active tab has primary color underline

## STEP 6: Verify Loading, Empty, Error States

### Loading State
1. Refresh page or navigate to feed cold
2. Observe skeleton cards while loading
3. Take screenshot: `flutter-feed-09-loading.png`
4. CHECK:
    □ Skeleton cards display while loading
    □ Pulsing animation on skeletons
    □ Content replaces skeletons when loaded

### Error State
1. Stop the backend server temporarily
2. Pull to refresh or reload the feed
3. Observe error message
4. Take screenshot: `flutter-feed-10-error.png`
5. Restart backend server
6. Tap retry button
7. Verify feed loads again
8. CHECK:
    □ Error message displays clearly
    □ Retry button is visible
    □ Feed recovers after retry

### Empty State
(If no posts exist in test DB):
1. Observe empty state message
2. Take screenshot: `flutter-feed-11-empty.png`
3. CHECK:
    □ Empty state message is helpful ("No content in your area")
    □ Empty state is not a blank screen
    □ Suggestion text is visible

## STEP 7: Verify Mobile Responsiveness (375px)
1. Resize browser to 375px width (iPhone-like)
2. Reload page
3. Take screenshot: `flutter-feed-12-mobile.png`
4. Scroll through feed
5. Take screenshot: `flutter-feed-13-mobile-scroll.png`
6. Tap a post's like button
7. CHECK:
    □ Layout adapts to mobile width
    □ Cards fit screen width (no horizontal scroll)
    □ Bottom nav is visible and tappable
    □ Text is readable (not too small)
    □ Images scale correctly
    □ No overflow errors in console
    □ Stories row scrolls horizontally

## STEP 8: Console Error Check
1. Open browser console
2. Navigate through all screens
3. Count all errors (red messages)
4. CHECK:
    □ Zero unhandled JavaScript errors
    □ Zero failed network requests (4xx/5xx)
    □ Zero Flutter assertion errors
    □ Zero "RenderFlex overflowed" errors
    □ Zero CORS errors
    (Note: 401 errors on auth check calls are OK)

## STEP 9: Keyboard Navigation (Desktop)
1. Tab through interactive elements
2. Verify focus order is logical
3. Verify focus indicators are visible
4. CHECK:
    □ All buttons reachable via Tab
    □ Focus indicators visible
    □ Enter/Space activates buttons

## COMPLETION REPORT

```
========== FLUTTER FEED QA REPORT ==========
Date: [TODAY]
Tester: QA Engineer
Environment: http://localhost:7357

STEP 1 — Feed Page Load:
  ✅/❌ Page loads without errors
  ✅/❌ Posts display correctly
  ✅/❌ Stories row visible
  ✅/❌ Location bar visible
  ✅/❌ Search bar visible

STEP 2 — Infinite Scroll & Refresh:
  ✅/❌ Infinite scroll works
  ✅/❌ Pull-to-refresh works

STEP 3 — Stories:
  ✅/❌ Stories display
  ✅/❌ Story viewer opens
  ✅/❌ Story viewer closes

STEP 4 — Interactions:
  ✅/❌ Like toggles
  ✅/❌ Comment screen opens
  ✅/❌ Save toggles
  ✅/❌ Follow toggles

STEP 5 — Tabs:
  ✅/❌ Explorer tab works
  ✅/❌ Business Hub tab works

STEP 6 — States:
  ✅/❌ Loading skeletons
  ✅/❌ Error state + retry
  ✅/❌ Empty state

STEP 7 — Mobile (375px):
  ✅/❌ Layout adapts
  ✅/❌ No overflow

STEP 8 — Console:
  ✅/❌ [N] errors found

STEP 9 — Keyboard:
  ✅/❌ All elements reachable

SCREENSHOTS:
  1. flutter-feed-01-initial.png
  2. flutter-feed-02-scroll.png
  3. flutter-feed-03-refresh.png
  4. flutter-feed-04-story-viewer.png
  5. flutter-feed-05-like.png
  6. flutter-feed-06-comments.png
  7. flutter-feed-07-save-follow.png
  8. flutter-feed-08-business-hub.png
  9. flutter-feed-09-loading.png
  10. flutter-feed-10-error.png
  11. flutter-feed-11-empty.png
  12. flutter-feed-12-mobile.png
  13. flutter-feed-13-mobile-scroll.png

FINAL STATUS: ✅ ALL PASSED / ❌ [N] FAILURES
============================================
```

## FAILURE PROTOCOL
If ANY step fails:
1. Document the failure with screenshot
2. Fix the underlying code
3. Restart Flutter web server (flutter run -d web-server --web-port 7357)
4. Re-run ALL steps from STEP 1
5. No partial passes accepted