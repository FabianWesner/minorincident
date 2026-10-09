"""Regenerates specs/scenes/layout-sweep/*.json: the layout overlap sweep (docs/tools/scene-lab.md, "Layout sweep").
L2 on D-GROVE as a 4x3 grid of cells (5 m overlap so pairs across a seam are seen), L3 additions on each L3 district.
Run from the repo root: python3 tools/scenelab/gen-layout-sweep.py"""
import json, os

OUT = 'specs/scenes/layout-sweep'
os.makedirs(OUT, exist_ok=True)


def spec(name, level, district, bbox, tier, note, target):
    s = {"name": name, "note": note, "ground": "district", "time": level, "tier": tier,
         "layout": {"level": level, "district": district, "bbox": bbox},
         "clipping": {"ignoreFoliage": True},
         "camera": {"mode": "game", "target": target, "zoom": 1.5},
         "frames": 4, "shots": [4], "expect": {"consoleErrors": 0, "staticOverlapMax": 0}}
    with open('%s/%s.json' % (OUT, name), 'w') as f:
        json.dump(s, f, indent=1)
        f.write('\n')


xs = [-85, -42.5, 0, 42.5, 85]
zs = [-55, -18.5, 18.5, 55]
pad = 5
for r in range(3):
    for c in range(4):
        x0 = xs[c] - (pad if c else 0)
        x1 = xs[c + 1] + (pad if c < 3 else 0)
        z0 = zs[r] - (pad if r else 0)
        z1 = zs[r + 1] + (pad if r < 2 else 0)
        spec('l2-grid-r%dc%d' % (r, c), 'L2', 'D-GROVE', [[x0, z0], [x1, z1]], 1,
             'L2 layout sweep cell r%d c%d: shipped L2 dressing and placement rules, static mesh clipping gate.' % (r, c),
             [(xs[c] + xs[c + 1]) / 2, 0, (zs[r] + zs[r + 1]) / 2])
for d in ['D-MAIN', 'D-SHOP', 'D-CIVIC']:
    spec('l3-%s' % d.lower(), 'L3', d, [[-28, -28], [28, 28]], 2,
         'L3 additions (barricades, cones, police, fences) on %s, static mesh clipping gate.' % d, [0, 0, 0])
# D-CIVIC's evac camp is one dense authored compound (tents, crates, fence panels inside a 12 m square): the pieces dressed
# into it overlap the kit by design, so those pairs are listed instead of the whole scene being exempt.
camp = ['prop.picket-fence', 'prop.street-lamp', 'prop.bench', 'npc.paramedic', 'npc.police-officer', 'prop.tent', 'prop.medical-cooler', 'prop.trash-bags']
known = {
    'l3-d-civic': [['kit.evac-camp', a] for a in camp] + [['prop.tree', 'prop.street-lamp'], ['prop.tree', 'bld.police'], ['prop.tree', 'bld.fire-station'], ['prop.medical-cooler', 'decal.blood-trail']],
    # The bay bench is authored against the crew seat anchors and cuts into the station's front step (see levels/L2/layout.ts).
    'l2-grid-r2c0': [['prop.bench', 'bld.fire-station']],
}
for name, pairs in known.items():
    path = '%s/%s.json' % (OUT, name)
    s = json.load(open(path))
    s['clipping']['ignore'] = pairs
    with open(path, 'w') as f:
        json.dump(s, f, indent=1)
        f.write('\n')
