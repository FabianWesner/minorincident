/** E08 balance: all durations are fixed 60 Hz ticks; sampling uses the npc RNG stream. */
export const npcs = {
  grabTicks: 90, staggerTicks: [60, 120], downTicks: [240, 480], petDownTicks: [120, 240],
  risingTicks: 72, eyesTicks: 120, petInfectionChance: .45,
  panicRadius: 12, routineSpeed: 1.5, fleeSpeed: 4.8,
  density: [60, 40, 24, 12, 6, 3], caps: [15, 40, 60, 80, 150, 200],
  turnChainLimit: [8, 20, 30, 40, 80, 100],
  reviveTicks: 120, downedTicks: 1200, corgiRecoveryTicks: 600,
} as const;
export const civilianRoles = [
  { role: 'jogger', routine: 'jog', variant: 'inf.jogger', color: '#3178ac' },
  { role: 'cashier', routine: 'shop', variant: 'inf.cashier', color: '#e5d9b9' },
  { role: 'bbq-dad', routine: 'walk-dog', variant: 'inf.bbq-dad', color: '#a86645' },
  { role: 'suburban-mom', routine: 'bus-stop', variant: 'inf.suburban-mom', color: '#79865b' },
  { role: 'delivery-driver', routine: 'carry-belongings', variant: 'inf.delivery-driver', color: '#d4ad32' },
  { role: 'bathrobe-neighbor', routine: 'chat', variant: 'inf.bathrobe-neighbor', color: '#ac7a91' },
] as const;
