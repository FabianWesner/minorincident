import { boot, expect, test } from '../fixtures';

const gain = (page: import('@playwright/test').Page, state: string) => page.evaluate(s => window.__SS__!.audio.snapshot().music.streamed.decks.find(d => d.state === s)?.gain ?? 0, state);

/** PO 10-12: "Big fight szene in L2, but the music is not changing." A dense fight must switch the music within seconds and release afterwards. */
for (const level of ['L2', 'L3']) test(`@E16 ${level} dense fight switches the music to combat and peak, then returns to calm`, async ({ page }) => {
    await boot(page); await page.mouse.click(200, 250);
    await page.evaluate(async level => {
        const a = window.__SS__!;
        await a.loadLevel(level); a.missions.begin(); a.pause(); a.cheats.god(true);
        a.cheats.killAll();
        await a.audio.unlock(); a.resume();
    }, level);
    await expect.poll(() => gain(page, 'calm'), { timeout: 8000 }).toBeGreaterThan(0.45);
    await page.evaluate(() => {
        const a = window.__SS__!, p = a.getEntity(1)!.transform;
        for (let i = 0; i < 10; i++) a.spawn('infected.runner', { x: p.x + 2 + (i % 4), z: p.z - 3 + Math.floor(i / 4) * 2 }, { state: 'chase' });
    });
    await expect.poll(() => gain(page, 'combat'), { timeout: 3000, intervals: [100] }).toBeGreaterThan(0.5);
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.peak), { timeout: 4000, intervals: [100] }).toBe(true);
    await expect.poll(() => gain(page, 'combat'), { timeout: 3000, intervals: [100] }).toBeGreaterThan(0.7);
    expect(await page.evaluate(() => window.__SS__!.audio.snapshot().music.layers)).toContain('peak');
    // The crowd is gone: peak releases after 5 s, combat after 7 s, calm returns.
    await page.evaluate(() => {
        const a = window.__SS__!;
        for (const e of a.query({ kind: 'infected' })) a.teleport(e.id, { x: 100, z: 100 });
    });
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.peak), { timeout: 9000, intervals: [250] }).toBe(false);
    await expect.poll(() => gain(page, 'calm'), { timeout: 14000, intervals: [250] }).toBeGreaterThan(0.45);
    expect(await gain(page, 'combat')).toBeLessThan(0.05);
});
