import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { relocatePlayer } from '../../../src/sim/missions/missionHelpers';
import { emptyInput } from '../../../src/input/InputFrame';
import { l4 } from '../../../src/data/l4';
import type { Tier } from './probe';

/** Isolated production timers. Objective advances below are fixture setup only;
 * they are excluded from every route/completion acceptance receipt. */
export async function l4TimingFixtures(tier: Tier, add: (id: string, clause: string, value: unknown, target: string, pass: boolean | undefined) => void): Promise<void> {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const world = await loadLevel('L4', 1, campaign, 0, { quality: tier });
  try {
    const mission = world.missions!;
    // An uninterrupted ordinary convoy ride, before the isolated timer setup.
    let readyAt: number | null = null;
    for (let i = 0; i < 40 * 60 && !mission.state.l4!.arrivedAt; i++) {
      world.applyInput(emptyInput(), 'keyboard'); world.update();
      if (mission.state.l4!.arrivedAt && !world.storyLock && !world.entities.get(1)!.hidden && !mission.state.l4!.seated && world.physics.playerCollider!.isEnabled()) readyAt = world.tick;
    }
    const arrived = mission.state.l4!.arrivedAt;
    const controlTicks = arrived && readyAt !== null ? readyAt - arrived : null;
    add('L4-01', 'courier control restored after actual convoy stop', { arrivedAt: arrived, readyAt, controlTicks }, 'visible, unseated, collider enabled, no story lock within30ticks of stop', controlTicks !== null ? controlTicks >= 0 && controlTicks <= 30 : undefined);
    const index = l4.convoy.vehicles.findIndex(v => v.player), spec = l4.convoy.vehicles[index];
    const bus = world.entities.get(mission.state.l4!.convoyIds[index])!.transform, c = Math.abs(Math.cos(bus.yaw)), s = Math.abs(Math.sin(bus.yaw));
    const halfX = (c * spec.len + s * spec.wid) / 2, halfZ = (s * spec.len + c * spec.wid) / 2;
    const bounds = { x0: bus.x - halfX, x1: bus.x + halfX, z0: bus.z - halfZ, z1: bus.z + halfZ }, p = l4.perimeter;
    add('L4-01', 'full passenger bus parks inside the military perimeter', { bus: { ...bus }, bounds, militaryArea: p }, 'all four hull bounds inside the actual military area', arrived ? bounds.x0 >= p.x0 && bounds.x1 <= p.x1 && bounds.z0 >= p.z0 && bounds.z1 <= p.z1 : undefined);
    const cameraTakeovers = Object.keys(mission.def.cinematics);
    add('L4-09', 'opening-fight has no gameplay camera takeover', cameraTakeovers, 'no L4 mission cinematics; opening-fight reveals remain in radio/HUD', cameraTakeovers.length === 0 && !mission.state.cinematic);
    for (const id of ['ride', 'quartermaster', 'hold', 'hide']) if (!mission.state.completedObjectives.includes(id)) mission.completeObjective(id);
    const brace = mission.def.anchors['l4-brace']; relocatePlayer(world, brace.x, brace.z);
    const started = world.tick;
    for (let i = 0; i < 61 && !mission.state.l4!.barredAt; i++) { world.applyInput(emptyInput(), 'keyboard'); world.update(); }
    const elapsed = mission.state.l4!.barredAt ? mission.state.l4!.barredAt - started : null;
    add('L4-16', 'uninterrupted standing bar interaction with E continuously false', { elapsedTicks: elapsed, interact: false, setup: 'completed preceding objectives, then placed at the actual brace for isolated timing' }, 'exactly60ticks from standing inside the bar anchor', elapsed === 60);
  } finally { world.dispose(); }
}
