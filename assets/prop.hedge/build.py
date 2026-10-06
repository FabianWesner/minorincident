"""Deterministic trimmed hedge: soft rounded leaves, merged by palette material."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
parser.add_argument('--lod', type=int, default=0)
a = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(714)
root = bpy.data.objects.new('root', None)
bpy.context.collection.objects.link(root)
root['asset_id'] = 'prop.hedge'
root['category'] = 'prop'

def material(token, hex_color):
    rgb = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new('pal_' + token)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*linear, 1)
    bs.inputs['Roughness'].default_value = .85
    return m

materials = [material('grass', '6f8f3a'), material('foliage', '7da23c')]
vertices = [[], []]
faces = [[], []]

def leaf(center, normal, upright):
    n = Vector(normal)
    n = (n + Vector((rng.uniform(-.18,.18), rng.uniform(-.18,.18),rng.uniform(-.18,.18)))).normalized()
    up = Vector(upright)
    right = up.cross(n).normalized()
    angle = rng.uniform(-.48, .48)
    u = up*math.cos(angle) + right*math.sin(angle)
    v = right*math.cos(angle) - up*math.sin(angle)
    length = rng.uniform(.095, .125)
    width = rng.uniform(.072, .095)
    c = Vector(center) + n*rng.uniform(.012, .043)
    index = 1 if rng.random() < .65 else 0
    vs, fs = vertices[index], faces[index]
    start = len(vs)
    # Rounded eight-sided leaf volumes, with smooth normals instead of hard
    # triangular ridges. Broad overlapping silhouettes read as leafy clusters.
    for k in range(8):
        angle = 2*math.pi*k/8
        vs.append(tuple(c + v*math.cos(angle)*width + u*math.sin(angle)*length))
    vs.extend([tuple(c+n*.025), tuple(c-n*.016)])
    for k in range(8):
        fs.append((start+8, start+k, start+(k+1)%8))
        fs.append((start+9, start+(k+1)%8, start+k))

# 684 leaves distributed over all five visible surfaces, with staggered courses.
for sign in (-1, 1):
    for i in range(18 if a.lod == 0 else 0):
        for j in range(12):
            x = -1.2 + (i+.5)*.1333 + (.025 if j%2 else -.025) + rng.uniform(-.025,.025)
            z = .09 + j*.116 + rng.uniform(-.023,.023)
            leaf((x,sign*.38,z),(0,sign,0),(0,0,1))
    for i in range(6 if a.lod == 0 else 0):
        for j in range(12):
            y = -.36 + (i+.5)*.12 + rng.uniform(-.024,.024)
            z = .09 + j*.116 + rng.uniform(-.023,.023)
            leaf((sign*1.19,y,z),(sign,0,0),(0,0,1))
for i in range(18 if a.lod == 0 else 0):
    for j in range(6):
        leaf((-1.2+(i+.5)*.1333+rng.uniform(-.024,.024),-.36+(j+.5)*.12,1.43+rng.uniform(-.025,.025)),(0,0,1),(0,1,0))

# Authored distant tiers use overlapping rounded foliage masses, avoiding
# simplification of hundreds of disconnected leaves into slivers.
if a.lod:
    columns = 6 if a.lod == 1 else 4
    for i in range(columns):
        for side in (-1, 1) if a.lod == 1 else (0,):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6 if a.lod == 1 else 4,
                location=(-.94 + i*1.88/(columns-1), side*.14, .79))
            o=bpy.context.object
            o.scale=(.36 if a.lod == 1 else .34,.30 if a.lod == 1 else .43,.73)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            o.parent=root
            o.data.materials.append(materials[(i+int(side==1))%2])
            for polygon in o.data.polygons: polygon.use_smooth=True
            o.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
            o.name='body' if i==0 and side<=0 else 'leaf_cluster'
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for k, m in enumerate(materials):
    if not vertices[k]: continue
    mesh = bpy.data.meshes.new(m.name)
    mesh.from_pydata(vertices[k], [], faces[k])
    mesh.update()
    for polygon in mesh.polygons: polygon.use_smooth=True
    obj = bpy.data.objects.new('body' if k == 0 else 'leaves_' + m.name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(m)
    obj.parent = root
    mesh.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
    objects.append(obj)
# The inset core fills small foliage gaps without adding surface overlays.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,.715))
core=bpy.context.object
core.name='core'
core.dimensions=(2.32,.69,1.43)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
core.data.materials.append(materials[0])
bevel=core.modifiers.new('soft trimmed corners','BEVEL')
bevel.width=.16
bevel.segments=4 if a.lod < 2 else 2
bpy.ops.object.modifier_apply(modifier=bevel.name)
for polygon in core.data.polygons: polygon.use_smooth=True
core.parent=root
bpy.ops.object.select_all(action='DESELECT')
core.select_set(True)
objects[0].select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join()
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
floor = min((o.matrix_world @ v.co).z for o in objects for v in o.data.vertices)
for o in objects:
    for v in o.data.vertices:
        v.co.z -= floor
# Bake geometric ambient occlusion into glTF vertex colors, no image textures.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.bake.target = 'VERTEX_COLORS'
for obj in objects:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.data.color_attributes.active_color = obj.data.color_attributes['ao']
    bpy.ops.object.bake(type='AO')
col=bpy.data.objects.new('col:hedge',None)
bpy.context.collection.objects.link(col)
col.parent=root
col.location=(0,0,.75)
col['collider']='cuboid'
col['size']=[2.4,.84,1.5]

if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,col]+objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_cameras=False, export_lights=False)

if a.render:
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Studio')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.065,.085,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    for name,loc,power,size,color in [('key',(1,-3,5),450,4,(1,.88,.66)),('fill',(-3,-1,3),140,4,(.7,.8,1)),('rim',(2,3,4),300,3,(1,.92,.7))]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy=power
        data.shape='DISK'
        data.size=size
        data.color=color
        obj=bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        obj.location=loc
        obj.rotation_euler=(Vector((0,0,.7))-obj.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'))
    scene.collection.objects.link(cam)
    target=Vector((0,0,.76))
    direction=Vector((-3,-5,3.1) if a.view=='ref' else (4,-4,5.2))
    cam.location=target+direction
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale=4.4 if a.view=='ref' else 5.3
    scene.camera=cam
    scene.render.resolution_x=a.width
    scene.render.resolution_y=a.height
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=-.4
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(Path(a.render).resolve())
    Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
print('OK hedge build: triangles',sum(len(p.vertices)-2 for o in objects for p in o.data.polygons))
