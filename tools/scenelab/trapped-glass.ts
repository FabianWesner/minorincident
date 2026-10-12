/** L2 trapped civilians behind the supermarket glass: every glass-role clip is played at the real `l2.rescue.atGlass`
 * positions and every arm/hand joint is probed against the glass planes. Gate: no hand/forearm joint (plus a hand-mesh
 * margin) passes the glass. Usage: tsx tools/scenelab/trapped-glass.ts [outDir] [--probe] (--probe only prints). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
import type { ActorSpec } from '../../src/debug/scenelab/spec';
import { l2 } from '../../src/data/l2';

import { GLASS_EAST_X, GLASS_SOUTH_Z, HAND_MARGIN_M, ROLE_CLIPS } from '../../src/data/l2Glass';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'test-results/trapped-glass';
const probeOnly = process.argv.includes('--probe');
const session = new SceneSession();
mkdirSync(out, { recursive: true });
const actors: ActorSpec[] = l2.rescue.atGlass.map(([, , yaw, role], i) => ({
  id: `g${i}`, kind: 'pedestrian', at: [-46 + (i % 2) * 4, -48 + Math.floor(i / 2) * 1.2], yaw: -yaw, state: 'idle',
  look: { model: role === 'child' ? 'npc.civilian-kid' : i % 2 ? 'npc.civilian-woman-a' : 'npc.civilian-man-a', handProp: null },
}));
const arms = ['upperArmL', 'upperArmR', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR'];
const report: Record<string, { role: string; clip: string; maxX: number; maxZ: number; side: 'east' | 'south'; root: number[] }> = {};
try {
  await session.open();
  await session.load({
    ground: 'district', time: 'L2', tier: 1,
    layout: { district: 'D-GROVE', level: 'L2', bbox: [[-64, -50], [-44, -30]], assets: ['bld.supermarket'] },
    camera: { mode: 'game', target: [-52.2, -42], zoom: 3 }, frames: 10, shots: [], expect: { consoleErrors: 0 },
  });
  await session.page.evaluate(specs => { const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
    const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
    // The shop interior is not navigable: like the mission, spawn outside, then place the figure at the glass.
    specs.forEach((a, i) => { lab.spawnActor(a.spec); const e = game.world.entities.get(lab.actors.get(a.spec.id!)!.entity)!;
      Object.assign(e.transform, { x: a.glass[0], z: a.glass[1], yaw: a.glass[2] }); game.world.spatial.set(e.id, a.glass[0], a.glass[1]); void i; });
  }, actors.map((spec, i) => ({ spec, glass: l2.rescue.atGlass[i] as unknown as number[] })));
  await session.step(30);
  const roles = l2.rescue.atGlass.map(g => g[3]);
  const clipNames = [...new Set(Object.values(ROLE_CLIPS).flat())];
  for (const clip of clipNames) {
    for (let pass = 0; pass < 3; pass++) {
      // Sample the whole loop of the clip (phase offsets via restart ticks) so the extremes of the swing are seen.
      await session.page.evaluate(({ clip, roles }) => {
        const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
        const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
        roles.forEach((role, i) => {
          const e = game.world.entities.get(lab.actors.get(`g${i}`)!.entity)!, c = e.civilian!;
          c.ambient = false; c.pauseUntil = Number.MAX_SAFE_INTEGER; c.path.length = 0;
          c.story = { clip, start: game.world.tick };
        });
      }, { clip, roles: roles as string[] });
      for (let k = 0; k < 24; k++) {
        // Pin each figure to its authored glass spot (the lab's idle AI would otherwise turn and shuffle it).
        await session.page.evaluate(glass => {
          const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
          const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
          glass.forEach((g, i) => { const e = game.world.entities.get(lab.actors.get(`g${i}`)!.entity)!; Object.assign(e.transform, { x: g[0], z: g[1], yaw: g[2] }); });
        }, l2.rescue.atGlass.map(g => [g[0], g[1], g[2]]));
        await session.step(3);
        const samples = await session.page.evaluate(({ arms, clip }) => {
          const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
          const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
          const figures = game.view.labProbes().npcs!.snapshot().civilians.figures;
          return [...lab.actors.entries()].map(([id, a]) => {
            const f = figures.find(fig => fig.id === a.entity && fig.drawn);
            return { id, clip: f?.clip, joints: f?.joints ? Object.fromEntries(arms.filter(n => f.joints![n]).map(n => [n, f.joints![n]])) : {}, want: clip, root: (() => { const e = game.world.entities.get(a.entity)!; return [e.transform.x, e.transform.z, e.transform.yaw]; })() };
          });
        }, { arms, clip });
        for (const s of samples) {
          if (s.clip !== clip) continue; // the figure is still blending into the requested clip
          const i = Number(s.id.slice(1)), [, , , role] = l2.rescue.atGlass[i];
          if (!ROLE_CLIPS[role].includes(clip)) continue;
          const side = l2.rescue.atGlass[i][2] === 0 ? 'east' : 'south';
          const pts = Object.entries(s.joints).filter(([n]) => /hand|foreArm/i.test(n)).map(([, p]) => p as number[]);
          const key = `${s.id}:${clip}`;
          const maxX = Math.max(-Infinity, ...pts.map(p => p[0])), maxZ = Math.max(-Infinity, ...pts.map(p => p[2]));
          const r = report[key] ??= { role, clip, maxX: -Infinity, maxZ: -Infinity, side, root: s.root };
          r.maxX = Math.max(r.maxX, maxX); r.maxZ = Math.max(r.maxZ, maxZ);
        }
      }
    }
  }
  const rows = Object.entries(report).map(([key, r]) => {
    // east glass: figures face +x, the glass is the plane x = GLASS_EAST_X; south glass: figures face +z? yaw -PI/2 faces -z.
    const overshootM = r.side === 'east' ? r.maxX + HAND_MARGIN_M - GLASS_EAST_X : r.maxZ + HAND_MARGIN_M - GLASS_SOUTH_Z;
    return { key, ...r, overshootM };
  });
  writeFileSync(`${out}/report.json`, JSON.stringify(rows, null, 1) + '\n');
  for (const r of rows) console.log(`${r.key.padEnd(14)} ${r.role.padEnd(7)} ${r.side} root=${r.root.map(v => v.toFixed(2))} maxX=${r.maxX.toFixed(3)} maxZ=${r.maxZ.toFixed(3)} over=${r.overshootM.toFixed(3)}`);
  // Captures: every figure in its most forward clip, pinned to its spot, game camera at the east and south glass.
  for (const [name, target] of [['east', [-52.2, -42.6]], ['south', [-56, -38.4]]] as const) {
    await session.page.evaluate(({ glass, roles, target }) => {
      const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
      const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
      glass.forEach((g, i) => { const e = game.world.entities.get(lab.actors.get(`g${i}`)!.entity)!; Object.assign(e.transform, { x: g[0], z: g[1], yaw: g[2] });
        e.civilian!.story = { clip: roles[i] === 'bang' || roles[i] === 'press' ? 'npc-press' : roles[i] === 'plead' ? 'npc-plead' : roles[i] === 'look' ? 'npc-plead' : roles[i] === 'hug' ? 'npc-hug' : 'npc-cower', start: game.world.tick }; });
      lab.setCamera({ mode: 'game', target, zoom: 1 } as never);
    }, { glass: l2.rescue.atGlass.map(g => [g[0], g[1], g[2]]), roles: roles as string[], target: [...target] });
    await session.step(14);
    await session.screenshot(`${out}/${name}.png`);
  }
  const worst = Math.max(...rows.map(r => r.overshootM));
  console.log(`worst overshoot past the glass: ${worst.toFixed(3)} m (gate <= 0)`);
  void probeOnly;
  if (worst > 0 && !probeOnly) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
