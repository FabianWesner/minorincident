/**
 * r2-way copy of sweep-a3-screen-run.mjs (same protocol: one fresh attached screenshot per decision, no model tool calls).
 * Changes, all control facts, no route facts:
 *  - the legend names the key for every screen direction. final-a's L3-12 trial pressed "wd" (up-right) eight times while
 *    describing "down-right", and L1-16 pressed "d" (minimap upper-right) for a target to the minimap's right;
 *  - L1 can start after a native depot pickup (--l1-pickup-prefix) so the 10-minute browser lease covers depot -> Annex -> garage.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { provenance } from './accept/probe.ts';

const level = process.argv[2] ?? 'L1', tier = process.argv[3] ?? 'low';
const out = resolve(process.env.SCREEN_RUN_OUT ?? `test-results/r2-way/screen-${level}-${tier}-${Date.now()}`);
const port = level === 'L1' ? 4875 : 4877, livePort = port + 1;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/identity.json`, JSON.stringify(provenance(), null, 2));
const fields = { move: { type: 'string', enum: ['', 'w', 'a', 's', 'd', 'wa', 'wd', 'sa', 'sd'] }, interact: { type: 'boolean' }, ms: { type: 'integer', minimum: 400, maximum: 4000 }, what_you_saw: { type: 'string' }, route_decision: { type: 'string' }, stuck: { type: 'string' } };
const schema = `${out}/decision-schema.json`;
writeFileSync(schema, JSON.stringify({ type: 'object', properties: fields, required: Object.keys(fields), additionalProperties: false }));
const fd = openSync(`${out}/live.log`, 'w');
const live = spawn(process.execPath, ['--import', 'tsx/esm', 'tools/playtest/live.ts', '--screen', '--step', '--autofight', '--level', level, '--quality', tier,
  ...(level === 'L3' ? ['--l3-retreat-prefix'] : level === 'L1' && process.env.SCREEN_RUN_FRESH !== '1' ? ['--l1-pickup-prefix'] : [])], {
  env: { ...process.env, E2E_PORT: String(port), LIVE_PORT: String(livePort), LUNA_RUN_DIR: out, LUNA_TIMING_LEDGER: '1', MI_BROWSER_POOL: '1', BROWSER_POOL: 'on' },
  stdio: ['ignore', fd, fd],
});
closeSync(fd);
let player;
try {
  const base = `http://127.0.0.1:${livePort}`;
  let current;
  for (let i = 0; i < 300; i++) {
    if (live.exitCode !== null) throw Error(`Live server exited ${live.exitCode}`);
    try { const r = await fetch(`${base}/look`); if (r.ok) { current = await r.json(); break; } } catch { /* server startup */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!current) throw Error('Live server unavailable');
  const prompt = `You are the named Luna screenshot-only player of Minor Incident. Inspect the attached image and visible HUD; choose ONE physical control action and return only the requested JSON. No tools or file/service reads. Never inspect hidden state, code, maps, reports or prior playtests. Play the visible objective using signs, paths, the yellow screen-edge arrow and minimap; ask for no route help.
Controls: one key per screen direction, two keys for a screen diagonal: up=w, down=s, left=a, right=d, up-right=wd, down-right=sd, down-left=sa, up-left=wa. To walk the way the yellow screen-edge arrow points, use that arrow's screen direction from this list (an arrow pointing down-right means sd, never wd). The camera looks north-west and the minimap is north-up, so minimap directions map differently: minimap right=sd, minimap up=wd, minimap left=wa, minimap down=sa (w alone goes to the minimap's upper-left, d to its upper-right, s to its lower-right, a to its lower-left). E interacts near a target. Remain on foot, ignore optional bike prompts. Prefer4000ms holds on clear ground; shorter near a visible corner or when target≤6m. Within2m of the named objective, interact=true holds E, or wait when HUD says hold still. Empty move and interact=false waits. Wait4000ms for a story panel blocking movement. Aim assist and courier protection measure navigation only. Time pauses between actions; model latency is excluded. Every later turn will have a NEW attached screenshot. Describe only what you see now. Use ms400–4000 and one of move or interact; no other actions.`;
  writeFileSync(`${out}/player-prompt.txt`, prompt);
  const history = [];
  for (let turn = 1; turn <= 80; turn++) {
    const decisionFile = `${out}/decision-${turn}.json`, logFile = `${out}/agent-${turn}.jsonl`;
    const log = openSync(logFile, 'w');
    player = spawn('codex', ['exec', '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort=low', '-c', 'service_tier=priority', '--image', current.screenshot,
      '--output-schema', schema, '--output-last-message', decisionFile, '--json', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-C', out,
      `${prompt}\nTurn${turn}. Your recent decisions: ${JSON.stringify(history.slice(-5).map(h => ({turn:h.turn,decision:h.decision,action:h.action})))}`], { stdio: ['ignore', log, log] });
    closeSync(log);
    const code = await new Promise((done, reject) => { player.on('error', reject); player.on('close', done); });
    if (code !== 0) throw Error(`Player exit${code}`);
    const audit = readFileSync(logFile, 'utf8').split('\n').filter(s => s.startsWith('{')).map(s => JSON.parse(s));
    if (audit.some(e => e.item && !['agent_message', 'reasoning'].includes(e.item.type))) throw Error('Player attempted a tool call; reject the trial');
    const d = JSON.parse(readFileSync(decisionFile, 'utf8'));
    if (!fields.move.enum.includes(d.move) || !Number.isFinite(d.ms) || d.ms < 400 || d.ms > 4000 || d.move && d.interact) throw Error('Invalid physical control');
    const action = { ...(d.move ? { move: d.move, ms: d.ms } : d.interact ? { hold: 'e', ms: d.ms } : { wait: d.ms }), playerTurn: turn, playerLevel: level };
    const priorHud = current.hud;
    const response = await fetch(`${base}/act`, { method: 'POST', body: JSON.stringify(action) });
    if (!response.ok) throw Error(`Input rejected ${response.status}`);
    current = await response.json();
    const observation = { turn, visibleHudBefore: priorHud, decision: d, action, visibleHudAfter: current.hud };
    appendFileSync(`${out}/player.jsonl`, JSON.stringify(observation) + '\n'); history.push(observation);
    console.log(level, tier, turn, current.hud.split('\n')[0]);
    if (/Mission complete|Continue to next level|Get inside the fire station/i.test(current.hud)) break;
  }
} finally {
  player?.kill('SIGTERM'); live.kill('SIGTERM');
}
