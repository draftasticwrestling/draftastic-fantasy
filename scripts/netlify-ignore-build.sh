#!/usr/bin/env bash
# Netlify "Ignore builds" hook: exit 0 = skip build (saves deploy credits), exit 1 = run build.
# https://docs.netlify.com/configure-builds/ignore-builds/
set -euo pipefail

echo "netlify-ignore-build: CACHED_COMMIT_REF=${CACHED_COMMIT_REF:-} COMMIT_REF=${COMMIT_REF:-}"

# A failed or canceled production deploy leaves no successful cache, so Netlify
# sets both refs to the incoming commit. An empty diff would skip the build we need.
if [[ -z "${CACHED_COMMIT_REF:-}" || -z "${COMMIT_REF:-}" || "$CACHED_COMMIT_REF" == "$COMMIT_REF" ]]; then
  echo "netlify-ignore-build: missing or identical refs; building."
  exit 1
fi

if ! git rev-parse --verify "$CACHED_COMMIT_REF^{commit}" >/dev/null 2>&1; then
  echo "netlify-ignore-build: cached commit not in clone; building."
  exit 1
fi

# If anything outside this list changed, we rebuild. Extend when you add root configs
# that affect the Next bundle (e.g. tailwind.config.ts, postcss.config.mjs).
PATHS=(
  app
  lib
  middleware.ts
  netlify
  netlify.toml
  next.config.ts
  package.json
  package-lock.json
  public
  scripts
  tsconfig.json
)

set +e
git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- "${PATHS[@]}"
diff_status=$?
set -e

if [[ "$diff_status" -eq 0 ]]; then
  echo "netlify-ignore-build: no changes under tracked app paths; skipping build."
  exit 0
fi

echo "netlify-ignore-build: app paths changed or diff failed (status ${diff_status}); building."
exit 1
