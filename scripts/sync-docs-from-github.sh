#!/bin/bash
# scripts/sync-docs-from-github.sh
# Sync ONLY .md files from GitHub main branch — no code changes
# Use this when you've updated .md files on GitHub and want to pull them locally
# without affecting any source code.

set -e

echo "============================================"
echo "  🔄 Syncing .md files from GitHub..."
echo "============================================"
echo ""

# Step 1: Fetch latest from GitHub
echo "📡 Fetching latest from origin/main..."
git fetch origin main
echo "✅ Fetch complete"
echo ""

# Step 2: Dry-run first — show what will change
echo "📋 Changes detected (dry-run):"
echo ""

DELETED=$(git diff --name-only --diff-filter=D origin/main -- '*.md' '**/*.md' || true)
UPDATED=$(git diff --name-only --diff-filter=M origin/main -- '*.md' '**/*.md' || true)
ADDED=$(git diff --name-only --diff-filter=A origin/main -- '*.md' '**/*.md' || true)

if [ -n "$DELETED" ]; then
  echo "🗑️  Files to be DELETED:"
  echo "$DELETED" | sed 's/^/    - /'
  echo ""
fi

if [ -n "$UPDATED" ]; then
  echo "📝 Files to be UPDATED:"
  echo "$UPDATED" | sed 's/^/    - /'
  echo ""
fi

if [ -n "$ADDED" ]; then
  echo "➕ Files to be ADDED:"
  echo "$ADDED" | sed 's/^/    - /'
  echo ""
fi

if [ -z "$DELETED" ] && [ -z "$UPDATED" ] && [ -z "$ADDED" ]; then
  echo "    No .md file changes detected. Everything is up to date."
  echo ""
fi

echo "--------------------------------------------"
echo ""

# Step 3: Remove local .md files that were deleted on GitHub
if [ -n "$DELETED" ]; then
  echo "🗑️  Removing local .md files deleted on GitHub..."
  echo "$DELETED" | while read f; do
    if [ -f "$f" ]; then
      rm -v "$f"
    fi
  done
  echo "✅ Removal complete"
  echo ""
else
  echo "✅ No files to remove"
  echo ""
fi

# Step 4: Checkout all .md files from GitHub (updates existing + adds new)
echo "📥 Checking out .md files from origin/main..."
git checkout origin/main -- '*.md' '**/*.md'
echo "✅ Checkout complete"
echo ""

# Step 5: Show final status
echo "============================================"
echo "  📊 Final Status"
echo "============================================"
git status --short
echo ""
echo "============================================"
echo "  ✅ Sync complete!"
echo "============================================"
echo ""
echo "📝 To commit these changes, run:"
echo "    git add -A && git commit -m \"chore(docs): sync .md files from GitHub\" && git push"
echo ""
echo "⚠️  No source code files were modified."
