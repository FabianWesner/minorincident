import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { missionControls } from '../../src/sim/missions/controls';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

for (const every of [18, 20, 22, 24, 27]) test(`regress every=${every}`, async () => {
  const { world, mission } = await loadL1(1);
  mission.loadCheckpoint('bat');
  const ctl = missionControls(world);
  world.combat!.damage.god = true; world.combat!.setLoadout(['weapon.bat'], ['weapon.fists']);
  const alive = () => world.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && !e.corpse && e.archetype !== 'infected.crow');
  const me0 = world.getEntity(1)!.transform;
  const first = alive().sort((x, y) => Math.hypot(x.transform.x - me0.x, x.transform.z - me0.z) - Math.hypot(y.transform.x - me0.x, y.transform.z - me0.z))[0];
  ctl.teleport(1, { x: first.transform.x - 4, z: first.transform.z });
  const me = world.getEntity(1)!.transform;
  const walkers = world.query({ kind: 'civilian' }).filter(e => !e.hidden && e.health.current > 0 && !e.civilian?.pet && !e.civilian?.schedule?.some(s => s.seat));
  for (const [i, c] of walkers.slice(0, 16).entries()) ctl.teleport(c.id, { x: me.x + 3 + i % 4 * 1.5, z: me.z - 4 + Math.floor(i / 4) * 1.5 });
  const start = world.tick;
  for (let t = 0; t < 2400; t++) {
    if (t % every === 0) {
      const player = world.getEntity(1)!.transform;
      const struck = world.events.events(start).some((e: any) => e.type === 'infected.attack' && e.targetId === 1) || world.tick - start > 900;
      const near = alive().map(e => ({ e, d: Math.hypot(e.transform.x - player.x, e.transform.z - player.z) })).sort((x, y) => x.d - y.d)[0];
      if (near && near.d < 5 && struck) world.setInput({ attackTarget: { id: near.e.id, side: 'LEFT' } } as any);
      else if (near && (t % (every * 6) === 0 || !struck && near.d > 1.5)) world.setInput({ moveTarget: { x: near.e.transform.x, z: near.e.transform.z } } as any);
    }
    world.update();
  }
  const ev = world.events.events(start) as any[];
  appendFileSync(process.env.OUTF ?? "/tmp/x", `RESULT every=${every} attacks=${ev.filter(e => e.type === 'infected.attack' && e.targetId === 1).length} turned=${ev.filter(e => e.type === 'civilian.turned').length} kills=${ev.filter(e => e.type === 'combat.kill').length}` + "\n");
  world.dispose();
  expect(true).toBe(true);
}, 120000);
