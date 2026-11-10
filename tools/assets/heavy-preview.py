"""Quick Blender turntable-less preview of skinned crowd GLBs in bind pose (front / side / back), side by side.

Usage: python3 tools/blender/run.py tools/assets/heavy-preview.py -- <out.png> <a.glb> [b.glb ...]
Meshes are shown with the atlas base colour, unlit, so it is a colour/silhouette check only (the game camera check is Scene Lab).
"""
import sys
import math
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out, files = argv[0], argv[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'FLAT'
scene.display.shading.color_type = 'TEXTURE'
scene.display.shading.show_cavity = False
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('w')
scene.world.color = (0.55, 0.62, 0.7)
scene.display.render_aa = 'OFF'
scene.view_settings.view_transform = 'Standard'

views = [('front', 0), ('side', 90), ('back', 180)]
cols = len(files)
W, H = 360, 540
scene.render.resolution_x = W * len(views) * cols
scene.render.resolution_y = H
spacing = 2.8
for fi, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == 'MESH' and (o.name.startswith('stump') or 'eyes' in o.name and False):
            o.hide_render = True
    for vi, (vn, ang) in enumerate(views):
        # one clone per view
        if vi == 0:
            grp = new
        else:
            bpy.ops.object.select_all(action='DESELECT')
            for o in new:
                o.select_set(True)
            bpy.context.view_layer.objects.active = new[0]
            bpy.ops.object.duplicate()
            grp = [o for o in bpy.context.selected_objects]
        roots = [o for o in grp if o.parent is None]
        for r in roots:
            r.rotation_euler = (0, 0, 0)
            r.rotation_mode = 'XYZ'
            r.rotation_euler[2] = math.radians(ang - 90)
            r.location = ((fi * len(views) + vi) * spacing, 0, 0)
    bpy.context.view_layer.update()

cam = bpy.data.cameras.new('c')
cam.type = 'ORTHO'
cam.ortho_scale = spacing * len(views) * cols
camo = bpy.data.objects.new('c', cam)
scene.collection.objects.link(camo)
camo.location = (spacing * (len(views) * cols - 1) / 2, -20, 1.5)
camo.rotation_euler = (math.radians(90), 0, 0)
scene.camera = camo
cam.ortho_scale = spacing * len(views) * cols
cam.shift_y = 0.0
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
