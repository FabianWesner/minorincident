# Elderly civilian hero

Reference: reference-upscaled.png, reference.png and the elderly panel of living-civilians-and-story-npcs.png. Height ~1.40 m including the cap; head/cap occupies approximately one quarter of the height. +X forward, Z up, -Y anatomical right. Feet and cane ferrule touch z=0.

Identity: burgundy V-neck argyle sweater vest; cream shirt with blue/red plaid and rolled cuffs; roomy brown trousers with turned cuffs, slant front pockets and stitched rear pockets; brown leather shoes with welts, lacing and sole notches. Round open-frame spectacles; large warm eyes, white eyebrows and parted moustache; layered white side and nape hair; brown low flat cap with panel seams, top button and short visor; curved wooden cane in the right hand.

All sculpting subdivision modifiers are applied before export (explicit user requirement). Each anatomical joint is an empty at the joint centre; same-material mesh parts consolidate only within their owning joint. Cane belongs to handR. Socket empties inherit hand/torso motion. All surfaces use flat pal_* Principled materials without textures. Extended palette entries describe reference garment, hair and skin colours absent from the starter token list.

Round 1: identified short vest/long legs, overly open neckline and sleeve/knee joins.
Round 2: lengthened vest, shortened trousers, broadened head, tightened neckline, corrected cuff geometry and knee overlaps; reduced dense surfaces for the 60k budget.
Round 3: completed lower-sleeve plaid, lowered the head to shorten the visible neck, reduced argyle diamond size, and overlapped trouser thighs into the seat to remove hip gaps.
Round 4: finished fuller white moustache/nape curls, consolidated the self-contained source, reduced applied surface density to remain below 60k, and aligned the right weapon socket with the raised cane hand. Final geometry: 58,742 triangles.

Round 5: fit upper-sleeve plaid and vest hem ribs to the applied cloth surfaces, retaining at least 3 mm clearance. Re-exported and repeated both browser checks: WebGPU and WebGL2, no console warnings or errors. Runtime bounds: 0.455 × 1.399 × 0.668 m (glTF Y up).
