# Social Feed Full Function Test - Flutter Web

> Created: 2026-08-12T05:31:34.328Z
> Total tasks: 35

---

## TASK 1: Verify Flutter Web is running and accessible

Navigate to http://localhost:7357, take a screenshot, confirm the app loads. Check console for errors.

---

## TASK 2: Login with valid customer account

On http://localhost:7357, login with customer@neighborly.local / 12345678. Take screenshot after login. Verify the feed screen appears.

---

## TASK 3: Login with invalid password (error handling)

First logout, then attempt login with customer@neighborly.local / wrongpassword. Verify error message appears. Take screenshot.

---

## TASK 4: Logout functionality

After valid login, find and click logout. Verify returned to login screen. Take screenshot.

---

## TASK 5: Re-login for remaining tests

Login again with customer@neighborly.local / 12345678 to prepare for feature tests.

---

## TASK 6: Create Post - navigate to create post screen

Find and tap the 'Create Post' button/icon. Verify the create post screen opens. Take screenshot.

---

## TASK 7: Create Post - text only

Type a caption: 'Test post from automated testing - Flutter'. Select a category if required. Submit. Verify post appears in feed. Take screenshot.

---

## TASK 8: Create Post - empty caption validation

Try to create a post with empty caption. Verify validation error appears. Take screenshot.

---

## TASK 9: Create Post - cancel/dismiss

Open create post screen, type something, then cancel/close. Verify returned to feed without changes. Take screenshot.

---

## TASK 10: Like a post - toggle on

Find a post with visible like button. Tap the like button. Verify the like count increases or icon changes (filled/red). Take screenshot.

---

## TASK 11: Unlike a post - toggle off

Tap the like button again on the same post. Verify the like is removed (count decreases, icon unfilled). Take screenshot.

---

## TASK 12: Open comments on a post

Tap the comment button/icon on a post. Verify the comments screen opens. Take screenshot.

---

## TASK 13: Write a comment on a post

Type a comment: 'This is a test comment from automation!'. Submit. Verify the comment appears in the list. Take screenshot.

---

## TASK 14: Write empty comment (validation)

Try to submit an empty comment. Verify error/validation message appears or submit is disabled. Take screenshot.

---

## TASK 15: Reply to a comment

Find a comment, tap reply. Type 'This is a test reply'. Submit. Verify reply appears nested under the comment. Take screenshot.

---

## TASK 16: Like a comment

Find the like button on a comment. Tap it. Verify like count changes or icon toggles. Take screenshot.

---

## TASK 17: Unlike a comment

Tap like button again on the same comment. Verify like is removed. Take screenshot.

---

## TASK 18: Like a reply

Find a reply, tap its like button. Verify like registers. Take screenshot.

---

## TASK 19: Unlike a reply

Tap like button again on the reply. Verify unlike works. Take screenshot.

---

## TASK 20: Delete own comment

Find a comment you wrote. Long press or use menu to delete it. Verify comment is removed. Take screenshot.

---

## TASK 21: Scroll comments / load more

If many comments exist, scroll down to load more. Verify pagination works. Take screenshot.

---

## TASK 22: Close comments and return to feed

Navigate back from comments screen to the main feed. Take screenshot.

---

## TASK 23: Save/Bookmark a post

Find the save/bookmark icon on a post. Tap it. Verify save state changes. Take screenshot.

---

## TASK 24: Unsave a post

Tap save/bookmark again on the same post. Verify unsaved. Take screenshot.

---

## TASK 25: Open post detail screen

Tap on a post (not the buttons, the content area). Verify the post detail screen opens. Take screenshot.

---

## TASK 26: Like from post detail screen

On the post detail screen, tap like button. Verify it works. Take screenshot.

---

## TASK 27: Comment from post detail screen

On post detail screen, write a comment and submit. Verify it appears. Take screenshot.

---

## TASK 28: Follow a user

Find a follow button on a user profile or post. Tap follow. Verify follow state changes. Take screenshot.

---

## TASK 29: Unfollow a user

Tap follow again to unfollow. Verify unfollow. Take screenshot.

---

## TASK 30: Pull-to-refresh feed

Scroll to top of feed and pull down to refresh. Verify loading indicator appears and feed refreshes. Take screenshot.

---

## TASK 31: Tab navigation - Explorer tab

Tap the Explorer tab in bottom navigation. Verify explorer screen loads. Take screenshot.

---

## TASK 32: Tab navigation - Home tab

Tap the Home tab. Verify home screen loads. Take screenshot.

---

## TASK 33: View stories

If stories row is visible, tap a story. Verify story viewer opens and plays. Take screenshot.

---

## TASK 34: Story auto-advance / close

Wait for story to advance or close. Verify return to feed. Take screenshot.

---

## TASK 35: Final console check & summary

Check browser console for any errors during the entire session. Take a final screenshot of the feed.

---

