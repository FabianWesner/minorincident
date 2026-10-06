"""Reproducible palette geometry. Metres, Z-up, +X front; standalone bpy build."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from sslib import palette, ao
p=argparse.ArgumentParser()
for key in ('glb','render'):p.add_argument('--'+key)
p.add_argument('--view',default='game',choices=['game','ref','rear'])
p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=1200);p.add_argument('--height',type=int,default=700)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={};parts=[]
def mat(token):
 if token not in M:
  M[token]=palette.mat(token);M[token].use_backface_culling=True
  bs=M[token].node_tree.nodes['Principled BSDF'];bs.inputs['Roughness'].default_value=.55
 return M[token]
def empty(name,pos=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos
 if parent:
  bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
 return o
root=empty('root')
parent=root
def finish(o,name,token,bevel=0):
 o.name=name;o.data.materials.append(mat(token));bpy.context.view_layer.objects.active=o
 if bevel:
  m=o.modifiers.new('soft bevel','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
 # Outward normals, including hand-authored closed profiles.
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name)
 bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world;parts.append(o)
 return o
def box(name,pos,size,token,bevel=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,token,min(bevel,min(size)*.3))
def rod(name,start,end,r,token,n=12):
 d=Vector(end)-Vector(start);bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d.length,location=(Vector(start)+Vector(end))/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,token)
def sphere(name,pos,scale,token,n=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=8,location=pos);o=bpy.context.object;o.scale=scale;return finish(o,name,token)
def profile(name,x,depth,points,token,bevel=0):
 # Closed extruded Y/Z polygon, all sides solid.
 k=len(points);vs=[(xx,y,z) for xx in (x-depth/2,x+depth/2) for y,z in points]
 fs=[tuple(range(k-1,-1,-1)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,token,bevel)
def text(name,words,pos,width,height,token):
 bpy.ops.object.text_add(location=pos);o=bpy.context.object;o.data.body=words;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=1;o.data.space_line=.9;o.data.extrude=.0015;o.data.resolution_u=2;o.data.offset=.012
 bpy.ops.object.convert(target='MESH');o=bpy.context.object
 # Fit converted local geometry; Blender text dimensions can lag rotation updates.
 xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
 cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
 scale=min(width/(max(xs)-min(xs)),height/(max(ys)-min(ys)))
 for v in o.data.vertices:v.co.x=(v.co.x-cx)*scale;v.co.y=(v.co.y-cy)*scale;v.co.z*=scale
 o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler()
 return finish(o,name,token)
def ring(name,pos,r,thickness,token):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,major_radius=r,minor_radius=thickness,location=pos,rotation=(0,math.pi/2,0));return finish(bpy.context.object,name,token)
def collider(name,pos,size):
 e=empty('col:'+name,pos,parent);e['collider']='cuboid';e['size']=list(size)
ASSET={'id':'kit.edge-roadwork','category':'prop','tier':'side'}
root['asset_id']=ASSET['id'];root['tier']='side';root['forward']='+X'
# White A-frame, solid boards and raised orange diagonal reflective stripes.
parent=empty('road_closed',parent=root);cy=-3.25
for y in (cy-.66,cy+.66):
 for s in (-1,1):
  leg=box('A-frame leg',(s*.24,y,.67),(.095,.12,1.37),'picketWhite');leg.rotation_euler.y=s*math.radians(-19)
 rod('hinge pin',(-.07,y,1.3),(.07,y,1.3),.06,'silver')
 box('rubber foot',(.40,y,.04),(.19,.19,.08),'uiDark')
for z in (.44,1.12):
 box('reflective board',(.30,cy,z),(.12,1.95,.27),'picketWhite')
 for j in range(5):
  y=cy-.90+j*.40
  # Trapezoid stripes, confined to board height.
  profile('orange reflective stripe',.367,.008,[(y,z-.125),(y+.20,z-.125),(y+.36,z+.125),(y+.16,z+.125)],'orange',.002)
box('road sign border',(.397,cy,.88),(.065,1.12,.93),'uiDark',.035)
box('road sign plate',(.438,cy,.88),(.025,1.07,.88),'picketWhite',.025)
text('ROAD CLOSED lettering','ROAD\nCLOSED',(.457,cy,.94),.91,.61,'uiDark')
text('roadwork subline','ROAD WORK',(.458,cy,.55),.93,.10,'uiDark')
for yy in (cy-.47,cy+.47):
 for z in (.52,1.24):rod('sign fastener',(.451,yy,z),(.466,yy,z),.022,'silver',8)
for yy in (cy-.65,cy+.65):
 box('lamp bracket',(.31,yy,1.35),(.16,.16,.11),'silver')
 rod('amber lamp housing',(.24,yy,1.53),(.34,yy,1.53),.14,'orange',24)
 rod('amber lens',(.345,yy,1.53),(.37,yy,1.53),.11,'windowGlow',24)
 ring('lens rim',(.375,yy,1.53),.116,.012,'schoolBusYellow')
 sphere('lens bright core',(.381,yy,1.53),(.018,.055,.055),'windowGlow')
collider('barricade',(.05,cy,.84),(.95,2.02,1.68))
# Open safety mesh: gently bowed in depth and sagging at the centre.
parent=empty('mesh_fence',parent=root);fy=-.68;fw=2.18
for y in (fy-fw/2,fy+fw/2):
 rod('fence post',(0,y,.06),(0,y,1.63),.043,'orange')
 rod('post cap',(0,y,1.59),(0,y,1.68),.055,'orange')
 box('fence foot',(0,y,.045),(.30,.22,.09),'uiDark')
 for z in (.20,1.5):rod('mesh clamp',(0,y,z-.035),(0,y,z+.035),.063,'orange')
def grid(u,v):return (.09*math.sin(math.pi*u),fy-fw/2+fw*u,.19+v*1.37-.16*math.sin(math.pi*u))
for j in range(9):
 for i in range(12):rod('horizontal mesh web',grid(i/12,j/8),grid((i+1)/12,j/8),.014,'orange',4)
for i in range(13):
 for j in range(8):rod('vertical mesh web',grid(i/12,j/8),grid(i/12,(j+1)/8),.014,'orange',4)
# The fence collider is deliberately coarse; the orange mesh stays visually open.
collider('fence',(0,fy,.83),(.16,2.28,1.66))
# Tracked mini excavator with sturdy tread bands, rollers and articulated silhouette.
parent=empty('excavator',parent=root);ey=2.4
for yy in (ey-.54,ey+.54):
 # Capsule track in X/Z using stretched rounded box and end wheels.
 box('rubber track band',(-.48,yy,.34),(1.48,.39,.57),'uiDark',.20)
 for xx in (-1.18,.22):
  rod('track curved end',(xx,yy-.20,.34),(xx,yy+.20,.34),.275,'uiDark',24)
  rod('end sprocket',(xx,yy-.212,.34),(xx,yy+.212,.34),.185,'silver',16)
  rod('sprocket hub',(xx,yy-.224,.34),(xx,yy+.224,.34),.074,'uiDark',12)
 for xx in (-.93,-.56,-.19):rod('track roller',(xx,yy-.21,.30),(xx,yy+.21,.30),.15,'silver',16)
 # Raised track shoes follow an actual closed capsule path.
 for i in range(30):
  if i<10:xx=-1.18+i*1.40/10;zz=.64;angle=0
  elif i<15:
   t=math.pi/2-(i-10)*math.pi/5;xx=.22+.30*math.cos(t);zz=.34+.30*math.sin(t);angle=t-math.pi/2
  elif i<25:xx=.22-(i-15)*1.40/10;zz=.04;angle=0
  else:
   t=-math.pi/2-(i-25)*math.pi/5;xx=-1.18+.30*math.cos(t);zz=.34+.30*math.sin(t);angle=t-math.pi/2
  shoe=box('track shoe',(xx,yy,zz),(.145,.44,.055),'denim',0);shoe.rotation_euler.y=-angle
box('undercarriage',(-.46,ey,.60),(1.40,.82,.19),'uiDark')
rod('slew bearing',(-.50,ey,.64),(-.50,ey,.78),.37,'silver',24)
box('yellow rotating chassis',(-.46,ey,.85),(1.65,1.22,.28),'schoolBusYellow',.08)
box('rear counterweight',(-1.12,ey,1.15),(.55,1.18,.56),'schoolBusYellow',.09)
box('engine cover',(-1.11,ey,1.47),(.55,1.12,.11),'schoolBusYellow',.035)
for s in (-1,1):
 box('engine vent',(-1.11,ey+s*.601,1.23),(.36,.022,.30),'uiDark',.015)
 for k in range(5):box('vent grille bar',(-1.11,ey+s*.618,1.13+k*.045),(.32,.017,.013),'silver',.003)
# Cab dark solid windows inside yellow structural frame; no fragile transparency.
box('cab dark volume',(-.44,ey,1.65),(.78,.88,1.12),'navy',.06)
for xx in (-.83,-.04):
 for yy in (ey-.47,ey+.47):box('cab upright',(xx,yy,1.64),(.075,.075,1.14),'schoolBusYellow',.018)
box('cab roof',(-.44,ey,2.24),(.99,1.08,.15),'schoolBusYellow',.045)
box('roof inset',(-.44,ey,2.326),(.73,.83,.012),'mustard',.006)
box('cab lower front',(-.015,ey,1.20),(.08,.93,.23),'schoolBusYellow')
for s in (-1,1):
 box('cab door bottom',(-.44,ey+s*.466,1.15),(.71,.042,.16),'schoolBusYellow')
 box('door vertical divider',(-.43,ey+s*.480,1.70),(.045,.025,.86),'schoolBusYellow',.008)
 box('door handle',(-.70,ey+s*.50,1.48),(.11,.025,.03),'uiDark',.006)
 box('side glass reflection',(-.64,ey+s*.477,1.82),(.10,.009,.52),'denim',.003)
box('front glass highlight',(-.012,ey-.22,1.82),(.012,.11,.51),'denim',.003)
# Boom in XZ, grey hydraulic sleeves, exposed polished rods and circular pins.
def beam(name,start,end,w,d,token):
 delta=Vector(end)-Vector(start);o=box(name,(Vector(start)+Vector(end))/2,(w,d,delta.length),token,.045);o.rotation_euler.y=math.atan2(delta.x,delta.z);return o
b0=(.30,ey-.26,.94);b1=(.77,ey-.26,2.48);b2=(1.73,ey-.26,2.62);b3=(2.17,ey-.26,.63)
beam('boom rising',b0,b1,.25,.27,'schoolBusYellow');beam('boom shoulder',b1,b2,.24,.27,'schoolBusYellow');beam('dipper arm',b2,b3,.21,.25,'schoolBusYellow')
for q in (b0,b1,b2,b3):
 rod('pivot boss',(q[0],q[1]-.17,q[2]),(q[0],q[1]+.17,q[2]),.10,'schoolBusYellow',16)
 rod('dark pivot pin',(q[0],q[1]-.183,q[2]),(q[0],q[1]+.183,q[2]),.062,'silver',16)
rod('boom hydraulic barrel',(.44,ey-.46,1.11),(.78,ey-.46,1.89),.058,'uiDark')
rod('boom hydraulic piston',(.78,ey-.46,1.89),(.96,ey-.46,2.32),.029,'silver')
rod('dipper hydraulic barrel',(1.00,ey-.26,2.60),(1.49,ey-.26,2.66),.059,'uiDark')
rod('dipper piston',(1.49,ey-.26,2.66),(1.76,ey-.26,2.62),.029,'silver')
rod('bucket hydraulic barrel',(1.85,ey-.44,2.02),(2.04,ey-.44,1.15),.048,'uiDark')
rod('bucket piston',(2.04,ey-.44,1.15),(2.12,ey-.44,.81),.027,'silver')
# Open scoop: two side profiles and a curved thick floor, no solid block mouth.
path=[(1.94,.66),(1.89,.47),(1.94,.23),(2.13,.09),(2.45,.055),(2.59,.10)]
for s in (-1,1):
 # side polygon extruded in Y rather than X
 pts=[(x,z) for x,z in path]+[(2.40,.50),(2.14,.76)];k=len(pts);yy=ey-.26+s*.34
 vs=[(x,y,z) for y in (yy-.027,yy+.027) for x,z in pts];fs=[tuple(range(k-1,-1,-1)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
 me=bpy.data.meshes.new('bucket cheek');me.from_pydata(vs,[],fs);o=bpy.data.objects.new('bucket cheek',me);bpy.context.collection.objects.link(o);finish(o,'bucket cheek','silver',.012)
for i in range(len(path)-1):beam('curved scoop floor',(path[i][0],ey-.26,path[i][1]),(path[i+1][0],ey-.26,path[i+1][1]),.055,.68,'silver')
for yy in (ey-.49,ey-.26,ey-.03):box('bucket tooth',(2.61,yy,.075),(.26,.10,.095),'silver',.015)
collider('excavator',(.47,ey,1.35),(4.05,1.58,2.70))
empty('front',(2.9,0,1),root)
# Centre the complete placement kit on X/Y, with its contacts still at z=0.
bpy.context.view_layer.update()
coordinates=[o.matrix_world@v.co for o in parts for v in o.data.vertices]
centre_x=(min(v.x for v in coordinates)+max(v.x for v in coordinates))/2
centre_y=(min(v.y for v in coordinates)+max(v.y for v in coordinates))/2
root.location=(-centre_x,-centre_y,0)
bpy.context.view_layer.update()
# Material merging stays within each semantic placement assembly.
for owner in [o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.parent==root]:
 for material in M.values():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==owner and o.data.materials[0]==material]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=owner.name+'_'+material.name
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
def count():
 deps=bpy.context.evaluated_depsgraph_get();total=0
 for o in meshes:
  ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();total+=len(me.loop_triangles);ev.to_mesh_clear()
 return total
bpy.context.view_layer.update()
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
lo=[min(q[i] for q in points) for i in range(3)];hi=[max(q[i] for q in points) for i in range(3)]
report={'id':ASSET['id'],'tier':'side','triangles':{'lod0':count()},'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'dimensions_blender':[hi[i]-lo[i] for i in range(3)],'bbox_blender':{'min':lo,'max':hi},'nodes':[o.name for o in bpy.context.scene.objects if o.type=='EMPTY'],'baked_ao':False,'backface_culling':True,'render_engine':'Eevee'}
asset=list(bpy.context.scene.objects)
if a.glb:
 ao.bake_all(meshes,samples=32);report['baked_ao']=True
 def export(path):
  bpy.ops.object.select_all(action='DESELECT')
  for o in asset:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
 export(a.glb)
 # LOD1 uses decimation; far LOD2 is authored to preserve all three readable silhouettes.
 mods=[]
 for o in meshes:
  m=o.modifiers.new('LOD','DECIMATE');m.ratio=.12;m.use_collapse_triangulate=True;mods.append((o,m))
 bpy.context.view_layer.update();report['triangles']['lod1']=count()
 export(Path(a.glb).with_name('model.lod1.glb'))
 for o,m in mods:o.modifiers.remove(m)
 high_meshes=meshes;high_asset=asset
 for o in high_meshes:o.hide_render=True
 before=set(bpy.context.scene.objects)
 parent=bpy.data.objects['road_closed'];cy=-3.25
 for y in (cy-.66,cy+.66):
  for x in (-.25,.25):box('far A-frame leg',(x,y,.63),(.09,.12,1.26),'picketWhite',0)
 for z in (.44,1.12):box('far board',(.30,cy,z),(.12,1.95,.27),'orange',0)
 box('far road sign',(.40,cy,.88),(.08,1.12,.93),'picketWhite',0)
 for y in (cy-.65,cy+.65):rod('far lamp',(.29,y,1.5),(.39,y,1.5),.13,'windowGlow',6)
 parent=bpy.data.objects['mesh_fence'];fy=-.68
 for y in (fy-1.09,fy+1.09):box('far fence post',(0,y,.84),(.07,.07,1.68),'orange',0)
 for z in (.25,.82,1.45):box('far fence horizontal',(.02,fy,z),(.025,2.18,.034),'orange',0)
 for y in (fy-.8,fy-.27,fy+.27,fy+.8):box('far fence vertical',(.02,y,.85),(.025,.034,1.23),'orange',0)
 parent=bpy.data.objects['excavator'];ey=2.4
 for y in (ey-.54,ey+.54):box('far track',(-.48,y,.33),(2.0,.44,.59),'uiDark',0)
 box('far chassis',(-.46,ey,.84),(1.65,1.22,.29),'schoolBusYellow',0)
 box('far engine',(-1.12,ey,1.17),(.55,1.18,.64),'schoolBusYellow',0)
 box('far cab',(-.44,ey,1.66),(.82,.95,1.12),'navy',0)
 box('far roof',(-.44,ey,2.24),(.99,1.08,.15),'schoolBusYellow',0)
 for x in (-.83,-.04):
  for y in (ey-.47,ey+.47):box('far cab frame',(x,y,1.64),(.075,.075,1.14),'schoolBusYellow',0)
 # Cross-section width stays along world Y for every boom member.
 for start,end in ((b0,b1),(b1,b2),(b2,b3)):
  delta=Vector(end)-Vector(start);o=box('far boom',(Vector(start)+Vector(end))/2,(.23,.27,delta.length),'schoolBusYellow',0);o.rotation_euler.y=math.atan2(delta.x,delta.z)
 box('far scoop',(2.28,ey-.26,.27),(.65,.74,.47),'silver',0)
 low_meshes=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
 # Newly authored low geometry was placed in source coordinates by the helpers.
 for o in bpy.context.scene.objects:
  if o not in before and o.type=='MESH':o.location.x-=centre_x;o.location.y-=centre_y
 # Join per parent/material as with LOD0.
 for owner in (bpy.data.objects['road_closed'],bpy.data.objects['mesh_fence'],bpy.data.objects['excavator']):
  for material in M.values():
   obs=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH' and o.parent==owner and o.data.materials[0]==material]
   if not obs:continue
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=owner.name+'_far_'+material.name
 meshes=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
 ao.bake_all(meshes,samples=32);bpy.context.view_layer.update();report['triangles']['lod2']=count()
 asset=[o for o in high_asset if o.type!='MESH']+meshes
 export(Path(a.glb).with_name('model.lod2.glb'))
 for o in meshes:bpy.data.objects.remove(o,do_unlink=True)
 meshes=high_meshes;asset=high_asset
 for o in meshes:o.hide_render=False
 (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render:
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.15,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
 target=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2))
 span=max(hi[0]-lo[0],hi[1]-lo[1]);parent=root
 box('studio floor',(0,0,-.045),(200,200,.075),'uiDark',0)
 for pos,power,size,color in [((4,-5,8),850,6,(1,.81,.64)),((-3,3,7),650,5,(.68,.77,1)),((2,6,5),600,4,(1,.68,.41))]:
  bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 offset={'ref':Vector((12,-1.5,4.5)),'game':Vector((9,-5,10)),'rear':Vector((-9,5,7))}[a.view]
 bpy.ops.object.camera_add(location=target+offset);cam=bpy.context.object;cam.rotation_euler=(-offset).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span*(1.5 if a.view=='game' else 1.26);scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
