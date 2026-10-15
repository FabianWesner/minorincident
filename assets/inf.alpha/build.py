"""Alpha: reshape the shipped worker, preserving its rigid joints and surfaces.
Headless: python3 tools/blender/run.py assets/inf.alpha/build.py --glb assets/inf.alpha/model.glb
The three authored tiers include hidden stump caps; no new human primitives.
"""
import argparse
import json
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector

P = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--glb', required=True)
parser.add_argument('--quality', default='high')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
base = P.parent / 'inf.common-worker/build.py'
# Redirect the worker's build metadata into this variant, leaving its source intact.
sys.argv = [str(base), '--']
ns = {'__file__': str(P / 'build.py'), '__name__': '__alpha_base__'}
source = base.read_text().replace("'c9a39a'", "'796084'").replace("'5b4f5c'", "'25222c'")
# Alter named worker surfaces before its material/owner join. Broad exposed upper
# arms and a torn vest read at game distance; omit office details that become shards.
sculpt = """
remove = ('tie_', 'shirt_collar', 'shirt_button', 'shirt_wrinkle', 'welt_pocket',
          'jacket_lapel', 'jacket_button', 'sleeve_wrinkle', 'sleeve_tear_edge',
          'sleeve_torn_flap', 'hair_blood', 'blood_splash2', 'heavy_fringe', 'messy_crown', 'low_nape', 'hair_layer')
for o in list(objects):
    if o.name.startswith(remove):
        objects.remove(o)
        bpy.data.objects.remove(o, do_unlink=True)
        continue
    if o.name.startswith(('upper_sleeve', 'shoulder_mass')):
        o.data.materials.clear()
        o.data.materials.append(M['infectedSkin'])
        for face in o.data.polygons: face.material_index = 0
    # Expand the existing curved shoulder/upper-arm surfaces, keeping their pivots.
    if o.name.startswith(('upper_sleeve', 'shoulder_mass')):
        pivot = o.matrix_world.inverted() @ parts[o.parent.name].matrix_world.translation
        o.data.transform(Matrix.Translation(pivot) @ Matrix.Diagonal(Vector((1.22, 1.13, 1, 1))) @ Matrix.Translation(-pivot))
    if o.name == 'shirt_body':
        o.data.materials.clear()
        o.data.materials.append(M['asphalt'])
        for face in o.data.polygons: face.material_index = 0
        o.scale.x *= 1.10
        o.scale.y *= 1.10
    if o.name.startswith('eye_glow'):
        o.scale *= 1.3
    if o.name.startswith('hair_base'):
        o.scale.z *= .85
bpy.ops.object.select_all(action='DESELECT')
# Raised closed wounds and emissive veins keep the chest readable at distant zoom.
for side in (-1, 1):
    tube('alpha_wound'+str(side),[(.225,side*.13,1.08),(.24,side*.08,.99),(.23,side*.12,.89)], [.025,.03,.012], 'blood','torso',N=6,sub=0)
    tube('alpha_vein'+str(side),[(.234,side*.15,1.09),(.25,side*.10,1.02),(.244,side*.14,.97)], [.009,.012,.006], 'eye','torso',N=6,sub=0)
# A forward neck and broad shoulders preserve the human outline.
parts['head'].location.x += .035
"""
marker = '# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.'
assert marker in source
source = source.replace(marker, sculpt + '\n' + marker)
for before, after in [("parts['torso'].rotation_euler.y=.24", "parts['torso'].rotation_euler.y=.30"),
                      ("parts['hand'+side].scale=(1.38,1.45,1.40)", "parts['hand'+side].scale=(1.55,1.58,1.48)")]:
    assert before in source
    source = source.replace(before, after)
exec(compile(source, str(base), 'exec'), ns)
# The base's rest metadata describes the worker, not this derived rig.
(P / 'rig-rest.json').unlink(missing_ok=True)
parts, objects = ns['parts'], ns['objects']
# Runtime resolves palette names, so RGB changes alone do not change the game.
ns['M']['infectedSkin'].name = 'pal_purple'
ns['M']['asphalt'] = ns['M']['uiDark']
bpy.context.view_layer.update()
# Compensate for the lower crown and deeper hunch: packed height remains about 2.58 m.
shape = Matrix.Diagonal(Vector((1.47 * 1.14, 1.47 * 1.22, 1.58, 1)))
positions = {name: shape @ node.matrix_world.translation for name, node in parts.items()}
parents = {name: node.parent.name if node.parent else None for name, node in parts.items()}
owners = {obj.name: obj.parent.name for obj in objects}
for obj in objects:
    matrix = obj.matrix_world.copy()
    # Zero-scale caps have actual geometry in their parent coordinate system.
    if obj.name.startswith('stump_'):
        obj.scale = (1, 1, 1)
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.copy()
    if owners[obj.name] == 'head':
        pivot = parts['head'].matrix_world.translation.copy()
        matrix = Matrix.Translation(pivot) @ Matrix.Diagonal(Vector((.82, .82, .90, 1))) @ Matrix.Translation(-pivot) @ matrix
    obj.data.transform(shape @ matrix)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
for name, node in parts.items():
    node.parent = None
    node.matrix_world = Matrix.Translation(positions[name])
for name, node in parts.items():
    if parents[name]:
        node.parent = parts[parents[name]]
        node.matrix_parent_inverse = Matrix.Identity(4)
        node.location = positions[name] - positions[parents[name]]
bpy.context.view_layer.update()
for obj in objects:
    obj.parent = parts[owners[obj.name]]
    obj.matrix_parent_inverse = obj.parent.matrix_world.inverted()
    obj.matrix_basis = Matrix.Identity(4)
    materials = list(obj.data.materials)
    for i, material in enumerate(materials):
        if material.name not in ('pal_purple', 'pal_blood', 'emi_infectedEye'):
            obj.data.materials[i] = ns['M']['asphalt']
# Merge decorations by rigid owner; palette regions remain distinct face materials.
caps = [obj for obj in objects if obj.name.startswith('stump_')]
groups = {}
for obj in objects:
    if obj not in caps:
        groups.setdefault(obj.parent.name, []).append(obj)
objects = caps.copy()
for owner, group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1:
        bpy.ops.object.join()
    obj = group[0]
    obj.name = owner + '__alpha'
    objects.append(obj)
for obj in objects:
    # Compact repeated slots introduced by joining.
    slots = list(obj.data.materials)
    unique = list(dict.fromkeys(slots))
    indices = [unique.index(slots[face.material_index]) for face in obj.data.polygons]
    obj.data.materials.clear()
    for material in unique:
        obj.data.materials.append(material)
    for face, index in zip(obj.data.polygons, indices):
        face.material_index = index
sources = {obj.name: obj.data.copy() for obj in objects}
def triangles(obj):
    return sum(len(face.vertices) - 2 for face in obj.data.polygons)
def reduce(obj, ratio):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('alpha surface reduction', 'DECIMATE')
    mod.ratio = ratio
    # Export explicit triangles; the packed-asset tests verify retained eye vertices.
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
def solid_lod(obj, voxel):
    """Union each palette surface before reduction; thin cloth cannot become shards."""
    pieces = []
    for slot, material in enumerate(list(obj.data.materials)):
        piece = obj.copy()
        piece.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(piece)
        bm = bmesh.new()
        bm.from_mesh(piece.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != slot], context='FACES_ONLY')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(piece.data)
        bm.free()
        if not piece.data.polygons:
            bpy.data.objects.remove(piece, do_unlink=True)
            continue
        bpy.context.view_layer.objects.active = piece
        if material.name != 'emi_infectedEye':
            piece.data.remesh_voxel_size = voxel
            piece.data.remesh_voxel_adaptivity = 0
            bpy.ops.object.voxel_remesh()
        if not piece.data.polygons:
            bpy.data.objects.remove(piece, do_unlink=True)
            continue
        piece.data.materials.clear()
        piece.data.materials.append(material)
        for face in piece.data.polygons:
            face.material_index = 0
            face.use_smooth = True
        pieces.append(piece)
    assert pieces, obj.name
    bpy.ops.object.select_all(action='DESELECT')
    for piece in pieces: piece.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    if len(pieces) > 1: bpy.ops.object.join()
    obj.data = pieces[0].data.copy()
    bpy.data.objects.remove(pieces[0], do_unlink=True)

def close_reduced_surfaces(obj):
    """Decimation can flatten tiny islands or leave a triangular puncture."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.001)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=.0001)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    seen = set()
    for seed in list(bm.faces):
        if seed in seen: continue
        island, stack = [], [seed]
        seen.add(seed)
        while stack:
            face = stack.pop()
            island.append(face)
            for edge in face.edges:
                for other in edge.link_faces:
                    if other not in seen:
                        seen.add(other)
                        stack.append(other)
        volume = abs(sum(f.calc_center_median().dot(f.normal) * f.calc_area() / 3 for f in island))
        if len(island) < 4 or volume < 1e-9 or any(not e.is_manifold for f in island for e in f.edges):
            bmesh.ops.delete(bm, geom=island, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    assert all(e.is_manifold for e in bm.edges), obj.name
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    obj.data.validate(verbose=True)
    obj.data.calc_loop_triangles()
    # Mesh conversion can discard a duplicate face left by hole filling. Repair
    # the converted mesh, then validate that exact export input, not just BMesh.
    check = bmesh.new()
    check.from_mesh(obj.data)
    if any(e.is_boundary for e in check.edges):
        bmesh.ops.holes_fill(check, edges=[e for e in check.edges if e.is_boundary], sides=0)
        bmesh.ops.triangulate(check, faces=list(check.faces))
        bmesh.ops.recalc_face_normals(check, faces=list(check.faces))
        check.to_mesh(obj.data)
        obj.data.update()
    check.free()
    check = bmesh.new()
    check.from_mesh(obj.data)
    assert all(e.is_manifold for e in check.edges), obj.name
    check.free()

records = []
output = Path(args.glb).resolve()
allobjects = objects
for lod, limit in enumerate((7800, 2900, 950)):
    for obj in allobjects:
        obj.data = sources[obj.name].copy()
        obj.hide_set(False)
    objects = allobjects
    if lod > 0:
        for obj in objects:
            if obj not in caps:
                solid_lod(obj, .045 if lod == 1 else .085)
    total = sum(triangles(obj) for obj in objects)
    for obj in objects:
        reduce(obj, min(1, limit / total))
        if lod > 0: close_reduced_surfaces(obj)
    # Per-owner rounding can exceed the target. Retain all owners, never remove limbs.
    while sum(triangles(obj) for obj in objects) > limit:
        for obj in objects:
            if triangles(obj) > 12:
                reduce(obj, .92)
                if lod > 0: close_reduced_surfaces(obj)
    for cap in caps:
        cap.scale = (1, 1, 1)
        cap['hidden'] = True
    bpy.context.view_layer.update()
    bounds = [obj.matrix_world @ vertex.co for obj in objects if obj not in caps for vertex in obj.data.vertices]
    path = output if lod == 0 else output.with_name(output.stem + f'.lod{lod}.glb')
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects + list(parts.values()):
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_extras=True, export_cameras=False, export_lights=False)
    records.append({'lod': lod, 'triangles': sum(triangles(obj) for obj in objects),
                    'fileKB': path.stat().st_size / 1024, 'dimensions': [max(v[i] for v in bounds) - min(v[i] for v in bounds) for i in range(3)]})
(P / 'build-stats.json').write_text(json.dumps({'derivedFrom': str(base.relative_to(P.parents[1])),
    'heightRatio': records[0]['dimensions'][2] * 1.08101627 / 1.8,
    'bodyHeightScale': 1.58, 'headScale': [.82, .82, .90], 'shapeScale': [1.6758, 1.7934, 1.58], 'lods': records,
    'parts': list(parts), 'materials': ['pal_purple', 'pal_uiDark', 'pal_blood', 'emi_infectedEye']}, indent=2) + '\n')
