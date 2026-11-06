/** Controlled production service-gate endurance against exactly five runners. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { relocatePlayer } from '../../src/sim/missions/missionHelpers';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) for (const gateX of [90, 150, 210]) {
  const campaign = preset('L6-default'); campaign.settings.quality = tier;
  const w = await loadLevel('L6', 1, campaign, 0, { quality: tier });
  try {
    const gate = w.missions!.state.l6!.gates.find(g => g.x === gateX)!, e = w.entities.get(gate.id)!;
    const attacks: unknown[] = [];
    w.events.on('barricade.damaged', event => { if (event.type === 'barricade.damaged' && event.id === gate.id) attacks.push(structuredClone(event)); });
    relocatePlayer(w, gateX + 3, 15);
    const from = { x: gateX - 1, z: 15 }, to = { x: gateX + 1, z: 15 };
    const openSight = w.infected!.nav.visible(from, to, 0);
    const cross = () => {
      relocatePlayer(w, gateX - 2, 15);
      const before = { ...w.entities.get(1)!.transform };
      for (let i = 0; i < 120; i++) { w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 } }, 'keyboard'); w.update(); }
      const after = { ...w.entities.get(1)!.transform };
      relocatePlayer(w, gateX + 3, 15);
      return { before, after, crossed: after.x > gateX };
    };
    const openMovement = cross();
    w.barricades!.closeServiceGate(gate.id, Math.round(w.barricades!.dps('infected.runner') * 5 * 10));
    const closedSight = w.infected!.nav.visible(from, to, 0), closedClearance = w.infected!.nav.clear(gateX, 15, .35);
    const closedMovement = cross();
    const ids = [13.8, 14.4, 15, 15.6, 16.2].map(z => w.infected!.spawn('infected.runner', { x: gateX - .85, z }));
    for (const id of ids) { w.infected!.press(id, 1, w.tick + 1800, 4); w.infected!.rush(id, w.entities.get(1)!.transform, w.tick + 1800, true); }
    const started = w.tick, hp = e.health.current;
    let broken: number | null = null;
    for (let i = 0; i < 20 * 60; i++) {
      w.applyInput(emptyInput(), 'keyboard'); w.update();
      if (!e.barricade!.intact) { broken = w.tick; break; }
    }
    rows.push({ tier, gateX, gateId: gate.id, widthM: Math.hypot(e.barricade!.slot.b.x - e.barricade!.slot.a.x, e.barricade!.slot.b.z - e.barricade!.slot.a.z),
      ids, started, hp, remainingHp: e.health.current, broken, heldSeconds: broken === null ? null : (broken - started) / 60,
      observedSeconds: (w.tick - started) / 60, openSight, closedSight, closedClearance, openMovement, closedMovement, attacks,
      livingAttackers: ids.map(id => ({ id, hp: w.entities.get(id)?.health.current, at: w.entities.get(id)?.transform })) });
    console.log(tier, gateX, rows.at(-1)!.heldSeconds, attacks.length);
  } finally { w.dispose(); }
}
writeFileSync('docs/reports/sweep-b/L6-gates.json', JSON.stringify({ ...identity,
  producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-gates.ts')).digest('hex'),
  method: 'Controlled fixture, not a route: fresh production L6 world for each gate/tier, player placed beyond actual gate, production closeServiceGate uses unchanged dps×5×10 HP; exactly five ordinary runners admitted west of gate and production director press/rush toward courier. No actor stats, caps, timers or target reductions. Native actual damage events and closed/open navigation sight/clearance retained. Refusal and prompt clauses remain separate.', rows }, null, 2) + '\n');
