import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { writeJson } from './session';

const receipts: unknown[] = [];
for (const phase of ['before', 'after']) {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L1;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(phase === 'before' && d.id === 'D-GROVE' ? execFileSync('git', ['show', '0e3e33219:public/assets/layouts/D-GROVE.layout.json'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }) : readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  world.loadMission(resolveCampaignMission('L1', world.districts!)).begin();
  for (const [name, x, z] of [['bags-west', -18, -49.25], ['crates', 0, -49.25], ['bags-east', 24, -49.25], ['chair', -39, -16.25]] as const) {
    const player = world.entities.get(1)!;
    assert(world.solids.relocate(player, { x: x - 2, z, y: .72 }, 'luna.route-fixture', 0, false));
    world.previousPlayer = { ...player.transform }; world.physics.playerBody!.setTranslation(player.transform, true);
    world.setInput({ move: { x: 1, z: 0 } });
    const path = [];
    for (let i = 0; i < 90; i++) { world.update(); if (i % 6 === 5) path.push({ ...player.transform }); }
    world.clearInput();
    const travel = player.transform.x - (x - 2), drift = Math.abs(player.transform.z - z);
    if (phase === 'after') { assert(travel > 5.5, `${name} travelled only ${travel} m`); assert(drift < .02, `${name} drifted ${drift} m`); }
    receipts.push({ phase, name, start: [x - 2, z], travel, drift, path });
    console.log(`${phase} ${name}: ${travel.toFixed(3)} m forward, ${drift.toFixed(3)} m sideways`);
  }
  world.dispose();
}
writeJson('docs/reports/luna-fixes-1101/evidence/Q-319-route-sim.json', receipts);
