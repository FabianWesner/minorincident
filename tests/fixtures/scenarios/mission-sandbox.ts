import type { MissionDef, ObjectiveType, Trigger } from '../../../src/sim/missions/types';
/** Every completion comes from a real sim condition; cheats are tested separately. */
export function missionSandbox(type: ObjectiveType = 'reach'): MissionDef {
  const completions: Record<ObjectiveType, Trigger> = {
    reach: { kind: 'volume', anchor: 'goal', edge: 'inside' },
    interact: { kind: 'interact', anchor: 'goal', seconds: 0.6 },
    kill: { kind: 'kills', actors: ['boss'] }, killAll: { kind: 'kills', actors: ['boss', 'runner'] },
    survive: { kind: 'timer', seconds: 2 }, defend: { kind: 'timer', seconds: 2 },
    escort: { kind: 'escort', actor: 'escort', anchor: 'goal' },
    collect: { kind: 'items', ids: ['fuse', 'keys'] }, drive: { kind: 'drive', actor: 'car', anchor: 'goal' },
    custom: { kind: 'count', key: 'breakers', atLeast: 3 },
  };
  return {
    id: 'mission-sandbox', briefing: 'Complete the sandbox objective.',
    anchors: { goal: { x: 5, z: 0, radius: 2 }, spawn: { x: -5, z: 0, radius: 2 } },
    actors: {
      boss: { kind: 'infected', faction: 'infected', archetype: 'infected.patient-zero', anchor: 'spawn', hp: 100, boss: true },
      runner: { kind: 'infected', faction: 'infected', archetype: 'infected.runner', anchor: 'spawn', hp: 40 },
      escort: { kind: 'escort', faction: 'escort', archetype: 'escort.neighbor', anchor: 'spawn', hp: 100 },
      car: { kind: 'vehicle', faction: 'survivor', archetype: 'vehicle.sedan', anchor: 'spawn', hp: 100 },
      target: { kind: 'defend', faction: 'survivor', archetype: 'convoy.bus', anchor: 'spawn', hp: 200 },
    }, groups: { actors: ['boss', 'runner', 'escort', 'car', 'target'] }, gates: { exit: { anchor: 'goal', open: false } },
    items: ['fuse', 'keys'], states: ['driving:car', 'power'], counters: ['breakers'], checkpoints: ['C'],
    cinematics: { twist: { seconds: 2, caption: 'Mission successful. Outbreak not contained.', position: [12, 15, 12], target: [5, 0, 0], actions: [{ kind: 'grant', item: 'keys' }, { kind: 'gate', id: 'exit', open: true }] } },
    steps: [{ id: type, type, text: `Complete ${type}`, anchor: 'goal', start: { kind: 'start' }, complete: completions[type], fail: type === 'escort' ? [{ trigger: { kind: 'dead', actor: 'escort' }, reason: 'escort-died' }] : type === 'defend' ? [{ trigger: { kind: 'dead', actor: 'target' }, reason: 'target-destroyed' }] : [] }],
    finish: [type], onStart: [{ kind: 'spawn', group: 'actors' }, { kind: 'radio', id: 'L1.briefing' }], onComplete: [],
  };
}
