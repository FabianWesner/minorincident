"""L9 collapsed road/bridge crash site. Deterministic, metres, +X road direction, Z up, ground z=0.

Local origin is the centre of the 16 m gap. The terrain gully (banks and floor, x -8..+8, floor z=-5.5)
belongs to layouts/D-CROSSING/layout.py; this kit dresses it: broken asphalt lips, fallen deck slabs,
pier stubs, rebar, torn guard rails, burn scars and rubble (the existing decay.rubble-pile GLB is reused).
Rebuild: python3 tools/blender/run.py tools/blender/... (see notes.md).
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Euler, Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'kit.crossing-crash', 'category': 'prop'}
p = argparse.ArgumentParser()
for name in ('render', 'glb'): p.add_argument('--' + name)
p.add_argument('--lod', type=int, default=0); p.add_argument('--view', default='ref'); p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng = random.Random(931)
L = a.lod              # 0 hero, 1 mid, 2 far: authored tiers drop rebar, teeth, chips and bevels, never the silhouette
HALF = 8.0            # half gap length along x
FLOOR = -5.5          # gully floor height (layout owns the terrain)
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
root['asset_id'] = ASSET['id']; root['category'] = 'prop'; root['forward'] = '+X'
materials = {}
def mat(token):
    if token not in materials:
        materials[token] = palette.mat(token)
        materials[token].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .86
    return materials[token]
def finish(o, name, token, bevel=0):
    o.name = name; o.parent = root; o.data.materials.append(mat(token))
    bpy.context.view_layer.objects.active = o
    if bevel and L == 0:
        m = o.modifiers.new('chipped edge', 'BEVEL'); m.width = bevel; m.segments = 1
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o
def box(name, pos, size, token, bevel=.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); o = bpy.context.object; o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler = rot; o.location = pos
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    return finish(o, name, token, bevel)
def mesh(name, verts, faces, token):
    d = bpy.data.meshes.new(name); d.from_pydata(verts, [], faces); d.update()
    o = bpy.data.objects.new(name, d); bpy.context.collection.objects.link(o); return finish(o, name, token)
def rod(name, start, end, width, token, sides=4, keep=False):
    """Identical thin prisms at every tier keep the sparse silhouette stable; rails go 6 -> 4 sides at the far tier."""
    if keep == 'rail': sides = 6 if L < 2 else 4
    delta = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=width / 2, depth=delta.length, location=(Vector(start) + Vector(end)) / 2)
    o = bpy.context.object; o.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, name, token)
def column(name, pos, radius, height, token, sides=8):
    sides = (8, 6, 5)[L]
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=height, location=(pos[0], pos[1], pos[2] + height / 2))
    return finish(bpy.context.object, name, token, .02)
def chunk(pos, size, token):
    """Faceted broken-concrete block: deformed cube, seeded."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for v in o.data.vertices: v.co += Vector((rng.uniform(-.2, .2) * size[0], rng.uniform(-.2, .2) * size[1], rng.uniform(-.15, .15) * size[2]))
    o.rotation_euler = (rng.uniform(-.5, .5), rng.uniform(-.5, .5), rng.random() * 6.28); o.location = pos
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(o, 'broken block', token)

def slab(name, center, length, width, thick, euler, painted=True, rebar_ends=(1, -1)):
    """Fallen deck slab: concrete body, asphalt top, broken yellow lines, ragged ends and rebar."""
    rng.seed(sum(map(ord, name)) * 7919)
    R = Euler(euler).to_matrix()
    def at(dx, dy, dz): return Vector(center) + R @ Vector((dx, dy, dz))
    box(name + ' concrete', at(0, 0, -thick * .12), (length, width, thick * .76), 'sidewalk', .04, euler)
    box(name + ' asphalt', at(0, 0, thick * .38), (length, width, thick * .24), 'asphalt', .03, euler)
    if painted:
        for s in (-1, 1):
            box(name + ' paint', at(s * length * .22, 0, thick * .5 + .012), (length * .3, .26, .02), 'schoolBusYellow', 0, euler)
        for sy in (-1, 1) if L < 2 else ():
            box(name + ' edge line', at(0, sy * (width / 2 - .5), thick * .5 + .012), (length * .8, .14, .02), 'picketWhite', 0, euler)
    for end in rebar_ends:       # ragged broken end: loose teeth plus bent rebar
        for k in range(3):
            dy = -width / 2 + (k + .5) * width / 3
            tooth = rng.uniform(.25, .8)
            box(name + ' tooth', at(end * (length / 2 + tooth / 2 - .1), dy, rng.uniform(-.08, .1)), (tooth, width / 3 * rng.uniform(.5, .95), thick * rng.uniform(.5, .85)), 'sidewalk', .03, euler)
        for k in range(4):
            dy = -width / 2 + (k + .4) * width / 4 + rng.uniform(-.2, .2)
            s = at(end * (length / 2 + .3), dy, 0); e = s + R @ Vector((end * rng.uniform(.5, 1.3), rng.uniform(-.25, .25), rng.uniform(-.6, .3)))
            rod('rebar', s, e, .07, 'leatherShadow')

# ---- Near and far broken lips (asphalt overhang with jagged teeth) -------------------------------
def lip(side):
    x_edge = side * HALF
    rng.seed(300 + side)
    teeth = (9, 9, 7)[L]; y_span = 12.2
    for t in range(teeth):
        y0 = -y_span / 2 + t * y_span / teeth; y1 = y0 + y_span / teeth
        reach = rng.uniform(.25, 1.35); mid = (y0 + y1) / 2 + rng.uniform(-.15, .15)
        xi, xo = x_edge, x_edge + side * reach
        v = [(xi, y0, 0.012), (xi, y1, 0.012), (xo, mid, 0.012), (xi, y0, -.56), (xi, y1, -.56), (xo, mid, -.40)]
        f = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (0, 3, 5, 2), (1, 2, 5, 4)]
        if side < 0: f = [t_[::-1] for t_ in f]
        mesh('lip tooth', v, f, 'asphalt')
    rng.seed(310 + side)
    for k in range(4):
        y = -5 + k * 3.3 + rng.uniform(-.3, .3)
        box('lip concrete', (x_edge - side * .15, y, -.5), (1.4, 2.6, .5), 'sidewalk', .05, (0, rng.uniform(-.1, .1), rng.uniform(-.1, .1)))
    rng.seed(320 + side)
    for k in range(0):   # lip rebar dropped: pier and slab-end rebar carry the read, the silhouette stays compact
        y = -5.6 + k * 2.5 + rng.uniform(-.2, .2)
        s = Vector((x_edge + side * .35, y, -.18)); e = s + Vector((side * rng.uniform(.5, 1.6), rng.uniform(-.2, .2), -rng.uniform(.1, .7)))
        rod('rebar', s, e, .07, 'leatherShadow')
lip(-1); lip(1)

# ---- Fallen deck slabs --------------------------------------------------------------------------
slab('deck A', (-4.6, 0, -2.75), 6.6, 11.4, .55, (0, math.radians(42), 0))                      # ramp from the near lip into the gully
slab('deck B', (6.6, -3.9, FLOOR + 1.9), 5.0, 5.4, .5, (math.radians(-4), math.radians(-34), math.radians(14)))
slab('deck C', (6.6, 3.9, FLOOR + 2.0), 4.0, 4.0, .45, (math.radians(10), math.radians(-52), math.radians(-18)), painted=False, rebar_ends=(1,))

# ---- Broken pier stubs --------------------------------------------------------------------------
rng.seed(400)
for x, y, h in ((-1.4, -4.2, 2.6), (-.9, 4.4, 1.7), (3.5, 4.6, 1.0)):
    # Rectangular stubs and bent, uneven rebar (parallel round columns with five upright rods read as raised hands at night).
    box('pier stub', (x, y, FLOOR + h / 2), (1.5, 1.3, h), 'sidewalk', .03, (0, 0, rng.uniform(-.3, .3)))
    box('pier cap rubble', (x, y, FLOOR + h + .1), (1.7, 1.5, .24), 'sidewalk', .05, (rng.uniform(-.2, .2), rng.uniform(-.2, .2), rng.random()))
    for k in range(4):
        s = Vector((x + rng.uniform(-.6, .6), y + rng.uniform(-.5, .5), FLOOR + h + .2))
        e = s + Vector((rng.uniform(-.8, .8), rng.uniform(-.8, .8), rng.uniform(.3, .8)))
        rod('rebar', s, e, .08, 'silver')

# ---- Torn guard rails ---------------------------------------------------------------------------
rng.seed(500)
for side in (-1, 1):
    for ys in (-1, 1):
        y = ys * 6.55
        xs = [side * (HALF + 1.2 + i * 2.2) for i in range(rng.randint(4, 5))]
        for i, x in enumerate(xs):
            box('rail post', (x, y, .5), (.2, .2, 1.0), 'sidewalk', .02, (0, (i == 0) * rng.uniform(.1, .3) * side, 0))
        rod('rail beam', (xs[-1], y, .9), (xs[1], y, .9), .12, 'silver', 6, 'rail')
        rod('rail beam bent', (xs[1], y, .9), (xs[0] - side * .5, y + ys * .3, .55), .12, 'silver', 6, 'rail')
        rod('rail beam hanging', (xs[0] - side * .5, y + ys * .3, .55), (xs[0] - side * 2.4, y + ys * .9, -1.9), .12, 'silver', 6, 'rail')

# ---- Burn scars and cracks on the approach ------------------------------------------------------
for side in (-1, 1):
    cx = side * (HALF + 3.5)
    rng.seed(600 + side)
    for k in range(0):   # scorch polygons read as holes at night; the explosion is S6's VFX (explosionSocket)
        rng.seed(610 + side * 10 + k)
        r = rng.uniform(.45, 1.1); cy = rng.uniform(-3.6, 3.6); n = 9
        verts = [(cx + rng.uniform(-1, 1), cy, .016)] + [(cx + math.cos(i / n * 6.28) * r * rng.uniform(.7, 1.2), cy + math.sin(i / n * 6.28) * r * rng.uniform(.7, 1.2) * 1.2, .016) for i in range(n)]
        mesh('burn scar', verts, [(0, i + 1, (i + 1) % n + 1) for i in range(n)], 'uiDark')
    for k in range(5):
        rng.seed(620 + side * 10 + k)
        y = rng.uniform(-5, 5); x0 = side * (HALF + .1); length = rng.uniform(2.5, 6)
        pts = [(x0 + side * length * t, y + rng.uniform(-.25, .25) * t + .6 * t * t * rng.choice([-1, 1]), .02) for t in (0, .35, .7, 1)]
        verts = []
        for i, pt in enumerate(pts):
            w = .07 * (1 - i / 4); verts += [(pt[0], pt[1] - w, pt[2]), (pt[0], pt[1] + w, pt[2])]
        mesh('crack', verts, [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(3)], 'uiDark')

# ---- Rubble: faceted blocks + reused decay.rubble-pile -------------------------------------------
def scatter(count, xr, yr, z, sizes, tokens):
    base = int(abs(xr[0]) * 100 + abs(yr[0]) * 10 + abs(z) * 1000)
    for i in range(count):
        rng.seed(base + i)
        x, y = rng.uniform(*xr), rng.uniform(*yr); s = rng.uniform(*sizes)
        if z == FLOOR and -.2 < x < 3.9 and abs(y) < 3.4: continue   # keep the crash-wreck spot clear
        chunk((x, y, z + s * .3), (s * rng.uniform(.8, 1.5), s * rng.uniform(.7, 1.3), s * rng.uniform(.5, 1)), rng.choice(tokens))
scatter(24, (-HALF + .8, HALF - .8), (-6, 6), FLOOR, (.5, 1.1), ['sidewalk', 'asphalt', 'sidewalk'])
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/decay.rubble-pile' / ('model.glb' if L == 0 else f'model.lod{L}.glb')))
imported = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
bpy.context.view_layer.update()
for x, y, z, yaw, sc in ((-2.6, 3.6, FLOOR, .5, 1.7), (4.6, -5.4, FLOOR, 3.7, 1.2)):
    for src in imported:
        ob = bpy.data.objects.new('rubble pile', src.data.copy()); bpy.context.collection.objects.link(ob)
        ob.data.materials.clear()
        for m in src.data.materials: ob.data.materials.append(mat(m.name.removeprefix('pal_').split('.')[0]))
        mw = src.matrix_world.copy(); ob.parent = root
        R = Euler((0, 0, yaw)).to_matrix().to_4x4()
        ob.matrix_world = R @ mw
        ob.scale = ob.scale * sc
        ob.location = (x, y, z)
for src in imported: bpy.data.objects.remove(src, do_unlink=True)

# ---- Sockets for the S6 crash sequence (explosion / smoke / falling debris origins) --------------
for name, pos in (('debrisOrigin', (-HALF + 1, 0, 2.2)), ('smokeSocket', (0, 0, FLOOR + 1)), ('explosionSocket', (1.5, 0, FLOOR + 1.5)), ('front', (0, 0, 0))):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e); e.parent = root; e.location = pos

# ---- Merge by material ---------------------------------------------------------------------------
for token, m in materials.items():
    obs = [o for o in root.children if o.type == 'MESH' and o.data.materials and o.data.materials[0] == m]
    if not obs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join(); obs[0].name = 'static_' + m.name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
meshes = [o for o in root.children if o.type == 'MESH']
ao.bake_all(meshes, samples=32)
triangles = sum(len(p_.vertices) - 2 for o in meshes for p_ in o.data.polygons)
report = {'id': ASSET['id'], 'tier': 'Side', 'triangles': triangles, 'draw_calls': len(meshes), 'materials': sorted(m.name for m in materials.values()), 'nodes_ok': True, 'within_budget': triangles <= 16000, 'rounds': 1, 'webgpu_ok': False, 'webgl2_ok': False, 'gaps': []}
if a.glb:
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for o in root.children: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb, export_format='GLB', use_selection=True, export_apply=True, export_extras=True)
if L == 0: Path(__file__).with_name('report.json').write_text(json.dumps(report, indent=2) + '\n')
if a.render:
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = a.samples; scene.cycles.use_denoising = True
    scene.world.color = (.20, .20, .20)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, FLOOR - .02)); f = bpy.context.object; f.scale = (16, 40, 1); f.data.materials.append(palette.mat('khakiSeam'))
    target = Vector((0, 0, -1.5))
    for loc, power, color, size in [((-3, -4, 12), 2400, (1, .79, .56), 5), ((6, 5, 9), 1500, (.65, .74, 1), 5)]:
        bpy.ops.object.light_add(type='AREA', location=loc); o = bpy.context.object; o.data.energy = power; o.data.color = color; o.data.shape = 'DISK'; o.data.size = size; o.rotation_euler = (target - o.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(); cam = bpy.context.object; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 30
    az, elev = math.radians(-40), math.radians(38)
    cam.location = target + Vector((math.cos(az) * math.cos(elev), -math.sin(az) * math.cos(elev), math.sin(elev))) * 30
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler(); scene.camera = cam
    scene.render.resolution_x = a.width; scene.render.resolution_y = a.height
    scene.view_settings.view_transform = 'AgX'; scene.render.filepath = a.render; bpy.ops.render.render(write_still=True)
print('OK', json.dumps(report))
