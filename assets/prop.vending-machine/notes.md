# Fizz vending machine

Reference silhouette: 1.0 m wide, 0.70 m deep, 2.174 m tall including top screws; four 0.12 m feet. Front faces +X, base touches z=0. Blue rounded cabinet encloses a red illuminated inset. Eight cans, four buttons, a dark recessed dispensing hatch, lid screws and rear ventilation provide the middle-detail finish.

The palette's policeBlue is brighter than the reference's indigo. Geometry replaces all printing: the script-style Fizz word, can branding and bubbles have at least 3 mm clearance. Surface weathering is represented by coarse edge chips rather than the reference's fine scratches. Can artwork is simplified.

`door_front` rotates about its left vertical hinge. `delivery_flap` rotates about its top hinge, in the door's hierarchy. Static geometry is joined by material within each assembly. Light metadata belongs to the door; physics metadata and the cuboid collider belong to `root`. No camera, Blender light or stage mesh is exported.

Review rounds are saved as `renders/roundN-ref.png` and `renders/roundN-game.png`. Final Blender renders and Three.js views are separate artifacts.
