#!/bin/sh
# Run through tools/remote/run.sh; every heavy stage is sequential and headless.
case "$PWD" in /srv/mi/jobs/*) ;; *) echo 'Run this batch in a remote job checkout.' >&2; exit 64 ;; esac
root=test-results/eg-l9
mkdir -p "$root"
: > "$root/checks.tsv"
run() {
  label=$1; shift
  "$@" > "$root/$label.log" 2>&1
  code=$?
  printf '%s\t%s\n' "$label" "$code" >> "$root/checks.tsv"
  printf '[l9-validation] %s exit=%s\n' "$label" "$code"
  if [ "$code" -ne 0 ]; then tail -n 16 "$root/$label.log"; fi
}
# The runner normally supplies an index-only manifest. The existing QA tools
# and review freshness tests need an actual HEAD in this disposable checkout.
git add --renormalize -u
git -c user.name='Remote validation' -c user.email=validation@localhost commit -qm 'Remote validation source snapshot' || exit 1
run typecheck npm run typecheck
run lint npm run lint
run unit npm test -- --maxWorkers=1
run story node --import tsx/esm tools/qa/l9-story-proof.ts
run course node --import tsx/esm tools/qa/l9-course-proof.ts
for route in road countryside dry-shortcut; do
  run "$route-low" node --import tsx/esm tools/qa/l9-driving-proof.ts --route "$route" --tier low
done
run road-high node --import tsx/esm tools/qa/l9-driving-proof.ts --route road --tier high
run road-low-zero node --import tsx/esm tools/qa/l9-driving-proof.ts --route road --tier low --zero
export QA_ACCEPT_ROOT="$root/accept"
run acceptance npm run qa:accept -- --level L9 --skip-browser
run threat npm run qa:threat -- --levels L9 --maxWorkers 1 --out "$root/threat"
if awk -F '\t' '$2 != 0 { bad=1 } END { exit bad }' "$root/checks.tsv"; then exit 0; else exit 1; fi
