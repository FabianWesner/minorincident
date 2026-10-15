import { expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { audioCues, audioVariationPools, noiseCues, weaponSlices } from '../../../src/data/audioCues';
import { catalog, balanceActions, mountedActions } from '../../../src/data/actions/catalog';
import imports from '../../../assets/audio/imports.json';
import { audioCredits } from '../../../src/data/credits';
import { measureCue, weaponClasses } from '../../../tools/audio/weapon-loudness';

/** PO bug 36 (10-15): "For all weapons make sure we use proper sounds". Every catalogued weapon id has a recorded cue with takes. */
const everyAction = { ...Object.fromEntries(balanceActions.map(a => [a.id, a])), ...catalog, ...mountedActions };
const recipes = imports.cues as Record<string, { source: string; start: number }>;
// E05 test fixture and the three synthesized support abilities (no weapon sound to curate) are the only ids without a recorded recipe.
const synthOk = new Set(['weapon.test-projectile', 'ability.corgi-lure', 'ability.shield-bubble', 'ability.adrenaline']);

test('every catalogued weapon id maps to a recorded cue with four takes', () => {
    const ids = Object.keys(everyAction);
    expect(ids.length).toBeGreaterThan(30);
    expect(ids).toContain('weapon.rotary-minigun');
    for (const id of ids) {
        expect(audioCues[`action.${id}`], `no cue for ${id}`).toBeDefined();
        if (synthOk.has(id)) continue;
        expect(recipes[`action.${id}`], `${id} has no recorded recipe`).toBeDefined();
        if (!(`action.${id}` in audioVariationPools)) { expect(['weapon.fists', 'weapon.kick', 'weapon.bat', 'weapon.crowbar', 'weapon.machete']).toContain(id); continue; } // the five original melee swings keep their single take
        expect(audioVariationPools[`action.${id}`], `${id} has no takes`).toHaveLength(4);
        for (const take of audioVariationPools[`action.${id}`]) expect(recipes[take], take).toBeDefined();
    }
    for (const id of Object.keys(weaponSlices)) expect(everyAction[id], `weaponSlices names an unknown action: ${id}`).toBeDefined();
});

test('every noise kind, the HMG, pump, reload, dry and minigun whir resolve to recorded cues', () => {
    for (const id of Object.values(noiseCues)) expect(audioCues[id], id).toBeDefined();
    for (const id of ['weapon.hmg', 'weapon.pump', 'weapon.reload', 'weapon.reload-rifle', 'weapon.dry', 'weapon.minigun-whir', 'tail.street', 'tail.interior', 'tail.open'])
        expect(recipes[id], id).toBeDefined();
    expect(audioCues['weapon.minigun-whir'].loop).toBe(true);
    expect(audioCues['tail.interior'].duration).toBeGreaterThan(audioCues['tail.street'].duration);
});

test('voice limits: a gun cue is never anti-spammed below its own rate of fire', () => {
    for (const [id, def] of Object.entries(everyAction)) {
        const cue = audioCues[`action.${id}`];
        if (def.category !== 'ranged' || !def.fireRate) continue;
        expect(cue.antiSpam, id).toBeLessThanOrEqual(1 / def.fireRate + 1e-9);
        // rapid fire does not smear: a 20 rps minigun round must end before the next one
        if (def.fireRate >= 10) expect(cue.duration, id).toBeLessThanOrEqual(0.5);
    }
});

test('weapon sources are CC0 / CC-BY with a recorded licence snapshot and credit', () => {
    const sources = imports.sources as Record<string, { license: string; licenseUrl: string; url: string; downloadSha256: string; sha256: string }>;
    for (const [cue, recipe] of Object.entries(recipes)) {
        if (!/^(action\.(weapon|ability)\.|weapon\.|tail\.)/.test(cue)) continue;
        const s = sources[recipe.source];
        expect(s, cue).toBeDefined();
        expect(s.license, cue).toMatch(/^(CC0|CC-BY)/);
        expect(s.url).toMatch(/^https:/);
        expect(s.downloadSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(JSON.stringify(audioCredits)).toBeDefined();
});

const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && existsSync('public/assets/audio/weapons.webm');
test.skipIf(!ffmpeg)('offline loudness: shotgun >= 4 LU above the handgun, every weapon cue <= -1 dBTP', () => {
    const dir = mkdtempSync(join(tmpdir(), 'weapon-audio-')), sprites = new Map<string, Buffer>();
    try {
        const lufs = (id: string) => { const takes = audioVariationPools[id] ?? [id], m = takes.map(t => measureCue(t, dir, sprites)); return m.reduce((a, x) => a + x.lufs, 0) / m.length; };
        expect(lufs('action.weapon.shotgun') - lufs('action.weapon.handgun')).toBeGreaterThanOrEqual(4);
        expect(lufs('action.weapon.rocket-launcher')).toBeGreaterThan(lufs('action.weapon.handgun'));
        for (const id of [...Object.keys(weaponClasses).map(w => `action.${w}`), 'weapon.hmg', 'weapon.pump', 'weapon.reload', 'weapon.reload-rifle', 'weapon.dry', 'weapon.minigun-whir', 'tail.interior'])
            for (const take of audioVariationPools[id] ?? [id])
                expect(measureCue(take, dir, sprites).truePeak, take).toBeLessThanOrEqual(-1);
    }
    finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);
