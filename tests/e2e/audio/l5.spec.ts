import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect, testUrl } from '../fixtures';
import type { AudioRenderRequest } from '../../../src/debug/audioHarness';
import { loudness } from '../../../tools/audio/measure';
import { l4 } from '../../../src/data/l4';

/** E23-AC14: the silent city. No music before the first find, no battle layer ever, and a mix at least 18 LU below the L4 war phase. */
// The complete war capture makes thousands of nonvisual RPCs. DOM tracing
// repeatedly snapshots the paused HUD; retain cue JSON, WAVs and numeric receipts.
test.use({ trace: 'off' });
const root = 'test-results/epics/E23';
async function render(page: import('@playwright/test').Page, request: AudioRenderRequest, name: string) {
    const result = await page.evaluate(req => window.__SS__!.audio.render(req), request), bytes = Buffer.from(result.wav, 'base64');
    mkdirSync(root, { recursive: true });
    writeFileSync(`${root}/${name}.wav`, bytes);
    return { result, path: `${root}/${name}.wav` };
}
test('T-E23-14a @E23 @E23-AC14 PO #19c zero music before survivor 1, current recording within 2 s after, including restore', async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page); await page.mouse.click(200, 250);
    await page.evaluate(async () => {
        const a = window.__SS__!;
        await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause(); a.missions.begin(); await a.audio.unlock();
        a.cheats.completeObjective('emerge');
        const health = a.getState().player!.health; a.survivor.damage(health.current - health.max * .15); await a.step(120 * 60);
    });
    const before = await page.evaluate(() => window.__SS__!.audio.snapshot());
    expect(before.music.streamed.decks.filter(d => !d.paused)).toEqual([]);
    expect(before.cues.filter(c => /^(music|score|stinger)\./.test(c.cue))).toEqual([]);
    const quiet = await render(page, { scenario: 'cue-log', level: 'L5', duration: 3, cues: [] }, 'audio-before-survivor-1');
    expect(quiet.result.voices).toBe(0);
    await page.evaluate(async () => {
        const a = window.__SS__!; a.missions.restore('outside'); a.bot.start('complete');
        for (let i = 0; i < 180 && !a.missions.state()!.l5!.found; i++) await a.step(30);
        a.bot.stop();
    });
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('survivor-1');
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.filter(d => !d.paused && d.gain > 0).map(d => d.file)), { timeout: 2000 }).toEqual(['calm-L5']);
    const deck = await page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.find(d => !d.paused)!);
    const music = await render(page, { scenario: 'cue-log', level: 'L5', duration: 3, cues: [], score: { file: deck.file, gain: deck.gain } }, 'audio-after-survivor-1');
    expect(loudness(music.path).lufs).toBeGreaterThan(-60);
    for (const checkpoint of ['survivor-1', 'survivor-5']) {
        if (checkpoint === 'survivor-5') await page.evaluate(async () => { const a = window.__SS__!; a.cheats.completeObjective('look'); await a.step(2); });
        // Stop the live score first: restoring a found survivor must restart it from silence.
        await page.evaluate(async () => { const a = window.__SS__!; a.missions.restore('outside'); await a.step(2); });
        await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.filter(d => !d.paused).map(d => d.file)), { timeout: 2000 }).toEqual([]);
        await page.evaluate(async id => { const a = window.__SS__!; a.missions.restore(id); await a.step(2); }, checkpoint);
        await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.decks.filter(d => !d.paused && d.gain > 0).map(d => d.file)), { timeout: 2000 }).toEqual(['calm-L5']);
    }
});
test('T-E23-14b @E23 @E23-AC14 the first 60 s of L5 measure at least 18 LU below the battle mix of L4\'s war phase (offline render of the production graph)', async ({ page }) => {
    test.setTimeout(900_000);
    mkdirSync(root, { recursive: true });
    await boot(page, `${testUrl}&scenelab=1`); await page.mouse.click(200, 250);
    const capture = async (level: 'L4' | 'L5'): Promise<AudioRenderRequest> => {
        await page.evaluate(async level => {
            const a = window.__SS__!; await a.loadLevel(level, { seed: 1, progression: level === 'L4' ? 'L4-default' : 'L5-default' });
            a.pause(); a.missions.begin(); a.cheats.god(true); await a.audio.unlock();
            if (level === 'L4') a.bot.start('complete'); else a.cheats.completeObjective('emerge');
            // This gate measures audio, not pixels. Keep the complete production
            // sim/cue window and live voice waits without drawing it in SwiftShader.
            (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game.view.freeze();
        }, level);
        const cues: NonNullable<AudioRenderRequest['cues']> = [];
        let firstTurn = -1, lineBreak = -1, tick = 0;
        let score: AudioRenderRequest['score'];
        let captureSteps = level === 'L4' ? 2400 : 600;
        for (let i = 0; i < captureSteps; i++) {
            const frame = await page.evaluate(async () => {
                const a = window.__SS__!; await a.step(6);
                const state = a.getState(), p = state.player!.transform, audio = a.audio.snapshot();
                const events = a.events(); a.audio.clearLog();
                return { tick: state.tick, cues: audio.cues.map(c => ({ ...c, position: c.position ? { x: c.position.x - p.x, y: c.position.y, z: c.position.z - p.z } : undefined })),
                    first: events.find(e => e.type === 'l4.firstTurn')?.tick, last: events.find(e => e.type === 'l4.lineBreaks')?.tick,
                    score: audio.music.streamed.decks.find(d => d.state === 'combat') };
            });
            tick = frame.tick;
            if (frame.first !== undefined && firstTurn < 0) {
                firstTurn = frame.first;
                // Keep the existing pre-turn setup guard, then record the complete current war.
                // PO 10-12's collapse is ~190 s after the turn, beyond the old 240 s total cutoff.
                captureSteps = i + Math.ceil(l4.lineBreak.defenseS * 60 / 6) + 1;
            }
            if (frame.last !== undefined) lineBreak = frame.last;
            for (const c of frame.cues) cues.push({ ...c, time: c.tick / 60 });
            if (frame.score && firstTurn >= 0) score = { file: frame.score.file, gain: frame.score.gain };
            if (level === 'L4' && lineBreak >= 0 || level === 'L5' && tick >= 3600) break;
            // Let native one-shot sources finish so capture uses the live voice limiter.
            await page.waitForTimeout(100);
        }
        if (level === 'L4') {
            expect(firstTurn).toBeGreaterThan(0); expect(lineBreak).toBeGreaterThan(firstTurn);
            expect(lineBreak - firstTurn).toBeLessThanOrEqual(l4.lineBreak.defenseS * 60);
        }
        const start = level === 'L4' ? firstTurn / 60 : 0, duration = level === 'L4' ? (lineBreak - firstTurn) / 60 : 60;
        const beds = cues.filter(c => c.cue.startsWith('bed.') && c.time < start).map(c => ({ ...c, time: 0 }));
        const windowCues = cues.filter(c => c.time >= start && c.time < start + duration).map(c => ({ ...c, time: c.time - start }));
        const request: AudioRenderRequest = { scenario: 'cue-log', level, duration, cues: [...beds, ...windowCues], ...(level === 'L4' && score ? { score } : {}) };
        writeFileSync(`${root}/audio-${level}-production-log.json`, JSON.stringify({ firstTurn, lineBreak, request }, null, 1));
        return request;
    };
    const quiet = await render(page, await capture('L5'), 'audio-l5-quiet'), war = await render(page, await capture('L4'), 'audio-war-reference');
    const loudWar = loudness(war.path), loudQuiet = loudness(quiet.path);
    writeFileSync(`${root}/audio-l5-vs-war.json`, JSON.stringify({ war: loudWar, quiet: loudQuiet, differenceLU: loudWar.lufs - loudQuiet.lufs, cues: [...new Set(quiet.result.events.map(e => e.cue))] }, null, 1));
    expect(quiet.result.events.map(e => e.cue)).toEqual(expect.arrayContaining(['bed.wind', 'bed.fire']));
    expect(war.result.events.some(e => e.cue.startsWith('action.weapon.') || e.cue.startsWith('explosion.'))).toBe(true);
    expect(quiet.result.events.some(e => e.cue.startsWith('music.') || e.cue.startsWith('stinger.'))).toBe(false);
    expect(loudWar.lufs - loudQuiet.lufs).toBeGreaterThanOrEqual(18);
});
