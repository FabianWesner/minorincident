/** Profile the unchanged E31/E32 high-tier timing workloads. Instrumented timings
 * are diagnostic only; acceptance still uses the original isolated Vitest cases. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { installNpcSystems } from '../../src/sim/npc/install';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';

const out = process.argv[2] ?? 'test-results/late-sim-profile'; mkdirSync(out, { recursive: true });
const hash = createHash('sha256');
for (const file of readdirSync('src/sim', { recursive: true }).map(String).filter(f => f.endsWith('.ts')).sort()) hash.update(file).update(readFileSync(`src/sim/${file}`));
const simSourceHash = hash.digest('hex'), results = [];
const profiler = new Session(); profiler.connect();
await profiler.post('Profiler.enable'); await profiler.post('Profiler.setSamplingInterval', { interval: 500 });
try {
  for (const level of ['L9', 'L10'] as const) {
    const w = new SimWorld(); await w.init();
    try {
      const layout = JSON.parse(readFileSync(`public/assets/layouts/${level === 'L9' ? 'D-CROSSING' : 'D-CURE'}.layout.json`, 'utf8')) as DistrictLayout;
      w.loadComposition(level === 'L9' ? compositions['D-CROSSING'] : compositions.L10, [layout], level === 'L9' ? 31 : 32);
      if (level === 'L9') {
        installNpcSystems(w); w.chunks!.setQuality('high');
        const p = w.entities.get(1)!; Object.assign(p.transform, { x: 0, z: -330 }); w.physics.playerBody!.setTranslation(p.transform, true); w.chunks!.update([0, -330]);
        w.infected!.director.levelCap = 200; w.infected!.director.setTier('high');
        for (let i = 0; i < 200; i++) w.infected!.spawn('infected.runner', { x: 15 + i % 20 * 2, z: -320 + Math.floor(i / 20) * 2 }, { state: 'chase' });
      } else {
        applyCampaign(w, preset('L10-default')); w.chunks!.setQuality('high');
        const mission = w.loadMission(resolveCampaignMission('L10', w.districts!)); mission.begin(); mission.loadCheckpoint('cure-disperse-ready');
        const p = w.entities.get(1)!; Object.assign(p.transform, { x: 4002, z: -25 }); w.physics.playerBody!.setTranslation(p.transform, true); w.chunks!.update();
        w.megaPursuit!.introduce({ x: 3942, z: -25 });
        w.tick = 3600; w.l10Encounters!.update(); w.setInput({ interact: true }); w.update(); w.clearInput();
      }
      w.combat!.damage.god = true;
      const samples: number[] = [], hashes: { tick: number; hash: string }[] = []; let peak = 0;
      for (let i = 0; i < (level === 'L9' ? 900 : 3600); i++) {
        if (i === 120) await profiler.post('Profiler.start');
        const start = performance.now(); w.update(); if (i >= 120) samples.push(performance.now() - start);
        peak = Math.max(peak, w.infected!.director.count);
        if (i === 119 || i % 300 === 299) hashes.push({ tick: w.tick, hash: stateHash(w.getState()) });
      }
      const { profile } = await profiler.post('Profiler.stop'); writeFileSync(`${out}/${level}.cpuprofile`, JSON.stringify(profile));
      samples.sort((a, b) => a - b);
      const result = { level, simSourceHash, node: process.version, peak, instrumentedP95: samples[Math.ceil(samples.length * .95) - 1], hashes };
      results.push(result); console.log(JSON.stringify(result));
    } finally { w.dispose(); }
  }
} finally { profiler.disconnect(); }
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
