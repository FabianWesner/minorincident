import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, boot } from '../fixtures';

/**
 * l4-po-round game-camera captures (PO 10-13 L4 requests) at both quality tiers and both player zooms (1.0 = default framing,
 * 0.5 = closest): the bus exit, the calm before the alarm (soldiers relaxed, people in routines), the alarm (+3 s and +8 s: soldiers
 * to posts, people fleeing), the war (infected from all sides) and the Alphas at the line. Records per shot what the sim says
 * (soldiers aiming / at post, people fleeing, where the infected come from). Headless through tools/e2e-lock.sh, courier idle (god).
 * `L4_CAPTURE_TAG` names the output folder (before / after).
 */
const tag = process.env.L4_CAPTURE_TAG ?? 'after';
const output = `test-results/l4-po-round/${tag}`;
test.use({ trace: 'off', viewport: { width: 1280, height: 720 } });

async function run(page: Page, quality: 'high' | 'low', zoom: number, renderer: 'webgl' | 'webgpu' = 'webgl'): Promise<void> {
  const name = `${renderer}-${quality}-z${zoom}`;
  mkdirSync(output, { recursive: true });
  await boot(page, `/?test=1&renderer=${renderer}&dpr=1&quality=${quality}&audio=muted&seed=2&ui=1`);
  // A campaign level load takes the tier from the campaign settings (the URL parameter alone keeps a progression load on high).
  await page.evaluate(q => window.__SS__!.settings.set({ quality: q }), quality);
  await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 2, progression: 'L4-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.cheats.god(true); });
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const l4 = () => page.evaluate(() => window.__SS__!.missions.state()!.l4!);
  for (let i = 0; i < 80 && (await l4()).phase === 'convoy'; i++) await step(30);
  const setZoom = async () => {
    for (let i = 0; i < 40; i++) {
      const z = await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number);
      if (Math.abs(z - zoom) < .02) break;
      await page.mouse.move(640, 360); await page.mouse.wheel(0, z > zoom ? -120 : 120); await step(2);
    }
    await step(30);
  };
  const report: Record<string, unknown> = {};
  /** A wide still of the camp (cinematic pose from the south-east, as the follow camera looks), then back to the follow camera. */
  const overview = async (label: string, x: number, z: number, r: number) => {
    await page.evaluate(({ x, z, r }) => window.__SS__!.camera.cinematic({ position: [x + r, r * 1.25, z + r], target: [x, 0, z] }, true), { x, z, r });
    await step(1); await shot(label);
    await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  };
  const shot = async (label: string) => {
    const m = await page.evaluate(async () => {
      const a = window.__SS__!; a.vfx.stepRender(1.2); await a.screenshotReady();
      const s = a.missions.state()!.l4!, p = a.getState().player!.transform, ring = { x0: -33, x1: -12, z0: -14, z1: 17 };
      const civ = a.query({ kind: 'civilian' }).filter(e => e.health.current > 0 && !e.hidden && e.civilian && !e.infection);
      const soldiers = civ.filter(e => s.soldierIds.includes(e.id));
      const armed = new Set(s.armed.map(x => x.id));
      const peds = civ.filter(e => !s.soldierIds.includes(e.id) && !armed.has(e.id) && !e.civilian!.ally && !e.civilian!.pet);
      const infected = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden);
      return {
        backend: a.perf().backend, tier: a.perf().quality.tier, t: s.turnAt ? +((a.tick() - s.turnAt) / 60).toFixed(1) : null, phase: s.phase,
        player: { x: +p.x.toFixed(1), z: +p.z.toFixed(1), insideRing: p.x > ring.x0 && p.x < ring.x1 && p.z > ring.z0 && p.z < ring.z1 },
        soldiers: soldiers.length, aiming: soldiers.filter(e => e.civilian!.story?.clip === 'shoot' || !!e.civilian!.ally?.targetId).length,
        engaged: soldiers.filter(e => e.civilian!.ally?.engaged).length,
        peds: peds.length, fleeing: peds.filter(e => e.civilian!.state === 'flee' || e.civilian!.state === 'hide' || e.civilian!.state === 'alarmed').length,
        infected: infected.length, alphas: infected.filter(e => e.archetype === 'infected.alpha').length,
      };
    });
    await page.screenshot({ path: `${output}/${name}-${label}.png` });
    expect(m.backend).toBe(renderer);
    report[label] = m;
  };
  // 1: the bus exit (the courier and the corgi step off), framed by the follow camera.
  await step(20); await setZoom(); await shot('1-exit');
  // 2: the calm (10 s later) at the quartermaster's table and at the north line: soldiers, people queueing and strolling.
  await step(600); await page.evaluate(() => window.__SS__!.teleport('player', { x: -21.5, z: 5 })); await step(60); await shot('2-calm-plaza');
  await page.evaluate(() => window.__SS__!.teleport('player', { x: -23, z: -10 })); await step(60); await shot('2-calm-north');
  await overview('2-calm-overview-n', -22, -9, 15); await overview('2-calm-overview-s', -22, 12, 15);
  // The gun, then the alarm (the turn) right away: +3 s and +8 s.
  await page.evaluate(() => { const a = window.__SS__!; a.cheats.completeObjective('quartermaster'); a.teleport('player', { x: -21.5, z: 3 }); });
  // The turn comes 40-50 s after the gun (never through completeObjective here: in that gap it completes the hold, i.e. the line break).
  for (let i = 0; i < 60 && !(await l4()).turnAt; i++) await step(60);
  const turnAt = (await l4()).turnAt, now = await page.evaluate(() => window.__SS__!.tick());
  await step(Math.max(1, turnAt + 180 - now)); await shot('3-alarm-3s');
  await step(120); await overview('3-alarm-5s-overview', -22, 2, 17);
  await step(180); await shot('4-alarm-8s');
  // 5: the war (t = 40 s): infected come from every side; 6: the Alphas at the line (t = 95 s).
  const until = async (s: number) => { for (let i = 0; i < 400; i++) { const st = await l4(), elapsed = (await page.evaluate(() => window.__SS__!.tick())) - st.turnAt; if (st.turnAt && elapsed >= s * 60) return; await step(Math.min(60, s * 60 - elapsed)); } };
  await until(10); await shot('4-alarm-10s');
  await page.evaluate(() => document.body.classList.add('ui-hidden')); await shot('4-alarm-10s-clean');
  await page.evaluate(() => document.body.classList.remove('ui-hidden'));
  await until(40); await shot('5-war-40s');
  await until(95); await shot('6-war-95s');
  writeFileSync(`${output}/${name}.json`, JSON.stringify(report, null, 1) + '\n');
}

test.describe('l4-po-round captures', () => {
  for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of (renderer === 'webgl' ? [1, .5, 1.5] : [1, 1.5])) {
    test(`${renderer} ${quality} zoom ${zoom}`, async ({ page }) => { test.setTimeout(900_000); page.setDefaultTimeout(180_000); await run(page, quality, zoom, renderer); });
  }
});
