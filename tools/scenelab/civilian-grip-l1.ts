import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson } from './session';

/** Run through tools/e2e-lock.sh; capture the shipped L1 start bench, with the game's lens and polar angle. */
const out = resolve(process.argv[2] ?? 'test-results/cup-hand/l1');
const session = new SceneSession({ viewport: { width: 1280, height: 720 }, seed: 1 });
try {
  await session.open(); await session.inspectLevel('L1');
  const holder = await session.page.evaluate(async () => {
    const api = window.__SS__!; api.pause(); api.missions.begin();
    const player = api.getEntity(1)!;
    for (let i = 0; i < 15; i++) {
      await api.step(60);
      const candidates = api.query({ kind: 'civilian' }).filter(e => {
        const c = e.civilian!, activity = c.schedule?.[c.scheduleStep ?? 0];
        return e.appearance?.asset === 'npc.civilian-man-b' && e.appearance.handProp === 'coffee' && activity?.activity === 'sit' && c.activityUntil && activity.seat;
      }).sort((a, b) => Math.hypot(a.transform.x - player.transform.x, a.transform.z - player.transform.z) - Math.hypot(b.transform.x - player.transform.x, b.transform.z - player.transform.z));
      if (candidates.length) {
        const e = candidates[0], activity = e.civilian!.schedule![e.civilian!.scheduleStep ?? 0];
        return { id: e.id, look: e.appearance, at: activity.seat!, lift: activity.seatLift ?? 0, player: player.transform, tick: api.tick() };
      }
    }
    throw new Error('No seated orange-hoodie coffee civilian near the L1 start');
  });
  await session.page.addStyleTag({ content: '#hud,.hud,.inspect-overlay,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:hidden!important}' });
  for (const [name, radius] of [['po-angle', 3], ['game-camera', 19]] as const) {
    await session.page.evaluate(({ holder, radius }) => {
      const api = window.__SS__!, y = .7 + holder.lift, delta = radius * Math.sin(Math.PI * .3) / Math.sqrt(2);
      api.inspect.setCamera({ position: [holder.at.x + delta, y + radius * Math.cos(Math.PI * .3), holder.at.z + delta], target: [holder.at.x, y, holder.at.z] });
      api.inspect.timeScale(0);
    }, { holder, radius });
    await session.screenshot(`${out}/${name}.png`);
  }
  writeJson(`${out}/metrics.json`, { holder, consoleErrors: session.errors, state: await session.page.evaluate(() => window.__SS__!.inspect.state()) });
  if (session.errors.length) throw new Error(session.errors.join('\n'));
  console.log(JSON.stringify({ pass: true, holder, out }));
} finally { await session.close(); stopServer(); }
