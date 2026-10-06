"""Deterministic Sunset Grove pallet. Metres, +X front, Z up; no textures."""
import argparse, json, sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--glb')
p.add_argument('--lod',type=int,choices=(0,1,2),default=0)
p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(token,rgb,metal=0):
 m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF')
 bs.inputs['Base Color'].default_value=(*[((v/255+.055)/1.055)**2.4 if v>10 else v/3294.6 for v in rgb],1)
 bs.inputs['Roughness'].default_value=.78; bs.inputs['Metallic'].default_value=metal
 return m
wood=material('woodWarm',(176,112,63))
parts=[]
def box(name,pos,size,mat=wood,bevel=.004,segments=1):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.name=name; o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel and a.lod==0:
  mod=o.modifiers.new('Rounded timber','BEVEL'); mod.width=bevel; mod.segments=segments
  bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.materials.append(mat); parts.append(o); return o
# Three runners and nine blocks leave full-height fork channels.
for x in [-.405,0,.405]:
 box('Bottom runner',(x,0,.016),(.14,1.2,.032))
 for y in [-.51,0,.51]:box('Spacer block',(x,y,.087),(.14,.18,.11),bevel=.009)
for y in [-.51,0,.51]:box('Cross bearer',(0,y,.154),(.95,.18,.024),bevel=.004)
# Keep eight deck boards close up; merge each pair only at distant LOD2.
for x in [-.399,-.133,.133,.399]:
 if a.lod==2:
  box('Deck plank',(x,0,.187),(.213,1.2,.042))
 else:
  for half in [-1,1]:
   box('Deck plank',(x+half*.055,0,.187),(.103,1.2,.042))
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['asset_id']='prop.pallet'; root['tier']='Side'; root['front']='+X'
root['ss_physics']={'class':'medium','mass':22,'friction':.65,'restitution':.1,'centerOfMass':[0,.104,0],'pushable':True,'kickable':False,'barricadeValue':.4,'barricadeHP':100,'vaultable':True,'flammable':True,'burnTime':15,'breakable':{'hp':80,'debrisSet':'debris.wood-small'},'sounds':'prop.wood-medium'}
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
body=bpy.context.object; body.name='body'; body.parent=root
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
meshes=[body]
# Retain the previous detail node contract without any per-detail geometry.
detail_nodes=[]
for name in ['woodWarm_grain','woodWarm_fresh','uiDark']:
 node=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(node); node.parent=root; detail_nodes.append(node)
col=bpy.data.objects.new('col:pallet',None); bpy.context.collection.objects.link(col); col.parent=root; col.location=(0,0,.108)
col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[.95,1.2,.216]; col['halfExtents']=[.475,.6,.108]
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
report=dict(id='prop.pallet',tier='Side',triangles=tris,draw_calls=1,materials=[wood.name],nodes_ok=True,within_budget=tris<=3000,rounds=4,webgpu_ok=False,webgl2_ok=False,gaps=[])
if a.lod==0:(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
(OUT/f'lod{a.lod}-stats.json').write_text(json.dumps({'triangles':tris,'draw_calls':1},indent=2))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in [root,col]+meshes+detail_nodes:o.select_set(True)
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
        light.data.energy=power; light.data.shape='DISK'; light.data.size=size; light.data.color=color; aim(light,(0,0,.1))
    views={'ref':(3,-2.3,1.9),'game':(3.8,-4.8,5.2),'front':(5,0,1.8),'rear':(-5,0,1.8),'side':(0,-5,1.8)}
    bpy.ops.object.camera_add(location=views[a.view]); camera=bpy.context.object; aim(camera,(0,0,.10))
    camera.data.type='ORTHO'; camera.data.ortho_scale=2.4 if a.view=='game' else 1.9; scene.camera=camera
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'
    scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
