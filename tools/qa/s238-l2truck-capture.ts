/** Scheduler s238: real L2 boarding, closed-body ride and arrival frames at both tiers/zooms. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const rows: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    const out = `test-results/s238-l2truck/${tier}`;
    mkdirSync(out, { recursive: true });
    try {
      await session.open();
      await session.page.evaluate(async () => {
        const a = window.__SS__!;
        a.settings.set({ quality: a.getState().render.quality });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.inspect.enable(false); a.camera.follow(); a.cheats.god(true);
        const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        const board = g.world.missions!.def.anchors['l2-board'];
        a.teleport(1, { x: board.x - 4, z: board.z });
        const style = document.createElement('style'); style.textContent = '.mission-subtitle { visibility: hidden !important; }'; document.head.append(style);
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(n => n.setAttribute('data-scene-hud', ''));
      });
      const wait = async (n: number) => session.page.evaluate(n => window.__SS__!.step(n), n);
      const snap = async (stage: string, frame: number) => {
        for (const zoom of [1, 1.5]) {
          const detail = await session.page.evaluate(async zoom => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            a.camera.zoom(zoom); await a.step(1); await a.screenshotReady();
            const l = g.world.missions!.state.l2!, crew = l.crewIds.map(id => g.world.entities.get(id)!);
            return { tick: g.world.tick, phase: l.phase, boardingAt: l.boardingAt ?? null, departAt: l.departAt, seated: l.seated,
              courierVisible: !g.world.entities.get(1)!.hidden, crewVisible: crew.filter(e => !e.hidden).length,
              sitDown: crew.filter(e => e.civilian?.story?.clip === 'npc-sit-down').length,
              crew: crew.map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z, hidden: !!e.hidden, run: e.civilian?.ally?.run, story: e.civilian?.story })),
              render: a.getState().render.vehicles.find(v => v.id === l.truckId) };
          }, zoom);
          const file = `${out}/${stage}-f${String(frame).padStart(3, '0')}-z${zoom}.png`;
          await session.page.screenshot({ path: file });
          rows.push({ tier, stage, frame, zoom, ...detail, file,
            sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
        }
      };
      const state = () => session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        return { tick: g.world.tick, l2: g.world.missions!.state.l2! };
      });
      let s = await state();
      while (!s.l2.alarmAt && s.tick < 31 * 60) { await wait(30); s = await state(); }
      if (!s.l2.alarmAt) throw new Error(`${tier}: station alarm did not fire`);
      for (const dt of [30, 60, 90]) {
        const now = (await state()).tick;
        const target = s.l2.alarmAt + dt;
        if (now < target) await wait(target - now);
        await snap('approach', dt);
      }
      await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        const board = g.world.missions!.def.anchors['l2-board'];
        window.__SS__!.teleport(1, { x: board.x, z: board.z });
      });
      if ((await state()).l2.boardingAt) throw new Error(`${tier}: boarding started before interaction`);
      await session.page.evaluate(() => window.__SS__!.input.set({ interact: true }));
      for (let i = 0; i < 50 && !(await state()).l2.boardingAt; i++) await wait(1);
      await session.page.evaluate(() => window.__SS__!.input.clear());
      s = await state();
      if (!s.l2.boardingAt) throw new Error(`${tier}: l2-board interaction did not start boarding`);
      for (const dt of [80, 110, 140, 170, 210]) {
        const now = (await state()).tick, target = s.l2.boardingAt + dt;
        if (now < target) await wait(target - now);
        await snap('boarding', dt);
      }
      s = await state();
      while (s.l2.phase === 'alarm' && s.tick - (s.l2.boardingAt ?? s.tick) < 500) { await wait(10); s = await state(); }
      if (s.l2.phase !== 'ride') throw new Error(`${tier}: truck did not depart after boarding (${s.l2.phase})`);
      await snap('ride', 180);
      while (s.l2.phase !== 'arrived' && s.tick < s.l2.departAt + 1800) { await wait(20); s = await state(); }
      if (s.l2.phase !== 'arrived') throw new Error(`${tier}: truck did not reach arrival beat`);
      for (const dt of [18, 78, 150, 222, 300]) {
        const now = (await state()).tick, target = s.l2.arrivedAt + dt;
        if (now < target) await wait(target - now);
        await snap('arrival', dt);
      }
      if (session.errors.length) throw new Error(session.errors.join('\n'));
    } finally { await session.close(); }
  }
} finally {
  writeFileSync('test-results/s238-l2truck/captures.json', JSON.stringify(rows, null, 2) + '\n');
  stopServer();
}
