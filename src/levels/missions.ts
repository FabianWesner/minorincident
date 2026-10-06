import { dialogue } from '../data/dialogue';
import type { DistrictId } from './districts/types';
import type { DistrictWorld } from '../sim/world/DistrictWorld';
import type { Anchor, MissionDef, ObjectiveDef, ObjectiveType, Trigger } from '../sim/missions/types';

export const missionIds = ['L1','L2','L3','L4','L5','L6'] as const;
export type MissionId = typeof missionIds[number];
/** Campaign graph authoring, distinct from encounter tuning and bots owned by E19–E24.
 * Coordinates come from loaded district GLB anchors; no duplicate placement coordinates. */
export function campaignMission(id: MissionId, resolve: (district: DistrictId, anchor: string) => Anchor): MissionDef {
  const def: MissionDef = { id, briefing: dialogue[`${id}.briefing`], anchors: {}, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: [], cinematics: {}, steps: [], finish: [], onStart: [{ kind: 'radio', id: `${id}.briefing` }], onComplete: [{ kind: 'cinematic', id: 'twist' }] };
  const anchor = (key: string, district: DistrictId, name: string) => { def.anchors[key] = resolve(district, name); return key; };
  const actor = (key: string, at: string, kind: string, hp = 100, boss = false) => {
    def.actors[key] = { anchor: at, kind, faction: kind === 'infected' ? 'infected' : 'survivor', archetype: `${kind}.${key}`, hp, boss };
    def.groups[key] = [key]; return key;
  };
  const step = (key: string, type: ObjectiveType, text: string, at: string, complete: Trigger, after?: string[]): ObjectiveDef => {
    const prev = after ?? (def.steps.length ? [def.steps[def.steps.length - 1].id] : []);
    const s: ObjectiveDef = { id: key, type, text, anchor: at, start: prev.length ? { kind: 'objectives', ids: prev, mode: 'all' } : { kind: 'start' }, complete, fail: [] };
    def.steps.push(s); return s;
  };
  const reach = (key: string, text: string, at: string, after?: string[]) => step(key, 'reach', text, at, { kind: 'volume', anchor: at, edge: 'inside' }, after);
  const interact = (key: string, text: string, at: string, seconds = 0.6, after?: string[]) => step(key, 'interact', text, at, { kind: 'interact', anchor: at, seconds }, after);
  const checkpoint = (s: ObjectiveDef) => { def.checkpoints.push(s.id); (s.onStart ??= []).push({ kind: 'checkpoint', id: s.id }); };
  const defend = (key: string, text: string, at: string, target: string, seconds: number) => {
    const s = step(key, 'defend', text, at, { kind: 'timer', seconds }); s.fail = [{ trigger: { kind: 'dead', actor: target }, reason: 'target-destroyed' }]; s.onStart = [{ kind: 'spawn', group: target }]; checkpoint(s); return s;
  };
  let end: string;
  switch (id) {
    case 'L1': {
      const diner = anchor('diner','D-MAIN','diner-door'), hardware = anchor('hardware','D-MAIN','hardware-display'), pharmacy = anchor('pharmacy','D-SHOP','pharmacy-door');
      reach('breakfast', "Go to Joe’s Diner for breakfast", diner).onComplete = [{ kind: 'tier', tier: 1 }];
      reach('escape', 'Get away! Reach the hardware store.', hardware);
      const pickup = interact('melee','Pick up a melee weapon',hardware); def.items.push('melee'); pickup.onComplete = [{ kind: 'grant', item: 'melee' }]; checkpoint(pickup);
      for (let i=1;i<=3;i++) reach(`trail-${i}`,`Follow the trail of incidents (${i}/3)`,anchor(`trail-${i}`,i<3?'D-MAIN':'D-SHOP',i===1?'arrival':i===2?'exit':'arrival'));
      const boss = actor('patient-zero',pharmacy,'infected',600,true), kill = step('source','kill','Defeat Patient Zero',pharmacy,{ kind: 'kills', actors: [boss] }); kill.onStart = [{ kind: 'spawn', group: boss }]; checkpoint(kill);
      end = interact('seal','Seal the cooler room',pharmacy,3).id; break;
    }
    case 'L2': {
      const home = anchor('home','D-RES','safe-house-door'), school = anchor('school','D-SCHOOL','gym-door'), buses = anchor('buses','D-PARK','safe-point');
      const alvarez = actor('alvarez',home,'escort'), brother = actor('brother',school,'escort'), bus = actor('bus',buses,'defend');
      interact('neighbor','Help Mrs. Alvarez',home).onComplete = [{ kind: 'spawn', group: alvarez }];
      checkpoint(reach('school','Reach Sunset Grove Elementary',school));
      const rescue = interact('brother','Find your brother in the gym',school); rescue.onComplete = [{ kind: 'spawn', group: brother }]; checkpoint(rescue);
      for (const npc of [alvarez,brother]) {
        const s = step(`escort-${npc}`,'escort',`Escort ${npc} to the buses`,buses,{ kind: 'escort', actor: npc, anchor: buses },['brother']); s.fail = [{ trigger: { kind: 'dead', actor: npc }, reason: 'escort-died' }];
      }
      const s = defend('board','Hold the buses while everyone boards',buses,bus,60); s.start = { kind: 'objectives', ids: ['escort-alvarez','escort-brother'], mode: 'all' }; end = s.id; break;
    }
    case 'L3': {
      const fuel = anchor('fuel','D-MAIN','fuel-shop-door'), market = anchor('market','D-SHOP','market-door'), park = anchor('park','D-PARK','arrival'), gate = anchor('camp','D-CIVIC','hospital-door');
      const car = actor('sedan',fuel,'vehicle'); def.states.push(`driving:${car}`);
      interact('car','Get the sedan keys',fuel).onComplete = [{ kind: 'spawn', group: car }];
      for (const [key, at] of [['market-route',market],['park-route',park]]) { const s = step(key,'drive',`Drive via ${key === 'market-route' ? 'the supermarket' : 'the park'}`,at,{ kind: 'drive', actor: car, anchor: at },['car']); s.choice = 'route'; s.timer = 720; }
      const checkpointStep = reach('checkpoint','Clear the police checkpoint',anchor('checkpoint','D-CIVIC','checkpoint-door')); checkpointStep.start = { kind: 'objectives', ids: ['market-route','park-route'], mode: 'any' }; checkpoint(checkpointStep);
      const s = reach('gates','Reach the Civic Center gates',gate); s.timer = 720; end = s.id; break;
    }
    case 'L4': {
      const hub = anchor('hub','D-CIVIC','station-door'), substation = anchor('substation','D-EDGE','substation-door'), crossing = anchor('crossing','D-EDGE','arrival'), bridge = anchor('bridge','D-EDGE','exit');
      reach('hub','Meet the survivor group at the fire station',hub);
      for(let i=1;i<=3;i++) { const s = interact(`breaker-${i}`,`Restart breaker ${i}/3`,substation,3,i===1?['hub']:[`breaker-${i-1}`]); if(i===3)checkpoint(s); }
      const fuse = interact('fuse','Recover the fuse via the zoo',anchor('zoo','D-ZOO','zoo-entrance'),3,['hub']); def.items.push('fuse'); fuse.onComplete = [{ kind: 'grant', item: 'fuse' }];
      checkpoint(interact('crossing','Raise the rail crossing gates',crossing,3,['fuse']));
      def.states.push('blockade-cleared'); checkpoint(step('blockade','custom','Clear the bridge wreck blockade',bridge,{ kind: 'state', key: 'blockade-cleared', equals: true },['hub']));
      end = reach('bridge','Return to the bridge',bridge,['breaker-3','crossing','blockade']).id; break;
    }
    case 'L5': {
      const positions = [anchor('res','D-RES','arrival'),anchor('fuel','D-MAIN','fuel-shop-door'),anchor('checkpoint','D-CIVIC','checkpoint-door'),anchor('bridge','D-EDGE','exit')];
      const convoy = actor('convoy',positions[0],'defend',1000);
      for(let i=0;i<4;i++) {
        if(i) { const s = reach(`fallback-${i}`,'Fall back to the next position',positions[i]); s.timer = 30; s.onStart = [{ kind: 'radio', id: 'L5.fallback' }]; }
        const prep = step(`prep-${i+1}`,'survive','Prepare the fallback position',positions[i],{ kind: 'timer', seconds: 20 }); checkpoint(prep);
        defend(`hold-${i+1}`,`Hold position ${i+1}/4`,positions[i],convoy,[90,100,110,120][i]);
      }
      end = 'hold-4'; break;
    }
    case 'L6': {
      reach('home','Leave the burning neighborhood',anchor('home','D-RES','arrival'));
      checkpoint(interact('school','Open the schoolyard gate',anchor('school','D-SCHOOL','school-entrance'),3));
      checkpoint(reach('mall','Cross the overrun mall',anchor('mall','D-SHOP','mall-door')));
      const station = anchor('station','D-CIVIC','station-door'), edge = anchor('edge','D-EDGE','arrival'), helipad = anchor('helipad','D-EDGE','safe-point'), engine = actor('fire-engine',station,'vehicle'); def.states.push(`driving:${engine}`);
      const s = interact('engine','Start the fire engine',station,3); s.onComplete = [{ kind: 'spawn', group: engine }]; checkpoint(s);
      checkpoint(step('drive','drive','Drive through Main Street to the town edge',edge,{ kind: 'drive', actor: engine, anchor: edge }));
      for(let i=1;i<=3;i++) interact(`flare-${i}`,`Light extraction flare ${i}/3`,helipad);
      const hold = step('extraction','survive','Hold the helipad until dawn',helipad,{ kind: 'timer', seconds: 150 }); checkpoint(hold); end = hold.id; break;
    }
  }
  def.finish = [end]; const at = def.anchors[def.steps.at(-1)!.anchor];
  def.cinematics.twist = { seconds: 20, caption: dialogue[`${id}.twist`], position: [at.x+18,22,at.z+18], target: [at.x,0,at.z], actions: [{ kind: 'radio', id: `${id}.twist` }] };
  return def;
}
/** Missing loaded anchors are authoring errors, never silently replaced with coordinates. */
export function resolveCampaignMission(id: MissionId, world: DistrictWorld): MissionDef {
  return campaignMission(id, (district, name) => {
    const d = world.districts.find(d => d.id === district), a = d?.layout.anchors[name];
    if (!d || !a) throw new Error(`Missing mission anchor: ${district}/${name}`);
    return { x: a.position[0]+d.origin[0], z: a.position[2]+d.origin[1], radius: 2 };
  });
}
