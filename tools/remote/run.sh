#!/bin/sh
# Run a command for a worktree on the shared Hetzner runner (host alias `mi-runner`, see docs/tools/remote-runner.md).
#   sh tools/remote/run.sh <worktree> [--pull <path>]... [--with <path>]... [--env K=V]... -- <command...>
# Syncs tracked + untracked-not-ignored files (minus heavy dev-only dirs), installs node_modules on a package-lock
# change, waits for one of RUNNER_SLOTS (default 2) remote slots, streams output, pulls back results, exits with the remote code.
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
WS="/srv/mi/ws/$SLUG"
T0=$(date +%s)
LIST=$(mktemp "${TMPDIR:-/tmp}/mi-remote-list.XXXXXX")
trap 'rm -f "$LIST"' EXIT

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
SSHO="-i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=$HOME/.ssh/known_hosts_mi-runner -o LogLevel=ERROR -o ControlMaster=auto -o ControlPath=$HOME/.ssh/cm-mir-%C -o ControlPersist=5m"
echo "[remote] sync $WT -> $IP:$WS"
# A new workspace is seeded with a hardlink copy of the newest existing one (rsync replaces changed files via rename, so no cross-talk).
ssh $SSHO "$HOST" "mkdir -p /srv/mi/queue /srv/mi/ws; if [ ! -d $WS ]; then src=\$(ls -td /srv/mi/ws/*/ 2>/dev/null | head -1); if [ -n \"\$src\" ]; then cp -al \"\$src\" $WS; else mkdir -p $WS; fi; fi" || { echo "run.sh: cannot reach $HOST" >&2; exit 69; }
rsync -a --no-perms --chmod=ugo=rwX -z --from0 --files-from="$LIST" -e "ssh $SSHO" "$WT/" "$HOST:$WS/" || { echo "run.sh: rsync failed" >&2; exit 70; }
# The workspace is also a (commit-less) git repo whose index lists the synced files: some tests call `git ls-files`.
# Remove files that were synced last time but are gone now; keep the manifest for the next run.
scp -q $SSHO "$LIST" "$HOST:$WS/.mi-manifest.new" && ssh $SSHO "$HOST" "cd $WS && if [ -f .mi-manifest ]; then tr '\\0' '\\n' < .mi-manifest | sort > .o; tr '\\0' '\\n' < .mi-manifest.new | sort > .n; comm -23 .o .n | while IFS= read -r f; do rm -f -- \"\$f\"; done; rm -f .o .n; fi; mv .mi-manifest.new .mi-manifest; [ -d .git ] || git init -q; rm -f .git/index; git update-index --add --info-only -z --stdin < .mi-manifest"
T1=$(date +%s)

# Remote side: lock + npm ci cache + run (tools/remote/exec.sh travels with the worktree).
ARGS=""; for a in "$@"; do ARGS="$ARGS $(sq "$a")"; done
ENVARGS=""; OLDIFS=$IFS; IFS='
'; for e in $ENVS; do [ -n "$e" ] && ENVARGS="$ENVARGS $(sq "$e")"; done; IFS=$OLDIFS
echo "[remote] sync $((T1 - T0))s, $(tr -cd '\0' < "$LIST" | wc -c | tr -d ' ') files; queueing for a slot"
ssh $SSHO -o ServerAliveInterval=20 -T "$HOST" "cd $WS && MI_SLUG=$SLUG MI_ENVS=$(sq "$ENVARGS") bash tools/remote/exec.sh --$ARGS"
RC=$?
T2=$(date +%s)

IFS='
'
for p in $PULL; do
  [ -n "$p" ] || continue
  mkdir -p "$(dirname "$WT/$p")"
  rsync -a -z -e "ssh $SSHO" "$HOST:$WS/$p" "$(dirname "$WT/$p")/" 2>/dev/null && echo "[remote] pulled $p" || echo "[remote] could not pull $p (missing?)" >&2
done
python3 -I "$D/pool.py" reap >/dev/null 2>&1 &
echo "[remote] done exit=$RC (runner $IP, sync $((T1 - T0))s, remote total $((T2 - T1))s)"
exit $RC
