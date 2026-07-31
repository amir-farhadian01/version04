# Flutter: Merge Duplicate Feed Screens & Clean Architecture

## ROLE
You are a Senior Flutter Developer with 10 years experience. You write clean, DRY,
production-ready Flutter code. You are methodical and ALWAYS read before writing.

## PROJECT CONTEXT
- Project: Neighborly — social-first local services marketplace
- Flutter: /home/amir/version04/flutter_project/
- Backend API: http://localhost:8080/api
- Design: Dark mode first, primary=#6C63FF, background=#0A0A0F

## INVIOLABLE RULES
1. READ every file fully before editing
2. Never touch chat-related files
3. Null safety required
4. Use const constructors where possible
5. After changes: flutter analyze must pass with 0 errors
6. git commit after each task

## PROBLEM
The project has TWO nearly identical feed screens:
- /flutter_project/lib/screens/social_screen.dart (1185 lines)
- /flutter_project/lib/screens/explorer/explorer_screen.dart (1208 lines)

Both have: feed list, stories row, business hub tab, like/comment/save, follow/unfollow,
skeleton loading, error state, empty state, infinite scroll, pull-to-refresh.

This is duplicate code that must be consolidated.

## TASK
Execute IN ORDER:

1. Read both files completely:
   - /flutter_project/lib/screens/social_screen.dart
   - /flutter_project/lib/screens/explorer/explorer_screen.dart

2. Read /flutter_project/lib/main.dart to understand routing

3. Read /flutter_project/lib/services/api_service.dart to understand API methods used

4. Choose the BETTER implementation (explorer_screen has caching via CacheProvider,
   social_screen has dynamic location — pick the best of both)

5. Create /flutter_project/lib/features/feed/feed_screen.dart that:
   - Contains the SINGLE canonical Feed Screen
   - Merges the best features from both duplicates:
     - Five-layer caching from explorer_screen (CacheProvider + CachePolicy)
     - Dynamic location loading from social_screen (getMyLocation)
     - Both "Explorer" and "Business Hub" tabs
     - Stories horizontal row with gradient rings
     - Post cards with: avatar, name, time, media, caption, like/comment/save/follow
     - Infinite scroll with loading indicator
     - Pull-to-refresh
     - Skeleton loading cards
     - Error state with retry button
     - Empty state with appropriate message per tab
   - Extract shared widgets to /flutter_project/lib/features/feed/widgets/:
     - post_card.dart (the post card widget)
     - stories_row.dart (the stories horizontal list)
     - business_card.dart (the business hub card)
     - feed_skeleton.dart (skeleton loading card)

6. Update /flutter_project/lib/main.dart:
   - Remove duplicate route entries
   - Keep only ONE feed screen route
   - Make sure all references point to the new merged file

7. DELETE /flutter_project/lib/screens/social_screen.dart
8. DELETE /flutter_project/lib/screens/explorer/explorer_screen.dart
   (or mark as @deprecated and redirect to new screen if unsure)

9. Run: cd flutter_project && flutter analyze
   Fix ALL errors and warnings.

10. Run: cd flutter_project && flutter run -d web-server --web-port 7357
    Verify the feed loads, tabs work, scroll works, interactions work.

## CONSTRAINTS
- DO: Keep five-layer caching (CacheProvider, CachePolicy)
- DO: Keep dark mode support (check Theme.brightness)
- DO: Keep all API methods used (getFeedPosts, getStories, toggleLike, etc.)
- DO: Extract widgets — no file over 500 lines
- DON'T: Change any API endpoint paths
- DON'T: Remove any functionality that exists in current screens
- DON'T: Create new state management pattern (keep setState + Provider)

## EXPECTED OUTPUT
- Single canonical feed screen at /flutter_project/lib/features/feed/feed_screen.dart (max 500 lines)
- Extracted widgets in /flutter_project/lib/features/feed/widgets/ (each max 200 lines)
- Both old duplicate files deleted
- flutter analyze: 0 errors
- flutter build web --no-pub: succeeds
- git commit: "refactor(flutter): merge duplicate feed screens into single canonical feed feature"

## VERIFICATION
□ flutter analyze passes (0 errors)
□ flutter run -d web-server --web-port 7357 shows feed correctly
□ Stories row displays
□ Tabs switch between Explorer and Business Hub
□ Infinite scroll loads more posts
□ Pull-to-refresh works
□ Like/Comment/Save/Follow buttons work
□ No duplicate route error
□ Screenshot saved to screenshots/flutter-feed-merged.png