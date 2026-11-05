/** Shared-pool follower-bar matrix. Run each backend serially on SCENE_PORT=4874. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { HealthBars } from '../../src/render/HealthBars';
import type { InstancedMesh } from 'three';
import { formationSlot, leaderHeading } from '../../src/sim/missions/missionHelpers';

const backend = (process.env.L6_BAR_BACKEND ?? 'webgl2') as Backend;
assert.ok(['webgl2', 'webgpu'].includes(backend));
const out = `test-results/l6-retreat-bars/bars-${backend}`;
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const scenes = ['stunning-bars-l5-five', 'l6-tunnel-group', 'stunning-bars-l7-start-healthy'];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend, tier });
    try {
      await session.open();
      for (const name of scenes) {
        const spec = readSpec(`tests/scenes/catalog/${name}.json`);
        if (spec.l6Subway) {
          spec.l6Subway = 'gate';
          spec.actors![0].at = [106, 15];
          spec.camera = { mode: 'game', target: [106, 1.3, 15], zoom: 1 };
        }
        if (spec.l7Group) {
          // An explicit handover cohort keeps the requested 24 people at low too.
          spec.l7Group = true;
          spec.actors!.push(...Array.from({ length: 24 }, (_, slot) => {
            const at = formationSlot({ x: 273, z: 15 }, leaderHeading(0), slot);
            return { id: `follower-${slot}`, kind: 'pedestrian' as const, at: [at.x, at.z] as [number, number], look: { model: slot % 2 ? 'npc.civilian-man-b.aftermath' : 'npc.civilian-woman-b.aftermath' }, state: { survivor: { slot } } };
          }));
        }
        await session.load(spec);
        const followers = await session.page.evaluate(() => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          const group = [...w.entities.iterate()].filter(e => e.civilian?.survivor?.mode === 'follow' && !e.hidden && e.health.current > 0);
          for (const [i, e] of group.entries()) {
            a.npcs.health(e.id, e.health.max * (i % 4 === 0 ? .25 : i % 4 === 1 ? .5 : 1));
            if (w.scenario === 'L6') w.solids.relocate(e, { x: 101 + Math.floor(i / 3) * 1.1, y: 1.3, z: 15 + (i % 3 - 1) * .8 }, 'qa.follower-bars', 2);
          }
          if (w.missions?.state.l6) { w.missions.state.l6.leaderX = 110; w.missions.state.l6.leaderZ = 15; }
          return group.map(e => e.id);
        });
        assert.equal(followers.length, name.includes('l5') ? 5 : name.includes('l6') ? 29 : 24, `${name} roster`);
        for (const zoom of [1.5, .5]) {
          await session.page.evaluate(z => window.__SCENE__!.setCamera({ mode: 'follow', actor: 'courier', zoom: z }), zoom);
          const result = await session.page.evaluate(async ids => {
            const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
            const bars = (game.view as unknown as { healthBars: { snapshot: HealthBars['snapshot']; heroScreen: { left: number; right: number; top: number; bottom: number }; followerMeshes: InstancedMesh[] } }).healthBars;
            let shown = 0, hurt = 0, healthy = 0, overlap = 0, badSize = 0, fillError = 0, missingHero = 0, clippedHero = 0;
            for (let frame = 0; frame < 30; frame++) {
              await a.step(1);
              const snapshot = bars.snapshot(), hero = bars.heroScreen;
              if (!Object.values(hero).every(Number.isFinite) || hero.right <= hero.left || hero.bottom <= hero.top) missingHero++;
              if (hero.left < 0 || hero.right > innerWidth || hero.top < 0 || hero.bottom > innerHeight) clippedHero++;
              const followers = snapshot.bars.filter(b => ids.includes(b.id));
              const bg = bars.followerMeshes[1].instanceMatrix.array, fill = bars.followerMeshes[2].instanceMatrix.array;
              for (const [i, bar] of followers.entries()) {
                shown++; if (bar.fraction < 1) hurt++; else healthy++;
                if (ids.length > 5 && (bar.width !== 18 || bar.height !== 3 || bar.gap !== 0)) badSize++;
                if (bar.x + bar.width / 2 + bar.gap >= hero.left && bar.x - bar.width / 2 - bar.gap <= hero.right && bar.y + bar.height / 2 + bar.gap >= hero.top && bar.y - bar.height / 2 - bar.gap <= hero.bottom) overlap++;
                // Compare rendered left edges, independently of the screen probe.
                for (let axis = 0; axis < 3; axis++) fillError = Math.max(fillError, Math.abs((bg[i * 16 + 12 + axis] - bg[i * 16 + axis] / 2) - (fill[i * 16 + 12 + axis] - fill[i * 16 + axis] / 2)));
              }
            }
            const actual = a.getState().render.backend;
            const gl = actual === 'webgl' ? game.view.renderer.domElement.getContext('webgl2') : null;
            return { frames: 30, shown, hurt, healthy, overlap, badSize, fillError, missingHero, clippedHero, actual, webglVersion: gl ? String(gl.getParameter(gl.VERSION)) : null, actualTier: a.getState().render.quality, camera: a.getState().render.camera };
          }, followers);
          const id = `${name}-${tier}-z${zoom}`;
          rows.push({ id, followers: followers.length, ...result });
          assert.equal(result.actual, backend === 'webgl2' ? 'webgl' : backend, `${id} actual backend`);
          if (backend === 'webgl2') assert.ok(result.webglVersion?.startsWith('WebGL 2.0'), `${id} actual WebGL2 context`);
          assert.equal(result.actualTier, tier, `${id} actual quality`);
          assert.ok(Math.abs(result.camera.targetZoom - zoom) < .001 && result.camera.spot === null, `${id} production follow camera at requested zoom`);
          assert.ok(result.healthy > 0 && result.hurt > 0, `${id} includes displayed healthy/injured health UI`);
          assert.equal(result.missingHero, 0, `${id} posed heroine bounds exist in every frame`);
          assert.equal(result.clippedHero, 0, `${id} heroine remains inside the viewport`);
          assert.equal(result.overlap, 0, `${id} follower bars cover the heroine`);
          assert.equal(result.badSize, 0, `${id} compact pip size`);
          assert.ok(result.fillError < .0001, `${id} injured fills align with their backgrounds: ${result.fillError}`);
          await session.screenshot(`${out}/${id}.png`);
          console.log(`${id}: ${result.shown} bars, ${result.hurt} hurt, no heroine overlap`);
        }
      }
      assert.deepEqual(session.errors, [], 'renderer errors');
    } finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, null, 2));
}
