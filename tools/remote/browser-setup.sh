#!/bin/bash
# Invoked from a node_modules cache with the pinned Playwright installed.
set -euo pipefail
export PATH=/usr/local/bin:$PATH
exec 7>/srv/mi/locks/playwright-setup
flock 7
version=$(node -p 'require("playwright-core/package.json").version')
marker="/srv/mi/.chromium-$version"
browser=$(node -p 'require("playwright-core").chromium.executablePath()')
if [ ! -f "$marker" ] || [ ! -x "$browser" ]; then
  sudo -n env PATH="$PATH" ./node_modules/.bin/playwright install-deps chromium
  ./node_modules/.bin/playwright install chromium
  touch "$marker"
fi
