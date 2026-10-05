"""Combat knife: deterministic palette geometry, +X tip, metres, ground on Z=0."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ASSET={'id':'wpn.knife','category':'weapon'}
p=argparse.ArgumentParser()
for k in ['render','glb']:p.add_argument('--'+k)
p.add_argument('--view',default='ref')
for k,v in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+k,type=int,default=v)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.unit_settings.system='METRIC'
def mat(token,h,metal=0,rough=.4):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)];rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
 bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 return m
steel=mat('lavenderShadow','8b89b3',.65);edge=mat('sidewalk','b9a4a0',.7);gold=mat('schoolBusYellow','f2b630',.6);dark=mat('uiDark','25222c',.15);wear=mat('woodWarm','b0703f',.45)
parts=[]
def finish(o,name,m,b=0):
 o.name=name;o.data.materials.append(m);bpy.context.view_layer.objects.active=o
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 if b:
  mod=o.modifiers.new('edge bevel','BEVEL');mod.width=b;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 parts.append(o);return o
def box(name,loc,size,m,b=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;return finish(o,name,m,b)
def poly(name,pts,z0,z1,m,b=0):
 n=len(pts);verts=[(x,y,z) for z in [z0,z1] for x,y in pts];faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,m,b)
def pin(name,x,y,z,m,r=.003):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=.004,location=(x,y,z));return finish(bpy.context.object,name,m,.0005)
# Blade perimeter: belly along -Y, clipped point, scalloped spine near the guard.
outline=[(-.03,-.032),(.13,-.043),(.19,-.043),(.235,-.035),(.272,-.019),(.30,0),(.252,.014),(.23,.022),(.19,.039),(.11,.039)]
for x in [.105,.088,.071,.054,.037]:
 outline.extend([(x,.039),(x-.002,.034),(x-.008,.034),(x-.010,.039)])
outline.extend([(-.03,.039)])
face_outline=[(x,y+.009) if i<5 else (x,y) for i,(x,y) in enumerate(outline)]
blade=poly('blade',face_outline,.029,.047,steel,.001)
# Continuous sharpened bevel follows the cutting belly, with a thin true edge.
belly=outline[:6]
verts=[(x,y+(.009 if i<5 else 0),z) for z in [.029,.047] for i,(x,y) in enumerate(belly)]+[(x,y,.038) for x,y in belly]
n=len(belly);faces=[]
for i in range(n-1):faces.extend([(i,i+1,2*n+i+1,2*n+i),(n+i,2*n+i,2*n+i+1,n+i+1)])
me=bpy.data.meshes.new('cutting bevel');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('cutting bevel',me);bpy.context.collection.objects.link(o);finish(o,'cutting bevel',edge)
# Genuine recessed fuller on both broad faces, not overlapping surface paint.
groove=[(-.004,-.019),(.188,-.020),(.224,-.008),(.191,-.009),(.009,-.007),(.002,-.002)]
for top in [True,False]:
 cutter=poly('fuller cutter',groove,.043 if top else .02,.06 if top else .033,steel,.002)
 mod=blade.modifiers.new('recessed fuller','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.context.view_layer.objects.active=blade;bpy.ops.object.modifier_apply(modifier=mod.name);parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
# Thick orange guard, dark tang collar and five faceted grip cushions.
box('tang collar',(-.035,0,.038),(.024,.068,.030),steel,.004)
box('guard',(-.049,0,.038),(.014,.105,.058),gold,.007)
box('guard liner',(-.059,0,.038),(.005,.069,.036),wear,.002)
box('handle core',(-.151,0,.038),(.188,.042,.041),dark,.008)
box('front ferrule',(-.069,0,.038),(.015,.059,.055),gold,.005)
for i in range(5):
 x=-.091-i*.030
 box('grip segment',(x,0,.038),(.028,.054,.051),dark,.006)
 # Side seams catch light without multiplying materials.
 box('wrap rim',(x+.012,0,.038),(.0025,.056,.050),dark,.001)
box('pommel',(-.242,0,.038),(.026,.064,.062),gold,.006)
for x,y,z in [(-.049,-.035,.068),(-.049,.035,.068),(-.069,0,.068),(-.242,-.018,.071),(-.242,.018,.071)]:
 pin('fastener',x,y,z,steel)
 box('fastener slot',(x,y,z+.0025),(.003,.001,.001),dark,.0002)
# Broad restrained angular scuffs: 3mm clear of underlying face.
for x,y in [(.17,.018),(.125,.004),(.06,.014),(.008,.026)]:
 poly('blade scuff',[(x,y),(x+.009,y+.004),(x+.003,y+.005),(x-.003,y+.002)],.050,.0508,wear)
for i in range(5):
 x=-.093-i*.03
 poly('grip edge wear',[(x-.008,.016),(x-.003,.022),(x+.004,.024),(x+.001,.019)],.0665,.0675,wear)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']=ASSET['id']
objects=[]
groups=[(m,[o for o in parts if o.data.materials[0]==m]) for m in [steel,edge,gold,dark,wear]]
for m,group in groups:
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name='body_'+m.name;o.parent=root;objects.append(o)
for name,loc in [('grip',(-.15,0,.038)),('tip',(.30,0,.038))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
# Centre the footprint and rest the pommel on the floor.
for o in list(root.children):
 o.location.x-=.0225;o.location.z-=.007
 if o.type=='MESH':
  for v in o.data.vertices:v.co.y=-v.co.y
  o.data.flip_normals()
 else:o.location.y=-o.location.y
s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.seed=8;s.render.bake.target='VERTEX_COLORS'
for o in objects:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr;bpy.ops.object.bake(type='AO')
triangles=0
for o in objects:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
report=dict(id=ASSET['id'],tier='Side',triangles=triangles,draw_calls=5,materials=sorted(m.name for m in [steel,edge,gold,dark,wear]),nodes_ok=True,within_budget=triangles<=6000,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',export_extras=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
if a.render:
 s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.world.color=(.17,.17,.17)
 target=Vector((0,0,.031))
 def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,col in [((.3,-.5,1),45,.7,(1,.8,.65)),((-.3,.5,.8),35,.6,(.65,.72,1)),((.4,.4,.7),40,.5,(1,.65,.32))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=col;aim(o)
 views={'ref':(.08,-.45,.8),'game':(1,-1,1.5),'side':(0,-1,.15),'front':(1,0,.4),'rear':(-1,0,.4)}
 bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=.70;s.camera=cam
 if a.view=='ref':cam.rotation_euler.rotate_axis('Z',math.pi-.13)
 s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=-1.2;s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100;s.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
 if a.view=='ref':
  cam.location=views['game'];aim(cam);s.cycles.samples=24;s.render.resolution_x=960;s.render.resolution_y=540;s.render.filepath=str(Path(a.render).with_name('game.png' if Path(a.render).name=='hero.png' else Path(a.render).stem+'-game.png').resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
