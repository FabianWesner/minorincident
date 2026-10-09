import { dialogue } from '../../data/dialogue';
import { l5, l5Fires, l5Loadout, l5Survivors, l5Wanderers } from '../../data/l5';
import { l5Dressing } from '../../levels/L5/layout';
import { Outbreak } from '../outbreak/Outbreak';
import type { Mission } from './Mission';
import type { L5State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const NEVER = Number.MAX_SAFE_INTEGER;
const fresh = (): L5State => ({
  phase: 'cellar', startAt: 0, emergedAt: 0, searchAt: 0, accountedAt: 0, metroAt: 0, shutterAt: 0, doneAt: 0,
  survivors: [], found: 0, lookoutId: 0, infectedIds: [], medkitIds: [], corpseIds: [], fireIds: [], gloom: 1, cue: null, lastShot: {}, waitedAt: 0, infectedMax: 0, deadAtMetro: 0,
});

/**
 * L5 "Aftermath" controller (specs/epic-23 sections 4 and 5). Nothing is scripted but the beats: the courier unbars the cellar door and
 * steps out into the silent city; ten seconds later the objective appears; each of the five survivors is hidden (inside a building or
 * a wreck: out of sight and out of reach) and gives a sign of life within 25 m; standing next to the spot for 1.0 s brings them out and
 * they follow in single file (unarmed, biteable, no fail state); when all five are found the Metro entrance is the destination, and
 * the shutter rolls shut once the courier is at its foot and the living followers are within 15 m (or after 10 s). The sunset gloom
 * ramps down with the story. All state lives in `mission.state.l5`, so checkpoints restore it.
 */
export class LevelFiveAftermath {
  /** The lowest gloom reached so far: a checkpoint restore never brightens the sunset again. */
  private lowest = 1;
  constructor(private readonly mission: Mission) {}
  private get s(): L5State { return this.mission.state.l5!; }
  private get world() { return this.mission.world; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }
  private outbreak(): Outbreak { return this.world.npcs!.civilians.outbreak!; }
  private get low(): boolean { return this.world.infected!.director.tier === 'low'; }
  private snap(p: Point, r = .4): Point {
    const nav = this.world.infected!.nav;
    for (let d = 0; d <= 6; d += .5) for (let k = 0; k < (d ? 16 : 1); k++) {
      const x = p.x + Math.cos(k * Math.PI / 8) * d, z = p.z + Math.sin(k * Math.PI / 8) * d;
      if (nav.clear(x, z, Math.max(r, .36))) return { x, z };
    }
    return { x: p.x, z: p.z };
  }
  private entity(id: number): EntitySnapshot | undefined { return this.world.entities.get(id); }

  // ---------------------------------------------------------------------------------------------------------- setup
  prepare(): void {
    const { world, state } = this.mission;
    state.l5 = fresh(); this.s.startAt = world.tick;
    if (!world.infected || !world.npcs) return;
    const tier = world.infected.director.tier;
    const edges = Object.keys(this.mission.def.anchors).filter(n => n.startsWith('edge-in-')).map(id => ({ id, ...this.anchor(id) }));
    const outbreak = world.npcs.civilians.outbreak ?? new Outbreak(world, { refuges: edges, tier });
    world.npcs.civilians.outbreak = outbreak;
    // Sparse by design: 12-20 wanderers, a cap of 30 on both tiers, no waves, no emergence (no director request is ever made here).
    world.infected.director.levelCap = tier === 'low' ? l5.infected.cap.low * 2 : l5.infected.cap.high; world.infected.director.strict = true;
    world.npcs.setAmbient(0);
    // The L4 end loadout (no weapon pickups exist in L5): axe and bat left, the machine gun selected on the right.
    const combat = world.combat;
    if (combat) {
      combat.rackCapacity = Math.max(combat.rackCapacity, 3);
      combat.setLoadout([...l5Loadout.left], [...l5Loadout.right]); combat.runner.loadout.state.selectedSide = 'RIGHT';
    }
    this.placeInCellar();
    this.spawnSurvivors();
    this.spawnLookout();
    this.spawnCorpses();
    this.spawnFires();
    this.spawnWanderers();
    this.spawnMedkits();
    // Every machine-gun burst is a loud event (30 m, E21 section 5.3): non-chasing infected come to the shot.
    world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.army-mg') this.gunshot(e.position, 30); });
  }
  /** The courier starts at the stair foot of Kessler's cellar (a walled-off yard), as L4 ended. */
  private placeInCellar(): void {
    const { world } = this.mission, player = world.entities.get(1)!, inn = this.anchor('l5-cellar-in');
    this.teleport(player, inn);
    for (const e of world.entities.iterate()) if (e.companion) { const p = { x: inn.x + 1.2, z: inn.z - .6 }; Object.assign(e.transform, p); e.hidden = false; world.spatial.set(e.id, p.x, p.z); }
  }
  private teleport(player: EntitySnapshot, to: Point): void {
    const { world } = this.mission;
    Object.assign(player.transform, { x: to.x, z: to.z });
    world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, to.x, to.z); world.player!.locomotion.reset(); world.player!.setCheckpoint(player.transform); world.clearInput();
  }
  private hiddenSchedule(p: Point) { return [{ activity: 'look' as const, anchor: 'l5/hidden', target: p, facing: { x: p.x, z: p.z + 5 }, ticks: 60 * 60 * 6 }]; }
  private spawnSurvivors(): void {
    const o = this.outbreak(), s = this.s;
    for (const def of l5Survivors) {
      const out = this.snap({ x: def.outAt[0], z: def.outAt[1] }, .4), hide = this.anchor(`l5-hide-${def.key}`);
      const id = o.spawnPedestrian(out, { role: 'cashier', model: def.model, tier: def.key === 'okafor' ? 'frail' : 'average', schedule: this.hiddenSchedule(out), walkSpeed: 1.3 });
      const e = this.entity(id)!, c = e.civilian!;
      // Hidden in the building or wreck: out of sight and out of reach (not a human target) until the courier finds them.
      Object.assign(e.transform, { x: hide.x, z: hide.z }); e.hidden = true; c.pauseUntil = NEVER; this.world.spatial.delete(id);
      e.health = { current: l5.follow.hp, max: l5.follow.hp };
      c.survivor = { key: def.key, mode: 'hidden', slot: -1, leader: 0, cover: false, waitAt: 0, foundAt: 0 };
      s.survivors.push({ key: def.key, id, status: 'hidden', foundAt: 0, cueAt: 0, lostAt: 0, hold: 0 });
    }
  }
  /** The lookout behind the half-open metro shutter: appears (waving a flashlight) when the group is called to the station. */
  private spawnLookout(): void {
    const o = this.outbreak(), foot = this.anchor('l5-metro-foot'), at = this.snap({ x: foot.x, z: foot.z - 1.4 }, .4);
    const id = o.spawnPedestrian(at, { role: 'cashier', model: 'npc.marcus.aftermath', schedule: this.hiddenSchedule(at) });
    const e = this.entity(id)!; e.hidden = true; e.civilian!.pauseUntil = NEVER; this.world.spatial.delete(id); this.s.lookoutId = id;
  }
  private spawnCorpses(): void {
    const o = this.outbreak(), s = this.s, tick = this.world.tick;
    for (const d of l5Dressing) if (d.entity && d.kind === 'corpse') {
      const p = this.snap({ x: d.x, z: d.z }, .35);
      const id = o.spawnPedestrian(p, { model: d.assetId, yaw: d.yaw, ...(d.uniform ? { role: 'soldier', tint: '#4b5a3a' } : {}), schedule: [{ activity: 'look', anchor: 'l5/corpse', target: p, facing: p, ticks: 60 * 60 * 6 }] });
      const e = this.entity(id)!;
      e.civilian!.state = 'finished'; e.civilian!.entered = tick - 600; e.appearance!.handProp = null; s.corpseIds.push(id);
    }
  }
  private spawnFires(): void {
    for (const f of l5Fires) this.s.fireIds.push(this.world.hazards?.spawn('fire', { x: f.at[0], z: f.at[1] }, { radius: f.r, duration: 7200 }) ?? 0);
  }
  /** 12-20 infected in ones and twos (no group above 3), each leashed to its spot so they loiter in the ruins instead of crowding the courier. */
  private spawnWanderers(): void {
    const { world } = this.mission, o = this.outbreak(), s = this.s, ai = world.infected!;
    let left = this.low ? l5.infected.start.low : l5.infected.start.high;
    for (const g of l5Wanderers) for (let k = 0; k < g.n && left > 0; k++) {
      if (ai.director.count >= ai.director.cap || !ai.pool.length) return;
      const at = this.snap({ x: g.at[0] + k * 1.3, z: g.at[1] + k * .7 }, .45), id = o.spawnPedestrian(at), e = this.entity(id)!;
      o.turnNow(e);
      if (!e.infected) continue;
      const brain = e.infected.l1; if (brain) { brain.homeX = g.at[0]; brain.homeZ = g.at[1]; brain.leashM = l5.infected.leashM; }
      if (e.combat) e.combat.damageMultiplier = l5.infected.damage;
      s.infectedIds.push(id); left--;
    }
  }
  private spawnMedkits(): void {
    for (const [x, z] of l5.medkits.positions) {
      const p = this.snap({ x, z }, .3), id = this.world.pickups!.spawn('medkit', p);
      const e = this.world.entities.get(id)!; if (e.pickup && 'kind' in e.pickup) e.pickup.amount = l5.medkits.heal;
      this.s.medkitIds.push(id);
    }
  }

  // ---------------------------------------------------------------------------------------------------------- beats
  completed(id: string): void {
    if (!this.mission.state.l5) return;
    if (id === 'emerge') this.emerge();
    if (id === 'look') this.findAll();
    if (id === 'metro') this.forceShelter();
  }
  /** The courier unbars the door and steps out at the foot of Kessler Lane: the first look at the devastated city. */
  private emerge(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (s.phase !== 'cellar') return;
    this.teleport(world.entities.get(1)!, this.anchor('l5-out'));
    for (const e of world.entities.iterate()) if (e.companion) { const p = this.snap({ x: this.anchor('l5-out').x - 1.2, z: this.anchor('l5-out').z + .8 }, .4); Object.assign(e.transform, p); world.spatial.set(e.id, p.x, p.z); }
    s.phase = 'emerged'; s.emergedAt = tick;
    if (!this.mission.state.states.emerged) this.mission.setState('emerged', true);
    world.events.emit({ type: 'l5.emerged', tick });
    this.mission.requestCheckpoint('outside');
  }
  /** About ten seconds of silence, then the objective. */
  private startSearch(): void {
    const { world } = this.mission, s = this.s;
    if (s.phase !== 'emerged') return;
    s.phase = 'search'; s.searchAt = world.tick;
    if (!this.mission.state.states.searching) this.mission.setState('searching', true);
    world.events.emit({ type: 'l5.searching', tick: world.tick });
  }
  /** Cheat/test completion of the search: everyone steps out at once. */
  private findAll(): void {
    for (const r of this.s.survivors) if (r.status === 'hidden') this.find(r);
    this.checkAccounted();
  }
  private find(r: L5State['survivors'][number]): void {
    const { world } = this.mission, s = this.s, tick = world.tick, e = this.entity(r.id), def = l5Survivors.find(d => d.key === r.key)!;
    if (!e?.civilian?.survivor || r.status !== 'hidden') return;
    const out = this.snap({ x: def.outAt[0], z: def.outAt[1] }, .4), c = e.civilian, sv = c.survivor!;
    Object.assign(e.transform, out); e.hidden = false; world.spatial.set(e.id, out.x, out.z);
    c.pauseUntil = 0; c.path.length = 0; c.goal = -1; c.schedule = this.hiddenSchedule(out); c.scheduleStep = 0; c.activityUntil = 0;
    sv.mode = 'follow'; sv.slot = s.found; sv.foundAt = tick; sv.waitAt = tick + ticks(l5.follow.waitEveryS);
    r.status = 'following'; r.foundAt = tick; r.hold = 0; s.found++;
    world.events.emit({ type: 'l5.found', tick, key: r.key, id: r.id, count: s.found });
    this.mission.radio(`L5.found.${r.key}`);
    this.mission.requestCheckpoint(`survivor-${s.found}`);
    this.checkAccounted();
  }
  /** Found, dead or turned: all five accounted for, the Metro station is the destination. */
  private checkAccounted(): void {
    const { world } = this.mission, s = this.s;
    if (s.accountedAt || s.survivors.some(r => r.status === 'hidden')) return;
    s.accountedAt = world.tick; s.phase = 'metro';
    if (!this.mission.state.states.searching) this.mission.setState('searching', true);
    if (!this.mission.state.states.accounted) this.mission.setState('accounted', true);
    // The lookout behind the half-open shutter waves a flashlight.
    const look = this.entity(s.lookoutId);
    if (look) { look.hidden = false; this.world.spatial.set(look.id, look.transform.x, look.transform.z); if (look.civilian) look.civilian.story = { clip: 'npc-wave-in', start: world.tick }; }
    world.events.emit({ type: 'l5.accounted', tick: world.tick });
  }
  private following(): { r: L5State['survivors'][number]; e: EntitySnapshot }[] {
    const out: { r: L5State['survivors'][number]; e: EntitySnapshot }[] = [];
    for (const r of this.s.survivors) if (r.status === 'following') { const e = this.entity(r.id); if (e) out.push({ r, e }); }
    return out;
  }
  /** A found survivor is lost when bitten (turns in about 3 s: same entity, same look) or killed. */
  private losses(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    for (const r of s.survivors) {
      if (r.status !== 'following' && r.status !== 'hidden') continue;
      const e = this.entity(r.id), c = e?.civilian;
      const turned = !!e && (!!e.infection || !!e.infected || c?.state === 'bitten' || c?.state === 'down' || c?.state === 'rising' || c?.state === 'infected');
      const dead = !e || e.health.current <= 0 || c?.state === 'finished';
      if (!turned && !dead) continue;
      r.status = turned && !dead ? 'turned' : 'dead'; r.lostAt = tick;
      if (c?.survivor) c.survivor.mode = 'hidden';
      world.events.emit({ type: 'l5.lost', tick, key: r.key, id: r.id, cause: r.status });
    }
  }
  /** Slots: the live followers renumber 0..n-1 in the order they were found, so the group closes up when one is lost. */
  private chain(): void {
    let slot = 0;
    for (const { e } of this.following().sort((a, b) => a.r.foundAt - b.r.foundAt)) e.civilian!.survivor!.slot = slot++;
  }
  private cues(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, player = world.entities.get(1)!;
    if (player.health.current <= 0 || s.phase !== 'search' && s.phase !== 'metro') return;
    for (const r of s.survivors) {
      if (r.status !== 'hidden') continue;
      const def = l5Survivors.find(d => d.key === r.key)!, hide = this.anchor(`l5-hide-${r.key}`), ring = this.anchor(`l5-ring-${r.key}`);
      const d = dist(player.transform, hide);
      // Sign of life: audible (position + subtitle) within 25 m, never beyond.
      if (d <= l5.survivors.cueRangeM && tick >= r.cueAt) {
        r.cueAt = tick + ticks(l5.survivors.cueEveryS);
        s.cue = { key: r.key, x: hide.x, z: hide.z, until: tick + ticks(l5.survivors.pingS), text: dialogue[def.cue.id] };
        world.events.emit({ type: 'l5.cue', tick, key: r.key, position: { x: hide.x, z: hide.z }, text: dialogue[def.cue.id], distance: d });
      }
      // Standing next to the spot for 1.0 s (or pressing E there) brings them out.
      if (dist(player.transform, ring) <= l5.survivors.reachM) {
        r.hold++;
        if (r.hold >= ticks(l5.survivors.interactS) || world.inputFrame.interact && r.hold >= 6) this.find(r);
      } else r.hold = 0;
    }
    if (s.cue && tick >= s.cue.until) s.cue = null;
  }
  /** The shutter: the courier at the foot of the entrance, the living followers within 15 m (or 10 s have passed). */
  private metro(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, player = world.entities.get(1)!;
    if (s.phase !== 'metro' || s.shutterAt) return;
    const foot = this.anchor('l5-metro-foot'), inside = player.health.current > 0 && dist(player.transform, foot) <= foot.radius;
    if (!inside) { s.metroAt = 0; return; }
    if (!s.metroAt) { s.metroAt = tick; if (!this.mission.state.states['at-metro']) this.mission.setState('at-metro', true); }
    const group = this.following(), gathered = group.every(({ e }) => dist(e.transform, player.transform) <= l5.metro.gatherM);
    if (gathered || tick >= s.metroAt + ticks(l5.metro.waitS)) this.shutter();
  }
  private shutter(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, player = world.entities.get(1)!;
    if (s.shutterAt) return;
    s.shutterAt = tick; s.phase = 'shelter';
    for (const { r, e } of this.following()) if (dist(e.transform, player.transform) <= l5.metro.gatherM) r.status = 'sheltered';
    s.deadAtMetro = s.survivors.filter(r => r.status === 'dead' || r.status === 'turned').length;
    this.mission.radio('L5.shutter');
    world.events.emit({ type: 'l5.shutter', tick });
  }
  /** Cheat/test completion of the last step: everybody who still follows is carried in, the shutter closes now. */
  private forceShelter(): void {
    const s = this.s; if (s.doneAt) return;
    if (!s.shutterAt) { s.shutterAt = this.world.tick; s.phase = 'shelter'; for (const { r } of this.following()) r.status = 'sheltered'; s.deadAtMetro = s.survivors.filter(r => r.status === 'dead' || r.status === 'turned').length; this.mission.radio('L5.shutter'); this.world.events.emit({ type: 'l5.shutter', tick: this.world.tick }); }
    this.done();
  }
  private done(): void {
    const s = this.s; if (s.doneAt) return;
    s.doneAt = this.world.tick; s.phase = 'done';
    if (!this.mission.state.states.sheltered) this.mission.setState('sheltered', true);
    this.world.events.emit({ type: 'l5.sheltered', tick: this.world.tick });
  }
  /** Sunset gloom: falls monotonically with the time since the exit and with the share of the story told, to half the sun at the station. */
  private gloom(): void {
    const s = this.s, tick = this.world.tick;
    if (!s.emergedAt) return;
    const accounted = s.survivors.filter(r => r.status !== 'hidden').length;
    const share = (accounted + (s.accountedAt ? 1 : 0) + (s.shutterAt ? 1 : 0)) / (l5.survivors.count + 2);
    const p = Math.min(1, Math.max((tick - s.emergedAt) / ticks(l5.gloom.rampS), share));
    this.lowest = Math.min(this.lowest, 1 - (1 - l5.gloom.endFactor) * p);
    s.gloom = Math.min(s.gloom, this.lowest);
  }
  private gunshot(at: Point, radius: number): void {
    const s = this.mission.state.l5, world = this.world; if (!s || !world.infected) return;
    const last = s.lastShot[1] ?? -Infinity; if (world.tick - last < ticks(.5)) return;
    s.lastShot[1] = world.tick;
    world.events.emit({ type: 'outbreak.distraction', tick: world.tick, id: 500_000 + world.tick * 64, kind: 'gunfire', position: { x: at.x, z: at.z }, radius, until: world.tick + ticks(6) });
  }

  // ---------------------------------------------------------------------------------------------------------- tick
  update(): void {
    const { world, state } = this.mission, s = state.l5; if (!s || !world.infected) return;
    const tick = world.tick;
    if (s.phase === 'emerged' && tick >= s.emergedAt + ticks(l5.emerge.objectiveAfterS)) this.startSearch();
    // No marker ever points at a survivor (or at the search area): only the cellar brace and the Metro entrance are marked.
    if (state.marker === 'l5-plaza') state.marker = null;
    if (s.phase !== 'cellar') {
      this.losses(); this.chain(); this.cues(); this.checkAccounted(); this.metro();
      s.infectedMax = Math.max(s.infectedMax, world.infected.director.count);
      if (s.shutterAt && !s.doneAt && tick >= s.shutterAt + ticks(3)) this.done();
    }
    this.gloom();
  }
  /** Cheat/test path (`completeObjective` in a gap without an active objective): the objective appears now. */
  advance(): boolean {
    const s = this.mission.state.l5; if (!s) return false;
    if (s.phase === 'emerged') { this.startSearch(); return true; }
    return false;
  }
  /** The result: survivors that reached the station alive (keys, carried into L6) and their count as `rescued`. */
  result(): { survivors: string[] } {
    const s = this.mission.state.l5, keys = s ? s.survivors.filter(r => r.status === 'sheltered').map(r => r.key) : [];
    this.mission.state.stats.rescued = keys.length;
    return { survivors: keys };
  }
  /** Checkpoint restore: shift the timeline. Entities (survivors, infected, corpses, pickups) come back from the snapshot. */
  restore(delta: number): void {
    const s = this.mission.state.l5; if (!s) return;
    for (const key of ['startAt', 'emergedAt', 'searchAt', 'accountedAt', 'metroAt', 'shutterAt', 'doneAt', 'waitedAt'] as const) if (s[key]) s[key] += delta;
    for (const r of s.survivors) for (const key of ['foundAt', 'cueAt', 'lostAt'] as const) if (r[key]) r[key] += delta;
    if (s.cue) s.cue.until += delta;
    s.gloom = Math.min(s.gloom, this.lowest);
    for (const k of Object.keys(s.lastShot)) s.lastShot[Number(k)] += delta;
    this.outbreak()?.humans.invalidate();
  }
}
