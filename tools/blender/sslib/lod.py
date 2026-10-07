"""Conservative authored LODs: dissolve planar tessellation, retain boundaries.

Unlike delivery simplification this never welds disconnected trim/shingle solids,
never discards whole faces, and reconstructs hard normals after reducing bevels.
"""
import math
import bpy
import bmesh


def triangles(data):
    data.calc_loop_triangles()
    return len(data.loop_triangles)


def hard_normals(obj):
    if obj.data.has_custom_normals:
        obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
    for face in obj.data.polygons:
        face.use_smooth = False
    obj.data.update()
    mod = obj.modifiers.new('LOD hard face normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def simplify(obj, ratio, planar_only=False):
    original = triangles(obj.data)
    bpy.context.view_layer.objects.active = obj
    # Coplanar glyphs and broad roof/wall panels keep their exact outline.
    mod = obj.modifiers.new('Planar tessellation reduction', 'DECIMATE')
    mod.decimate_type = 'DISSOLVE'
    mod.angle_limit = math.radians(.5)
    mod.use_dissolve_boundaries = False
    mod.delimit = {'MATERIAL', 'SEAM', 'SHARP'}
    bpy.ops.object.modifier_apply(modifier=mod.name)
    count = triangles(obj.data)
    if not planar_only and count > original * ratio:
        before = obj.data.copy()
        bm = bmesh.new(); bm.from_mesh(before)
        boundary_before = sum(e.is_boundary for e in bm.edges); bm.free()
        mod = obj.modifiers.new('Closed bevel reduction', 'DECIMATE')
        mod.ratio = min(1, original * ratio / count)
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bm = bmesh.new(); bm.from_mesh(obj.data)
        boundary_after = sum(e.is_boundary for e in bm.edges); bm.free()
        # Reduction may simplify existing openings, but must never tear new ones.
        if boundary_after > boundary_before:
            reduced = obj.data; obj.data = before; bpy.data.meshes.remove(reduced)
        else:
            bpy.data.meshes.remove(before)
    hard_normals(obj)
    return triangles(obj.data)


def export_lods(output, meshes=None, ratios=(.55, .25), planar_prefixes=('emi_',), planar_nodes=()):
    """Export tiers from an asset's evaluated, baked source, keeping its hierarchy."""
    from pathlib import Path
    import json
    output = Path(output).resolve()
    meshes = meshes or [o for o in bpy.context.scene.objects if o.type == 'MESH']
    originals = {o: o.data for o in meshes}
    stats = {}
    try:
        for level, ratio in enumerate(ratios, 1):
            for o, data in originals.items():
                o.data = data.copy()
                simplify(o, ratio, planar_only=o.name in planar_nodes or any(m.name.startswith(planar_prefixes) for m in o.data.materials))
            bpy.ops.object.select_all(action='DESELECT')
            for o in bpy.context.scene.objects:
                o.select_set(o in meshes or o.type == 'EMPTY')
            path = output.with_name(output.stem + '.lod%d.glb' % level)
            bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                     export_apply=True, export_yup=True, export_extras=True,
                                     export_cameras=False, export_lights=False)
            stats['lod%d' % level] = {'triangles': sum(triangles(o.data) for o in meshes),
                                     'draw_calls': sum(len(o.data.materials) for o in meshes)}
            for o, data in originals.items():
                reduced = o.data; o.data = data; bpy.data.meshes.remove(reduced)
    finally:
        for o, data in originals.items():
            if o.data != data:
                reduced = o.data; o.data = data; bpy.data.meshes.remove(reduced)
    (output.parent / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print('OK authored LODs', json.dumps(stats))


def rebuild_from_baked(output, planar_prefixes=('emi_',), planar_nodes=(), ratios=(.55, .25)):
    """Fast LOD-only rebuild from the source script's already baked LOD0 export."""
    from pathlib import Path
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(output).resolve()))
    export_lods(output, planar_prefixes=planar_prefixes, planar_nodes=planar_nodes, ratios=ratios)


def refresh_normals(directory, decoded_directory):
    """Restore hard edges on existing tiers without changing their geometry."""
    from pathlib import Path
    import json
    directory = Path(directory).resolve(); decoded_directory = Path(decoded_directory).resolve()
    stats = {}
    for level in (1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(decoded_directory / ('model.lod%d.glb' % level)))
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        for o in meshes: hard_normals(o)
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(directory / ('model.lod%d.glb' % level)),
                                 export_format='GLB', use_selection=True, export_apply=True,
                                 export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
        stats['lod%d' % level] = {'triangles': sum(triangles(o.data) for o in meshes),
                                 'draw_calls': sum(len(o.data.materials) for o in meshes)}
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print('OK hard-edge normals', json.dumps(stats))
