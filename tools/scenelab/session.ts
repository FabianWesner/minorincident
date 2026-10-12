import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { attachErrorGuard } from '../../tests/e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** Scene Lab browser session: one headless Chromium page with the real game on a private Vite server.
 * Shared by the CLI runner (cli.ts) and the MCP server (mcp.ts). Never port 3300. */
export const port = Number(process.env.SCENE_PORT ?? 3341);
if (port === 3300) throw new Error('Scene Lab must not use the shared dev-server port 3300');
export const origin = `http://127.0.0.1:${port}`;
export type Backend = 'webgl2' | 'webgpu';
/** `query`: extra game URL parameters, e.g. { skin: '0' } for the rigid courier (A/B checks). */
export interface SessionOptions { backend?: Backend; tier?: 'high' | 'low'; viewport?: { width: number; height: number }; seed?: number; query?: Record<string, string>; /** E18 native timing: Chrome without the refresh-rate ceiling (still headless). */ nativeFrameTiming?: boolean; log?: (line: string) => void }

let server: ChildProcess | null = null;
const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
/** Reuse a running Scene Lab server, else start Vite (dev: current sources; SCENE_SERVER=preview serves dist/). */
async function ensureServer(log: (line: string) => void): Promise<void> {
  if (await up()) return;
  const preview = process.env.SCENE_SERVER === 'preview';
  log(`starting ${preview ? 'vite preview' : 'vite dev'} on ${origin}`);
  // Own the Vite process directly so stopServer does not leave an npx child serving a deleted remote job.
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore', detached: false });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  if (!(await up())) { server.kill(); server = null; throw new Error(`Scene Lab server did not start on ${port}`); }
}
export function stopServer(): void { server?.kill(); server = null; }

/** Read a spec file (JSON) or accept an object. Relative `extends` paths are merged shallowly. */
export function readSpec(path: string): SceneSpec {
  const spec = JSON.parse(readFileSync(path, 'utf8')) as SceneSpec & { extends?: string };
  if (spec.extends) { const base = readSpec(resolve(dirname(path), spec.extends)); delete spec.extends; return { ...base, ...spec }; }
  return spec;
}

export class SceneSession {
  page!: Page;
  private browser!: Browser;
  private sceneUrl = '';
  private guard!: ReturnType<typeof attachErrorGuard>;
  readonly options: Required<Omit<SessionOptions, 'log'>> & { log: (line: string) => void };
  constructor(options: SessionOptions = {}) {
    this.options = { backend: options.backend ?? 'webgl2', tier: options.tier ?? 'high', viewport: options.viewport ?? { width: 1280, height: 720 }, seed: options.seed ?? 1, query: options.query ?? {}, nativeFrameTiming: options.nativeFrameTiming ?? false, log: options.log ?? (line => console.error(`[scene] ${line}`)) };
  }
  get errors(): string[] { return this.guard?.errors ?? []; }
  async open(): Promise<void> {
    await ensureServer(this.options.log);
    const webgpu = this.options.backend === 'webgpu';
    // macOS: ANGLE/Metal gives real-GPU WebGL2 headless. WebGPU needs the unsafe flag and may still fall back.
    const args = webgpu ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
    if (this.options.nativeFrameTiming) args.push('--disable-frame-rate-limit', '--disable-gpu-vsync');
    this.browser = await chromium.launch({ headless: true, args, ...(this.options.nativeFrameTiming ? { channel: 'chrome' } : {}) });
    const context = await this.browser.newContext({ viewport: this.options.viewport, deviceScaleFactor: 1 });
    this.page = await context.newPage();
    this.guard = attachErrorGuard(this.page);
    const query = new URLSearchParams({ test: '1', scenelab: '1', profile: '1', dpr: '1', quality: this.options.tier, audio: 'muted', seed: String(this.options.seed) });
    if (!webgpu) query.set('renderer', 'webgl');
    for (const [key, value] of Object.entries(this.options.query)) query.set(key, value);
    this.sceneUrl = `${origin}/?${query}`;
    await this.page.goto(this.sceneUrl);
    await this.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 120_000 });
    await this.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    // Story/HUD overlays are not part of an isolated scene.
    await this.page.addStyleTag({ content: '#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:hidden!important}' });
  }
  /** Switch from isolation to a real registered mission; use Inspection for camera and time. */
  async inspectLevel(level: string, bot = false) {
    await this.page.goto(`${origin}/?test=1&debug=true&inspect=1&level=${encodeURIComponent(level)}&bot=${bot ? 'complete' : 'ghost'}&renderer=webgl&profile=1&audio=muted&quality=${this.options.tier}&seed=${this.options.seed}`);
    await this.page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
    await this.page.evaluate(async () => { await window.__SS__!.ready; });
    return this.page.evaluate(() => window.__SS__!.inspect.anchors());
  }
  async load(spec: SceneSpec) {
    if (!(await this.page.evaluate(() => !!window.__SCENE__))) {
      await this.page.goto(this.sceneUrl);
      await this.page.waitForFunction(() => !!window.__SCENE__, null, { timeout: 120_000 });
      await this.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    }
    return this.page.evaluate(s => window.__SCENE__!.load(s), spec);
  }
  async step(frames: number) { return this.page.evaluate(n => window.__SCENE__!.step(n), frames); }
  async ready() { await this.page.evaluate(() => window.__SCENE__ ? window.__SCENE__.ready() : window.__SS__!.screenshotReady()); }
  async metrics() { return this.page.evaluate(() => window.__SCENE__!.metrics()); }
  async clipping() { return this.page.evaluate(() => window.__SCENE__!.clipping()); }
  async describe() { return this.page.evaluate(() => window.__SCENE__!.describe()); }
  /** Full-viewport PNG after streaming settles. */
  async screenshot(path: string): Promise<Buffer> {
    await this.ready(); mkdirSync(dirname(path), { recursive: true });
    return this.page.screenshot({ path, type: 'png' });
  }
  /** Low-res JPEG of the current frame for a contact sheet (waits for streaming like a screenshot). */
  async snapshot(): Promise<Buffer> { await this.ready(); return this.page.screenshot({ type: 'jpeg', quality: 72 }); }
  /** One JPG grid of labelled cells ("f<frame>"), composed on a canvas in a scratch page; the file stays under maxKb. */
  async makeSheet(cells: { frame: number; jpeg: Buffer }[], path: string, cellWidth = 320, maxKb = 380): Promise<{ path: string; cells: number; kb: number }> {
    const scratch = await this.page.context().newPage();
    try {
      const data = cells.map(c => ({ frame: c.frame, src: `data:image/jpeg;base64,${c.jpeg.toString('base64')}` }));
      const b64 = await scratch.evaluate(async ({ data, cellWidth, maxKb }) => {
        const images = await Promise.all(data.map(d => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d.src; })));
        const aspect = images[0].height / images[0].width, h = Math.round(cellWidth * aspect), n = images.length;
        const cols = n <= 4 ? n : n <= 12 ? 4 : 6, rows = Math.ceil(n / cols), gap = 2;
        const c = document.createElement('canvas'); c.width = cols * cellWidth + (cols - 1) * gap; c.height = rows * h + (rows - 1) * gap;
        const g = c.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.font = 'bold 14px monospace'; g.textBaseline = 'top';
        images.forEach((img, i) => {
          const x = (i % cols) * (cellWidth + gap), y = Math.floor(i / cols) * (h + gap);
          g.drawImage(img, x, y, cellWidth, h);
          const label = `f${data[i].frame}`, w = g.measureText(label).width + 8;
          g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(x, y, w, 18); g.fillStyle = '#ffe14d'; g.fillText(label, x + 4, y + 2);
        });
        let q = 0.8, url = c.toDataURL('image/jpeg', q);
        while (url.length * 0.75 > maxKb * 1024 && q > 0.3) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
        return url.slice(url.indexOf(',') + 1);
      }, { data, cellWidth, maxKb });
      const buffer = Buffer.from(b64, 'base64'); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buffer);
      return { path, cells: cells.length, kb: Math.round(buffer.length / 1024) };
    } finally { await scratch.close(); }
  }
  async close(): Promise<void> { this.guard?.dispose(); await this.browser?.close(); }
}

/** Box-filtered thumbnail (PNG), for inline MCP images. */
export function thumbnail(png: Buffer, width = 360): Buffer {
  const src = PNG.sync.read(png), k = Math.max(1, Math.ceil(src.width / width)), w = Math.floor(src.width / k), h = Math.floor(src.height / k), out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let sum = 0; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) sum += src.data[((y * k + dy) * src.width + x * k + dx) * 4 + c];
    out.data[(y * w + x) * 4 + c] = sum / (k * k);
  }
  return PNG.sync.write(out);
}

/** WebM from JPEG frames via Playwright's bundled ffmpeg (same pipeline as tools/playeranim/game-capture.ts). */
export function encodeWebm(frames: Buffer[], path: string, fps = 20): void {
  const cache = `${homedir()}/Library/Caches/ms-playwright`;
  const ffmpeg = process.env.FFMPEG_BIN ?? (existsSync(cache) ? readdirSync(cache).filter(d => d.startsWith('ffmpeg-')).sort().map(d => `${cache}/${d}/ffmpeg-mac`).find(existsSync) : undefined) ?? 'ffmpeg';
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '900k', '-crf', '20', path], { input: Buffer.concat(frames), maxBuffer: 1024 * 1024 * 64 });
}
export const writeJson = (path: string, data: unknown) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(data, null, 2)); };

/** Turn spec expectations into pass/fail checks. */
export function evaluate(spec: SceneSpec, metrics: Awaited<ReturnType<SceneSession['metrics']>>, clipping: Awaited<ReturnType<SceneSession['clipping']>>, errors: string[]) {
  const e = spec.expect ?? {}, checks: { name: string; pass: boolean; value: number; limit: number }[] = [];
  const add = (name: string, value: number, limit: number | undefined) => { if (limit !== undefined) checks.push({ name, pass: value <= limit, value, limit }); };
  add('propPenetrationFramesMax', metrics.propPenetration.framesMax, e.propPenetrationFramesMax);
  add('consoleErrors', errors.length, e.consoleErrors ?? 0);
  add('clipping', clipping.static.length + clipping.actors.length + clipping.heldProps.length + (clipping.gunBodies?.length ?? 0), e.clippingMax);
  add('heldPropIntersections', clipping.heldProps.length, e.heldPropIntersectionsMax);
  if (e.heldPropSamplesMin !== undefined) checks.push({ name: 'heldPropSamples', pass: metrics.heldProps.samples >= e.heldPropSamplesMin, value: metrics.heldProps.samples, limit: e.heldPropSamplesMin });
  add('staticOverlap', clipping.static.length, e.staticOverlapMax);
  const motion = Object.values(metrics.actors).map(a => a.motion);
  add('footSlideMaxCm', Math.max(0, ...motion.map(m => m.slideMaxCm)), e.footSlideMaxCm);
  add('footSinkMaxCm', Math.max(0, ...motion.map(m => m.sinkMaxCm)), e.footSinkMaxCm);
  add('footJitterRunMax', Math.max(0, ...Object.values(metrics.actors).filter(a => a.kind === 'courier').map(a => a.motion.jitterRunMax)), e.footJitterRunMax);
  add('bodyOverlapMaxCm', Math.max(0, ...(metrics.bodies ?? []).map(b => b.depthCm)), e.bodyOverlapMaxCm);
  add('corgiCourierOverlapMaxCm', metrics.companion?.samples ? metrics.companion.overlapMaxCm : Infinity, e.corgiCourierOverlapMaxCm);
  add('corgiRunLagMaxM', metrics.companion?.runningSamples ? metrics.companion.runLagMaxM : Infinity, e.corgiRunLagMaxM);
  add('undrawnFramesMax', Math.max(0, ...Object.values(metrics.actors).map(a => a.missedInViewFrames)), e.undrawnFramesMax);
  add('yawDriftMaxDeg', Math.max(0, ...motion.map(m => m.yawDriftMaxDeg)), e.yawDriftMaxDeg);
  add('torsoPitchMaxDeg', Math.max(0, ...motion.map(m => Math.max(Math.abs(m.torsoPitchMaxDeg ?? 0), Math.abs(m.torsoPitchMinDeg ?? 0)))), e.torsoPitchMaxDeg);
  add('clickMissMax', metrics.clicks.misses, e.clickMissMax);
  add('drawCallsMax', metrics.perf.drawCalls.max ?? 0, e.drawCallsMax);
  add('trianglesMax', metrics.perf.triangles.max ?? 0, e.trianglesMax);
  const actors = Object.values(metrics.actors);
  add('emergeOutsideMax', actors.filter(a => a.emerge && (a.firstDrawn?.outM ?? 1) > .05).length, e.emergeOutsideMax);
  add('farLodCloseMax', Math.max(0, ...actors.map(a => a.farLodCloseFrames)), e.farLodCloseMax);
  add('actorHitsMax', clipping.actors.length, e.actorHitsMax);
  add('doorClosedFramesMax', Math.max(0, ...Object.values(metrics.doors ?? {}).map(d => d.closedFrames)), e.doorClosedFramesMax);
  add('propSinkMaxCm', metrics.props.sinkMaxCm, e.propSinkMaxCm);
  const pursuit = Object.values(metrics.pursuit?.actors ?? {});
  add('stuckActorFramesMax', Math.max(0, ...pursuit.map(p => p.stuckRunMax)), e.stuckActorFramesMax);
  add('lostTargetNearFramesMax', Math.max(0, ...pursuit.map(p => p.lostNearFrames)), e.lostTargetNearFramesMax);
  add('overshootMaxM', Math.max(0, ...pursuit.map(p => p.overshootMaxM)), e.overshootMaxM);
  if (e.courierSwingsMin !== undefined) checks.push({ name: 'courierSwingsMin', pass: (metrics.pursuit?.courierSwings ?? 0) >= e.courierSwingsMin, value: metrics.pursuit?.courierSwings ?? 0, limit: e.courierSwingsMin });
  if (e.courierAttacksMin !== undefined) checks.push({ name: 'courierAttacksMin', pass: (metrics.pursuit?.courierAttacks ?? 0) >= e.courierAttacksMin, value: metrics.pursuit?.courierAttacks ?? 0, limit: e.courierAttacksMin });
  if (e.firstBiteFrameMax !== undefined) { const f = metrics.pursuit?.firstBiteFrame ?? -1; checks.push({ name: 'firstBiteFrameMax', pass: f >= 0 && f <= e.firstBiteFrameMax, value: f, limit: e.firstBiteFrameMax }); }
  if (e.propGroundSamplesMin !== undefined) checks.push({ name: 'propGroundSamplesMin', pass: metrics.props.samples >= e.propGroundSamplesMin, value: metrics.props.samples, limit: e.propGroundSamplesMin });
  const wheels = Object.values(metrics.wheels ?? {}).flat();
  add('vehicleYawRateMaxDegS', Math.max(0, ...Object.values(metrics.vehicles).map(v => v?.yawRateMaxDegS ?? 0)), e.vehicleYawRateMaxDegS);
  add('vehicleRideRemainingMaxM', Math.max(0, ...Object.values(metrics.vehicles).map(v => v?.rideRemainingM ?? 0)), e.vehicleRideRemainingMaxM);
  add('vehicleBodyOverlapsMax', Math.max(0, ...Object.values(metrics.vehicles).map(v => v?.bodyOverlaps ?? 0)), e.vehicleBodyOverlapsMax);
  add('wheelSinkMaxCm', Math.max(0, ...wheels.map(w => -w.gapMinCm)), e.wheelSinkMaxCm);
  add('wheelFloatMaxCm', Math.max(0, ...wheels.map(w => w.gapMaxCm)), e.wheelFloatMaxCm);
  add('bikeUndrawnFramesMax', (metrics.bike?.missedFrames ?? 0) + (metrics.bike?.offFrames ?? 0), e.bikeUndrawnFramesMax);
  add('wheelSpikeMaxCm', Math.max(0, ...wheels.map(w => w.hubSpikeCm)), e.wheelSpikeMaxCm);
  return { pass: checks.every(c => c.pass), checks };
}
