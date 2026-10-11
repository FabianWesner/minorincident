import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';

const output = 'test-results/l1-street-infected/captures';
test('L1 authored street encounters @E19 game camera shows infected across three escape sections', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow(); a.bot.start('complete');
  });
  mkdirSync(output, { recursive: true });
  const shots = new Set<string>(), evidence = [];
  for (let i = 0; i < 300; i++) {
    const sample = await page.evaluate(async () => {
      const a = window.__SS__!; await a.step(60);
      const m = a.missions.state()!, p = a.getState().player!;
      const section = p.transform.z > 18 ? 'elm' : p.transform.z > -12 ? 'juniper' : 'main-row';
      const visible = a.query({ kind: 'infected' }).filter(e => {
        if (e.health.current <= 0 || e.hidden || e.emerging) return false;
        const q = a.input.project(e.transform);
        return Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 12 && q.x > 40 && q.x < innerWidth - 40 && q.y > 40 && q.y < innerHeight - 150;
      }).map(e => ({ id: e.id, at: e.transform, mode: e.infected?.l1?.mode }));
      return { section, visible, p: p.transform, phase: m.phase, finalLeg: m.steps.weapon.status === 'completed', deaths: m.stats.deaths };
    });
    if (sample.finalLeg && sample.visible.length && !shots.has(sample.section)) {
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/${sample.section}.png` });
      shots.add(sample.section); evidence.push(sample);
    }
    if (sample.phase === 'result') break;
  }
  writeFileSync(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
  expect([...shots].sort()).toEqual(['elm', 'juniper', 'main-row']);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.phase)).toBe('result');
});
