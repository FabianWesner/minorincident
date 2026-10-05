"""Compact SMG: deterministic metre-scale, +X muzzle, texture-free palette model."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ('render','glb'):p.add_argument('--'+k)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
for token,h in {'uiDark':'25222c','asphalt':'5b4f5c','sidewalk':'b9a4a0','survivorRed':'d9363e'}.items():
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
 bs.inputs['Roughness'].default_value=.4;bs.inputs['Metallic'].default_value=.35 if token!='survivorRed' else .1;M[token]=m

def empty(n,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;return o
root=empty('root');root['asset_id']='wpn.smg'
body=empty('body');body.parent=root
mag=empty('magazine',(.01,0,.235));mag.parent=root
trigger=empty('trigger',(-.072,0,.253));trigger.parent=root
empty('grip',(-.16,0,.12)).parent=root
empty('muzzle',(.43,0,.328)).parent=root

def finish(o,n,mat,parent=body,bevel=.003):
 o.name=n;o.data.materials.append(M[mat]);bpy.context.view_layer.objects.active=o
 if bevel:
  mod=o.modifiers.new('edge bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
 return o

def box(n,loc,size,mat='asphalt',parent=body,bevel=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,n,mat,parent,min(bevel,min(size)*.3))

def profile(n,points,width,mat='asphalt',parent=body,bevel=.003,y=0):
 k=len(points);v=[(x,y+s*width/2,z) for s in (-1,1) for x,z in points]
 f=[tuple(range(k-1,-1,-1)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o);return finish(o,n,mat,parent,bevel)

def cyl(n,loc,r,depth,mat='uiDark',axis='Y',vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object
 o.rotation_euler=(0,math.pi/2,0) if axis=='X' else (math.pi/2,0,0)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,mat,bevel=0)

def ring(n,x,ro,ri,length,mat='asphalt'):
 v=[];N=20
 for xx,r in ((x-length/2,ro),(x+length/2,ro),(x-length/2,ri),(x+length/2,ri)):
  v.extend((xx,r*math.cos(i*2*math.pi/N),.328+r*math.sin(i*2*math.pi/N)) for i in range(N))
 f=[]
 for i in range(N):
  j=(i+1)%N
  for aa,bb in ((0,N),(2*N,3*N),(0,2*N),(N,3*N)):f.append((aa+i,aa+j,bb+j,bb+i))
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o);finish(o,n,mat,bevel=0)
# Receiver, forward handguard and red muzzle collar.
box('receiver',(-.035,0,.309),(.355,.082,.111))
box('upper receiver',(-.029,0,.373),(.359,.076,.032))
box('handguard',(.208,0,.313),(.194,.089,.117))
box('front red collar',(.31,0,.318),(.027,.103,.142),'survivorRed',bevel=.006)
ring('barrel socket',.342,.039,.016,.040)
cyl('barrel',(.373,0,.328),.021,.054,axis='X')
ring('hollow muzzle',.410,.030,.015,.071)
ring('muzzle lip',.443,.032,.015,.009,'sidewalk')
for s in (-1,1):
 y=s*.048
 box('handguard lower plate',(.209,y,.281),(.168,.010,.039))
 box('control recess',(.212,y,.326),(.161,.010,.027),'uiDark')
 box('red charging strip',(.209,s*.056,.326),(.128,.008,.011),'survivorRed')
 for x in (.207,.213,.219,.225):box('charging serration',(x,s*.063,.327),(.004,.008,.016),'survivorRed',bevel=.0006)
 for z in (.273,.283):box('handguard groove',(.212,s*.055,z),(.100,.004,.004),'uiDark',bevel=.0005)
 box('receiver inset',(-.025,s*.043,.346),(.223,.006,.013),'uiDark')
 box('ejection port',(.044,s*.042,.373),(.047,.006,.012),'uiDark')
 box('rear raised panel',(-.165,s*.045,.311),(.074,.009,.053))
 box('red selector plate',(-.003,s*.049,.289),(.061,.012,.037),'survivorRed')
 for x,z in ((.266,.283),(.15,.283),(-.09,.279),(-.177,.349),(-.172,.292),(.006,.293),(.305,.365),(.305,.272)):
  cyl('fastener',(x,s*.059,z),.0045,.004,'sidewalk')
# Continuous rail teeth and tall paired aperture sights.
box('top rail',(.014,0,.399),(.377,.039,.009),'uiDark')
for i in range(15):box('rail tooth',(-.16+i*.025,0,.406),(.014,.051,.008),'sidewalk',bevel=.001)
for x in (.252,-.162):
 box('sight base',(x,0,.410),(.052,.064,.018),'uiDark')
 for y in (-.022,.022):
  box('sight upright',(x,y,.444),(.012,.009,.055))
  box('sight top',(x,y,.473),(.035,.009,.009))
  box('sight side',(x-.017,y,.452),(.009,.009,.043))
 box('sight bridge',(x,0,.424),(.039,.044,.010))
# Pistol grip and hollow guard assembled around true open space.
profile('grip core',[(-.145,.260),(-.094,.250),(-.116,.204),(-.168,.046),(-.231,.066),(-.189,.211)],.066,'asphalt')
for s in (-1,1):
 profile('rubber grip',[(-.163,.189),(-.141,.187),(-.182,.071),(-.216,.082)],.009,'uiDark',y=s*.035)
 for i in range(5):
  z=.090+i*.013;x=-.201+(z-.09)*.34
  cyl('grip dimple',(x,s*.042,z),.0018,.003,'asphalt',vertices=8)
box('grip heel',(-.201,0,.056),(.068,.075,.018))
for i in range(3):box('finger ridge',(-.136-i*.009,0,.172-i*.027),(.018,.073,.015),'uiDark')
box('guard floor',(-.065,0,.199),(.090,.032,.011))
box('guard front',(-.018,0,.225),(.011,.032,.052))
box('guard rear',(-.109,0,.225),(.011,.032,.052))
profile('curved trigger',[(-.071,.257),(-.059,.248),(-.050,.230),(-.052,.216),(-.060,.213),(-.059,.231),(-.068,.244)],.011,'uiDark',trigger,.001)
# Curved magazine: extruded curved outline with proud longitudinal ribs.
pts=[(.053,.250),(-.026,.244),(-.006,.149),(.020,.077),(.051,.011),(.145,.045),(.104,.126),(.079,.194)]
profile('curved magazine',pts,.057,'asphalt',mag,.004)
box('magazine well',(.016,0,.236),(.113,.080,.025))
profile('magazine base',[(.046,.018),(.143,.054),(.151,.039),(.049,0)],.065,'sidewalk',mag,.001)
for s in (-1,1):
 for offset in (0,.037):
  profile('magazine rib',[(.004+offset,.226),(.012+offset,.226),(.034+offset,.140),(.076+offset,.031),(.066+offset,.028),(.025+offset,.138)],.006,'uiDark',mag,.001,y=s*.032)
# Open skeletal stock: two telescoping bars and diagonal strut, butt pad.
box('stock hinge',(-.239,0,.315),(.044,.069,.071))
for y in (-.023,.023):box('stock extension',(-.292,y,.330),(.119,.014,.017),'sidewalk')
profile('stock diagonal',[(-.252,.286),(-.270,.286),(-.353,.187),(-.368,.176),(-.370,.153)],.029)
box('stock butt',(-.371,0,.255),(.025,.068,.174),bevel=.005)
box('butt rubber',(-.388,0,.255),(.014,.073,.165),'uiDark')
for z in (.181,.329):
 for s in (-1,1):cyl('stock bolt',(-.373,s*.038,z),.004,.004,'sidewalk')
# Join by material within each movable assembly.
for parent in (body,mag,trigger):
 for mat in M.values():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=parent.name+'_'+mat.name
asset=list(bpy.context.scene.objects);meshes=[o for o in asset if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=12;scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
 attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr;o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'wpn.smg','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','grip','muzzle','magazine','trigger')),'within_budget':tri<=6000 and len(meshes)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Canonical palette differs slightly from reference metal colours.','Sight apertures are rectangular; reference wear scratches omitted.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in asset:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
 world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.21,.29,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));m=bpy.data.materials.new('stage');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.024,.035,1);bpy.context.object.data.materials.append(m)
 for loc,power,size,color in [((1,-2,3),180,2,(1,.83,.67)),((-1,1,2),160,2,(.65,.75,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,.24))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((.025,0,.24))
 cam.location={'ref':(.85,2.5,1.0),'game':(1.6,-1.6,2.1),'front':(2,0,.3),'side':(0,-2,.3),'rear':(-1.5,-2,1)}[a.view];cam.data.type='ORTHO';cam.data.ortho_scale=1.05 if a.view!='game' else 1.18;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=True
 scene.cycles.device='GPU';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')
