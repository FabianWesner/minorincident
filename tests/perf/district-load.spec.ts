import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "../e2e/fixtures";
const output = "test-results/epics/E10";
// This criterion measures native WebGPU; macOS has no headless WebGPU.
// The user explicitly requires its manual verification instead of opening a window.
test.skip(process.platform === "darwin", "Native WebGPU is verified manually on macOS; browser automation stays headless");
// Headless only (never open windows on the shared Mac); real GPU via ANGLE/Metal on macOS.
test.use({
  headless: true,
  launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] },
});
test("T-E10-06 @E10 @E10-AC06 largest L6 composition loads in <=6 seconds with warm cache in production", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(`/?test=1&renderer=webgpu&dpr=1&quality=high&audio=muted`);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => {
    await window.__SS__!.ready;
    window.__SS__!.pause();
  });
  const samples = await page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadLevel("L6");
    api.pause();
    await api.screenshotReady();
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await api.loadLevel("L6", { seed: i });
      api.pause();
      await api.screenshotReady();
      samples.push({
        total: performance.now() - start,
        ...api.perf().loadTiming,
      });
    }
    return { samples, state: api.getState(), perf: api.perf() };
  });
  mkdirSync(output, { recursive: true });
  writeFileSync(
    `${output}/load-time.json`,
    JSON.stringify(samples, null, 2) + "\n",
  );
  expect(samples.perf.backend).toBe("webgpu");
  expect(samples.state.districts!.districts).toHaveLength(8);
  for (const ms of samples.samples) expect(ms.total).toBeLessThanOrEqual(6000);
});
