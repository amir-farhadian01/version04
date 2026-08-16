#!/bin/bash
# QualityGuard: Prompt Status Checker
# Scans prompts/ and checks if expected output files exist.
# Usage: bash scripts/check-prompt-status.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
FLUTTER="$REPO_ROOT/flutter_project/lib"

echo "======================================"
echo "   QualityGuard Prompt Status Check"
echo "   $(date +%Y-%m-%d)"
echo "======================================"
echo ""

check_file() {
  local label="$1"
  local path="$2"
  if [ -f "$path" ]; then
    echo "  ✅ $label"
    echo "     → $path"
  else
    echo "  ❌ $label — NOT FOUND"
    echo "     Expected: $path"
  fi
}

echo "📋 flutter-feed prompts"
echo "------------------------"

# 01 - Merge duplicate feeds
echo ""
echo "[01] Merge Duplicate Feed Screens"
check_file "feed_screen.dart" "$FLUTTER/features/feed/feed_screen.dart"
check_file "widgets/post_card.dart" "$FLUTTER/features/feed/widgets/post_card.dart"
check_file "widgets/stories_row.dart" "$FLUTTER/features/feed/widgets/stories_row.dart"
check_file "widgets/business_card.dart" "$FLUTTER/features/feed/widgets/business_card.dart"
check_file "widgets/feed_skeleton.dart" "$FLUTTER/features/feed/widgets/feed_skeleton.dart"
if [ -f "$FLUTTER/screens/social_screen.dart" ]; then
  echo "  ⚠️  social_screen.dart still exists — should be deleted"
fi

# 02 - Post creation
echo ""
echo "[02] Post Creation Screen"
check_file "features/post/create_post_screen.dart" "$FLUTTER/features/post/create_post_screen.dart"
if [ -f "$FLUTTER/screens/post/create_post_screen.dart" ]; then
  echo "  ⚠️  screens/post/create_post_screen.dart exists — should be moved to features/post/"
fi

# 03 - Post detail & comments
echo ""
echo "[03] Post Detail & Comments Screen"
check_file "features/post/post_detail_screen.dart" "$FLUTTER/features/post/post_detail_screen.dart"

# 04 - Story creation
echo ""
echo "[04] Story Creation"
check_file "features/stories/create_story_screen.dart" "$FLUTTER/features/stories/create_story_screen.dart"

# 05 - QA Verification (screenshots)
echo ""
echo "[05] QA Verification Screenshots"
check_file "screenshots/flutter-feed-merged.png" "$REPO_ROOT/screenshots/flutter-feed-merged.png"
check_file "screenshots/flutter-post-creation.png" "$REPO_ROOT/screenshots/flutter-post-creation.png"

echo ""
echo "======================================"
echo "  Check complete. Update prompts/PROMPT_STATUS.md"
echo "======================================"
