#!/bin/sh
set -eu
# Remote caches have a manifest index and no commits. Give revision-dependent
# QA helpers valid job-local metadata; source content hashes identify the build.
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  snapshot_index="$PWD/.git/p1-review.index"
  GIT_INDEX_FILE="$snapshot_index" git read-tree --empty
  GIT_INDEX_FILE="$snapshot_index" git add -f src/levels src/data src/render src/ui src/assets public
  tree=$(GIT_INDEX_FILE="$snapshot_index" git write-tree)
  snapshot=$(git -c user.name='Runner snapshot' -c user.email='runner@localhost' commit-tree "$tree" -m 'Runner source snapshot for review freshness fixtures')
  git update-ref HEAD "$snapshot"
fi
npm run verify -- E07
python3 - <<'PY'
import hashlib, json, subprocess
from pathlib import Path
def digest(scopes):
    files = subprocess.check_output(['git', 'ls-files', '-z', '--', *scopes]).decode().split('\0')
    value = hashlib.sha256()
    for name in sorted(set(filter(None, files))):
        value.update(name.encode()); value.update(b'\0'); value.update(Path(name).read_bytes())
    return value.hexdigest()
path = Path('test-results/epics/E07/checks.json')
receipt = json.loads(path.read_text())
receipt['sourceHash'] = digest(['src', 'layouts', 'public/assets/layouts'])
receipt['unitContractHash'] = digest(['tests/engine', 'tests/helpers', 'tests/shared', 'tests/tools'])
path.write_text(json.dumps(receipt, indent=2) + '\n')
PY
