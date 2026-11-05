# Butcher hero model

Reference studied: original crop, upscaled four-view turnaround, infected workers sheet and accepted common-worker hero. The adult elite is approximately 2 m tall; a ~0.65 m head/hair silhouette gives the accepted infected chibi ratio. Broad shoulders, hypertrophied arms, wide planted stance and a modest forward neck distinguish it from common infected.

Purposeful parts: ragged shirt and collar, sculpted muscle masses and veins, separate draped white apron with shoulder straps/eyelets and waist bow, olive trousers with pockets and exposed knees, rubber boot shafts/rims/toe guards/welts/treads, sculpted angry face and hollow toothed mouth, thick short layered hair, leather wrist cuffs, pierced steel cleaver attached to right weapon socket. All colours use existing palette tokens. Subdivision is applied before export as requested.

Rigid hierarchy uses shoulder/elbow/wrist, hip/knee/ankle, and neck pivots. Hidden stump caps remain on the proximal joint when distal limbs detach. Review pose moves three required joints and separates the left arm to reveal the shoulder cap.

Final rest measurements: height 2.0593 m, ground clearance effectively 0 m. The scene has 23 exported glTF meshes (16 rigid geometry groups + 7 caps) containing 70 material primitives as reported by Three.js. Triangle count includes the hidden cap geometry: 37,130. Runtime rotations begin at zero with unit joint scales.

Refinement history: initial sculpt/outfit; reduced topology and weighted rest stance; reshaped back apron, turned cleaver, strengthened clothing/hair; connected projected torn sleeve edges. The final build removes unused palette allocations and redundant pose visibility loops.
