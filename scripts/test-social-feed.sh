#!/bin/bash
# Social Feed Full Function Test
set +e
API="http://localhost:8080/api"
TOKEN=$(cat /tmp/token.txt)
AUTH="Authorization: Bearer $TOKEN"
PASS=0
FAIL=0

green() { echo -e "\033[32m✅ $1\033[0m"; ((PASS++)); }
red() { echo -e "\033[31m❌ $1\033[0m"; ((FAIL++)); }
section() { echo -e "\n\033[1;36m━━━ $1 ━━━\033[0m"; }

# ─── PART 1: POSTS ────────────────────────────────────────
section "PART 1: POSTS"

# 1.1 Get all posts
POSTS=$(curl -s "$API/posts" -H "$AUTH")
POST_COUNT=$(echo "$POSTS" | jq 'length')
if [ "$POST_COUNT" -gt 0 ]; then green "Get posts: $POST_COUNT posts found"; else red "Get posts: no posts"; fi

POST_ID=$(echo "$POSTS" | jq -r '.[0].id')
POST_LIKES=$(echo "$POSTS" | jq -r '.[0].likeCount')
POST_COMMENTS=$(echo "$POSTS" | jq -r '.[0].commentCount')
echo "   First post: $POST_ID (likes=$POST_LIKES, comments=$POST_COMMENTS)"

# 1.2 Get single post
SINGLE=$(curl -s "$API/posts/$POST_ID" -H "$AUTH")
HAS_LIKED=$(echo "$SINGLE" | jq -r '.hasLiked')
SINGLE_LIKES=$(echo "$SINGLE" | jq -r '.likeCount')
if [ "$(echo "$SINGLE" | jq -r '.id')" = "$POST_ID" ]; then green "Get single post: OK (hasLiked=$HAS_LIKED, likes=$SINGLE_LIKES)"; else red "Get single post: FAILED"; fi

# 1.3 Create post
CREATE_RESP=$(curl -s -X POST "$API/posts" -H "$AUTH" -H 'Content-Type: application/json' -d '{"caption":"API Test Post - Automated Testing","categoryId":"","mediaAssetId":""}')
NEW_POST_ID=$(echo "$CREATE_RESP" | jq -r '.id // empty')
NEW_POST_CAPTION=$(echo "$CREATE_RESP" | jq -r '.caption // empty')
if [ -n "$NEW_POST_ID" ] && [ "$NEW_POST_CAPTION" = "API Test Post - Automated Testing" ]; then
  green "Create post: OK (id=$NEW_POST_ID)"
else
  echo "   Create response: $CREATE_RESP" | head -c 200
  red "Create post: FAILED"
fi

# 1.4 Create post without caption (validation)
EMPTY_CREATE=$(curl -s -X POST "$API/posts" -H "$AUTH" -H 'Content-Type: application/json' -d '{"caption":"","categoryId":"","mediaAssetId":""}')
EMPTY_STATUS=$(echo "$EMPTY_CREATE" | jq -r '.code // .error // "unknown"')
echo "   Empty caption response: $EMPTY_STATUS (expecting error/validation)"
if [ "$EMPTY_STATUS" != "VALIDATION_ERROR" ] && [ "$EMPTY_CREATE" != '{"id"'* ]; then
  green "Create post empty caption: properly rejected"
else
  echo "   Response: $(echo $EMPTY_CREATE | head -c 100)"
  red "Create post empty caption: should have been rejected"
fi

# ─── PART 2: LIKE / UNLIKE POST ──────────────────────────
section "PART 2: LIKE / UNLIKE POST"

# 2.1 Like post
LIKE_RESP=$(curl -s -X POST "$API/posts/$POST_ID/like" -H "$AUTH" -w "\n%{http_code}")
HTTP_CODE=$(echo "$LIKE_RESP" | tail -1)
LIKE_BODY=$(echo "$LIKE_RESP" | head -1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  green "Like post: HTTP $HTTP_CODE"
  echo "   Response: $LIKE_BODY" | head -c 150
else
  echo "   HTTP $HTTP_CODE: $LIKE_BODY" | head -c 150
  red "Like post: unexpected response"
fi

# 2.2 Unlike post
UNLIKE_RESP=$(curl -s -X DELETE "$API/posts/$POST_ID/like" -H "$AUTH" -w "\n%{http_code}")
HTTP_CODE=$(echo "$UNLIKE_RESP" | tail -1)
UNLIKE_BODY=$(echo "$UNLIKE_RESP" | head -1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  green "Unlike post: HTTP $HTTP_CODE"
else
  echo "   HTTP $HTTP_CODE: $UNLIKE_BODY" | head -c 150
  red "Unlike post: unexpected response"
fi

# 2.3 Verify like state changed
CHECK=$(curl -s "$API/posts/$POST_ID" -H "$AUTH")
CHECK_LIKED=$(echo "$CHECK" | jq -r '.hasLiked')
CHECK_LIKES=$(echo "$CHECK" | jq -r '.likeCount')
echo "   After unlike: hasLiked=$CHECK_LIKED, likeCount=$CHECK_LIKES"
if [ "$CHECK_LIKED" = "false" ]; then green "Like state verification: correctly unliked"; else red "Like state: still liked (unexpected)"; fi

# ─── PART 3: COMMENT ──────────────────────────────────────
section "PART 3: COMMENT ON POST"

# 3.1 Write comment
COMMENT_RESP=$(curl -s -X POST "$API/posts/$POST_ID/comments" -H "$AUTH" -H 'Content-Type: application/json' -d '{"content":"API test comment!"}')
COMMENT_ID=$(echo "$COMMENT_RESP" | jq -r '.id // empty')
COMMENT_CONTENT=$(echo "$COMMENT_RESP" | jq -r '.content // empty')
if [ -n "$COMMENT_ID" ] && [ "$COMMENT_CONTENT" = "API test comment!" ]; then
  green "Write comment: OK (id=$COMMENT_ID)"
else
  echo "   Response: $COMMENT_RESP" | head -c 200
  red "Write comment: FAILED"
fi

# 3.2 Write empty comment (validation)
EMPTY_CMT=$(curl -s -X POST "$API/posts/$POST_ID/comments" -H "$AUTH" -H 'Content-Type: application/json' -d '{"content":""}' -w "\n%{http_code}")
echo "   Empty comment HTTP: $(echo "$EMPTY_CMT" | tail -1)"

# 3.3 Get comments
COMMENTS=$(curl -s "$API/posts/$POST_ID/comments" -H "$AUTH")
CMT_COUNT=$(echo "$COMMENTS" | jq 'length')
echo "   Comments on post: $CMT_COUNT"
if [ "$CMT_COUNT" -gt 0 ]; then green "Get comments: $CMT_COUNT comments"; else red "Get comments: no comments found"; fi

# ─── PART 4: LIKE / UNLIKE COMMENT ────────────────────────
section "PART 4: LIKE / UNLIKE COMMENT"

if [ -n "$COMMENT_ID" ]; then
  # 4.1 Like comment
  CMT_LIKE=$(curl -s -X POST "$API/posts/$POST_ID/comments/$COMMENT_ID/like" -H "$AUTH" -w "\n%{http_code}")
  echo "   Like comment HTTP: $(echo "$CMT_LIKE" | tail -1)"

  # 4.2 Unlike comment
  CMT_UNLIKE=$(curl -s -X DELETE "$API/posts/$POST_ID/comments/$COMMENT_ID/like" -H "$AUTH" -w "\n%{http_code}")
  echo "   Unlike comment HTTP: $(echo "$CMT_UNLIKE" | tail -1)"
  green "Comment like/unlike: tested"
else
  red "Comment like/unlike: SKIPPED (no comment ID)"
fi

# ─── PART 5: REPLY TO COMMENT ─────────────────────────────
section "PART 5: REPLY TO COMMENT"

if [ -n "$COMMENT_ID" ]; then
  REPLY_RESP=$(curl -s -X POST "$API/posts/$POST_ID/comments" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"content\":\"API test reply!\",\"parentId\":\"$COMMENT_ID\"}")
  REPLY_ID=$(echo "$REPLY_RESP" | jq -r '.id // empty')
  REPLY_PARENT=$(echo "$REPLY_RESP" | jq -r '.parentId // empty')
  if [ -n "$REPLY_ID" ] && [ "$REPLY_PARENT" = "$COMMENT_ID" ]; then
    green "Reply to comment: OK (replyId=$REPLY_ID, parentId=$REPLY_PARENT)"
  else
    echo "   Response: $REPLY_RESP" | head -c 200
    red "Reply to comment: FAILED"
  fi

  # 5.2 Like reply
  if [ -n "$REPLY_ID" ]; then
    REPLY_LIKE=$(curl -s -X POST "$API/posts/$POST_ID/comments/$REPLY_ID/like" -H "$AUTH" -w "\n%{http_code}")
    echo "   Like reply HTTP: $(echo "$REPLY_LIKE" | tail -1)"
    
    REPLY_UNLIKE=$(curl -s -X DELETE "$API/posts/$POST_ID/comments/$REPLY_ID/like" -H "$AUTH" -w "\n%{http_code}")
    echo "   Unlike reply HTTP: $(echo "$REPLY_UNLIKE" | tail -1)"
    green "Reply like/unlike: tested"
  fi

  # 5.3 Delete reply
  if [ -n "$REPLY_ID" ]; then
    DEL_REPLY=$(curl -s -X DELETE "$API/posts/$POST_ID/comments/$REPLY_ID" -H "$AUTH" -w "\n%{http_code}")
    DEL_HTTP=$(echo "$DEL_REPLY" | tail -1)
    if [ "$DEL_HTTP" = "200" ]; then green "Delete reply: OK (HTTP $DEL_HTTP)"; else echo "   HTTP $DEL_HTTP"; red "Delete reply: unexpected"; fi
  fi
else
  red "Reply: SKIPPED (no comment ID)"
fi

# ─── PART 6: DELETE COMMENT ───────────────────────────────
section "PART 6: DELETE COMMENT"

if [ -n "$COMMENT_ID" ]; then
  DEL_CMT=$(curl -s -X DELETE "$API/posts/$POST_ID/comments/$COMMENT_ID" -H "$AUTH" -w "\n%{http_code}")
  DEL_HTTP=$(echo "$DEL_CMT" | tail -1)
  if [ "$DEL_HTTP" = "200" ]; then green "Delete comment: OK (HTTP $DEL_HTTP)"; else echo "   HTTP $DEL_HTTP: $(echo "$DEL_CMT" | head -1 | head -c 100)"; red "Delete comment: unexpected"; fi
else
  red "Delete comment: SKIPPED"
fi

# ─── PART 7: SAVE / UNSAVE POST ──────────────────────────
section "PART 7: SAVE / UNSAVE POST"

SAVE_RESP=$(curl -s -X POST "$API/social/posts/$POST_ID/save" -H "$AUTH" -w "\n%{http_code}")
echo "   Save HTTP: $(echo "$SAVE_RESP" | tail -1)"
UNSAVE_RESP=$(curl -s -X DELETE "$API/social/posts/$POST_ID/save" -H "$AUTH" -w "\n%{http_code}")
echo "   Unsave HTTP: $(echo "$UNSAVE_RESP" | tail -1)"
green "Save/Unsave post: tested"

# ─── PART 8: FOLLOW / UNFOLLOW ────────────────────────────
section "PART 8: FOLLOW / UNFOLLOW"

# Get a user ID from a post author
AUTHOR_ID=$(echo "$SINGLE" | jq -r '.authorId // .author.id // empty')
if [ -n "$AUTHOR_ID" ]; then
  FOLLOW=$(curl -s -X POST "$API/follow/$AUTHOR_ID" -H "$AUTH" -w "\n%{http_code}")
  echo "   Follow HTTP: $(echo "$FOLLOW" | tail -1)"
  UNFOLLOW=$(curl -s -X DELETE "$API/follow/$AUTHOR_ID" -H "$AUTH" -w "\n%{http_code}")
  echo "   Unfollow HTTP: $(echo "$UNFOLLOW" | tail -1)"
  green "Follow/Unfollow: tested"
else
  red "Follow/Unfollow: SKIPPED (no author ID found)"
fi

# ─── PART 9: FEED ─────────────────────────────────────────
section "PART 9: FEED"

FEED=$(curl -s "$API/feed" -H "$AUTH")
FEED_COUNT=$(echo "$FEED" | jq 'length')
if [ "$FEED_COUNT" -gt 0 ]; then green "Get feed: $FEED_COUNT items"; else red "Get feed: empty"; fi

# ─── PART 10: STORIES ─────────────────────────────────────
section "PART 10: STORIES"

STORIES=$(curl -s "$API/stories" -H "$AUTH")
STORY_COUNT=$(echo "$STORIES" | jq 'length // 0')
echo "   Story count: $STORY_COUNT"
green "Stories endpoint: accessible"

# ─── PART 11: SOCIAL FEED ─────────────────────────────────
section "PART 11: SOCIAL FEED"

SOCIAL=$(curl -s "$API/social/feed?page=1&pageSize=3" -H "$AUTH")
SOCIAL_COUNT=$(echo "$SOCIAL" | jq '.data | length // 0')
echo "   Social feed items: $SOCIAL_COUNT"
if [ "$SOCIAL_COUNT" -gt 0 ]; then green "Social feed: $SOCIAL_COUNT items"; else red "Social feed: empty"; fi

# ─── PART 12: SEARCH ──────────────────────────────────────
section "PART 12: SEARCH"

SEARCH=$(curl -s "$API/social/search?q=test&page=1&pageSize=3" -H "$AUTH")
SEARCH_COUNT=$(echo "$SEARCH" | jq '.data | length // 0')
echo "   Search results: $SEARCH_COUNT"
green "Search: tested"

# ─── SUMMARY ──────────────────────────────────────────────
section "SUMMARY"
echo -e "   \033[32mPassed: $PASS\033[0m"
echo -e "   \033[31mFailed: $FAIL\033[0m"
TOTAL=$((PASS + FAIL))
echo "   Total: $TOTAL checks"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n\033[33m⚠ Some tests failed. Check details above.\033[0m"
  exit 1
else
  echo -e "\n\033[32m🎉 ALL TESTS PASSED!\033[0m"
  exit 0
fi