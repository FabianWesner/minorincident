import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SimPhase } from '../../../src/core/EventBus';
import { emptyInput } from '../../../src/input/InputFrame';
import { newCampaign, preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import type { MissionCheckpoint } from '../../../src/sim/missions/types';
import { respawnRule } from '../../../src/sim/missions/Respawn';
import type { MegaPursuitState } from '../../../src/sim/ai/MegaPursuit';
import { loadLevel, runLevel, type RunnerLevel } from '../../sim-runner/levels';
import type { NativeReceipt, Tier } from './probe';
import type { FixtureReceipt } from './fixtures';

export const checkpointHash = () => createHash('sha256').update(readFileSync(new URL('./checkpoints.ts', import.meta.url))).digest('hex');
export interface CheckpointReceipt extends FixtureReceipt { control: { observed: string | null; control: string | null; identical: boolean }; checkpointHash: string }

/** Capture actual naturally reached checkpoints during an uninstrumented control route, then
 * load each save into a fresh native world and exercise the ordinary death/respawn path. */
export async function checkpointProbe(native: NativeReceipt, path: string, fixturesHash: string): Promise<CheckpointReceipt> {
  const { level, tier, sourceHash } = native;
  const makeCampaign = () => { const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset); campaign.settings.quality = tier; return campaign; };
  const snapshots = new Map<string, MissionCheckpoint>();
  let controlHash: string | null = null;
  await runLevel(level, 'complete', 1, undefined, 'auto', makeCampaign(), undefined, 0, {
    quality: tier,
    beforeBegin: world => { world.events.on('checkpoint.set', event => { if (event.type === 'checkpoint.set') snapshots.set(event.id, world.missions!.saveResume().checkpoint); }); },
    beforeDispose: world => { controlHash = stateHash(world.getState()); },
  });
  const result: CheckpointReceipt = { version: 1, level, tier, sourceHash, fixtureHash: fixturesHash, checkpointHash: checkpointHash(), checks: [], errors: [], control: { observed: native.nativeStateHash, control: controlHash, identical: !!controlHash && controlHash === native.nativeStateHash } };
  if (!result.control.identical) result.errors.push('Observed competent route differs from uninstrumented control state hash');
  for (const [id, checkpoint] of snapshots) {
    if (id === 'start') continue;
    const world = await loadLevel(level as RunnerLevel, 1, makeCampaign(), 0, { quality: tier as Tier });
    try {
      world.missions!.loadResume({ current: structuredClone(checkpoint), checkpoint: structuredClone(checkpoint) });
      // Checkpoints may be captured during briefing/camera beats. Ordinary death uses
      // restore(), which resumes playing; loadResume() alone preserves a live-save phase.
      world.missions!.restore(id);
      const mission = world.missions!, expected = mission.saveResume().checkpoint, player = world.entities.get(1)!;
      // E19's PO 2026-10-07 amendment and E22-AC17 explicitly supersede
      // snapshot rewind for these retries. Probe their live-world contract.
      const worldKept = level === 'L1' || level === 'L4' && ['war', 'collapse'].includes(mission.state.l4?.phase ?? '');
      const anchor = { ...player.survivor!.checkpoint };
      const roster = expected.entities.filter(e => e.civilian?.survivor?.mode === 'follow' || e.civilian?.ally?.follow?.targetId === 1 || e.escort?.state === 'follow');
      const pickups = expected.entities.filter(e => e.pickup && !('collected' in e.pickup && e.pickup.collected));
      // Deliberately dirty the live state after the checkpoint, then die through Player.damage.
      for (const key of Object.keys(mission.state.gates)) mission.state.gates[key] = !expected.state.gates[key];
      const follower = roster[0] && world.entities.get(roster[0].id); if (follower) follower.health.current = 1;
      const pickup = pickups[0]; if (pickup) { world.entities.remove(pickup.id); world.spatial.delete(pickup.id); }
      const rackIds = (entity: typeof player) => entity.weapons ? { LEFT: entity.weapons.LEFT.rack.map(slot => slot.id), RIGHT: entity.weapons.RIGHT.rack.map(slot => slot.id) } : null;
      world.combat?.setLoadout(['weapon.fists'], ['weapon.kick']);
      const expectedRack = rackIds(worldKept ? player : expected.entities.find(e => e.id === 1)!);
      const expectedGates = { ...(worldKept ? mission.state.gates : expected.state.gates) };
      const expectedRoster = worldKept ? roster.map(e => structuredClone(world.entities.get(e.id)!)) : roster;
      const expectedPickups = worldKept ? pickups.filter(e => !!world.entities.get(e.id)?.pickup) : pickups;
      const removedPickups = worldKept && pickup ? [pickup.id] : [];
      const expectedBoss = expected.seams?.megaPursuit as MegaPursuitState | undefined;
      if (level === 'L10') {
        mission.state.states['cure-carried'] = !expected.state.states['cure-carried'];
        const boss = world.megaPursuit?.entity();
        if (boss && id === 'cure-disperse-ready') {
          for (let hit = 0; hit < 10 && boss.health.current > 0; hit++) world.combat!.damage.apply({ attackId: 100000 + hit, actionId: 'weapon.rocket-launcher', sourceId: 1, targetId: boss.id, origin: player.transform, direction: { x: 1, z: 0 }, base: 99999, multiplier: 1, type: 'explosive', direct: true, knockback: 0, stagger: 0 });
        } else if (boss) boss.health.current = Math.max(1, boss.health.current - 1);
      }
      type Restored = { id: string | null; position: { x: number; z: number }; gates: Record<string, boolean>; racks: ReturnType<typeof rackIds>; followerMismatches: number[]; missingPickups: number[]; unexpectedPickups: number[]; cure: boolean; bossMode: string | null; bossHp: number | null };
      let observed: Restored | null = null;
      const stop = world.events.on('player.respawned', () => {
        const p = world.entities.get(1)!;
        observed = { id: mission.state.checkpoint, position: { x: p.transform.x, z: p.transform.z }, gates: { ...mission.state.gates }, racks: rackIds(p),
          followerMismatches: expectedRoster.filter(e => world.entities.get(e.id)?.health.current !== e.health.current).map(e => e.id),
          missingPickups: expectedPickups.filter(e => !world.entities.get(e.id)?.pickup).map(e => e.id), unexpectedPickups: removedPickups.filter(id => !!world.entities.get(id)?.pickup), cure: !!mission.state.states['cure-carried'], bossMode: world.megaPursuit?.state.mode ?? null, bossHp: world.megaPursuit?.state.hp ?? null };
      }, SimPhase.cleanup);
      const damage = world.player!.damage(100000, world.tick, true);
      for (let tick = 0; tick < 360 && !observed; tick++) { world.applyInput(emptyInput(), 'keyboard'); world.update(); }
      stop();
      // TS cannot infer a mutation performed by a registered callback.
      const restored = observed as Restored | null;
      const positionError = restored ? Math.hypot(restored.position.x - anchor.x, restored.position.z - anchor.z) : null;
      const gateMatch = !!restored && Object.entries(expectedGates).every(([key, value]) => restored.gates[key] === value);
      const rackMatch = !!restored && JSON.stringify(restored.racks) === JSON.stringify(expectedRack);
      const pass = !!restored && restored.id === id && positionError! <= respawnRule.snapM && gateMatch && rackMatch && !restored.followerMismatches.length && !restored.missingPickups.length && !restored.unexpectedPickups.length;
      const value = { checkpoint: id, contract: worldKept ? 'live world preserved (E19 PO 10-07 / E22-AC17)' : 'checkpoint snapshot restored', snapshotSha256: createHash('sha256').update(JSON.stringify(checkpoint)).digest('hex'), damage, expected: { id, anchor, gates: expectedGates, racks: expectedRack, followers: expectedRoster.map(e => e.id), pickups: expectedPickups.map(e => e.id), removedPickups, cure: expected.state.states['cure-carried'] ?? false, bossHp: expectedBoss?.hp, bossMode: expectedBoss?.mode }, observed: restored, positionError, gateMatch, rackMatch };
      result.checks.push({ id: 'G-21', clause: `mortal checkpoint restore at ${level}/${id}`, tier, policy: 'checkpoint-death-fixture', status: restored ? pass ? 'PASS' : 'FAIL' : 'NOT CHECKED', value, target: `last reached ID; position within native support snap≤${respawnRule.snapM} m; ${worldKept ? 'live' : 'snapshot'} racks/gates/follower HP/pickups ${worldKept ? 'preserved' : 'restored'}`, receipt: path });
      if (level === 'L10') result.checks.push({ ...result.checks.at(-1)!, id: 'L10-15', clause: `mortal regional checkpoint ${id} (cure/boss comparison still partial)` });
      if (level === 'L10') result.checks.push({ id: 'L10-15', clause: `cure and boss HP/death snapshot at ${id}`, tier, policy: 'checkpoint-death-fixture', status: restored ? restored.cure === !!expected.state.states['cure-carried'] && (!expectedBoss || restored.bossHp === expectedBoss.hp && (restored.bossMode === 'dead') === (expectedBoss.mode === 'dead')) ? 'PASS' : 'FAIL' : 'NOT CHECKED', value, target: 'captured cure flag, boss HP and dead/alive status restored; ready fixture kills boss with10 direct rockets before courier death', receipt: path });
      console.log(`[qa:accept:checkpoint] ${level} ${tier}/${id}: ${restored ? pass ? 'PASS' : 'FAIL' : 'NO RESPAWN'}`);
    } catch (error) { result.errors.push(`${id}: ${String(error)}`); }
    finally { world.dispose(); }
  }
  return result;
}
