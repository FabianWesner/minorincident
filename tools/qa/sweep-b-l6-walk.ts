/** Controlled production follower walks; no injuries or speeds patched. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) for (let rosterIndex = 0; rosterIndex < 29; rosterIndex++) {
  const campaign = preset('L6-default'); campaign.settings.quality = tier;
  const w = await loadLevel('L6', 1, campaign, 0, { quality: tier });
  try {
    const m = w.missions!, s = m.state.l6!;
    m.completeObjective('shelter'); m.completeObjective('stop');
    const r = s.survivors[rosterIndex], injured = r.injured, e = w.entities.get(r.id)!;
    // Keep every roster member present. The selected walker gets an empty
    // existing tunnel lane, well away from the other shelter bodies.
    r.status = 'following'; r.collected = false; r.straggler = false;
    Object.assign(e.transform, { x: 110, z: 15, y: 1.3, yaw: 0 });
    e.civilian!.survivor!.slot = 0;
    w.solids.forget(e); w.spatial.set(e.id, 110, 15);
    s.leaderX = 145; s.leaderZ = 15;
    const samples = [];
    for (let i = 0; i < 240; i++) {
      w.tick++; const before = { ...e.transform };
      m.l6!.follower(e); w.solids.commit();
      samples.push({ tick: w.tick, x: e.transform.x, z: e.transform.z, speed: Math.hypot(e.transform.x - before.x, e.transform.z - before.z) * 60 });
    }
    const settled = samples.slice(120), min = Math.min(...settled.map(s => s.speed)), max = Math.max(...settled.map(s => s.speed));
    rows.push({ tier, injured, id: e.id, hp: e.health, originalRosterCount: s.survivors.length, minSettledSpeed: min, maxSettledSpeed: max, samples });
    console.log(tier, injured, min, max);
  } finally { w.dispose(); }
}
writeFileSync(process.env.L6_VISUAL_NATIVE_OUT ?? 'docs/reports/sweep-b/L6-walk.json', JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-walk.ts')).digest('hex'), method: 'Explicit production follower fixture: completes shelter/stop, places each of all29 existing roster members, including authored injured actors, separately on an empty straight tunnel lane, keeps all29 original actors, and invokes the actual LevelSixSubway.follower plus final contact commit for240ticks. Final120ticks measure settled walking; no health, speed, cap or target changes. Other AI/time progression is frozen; bars are a separate renderer clause.', rows }, null, 2) + '\n');
