import { emptyInput } from '../../src/input/InputFrame';
import { cure } from '../../src/levels/L10/district';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { Walker } from '../../src/debug/bot/Walker';
import type { CompletionPolicy } from './levels';

export interface CureRegionTiming {
  id: string; seconds: number; travelSeconds: number; combatSeconds: number;
  interactionSeconds: number; holdSeconds: number; epilogueSeconds: number; otherSeconds: number;
  metres: number;
}
/** Full production level, seed fixed by the caller. Only movement, aim, weapon selection and interaction inputs. */
export function runTen(world: SimWorld, policy: CompletionPolicy, maxSeconds: number) {
  const mission = world.missions!, player = world.entities.get(1)!, walker = new Walker();
  const timings: CureRegionTiming[] = cure.regions.map(r => ({ id: r.id, seconds: 0, travelSeconds: 0, combatSeconds: 0, interactionSeconds: 0, holdSeconds: 0, epilogueSeconds: 0, otherSeconds: 0, metres: 0 }));
  const route = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route);
  let waypoint = 0, peak = 0;
  for (let tick = 0; tick < maxSeconds * 60 && mission.state.phase !== 'result' && mission.state.phase !== 'progression'; tick++) {
    const f = emptyInput(), active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
    if (!active || player.health.current <= 0 || mission.state.phase === 'retry') break;
    // Killing the boss used to share the hold objective. Retain that same
    // console-centred combat policy after splitting it into the mega step.
    const finale = active.id === 'hold' || active.id === 'mega';
    const anchor = mission.def.anchors[active.id === 'mega' ? 'cure-console' : active.anchor], p = player.transform;
    const distance = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    const released = !!mission.state.states['cure-released'];
    while (waypoint < route.length && distance({ x: route[waypoint][0], z: route[waypoint][1] }) < 2) waypoint++;
    let goal = anchor;
    if (!released && !finale && waypoint < route.length && route[waypoint][0] < anchor.x - 2) {
      goal = { x: route[waypoint][0], z: route[waypoint][1], radius: 2 };
    }
    if (released) {
      // Explore the authored service platform throughout the playable ending.
      goal = { x: anchor.x + (tick % 600 < 300 ? 12 : -12), z: anchor.z, radius: 1 };
    }
    f.move = walker.step(world, goal, .8, `${active.id}-${waypoint}`) ?? f.move;
    f.interact = !released && tick % 60 < 45 && distance(anchor) <= anchor.radius;
    const threats = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && distance(e.transform) < 30 && world.infected!.nav.visible(p, e.transform, 0));
    threats.sort((a, b) => distance(a.transform) - distance(b.transform));
    const rack = player.weapons!.RIGHT.rack;
    const index = rack.length - 1, weapon = rack[index].id, target = threats[0];
    if (!released && target && (weapon !== 'weapon.fire-axe' || distance(target.transform) < 2.5)) {
      f.selectedSlot = { side: 'RIGHT', index }; f.aimSource = 'keyboard';
      const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
      f.aim = { x: dx / d, z: dz / d }; f.aimPoint = { x: target.transform.x, z: target.transform.z };
      f.right.held = true;
      if (finale && d < 10) {
        // Circle through the hold area so the solid pursuing crowd trails the
        // courier. Every step still uses ordinary navigation and movement input.
        const angle = Math.atan2(p.z - anchor.z, p.x - anchor.x) + Math.PI / 4;
        f.move = walker.step(world, { x: anchor.x + Math.cos(angle) * 18, z: anchor.z + Math.sin(angle) * 18 }, 1, 'dodge') ?? f.move;
      }
    }
    if (policy === 'newbie') { f.move.x *= .8; f.move.z *= .8; }
    const region = cure.regions.findIndex(r => p.x >= r.envelope[0][0] && p.x <= r.envelope[1][0]);
    const row = timings[Math.max(0, region)], x = p.x, z = p.z;
    world.applyInput(f, 'keyboard'); world.update();
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
