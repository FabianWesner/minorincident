import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from '../fixtures';
const root = 'test-results/epics/E16';
// File name deliberately participates in the existing Chromium/mobile/WebKit smoke projects.
test('S-11 T-E16-21 @smoke @E16 @E16-AC21 away suspends audio/music/sim, preserves mute and discards queued cues', async ({ page }, info) => {
    await boot(page);
    await page.mouse.click(200, 250);
    await page.evaluate(async () => { const a = window.__SS__!; await a.audio.unlock(); a.input.clear(); });
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().state)).toBe('running');
    await page.waitForTimeout(350);
    await page.mouse.click(200, 250);
    // Further gestures must not restart the first-unlock fade.
    expect(await page.evaluate(() => window.__SS__!.audio.snapshot().master)).toBeCloseTo(2, 3);
    const rows = [];
    for (const trigger of ['visibilitychange', 'blur', 'pagehide'] as const)
        for (const muted of [false, true]) {
            await page.evaluate(muted => { const a = window.__SS__!; a.settings.set({ muted }); a.resume(); a.audio.clearLog(); }, muted);
            if (!muted)
                await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().state)).toBe('running');
            await page.keyboard.down('KeyW');
            const before = await page.evaluate(async (trigger) => {
                const a = window.__SS__!, time = performance.now();
                if (trigger === 'visibilitychange') {
                    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                    document.dispatchEvent(new Event('visibilitychange'));
                }
                else
                    window.dispatchEvent(new Event(trigger));
                while (a.audio.snapshot().state !== 'suspended' && performance.now() - time < 100)
                    await new Promise(r => setTimeout(r, 1));
                return { position: a.audio.snapshot().music.position, time, tick: a.tick(), suspendMs: performance.now() - time };
            }, trigger);
            await page.waitForFunction(() => window.__SS__!.audio.snapshot().state === 'suspended', undefined, { timeout: 100 });
            const away = await page.evaluate(() => ({ now: performance.now(), tick: window.__SS__!.tick(), snapshot: window.__SS__!.audio.snapshot() }));
            expect(before.suspendMs).toBeLessThan(100);
            expect(away.snapshot.master).toBe(0);
            expect(away.snapshot.music.paused).toBe(true);
            await expect(page.locator('[data-audio-pause]')).toBeVisible();
            await page.evaluate(() => { const a = window.__SS__!; for (let i = 0; i < 20; i++)
                a.audio.emit({ type: 'noise', tick: a.tick(), sourceId: 1, position: { x: 0, y: 0.7, z: 0 }, radius: 25, loudness: 1, kind: 'ranged', actionId: 'weapon.pistol' }); });
            await page.waitForTimeout(200);
            const stable = await page.evaluate(() => ({ snapshot: window.__SS__!.audio.snapshot(), tick: window.__SS__!.tick() }));
            expect(stable.tick).toBe(before.tick);
            expect(stable.snapshot.music.position).toBe(away.snapshot.music.position);
            expect(stable.snapshot.cues).toEqual([]);
            const returned = await page.evaluate(async (trigger) => {
                const a = window.__SS__!;
                if (trigger === 'visibilitychange') {
                    delete (document as unknown as {
                        hidden?: boolean;
                    }).hidden;
                    document.dispatchEvent(new Event('visibilitychange'));
                    window.dispatchEvent(new Event('focus'));
                }
                else if (trigger === 'pagehide')
                    window.dispatchEvent(new Event('pageshow'));
                else
                    window.dispatchEvent(new Event('focus'));
                if (!a.audio.snapshot().muted)
                    await a.audio.unlock();
                return { snapshot: a.audio.snapshot(), tick: a.tick() };
            }, trigger);
            expect(returned.snapshot.state).toBe(muted ? 'suspended' : 'running');
            expect(Math.abs(returned.snapshot.music.position - stable.snapshot.music.position)).toBeLessThanOrEqual(0.05);
            expect(returned.tick).toBe(before.tick);
            await page.waitForTimeout(500);
            const after = await page.evaluate(() => ({ snapshot: window.__SS__!.audio.snapshot(), tick: window.__SS__!.tick() }));
            expect(after.snapshot.cues).toEqual([]);
            expect(after.tick).toBe(before.tick);
            if (muted)
                expect(after.snapshot.master).toBe(0);
            else
                expect(after.snapshot.master).toBeCloseTo(2, 3);
            // The game remains paused on return; its explicit Resume action restarts with released inputs.
            if (!muted) {
                await page.locator('[data-audio-pause] button').click();
                await page.waitForTimeout(60);
                await page.evaluate(() => window.__SS__!.pause());
                const input = await page.evaluate(() => window.__SS__!.getState().input.frame);
                expect(input.move).toEqual({ x: 0, z: 0 });
            }
            rows.push({ trigger, muted, suspendMs: before.suspendMs, positionDrift: returned.snapshot.music.position - stable.snapshot.music.position });
            await page.keyboard.up('KeyW');
        }
    mkdirSync(root, { recursive: true });
    writeFileSync(`${root}/background-${info.project.name}.json`, JSON.stringify(rows, null, 2) + '\n');
});
test('T-E16-18 @E16 @E16-AC18 @mobile first real gesture unlocks; haptics/settings and freeze/interrupted suspend', async ({ page }, info) => {
    await boot(page);
    expect(await page.evaluate(() => window.__SS__!.audio.snapshot().unlocked)).toBe(false);
    await page.evaluate(() => { (window as unknown as {
        vibrations: unknown[];
    }).vibrations = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p: unknown) => { (window as unknown as {
            vibrations: unknown[];
        }).vibrations.push(p); return true; } }); });
    await page.mouse.click(200, 250);
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().state)).toBe('running');
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); a.settings.set({ haptics: true }); a.survivor.damage(25); a.audio.emit({ type: 'explosion.beat', tick: 0, sourceId: 2, beat: 'crack', size: 'large', position: { x: 15, z: 0 } }); a.audio.emit({ type: 'vehicle.sound', tick: 0, sourceId: 3, phase: 'crash', position: { x: 2, z: 0 }, velocity: { x: 0, z: 0 }, rpm: 0, speed: 0, health: 1, impulse: 30 }); });
    expect(await page.evaluate(() => (window as unknown as {
        vibrations: unknown[];
    }).vibrations)).toHaveLength(3);
    await page.evaluate(() => { const a = window.__SS__!; a.settings.set({ haptics: false }); a.audio.emit({ type: 'player.damaged', tick: 0, id: 1, amount: 30 }); a.audio.emit({ type: 'explosion.beat', tick: 0, sourceId: 4, beat: 'crack', size: 'mega', position: { x: 15, z: 0 } }); });
    expect(await page.evaluate(() => (window as unknown as {
        vibrations: unknown[];
    }).vibrations)).toHaveLength(3);
    for (const trigger of ['freeze', 'pagehide', 'interrupted']) {
        await page.evaluate(async (trigger) => { if (trigger === 'freeze')
            document.dispatchEvent(new Event('freeze'));
        else if (trigger === 'pagehide')
            window.dispatchEvent(new Event('pagehide'));
        else
            await window.__SS__!.audio.interrupt(); }, trigger);
        await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().state)).toBe('suspended');
        expect(await page.evaluate(() => window.__SS__!.audio.snapshot().master)).toBe(0);
        await page.evaluate(async (trigger) => { if (trigger === 'freeze')
            document.dispatchEvent(new Event('resume'));
        else if (trigger === 'pagehide')
            window.dispatchEvent(new Event('pageshow'));
        else
            window.dispatchEvent(new Event('focus')); await window.__SS__!.audio.unlock(); }, trigger);
        await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().state)).toBe('running');
    }
    await page.locator('[data-audio-pause] button').click();
    await page.evaluate(() => window.__SS__!.pause());
    await page.evaluate(() => { const a = window.__SS__!; a.settings.set({ captions: true, noiseRings: true }); a.audio.emit({ type: 'dialogue', tick: 0, text: 'Safe zone ahead.', position: { x: -6, z: 6 } }); a.audio.emit({ type: 'noise', tick: 0, sourceId: 1, actionId: 'weapon.pistol', kind: 'ranged', position: { x: 0, y: 0.7, z: 0 }, radius: 25, loudness: 1 }); });
    await page.evaluate(() => window.__SS__!.audio.emit({ type: 'noise', tick: 0, sourceId: 1, actionId: 'weapon.fists', kind: 'melee', position: { x: 0, y: 0.7, z: 0 }, radius: 6, loudness: 1 }));
    await page.locator('[data-audio-controls]').evaluate(e => (e as HTMLDetailsElement).open = true);
    mkdirSync(root, { recursive: true });
    await page.screenshot({ path: `${root}/accessibility-${info.project.name}.png` });
});
