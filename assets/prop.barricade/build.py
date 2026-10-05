"""Sunset Grove road barricade: metre-scale, +X front, deterministic geometry."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {}
# Hazard orange is the reference-specific warm variation of the hazard palette token.
for token, color in [('picketWhite', 'f2e6dc'), ('schoolBusYellow', 'f65b18'), ('sidewalk', 'b9a4a0')]:
    rgb = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    mat = bpy.data.materials.new('pal_'+token)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = .68
    mat.diffuse_color = (*linear, 1)
    materials[token] = mat

root = bpy.data.objects.new('root', None)
bpy.context.collection.objects.link(root)
root['asset_id'] = 'prop.barricade'
root['ss_physics'] = {'class':'medium', 'mass':18, 'friction':.65, 'restitution':.1,
    'centerOfMass':[0,.67,0], 'pushable':True, 'kickable':False, 'barricadeValue':1.0,
    'barricadeHP':180, 'vaultable':False, 'flammable':True, 'burnTime':20,
    'breakable':{'hp':120, 'debrisSet':'debris.wood-small'}, 'sounds':'prop.wood-medium'}

def finish(obj, token, bevel=.018, segments=5):
    obj.data.materials.append(materials[token])
    bpy.context.view_layer.objects.active = obj
    if bevel:
        mod = obj.modifiers.new('rounded edges', 'BEVEL')
        mod.width, mod.segments = bevel, segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.parent = root
    return obj

def box(name, loc, size, token='picketWhite', bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name, obj.dimensions = name, size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, token, bevel)

# Four solid legs; splay matches the broad triangular negative space in the reference.
for y in [-.89, .89]:
    for side in [-1, 1]:
        joint_y = y + side*.006
        bottom = Vector((side*.43, joint_y, .045))
        top = Vector((side*.035, joint_y, 1.57))
        leg = box('splayed leg', (bottom+top)/2, (.145,.175,(top-bottom).length+.09))
        leg.rotation_euler = (top-bottom).to_track_quat('Z', 'Y').to_euler()
    box('cap collar', (0,y,1.585), (.16,.17,.075), 'sidewalk', .012)
    box('square post cap', (0,y,1.69), (.215,.215,.195), bevel=.027)

# Rails lean with the A-frame. Orange bands are closed prisms 6 mm clear of the face.
def clip(poly, limit, keep_greater):
    result = []
    for p, q in zip(poly, poly[1:]+poly[:1]):
        a, b = (p[0]>=limit), (q[0]>=limit)
        if not keep_greater: a, b = not a, not b
        if a: result.append(p)
        if a != b:
            t = (limit-p[0])/(q[0]-p[0])
            result.append((limit, p[1]+t*(q[1]-p[1])))
    return result

for side in [-1, 1]:
    for z in [.43, 1.34]:
        x = side*(.43-(z-.045)*.395/1.525+.135)
        angle = -side*math.atan(.395/1.525)
        rail = box('striped rail', (x,0,z), (.105,2.25,.43), bevel=.024)
        rail.rotation_euler.y = angle
        rotation = rail.rotation_euler.to_matrix()
        # local coordinates (across, up), diagonal down to the right.
        for start in [-1.42, -.84, -.26, .32, .90]:
            poly = [(start+.105,-.201),(start+.38,-.201),(start+.17,.201),(start-.105,.201)]
            poly = clip(clip(poly,-1.105,True),1.105,False)
            if len(poly)<3: continue
            verts = [tuple(rail.location+rotation@Vector((side*depth,u,v)))
                     for depth in [.0585,.0675] for u,v in poly]
            n = len(poly)
            faces = [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
            faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
            if side < 0:
                faces = [tuple(reversed(face)) for face in faces]
            mesh = bpy.data.meshes.new('raised hazard band')
            mesh.from_pydata(verts,[],faces)
            mesh.update()
            obj = bpy.data.objects.new('raised hazard band',mesh)
            bpy.context.collection.objects.link(obj)
            finish(obj,'schoolBusYellow',.002,3)
# Narrow folding spreader beneath the lower rails; no invented bolts or lettering.
for y in [-.89,.89]:
    box('spreader', (0,y,.31), (.62,.06,.045), 'sidewalk', .01)

for token, mat in materials.items():
    objects = [o for o in bpy.data.objects if o.type=='MESH' and o.data.materials[0]==mat]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = 'body' if token=='picketWhite' else 'static_'+token
    # AO is baked into glTF vertex colours; named attribute is also retained.
    mesh = objects[0].data
    mesh.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')

col = bpy.data.objects.new('col:body',None)
bpy.context.collection.objects.link(col)
col.parent = root
col['collider'] = 'cuboid'
col['shape'] = 'cuboid'
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
meshes = [o for o in bpy.data.objects if o.type=='MESH']
# Apply joined object transforms and seat the lowest bevel exactly at ground level.
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes: obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
low = min(v.co.z for obj in meshes for v in obj.data.vertices)
for obj in meshes:
    for vertex in obj.data.vertices: vertex.co.z -= low
points = [v.co for obj in meshes for v in obj.data.vertices]
minimum = [min(v[i] for v in points) for i in range(3)]
maximum = [max(v[i] for v in points) for i in range(3)]
col.location = tuple((a+b)/2 for a,b in zip(minimum, maximum))
col['size'] = [b-a for a,b in zip(minimum, maximum)]
triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
report = {'id':'prop.barricade','tier':'Side','triangles':triangles,'draw_calls':len(meshes),
          'materials':[m.name for m in materials.values()], 'nodes_ok':True,
          'within_budget':6000<=triangles<=12000 and len(meshes)<=30}
Path(__file__).with_name('metrics.json').write_text(json.dumps(report,indent=2)+'\n')
# Deterministic Cycles AO bake, with all parts participating in occlusion.
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.seed = 0
scene.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
    obj.data.color_attributes.active_color = obj.data.color_attributes['ao']
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type='AO')
if args.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=args.glb,export_format='GLB',use_selection=True,
                             export_apply=True,export_extras=True,export_attributes=True)
if args.render:
    stage = bpy.data.materials.new('stage')
    stage.diffuse_color = (.045,.037,.053,1)
    stage.use_nodes = True
    stage.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (.045,.037,.053,1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
    bpy.context.object.data.materials.append(stage)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    scene.cycles.seed = 0
    scene.world.color = (.25,.25,.25)
    target = Vector((0,0,.85))
    for loc,energy,color in [((4,1,6),650,(1,.82,.65)),((-3,-4,4),450,(.69,.75,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.color, lamp.data.size = energy,color,4
        lamp.rotation_euler = (target-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    directions = {'ref':(6,3.5,3.1),'game':(7,7,9),'front':(8,0,.4),'rear':(-8,0,.4),'side':(0,8,1)}
    camera.location = target+Vector(directions[args.view])
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 4.9 if args.view!='game' else 6.0
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = args.width,args.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = args.render
    bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
