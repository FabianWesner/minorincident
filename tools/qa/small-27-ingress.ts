/** Q-215 diagnostic: isolate the recorded live Metro approach with unchanged movement/contact rules. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { l5 } from '../../src/data/l5';

const stage = process.argv[2] ?? 'before';
const lines = readFileSync('test-results/small-27/l5-before-2/log-campaign.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line));
const sample = lines.find(line => line.metro?.metroAt)?.metro;
const loader = process.env.Q215_BASELINE_ROOT ? pathToFileURL(resolve(process.env.Q215_BASELINE_ROOT, 'tools/sim-runner/l5Bots.ts')).href : '../sim-runner/l5Bots';
const { loadL5 } = await import(loader) as typeof import('../sim-runner/l5Bots');
const { world: w, mission: m } = await loadL5(1, 'low');
const combat = process.argv.includes('--threat');
const trace: unknown[] = [];
try {
  m.completeObjective('emerge');
  for (let i = 0; i < 660; i++) w.update();
  m.completeObjective('look');
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  const s = m.state.l5!;
  for (const r of s.survivors) {
    const recorded = sample.survivors.find((entry: { key: string }) => entry.key === r.key), e = w.entities.get(r.id)!;
    r.status = combat && r.key !== 'okafor' ? 'dead' : recorded.status;
    if (r.status !== 'following') { e.hidden = true; e.civilian!.survivor!.mode = 'hidden'; w.spatial.delete(e.id); continue; }
    Object.assign(e.transform, recorded.transform);
    e.civilian = structuredClone(recorded.civilian); e.locomotion = structuredClone(recorded.locomotion);
    if (combat) {
      Object.assign(e.transform, { x: 38.2, z: -46.4 });
      Object.assign(e.civilian!.ally!, { nextAttack: w.tick, reloadUntil: 0, stepAfter: 0, targetId: 0, strikeAt: 0 });
    }
    w.spatial.set(e.id, e.transform.x, e.transform.z);
  }
  const player = w.entities.get(1)!;
  Object.assign(player.transform, sample.player);
  w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
  Object.assign(w.previousPlayer!, player.transform); w.spatial.set(1, player.transform.x, player.transform.z);
  s.metroAt = w.tick; s.phase = 'metro';
  if (combat) {
    const id = w.infected!.spawn('infected.alpha', { x: 43, z: -34 });
    w.entities.get(id)!.infected!.territory = { x: 43, z: -34, radius: l5.infected.leashM };
  }
  const start = w.tick;
  for (let i = 0; i < 1800 && !s.shutterAt; i++) {
    if (i % 10 === 0) trace.push({ tick: i, player: { ...player.transform }, text: m.l5!.metroStatus(), followers: s.survivors.filter(r => r.status === 'following').map(r => {
      const e = w.entities.get(r.id)!;
      return { key: r.key, position: { ...e.transform }, goal: m.l5!.ingress(e), story: e.civilian?.story?.clip };
    }) });
    w.update();
  }
  const result = { stage, combat, sourceTick: sample.tick, sourceMetroAt: sample.metroAt, closedAfterS: s.shutterAt ? (s.shutterAt - start) / 60 : null, trace };
  mkdirSync('test-results/small-27/ingress', { recursive: true });
  writeFileSync(`test-results/small-27/ingress/${stage}.json`, JSON.stringify(result));
  console.log(JSON.stringify({ ...result, trace: `${trace.length} samples` }));
} finally { w.dispose(); }
