import type { NoiseKind } from './noise';
import { infectedDefinitions } from './infected';
import { catalog, balanceActions } from './actions/catalog';
import type { GameEvent } from '../sim/world/types';
import type { Surface, PropMaterial } from './audioEvents';
export const audioBuses = ['music', 'weapons', 'impacts', 'vehicles', 'props', 'gore', 'telegraph', 'ambience', 'dialogue', 'barks', 'ui'] as const;
export type AudioBus = typeof audioBuses[number];
export type SoundShape = 'shot' | 'noise' | 'tone' | 'vocal' | 'music' | 'step' | 'bed' | 'buzz' | 'chatter';
/** Sprite offsets are seconds; recorded and original cues share identical Opus/AAC grids. */
export interface AudioCue {
    id: string;
    category: string;
    offset: number;
    duration: number;
    bus: AudioBus;
    priority: number;
    gain: number;
    antiSpam: number;
    rateSpread: number;
    loop: boolean;
    caption?: string;
    frequency: number;
    shape: SoundShape;
    initial: boolean;
}
export const audioCues: Record<string, AudioCue> = {};
const offsets = new Map<string, number>();
function cue(id: string, bus: AudioBus, shape: SoundShape, duration = 0.3, frequency = 250, options: Partial<AudioCue> = {}): void {
    const category = options.category ?? bus;
    const offset = offsets.get(category) ?? 0;
    const priority = { weapons: 100, telegraph: 90, impacts: 80, dialogue: 75, barks: 70, vehicles: 60, gore: 45, props: 40, music: 35, ui: 35, ambience: 10 }[bus];
    audioCues[id] = { id, category, offset, duration, bus, shape, frequency, priority, gain: 0.35, antiSpam: 0.08, rateSpread: 0.06, loop: false, initial: !category.startsWith('music-L') || category === 'music-L1', ...options };
    offsets.set(category, offset + duration + 0.08);
}
const captions: Record<string, string> = { screamer: 'Screamer inhaling', runner: 'Runner snarling', crawler: 'Crawler scraping', brute: 'Brute roaring', bloated: 'Bloated gurgling', dog: 'Dog growling', cat: 'Cat hissing', crow: 'Crows cawing', lion: 'Lion roaring', gorilla: 'Gorilla beating its chest' };
export const telegraphCues: Record<string, string> = {};
for (const [index, def] of infectedDefinitions.entries()) {
    const name = def.id.split('.')[1], id = `telegraph.${name}`;
    telegraphCues[def.id] = id;
    cue(id, 'telegraph', ['riot', 'armored', 'firefighter', 'gorilla'].includes(name) ? 'step' : 'vocal', name === 'screamer' ? 0.8 : name === 'bloated' ? 1 : 0.4, 100 + index * 27, { gain: 0.6, caption: captions[name] ?? `${name[0].toUpperCase() + name.slice(1)} preparing an attack`, rateSpread: 0, antiSpam: 0 });
}
cue('screamer.scream', 'telegraph', 'vocal', 1.2, 700, { gain: 0.65, caption: 'Screamer shrieking', antiSpam: 0.3, rateSpread: 0 });
for (const name of ['zebra', 'civilian', 'explosive']) {
    telegraphCues[name] = `telegraph.${name}`;
    telegraphCues[`infected.${name}`] = `telegraph.${name}`;
    cue(`telegraph.${name}`, 'telegraph', 'vocal', 0.8, 160, { caption: `${name} approaching`, gain: 0.6 });
}
for (const def of [...Object.values(catalog), ...balanceActions.filter(d => !(d.id in catalog))])
    cue(`action.${def.id}`, 'weapons', def.category === 'ranged' ? 'shot' : 'noise', def.category === 'ranged' ? 0.16 : 0.24, 150, { gain: 0.8, antiSpam: 0.025 });
for (const env of ['street', 'interior', 'open'])
    cue(`tail.${env}`, 'weapons', 'noise', env === 'interior' ? 0.65 : 0.25, 500, { gain: 0.14 });
cue('weapon.rocket-whoosh', 'weapons', 'noise', 1, 600, { gain: 0.16, loop: true, antiSpam: 0 });
cue('weapon.reload', 'weapons', 'step', 0.4, 800);
cue('weapon.dry', 'weapons', 'step', 0.12, 1000);
export const surfaces: readonly Surface[] = ['asphalt', 'sidewalk', 'grass', 'wood', 'gravel', 'tile', 'metal', 'glass', 'water', 'blood'];
for (const [index, surface] of surfaces.entries())
    for (const actor of ['survivor', 'infected', 'corgi', 'tires'])
        cue(`footstep.${actor}.${surface}`, 'impacts', 'step', 0.3, 120 + index * 120 + (actor === 'corgi' ? 900 : 0), { gain: actor === 'survivor' ? 0.3 : 0.1, antiSpam: 0.12 });
export const propMaterials: readonly PropMaterial[] = ['wood', 'metal', 'plastic', 'glass', 'rubber', 'sandbag'];
for (const [i, material] of propMaterials.entries())
    cue(`prop.${material}`, 'props', 'step', 0.4, 160 + i * 310);
for (const id of ['brace', 'creak', 'break', 'roll', 'scrape'])
    cue(`prop.${id}`, 'props', id === 'creak' ? 'tone' : 'noise', id === 'roll' || id === 'scrape' ? 1 : 0.4, 300, { loop: id === 'roll' || id === 'scrape' });
for (const id of ['pull', 'sputter', 'idle'])
    cue(`generator.${id}`, 'props', id === 'pull' ? 'noise' : 'tone', id === 'idle' ? 1 : 0.4, 90, { loop: id === 'idle' });
for (const id of ['hum', 'flicker', 'break', 'power-on', 'power-off'])
    cue(`lamp.${id}`, 'props', id === 'hum' ? 'tone' : 'step', id === 'hum' ? 1 : 0.25, 120, { loop: id === 'hum' });
export const explosionBeats = ['tell', 'crack', 'boom', 'sub', 'debris', 'roar', 'crackle'] as const;
for (const beat of explosionBeats)
    cue(`explosion.${beat}`, 'impacts', beat === 'tell' ? 'tone' : beat === 'crack' ? 'shot' : beat === 'sub' ? 'tone' : 'noise', beat === 'sub' ? 0.8 : beat === 'roar' ? 1.5 : 0.4, beat === 'sub' ? 55 : beat === 'tell' ? 1400 : 200, { gain: 0.65, antiSpam: 0.02 });
cue('tinnitus', 'impacts', 'tone', 1.5, 3800, { gain: 0.06, rateSpread: 0 });
for (const id of ['engine-low', 'engine-high', 'sputter', 'fire', 'skid', 'horn', 'siren', 'crash', 'grab'])
    cue(`vehicle.${id}`, 'vehicles', id === 'crash' ? 'shot' : ['horn', 'siren', 'engine-low', 'engine-high'].includes(id) ? 'tone' : 'noise', id === 'crash' ? 0.4 : 1, id === 'engine-high' ? 160 : id === 'horn' ? 380 : id === 'siren' ? 700 : 80, { loop: ['engine-low', 'engine-high', 'sputter', 'fire', 'siren'].includes(id), caption: id === 'horn' ? 'Car horn' : id === 'siren' ? 'Police siren' : undefined });
for (const id of ['squelch', 'bone', 'splat'])
    cue(`gore.${id}`, 'gore', 'noise', 0.2, 130, { gain: 0.18 });
for (const variant of ['male', 'female'])
    for (const kind of ['effort', 'hurt', 'quip'])
        cue(`bark.${variant}.${kind}`, 'barks', 'vocal', kind === 'quip' ? 1.4 : 0.4, variant === 'female' ? 230 : 130, { antiSpam: kind === 'quip' ? 25 : 0.3, caption: kind === 'quip' ? 'Could really use a quieter neighborhood.' : undefined });
for (const id of ['warning', 'happy', 'hurt', 'pant'])
    cue(`corgi.${id}`, 'barks', 'vocal', 0.4, 450, { caption: id === 'warning' ? 'Corgi warning bark' : undefined });
for (const [id, text] of [['radio', 'Emergency broadcast: proceed to the safe zone.'], ['emergency', 'This is an emergency broadcast.'], ['safe-zone', 'Safe zone ahead. Keep moving.']])
    cue(`dialogue.${id}`, 'dialogue', 'vocal', 3, 185, { gain: 1, antiSpam: 0, rateSpread: 0, caption: text });
for (const id of ['click', 'switch', 'pickup', 'respawn', 'death', 'tick'])
    cue(`ui.${id}`, 'ui', 'tone', 0.1, 700, { gain: id === 'tick' ? 0 : 0.1 });
cue('civilian.hey', 'barks', 'vocal', .4, 200, { gain: .5, antiSpam: .3, caption: 'Hey!' });
cue('infected.vocal', 'barks', 'vocal', 0.6, 130, { gain: 0.12, antiSpam: 0.9 });
cue('horde.loop', 'ambience', 'bed', 2, 150, { loop: true, gain: 0.3, antiSpam: 0 });
for (const [i, surface] of surfaces.entries())
    cue(`horde.loop.${surface}`, 'ambience', 'bed', 2, 110 + i * 90, { loop: true, gain: 0.3, antiSpam: 0 });
export const ambienceTiers = [
    { beds: ['birds', 'wind', 'traffic'], oneShots: ['sprinkler', 'dog', 'lawnmower', 'basketball'] },
    { beds: ['birds', 'traffic', 'horns'], oneShots: ['siren', 'alarm', 'shout', 'news'] },
    { beds: ['sirens', 'helicopter'], oneShots: ['megaphone', 'radio', 'gunshot'] },
    { beds: ['wind', 'fire', 'hum'], oneShots: ['alarm', 'glass', 'explosion', 'power'] },
    { beds: ['fire-roar', 'moans'], oneShots: ['scream', 'automatic', 'collapse'] },
    { beds: ['wind', 'fire'], oneShots: ['debris', 'dog', 'helicopter'] },
] as const;
for (const [i, id] of [...new Set(ambienceTiers.flatMap(t => [...t.beds]))].entries())
    cue(`bed.${id}`, 'ambience', 'bed', ['birds', 'traffic', 'sirens'].includes(id) ? 12 : 2, 100 + i * 210, { gain: 0.18, loop: true });
for (const [i, id] of [...new Set(ambienceTiers.flatMap(t => [...t.oneShots]))].entries())
    cue(`ambient.${id}`, 'ambience', id === 'gunshot' || id === 'explosion' ? 'shot' : id === 'dog' || id === 'shout' || id === 'scream' ? 'vocal' : 'noise', 0.6, 160 + i * 70, { caption: id === 'alarm' ? 'Car alarm' : id === 'scream' ? 'Distant scream' : undefined });
export const musicLevels = { L1: 120, L2: 120, L3: 128, L4: 96, L5: 120, L6: 120 } as const;
export const musicLayers = ['base', 'pulse', 'drive', 'peak'] as const;
for (const [level, bpm] of Object.entries(musicLevels))
    for (const [i, layer] of musicLayers.entries())
        cue(`music.${level}.${layer}`, 'music', 'music', 960 / bpm, 130 + i * 90, { category: `music-${level}`, loop: true, gain: 0.35, rateSpread: 0, antiSpam: 0 });
for (const id of ['objective', 'weapon', 'elite', 'low-hp', 'twist', 'complete', 'dawn'])
    cue(`stinger.${id}`, 'music', 'music', id === 'dawn' ? 4 : 1, 200, { gain: 0.5, rateSpread: 0, antiSpam: 0 });
for (const kind of ['jukebox', 'ice-cream', 'car-radio', 'school-bell', 'pa', 'megaphone']) {
    cue(`diegetic.${kind}`, 'vehicles', kind === 'pa' || kind === 'megaphone' ? 'vocal' : 'music', 2, kind === 'ice-cream' ? 660 : 260, { loop: true, gain: 0.4, caption: kind === 'pa' || kind === 'megaphone' ? 'Safe zone announcement' : undefined });
    if (kind === 'jukebox' || kind === 'ice-cream')
        cue(`diegetic.${kind}.warped`, 'vehicles', 'music', 2, 240, { loop: true, gain: 0.32, rateSpread: 0 });
}
for (const weapon of ['fists', 'kick', 'bat', 'crowbar', 'machete'])
    cue(`flesh.${weapon}`, 'impacts', 'step', 0.35, 150, { gain: 0.65, antiSpam: 0.04, rateSpread: 0.06 });
cue('civilian.transform', 'barks', 'vocal', 1.6, 130, { gain: 0.45, antiSpam: 0.4, caption: 'Infection taking hold' });
cue('civilian.scream', 'barks', 'vocal', 1.2, 500, { gain: 0.4, antiSpam: 0.7, caption: 'Civilian screaming' });
/** Four independent sprite slices per repeated one-shot; selection never repeats its last slice. */
export const audioVariationPools: Record<string, string[]> = {};
for (const original of Object.values(audioCues)) {
    if (original.loop || !(/^(footstep\.|flesh\.|gore\.|corgi\.|civilian\.|infected\.vocal|telegraph\.|screamer\.scream|ambient\.(shout|scream)|ui\.(click|switch|pickup))/.test(original.id))) continue;
    const ids = [original.id];
    for (let variant = 1; variant < 4; variant++) {
        const id = `${original.id}.v${variant}`;
        cue(id, original.bus, original.shape, original.duration, original.frequency, { ...original, id, offset: offsets.get(original.category)! });
        ids.push(id);
    }
    audioVariationPools[original.id] = ids;
}
/** L1 v2 sound arc (lane H): calm layer, accident beats, chaos layer, fire-station interior. One sprite category. */
const arc = { category: 'l1arc', rateSpread: 0.04 } as const;
cue('l1.calm.chatter', 'ambience', 'chatter', 2, 260, { ...arc, loop: true, gain: 0.22, antiSpam: 0 });
cue('l1.calm.talk', 'ambience', 'vocal', 0.9, 170, { ...arc, gain: 0.2, antiSpam: 2 });
cue('l1.calm.traffic', 'ambience', 'noise', 1.2, 120, { ...arc, gain: 0.18, antiSpam: 3 });
cue('l1.calm.bike-tick', 'ambience', 'step', 0.25, 2400, { ...arc, gain: 0.14, antiSpam: 1 });
cue('l1.calm.birds', 'ambience', 'vocal', 0.5, 2600, { ...arc, gain: 0.1, antiSpam: 2 });
cue('l1.flicker.buzz', 'impacts', 'buzz', 1.5, 100, { ...arc, gain: 0.45, antiSpam: 0.5 });
cue('l1.blast', 'impacts', 'shot', 0.9, 70, { ...arc, gain: 0.8, antiSpam: 1, rateSpread: 0, caption: 'Muffled blast' });
cue('l1.glass.rattle', 'props', 'noise', 1, 4000, { ...arc, gain: 0.4, antiSpam: 0.5, caption: 'Glass rattling' });
cue('l1.ringing', 'impacts', 'tone', 1.2, 3800, { ...arc, gain: 0.08, antiSpam: 1, rateSpread: 0 });
cue('l1.scream', 'barks', 'vocal', 1.1, 520, { ...arc, gain: 0.5, antiSpam: 0.2, caption: 'Screams' });
cue('l1.crash', 'impacts', 'shot', 0.5, 200, { ...arc, gain: 0.55, antiSpam: 0.3 });
cue('l1.bell', 'props', 'tone', 1.5, 880, { ...arc, gain: 0.3, antiSpam: 2, rateSpread: 0, caption: 'Facility alarm bell' });
cue('l1.chaos.panic', 'ambience', 'chatter', 2, 330, { ...arc, loop: true, gain: 0.3, antiSpam: 0 });
cue('l1.chaos.infected', 'barks', 'vocal', 0.7, 120, { ...arc, gain: 0.35, antiSpam: 0.3, caption: 'Infected snarling' });
cue('l1.chaos.run', 'impacts', 'step', 0.3, 160, { ...arc, gain: 0.3, antiSpam: 0.15 });
cue('l1.chaos.car-alarm', 'vehicles', 'tone', 0.8, 900, { ...arc, gain: 0.3, antiSpam: 1, caption: 'Car alarm' });
cue('l1.chaos.fall', 'props', 'shot', 0.5, 150, { ...arc, gain: 0.4, antiSpam: 0.5 });
cue('l1.chaos.distant', 'ambience', 'vocal', 1, 420, { ...arc, gain: 0.25, antiSpam: 1, caption: 'Distant panic' });
cue('l1.interior.hush', 'ambience', 'bed', 2, 70, { ...arc, loop: true, gain: 0.25, antiSpam: 0 });
cue('l1.outro.sting', 'music', 'music', 2.5, 196, { ...arc, gain: 0.5, antiSpam: 0, rateSpread: 0 });
export const l1CalmCues = ['l1.calm.chatter', 'l1.calm.talk', 'l1.calm.traffic', 'l1.calm.bike-tick', 'l1.calm.birds'] as const;
export const l1AccidentCues = ['l1.flicker.buzz', 'l1.blast', 'l1.glass.rattle', 'l1.ringing', 'l1.scream', 'l1.crash', 'l1.bell'] as const;
export const l1ChaosCues = ['l1.chaos.panic', 'l1.chaos.infected', 'l1.chaos.run', 'l1.chaos.car-alarm', 'l1.chaos.fall', 'l1.chaos.distant'] as const;
/** Explicit coverage includes silent control events; these still resolve to a decodable cue. */
export const eventCues = {
    'level.started': 'ui.tick', 'sim.tick': 'ui.tick', 'scenario.loaded': 'ui.tick', 'scenario.unloaded': 'ui.tick',
    'civilian.bark': 'civilian.hey', 'story.say': 'ui.tick', 'civilian.state': 'ui.tick', 'civilian.eyes': 'civilian.transform', 'civilian.saved': 'stinger.objective', 'civilian.finished': 'ui.tick', 'civilian.turned': 'civilian.transform',
    'corgi.bark': 'corgi.warning', 'corgi.warn': 'corgi.warning', 'corgi.fetched': 'ui.pickup', 'escort.order': 'ui.switch', 'escort.downed': 'ui.tick', 'escort.revived': 'stinger.objective',
    'civilian.grabbed': 'telegraph.civilian', 'infected.prop-thrown': 'prop.wood', 'telegraph': 'telegraph.runner',
    'infected.attack': 'infected.vocal', 'infected.revived': 'telegraph.nurse', 'infected.leg-lost': 'gore.bone',
    noise: 'action.weapon.pistol', 'ai.alerted': 'ui.tick', 'combat.effect': 'ui.tick', 'pickup.collected': 'ui.pickup',
    'combat.attack': 'action.weapon.fists', 'combat.hit': 'gore.squelch', 'combat.kill': 'gore.bone', 'combat.hit-stop': 'ui.tick',
    'loadout.switched': 'ui.switch', 'combat.landed': 'gore.splat', 'combat.exploded': 'explosion.boom',
    'player.died': 'ui.death', 'player.respawned': 'ui.respawn', 'player.damaged': 'bark.female.hurt',
    footstep: 'footstep.survivor.asphalt', 'light.generator': 'generator.pull', 'light.lamp': 'lamp.hum', 'light.power': 'lamp.power-on',
    'prop.impact': 'prop.wood', 'prop.motion': 'prop.roll', 'barricade.sound': 'prop.creak', 'explosion.beat': 'explosion.boom',
    'vehicle.sound': 'vehicle.engine-low', diegetic: 'diegetic.jukebox', dialogue: 'dialogue.radio',
    'music.stinger': 'stinger.twist', 'music.intensity': 'ui.tick', 'corgi.sound': 'corgi.warning', 'survivor.bark': 'bark.female.effort', 'gore.sound': 'gore.squelch',
    // Integrated mission, interaction, vehicle and VFX events reuse the shipped sprites.
    'attack.resolved': 'ui.tick',
    'checkpoint.restored': 'ui.tick',
    'checkpoint.set': 'ui.tick',
    'cinematic.completed': 'ui.tick',
    'cinematic.started': 'ui.tick',
    'dialogue.line': 'dialogue.radio',
    'entity.spawned': 'ui.tick',
    'escort.rescued': 'stinger.objective',
    'gate.changed': 'ui.tick',
    'hazard.armed': 'explosion.tell',
    'hazard.electrified': 'lamp.power-on',
    'hazard.exploded': 'explosion.boom',
    'hazard.leaked': 'generator.sputter',
    'interact.completed': 'ui.switch',
    'interact.interrupted': 'ui.tick',
    'item.granted': 'ui.pickup',
    'level.completed': 'stinger.complete',
    'migration.started': 'ui.tick',
    'mission.briefing': 'ui.tick',
    'mission.failed': 'ui.death',
    'mission.signal': 'ui.tick',
    'mission.spawned': 'ui.tick',
    'objective.completed': 'stinger.objective',
    'objective.started': 'ui.tick',
    'progression.requested': 'ui.tick',
    'prop.broken': 'prop.break',
    'prop.ignited': 'explosion.crackle',
    'vehicle.burning': 'explosion.crackle',
    'vehicle.entered': 'ui.click',
    'vehicle.exited': 'ui.click',
    'vehicle.exploded': 'explosion.boom',
    'vehicle.feedback': 'ui.tick',
    'vehicle.grabbed': 'vehicle.grab',
    'vehicle.obstacle-broken': 'prop.break',
    'vehicle.recovering': 'ui.tick',
    'vehicle.shaken': 'prop.plastic',
    'vehicle.smoking': 'vehicle.crash',
    'vfx.effect': 'ui.tick',
    'world.blocker.changed': 'ui.tick',
    'world.tier-requested': 'ui.tick',
    // L1 v2 outbreak/accident events (L0 scaffold): silent until lane H assigns cues.
    'outbreak.bite': 'ui.tick', 'outbreak.distraction': 'ui.tick', 'outbreak.civilian-escaped': 'ui.tick', 'outbreak.infection': 'ui.tick',
    'l1.flicker': 'l1.flicker.buzz', 'l1.blast': 'l1.blast', 'l1.ringing': 'l1.ringing', 'l1.smoke': 'l1.bell', 'l1.screams': 'l1.scream', 'l1.infectedExit': 'l1.chaos.infected',
} satisfies Record<GameEvent['type'], string>;
export const audioCategories = [...offsets.keys()];
export function audioFile(category: string, format: 'webm' | 'm4a'): string { return `/assets/audio/${category}.${format}`; }
export function categoryDuration(category: string): number { return offsets.get(category)!; }
/** Noise events from weapons and world systems share AI hearing metadata and these cue IDs. */
export const noiseCues = {
    scream: 'screamer.scream',
    melee: 'action.weapon.fists', pistol: 'action.weapon.pistol', smg: 'action.weapon.smg', shotgun: 'action.weapon.shotgun', rifle: 'action.weapon.assault-rifle', machineGun: 'action.weapon.machine-gun',
    explosionSmall: 'explosion.boom', explosionMedium: 'explosion.boom', explosionLarge: 'explosion.boom', explosionMega: 'explosion.boom',
    horn: 'vehicle.horn', alarm: 'ambient.alarm', siren: 'vehicle.siren', firecracker: 'action.weapon.firecracker-lure', glass: 'lamp.break', barricade: 'prop.creak',
} satisfies Record<NoiseKind, string>;
