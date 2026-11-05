"""Sunset Grove wooden bolt-action rifle. +X muzzle; metre units.
Solid bevelled stock, hollow muzzle/scope rims, raised checkering, separate bolt.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for flag in ['render','glb']: p.add_argument('--'+flag)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
for token,h in [('woodWarm','b0703f'),('uiDark','25222c'),('sidewalk','b9a4a0'),('backpackTeal','2f6e6a')]:
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.42 if token!='woodWarm' else .63;n.inputs['Metallic'].default_value=.45 if token in ['uiDark','sidewalk'] else 0;materials[token]=m
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='wpn.hunting-rifle'
def finish(o,name,mat,bevel=0):
 o.name=name;o.data.materials.append(materials[mat])
 if bevel:
  bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 o.parent=root
 return o

def mesh(name,verts,faces,mat,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,mat,bevel)
def box(name,loc,size,mat='uiDark',bevel=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,bevel)
def lathe(name,profile,z,mat='uiDark',y=0,n=16):
 vs=[];rings=[]
 for x,r in profile:
  ring=[]
  for i in range(n if r else 1):
   ring.append(len(vs));vs.append((x,y+r*math.cos(i*math.tau/n),z+r*math.sin(i*math.tau/n)))
  rings.append(ring)
 fs=[]
 for left,right in zip(rings,rings[1:]):
  for i in range(n):
   j=(i+1)%n
   if len(left)==1:fs.append((left[0],right[j],right[i]))
   elif len(right)==1:fs.append((left[i],left[j],right[0]))
   else:fs.append((left[i],left[j],right[j],right[i]))
 return mesh(name,vs,fs,mat)

def tube(name,points,r,mat='uiDark'):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for v,pt in zip(s.points,points):v.co=(*pt,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,mat)
# Side silhouette has a scooped wrist, lowered pistol grip and tapered fore-end.
outline=[(-.63,.018),(-.63,.174),(-.60,.185),(-.39,.176),(-.35,.147),(-.31,.139),(-.26,.157),(-.20,.176),(.29,.158),(.31,.139),(.30,.085),(-.19,.083),(-.23,.065),(-.27,.006),(-.31,0),(-.35,.048),(-.40,.061),(-.59,.006)]
n=len(outline);vs=[(x,y,z) for y in [-.033,.033] for x,z in outline];fs=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh('carved walnut stock',vs,fs,'woodWarm',.009)
box('rubber recoil pad',(-.636,0,.096),(.024,.079,.186),'uiDark',.008)
lathe('barrel',[(.04,.023),(.30,.023),(.36,.020),(.65,.017),(.66,.017),(.66,.010),(.63,.010)],.174)
lathe('muzzle crown',[(.64,.018),(.662,.018),(.665,.015),(.665,.011),(.645,.011)],.174,'sidewalk')
lathe('bore dark',[(.626,0),(.626,.010)],.174)
lathe('receiver', [(-.22,.027),(-.20,.031),(.035,.031),(.05,.026)],.179)
box('receiver top rail',(-.07,0,.207),(.28,.045,.012))
box('ejection port',(-.09,-.029,.185),(.075,.008,.022),'sidewalk',.002)
# Scope body with bell flares and recessed teal lenses at both ends.
lathe('scope', [(-.27,.028),(-.25,.030),(-.21,.029),(-.18,.020),(.065,.020),(.11,.036),(.15,.036),(.16,.032),(.16,.026),(.143,.026)],.281)
for x,r in [(-.268,.025),(.151,.026)]:lathe('scope recessed lens',[(x,0),(x,r)],.281,'backpackTeal')
for x in [-.17,.035]:
 box('scope mount foot',(x,0,.218),(.040,.055,.016))
 box('scope mount riser',(x,0,.236),(.025,.030,.037))
 lathe('scope ring',[(x-.010,.022),(x-.010,.026),(x+.010,.026),(x+.010,.022)],.281)
 for s in [-1,1]:box('ring clamp screw',(x,s*.029,.283),(.010,.007,.012),'sidewalk',.002)
box('turret saddle',(-.066,0,.293),(.042,.050,.039))
# Scope adjustment cylinders rotate onto vertical / side axes.
for name,loc,rot in [('elevation',(-.066,0,.320),(0,0,0)),('windage',(-.066,-.036,.290),(math.pi/2,0,0))]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.018,depth=.018,location=loc,rotation=rot);finish(bpy.context.object,name,'uiDark',.002)
# Bolt has joint origin, preserved separately for cycling animation.
bolt=tube('bolt', [(-.195,-.020,.195),(-.203,-.048,.177),(-.205,-.055,.143)],.008)
bolt.name='bolt';bpy.context.scene.cursor.location=(-.195,-.020,.195);bpy.context.view_layer.objects.active=bolt;bolt.select_set(True);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bolt.select_set(False)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.016,location=(-.205,-.055,.139));knob=finish(bpy.context.object,'bolt knob','uiDark');knob.parent=bolt;knob.matrix_parent_inverse=bolt.matrix_world.inverted()
tube('trigger guard',[(-.225,0,.087),(-.211,0,.048),(-.193,0,.038),(-.136,0,.038),(-.117,0,.048),(-.110,0,.083)],.007)
tube('curved trigger',[(-.170,0,.087),(-.177,0,.060),(-.167,0,.050)],.004,'sidewalk')
# Raised grip crosshatching, comfortably above the wooden side plane.
for s in [-1,1]:
 tube('grip panel rim',[(-.267,s*.039,.135),(-.233,s*.039,.112),(-.293,s*.039,.029),(-.323,s*.039,.052),(-.267,s*.039,.135)],.003)
 for i in range(7):
  z=.051+i*.010;x=-.302+i*.005
  tube('checkering',[(x-.009,s*.039,z),(x+.018,s*.039,z+.020)],.0015)
  tube('checkering',[(x-.014,s*.040,z+.019),(x+.014,s*.040,z)],.0015)
 # Fore-end inset outline and restrained wood grain relief.
 tube('fore-end border',[(.05,s*.037,.109),(.20,s*.037,.112),(.22,s*.037,.130),(.20,s*.037,.142),(.05,s*.037,.140),(.04,s*.037,.125),(.05,s*.037,.109)],.002)
 for j in range(3):tube('wood grain',[(-.59,s*.037,.05+j*.035),(-.49,s*.038,.066+j*.029),(-.43,s*.038,.070+j*.024)],.0012,'woodWarm')
for x,z in [(.21,.080),(-.55,.019)]:
 box('sling swivel base',(x,0,z),(.025,.022,.013))
 tube('sling swivel',[(x-.008,0,z-.006),(x-.008,0,z-.023),(x+.008,0,z-.023),(x+.008,0,z-.006)],.003)
box('front sight base',(.61,0,.194),(.039,.023,.012))
box('front sight blade',(.614,0,.208),(.012,.009,.020), 'uiDark',.002)
# Layered hardware in round 2; rings have real thickness, not coplanar decals.
lathe('fore-end barrel band',[(.285,.024),(.285,.028),(.309,.028),(.309,.024)],.174)
for x,r in [(-.27,.030),(.157,.034)]:
 lathe('scope rim',[(x-.002,r),(x+.002,r),(x+.002,r-.003),(x-.002,r-.003)],.281,'sidewalk')
for s in [-1,1]:
 for z in [.053,.142]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.004,depth=.008,location=(-.634,s*.039,z),rotation=(math.pi/2,0,0));finish(bpy.context.object,'butt pad fastener','sidewalk')
# Ground contact includes the rear sling loop.
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.parent==root:o.location.z+=.007
# Join static meshes once per palette. Keep only the bolt articulation separate.
for token,material in materials.items():
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==root and o!=bolt and o.data.materials[0]==material]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='body_'+token
for name,loc in [('grip',(-.28,0,.086)),('muzzle',(.666,0,.174))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=root;o.location=Vector(loc)+Vector((0,0,.007))
bpy.context.scene.unit_settings.system='METRIC'
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Deterministic texture-free AO, baked into vertex colors for runtime shading.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.seed=17;scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
 attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
 o.data.color_attributes.active_color=attr;o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO')
tris=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='wpn.hunting-rifle',tier='Side',triangles=tris,draw_calls=len(meshes),materials=[m.name for m in materials.values()],nodes_ok=True,within_budget=tris<=6000 and len(meshes)<=30,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(P/'metrics.json').write_text(json.dumps(report,indent=2))
bpy.ops.object.select_all(action='SELECT')
if a.glb:bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.world.color=(.22,.22,.22)
 def light(loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.15))-o.location).to_track_quat('-Z','Y').to_euler()
 light((.5,-1.4,2.5),180,(1,.78,.55),2);light((-.5,1,1.5),130,(.6,.68,1),2)
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,.163));cam.location=target+Vector((.75,-2.9,1.7) if a.view=='game' else (.35,-3,.95));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.55;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
