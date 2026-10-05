"""Sunset Grove playground: deterministic metre-scale, +X slide/front, texture free."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT=Path(__file__).resolve().parent
p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
for token,h in {'policeBlue':'2f6bff','survivorRed':'d9363e','schoolBusYellow':'f2b630','uiDark':'25222c','sidewalk':'b9a4a0','windowGlow':'ffc773','woodWarm':'b0703f','picketWhite':'f2e6dc','backpackTeal':'2f6e6a'}.items():
 m=bpy.data.materials.new('pal_'+token); m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]; bs.inputs['Base Color'].default_value=(*[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c],1); bs.inputs['Roughness'].default_value=.48; M[token]=m
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root); root['asset_id']='kit.playground'; root['tier']='Side'; root['front']='+X'
parts=[]
def finish(o,name,mat,bevel=0):
 o.name=name; o.data.materials.append(M[mat]); o.parent=root; parts.append(o)
 if bevel:
  mod=o.modifiers.new('Rounded edges','BEVEL'); mod.width=bevel; mod.segments=1; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(name,pos,size,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return finish(o,name,mat,bevel)
def ball(name,pos,size,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=5,location=pos); o=bpy.context.object; o.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return finish(o,name,mat)
def rod(name,start,end,r,mat,n=8):
 d=Vector(end)-Vector(start); bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d.length,location=(Vector(start)+Vector(end))/2); o=bpy.context.object; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return finish(o,name,mat)
def tube(name,points,r,mat,sides=8):
 vs=[]
 for i,pt in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)]); tangent.normalize(); u=tangent.cross(Vector((0,1,0)))
  if u.length<.01:u=tangent.cross(Vector((1,0,0)))
  u.normalize(); v=tangent.cross(u)
  vs.extend([Vector(pt)+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v) for j in range(sides)])
 fs=[tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))]
 for i in range(len(points)-1):
  for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); return finish(o,name,mat)
def assembly(name,objs,pivot):
 e=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(e); e.parent=root; e.location=pivot
 for o in objs:
  o.parent=e; o.matrix_parent_inverse.identity(); o.location-=Vector(pivot)
 return e
# Low irregular sandbox pad.
N=48; vs=[]
for z in [0,.10]:
 for i in range(N):
  t=i*math.tau/N; f=1+.025*math.sin(7*t)+.014*math.cos(11*t); vs.append((4.10*math.cos(t)*f,4.85*math.sin(t)*f,z))
fs=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
me=bpy.data.meshes.new('Sand pad'); me.from_pydata(vs,[],fs); o=bpy.data.objects.new('sand',me); bpy.context.collection.objects.link(o); finish(o,'Sand pad','windowGlow',.03)
# Sparse low-poly sand stones, each a solid raised mesh.
for i,(x,y) in enumerate([(-2.8,-2.8),(1.6,-3.7),(3.25,-1.3),(2.85,1.8),(.65,4.3),(-2.8,1.2),(-3.25,-.5),(.6,-4.35),(3.2,.2),(-.2,3.9)]):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,.12)); stone=bpy.context.object; stone.scale=(.12+.02*(i%3),.10,.065); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(stone,'Sand pebble','sidewalk')
# Tower and side climbing deck.
cx,cy=-1.6,-2.65
for x in [-2.25,-.95]:
 for y in [-3.3,-2.0]:
  rod('Tower post',(x,y,.10),(x,y,3.25),.095,'policeBlue'); rod('Collar',(x,y,1.48),(x,y,1.60),.125,'policeBlue'); ball('Post cap',(x,y,3.25),(.12,.12,.08),'policeBlue')
box('Main deck',(cx,cy,1.5),(1.65,1.65,.16),'policeBlue')
box('Side deck',(-1.65,-3.85,1.5),(1.6,.82,.16),'policeBlue')
for x in [-2.25,-.95]:
 rod('Outer post',(x,-4.2,.1),(x,-4.2,2.35),.075,'policeBlue'); ball('Cap',(x,-4.2,2.35),(.09,.09,.07),'policeBlue')
for start,end in [((-2.25,-4.2,2.18),(-.95,-4.2,2.18)),((-2.25,-4.2,2.18),(-2.25,-2,2.18)),((-.95,-4.2,2.18),(-.95,-3.35,2.18)),((-2.25,-2,2.18),(-.95,-2,2.18))]:
 rod('Safety top rail',start,end,.055,'schoolBusYellow')
 for i in range(1,8):
  q=Vector(start).lerp(Vector(end),i/8); rod('Safety baluster',(q.x,q.y,1.63),q,.027,'schoolBusYellow')
 rod('Bottom rail',(start[0],start[1],1.67),(end[0],end[1],1.67),.04,'schoolBusYellow')
# Red grab arch on the small side deck.
tube('Grab arch',[(-1.65+.22*math.cos(t),-4.1,2.24+.32*math.sin(t)) for t in [i*math.pi/12 for i in range(13)]],.05,'survivorRed')
# Pitched tiled canopy ridge along X.
for s in [-1,1]:
 roof=box('Roof panel',(cx,cy+s*.46,3.34),(1.9,1.08,.11),'policeBlue'); roof.rotation_euler.x=-s*math.radians(36)
 for row in range(3):
  yy=cy+s*(.17+row*.30); zz=3.68-(.17+row*.30)*.727
  for col in range(5):
   tile=box('Raised roof tile',(cx-.75+col*.375,yy,zz+.065),(.35,.35,.055),'policeBlue',.025); tile.rotation_euler.x=-s*math.radians(36)
rod('Ridge cap',(-2.6,cy,3.74),(-.6,cy,3.74),.09,'policeBlue')
# Raised structural bolts on the outward post faces.
for x in [-2.25,-.95]:
 for y in [-3.3,-2.0,-4.2]:
  rod('Hex bolt',(x+.095,y,1.49),(x+.112,y,1.49),.025,'sidewalk',6)
# Climbing board tilted from foreground toward deck.
b=box('Climbing board',(.0,-3.85,.82),(.11,.91,1.72),'sidewalk'); b.rotation_euler.y=-.55
for y in [-4.34,-3.36]:rod('Climb blue frame',(.45,y,.14),(-.45,y,1.54),.055,'policeBlue')
for i in range(6):
 z=.28+i*.205; x=.45-(z-.14)*.643+.10; ball('Climbing hold',(x,-3.85+(-.19 if i%2 else .19),z),(.09,.10,.085),'survivorRed' if i%3==0 else 'policeBlue')
for z in [.35,.68,1.01,1.34]:rod('Deck access rung',(-2.28,-4.20,z),(-.92,-4.20,z),.035,'uiDark')
# Smoothly sampled slide trough, thick side walls with rounded upper rails.
path=[(-.83,1.52),(-.57,1.48),(-.25,1.27),(.10,.92),(.48,.56),(.85,.31),(1.2,.23),(1.55,.23)]
# Catmull-Rom interpolation keeps the wide slide curve smooth at modest density.
control=path; path=[]
for i in range(len(control)-1):
 p0=Vector(control[max(0,i-1)]); p1=Vector(control[i]); p2=Vector(control[i+1]); p3=Vector(control[min(len(control)-1,i+2)])
 for j in range(3):
  t=j/3; q=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t); path.append(tuple(q))
path.append(control[-1])
verts=[]
for x,z in path:verts.extend([(x,-3.02,z),(x,-2.28,z),(x,-3.02,z-.07),(x,-2.28,z-.07)])
faces=[]
for i in range(len(path)-1):
 k=i*4; l=k+4; faces.extend([(k,k+1,l+1,l),(k+2,l+2,l+3,k+3),(k,l,k+2+4,k+2),(k+1,k+3,l+3,l+1)])
k=(len(path)-1)*4; faces.extend([(0,2,3,1),(k,k+1,k+3,k+2)])
me=bpy.data.meshes.new('Slide'); me.from_pydata(verts,[],faces); o=bpy.data.objects.new('Slide',me); bpy.context.collection.objects.link(o); finish(o,'Slide bed','survivorRed',.02)
for y in [-3.04,-2.26]:
 wallverts=[]
 for x,z in path:wallverts.extend([(x,y-.035,z-.045),(x,y+.035,z-.045),(x,y-.035,z+.15),(x,y+.035,z+.15)])
 wallfaces=[(0,2,3,1)]
 for i in range(len(path)-1):
  k=i*4; l=k+4; wallfaces.extend([(k,l,l+2,k+2),(k+1,k+3,l+3,l+1),(k+2,l+2,l+3,k+3),(k,k+1,l+1,l)])
 k=(len(path)-1)*4; wallfaces.append((k,k+1,k+3,k+2))
 me=bpy.data.meshes.new('Solid slide wall'); me.from_pydata(wallverts,[],wallfaces); me.update(); o=bpy.data.objects.new('Solid slide wall',me); bpy.context.collection.objects.link(o); finish(o,'Solid slide wall','survivorRed')
 tube('Slide raised wall',[(x,y,z+.14) for x,z in path],.105,'survivorRed',10)
 rod('Slide foot',(1.35,y,.10),(1.35,y,.28),.06,'survivorRed')
# Monkey bars, freestanding red ladders.
for x in [-2.3,.05]:
 for y in [-.85,.25]:
  rod('Monkey upright',(x,y,.10),(x,y,2.5),.085,'survivorRed'); rod('Joint collar',(x,y,2.3),(x,y,2.43),.115,'sidewalk')
 for z in [.55,1.05,1.55,2.05]:rod('Ladder rung',(x,-.85,z),(x,.25,z),.042,'survivorRed')
for y in [-.85,.25]:rod('Monkey top beam',(-2.42,y,2.5),(.17,y,2.5),.09,'survivorRed')
for i in range(7):
 x=-2.2+i*.36; rod('Overhead rung',(x,-.85,2.5),(x,.25,2.5),.048,'survivorRed')
for x in [-2.43,.18]:
 for y in [-.85,.25]:ball('Yellow end fitting',(x,y,2.5),(.07,.15,.15),'schoolBusYellow')
# Move the monkey-bar assembly clear of the tower.
for o in parts:
 if o.name.startswith(('Monkey','Ladder rung','Overhead rung','Joint collar','Yellow end fitting')):o.location.y+=.48
# Swings: A frames with brace, two separately pivoted seats and chains.
for y in [1.6,4.1]:
 for x in [-1.85,-.35]:rod('Swing A leg',(x,y,.10),(-1.1,y,2.48),.085,'policeBlue')
 rod('Swing brace',(-1.63,y,.52),(-.57,y,.52),.045,'policeBlue')
rod('Swing overhead',(-1.1,1.46,2.48),(-1.1,4.24,2.48),.11,'policeBlue')
for idx,y in enumerate([2.25,3.4]):
 before=len(parts); box('Swing seat',(-1.1,y,.62),(.40,.64,.095),'policeBlue',.035)
 for yy in [y-.24,y+.24]:
  # Linked oval chain silhouette, staggered planes; low sided rings.
  for j in range(12):
   z=.78+j*.133; bpy.ops.mesh.primitive_torus_add(major_segments=6,minor_segments=3,location=(-1.1,yy,z),major_radius=.052,minor_radius=.012,rotation=(math.pi/2,0,0) if j%2 else (0,math.pi/2,0)); finish(bpy.context.object,'Chain link','uiDark')
  rod('Seat hanger',(-1.26,yy,.67),(-1.1,yy,.81),.024,'uiDark'); rod('Seat hanger',(-.94,yy,.67),(-1.1,yy,.81),.024,'uiDark')
 assembly('swing'+str(idx+1),parts[before:],(-1.1,y,2.48))
# Bring the swing set forward to match the reference grouping.
for o in parts:
 if o.parent==root and o.name.startswith(('Swing A','Swing brace','Swing overhead')):o.location.x+=.85
for name in ['swing1','swing2']:bpy.data.objects[name].location.x+=.85
# Spring duck, a thick sculpted toy silhouette with raised eyes and broad beak.
dx,dy=2.65,-.50
rod('Duck base',(dx,dy,.10),(dx,dy,.18),.30,'policeBlue',16)
pts=[(dx+.145*math.cos(i*math.tau/12),dy+.145*math.sin(i*math.tau/12),.20+i*.0075) for i in range(49)]
tube('Spring coil',pts,.028,'uiDark',6)
before=len(parts)
ball('Duck body',(dx,dy,.72),(.40,.21,.25),'schoolBusYellow'); ball('Duck neck',(dx+.29,dy,.88),(.18,.19,.29),'schoolBusYellow'); ball('Duck head',(dx+.36,dy,1.10),(.24,.22,.25),'schoolBusYellow')
box('Duck saddle',(dx-.08,dy,.89),(.35,.32,.065),'schoolBusYellow',.03)
ball('Duck tail',(dx-.39,dy,.78),(.10,.23,.21),'survivorRed'); ball('Duck beak',(dx+.61,dy,1.02),(.19,.19,.085),'survivorRed')
for s in [-1,1]:
 ball('Eye rim',(dx+.46,dy+s*.192,1.16),(.085,.036,.087),'woodWarm'); ball('Eye',(dx+.47,dy+s*.224,1.17),(.060,.019,.065),'uiDark'); ball('Eye glint',(dx+.49,dy+s*.240,1.20),(.021,.010,.022),'picketWhite')
 rod('Duck grip',(dx+.29,dy+s*.17,1.36),(dx+.29,dy+s*.25,1.36),.035,'schoolBusYellow')
assembly('springDuck',parts[before:],(dx,dy,.55))
# Join static material groups and each articulated material group.
for parent in [root,bpy.data.objects['swing1'],bpy.data.objects['swing2'],bpy.data.objects['springDuck']]:
 for mat in M.values():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+mat.name
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']; tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
report=dict(id='kit.playground',tier='Side',triangles=tris,draw_calls=sum(len(o.data.materials) for o in meshes),materials=sorted({m.name for o in meshes for m in o.data.materials}),nodes_ok=all(bpy.data.objects.get(n) for n in ['root','swing1','swing2','springDuck']),within_budget=6000<=tris<=12000 and len(meshes)<=30,rounds=5,webgpu_ok=False,webgl2_ok=False,gaps=[])
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 sys.path.insert(0,str(OUT.parents[1]/'tools'/'blender')); from sslib import ao
 ao.bake_all(meshes,samples=32)
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
 scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True; scene.world.use_nodes=True; scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.14,.12,.18,1); scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02)); floor=bpy.context.object; mat=bpy.data.materials.new('Stage'); mat.use_nodes=True; mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.014,.011,.019,1); floor.data.materials.append(mat)
 def aim(o,t):o.rotation_euler=(Vector(t)-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((2,-6,9),1800,7,(1,.80,.60)),((-5,2,7),1300,6,(.63,.72,1)),((4,6,5),900,5,(1,.64,.35))]:
  bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; aim(o,(0,0,1))
 views={'ref':(12,-15,10),'game':(12,-15,17),'front':(18,0,8),'side':(0,-18,8),'rear':(-18,0,8)}
 bpy.ops.object.camera_add(location=views[a.view]); cam=bpy.context.object; aim(cam,(0,0,1.3)); cam.data.type='ORTHO'; cam.data.ortho_scale=13.5; scene.camera=cam
 scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'; scene.view_settings.exposure=-.35; scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
