# Flutter: Post Detail Screen — Enhance & Polish

## ROLE
You are a Senior Flutter Developer. You write clean, polished, Instagram-quality UI.

## PROJECT CONTEXT
- Project: Neighborly — social-first local services marketplace
- Flutter: /home/amir/version04/flutter_project/
- Existing: /flutter_project/lib/screens/post_detail_screen.dart
- Existing: /flutter_project/lib/screens/explorer/comments_screen.dart
- API: /flutter_project/lib/services/api_service.dart
- Design: Dark mode first, primary=#6C63FF, background=#0A0A0F

## INVIOLABLE RULES
1. READ every file fully before editing
2. Never touch chat-related files
3. Null safety required
4. Dart const constructors where possible
5. After: flutter analyze with 0 errors

## TASK

1. Read existing files:
   - /flutter_project/lib/screens/post_detail_screen.dart (fully)
   - /flutter_project/lib/screens/explorer/comments_screen.dart (fully)
   - /flutter_project/lib/services/api_service.dart (social section)

2. ENHANCE Post Detail Screen at /flutter_project/lib/screens/post_detail_screen.dart:
   - Full-screen media viewer (tap image to expand, pinch to zoom)
   - Swipeable media carousel if post has multiple images
   - Comments section inline (not separate page)
   - Like count + comment count with real-time updates
   - Share button (system share sheet)
   - Better time formatting (relative: "2h ago", "3d ago")
   - Author avatar + name (tappable → profile)
   - Follow/Unfollow button on author header
   - Caption below media with "more"/"less" expand

3. ENHANCE Comments Screen at /flutter_project/lib/screens/explorer/comments_screen.dart:
   - Nested reply threads (indented)
   - "View X replies" expand/collapse
   - Like button on each comment
   - Pull-to-refresh comment list
   - Empty state: "No comments yet. Be the first!"
   - Input bar pinned at bottom with send button
   - Auto-focus keyboard when tapping reply

4. Verify: flutter analyze passes
5. Test: flutter run -d web-server --web-port 7357
6. Screenshot: screenshots/flutter-post-detail.png

## CONSTRAINTS
- DO: Use InteractiveViewer for pinch-to-zoom
- DO: Use PageView for media carousel
- DO: Show nested replies with indentation
- DO: Keep existing API methods (getComments, addComment, toggleCommentLike)
- DON'T: Change API response format expectations
- DON'T: Remove existing functionality

## EXPECTED OUTPUT
- Enhanced post detail with media carousel + inline comments
- Enhanced comments with nested replies + like
- flutter analyze: 0 errors
- Screenshots taken

## VERIFICATION
□ Media carousel swipes between images
□ Pinch to zoom works on images
□ Comments load and display inline
□ Nested replies show with indentation
□ Like button works on comments
□ Share button opens share sheet
□ Caption expands/collapses
□ Author header shows follow button
□ Empty state shows for no comments
□ Pull-to-refresh works on comments
□ Screenshot saved