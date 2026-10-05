"""Two reference-derived municipal bins; metres, +X front, Z-up.
Static geometry batches by material. Lid, recycling hood and wheels retain pivots.
All markings are solid raised geometry, with no image textures.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
H=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for flag in ('render','glb'):p.add_argument('--'+flag)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
M={}
def mat(t,h):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new('pal_'+t);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.48;m.diffuse_color=(*c,1);M[t]=m
for t,h in [('backpackTeal','42675a'),('grass','657653'),('policeBlue','454ab5'),('uiDark','292633'),('sidewalk','a07183'),('picketWhite','f2e6dc')]:mat(t,h)
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
 if parent:o.parent=parent
 bpy.context.view_layer.update();return o
root=empty('root');root['asset_id']='prop.trash-bin'
green=empty('trashBin',parent=root);blue=empty('recyclingBin',parent=root)
for o,mass in [(green,14),(blue,24)]:o['ss_physics']={'class':'light','mass':mass,'friction':.65,'restitution':.08,'pushable':True,'kickable':True,'flammable':True}
def finish(o,name,t,group,bevel=.015):
 o.name=name;o.data.materials.append(M[t]);
 if name=='rounded blue hood':
  for face in o.data.polygons:face.use_smooth=True
 bpy.context.view_layer.objects.active=o
 if bevel:
  mod=o.modifiers.new('molded edge','BEVEL');mod.width=bevel;mod.segments=1 if any(k in name for k in ('wheel','axle','tire','pivot','arch rim','dark inset')) else 2;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.parent=group;o.matrix_parent_inverse=group.matrix_world.inverted();return o
def box(name,loc,size,t,group,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,t,group,min(bevel,min(size)*.4))
def mesh(name,vs,fs,t,group,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,t,group,bevel)
def cylinder(name,loc,r,depth,t,group,axis='y',vertices=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0) if axis=='y' else (0,math.pi/2,0) if axis=='x' else (0,0,0));return finish(bpy.context.object,name,t,group,.007)
def plate(name,pts,x,depth,t,group):
 n=len(pts);vs=[(xx,y,z) for xx in [x,x+depth] for y,z in pts];fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,vs,fs,t,group,.003)
# Green tapered molded shell and structural inset frames.
y=-.57
vs=[(x,y+dy,z) for z,w,d in [(.055,.255,.25),(1.02,.30,.29)] for x,dy in [(-d,-w),(d,-w),(d,w),(-d,w)]]
mesh('tapered green shell',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'backpackTeal',green,.028)
for zz,h,w in [(.40,.68,.38),(.865,.24,.40)]:
 box('front recessed field',(.287,y,zz),(.018,w,h),'grass',green,.02)
 for s in [-1,1]:box('front molding upright',(.318,y+s*(w/2+.025),zz),(.072,.063,h+.075),'grass',green,.021)
 for z in [zz-h/2-.02,zz+h/2+.02]:box('front molding cross rib',(.315,y,z),(.066,w-.014,.062),'grass',green,.016)
box('belt rib',(0,y,.69),(.60,.62,.062),'backpackTeal',green,.019)
box('upper rim',(0,y,1.035),(.67,.69,.085),'backpackTeal',green,.024)
lid=empty('lid',(-.295,y,1.081),green);lid['hinge_axis']='Y';lid['open_angle']=105
box('lid slab',(0,y,1.092),(.67,.68,.060),'grass',lid,.022)
box('lid inset panel',(0,y,1.130),(.48,.48,.030),'backpackTeal',lid,.017)
for s in [-1,1]:
 box('lid raised border',(0,y+s*.275,1.139),(.56,.045,.048),'grass',lid,.011)
 box('lid rear hinge',(-.30,y+s*.22,1.136),(.10,.105,.07),'grass',lid,.013)
box('lid front lifting lip',(.297,y,1.148),(.075,.22,.048),'grass',lid,.012)
cylinder('rear axle',(-.235,y,.135),.025,.66,'uiDark',green)
for s,label in [(-1,'L'),(1,'R')]:
 pos=(-.235,y+s*.305,.135);wheel=empty('wheel'+label,pos,green);wheel['rotation_axis']='Y'
 cylinder('rubber tire',pos,.135,.092,'uiDark',wheel,vertices=40)
 cylinder('wheel rim',(-.235,y+s*.354,.135),.088,.018,'sidewalk',wheel)
 cylinder('dark inset',(-.235,y+s*.367,.135),.066,.015,'uiDark',wheel)
 cylinder('axle cap',(-.235,y+s*.385,.135),.030,.027,'sidewalk',wheel)
 for i in range(6):
  t=i*math.tau/6;o=box('chunky wheel spoke',(-.235+.047*math.sin(t),y+s*.378,.135+.047*math.cos(t)),(.021,.014,.065),'sidewalk',wheel,.005);o.rotation_euler.y=t
# Side sorting label stands clear of the tapered shell.
box('sorting label',(0,y-.292,.87),(.095,.015,.115),'sidewalk',green,.004)
for x in [-.013,.014]:box('label bars',(x,y-.305,.877),(.008,.006,.085),'grass',green,.001)
# Blue domed recycling enclosure. Flat body with broad raised corner rails.
y=.49
box('blue container',(0,y,.46),(.53,.56,.87),'policeBlue',blue,.028)
for x in [-.28,.28]:
 for s in [-1,1]:box('blue corner rail',(x,y+s*.29,.49),(.065,.067,.98),'policeBlue',blue,.018)
for z in [.085,.89]:box('blue front frame crossbar',(.292,y,z),(.066,.61,.057),'policeBlue',blue,.015)
hood=empty('recyclingHood',(-.275,y,.9),blue);hood['hinge_axis']='Y';hood['open_angle']=90
# Barrel roof across depth, arched in the side XZ plane and running along Y.
n=32;radius=.285;base=.9
profile=[(radius*math.cos(math.pi-i*math.pi/n),base+radius*math.sin(math.pi-i*math.pi/n)) for i in range(n+1)]
vs=[(x,yy,z) for yy in [y-.28,y+.28] for x,z in profile];k=len(profile)
mesh('rounded blue hood',vs,[tuple(range(k-1,-1,-1)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)],'policeBlue',hood,.008)
# Raised arc ribs follow the hood, with a visible 12 mm offset.
for yy in [y-.295,y+.295]:
 vs=[(r*math.cos(math.pi-i*math.pi/n),yyy,base+r*math.sin(math.pi-i*math.pi/n)) for yyy in [yy-.022,yy+.022] for r in [.282,.318] for i in range(n+1)]
 idx=lambda j,r,i:(j*2+r)*(n+1)+i
 fs=[]
 for i in range(n):
  for j in [0,1]:fs.append((idx(j,0,i),idx(j,0,i+1),idx(j,1,i+1),idx(j,1,i)))
  for r in [0,1]:fs.append((idx(0,r,i),idx(1,r,i),idx(1,r,i+1),idx(0,r,i+1)))
 for i in [0,n]:fs.append((idx(0,0,i),idx(0,1,i),idx(1,1,i),idx(1,0,i)))
 mesh('hood arch rim',vs,fs,'policeBlue',hood,.004)
 for x in [-.298,.298]:cylinder('hood pivot cap',(x,yy,.91),.019,.016,'policeBlue',hood)
# Three broad bent arrows: embossed recycling emblem, readable at game scale.
arrow=[(-.055,.13),(.045,.13),(.085,.065),(.12,.087),(.093,-.003),(.003,.011),(.035,.033),(.007,.080),(-.055,.080)]
for i in range(3):
 t=i*math.tau/3;pts=[(y+1.22*(u*math.cos(t)-v*math.sin(t)),.53+1.22*(u*math.sin(t)+v*math.cos(t))) for u,v in arrow]
 plate('recycle arrow',pts,.273,.012,'picketWhite',blue)
# Batch each fixed/moving material group, retaining joint origins.
for group in [green,blue,lid,hood]+[o for o in bpy.data.objects if o.name in ['wheelL','wheelR']]:
 for m in M.values():
  obs=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==m]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=('body' if group==green and m==M['backpackTeal'] else group.name+'_'+m.name)
for group,yy,size in [(green,-.57,(.66,.69,1.17)),(blue,.49,(.64,.66,1.22))]:
 col=empty('col:'+group.name,(0,yy,size[2]/2),group);col['collider']='cuboid';col['shape']='cuboid';col['size']=size
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.calc_loop_triangles()
 # Deterministic Cycles AO in corner colors, texture-free.
 ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=ao
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO',target='VERTEX_COLORS')
for o in meshes:
 for color in o.data.color_attributes['ao'].data:color.color=tuple(max(.35,c) for c in color.color[:3])+(1,)
tri=sum(len(o.data.loop_triangles) for o in meshes);draw=sum(len(o.data.materials) for o in meshes)
stats={'id':'prop.trash-bin','tier':'Side','triangles':tri,'draw_calls':draw,'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','body','lid','recyclingHood','wheelL','wheelR']),'within_budget':6000<=tri<=12000 and draw<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(H/'build-stats.json').write_text(json.dumps(stats,indent=2)+'\n');print('BUILD OK',tri,draw)
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if a.render:
 stage=bpy.data.materials.new('studio');stage.use_nodes=True;stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.045,.038,.052,1);stage.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.009));bpy.context.object.data.materials.append(stage)
 scene.world=bpy.data.worlds.new('studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.10,.085,.12,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
 for loc,power,color,size in [((3,-4,6),450,(1,.81,.59),4),((-3,2,4),320,(.58,.66,1),4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,-.04,.59));views={'ref':(6,-4,3.5),'game':(5,-5,7),'front':(6,0,.9),'side':(0,-6,.9),'rear':(-5,4,3)};cam.location=target+Vector(views[a.view]);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.6 if a.view!='game' else 3.7;scene.camera=cam
 scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
 if a.view=='ref':
  cam.location=target+Vector(views['game']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.7
  scene.render.resolution_x=960;scene.render.resolution_y=540;scene.cycles.samples=24
  output=Path(a.render);scene.render.filepath=str(output.with_name(output.stem.replace('-ref','-game')+'.png').resolve()) if '-ref' in output.stem else str((H/'renders/game.png').resolve());bpy.ops.render.render(write_still=True)
 print('RENDER OK')
