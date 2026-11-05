# npc.mr-okafor.aftermath

Original npc.civilian-elderly anatomy, bent posture, cap, spectacles and cane; warm brown living skin and pale wrap.

Derived by replaying the shipped base source anatomy/tailoring recipe before its old reduction and export section. Authored LODs use explicit primitive radial counts, closed profiles and named trim omissions. No mesh decimation. Geometry, original joint hierarchy and sockets are retained; uniform source metres conversion uses the base manifest scale exactly once.

Pale gauze follows the original animated limb owner. Broad asymmetric chest/back soot and dusty lower clothing are vertex colors, folded into pal_picketWhite with the shared palette. Static swatches and attachments batch within the original rigid owners. Skin and iris materials keep their names for crowd infection classification; three materials total. Faces retain living sclera/pupils, no emissive eyes.

Runtime interfaces: root, hip, torso, head, armL/R, foreArmL/R, handL/R, legL/R, shinL/R, footL/R; empty weaponSocketL/R and backpackSocket; +X front empty. No body node: that name selects animal clips in the crowd baker. Character physics stays with the existing NPC simulation contract. Identity continuity, escort behavior, infection swaps and level placement belong to the runtime lane.

Triangle caps: 15000/6000/2000; measured production tiers in report.json. Draw cap: 18; also bounded by shipped base/member in rigDrawBase at each tier. Visual sheets inspected at 135/190 px and all sides; independent acceptance pending. Scene Lab actor gate is blocked by the fixed CivilianCrowd model list, which excludes this identity (see batch report).
