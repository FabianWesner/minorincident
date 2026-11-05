#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
: "${E2E_PORT:=4891}"; : "${LIVE_PORT:=4892}"; : "${LUNA_MAX_MINUTES:=120}"; : "${LUNA_MAX_TURNS_PER_INVOCATION:=8}"; : "${LUNA_MIN_FREE_GB:=8}"
export E2E_PORT LIVE_PORT
[ "$E2E_PORT" = 4891 ] && [ "$LIVE_PORT" = 4892 ] || { echo 'Luna play uses E2E_PORT=4891 LIVE_PORT=4892' >&2; exit 2; }
[ "$E2E_PORT" != 3300 ] && [ "$LIVE_PORT" != 3300 ]
if [ "${LUNA_LEGACY_BROWSER:-0}" = 1 ] && [ "${LUNA_LOCKS_HELD:-0}" != 1 ]; then
  lockbase=${E2E_LOCK:-/tmp/minor-incident-e2e.lock}
  exec lockf -k -t 1800 "${lockbase}.0" lockf -k -t 1800 "${lockbase}.1" lockf -k -t 1800 "${lockbase}.2" lockf -k -t 1800 "${lockbase}.3" env LUNA_LOCKS_HELD=1 E2E_LEGACY=1 BROWSER_POOL=off MI_E2E_LOCK_HELD=1 MI_E2E_UNITS_HELD=4 E2E_SLOTS=4 E2E_UNITS=4 sh "$0"
fi
if [ "${LUNA_LEGACY_BROWSER:-0}" = 1 ]; then
  python3 tools/mac-gpu-guard.py 1
else
  export MI_BROWSER_POOL=1 BROWSER_POOL=on BROWSER_POOL_IDLE_MS="${LUNA_BROWSER_IDLE_MS:-300000}"
  # The pool owns the one GPU browser; Luna adds an isolated context, not a browser process.
  python3 tools/mac-gpu-guard.py 0
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ); run="$root/test-results/live/run-$stamp"; task_tmp="${TMPDIR:-/tmp}/luna-play-$stamp"
mkdir -p "$run/keep" "$run/.frames" "$task_tmp"
touch "$run/log.jsonl" "$run/player.jsonl"
export LUNA_RUN_DIR="$run" BROWSER_POOL_JOB_ID="luna-screen-play-$stamp" MI_WORKTREE_CACHE="${MI_WORKTREE_CACHE:-/private/tmp/minorincident-mi-cache}"
if [ "${LUNA_LEGACY_BROWSER:-0}" = 1 ]; then
  export BROWSER_POOL=off E2E_LEGACY=1 MI_E2E_LOCK_HELD=1
else
  export MI_BROWSER_POOL=1 BROWSER_POOL=on BROWSER_POOL_IDLE_MS="${LUNA_BROWSER_IDLE_MS:-300000}"
fi
fails=0; live_pid=''; heartbeat_pid=''; abort_reason=''; segments=0; summary_written=0
 disk_gb() { df -g / | awk 'NR==2 {print $4}'; }
write_summary() {
 [ "$summary_written" -eq 0 ] || return 0
 LUNA_RUN_DIR="$run" LUNA_ABORT_REASON="$abort_reason" node <<'NODE'
const fs=require('fs'),p=require('path'),d=process.env.LUNA_RUN_DIR;
const read=n=>fs.readFileSync(p.join(d,n),'utf8').split(/\n/).filter(Boolean).flatMap(x=>{try{return [JSON.parse(x)]}catch{return []}});
const api=read('log.jsonl'),pl=read('player.jsonl'),keepDir=p.join(d,'keep');
const shots=fs.readdirSync(keepDir).filter(x=>x.endsWith('.jpg')).sort().reverse();for(const f of shots.slice(3))fs.unlinkSync(p.join(keepDir,f));const kept=shots.slice(0,3);
const levels=[...new Set(pl.map(x=>x.level).filter(x=>x&&x!=='-'))],finished=[...new Set(pl.filter(x=>x.level_finished).map(x=>x.level))];
const deaths=new Map();for(const x of api)if(x.level&&x.level!=='-')deaths.set(x.level,x.deaths||0);
const reports=(field,type)=>pl.filter(x=>x[field]&&x[field]!=='none').map(x=>{const f=kept.find(n=>n.startsWith(`turn-${String(x.turn).padStart(6,'0')}-${type}`));return `- Turn ${x.turn}: ${x[field]} — ${f?`keep/${f}`:'screenshot unavailable'}`});
const keptTurns=new Set(kept.map(f=>Number(f.match(/turn-(\d+)/)?.[1])).filter(Number.isFinite));
const t=api.length?Math.max(...api.map(x=>x.wall_seconds||0)):0;
const a=['# Luna screenshot play','',`- Started: ${p.basename(d).replace('run-','')}`,`- Player turns logged: ${pl.length}`,`- API actions logged: ${api.length}`,`- Wall time: ${t}s`,`- Levels observed: ${levels.join(', ')||'none reported'}`,`- Levels finished: ${finished.join(', ')||'none visibly confirmed'}`,`- Deaths per level: ${[...deaths].map(([l,n])=>`${l}: ${n}`).join(', ')||'none recorded'}`,`- Autofight observed firing: ${api.some(x=>x.autofight==='autofight: firing')?'yes':'no'}`,`- Debug bar in kept frames: ${api.some(x=>keptTurns.has(x.turn)&&x.debug_bar_visible)?'present':'none'}`,`- Browser sessions: 1`,`- Result: ${process.env.LUNA_ABORT_REASON||'wall-clock cap reached'}`,'','## Glitch reports','',...(reports('glitch','glitch').length?reports('glitch','glitch'):['- None reported']),'','## Stuck reports','',...(reports('stuck','stuck').length?reports('stuck','stuck'):['- None reported']),'',`Kept screenshots: ${kept.length} (1280×720 JPEG, quality 70; maximum 3).`,''];fs.writeFileSync(p.join(d,'summary.md'),a.join('\n'));
NODE
 summary_written=1
}
cleanup() {
 [ -z "$heartbeat_pid" ] || { kill "$heartbeat_pid" 2>/dev/null || true; wait "$heartbeat_pid" 2>/dev/null || true; }
 [ -z "$live_pid" ] || { kill "$live_pid" 2>/dev/null || true; wait "$live_pid" 2>/dev/null || true; }
 rm -f "$root/test-results/live/shot.jpg" "$root/test-results/live/shot-keep.jpg" "$run/.input-turn.jpg" "$run/.action-turn.jpg"; rm -rf "$run/.frames"; write_summary
 rm -rf "$task_tmp"
}
trap cleanup EXIT; trap 'abort_reason=interrupted; exit 130' INT; trap 'abort_reason=terminated; exit 143' TERM
available=$(disk_gb); if [ -z "$available" ] || [ "$available" -lt "$LUNA_MIN_FREE_GB" ]; then abort_reason="aborted before startup: only ${available:-unknown} GB free (minimum $LUNA_MIN_FREE_GB GB)"; write_summary; exit 2; fi
npm run build:qa
start=$(date +%s); cap=$((LUNA_MAX_MINUTES*60)); turn=0; last_level='-'; last_objective=''; deaths=0; recent=''; session=''; credits=0
ready=0
for attempt in 1 2; do
  LUNA_WALL_OFFSET_MS=0 LUNA_TURN_OFFSET=0 node --import tsx tools/playtest/live.ts --screen --autofight --quality low --level "${LUNA_LEVEL:-L1}" >>"$run/live.out" 2>&1 & live_pid=$!; segments=$attempt
  for i in $(seq 1 120); do
    if ! kill -0 "$live_pid" 2>/dev/null; then break; fi
    if curl -fsS "http://127.0.0.1:$LIVE_PORT/look" >"$run/current.json" 2>/dev/null; then ready=1; break; fi
    sleep 1
  done
  [ "$ready" -eq 1 ] && break
  kill "$live_pid" 2>/dev/null || true; wait "$live_pid" 2>/dev/null || true; live_pid=''
done
[ "$ready" -eq 1 ] || { tail -n 30 "$run/live.out" >&2; abort_reason='live server failed to start after one retry'; exit 1; }
(while sleep 20; do curl -fsS --max-time 8 "http://127.0.0.1:$LIVE_PORT/ping" >/dev/null 2>&1 || true; done) & heartbeat_pid=$!
while [ $(( $(date +%s)-start )) -lt "$cap" ]; do
 if [ "$turn" -gt 0 ] && [ $((turn%20)) -eq 0 ]; then available=$(disk_gb); if [ -z "$available" ] || [ "$available" -lt "$LUNA_MIN_FREE_GB" ]; then abort_reason="aborted at turn $turn: only ${available:-unknown} GB free (minimum $LUNA_MIN_FREE_GB GB)"; break; fi; fi
 batch=$LUNA_MAX_TURNS_PER_INVOCATION; remain=$((20-turn%20)); [ "$remain" -eq 20 ] || [ "$batch" -le "$remain" ] || batch=$remain
 from=$((turn+1)); prompt=$(cat tools/playtest/luna-player-prompt.md); shot=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1])).screenshot)' "$run/current.json"); hud=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1])).hud)' "$run/current.json")
 batch_end=$((from+batch-1)); curl -fsS -X POST "http://127.0.0.1:$LIVE_PORT/batch" -H 'content-type: application/json' -d "{\"from\":$from,\"to\":$batch_end}" >/dev/null
 task="$prompt
State summary: current level=$last_level; objective=$last_objective; deaths=$deaths; recent action/objective history=$recent. Current visible HUD: $hud. If recent objective distances stayed flat twice or grew, change direction/route now unless the screenshot confirms a planned sidewalk detour. The current attached screenshot is fresh. Play up to $batch consecutive turns starting at turn $from, one action per turn, checking the newly returned screenshot with your image viewer after each action. Append one JSONL row per action to $run/player.jsonl. Do not stop before using the batch unless credits or a visible state needing intervention."
 before=$(grep -c . "$run/player.jsonl" || true)
 # A fresh Luna session per turn: resuming one session grew its context to ~400k tokens per turn.
 codex exec -m gpt-6-luna -c model_reasoning_effort=low -c service_tier=priority --image "$shot" --json --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$run" "$task" >"$run/codex.jsonl" 2>&1 || { fails=$((fails+1)); [ "$fails" -lt 5 ] || { abort_reason="player command failed 5 times in a row at turn $from"; break; }; continue; }
 tail -n 50 "$run/codex.jsonl" >>"$run/orchestrator.out"
 after=$(grep -c . "$run/player.jsonl" || true)
 if [ "$after" -le "$before" ]; then fails=$((fails+1)); [ "$fails" -lt 5 ] || { abort_reason="no player row 5 times in a row at turn $from"; break; }; curl -fsS "http://127.0.0.1:$LIVE_PORT/look" >"$run/current.json" || true; continue; fi
 fails=0
 # The harness owns turn numbers: renumber all rows by position.
 node -e 'const fs=require("fs"),f=process.argv[1];const a=fs.readFileSync(f,"utf8").split(/\n/).filter(Boolean).flatMap(l=>{try{return [JSON.parse(l)]}catch{return []}});fs.writeFileSync(f,a.map((x,i)=>JSON.stringify({...x,turn:i+1})).join("\n")+"\n")' "$run/player.jsonl"
 end=$(grep -c . "$run/player.jsonl")
 for n in $(seq "$from" "$end"); do
  turn=$n; row=$(sed -n "${n}p" "$run/player.jsonl"); [ -n "$row" ] || continue
  node - "$row" "$run/.frames" "$run/keep" "$turn" <<'NODE'
const fs=require('fs'),path=require('path');let x;try{x=JSON.parse(process.argv[2])}catch{process.exit(0)}const [frames,keep,turn]=process.argv.slice(3),id=String(turn).padStart(6,'0');
const copy=(src,suffix)=>{const f=path.join(frames,`turn-${id}-${src}.jpg`);if(fs.existsSync(f))fs.copyFileSync(f,path.join(keep,`turn-${id}${suffix}.jpg`))};
if(+turn%10===0)copy('action','');
if(x.glitch&&x.glitch!=='none')copy(x.glitch_screenshot==='input'?'input':'action','-glitch');if(x.stuck&&x.stuck!=='none')copy(x.stuck_screenshot==='input'?'input':'action','-stuck');
NODE
 done
 rm -f "$run/.frames"/*
 curl -fsS "http://127.0.0.1:$LIVE_PORT/look" >"$run/current.json" || { abort_reason='GET /look failed after batch'; break; }
 hud=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1])).hud)' "$run/current.json"); last_objective=$(printf '%s' "$hud" | tr '\n' ' ' | cut -c1-400); last_level=$(printf '%s' "$last_objective" | grep -Eo 'L[0-9]+' | head -1 || true); [ -n "$last_level" ] || last_level='-'; deaths=$(node -e 'let a=require("fs").readFileSync(process.argv[1],"utf8").trim().split(/\n/).filter(Boolean);try{console.log(JSON.parse(a.at(-1)).deaths||0)}catch{console.log(0)}' "$run/log.jsonl"); recent=$(tail -n 5 "$run/player.jsonl" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(s.trim().split(/\n/).map(l=>{try{const x=JSON.parse(l);return JSON.stringify(x.action)+" / "+x.objective}catch{return "?"}}).join(";"))})')
 grep -Eqi 'credits|the end' "$run/current.json" && { abort_reason='credits visibly reached'; break; }
done
[ -n "$abort_reason" ] || abort_reason="wall-clock cap reached after $LUNA_MAX_MINUTES minutes"; write_summary; echo "Luna run: $run"
