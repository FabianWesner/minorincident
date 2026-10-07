"""Rebuild worker distance meshes from closed source solids, without meshopt collapse.
Run: Blender -b --python tools/assets/rebuild-worker-lods.py
Outputs stay in .cache/crowd-feel until delivery validation succeeds.
"""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'tools/blender'))
from sslib.lod import export_lods
import bpy
import bmesh

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'assets/inf.common-worker/model.glb'))
# glTF hard-normal/material seams split coincident corners. Blender's collapse
# must see closed solids rather than hundreds of disconnected triangle islands.
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-6)
    mesh.to_mesh(obj.data)
    mesh.free()
output = root / '.cache/crowd-feel/model.glb'
output.parent.mkdir(parents=True, exist_ok=True)
export_lods(output, ratios=(.13, .10))
# The shared scenery reducer reconstructs hard faces. Worker hair/skin are
# rounded solids; hardening every triangle makes their reduced facets read as
# separate shards. Restore smooth corner normals after the geometry reduction.
for level in (1, 2):
    path = output.with_name('model.lod%d.glb' % level)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-6)
        mesh.to_mesh(obj.data)
        mesh.free()
        if obj.data.has_custom_normals:
            obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
        for face in obj.data.polygons:
            face.use_smooth = True
        obj.data.update()
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB',
                             export_apply=True, export_yup=True, export_extras=True,
                             export_cameras=False, export_lights=False)
