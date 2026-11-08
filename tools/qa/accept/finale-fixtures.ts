import { loadLevel } from '../../sim-runner/levels';
import type { Tier } from './probe';
import type { Clause } from './evaluate';
import { emptyInput } from '../../../src/input/InputFrame';
import { cureFinaleText } from '../../../src/sim/missions/LevelTenFinale';
import { CureFront, cureReached } from '../../../src/sim/missions/CureFront';
import type { Mission } from '../../../src/sim/missions/Mission';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { finale } from '../../../src/data/l10Finale';

type Add = (id: string, clause: string, value: unknown, target: string, pass: boolean | undefined) => void;
/** Explicit state fixtures call the production finale predicate; these are not play-throughs. */
export async function finaleFixtures(tier: Tier, add: Add): Promise<void> {
  const cells = [];
  for (const missing of ['none', 'charge', 'installed', 'boss', 'console', 'input']) {
    const world = await loadLevel('L10', 1, undefined, 0, { quality: tier });
    try {
      const mission = world.missions!, s = mission.state, player = world.entities.get(1)!, console = mission.def.anchors['cure-console'];
      const input = { ...emptyInput(), interact: missing !== 'input' };
      Object.defineProperty(world, 'inputFrame', { get: () => input });
      s.phase = 'playing'; s.states['console-held'] = false; s.states['charge-active'] = true;
      s.states['cure-installed'] = missing !== 'installed'; s.counters['charge-ticks'] = missing === 'charge' ? 3599 : 3600;
      for (const step of Object.values(s.steps)) step.status = 'completed'; s.steps.release.status = 'active';
      world.megaPursuit!.introduce({ x: 0, z: 0 });
      world.megaPursuit!.state.mode = missing === 'boss' ? 'coarse' : 'dead';
      Object.assign(player.transform, { x: console.x + (missing === 'console' ? console.radius + 1 : 0), z: console.z });
      mission.l10!.update();
      cells.push({ missing, released: !!s.states['cure-released'], expected: missing === 'none', consoleRadius: console.radius });
    } finally { world.dispose(); }
  }
  add('L10-13', 'release predicate missing-prerequisite matrix', cells, 'release only with charge3600, installed cure, dead Mega, console range and fresh E', cells.every(cell => cell.released === cell.expected));

  const world = await loadLevel('L10', 1, undefined, 0, { quality: tier });
  try {
    const mission = world.missions!, s = mission.state, player = world.entities.get(1)!, console = mission.def.anchors['cure-console'];
    const input = { ...emptyInput(), interact: true };
    Object.defineProperty(world, 'inputFrame', { get: () => input });
    s.phase = 'playing'; s.states['cure-installed'] = true; s.states['charge-active'] = false; s.states['console-held'] = false; s.counters['charge-ticks'] = 0;
    for (const step of Object.values(s.steps)) step.status = 'completed'; s.steps.hold.status = 'active';
    Object.assign(player.transform, { x: console.x, z: console.z }); mission.l10!.update(); input.interact = false;
    mission.l10!.update(); const inside = s.counters['charge-ticks'];
    player.transform.x = console.x + finale.holdRadius + .01; mission.l10!.update(); const outside = s.counters['charge-ticks'], instruction = cureFinaleText(mission);
    player.transform.x = console.x; player.health.current = 0; mission.l10!.update(); const dead = s.counters['charge-ticks'];
    player.health.current = player.health.max; mission.l10!.update(); const resumed = s.counters['charge-ticks'];
    add('L10-10', 'charge inside/outside/dead/resume boundary and pause instruction', { inside, outside, dead, resumed, instruction }, '1/1/1/2 ticks; outside instruction says Charge paused', inside === 1 && outside === 1 && dead === 1 && resumed === 2 && !!instruction?.includes('Charge paused'));
  } finally { world.dispose(); }

  const arena = new SimWorld(); await arena.init();
  try {
    arena.loadScenario('civ-street', 1); arena.infected!.director.setTier(tier);
    arena.infected!.director.levelCap = 200; // Isolated eight-species processor fixture, not sanctuary population tuning.
    const healthy = [...arena.entities.iterate()].filter(e => !e.infected && (e.id === 1 || e.civilian || e.companion)).map(e => ({ id: e.id, hp: e.health.current }));
    const roles = ['runner', 'dog', 'alpha', 'lion', 'gorilla', 'elephant', 'zebra', 'flamingo'];
    const enemies = roles.map((role, index) => {
      const id = arena.infected!.spawn(`infected.${role}`, { x: 4 + index * 4, z: 0 });
      return { role, id, entity: arena.entities.get(id)!, reached: null as number | null, dead: null as number | null };
    });
    // The production cure class needs only this mission state/anchor seam in an isolated arena.
    const mission = { world: arena, state: {}, def: { anchors: { 'cure-console': { x: 0, z: 0 } } } } as unknown as Mission;
    const cure = new CureFront(mission); cure.release();
    for (let tick = 1; tick <= 240; tick++) {
      arena.tick++; cure.update();
      for (const enemy of enemies) {
        if (cureReached(mission.state.cureFront!, enemy.entity.transform)) enemy.reached ??= tick;
        if (enemy.entity.health.current <= 0 && enemy.entity.infected!.recoverAt < 0) enemy.dead ??= tick;
      }
    }
    const species = enemies.map(enemy => ({ role: enemy.role, id: enemy.id, reached: enemy.reached, dead: enemy.dead, hp: enemy.entity.health.current }));
    const harmed = healthy.filter(e => arena.entities.get(e.id)?.health.current !== e.hp);
    add('L10-14', 'cure native species mortality and healthy immunity', { species, healthyChecked: healthy.length, harmed }, 'regular, dog, Alpha and all zoo species die≤1 tick after front; healthy/player/corgi unchanged', species.every(enemy => enemy.reached !== null && enemy.dead !== null && enemy.dead - enemy.reached <= 1) && harmed.length === 0);
  } finally { arena.dispose(); }
}

export type FinaleClause = Clause;
