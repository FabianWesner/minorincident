/** Actual mortal L5 completion save -> native L6 shelter posture/identity regression. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { preset, type CampaignSave } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { emptyInput } from '../../src/input/InputFrame';
import { loadLevel, runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

const out = 'test-results/fix67-b/l6-handover'; mkdirSync(out, { recursive: true });
const identity = provenance(), rows = [], reuse = process.argv.includes('--reuse-saves');
const clips: Record<string, string> = { sit: 'npc-sit', talk: 'npc-gesture', treat: 'npc-cower', rest: 'death-side', share: 'npc-give' };
for (const tier of ['low', 'high'] as const) {
  const path = `${out}/${tier}-L5-save.json`;
  let save: CampaignSave;
  if (reuse && existsSync(path)) save = JSON.parse(readFileSync(path, 'utf8'));
  else {
    save = preset('L5-default'); save.settings.quality = tier;
    const run = await runLevel('L5', 'complete', 1, undefined, 'auto', save, (world, result) => completeCampaignLevel(save, 5, result, world), 0, { quality: tier });
    assert.ok(run.completed, 'ordinary mortal L5 must finish before testing its handover');
    assert.equal(save.stationOccupants?.length, 24);
    writeFileSync(path, JSON.stringify(save) + '\n');
    writeFileSync(`${out}/${tier}-L5-source.json`, JSON.stringify({ ...identity, run }, null, 2) + '\n');
  }
  const w = await loadLevel('L6', 1, save, 0, { quality: tier });
  try {
    const snapshot = (second: number) => ({ second, actors: w.missions!.state.l6!.survivors.map(row => {
      const e = w.entities.get(row.id)!;
      return { id: e.id, key: row.key, routine: row.routine, clip: e.civilian!.story?.clip,
        at: { ...e.transform }, health: { ...e.health }, appearance: e.appearance,
        storyProp: e.civilian!.story?.prop, allyWeapon: e.civilian!.ally?.weapon };
    }) });
    const samples: ReturnType<typeof snapshot>[] = [], idleTicks = new Map<number, number>(); let maxIdleTicks = 0;
    for (let second = 0; second <= 4; second++) {
      if (second) for (let tick = 0; tick < 60; tick++) {
        w.applyInput(emptyInput(), 'keyboard'); w.update();
        for (const row of w.missions!.state.l6!.survivors) {
          const clip = w.entities.get(row.id)!.civilian!.story?.clip;
          const idle = !clip || clip === 'idle' ? (idleTicks.get(row.id) ?? 0) + 1 : 0;
          idleTicks.set(row.id, idle); maxIdleTicks = Math.max(maxIdleTicks, idle);
        }
      }
      samples.push(snapshot(second));
    }
    const expectedIds = [...save.stationOccupants!, ...save.rescuedSurvivors ?? []].map(e => e.id).sort((a, b) => a - b);
    const identityPreserved = JSON.stringify(samples[0].actors.map(e => e.id).sort((a, b) => a - b)) === JSON.stringify(expectedIds);
    const fullHealth = samples.every(s => s.actors.every(e => e.health.max > 0 && e.health.current === e.health.max));
    const routineClipsMatch = samples.every(s => s.actors.every(e => e.routine === 'guard' ? !!e.clip && e.clip !== 'idle' : e.routine in clips && e.clip === clips[e.routine]));
    const allRoutinesPresent = Object.keys(clips).every(routine => samples[0].actors.some(e => e.routine === routine));
    const noSeatedGuns = samples.every(s => s.actors.filter(e => e.routine === 'sit' || e.routine === 'rest').every(e => !e.storyProp && !e.allyWeapon && !e.appearance?.handProp));
    const withinShelter = samples.every(s => s.actors.every(e => e.at.z < 11 && e.at.x < 25));
    rows.push({ tier, inputSave: path, inputSaveSha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
      identityPreserved, fullHealth, routineClipsMatch, allRoutinesPresent, noSeatedGuns, maxIdleTicks, withinShelter, samples });
    console.log(tier, { identityPreserved, fullHealth, routineClipsMatch, allRoutinesPresent, noSeatedGuns, maxIdleTicks, withinShelter });
  } finally { w.dispose(); }
}
writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...identity, rows }, null, 2) + '\n');
if (rows.some(r => !r.identityPreserved || !r.fullHealth || !r.routineClipsMatch || !r.allRoutinesPresent || !r.noSeatedGuns || r.maxIdleTicks > 180 || !r.withinShelter)) process.exitCode = 1;
