import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { AudioService } from '../../../src/audio/AudioService';
import { audioCues, audioFile, eventCues, pickupFanfare, pickupFanfareByAction, pickupFanfareDurations } from '../../../src/data/audioCues';
import { catalog } from '../../../src/data/actions/catalog';
import { synthesize } from '../../../src/audio/synthesis';
import imports from '../../../assets/audio/imports.json';

/** PO 2026-10-13: "When I get the machine gun, there is a sound sample from L1 that doesn't fit. Let's have some fanfare when I pick up a weapon that fits to the weapon". */
const pickupable = Object.keys(catalog).filter(id => !['weapon.fists', 'weapon.kick'].includes(id));

test('every pickup-able weapon, throwable and ability resolves to a fanfare cue of at most 2 s', () => {
    expect(pickupable.length).toBeGreaterThanOrEqual(30);
    for (const id of [...pickupable, 'weapon.pistol', 'weapon.machine-gun', 'weapon.army-mg']) {
        const cue = audioCues[`pickup.fanfare.${pickupFanfare(id)}`];
        expect(cue, id).toBeDefined();
        expect(cue.duration, id).toBeLessThanOrEqual(2);
        expect(cue.category).toBe('pickups');
    }
    for (const [action, name] of Object.entries(pickupFanfareByAction)) expect(pickupFanfare(action)).toBe(name);
    // The six hand-picked moods are distinct cues.
    const six = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher'].map(id => pickupFanfare(id));
    expect(new Set(six).size).toBe(6);
    expect(pickupFanfare('weapon.molotov')).toBe('molotov');
    expect(pickupFanfare('ability.corgi-lure')).toBe('corgi-lure');
    expect(pickupFanfare('weapon.katana')).toBe('melee');
    expect(pickupFanfare('weapon.smg')).toBe('gun');
    expect(pickupFanfare('weapon.smoke-grenade')).toBe('throwable');
    expect(pickupFanfare('ability.turret')).toBe('ability');
});

test('every fanfare has audio files, a synthesised body, and licence records for each recorded layer', () => {
    const layers = imports.fanfare as Record<string, { source: string; at: number; duration: number }[]>;
    const sources = imports.sources as Record<string, { license: string; author: string; url: string; licenseUrl: string }>;
    const licenses = readFileSync('public/assets/audio/LICENSES.md', 'utf8');
    for (const name of Object.keys(pickupFanfareDurations)) {
        const id = `pickup.fanfare.${name}`, cue = audioCues[id];
        expect(cue.shape).toBe('fanfare');
        const body = synthesize(cue, 48000);
        expect(body.length).toBe(Math.ceil(cue.duration * 48000));
        let peak = 0, energy = 0;
        for (const v of body) { peak = Math.max(peak, Math.abs(v)); energy += v * v; }
        expect(Number.isFinite(energy), id).toBe(true);
        expect(peak, id).toBeGreaterThan(0.3);
        expect(peak, id).toBeLessThanOrEqual(0.7);
        expect(layers[id]?.length, `${id} needs recorded foley`).toBeGreaterThan(0);
        for (const layer of layers[id]) {
            const source = sources[layer.source];
            expect(source, layer.source).toBeDefined();
            expect(source.license).toMatch(/^(CC0|CC-BY [34]\.0)$/);
            expect(source.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
            expect(layer.at + layer.duration, id).toBeLessThanOrEqual(cue.duration + 1e-9);
        }
        expect(licenses, id).toContain(`| ${id} (layer) |`);
    }
    for (const format of ['webm', 'm4a'] as const) {
        expect(existsSync(`public${audioFile('pickups', format)}`)).toBe(true);
        expect(licenses).toMatch(new RegExp(`\\| pickups\\.${format} \\|`));
    }
    expect(Object.keys(layers).sort()).toEqual(Object.keys(pickupFanfareDurations).map(n => `pickup.fanfare.${n}`).sort());
});

/** An AudioService with just enough state for event(): records every cue played and every music duck. */
function harness(level: string) {
    const played: string[] = [], ducks: number[] = [];
    const audio = Object.create(AudioService.prototype) as AudioService & Record<string, unknown>;
    Object.assign(audio, {
        loaded: true, unlocked: true, background: false, settings: { muted: false }, context: { state: 'running', currentTime: 5 },
        world: { entities: new Map(), tick: 1 }, level, l5Music: false, alarm: { onEvent: () => false },
        graph: { duckMusic: (_t: number, hold: number) => ducks.push(hold) },
        play: (id: string) => { played.push(id); return {}; }, stinger: (kind: string) => { played.push(`stinger.${kind}`); },
    });
    return { audio, played, ducks };
}
const weaponPickup = (actionId: string) => ({ type: 'pickup.collected' as const, tick: 1, sourceId: 1, pickupId: 0, side: 'RIGHT' as const, actionId, replaced: null });

test('a weapon pickup plays exactly its fanfare, ducks the score, and never the old L1 stinger or generic pickup tick', () => {
    for (const level of ['L1', 'L2', 'L4', 'L6']) {
        for (const id of ['weapon.army-mg', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.molotov', 'ability.corgi-lure']) {
            const { audio, played, ducks } = harness(level);
            audio.event(weaponPickup(id));
            expect(played, `${level} ${id}`).toEqual([`pickup.fanfare.${pickupFanfare(id)}`]);
            expect(played.some(c => c === 'stinger.weapon' || c === 'ui.pickup')).toBe(false);
            expect(ducks).toHaveLength(1);
            expect(ducks[0]).toBeLessThan(audioCues[played[0]].duration);
        }
    }
});

test('the scripted mission pickups (L3 handgun, L4 machine gun) no longer add the old pickup tick', () => {
    expect(eventCues['l3.handgun']).not.toBe('ui.pickup');
    expect(eventCues['l4.gun']).not.toBe('ui.pickup');
    expect(audioCues[eventCues['l4.gun']].gain).toBe(0);
    // The generic item pickup (medkit, key item) keeps the quiet tick, without the L1 score excerpt.
    const { audio, played } = harness('L1');
    audio.event({ type: 'pickup.collected', tick: 1, id: 7, kind: 'item', item: 'key' } as never);
    expect(played).toEqual(['ui.pickup']);
});

test('the silent L5 city keeps a quiet tick instead of a fanfare', () => {
    const { audio, played, ducks } = harness('L5');
    audio.event(weaponPickup('weapon.rocket-launcher'));
    expect(played).toEqual(['ui.pickup']);
    expect(ducks).toEqual([]);
});
