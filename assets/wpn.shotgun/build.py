"""Deterministic chunky pump shotgun. +X forward, metres; sliding pump local pivot."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ASSET={'id':'wpn.shotgun','category':'weapon'}
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
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 return m
wood=mat('woodWarm','b0703f');dark=mat('uiDark','25222c',.65);metal=mat('asphalt','5b4f5c',.7);gold=mat('schoolBusYellow','f2b630',.65);red=mat('survivorRed','d9363e',.15);grain=mat('brick','a8483a')
parts=[];pump_parts=[]
def finish(o,name,m,bevel=0,pump=False):
 o.name=name;o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 if bevel:
  mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=2 if bevel>=.006 else 1;bpy.ops.object.modifier_apply(modifier=mod.name)
 (pump_parts if pump else parts).append(o)
 return o
def box(name,loc,size,m,bevel=.004,pump=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;return finish(o,name,m,bevel,pump)
def cyl(name,loc,r,length,m,axis='X',pump=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=length,location=loc);o=bpy.context.object
 o.rotation_euler[1 if axis=='X' else 0]=math.pi/2 if axis!='Z' else 0
 return finish(o,name,m,.0015,pump)
def profile(name,pts,width,m,bevel=.006):
 verts=[(x,y,z) for y in [-width/2,width/2] for x,z in pts];n=len(pts)
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,m,bevel)
def tube(name,x0,x1,z,r,inner,m):
 verts=[(x,radius*math.cos(i*math.tau/20),z+radius*math.sin(i*math.tau/20)) for x,radius in [(x0,r),(x1,r),(x1,inner),(x0,inner)] for i in range(20)]
 faces=[(k*20+i,k*20+(i+1)%20,((k+1)%4)*20+(i+1)%20,((k+1)%4)*20+i) for k in range(4) for i in range(20)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,m)
# Buttstock: deep shoulder pad and swept wrist with distinct pistol grip.
profile('stock',[(-.59,.035),(-.59,.245),(-.38,.265),(-.26,.34),(-.20,.33),(-.15,.24),(-.235,.17),(-.27,.07),(-.32,.065),(-.33,.135)],.075,wood)
profile('recoilPad',[(-.61,.023),(-.61,.25),(-.578,.254),(-.578,.026)],.085,dark)
profile('receiver',[(-.255,.335),(-.18,.375),(.025,.375),(.055,.315),(.055,.22),(-.17,.22),(-.235,.25)],.09,dark)
box('receiverSide',(-.085,-.050,.29),(.19,.012,.08),metal)
box('ejectionRecess',(-.055,.048,.336),(.115,.008,.041),dark)
box('bolt',(-.048,.055,.336),(.084,.006,.025),metal,.002)
# Open barrel wall with deep dark bore; a second magazine tube below.
tube('barrel',-.01,.60,.357,.027,.018,metal)
cyl('boreBack',(.32,0,.357),.018,.008,dark)
cyl('magazine',(.285,0,.287),.023,.58,dark)
tube('muzzleCollar',.55,.61,.357,.032,.018,metal)
cyl('magazineCap',(.572,0,.287),.027,.022,metal)
for x in [.026,.512]:
 box('barrelBand',(x,0,.32),(.033,.071,.118),dark,.004)
 box('bandFace',(x,-.039,.32),(.025,.009,.106),metal,.002)
box('frontSight',(.569,0,.395),(.042,.018,.018),metal)
box('receiverBand',(-.105,0,.303),(.025,.104,.15),metal,.004)
box('rearSight',(-.155,0,.387),(.031,.023,.014),metal)
# Slide: oblong wooden fore-end and sculpted raised side panels.
box('pumpWood',(.245,0,.277),(.29,.094,.083),wood,.012,True)
for y in [-1,1]:
 box('pumpInset',(.245,y*.049,.278),(.236,.006,.034),grain,.011,True)
 box('pumpPanel',(.245,y*.054,.28),(.222,.006,.024),wood,.009,True)
 for x in [.145,.182,.219,.256,.293,.33]:box('pumpGroove',(x,y*.052,.258),(.006,.006,.011),grain,.001,True)
# Trigger guard as continuous angular loop in the side plane.
outer=[(-.17,.223),(.002,.223),(-.005,.152),(-.055,.12),(-.135,.12),(-.176,.157)]
inner=[(-.156,.208),(-.014,.208),(-.02,.16),(-.061,.136),(-.127,.136),(-.16,.165)]
verts=[(x,y,z) for y in [-.021,.021] for ring in [outer,inner] for x,z in ring];faces=[]
for i in range(6):
 j=(i+1)%6
 faces += [(i,j,6+j,6+i),(12+i,18+i,18+j,12+j),(i,12+i,12+j,j),(6+i,6+j,18+j,18+i)]
mesh=bpy.data.meshes.new('guard');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('triggerGuard',mesh);bpy.context.collection.objects.link(o);finish(o,'triggerGuard',dark,.003)
trigger=profile('trigger',[(-.074,.222),(-.064,.216),(-.07,.18),(-.086,.164),(-.096,.167),(-.083,.185)],.015,metal,.002)
# Two reference shells on the visible receiver side, standing clear of receiver.
box('shellRack',(-.157,-.061,.273),(.105,.021,.025),dark)
for x in [-.189,-.137]:
 cyl('shell',(x,-.076,.252),.019,.077,red,'Z')
 for z in [.209,.297]:cyl('brass',(x,-.076,z),.020,.014,gold,'Z')
for x,z in [(-.216,.301),(-.20,.25),(.026,.286),(.026,.352),(-.085,.252)]:
 cyl('screw',(x,-.058,z),.006,.009,metal,'Y')
 box('screwSlot',(x,-.064,z),(.008,.003,.002),dark,.0004)
# Broad wood grain ribbons (actual proud geometry; no texture or coplanar paint).
for side in [-1,1]:
 for pts in [[(-.55,.08),(-.39,.16),(-.35,.173),(-.405,.152)],[(-.54,.208),(-.43,.228),(-.35,.233),(-.44,.218)],[(-.305,.15),(-.278,.232),(-.26,.259),(-.282,.22)]]:
  o=profile('woodGrain',pts,.005,grain,.0005);o.location.y=side*.041
# Join static geometry by material. Pump remains one local-pivot mesh.
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']=ASSET['id']
def join(group,name,pivot=(0,0,0)):
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 s.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.parent=root;return o
parts.remove(trigger)
objects=[join([trigger],'trigger',(-.074,0,.222))]
groups=[(m,[o for o in parts if o.data.materials[0]==m]) for m in [wood,dark,metal,gold,red,grain]]
for m,group in groups:
 if group:objects.append(join(group,'body_'+m.name))
objects.append(join(pump_parts,'pump',(.245,0,.277)))
for name,loc in [('grip',(-.245,0,.225)),('muzzle',(.612,0,.357))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
# Place the shoulder pad on z=0 and centre the full footprint.
minimum=min((o.matrix_world @ v.co).z for o in objects for v in o.data.vertices)
for o in objects+[bpy.data.objects['grip'],bpy.data.objects['muzzle']]:o.location.z-=minimum
# Bake AO into exported corner colours, preserving palette-only materials.
s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.seed=8;s.render.bake.target='VERTEX_COLORS'
for o in objects:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr;bpy.ops.object.bake(type='AO')
triangles=0
for o in objects:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
materials=sorted({m.name for o in objects for m in o.data.materials});draws=sum(len(o.data.materials) for o in objects)
report=dict(id=ASSET['id'],tier='Side',triangles=triangles,draw_calls=draws,materials=materials,nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','grip','muzzle','pump','trigger']),within_budget=triangles<=6000 and draws<=30,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',export_extras=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
if a.render:
 s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.world.color=(.14,.14,.14)
 stage=mat('stage','292630');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));bpy.context.object.data.materials.append(stage)
 target=Vector((0,0,.22))
 def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,col in [((0,-2,3),210,2,(1,.8,.65)),((-1,1,2),180,2,(.6,.7,1)),((1,1,2),230,1.5,(1,.6,.3))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=col;aim(o)
 views={'ref':(.8,-2.5,1.05),'game':(2,-2,3),'side':(0,-3,.35),'front':(3,-.3,.6),'rear':(-3,-.3,.6)}
 bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=1.65;s.camera=cam
 if a.view=='ref':cam.rotation_euler.rotate_axis('Z',-.22)
 s.view_settings.view_transform='AgX';s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100;s.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
 if a.view=='ref':
  cam.location=views['game'];aim(cam);s.cycles.samples=24;s.render.resolution_x=960;s.render.resolution_y=540;s.render.filepath=str(Path(a.render).with_name('game.png' if Path(a.render).name=='hero.png' else Path(a.render).stem+'-game.png').resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
