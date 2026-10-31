import bpy, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=ROOT/'docs/reports/slim/pilot/blender'
OUT.mkdir(parents=True,exist_ok=True)
FIGS={
 'man-a':(ROOT/'docs/reports/slim/pilot/input/npc.civilian-man-a.model.q249.skin.glb',ROOT/'public/assets/models/slim-pilot/npc.civilian-man-a.npc.civilian-man-a.lod0.glb'),
 'woman-a':(ROOT/'docs/reports/slim/pilot/input/npc.civilian-woman-a.model.skin.glb',ROOT/'public/assets/models/slim-pilot/npc.civilian-woman-a.npc.civilian-woman-a.lod0.glb'),
}
HERO=ROOT/'public/assets/models/char.courier-female.skin.glb'
def render(figure,state,view):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 def import_root(path):
  before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(path));new=set(bpy.context.scene.objects)-before
  roots=[o for o in new if o.parent not in new]
  return next((o for o in roots if o.type in {'EMPTY','ARMATURE'}),roots[0])
 hero=import_root(HERO);ped=import_root(FIGS[figure][0 if state=='before' else 1])
 def bounds(root):
  pts=[root.matrix_world@Vector(corner) for ob in [root,*root.children_recursive] if ob.type=='MESH' for corner in ob.bound_box]
  return (min(p.z for p in pts),max(p.z for p in pts)) if pts else (0,1.7)
 for root in (hero,ped):
  lo,hi=bounds(root);root.location.z-=lo
 angle={'front':0,'three-quarter':math.pi/4,'side':math.pi/2}[view]
 forward=Vector((math.cos(angle),math.sin(angle),0));right=Vector((-forward.y,forward.x,0))
 hero.location += right*-.48;ped.location += right*.48
 bpy.context.scene.render.engine='BLENDER_EEVEE_NEXT';bpy.context.scene.eevee.taa_render_samples=32
 bpy.context.scene.render.resolution_x=900;bpy.context.scene.render.resolution_y=900;bpy.context.scene.render.resolution_percentage=100
 bpy.context.scene.render.image_settings.file_format='PNG';bpy.context.scene.render.film_transparent=False
 bpy.context.scene.world.color=(.34,.35,.38)
 floor_mat=bpy.data.materials.new('studio floor');floor_mat.diffuse_color=(.65,.66,.68,1)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));floor=bpy.context.object;floor.data.materials.append(floor_mat)
 def area(name,loc,power,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 area('key',(3,-4,6),900,4);area('fill',(-4,-1,3),500,5)
 bpy.ops.object.camera_add(location=forward*6+Vector((0,0,1.25)));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.0))-cam.location).to_track_quat('-Z','Z').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.65;bpy.context.scene.camera=cam
 bpy.context.scene.render.image_settings.color_mode='RGBA';bpy.context.scene.view_settings.view_transform='AgX'
 path=OUT/f'{figure}-{state}-{view}.png';bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);print(path)
for figure in FIGS:
 for state in ('before','after'):
  for view in ('front','three-quarter','side'):render(figure,state,view)
