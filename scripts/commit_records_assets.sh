#!/usr/bin/env bash
# Commit materialized Bible Friend records assets to the working branch.
set -euo pipefail

target_branch="${1:-main}"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add client/public/assets/bible-friend/records
if git diff --cached --quiet; then
  echo 'Assets already materialized.'
else
  git commit -m 'assets: materialize Figma records experience PNG pack'
  git push origin "HEAD:${target_branch}"
fi