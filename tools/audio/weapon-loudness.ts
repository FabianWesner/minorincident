import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { audioCues, audioFile } from '../../src/data/audioCues';
import { catalog, mountedActions } from '../../src/data/actions/catalog';
import { loudness } from './measure';
/**
 * Offline loudness per weapon class (PO 10-15: "Loudness-matched (offline LUFS per weapon class, the shotgun louder than the handgun)").
 * Each cue's sprite slice is cut from the SHIPPED weapons.webm, padded with silence and measured with FFmpeg EBU R128 (integrated LUFS and true peak).
 * `lufs` is the sprite; `played` adds the cue's runtime gain (20 log10 gain), which is what the listener hears at the source.
 * Usage: npx tsx tools/audio/weapon-loudness.ts [--json]
 */
export type WeaponClass = 'melee' | 'throw' | 'handgun' | 'smg' | 'rifle' | 'machine-gun' | 'shotgun' | 'rocket' | 'minigun' | 'mounted' | 'reload';
export const weaponClasses: Record<string, WeaponClass> = {
    'weapon.fists': 'melee', 'weapon.kick': 'melee', 'weapon.bat': 'melee', 'weapon.crowbar': 'melee', 'weapon.machete': 'melee', 'weapon.knife': 'melee', 'weapon.nail-bat': 'melee',
    'weapon.shovel': 'melee', 'weapon.police-baton': 'melee', 'weapon.fire-axe': 'melee', 'weapon.katana': 'melee',
    'weapon.handgun': 'handgun', 'weapon.pistol': 'handgun', 'weapon.nail-gun': 'handgun', 'weapon.smg': 'smg', 'ability.turret': 'smg',
    'weapon.assault-rifle': 'rifle', 'weapon.hunting-rifle': 'rifle', 'weapon.machine-gun': 'machine-gun', 'weapon.army-mg': 'machine-gun',
    'weapon.shotgun': 'shotgun', 'weapon.rocket-launcher': 'rocket', 'weapon.rotary-minigun': 'minigun',
    'weapon.grenade': 'throw', 'weapon.molotov': 'throw', 'weapon.pipe-bomb': 'throw', 'weapon.smoke-grenade': 'throw', 'weapon.flashbang': 'throw', 'weapon.firecracker-lure': 'handgun',
};
export interface CueLoudness { id: string; cls: WeaponClass; lufs: number; truePeak: number; played: number }
export function measureCue(id: string, dir: string, sprites: Map<string, Buffer>): { lufs: number; truePeak: number } {
    const cue = audioCues[id], key = cue.category;
    if (!sprites.has(key)) sprites.set(key, spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', `public${audioFile(key, 'webm')}`, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 512 * 1024 * 1024 }).stdout);
    const pcm = sprites.get(key)!, from = Math.round(cue.offset * 48000) * 4, to = Math.min(pcm.length, from + Math.round(cue.duration * 48000) * 4);
    const pad = Buffer.alloc(48000 * 4), wav = join(dir, `${id}.f32`);
    writeFileSync(wav, Buffer.concat([pad, pcm.subarray(from, to), pad]));
    const out = join(dir, `${id}.wav`);
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '1', '-i', wav, out]);
    return loudness(out);
}
/** All cues (`action.<id>` plus the first take of each pool, the pump, hmg, reload) with their class. */
export function measureWeapons(): CueLoudness[] {
    const dir = mkdtempSync(join(tmpdir(), 'weapon-loudness-')), sprites = new Map<string, Buffer>(), rows: CueLoudness[] = [];
    try {
        const ids: [string, WeaponClass][] = [...Object.entries(weaponClasses).map(([id, cls]) => [`action.${id}`, cls] as [string, WeaponClass]),
            ['weapon.hmg', 'mounted'], ['weapon.pump', 'reload'], ['weapon.reload', 'reload'], ['weapon.reload-rifle', 'reload']];
        for (const [id, cls] of ids) {
            for (const take of ['', '.v1', '.v2', '.v3']) {
                if (!audioCues[id + take]) continue;
                const m = measureCue(id + take, dir, sprites);
                rows.push({ id: id + take, cls, lufs: m.lufs, truePeak: m.truePeak, played: m.lufs + 20 * Math.log10(audioCues[id + take].gain) });
            }
        }
    }
    finally { rmSync(dir, { recursive: true, force: true }); }
    return rows;
}
if (process.argv[1]?.endsWith('weapon-loudness.ts')) {
    void catalog; void mountedActions;
    const rows = measureWeapons(), classes = [...new Set(rows.map(r => r.cls))];
    if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
    else {
        console.log('| class | cues | mean LUFS (sprite) | mean LUFS (played, with cue gain) | worst true peak dBTP |', '\n| --- | --- | --- | --- | --- |');
        for (const cls of classes) {
            const r = rows.filter(x => x.cls === cls), mean = (f: (x: CueLoudness) => number) => (r.reduce((a, x) => a + f(x), 0) / r.length).toFixed(1);
            console.log(`| ${cls} | ${r.length} | ${mean(x => x.lufs)} | ${mean(x => x.played)} | ${Math.max(...r.map(x => x.truePeak)).toFixed(1)} |`);
        }
        console.log('\n| cue | class | LUFS | played | dBTP |\n| --- | --- | --- | --- | --- |');
        for (const r of rows.filter(x => !/\.v\d$/.test(x.id))) console.log(`| ${r.id} | ${r.cls} | ${r.lufs.toFixed(1)} | ${r.played.toFixed(1)} | ${r.truePeak.toFixed(1)} |`);
    }
}
