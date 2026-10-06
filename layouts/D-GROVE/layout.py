"""Sunset Grove (L1 v2): skeleton on a flat placeholder ground, 170 x 110 m, origin at map centre (X east, Z south).

Lane L0 exports every named anchor of epics-pipeline/l1v2-lanes.md section 3 at its planned position; lane A builds the
real district on top (streets, houses, dressing, colliders) and may move items by <= 10 m. Gameplay tuning stays in
src/levels/districts/D-GROVE.ts and src/data/l1v2.ts.
"""
from sslib.layout import Layout
l = Layout('D-GROVE', 'Sunset Grove', size=(170, 110))

# Planned area centres: Maple Corner (-70,10), Courier (-45,-35), Juniper loop (-5,0), Medical Annex (65,-15),
# annex bike rack (55,-5), Henderson garage (20,35), car wash (-50,45), Fire Station 3 (-75,40).
ANCHORS = {
    # Maple Corner (start)
    'player-start': (-67, 12), 'bike-start': (-70, 10), 'cafe-patio': (-75, 5), 'bus-stop': (-62, 14),
    # Main Row / Sunset Grove Courier depot
    'parcel-counter': (-45, -33), 'parcel-door': (-45, -30),
    # Sunset Grove Medical Annex
    'lab-gate': (59, -8), 'lab-bike-rack': (55, -5), 'lab-door': (65, -9), 'lab-tech-spawn': (66, -17),
    'lab-exit-front': (65, -10), 'lab-exit-side': (73, -15), 'lab-exit-window': (59, -14),
    'lab-smoke-vent': (66, -19), 'lab-smoke-window': (59, -18),
    # Henderson garage (Elm Street)
    'garage-door': (20, 31), 'garage-bat': (21, 36),
    # Fire Station 3
    'fire-bay-door': (-75, 36), 'fire-bay-trigger': (-75, 38),
    # Back-alley toys
    'gate-1': (-20, 20), 'gate-2': (10, -25), 'gate-3': (45, 15),
    'dumpster-1': (-30, -20), 'dumpster-1-end': (-30, -23), 'dumpster-2': (35, 22), 'dumpster-2-end': (35, 19),
    'alarm-car-1': (-60, 6), 'alarm-car-2': (-10, -15), 'alarm-car-3': (30, -5), 'alarm-car-4': (50, 30),
    'carwash-start': (-46, 41),
    # Systemic population: refuge doors (>= 12), off-screen edge entries (>= 6), horde entry
    'refuge-door-1': (-60, -5), 'refuge-door-2': (-35, -30), 'refuge-door-3': (-20, -8), 'refuge-door-4': (-8, -8),
    'refuge-door-5': (6, -8), 'refuge-door-6': (-20, 8), 'refuge-door-7': (-6, 8), 'refuge-door-8': (8, 8),
    'refuge-door-9': (30, 28), 'refuge-door-10': (45, 8), 'refuge-door-11': (-60, 28), 'refuge-door-12': (-30, 36),
    'edge-in-1': (-84, 0), 'edge-in-2': (-40, -54), 'edge-in-3': (10, -54), 'edge-in-4': (84, 0),
    'edge-in-5': (45, 54), 'edge-in-6': (-20, 54),
    'elm-horde-entry': (50, 52),
    # Photo spots (targets)
    'photo-l1-morning': (-70, 8), 'photo-l1-pickup': (-45, -32), 'photo-l1-facility': (58, -6),
    'photo-l1-accident': (64, -12), 'photo-l1-escape': (55, -2), 'photo-l1-spread': (30, 5),
    'photo-l1-garage': (20, 33), 'photo-l1-horde': (30, 42), 'photo-l1-safe': (-75, 41),
}
for name, (x, z) in ANCHORS.items(): l.anchor(name, [x, 0, z])

# Named polygons (x, z): no-bicycle zones, car-wash bay. Each also exports a centroid anchor.
l.zone('lab-nobike-zone', [(59, -22), (75, -22), (75, -8), (59, -8)])
l.zone('garage-nobike-zone', [(16, 32), (24, 32), (24, 40), (16, 40)])
l.zone('fire-nobike-zone', [(-80, 36), (-70, 36), (-70, 46), (-80, 46)])
l.zone('carwash-bay', [(-56, 42), (-44, 42), (-44, 48), (-56, 48)])
l.export()
