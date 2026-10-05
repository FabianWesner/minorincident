"""White picket fence: six pointed boards, paired rails and capped end posts.
Run through experiment/tools/blender_run.py; no textures or moving parts.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render')
p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
p.add_argument('--glb')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

m = bpy.data.materials.new('pal_picketWhite')
m.use_nodes = True
rgb = [int('f2e6dc'[i:i+2], 16)/255 for i in (0, 2, 4)]
rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
m.diffuse_color = (*rgb, 1)
bsdf = m.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (*rgb, 1)
bsdf.inputs['Roughness'].default_value = .72
parts = []

def finish(obj, name, bevel):
    obj.name = name
    obj.data.materials.append(m)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Rounded painted edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 5
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(obj)
    return obj

def box(name, center, size, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, bevel)

def prism(name, y, outline, depth, x=0, bevel=.014):
    n = len(outline)
    verts = [(x+side*depth/2, y+u, z) for side in (-1, 1) for u,z in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, bevel)

# +X is the presentation face. Rails lie behind the boards, with overlap
# in volume rather than coincident surface planes.
for y in (-1.18, 1.18):
    box('End post', (0, y, .585), (.23, .25, 1.17))
    box('Cap collar', (0, y, 1.205), (.25, .275, .075), .014)
    # Pyramid cap, a separate solid meeting the collar below its top plane.
    verts = [(-.13,y-.145,1.23), (.13,y-.145,1.23),
             (.13,y+.145,1.23), (-.13,y+.145,1.23), (0,y,1.345)]
    mesh = bpy.data.meshes.new('Pyramid cap')
    mesh.from_pydata(verts, [], [(3,2,1,0),(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
    mesh.update()
    obj = bpy.data.objects.new('Pyramid cap', mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, 'Pyramid cap', .009)
for z in (.18, .825):
    box('Horizontal rail', (-.055,0,z), (.115,2.36,.16), .013)
for i in range(6):
    y = -.9 + i*.36
    prism('Pointed picket', y, [(-.125,.025),(.125,.025),(.125,1.01),(0,1.145),(-.125,1.01)], .13, .04)

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'body'
bpy.context.scene.cursor.location = (0,0,0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
root = bpy.data.objects.new('root', None)
bpy.context.collection.objects.link(root)
root['asset_id'] = 'prop.picket-fence'
root['category'] = 'prop'
body.parent = root
col = bpy.data.objects.new('col:fence', None)
bpy.context.collection.objects.link(col)
col.parent = root
col.location = (0,0,.6725)
col['collider'] = 'cuboid'
col['size'] = [.26,2.65,1.345]
# Bake ambient occlusion into the runtime color attribute before adding studio objects.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
body.data.color_attributes.new(name='ao', type='BYTE_COLOR', domain='CORNER')
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
scene.render.bake.target = 'VERTEX_COLORS'
scene.world.color = (1,1,1)
bpy.ops.object.bake(type='AO')
# A fence is fixed scenery, so no movable-body extras or animation joints.
bpy.context.scene.unit_settings.system = 'METRIC'
body.data.calc_loop_triangles()
triangles = len(body.data.loop_triangles)
stats = {'triangles': triangles, 'draw_calls': 1, 'materials': [m.name], 'nodes_ok': True}
(OUT/'build-stats.json').write_text(json.dumps(stats, indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=a.glb, export_format='GLB', use_selection=True,
        export_apply=True, export_extras=True, export_yup=True)
if a.render:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    scene.world.color = (.20,.20,.20)
    stage = bpy.data.materials.new('Studio ground')
    stage.diffuse_color = (.047,.039,.058,1)
    stage.use_nodes = True
    stage.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (.047,.039,.058,1)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.012))
    bpy.context.object.data.materials.append(stage)
    target = Vector((0,0,.65))
    for loc, energy, color, size in [((4,-3,6),850,(1,.72,.40),4),((-3,2,4),500,(.67,.49,1),4)]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.color, lamp.data.size = energy,color,size
        lamp.rotation_euler = (target-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    az,elev = (45,36) if a.view=='game' else (-12,12)
    if a.view=='front': az,elev = 0,0
    if a.view=='rear': az,elev = 180,12
    if a.view=='side': az,elev = 90,12
    az,elev = math.radians(az),math.radians(elev)
    cam.location = target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*(10.5 if a.view=='game' else 7.8)
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type = 'ORTHO' if a.view!='game' else 'PERSP'
    cam.data.ortho_scale = 3.5
    cam.data.angle = math.radians(25)
    scene.camera = cam
    scene.render.resolution_x,scene.render.resolution_y = a.width,a.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = a.render
    bpy.ops.render.render(write_still=True)
print('OK', json.dumps(stats))
