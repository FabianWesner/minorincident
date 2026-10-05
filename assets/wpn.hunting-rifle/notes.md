# Hunting rifle

1.313 m long, +X forward, +Z up. Stock/fore-end occupy about 72% of the length. Sculpted wooden outline includes a scooped wrist and dropped pistol grip. The reference is mirrored relative to the preview camera, so the muzzle projects right while still following the +X contract.

Parts: walnut stock and recoil pad, barrel and hollow crown, receiver/ejection port, bolt/ball handle, rail and scope mounts, stepped scope bells and recessed lenses, adjustment turrets, trigger/guard, sling loops, sight, checkered grip and fore-end panel.

Static geometry joins by palette; bolt and knob stay separate with the bolt origin at the receiver joint. `grip` and `muzzle` are empties. Vertex AO is baked deterministically in Cycles (32 samples). No textures or brand markings. Raised stock relief stands at least 4 mm above the side plane. Fine wood grain from the reference is simplified to geometric relief, avoiding high-frequency texture noise at gameplay scale.

Three rounds: silhouette blockout and renderer check; layered hardware and ground-contact correction; nondegenerate disk topology, vertex AO and final renders.
