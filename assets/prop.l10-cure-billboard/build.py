"""Original roadside public health billboard, metres, local +X facing traffic."""
import argparse, sys
from pathlib import Path
import bpy
from mathutils import Matrix
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser();p.add_argument('--glb',default=str(HERE/'model.glb'));a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.l10-cure-billboard'
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root
mats={n:palette.mat(n) for n in ['olive','canvasTan','uiDark','woodWarm']}
def box(name,at,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[mat]);o.parent=body
for y in (-3.4,3.4):
 box('post',(0,y,2.8),(.25,.25,5.6),'olive');box('foot',(0,y,.18),(.7,.7,.36),'woodWarm')
box('frame',(0,0,4.35),(.32,7.5,2.55),'olive')
box('faded sign',(.18,0,4.35),(.08,7.2,2.25),'canvasTan')
def text(label,z,width,height):
 c=bpy.data.curves.new(label,'FONT');c.body=label;c.align_x='CENTER';c.align_y='CENTER';c.size=1;c.extrude=.004;c.resolution_u=1
 o=bpy.data.objects.new(label,c);bpy.context.collection.objects.link(o);o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler();o.location=(.225,0,z);bpy.context.view_layer.update()
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
 xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
 for v in o.data.vertices: v.co.x*=width/(max(xs)-min(xs));v.co.y*=height/(max(ys)-min(ys))
 o.data.materials.append(mats['uiDark']);o.parent=body
text('STAY CALM. STAY HOME.',4.95,6.4,.42);text('THE CURE IS COMING.',4.15,6.1,.42)
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
