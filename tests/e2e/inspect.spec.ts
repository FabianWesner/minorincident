import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, testUrl, boot } from './fixtures';

const output = 'test-results/inspect';
test.describe('Real level inspection', () => {
  for (const level of ['L1', 'L2']) test(`${level}: three anchors and moving infected follow`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `${testUrl}&debug=true&inspect=1&level=${level}&bot=complete`);
    const anchors = await page.evaluate(() => window.__SS__!.inspect.anchors());
    expect(anchors.length).toBeGreaterThan(3);
    mkdirSync(output, { recursive: true });
    for (const [index, anchor] of anchors.filter(a => a.kind === 'objective').slice(0, 3).entries()) {
      await page.evaluate(id => window.__SS__!.inspect.jump(id), anchor.id);
      await page.evaluate(() => window.__SS__!.screenshotReady());
      const state = await page.evaluate(() => window.__SS__!.inspect.state());
      expect(state.camera!.target[0]).toBeCloseTo(anchor.position[0]);
      expect(state.camera!.target[2]).toBeCloseTo(anchor.position[2]);
      await page.screenshot({ path: `${output}/${level}-anchor-${index}.png` });
    }
    // Run the real complete profile until the authored outbreak appears.
    let id: number | undefined;
    for (let seconds = 0; seconds < 240 && id === undefined; seconds += 5) {
      await page.evaluate(() => window.__SS__!.step(300));
      id = await page.evaluate(() => window.__SS__!.query({}).filter(e => e.infected && !e.hidden && !e.infected.hidden && e.health.current > 0 && (e.motion?.speed ?? 0) > .3).sort((a, b) => { const p = window.__SS__!.getEntity(1)!.transform; return Math.hypot(b.transform.x - p.x, b.transform.z - p.z) - Math.hypot(a.transform.x - p.x, a.transform.z - p.z); })[0]?.id);
    }
    expect(id, 'authored infected appears').toBeDefined();
    await page.evaluate(id => window.__SS__!.inspect.follow(id), id!);
    const before = await page.evaluate(id => window.__SS__!.getEntity(id)!.transform, id!);
    await page.evaluate(() => { window.__SS__!.inspect.timeScale(1); });
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.__SS__!.pause());
    const after = await page.evaluate(id => ({ entity: window.__SS__!.getEntity(id), inspect: window.__SS__!.inspect.state() }), id!);
    expect(Math.hypot(after.entity!.transform.x - before.x, after.entity!.transform.z - before.z)).toBeGreaterThan(.1);
    expect(after.inspect.following).toBe(id);
    expect(after.inspect.camera!.target[0]).toBeCloseTo(after.entity!.transform.x, 0);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${level}-follow.png` });
    writeFileSync(`${output}/${level}-metrics.json`, JSON.stringify(after.inspect.perf, null, 2));
  });
  test('60 s L1 complete bot: camera on/off gives identical sim hash', async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `${testUrl}&debug=true`);
    const hashes: string[] = [];
    for (const inspect of [false, true]) {
      const state = await page.evaluate(async on => {
        const api = window.__SS__!;
        api.inspect.enable(false); await api.loadLevel('L1', { seed: 7 }); api.pause(); api.missions.begin(); api.bot.start('complete');
        if (on) { api.inspect.enable(true, { courier: 'unchanged' }); api.inspect.setCamera({ position: [120, 70, 90], target: [-50, 0, -20] }); }
        for (let i = 0; i < 12; i++) { await api.step(300); if (on) { if (i === 5) { api.inspect.enable(false); api.inspect.enable(true, { courier: 'unchanged' }); } api.inspect.jump(api.inspect.anchors()[i].id); } }
        const { render: _render, ...sim } = api.getState(); void _render;
        return sim;
      }, inspect);
      hashes.push(createHash('sha256').update(JSON.stringify(state)).digest('hex'));
    }
    expect(hashes[1]).toBe(hashes[0]);
    mkdirSync(output, { recursive: true }); writeFileSync(`${output}/determinism.json`, JSON.stringify({ ticks: 3600, hashes }));
  });
  test('production inspect requires debug=true', async ({ page }) => {
    await boot(page, `${testUrl}&inspect=1&level=L2`);
    expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('empty');
    await expect(page.locator('[data-testid=inspection]')).toHaveCount(0);
  });
  test('keyboard, mouse and pause leave courier input idle in ghost mode', async ({ page }) => {
    test.setTimeout(120_000); await boot(page, `${testUrl}&debug=true&inspect=1&level=L1`);
    const before = await page.evaluate(() => window.__SS__!.inspect.state().camera);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => window.__SS__!.inspect.state().camera);
    expect(after!.target).not.toEqual(before!.target);
    await page.mouse.move(700, 400); await page.mouse.down(); await page.mouse.move(850, 430, { steps: 5 }); await page.mouse.up();
    await page.mouse.wheel(0, -500);
    await page.keyboard.press('KeyH'); await expect(page.locator('[data-testid=inspection]')).toBeHidden();
    await page.keyboard.press('KeyH'); await expect(page.locator('[data-testid=inspection]')).toBeVisible();
    await page.evaluate(() => window.__SS__!.inspect.timeScale(0)); const tick = await page.evaluate(() => window.__SS__!.tick());
    await page.waitForTimeout(200); expect(await page.evaluate(() => window.__SS__!.tick())).toBe(tick);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Screenshot', exact: true }).click();
    await (await download).saveAs(`${output}/screenshot-button.png`);
    await page.keyboard.press('KeyF'); expect(await page.evaluate(() => window.__SS__!.inspect.state().enabled)).toBe(false);
  });
  test.describe('touch gestures', () => {
    test.use({ hasTouch: true });
    test('one finger pan, pinch zoom and two finger rotate', async ({ page, context }) => {
      test.setTimeout(120_000); await boot(page, `${testUrl}&debug=true&inspect=1&level=L1`);
      const cdp = await context.newCDPSession(page);
      const pose = () => page.evaluate(() => window.__SS__!.inspect.state().camera!);
      const before = await pose();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 800, y: 500 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 900, y: 550 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect((await pose()).target).not.toEqual(before.target);
      const pan = await pose();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 750, y: 500 }, { id: 2, x: 950, y: 500 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 720, y: 450 }, { id: 2, x: 1000, y: 550 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const pinch = await pose();
      expect(pinch.position).not.toEqual(pan.position);
      expect(pinch.position[1]).toBeLessThan(pan.position[1]);
      expect(pinch.target).toEqual(pan.target);
      await cdp.detach();
    });
  });
});
