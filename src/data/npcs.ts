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
/**
 * L1 v2 pedestrians (specs/epic-19 section 5.1). Shirt tints combine with the five civilian silhouettes so that no two
 * neighbours share a model+tint pair; hand props drop on startle or bite, accessories stay through infection (5.7).
 */
export const l1Pedestrians = {
  models: ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'],
  shirts: ['#3178ac', '#e5d9b9', '#a86645', '#79865b', '#d4ad32', '#ac7a91', '#c4473d', '#4f8f8a', '#6d5aa8', '#e08a3c', '#2f4858', '#9bb7d4'],
  accessories: ['none', 'cap', 'glasses', 'backpack', 'scarf'],
  handProps: ['coffee', 'bag', 'phone', 'cane', 'watering-can'],
  /** Seconds between top-up walkers entering from an edge while the director tops up (section 5.9). */
  topUpEveryS: 2,
  /** Refuge or edge counts as reached within this radius (escaped). */
  refugeReachM: 1.2,
  /** Seconds spent opening a refuge door (houses, shops) before being safe inside; edges are instant. */
  doorOpenS: 1.0,
  /** Bite reach of an infected that is not already holding someone. */
  grabReachM: 1.0,
  /** A grabbing infected farther than this from its victim has been knocked away (rescue). */
  grabBreakM: 1.8,
  /** Share of non-elderly, non-jogger adults that rise athletic ("young adults"). */
  athleticShare: 0.25,
} as const;
