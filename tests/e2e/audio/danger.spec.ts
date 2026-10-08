import { mkdirSync, writeFileSync } from 'node:fs';
import { l2 } from '../../../src/data/l2';
import { boot, expect, test } from '../fixtures';

for (const level of ['L1', 'L2']) test(`@E16 ${level} visible outbreak encounter crossfades to danger and releases to ambient`, async ({ page }) => {
    await boot(page);
    await page.mouse.click(200, 250);
    await page.evaluate(async level => {
        const a = window.__SS__!;
        await a.loadLevel(level); a.missions.begin(); a.pause(); a.cheats.god(true);
        a.teleport('player', { x: 0, z: 0 });
        a.cheats.killAll();
        await a.audio.unlock(); a.resume();
    }, level);
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.find(d => d.state === 'calm')?.gain ?? 0), { timeout: 8000 }).toBeGreaterThan(0.45);
    const started = Date.now();
    await page.evaluate(level => {
        const a = window.__SS__!;
        if (level === 'L1') a.audio.emit({ type: 'l1.screams', tick: a.tick(), anchor: 'lab-exit-window' } as never);
        const p = a.getEntity(1)!.transform;
        a.spawn('infected.runner', { x: p.x + 4, z: p.z }, { state: 'chase' });
    }, level);
    const samples: { ms: number; music: Awaited<ReturnType<typeof snapshot>> }[] = [];
    async function snapshot() { return page.evaluate(() => window.__SS__!.audio.snapshot().music); }
    await expect.poll(async () => {
        const music = await snapshot(); samples.push({ ms: Date.now() - started, music });
        return music.streamed.decks.find(d => d.state === 'combat')?.gain ?? 0;
    }, { timeout: 1500, intervals: [50] }).toBeGreaterThan(0.5).catch(async error => {
        mkdirSync('test-results/epics/E16', { recursive: true });
        writeFileSync(`test-results/epics/E16/danger-${level}-failure.json`, JSON.stringify({ samples, state: await page.evaluate(() => ({ audio: window.__SS__!.audio.snapshot(), tick: window.__SS__!.tick(), player: window.__SS__!.getEntity(1), infected: window.__SS__!.query({ kind: 'infected' }) })) }, null, 2));
        throw error;
    });
    expect(samples.at(-1)!.music.state).toBe('combat');
    mkdirSync('test-results/epics/E16', { recursive: true });
    await page.screenshot({ path: `test-results/epics/E16/danger-${level}-encounter.png` });
    await page.waitForTimeout(1000);
    expect((await snapshot()).streamed.decks.find(d => d.state === 'calm')!.gain).toBeLessThan(0.01);
    // Remove live threats without changing the music director or emitting intensity events.
    await page.evaluate(() => {
        const a = window.__SS__!;
        for (const e of a.query({ kind: 'infected' })) a.teleport(e.id, { x: 100, z: 100 });
    });
    const left = Date.now();
    await page.waitForTimeout(5500);
    expect((await snapshot()).state).toBe('combat');
    await expect.poll(async () => {
        const music = await snapshot(); samples.push({ ms: Date.now() - started, music });
        return (music.streamed.decks.find(d => d.state === 'calm')?.gain ?? 0) > 0.45
            && (music.streamed.decks.find(d => d.state === 'combat')?.gain ?? 0) < 0.01;
    }, { timeout: 3000, intervals: [100] }).toBe(true);
    const releaseMs = Date.now() - left;
    expect(releaseMs).toBeGreaterThan(6000);
    expect(releaseMs).toBeLessThan(8200);
    expect((await snapshot()).streamed.decks.find(d => d.state === 'combat')!.gain).toBeLessThan(0.01);
    for (const sample of samples) expect(sample.music.streamed.decks.reduce((n, d) => n + d.gain, 0)).toBeLessThanOrEqual(0.601);
    mkdirSync('test-results/epics/E16', { recursive: true });
    writeFileSync(`test-results/epics/E16/danger-${level}.json`, JSON.stringify({ onsetMs: samples.find(s => (s.music.streamed.decks.find(d => d.state === 'combat')?.gain ?? 0) > 0.5)?.ms, releaseMs, samples }, null, 2));
});

test('@E16 L2 escape keeps dramatic rock with zero nearby infected until the safe checkpoint', async ({ page }) => {
    await boot(page); await page.mouse.click(200, 250);
    await page.evaluate(async () => {
        const a = window.__SS__!;
        await a.loadLevel('L2'); a.missions.begin(); a.pause(); a.cheats.god(true);
        await a.step(1);
        for (const id of ['calm', 'board', 'ride', 'doors']) a.missions.completeObjective(id);
        a.teleport('player', { x: 0, z: 0 });
        a.cheats.killAll();
        await a.audio.unlock(); a.resume();
    });
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.find(d => d.state === 'combat')?.gain ?? 0), { timeout: 2500 }).toBeGreaterThan(0.5);
    const samples = [];
    for (let i = 0; i < 10; i++) {
        // Ten seconds exceeds local-threat hysteresis. Newly spawned infected are moved out of sight each sample.
        await page.evaluate(() => {
            const a = window.__SS__!;
            for (const e of a.query({ kind: 'infected' })) a.teleport(e.id, { x: 100, z: 100 });
        });
        await page.waitForTimeout(1000);
        const sample = await page.evaluate(() => {
            const a = window.__SS__!, p = a.getEntity(1)!.transform;
            return { music: a.audio.snapshot().music, nearby: a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 12).length };
        });
        expect(sample.nearby).toBe(0);
        expect(sample.music.story).toEqual({ beat: 'escape', minimum: 0.5 });
        expect(sample.music.streamed.decks.find(d => d.state === 'combat')!.gain).toBeGreaterThan(0.5);
        samples.push(sample);
    }
    // Cross the real police checkpoint volume; the story controller declares it safe.
    await page.evaluate(pos => window.__SS__!.teleport('player', pos), { x: l2.checkpoint.gateX + 2, z: 30 });
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.story.minimum), { timeout: 3000 }).toBe(0);
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.find(d => d.state === 'combat')?.gain ?? 0), { timeout: 8500 }).toBeLessThan(0.01);
    mkdirSync('test-results/epics/E16', { recursive: true });
    writeFileSync('test-results/epics/E16/danger-L2-escape.json', JSON.stringify(samples, null, 2));
});
