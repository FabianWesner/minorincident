# Riot cop measurements and construction

Reference: dark slate riot helmet with raised face visor, visible glowing eyes and snarling face, pale rolled/torn sleeves, layered vest and utility belt, thigh/knee/shin armour, heavy boots, left riot shield and right baton. No exposed long hair: small nape/temple volumes under helmet.

Target height 1.60 m. Helmet/head silhouette about 0.53 m (one third), broad shoulders, chunky hands and boots. Relaxed asymmetric crouch matching turnaround, slightly forward torso. +X forward, Z up, -Y right. Separate rigid joint hierarchy, proximal stump caps hidden by zero scale (restore to one on dismemberment). Applied subdivision and bevels; material buckets merged per rigid node.

Final construction uses explicit sphere/tube/font resolution with no collapse modifier. Hidden cap nodes use zero scale and hidden/stumpFor extras; runtime restores scale to one. Static details are merged by material within each rigid parent. Final triangle and node checks are in validation.json.
