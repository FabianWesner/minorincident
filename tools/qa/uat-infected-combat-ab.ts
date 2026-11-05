/** Controlled L6 combat on the actual PROD and candidate modules; no balance overrides.
 * node --import tsx tools/qa/uat-infected-combat-ab.ts <prod-worktree> */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SimWorld } from '../../src/sim/world/SimWorld';

const root = process.cwd(), baseline = process.argv[2];
if (!baseline) throw new Error('PROD worktree required');
const result: Record<string, unknown> = {};
for (const [side, directory] of [['prod', resolve(baseline)], ['current', root]]) {
  process.chdir(directory);
  const { loadLevel } = await import(pathToFileURL(resolve(directory, 'tools/sim-runner/levels.ts')).href);
  const samples: Record<string, unknown> = {};
  for (const mode of ['incoming', 'outgoing']) {
    const w = await loadLevel('L6', 1) as SimWorld;
    try {
      w.storyLock = null;
      const ai = w.infected!, player = w.entities.get(1)!;
      ai.director.update = () => {};
      for (const e of [...ai.active]) ai.release(e);
      for (const e of w.entities.iterate()) if (e.civilian || e.companion) e.hidden = true;
      delete player.hidden;
      const nav = ai.nav;
      let cell = -1, best = Infinity;
      for (let i = 0; i < nav.blocked.length; i++) {
        const x = nav.x(i), z = nav.z(i), d = Math.hypot(x - player.transform.x, z - player.transform.z);
        if (d < best && [0, 2, 4, 6, 8].every(dx => nav.clear(x + dx, z, .6)) && nav.visible({ x, z }, { x: x + 8, z }, .4)) { cell = i; best = d; }
      }
      if (cell < 0) throw new Error('L6 combat lane unavailable');
      Object.assign(player.transform, { x: nav.x(cell), z: nav.z(cell), y: .7 + (w.districts?.pavingHeight(nav.x(cell), nav.z(cell)) ?? 0) });
      w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
      const id = ai.spawn('infected.runner', { x: player.transform.x + (mode === 'incoming' ? .8 : 7), z: player.transform.z }, { yaw: Math.PI });
      const enemy = w.entities.get(id)!, start = w.tick, hp = player.health.current;
      const hits: { tick: number; amount: number }[] = [];
      w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.sourceId === id && e.targetId === 1) hits.push({ tick: e.tick - start, amount: e.amount }); });
      while (w.tick - start < (mode === 'incoming' ? 180 : 360) && enemy.health.current > 0 && player.health.current > 0) {
        if (mode === 'outgoing') {
          const dx = enemy.transform.x - player.transform.x, dz = enemy.transform.z - player.transform.z, d = Math.hypot(dx, dz) || 1;
          w.setInput({ aim: { x: dx / d, z: dz / d }, aimPoint: { x: enemy.transform.x, z: enemy.transform.z }, right: { down: false, held: true, up: false } });
          w.update();
        } else { w.tick++; ai.update(); }
      }
      samples[mode] = { ticks: w.tick - start, gear: player.survivor!.gearTier, enemyMaxHp: enemy.health.max, enemyHp: enemy.health.current, playerDamage: hp - player.health.current, hits };
    } finally { w.dispose(); }
  }
  result[side] = samples;
}
process.chdir(root);
writeFileSync('test-results/q297/l6-combat-ab.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
