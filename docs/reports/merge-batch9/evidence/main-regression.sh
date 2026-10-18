#!/bin/sh
# A read-only main source/layout control inside this job's ignored output dir.
# Prepare from the repo root (source/layout files only; asset exports are unchanged):
# git archive --format=tar.gz 6e4e37634 src tests tools specs layouts preview functions index.html package.json package-lock.json tsconfig.json tsconfig.sim.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js public/assets/layouts > test-results/merge-batch9-main-source.tar.gz
# Invoke through tools/remote/run.sh with --with test-results/merge-batch9-main-source.tar.gz.
set -eu
candidate=$(pwd)
baseline="$candidate/test-results/merge-batch9-main"
mkdir -p "$baseline"
tar -xzf test-results/merge-batch9-main-source.tar.gz -C "$baseline"
for name in node_modules assets docs; do
  [ -e "$baseline/$name" ] || ln -s "$candidate/$name" "$baseline/$name"
done
for file in "$candidate"/public/*; do
  name=${file##*/}
  [ "$name" = assets ] || [ -e "$baseline/public/$name" ] || ln -s "$file" "$baseline/public/$name"
done
for file in "$candidate"/public/assets/*; do
  name=${file##*/}
  [ "$name" = layouts ] || [ -e "$baseline/public/assets/$name" ] || ln -s "$file" "$baseline/public/assets/$name"
done
cd "$baseline"
printf '%s\n' 'Control source/layout commit: 6e4e37634'
exec "$@"
