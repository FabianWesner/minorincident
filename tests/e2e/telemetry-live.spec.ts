import { test, expect } from './fixtures';
import { decodeLog } from '../../src/telemetry/codec';
import { gunzip } from '../../src/telemetry/gzip';

/**
 * Whole pipeline against a local Pages runtime: `?telemetry=live` sends events and replay chunks to /api/t and /api/replay,
 * the stats and replay endpoints return them. Needs a running `wrangler pages dev` (see docs/tools/telemetry.md):
 *   E2E_TELEMETRY_BASE=http://127.0.0.1:8791 E2E_TELEMETRY_TOKEN=<TELEMETRY_READ_TOKEN of that server> npx playwright test tests/e2e/telemetry-live.spec.ts
 * Skipped otherwise.
 */
const base = process.env.E2E_TELEMETRY_BASE, token = process.env.E2E_TELEMETRY_TOKEN;
test.skip(!base || !token, 'needs E2E_TELEMETRY_BASE and E2E_TELEMETRY_TOKEN (local wrangler pages dev)');
test.use({ headless: true });

test('T-TELEMETRY-4 live mode: events and replay chunks reach the Pages functions, stats and replays read them back', async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultTimeout(120_000);
  await page.goto(`${base}/?test=1&telemetry=live&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1`);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { const a = window.__SS__!; await a.ready; a.pause(); await a.loadLevel('L1', { seed: 3 }); a.pause(); });
  await page.waitForFunction(() => window.__SS__!.replay.ready());
  await page.evaluate(() => { const a = window.__SS__!; a.missions.begin(); a.bot.start('complete'); a.setTimeScale(6); a.resume(); });
  await page.waitForFunction(() => window.__SS__!.missions.state()!.phase !== 'playing', undefined, { timeout: 200_000 });
  await page.evaluate(() => window.__SS__!.pause());
  const finished = await page.evaluate(() => { const a = window.__SS__!; return { ticks: a.tick(), deaths: a.missions.state()!.stats.deaths }; });
  // The page flushes on level completion; closing the page sends the last events through the final (pagehide) path.
  await page.waitForTimeout(3000);
  await page.close({ runBeforeUnload: true });
  await new Promise(resolve => setTimeout(resolve, 2500));
  const get = async (path: string) => (await fetch(`${base}/api/${path}${path.includes('?') ? '&' : '?'}token=${token}`));
  const stats = await (await get('stats?days=2')).json() as { totals: { sessions: number; players: number }; level_funnel: { level: string; starts: number; completes: number }[]; deaths: { level: string; deaths: number }[]; replays: { count: number } };
  expect(stats.totals.sessions).toBeGreaterThanOrEqual(1);
  const l1 = stats.level_funnel.find(f => f.level === 'L1')!;
  expect(l1.starts).toBeGreaterThanOrEqual(1); expect(l1.completes).toBeGreaterThanOrEqual(1);
  if (finished.deaths) expect(stats.deaths.find(d => d.level === 'L1')!.deaths).toBeGreaterThanOrEqual(finished.deaths);
  const list = await (await get('replays?level=L1&outcome=complete&limit=5')).json() as { replays: { attempt_id: string; chunks: number; ticks: number; samples: number }[] };
  expect(list.replays.length).toBeGreaterThanOrEqual(1);
  const replay = list.replays[0];
  expect(replay.ticks).toBeGreaterThan(3000);
  const detail = await (await get(`replays?id=${replay.attempt_id}`)).json() as { chunks: { n: number }[] };
  expect(detail.chunks).toHaveLength(replay.chunks);
  const raw: Uint8Array[] = [];
  for (const { n } of detail.chunks) raw.push(await gunzip(new Uint8Array(await (await get(`replays?id=${replay.attempt_id}&chunk=${n}`)).arrayBuffer())));
  const log = decodeLog(raw);
  expect(log.samples).toBe(replay.samples); expect(log.meta).toMatchObject({ level: 'L1', seed: 3 });
  console.log(`live pipeline: ${replay.chunks} chunks, ${log.samples} samples, stats sessions=${stats.totals.sessions} funnel=${JSON.stringify(l1)}`);
});
