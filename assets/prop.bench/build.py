"""Deterministic, texture-free Sunset Grove wooden bench; +X is seating front."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
p.add_argument('--glb')
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(token, color, metal=0):
    m = bpy.data.materials.new('pal_'+token); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*[ ((v/255+0.055)/1.055)**2.4 if v/255>0.04045 else v/255/12.92 for v in color],1)
    bs.inputs['Roughness'].default_value = .62; bs.inputs['Metallic'].default_value = metal
    return m
wood = material('woodWarm', (176,112,63)); iron = material('uiDark',(37,34,44),.55)
parts=[]
def box(name, pos, size, bevel=.015, rotation=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.rotation_euler[1]=rotation
    mod=o.modifiers.new('Soft timber edges','BEVEL'); mod.width=bevel; mod.segments=5
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(wood); parts.append(o)
    return o

def beam(name,start,end,width,depth):
    mid=(Vector(start)+Vector(end))/2
    o=box(name,mid,(width,depth,(Vector(end)-Vector(start)).length))
    o.rotation_euler=(Vector(end)-Vector(start)).to_track_quat('Z','Y').to_euler()
    return o
# Three broad seat planks, two open-backed boards, splayed trestle ends.
for i,x in enumerate([-.205,0,.205]):
    box('Seat plank '+str(i),(x,0,.52),(.19,1.9,.085),.012)
for y in [-.70,.70]:
    box('Seat bearer',(0,y,.435),(.66,.12,.13))
    beam('Front splayed leg',(.30,y, .035),(.12,y,.46),.12,.14)
    beam('Rear splayed leg',(-.29,y,.035),(-.13,y,.46),.12,.14)
    box('Trestle cross rail',(0,y,.25),(.51,.105,.10),.012)
    beam('Back upright',(-.16,y,.43),(-.34,y,1.09),.11,.12)
for z in [.79,1.005]:
    x=-.16-(z-.43)*(.18/.66)+.064
    board=box('Backrest plank',(x,0,z),(.08,1.87,.17),.013,math.radians(-15))
    for y in [-.70,.70]:
        # Bolt heads stand well proud of the front faces, never coplanar.
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.023, depth=.014, location=(x+.050,y,z),rotation=(0,math.pi/2,0))
        o=bpy.context.object; o.name='Hex carriage bolt'; o.data.materials.append(iron)
        mod=o.modifiers.new('Bolt edge','BEVEL'); mod.width=.002; mod.segments=3
        bpy.ops.object.modifier_apply(modifier=mod.name); parts.append(o)
# Reference shows a single raised arm at the right end.
box('Right arm cap',(.025,.83,.685),(.64,.15,.085),.013)
box('Arm front riser',(.22,.83,.588),(.09,.105,.14),.01)
beam('Arm rear brace',(-.18,.83,.47),(-.24,.83,.66),.08,.10)
box('Lower longitudinal stretcher',(-.12,0,.31),(.09,1.42,.09),.01)
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['ss_physics']={'class':'medium','mass':35,'friction':0.6,'restitution':0.15,'centerOfMass':[0,0.45,0],'pushable':True,'kickable':False,'barricadeValue':1.0,'barricadeHP':250,'vaultable':True,'flammable':True,'burnTime':20,'breakable':{'hp':120,'debrisSet':'debris.wood-small'},'sounds':'prop.wood-medium'}
root['asset_id']='prop.bench'; root['front']='+X'; root['tier']='Side'
# Static geometry collapses to one draw per palette material.
groups={mat:[o for o in parts if o.data.materials[0]==mat] for mat in [wood,iron]}
for mat in [wood,iron]:
    bpy.ops.object.select_all(action='DESELECT')
    group=groups[mat]
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name='body' if mat==wood else 'fasteners'
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    o.parent=root
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Align the lowest bevelled foot precisely with the ground.
low=min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
for o in meshes:o.location.z-=low
colliders=[]
for name,pos,size in [('seat',(0,0,.49),(.63,1.9,.20)),('back',(-.25,0,.86),(.25,1.87,.46)),('legs',(0,0,.23),(.66,1.54,.46))]:
    col=bpy.data.objects.new('col:'+name,None); bpy.context.collection.objects.link(col); col.parent=root; col.location=pos
    col['collider']='cuboid'; col['shape']='cuboid'; col['size']=list(size); col['halfExtents']=[v/2 for v in size]; colliders.append(col)
tris=sum(sum(len(poly.vertices)-2 for poly in o.data.polygons) for o in meshes)
report=dict(id='prop.bench',tier='Side',triangles=tris,draw_calls=2,materials=[wood.name,iron.name],nodes_ok=True,within_budget=6000<=tris<=12000,rounds=1,webgpu_ok=False,webgl2_ok=False,gaps=[])
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root]+meshes+colliders:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.14,.12,.18,1)
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.45
    ground=bpy.data.materials.new('Render floor'); ground.use_nodes=True
    ground.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.014,.011,.019,1)
    ground.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object; floor.data.materials.append(ground); floor.location.z=-.012
    def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((3,-4,6),650,4,(1,.78,.60)),((-3,-1,4),450,3,(1,.55,.30)),((1,4,3),250,4,(.65,.75,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object
        light.data.energy=power; light.data.shape='DISK'; light.data.size=size; light.data.color=color; aim(light,(0,0,.5))
    views={'ref':(5,1.6,2.25),'game':(3.8,-4.8,5.2),'front':(5,0,1.8),'rear':(-5,0,1.8),'side':(0,-5,1.8)}
    bpy.ops.object.camera_add(location=views[a.view]); camera=bpy.context.object; aim(camera,(0,0,.53))
    camera.data.type='ORTHO'; camera.data.ortho_scale=3.7 if a.view=='game' else 2.9; scene.camera=camera
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'
    scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
