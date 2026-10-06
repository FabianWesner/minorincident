# L1V2_BATCH_ITEM — self-contained reproducible source; +X front, metres.
"""Shared deterministic modeling/export helpers for the Level 1 garden/alley batch.
Blender only; no dependencies beyond the project's sslib. +X front, Z up, metres.
"""
import argparse, json, math, sys, random
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/blender'))
from sslib import palette, ao
M={}; parts=[]; groups=[]; rng=random.Random(612)
def init(asset):
 global ID, root
 ID=asset
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 root=empty('root');root['asset_id']=asset;root['tier']='side';root['forward']='+X'
 return root

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
 if parent:o.parent=parent
 groups.append(o);return o

def collider(name,loc,size,parent=None):
 o=empty('col:'+name,loc,parent or root);o['collider']='cuboid';o['shape']='cuboid';o['size']=list(size);o['halfExtents']=[v*.5 for v in size];return o

def mat(token):
 if token not in M:
  M[token]=palette.mat(token);M[token].use_backface_culling=True
  M[token].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65
 return M[token]

def finish(o,name,token,parent=None,smooth=False):
 o.name=name;o.data.materials.append(mat(token))
 for p in o.data.polygons:p.use_smooth=smooth
 bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent or root;o.matrix_world=world;bpy.context.view_layer.update();parts.append(o);return o

def box(name,loc,size,t='woodWarm',b=.015,parent=None,segments=2):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  m=o.modifiers.new('soft bevel','BEVEL');m.width=min(b,min(size)*.35);m.segments=segments;bpy.ops.object.modifier_apply(modifier=m.name)
  m=o.modifiers.new('weighted corners','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=m.name)
 return finish(o,name,t,parent)

def mesh(name,verts,faces,t,parent=None):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,t,parent)

def sphere(name,loc,size,t,parent=None,n=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=max(8,n//2),radius=1,location=loc);o=bpy.context.object;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,t,parent,True)

def ico(name,loc,size,t,parent=None,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=bpy.context.object;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,t,parent,smooth=ID in ['prop.flower-bed.large','prop.flower-bed.small','prop.flower-box','house.porch-a'] and t in ['foliage','foliageDark','grass','schoolBusYellow','flamingoPink','picketWhite'])

def cyl(name,loc,r,depth,t,parent=None,axis='Z',n=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc);o=bpy.context.object
 if axis=='Y':o.rotation_euler.x=math.pi/2
 if axis=='X':o.rotation_euler.y=math.pi/2
 return finish(o,name,t,parent,True)

def beam(name,start,end,w,t='silver',parent=None):
 d=Vector(end)-Vector(start)
 if w<.012:o=cyl(name,(Vector(start)+Vector(end))/2,w*.5,d.length,t,parent,n=6)
 else:o=box(name,(Vector(start)+Vector(end))/2,(w,w,d.length),t,min(w*.25,.012),parent,segments=1)
 o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o

def tube(name,path,r,t,parent=None,n=12):
 vs=[];fs=[]
 for i,pt in enumerate(path):
  tangent=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)]);tangent.normalize()
  u=tangent.cross(Vector((0,0,1)))
  if u.length<.1:u=tangent.cross(Vector((1,0,0)))
  u.normalize();v=tangent.cross(u)
  for j in range(n):vs.append(Vector(pt)+r*(u*math.cos(j*math.tau/n)+v*math.sin(j*math.tau/n)))
 for i in range(len(path)-1):
  for j in range(n):k=i*n+j;l=i*n+(j+1)%n;fs.append((k,l,l+n,k+n))
 fs += [tuple(reversed(range(n))),tuple((len(path)-1)*n+j for j in range(n))]
 o=mesh(name,vs,fs,t,parent)
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 return o

def smooth_path(points,steps=6):
 pts=[Vector(points[0]),*[Vector(p) for p in points],Vector(points[-1])];out=[]
 for i in range(1,len(pts)-2):
  a,b,c,d=pts[i-1:i+3]
  for j in range(steps):
   t=j/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 out.append(Vector(points[-1]));return out

def torus(name,loc,major,minor,t,parent=None,axis='Z',n=48):
 bpy.ops.mesh.primitive_torus_add(major_segments=n,minor_segments=6,location=loc,major_radius=major,minor_radius=minor);o=bpy.context.object
 if axis=='Y':o.rotation_euler.x=math.pi/2
 if axis=='X':o.rotation_euler.y=math.pi/2
 return finish(o,name,t,parent,True)

def lathe(name,loc,profile,t,parent=None,n=48):
 vs=[(loc[0]+r*math.cos(i*math.tau/n),loc[1]+r*math.sin(i*math.tau/n),loc[2]+z) for r,z in profile for i in range(n)]
 fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
 o=mesh(name,vs,fs,t,parent)
 for p in o.data.polygons:p.use_smooth=True
 return o

def wheel(loc,r=.15,w=.09,parent=None):
 cyl('rubber tire',loc,r,w,'uiDark',parent,'Y',40)
 for s in [-1,1]:
  p=(loc[0],loc[1]+s*w*.52,loc[2]);cyl('wheel hub',p,r*.68,.018,'brass',parent,'Y');cyl('hub cap',(p[0],p[1]+s*.014,p[2]),r*.24,.027,'silver',parent,'Y',16)

def pot(x,y,z=.0,scale=1,flowers=True):
 s=scale
 lathe('terracotta pot',(x,y,z),[(0,0),(.15*s,0),(.16*s,.04*s),(.23*s,.36*s),(.26*s,.37*s),(.26*s,.43*s),(.21*s,.43*s),(.21*s,.37*s),(.13*s,.06*s),(0,.06*s)],'brick',n=32)
 cyl('pot soil',(x,y,z+.375*s),.205*s,.025*s,'hairChestnut')
 plant(x,y,z+.4*s,.32*s,flowers)

def flower(x,y,z,r=.065,t='schoolBusYellow',parent=None):
 cyl('green stem',(x,y,z-.10),.009,.22,'grass',parent,n=8)
 for j in range(6):
  a=j*math.tau/6; o=ico('petal',(x+r*.58*math.cos(a),y+r*.58*math.sin(a),z),(r*.64,r*.29,r*.20),t,parent,1);o.rotation_euler.z=a
 ico('gold flower heart',(x,y,z+.012),(r*.27,r*.27,r*.20),'schoolBusYellow',parent,sub=1)

def plant(x,y,z,r=.35,flowers=True):
 for i in range(18):
  a=i*2.4;rr=r*rng.uniform(.25,.8);h=rng.uniform(.04,r*.7)
  o=ico('leaf',(x+rr*math.cos(a),y+rr*math.sin(a),z+h),(r*.4,r*.16,r*.12),'foliage' if i%3 else 'foliageDark');o.rotation_euler=(0,-.6,a)
  if flowers and i%3==0:flower(x+rr*math.cos(a),y+rr*math.sin(a),z+h+r*.25,r*.17,['schoolBusYellow','picketWhite','flamingoPink'][i%9//3])

def star(name,x,y,z,r,t,parent=None):
 # Solid extruded star plaque in the YZ plane, front at +X.
 pts=[(y+(r if i%2==0 else r*.45)*math.sin(i*math.pi/5),z+(r if i%2==0 else r*.45)*math.cos(i*math.pi/5)) for i in range(10)]
 vs=[(xx,yy,zz) for xx in [x,x+.008] for yy,zz in pts];fs=[tuple(reversed(range(10))),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
 return mesh(name,vs,fs,t,parent)

def run(out):
 p=argparse.ArgumentParser()
 p.add_argument('--quality',choices=['high','low'],default='high')
 for key,default,typ in [('render',None,str),('glb',None,str),('view','game',str),('samples',24,int),('width',960,int),('height',720,int)]:p.add_argument('--'+key,default=default,type=typ)
 a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 # Merge only siblings of matching material. Joint empties stay separate.
 for parent in groups:
  for m in M.values():
   obs=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==m]
   if not obs:continue
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=parent.name+'_'+m.name
 meshes=[o for o in bpy.data.objects if o.type=='MESH']
 for o in meshes:
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 bpy.context.view_layer.update()
 points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
 lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
 shift=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
 for o in root.children:o.location+=shift
 dims=hi-lo
 front=empty('front',(dims.x/2+.01,0,dims.z*.5),root)
 if not any(o.name.startswith('col:') for o in groups):collider('body',(0,0,dims.z*.5),dims)
 masses={'prop.bbq':18,'prop.wheelbarrow':35,'prop.crates':35,'prop.hose-reel':12,'prop.gnome':3,'prop.flamingo':1.5,'prop.recycling-bin':9,'prop.trash-bags':6,'prop.carpet':8,'prop.sprinkler':2,'prop.lawn-chair-a':4,'prop.lawn-chair-b':4,'prop.broken-chair':5}
 mass=masses.get(ID,0);cls='fixed' if not mass else ('light' if mass<=15 else 'medium')
 root['ss_physics']={'class':cls,'mass':mass,'friction':.65,'restitution':.08,'centerOfMass':[0,float(dims.z)*.45,0],'pushable':bool(mass),'kickable':cls=='light','barricadeValue':.5,'barricadeHP':80,'vaultable':float(dims.z)<.9,'flammable':ID in ['prop.crates','prop.carpet','prop.broken-chair'],'burnTime':20,'explosive':None,'sounds':'prop.metal-light'}
 bpy.context.view_layer.update()
 tris=sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons)
 report={'id':ID,'triangles':{'lod0':tris},'dimensions_blender':list(dims),'draw_calls':len(meshes),'materials':[m.name for m in M.values()],'nodes':[o.name for o in groups],'backface_culling':True,'rounds':1,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
 if a.glb:
  ao.bake_all(meshes,samples=32)
  # Share AO at each geometric vertex, avoiding noisy color seams on bevels.
  for obj in meshes:
   layer=obj.data.color_attributes.get('ao');sums=[[0.,0.,0.,0.,0] for v in obj.data.vertices]
   for loop in obj.data.loops:
    value=layer.data[loop.index].color;acc=sums[loop.vertex_index]
    for j in range(4):acc[j]+=value[j]
    acc[4]+=1
   for loop in obj.data.loops:
    acc=sums[loop.vertex_index];layer.data[loop.index].color=tuple(.55+.45*acc[j]/max(1,acc[4]) for j in range(3))+(1.,)
  bpy.ops.object.select_all(action='DESELECT')
  for o in meshes+groups:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_texcoords=False)
 (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 if a.render:
  scene=bpy.context.scene
  # Eevee game camera review; authored materials are one-sided.
  try:scene.render.engine='BLENDER_EEVEE_NEXT'
  except TypeError:scene.render.engine='BLENDER_EEVEE'
  scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs['Color'].default_value=(.075,.065,.09,1);bg.inputs['Strength'].default_value=.65
  target=Vector((0,0,dims.z*.46));scale=max(dims.x,dims.y,dims.z)*1.55
  for loc,power,color in [((4,-6,8),1300,(1,.78,.55)),((-4,3,6),950,(.63,.71,1))]:
   bpy.ops.object.light_add(type='AREA',location=Vector(loc)*max(1,scale/4));o=bpy.context.object;o.data.energy=power*max(1,scale/4)**2;o.data.size=max(3,scale);o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
  bpy.ops.object.camera_add();cam=bpy.context.object
  direction=Vector({'game':(7,-5,7),'ref':(6,-8,5),'front':(1,0,.18),'back':(-1,0,.18),'side':(0,-1,.18)}.get(a.view,(5,-7,7))).normalized()
  cam.location=target+direction*scale*3;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;scene.camera=cam
  scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
 print('OK '+json.dumps(report))

OUT=Path(__file__).resolve().parent
root=init(OUT.name)

def bicycle(x,y,s,t):
 # Display-facing bicycle side on -Y, with real spoke wheels and triangle frame.
 for xx,label in [(x-.49*s,'rear'),(x+.49*s,'front')]:
  joint=empty('wheel_'+label+'_'+t,(xx,y,.35*s),root)
  torus('bicycle tire',(xx,y,.35*s),.31*s,.033*s,'uiDark',joint,'Y',40)
  torus('wheel rim',(xx,y-.012*s,.35*s),.285*s,.011*s,'silver',joint,'Y',40)
  cyl('hub',(xx,y,.35*s),.028*s,.11*s,'silver',joint,'Y',16)
  for i in range(16):
   a=i*math.tau/16;beam('wheel spoke',(xx,y-.035*s,.35*s),(xx+.28*s*math.cos(a),y-.035*s,.35*s+.28*s*math.sin(a)),.006*s,'silver',joint)
 crank=(x,y,.36*s);seat=(x-.18*s,y,.84*s);head=(x+.30*s,y,.85*s);rear=(x-.49*s,y,.35*s);front=(x+.49*s,y,.35*s)
 for a,b in [(crank,seat),(seat,head),(head,crank),(crank,rear),(seat,rear),(head,front)]:beam('painted bicycle frame',a,b,.035*s,t)
 beam('seat stem',seat,(seat[0]-.02*s,y,.93*s),.025*s,'silver')
 sphere('saddle',(seat[0]-.02*s,y,.95*s),(.13*s,.074*s,.037*s),'uiDark',n=16)
 beam('steerer',head,(x+.29*s,y,1.03*s),.026*s,'silver')
 tube('handlebars',[(x+.35*s,y-.17*s,1.05*s),(x+.27*s,y-.10*s,1.00*s),(x+.27*s,y+.10*s,1.00*s),(x+.35*s,y+.17*s,1.05*s)],.017*s,'silver')
 for yy in [-.17,.17]:cyl('bar grip',(x+.35*s,y+yy*s,1.05*s),.025*s,.11*s,'uiDark',axis='Y',n=12)
 cyl('chain ring',crank,.10*s,.045*s,'silver',axis='Y',n=24)
 tube('chain loop',[(x-.49*s,y+.05*s,.39*s),(x,y+.05*s,.46*s),(x+.10*s,y+.05*s,.36*s),(x,y+.05*s,.26*s),(x-.49*s,y+.05*s,.31*s),(x-.49*s,y+.05*s,.39*s)],.008*s,'uiDark',n=6)
 beam('kickstand',(x-.05*s,y,.38*s),(x-.18*s,y-.18*s,.01),.014*s,'uiDark')
 for yy in [-.09,.09]:box('pedal',(x+.08*s,y+yy*s,.34*s),(.11*s,.065*s,.025*s),'uiDark',.006)
bicycle(-.18,.39,1,'policeBlue');bicycle(.26,-.32,.83,'flamingoPink')
# Red pull wagon and striped toy ball complete the porch dressing module.
box('wagon tray',(1.10,.37,.22),(.54,.33,.09),'survivorRed',.012)
for y in [.20,.54]:box('wagon side',(1.10,y,.33),(.56,.025,.18),'survivorRed',.008)
for x in [.82,1.38]:box('wagon end',(x,.37,.33),(.025,.33,.18),'survivorRed',.008)
for x in [.92,1.29]:
 for y in [.17,.57]:wheel((x,y,.10),.10,.05)
tube('pull handle',[(.82,.37,.21),(.67,.37,.73),(.60,.37,.73)],.014,'uiDark')
sphere('toy ball',(.62,-.61,.11),(.11,.11,.11),'picketWhite',n=24)
for i in range(3):
 o=torus('red ball stripe',(.62,-.61,.11),.109,.012,'survivorRed',n=32);o.rotation_euler=(i*math.pi/3,math.pi/2,0)

run(OUT)
