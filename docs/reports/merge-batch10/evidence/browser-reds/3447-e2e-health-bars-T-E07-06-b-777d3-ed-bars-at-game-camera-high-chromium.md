# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/health-bars.spec.ts >> T-E07-06-bars-1600 @E07-AC06 @E07-AC19 @E30-AC15 shared bars at game camera high
- Location: tests/e2e/health-bars.spec.ts:11:3

# Error details

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
```

# Test source

```ts
  1   | import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
  2   | import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
  3   | import { homedir } from 'node:os';
  4   | import { dirname, resolve } from 'node:path';
  5   | import { chromium, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
  6   | import { PNG } from 'pngjs';
  7   | import { attachErrorGuard } from '../../tests/e2e/fixtures';
  8   | import type { SceneSpec } from '../../src/debug/scenelab/spec';
  9   | 
  10  | /** Scene Lab browser session: one headless Chromium page with the real game on a private Vite server.
  11  |  * Shared by the CLI runner (cli.ts) and the MCP server (mcp.ts). Never port 3300. */
  12  | export const port = Number(process.env.SCENE_PORT ?? 3341);
  13  | if (port === 3300) throw new Error('Scene Lab must not use the shared dev-server port 3300');
  14  | export const origin = `http://127.0.0.1:${port}`;
  15  | export type Backend = 'webgl2' | 'webgpu';
  16  | /** `query`: extra game URL parameters, e.g. { skin: '0' } for the rigid courier (A/B checks). */
  17  | export interface SessionOptions { /** Pixel 7 touch emulation for phone timing. */ phone?: boolean; backend?: Backend; tier?: 'high' | 'low'; viewport?: { width: number; height: number }; seed?: number; query?: Record<string, string>; /** E18 native timing: Chrome without the refresh-rate ceiling (still headless). */ nativeFrameTiming?: boolean; log?: (line: string) => void }
  18  | 
  19  | let server: ChildProcess | null = null;
  20  | const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
  21  | /** Reuse a running Scene Lab server, else start Vite (dev: current sources; SCENE_SERVER=preview serves dist/). */
  22  | async function ensureServer(log: (line: string) => void): Promise<void> {
  23  |   if (await up()) return;
  24  |   const preview = process.env.SCENE_SERVER === 'preview';
  25  |   log(`starting ${preview ? 'vite preview' : 'vite dev'} on ${origin}`);
  26  |   // Own the Vite process directly so stopServer does not leave an npx child serving a deleted remote job.
  27  |   server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), ...(preview ? ['preview', ...(process.env.SCENE_DIST ? ['--outDir', process.env.SCENE_DIST] : [])] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore', detached: false });
  28  |   for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  29  |   if (!(await up())) { server.kill(); server = null; throw new Error(`Scene Lab server did not start on ${port}`); }
  30  | }
  31  | export function stopServer(): void { server?.kill(); server = null; }
  32  | 
  33  | /** Read a spec file (JSON) or accept an object. Relative `extends` paths are merged shallowly. */
  34  | export function readSpec(path: string): SceneSpec {
  35  |   const spec = JSON.parse(readFileSync(path, 'utf8')) as SceneSpec & { extends?: string };
  36  |   if (spec.extends) { const base = readSpec(resolve(dirname(path), spec.extends)); delete spec.extends; return { ...base, ...spec }; }
  37  |   return spec;
  38  | }
  39  | 
  40  | export class SceneSession {
  41  |   page!: Page;
  42  |   private browser!: Browser;
  43  |   private context?: BrowserContext;
  44  |   private ownsBrowser = false;
  45  |   private sceneUrl = '';
  46  |   private guard!: ReturnType<typeof attachErrorGuard>;
  47  |   readonly options: Required<Omit<SessionOptions, 'log'>> & { log: (line: string) => void };
  48  |   constructor(options: SessionOptions = {}) {
  49  |     this.options = { phone: options.phone ?? false, backend: options.backend ?? 'webgl2', tier: options.tier ?? 'high', viewport: options.viewport ?? { width: 1280, height: 720 }, seed: options.seed ?? 1, query: options.query ?? {}, nativeFrameTiming: options.nativeFrameTiming ?? false, log: options.log ?? (line => console.error(`[scene] ${line}`)) };
  50  |   }
  51  |   get errors(): string[] { return this.guard?.errors ?? []; }
  52  |   /** A supplied browser is borrowed: close() releases only this session's isolated context. */
  53  |   async open(browser?: Browser): Promise<void> {
  54  |     await ensureServer(this.options.log);
  55  |     const webgpu = this.options.backend === 'webgpu';
  56  |     // macOS: ANGLE/Metal gives real-GPU WebGL2 headless. WebGPU needs the unsafe flag and may still fall back.
  57  |     const args = webgpu ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  58  |     // Native frame-budget probes measure uncapped cadence, as the E18 browser specs do.
  59  |     if (process.env.SCENE_UNCAPPED === '1' || this.options.nativeFrameTiming) args.push('--disable-frame-rate-limit', '--disable-gpu-vsync');
  60  |     this.ownsBrowser = !browser;
  61  |     this.browser = browser ?? await chromium.launch({ headless: true, args, ...(this.options.nativeFrameTiming ? { channel: 'chrome' } : {}) });
  62  |     const context = await this.browser.newContext({ ...(this.options.phone ? devices['Pixel 7'] : {}), viewport: this.options.viewport, deviceScaleFactor: 1 });
  63  |     this.context = context;
  64  |     this.page = await context.newPage();
  65  |     this.guard = attachErrorGuard(this.page);
  66  |     const query = new URLSearchParams({ test: '1', scenelab: '1', profile: '1', dpr: '1', quality: this.options.tier, audio: 'muted', seed: String(this.options.seed) });
  67  |     if (!webgpu) query.set('renderer', 'webgl');
  68  |     for (const [key, value] of Object.entries(this.options.query)) query.set(key, value);
  69  |     this.sceneUrl = `${origin}/?${query}`;
  70  |     await this.page.goto(this.sceneUrl);
  71  |     await this.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 120_000 });
  72  |     await this.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  73  |     // Story/HUD overlays are not part of an isolated scene.
  74  |     await this.page.addStyleTag({ content: '#hud:not([data-scene-hud]),.hud:not([data-scene-hud]),.story-bubble,html:not([data-scene-hud]) .mission-subtitle,[data-testid=mission-button]{visibility:hidden!important}' });
  75  |   }
  76  |   /** Switch from isolation to a real registered mission; use Inspection for camera and time. */
  77  |   async inspectLevel(level: string, bot = false) {
  78  |     await this.page.goto(`${origin}/?test=1&debug=true&inspect=1&level=${encodeURIComponent(level)}&bot=${bot ? 'complete' : 'ghost'}&renderer=webgl&profile=1&audio=muted&quality=${this.options.tier}&seed=${this.options.seed}`);
  79  |     await this.page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  80  |     await this.page.evaluate(async () => { await window.__SS__!.ready; });
  81  |     return this.page.evaluate(() => window.__SS__!.inspect.anchors());
  82  |   }
  83  |   async load(spec: SceneSpec) {
  84  |     if (!(await this.page.evaluate(() => !!window.__SCENE__))) {
  85  |       await this.page.goto(this.sceneUrl);
  86  |       await this.page.waitForFunction(() => !!window.__SCENE__, null, { timeout: 120_000 });
  87  |       await this.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  88  |     }
  89  |     await this.page.evaluate(({ hud, tier }) => {
  90  |       document.documentElement.toggleAttribute('data-scene-hud', hud);
  91  |       // Full UI applies persisted settings at level load; pin the requested QA tier there too.
  92  |       window.__SS__!.settings.set({ quality: tier });
  93  |     }, { hud: !!spec.hud, tier: this.options.tier });
> 94  |     const scene = await this.page.evaluate(s => window.__SCENE__!.load(s), spec);
      |                                   ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
  95  |     const actual = await this.page.evaluate(() => window.__SS__!.getState().render.quality);
  96  |     if (actual !== this.options.tier) throw new Error(`Scene quality ${actual}, requested ${this.options.tier}`);
  97  |     return scene;
  98  |   }
  99  |   async step(frames: number) { return this.page.evaluate(n => window.__SCENE__!.step(n), frames); }
  100 |   async ready() { await this.page.evaluate(() => window.__SCENE__ ? window.__SCENE__.ready() : window.__SS__!.screenshotReady()); }
  101 |   async metrics() { return this.page.evaluate(() => window.__SCENE__!.metrics()); }
  102 |   async clipping() { return this.page.evaluate(() => window.__SCENE__!.clipping()); }
  103 |   async describe() { return this.page.evaluate(() => window.__SCENE__!.describe()); }
  104 |   /** Full-viewport PNG after streaming settles. */
  105 |   async screenshot(path: string): Promise<Buffer> {
  106 |     await this.ready(); mkdirSync(dirname(path), { recursive: true });
  107 |     return this.page.screenshot({ path, type: 'png' });
  108 |   }
  109 |   /** Low-res JPEG of the current frame for a contact sheet (waits for streaming like a screenshot). */
  110 |   async snapshot(): Promise<Buffer> { await this.ready(); return this.page.screenshot({ type: 'jpeg', quality: 72 }); }
  111 |   /** One JPG grid of labelled cells ("f<frame>"), composed on a canvas in a scratch page; the file stays under maxKb. */
  112 |   async makeSheet(cells: { frame: number; jpeg: Buffer }[], path: string, cellWidth = 320, maxKb = 380): Promise<{ path: string; cells: number; kb: number }> {
  113 |     const scratch = await this.page.context().newPage();
  114 |     try {
  115 |       const data = cells.map(c => ({ frame: c.frame, src: `data:image/jpeg;base64,${c.jpeg.toString('base64')}` }));
  116 |       const b64 = await scratch.evaluate(async ({ data, cellWidth, maxKb }) => {
  117 |         const images = await Promise.all(data.map(d => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d.src; })));
  118 |         const aspect = images[0].height / images[0].width, h = Math.round(cellWidth * aspect), n = images.length;
  119 |         const cols = n <= 4 ? n : n <= 12 ? 4 : 6, rows = Math.ceil(n / cols), gap = 2;
  120 |         const c = document.createElement('canvas'); c.width = cols * cellWidth + (cols - 1) * gap; c.height = rows * h + (rows - 1) * gap;
  121 |         const g = c.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.font = 'bold 14px monospace'; g.textBaseline = 'top';
  122 |         images.forEach((img, i) => {
  123 |           const x = (i % cols) * (cellWidth + gap), y = Math.floor(i / cols) * (h + gap);
  124 |           g.drawImage(img, x, y, cellWidth, h);
  125 |           const label = `f${data[i].frame}`, w = g.measureText(label).width + 8;
  126 |           g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(x, y, w, 18); g.fillStyle = '#ffe14d'; g.fillText(label, x + 4, y + 2);
  127 |         });
  128 |         let q = 0.8, url = c.toDataURL('image/jpeg', q);
  129 |         while (url.length * 0.75 > maxKb * 1024 && q > 0.3) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
  130 |         return url.slice(url.indexOf(',') + 1);
  131 |       }, { data, cellWidth, maxKb });
  132 |       const buffer = Buffer.from(b64, 'base64'); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buffer);
  133 |       return { path, cells: cells.length, kb: Math.round(buffer.length / 1024) };
  134 |     } finally { await scratch.close(); }
  135 |   }
  136 |   async close(): Promise<void> {
  137 |     this.guard?.dispose();
  138 |     if (this.ownsBrowser) await this.browser?.close();
  139 |     else await this.context?.close();
  140 |     this.context = undefined;
  141 |   }
  142 | }
  143 | 
  144 | /** Box-filtered thumbnail (PNG), for inline MCP images. */
  145 | export function thumbnail(png: Buffer, width = 360): Buffer {
  146 |   const src = PNG.sync.read(png), k = Math.max(1, Math.ceil(src.width / width)), w = Math.floor(src.width / k), h = Math.floor(src.height / k), out = new PNG({ width: w, height: h });
  147 |   for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
  148 |     let sum = 0; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) sum += src.data[((y * k + dy) * src.width + x * k + dx) * 4 + c];
  149 |     out.data[(y * w + x) * 4 + c] = sum / (k * k);
  150 |   }
  151 |   return PNG.sync.write(out);
  152 | }
  153 | 
  154 | /** WebM from JPEG frames via Playwright's bundled ffmpeg (same pipeline as tools/playeranim/game-capture.ts). */
  155 | export function encodeWebm(frames: Buffer[], path: string, fps = 20): void {
  156 |   const cache = `${homedir()}/Library/Caches/ms-playwright`;
  157 |   const ffmpeg = process.env.FFMPEG_BIN ?? (existsSync(cache) ? readdirSync(cache).filter(d => d.startsWith('ffmpeg-')).sort().map(d => `${cache}/${d}/ffmpeg-mac`).find(existsSync) : undefined) ?? 'ffmpeg';
  158 |   execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '900k', '-crf', '20', path], { input: Buffer.concat(frames), maxBuffer: 1024 * 1024 * 64 });
  159 | }
  160 | export const writeJson = (path: string, data: unknown) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(data, null, 2)); };
  161 | 
  162 | /** Turn spec expectations into pass/fail checks. */
  163 | export function evaluate(spec: SceneSpec, metrics: Awaited<ReturnType<SceneSession['metrics']>>, clipping: Awaited<ReturnType<SceneSession['clipping']>>, errors: string[]) {
  164 |   const e = spec.expect ?? {}, checks: { name: string; pass: boolean; value: number; limit: number }[] = [];
  165 |   const add = (name: string, value: number, limit: number | undefined) => { if (limit !== undefined) checks.push({ name, pass: value <= limit, value, limit }); };
  166 |   for (const [name, range] of Object.entries(e.cure ?? {})) {
  167 |     const value = metrics.cure?.[name as keyof NonNullable<typeof metrics.cure>];
  168 |     const numeric = typeof value === 'number' ? value : NaN;
  169 |     checks.push({ name: `cure.${name}.min`, pass: numeric >= range[0], value: numeric, limit: range[0] }, { name: `cure.${name}.max`, pass: numeric <= range[1], value: numeric, limit: range[1] });
  170 |   }
  171 |   for (const [field, ranges] of [['health', e.actorHealth], ['travelM', e.actorTravel], ['maxX', e.actorMaxX]] as const) for (const [actor, range] of Object.entries(ranges ?? {})) {
  172 |     const value = metrics.actors[actor]?.[field] ?? NaN;
  173 |     checks.push({ name: `${field}.${actor}.min`, pass: value >= range[0], value, limit: range[0] }, { name: `${field}.${actor}.max`, pass: value <= range[1], value, limit: range[1] });
  174 |   }
  175 |   add('collisionFailures', metrics.collision?.failures ?? Infinity, e.collisionFailuresMax);
  176 |   add('collisionPending', metrics.collision?.pending ?? Infinity, e.collisionPendingMax);
  177 |   add('propPenetrationFramesMax', metrics.propPenetration.framesMax, e.propPenetrationFramesMax);
  178 |   add('convoyOverlapFramesMax', metrics.convoyOverlapFrames, e.convoyOverlapFramesMax);
  179 |   add('consoleErrors', errors.length, e.consoleErrors ?? 0);
  180 |   add('clipping', clipping.static.length + clipping.actors.length + clipping.heldProps.length + (clipping.gunBodies?.length ?? 0), e.clippingMax);
  181 |   add('heldPropIntersections', clipping.heldProps.length, e.heldPropIntersectionsMax);
  182 |   const holds = Object.values(metrics.heldProps.holds ?? {}) as { heightMin: number; straightMax: number; samples: number }[];
  183 |   // A gate on an empty set fails: the mug or phone must actually be drawn in a hand.
  184 |   if (e.heldPropHoldMin !== undefined) { const value = holds.length ? Math.min(...holds.map(h => h.heightMin)) : -1; checks.push({ name: 'heldPropHold', pass: value >= e.heldPropHoldMin, value, limit: e.heldPropHoldMin }); }
  185 |   if (e.heldPropArmStraightMax !== undefined) { const value = holds.length ? Math.max(...holds.map(h => h.straightMax)) : Infinity; checks.push({ name: 'heldPropArmStraight', pass: value <= e.heldPropArmStraightMax, value, limit: e.heldPropArmStraightMax }); }
  186 |   if (e.seeThroughNeverCut) for (const prefix of e.seeThroughNeverCut) { const hit = (metrics.seeThrough?.cutPlacements ?? []).filter(id => id.startsWith(prefix)); checks.push({ name: `seeThroughNeverCut:${prefix}`, pass: hit.length === 0, value: hit.length, limit: 0 }); }
  187 |   add('seeThroughLowProps', metrics.seeThrough?.cutLowProps.length ?? 0, e.seeThroughLowPropsMax);
  188 |   if (e.seeThroughOpenFramesMin !== undefined) checks.push({ name: 'seeThroughOpenFrames', pass: (metrics.seeThrough?.frames ?? 0) >= e.seeThroughOpenFramesMin, value: metrics.seeThrough?.frames ?? 0, limit: e.seeThroughOpenFramesMin });
  189 |   if (e.heldPropSamplesMin !== undefined) checks.push({ name: 'heldPropSamples', pass: metrics.heldProps.samples >= e.heldPropSamplesMin, value: metrics.heldProps.samples, limit: e.heldPropSamplesMin });
  190 |   add('staticOverlap', clipping.static.length, e.staticOverlapMax);
  191 |   const motion = Object.values(metrics.actors).map(a => a.motion);
  192 |   add('footSlideMaxCm', Math.max(0, ...motion.map(m => m.slideMaxCm)), e.footSlideMaxCm);
  193 |   add('footSinkMaxCm', Math.max(0, ...motion.map(m => m.sinkMaxCm)), e.footSinkMaxCm);
  194 |   add('footJitterRunMax', Math.max(0, ...Object.values(metrics.actors).filter(a => a.kind === 'courier').map(a => a.motion.jitterRunMax)), e.footJitterRunMax);
```