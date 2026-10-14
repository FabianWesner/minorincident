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
# Thin hair locks (spikes that decimate into slivers) are kept as their own joined mesh per
# owner, so the far tier can drop them and keep only the smooth hair_base cap.
HAIR = ('hair_layer', 'heavy_fringe', 'messy_crown', 'low_nape')
source = base.read_text()
key = "buckets.setdefault((o.parent.name,tuple("
assert key in source
source = source.replace(key, "buckets.setdefault((o.parent.name+('~hair' if o.name.startswith(%r) else ''),tuple(" % (HAIR,))
exec(compile(source, str(base), 'exec'), ns)
# The base's rest metadata describes the worker, not this derived rig.
(P / 'rig-rest.json').unlink(missing_ok=True)
parts, objects = ns['parts'], ns['objects']
bpy.context.view_layer.update()
# 1.47x height (hair locks are gone, so the crown is lower) with additional chest/limb breadth, still the worker's human shape.
shape = Matrix.Diagonal(Vector((1.47 * 1.14, 1.47 * 1.22, 1.47, 1)))
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
        if material.name not in ('pal_infectedSkin', 'pal_blood', 'emi_infectedEye'):
            obj.data.materials[i] = ns['M']['asphalt']
# Merge decorations by rigid owner; palette regions remain distinct face materials.
caps = [obj for obj in objects if obj.name.startswith('stump_')]
groups = {}
for obj in objects:
    if obj not in caps:
        groups.setdefault(obj.parent.name + ('__hair' if '~hair' in obj.name else ''), []).append(obj)
objects = caps.copy()
for owner, group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1:
        bpy.ops.object.join()
    obj = group[0]
    obj.name = owner.replace('__hair', '') + ('__hairalpha' if owner.endswith('__hair') else '__alpha')
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
def prune(obj, smallest):
    # Drop loose islands (cuffs, folds, laces, fingertips) whose longest side is below `smallest`
    # metres: at 30 m they only decimate into slivers that break the silhouette.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen, doomed = set(), []
    for seed in bm.verts:
        if seed.index in seen:
            continue
        island, stack = [], [seed]
        seen.add(seed.index)
        while stack:
            v = stack.pop()
            island.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
        size = max(max(v.co[i] for v in island) - min(v.co[i] for v in island) for i in range(3))
        if size < smallest:
            doomed.extend(island)
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
def reduce(obj, ratio):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('alpha surface reduction', 'DECIMATE')
    mod.ratio = ratio
    # Preserve palette boundaries, particularly the glowing eyes.
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
records = []
output = Path(args.glb).resolve()
allobjects = objects
ISLAND_MIN = 0.12
for lod, limit in enumerate((7800, 2900, 950)):
    for obj in allobjects:
        obj.data = sources[obj.name].copy()
        obj.hide_set(False)
    # Every tier omits the hair locks (at 1.45x they read as shards); the head keeps its smooth hair_base cap.
    objects = [obj for obj in allobjects if not obj.name.endswith('__hairalpha')]
    for obj in allobjects:
        if obj not in objects:
            obj.hide_set(True)
    if lod == 2:
        for obj in objects:
            if obj not in caps:
                prune(obj, ISLAND_MIN)
    total = sum(triangles(obj) for obj in objects)
    for obj in objects:
        reduce(obj, min(1, limit / total))
    # Per-owner rounding can exceed the target. Retain all owners, never remove limbs.
    while sum(triangles(obj) for obj in objects) > limit:
        for obj in objects:
            if triangles(obj) > 12:
                reduce(obj, .92)
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
    'heightRatio': records[0]['dimensions'][2] / (max(v.z for v in ns['bounds']) - min(v.z for v in ns['bounds'])),
    'bodyHeightScale': 1.47, 'headScale': [.82, .82, .90], 'shapeScale': [1.6758, 1.7934, 1.47], 'lods': records,
    'parts': list(parts), 'materials': ['pal_infectedSkin', 'pal_asphalt', 'pal_blood', 'emi_infectedEye']}, indent=2) + '\n')
