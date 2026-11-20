"""Original roadside quarantine gantry, metres, local +X facing traffic."""
import argparse, sys
from pathlib import Path
import bpy
from mathutils import Matrix
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser();p.add_argument('--glb',default=str(HERE/'model.glb'));a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.l10-quarantine-gantry'
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root
mats={n:palette.mat(n) for n in ['olive','canvasTan','uiDark','woodWarm']}
def box(name,at,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[mat]);o.parent=body
for y in (-6,6):
 box('post',(0,y,3.5),(.32,.32,7),'olive');box('foot',(0,y,.18),(.75,.75,.36),'woodWarm')
box('upper rail',(0,0,6.8),(.32,12.3,.28),'olive');box('lower rail',(0,0,5.3),(.25,12.3,.22),'olive')
box('weathered sign',(.02,0,6.07),(.22,10.4,1.25),'canvasTan')
def text(label,z,width,height):
 c=bpy.data.curves.new(label,'FONT');c.body=label;c.align_x='CENTER';c.align_y='CENTER';c.size=1;c.extrude=.004;c.resolution_u=1
 o=bpy.data.objects.new(label,c);bpy.context.collection.objects.link(o);o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler();o.location=(.15,0,z);bpy.context.view_layer.update()
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
 for v in o.data.vertices: v.co.x*=width/(max(xs)-min(xs));v.co.y*=height/(max(ys)-min(ys))
 o.data.materials.append(mats['uiDark']);o.parent=body
text('YOU ARE NOW LEAVING',6.35,8.6,.33);text('THE QUARANTINE ZONE',5.88,9.0,.38)
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
