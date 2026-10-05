import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { boot, expect, test } from "../e2e/fixtures";
import { districtGameplay } from "../../src/levels/districts";
import { resolvePosition } from "../../src/levels/districts/validate";
import type {
  DistrictId,
  DistrictLayout,
} from "../../src/levels/districts/types";
import { districtIds } from "../../src/levels/districts/types";
import type { Page } from "@playwright/test";
const output = "test-results/epics/E10";
async function district(
  page: Page,
  id: string,
  tier: number,
  spot = "overview",
) {
  const layout = JSON.parse(
    readFileSync(`public/assets/layouts/${id}.layout.json`, "utf8"),
  ) as DistrictLayout;
  const point = resolvePosition(
    districtGameplay[id as DistrictId].photoSpots.find((s) => s.name === spot)!
      .target,
    layout,
  );
  await page.evaluate(
    async ({ id, tier, spot, point }) => {
      const api = window.__SS__!;
      await api.loadLevel(id, { tier: tier as 0 | 5, seed: 1 });
      api.pause();
      api.teleport("player", { x: point[0], z: point[1] + 1 });
      api.camera.preset(`${id}/W${tier}/${spot}`);
      await api.step(0);
      await api.screenshotReady();
    },
    { id, tier, spot, point },
  );
}
function write(name: string, value: unknown) {
  mkdirSync(output, { recursive: true });
  writeFileSync(
    `${output}/${name}.json`,
    JSON.stringify(value, null, 2) + "\n",
  );
}
const lum = (p: PNG, i: number) =>
  p.data[i] * 0.2126 + p.data[i + 1] * 0.7152 + p.data[i + 2] * 0.0722;

function nonSky(png: PNG, sky: string): number {
  const rgb = [1, 3, 5].map((i) => Number.parseInt(sky.slice(i, i + 2), 16));
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4)
    if (
      Math.abs(png.data[i] - rgb[0]) > 12 ||
      Math.abs(png.data[i + 1] - rgb[1]) > 12 ||
      Math.abs(png.data[i + 2] - rgb[2]) > 12
    )
      n++;
  return n / (png.width * png.height);
}

for (const id of districtIds) {
  test(`T-E10-08-${id} @E10 @E10-AC08 photo spots at all six tiers have finite camera and >=30% non-sky pixels`, async ({
    page,
  }) => {
    test.setTimeout(480_000);
    await boot(page);
    const metrics = [];
    for (const tier of [0, 1, 2, 3, 4, 5]) {
      await district(page, id, tier);
      const state = await page.evaluate(() => window.__SS__!.getState());
      expect(state.render.camera.position.every(Number.isFinite)).toBe(true);
      expect(state.render.districts!.photoSpots).toContain(
        `${id}/W${tier}/landmark`,
      );
      const png = PNG.sync.read(
        await page.screenshot({ path: `${output}/${id}-W${tier}.png` }),
      );
      const ratio = nonSky(png, state.render.lighting!.sky);
      expect(ratio).toBeGreaterThanOrEqual(0.3);
      metrics.push({
        tier,
        spot: "overview",
        ratio,
        camera: state.render.camera,
      });
      await page.evaluate(
        (spot) => window.__SS__!.camera.preset(spot),
        `${id}/W${tier}/landmark`,
      );
      await page.evaluate(() => window.__SS__!.screenshotReady());
      const landmark = PNG.sync.read(
        await page.screenshot({
          path: `${output}/${id}-W${tier}-landmark.png`,
        }),
      );
      const landmarkState = await page.evaluate(
        () => window.__SS__!.getState().render,
      );
      expect(landmarkState.camera.position.every(Number.isFinite)).toBe(true);
      const landmarkRatio = nonSky(landmark, landmarkState.lighting!.sky);
      expect(landmarkRatio).toBeGreaterThanOrEqual(0.3);
      metrics.push({
        tier,
        spot: "landmark",
        ratio: landmarkRatio,
        camera: landmarkState.camera,
      });
    }
    write(`${id}-spots`, metrics);
  });
  test(`T-E10-04-${id} @E10 @E10-AC04 same-place W0/W5 window mask dims and fire emitters appear`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await boot(page);
    await district(page, id, 0, "landmark");
    const before = PNG.sync.read(
      await page.screenshot({ path: `${output}/${id}-decay-W0.png` }),
    );
    await page.evaluate(() =>
      window.__SS__!.settings.set({ windowMask: true }),
    );
    await page.evaluate(() => window.__SS__!.screenshotReady());
    const mask = PNG.sync.read(
      await page.screenshot({ path: `${output}/${id}-window-mask.png` }),
    );
    await page.evaluate(() =>
      window.__SS__!.settings.set({ windowMask: false }),
    );
    await district(page, id, 5, "landmark");
    const after = PNG.sync.read(
      await page.screenshot({ path: `${output}/${id}-decay-W5.png` }),
    );
    let a = 0,
      b = 0,
      n = 0,
      difference = 0;
    for (let i = 0; i < before.data.length; i += 4) {
      if (
        mask.data[i] > 240 &&
        mask.data[i + 1] > 240 &&
        mask.data[i + 2] > 240
      ) {
        a += lum(before, i);
        b += lum(after, i);
        n++;
      }
      difference += Math.abs(lum(before, i) - lum(after, i));
    }
    expect(n).toBeGreaterThan(30);
    expect(b / n).toBeLessThan((a / n) * 0.7);
    expect(difference / (before.width * before.height)).toBeGreaterThan(5);
    const state = await page.evaluate(() => window.__SS__!.getState());
    expect(state.districts!.fireEmitters).toBeGreaterThan(0);
    write(`${id}-decay`, {
      windowPixels: n,
      litWindowLuminance: a / n,
      destroyedWindowLuminance: b / n,
      frameDifference: difference / (before.width * before.height),
      fireEmitters: state.districts!.fireEmitters,
    });
  });
}
test("T-E10-09 @E10 @E10-AC09 all district diorama and decay review must items pass", () => {
  const review = readFileSync(`${output}/review.md`, "utf8");
  for (const id of districtIds)
    for (const item of ["A1", "A2", "A3", "A4", "E1", "E2"])
      expect(review).toMatch(new RegExp(`${id} ${item}: PASS`));
});

test("T-E10-review-thresholds @E10 reviewed diorama/decay should items meet the 70% threshold", () => {
  const review = readFileSync(`${output}/review.md`, "utf8");
  for (const id of districtIds) {
    expect(
      ["A5", "A6", "A7", "A8"].filter((item) =>
        new RegExp(`${id} ${item}: PASS`).test(review),
      ).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      ["E3", "E4"].filter((item) =>
        new RegExp(`${id} ${item}: PASS`).test(review),
      ).length,
    ).toBe(2);
  }
});
