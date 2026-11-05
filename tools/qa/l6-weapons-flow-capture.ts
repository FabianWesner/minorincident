// QA 10-21 #87/#88 captures (lane l6-weapons-flow): the gate checkpoint respawn and the retreat ring/text with the group
// held back at the tunnel mouth, at high/low and zoom 1/1.5, campaign weapons (L6-default).
// usage: SCENE_PORT=4012 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/l6-weapons-flow-capture.ts [webgl2|webgpu]
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const out = 'test-results/l6-weapons-flow';
mkdirSync(out, { recursive: true });
const backend = (process.argv[2] ?? 'webgl2') as 'webgl2' | 'webgpu';
const rows: unknown[] = [];
type L6World = { missions: { state: { checkpoint: string | null; marker: string | null; l6: { leaderX: number; leaderZ: number; survivors: { id: number; status: string }[]; gates: { passed?: boolean }[] } }; def: { anchors: Record<string, { x: number; z: number }> } }; entities: Map<number, { transform: { x: number; z: number } }>; spatial: { set(id: number, x: number, z: number): void } };
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, query: { level: 'L6' } });
    try {
      await session.open();
      await session.page.evaluate(async () => {
        const a = window.__SS__!; await a.ready; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' });
        a.pause(); a.missions.begin(); a.cheats.god(true);
        a.missions.completeObjective('shelter'); a.missions.completeObjective('stop'); await a.step(2);
      });
      for (const spot of ['held', 'respawn'] as const) {
        const info = await session.page.evaluate(async spot => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: { world: L6World } }).game.world, s = w.missions.state.l6;
          // No named closures in page code (tsx adds __name helpers the page does not have).
          const ids: number[] = []; for (const r of s.survivors) if (r.status === 'following') ids.push(r.id);
          if (spot === 'held') {
            // QA #88: the group stays at the tunnel mouth while the scripted leader is already at gate 90.
            a.teleport(1, { x: 52, z: 15 });
            for (let i = 0; i < 240; i++) { s.leaderX = 88; s.leaderZ = 15; for (let k = 0; k < ids.length; k++) { const e = w.entities.get(ids[k])!; e.transform.x = 50 - Math.floor(k / 3) * 1.4; e.transform.z = 15 + (k % 3 - 1) * 1.2; w.spatial.set(ids[k], e.transform.x, e.transform.z); } await a.step(1); }
          } else {
            // QA #87: the group passes gate 90 -> checkpoint; the courier dies behind it and respawns at the gate.
            a.cheats.god(false); a.teleport(1, { x: 70, z: 15 });
            for (let i = 0; i < 4; i++) { s.leaderX = 110; s.leaderZ = 15; for (let k = 0; k < ids.length; k++) { const e = w.entities.get(ids[k])!; e.transform.x = 108 - Math.floor(k / 3) * 1.4; e.transform.z = 15 + (k % 3 - 1) * 1.2; w.spatial.set(ids[k], e.transform.x, e.transform.z); } await a.step(1); }
            a.survivor.damage(100000);
            for (let i = 0; i < 600 && (a.getEntity(1)!.health.current <= 0 || a.missions.state()?.phase !== 'playing'); i++) {
              await a.step(1);
              if (a.missions.state()?.phase === 'retry') document.querySelector<HTMLButtonElement>('[data-testid="mission-button"]')?.click();
            }
            a.cheats.god(true); await a.step(30);
          }
          a.camera.follow(); await a.step(2);
          const p = a.getEntity(1)!.transform, ring = w.missions.def.anchors[w.missions.state.marker ?? ''];
          return { checkpoint: w.missions.state.checkpoint, marker: w.missions.state.marker, ring, player: { x: p.x, z: p.z }, text: document.querySelector('[data-testid="objective-text"]')?.textContent, gatePassed: s.gates[0].passed };
        }, spot);
        for (const zoom of [1, 1.5]) {
          await session.page.evaluate(async zoom => {
            const lab = window.__SCENE__ as unknown as { game: import('../../src/Game').Game };
            const rig = lab.game.view.view, hero = window.__SS__!.getEntity(1)!.transform;
            rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true);
            await window.__SS__!.step(1); await window.__SS__!.screenshotReady();
          }, zoom);
          const name = `${backend}-${tier}-${spot}-z${zoom}`;
          await session.page.screenshot({ path: `${out}/${name}.png` });
          rows.push({ name, ...info, errors: session.errors });
          console.log(JSON.stringify({ name, ...info }));
        }
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/evidence-${backend}.json`, JSON.stringify(rows, null, 2)); }
