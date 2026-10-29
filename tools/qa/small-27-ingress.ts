/** Q-215 diagnostic: isolate the recorded live Metro approach with unchanged movement/contact rules. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { l5 } from '../../src/data/l5';

const stage = process.argv[2] ?? 'before';
const source = process.env.Q215_TRACE ?? 'docs/reports/small-27/diagnostics/l5-before-2.jsonl.gz';
const bytes = readFileSync(source), data = source.endsWith('.gz') ? gunzipSync(bytes) : bytes;
const lines = data.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
const observations = lines.filter(line => line.metro).map(line => line.metro);
const arrival = observations.find(row => row.metroAt);
const follow = process.argv.includes('--follow');
const blockedPose = process.argv.includes('--blocked-pose'), click = process.argv.includes('--click');
const sample = blockedPose ? observations.find(row => row.metroAt && row.tick >= arrival.metroAt + 240) : follow ? observations.find(row => row.phase === 'metro' && row.tick >= arrival.metroAt - Number(process.env.Q215_LEAD_TICKS ?? 600)) : arrival;
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
  const s = m.state.l5!, delta = w.tick - sample.tick;
  for (const r of s.survivors) {
    const recorded = sample.survivors.find((entry: { key: string }) => entry.key === r.key), e = w.entities.get(r.id)!;
    r.status = combat && r.key !== 'okafor' ? 'dead' : recorded.status;
    if (r.status !== 'following') { e.hidden = true; e.civilian!.survivor!.mode = 'hidden'; w.spatial.delete(e.id); continue; }
    Object.assign(e.transform, recorded.transform);
    e.civilian = structuredClone(recorded.civilian); e.locomotion = structuredClone(recorded.locomotion);
    // Rebase recorded deadlines, as checkpoint restore does. Keeping the old
    // tick domain would manufacture a long flee/reload after its threat left.
    const c = e.civilian!, sv = c.survivor!;
    for (const key of ['entered', 'until', 'pauseUntil', 'knockedUntil', 'activityUntil', 'activityStarted', 'dangerUntil', 'lastTravelProgress'] as const) if (c[key]) c[key]! += delta;
    for (const key of ['waitAt', 'foundAt', 'fearUntil'] as const) if (sv[key]) sv[key]! += delta;
    r.foundAt = sv.foundAt;
    if (c.story) c.story.start += delta;
    if (c.ally) for (const key of ['nextAttack', 'strikeAt', 'forceUntil', 'stepAfter', 'reloadUntil', 'flinchUntil', 'panicUntil', 'calloutAt', 'blockedAt', 'aimMoveAt', 'aimMoveRestUntil'] as const) if (c.ally[key]) c.ally[key]! += delta;
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
  if (sample.companion?.length && !process.argv.includes('--queue')) {
    const dog = w.entities.get(w.npcs!.companion.spawn())!, recorded = sample.companion[0];
    Object.assign(dog.transform, recorded.transform); dog.companion = structuredClone(recorded.companion); delete dog.locomotion;
    for (const key of ['until', 'barkAt', 'hurtAt', 'transitionUntil'] as const) if (dog.companion![key]) dog.companion![key]! += delta;
    w.spatial.set(dog.id, dog.transform.x, dog.transform.z);
  }
  s.metroAt = follow ? 0 : w.tick; s.phase = 'metro';
  if (follow) {
    const initialTick = w.tick;
    w.events.on('sim.tick', () => {
      const tick = sample.tick + w.tick - initialTick;
      const next = observations.findIndex(row => row.tick >= tick), b = observations[next < 0 ? observations.length - 1 : next];
      const a = observations[Math.max(0, (next < 0 ? observations.length - 1 : next) - 1)];
      const span = Math.max(1, b.tick - a.tick), t = Math.max(0, Math.min(1, (tick - a.tick) / span));
      for (const key of ['x', 'y', 'z', 'yaw'] as const) player.transform[key] = a.player[key] + (b.player[key] - a.player[key]) * t;
      player.survivor!.velocity = { x: (b.player.x - a.player.x) / span * 60, z: (b.player.z - a.player.z) / span * 60 };
      w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
      Object.assign(w.previousPlayer!, player.transform); w.spatial.set(1, player.transform.x, player.transform.z);
    }, 1.5);
  }
  if (process.argv.includes('--queue')) {
    const dog = w.entities.get(w.npcs!.companion.spawn())!;
    Object.assign(dog.transform, { x: 37.77191, z: -49.34055, y: .975 });
    Object.assign(dog.companion!, { state: 'follow', following: false, velocity: { x: 0, z: 0 }, pickup: null });
    w.spatial.set(dog.id, dog.transform.x, dog.transform.z);
  }
  if (combat) {
    const id = w.infected!.spawn('infected.alpha', { x: 43, z: -34 });
    w.entities.get(id)!.infected!.territory = { x: 43, z: -34, radius: l5.infected.leashM };
  }
  const start = w.tick;
  for (let i = 0; i < (follow ? arrival.metroAt - sample.tick + 1800 : 1800) && !s.shutterAt; i++) {
    if (click) w.setInput({ moveTarget: i === 0 ? m.def.anchors['l5-metro-foot'] : undefined });
    if (i % 10 === 0) trace.push({ tick: i, player: { ...player.transform }, inputMove: { ...w.inputFrame.move }, text: m.l5!.metroStatus(), followers: s.survivors.filter(r => r.status === 'following').map(r => {
      const e = w.entities.get(r.id)!;
      return { key: r.key, position: { ...e.transform }, goal: m.l5!.ingress(e), story: e.civilian?.story?.clip };
    }) });
    w.update();
  }
  const result = { stage, combat, follow, blockedPose, click, source, sourceRevision: execFileSync('git', ['-C', process.env.Q215_BASELINE_ROOT ?? '.', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceTick: sample.tick, sourceMetroAt: sample.metroAt, closedAfterS: s.shutterAt ? (s.shutterAt - (follow ? s.metroAt : start)) / 60 : null,
    survivors: s.survivors.map(r => ({ key: r.key, status: r.status, hp: w.entities.get(r.id)?.health.current })), trace };
  mkdirSync('test-results/small-27/ingress', { recursive: true });
  writeFileSync(`test-results/small-27/ingress/${stage}.json`, JSON.stringify(result));
  console.log(JSON.stringify({ ...result, trace: `${trace.length} samples` }));
} finally { w.dispose(); }
