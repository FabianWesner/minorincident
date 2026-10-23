import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

/**
 * PO Q-159 ("Also in L4 people behave strange") probe: which L4 civilians are drawn crouched (npc-cower / npc-hug)
 * and is anything threatening them? Captures the first few at the PO settings (WebGPU, low, zoom 1.5).
 *   E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/playtest/probe-l4-civilians.ts http://127.0.0.1:4421 test-results/playtest/l4-civilians [webgpu|webgl]
 */
const [origin, out, backend = 'webgpu'] = process.argv.slice(2);
if (!origin || !out) throw new Error('Usage: probe-l4-civilians.ts <origin> <outDir> [webgpu|webgl]');
mkdirSync(out, { recursive: true });
const args = ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'];
const browser = await chromium.launch({ headless: true, args });
const report: unknown[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${origin}/?test=1&testApi=1&renderer=${backend}&dpr=1&audio=muted&quality=low`);
  await page.waitForFunction(() => !!window.__SS__);
  for (const [checkpoint, after] of [['arrival', 900], ['turn', 900], ['turn', 4200]] as const) {
    await page.evaluate(async ({ checkpoint }) => {
      const a = window.__SS__!; await a.ready;
      await a.loadLevel('L4', { seed: 327, checkpoint, progression: 'L4-default' });
      a.pause(); a.cheats.god(true); a.camera.follow();
    }, { checkpoint });
    for (let t = 0; t < after; t += 150) await page.evaluate(n => { window.__SS__!.step(n); }, 150);
    const rows = await page.evaluate(() => {
      const a = window.__SS__!;
      a.camera.zoom(1.5);
      const ents = a.query({}) as any[];
      const infected = ents.filter(e => e.infected && e.health.current > 0 && !e.hidden);
      // A full-scene render so every civilian is drawn this frame (figures come from the drawn batches).
      return ents.filter(e => e.civilian && !e.civilian.pet && !e.hidden && e.health.current > 0 && !e.civilian.ally).map(e => {
        const c = e.civilian, act = c.schedule?.[c.scheduleStep ?? 0];
        const near = infected.reduce((m, i) => Math.min(m, Math.hypot(i.transform.x - e.transform.x, i.transform.z - e.transform.z)), Infinity);
        return { id: e.id, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), state: c.state, story: c.story?.clip ?? null, anchor: act?.anchor ?? null, activity: act?.activity ?? null, prop: e.appearance?.handProp ?? null, nearInfectedM: Number.isFinite(near) ? +near.toFixed(1) : null };
      });
    });
    // Visit each candidate so it is drawn near (crowdFigures lists the batches drawn this frame).
    const shots: unknown[] = [];
    let n = 0;
    for (const r of rows) {
      const fig = await page.evaluate(async ({ id, x, z }) => {
        const a = window.__SS__!;
        a.teleport('player', { x: x + 2.5, z: z + 2.5 }); a.step(1); a.camera.follow(); a.camera.zoom(1.5);
        await a.screenshotReady();
        return (a.crowdFigures() as any[]).find(f => f.id === id) ?? null;
      }, r as { id: number; x: number; z: number });
      const clip = fig?.clip ?? null, row = { ...r as object, clip, lod: fig?.lod ?? null };
      shots.push(row);
      if ((clip === 'npc-cower' || clip === 'npc-hug') && n < 4) {
        await page.screenshot({ path: `${out}/${checkpoint}${after}-${(r as { id: number }).id}-${clip}.png` }); n++;
      }
    }
    report.push({ checkpoint, after, rows: shots });
    const crouched = (shots as { clip: string | null }[]).filter(s => s.clip === 'npc-cower' || s.clip === 'npc-hug');
    console.log(checkpoint, 'civilians', shots.length, 'crouched/hugging', crouched.length, JSON.stringify(crouched));
  }
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  await browser.close();
}
