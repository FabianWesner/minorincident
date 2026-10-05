import { mkdirSync, writeFileSync } from "node:fs";
import { boot, expect, test } from "../e2e/fixtures";
import { districtIds } from "../../src/levels/districts/types";
const output = "test-results/epics/E10";
test("T-E10-05 @E10 @E10-AC05 repeated props use instance batches and full high-tier district <=250 draw calls", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await boot(page);
  const results = [];
  for (const id of districtIds) {
    await page.evaluate(async (id) => {
      await window.__SS__!.loadLevel(id, { tier: 5 });
      window.__SS__!.pause();
      window.__SS__!.camera.preset(`${id}/W5/overview`);
      await window.__SS__!.screenshotReady();
    }, id);
    const data = await page.evaluate(() => ({
      render: window.__SS__!.getState().render.districts,
      perf: window.__SS__!.perf(),
    }));
    for (const assetId of [
      "prop.picket-fence",
      "prop.street-lamp",
      "prop.traffic-cone",
      "prop.tree",
      "prop.hedge",
      "veh.sedan-red",
    ]) {
      const batches = data.render!.batches.filter((b) => b.assetId === assetId);
      expect(batches.length).toBeGreaterThan(0);
      expect(batches.some((b) => b.instances > 1)).toBe(true);
      expect(batches.every((b) => b.meshes > 0)).toBe(true);
    }
    expect(data.perf.drawCalls).toBeLessThanOrEqual(250);
    expect(data.render!.grassBlades).toBeGreaterThan(0);
    results.push({ id, ...data.perf });
  }
  mkdirSync(output, { recursive: true });
  writeFileSync(
    `${output}/draw-calls.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
});

test("T-E10-lifecycle @E10 world reload preserves bounded shared caches and releases every instance/body/listener", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await boot(page);
  const results = await page.evaluate(async () => {
    const api = window.__SS__!,
      loads = [];
    for (let i = 0; i < 3; i++) {
      await api.loadLevel("D-RES", { tier: 5 });
      api.pause();
      await api.screenshotReady();
      loads.push(api.perf());
      await api.unloadScenario();
      if (api.getState().districts !== undefined)
        throw new Error("district sim retained");
    }
    return { loads, state: api.getState() };
  });
  expect(results.state.perf).toEqual({
    entities: 0,
    bodies: 0,
    colliders: 0,
    listeners: 0,
  });
  expect(results.state.render.districts).toBeNull();
  expect(results.loads[2].geometries).toBeLessThanOrEqual(
    results.loads[1].geometries,
  );
  expect(results.loads[2].textures).toBeLessThanOrEqual(
    results.loads[1].textures,
  );
});
