import { dialogue } from '../data/dialogue';
import type { DeviceKind } from '../sim/interact/Interactables';
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
  const device = (key: string, text: string, at: string, kind: DeviceKind, seconds: number, after?: string[]) => {
    const id = `device-${key}`;
    actor(id, at, 'device'); def.actors[id].archetype = `device.${kind}`;
    def.actors[id].device = { radius: def.anchors[at].radius, holdTime: seconds, instant: false, interruptOnDamage: true, label: text };
    const s = step(key, 'interact', text, at, { kind: 'interact', anchor: at, seconds, actor: id }, after);
    s.onStart = [{ kind: 'spawn', group: id }]; return s;
  };
  const checkpoint = (s: ObjectiveDef) => { def.checkpoints.push(s.id); (s.onStart ??= []).push({ kind: 'checkpoint', id: s.id }); };
  const defend = (key: string, text: string, at: string, target: string, seconds: number) => {
    const s = step(key, 'defend', text, at, { kind: 'hold', anchor: at, seconds }); s.fail = [{ trigger: { kind: 'dead', actor: target }, reason: 'target-destroyed' }]; s.onStart = [{ kind: 'spawn', group: target }]; checkpoint(s); return s;
  };
  let end: string;
  switch (id) {
    case 'L1': {
      // L1 v2 (specs/epic-19 section 3): courier job, hand-over, accident, systemic spread, bat, fire station.
      def.l1 = true;
      for (const name of ['player-start', 'parcel-counter', 'lab-door', 'lab-gate', 'lab-exit-front', 'lab-exit-side', 'lab-exit-window', 'lab-smoke-vent', 'lab-smoke-window', 'lab-tech-spawn', 'lab-bike-rack', 'garage-door', 'garage-bat', 'fire-bay-door', 'fire-bay-trigger', 'elm-horde-entry', ...[1, 2, 3, 4, 5, 6].map(i => `edge-in-${i}`)]) anchor(name, 'D-GROVE', name);
      // Entire completion volume is inside the open doorway, never on the apron.
      def.anchors['fire-bay-trigger'].radius = .5;
      def.onComplete = [{ kind: 'radio', id: 'L1.twist' }];
      // Doors that director infected emerge from (spec PO request 2026-10-07).
      for (let i = 1; i <= 80; i++) { try { anchor(`refuge-door-${i}`, 'D-GROVE', `refuge-door-${i}`); } catch { break; } }
      def.items.push('parcel', 'bat'); def.states.push('delivered', 'exited', 'away', 'safe'); def.checkpoints.push('accident', 'bat');
      def.gates['fire-shutter'] = { anchor: 'fire-bay-door', open: true };
      const pickup = interact('pickup', 'Pick up the package at the courier depot', 'parcel-counter', 1);
      pickup.onComplete = [{ kind: 'grant', item: 'parcel' }, { kind: 'radio', id: 'L1.pickedUp' }];
      // Completes when the technician has taken the box and walked back in (LevelOneOutbreak drives `delivered`).
      step('deliver', 'interact', 'Deliver the package to the Medical Annex', 'lab-door', { kind: 'state', key: 'delivered', equals: true });
      // Beat 5 leaves no objective for 4 to 6 s; the objective below starts when the infected exit.
      // PO feedback 2026-10-07: the weapon objective and its marker appear at once after the exits (no gate), the world stays live.
      const escape = step('escape', 'custom', 'Get away from the facility', 'garage-door', { kind: 'state', key: 'exited', equals: true }, []);
      escape.start = { kind: 'state', key: 'exited', equals: true }; escape.onStart = [{ kind: 'radio', id: 'L1.bang' }];
      const bat = interact('weapon', 'Find something to defend yourself', 'garage-bat', 0.6);
      // The marker sits at the garage door (visible from the street), the interaction itself stays at the bench.
      bat.onStart = [{ kind: 'marker', anchor: 'garage-door' }];
      bat.onComplete = [{ kind: 'grant', item: 'bat' }, { kind: 'checkpoint', id: 'bat' }];
      // PO: the courier walks into the bay herself; no cinematic, auto-walk or input lock.
      const fire = reach('firestation', 'Go into the fire station', 'fire-bay-trigger');
      fire.onStart = [{ kind: 'radio', id: 'L1.fire' }];
      fire.onComplete = [{ kind: 'state', key: 'safe', value: true }, { kind: 'gate', id: 'fire-shutter', open: false }];
      end = fire.id; break;
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
      const car = actor('sedan',fuel,'vehicle'); def.deadline = { seconds: 720, retryGraceSeconds: 60 };
      interact('car','Get the sedan keys',fuel).onComplete = [{ kind: 'spawn', group: car }];
      for (const [key, at] of [['market-route',market],['park-route',park]]) { const s = step(key,'drive',`Drive via ${key === 'market-route' ? 'the supermarket' : 'the park'}`,at,{ kind: 'drive', actor: car, anchor: at },['car']); s.choice = 'route'; }
      const checkpointStep = reach('checkpoint','Clear the police checkpoint',anchor('checkpoint','D-CIVIC','checkpoint-door')); checkpointStep.start = { kind: 'objectives', ids: ['market-route','park-route'], mode: 'any' }; checkpoint(checkpointStep);
      const s = reach('gates','Reach the Civic Center gates',gate); end = s.id; break;
    }
    case 'L4': {
      const hub = anchor('hub','D-CIVIC','station-door'), substation = anchor('substation','D-EDGE','substation-door'), crossing = anchor('crossing','D-EDGE','arrival'), bridge = anchor('bridge','D-EDGE','exit');
      reach('hub','Meet the survivor group at the fire station',hub);
      for(let i=1;i<=3;i++) { const s = device(`breaker-${i}`,`Restart breaker ${i}/3`,substation,'breaker',3,i===1?['hub']:[`breaker-${i-1}`]); if(i===3)checkpoint(s); }
      const zoo = anchor('zoo','D-ZOO','zoo-entrance'), fuseActor = actor('zoo-fuse',zoo,'pickup');
      def.items.push('fuse'); def.actors[fuseActor].item = 'fuse';
      const fuse = step('fuse','collect','Recover the fuse via the zoo',zoo,{ kind: 'items', ids: ['fuse'] },['hub']); fuse.onStart = [{ kind: 'spawn', group: fuseActor }];
      const lever = device('crossing','Raise the rail crossing gates',crossing,'lever',3,['fuse']); def.actors['device-crossing'].device!.requires = ['fuse']; checkpoint(lever);
      const wreck = actor('blockade',bridge,'prop',180); def.actors[wreck].archetype = 'prop.barricade';
      const blockade = step('blockade','custom','Clear the bridge wreck blockade',bridge,{ kind: 'destroy', actor: wreck },['hub']); blockade.onStart = [{ kind: 'spawn', group: wreck }]; checkpoint(blockade);
      end = reach('bridge','Return to the bridge',bridge,['breaker-3','crossing','blockade']).id; break;
    }
    case 'L5': {
      const positions = [anchor('res','D-RES','arrival'),anchor('fuel','D-MAIN','fuel-shop-door'),anchor('checkpoint','D-CIVIC','checkpoint-door'),anchor('bridge','D-EDGE','exit')];
      const convoy = actor('convoy',positions[0],'defend',1000);
      for(let i=0;i<4;i++) {
        if(i) { const s = reach(`fallback-${i}`,'Fall back to the next position',positions[i]); s.timer = 30; s.onStart = [{ kind: 'radio', id: 'L5.fallback' }]; }
        const prep = step(`prep-${i+1}`,'survive','Prepare the fallback position',positions[i],{ kind: 'hold', anchor: positions[i], seconds: 20 }); checkpoint(prep);
        defend(`hold-${i+1}`,`Hold position ${i+1}/4`,positions[i],convoy,[90,100,110,120][i]);
      }
      end = 'hold-4'; break;
    }
    case 'L6': {
      reach('home','Leave the burning neighborhood',anchor('home','D-RES','arrival'));
      checkpoint(device('school','Open the schoolyard gate',anchor('school','D-SCHOOL','school-entrance'),'gate',3));
      checkpoint(reach('mall','Cross the overrun mall',anchor('mall','D-SHOP','mall-door')));
      const station = anchor('station','D-CIVIC','station-door'), edge = anchor('edge','D-EDGE','arrival'), helipad = anchor('helipad','D-EDGE','safe-point'), engine = actor('fire-engine',station,'vehicle');
      const s = device('engine','Start the fire engine',station,'switch',3); s.onComplete = [{ kind: 'spawn', group: engine }]; checkpoint(s);
      checkpoint(step('drive','drive','Drive through Main Street to the town edge',edge,{ kind: 'drive', actor: engine, anchor: edge, exit: true }));
      for(let i=1;i<=3;i++) device(`flare-${i}`,`Light extraction flare ${i}/3`,helipad,'button',.6);
      const hold = step('extraction','survive','Hold the helipad until dawn',helipad,{ kind: 'hold', anchor: helipad, seconds: 150 }); checkpoint(hold); end = hold.id; break;
    }
  }
  def.finish = [end]; const at = def.anchors[def.steps.at(-1)!.anchor];
  if (id !== 'L1') def.cinematics.twist = { seconds: 20, caption: dialogue[`${id}.twist`], position: [at.x+18,22,at.z+18], target: [at.x,0,at.z], actions: [{ kind: 'radio', id: `${id}.twist` }] };
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
