import type { Mission } from './Mission';
import type { L1State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { CivilianProp } from '../npc/types';

const TICKS = 60;
type BeatId = NonNullable<L1State['beat']>['id'];
/** One speech line per beat (PO UAT: short in-world bubbles, no cut-scenes). */
export const storyLines: Record<string, string> = {
  'pickup.clerk': 'Morning! Cold-chain, handle with care.',
  'handover.tech': '…Thanks. Don’t hang around.',
  'garage.courier': 'This’ll do.',
  'firestation.firefighter': 'Get in!',
  'firestation.caption': 'Delivery complete. Outbreak: not contained.',
};
/** PO: reading time per bubble, max(2.5 s, 1 s + 70 ms per character), in ticks. */
export const readTicks = (text: string): number => Math.ceil(Math.max(2.5, 1 + .07 * [...text].length) * TICKS);
/** Beat timing in ticks (deterministic; all from the mission tick). */
const beat = { clerkWalkMs: 1.6, giveTicks: 54, contactTicks: 26, byeTicks: 40, garageTicks: 120, fireTriggerM: 14 };

/**
 * PO UAT story beats for L1 (in-engine, no hard cuts): the depot clerk hands over the parcel, the technician signs
 * for it and the courier grabs the bat off the garage rack. These three beats lock
 * player input for 2–5 s (any press skips), frames the camera (render reads `l1.beat`) and says one line. The beats
 * are mission state driven by the tick, so bots and checkpoints stay deterministic.
 */
export class L1Story {
  constructor(private readonly mission: Mission) {}
  private get l1(): L1State { return this.mission.state.l1!; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }
  private get world() { return this.mission.world; }

  /** Starts a beat; the previous one (if any) is finished first. */
  start(id: BeatId, actor = 0, focus?: { x: number; z: number }, scripted: import('../../input/InputFrame').InputFrame | null = null): void {
    const l1 = this.l1, world = this.world, player = world.entities.get(1)!;
    if (l1.beatsDone?.includes(id)) return;
    if (l1.beat) this.finish();
    const f = focus ?? player.transform;
    l1.beat = { id, start: world.tick, until: world.tick + 5 * TICKS, actor, fx: (player.transform.x + f.x) / 2, fz: (player.transform.z + f.z) / 2, ax: f.x, az: f.z, mx: f.x, mz: f.z };
    world.storyLock = { scripted, skip: false };
    // A pending click-to-move must not resume after the beat.
    world.controls.reset(); world.player?.locomotion.reset();
  }
  /** Speaker 0 is the narration caption. The bubble stays up for its reading time and the beat holds meanwhile. */
  say(id: number, key: string): void {
    const e = this.world.entities.get(id || 1); if (!e) return;
    const text = storyLines[key], tick = this.world.tick;
    this.l1.say = { id, text, at: tick, until: tick + readTicks(text) };
    this.world.events.emit({ type: 'story.say', tick, id, text, position: { x: e.transform.x, z: e.transform.z } });
  }
  /** True while the current bubble still needs reading time. */
  get reading(): boolean { const s = this.l1.say; return !!s && this.world.tick < s.until; }
  private finish(): void {
    const l1 = this.l1, b = l1.beat; if (!b) return;
    (l1.beatsDone ??= []).push(b.id); l1.beat = null; this.world.storyLock = null;
  }
  /** Gives control back while the beat's actor finishes walking off (camera returns to follow). */
  private release(): void { this.world.storyLock = null; }
  private pedestrian(at: { x: number; z: number }, model: string, role: string, tint: string): number {
    const outbreak = this.world.npcs?.civilians.outbreak; if (!outbreak) return 0;
    // Story actors appear from doorways/interiors that are off the walk grid: spawn on the nearest walkable cell, then place.
    const nav = this.world.infected?.nav, p = this.world.entities.get(1)!.transform;
    let spot = { x: p.x, z: p.z };
    if (nav) { const cell = nav.nearestCell(at.x, at.z) >= 0 ? nav.nearestCell(at.x, at.z) : nav.nearestCell(p.x, p.z); if (cell >= 0) spot = { x: nav.x(cell), z: nav.z(cell) }; }
    let id = 0;
    try { id = outbreak.spawnPedestrian(spot, { role, model, tint, tier: 'average' }); } catch { return 0; }
    const e = this.world.entities.get(id)!, c = e.civilian!;
    c.ambient = false; c.pauseUntil = Number.MAX_SAFE_INTEGER; c.routine = 'staff'; c.state = 'calm';
    Object.assign(e.transform, { x: at.x, z: at.z }); this.world.spatial.set(id, at.x, at.z);
    return id;
  }
  private place(e: EntitySnapshot, x: number, z: number, face: { x: number; z: number }): void {
    e.transform.x = x; e.transform.z = z; e.transform.yaw = -Math.atan2(face.z - z, face.x - x); this.world.spatial.set(e.id, x, z);
  }
  private present(e: EntitySnapshot | undefined, clip: string, prop?: CivilianProp): void {
    if (!e?.civilian) return;
    if (e.civilian.story?.clip !== clip || e.civilian.story.prop !== prop) e.civilian.story = { clip, start: this.world.tick, ...(prop ? { prop } : {}) };
    e.civilian.state = 'calm'; e.civilian.pauseUntil = Number.MAX_SAFE_INTEGER;
  }

  /** Beat 1: the clerk walks out from behind the counter with the parcel, hands it over, waves and goes back in. */
  pickup(): void {
    const world = this.world, player = world.entities.get(1)!, counter = this.anchor('parcel-counter');
    const dx = counter.x - player.transform.x, dz = counter.z - player.transform.z, d = Math.hypot(dx, dz) || 1;
    const behind = { x: player.transform.x + dx / d * Math.max(2.6, d + 1.4), z: player.transform.z + dz / d * Math.max(2.6, d + 1.4) };
    const id = this.pedestrian(behind, 'npc.depot-clerk', 'cashier', '#3f7f9a');
    this.l1.clerkId = id; this.l1.carrying = false;
    this.start('pickup', id, behind);
    const b = this.l1.beat!, mdx = player.transform.x - behind.x, mdz = player.transform.z - behind.z, md = Math.hypot(mdx, mdz) || 1;
    b.mx = player.transform.x - mdx / md * 1.05; b.mz = player.transform.z - mdz / md * 1.05;
    this.say(id, 'pickup.clerk');
  }
  /** Beat 3: reach up to the wall rack, lift the bat off, test swing. */
  garage(): void {
    this.start('garage', 1, this.anchor('garage-bat'));
    this.world.player?.act('rack-grab', this.world.tick); this.say(1, 'garage.courier');
  }

  update(): void {
    const l1 = this.l1, world = this.world, tick = world.tick;
    // The courier visibly carries the parcel (render: carry arm pose + box) while the story holds it.
    const pose = world.entities.get(1)?.survivor; if (pose) { if (l1.carrying) pose.carrying = 'prop.package-courier'; else delete pose.carrying; }
    const fire = this.mission.state.steps.firestation, player = world.entities.get(1)!;
    if (!l1.beat && fire?.status === 'active' && player.health.current > 0) this.firestation();
    const b = l1.beat; if (!b) return;
    const lock = world.storyLock;
    // A press while a bubble still reads completes the bubble; the next press skips the beat.
    if (lock?.skip && this.reading) { l1.say!.until = tick; lock.skip = false; }
    // The beat holds its pose until the bubble has been read (the hold points pause the beat clock).
    const t = tick - b.start;
    if (b.id === 'pickup') this.updatePickup(t, !!lock?.skip);
    else if (b.id === 'garage') { if (t >= beat.garageTicks && !this.reading || lock?.skip) this.finish(); }
    else if (b.id === 'handover') { if (lock?.skip) this.finish(); }
    if (l1.beat && tick >= l1.beat.until && !this.reading) this.finish();
  }

  private updatePickup(t: number, skip: boolean): void {
    const l1 = this.l1, b = l1.beat!, world = this.world, clerk = world.entities.get(l1.clerkId ?? 0), player = world.entities.get(1)!;
    if (!clerk) { l1.carrying = true; this.finish(); return; }
    const home = { x: b.ax, z: b.az }, meet = { x: b.mx, z: b.mz };
    const walk = Math.max(1, Math.round(Math.hypot(meet.x - home.x, meet.z - home.z) / beat.clerkWalkMs * TICKS));
    const give = walk, contact = give + beat.contactTicks, bye = give + beat.giveTicks, back = bye + beat.byeTicks, gone = back + walk;
    if (skip && t < back) { b.start -= back - t; t = back; }
    // Keep waving until the clerk's line has been read.
    if (t === back && this.reading) { b.start++; t--; }
    if (t < give) { const k = t / walk; this.place(clerk, home.x + (meet.x - home.x) * k, home.z + (meet.z - home.z) * k, meet); this.present(clerk, 'npc-carry', 'parcel'); }
    else if (t < bye) {
      this.place(clerk, meet.x, meet.z, player.transform);
      if (t === give) world.player?.act('receive', world.tick);
      this.present(clerk, 'npc-give', t < contact ? 'parcel' : undefined);
      if (t >= contact) l1.carrying = true;
    } else if (t < back) { l1.carrying = true; this.place(clerk, meet.x, meet.z, player.transform); this.present(clerk, 'npc-wave'); }
    else if (t < gone) {
      l1.carrying = true; this.release();
      const k = (t - back) / walk; this.place(clerk, meet.x + (home.x - meet.x) * k, meet.z + (home.z - meet.z) * k, home); this.present(clerk, 'npc-walk');
    } else { clerk.hidden = true; if (clerk.civilian) clerk.civilian.story = null; this.place(clerk, home.x, home.z, home); l1.clerkId = 0; this.finish(); }
  }

  /** A doorway invitation, never a beat: controls and infected AI remain live until actual entry. */
  private firestation(): void {
    const door = this.anchor('fire-bay-door'), trigger = this.anchor('fire-bay-trigger'), world = this.world;
    const player = world.entities.get(1)!;
    if (Math.hypot(player.transform.x - door.x, player.transform.z - door.z) > beat.fireTriggerM) return;
    const dx = trigger.x - door.x, dz = trigger.z - door.z, d = Math.hypot(dx, dz) || 1;
    const waving = { x: door.x - dz / d * 1.45 - dx / d * .6, z: door.z + dx / d * 1.45 - dz / d * .6 };
    if (!this.l1.firefighterId) this.l1.firefighterId = this.pedestrian(waving, 'npc.firefighter-alive', 'firefighter', '#b5332b');
    const ff = world.entities.get(this.l1.firefighterId ?? 0);
    if (!ff) return;
    this.place(ff, waving.x, waving.z, player.transform); this.present(ff, 'npc-wave-in');
    const last = this.l1.say;
    if (last?.id !== ff.id || world.tick - last.at >= 4 * TICKS) {
      this.say(ff.id, 'firestation.firefighter');
      // The delivered human bark is available; no recorded "Get in!" voice exists yet.
      world.events.emit({ type: 'civilian.bark', tick: world.tick, id: ff.id, text: 'Hey!', position: { x: ff.transform.x, z: ff.transform.z } });
    }
  }

  /** Beat 2 presentation hooks, called from the existing technician choreography. */
  handoverStart(techId: number, focus: { x: number; z: number }): void { this.start('handover', techId, focus); }
  handoverPose(tech: EntitySnapshot, stage: 'out' | 'glance' | 'sign' | 'in'): void {
    this.present(tech, stage === 'out' ? 'npc-walk' : stage === 'glance' ? 'npc-glance' : stage === 'sign' ? 'npc-sign' : 'npc-carry', stage === 'in' ? 'parcel' : undefined);
  }
  handoverEnd(tech: EntitySnapshot | undefined): void { if (tech?.civilian) tech.civilian.story = null; if (this.l1.beat?.id === 'handover') this.finish(); }
  get skipping(): boolean { return !!this.world.storyLock?.skip; }
}
