/** vqa60: A/B of batch 59 (PROD tree 2741447, QA-hooks build in a baseline worktree) against batch 60 candidate (local dist).
 *   VQA_B59_DIST=/path/to/b59/dist VQA_PARTS=plain,l10,l2,l7push VQA_BACKENDS=webgpu,webgl2 VQA_TIERS=low,high \
 *   E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/vqa60-ab.ts
 * plain:  start views of L1 L2 L4 L5 L6 L8 L9 L10 (presets) at zoom 1 / 1.5 (E25 lights on re-exported models).
 * l10:    the seven r9-l10pace crossing spots in the production L10 level (night), courier teleported, 3 s of play.
 * l2:     the L2 fire-engine ride (native no-axe bot boards), +12 s, zoom 1 / 1.5.
 * l7push: L7 start, courier walks into the follower column for 6 s by input frames; per-tick follower displacement + frames.
 * Captures to test-results/vqa60/ab/. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';

const out = 'test-results/vqa60/ab'; mkdirSync(out, { recursive: true });
const parts = (process.env.VQA_PARTS ?? 'plain,l10,l2,l7push').split(',');
const sides = (process.env.VQA_SIDES ?? 'b59,b60').split(',');
const backends = (process.env.VQA_BACKENDS ?? 'webgpu').split(',');
const tiers = (process.env.VQA_TIERS ?? 'low,high').split(',');
const plainLevels = (process.env.VQA_LEVELS ?? 'L1,L2,L4,L5,L6,L8,L9,L10').split(',');
const port = Number(process.env.E2E_PORT ?? 4360);
const servers = {
  b59: await preview({ configFile: false, build: { outDir: resolve(process.env.VQA_B59_DIST ?? '/private/tmp/claude-501/vqa60-b59/dist') }, preview: { host: '127.0.0.1', port, strictPort: true } }),
  b60: await preview({ configFile: false, build: { outDir: resolve('dist') }, preview: { host: '127.0.0.1', port: port + 1, strictPort: true } }),
};
const origins: Record<string, string> = { b59: `http://127.0.0.1:${port}`, b60: `http://127.0.0.1:${port + 1}` };
const presets: Record<string, string | undefined> = { L1: undefined, L2: 'L2-default', L3: 'L3-default', L4: 'L4-default', L5: 'L5-default', L6: 'L6-default', L7: 'L7-default', L8: 'L8-default', L9: 'L9-default', L10: 'L10-default' };
// Courier spots of tests/scenes/catalog/l10-crossing-*.json (r9-l10pace).
const crossings: [string, number, number][] = [['r2', 900, 21], ['r3', 1414, 15], ['r4', 2016, 11], ['r5', 2560, -12], ['r6', 3190, -12.5], ['r6s', 3400, -93], ['r7', 3745, -26]];
const rows: unknown[] = [];
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  for (const backend of backends) for (const tier of tiers) for (const side of sides) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(240000); await page.addInitScript('globalThis.__name = fn => fn');
    const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
    const u = new URL(origins[side]); for (const [k, v] of Object.entries({ test: '1', scenelab: '1', dpr: '1', quality: tier, audio: 'muted', preload: '0', seed: '1' })) u.searchParams.set(k, v);
    if (backend === 'webgl2') u.searchParams.set('renderer', 'webgl');
    await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    await page.addStyleTag({ content: '.story-bubble,.telemetry-consent{visibility:hidden!important}' });
    const tag = `${backend}-${tier}-${side}`;
    const shot = async (name: string, zooms = [1, 1.5]) => {
      for (const zoom of zooms) {
        await page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); for (let i = 0; i < 3; i++) await a.step(10); await a.screenshotReady(); }, zoom);
        const file = `${out}/${name}-z${zoom}-${tag}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 88 }); rows.push({ name, zoom, tag, file });
      }
    };
    const load = (level: string) => page.evaluate(async ({ level, tier, progression }) => {
      const a = window.__SS__!; a.settings.set({ quality: tier as 'low', cameraShake: false });
      await a.loadLevel(level, { seed: 1, ...(progression ? { progression } : {}) } as never);
      a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true); await a.step(90);
    }, { level, tier, progression: presets[level] });
    try {
      if (parts.includes('plain')) for (const level of plainLevels) { await load(level); await shot(`${level}-plain`); }
      if (parts.includes('l10')) {
        await load('L10');
        for (const [name, x, z] of crossings) {
          await page.evaluate(async ({ x, z }) => { const a = window.__SS__!; a.cheats.killAll(); a.teleport(1, { x, z }); a.camera.follow(); await a.step(180); a.cheats.killAll(); await a.step(30); }, { x, z });
          await shot(`L10-cross-${name}`);
        }
      }
      if (parts.includes('l2')) {
        const ok = await page.evaluate(async () => {
          const a = window.__SS__!; await a.loadLevel('L2', { seed: 1, progression: 'L2-default' } as never); a.missions.begin(); a.pause(); a.bot.start('no-axe');
          for (let i = 0; i < 120 && a.missions.state()!.l2!.phase !== 'ride'; i++) await a.step(30);
          if (a.missions.state()!.l2!.phase !== 'ride') return false; a.bot.stop?.(); a.camera.follow();
          const st = a.missions.state()!.l2! as unknown as { departAt: number }; while (a.getState().tick - st.departAt < 12 * 60) await a.step(1); return true;
        });
        if (ok) await shot('L2-ride-s12'); else rows.push({ tag, l2: 'bot did not board' });
      }
      if (parts.includes('l7push')) {
        await load('L7');
        const res = await page.evaluate(async () => {
          const a = window.__SS__!; a.cheats.killAll(); await a.step(30);
          const me = () => a.getEntity(1)!.transform as { x: number; z: number };
          const near = () => a.query({ within: { ...me(), r: 4 } }).filter(e => e.id !== 1 && (e as { kind?: string }).kind !== 'infected');
          const last = new Map<number, { x: number; z: number; t: number }>(); let maxStep = 0, maxStepId = -1, maxStepKind = '', ticks = 0, close = 0, minGap = 9, jumps = 0, path = 0; let prevMe = me(); const jumpList: unknown[] = [];
          const moves = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }];
          const start = { ...me() };
          for (const move of moves) {
            for (let t = 0; t < 90; t++) {
              a.input.set({ move } as never); await a.step(1); ticks++;
              const p = me(); path += Math.hypot(p.x - prevMe.x, p.z - prevMe.z); prevMe = p;
              for (const e of near()) {
                const q = e.transform as { x: number; z: number }; const prev = last.get(e.id);
                if (prev && prev.t === ticks - 1) { const s = Math.hypot(q.x - prev.x, q.z - prev.z); if (s > .12) { jumps++; if (jumpList.length < 8) jumpList.push({ id: e.id, kind: (e as { kind?: string }).kind, arch: (e as { archetype?: string }).archetype, s: +s.toFixed(2), t: ticks }); } if (s > maxStep) { maxStep = s; maxStepId = e.id; maxStepKind = `${(e as { kind?: string }).kind}/${(e as { archetype?: string }).archetype}`; } }
                last.set(e.id, { x: q.x, z: q.z, t: ticks }); const g = Math.hypot(q.x - p.x, q.z - p.z); minGap = Math.min(minGap, g); if (g < 1.2) close++;
              }
            }
          }
          a.input.clear?.();
          const end = me();
          return { ticks, maxFollowerStepPerTick: +maxStep.toFixed(3), maxStepId, maxStepKind, jumpsOver12cm: jumps, jumpList, courierPath: +path.toFixed(2), contactsUnder1_2m: close, minGap: +minGap.toFixed(2), courierTravel: +Math.hypot(end.x - start.x, end.z - start.z).toFixed(2), tracked: last.size };
        });
        rows.push({ tag, l7push: res }); await shot('L7-push-end', [1.5]);
      }
    } catch (e) { rows.push({ tag, error: String(e).slice(0, 400) }); }
    if (errors.length) rows.push({ tag, pageErrors: errors.slice(0, 6) });
    writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1));
    await context.close();
  }
} finally { await browser.close(); await servers.b59.close(); await servers.b60.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
process.exit(0);
