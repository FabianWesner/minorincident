/** Source-bound body/eye masks for every E25 infected archetype. Run through e2e-lock. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { infectedDefinitions } from '../../src/data/infected';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const tier = process.argv.includes('--low') ? 'low' : 'high';
const backend = (process.env.E25_BACKEND ?? 'webgl2') as Backend;
const out = process.env.E25_OUT ?? `test-results/epics/E25/final/eyes-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend });
const rows: unknown[] = [];
const linear = (v: number) => v <= 10.31475 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
const luminance = (p: PNG, i: number) => .2126 * linear(p.data[i]) + .7152 * linear(p.data[i + 1]) + .0722 * linear(p.data[i + 2]);
async function shot(name: string) {
  const data = await s.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    g.view.renderer.nextNodeFrame();
    const f = (g.view.renderer as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame;
    f.time = f.deltaTime = 0; g.view.update(1);
    return g.view.renderer.domElement.toDataURL('image/png').split(',')[1];
  });
  const bytes = Buffer.from(data, 'base64');
  writeFileSync(`${out}/${name}.png`, bytes);
  return { png: PNG.sync.read(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
}
try {
  await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
  const actualBackend = await s.page.evaluate(() => window.__SS__!.perf().backend);
  if (actualBackend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw Error(`Backend fallback: ${actualBackend}`);
  const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; crowdSkin?: boolean }[];
  const cases = infectedDefinitions.filter(d => manifest.find(a => a.id === d.asset)?.crowdSkin).map(d => ({ id: d.id, model: d.asset as string | undefined }));
  for (const model of ['inf.jogger', 'inf.cashier', 'inf.delivery-driver', 'inf.suburban-mom', 'inf.bbq-dad', 'inf.bathrobe-neighbor']) cases.push({ id: 'infected.runner', model });
  cases.push({ id: 'infected.runner', model: undefined });
  const selected = process.env.E25_CASES?.split(',');
  for (const [index, specimen] of cases.entries()) {
    const name = specimen.model ?? specimen.id;
    if (selected && !selected.includes(name)) continue;
    const spec: SceneSpec = { name: `eye-${name}`, time: 'night', ground: 'asphalt', size: 40, dof: false,
      actors: [{ id: 'courier', kind: 'courier', at: [-12, -12] }, { id: 'subject', kind: 'infected', archetype: specimen.id, ...(specimen.model ? { look: { model: specimen.model } } : {}), at: [0, 0], yaw: -45, state: 'idle' }],
      camera: { mode: 'pose', position: [12, Number(process.env.E25_CAMERA_Y ?? 18), 22], target: [0, .9, 0] } };
    const loaded = await s.load(spec);
    const subject = loaded.actors.find(a => a.id === 'subject')!.entity;
    // The generic lab uses L1's outbreak dressing, which otherwise substitutes the
    // same civilian for all seven native runner looks. Stage the requested retained
    // production batch explicitly; the shipping shaders, poses and geometry stay active.
    if (specimen.id === 'infected.runner' && specimen.model) await s.page.evaluate(subject => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      delete g.world.entities.get(subject)!.appearance;
      const outbreak = g.world.npcs?.civilians.outbreak; if (outbreak) outbreak.dressInfected = () => {};
      g.view.advance(0);
    }, subject);
    await s.step(1); await s.ready();
    const native = await shot(`${name}-native`);
    const setup = await s.page.evaluate(async ({ subject, path }) => {
      const { installInfectedMask } = await import(/* @vite-ignore */ path) as typeof import('./e25-infected-mask');
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const actor = game.world.entities.get(subject)!;
      const mask = installInfectedMask(game);
      (window as unknown as { e25Mask: typeof mask }).e25Mask = mask;
      return { actor: actor.id, model: actor.appearance, slots: mask.matched, render: window.__SS__!.getState().render };
    }, { subject, path: process.env.SCENE_SERVER === 'preview' ? '/build/e25-infected-mask.js' : '/tools/qa/e25-infected-mask.ts' });
    const masks: PNG[] = [];
    for (const mode of [0, 1, 2]) {
      await s.page.evaluate(mode => (window as unknown as { e25Mask: ReturnType<typeof import('./e25-infected-mask')['installInfectedMask']> }).e25Mask.set(mode), mode);
      masks.push((await shot(`${name}-mask-${mode}`)).png);
    }
    await s.page.evaluate(() => (window as unknown as { e25Mask: ReturnType<typeof import('./e25-infected-mask')['installInfectedMask']> }).e25Mask.restore());
    let bodyMax = 0, eyeMax = 0, bodyPixels = 0, eyePixels = 0;
    for (let i = 0; i < native.png.data.length; i += 4) {
      const isEye = masks[2].data[i] + masks[2].data[i + 1] + masks[2].data[i + 2] - masks[0].data[i] - masks[0].data[i + 1] - masks[0].data[i + 2] > 10;
      const isBody = Math.min(masks[1].data[i], masks[1].data[i + 1], masks[1].data[i + 2]) >= 240 &&
        masks[1].data[i] + masks[1].data[i + 1] + masks[1].data[i + 2] - masks[0].data[i] - masks[0].data[i + 1] - masks[0].data[i + 2] > 10;
      const l = luminance(native.png, i);
      if (isEye) { eyePixels++; eyeMax = Math.max(eyeMax, l); }
      if (isBody && !isEye) { bodyPixels++; bodyMax = Math.max(bodyMax, l); }
    }
    rows.push({ name, ...setup, nativeSha256: native.sha256, bodyMax, eyeMax, bodyPixels, eyePixels, pass: bodyPixels > 100 && eyePixels > 0 && eyeMax >= bodyMax });
    writeFileSync(`${out}/measurements.json`, JSON.stringify({ tier, backend, partial: true, rows, errors: s.errors }, null, 2) + '\n');
    console.log(`${index + 1}/${cases.length} ${name}: body ${bodyMax.toFixed(5)}, eyes ${eyeMax.toFixed(5)} (${eyePixels} px)`);
  }
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ tier, backend, method: 'same-tick production-depth source-bound body/eye masks; fully covered body pixels; positive differential eye support', rows, errors: s.errors }, null, 2) + '\n');
  await s.close(); stopServer();
}
