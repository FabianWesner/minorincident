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
    test.setTimeout(300_000);
    await boot(page);
    const war = await render(page, { scenario: 'audio-mix' }, 'audio-war-reference'), quiet = await render(page, { scenario: 'l5-quiet', level: 'L5', tier: 5 }, 'audio-l5-quiet');
    const loudWar = loudness(war.path), loudQuiet = loudness(quiet.path);
    writeFileSync(`${root}/audio-l5-vs-war.json`, JSON.stringify({ war: loudWar, quiet: loudQuiet, differenceLU: loudWar.lufs - loudQuiet.lufs, cues: [...new Set(quiet.result.events.map(e => e.cue))] }, null, 1));
    expect(quiet.result.events.some(e => e.cue.startsWith('music.') || e.cue.startsWith('stinger.'))).toBe(false);
    expect(loudWar.lufs - loudQuiet.lufs).toBeGreaterThanOrEqual(18);
});
