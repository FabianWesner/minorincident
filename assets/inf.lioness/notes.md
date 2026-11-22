# inf.lioness

TRELLIS.2 reconstruction from the approved lioness game view. The durable 300k high and input are in `/Users/wesner/Workspace/trellis-highs/s224-inf-lioness/` (high SHA256 `c7764027c367401766902c75644182ebfc1dcd5ad74167d4220efbc27aa11433`; input SHA256 `64896ca4ce34c98cbe2adc56269a1fc4b488edf49908f689d4c9e165b9fd3e83`). The solidified source LODs are one watertight component at 1,800 / 850 / 650 triangles. Eight-view silhouette IoU is 0.933 / 0.931 / 0.936.

The production candidate is rebuilt through the continuous skinned crowd path, preserving the existing lioness skeleton and animation. It uses authored emissive eye landmarks, a broad red flank/back wound pass with pale tissue strokes, and blood over the muzzle. It does not use the preliminary rigid-part cut bake that showed triangular openings.

Rebuild from this cast source with:

```sh
CROWD_Q=128 CROWD_WEIGHT_BITS=8 CROWD_JOINT_BITS=8 CROWD_PIPELINE=/Users/wesner/Workspace/minorincident_3dpipeline \
  sh tools/assets/skin-crowd-build.sh assets/inf.lioness/s224-lioness inf.lioness
node --import tsx tools/assets/compact-zoo-delivery.ts test-results/followups-25/zoo-delivery-s224-lioness.json
```

The compacted HIGH and LOW GLBs are each 74,220 / 49,960 / 40,916 bytes for LOD0/1/2; measured geometry is 1,860 / 880 / 699 total triangles. All are below the pre-change lioness ceilings of 82,092 / 57,512 / 49,616 bytes and 3,837 / 1,944 / 873 triangles. The compact step asserts decoded geometry, skin joints, bind matrices, node transforms, and KTX2 bytes are unchanged, then enforces those lioness ceilings.

Visual acceptance is still open: review this delivery against the old lioness at game camera zoom 1 and 1.5, HIGH and LOW, all LODs, and through its motions. The combined seven-animal sheet and final scene/remote gates are also pending.
