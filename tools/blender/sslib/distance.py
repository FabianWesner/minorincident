"""Export inexpensive native distance variants before detailed source batching.

Sources construct their original box/profile/cylinder forms with bevels disabled
and fewer radial segments. This module removes explicitly named decoration and
interiors, batches the remaining forms and bakes small CPU vertex AO. It never
collapses triangles or replaces a concave profile with a bounding box.
"""
import json
import re
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from .lod import hard_normals, triangles


def tier_argument():
    """Consume the common flag before each standalone source's own parser."""
    if '--distance-tier' not in sys.argv:
        return 0
    index = sys.argv.index('--distance-tier')
    tier = int(sys.argv[index + 1]); del sys.argv[index:index + 2]
    if tier not in (1, 2):
        raise ValueError('distance tier must be 1 or 2')
    return tier


def export_variant(directory, tier, omit=(), far_omit=(), owners=None, flat_parts=()):
    directory = Path(directory).resolve()
    bpy.context.view_layer.update()
    # Source C groups unparented primitives explicitly before its normal merge.
    if owners:
        for owner, objects in owners.items():
            for obj in objects:
                world = obj.matrix_world.copy(); obj.parent = owner; obj.matrix_world = world
    # Perforated wheel faces become closed low-sided discs, keeping their palette.
    import fnmatch
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH' or not any(fnmatch.fnmatch(re.sub(r'\.\d{3}$', '', obj.name.lower()), pattern.lower()) for pattern in flat_parts): continue
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        low = Vector(tuple(min(v[k] for v in points) for k in range(3)))
        high = Vector(tuple(max(v[k] for v in points) for k in range(3)))
        size = high-low; axis = min(range(3), key=lambda k:size[k])
        center = (low+high)/2; radius = max(size)/2
        owner = obj.parent; material = obj.data.materials[0]; name = obj.name
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12 if tier==1 else 8, radius=radius, depth=max(size[axis],.012), location=center)
        disc = bpy.context.object; disc.name = name
        disc.rotation_euler = (0,0,0) if axis==2 else ((0,1.5707963268,0) if axis==0 else (1.5707963268,0,0))
        disc.data.materials.append(material)
        bpy.context.view_layer.update()
        world = disc.matrix_world.copy(); disc.parent = owner; disc.matrix_world = world
    removed = []
    for obj in list(bpy.context.scene.objects):
        ancestry = []; parent = obj.parent
        while parent:
            ancestry.append(parent.name.lower()); parent = parent.parent
        if obj.type not in {'MESH', 'FONT', 'CURVE'}:
            continue
        name = obj.name.lower()
        if obj.type=='MESH' and not obj.data.materials:
            bpy.data.objects.remove(obj, do_unlink=True); continue
        small = False
        if directory.name.startswith('veh.'):
            bpy.context.view_layer.update()
            size = obj.dimensions
            important = any(word in name for word in ('tyre','tire','mirror','lamp','light','beacon','signal','indicator','pillar','shell','windshield','window','roof','hood','chassis','tailgate','rack')) or any(m.name.startswith('emi_') for m in obj.data.materials)
            small = not important and max(size) < (.45 if tier==1 else .75)
        if small or ('interior' in ancestry and 'floor' not in name) or any(word.lower() in name for word in (*omit, *(far_omit if tier == 2 else ()))):
            removed.append(obj.name); bpy.data.objects.remove(obj, do_unlink=True)
    # Native profiles keep boolean openings. Bevels are never evaluated for LODs.
    meshes = []
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {'MESH', 'FONT', 'CURVE'}: continue
        for mod in list(obj.modifiers):
            if mod.type in {'BEVEL', 'WEIGHTED_NORMAL', 'DECIMATE'}: obj.modifiers.remove(mod)
        if obj.type != 'MESH' or obj.modifiers:
            bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            if obj.type != 'MESH':
                bpy.ops.object.convert(target='MESH'); obj = bpy.context.object
            for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
        meshes.append(obj)
    detail = {}
    for obj in meshes:
        name = re.sub(r'\.\d{3}$', '', obj.name)
        detail[name] = detail.get(name,0) + triangles(obj.data)
    print('OK source components', sum(detail.values()), sorted(detail.items(), key=lambda pair: pair[1], reverse=True)[:10])
    # Keep identical placement/pivots and any sockets introduced after batching.
    native = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(directory / 'model.glb'))
    reference = set(bpy.context.scene.objects) - native
    def bounds(objects):
        bpy.context.view_layer.update()
        points = [o.matrix_world @ v.co for o in objects if o.type == 'MESH' for v in o.data.vertices]
        return [min(v[k] for v in points) for k in range(3)], [max(v[k] for v in points) for k in range(3)]
    low, high = bounds(native); rlow, rhigh = bounds(reference)
    shift = Vector(((rlow[0]+rhigh[0]-low[0]-high[0])/2,
                    (rlow[1]+rhigh[1]-low[1]-high[1])/2, rlow[2]-low[2]))
    for obj in native:
        if obj.parent is None: obj.location += shift
    roots = [o for o in native if o.type == 'EMPTY' and o.parent is None]
    root = roots[0]
    # Copy late-created empty sockets/light metadata from the detailed source.
    for obj in reference:
        if obj.type != 'EMPTY': continue
        name = re.sub(r'\.\d{3}$', '', obj.name)
        target = next((o for o in native if o.name == name), None)
        if target is None:
            target = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(target)
            target.parent = root; target.matrix_world = obj.matrix_world.copy(); native.add(target)
        for key in obj.keys(): target[key] = obj[key]
    for obj in reference: bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    buckets = {}
    for obj in meshes:
        # Each source primitive has one palette material; retain rigid ownership.
        buckets.setdefault((obj.parent, obj.data.materials[0]), []).append(obj)
    meshes = []
    for (owner, material), objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]; bpy.ops.object.join()
        obj = bpy.context.object; obj.name = (owner.name if owner else root.name) + '_' + material.name
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        # Planar dissolve removes font tessellation, without changing any outline.
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.dissolve_limit(bm, angle_limit=.001, verts=list(bm.verts), edges=list(bm.edges), use_dissolve_boundaries=False, delimit={'MATERIAL'})
        bm.to_mesh(obj.data); bm.free(); hard_normals(obj); meshes.append(obj)
    if not any(o.name=='body' for o in bpy.context.scene.objects):
        white = next((o for o in meshes if o.data.materials[0].name=='pal_picketWhite'), None)
        if white: white.name='body'
    # Deterministic geometry AO, eight rays: source geometry is small at distance.
    import math
    verts = []; faces = []
    for obj in meshes:
        offset = len(verts); verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
    tree = BVHTree.FromPolygons(verts, faces)
    directions = [Vector((math.sqrt(1-((i+.5)/8)**2)*math.cos(i*2.399963), math.sqrt(1-((i+.5)/8)**2)*math.sin(i*2.399963), (i+.5)/8)) for i in range(8)]
    for obj in meshes:
        layer = obj.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
        obj.data.color_attributes.active_color = layer
        for face in obj.data.polygons:
            normal = (obj.matrix_world.to_3x3() @ face.normal).normalized()
            rotation = normal.to_track_quat('Z','Y')
            for index in face.loop_indices:
                point = obj.matrix_world @ obj.data.vertices[obj.data.loops[index].vertex_index].co
                occlusion = 0
                for direction in directions:
                    hit, _, _, distance = tree.ray_cast(point+normal*.008, rotation @ direction, 1.2)
                    if hit is not None: occlusion += 1-distance/1.2
                value = 1-.4*occlusion/8; layer.data[index].color = (value,value,value,1)
    # Resolve anchor references to the surviving palette batches.
    for obj in bpy.context.scene.objects:
        if 'ss_light' not in obj: continue
        value = obj['ss_light']; light = json.loads(value) if isinstance(value, str) else dict(value)
        resolved = []
        for name in light.get('emissiveNodes', []):
            exact = next((o for o in meshes if o.name == name), None)
            if exact: resolved.append(exact.name); continue
            if '_emi_' not in name: continue
            owner, token = name.split('_emi_', 1)
            candidates = [o for o in meshes if any(m.name == 'emi_'+token for m in o.data.materials)]
            scoped = []
            for candidate in candidates:
                parent = candidate.parent
                while parent:
                    if parent.name == owner: scoped.append(candidate); break
                    parent = parent.parent
            resolved.extend(o.name for o in (scoped or candidates))
        light['emissiveNodes'] = sorted(set(resolved))
        obj['ss_light'] = json.dumps(light)
    bpy.ops.object.select_all(action='SELECT')
    path = directory / ('model.lod%d.glb' % tier)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_apply=True,
                             export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
    count = sum(triangles(o.data) for o in meshes)
    budget = (6000 if tier == 1 else 2000) if directory.name.startswith('veh.') else (12000 if tier == 1 else 4000)
    if count > budget: raise ValueError('%s LOD%d: %d > %d' % (directory.name, tier, count, budget))
    stats_path = directory/'distance-stats.json'
    stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
    stats[str(tier)] = {'triangles': count, 'bytes': path.stat().st_size, 'omitted': removed}
    stats_path.write_text(json.dumps(stats, indent=2)+'\n')
    lod_stats = {'lod'+key: {'triangles': value['triangles'], 'file_bytes': value['bytes']} for key,value in stats.items()}
    (directory/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2)+'\n')
    print('OK native distance variant', directory.name, tier, count, 'triangles')
    sys.exit(0)


def build_native_lods(source):
    """Full source builds regenerate native tiers, then restore the hero scene."""
    import runpy
    import tempfile
    source = Path(source).resolve()
    argv = list(sys.argv)
    with tempfile.TemporaryDirectory(prefix='minor-incident-lods-') as temp:
        saved = Path(temp)/'hero.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(saved))
        try:
            for tier in (1, 2):
                sys.argv = [str(source), '--', '--distance-tier', str(tier), '--glb', str(source.parent/('model.lod%d.glb' % tier))]
                try:
                    runpy.run_path(str(source), run_name='__main__')
                except SystemExit as error:
                    if error.code not in (None, 0): raise
        finally:
            sys.argv = argv
            bpy.ops.wm.open_mainfile(filepath=str(saved))
