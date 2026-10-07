// TEMPORARY gait cadence survey (deleted after).
import { test } from './fixtures';
import { menuStart } from './ui-helpers';
test('g gait', async ({ page }) => {
  test.setTimeout(300_000); await menuStart(page);
  await page.evaluate(() => { const a = window.__SS__!; a.cheats.god(true); a.resume(); (globalThis as unknown as { __gait: unknown[] }).__gait = []; });
  await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w'); await page.keyboard.down('c'); await page.keyboard.down('s'); await page.waitForTimeout(2500); await page.keyboard.up('s'); await page.keyboard.up('c');
  await page.evaluate(() => { const a = window.__SS__!; a.cheats.completeObjective(); a.cheats.completeObjective(); a.cheats.completeObjective(); });
  await page.waitForTimeout(3000); console.log('G-STATE', await page.evaluate(() => { const a = window.__SS__!; const m = a.missions.state() as unknown as { phase: string; steps: Record<string, { status: string }> }; return JSON.stringify({ phase: m.phase, steps: Object.fromEntries(Object.entries(m.steps).map(([k, v]) => [k, v.status])), inf: (a.query({} as never) as unknown as { infected?: unknown }[]).filter(e => e.infected).length }); }));
  for (let i = 0; i < 10; i++) { await page.keyboard.down(i % 2 ? 'a' : 'd'); await page.waitForTimeout(2500); await page.keyboard.up(i % 2 ? 'a' : 'd'); }
  const rows = await page.evaluate(() => { const g = (globalThis as unknown as { __gait: [string, number, number][] }).__gait; const by: Record<string, { n: number; v: number[]; stride: number }> = {}; for (const [k, v, s] of g) { if (v < .1) continue; const r = by[k] ??= { n: 0, v: [], stride: s }; r.n++; r.v.push(v); } return Object.entries(by).map(([k, r]) => { r.v.sort((a, b) => a - b); const med = r.v[r.v.length >> 1], p90 = r.v[Math.floor(r.v.length * .9)]; return [k, r.n, r.stride.toFixed(3), med.toFixed(2), p90.toFixed(2), (2 * med / r.stride).toFixed(1), (2 * p90 / r.stride).toFixed(1)]; }); });
  for (const r of rows) console.log('G-GAIT', r.join(' | '));
});
