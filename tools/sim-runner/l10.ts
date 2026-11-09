import { cure } from '../../src/levels/L10/district';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import type { CompletionPolicy } from './levels';
import { followFrustum } from './l3Bots';
import { l10Framing } from '../../src/levels/L10/cameraFraming';

/** Match Game.simTick's tick-driven spawn camera, including regional framing.
 * Without it L10 uses the director's 64 m fallback square rather than the
 * gameplay lens, deferring close authored arrivals that are off-camera. */
export function followTenFrustum(world: SimWorld): void {
  const p = world.entities.get(1)!.transform, state = world.missions!.state;
  followFrustum(world, l10Framing(p.x, p.z, !!state.states['cure-installed'] || !!state.epilogue).scale);
}

export interface CureRegionTiming {
  id: string; seconds: number; travelSeconds: number; combatSeconds: number;
  interactionSeconds: number; holdSeconds: number; epilogueSeconds: number; otherSeconds: number;
  metres: number;
}
/** Full production level, seed fixed by the caller. Only movement, aim, weapon selection and interaction inputs. */
export function runTen(world: SimWorld, policy: CompletionPolicy, maxSeconds: number, passiveHoldWindowSeconds?: number) {
  const mission = world.missions!, bot = new LevelTenBot(world, passiveHoldWindowSeconds === undefined ? policy : 'threat-passive');
  const timings: CureRegionTiming[] = cure.regions.map(r => ({ id: r.id, seconds: 0, travelSeconds: 0, combatSeconds: 0, interactionSeconds: 0, holdSeconds: 0, epilogueSeconds: 0, otherSeconds: 0, metres: 0 }));
  let peak = 0, holdTicks = 0;
  for (let tick = 0; tick < maxSeconds * 60 && mission.state.phase !== 'result' && mission.state.phase !== 'progression'; tick++) {
    // Match the pacing route's ordinary Retry action; death itself remains
    // mortal and checkpoint restoration owns inventory, pursuit and position.
    if (mission.state.phase === 'retry') { mission.restore(); continue; }
    const active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
    if (!active) break;
    // Keep updating through the ordinary death delay. Checkpoint respawn can
    // replace entity 1, so reacquire it instead of retaining the dead body.
    const player = world.entities.get(1)!;
    followTenFrustum(world);
    const f = bot.sample(), p = player.transform;
    const finale = active.id === 'hold' || active.id === 'mega', released = !!mission.state.states['cure-released'];
    const region = cure.regions.findIndex(r => p.x >= r.envelope[0][0] && p.x <= r.envelope[1][0]);
    const row = timings[Math.max(0, region)], x = p.x, z = p.z;
    world.applyInput(f, 'keyboard'); world.update();
    // Observation continues after the 60-second objective advances to Mega.
    if (mission.state.states['charge-active']) holdTicks++;
    if (passiveHoldWindowSeconds !== undefined && holdTicks >= passiveHoldWindowSeconds * 60) break;
    peak = Math.max(peak, world.infected!.director.count);
    // Credits are excluded from the PO gameplay timing, matching mission.stats.time.
    if (active.id === 'credits') continue;
    const metres = Math.hypot(p.x - x, p.z - z); row.metres += metres; row.seconds += 1 / 60;
    // Exclusive categories sum to elapsed time; movement distance is recorded separately.
    if (released) row.epilogueSeconds += 1 / 60;
    else if (finale) row.holdSeconds += 1 / 60;
    else if (f.right.held) row.combatSeconds += 1 / 60;
    else if (f.interact) row.interactionSeconds += 1 / 60;
    else if (metres > .0001) row.travelSeconds += 1 / 60;
    else row.otherSeconds += 1 / 60;
  }
  return { regions: timings, maxConcurrentInfected: peak, ticks: world.tick, bossId: world.megaPursuit!.state.id, released: !!mission.state.states['cure-released'] };
}
