import type { SimWorld } from '../world/SimWorld';
/** Shared browser/headless test surface. Gameplay signals use the same mission entry points. */
export function missionControls(world: SimWorld) {
  const mission = () => { if (!world.missions) throw new Error('No mission loaded'); return world.missions; };
  return {
    state: () => world.missions ? structuredClone(world.missions.state) : null,
    begin: () => mission().begin(), retry: () => mission().restore(), continue: () => mission().continue(),
    completeObjective: (id?: string) => mission().completeObjective(id),
    signal: (name: string, actor?: string) => mission().signal(name, actor),
    collect: (item: string) => mission().collect(item),
    setState: (key: string, value: boolean) => mission().setState(key, value),
    count: (key: string, amount?: number) => mission().count(key, amount),
    checkpoint: (id: string) => mission().checkpoint(id),
    restore: (id: string) => mission().restore(id),
  };
}
