"""Build corpse-only rigid LODs from intact models with headless Blender.

Collapse edges on the intact shells instead of selecting sparse triangles from
an already reduced living LOD. Rig nodes/materials survive; living tiers do not
use these files. Small clothing details may collapse, but whole bodies persist.
"""
import bpy
import bmesh
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ['inf.common-worker', 'inf.jogger', 'inf.cashier', 'inf.delivery-driver',
          'inf.suburban-mom', 'inf.bbq-dad', 'inf.bathrobe-neighbor']
for model in MODELS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (model + '.glb')))
    for original in list(bpy.context.scene.objects):
        if original.type != 'MESH':
            continue
        # glTF splits vertices at normal/material seams. Restore the original
        # closed topology before collapsing edges; keep separate nearby shells.
        topology = bmesh.new()
        topology.from_mesh(original.data)
        bmesh.ops.remove_doubles(topology, verts=list(topology.verts), dist=.00001)
        topology.to_mesh(original.data)
        topology.free()
        count = len(original.data.polygons)
        target = max(16, int(count * .018))
        if count > target:
            bpy.context.view_layer.objects.active = original
            modifier = original.modifiers.new('closed corpse shell', 'DECIMATE')
            modifier.ratio = target / count
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        for polygon in original.data.polygons:
            polygon.use_smooth = True
    bpy.context.scene['corpseSource'] = model + '.glb'
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (model + '.corpse.glb')),
                              export_format='GLB', export_animations=False, export_yup=True)
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
    print('CORPSE', model, triangles, flush=True)
