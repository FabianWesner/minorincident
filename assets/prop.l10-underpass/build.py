"""Original open-ended concrete overpass for the L10 crossing. Local X is travel."""
import argparse,sys
from pathlib import Path
import bpy
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser();p.add_argument('--glb',default=str(HERE/'model.glb'));a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.l10-underpass'
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root
mats={n:palette.mat(n) for n in ['sidewalk','uiDark','olive']}
def box(name,at,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[mat]);o.parent=body
box('deck',(0,0,5.25),(12,14,.7),'sidewalk')
for y in (-6.7,6.7):
 box('side parapet',(0,y,5.95),(12,.4,.8),'sidewalk')
 for x in (-4.8,4.8): box('pier',(x,y,2.45),(1,.8,4.9),'sidewalk')
for x in (-5.8,5.8): box('fascia',(x,0,4.95),(.35,13,.32),'uiDark')
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
