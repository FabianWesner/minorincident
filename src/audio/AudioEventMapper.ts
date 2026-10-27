import { megaBands, cureRecordingText, isMega } from '../data/megaPresentation';
import { apcEngineStages, apcDamageCaptions } from './apcEngine';
import { action } from '../data/actions/catalog';
import type { SimWorld } from '../sim/world/SimWorld';
import type { GameEvent } from '../sim/world/types';
import type { SoundPosition } from '../data/audioEvents';
import { audioCues, noiseCues, eventCues, telegraphCues, megaCueRates } from '../data/audioCues';
import type { AudioGraph, GraphVoice, PlayOptions } from './AudioGraph';
import { surfaceAt, zoneAt, dbGain } from './acoustics';
import type { MusicIntensity } from './MusicDirector';
import { l1v2 } from '../data/l1v2';
import { l5 } from '../data/l5';
import { humanInfected } from '../data/infected';
import type { L1ArcDirector } from './L1Arc';
import type { BaseAlarm } from './BaseAlarm';

/** Playback stays with AudioService; this adapter owns event reactions and their policy state. */
export interface AudioEventHost {
    readonly world: SimWorld;
    readonly context: AudioContext;
    readonly graph: AudioGraph;
    readonly alarm: BaseAlarm;
    arc(): L1ArcDirector | null;
    level(): string;
    l5Music(): boolean;
    readonly settings: { tinnitus: boolean };
    available(): boolean;
    offscreen(position: SoundPosition): boolean;
    play(id: string, options?: PlayOptions, sourceId?: number): GraphVoice | null;
    loop(key: string, id: string, options: PlayOptions, sourceId?: number): GraphVoice | null;
    stopLoop(key: string): void;
    caption(text: string, position?: SoundPosition, duration?: number): void;
    ring(position: SoundPosition, radius: number): void;
    haptic(kind: 'hit' | 'explosion' | 'crash'): void;
    musicIntensity(input: MusicIntensity): void;
    stinger(kind: string, level: string): void;
    pickupFanfare(actionId: string): void;
    update(): void;
}

/** E23 signs of life: each survivor's sound is an existing cue (knock, clang, radio, a soft voice, a flashlight click). */
const l5CueSounds: Record<string, { cue: string; gain: number; rate: number }> = {
    dale: { cue: 'impact.body.metal', gain: 1.2, rate: 0.8 }, rosa: { cue: 'door.wood', gain: 1.1, rate: 0.9 }, okafor: { cue: 'bark.male.effort', gain: 0.7, rate: 0.7 },
    mia: { cue: 'dialogue.radio', gain: 0.45, rate: 1 }, sam: { cue: 'ui.switch', gain: 2.5, rate: 0.8 },
};
/** Recorded infected voice cues (alert, hurt, death) are human performances: animals keep their own telegraphs. */
const voicedInfected = new Set(humanInfected.map(d => d.id));
/** Melee weapons without their own recorded hit take reuse the nearest existing one (blades like the machete, blunt tools like the bat or crowbar). */
const fleshLike: Record<string, string> = { knife: 'machete', katana: 'machete', 'fire-axe': 'machete', 'nail-bat': 'bat', shovel: 'crowbar', 'police-baton': 'bat' };
/** Maps the real producer events and lab events through the same ordered cue path. */
export class AudioEventMapper {
    ambienceDuckUntil = 0;
    readonly corgiWarnAt = new Map<string, number>();
    attackMusicUntil = 0;
    externalIntensity: MusicIntensity | null = null;
    incident = false;
    complete = false;
    constructor(private readonly host: AudioEventHost) {}
    /** Event → cue adapter. Real producer events and lab tests go through this identical path. */
    event(event: GameEvent): void {
        if ((event.type === 'combat.hit' || event.type === 'combat.kill') && event.actionId === 'cure') return;
        if (event.type === 'weather.lightning') return; // Thunder follows the sim distance delay.
        if (!this.host.available())
            return;
        const t = this.host.context.currentTime;
        const source = 'sourceId' in event ? event.sourceId : 'id' in event && typeof event.id === 'number' ? event.id : undefined;
        const entity = source === undefined ? undefined : this.host.world.entities.get(source);
        const position = 'position' in event ? event.position : entity?.transform;
        if (event.type.startsWith('l1.')) {
            this.host.arc()?.event(event.type, t);
            return;
        }
        if (this.host.alarm.onEvent(event, t)) return;
        if (event.type === 'l6.bang') { this.host.play('door.wood', { position: event.position, gain: 1, lowpass: 1800 }); return; }
        if (event.type === 'l5.wait') {
            this.host.play('civilian.hey', { position, gain: 0.7, rate: 0.9 }, source);
            return;
        }
        if (event.type === 'l5.cue') {
            // A sign of life: the knock, the clang, the radio, the voice or the flashlight click of that survivor, positional, with its caption.
            const sound = l5CueSounds[event.key] ?? { cue: 'door.wood', gain: 0.8, rate: 1 };
            this.host.play(sound.cue, { position: event.position, gain: sound.gain, rate: sound.rate });
            this.host.caption(event.text, event.position, 4);
            return;
        }
        if (event.type === 'l2.cue') {
            this.host.play(event.cue, { position: event.position, gain: event.gain, lowpass: event.lowpass });
            return;
        }
        if (event.type === 'sim.tick') {
            this.host.update();
            return;
        }
        if (event.type === 'civilian.state') {
            if (event.state === 'bitten') this.host.play('civilian.scream', { position, gain: .4 }, source);
            if (event.state === 'down') this.host.play('bark.female.hurt', { position, gain: .4 }, source);
            if (event.state === 'rising') this.host.play('civilian.transform', { position, gain: .45 }, source);
            return; // One-shots only: keep the collapse quiet between state reactions.
        }
        if (event.type === 'barricade.damaged') return; // The paired barricade.sound event owns the impact cue.
        if (event.type === 'mega.cue') {
            const cue = `mega.${event.kind}`;
            this.host.play(cue, { gain: megaBands[event.band].gain, rate: megaCueRates[cue], lowpass: 900, dry: true }, event.sourceId);
            return;
        }
        if (event.type === 'telegraph') {
            if (isMega(entity) && 'special' in event) {
                const cue = event.special === 'alpha.charge' ? 'mega.charge' : event.special === 'alpha.ground-slam' ? 'mega.slam' : event.special === 'alpha.grab-throw' ? 'mega.grab' : 'mega.roar';
                this.host.play(cue, { gain: 1, rate: megaCueRates[cue], priority: 150, dry: true }, source);
                return;
            }
            const special = 'special' in event ? event.special : event.kind;
            const id = telegraphCues[special] ?? telegraphCues[entity?.archetype ?? ''] ?? telegraphCues[`infected.${special}`] ?? eventCues.telegraph;
            if ('duration' in event && (special === 'alpha.charge' || special === 'alpha.ground-slam')) this.host.caption(special === 'alpha.charge' ? 'Alpha charging: clear the marked path' : 'Alpha ground slam: leave the marked circle', position, event.duration);
            this.host.play(id, { position, offscreen: position ? this.host.offscreen(position) : false }, source);
            return;
        }
        if (event.type === 'noise') {
            const id = audioCues[`action.${event.actionId}`] ? `action.${event.actionId}` : noiseCues[event.kind as keyof typeof noiseCues] ?? `action.${event.actionId}`;
            this.host.play(id, { position: event.position, gain: event.loudness, offscreen: audioCues[id]?.bus === 'telegraph' && this.host.offscreen(event.position) }, source);
            const zone = zoneAt(this.host.graph.map, event.position);
            // Shotgun: the pump racks the next shell 0.45 s behind the blast (PO 10-15).
            if (event.actionId === 'weapon.shotgun')
                this.host.play('weapon.pump', { position: event.position, time: this.host.context.currentTime + 0.45 }, source);
            if (event.kind === 'ranged')
                this.host.play(`tail.${zone.startsWith('interior') || zone === 'tunnel' ? 'interior' : zone === 'park' || zone === 'suburb-open' ? 'open' : 'street'}`, { position: event.position }, source);
            if (source === 1)
                this.host.ring(event.position, event.radius);
            return;
        }
        if (event.type === 'combat.attack') {
            if (source === 1) {
                this.attackMusicUntil = t + 0.2;
                this.host.musicIntensity({ alerted: 0, danger: true });
            }
            if (!['ranged', 'throwable'].includes(action(event.actionId).category))
                this.host.play(`action.${event.actionId}`, { position, rate: event.style === 'roundhouse' ? .62 : event.actionId === 'weapon.bat' ? .8 : event.actionId === 'weapon.crowbar' ? .95 : event.actionId === 'weapon.machete' ? 1.3 : event.actionId === 'weapon.kick' ? .72 : 1.15 }, source);
            return;
        }
        if (event.type === 'footstep') {
            if (event.actor === 'infected')
                return;
            const surface = event.surface ?? surfaceAt(this.host.graph.map, event.position);
            const weatherStep = this.host.world.weather?.kind === 'snow' ? 'weather.footstep.snow' : this.host.world.weather?.rain ? 'weather.footstep.wet' : `footstep.${event.actor}.${surface}`;
            this.host.play(weatherStep, { position: event.position }, source);
            return;
        }
        if (event.type === 'light.generator') {
            if (event.phase === 'stop')
                this.host.stopLoop(`generator:${source}`);
            else if (event.phase === 'idle')
                this.host.loop(`generator:${source}`, 'generator.idle', { position }, source);
            else
                this.host.play(`generator.${event.phase}`, { position }, source);
            return;
        }
        if (event.type === 'light.lamp') {
            if (event.phase === 'off' || event.phase === 'break')
                this.host.stopLoop(`lamp:${source}`);
            if (event.phase === 'hum')
                this.host.loop(`lamp:${source}`, 'lamp.hum', { position }, source);
            else if (event.phase !== 'off')
                this.host.play(`lamp.${event.phase}`, { position }, source);
            return;
        }
        if (event.type === 'light.power') {
            this.host.play(`lamp.power-${event.on ? 'on' : 'off'}`, { position }, source);
            return;
        }
        if (event.type === 'prop.impact') {
            this.host.play(`prop.${event.material}`, { position, gain: Math.min(2, Math.max(0.08, event.impulse / 20)) }, source);
            return;
        }
        if (event.type === 'prop.motion') {
            if (event.mode === 'stop') {
                this.host.stopLoop(`prop:${source}`);
            }
            else
                this.host.loop(`prop:${source}`, `prop.${event.mode}`, { position, gain: Math.min(1, event.speed / 3), rate: 0.7 + Math.min(1, event.speed / 8) }, source);
            return;
        }
        if (event.type === 'barricade.sound') {
            this.host.play(`prop.${event.phase === 'hit' ? 'creak' : event.phase}`, { position, rate: event.phase === 'hit' ? 1 + Math.max(0, 1 - event.hp / Math.max(1, event.maxHp)) * 0.7 : 1 }, source);
            return;
        }
        if (event.type === 'explosion.beat') {
            this.host.play(`explosion.${event.beat}`, { position, gain: { small: 0.5, medium: 0.75, large: 1, mega: 1.4 }[event.size] }, source);
            if (event.beat === 'crack') {
                this.host.haptic('explosion');
                if (event.size === 'mega' || event.size === 'large')
                    this.host.graph.duck('mega', t, 0.8);
                if (this.host.settings.tinnitus && position && Math.hypot(position.x - this.host.graph.listener.x, position.z - this.host.graph.listener.z) < 4) {
                    this.host.graph.tinnitus(t);
                    this.host.play('tinnitus');
                }
            }
            return;
        }
        if (event.type === 'vehicle.damage-stage') {
            this.host.play('vehicle.sputter', { position, loop: false, gain: .35, rate: apcEngineStages[event.stage]?.roughRate ?? 1 }, source);
            this.host.caption(apcDamageCaptions[event.stage as 1 | 2 | 3 | 4] ?? 'Vehicle damaged', position, 3);
            return;
        }
        if (event.type === 'vehicle.sound') {
            if (event.phase === 'stop') {
                for (const suffix of ['low', 'high', 'sputter', 'fire', 'tires'])
                    this.host.stopLoop(`vehicle:${source}:${suffix}`);
                this.host.stopLoop(`siren:${source}`);
                return;
            }
            if (event.phase === 'engine') {
                const rpm = Math.max(0, Math.min(1, event.rpm / 7000));
                // The player's own cab: a muffled, quieter engine and road noise (also see the in-bus radio).
                const cab = event.inCar ? { lowpass: 700, gain: 0.55 } : { gain: 1, lowpass: 20000 };
                const floor = entity?.vehicle?.floor;
                const stage = floor ? Math.max(0, Math.min(4, entity.vehicle!.stage ?? 0)) : 0;
                const engine = apcEngineStages[stage];
                const lowpass = Math.min(cab.lowpass, engine.lowpass);
                this.host.loop(`vehicle:${source}:low`, 'vehicle.engine-low', { position, velocity: event.velocity, rate: (0.6 + rpm) * engine.rate, gain: (1 - rpm) * cab.gain, lowpass }, source);
                this.host.loop(`vehicle:${source}:high`, 'vehicle.engine-high', { position, velocity: event.velocity, rate: (0.6 + rpm) * engine.rate, gain: rpm * cab.gain, lowpass }, source);
                if (floor ? stage > 0 : event.health < 0.4)
                    this.host.loop(`vehicle:${source}:sputter`, 'vehicle.sputter', { position, gain: floor ? engine.roughness * cab.gain : 1, rate: floor ? engine.roughRate : 1, lowpass: floor ? lowpass : 20000 }, source);
                else
                    this.host.stopLoop(`vehicle:${source}:sputter`);
                if (!floor && event.health < 0.15)
                    this.host.loop(`vehicle:${source}:fire`, 'vehicle.fire', { position }, source);
                else
                    this.host.stopLoop(`vehicle:${source}:fire`);
                if (event.speed > 0.2)
                    this.host.loop(`vehicle:${source}:tires`, `footstep.tires.${event.surface ?? surfaceAt(this.host.graph.map, event.position)}`, { position, gain: Math.min(1, event.speed / 15) * (event.inCar ? 0.5 : 1), lowpass: event.inCar ? 900 : undefined }, source);
                else
                    this.host.stopLoop(`vehicle:${source}:tires`);
            }
            else if (event.phase === 'siren')
                this.host.loop(`siren:${source}`, 'vehicle.siren', { position }, source);
            else {
                this.host.play(`vehicle.${event.phase}`, { position, gain: event.phase === 'crash' ? Math.min(2, (event.impulse ?? 20) / 20) : 1 }, source);
                if (event.phase === 'crash')
                    this.host.haptic('crash');
            }
            return;
        }
        if (event.type === 'diegetic') {
            const key = `diegetic:${source}`;
            if (event.stop) {
                this.host.stopLoop(key);
                return;
            }
            if (event.kind === 'emergency') {
                this.host.graph.duck('radio', t, 3);
                this.host.play('dialogue.radio', { position, lowpass: event.inCar ? 2400 : 20000 }, source);
                return;
            }
            const warped = event.level === 'L6' && ['jukebox', 'ice-cream'].includes(event.kind);
            this.host.loop(key, `diegetic.${event.kind}${warped ? '.warped' : ''}`, { position, lowpass: event.inCar ? 2400 : 20000, rate: warped ? 0.92 : 1 }, source);
            return;
        }
        if (event.type === 'dialogue' || event.type === 'dialogue.line') {
            if (event.type === 'dialogue' && event.recording === 'cure' || event.type === 'dialogue.line' && event.id === 'L10.research') {
                this.host.graph.duck('radio', t, 14);
                this.host.play('cure.recording', { gain: .3, lowpass: 2400, dry: true });
                this.host.caption(event.text || cureRecordingText, undefined, 14);
                return;
            }
            const duration = 'duration' in event ? event.duration ?? 3 : 3;
            this.host.graph.duck('radio', t, duration);
            this.host.play('dialogue.radio', { position, gain: this.host.level() === 'L5' ? dbGain(l5.audio.quietDb) : 1 });
            this.host.caption(event.text, position, duration);
            return;
        }
        if (event.type === 'music.intensity') {
            this.externalIntensity = event;
            this.host.musicIntensity(event);
            return;
        }
        if (event.type === 'music.stinger') {
            this.host.stinger(event.kind, event.level);
            return;
        }
        if (event.type === 'corgi.warn') {
            // Stages come rate-limited from the sim (bark every l1v2.corgi.barkIntervalS); keep a matching audio-side floor.
            const stage = event.stage, gap = stage === 'bark' ? l1v2.corgi.barkIntervalS - 0.2 : 1, last = this.corgiWarnAt.get(stage) ?? -Infinity;
            if (t - last < gap)
                return;
            this.corgiWarnAt.set(stage, t);
            const [cue, gain, rate] = stage === 'bark' ? ['corgi.warning', 1, 1] : stage === 'growl' ? ['corgi.warning', 0.7, 0.62] : stage === 'stiffen' ? ['corgi.pant', 0.6, 0.8] : ['corgi.pant', 0.5, 1] as const;
            this.host.play(cue, { position, gain, rate }, source);
            return;
        }
        if (event.type === 'corgi.sound') {
            this.host.play(`corgi.${event.kind}`, { position }, source);
            return;
        }
        if (event.type === 'survivor.bark') {
            this.host.play(`bark.${event.variant}.${event.kind}`, { position }, source);
            return;
        }
        if (event.type === 'gore.sound') {
            this.host.play(`gore.${event.kind}`, { position });
            return;
        }
        if (event.type === 'player.damaged') {
            const p = this.host.world.entities.get(event.id);
            this.host.play(`bark.${p?.survivor?.variant ?? 'female'}.hurt`);
            if (event.amount >= 20)
                this.host.haptic('hit');
            return;
        }
        if (event.type === 'combat.exploded') {
            this.host.haptic('explosion');
            if (this.host.settings.tinnitus && position && Math.hypot(position.x - this.host.graph.listener.x, position.z - this.host.graph.listener.z) < 4) {
                this.host.play('tinnitus');
                this.host.graph.tinnitus();
            }
        }
        if (event.type === 'level.completed') {
            this.complete = true;
            this.host.musicIntensity({ alerted: 0 });
            this.host.stinger('extraction', event.id);
            return;
        }
        if (event.type === 'combat.hit' || event.type === 'combat.kill') {
            const target = this.host.world.entities.get(event.targetId);
            if (target?.faction === 'environment' || target?.vehicle) return;
            if (target?.infected && voicedInfected.has(target.archetype)) {
                if (event.type === 'combat.kill')
                    this.host.play('infected.death', { position: target.transform }, target.id);
                else if (event.amount > 0 && target.health.current > 0)
                    this.host.play('infected.hurt', { position: target.transform }, target.id);
            }
            if (event.type === 'combat.hit' && event.amount > 0 && event.damageType === 'melee') {
                const weapon = event.actionId.split('.').at(-1)!;
                const targetPosition = target?.transform ?? position;
                const flesh = fleshLike[weapon] ?? weapon;
                this.host.play(audioCues[`flesh.${flesh}`] ? `flesh.${flesh}` : 'flesh.fists', { position: targetPosition }, source);
                // Layered hit: transient (flesh) + body of the weapon + low thump, each with its own variation.
                const body = /bat|baton/.test(weapon) ? 'wood' : /crowbar|machete|knife|katana|axe|shovel/.test(weapon) ? 'metal' : 'punch', heavy = weapon === 'kick' || weapon === 'bat' || weapon === 'fire-axe' || event.amount >= 20;
                this.host.play(`impact.body.${body}`, { position: targetPosition, gain: heavy ? 1 : 0.8 }, source);
                this.host.play('impact.thump', { position: targetPosition, gain: heavy ? 1 : 0.6 }, source);
                this.host.graph.buses.ambience.gain.setTargetAtTime(0.7, this.host.context.currentTime, 0.02);
                this.ambienceDuckUntil = this.host.context.currentTime + 0.5;
            }
        }
        if (event.type === 'infected.attack') {
            // Close individual vocals are bounded by the horde manager; a landed melee attack adds only the bite.
            if (event.amount > 0 && !['barricade', 'prop-throw', 'explode'].includes(event.special))
                this.host.play('infected.bite', { position: this.host.world.entities.get(event.targetId)?.transform ?? position }, source);
            return;
        }
        if (event.type === 'ally.attack' && event.from) {
            // An armed officer, soldier or civilian (allied fighters v2/v3): a gunshot at the shooter, not a fist swing. The HMG and the door gun are
            // machine guns, the soldiers' rifles assault rifles; the tank's round has its own explosion beats.
            if (event.role === 'tank') return;
            const machine = event.weapon === 'hmg' || event.weapon === 'door-gun';
            this.host.play(machine ? 'weapon.hmg' : event.weapon === 'shotgun' ? 'action.weapon.shotgun' : event.weapon === 'rifle' ? 'action.weapon.assault-rifle' : event.weapon === 'hunting-rifle' ? 'action.weapon.hunting-rifle' : 'action.weapon.pistol', { position: event.from, gain: machine ? 0.85 : 0.8 }, source);
            return;
        }
        if (event.type === 'infected.groan' || event.type === 'infected.recovered') {
            const body = this.host.world.entities.get(event.sourceId);
            if (body && !isMega(body) && voicedInfected.has(body.archetype))
                this.host.play(eventCues[event.type], { position: body.transform, gain: event.type === 'infected.groan' ? 0.7 : 1 }, body.id);
            return;
        }
        if (event.type === 'ai.alerted') {
            // One shared anti-spam key: a gunshot that alerts a whole street yields a few snarls, not a wall.
            if (voicedInfected.has(this.host.world.entities.get(event.targetId)?.archetype ?? ''))
                this.host.play('infected.alert', { position: event.position });
            return;
        }
        if (event.type === 'objective.started' && event.id !== 'breakfast') {
            // L1 v2 opens with a calm morning: its objectives are not an incident until the arc leaves calm.
            if (!this.host.arc() || this.host.arc()?.phase !== 'calm') this.incident = true;
            this.host.musicIntensity({ alerted: event.id === 'store-fight' ? 10 : 0 });
            if (event.id === 'escape') this.host.stinger('elite', this.host.level());
        }
        if (event.type === 'pickup.collected' && 'actionId' in event) {
            // A weapon or ability: its own fanfare replaces the generic pickup tick and the old L1 score stinger (they never stack). The silent L5 city keeps the quiet tick.
            this.host.pickupFanfare(event.actionId);
            return;
        }
        const id = eventCues[event.type];
        if (this.host.level() === 'L5' && id.startsWith('stinger.') && !this.host.l5Music())
            return;
        if (id !== 'ui.tick')
            this.host.play(id, { position }, source);
        // l4-collapse: each lost line escalates the score (the elite stinger over the combat bed).
        if (event.type === 'l4.beat')
            this.host.stinger('elite', this.host.level());
    }
}
