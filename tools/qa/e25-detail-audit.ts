/** E25 ground beam/shadow, material, reflected silhouette and eye-pixel measurements. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const out = 'test-results/epics/E25/details-high'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend: 'webgl2', tier: 'high' }), result: Record<string, unknown> = {};
const lin = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
function rgb(p: PNG, x: number, y: number) { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return [...p.data.subarray(i, i + 3)]; }
function lum(c: number[]) { return .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]); }
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
async function shot(name: string) {
  await s.ready();
  const data = await s.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.view.renderer.nextNodeFrame(); const frame = (game.view.renderer as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame; frame.time = frame.deltaTime = 0;
    game.view.update(1); return game.view.renderer.domElement.toDataURL('image/png').split(',')[1];
  });
  const bytes = Buffer.from(data, 'base64'); writeFileSync(`${out}/${name}.png`, bytes); return PNG.sync.read(bytes);
}
const project = (points: number[][]) => s.page.evaluate(points => points.map(p => window.__SCENE__!.project(p as [number, number, number])), points);
const trailer: SceneSpec = { name: 'light-lab', ground: 'asphalt', size: 60, time: 'night', dof: false, props: [{ asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' }, { asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }], actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [24, 32, 36], target: [0, 0, 0] } };
try {
  await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
  await s.load(trailer); await s.step(120); const lit = await shot('shadow-beams');
  const points: number[][] = []; for (let x = 1; x <= 4; x += .2) for (let z = -.25; z <= .25; z += .125) points.push([x, .05, z]);
  const q = await project(points), colors = q.map(p => rgb(lit, p.x, p.y)), meanRgb = [0, 1, 2].map(c => avg(colors.map(p => p[c])));
  const [r, g, b] = meanRgb, hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo;
  const hue = ((hi === r ? (g - b) / d : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
  result.shadow = { meanRgb, hue, meanLuminance: avg(colors.map(lum)), samples: q.length };
  await s.page.evaluate(() => window.__SCENE__!.hideProbe(true, false)); const noBody = await shot('shadow-without-body');
  const qualifying = q.map((p, i) => ({ rgb: colors[i], darkness: 1 - lum(colors[i]) / lum(rgb(noBody, p.x, p.y)) })).filter(p => p.darkness >= .35);
  const shadowRgb = [0, 1, 2].map(c => avg(qualifying.map(p => p.rgb[c]))), high = Math.max(...shadowRgb), low = Math.min(...shadowRgb), span = high - low;
  const shadowHue = ((high === shadowRgb[0] ? (shadowRgb[1] - shadowRgb[2]) / span : high === shadowRgb[1] ? (shadowRgb[2] - shadowRgb[0]) / span + 2 : (shadowRgb[0] - shadowRgb[1]) / span + 4) * 60 + 360) % 360;
  result.shadowMask = { reference: 'same frame without the caster', threshold: .35, samples: qualifying.length, rgb: shadowRgb, hue: shadowHue, meanDarkness: avg(qualifying.map(p => p.darkness)) };
  await s.page.evaluate(() => window.__SCENE__!.hideProbe(false, false));
  const bandLines = await s.page.evaluate(() => {
    const light = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting;
    return (light.field as unknown as { statics: { x: number; z: number; y: number; aimX: number; aimZ: number }[] }).statics.map(f => [window.__SCENE__!.project([f.x + f.aimX, .02, f.z + f.aimZ]), window.__SCENE__!.project([f.x + f.aimX * (1 - .8 / f.y), .8, f.z + f.aimZ * (1 - .8 / f.y)])]);
  });
  await s.page.evaluate(() => { const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting; (l.practicalEffects as unknown as { beams: { visible: boolean } }).beams.visible = false; });
  const noBeams = await shot('no-beams');
  result.beams = bandLines.map(([a, b]) => {
    const length = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y))), samples = Array.from({ length: length + 1 }, (_, i) => {
      const x = a.x + (b.x - a.x) * i / length, y = a.y + (b.y - a.y) * i / length;
      const on = lum(rgb(lit, x, y)), off = lum(rgb(noBeams, x, y)); return { on, off, contribution: on - off };
    });
    return { pixels: length, samples, maxBeamGradient: Math.max(...samples.slice(1).map((v, i) => Math.abs(v.contribution - samples[i].contribution) / Math.max(.001, v.on, samples[i].on))), maxBeautyGradient: Math.max(...samples.slice(1).map((v, i) => Math.abs(v.on - samples[i].on) / Math.max(.001, v.on, samples[i].on))) };
  });
  await s.page.evaluate(() => { const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting; (l.practicalEffects as unknown as { beams: { visible: boolean } }).beams.visible = true; });
  // Test-only tone alternatives; restore the shipping NoToneMapping value afterwards.
  const tones = [];
  for (const [name, mode] of [['shipping', 0], ['aces', 4], ['agx', 6]] as const) {
    await s.page.evaluate(mode => { const g = (window.__SCENE__ as unknown as { game: Game }).game; g.view.renderer.toneMapping = mode; }, mode);
    const image = await shot(`tone-${name}`); const values = [];
    for (let y = 0; y < image.height; y += 4) for (let x = 0; x < image.width; x += 4) values.push(lum(rgb(image, x, y)));
    tones.push({ name, mode, meanLuminance: avg(values), perf: await s.page.evaluate(() => window.__SS__!.perf()) });
  }
  result.tones = tones; await s.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.view.renderer.toneMapping = 0; });
  const reflection: SceneSpec = { name: 'reflection-lab', ground: 'asphalt', size: 50, time: 'night', weather: 'rain', weatherWarmup: 120, dof: false, props: [{ id: 'neon', asset: 'prop.jukebox', at: [-3, 0] }, { id: 'lamp', asset: 'prop.street-lamp', at: [3, 0] }, { id: 'car', asset: 'veh.sedan-green', at: [0, -4] }], actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] } };
  await s.load(reflection); await s.step(120);
  await s.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.view.scene.traverse(n => { n.castShadow = false; }); });
  const car = await shot('reflection-car-no-shadow');
  // Render the same production car geometry mirrored about the street as the expected reflection ID mask.
  const mirrored = await s.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game, view = game.view;
    const light = (view as unknown as { lighting: Lighting }).lighting, oldColor = light.color.value.clone(); light.color.value.setRGB(1, 0, 1);
    const hidden: import('three').Object3D[] = [], positions: { a: import('three').BufferAttribute | import('three').InterleavedBufferAttribute; y: number[] }[] = [];
    const saved = new Map<import('../../src/render/PaletteMaterial').PaletteMaterial, { output: import('../../src/render/PaletteMaterial').PaletteMaterial['outputNode']; side: import('three').Side }>();
    let meshes = 0;
    view.scene.traverse(n => {
      const mesh = n as import('three').InstancedMesh; if (!mesh.geometry || !n.visible) return;
      let car = false; for (let at: import('three').Object3D | null = n; at; at = at.parent) if (at.name.startsWith('inst:veh.sedan-green')) car = true;
      if (!car) { n.visible = false; hidden.push(n); return; }
      meshes++;
      const a = mesh.geometry.getAttribute('position'), y = Array.from({ length: a.count }, (_, i) => a.getY(i)); positions.push({ a, y });
      const instance = mesh.matrix.clone(); mesh.getMatrixAt(0, instance); const offset = instance.elements[13] + mesh.matrixWorld.elements[13];
      for (let i = 0; i < a.count; i++) a.setY(i, -y[i] - 2 * offset); a.needsUpdate = true;
      for (const source of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as import('../../src/render/PaletteMaterial').PaletteMaterial[]) if (!saved.has(source)) {
        saved.set(source, { output: source.outputNode, side: source.side }); source.outputNode = source.probeMaskOutput(light.color.rgb); source.side = 2; source.needsUpdate = true;
      }
    });
    const background = view.scene.background, backgroundNode = view.scene.backgroundNode; view.scene.background = null; view.scene.backgroundNode = null;
    view.renderer.nextNodeFrame(); view.renderer.render(view.scene, view.camera); const data = view.renderer.domElement.toDataURL('image/png').split(',')[1];
    for (const { a, y } of positions) { for (let i = 0; i < a.count; i++) a.setY(i, y[i]); a.needsUpdate = true; }
    view.renderer.nextNodeFrame(); view.renderer.render(view.scene, view.camera); const bodyData = view.renderer.domElement.toDataURL('image/png').split(',')[1];
    for (const [source, before] of saved) { source.outputNode = before.output; source.side = before.side; source.needsUpdate = true; }
    for (const n of hidden) n.visible = true; light.color.value.copy(oldColor); view.scene.background = background; view.scene.backgroundNode = backgroundNode;
    return { data, bodyData, meshes };
  });
  const maskBytes = Buffer.from(mirrored.data, 'base64'); writeFileSync(`${out}/reflected-car-id.png`, maskBytes); const mask = PNG.sync.read(maskBytes), bodyBytes = Buffer.from(mirrored.bodyData, 'base64'), bodyMask = PNG.sync.read(bodyBytes); writeFileSync(`${out}/physical-car-id.png`, bodyBytes);
  await s.load({ ...reflection, props: reflection.props!.filter(p => p.id !== 'car') }); await s.step(120);
  await s.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.view.scene.traverse(n => { n.castShadow = false; }); });
  const absent = await shot('reflection-without-car-no-shadow'); let maskPixels = 0, changed = 0, anyChange = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 200 && mask.data[i + 1] < 50 && mask.data[i + 2] > 200 && !(bodyMask.data[i] > 200 && bodyMask.data[i + 1] < 50 && bodyMask.data[i + 2] > 200)) { maskPixels++; const delta = Math.max(...[0, 1, 2].map(c => Math.abs(car.data[i + c] - absent.data[i + c]))); if (delta > 0) anyChange++; if (delta > 2) changed++; }
  result.ssr = { meshes: mirrored.meshes, maskPixels, changed, anyChange, overlap: changed / maskPixels, overlapAtAnyChange: anyChange / maskPixels, shadowsExcluded: true };
  const materialRows = [];
  for (const azimuth of [45, 60]) {
    await s.load({ name: 'materials', ground: 'asphalt', size: 30, time: 'golden', dof: false, props: [{ asset: 'veh.sedan-green', at: [0, 0] }], camera: { mode: 'orbit', radius: 12, polar: 54, azimuth, target: [0, .7, 0] } }); await s.step(12);
    const original = await shot(`material-${azimuth}`);
    const attributes = await s.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      type Attribute = import('three').BufferAttribute | import('three').InterleavedBufferAttribute;
      const batches = new Map<ArrayLike<number>, { a: Attribute; indices: Set<number> }>();
      game.view.scene.traverse(n => {
        let car = false;
        for (let parent: import('three').Object3D | null = n; parent; parent = parent.parent) { if (!parent.visible) return; if (parent.name.startsWith('inst:veh.sedan-green')) car = true; }
        if (!car) return;
        const geometry = (n as import('three').Mesh).geometry, a = geometry?.getAttribute('_surface'); if (!a) return;
        const array = 'data' in a ? a.data.array : a.array;
        let batch = batches.get(array); if (!batch) { batch = { a, indices: new Set() }; batches.set(array, batch); }
        // Prop batches share a large vertex arena. Touch only this car's draw indices.
        const index = geometry.getIndex(), start = geometry.drawRange.start, end = Math.min(start + geometry.drawRange.count, index?.count ?? a.count);
        for (let i = start; i < end; i++) batch.indices.add(index ? index.getX(i) : i);
      });
      const values = [...batches.values()].map(({ a, indices }) => ({ a, indices: [...indices], values: [...indices].map(i => a.getX(i)) }));
      for (const { a, indices } of values) { for (const i of indices) a.setX(i, 0); a.needsUpdate = true; }
      (window as unknown as { e25Surfaces: typeof values }).e25Surfaces = values; return values.map(v => v.indices.length);
    });
    const matte = await shot(`material-${azimuth}-matte`); let weight = 0, xSum = 0, ySum = 0, changed = 0;
    for (let y = 0; y < original.height; y++) for (let x = 0; x < original.width; x++) { const delta = lum(rgb(original, x, y)) - lum(rgb(matte, x, y)); if (delta > .01) { weight += delta; xSum += x * delta; ySum += y * delta; changed++; } }
    materialRows.push({ azimuth, vertices: attributes.reduce((a, b) => a + b, 0), changedPixels: changed, highlightCentroid: [xSum / weight, ySum / weight] });
    await s.page.evaluate(() => { const values = (window as unknown as { e25Surfaces: { a: import('three').BufferAttribute | import('three').InterleavedBufferAttribute; indices: number[]; values: number[] }[] }).e25Surfaces; for (const { a, indices } of values) { for (const i of indices) a.setX(i, 2); a.needsUpdate = true; } });
    await shot(`material-${azimuth}-metal`);
    await s.page.evaluate(() => { for (const { a, indices, values } of (window as unknown as { e25Surfaces: { a: import('three').BufferAttribute | import('three').InterleavedBufferAttribute; indices: number[]; values: number[] }[] }).e25Surfaces) { for (let i = 0; i < indices.length; i++) a.setX(indices[i], values[i]); a.needsUpdate = true; } });
  }
  result.materials = materialRows;
  const eyes: SceneSpec = { name: 'night-eyes', ground: 'asphalt', size: 30, time: 'night', dof: false, actors: [{ id: 'courier', kind: 'courier', at: [-10, -10] }, ...['runner', 'riot', 'firefighter', 'hazmat'].map((kind, i) => ({ id: kind, kind: 'infected' as const, archetype: `infected.${kind}`, at: [i * 3 - 4.5, 0] as [number, number], yaw: -45, state: 'idle' as const }))], camera: { mode: 'pose', position: [12, 18, 22], target: [0, .7, 0] } };
  await s.load(eyes); await s.step(1); const beauty = await shot('night-eyes');
  await s.page.evaluate(() => window.__SCENE__!.crowdMaskProbe(true)); const eyeMask = await shot('night-eyes-id');
  const visited = new Uint8Array(eyeMask.width * eyeMask.height), components: { pixels: number; brightest: number; brightestEye: number; eyePixels: number }[] = [];
  for (let y = 0; y < eyeMask.height; y++) for (let x = 0; x < eyeMask.width; x++) {
    const at = y * eyeMask.width + x, c = rgb(eyeMask, x, y); if (visited[at] || c[0] < 200 || c[1] > 50 || c[2] < 200) continue;
    const queue = [at]; visited[at] = 1; let brightest = 0, brightestEye = 0, eyePixels = 0;
    for (let k = 0; k < queue.length; k++) { const p = queue[k], px = p % eyeMask.width, py = Math.floor(p / eyeMask.width), b = rgb(beauty, px, py), l = lum(b); brightest = Math.max(brightest, l); if (b[0] > b[1] * 1.5 && b[0] > b[2] * 1.3 && b[0] > 80) { brightestEye = Math.max(brightestEye, l); eyePixels++; }
      for (const n of [p - 1, p + 1, p - eyeMask.width, p + eyeMask.width]) { if (n < 0 || n >= visited.length || visited[n]) continue; const c = rgb(eyeMask, n % eyeMask.width, Math.floor(n / eyeMask.width)); if (c[0] > 200 && c[1] < 50 && c[2] > 200) { visited[n] = 1; queue.push(n); } }
    }
    if (queue.length > 100) components.push({ pixels: queue.length, brightest, brightestEye, eyePixels });
  }
  result.eyes = components; result.errors = s.errors;
} finally { writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2) + '\n'); await s.close(); stopServer(); }
console.log(`${out}/measurements.json`);
