/** Q-187..190 matched mission close-ups, one browser and the QA seed (1). */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';
import type { Game } from '../../src/Game';
import type { CameraPose } from '../../src/render/View';

const out = resolve('docs/reports/l1-hats-faces/matched');
mkdirSync(out, { recursive: true });
const servers = [];
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors: string[] = [];
type Shot = { id: string; level: string; checkpoint?: string; frames: number; model?: string; infected?: boolean; rear?: boolean };
const shots: Shot[] = [
  { id: '01-l1-start-glasses', level: 'L1', frames: 1, model: 'npc.civilian-woman-b' },
  { id: '02-l1-lamp-hoodie', level: 'L1', frames: 1, model: 'npc.civilian-man-b' },
  { id: '03-l1-crossing-elderly', level: 'L1', frames: 1, model: 'npc.civilian-elderly' },
  { id: '04-l1-infected-pair', level: 'L1', checkpoint: 'bat', frames: 120, infected: true },
  { id: '05-l2-firefighter-front', level: 'L2', frames: 60, model: 'npc.firefighter-alive' },
  { id: '06-l2-firefighter-back', level: 'L2', frames: 60, model: 'npc.firefighter-alive', rear: true },
];
const matches = new Map<string, { ids: number[]; camera: CameraPose; positions: number[][] }>();
const receipts: object[] = [];
try {
  for (const [side, dist, port] of [['prod', 'test-results/l1-hats-faces/prod-dist', 4682], ['candidate', 'dist', 4681]] as const) {
    const server = await preview({ configFile: false, build: { outDir: resolve(dist) }, preview: { host: '127.0.0.1', port, strictPort: true } }); servers.push(server);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(180000);
    page.on('pageerror', error => errors.push(`${side}: ${error.message}`));
    await page.addInitScript('globalThis.__name = fn => fn');
    await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&renderer=webgpu&profile=1&dpr=1&quality=low&audio=muted&seed=1`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    await page.addStyleTag({ content: '#hud,.hud,.story-bubble,.mission-subtitle,.telemetry-consent{visibility:hidden!important}' });
    const images: { id: string; data: string }[] = [];
    for (const shot of shots) {
      const match = matches.get(shot.id);
      const receipt = await page.evaluate(async ({ shot, match }) => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        await a.loadLevel(shot.level, { seed: 1, ...(shot.checkpoint ? { checkpoint: shot.checkpoint } : {}) }); a.pause(); a.cheats.god(true);
        a.camera.follow(); a.camera.zoom(1.5); await a.step(shot.frames); await a.screenshotReady();
        const player = game.world.entities.get(1)!.transform;
        const people = [...game.world.entities.iterate()].filter(e => !e.hidden && e.health.current > 0 && (shot.infected ? !!e.infected && e.appearance?.asset.startsWith('npc.civilian-') : e.civilian?.model === shot.model));
        people.sort((a, b) => Math.hypot(a.transform.x - player.x, a.transform.z - player.z) - Math.hypot(b.transform.x - player.x, b.transform.z - player.z));
        const selected = match ? match.ids.map(id => game.world.entities.get(id)!) : people.slice(0, shot.infected ? 2 : 1);
        if (selected.length !== (shot.infected ? 2 : 1) || selected.some(e => !e)) throw Error(`No seeded subjects for ${shot.id}: ${people.length}`);
        const positions = selected.map(e => [e.transform.x, e.transform.y, e.transform.z]);
        const target = positions.reduce((p, row) => p.map((v, i) => v + row[i] / positions.length), [0, 0, 0]); target[1] += .2;
        const yaw = selected[0].transform.yaw + (shot.rear ? Math.PI : 0), r = shot.infected ? 4.2 : 3.5;
        const camera = match?.camera ?? { target: target as [number, number, number], position: [target[0] + r * Math.cos(yaw), target[1] + r * .85, target[2] - r * Math.sin(yaw)] as [number, number, number] };
        a.camera.cinematic(camera, true); game.view.update(1); await a.screenshotReady();
        return { ids: selected.map(e => e.id), positions, camera, tick: game.world.tick, seed: 1, level: shot.level, checkpoint: shot.checkpoint ?? 'start', backend: a.perf().backend,
          subjects: selected.map(e => ({ id: e.id, model: e.appearance?.asset ?? e.civilian?.model, yaw: e.transform.yaw, infected: !!e.infected, accessories: e.appearance?.accessories })) };
      }, { shot, match });
      if (!match) matches.set(shot.id, receipt);
      else assert.deepEqual(receipt.positions, match.positions, `${shot.id}: seed, ticks and subject positions match PROD`);
      assert.equal(receipt.backend, 'webgpu');
      const png = await page.screenshot({ path: resolve(out, `${shot.id}-${side}.png`) });
      images.push({ id: shot.id, data: png.toString('base64') }); receipts.push({ side, shot: shot.id, ...receipt });
      console.log(`${side} ${shot.id}: tick ${receipt.tick}, ids ${receipt.ids.join(',')}`);
    }
    await context.close();
    writeFileSync(resolve(out, `${side}-images.json`), JSON.stringify(images));
  }
  // Compose review sheets in the same browser; canvas only resizes the raw captures.
  const context = await browser.newContext(), page = await context.newPage();
  const fs = await import('node:fs');
  const left = JSON.parse(fs.readFileSync(resolve(out, 'prod-images.json'), 'utf8')) as { id: string; data: string }[];
  const right = JSON.parse(fs.readFileSync(resolve(out, 'candidate-images.json'), 'utf8')) as typeof left;
  for (let i = 0; i < left.length; i++) {
    const jpg = await page.evaluate(async ({ a, b }) => {
      const load = (data: string) => new Promise<HTMLImageElement>(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = `data:image/png;base64,${data}`; });
      const [l, r] = await Promise.all([load(a), load(b)]), canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 564;
      const g = canvas.getContext('2d')!; g.fillStyle = '#111'; g.fillRect(0, 0, 1920, 564); g.drawImage(l, 0, 24, 960, 540); g.drawImage(r, 960, 24, 960, 540);
      g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText('PROD 0009f107d', 12, 18); g.fillText('Candidate: seed 1 / same tick, subjects and camera', 972, 18);
      return canvas.toDataURL('image/jpeg', .88).split(',')[1];
    }, { a: left[i].data, b: right[i].data });
    writeFileSync(resolve(out, `${left[i].id}.jpg`), Buffer.from(jpg, 'base64'));
  }
  for (const side of ['prod', 'candidate']) { fs.unlinkSync(resolve(out, `${side}-images.json`)); for (const shot of shots) fs.unlinkSync(resolve(out, `${shot.id}-${side}.png`)); }
  await context.close();
  writeFileSync(resolve(out, 'captures.json'), JSON.stringify({ errors, receipts }, null, 2));
  assert.deepEqual(errors, []);
} finally { await browser.close(); for (const server of servers) await server.httpServer.close(); }
