import { loadLevel } from '../../sim-runner/levels';
import { runL1 } from '../../sim-runner/l1Bots';
import { missionControls } from '../../../src/sim/missions/controls';
import type { Tier } from './probe';

/** Ordinary opening followed by the criterion's remote idle observer. The live courier is never invulnerable. */
export async function l1SpreadProbe(tier: Tier) {
  const world = await loadLevel('L1', 1, undefined, 0, { quality: tier });
  try {
    const mission = world.missions!, bitten = new Set<number>(), turns: { id: number; tick: number; bitten: boolean }[] = [];
    const directSpawns: { id: number; tick: number }[] = [], spawn = world.infected!.spawn.bind(world.infected!);
    world.infected!.spawn = (...args: Parameters<typeof spawn>) => {
      const id = spawn(...args);
      // Outbreak conversions keep the victim's ID and emit infection below. Direct spawns have no such provenance.
      if (!args[3]) directSpawns.push({ id, tick: world.tick });
      return id;
    };
    const events: { type: string; tick: number }[] = [];
    world.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite') bitten.add(e.targetId); });
    world.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && e.phase === 'infected') turns.push({ id: e.entityId, tick: e.tick, bitten: bitten.has(e.entityId) }); });
    for (const type of ['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams', 'l1.infectedExit'] as const) world.events.on(type, e => events.push({ type: e.type, tick: e.tick }));
    let releasedAt = 0;
    const report = runL1(world, mission, 'idle', { maxSeconds: 600,
      onExit: () => { releasedAt = world.tick; missionControls(world).teleport(1, { x: -80, z: 50 }); },
      stopWhen: () => !!releasedAt && world.tick >= releasedAt + 240 * 60 + 2 });
    const l1 = mission.state.l1!, seedIds = new Set(l1.exitIds), spreadTurns = turns.filter(t => !seedIds.has(t.id));
    return { tier, protected: false, method: 'ordinary idle opening, then one remote-observer relocation', remote: { x: -80, z: 50 },
      releasedAt, calmS: (l1.flickerAt - l1.deliveredAt) / 60, events, initialExitIds: l1.exitIds, technicianId: l1.techId,
      headings: l1.exitHeadingsDeg, report, spreadTurns, directSpawns: directSpawns.filter(spawn => !seedIds.has(spawn.id)) };
  } finally { world.dispose(); }
}
export function l1SpreadChecks(result: Pick<Awaited<ReturnType<typeof l1SpreadProbe>>, 'report' | 'spreadTurns' | 'directSpawns' | 'events'>) {
  const counts = result.report.infectedAfterExit;
  const sequence = result.events.filter(event => ['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams'].includes(event.type));
  const eventOrder = ['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams'];
  const sequenceS = sequence.length === eventOrder.length ? (sequence.at(-1)!.tick - sequence[0].tick) / 60 : null;
  return { initialFive: counts[0] === 5, at120: counts[120] !== undefined && counts[120] >= 15,
    at240: counts[240] !== undefined && counts[240] >= 25,
    bitesOnly: result.directSpawns.length === 0 && result.spreadTurns.length > 0 && result.spreadTurns.every(turn => turn.bitten),
    observerSafe: result.report.deaths === 0 && result.report.damage === 0 && result.report.knockdowns === 0 && result.report.kills === 0,
    accidentSequence: { events: sequence, sequenceS },
    accidentSequencePass: sequence.length === eventOrder.length && sequence.every((event, index) => event.type === eventOrder[index]) && sequenceS !== null && sequenceS <= 8 };
}
