/** Courier-bike GLB metres at the runtime toy scale; measured in assets/veh.courier-bike/report.json. */
export const bicycleGeometry = {
  scale: .6,
  minX: -1.385681 * .6, maxX: 1.411812 * .6, halfWidth: .380008 * .6, height: 1.204 * .6,
  rearWheel: -.94 * .6, frontWheel: 1.035 * .6,
  /** While mounted the saddle is centred on the player capsule. */
  mountOffset: .65 * .6,
  edgeClearance: .1,
} as const;
