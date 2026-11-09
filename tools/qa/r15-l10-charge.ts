/** Disposable installed-checkpoint diagnostic; this is not a full native route receipt. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { provenance } from './accept/probe';
import { loadLevel } from '../../tests/qa/invariants/world';
import { missionControls } from '../../src/sim/missions/controls';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import { followTenFrustum } from '../sim-runner/l10';

const rows = [];
const stopStep = process.env.R15_STOP_STEP ?? 'hold';
if (stopStep !== 'hold' && stopStep !== 'mega') throw new Error('R15_STOP_STEP must be hold or mega');
for (const tier of ['low', 'high'] as const) {
  const world = await loadLevel('L10', 1, tier);
  try {
    const mission = world.missions!;
    mission.loadCheckpoint('cure-disperse-ready');
    const at = mission.def.anchors['cure-install'];
    missionControls(world).teleport(1, at);
    mission.checkpoint('cure-disperse-ready', at);
    const bot = new LevelTenBot(world);
    const samples = [];
    let mounted = 0, shots = 0, hits = 0, peakCharge = 0;
    world.events.on('mounted-gun.mounted', () => mounted++);
    world.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.actionId === 'weapon.rotary-minigun') shots++; });
    world.events.on('combat.hit', event => { if (event.type === 'combat.hit' && event.actionId === 'weapon.rotary-minigun') hits++; });
    for (let tick = 0; tick < 180 * 60; tick++) {
      followTenFrustum(world);
      const input = bot.sample();
      world.applyInput(input, 'keyboard'); world.update();
      peakCharge = Math.max(peakCharge, mission.state.counters['charge-ticks'] ?? 0);
      if (tick % 60 === 0) {
        const p = world.entities.get(1)!;
        samples.push({ tick: world.tick, at: { ...p.transform }, hp: p.health.current, move: input.move, charge: mission.state.counters['charge-ticks'], active: mission.state.states['charge-active'], objective: mission.def.steps.find(step => mission.state.steps[step.id].status === 'active')?.id, mounted: world.mountedGun?.mounted, canMount: world.mountedGun?.canMount(), deaths: mission.state.stats.deaths });
      }
      if (mission.state.steps[stopStep].status === 'completed') break;
    }
    rows.push({ tier, scope: 'installed-checkpoint fixture at installation anchor; normal bot inputs and mortal combat', stopStep, mounted, shots, hits, peakCharge, deaths: mission.state.stats.deaths, hold: mission.state.steps.hold.status, mega: mission.state.steps.mega.status, samples });
  } finally { world.dispose(); }
}
const root = process.env.R15_OUT ?? 'docs/reports/r15-qafix';
mkdirSync(root, { recursive: true });
writeFileSync(`${root}/charge-diagnostic.json`, JSON.stringify({ identity: provenance(process.env.R15_REVISION ?? 'synced-worktree'), rows }, null, 2) + '\n');
console.log(JSON.stringify(rows.map(row => ({ tier: row.tier, mounted: row.mounted, shots: row.shots, hits: row.hits, peakCharge: row.peakCharge, deaths: row.deaths, hold: row.hold }))));
