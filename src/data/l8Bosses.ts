/** L8 encounter tuning in metres, HP and fixed ticks. Entries sit on connected public paths. */
export const l8BossArenas = [
  { id: 'flamingo', name: 'Flamingo flock', count: 7, hp: 780, centre: { x: -6, z: -27 }, entry: { x: 0, z: -9 }, radius: 17, counter: 'Step sideways out of the shadow lane; sweep the birds as they land.' },
  { id: 'zebra', name: 'Zebra herd', count: 4, hp: 1250, centre: { x: 60, z: 32 }, entry: { x: 60, z: 8 }, radius: 23, counter: 'Leave the dust lane. The fence turns the herd; shoot the stragglers.' },
  // The healthy pack lives in the fenced primate yard north of the house. Keep
  // its arena trigger there too; the former centre sat on Nadia's tour.
  { id: 'monkey', name: 'Monkey pack', count: 7, hp: 840, centre: { x: -14, z: 26 }, entry: { x: -8, z: 21 }, radius: 13, counter: 'Use the doorway to stop the pack surrounding you. Melee shakes off a grab.' },
  { id: 'lion', name: 'Lion and lioness', count: 2, hp: 3200, centre: { x: -60, z: -32 }, entry: { x: -60, z: -8 }, radius: 23, counter: 'Keep your back to the rocks. Dodge sideways at the glint and fire after the landing.' },
  { id: 'gorilla', name: 'Gorilla', count: 1, hp: 6000, centre: { x: 60, z: -32 }, entry: { x: 60, z: -8 }, radius: 23, counter: 'Hit the chest-beat to interrupt it. Put a pillar between you and a throw.' },
  { id: 'elephant', name: 'Elephant', count: 1, hp: 5000, centre: { x: -60, z: 32 }, entry: { x: -60, z: 8 }, radius: 23, counter: 'Sidestep a charge into a wall or the truck. Three impacts stop him.' },
] as const;
export type L8BossId = typeof l8BossArenas[number]['id'];
export const l8ArenaKeys = l8BossArenas.map(a => `arena-${a.id}`);
