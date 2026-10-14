import { mkdirSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';

test.use({ viewport: { width: 1280, height: 720 }, launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`@E22 no army-line rebuild prompts ${renderer} ${quality} zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(300_000); page.setDefaultTimeout(120_000);
    await boot(page, `/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async quality => { const a = window.__SS__!; a.settings.set({ quality }); await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); }, quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('ride'); a.cheats.completeObjective('quartermaster'); });
    const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
    for (let i = 0; i < 60 && !await page.evaluate(() => window.__SS__!.missions.state()!.l4!.turnAt); i++) await step(60);
    for (let i = 0; i < 20 && Math.abs(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number) - zoom) > .02; i++) { await page.mouse.move(640, 360); await page.mouse.wheel(0, -120); await step(2); }
    const slots = await page.evaluate(() => window.__SS__!.barricades.slots().filter(s => s.state.slot.groupId === 'l4-line'));
    expect(slots).toHaveLength(3);
    for (const slot of slots) await page.evaluate(id => window.__SS__!.interact.hit(id, 1e6, 'bullet'), slot.id);
    const out = `test-results/l4-walk-left/barricades-${renderer}-${quality}-z${zoom}`; mkdirSync(out, { recursive: true });
    for (const phase of ['war', 'collapse']) {
      if (phase === 'collapse') await page.evaluate(() => window.__SS__!.cheats.completeObjective('hold'));
      for (const slot of slots) {
        const at = { x: (slot.state.slot.a.x + slot.state.slot.b.x) / 2, z: (slot.state.slot.a.z + slot.state.slot.b.z) / 2 + 1 };
        await page.evaluate(at => window.__SS__!.teleport('player', at), at); await step(40);
        const e = await page.evaluate(id => window.__SS__!.getEntity(id)!, slot.id);
        expect(e.barricade!.intact).toBe(false); expect(e.barricade!.slot.playerBuildable).toBe(false); expect(e.interactable!.enabled).toBe(false);
        await expect(page.getByTestId('interaction-prompt')).toBeHidden();
        await page.keyboard.press('e'); await step(90);
        expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.barricade!.intact, slot.id)).toBe(false);
        await page.screenshot({ path: `${out}/${phase}-${slot.state.slot.id}.png` });
      }
    }
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
    expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(quality);
  });
}
