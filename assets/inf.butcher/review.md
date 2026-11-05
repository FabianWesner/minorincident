# Final review — inf.butcher

Approved after four visual build rounds. Final hero (1600×900, 96 samples), four-view turnaround, and pose proof were inspected and compared again with reference-upscaled.png and the original crop. The enlarged head follows the accepted common-worker infected rather than the smaller head in the image reference. The ~2.06 m elite keeps the broad shoulders, heavy bare arms, hunched neck, relaxed wide stance, dark tousled hair, torn grey shirt, stained white apron, rear bow, olive trousers, wrist bands, rubber boots, and pierced hanging cleaver.

The final changes fitted the back apron to the shoulder hump, oriented the cleaver to remain readable from the front and hero view, and attached sleeve tears to the sculpted clothing edge. Visible details use palette geometry; stains stand 4 mm above their projected surfaces. All subdivision, bevels and mesh reduction are applied before export. Static details are joined within each rigid joint group.

Pose proof: armL rotates 0.55 radians around X, foreArmL rotates −0.6 around Y, and legR rotates −0.3 around Y. The left arm is separated beside the body and stump_armL is shown. The shoulder cap, curled detached forearm and lifted boot visibly demonstrate the joints and hierarchy.

Validation: validate_glb.py passes required node/socket parenting, seven hidden proximal stump caps, palette-only materials, finite vertex coordinates, unit joint scales, zero rest rotations, triangle budget and ground contact. The exported file has 37,130 triangles and 23 glTF mesh groups (70 material primitives in Three.js).

Browser proof: capture_glb.mjs completed WebGPU and WebGL2 captures at azimuths 35°, 215° and the gameplay camera. backend-check.jsonl reports errors=[] for both. Browser captures were inspected for intact parts and readable silhouette. No unresolved gaps. No specification or reference images were edited.
