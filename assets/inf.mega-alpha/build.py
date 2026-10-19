"""Mega Alpha (L10 final boss): the Alpha's rig and clip contract at the regular Alpha's height and footprint.
Headless: python3 tools/blender/run.py assets/inf.mega-alpha/build.py --glb assets/inf.mega-alpha/model.glb
Derived from the shipped worker like inf.alpha (same node names, identity rest rotations, hidden stump caps).
LOD0 is a closed reshaped worker plus authored features (hunch mass, spine ridges, scars, big eyes, oversized right arm).
All three LODs are closed solids: every rigid part is voxel-remeshed per material (watertight union), then reduced; the
features are re-authored with fewer segments. No per-triangle decimation of open surfaces.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector

P = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--glb', required=True)
parser.add_argument('--variant', default='base')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
PALETTE = json.loads((P.parents[1] / 'src/assets/palette.json').read_text())
# PO #23: Mega looks share the rig, height and footprint; they differ in palette and head hardware. base = the shipped Mega.
VARIANTS = {'base': ('vest', 'leather', ''), 'ashen': ('poloDark', 'argyleGrey', 'horns'), 'ember': ('hairCopper', 'leatherEdge', 'tusks')}
MASS, SKIN, HARDWARE = VARIANTS[args.variant]
base = P.parent / 'inf.common-worker/build.py'
sys.argv = [str(base), '--']
ns = {'__file__': str(P / 'build.py'), '__name__': '__mega_alpha_base__'}
exec(compile(base.read_text(), str(base), 'exec'), ns)
(P / 'rig-rest.json').unlink(missing_ok=True)
parts, objects, M = ns['parts'], ns['objects'], ns['M']
bpy.context.view_layer.update()

# ---- shape --------------------------------------------------------------------------------------------------------
HEIGHT = 1.77          # Match the regular Alpha's packed height despite the deeper hunch.
BULK = 1.03            # PO 10-15: width and depth must remain within 1.3x the regular Alpha.
S = HEIGHT / 3.3       # authored absolute offsets below were sized for the old x3.3 body
shape = Matrix.Diagonal(Vector((HEIGHT * 1.14 * BULK, HEIGHT * 1.22 * BULK, HEIGHT, 1)))
LEAN = math.radians(14)  # hunch baked into the rest pose (rest rotations stay identity)
ARM_SCALE = 1.08          # oversized right arm (character right = -Y)
TORSO_TREE = {'torso', 'head', 'backpackSocket', 'armL', 'foreArmL', 'handL', 'armR', 'foreArmR', 'handR'}
ARM_TREE = {'armR', 'foreArmR', 'handR'}
parents = {n: (o.parent.name if o.parent else None) for n, o in parts.items()}
owners = {o.name: o.parent.name for o in objects}
base_pos = {n: o.matrix_world.translation.copy() for n, o in parts.items()}

def about(pivot, m):
    return Matrix.Translation(pivot) @ m @ Matrix.Translation(-pivot)

shaped_hip = shape @ base_pos['hip']
hunch = about(shaped_hip, Matrix.Rotation(LEAN, 4, 'Y'))
shoulder = hunch @ (shape @ base_pos['armR'])
armgrow = about(shoulder, Matrix.Scale(ARM_SCALE, 4))

HEAD_DROP = Vector((.30 * S, 0, -.15 * S))   # the head sits low and forward of the shoulder mass

def tf(owner):
    m = shape
    if owner in TORSO_TREE:
        m = hunch @ m
    if owner == 'head':
        m = Matrix.Translation(HEAD_DROP) @ m
    if owner in ARM_TREE:
        m = armgrow @ m
    # Keep the forward hunch inside the same 1.3x depth limit as the arm span.
    return Matrix.Diagonal(Vector((.84, 1, 1, 1))) @ m

positions = {n: tf(n) @ base_pos[n] for n in parts}
# The head is shrunk locally (a small head on the mass reads brutish).
HEAD_SHRINK = Matrix.Diagonal(Vector((.8, .8, .84, 1)))
head_pivot = base_pos['head']
bodies = {}   # owner -> list of mesh objects (world-space data, identity matrix)
caps = []
for obj in objects:
    owner = owners[obj.name]
    matrix = obj.matrix_world.copy()
    if obj.name.startswith('stump_'):
        obj.scale = (1, 1, 1)
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.copy()
    if owner == 'head':
        matrix = Matrix.Translation(head_pivot) @ HEAD_SHRINK @ Matrix.Translation(-head_pivot) @ matrix
    obj.data.transform(tf(owner) @ matrix)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    if obj.name.startswith('stump_'):
        caps.append(obj)
    else:
        bodies.setdefault(owner, []).append(obj)
for name, node in parts.items():
    node.parent = None
    node.matrix_world = Matrix.Translation(positions[name])
for name, node in parts.items():
    if parents[name]:
        node.parent = parts[parents[name]]
        node.matrix_parent_inverse = Matrix.Identity(4)
        node.location = positions[name] - positions[parents[name]]
bpy.context.view_layer.update()
for obj in caps:
    obj.parent = parts[owners[obj.name]]
    obj.matrix_parent_inverse = obj.parent.matrix_world.inverted()
    obj.matrix_basis = Matrix.Identity(4)

# PO revision: bruised dark skin/muscle, near-black rags, bone armour and bright blood.
PAL = {'mass': ns['mat'](MASS, PALETTE[MASS][1:], .6), 'skin': ns['mat'](SKIN, PALETTE[SKIN][1:], .74), 'cloth': M['uiDark'], 'blood': M['blood'], 'eye': M['eye'], 'bone': M['picketWhite']}
for owner, group in bodies.items():
    for obj in group:
        for i, material in enumerate(list(obj.data.materials)):
            if material.name == 'pal_infectedSkin':
                obj.data.materials[i] = PAL['skin']
            elif material.name not in ('pal_blood', 'emi_infectedEye'):
                obj.data.materials[i] = PAL['cloth']

def tris(obj):
    return sum(len(f.vertices) - 2 for f in obj.data.polygons)

def join(group, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:
        o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1:
        bpy.ops.object.join()
    o = group[0]
    o.name = name
    return o

def compact(obj):
    slots = list(obj.data.materials)
    unique = list(dict.fromkeys(slots))
    idx = [unique.index(slots[f.material_index]) for f in obj.data.polygons]
    obj.data.materials.clear()
    for m in unique:
        obj.data.materials.append(m)
    for f, i in zip(obj.data.polygons, idx):
        f.material_index = i

# Merge each owner's worker surfaces once (kept as the source for every tier).
for owner in list(bodies):
    bodies[owner] = join(bodies[owner], owner + '__body')
    compact(bodies[owner])

# ---- measurements used to place features ---------------------------------------------------------------------------
def bbox(obj):
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi

# Base eye faces (emissive) give the eye sockets; the originals are removed and replaced by larger authored eyes.
head = bodies['head']
eye_slots = [i for i, m in enumerate(head.data.materials) if m.name.startswith('emi_')]
eye_centres = {-1: [], 1: []}
bm = bmesh.new()
bm.from_mesh(head.data)
doomed = []
hair_slots = [i for i, m in enumerate(head.data.materials) if m == PAL['cloth']]
for f in bm.faces:
    if f.material_index in eye_slots:
        c = f.calc_center_median()
        eye_centres[1 if c.y > 0 else -1].append(c)
        doomed.append(f)
    elif f.material_index in hair_slots:
        doomed.append(f)   # the hair mass hides the face from the game camera: bald skull instead
bmesh.ops.delete(bm, geom=doomed, context='FACES')
bm.to_mesh(head.data)
bm.free()
eye_pos = {s: sum(v, Vector()) / len(v) for s, v in eye_centres.items() if v}
torso_lo, torso_hi = bbox(bodies['torso'])
head_lo, head_hi = bbox(head)
hand_lo, hand_hi = bbox(bodies['handR'])
print('HANDR', hand_lo, hand_hi, 'HEADBOX', head_lo, head_hi)
print('TORSO', torso_lo, torso_hi, 'HEAD', head_lo, head_hi, 'EYES', eye_pos)

# ---- authored features --------------------------------------------------------------------------------------------
def _obj(bm_, name, material):
    mesh = bpy.data.meshes.new(name)
    bm_.to_mesh(mesh)
    bm_.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    mesh.materials.append(material)
    for f in mesh.polygons:
        f.use_smooth = False
    return o

def ellipsoid(name, centre, radii, material, seg=10, rings=6, rot=None):
    bm_ = bmesh.new()
    bmesh.ops.create_uvsphere(bm_, u_segments=seg, v_segments=rings, radius=1.0)
    m = Matrix.Translation(centre) @ (rot.to_4x4() if rot else Matrix.Identity(4)) @ Matrix.Diagonal(Vector((*radii, 1)))
    bmesh.ops.transform(bm_, matrix=m, verts=bm_.verts)
    return _obj(bm_, name, material)

def spike(name, base_c, direction, radius, length, material, sides=5):
    bm_ = bmesh.new()
    bmesh.ops.create_cone(bm_, cap_ends=True, cap_tris=True, segments=sides, radius1=radius, radius2=radius * .06, depth=length)
    bmesh.ops.translate(bm_, vec=(0, 0, length / 2), verts=bm_.verts)
    q = Vector((0, 0, 1)).rotation_difference(Vector(direction).normalized())
    bmesh.ops.transform(bm_, matrix=Matrix.Translation(base_c) @ q.to_matrix().to_4x4(), verts=bm_.verts)
    return _obj(bm_, name, material)

def slash(name, centre, direction, length, width, thick, normal, material, sides=4):
    """A scar: an elongated closed solid half sunk into the surface, long axis along `direction`."""
    bm_ = bmesh.new()
    bmesh.ops.create_uvsphere(bm_, u_segments=sides * 2, v_segments=4, radius=1.0)
    long = Vector(direction).normalized()
    nrm = Vector(normal).normalized()
    side = nrm.cross(long).normalized()
    nrm = long.cross(side).normalized()
    basis = Matrix(((long.x, side.x, nrm.x), (long.y, side.y, nrm.y), (long.z, side.z, nrm.z)))
    m = Matrix.Translation(centre) @ basis.to_4x4() @ Matrix.Diagonal(Vector((length / 2, width / 2, thick, 1)))
    bmesh.ops.transform(bm_, matrix=m, verts=bm_.verts)
    return _obj(bm_, name, material)

def features(detail):
    """Returns {owner: [objects]} for one level of detail (2 = LOD0, 1 = LOD1, 0 = LOD2)."""
    seg, rings, sides = [(5, 3, 3), (8, 4, 4), (12, 7, 6)][detail]
    out = {}
    def put(owner, o):
        out.setdefault(owner, []).append(o)
    tw = torso_hi.y - torso_lo.y
    td = torso_hi.x - torso_lo.x
    th = torso_hi.z - torso_lo.z
    cx = (torso_hi.x + torso_lo.x) / 2
    # Hunch as muscle: a wide trapezius ramp from the back of the neck over both shoulders, with a heavy shoulder mass on
    # each side (the right one bigger, matching the oversized arm), so the silhouette reads as hulking shoulders.
    hump_c = Vector((torso_lo.x + .48 * td, 0, torso_hi.z - .30 * th))
    rx, ry, rz = .55 * td, .62 * tw, .34 * th
    put('torso', ellipsoid('hump', hump_c, (rx, ry, rz), PAL['mass'], seg + 2, rings + 1))
    for name, side, grow in (('shoulderL', 'armL', 1.0), ('shoulderR', 'armR', 1.08)):
        sp = positions[side] + Vector((-.10 * S, 0, .02 * S * grow))
        put('torso', ellipsoid(name, sp, (.58 * S * grow, .54 * S * grow, .50 * S * grow), PAL['mass'], seg + 2, rings + 1))
    # Exposed spine ridge: bone-white spikes riding the trapezius from the lower back up and over to the neck.
    count = 8
    for i in range(count):
        ang = math.radians(205 - i * (205 - 70) / (count - 1))
        c = hump_c + Vector((rx * math.cos(ang), 0, rz * math.sin(ang)))
        nrm = Vector((math.cos(ang) / rx, 0, math.sin(ang) / rz)).normalized()
        size = (.40 + .20 * math.sin(math.pi * i / (count - 1))) * td * .35
        put('torso', spike('ridge%d' % i, c - nrm * .10 * S, nrm, .10 * td * .75, size, PAL['bone'], sides))
    # Scars: diagonal slashes on the chest and a ragged band over the hump (blood palette, wounds read at distance).
    chest_x = torso_hi.x - .03 * td
    for i, (dy, dz, ang) in enumerate([(-.18, .66, .55), (-.05, .60, .55), (.10, .54, .55), (.24, .48, .55)]):
        d = Vector((0, math.cos(ang), -math.sin(ang)))
        put('torso', slash('chestScar%d' % i, Vector((chest_x - .02, dy * tw, torso_lo.z + dz * th)), d, .5 * th, .08 * th, .04 * td, (1, 0, 0), PAL['blood'], sides))
    # Back scars: short diagonal slashes pressed into the hump surface (centres follow the ellipsoid, sunk 4 cm).
    for i, (u, v, ang) in enumerate([(-.50, .10, .9), (-.15, .42, -.9), (.30, .05, .9), (.55, .40, -.8), (.0, -.35, .8)]):
        y, z = u * ry, v * rz
        x = -rx * math.sqrt(max(.04, 1 - (y / ry) ** 2 - (z / rz) ** 2))
        normal = Vector((x / rx ** 2, y / ry ** 2, z / rz ** 2)).normalized()
        d = Vector((0, math.sin(ang), math.cos(ang)))
        d = (d - normal * d.dot(normal)).normalized()
        put('torso', slash('backScar%d' % i, hump_c + Vector((x, y, z)) + normal * .0, d, .34 * th, .07 * th, .05 * td, normal, PAL['cloth'], sides))
    # Armour-like bone plates over both shoulders and glowing red veins crawling over the chest and the hump.
    for name, side, grow in (('plateL', 'armL', 1.0), ('plateR', 'armR', 1.08)):
        sp = positions[side] + Vector((-.06 * S, 0, .30 * S * grow))
        put('torso', ellipsoid(name, sp, (.50 * S * grow, .52 * S * grow, .17 * S * grow), PAL['bone'], seg + 2, rings))
    for i, (dy, dz, ang) in enumerate([(-.30, .78, .25), (.0, .72, -.25), (.30, .78, .3), (-.12, .40, .1), (.16, .36, -.15)]):
        d = Vector((0, math.cos(ang), -math.sin(ang)))
        put('torso', slash('chestVein%d' % i, Vector((chest_x - .01, dy * tw, torso_lo.z + dz * th)), d, .32 * th, .035 * th, .035 * td, (1, 0, 0), PAL['eye'], sides))
    for i, (u, v, ang) in enumerate([(-.30, .30, .6), (.20, .20, -.6), (.0, -.15, .0)]):
        y, z = u * ry, v * rz
        x = -rx * math.sqrt(max(.04, 1 - (y / ry) ** 2 - (z / rz) ** 2))
        normal = Vector((x / rx ** 2, y / ry ** 2, z / rz ** 2)).normalized()
        d = Vector((0, math.sin(ang), math.cos(ang)))
        d = (d - normal * d.dot(normal)).normalized()
        put('torso', slash('backVein%d' % i, hump_c + Vector((x, y, z)) + normal * .01, d, .30 * th, .035 * th, .04 * td, normal, PAL['eye'], sides))
    # Heavy brow over glowing eyes: the brow overhangs but the eyes peek out in front of it so they read from above.
    if eye_pos:
        ex = max(c.x for c in eye_pos.values())
        ez = sum(c.z for c in eye_pos.values()) / len(eye_pos)
        ew = max(abs(c.y) for c in eye_pos.values())
        put('head', ellipsoid('brow', Vector((ex - .10 * S, 0, ez + .20 * S)), (.20 * S, ew + .30 * S, .11 * S), PAL['cloth'], seg + 2, rings))
        put('head', ellipsoid('cheekbones', Vector((ex - .12 * S, 0, ez - .22 * S)), (.14 * S, ew + .22 * S, .08 * S), PAL['bone'], seg + 2, rings))
    for s_, c in eye_pos.items():
        put('head', ellipsoid('eye%d' % s_, c + Vector((.07 * S, 0, -.01 * S)), (.11 * S, .17 * S, .12 * S), PAL['eye'], seg, max(3, rings - 1)))
    # Head hardware of the sibling looks (PO #23). Horns sweep out and slightly up from the skull sides so the Mega keeps the
    # Alpha's height; tusks rise from the jaw beside the mouth.
    hc = (head_lo + head_hi) / 2
    hw, hd, hh = head_hi.y - head_lo.y, head_hi.x - head_lo.x, head_hi.z - head_lo.z
    for s_ in (-1, 1):
        if HARDWARE == 'horns':
            put('head', spike('horn%d' % s_, Vector((hc.x - .05 * hd, hc.y + s_ * .32 * hw, head_hi.z - .62 * hh)),
                              (-.45, s_ * 1.0, -.05), .10 * hw, .70 * hw, PAL['bone'], sides))
        elif HARDWARE == 'tusks':
            put('head', spike('tusk%d' % s_, Vector((head_hi.x - .12 * hd, hc.y + s_ * .20 * hw, head_lo.z + .16 * hh)),
                              (.35, s_ * .18, 1.0), .12 * hw, .85 * hh, PAL['bone'], sides))
            for k, (zf, yf) in enumerate(((.15, .62), (-.15, .40))):
                put('torso', spike('backGrowth%d_%d' % (s_, k), hump_c + Vector((-rx * .55, s_ * ry * yf, rz * zf)),
                                   (-.55, s_ * .7, .45), .14 * td * .75, .30 * td, PAL['mass'], sides))
            put('head', ellipsoid('crownRidge%d' % s_, Vector((hc.x - .20 * hd, hc.y + s_ * .22 * hw, head_hi.z - .12 * hh)),
                                  (.16 * hd, .09 * hw, .08 * hh), PAL['mass'], seg, rings))
    return out

def bodies_for_lod(level):
    """Returns {owner: object} worker surfaces for the tier (level 0 = authored high, others closed solids)."""
    result = {}
    for owner, src in bodies.items():
        o = src.copy()
        o.data = src.data.copy()
        bpy.context.scene.collection.objects.link(o)
        result[owner] = o
    return result

def closed_solid(obj, voxel, hull=False):
    """Per material: copy the faces, voxel-remesh (watertight union), reduce; then join. Result is closed."""
    pieces = []
    for slot, material in enumerate(list(obj.data.materials)):
        piece = obj.copy()
        piece.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(piece)
        bm_ = bmesh.new()
        bm_.from_mesh(piece.data)
        bmesh.ops.delete(bm_, geom=[f for f in bm_.faces if f.material_index != slot], context='FACES_ONLY')
        bmesh.ops.delete(bm_, geom=[v for v in bm_.verts if not v.link_faces], context='VERTS')
        bm_.to_mesh(piece.data)
        bm_.free()
        if not piece.data.polygons or (voxel > .2 * S and material.name == 'pal_blood'):
            # Scattered gore patches have no hull; the authored scars carry the wounds at the distant tier.
            bpy.data.objects.remove(piece)
            continue
        bpy.context.view_layer.objects.active = piece
        if hull:
            # Distant tier: the convex hull of the part is a closed solid by construction.
            bm_ = bmesh.new()
            bm_.from_mesh(piece.data)
            bmesh.ops.remove_doubles(bm_, verts=list(bm_.verts), dist=1e-4)
            res = bmesh.ops.convex_hull(bm_, input=list(bm_.verts), use_existing_faces=False)
            bmesh.ops.delete(bm_, geom=res['geom_interior'] + res['geom_unused'], context='VERTS')
            bmesh.ops.triangulate(bm_, faces=list(bm_.faces))
            bm_.to_mesh(piece.data)
            bm_.free()
        else:
            piece.data.remesh_voxel_size = voxel
            piece.data.remesh_voxel_adaptivity = 0
            bpy.ops.object.voxel_remesh()
        piece.data.materials.clear()
        piece.data.materials.append(material)
        for f in piece.data.polygons:
            f.material_index = 0
            f.use_smooth = False
        pieces.append(piece)
    bpy.data.objects.remove(obj)
    return pieces

def nonmanifold(obj):
    bm_ = bmesh.new()
    bm_.from_mesh(obj.data)
    n = sum(1 for e in bm_.edges if not e.is_manifold)
    bm_.free()
    return n

def make_fist():
    """The oversized right hand becomes a clenched fist (palm block, four knuckles, thumb) instead of splayed fingers."""
    body = bodies['handR']
    bm_ = bmesh.new()
    bm_.from_mesh(body.data)
    bmesh.ops.delete(bm_, geom=list(bm_.faces), context='FACES')
    bm_.to_mesh(body.data)
    bm_.free()
    c = (hand_lo + hand_hi) / 2
    dx, dy, dz = hand_hi.x - hand_lo.x, hand_hi.y - hand_lo.y, hand_hi.z - hand_lo.z
    top = hand_hi.z - .30 * dz
    parts_ = [ellipsoid('fistBlock', Vector((c.x, c.y, top - .05 * dz)), (.40 * dx, .38 * dy, .34 * dz), PAL['skin'], 12, 7)]
    for k in range(4):
        y = c.y + (k - 1.5) * .21 * dy
        parts_.append(ellipsoid('knuckle%d' % k, Vector((hand_hi.x - .22 * dx, y, top - .30 * dz)), (.20 * dx, .115 * dy, .13 * dz), PAL['skin'], 8, 5))
        parts_.append(ellipsoid('knuckleGore%d' % k, Vector((hand_hi.x - .08 * dx, y, top - .34 * dz)), (.09 * dx, .075 * dy, .07 * dz), PAL['blood'], 6, 4))
    parts_.append(ellipsoid('thumb', Vector((hand_hi.x - .30 * dx, hand_hi.y - .12 * dy, top - .10 * dz)), (.20 * dx, .10 * dy, .12 * dz), PAL['skin'], 8, 5))
    bodies['handR'] = join([body] + parts_, 'handR__body')
    compact(bodies['handR'])

make_fist()

cap_sources = {c: c.data.copy() for c in caps}

def set_cap_lod(level):
    """Caps keep real closed geometry in every tier (hidden stump contract); distant tiers use a coarser ellipsoid."""
    for c in caps:
        c.data = cap_sources[c].copy()
        if level == 0:
            continue
        lo_, hi_ = bbox(c)
        centre, size = (lo_ + hi_) / 2, hi_ - lo_
        bm_ = bmesh.new()
        bmesh.ops.create_uvsphere(bm_, u_segments=(8, 6)[level - 1], v_segments=(4, 3)[level - 1], radius=1.0)
        bmesh.ops.transform(bm_, matrix=Matrix.Translation(centre) @ Matrix.Diagonal(Vector((size.x / 2, size.y / 2, size.z / 2, 1))), verts=bm_.verts)
        bm_.to_mesh(c.data)
        bm_.free()
        mats = list(cap_sources[c].materials)
        c.data.materials.clear()
        for m in mats:
            c.data.materials.append(m)

TARGETS = (15600, 5700, 1900)
VOXEL = (.055 * S, .11 * S, .30 * S)
records = []
output = Path(args.glb).resolve()
for lod in range(3):
    set_cap_lod(lod)
    owners_meshes = bodies_for_lod(lod)
    feats = features((2, 1, 0)[lod])
    cap_tris = sum(tris(c) for c in caps)
    feat_tris = sum(tris(o) for g in feats.values() for o in g)
    solid = {owner: closed_solid(o, VOXEL[lod], hull=False) for owner, o in owners_meshes.items()}
    remesh_total = sum(tris(p_) for ps in solid.values() for p_ in ps)
    ratio = max(.01, min(1, (TARGETS[lod] - cap_tris - feat_tris) / remesh_total))
    print('BUDGET', lod, 'caps', cap_tris, 'feat', feat_tris, 'remeshed', remesh_total, 'ratio', ratio)
    owners_meshes = {}
    for owner, ps in solid.items():
        for p_ in ps:
            n = tris(p_)
            bpy.context.view_layer.objects.active = p_
            mod = p_.modifiers.new('closed reduce', 'DECIMATE')
            mod.ratio = max(ratio, min(1, 14 / n))
            mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
            # Weld slivers left by the reduction (sub-2 mm edges) so the exported surface stays an exact closed solid.
            bm_ = bmesh.new()
            bm_.from_mesh(p_.data)
            bmesh.ops.remove_doubles(bm_, verts=list(bm_.verts), dist=.003)
            bmesh.ops.dissolve_degenerate(bm_, dist=.001, edges=list(bm_.edges))
            # Closed solids only: drop any island that is not watertight after the weld (stray slivers).
            seen = set()
            for face in list(bm_.faces):
                if face in seen:
                    continue
                island, stack = [], [face]
                seen.add(face)
                while stack:
                    f = stack.pop()
                    island.append(f)
                    for e in f.edges:
                        for g in e.link_faces:
                            if g not in seen:
                                seen.add(g)
                                stack.append(g)
                if len(island) < 4 or any(not e.is_manifold for f in island for e in f.edges):
                    bmesh.ops.delete(bm_, geom=island, context='FACES')
            bmesh.ops.delete(bm_, geom=[v for v in bm_.verts if not v.link_faces], context='VERTS')
            bm_.to_mesh(p_.data)
            bm_.free()
        owners_meshes[owner] = join(ps, owner + '__solid')
    final = []
    for owner, o in owners_meshes.items():
        group = [o] + feats.get(owner, [])
        j = join(group, owner + '__mega')
        for f in j.data.polygons:
            f.use_smooth = False
        compact(j)
        j.parent = parts[owner]
        j.matrix_parent_inverse = j.parent.matrix_world.inverted()
        j.matrix_basis = Matrix.Identity(4)
        final.append(j)
    for cap in caps:
        cap['hidden'] = True
    bpy.context.view_layer.update()
    allm = final + caps
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in final:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    open_edges = {o.name: nonmanifold(o) for o in final}   # measured before export
    path = output if lod == 0 else output.with_name(output.stem + f'.lod{lod}.glb')
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in allm + list(parts.values()):
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_extras=True, export_cameras=False, export_lights=False)
    records.append({'lod': lod, 'triangles': sum(tris(o) for o in allm), 'fileKB': round(path.stat().st_size / 1024, 1),
                    'dimensions': [round(hi[i] - lo[i], 4) for i in range(3)],
                    'nonManifoldEdges': open_edges,
                    'materials': sorted({m.name for o in final for m in o.data.materials})})
    for o in final:
        bpy.data.objects.remove(o)
(output.parent / 'build-stats.json').write_text(json.dumps({
    'derivedFrom': 'assets/inf.common-worker/build.py (like inf.alpha)', 'heightScale': HEIGHT, 'bulk': BULK,
    'leanDegrees': 14, 'oversizedArm': {'node': 'armR', 'scale': ARM_SCALE},
    'lods': records, 'parts': list(parts)}, indent=2) + '\n')
print('OK', [r['triangles'] for r in records], 'caps', cap_tris)
