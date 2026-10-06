import type { MissionDef } from '../sim/missions/types';

/** Product-owner playtest boundary: only morning, incident and hardware-store combat. */
export function levelOneSlice(campaign: MissionDef): MissionDef {
  const def = structuredClone(campaign);
  def.slice = true;
  def.briefing = "A quiet morning in Sunset Grove. Take your corgi to Joe's Diner for breakfast.";
  def.steps = def.steps.filter(s => ['breakfast', 'escape', 'melee'].includes(s.id));
  def.steps[0].text = "Go to Joe's Diner for breakfast";
  def.actors = {}; def.groups = {}; def.checkpoints = ['escape', 'melee']; def.cinematics = {};
  const encounter = (group: string, at: string, roles: string[], offsets: [number, number][]) => {
    def.groups[group] = roles.map((role, i) => {
      const id = `${group}-${i}`, a = def.anchors[at];
      def.anchors[id] = { x: a.x + offsets[i][0], z: a.z + offsets[i][1], radius: .6 };
      def.actors[id] = { kind: 'infected', archetype: `infected.${role}`, faction: 'infected', hp: role === 'crawler' ? 25 : 40, anchor: id };
      return id;
    });
  };
  encounter('incident', 'diner', ['runner', 'runner', 'runner', 'runner'], [[-3,0],[-5,-3],[-7,2],[-6,5]]);
  encounter('store', 'hardware', ['runner','runner','runner','runner','crawler'], [[4,1],[6,-2],[7,3],[5,5],[3,-4]]);
  def.steps[1].text = 'Run! Find something better at the hardware store';
  def.steps[0].onComplete = [{ kind:'tier', tier:1 }, { kind:'spawn', group:'incident' }];
  def.steps[1].onStart = [{ kind:'checkpoint', id:'escape' }];
  def.steps[2].text = 'Choose bat, crowbar or machete at the display';
  // A brief choice window precedes automatic stand-to-interact; F/MMB completes instantly.
  def.steps[2].complete = { kind:'interact', anchor:'hardware', seconds:3 };
  def.steps[2].onComplete = [{kind:'grant',item:'melee'}, {kind:'spawn',group:'store'}];
  def.steps.push({ id:'store-fight', type:'killAll', text:'Clear the store — LEFT weapon, RIGHT kick', anchor:'hardware', start:{kind:'objectives',ids:['melee'],mode:'all'}, complete:{kind:'kills',actors:def.groups.store}, fail:[] });
  def.finish = ['store-fight']; def.onComplete = []; def.onStart = [];
  return def;
}
