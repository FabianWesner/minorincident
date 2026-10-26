/** Native ABBA: every L1 figure together, plus the occupied production escape street. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { get } from 'node:http';
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
import { loadCrowd } from './l1-all-new-crowd';
import type { Game } from '../../src/Game';

const root = process.cwd(), baseline = resolve(process.env.BASELINE_ROOT ?? '../l1-all-new-main');
const out = resolve(root, 'test-results/l1-all-new'), summarize = process.argv.includes('--summarize');
const receipts: Record<string, unknown>[] = summarize ? JSON.parse(readFileSync(resolve(out, 'performance.json'), 'utf8')) : [];
const setups = [{ backend: 'webgl2' as Backend, phone: false }, { backend: 'webgpu' as Backend, phone: false }, { backend: 'webgl2' as Backend, phone: true }];
process.env.SCENE_SERVER = 'preview';
try {
  if (!summarize) for (const { backend, phone } of setups) for (const variant of ['main', 'new', 'new', 'main']) for (const scenario of ['all-figures', 'escape-street']) {
    process.chdir(variant === 'main' ? baseline : root);
    const session = new SceneSession({ backend, phone, tier: 'low', nativeFrameTiming: true, viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, query: { crowdProbe: 'drawn', dpr: phone ? '1.5' : '1' } });
    try {
      await session.open();
      await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
      await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
      if (phone) { const cdp = await session.page.context().newCDPSession(session.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
      if (scenario === 'all-figures') await loadCrowd(session);
      else await session.page.evaluate(async () => {
        const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.cheats.god(true);
        for (let i = 0; i < 8 && a.missions.state()!.steps.weapon.status !== 'active'; i++) a.cheats.completeObjective();
        a.teleport('player', { x: 23.1, z: 38.289 }); await a.step(1200);
        a.teleport('player', { x: 14, z: 4 }); a.camera.follow(); await a.step(600); await a.screenshotReady();
      });
      let overlap = false;
      const monitor = setInterval(() => {
        const processes = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' }).split('\n');
        const browsers = processes.filter(line => /^\/(?:.*\/)?(?:chrome-headless-shell|Chromium|Google Chrome) /.test(line) && !line.includes('--type=') && (line.includes('headless') || line.includes('--remote-debugging')));
        if (browsers.length > 1 || processes.some(line => /^\/Applications\/Blender[.]app\/Contents\/MacOS\/Blender |^(?:\/[^ ]*\/)?node .*\/(?:vite|vite[.]js) build(?: |$)|^(?:\/[^ ]*\/)?node (?:\(vitest|.*(?:node_modules\/(?:[.]bin\/vitest|vitest\/vitest[.]mjs)|typescript\/bin\/tsc)(?: |$))/.test(line))) overlap = true;
      }, 500);
      let result;
      try {
        result = await session.page.evaluate(async () => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          const frames: number[] = []; let previous = 0, maxDraws = 0, maxTriangles = 0;
          a.resume(); const start = performance.now();
          for (let i = 0; i < 720 || performance.now() - start < 12000; i++) {
            const now = await new Promise<number>(requestAnimationFrame);
            if (i >= 120 && previous) frames.push(now - previous); previous = now;
            if (i % 30 === 0) { const p = a.perf(); maxDraws = Math.max(maxDraws, p.drawCalls); maxTriangles = Math.max(maxTriangles, p.triangles); }
          }
          a.pause(); frames.sort((x, y) => x - y);
          const textures = new Set<import('three').Texture>();
          game.view.scene.traverse(node => {
            const mesh = node as import('three').Mesh;
            if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
            for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
          });
          let decodedBytes = 0, rgbaUpperBoundBytes = 0;
          for (const texture of textures) {
            const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } };
            if (!image?.width || !image?.height) continue;
            const mipmaps = texture.mipmaps as { data?: { byteLength: number } }[];
            const bytes = mipmaps.reduce((sum, mip) => sum + (mip.data?.byteLength ?? 0), 0) || image.data?.byteLength || image.width * image.height * 4;
            decodedBytes += bytes;
            rgbaUpperBoundBytes += image.data?.byteLength ?? Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps || mipmaps.length > 1 ? 4 / 3 : 1));
          }
          return { samples: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1], p50: frames[Math.ceil(frames.length * .5) - 1], maxDraws, maxTriangles, decodedTextures: { count: textures.size, decodedBytes, rgbaUpperBoundBytes }, perf: a.perf(), render: a.getState().render };
        });
      } finally { clearInterval(monitor); }
      const receipt = { sampledAt: new Date().toISOString(), scenario, variant, backend, phone, overlap, ...result, errorCount: session.errors.length, errors: [...new Set(session.errors)].slice(0, 20) };
      receipts.push(receipt); writeJson(resolve(out, 'performance.json'), receipts);
      console.log(JSON.stringify({ scenario, variant, backend, phone, overlap, p95: result.p95, draws: result.maxDraws, errors: session.errors.length }));
      if (overlap || session.errors.length || result.perf.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu') || result.render.quality !== 'low') throw Error('Invalid native performance sample');
    } finally { await session.close(); stopServer(); }
    for (let i = 0; i < 30; i++) {
      const alive = await new Promise<boolean>(resolve => { const request = get(`http://127.0.0.1:${process.env.SCENE_PORT ?? 4672}`, { agent: false }, response => { response.resume(); resolve(true); }); request.on('error', () => resolve(false)); request.setTimeout(1000, () => { request.destroy(); resolve(false); }); });
      if (!alive) break; await new Promise(r => setTimeout(r, 100));
    }
  }
  const summary = setups.flatMap(({ backend, phone }) => ['all-figures', 'escape-street'].map(scenario => {
    const rows = receipts.filter(r => r.backend === backend && r.phone === phone && r.scenario === scenario);
    const mean = (variant: string) => { const values = rows.filter(r => r.variant === variant).map(r => r.p95 as number); return values.reduce((a, b) => a + b, 0) / values.length; };
    const before = mean('main'), after = mean('new');
    return { scenario, backend, phone, mainP95: before, newP95: after, deltaMs: after - before, pass: rows.length === 4 && after - before <= 1 && rows.filter(r => r.variant === 'new').every(r => (r.maxDraws as number) <= 300 && (r.maxTriangles as number) <= 500000) };
  }));
  writeJson(resolve(out, 'performance-summary.json'), summary);
  if (summary.some(row => !row.pass)) throw Error('L1 native performance budget failed');
} finally { process.chdir(root); stopServer(); }
