/** PO 2026-11-08: the hangar is a protected, enterable story space between the hunt and final delivery. */
export const cureHangar = {
  centre: { x: 2707, z: 66 },
  entrance: { x: 2707, z: 53 },
  outside: { x: 2707, z: 43 },
  min: { x: 2689.5, z: 53 }, max: { x: 2724.5, z: 79 },
  terminal: { x: 2699, z: 66 }, canister: { x: 2705, z: 66 },
} as const;
export function insideCureHangar(p: { x: number; z: number }, margin = 0): boolean {
  return p.x >= cureHangar.min.x + margin && p.x <= cureHangar.max.x - margin && p.z >= cureHangar.min.z + margin && p.z <= cureHangar.max.z - margin;
}
/** These fences have a courier-width opening; the stalker's authored route goes around the long end. */
export const cureEscapeGaps = [
  { x: 937, z: 80, detourZ: 120 },
  { x: 2137, z: -75, detourZ: -115 },
  { x: 3317, z: 95, detourZ: 135 },
  // The objective-bearing field crossings need the same escape choice as the road.
  { x: 925, z: -12, detourZ: -52 },
  { x: 2110, z: -2, detourZ: 38 },
] as const;
/** The hangar returns every carried weapon, including optional campaign finds and abilities. */
export const cureRackCapacity = 32;
/** Exact line IDs from docs/design/story-script.md. Durations are active simulation ticks. */
export const cureHangarConversation = [
  ['L10.voss-intro', 240], ['L10.voss-sample', 660], ['L10.courier-carried', 150],
  ['L10.voss-cure', 210], ['L10.voss-delivery', 780], ['L10.ruiz', 450],
  ['L10.voss-prototype', 240], ['L10.sam-coming', 150], ['L10.voss-stay', 240], ['L10.sam-delivery', 240],
] as const;

/** Optional porch find in the dead R2 house; never an objective or weapon slot. */
export const cureCorgiToy = { x: 1013, z: 83 };
