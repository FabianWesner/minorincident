import type { Game } from '../Game';
import { debugEntityCounts } from './debugEntityCounts';
declare const __BUILD_COMMIT__: string;

/** Player-facing pause overlay. Loaded only when ?debug=1 or ?debug=true is present. */
export class DebugInfo {
  constructor(private readonly output: HTMLPreElement) {}

  update(game: Game, performanceInfo: string): void {
    const world = game.world, player = world.entities.get(1), mission = world.missions;
    const active = mission?.def.steps.find(step => mission.state.steps[step.id]?.status === 'active');
    const nearest: { id: string; distance: number }[] = [];
    if (player && world.districts) for (const district of world.districts.districts) {
      const [ox, oz] = district.origin;
      for (const [id, point] of Object.entries(district.layout.anchors)) nearest.push({ id: `${district.layout.district}/${id}`, distance: Math.hypot(player.transform.x - (point.position[0] + ox), player.transform.z - (point.position[2] + oz)) });
      for (const building of district.layout.buildings) nearest.push({ id: `${district.layout.district}/${building.id}`, distance: Math.hypot(player.transform.x - ((building.aabb.min[0] + building.aabb.max[0]) / 2 + ox), player.transform.z - ((building.aabb.min[2] + building.aabb.max[2]) / 2 + oz)) });
      for (const placement of district.layout.placements) nearest.push({ id: `${district.layout.district}/${placement.id}`, distance: Math.hypot(player.transform.x - (placement.position[0] + ox), player.transform.z - (placement.position[2] + oz)) });
    }
    const closest = nearest.filter(item => item.distance <= 10).sort((a, b) => a.distance - b.distance)[0];
    const entities = [...world.entities.iterate()], counts = debugEntityCounts(entities);
    const loadout = player?.weapons ? world.combat!.runner.loadout.activeEntries().map(entry => entry.id).join(', ') : 'none';
    const district = world.districts?.districts.map(d => {
      const bounds = d.layout.bounds;
      const center = bounds.reduce((sum, point) => [sum[0] + point[0] / bounds.length, sum[1] + point[1] / bounds.length], [d.origin[0], d.origin[1]] as [number, number]);
      return { id: d.id, distance: Math.hypot((player?.transform.x ?? 0) - center[0], (player?.transform.z ?? 0) - center[1]) };
    }).sort((a, b) => a.distance - b.distance)[0]?.id ?? 'unknown';
    const bike = player?.riding ? world.entities.get(player.riding)?.bicycle : undefined;
    const driving = player?.riding ? world.entities.get(player.riding)?.vehicle?.driver === player.id : false;
    const fields = [
      `Level: ${mission?.def.id ?? world.scenario ?? 'unknown'} · Seed: ${world.seed}`,
      `Step: ${active ? `${active.id} · ${active.text}` : 'none'} · Checkpoint: ${mission?.state.checkpoint ?? 'none'}`,
      `Sim: tick ${world.tick} · ${(world.tick / 60).toFixed(1)} s elapsed`,
      `Player (x, z, y): ${player ? `${player.transform.x.toFixed(2)}, ${player.transform.z.toFixed(2)}, ${player.transform.y.toFixed(2)}` : 'unavailable'} · yaw ${player?.transform.yaw.toFixed(3) ?? 'n/a'} rad`,
      `District: ${district} · Nearest: ${closest ? `${closest.id} (${closest.distance.toFixed(1)} m)` : 'none within 10 m'}`,
      `Vehicle: ${driving ? 'driving' : bike?.mounted ? 'on bike' : 'on foot'}${player?.riding ? ` · entity ${player.riding}` : ''} · HP ${player ? `${player.health.current}/${player.health.max}` : 'n/a'}`,
      `Loadout: ${loadout || 'empty'} · Camera: ${game.view.view.getState().spot ?? 'follow'} / zoom ${game.view.view.getState().zoom.toFixed(2)}`,
      performanceInfo,
      `Entities: pedestrians ${counts.pedestrians} · infected alive ${counts.alive} · downed ${counts.downed} · corpses ${counts.corpses}`,
      `Build: ${typeof __BUILD_COMMIT__ === 'undefined' ? 'unknown' : __BUILD_COMMIT__}`,
    ];
    this.output.textContent = fields.join('\n');
  }
}
