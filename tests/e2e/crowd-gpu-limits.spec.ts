import { expect, test } from './fixtures';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** Q-201 hard gate: every crowd material variant (rigid, skinned, textured, infected tint, dog palette, all LODs,
 * accessories, frozen corpse pages, id/mask passes) compiles within the portable GPU limits on both backends.
 * Ground truth is the compiled program, not an estimate: WebGL2 active attributes and vertex `out`s per linked
 * program, WebGPU vertex buffers/attributes and inter-stage @locations per render pipeline.
 * Hard limits (every program): 16 attributes (WebGL2 MAX_VERTEX_ATTRIBS), 15 varyings (WebGL2 minimum
 * MAX_VARYING_VECTORS), 8 vertex buffers (WebGPU maxVertexBuffers).
 * Crowd headroom (programs reading `_parts`): 14 attributes, 14 varyings, 7 buffers, so a future varying or
 * per-instance channel cannot silently push a figure over the edge on a real device. */
const scene = (path: string) => JSON.parse(readFileSync(new URL(`../scenes/${path}`, import.meta.url), 'utf8')) as SceneSpec;
const scenes = ['crowd-variety/infected-20.json', 'crowd-variety/l1-street.json', 'crowd-variety/l2-fight.json', 'catalog/corpse-look-alpha.json', 'dog-corpse/close.json'];
export const HARD = { attributes: 16, varyings: 15, buffers: 8 }, CROWD = { attributes: 14, varyings: 14, buffers: 7 };
interface Program { backend: 'webgl' | 'webgpu'; label: string; attributes: number; varyings: number; buffers: number; names: string[]; outputs: string[] }

test.use({ launchOptions:{ args: process.platform==='darwin' ? ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-webgpu'] : ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-unsafe-webgpu'] } });
for (const backend of ['webgl','webgpu'] as const) test(`crowd materials compile within GPU limits on ${backend} @smoke @E18-AC01`, async ({page}) => {
  test.setTimeout(240000);
  await page.addInitScript(() => {
    const w = window as unknown as { __programs: Program[] };
    w.__programs = [];
    // GLSL/WGSL slot count of one declared type (matrices take one location per column).
    const slots = (type: string) => /mat4/.test(type) ? 4 : /mat3/.test(type) ? 3 : /mat2/.test(type) ? 2 : 1;
    const gl = (globalThis as unknown as { WebGL2RenderingContext?: { prototype: WebGL2RenderingContext } }).WebGL2RenderingContext?.prototype;
    if (gl) {
      const link = gl.linkProgram;
      gl.linkProgram = function (this: WebGL2RenderingContext, program: WebGLProgram) {
        link.call(this, program);
        const names: string[] = []; let attributes = 0;
        const count = this.getProgramParameter(program, this.ACTIVE_ATTRIBUTES) as number;
        for (let i = 0; i < count; i++) {
          const info = this.getActiveAttrib(program, i)!; if (info.name.startsWith('gl_')) continue;
          names.push(info.name);
          attributes += info.type === this.FLOAT_MAT4 ? 4 : info.type === this.FLOAT_MAT3 ? 3 : info.type === this.FLOAT_MAT2 ? 2 : 1;
        }
        const vertex = (this.getAttachedShaders(program) ?? []).find(s => this.getShaderParameter(s, this.SHADER_TYPE) === this.VERTEX_SHADER);
        const source = vertex ? this.getShaderSource(vertex) ?? '' : '';
        let varyings = 0; const outputs: string[] = [];
        for (const m of source.matchAll(/^\s*(?:(?:flat|smooth|centroid|highp|mediump|lowp)\s+)*out\s+(\w+)\s+(\w+)\s*(?:\[\s*(\d+)\s*\])?\s*;/gm)) { varyings += slots(m[1]) * Number(m[3] ?? 1); outputs.push(`${m[1]} ${m[2]}`); }
        w.__programs.push({ backend: 'webgl', label: names.join(','), attributes, varyings, buffers: 0, names, outputs });
      };
    }
    const device = (globalThis as unknown as { GPUDevice?: { prototype: Record<string, (d: never) => unknown> } }).GPUDevice?.prototype;
    if (device) {
      const code = new WeakMap<object, string>();
      const createModule = device.createShaderModule;
      device.createShaderModule = function (this: unknown, d: { code: string }) { const m = createModule.call(this, d as never) as object; code.set(m, d.code); return m; } as never;
      for (const name of ['createRenderPipeline', 'createRenderPipelineAsync']) {
        const original = device[name];
        device[name] = function (this: unknown, d: { label?: string; vertex: { module: object; buffers?: ({ attributes: unknown[] } | null)[] } }) {
          const wgsl = code.get(d.vertex.module) ?? '', buffers = d.vertex.buffers ?? [];
          // The vertex output struct is the one carrying @builtin(position).
          const output = [...wgsl.matchAll(/struct\s+\w+\s*\{([^}]*)\}/g)].map(m => m[1]).find(body => /@builtin\(\s*position\s*\)/.test(body)) ?? '';
          const outputs = [...output.matchAll(/@location\(\s*\d+\s*\)\s*(?:@interpolate\([^)]*\)\s*)?(\w+\s*:\s*[\w<>]+)/g)].map(m => m[1].replace(/\s+/g, ''));
          const varyings = [...output.matchAll(/@location\(\s*\d+\s*\)/g)].length;
          const names = [...wgsl.matchAll(/@location\(\s*\d+\s*\)\s*(\w+)\s*:/g)].map(m => m[1]).filter(n => !output.includes(`${n} :`) && !output.includes(`${n}:`));
          w.__programs.push({ backend: 'webgpu', label: d.label ?? '', attributes: buffers.reduce((n, b) => n + (b?.attributes.length ?? 0), 0), varyings, buffers: buffers.filter(Boolean).length, names, outputs });
          return original.call(this, d as never);
        } as never;
      }
    }
  });
  if (backend==='webgpu') {
    await page.goto('/');
    const adapter = await page.evaluate(async()=>Boolean(await (navigator as Navigator & {gpu?:{requestAdapter():Promise<unknown>}}).gpu?.requestAdapter()));
    test.skip(!adapter && process.platform!=='darwin','No headless WebGPU adapter');
  }
  await page.goto(`/?test=1&scenelab=1&renderer=${backend}&quality=high&audio=muted&profile=1`);
  await page.waitForFunction(()=>Boolean(window.__SCENE__));
  await page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
  for (const path of scenes) {
    await page.evaluate(async spec=>{await window.__SCENE__!.load(spec as SceneSpec);await window.__SCENE__!.step(30);await window.__SCENE__!.ready();await window.__SS__!.screenshotReady();},scene(path));
    expect((await page.evaluate(async()=>window.__SCENE__!.metrics())).backend).toBe(backend);
    // Matched before/after evidence for layout refactors: CROWD_CAPTURE_DIR=<dir> saves one frame per scene.
    if (process.env.CROWD_CAPTURE_DIR) { mkdirSync(process.env.CROWD_CAPTURE_DIR, { recursive: true }); await page.screenshot({ path: `${process.env.CROWD_CAPTURE_DIR}/${backend}-${path.replace(/[/.]/g, '_')}.png` }); }
    // Mask/id passes rebind static-attribute batches through implicit instancing: compile those programs too.
    await page.evaluate(async()=>{ const api=window.__SS__!; api.settings.set({idPass:true}); await api.screenshotReady(); api.settings.set({idPass:false}); await api.screenshotReady(); });
  }
  const programs = await page.evaluate(()=>(window as unknown as { __programs: Program[] }).__programs);
  const own = programs.filter(p => p.backend === backend), crowd = own.filter(p => p.names.includes('_parts'));
  const worst = (list: Program[], key: 'attributes' | 'varyings' | 'buffers') => list.reduce((a, p) => p[key] > a[key] ? p : a, list[0]);
  console.log(`[gpu-limits] ${backend}: ${own.length} programs, ${crowd.length} crowd; crowd max attributes ${worst(crowd, 'attributes').attributes}, varyings ${worst(crowd, 'varyings').varyings}, buffers ${worst(crowd, 'buffers').buffers}; all max attributes ${worst(own, 'attributes').attributes}, varyings ${worst(own, 'varyings').varyings}, buffers ${worst(own, 'buffers').buffers}`);
  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/crowd-gpu-limits-${backend}.json`, JSON.stringify([...new Map(own.map(p => [JSON.stringify([p.names, p.outputs, p.buffers]), p])).values()].sort((a, b) => b.varyings - a.varyings || b.attributes - a.attributes), null, 1));
  expect(own.length).toBeGreaterThan(0); expect(crowd.length).toBeGreaterThan(0);
  for (const p of own) {
    expect.soft(p.attributes, `${p.label} attributes`).toBeLessThanOrEqual(HARD.attributes);
    expect.soft(p.varyings, `${p.label} varyings`).toBeLessThanOrEqual(HARD.varyings);
    expect.soft(p.buffers, `${p.label} buffers`).toBeLessThanOrEqual(HARD.buffers);
  }
  for (const p of crowd) {
    expect.soft(p.attributes, `crowd ${p.label} attributes [${p.names.join(',')}]`).toBeLessThanOrEqual(CROWD.attributes);
    expect.soft(p.varyings, `crowd ${p.label} varyings`).toBeLessThanOrEqual(CROWD.varyings);
    expect.soft(p.buffers, `crowd ${p.label} buffers`).toBeLessThanOrEqual(CROWD.buffers);
  }
  // The scene snapshot's own estimate (also used by Scene Lab) must agree with the headroom target.
  const layouts = await page.evaluate(()=>{ const r = window.__SS__!.getState().render; return [...(r.crowd?.batches.map(b=>({id:b.id+':'+b.lod,...b.layout})) ?? []),...(r.npcs?.civilians.layouts ?? []).map(l=>({id:'civilian',...l!})),...r.accessories.map(b=>({id:'accessory',...b.layout}))]; });
  for (const l of layouts) { expect.soft(l.locations, `${l.id} layout locations`).toBeLessThanOrEqual(CROWD.attributes); expect.soft(l.buffers, `${l.id} layout buffers`).toBeLessThanOrEqual(CROWD.buffers); }
});
