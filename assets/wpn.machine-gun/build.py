"""Deterministic palette-only LMG; +X muzzle, Z up, metres. Run via blender_run.py."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette, ao, colliders
p=argparse.ArgumentParser()
for key in ('render','glb'):p.add_argument('--'+key)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
M={t:palette.mat(t) for t in ('uiDark','asphalt','sidewalk','woodWarm','grass','schoolBusYellow')}
for t in ('uiDark','asphalt','sidewalk','schoolBusYellow'):
 s=M[t].node_tree.nodes['Principled BSDF'];s.inputs['Metallic'].default_value=.65;s.inputs['Roughness'].default_value=.34
parts={}
def finish(o,t,b=.003,group='static'):
 o.data.materials.append(M[t]);bpy.context.view_layer.objects.active=o
 if b:
  mod=o.modifiers.new('edge bevel','BEVEL');mod.width=b;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 parts.setdefault(group,[]).append(o);return o

def box(n,loc,size,t,b=.003,group='static'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,t,b,group)
def cyl(n,loc,r,d,t,axis='X',N=12,b=0,group='static'):
 rot={'X':(0,math.pi/2,0),'Y':(math.pi/2,0,0),'Z':(0,0,0)}[axis]
 bpy.ops.mesh.primitive_cylinder_add(vertices=N,radius=r,depth=d,location=loc,rotation=rot);o=bpy.context.object;o.name=n;return finish(o,t,b,group)
def profile(n,points,width,t,group='static'):
 N=len(points);v=[(x,y,z) for y in (-width/2,width/2) for x,z in points];f=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,t,.004,group)
def rod(n,start,end,r,t,group='static'):
 d=Vector(end)-Vector(start);o=cyl(n,(Vector(start)+Vector(end))/2,r,d.length,t,'Z',10,0,group);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
# Overall 1.46 m silhouette, low tip of angled grip at ground contact.
profile('wood stock',[(-.72,.055),(-.72,.265),(-.40,.28),(-.36,.24),(-.36,.16),(-.49,.14),(-.65,.065)],.085,'woodWarm')
box('butt plate',(-.715,0,.16),(.028,.098,.23),'asphalt',.008)
box('stock connector',(-.32,0,.235),(.19,.08,.09),'asphalt')
for x in (-.49,-.385):box('stock bands',(x,0,.215),(.019,.097,.132),'asphalt')
box('receiver',(-.11,0,.238),(.29,.114,.145),'uiDark',.008)
box('top cover',(-.105,0,.317),(.31,.13,.022),'asphalt')
box('side receiver panel',(-.17,-.063,.245),(.13,.013,.091),'asphalt')
box('lower latch',(-.14,-.075,.181),(.057,.018,.035),'asphalt')
profile('pistol grip',[(-.31,.19),(-.21,.187),(-.245,.14),(-.28,.006),(-.355,.025),(-.305,.135)],.06,'woodWarm')
# Grip checkering: raised, spaced, readable at game scale.
for side in (-1,1):
 o=box('grip inset',(-.304,side*.034,.082),(.029,.009,.093),'asphalt',.004);o.rotation_euler.y=.29
 for i in range(5):
  o=box('grip rib',(-.315+i*.004,side*.041,.044+i*.014),(.028,.006,.004),'woodWarm',.001);o.rotation_euler.y=.29
for st,en in [((-.235,0,.185),(-.22,0,.105)),((-.22,0,.105),(-.125,0,.105)),((-.125,0,.105),(-.10,0,.17))]:rod('trigger guard',st,en,.008,'asphalt')
rod('trigger blade',(-.155,0,.168),(-.171,0,.127),.005,'uiDark','trigger')
# Magazine walls, proud perimeter frame and corner fasteners.
box('ammunition box',(.06,-.065,.117),(.19,.167,.205),'grass',.008,'magazine')
box('magazine lid',(.06,-.065,.225),(.206,.18,.022),'grass',.004,'magazine')
for y in (-.154,.024):
 box('magazine inset',(.06,y,.112),(.154,.012,.162),'grass',.005,'magazine')
 for x in (-.023,.143):box('magazine frame',(x,y,.112),(.009,.018,.18),'grass',.001,'magazine')
 for z in (.025,.199):box('magazine frame',(.06,y,z),(.17,.018,.008),'grass',.001,'magazine')
 for x in (-.005,.125):
  for z in (.046,.181):cyl('magazine screw',(x,y-.01 if y<0 else y+.01,z),.006,.008,'asphalt','Y',8,0,'magazine')
# Belt: chunky brass rounds point forward above box; dark links.
for i in range(5):
 y=-.049-i*.026;z=.279-i*.009
 cyl('cartridge',(.047,y,z),.009,.075,'schoolBusYellow',N=10)
 cyl('belt link',(.019,y,z),.010,.021,'asphalt',N=10)
 bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=.009,radius2=0,depth=.024,location=(.096,y,z),rotation=(0,math.pi/2,0));finish(bpy.context.object,'schoolBusYellow',0)
# Perforated metal shroud: true boolean holes through both sides.
shroud=cyl('vent shroud',(.275,0,.278),.054,.32,'asphalt',N=16)
for row,z in enumerate((.257,.297)):
 for i in range(6):
  x=.139+i*.052+(row*.008)
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.013 if row else .010,depth=.18,location=(x,0,z),rotation=(math.pi/2,0,0));cut=bpy.context.object
  bpy.context.view_layer.objects.active=shroud;mod=shroud.modifiers.new('cooling port','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
for i in range(5):
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.009,depth=.14,location=(.163+i*.055,0,.278));cut=bpy.context.object
 bpy.context.view_layer.objects.active=shroud;mod=shroud.modifiers.new('top cooling port','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
cyl('internal barrel',(.39,0,.274),.021,.62,'uiDark')
for x in (.11,.446):cyl('shroud end collar',(x,0,.276),.060,.025,'asphalt',N=16)
box('forearm',(.283,0,.201),(.29,.076,.047),'grass',.007)
for x in (.16,.365):box('forearm straps',(x,0,.203),(.018,.091,.06),'asphalt')
box('muzzle brake',(.714,0,.275),(.066,.089,.115),'asphalt',.008)
# Black inset ports separated by 3mm; no coplanar overlays.
for z in (.242,.275,.308):cyl('muzzle side port',(.715,-.049,z),.009,.01,'uiDark','Y',10,0)
cyl('muzzle bore',(.751,0,.275),.015,.008,'uiDark',N=12,b=0)
# Front support has its pivot at barrel mount.
box('support bracket',(.45,0,.222),(.033,.074,.081),'asphalt',.004)
rod('support shaft',(.45,0,.198),(.45,0,.044),.011,'woodWarm','support')
cyl('support sleeve',(.45,0,.15),.014,.059,'asphalt','Z',12,.001,'support')
cyl('support foot',(.45,0,.031),.026,.025,'asphalt','Z',12,.002,'support')
for x,z in [(-.707,.314),(.446,.355)]:
 box('sight foot',(x,0,z-.015),(.031,.033,.015),'asphalt')
 for y in (-.013,.013):box('sight frame',(x,y,z+.006),(.014,.009,.031),'asphalt',.002)
 box('sight bridge',(x,0,z+.024),(.014,.034,.009),'asphalt',.002)
# Raised carry handle with orange segmented wrapping.
for st,en in [((-.25,0,.33),(-.26,0,.393)),((-.26,0,.393),(-.10,0,.401)),((-.10,0,.401),(-.04,0,.343)),((-.04,0,.343),(.012,0,.343))]:rod('handle',st,en,.009,'asphalt')
for i in range(7):cyl('handle wrap',(-.248+i*.023,0,.398),.017,.018,'woodWarm',N=12)
# Raised bolts and short woodgrain strokes, no texture or brands.
for x,z in [(-.485,.168),(-.385,.258),(-.24,.273),(-.24,.218),(-.12,.193),(.16,.202),(.367,.2),(.449,.223)]:
 for y in (-.066,.066):cyl('fastener',(x,y,z),.005,.009,'sidewalk','Y',8,0)
for i in range(4):rod('stock grain',(-.66+i*.023,-.048,.12+i*.03),(-.53+i*.023,-.048,.16+i*.025),.0015,'woodWarm')
# Join static geometry by material; preserve joint pivots of moving pieces.
ground=min((o.matrix_world @ Vector(v)).z for obs in parts.values() for o in obs for v in o.bound_box)
for obs in parts.values():
 for o in obs:o.location.z-=ground
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
for group,objects in parts.items():
 parent=root
 if group!='static':
  parent=bpy.data.objects.new(group,None);bpy.context.collection.objects.link(parent);parent.location={'magazine':(.02,0,.228),'trigger':(-.155,0,.168),'support':(.45,0,.198)}[group];parent.location.z-=ground;parent.parent=root
 batches={token:[o for o in objects if o.data.materials[0]==M[token]] for token in M}
 for token,batch in batches.items():
  if not batch:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in batch:o.select_set(True)
  bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();o=bpy.context.object;o.name=('body' if group=='static' and token=='uiDark' else group+'_'+token)
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
for n,loc in [('grip',(-.285,0,.12)),('muzzle',(.759,0,.275))]:
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.location.z-=ground;o.parent=root
root['ss_physics']={'class':'light','mass':8.5,'friction':.6,'restitution':.1,'centerOfMass':[0,.2,0],'pushable':True,'kickable':True,'flammable':False,'explosive':None}
collider=colliders.cuboid('weapon',(1.484,.239,.408),(.014,-.0405,.204),root)
collider['shape']='cuboid'
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:o.data.calc_loop_triangles()
tris=sum(len(o.data.loop_triangles) for o in meshes)
report={'id':'wpn.machine-gun','tier':'Side','triangles':tris,'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(n in bpy.data.objects for n in ('root','body','grip','muzzle')),'within_budget':tris<=6000 and len(meshes)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 ao.bake_all(meshes,samples=32)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
 scene.world=bpy.data.worlds.new('review world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.03,.045,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object
 cam.location={'ref':(.45,-3,1.0),'game':(1.6,-2.3,2.6),'front':(3,0,.5),'side':(0,-3,.6),'rear':(-3,-1,.8)}[a.view];aim(cam,(0,0,.20));cam.data.type='ORTHO';cam.data.ortho_scale=1.76;scene.camera=cam
 for loc,power,size,color in [((-1,-2,3),210,3,(1,.79,.57)),((1,2,2),230,2,(.60,.70,1)),((0,-1,1),35,2,(1,1,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,.2))
 scene.view_settings.view_transform='AgX';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
