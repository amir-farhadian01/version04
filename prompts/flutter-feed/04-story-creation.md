# Flutter: Story Creation & Viewer Enhancement

## ROLE
You are a Senior Flutter Developer. You build smooth, Instagram-quality story experiences.

## PROJECT CONTEXT
- Project: Neighborly
- Flutter: /home/amir/version04/flutter_project/
- Existing story viewer: /flutter_project/lib/screens/explorer/story_screen.dart
- API: POST /social/stories { mediaUrl, mediaType }
- API: POST /upload (file upload)
- Design: Dark mode, fullscreen immersive

## INVIOLABLE RULES
1. READ every file fully before editing
2. Never touch chat-related files
3. Null safety required
4. Dart const constructors where possible

## TASK

1. Read: /flutter_project/lib/screens/explorer/story_screen.dart (fully)

2. ENHANCE Story Viewer (story_screen.dart):
   - Fullscreen immersive view (hide status bar)
   - Progress bar segments at top (Instagram-style)
   - Tap right half → next story, left half → previous
   - Hold to pause, release to resume
   - Swipe down to close
   - 24h expiry "badge" indicator
   - Story author name + time at top-left
   - Reply field at bottom ("Send message")

3. CREATE Story Creation screen: /flutter_project/lib/features/stories/create_story_screen.dart
   - Camera-first approach (open camera directly)
   - Or pick from gallery (toggle button)
   - Preview captured/selected media before posting
   - Add text overlay (optional, draggable text)
   - "Post to Story" button
   - "Your Story" circular button in feed stories row (first item, with + icon)
   - After creation, navigate back (story appears in stories row automatically via API)

4. Add route '/story/create' in /flutter_project/lib/main.dart

5. Add image_picker or camera package dependency if not already in pubspec.yaml

6. Verify: flutter analyze
7. Test: flutter run -d web-server --web-port 7357
8. Screenshot: screenshots/flutter-story-creation.png

## CONSTRAINTS
- DO: Use fullscreen immersive mode (SystemChrome)
- DO: Progress bar should auto-advance (AnimationController)
- DO: Camera is primary, gallery is fallback
- DO: Media type: 'image' or 'video'
- DON'T: Use any deprecated Flutter camera APIs
- DON'T: Block main thread during upload

## EXPECTED OUTPUT
- Enhanced story viewer with progress bars, tap navigation, hold-to-pause
- New story creation screen
- "Your Story" button in feed stories row
- flutter analyze: 0 errors
- Screenshots taken

## VERIFICATION
□ Story viewer: fullscreen immersive
□ Story viewer: progress bars advance
□ Story viewer: tap left/right navigates
□ Story viewer: hold pauses, release resumes
□ Story viewer: swipe down closes
□ Story creation: camera/gallery opens
□ Story creation: preview before post
□ Story creation: text overlay works
□ "Your Story" appears in feed stories row
□ Created story appears in stories row
□ Screenshots saved