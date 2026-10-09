#!/bin/sh
# Run a command for a worktree on the shared Hetzner runner (host alias `mi-runner`, see docs/tools/remote-runner.md).
#   sh tools/remote/run.sh <worktree> [--pull <path>]... [--with <path>]... [--env K=V]... -- <command...>
# Syncs tracked + untracked-not-ignored files (minus heavy dev-only dirs) into the worktree's cache dir on the runner,
# copies that cache into a private per-run job dir, installs node_modules on a package-lock change, waits for one of
# RUNNER_SLOTS (default 2) remote slots, streams output, pulls back results, deletes the job dir, exits with the remote code.
# Parallel runs of the same worktree each get their own job dir, so they never write into each other's files.
set -u
D=$(cd "$(dirname "$0")" && pwd)
KEY="${MI_RUNNER_KEY:-$HOME/.ssh/mi-runner}"
usage() { echo "usage: sh tools/remote/run.sh <worktree> [--pull <path>]... [--with <path>]... [--env K=V]... -- <command...>" >&2; exit 64; }
[ $# -ge 3 ] || usage
WT=$(cd "$1" 2>/dev/null && pwd -P) || { echo "run.sh: no such worktree: $1" >&2; exit 64; }
shift
PULL=""; WITH=""; ENVS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --pull) [ $# -ge 2 ] || usage; PULL="$PULL
$2"; shift 2 ;;
    --with) [ $# -ge 2 ] || usage; WITH="$WITH
$2"; shift 2 ;;
    --env) [ $# -ge 2 ] || usage; ENVS="$ENVS
$2"; shift 2 ;;
    --) shift; break ;;
    *) usage ;;
  esac
done
[ $# -ge 1 ] || usage
git -C "$WT" rev-parse --git-dir >/dev/null 2>&1 || { echo "run.sh: $WT is not a git worktree" >&2; exit 64; }

sq() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
SLUG="$(basename "$WT" | tr -c 'A-Za-z0-9_.\n-' '_')-$(printf '%s' "$WT" | shasum | cut -c1-6)"
CACHE="/srv/mi/ws/$SLUG"                    # per-worktree sync cache: only rsync and the manifest write here, under the sync lock
JOB="/srv/mi/jobs/$SLUG-$$-$(date +%s)"     # private per-run copy of the cache: the job runs here and is deleted afterwards
T0=$(date +%s)
LIST=$(mktemp "${TMPDIR:-/tmp}/mi-remote-list.XXXXXX")
LOCK="${TMPDIR:-/tmp}/mi-remote-sync-$SLUG.lock"
LOCKED=""
JOB_STARTED=""
SSHO=""; HOST=""
cleanup() {
  rm -f "$LIST"
  [ -n "$LOCKED" ] && rmdir "$LOCK" 2>/dev/null
  [ -n "$JOB_STARTED" ] && ssh $SSHO "$HOST" "rm -rf -- $JOB" >/dev/null 2>&1
  return 0
}
trap cleanup EXIT

# File list: tracked + untracked-not-ignored, minus deleted files and dev-only heavy paths (override with --with <path>).
MI_WITH="$WITH" python3 -I - "$WT" > "$LIST" <<'PY'
import os, subprocess, sys
wt = sys.argv[1]
def git(*a):
    return subprocess.run(["git", "-C", wt, *a], check=True, capture_output=True).stdout.decode("utf-8", "surrogateescape").split("\0")[:-1]
files = set(git("ls-files", "-z", "-c", "-o", "--exclude-standard")) - set(git("ls-files", "-z", "-d"))
skip_dirs = ("test-results/", "initial-drafts/", "experiment/", "references/", "drafts-pipeline/", "epics-pipeline/", "folio-2025/", ".claude/", ".git/")
with_ = [w.strip("/") + "/" for w in os.environ.get("MI_WITH", "").split("\n") if w.strip()]
def keep(f):
    if any(f.startswith(w) or f == w[:-1] for w in with_): return True
    if f.startswith(skip_dirs): return False
    if f.startswith("assets/") and f.rsplit(".", 1)[-1] in ("blend", "wav", "ogg", "mp3", "webm", "mp4"): return False
    return True
out = sorted(f for f in files if keep(f) and os.path.lexists(os.path.join(wt, f)))
sys.stdout.buffer.write(b"".join(f.encode("utf-8", "surrogateescape") + b"\0" for f in out))
PY
[ -s "$LIST" ] || { echo "run.sh: empty file list" >&2; exit 70; }

# Pick the least-loaded runner with a free slot (waits; adds a runner after 5 min of waiting, max 4).
IP=$(python3 -I "$D/pool.py" pick) || { echo "run.sh: no runner available" >&2; exit 69; }
HOST="runner@$IP"
SSHO="-i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=$HOME/.ssh/known_hosts_mi-runner -o LogLevel=ERROR -o ControlMaster=auto -o ControlPath=$HOME/.ssh/cm-mir-%C -o ControlPersist=5m -o ServerAliveInterval=15 -o ServerAliveCountMax=8"

# retry <cmd...>: re-run up to 3 times when it fails with 255 (ssh connection failure). Other exit codes return at once.
retry() {
  n=0
  while :; do
    "$@"; rc=$?
    [ "$rc" -ne 255 ] && return "$rc"
    n=$((n + 1))
    [ "$n" -gt 3 ] && return "$rc"
    echo "[remote] connection failed (exit 255), retry $n/3" >&2
    sleep $((n * 3))
  done
}

# Serialize cache updates (sync, manifest, copy to job dir) across parallel runs of this worktree. mkdir lock, stale after 10 min.
i=0
until mkdir "$LOCK" 2>/dev/null; do
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; continue; fi
  i=$((i + 1)); [ "$i" -gt 600 ] && { echo "run.sh: sync lock busy: $LOCK" >&2; exit 70; }
  sleep 1
done
LOCKED=1

echo "[remote] sync $WT -> $IP:$CACHE"
# The cache is seeded once from the newest existing cache (hardlinks; rsync replaces changed files via rename, so no cross-talk).
# node_modules is never kept in the cache: each job gets it from /srv/mi/nm (see exec.sh).
retry ssh $SSHO "$HOST" "mkdir -p /srv/mi/queue /srv/mi/ws /srv/mi/jobs; find /srv/mi/jobs -mindepth 1 -maxdepth 1 -mmin +1440 -exec rm -rf {} + 2>/dev/null; if [ ! -d $CACHE ]; then src=\$(ls -td /srv/mi/ws/*/ 2>/dev/null | head -1); if [ -n \"\$src\" ]; then cp -al \"\$src\" $CACHE; else mkdir -p $CACHE; fi; fi; rm -rf $CACHE/node_modules $CACHE/.mi-nmhash" \
  || { echo "run.sh: cannot reach $HOST" >&2; exit 69; }
retry rsync -a --no-perms --chmod=ugo=rwX -z --from0 --files-from="$LIST" -e "ssh $SSHO" "$WT/" "$HOST:$CACHE/" \
  || { echo "run.sh: rsync failed" >&2; exit 70; }
# The cache is also a (commit-less) git repo whose index lists the synced files: some tests call `git ls-files`.
# Remove files that were synced last time but are gone now; keep the manifest for the next run.
retry scp -q $SSHO "$LIST" "$HOST:$CACHE/.mi-manifest.new" \
  && retry ssh $SSHO "$HOST" "cd $CACHE && if [ -f .mi-manifest ]; then tr '\\0' '\\n' < .mi-manifest | sort > .o; tr '\\0' '\\n' < .mi-manifest.new | sort > .n; comm -23 .o .n | while IFS= read -r f; do rm -f -- \"\$f\"; done; rm -f .o .n; fi; mv .mi-manifest.new .mi-manifest; [ -d .git ] || git init -q; rm -f .git/index; git update-index --add --info-only -z --stdin < .mi-manifest" \
  || { echo "run.sh: manifest update failed" >&2; exit 70; }
# Private job dir: a full copy (about 270 MB of source), so parallel jobs never write into each other's files or into the cache.
JOB_STARTED=1
retry ssh $SSHO "$HOST" "rm -rf -- $JOB && cp -a $CACHE $JOB" || { echo "run.sh: cannot create job dir" >&2; exit 70; }
rmdir "$LOCK" 2>/dev/null; LOCKED=""
T1=$(date +%s)

# Remote side: slot + node_modules cache + run (tools/remote/exec.sh travels with the worktree).
ARGS=""; for a in "$@"; do ARGS="$ARGS $(sq "$a")"; done
ENVARGS=""; OLDIFS=$IFS; IFS='
'; for e in $ENVS; do [ -n "$e" ] && ENVARGS="$ENVARGS $(sq "$e")"; done; IFS=$OLDIFS
echo "[remote] sync $((T1 - T0))s, $(tr -cd '\0' < "$LIST" | wc -c | tr -d ' ') files; job $JOB; queueing for a slot"
ssh $SSHO -T "$HOST" "cd $JOB && MI_SLUG=$SLUG MI_ENVS=$(sq "$ENVARGS") bash tools/remote/exec.sh --$ARGS"
RC=$?
T2=$(date +%s)

# Results are pulled from the job dir before cleanup (the EXIT trap deletes the job dir).
IFS='
'
for p in $PULL; do
  [ -n "$p" ] || continue
  mkdir -p "$(dirname "$WT/$p")"
  rsync -a -z -e "ssh $SSHO" "$HOST:$JOB/$p" "$(dirname "$WT/$p")/" 2>/dev/null && echo "[remote] pulled $p" || echo "[remote] could not pull $p (missing?)" >&2
done
python3 -I "$D/pool.py" reap >/dev/null 2>&1 &
echo "[remote] done exit=$RC (runner $IP, sync $((T1 - T0))s, remote total $((T2 - T1))s)"
exit $RC
