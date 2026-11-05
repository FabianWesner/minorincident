import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { minigun } from '../../../src/data/minigun';
import { megaAlpha } from '../../../src/data/megaAlpha';
import { infectedDefinitions } from '../../../src/data/infected';
import { catalog } from '../../../src/data/actions/catalog';
import { CureFront } from '../../../src/sim/missions/CureFront';
import { LevelTenFinale } from '../../../src/sim/missions/LevelTenFinale';
import { Mission } from '../../../src/sim/missions/Mission';
import { runFixtures, fixtureHash } from './fixtures';
import { checkpointProbe, checkpointHash } from './checkpoints';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson, reportRoot } from './report';
import type { Clause } from './evaluate';
import { l3 } from '../../../src/data/l3';
import { loadL3 } from '../../sim-runner/l3Bots';
import { l3HumanCensus, l3HumansPass } from './battery-fixtures';

// Each mutation is process-local, restored in finally, and never written to game source.
const identity = provenance(), results: { name: string; clause: string; detected: boolean }[] = [];
const baseline = await runFixtures('L10', 'low', identity.sourceHash, 'fault-proof');
assert.deepEqual(baseline.errors, []);
async function fault(name: string, clause: string, change: () => () => void) {
  assert.equal(baseline.checks.find(check => check.clause === clause)?.status, 'PASS', `${name}: baseline must pass`);
  const restore = change();
  try {
    const broken = await runFixtures('L10', 'low', identity.sourceHash, 'fault-proof');
    const detected = broken.checks.find(check => check.clause === clause)?.status === 'FAIL';
    results.push({ name, clause, detected }); assert(detected, `${name}: actual production fault must be detected`);
  } finally { restore(); }
}
await fault('minigun fires19/s', 'minigun rounds and heat per full-speed second', () => {
  const config = minigun as unknown as { rate: number }, before = config.rate; config.rate = 19; return () => { config.rate = before; };
});
await fault('dog telegraph shortened', 'actual dog telegraph duration', () => {
  const dog = infectedDefinitions.find(def => def.id === 'infected.dog')!, before = dog.windup; dog.windup = .5; return () => { dog.windup = before; };
});
await fault('Mega dies before rocket9', 'Mega direct rocket9/10 HP threshold', () => {
  const config = megaAlpha as unknown as { directRocketFraction: number }, before = config.directRocketFraction; config.directRocketFraction = .125; return () => { config.directRocketFraction = before; };
});
await fault('cure stops applying damage', 'cure native species mortality and healthy immunity', () => {
  const apply = CureFront.prototype.apply; CureFront.prototype.apply = () => {}; return () => { CureFront.prototype.apply = apply; };
});
await fault('release ignores prerequisites', 'release predicate missing-prerequisite matrix', () => {
  const update = LevelTenFinale.prototype.update;
  LevelTenFinale.prototype.update = function () { update.call(this); (this as unknown as { mission: Mission }).mission.state.states['cure-released'] = true; };
  return () => { LevelTenFinale.prototype.update = update; };
});
await fault('Alpha bar disabled', 'production enemy-bar eligibility at distance/health boundaries', () => {
  const def = infectedDefinitions.find(def => def.id === 'infected.alpha')!, before = def.bar; def.bar = false; return () => { def.bar = before; };
});
{
  const baseline = await runFixtures('L2', 'low', identity.sourceHash, 'fault-proof');
  const clause = 'axe measured roundhouse displacement'; assert.equal(baseline.checks.find(check => check.clause === clause)?.status, 'PASS');
  const sweep = catalog['weapon.fire-axe'].roundhouse!, before = sweep.knockback;
  try {
    sweep.knockback = 0;
    const broken = await runFixtures('L2', 'low', identity.sourceHash, 'fault-proof');
    const detected = broken.checks.find(check => check.clause === clause)?.status === 'FAIL';
    results.push({ name: 'axe sweep loses shove', clause, detected }); assert(detected);
  } finally { sweep.knockback = before; }
}
{
  const native = JSON.parse(readFileSync(`${reportRoot}/receipts/L2-low-complete.json`, 'utf8')) as NativeReceipt;
  const restore = Mission.prototype.restore;
  try {
    console.log('[qa:accept:fault-proof] Deliberately restoring the wrong checkpoint in an isolated process');
    Mission.prototype.restore = function (_id, resume) { return restore.call(this, 'start', resume); };
    const broken = await checkpointProbe(native, 'fault-proof', fixtureHash());
    const detected = broken.checks.some((check: Clause) => check.id === 'G-21' && check.status === 'FAIL');
    results.push({ name: 'respawn always uses start', clause: 'G-21 checkpoint identity', detected }); assert(detected);
  } finally { Mission.prototype.restore = restore; }
}
{
  const sample = async () => {
    const { world } = await loadL3(1, 'low');
    try {
      const at = world.entities.get(1)!.transform, humans = [];
      for (let i = 0; i < 40; i++) {
        const id = world.infected!.spawn('infected.runner', at), e = world.entities.get(id)!;
        humans.push({ archetype: e.archetype, speed: e.infected!.speed });
      }
      return l3HumanCensus(humans);
    } finally { world.dispose(); }
  };
  assert(l3HumansPass(await sample()), 'native L3 admission baseline must pass');
  const config = l3.infected as unknown as { maxRegularMs: number; sprinterEvery: number };
  for (const [key, bad, name] of [['maxRegularMs', 4.5, 'L3 regular speed exceeds4m/s'], ['sprinterEvery', 10, 'L3 sprinter frequency doubles']] as const) {
    const before = config[key];
    try {
      config[key] = bad;
      const detected = !l3HumansPass(await sample());
      results.push({ name, clause: 'native L3 human speed and admitted sprinter fraction', detected }); assert(detected);
    } finally { config[key] = before; }
  }
}
const codeHash = createHash('sha256').update(readFileSync(new URL('./fault-proof.ts', import.meta.url))).digest('hex');
atomicJson(`${reportRoot}/fault-proof.json`, { ...identity, fixtureHash: fixtureHash(), checkpointHash: checkpointHash(), codeHash, scope: 'process-local restored fault injection; no source/configuration file edits', results });
console.log(`[qa:accept:fault-proof] ${results.length}/${results.length} injected production faults detected`);
