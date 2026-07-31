# Flutter: Post Creation Screen

## ROLE
You are a Senior Flutter Developer with 10 years experience building Instagram-like
social media apps. You write beautiful, smooth, production-ready Flutter code.

## PROJECT CONTEXT
- Project: Neighborly — social-first local services marketplace
- Flutter: /home/amir/version04/flutter_project/
- API Service: /flutter_project/lib/services/api_service.dart
- Backend API: http://localhost:8080/api
- POST /social/posts — create a post (multipart: caption, categoryId, media files)
- POST /upload — upload a single file, returns { url }
- GET /categories — get list of categories
- Design: Dark mode first, primary=#6C63FF, background=#0A0A0F, card=#15151E

## INVIOLABLE RULES
1. READ every file fully before editing
2. Never touch chat-related files
3. Null safety required
4. Use const constructors where possible
5. No API logic in widgets — use ApiService
6. After: `flutter analyze` must pass with 0 errors

## TASK
Create a Post Creation screen that lets users create and publish social posts.

Execute IN ORDER:

1. Read existing files:
   - /flutter_project/lib/services/api_service.dart (uploadFile, createPost, getCategories)
   - /flutter_project/lib/theme/app_theme.dart (for colors)
   - /flutter_project/lib/features/feed/feed_screen.dart (to add FAB)

2. Create /flutter_project/lib/features/post/create_post_screen.dart with:

   **UI Layout (single scrollable column):**
   - AppBar: "New Post" title, close (X) button, "Post" button (top right)
   - Image Picker area (top):
     - Grid of selected images (1-4 images, square tiles)
     - "Add Photo" tile as the last item (opens image_picker)
     - Support gallery + camera using image_picker package
   - Category selector (REQUIRED):
     - Horizontal scrollable chips loaded from API GET /categories
     - At least one must be selected (show error if none)
   - Caption field:
     - Multi-line TextField with placeholder "What's happening in your neighbourhood?"
     - Character counter (max 500)
   - Location toggle (optional):
     - Switch "Include location"
     - When on, show current location text
   - Service link (optional, for business users):
     - "Link a service" button that opens service picker

   **Post flow:**
   1. User selects 1-4 images
   2. User selects category (required)
   3. User writes caption (optional)
   4. User taps "Post" button
   5. Show loading overlay with progress
   6. Upload images one by one via API uploadFile()
   7. After all uploads complete, call API createPost() with:
      { caption, categoryId, mediaUrls: [...], location?: {lat, lng} }
   8. On success: show snackbar "Post published!", pop back to feed
   9. On failure: show error dialog, let user retry

   **States to handle:**
   - Loading: skeleton/spinner while categories load
   - Empty: if user hasn't selected anything yet
   - Error: if image upload fails or createPost fails
   - Success: briefly show checkmark then navigate back

3. Add route to /flutter_project/lib/main.dart:
   - Route '/post/create' → CreatePostScreen
   - Add import at top

4. Add "Create Post" FAB or button on the Feed Screen:
   - Read the merged feed screen: /flutter_project/lib/features/feed/feed_screen.dart
   - Add a FloatingActionButton at bottom-right (above BottomNav)
   - Icon: Icons.add (plus)
   - On tap: Navigator.pushNamed(context, '/post/create')
   - After returning from create screen: refresh feed

5. Add image_picker to pubspec.yaml if not already there:
   - Read /flutter_project/pubspec.yaml
   - Add `image_picker: ^1.0.0` if missing
   - Run `flutter pub get`

6. Run: flutter analyze (fix ALL errors)
7. Run: flutter run -d web-server --web-port 7357
8. Test: navigate to create post, select image, select category, write caption, post
9. Take screenshot: screenshots/flutter-post-creation.png

## CONSTRAINTS
- DO: Use image_picker package for gallery/camera
- DO: Upload images one by one, collect URLs
- DO: Category selection is REQUIRED — show validation error if missing
- DO: Use ApiService (not raw HTTP)
- DO: Show loading state during upload
- DO: Handle all error cases gracefully
- DON'T: Allow posting without category
- DON'T: Block UI during upload (show progress overlay)
- DON'T: Create more than 1 new file (create_post_screen.dart only)

## EXPECTED OUTPUT
- /flutter_project/lib/features/post/create_post_screen.dart (max 400 lines)
- "Create Post" FAB added to feed screen
- Route '/post/create' added to main.dart
- User can: select images → select category → write caption → post → see in feed
- Screenshot saved

## VERIFICATION
□ flutter analyze: 0 errors
□ Post screen opens from feed FAB
□ Image picker works (gallery + camera)
□ Category chips load from API
□ Category selection is required (validated)
□ Caption field works with character counter
□ Post button uploads images and creates post
□ Success feedback shown
□ Navigates back and refreshes feed
□ Error state handled (show dialog)
□ Screenshot taken