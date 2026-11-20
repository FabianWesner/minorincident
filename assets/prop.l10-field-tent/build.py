"""Original L10 field tent, split entrance flaps, local +X faces outward."""
import argparse,sys,math
from pathlib import Path
import bpy
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser();p.add_argument('--glb',default=str(HERE/'model.glb'));a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.l10-field-tent'
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root
mats={n:palette.mat(n) for n in ['canvasTan','olive','uiDark','schoolBusYellow']}
def box(name,at,size,mat,parent=body,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.rotation_euler[1]=rot;o.data.materials.append(mats[mat]);o.parent=parent
box('floor',(0,0,.06),(4.4,6.8,.12),'olive')
for y in (-3.2,3.2):box('side canvas',(0,y,1.05),(4.2,.12,2.1),'canvasTan')
box('back canvas',(-2.05,0,1.05),(.12,6.4,2.1),'canvasTan')
for x in (-1.05,1.05): box('sloped roof',(x,0,2.5),(2.45,6.8,.12),'canvasTan',rot=(-.48 if x<0 else .48))
for y in (-2.9,2.9): box('front edge',(2.08,y,1.05),(.16,.6,2.1),'olive')
box('front header',(2.08,0,2.0),(.16,5.2,.2),'schoolBusYellow')
for name,y,centre in [('flapL',-2.6,-1.3),('flapR',2.6,1.3)]:
 hinge=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(hinge);hinge.parent=root;hinge.location=(2.12,y,0)
 box(name+'-canvas',(0,centre-y,1.0),(.1,2.6,1.8),'canvasTan',parent=hinge)
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
