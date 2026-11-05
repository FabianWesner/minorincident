/** L5 caption acceptance fixtures. World placement is fixture setup, never a playtest navigation input. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/l5-density/captures';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of ['webgpu', 'webgl2'] as const) for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend, tier, query: { ui: '1', loadProfile: '2' } });
    try {
      await session.open();
      await session.page.evaluate('window.__name = f => f');
      await session.page.evaluate(async tier => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        a.settings.set({ quality: tier, muted: true });
        await a.loadLevel('L5', { seed: 1 }); a.pause(); a.missions.begin(); game.ui.show(null);
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelector('.hud')!.setAttribute('data-scene-hud', '');
        a.missions.completeObjective('emerge');
        // Wait out the search timer away from combat; a stationary unarmed high-tier fixture dies at the exit.
        const quietRing = game.world.missions!.def.anchors['l5-ring-rosa'];
        a.teleport(1, { x: quietRing.x + 50, z: quietRing.z }); await a.step(11 * 60);
        const mission = game.world.missions!;
        const controller = mission.l5 as unknown as { find(row: NonNullable<typeof mission.state.l5>['survivors'][number]): void };
        for (const row of mission.state.l5!.survivors) if (row.key !== 'rosa') controller.find(row);
        const ring = game.world.missions!.def.anchors['l5-ring-rosa'];
        a.teleport(1, { x: ring.x + 15, z: ring.z }); a.camera.follow();
        // Keep this naturally generated cue in its full-opacity interval for the matrix.
        await a.step(60);
      }, tier);
      console.log(JSON.stringify(await session.page.evaluate(() => { const game = (window.__SCENE__ as unknown as { game: Game }).game; return { setup: true, tier: window.__SS__!.getState().render.quality, hp: game.world.entities.get(1)!.health.current, tick: game.world.tick, phase: game.world.missions!.state.l5!.phase }; })));
      for (const zoom of [1.5, .5]) for (const framing of ['world', 'edge'] as const) {
        const result = await session.page.evaluate(async ({ zoom, framing }) => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          const ring = game.world.missions!.def.anchors['l5-ring-rosa'];
          a.teleport(1, { x: ring.x - (framing === 'world' ? 3 : 15), z: ring.z });
          a.camera.zoom(zoom); await a.step(2); await a.screenshotReady(); game.ui.hud.update();
          const cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]')!;
          const arrow = document.querySelector<HTMLElement>('[data-testid=survivor-cue-arrow]')!;
          const rect = cue.getBoundingClientRect(), m = game.world.missions!;
          const p = a.getEntity(1)!.transform, pin = document.querySelector<HTMLElement>('[data-testid=minimap-cue]')!;
          return { backend: a.getState().render.backend, quality: a.getState().render.quality, zoom,
            camera: game.view.view.getState(),
            cue: { text: cue.innerText, visible: !cue.hidden, opacity: +cue.style.opacity,
              box: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }, edge: !arrow.hidden },
            distance: Math.hypot(p.x - ring.x, p.z - ring.z), cueUntil: m.state.l5!.cue?.until,
            pin: { hidden: pin.hidden, survivor: pin.dataset.survivor, x: pin.dataset.worldX, z: pin.dataset.worldZ,
              clamped: pin.dataset.clamped, label: pin.getAttribute('aria-label') },
            cueSource: m.state.l5!.cue && { x: m.state.l5!.cue.x, z: m.state.l5!.cue.z },
            waypoint: m.def.steps.find(s => s.id === 'look')!.waypoint,
            overlaps: [...document.querySelectorAll<HTMLElement>('.hud-vitals,.hud-companion,.hud-survivor-vitals,.hud-map,.hud-weather,.hud-tracker,.hud-weapon-rack,.mission-subtitle')].flatMap(panel => {
              const box = panel.getBoundingClientRect();
              return !panel.hidden && box.width && box.height && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top ? [panel.className] : [];
            }),
          };
        }, { zoom, framing });
        assert.equal(result.backend, backend === 'webgl2' ? 'webgl' : backend); assert.equal(result.quality, tier);
        assert.equal(result.camera.zoom, zoom, 'actual camera zoom');
        assert(result.cue.visible && result.cue.opacity > .9, JSON.stringify(result));
        assert(result.pin && !result.pin.hidden, 'Q-321: radar ♪ pin is visible during the call');
        assert.equal(result.pin.survivor, 'rosa');
        assert.equal(Number(result.pin.x), result.cueSource!.x, 'radar pin uses the call source X');
        assert.equal(Number(result.pin.z), result.cueSource!.z, 'radar pin uses the call source Z');
        assert.equal(result.pin.label, 'A sign of life');
        assert.equal(result.waypoint, false, 'Q-302: no survivor search waypoint');
        assert(result.distance <= 25, 'existing cue range');
        assert.deepEqual(result.overlaps, [], 'caption does not cover the HUD');
        assert.equal(result.cue.edge, framing === 'edge', 'world caption / edge caption fixture');
        assert(result.cue.box.x >= 0 && result.cue.box.y >= 0 && result.cue.box.right <= 1280 && result.cue.box.bottom <= 720, 'caption stays in frame');
        const name = `${backend}-${tier}-z${zoom}-${framing}`;
        await session.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 72 });
        const radar = await session.page.locator('.hud-map').boundingBox(); assert(radar, 'radar is visible for cue capture');
        await session.page.screenshot({ path: `${out}/${name}-radar.jpg`, type: 'jpeg', quality: 78, clip: radar });
        rows.push({ name, ...result }); console.log(JSON.stringify({ name, ...result }));
      }
      const clamped = await session.page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, cue = game.world.missions!.state.l5!.cue!;
        a.teleport(1, { x: cue.x + 50, z: cue.z }); await a.step(1); await a.screenshotReady(); game.ui.hud.update();
        const pin = document.querySelector<HTMLElement>('[data-testid=minimap-cue]')!;
        return { hidden: pin.hidden, clamped: pin.dataset.clamped, tick: a.tick(), until: game.world.missions!.state.l5!.cue?.until };
      });
      assert(!clamped.hidden && clamped.until! > clamped.tick && clamped.clamped === 'true', 'radar pin clamps to the edge while the call remains active');
      const farRadar = await session.page.locator('.hud-map').boundingBox(); assert(farRadar);
      await session.page.screenshot({ path: `${out}/${backend}-${tier}-radar-clamped.jpg`, type: 'jpeg', quality: 78, clip: farRadar });
      rows.push({ backend, tier, clamped });
      const corner = await session.page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        const ring = game.world.missions!.def.anchors['l5-ring-rosa'];
        a.teleport(1, { x: ring.x + 15, z: ring.z }); a.camera.zoom(1.5); await a.step(2); await a.screenshotReady(); game.ui.hud.update();
        const cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]')!, rect = cue.getBoundingClientRect();
        return { cue: { text: cue.innerText, box: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom } }, overlaps: [...document.querySelectorAll<HTMLElement>('.hud-vitals,.hud-companion,.hud-survivor-vitals,.hud-map,.hud-weather,.hud-tracker,.hud-weapon-rack,.mission-subtitle')].flatMap(panel => {
          const box = panel.getBoundingClientRect(); return !panel.hidden && box.width && box.height && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top ? [panel.className] : [];
        }) };
      });
      assert.deepEqual(corner.overlaps, [], 'left caption clears four survivor cards and the portrait');
      const cornerName = `${backend}-${tier}-hud-left`;
      await session.page.screenshot({ path: `${out}/${cornerName}.jpg`, type: 'jpeg', quality: 72 }); rows.push({ name: cornerName, ...corner });
      const lifecycle = await session.page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        const cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]')!;
        const mission = game.world.missions!, ring = mission.def.anchors['l5-ring-rosa'];
        const until = mission.state.l5!.cue!.until;
        await a.step(until - a.tick() - 10);
        const fadeOut = +cue.style.opacity;
        await a.step(10); const expired = cue.hidden, pinExpired = document.querySelector<HTMLElement>('[data-testid=minimap-cue]')!.hidden, expiryTick = a.tick();
        a.teleport(1, { x: ring.x + 31, z: ring.z }); await a.step(500);
        const outside = cue.hidden && !mission.state.l5!.cue;
        a.teleport(1, { x: ring.x + 24.9, z: ring.z }); await a.step(1);
        const fadeInStart = +cue.style.opacity;
        await a.step(10); const fadeIn = +cue.style.opacity;
        a.teleport(1, { x: ring.x + 25.1, z: ring.z }); await a.step(1);
        return { fadeOut, expired, pinExpired, expiryTick, until, outside, fadeInStart, fadeIn, hiddenBeyondRange: cue.hidden, hp: game.world.entities.get(1)!.health.current, phase: mission.state.l5!.phase };
      });
      console.log(JSON.stringify({ backend, tier, lifecycle }));
      assert(lifecycle.fadeOut > 0 && lifecycle.fadeOut < .3 && lifecycle.expired && lifecycle.pinExpired && lifecycle.outside && lifecycle.hiddenBeyondRange);
      assert(lifecycle.fadeInStart === 0 && lifecycle.fadeIn > 0 && lifecycle.fadeIn < 1);
      assert.equal(lifecycle.expiryTick, lifecycle.until, 'radar pin disappears at the exact call expiry tick');
      const silentPin = await session.page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        const until = game.world.missions!.state.l5!.cue?.until ?? a.tick();
        await a.step(Math.max(1, until - a.tick() + 1)); game.ui.hud.update();
        return document.querySelector<HTMLElement>('[data-testid=minimap-cue]')!.hidden;
      });
      assert(silentPin, 'radar pin is hidden in the captured interval between calls');
      const between = await session.page.locator('.hud-map').boundingBox(); assert(between, 'radar is visible between calls');
      await session.page.screenshot({ path: `${out}/${backend}-${tier}-radar-between.jpg`, type: 'jpeg', quality: 78, clip: between });
      rows.push({ backend, tier, lifecycle });
      assert.deepEqual(session.errors, []);
    } finally { await session.close(); }
  }
  writeFileSync(`${out}/matrix.json`, JSON.stringify(rows, null, 2));
} finally { stopServer(); }
