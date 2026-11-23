#!/usr/bin/env bash
# Build the static site and publish it to the gh-pages branch of `origin`.
# The site is served from https://<owner>.github.io/<repo>/, so the build
# uses the repository name as its base path.
set -euo pipefail

cd "$(dirname "$0")/.."

remote="$(git remote get-url origin)"
slug="$(printf '%s' "$remote" | sed -E 's#(\.git)?$##; s#^.*[:/]([^/]+/[^/]+)$#\1#')"
owner="${slug%%/*}"
repo="${slug##*/}"

export NEXT_PUBLIC_BASE_PATH="/${repo}"
export NEXT_PUBLIC_SITE_URL="https://${owner}.github.io"

rm -rf out
pnpm build

# Without this file GitHub Pages skips folders that start with an underscore.
touch out/.nojekyll

name="$(git log -1 --format=%an)"
email="$(git log -1 --format=%ae)"
source="$(git rev-parse --short HEAD)"

cd out
git init -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m "Publish ${source}"
git push -f -q "$remote" gh-pages
rm -rf .git

echo "Published https://${owner}.github.io/${repo}/"
