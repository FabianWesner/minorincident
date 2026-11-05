"""Skinned courier (default, ?skin=0 keeps the rigid figure): one welded deforming body + rigid head/hands/shoes/bag.
Rebuild: Blender -b --python assets/char.courier-female-skin/build.py -- --glb assets/char.courier-female-skin/model.skin.glb
then meshopt into public/assets/models/char.courier-female.skin.glb (npx tsx tools/skinpilot/compress.ts).
+X forward, Z up. Reuses build.py's accepted outfit/joints (read-only), then:
1. spreads arms/legs so the voxel remesh cannot fuse arm-torso or thigh-thigh,
2. voxel-remeshes the clothed body (hip/torso/arms/legs/neck) into ONE closed mesh, decimates it,
3. paints every face with the palette token of the nearest original shell (flat face-corner colors),
4. skeleton v2 (runtime joint names kept; Mesh2Motion chain spine/chest/neck/clavicles inserted, toe, elbow/knee/twist
   helpers, eye/iris and female ponytail bones). Bone heat on the old 16 joints only decides limb membership; weights
   are wide eased blends along each chain, the strap rides chest/clavicle, shoes bend at the ball. Cycles AO is baked
   per vertex and multiplied into the colours,
5. poses the limbs back and applies that pose as the rest pose, so the bind pose equals the rigid rest.
Options: --ao <strength> --ao-distance --ao-samples --ao-smooth --band --member-smooth --strap.
"""
from pathlib import Path
import sys, math, json, hashlib
import bpy, bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key) + 1] if key in ARGS else default

SEX = arg('--variant', 'female')
assert SEX in ('female', 'male')
source = REPO / f'assets/char.courier-{SEX}/build.py'
marker = '# Store exact rest-world extents'
text = source.read_text(); assert text.count(marker) == 1
saved = sys.argv; sys.argv = [sys.argv[0], '--']
base = {'__file__': str(source), '__name__': 'courier_skin_source'}
exec(compile(text.split(marker)[0], str(source), 'exec'), base)
sys.argv = saved
N, collection, M = base['N'], base['collection'], base['M']
scene = bpy.context.scene
VOXEL = float(arg('--voxel', .0055))
BODY_TRIS = int(arg('--body-tris', 14000))
SPREAD_ARM, SPREAD_LEG = math.radians(24), math.radians(7)

# ---- 1. spread pose (rigid empties) -------------------------------------------------------------
N['armL'].rotation_euler.x = SPREAD_ARM; N['armR'].rotation_euler.x = -SPREAD_ARM
N['legL'].rotation_euler.x = SPREAD_LEG; N['legR'].rotation_euler.x = -SPREAD_LEG
bpy.context.view_layer.update()
joint = {n: o.matrix_world.translation.copy() for n, o in N.items()}

RIGID = {'head': 'head', 'handL': 'handL', 'handR': 'handR', 'footL': 'footL', 'footR': 'footR', 'backpackSocket': 'backpackSocket'}
def owner(o):
    p = o.parent.name if o.parent else None
    if o.name == 'neck': return None  # neck joins the welded body (torso<->head blend)
    return RIGID.get(p)

def bake_world(o):
    """Detach a shell into world space with its transform applied (keeps material slots)."""
    me = o.data.copy(); me.transform(o.matrix_world)
    w = bpy.data.objects.new(o.name + '.w', me); scene.collection.objects.link(w)
    return w

def color_of(mat):
    c = mat.diffuse_color; return (c[0], c[1], c[2], 1.0)

body_src, rigid_src = [], []
for o in list(collection.objects):
    if o.type != 'MESH': continue
    (rigid_src if owner(o) else body_src).append(o)

# ---- 2. welded body: union of clothed shells -> voxel remesh -> decimate ------------------------
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; return o

ref = join([bake_world(o) for o in body_src], 'body reference')     # original look, for colors
vol = bpy.data.objects.new('body', ref.data.copy()); scene.collection.objects.link(vol)
vol.data.remesh_voxel_size = VOXEL; vol.data.remesh_voxel_adaptivity = 0
bpy.context.view_layer.objects.active = vol
with bpy.context.temp_override(object=vol, active_object=vol):
    bpy.ops.object.voxel_remesh()
# keep the largest connected piece only (stray decal islands)
bm = bmesh.new(); bm.from_mesh(vol.data)
islands, seen = [], set()
for f in bm.faces:
    if f.index in seen: continue
    stack, isl = [f], []
    seen.add(f.index)
    while stack:
        g = stack.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen: seen.add(h.index); stack.append(h)
    islands.append(isl)
islands.sort(key=len, reverse=True)
drop = [f for isl in islands[1:] for f in isl]
if drop: bmesh.ops.delete(bm, geom=drop, context='FACES')
bm.to_mesh(vol.data); bm.free()
smooth = vol.modifiers.new('relax', 'CORRECTIVE_SMOOTH'); smooth.iterations = 8; smooth.smooth_type = 'SIMPLE'; smooth.use_only_smooth = False
with bpy.context.temp_override(object=vol, active_object=vol): bpy.ops.object.modifier_apply(modifier=smooth.name)
vol.data.calc_loop_triangles(); tris = len(vol.data.loop_triangles)
dec = vol.modifiers.new('budget', 'DECIMATE'); dec.ratio = min(1, BODY_TRIS / tris); dec.use_collapse_triangulate = True
with bpy.context.temp_override(object=vol, active_object=vol): bpy.ops.object.modifier_apply(modifier=dec.name)
for p in vol.data.polygons: p.use_smooth = True

# ---- 3. flat palette colors from the nearest original shell ------------------------------------
def palette_faces(target, ref_obj):
    bm = bmesh.new(); bm.from_mesh(ref_obj.data); bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    ref_mats = [color_of(s.material) if s.material else (1, 0, 1, 1) for s in ref_obj.material_slots]
    face_mat = [f.material_index for f in bm.faces]
    labels = []
    for poly in target.data.polygons:
        hit = tree.find_nearest(poly.center)
        labels.append(face_mat[hit[2]] if hit[0] is not None else 0)
    # majority passes over edge neighbours remove speckles and stair-steps on colour seams
    tb = bmesh.new(); tb.from_mesh(target.data); tb.faces.ensure_lookup_table()
    neighbours = [[g.index for e in f.edges for g in e.link_faces if g.index != f.index] for f in tb.faces]
    out = list(labels)
    for _ in range(4):
        cur = list(out)
        for i, ns in enumerate(neighbours):
            counts = {}
            for j in ns: counts[cur[j]] = counts.get(cur[j], 0) + 1
            if not counts: continue
            best = max(sorted(counts), key=lambda k: counts[k])
            if best != cur[i] and counts[best] >= 2 and counts.get(cur[i], 0) <= 1: out[i] = best
    tb.free(); bm.free()
    face_material[:] = [ref_obj.material_slots[i].material.name if ref_obj.material_slots[i].material else '' for i in out]
    return [ref_mats[i] for i in out]
face_material = []  # palette material name per welded face (the strap is re-weighted by it)

def write_colors(o, face_colors):
    layer = o.data.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
    for poly, c in zip(o.data.polygons, face_colors):
        for li in poly.loop_indices: layer.data[li].color = c
    o.data.color_attributes.active_color = layer
write_colors(vol, palette_faces(vol, ref))

# ---- 4. skeleton v2 and weights --------------------------------------------------------------------
# The runtime joint names stay (root, hip, torso, head, arm*, foreArm*, hand*, leg*, shin*, foot*, sockets).
# v2 inserts the Mesh2Motion chain between them: torso = spine_01, spine = spine_02, chest = spine_03,
# neck = neck_01, clavicle* = clavicle_*, toe* = ball_*. Leaf helpers (elbow*, knee*, foreArmTwist*) are
# driven at runtime (half joint angle / half hand roll). Face and hair bones: pony1..3 (female), eye*/iris*.
up = Vector((0, 0, 1)); fwd = Vector((1, 0, 0))
J = dict(joint)  # spread-pose joint positions (the welded body is remeshed in this pose)
lerp = lambda a, b, t: a + (b - a) * t
J['spine'] = lerp(J['torso'], J['head'], .30); J['chest'] = lerp(J['torso'], J['head'], .60); J['neck'] = lerp(J['torso'], J['head'], .88)
for s, sign in (('L', 1), ('R', -1)):
    J['clavicle' + s] = Vector((J['chest'].x, .045 * sign, J['arm' + s].z - .012))
    J['elbow' + s] = J['foreArm' + s].copy(); J['knee' + s] = J['shin' + s].copy()
    J['foreArmTwist' + s] = lerp(J['foreArm' + s], J['hand' + s], .55)
heel_toe = {}
for s in 'LR':  # ball of the shoe from the rigid shoe extents
    pts = [o.matrix_world @ v.co for o in rigid_src if owner(o) == 'foot' + s for v in o.data.vertices]
    x0, x1 = min(p.x for p in pts), max(p.x for p in pts); z0 = min(p.z for p in pts)
    heel_toe[s] = (x0, x1)
    J['toe' + s] = Vector((x0 + .66 * (x1 - x0), J['foot' + s].y, z0 + .03))
FACE = {}  # rigid head shells owned by face/hair bones
def shell_side(o):
    c = sum((o.matrix_world @ v.co for v in o.data.vertices), Vector()) / max(1, len(o.data.vertices)); return 'L' if c.y > 0 else 'R'
for o in rigid_src:
    if owner(o) != 'head': continue
    n = o.name.lower()
    if n.startswith(('iris', 'pupil', 'eye glint', 'eye_iris', 'eye_pupil', 'eye_glint', 'eye_tiny_glint')): FACE[o.name] = 'iris' + shell_side(o)
    elif n.startswith(('eye sclera', 'upper lashes', 'outer lash', 'eye_white', 'upper_eyelid')): FACE[o.name] = 'eye' + shell_side(o)
    elif n.startswith('ponytail lock'): FACE[o.name] = 'pony'
for s in 'LR':
    whites = [o.matrix_world @ v.co for o in rigid_src if FACE.get(o.name) == 'eye' + s and o.name.lower().startswith(('eye sclera', 'eye_white')) for v in o.data.vertices]
    irises = [o.matrix_world @ v.co for o in rigid_src if FACE.get(o.name) == 'iris' + s for v in o.data.vertices]
    assert whites and irises, ('eye shells', s)
    J['eye' + s] = sum(whites, Vector()) / len(whites)
    J['iris' + s] = sum(irises, Vector()) / len(irises)
PONY = [o for o in rigid_src if FACE.get(o.name) == 'pony']
if PONY:
    roots = [o for o in rigid_src if owner(o) == 'head' and o.name.lower().startswith(('scrunchie', 'ponytail root'))]
    root_pts = [o.matrix_world @ v.co for o in roots for v in o.data.vertices]
    pony_root = sum(root_pts, Vector()) / len(root_pts)
    lock_pts = [o.matrix_world @ v.co for o in PONY for v in o.data.vertices]
    far = sorted(lock_pts, key=lambda p: (p - pony_root).length)[-max(8, len(lock_pts) // 25):]
    pony_tip = sum(far, Vector()) / len(far)
    for i in range(3): J['pony%d' % (i + 1)] = lerp(pony_root, pony_tip, i / 3)
    J['ponyTip'] = pony_tip

# (bone, parent, tail) in the spread pose. Named runtime joints keep their parents except where v2 inserts the chain.
def toward(a, b, length):
    return J[a] + (J[b] - J[a]).normalized() * length
SPEC = [('root', None, J['root'] + Vector((0, 0, .12))), ('hip', 'root', J['torso'] + Vector((0, 0, .02))),
        ('torso', 'hip', J['spine']), ('spine', 'torso', J['chest']), ('chest', 'spine', J['neck']), ('neck', 'chest', J['head']),
        ('head', 'neck', J['head'] + Vector((0, 0, .32))), ('backpackSocket', 'chest', J['backpackSocket'] + Vector((-.06, 0, 0)))]
for s in 'LR':
    SPEC += [('clavicle' + s, 'chest', J['arm' + s]), ('arm' + s, 'clavicle' + s, J['foreArm' + s]),
             ('elbow' + s, 'arm' + s, toward('foreArm' + s, 'hand' + s, .04)), ('foreArm' + s, 'arm' + s, J['hand' + s]),
             ('foreArmTwist' + s, 'foreArm' + s, toward('foreArm' + s, 'hand' + s, (J['hand' + s] - J['foreArm' + s]).length * .8)),
             ('hand' + s, 'foreArm' + s, J['hand' + s] + (J['hand' + s] - J['foreArm' + s]).normalized() * .09),
             ('weaponSocket' + s, 'hand' + s, J['weaponSocket' + s] + fwd * .05),
             ('leg' + s, 'hip', J['shin' + s]), ('knee' + s, 'leg' + s, toward('shin' + s, 'foot' + s, .04)), ('shin' + s, 'leg' + s, J['foot' + s]),
             ('foot' + s, 'shin' + s, J['toe' + s]), ('toe' + s, 'foot' + s, Vector((heel_toe[s][1], J['toe' + s].y, J['toe' + s].z))),
             ('eye' + s, 'head', J['eye' + s] + fwd * .02), ('iris' + s, 'eye' + s, J['iris' + s] + fwd * .02)]
if PONY:
    SPEC += [('pony1', 'head', J['pony2']), ('pony2', 'pony1', J['pony3']), ('pony3', 'pony2', J['ponyTip'])]
NONDEFORM = {'root', 'weaponSocketL', 'weaponSocketR'}

arm_data = bpy.data.armatures.new('courierSkeleton')
rig = bpy.data.objects.new('courierRig', arm_data); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig

# 4a. bone heat on the original 16 deforming joints solves limb membership on the closed body.
bpy.ops.object.mode_set(mode='EDIT')
heat_tails = {
    'root': joint['root'] + Vector((0, 0, .12)), 'hip': joint['torso'] + Vector((0, 0, .02)), 'torso': joint['head'],
    'head': joint['head'] + Vector((0, 0, .32)),
    'legL': joint['shinL'], 'legR': joint['shinR'], 'shinL': joint['footL'], 'shinR': joint['footR'],
    'footL': joint['footL'] + Vector((.12, 0, -.13)), 'footR': joint['footR'] + Vector((.12, 0, -.13)),
    'armL': joint['foreArmL'], 'armR': joint['foreArmR'], 'foreArmL': joint['handL'], 'foreArmR': joint['handR'],
    'handL': joint['handL'] + (joint['handL'] - joint['foreArmL']).normalized() * .09,
    'handR': joint['handR'] + (joint['handR'] - joint['foreArmR']).normalized() * .09,
    'weaponSocketL': joint['weaponSocketL'] + fwd * .05, 'weaponSocketR': joint['weaponSocketR'] + fwd * .05,
    'backpackSocket': joint['backpackSocket'] + Vector((-.06, 0, 0)),
}
heat = {}
for name in N:
    b = arm_data.edit_bones.new(name); b.head = joint[name]; b.tail = heat_tails[name]; b.roll = 0; heat[name] = b
for name, o in N.items():
    if o.parent: heat[name].parent = heat[o.parent.name]
for name in ('root', 'weaponSocketL', 'weaponSocketR', 'backpackSocket'): heat[name].use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); vol.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
assert all(vol.vertex_groups.get(n) for n in ('hip', 'torso', 'armL', 'foreArmL', 'legL', 'shinL')), [g.name for g in vol.vertex_groups]
gname = {g.index: g.name for g in vol.vertex_groups}
H = [{gname[g.group]: g.weight for g in v.groups if g.weight > 0} for v in vol.data.vertices]
for h in H:
    t = sum(h.values())
    if t > 0:
        for k in h: h[k] /= t
vol.vertex_groups.clear()
for m in [m for m in vol.modifiers if m.type == 'ARMATURE']: vol.modifiers.remove(m)
world_matrix = vol.matrix_world.copy(); vol.parent = None; vol.matrix_world = world_matrix
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for b in list(arm_data.edit_bones): arm_data.edit_bones.remove(b)
bones = {}
for name, parent, tail in SPEC:
    b = arm_data.edit_bones.new(name); b.head = J[name]; b.tail = tail; b.roll = 0; bones[name] = b
    if parent: b.parent = bones[parent]
    b.use_deform = name not in NONDEFORM
bpy.ops.object.mode_set(mode='OBJECT')

# 4b. welded body weights: smoothed limb membership from bone heat, then wide eased blends along each chain.
P = [vol.matrix_world @ v.co for v in vol.data.vertices]
nbr = [[] for _ in P]
for e in vol.data.edges:
    a, b = e.vertices; nbr[a].append(b); nbr[b].append(a)
def smooth_field(f, iterations, rate=.5):
    for _ in range(iterations):
        f = [(1 - rate) * f[i] + rate * (sum(f[j] for j in nbr[i]) / len(nbr[i]) if nbr[i] else f[i]) for i in range(len(f))]
    return f
LIMBS = {'armL': ('armL', 'foreArmL', 'handL'), 'armR': ('armR', 'foreArmR', 'handR'), 'legL': ('legL', 'shinL', 'footL'), 'legR': ('legR', 'shinR', 'footR')}
member = {k: [sum(h.get(n, 0) for n in names) for h in H] for k, names in LIMBS.items()}
strap = [0.] * len(P)
for poly, mat in zip(vol.data.polygons, face_material):
    if mat == 'pal_tealDark':
        for i in poly.vertices: strap[i] = 1.
strapField = smooth_field(strap, 3)
STRAP = float(arg('--strap', .8))  # share of the arm's pull removed from the strap: it rides the chest and clavicle
for k in ('armL', 'armR'): member[k] = [m * (1 - STRAP * min(1, 1.3 * sf)) for m, sf in zip(member[k], strapField)]
for k in member: member[k] = smooth_field(member[k], int(arg('--member-smooth', 2)))

def hats(t, centers):
    """Eased piecewise-linear partition of unity over sorted `centers` [(position, bone)]."""
    if t <= centers[0][0]: return {centers[0][1]: 1.}
    for (a, ba), (b, bb) in zip(centers, centers[1:]):
        if t <= b:
            u = (t - a) / (b - a); u = u * u * (3 - 2 * u); return {ba: 1 - u, bb: u}
    return {centers[-1][1]: 1.}
def chain_param(p, pts):
    """Arc length of the closest point on polyline `pts` (extrapolated beyond both ends)."""
    best, bestd, acc = 0, 1e9, 0
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        d = b - a; L = d.length; u = (p - a).dot(d) / (L * L)
        if i > 0: u = max(0, u)
        if i < len(pts) - 2: u = min(1, u)
        q = a + d * max(0, min(1, u)); dist = (p - q).length
        if dist < bestd: bestd, best = dist, acc + u * L
        acc += L
    return best
BAND = float(arg('--band', .06))
def limb_centers(s, arm):
    up_, mid, end = (('arm', 'foreArm', 'hand') if arm else ('leg', 'shin', 'foot'))
    A, B, C = J[up_ + s], J[mid + s], J[end + s]; l1, l2 = (B - A).length, (C - B).length
    if arm: c = [(min(.35 * l1, l1 - BAND), 'arm' + s), (l1, 'elbow' + s), (l1 + min(BAND, .42 * l2), 'foreArm' + s), (l1 + .8 * l2, 'foreArmTwist' + s), (l1 + l2 + .012, 'hand' + s)]
    else: c = [(min(.35 * l1, l1 - BAND), 'leg' + s), (l1, 'knee' + s), (l1 + min(BAND, .45 * l2), 'shin' + s), (l1 + l2 + .01, 'foot' + s)]
    return [A, B, C], c
LIMB_GEOM = {k: limb_centers(k[-1], k.startswith('arm')) for k in LIMBS}
SPINE = [(J['hip'].z, 'hip'), (J['torso'].z + .02, 'torso'), (J['spine'].z, 'spine'), (J['chest'].z, 'chest'), (J['neck'].z, 'neck'), (J['head'].z + .025, 'head')]
def seg_distance(p, a, b):
    d = b - a; u = max(0, min(1, (p - a).dot(d) / d.length_squared)); return (p - (a + d * u)).length
neck_pts = [p for p in P if J['neck'].z + .01 < p.z < J['head'].z]
NECK_RADIUS = sorted(math.hypot(p.x - J['neck'].x, p.y - J['neck'].y) for p in neck_pts)[len(neck_pts) // 10] if neck_pts else .05
print('NECK_RADIUS', NECK_RADIUS)
W = []
for i, p in enumerate(P):
    w = {}
    rest = 1.
    for k, (pts, centers) in LIMB_GEOM.items():
        m = member[k][i]
        if m < 1e-4: continue
        rest -= m
        for b, x in hats(chain_param(p, pts), centers).items(): w[b] = w.get(b, 0) + m * x
    rest = max(0., rest)
    if rest > 1e-4:
        part = hats(p.z, SPINE)
        # Only the neck column itself follows neck/head; shoulder tops at the same height stay on the chest.
        radial = math.hypot(p.x - J['neck'].x, p.y - J['neck'].y)
        lateral = max(0, min(1, (radial - NECK_RADIUS) / .035)); lateral = lateral * lateral * (3 - 2 * lateral)
        for b in ('neck', 'head'):
            if b in part and lateral > 0: part['chest'] = part.get('chest', 0) + part[b] * lateral; part[b] *= 1 - lateral
        # Shoulder tops follow the clavicle (shrug/reach) between the chest and the arm membership.
        for s in 'LR':
            d = seg_distance(p, J['clavicle' + s], J['arm' + s])
            c = (1 - max(0, min(1, (d - .025) / .05))) * max(0, min(1, (p.z - J['chest'].z) / .05)) * lateral
            if c > 0:
                take = .75 * c
                part = {b: x * (1 - take) for b, x in part.items()}; part['clavicle' + s] = part.get('clavicle' + s, 0) + take
        for b, x in part.items(): w[b] = w.get(b, 0) + rest * x
    W.append(w)

def limit(w, n=4):
    top = sorted(w.items(), key=lambda kv: -kv[1])[:n]; t = sum(x for _, x in top) or 1
    return {b: x / t for b, x in top if x / t > 1e-3}
for name, _, _ in SPEC:
    if name not in NONDEFORM: vol.vertex_groups.new(name=name)
for i, w in enumerate(W):
    for b, x in limit(w).items(): vol.vertex_groups[b].add([i], x, 'REPLACE')

# rigid parts: one object per owner bone, flat colors; shoes bend at the ball, face/hair shells get their bones.
# Groups are assigned per shell before joining (join keeps vertex groups, not vertex order).
def rigid_groups(w, bone, face):
    groups = {}
    def add(b, idx, x):
        if b not in groups: groups[b] = w.vertex_groups.new(name=b)
        groups[b].add([idx], x, 'REPLACE')
    for v in w.data.vertices:
        p = w.matrix_world @ v.co
        if bone.startswith('foot'):
            s = bone[-1]; u = max(0, min(1, (p.x - J['toe' + s].x + .012) / .024)); u = u * u * (3 - 2 * u)
            if u < 1: add(bone, v.index, 1 - u)
            if u > 0: add('toe' + s, v.index, u)
        elif face == 'pony':
            axis = J['ponyTip'] - J['pony1']; t = (p - J['pony1']).dot(axis) / axis.length_squared
            for bn, x in hats(t, [(.0, 'head'), (.17, 'pony1'), (.5, 'pony2'), (.84, 'pony3')]).items():
                if x > 1e-3: add(bn, v.index, x)
        else: add(face or bone, v.index, 1.)
rigid_objs = []
for bone in RIGID.values():
    sources = [o for o in rigid_src if owner(o) == bone]
    if not sources: continue
    parts = []
    for src in sources:
        w = bake_world(src); rigid_groups(w, bone, FACE.get(src.name)); parts.append(w)
    o = join(parts, 'rigid ' + bone)
    write_colors(o, [color_of(o.material_slots[p.material_index].material) for p in o.data.polygons])
    rigid_objs.append(o)
skin = join([vol] + rigid_objs, 'courierSkin')
skin.data.materials.clear()
mat = bpy.data.materials.new('pal_vertexColor'); mat.use_nodes = True
nodes = mat.node_tree.nodes; bsdf = nodes['Principled BSDF']
attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = .65; mat.use_backface_culling = True
skin.data.materials.append(mat)
skin.parent = rig
mod = skin.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
for p in skin.data.polygons: p.material_index = 0

# 4c. ambient occlusion (deterministic CPU Cycles, as the rigid courier bakes it), multiplied into the palette colour.
AO_STRENGTH = float(arg('--ao', .45))
if AO_STRENGTH > 0:
    sys.path.insert(0, str(REPO / 'tools/blender'))
    from sslib import ao
    if scene.world is None: scene.world = bpy.data.worlds.new('ao')
    scene.world.light_settings.distance = float(arg('--ao-distance', .12))
    ao.bake_all([skin], samples=int(arg('--ao-samples', 128)))
    occ, col = skin.data.color_attributes['ao'], skin.data.color_attributes['Color']
    # Average per vertex: per-corner AO would split every vertex in the export (palette seams still split as before).
    total, count = [0.] * len(skin.data.vertices), [0] * len(skin.data.vertices)
    for loop in skin.data.loops: total[loop.vertex_index] += occ.data[loop.index].color[0]; count[loop.vertex_index] += 1
    occlusion = [t / max(1, c) for t, c in zip(total, count)]
    # Sample noise and voxel-surface ripples read as dirt at the game camera: relax AO along the surface.
    links = [[] for _ in occlusion]
    for e in skin.data.edges:
        a, b = e.vertices; links[a].append(b); links[b].append(a)
    for _ in range(int(arg('--ao-smooth', 6))):
        occlusion = [.5 * o + .5 * (sum(occlusion[j] for j in l) / len(l) if l else o) for o, l in zip(occlusion, links)]
    for loop in skin.data.loops:
        a = occlusion[loop.vertex_index]; k = round((1 - AO_STRENGTH * (1 - a)) * 20) / 20  # 5 % steps
        c = col.data[loop.index].color; col.data[loop.index].color = (c[0] * k, c[1] * k, c[2] * k, 1)
    skin.data.color_attributes.remove(occ)
    skin.data.color_attributes.active_color = skin.data.color_attributes['Color']

# ---- 5. pose limbs back to the rigid rest and make it the bind pose ----------------------------
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
for name, angle in (('armL', -SPREAD_ARM), ('armR', SPREAD_ARM), ('legL', -SPREAD_LEG), ('legR', SPREAD_LEG)):
    pb = rig.pose.bones[name]; h = joint[name]
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = skin
with bpy.context.temp_override(object=skin, active_object=skin):
    bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
mod = skin.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
# restore the rigid empties for the pivot check
for n in ('armL', 'armR', 'legL', 'legR'): N[n].rotation_euler.x = 0
bpy.context.view_layer.update()
rest = {n: o.matrix_world.translation for n, o in N.items()}
for b in arm_data.bones:
    if b.name in rest: assert (rig.matrix_world @ b.head_local - rest[b.name]).length < 1e-4, (b.name, b.head_local, rest[b.name])

# runtime metadata, gltf extras
rig.name = 'courierRig'
skin['asset_id'] = f'char.courier-{SEX}'; skin['skinned'] = True; skin['skeleton'] = 2
front = bpy.data.objects.new('front', None); scene.collection.objects.link(front); front.location = (.39, -.061, .728)
for o in list(collection.objects): bpy.data.objects.remove(o, do_unlink=True)
for o in list(scene.collection.objects):
    if o not in (rig, skin, front) and o.type in ('MESH', 'EMPTY'): bpy.data.objects.remove(o, do_unlink=True)

skin.data.calc_loop_triangles()
max_inf = max((len([g for g in v.groups if g.weight > 1e-4]) for v in skin.data.vertices), default=0)
stats = {'id': f'char.courier-{SEX}.skin', 'skeleton': 2, 'triangles': len(skin.data.loop_triangles), 'vertices': len(skin.data.vertices),
         'bones': len(arm_data.bones), 'deform_bones': sum(b.use_deform for b in arm_data.bones), 'max_influences_before_limit': max_inf,
         'voxel': VOXEL, 'ao_strength': AO_STRENGTH, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
print('SKIN OK', json.dumps(stats))
report_dir = Path(arg('--glb')).resolve().parent if arg('--glb') else HERE
report_dir.mkdir(parents=True, exist_ok=True)
(report_dir / 'report.json').write_text(json.dumps(stats, indent=2) + '\n')

if arg('--glb'):
    out = Path(arg('--glb')).resolve(); out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in (rig, skin, front): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_yup=True, export_extras=True,
                              export_cameras=False, export_lights=False, export_texcoords=False, export_animations=False,
                              export_skins=True, export_influence_nb=4, export_def_bones=False, export_vertex_color='ACTIVE')
    print('GLB OK', out)

if arg('--render'):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    pose = arg('--pose', 'rest')
    if pose == 'bend':
        P = rig.pose.bones
        P['armL'].rotation_mode = P['foreArmL'].rotation_mode = P['legR'].rotation_mode = P['shinR'].rotation_mode = P['torso'].rotation_mode = 'XYZ'
        P['armL'].rotation_euler.x = math.radians(-70); P['foreArmL'].rotation_euler.x = math.radians(-80)
        P['legR'].rotation_euler.x = math.radians(-55); P['shinR'].rotation_euler.x = math.radians(80)
        P['torso'].rotation_euler.x = math.radians(15)
    bpy.ops.object.mode_set(mode='OBJECT')
    world = bpy.data.worlds.new('studio'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.11, .13, .17, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    target = Vector((0, 0, .72))
    for name, pos, power in [('Key', (3, -4, 5), 430), ('Fill', (1, 4, 3), 260), ('Rim', (-3, -1, 4), 420)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.size = 4
        o = bpy.data.objects.new(name, data); scene.collection.objects.link(o); o.location = pos
        o.rotation_euler = (target - o.location).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.type = 'ORTHO'
    scene.render.resolution_x = int(arg('--width', 1200)); scene.render.resolution_y = int(arg('--height', 600))
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    rp = Path(arg('--render')).resolve(); rp.parent.mkdir(parents=True, exist_ok=True)
    for view, d in [('front', (6, 0, .08)), ('side', (0, -6, .08)), ('ref', (5, -4, 2.5)), ('back', (-6, 0, .08))]:
        cam.location = target + Vector(d); cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = 1.72 * scene.render.resolution_x / scene.render.resolution_y
        scene.render.filepath = str(rp.parent / (rp.stem + '-' + view + '.png'))
        bpy.ops.render.render(write_still=True); print('RENDER OK', scene.render.filepath)
