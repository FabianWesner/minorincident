"""Field-hospital stretcher and IV stand; +X is the foot end."""
import argparse,sys,math
from pathlib import Path
import bpy
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser();p.add_argument('--glb',default=str(HERE/'model.glb'));a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.l10-field-stretcher'
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root
m={n:palette.mat(n) for n in ['uiDark','sidewalk','canvasTan','picketWhite','sirenRed']}
def box(name,at,size,token):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m[token]);o.parent=body
box('frame',(0,0,.72),(2.1,.82,.1),'uiDark')
box('canvas mattress',(0,0,.82),(1.9,.74,.16),'canvasTan')
for x in (-.8,.8):
 for y in (-.29,.29):
  box('leg',(x,y,.39),(.08,.08,.65),'sidewalk')
  box('wheel',(x,y,.08),(.20,.10,.16),'uiDark')
for y in (-.38,.38): box('rail',(0,y,1.02),(1.9,.06,.06),'sidewalk')
box('iv base',(.9,.62,.06),(.5,.48,.12),'uiDark')
box('iv upright',(.9,.62,.86),(.055,.055,1.65),'sidewalk')
box('iv hook',(.78,.62,1.66),(.28,.055,.055),'sidewalk')
box('iv bag',(.67,.62,1.47),(.18,.1,.3),'picketWhite')
box('iv mark',(.772,.62,1.48),(.015,.06,.06),'sirenRed')
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
