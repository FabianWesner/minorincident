import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import { authoredClips } from '../../src/render/characters/clips';
import type { SceneSpec, CameraSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from '../scenelab/session';
const runOnly = process.argv.includes('--run-only'), swingOnly=process.argv.includes('--swing-only');
const phase = process.argv[2] ?? 'after', tier = process.argv[3] === 'low' ? 'low' : 'high';
const output = resolve(process.env.SLIM_OUT ?? `docs/reports/slim/pilot/game-${phase}-${tier}`); mkdirSync(output, { recursive: true });
const session = new SceneSession({ backend: process.env.SLIM_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2', tier, viewport: { width: 1200, height: 900 }, query: { skin: '1' } });
const receipts: unknown[] = [];
const cameras: Record<string, CameraSpec> = { zoom15: { mode: 'game', target: [0, .7, 0], zoom: 1.5 }, close3m: { mode: 'close', target: [0, .95, 0], radius: 3, azimuth: 45 } };
try {
  await session.open();
  for (const figure of ['man-a', 'woman-a']) {
    const spec: SceneSpec = { name: `slim-pilot-${figure}`, ground: 'sidewalk', time: 'L1', size: 20, dof: false, trace: true,
      actors: [{ id: 'heroine', kind: 'courier', at: [-.4, .4], yaw: 315, look: { model: 'female' }, state: 'idle' }, { id: 'pilot', kind: 'pedestrian', at: [.4, -.4], yaw: 315, look: { model: `npc.civilian-${figure}`, accessories: ['none'], handProp: 'coffee' }, state: 'idle' }], camera: cameras.close3m };
    const reset = async () => { await session.load(spec); await session.step(120); await session.ready(); await session.page.evaluate(() => window.__SCENE__!.command('heroine', { god: true })); };
    const shot = async (pose: string, all = true) => {
      const m = await session.metrics(), actor = m.actors.pilot, at = actor.position!;
      const dead = pose.startsWith('death');
      for (const view of Object.keys(cameras)) {
        if (!all && view === 'zoom15') continue;
        const frame: CameraSpec = view === 'close3m'
          ? { mode: 'close', radius: 3, azimuth: 45, target: dead ? [at[0], .15, at[1]] : [at[0] * .5 - .2, .95, at[1] * .5 + .2] }
          : { mode: 'game', zoom: 1.5, target: dead ? [at[0], .15, at[1]] : [0, .7, 0] };
        await session.page.evaluate(c => window.__SCENE__!.setCamera(c), frame); await session.ready();
        await session.page.screenshot({ path: resolve(output, `${figure}-${pose}-${view}.jpg`), type: 'jpeg', quality: 94 });
        if (view === 'close3m') {
          await session.page.evaluate(({p,dead}) => window.__SCENE__!.setCamera(dead ? {mode:'pose',target:[p[0],.15,p[1]],position:[p[0]+.4,.15+Math.sqrt(9-.32),p[1]+.4]} : { mode: 'close', target: [p[0], .2, p[1]], radius: 3, azimuth: 45 }), {p:at,dead}); await session.ready();
          await session.page.screenshot({ path: resolve(output, `${figure}-${pose}-close3m-lower.jpg`), type: 'jpeg', quality: 94 });
        }
      }
      const metrics = await session.metrics();
      for (const a of Object.values(metrics.actors)) if (a.track) a.track = a.track.filter(t => t.frame % 12 === 0 || t.frame === metrics.frame);
      receipts.push({ figure, pose, metrics }); console.log(phase, tier, figure, pose);
    };
    const swing=async()=>{await reset();await session.page.evaluate(()=>{const lab=window.__SCENE__ as unknown as{game:Game;actors:Map<string,{entity:number}>};const e=lab.game.world.entities.get(lab.actors.get('pilot')!.entity)!;e.appearance!.handProp=null;e.civilian!.story={clip:'swing',start:lab.game.world.tick};});await session.step(Math.max(1,Math.floor(authoredClips.get('swing')!.duration*30)));await shot('swing-mid');};
    if(swingOnly){await swing();continue;}
    if (runOnly) { await reset(); await session.page.evaluate(() => window.__SCENE__!.command('pilot', { flee: [-4, -4] })); await session.step(60); await shot('run60'); continue; }
    await reset(); await shot('idle', true);
    await session.page.evaluate(() => window.__SCENE__!.command('pilot', { walk: [[1.8, 1.4]] }));
    await session.step(12); await shot('walk12', true); await session.step(12); await shot('walk24', true);
    await reset(); await session.page.evaluate(() => window.__SCENE__!.command('pilot', { flee: [-4, -4] })); await session.step(60); await shot('run60');
    await reset(); await session.page.evaluate(() => window.__SCENE__!.command('pilot', { routine: 'sit' })); await session.step(60); await shot('sit60');
    await swing();
    await reset(); await session.page.evaluate(() => window.__SCENE__!.command('pilot', { infect: { instant: true } })); await session.step(1);
    await session.page.evaluate(() => window.__SCENE__!.command('pilot', { chase: 'heroine' })); await session.step(35); await shot('attack35');
    await session.step(20); await shot('attack55');
    await session.page.evaluate(() => window.__SCENE__!.command('pilot', { corpse: true })); await session.step(180); await shot('death180');
  }
  if (runOnly || swingOnly) { const previous = JSON.parse(readFileSync(resolve(output, 'receipts.json'), 'utf8')); receipts.push(...previous.receipts.filter((r: { pose: string }) => swingOnly?r.pose!=='swing-mid':!r.pose.startsWith('run'))); }
  writeFileSync(resolve(output, 'receipts.json'), JSON.stringify({ phase, tier, receipts, errors: session.errors }, null, 2) + '\n');
  if (session.errors.length) throw Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
