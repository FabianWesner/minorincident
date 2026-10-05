# Bathrobe neighbor

Reference: original civilian infected sheet and both supplied crops. Adult infected,
+X forward, +Z up, right side at -Y. Chibi head follows accepted common-worker
proportions (approximately one third of visible height).

Parts: sculpted skull/jaw and open toothy mouth, volumetric swept gray-brown hair,
red emissive eyes, open bloody chest, thick blue plaid robe, pale shawl collar,
rolled cuffs, tied belt with two tails, patch pockets, ragged hem, bare knees/calves,
open-backed slippers with raised rim and seven-tuft pompoms, curled fingers/nails.

Rigid hierarchy: hip/torso/head; shoulder/elbow/wrist and hip/knee/ankle chains.
Subdivision is applied before export. Static decorations join by palette material
within each rigid parent. Proximal stump meshes retain names, zero scale and
hidden/stumpFor extras so runtime can reveal them. Rest transforms are baked into
geometry and joint locations; nodes have unit scale and zero rotation.

Plaid uses mesh material regions, no image textures or coplanar decals. Blood
silhouettes project onto evaluated geometry, offset 4 mm. Deterministic seed 71.
