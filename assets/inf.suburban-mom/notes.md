# Suburban mom Runner

Reference study: the turnaround shows a buttoned dusty-pink cardigan over a white pointed collar, rolled sleeves, torn blue jeans with turned cuffs, coral and cream sneakers, an auburn shoulder-length half ponytail with a pink scrunchie, a wristwatch, and a brown crossbody handbag on her left hip. These are modeled as separate solid pieces with flat palette materials, no textures.

Adult miniature: 1.531 m in the lunging rest pose; crown-to-neck height is 36.9% of total height. The larger chibi head and hunched reaching stance follow the job's explicit lessons from the first zombies. Blender forward is +X; right is -Y; outsole ground contact is z=0.

Rigid joints: root → hip → torso → head/arms; arms → forearms → hands; hip → thighs → shins → feet. Meshes merge by material within each joint. Neck, shoulder, elbow, wrist, hip, knee and ankle origins stay at anatomical joints. Stump caps live on the retained parent at each detachable joint, use zero scale in the rest GLB, and declare hidden/stumpFor/showScale extras. Toggle visible by setting scale to (1,1,1).

Starter palette identities retain their specified colors. Outfit-specific flat palette extensions describe cardigan rose, auburn/copper hair, denim, stitching and leather shadow. Principled materials use only scalars and colors; red irises use emi_infectedEye.

All subdivision/bevel modifiers are applied before export. The mouth and torn knee openings use actual removed geometry, with separate cavity/skin interiors. Raised blood patches follow surfaces where needed and stand at least 3 mm clear.

R2 proportion review: compared directly with the accepted common-worker hero. The torso leans 27.5°, knee flexion is 76.24° left / 68.17° right, and the right foot leads the left. Head geometry is wider and taller; red irises are larger and brighter. Hands are 48% larger with splayed curved fingers; sleeve/forearm/thigh/calf volumes and sneakers are thicker. Shoulder curls now roll into full S-curves. Surface reshaping happens before export, and all joint nodes remain unscaled with anatomical pivots. Source rig metrics and independent exported GLB measurements agree.
