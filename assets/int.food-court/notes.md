# Food court production notes

World frame: +X forward, +Z up, metres, foundation on z = 0, centered in X/Y. Approximate bounds: X 10.108 m, Y 12.8 m, Z 4.915 m.

Reference composition: chamfered open floor plinth and L-shaped walls; generic burger, Asian kitchen and taco stalls; five four-seat tables; five planted dividers/pots; two tray islands and six waste bins. Purposeful detail includes layered burgers, fries, soda fountains, cups, fry baskets, steamers, ovens, griddles, extraction vents, registers, menu boards, sauce caddies, tray stacks, napkin dispensers, recessed bin mouths, wall sconces and ribbed red lanterns.

Palette-only Principled materials and emissive windowGlow, with raised geometric lettering/icons. Roof, interior, suspended lamps, wall sconces, light metadata and collider empties remain identifiable. Static geometry joins by material. Vertex AO is baked at 32 deterministic samples with a .55 ambient floor.

LOD0 99,328 triangles / 40 draws; LOD1 11,459 / 40; LOD2 2,700 / 25. Four sconces and three lanterns account for 14 separate lamp material draws; static budgets are 26, 26 and 11 respectively. LOD1 retains simple closed boxes and floor planes, then simplifies details. LOD2 uses those broad forms, crossed furniture supports, coarse leaf blades and plain signs/menu panels; fine text/equipment/trays are culled at distance.
