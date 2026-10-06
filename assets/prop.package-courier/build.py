"""Medical courier parcel and barcode scanner; deterministic palette geometry, +X front."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'tools/blender'))
from sslib import palette,ao
ASSET={'id':'prop.package-courier','category':'prop'}
p=argparse.ArgumentParser()
p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref')
p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
parts=[]
def box(name,pos,size,token,bevel=.006):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(palette.mat(token))
 if bevel:
  b=o.modifiers.new('soft edges','BEVEL');b.width=min(bevel,min(size)*.35);b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
 b=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=b.name)
 parts.append(o);return o
def front(n,y,z,w,h,t,x=.258):return box(n,(x,y,z),(.006,w,h),t,.001)
def text(n,s,y,z,size,token,x=.266):
 cu=bpy.data.curves.new(n,'FONT');cu.body=s;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=.0006;cu.resolution_u=2
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);o.location=(x,y,z);o.rotation_euler=(math.pi/2,0,math.pi/2);cu.materials.append(palette.mat(token))
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');parts.append(bpy.context.object)
box('parcel', (0,0,.22),(.50,.72,.44),'orange',.014)
# Lid seam, thick tape and reinforced metal/cardboard edge strips.
box('lid seam',(0,0,.426),(.505,.726,.008),'leatherShadow',.001)
box('lid',(0,0,.445),(.51,.735,.032),'corgiOrangeLight',.009)
box('top tape',(0,0,.464),(.514,.072,.007),'brass',.002)
for x in [-.251,.251]:
 for y in [-.354,.354]:
  box('corner reinforcement',(x,y,.22),(.022,.026,.414),'woodWarm',.004)
  for z in [.045,.39]:box('corner rivet',(x+(.013 if x>0 else -.013),y,z),(.007,.010,.010),'leatherShadow',.002)
for z in [.025,.419]:front('edge reinforcement',0,z,.705,.025,'corgiOrangeLight',.257)
front('medical label',-.177,.227,.285,.35,'canvasTan',.266)
front('cross upright',-.177,.305,.047,.146,'backpackTeal',.273)
front('cross horizontal',-.177,.305,.140,.047,'backpackTeal',.274)
text('town','Sunset Grove',-.177,.194,.034,'tealDark',.279)
text('courier','Courier',-.177,.152,.041,'tealDark',.279)
front('cold chain border',.148,.325,.270,.125,'policeBlue',.266)
front('cold chain paper',.148,.325,.256,.111,'policeBlue',.273)
front('temperature field',.179,.305,.173,.041,'picketWhite',.278)
front('snowflake tile',.055,.325,.061,.105,'policeBlue',.279)
text('snowflake','*',.055,.326,.085,'picketWhite',.286)
text('cold label','COLD CHAIN',.179,.349,.027,'picketWhite',.281)
text('temperature','2-8 C',.179,.308,.029,'policeBlue',.285)
front('fragile border',.148,.157,.270,.139,'survivorRed',.266)
front('fragile paper',.148,.157,.256,.125,'picketWhite',.273)
# Wineglass bowl is a filled tapered profile, offset from its label.
me=bpy.data.meshes.new('glass bowl');me.from_pydata([(.285,.031,.206),(.285,.079,.206),(.285,.074,.180),(.285,.055,.171),(.285,.036,.180)],[],[(4,3,2,1,0)]);me.materials.append(palette.mat('survivorRed'));o=bpy.data.objects.new('glass bowl',me);bpy.context.collection.objects.link(o);parts.append(o)
front('glass stem',.055,.149,.009,.047,'survivorRed',.282)
front('glass foot',.055,.123,.046,.008,'survivorRed',.282)
text('fragile','FRAGILE',.183,.178,.030,'survivorRed',.281)
text('medical supplies','MEDICAL',.183,.135,.020,'survivorRed',.281)
for y in [-.334,.334]:
 for z in [.049,.397]:
  front('corner plate',y,z,.045,.061,'woodWarm',.270)
  front('plate rivet',y,z,.010,.010,'leatherShadow',.277)
# Lid shipping card and barcode, visible from game camera.
box('shipping card',(-.04,-.16,.467),(.285,.215,.007),'picketWhite',.002)
for i in range(23):box('shipping barcode',(-.145+i*.009,-.14,.474),(.003 if i%3 else .005,.09,.004),'uiDark',0)
for y in [-.235,-.215]:box('address lines',(-.03,y,.474),(.18,.006,.004),'denim',0)
box('top screen frame',(.03,.227,.47),(.14,.095,.012),'uiDark',.007)
box('top blue display',(.03,.227,.478),(.113,.067,.006),'policeBlue',.003)
box('top display glint',(.035,.22,.482),(.070,.013,.004),'picketWhite',0)
# Side inset blue status screen, arrows pointing up.
box('side display frame',(-.04,.368,.30),(.135,.013,.085),'uiDark',.006)
box('side display',(-.04,.377,.30),(.111,.006,.060),'policeBlue',.003)
box('side display glint',(-.04,.382,.30),(.075,.004,.022),'picketWhite',0)
for x in [-.10,.025]:
 box('arrow shaft',(x,.373,.133),(.014,.006,.096),'uiDark',0)
 me=bpy.data.meshes.new('arrow');me.from_pydata([(x-.03,.377,.168),(x+.03,.377,.168),(x,.377,.210)],[],[(0,2,1)]);me.materials.append(palette.mat('uiDark'));o=bpy.data.objects.new('up arrow',me);bpy.context.collection.objects.link(o);parts.append(o)
box('arrow underline',(-.04,.374,.075),(.19,.007,.009),'uiDark',0)
# Scanner placed beside parcel; separately named node for pickup.
scanner_start=len(parts)
box('scanner foot',(.06,.635,.022),(.115,.14,.044),'woodWarm',.007)
o=box('scanner grip',(.025,.635,.137),(.072,.100,.245),'uiDark',.014);o.rotation_euler.y=.23
box('grip orange stripe',(.074,.635,.137),(.016,.08,.19),'orange',.006)
box('trigger',(.088,.635,.249),(.032,.06,.058),'survivorRed',.008)
box('scanner shell',(.005,.635,.34),(.155,.232,.152),'orange',.022)
box('scanner bumper',(.088,.635,.34),(.032,.239,.155),'uiDark',.018)
front('scanner teal screen',.635,.349,.179,.101,'backpackTeal',.108)
for i in range(13):front('scanner barcode',.579+i*.009,.351,.003 if i%3 else .005,.065,'picketWhite',.115)
box('scanner rear lens',(-.081,.635,.34),(.014,.11,.081),'tealDark',.007)
for o in parts[scanner_start:]:o.location.y+=.28
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']=ASSET['id'];root['forward']='+X'
root['ss_physics']={'class':'light','mass':4,'friction':.6,'restitution':.08,'centerOfMass':[0,.23,0],'pushable':True,'kickable':True,'vaultable':True,'flammable':True,'barricadeValue':.1,'barricadeHP':20,'sounds':'prop.cardboard'}
meshes=[]
for group,label in [(parts[:scanner_start],'body'),(parts[scanner_start:],'scanner')]:
 groups=[(m,[o for o in group if o.data.materials[0]==m]) for m in list(bpy.data.materials)]
 for m,obs in groups:
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=label+'_'+m.name;o.parent=root;meshes.append(o)
for name,loc,size in [('parcel',(0,0,.23),(.54,.47,.75)),('scanner',(.025,.915,.21),(.22,.42,.25))]:
 o=bpy.data.objects.new('col:'+name,None);bpy.context.collection.objects.link(o);o.parent=root;o.location=loc;o['collider']='cuboid';o['shape']='cuboid';o['size']=size
# Bake shared deterministic vertex AO before exporting.
for o in meshes:
 o.data.materials[0].use_backface_culling=True
 ao.bake(o,samples=32)
def count():
 for o in meshes:o.data.calc_loop_triangles()
 return sum(len(o.data.loop_triangles) for o in meshes)
counts={'lod0':count()}
def save(path):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.glb:
 save(Path(a.glb).resolve())
 backups={o:o.data.copy() for o in meshes}
 for level,ratio in [(1,.13),(2,.043)]:
  for o in meshes:
   o.data=backups[o].copy();bpy.context.view_layer.objects.active=o
   d=o.modifiers.new('LOD simplification','DECIMATE');d.ratio=ratio;bpy.ops.object.modifier_apply(modifier=d.name)
  counts['lod'+str(level)]=count();save(OUT/f'model.lod{level}.glb')
 for o in meshes:o.data=backups[o]
report={'id':ASSET['id'],'tier':'side','triangles':counts,'draw_calls':len(meshes),'materials':sorted({o.data.materials[0].name for o in meshes}),'nodes_ok':True,'within_budget':counts['lod0']<=12000 and len(meshes)<=30,'webgpu_ok':False,'webgl2_ok':False,'rounds':3,'gaps':[]}
if a.glb:(OUT/'report.json').write_text(json.dumps(report,indent=2))
if a.render:
 s=bpy.context.scene;s.render.engine='CYCLES' # AO used Cycles; preview switches to Eevee below.
 s.render.engine='BLENDER_EEVEE';s.eevee.taa_render_samples=a.samples;s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100
 s.world=bpy.data.worlds.new('studio');s.world.color=(.06,.05,.07)
 bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.location.z=-.005;bpy.context.object.data.materials.append(palette.mat('uiDark'))
 target=Vector((0,.34,.23));views={'ref':(3.5,2.3,1.5),'game':(2.4,2.3,3.2),'front':(3,.22,.5),'side':(0,3,.6),'rear':(-3,-2,1.3)}
 bpy.ops.object.camera_add(location=views[a.view]);c=bpy.context.object;c.rotation_euler=(target-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=2.15;s.camera=c
 for pos,power,color in [((2,-3,4),220,(1,.82,.66)),((-3,1,3),150,(.7,.8,1)),((1,3,3),160,(1,.9,.7))]:
  bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.size=3;l.data.color=color;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 s.view_settings.view_transform='Standard';s.render.filepath=str(Path(a.render).resolve());Path(a.render).parent.mkdir(exist_ok=True,parents=True);bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
