import { l1Frames, type L1Report } from '../../src/debug/bot/LevelOneBot';
export type { L1Profile, L1Report } from '../../src/debug/bot/LevelOneBot';
export { Walker } from '../../src/debug/bot/Walker';
import { readFileSync } from 'node:fs';
import { Rng } from '../../src/core/Rng';
import { l1v2 } from '../../src/data/l1v2';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import type { Mission } from '../../src/sim/missions/Mission';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';

/**
 * L1 v2 bot policies (specs/90-test-concept.md section 5, epic-19 section 9). Bots read the sim like a player sees it
 * (positions, objective anchors) and write only InputFrame patches: no cheats, no teleports.
 */
export async function loadL1(seed: number): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L1;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  const mission = world.loadMission(resolveCampaignMission('L1', world.districts!)); mission.begin();
  return { world, mission };
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export function runL1(...args: Parameters<typeof l1Frames>): L1Report {
  const frames = l1Frames(...args);
  let next = frames.next();
  while (!next.done) { args[0].update(); next = frames.next(); }
  return next.value;
}
export const l1BotConfig = l1v2.bots;

export interface DuelReport { seed: number; count: number; weapon: 'unarmed' | 'bat'; skill: 'newbie' | 'standing'; playerDied: boolean; diedAtS: number | null; killed: number; seconds: number }
/**
 * AC14 duel bot: the player (unarmed or with the bat) against `count` infected chasing from 7 m, standing or
 * `newbie` (250 ms reaction, 15 % skipped attacks). Runs inside the real L1 world; ends when all infected are down,
 * the player dies, or after `maxSeconds`.
 */
export async function runDuel(opts: { seed: number; count: number; weapon: 'unarmed' | 'bat'; skill: 'newbie' | 'standing'; maxSeconds?: number }): Promise<DuelReport> {
  const { world } = await loadL1(opts.seed);
  const rng = new Rng(opts.seed, 'duel'), ai = world.infected!, player = world.entities.get(1)!;
  world.combat!.setLoadout([opts.weapon === 'bat' ? 'weapon.bat' : 'weapon.fists'], ['weapon.fists']);
  const ids: number[] = [];
  for (let i = 0; i < opts.count; i++) {
    const angle = (i / opts.count) * Math.PI * 2 + rng.next() * .5;
    for (let r = 7; r > 2; r -= .5) {
      const at = { x: player.transform.x + Math.cos(angle) * r, z: player.transform.z + Math.sin(angle) * r };
      if (ai.nav.clear(at.x, at.z, .45)) { ids.push(ai.spawn('infected.runner', at, { state: 'chase', yaw: -Math.atan2(player.transform.z - at.z, player.transform.x - at.x) })); break; }
    }
  }
  const maxTicks = (opts.maxSeconds ?? 40) * 60, reaction = opts.skill === 'newbie' ? 15 : 1;
  let target: EntitySnapshot | undefined, died: number | null = null, miss = false;
  for (let tick = 0; tick < maxTicks; tick++) {
    const living = ids.map(id => world.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0);
    if (!living.length) break;
    if (player.health.current <= 0) { died ??= tick / 60; break; }
    if (tick % reaction === 0) {
      target = living.sort((a, b) => dist(a.transform, player.transform) - dist(b.transform, player.transform))[0];
      miss = opts.skill === 'newbie' && rng.next() < .15;
    }
    world.setInput(target && !miss ? { move: { x: 0, z: 0 }, attackTarget: { id: target.id, side: 'LEFT' }, left: { down: false, held: true, up: false } } : { move: { x: 0, z: 0 }, attackTarget: undefined, left: { down: false, held: false, up: false } });
    world.update();
  }
  const killed = ids.filter(id => (world.entities.get(id)?.health.current ?? 0) <= 0).length;
  const report: DuelReport = { seed: opts.seed, count: opts.count, weapon: opts.weapon, skill: opts.skill, playerDied: died !== null, diedAtS: died, killed, seconds: world.tick / 60 };
  world.clearInput(); world.dispose();
  return report;
}
