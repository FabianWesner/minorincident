import type { MissionDef } from './types';
import type { SimWorld } from '../world/SimWorld';
/** Shared browser/headless test surface. Gameplay signals use the same mission entry points. */
export function missionControls(world: SimWorld) {
  const mission = () => { if (!world.missions) throw new Error('No mission loaded'); return world.missions; };
  return {
    /** Sandbox-only authoring hook, never changes a campaign definition. */
    load: (def: MissionDef) => { if (world.scenario !== 'mission-sandbox') throw new Error('Mission authoring requires mission-sandbox'); const seed=world.seed;world.loadScenario('mission-sandbox',seed);world.loadMission(def); },
    teleport: (id: number | 'player', pos: { x: number; z: number }) => {
      if (![pos.x,pos.z].every(Number.isFinite)) throw new RangeError('Position must be finite');
      const entity=world.entities.get(id==='player'?1:id);if(!entity)throw new Error(`Unknown entity: ${id}`);
      Object.assign(entity.transform,pos);world.spatial.set(entity.id,pos.x,pos.z);
      if(entity.id===1){world.previousPlayer={...entity.transform};world.physics.playerBody!.setTranslation(entity.transform,true);}
    },
    damageActor: (actor: string, amount: number) => {
      const id=mission().state.actors[actor];if(!id||!Number.isFinite(amount)||amount<0)throw new Error(`Invalid actor damage: ${actor}`);
      return world.combat!.damage.apply({ targetId:id, sourceId:1, attackId:0, actionId:world.combat!.runner.loadout.current('RIGHT').id, origin:world.entities.get(1)!.transform, direction:{x:0,z:0},base:amount,multiplier:1,type:'explosive',knockback:0,stagger:0 });
    },
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
