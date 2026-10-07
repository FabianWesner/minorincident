"""Skinned courier (pilot, ?skin=1): one welded deforming body + rigid head/hands/shoes/bag on bones.
Rebuild: python3 experiment/tools/blender_run.py <log-slug> assets/char.courier-female-skin/build.py -- --glb assets/char.courier-female-skin/model.skin.glb [--render out.png]
then copy to public/assets/models/char.courier-female.skin.glb (meshopt: npx tsx tools/skinpilot/compress.ts).
+X forward, Z up. Reuses build.py's accepted outfit/joints (read-only), then:
1. spreads arms/legs so the voxel remesh cannot fuse arm-torso or thigh-thigh,
2. voxel-remeshes the clothed body (hip/torso/arms/legs/neck) into ONE closed mesh, decimates it,
3. paints every face with the palette token of the nearest original shell (flat face-corner colors),
4. builds an armature whose bones carry the runtime joint names (root, hip, ..., weaponSocketR),
   bone-heat weights the body (deterministic), rigid parts get one bone each,
5. poses the limbs back and applies that pose as the rest pose, so the bind pose equals the rigid rest.
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

source = REPO / 'assets/char.courier-female/build.py'
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
    return [ref_mats[i] for i in out]

def write_colors(o, face_colors):
    layer = o.data.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
    for poly, c in zip(o.data.polygons, face_colors):
        for li in poly.loop_indices: layer.data[li].color = c
    o.data.color_attributes.active_color = layer
write_colors(vol, palette_faces(vol, ref))

# ---- 4. armature with runtime joint names --------------------------------------------------------
arm_data = bpy.data.armatures.new('courierSkeleton')
rig = bpy.data.objects.new('courierRig', arm_data); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
up = Vector((0, 0, 1)); fwd = Vector((1, 0, 0))
tails = {
    'root': joint['root'] + Vector((0, 0, .12)),
    'hip': joint['torso'] + Vector((0, 0, .02)), 'torso': joint['head'],
    'head': joint['head'] + Vector((0, 0, .32)),
    'legL': joint['shinL'], 'legR': joint['shinR'], 'shinL': joint['footL'], 'shinR': joint['footR'],
    'footL': joint['footL'] + Vector((.12, 0, -.13)), 'footR': joint['footR'] + Vector((.12, 0, -.13)),
    'armL': joint['foreArmL'], 'armR': joint['foreArmR'], 'foreArmL': joint['handL'], 'foreArmR': joint['handR'],
    'handL': joint['handL'] + (joint['handL'] - joint['foreArmL']).normalized() * .09,
    'handR': joint['handR'] + (joint['handR'] - joint['foreArmR']).normalized() * .09,
    'weaponSocketL': joint['weaponSocketL'] + fwd * .05, 'weaponSocketR': joint['weaponSocketR'] + fwd * .05,
    'backpackSocket': joint['backpackSocket'] + Vector((-.06, 0, 0)),
}
bones = {}
for name in N:
    b = arm_data.edit_bones.new(name); b.head = joint[name]; b.tail = tails[name]; b.roll = 0
    bones[name] = b
for name, o in N.items():
    if o.parent: bones[name].parent = bones[o.parent.name]
for name in ('root', 'weaponSocketL', 'weaponSocketR', 'backpackSocket'): bones[name].use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')

# bone heat on the welded body only (deterministic solver, closed manifold input)
bpy.ops.object.select_all(action='DESELECT'); vol.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
assert all(vol.vertex_groups.get(n) for n in ('hip', 'torso', 'armL', 'foreArmL', 'legL', 'shinL')), [g.name for g in vol.vertex_groups]
# hands/feet/head bones only blend a short band into the body: clamp their reach
def clamp_group(name, center_bone, radius):
    g = vol.vertex_groups.get(name)
    if not g: return
    c = joint[center_bone]
    for v in vol.data.vertices:
        d = ((vol.matrix_world @ v.co) - c).length
        if d > radius:
            try: g.remove([v.index])
            except RuntimeError: pass
for side in 'LR':
    clamp_group('hand' + side, 'hand' + side, .07)
    clamp_group('foot' + side, 'foot' + side, .08)
clamp_group('head', 'head', .11)
for v in vol.data.vertices:  # renormalise
    total = sum(g.weight for g in v.groups)
    if total > 0:
        for g in v.groups: g.weight /= total

# rigid parts: one object per owner bone, flat colors, single 100 % group
rigid_objs = []
for bone in RIGID.values():
    parts = [bake_world(o) for o in rigid_src if owner(o) == bone]
    if not parts: continue
    o = join(parts, 'rigid ' + bone)
    write_colors(o, [color_of(o.material_slots[p.material_index].material) for p in o.data.polygons])
    g = o.vertex_groups.new(name=bone); g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
    rigid_objs.append(o)
arm_data.bones['backpackSocket'].use_deform = True
skin = join([vol] + rigid_objs, 'courierSkin')
skin.data.materials.clear()
mat = bpy.data.materials.new('pal_vertexColor'); mat.use_nodes = True
nodes = mat.node_tree.nodes; bsdf = nodes['Principled BSDF']
attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = .65; mat.use_backface_culling = True
skin.data.materials.append(mat)
for o in rigid_objs: pass
skin.parent = rig
mod = next((m for m in skin.modifiers if m.type == 'ARMATURE'), None) or skin.modifiers.new('Armature', 'ARMATURE')
mod.object = rig
for p in skin.data.polygons: p.material_index = 0

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
    assert (rig.matrix_world @ b.head_local - rest[b.name]).length < 1e-4, (b.name, b.head_local, rest[b.name])

# runtime metadata, gltf extras
rig.name = 'courierRig'
skin['asset_id'] = 'char.courier-female'; skin['skinned'] = True
front = bpy.data.objects.new('front', None); scene.collection.objects.link(front); front.location = (.39, -.061, .728)
for o in list(collection.objects): bpy.data.objects.remove(o, do_unlink=True)
for o in list(scene.collection.objects):
    if o not in (rig, skin, front) and o.type in ('MESH', 'EMPTY'): bpy.data.objects.remove(o, do_unlink=True)

skin.data.calc_loop_triangles()
max_inf = max((len([g for g in v.groups if g.weight > 1e-4]) for v in skin.data.vertices), default=0)
stats = {'id': 'char.courier-female.skin', 'triangles': len(skin.data.loop_triangles), 'vertices': len(skin.data.vertices),
         'bones': len(arm_data.bones), 'deform_bones': sum(b.use_deform for b in arm_data.bones), 'max_influences_before_limit': max_inf,
         'voxel': VOXEL, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
print('SKIN OK', json.dumps(stats))
(HERE / 'report.json').write_text(json.dumps(stats, indent=2) + '\n')

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
