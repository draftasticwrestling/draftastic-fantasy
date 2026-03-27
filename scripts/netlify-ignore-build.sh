#!/usr/bin/env bash
# Netlify "Ignore builds" hook: exit 0 = skip build (saves deploy credits), exit 1 = run build.
# https://docs.netlify.com/configure-builds/ignore-builds/
set -euo pipefail

if [[ -z "${CACHED_COMMIT_REF:-}" || -z "${COMMIT_REF:-}" ]]; then
  exit 1
fi

if ! git rev-parse --verify "$CACHED_COMMIT_REF^{commit}" >/dev/null 2>&1; then
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

if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- "${PATHS[@]}"; then
  echo "netlify-ignore-build: no changes under tracked app paths; skipping build."
  exit 0
fi

exit 1
