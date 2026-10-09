import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from '../fixtures';
import type { AudioRenderRequest } from '../../../src/debug/audioHarness';
import { loudness } from '../../../tools/audio/measure';

/** E23-AC14: the silent city. No music in the first 60 s, no battle layer ever, and a mix at least 18 LU below the L4 war phase. */
const root = 'test-results/epics/E23';
async function render(page: import('@playwright/test').Page, request: AudioRenderRequest, name: string) {
    const result = await page.evaluate(req => window.__SS__!.audio.render(req), request), bytes = Buffer.from(result.wav, 'base64');
    mkdirSync(root, { recursive: true });
    writeFileSync(`${root}/${name}.wav`, bytes);
    return { result, path: `${root}/${name}.wav` };
}
test('T-E23-14a @E23 @E23-AC14 no music cue in the first 60 s of L5 and no battle-layer cue at any time, while shooting the machine gun and meeting infected', async ({ page }) => {
    test.setTimeout(600_000);
    await boot(page);
    await page.mouse.click(200, 250);
    const log = await page.evaluate(async () => {
        const a = window.__SS__!;
        await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause(); a.missions.begin(); await a.audio.unlock(); a.cheats.god(true); a.audio.clearLog();
        a.bot.start('complete');
        const early: string[] = [], late: string[] = [];
        for (let second = 0; second < 90; second++) {
            await a.step(60);
            const time = a.missions.state()!.stats.time, cues = a.audio.snapshot().cues.map(c => c.cue); a.audio.clearLog();
            (time < 60 ? early : late).push(...cues);
        }
        return { early, late, time: a.missions.state()!.stats.time };
    });
    mkdirSync(root, { recursive: true }); writeFileSync(`${root}/audio-l5-log.json`, JSON.stringify({ early: [...new Set(log.early)], late: [...new Set(log.late)], time: log.time }, null, 1));
    expect(log.early.filter(c => c.startsWith('music.') || c.startsWith('stinger.') || c.startsWith('score.'))).toEqual([]);
    expect(log.late.filter(c => /^music\.L5\.(pulse|drive|peak)$/.test(c))).toEqual([]);
    expect([...log.early, ...log.late].filter(c => /siren|helicopter|megaphone|explosion\.(boom|roar)|tank|hmg/.test(c))).toEqual([]);
});
test('T-E23-14b @E23 @E23-AC14 the first 60 s of L5 measure at least 18 LU below the battle mix of L4\'s war phase (offline render of the production graph)', async ({ page }) => {
    test.setTimeout(900_000);
    mkdirSync(root, { recursive: true });
    await boot(page); await page.mouse.click(200, 250);
    const capture = async (level: 'L4' | 'L5'): Promise<AudioRenderRequest> => {
        await page.evaluate(async level => {
            const a = window.__SS__!; await a.loadLevel(level, { seed: 1, progression: level === 'L4' ? 'L4-default' : 'L5-default' });
            a.pause(); a.missions.begin(); a.cheats.god(true); await a.audio.unlock();
            if (level === 'L4') a.bot.start('complete'); else a.cheats.completeObjective('emerge');
        }, level);
        const cues: NonNullable<AudioRenderRequest['cues']> = [];
        let firstTurn = -1, lineBreak = -1, tick = 0;
        let score: AudioRenderRequest['score'];
        for (let i = 0; i < (level === 'L4' ? 2400 : 600); i++) {
            const frame = await page.evaluate(async () => {
                const a = window.__SS__!; await a.step(6);
                const state = a.getState(), p = state.player!.transform, audio = a.audio.snapshot();
                const events = a.events(); a.audio.clearLog();
                return { tick: state.tick, cues: audio.cues.map(c => ({ ...c, position: c.position ? { x: c.position.x - p.x, y: c.position.y, z: c.position.z - p.z } : undefined })),
                    first: events.find(e => e.type === 'l4.firstTurn')?.tick, last: events.find(e => e.type === 'l4.lineBreaks')?.tick,
                    score: audio.music.streamed.decks.find(d => d.state === 'combat') };
            });
            tick = frame.tick;
            if (frame.first !== undefined) firstTurn = frame.first;
            if (frame.last !== undefined) lineBreak = frame.last;
            for (const c of frame.cues) cues.push({ ...c, time: c.tick / 60 });
            if (frame.score && firstTurn >= 0) score = { file: frame.score.file, gain: frame.score.gain };
            if (level === 'L4' && lineBreak >= 0 || level === 'L5' && tick >= 3600) break;
            // Let native one-shot sources finish so capture uses the live voice limiter.
            await page.waitForTimeout(100);
        }
        if (level === 'L4') { expect(firstTurn).toBeGreaterThan(0); expect(lineBreak).toBeGreaterThan(firstTurn); }
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
