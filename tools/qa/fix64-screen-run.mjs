// The named Luna player receives screenshots/HUD and controls only, with no route hints.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const level = process.argv[2] ?? 'L1', tier = process.argv[3] ?? 'low';
const suffix = process.argv[4] ?? 'full', batches = Number(process.argv[5] ?? 8);
if (process.env.MI_BROWSER_POOL_EXTERNAL === '1' || process.env.BROWSER_POOL === 'off') throw Error('Screenshot play requires the shared pool; invoke through browser-job.py, not an opaque wrapper reservation');
const port = level === 'L1' ? 4891 : 4893, livePort = port + 1;
const out = resolve(`test-results/fix64-a/screen-${level}-${tier}-${suffix}`);
mkdirSync(out, { recursive: true });
if (existsSync(`${out}/log.jsonl`)) throw Error('Use a fresh output directory; this run already has actions');
writeFileSync(`${out}/player.jsonl`, '');
const fd = openSync(`${out}/live.log`, 'w');
const live = spawn(process.execPath, ['--import', 'tsx/esm', 'tools/playtest/live.ts', '--screen', '--step', '--autofight', '--level', level, '--quality', tier, ...(level === 'L3' && suffix.startsWith('route') ? ['--l3-retreat-prefix'] : [])], {
  env: { ...process.env, E2E_PORT: String(port), LIVE_PORT: String(livePort), LUNA_RUN_DIR: out, LUNA_TIMING_LEDGER: '1', MI_BROWSER_POOL: '1', BROWSER_POOL: 'on' }, stdio: ['ignore', fd, fd],
});
closeSync(fd);
const base = `http://127.0.0.1:${livePort}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = path => existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(x => JSON.parse(x)) : [];
const prompt = `You are the named Luna screenshot-only player of Minor Incident. Use only the attached screenshot and the visible HUD text provided below. Never read game source, browser internals, hidden state, maps from files, or previous reports. Do not request navigation assistance. Play the currently visible objectives using physical WASD/mouse/E. W moves up on the screen, S down, A left, D right; diagonals combine two keys. Use screenshot changes to learn movement. E interacts near a visible target. Follow visible signs, paths, objective arrows and HUD distance. You may use the visible minimap. Stay on foot and ignore optional ride prompts; press E once to dismount if needed. On a clear path prefer4000ms moves; use shorter holds only at corners or final alignment. When the named objective is within2m, hold E for1200ms; if HUD says hold still, wait or hold E. If a visible story panel blocks control, use a4000ms wait. These are control instructions, not route directions. Combat aim assistance is enabled and the courier is protected; this run measures navigation only. The clock pauses between actions, so only your action duration is active game time.\n\nSend one POST to ${base}/act per turn with JSON such as {"move":"wd","ms":3000,"playerTurn":1,"playerLevel":"${level}"}. Use holds up to4000ms on clear paths, shorter at corners. Other fields: key:"e", hold:"e", ms:900, button:"mission"/"retry"/"continue", wait:500. The response contains the fresh screenshot path and visible HUD. Open that screenshot with your image viewer after EVERY action before deciding another. Do not call /look or inspect any other service or game state.\n\nAppend exactly one JSON line per action to ${out}/player.jsonl with turn, objective, action, what_you_saw, route_decision, stuck (none or the visible confusion), and lost_active_seconds (your total action time since useful route progress stopped). Stop only at the end of the supplied turn batch or when the visible UI requires intervention. Do not claim the route complete unless the HUD proves it.\n`;
writeFileSync(`${out}/player-prompt.txt`, prompt);
try {
  let current;
  for (let i = 0; i < 600; i++) {
    if (live.exitCode !== null) throw Error(`Live server exited ${live.exitCode}`);
    try { const r = await fetch(`${base}/look`); if (r.ok) { current = await r.json(); break; } } catch { /* The live server may still be starting. */ }
    await sleep(1000);
  }
  if (!current) throw Error('Live server did not become ready');
  for (let batch = 0; batch < batches; batch++) {
    const prior = lines(`${out}/log.jsonl`), from = prior.length + 1, to = from + 7;
    await fetch(`${base}/batch`, { method: 'POST', body: JSON.stringify({ from, to }) });
    const task = `${prompt}\nPlay turns ${from} through ${to}. Current visible HUD: ${current.hud}\nYour previous recorded observations: ${readFileSync(`${out}/player.jsonl`, 'utf8').split('\n').slice(-9).join('\n')}`;
    const log = openSync(`${out}/codex-${batch}.jsonl`, 'w');
    const child = spawn('codex', ['exec', '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort=low', '-c', 'service_tier=priority', '--image', current.screenshot, '--json', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-C', out, task], { stdio: ['ignore', log, log] });
    closeSync(log);
    const code = await new Promise((r, reject) => { child.on('error', reject); child.on('close', r); });
    current = await (await fetch(`${base}/look`)).json();
    writeFileSync(`${out}/current.json`, JSON.stringify(current, null, 2));
    const after = lines(`${out}/log.jsonl`);
    console.log(level, tier, 'batch', batch + 1, 'exit', code, 'actions', after.length, current.hud.split('\n')[0]);
    if (after.length <= prior.length) throw Error('Player made no actions');
  }
} finally {
  live.kill('SIGTERM');
  for (let i = 0; i < 50 && live.exitCode === null; i++) await sleep(100);
  if (live.exitCode === null) live.kill('SIGKILL');
}
