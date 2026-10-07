"""House C: deterministic, texture-free backyard diorama, +X front, metres."""
import argparse, hashlib, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import simplify as simplify_lod

P=Path(__file__).resolve().parent
fingerprint=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
p=argparse.ArgumentParser()
p.add_argument('--lod',type=int,default=0);p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
def build_scene():
 rng=random.Random(37);materials={};groups={}
 def mat(t,h,em=False,metal=0):
  m=bpy.data.materials.new(('emi_' if em else 'pal_')+t);m.use_nodes=True
  c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
  m.diffuse_color=c;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=.62;b.inputs['Metallic'].default_value=metal
  if em:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=1.5
  materials[m.name]=m;return m
 cream=mat('picketWhite','f2e6dc');siding=mat('sidewalk','d1b59b');wood=mat('woodWarm','b0703f');dark=mat('uiDark','30303e',metal=.15);slate=mat('asphalt','403848');green=mat('foliage','7da23c');grass=mat('grass','6f8f3a');red=mat('survivorRed','d9363e');yellow=mat('schoolBusYellow','f2b630');blue=mat('backpackTeal','2f6e6a');glow=mat('windowGlow','ffb344',True)
 slate.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
 slate.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.1
 root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
 def empty(n,loc=(0,0,0),parent=root):
  o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
 roof=empty('roof');interior=empty('interior');door=empty('door_back',(0,-.46,.85));lid=empty('door_grill_lid',(.75,-2.05,1.72))
 def finish(o,m,b=0,group='body'):
  o.data.materials.append(m)
  if b:
   weights=o.data.attributes.new(name='bevel_weight_edge',type='FLOAT',domain='EDGE')
   for value in weights.data:value.value=b/.03
  if a.lod==2 and group!='roof':group='body'
  groups.setdefault((group,m.name),[]).append(o);return o
 def box(n,loc,size,m,b=.018,group='body'):
  vertices=[(x*size[0]/2,y*size[1]/2,z*size[2]/2) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
  o=mesh(n,vertices,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],m,group,min(b,min(size)*.25));o.location=loc;return o
 def mesh(n,v,f,m,group='body',b=0):
  me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,m,b,group)
 def cyl(n,loc,r,d,m,N=16,group='body'):
  vertices=[(r*math.cos(i*math.tau/N),r*math.sin(i*math.tau/N),z) for z in [-d/2,d/2] for i in range(N)]
  faces=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
  o=mesh(n,vertices,faces,m,group,(min(.008,r*.2) if r>.025 else 0));o.location=loc;return o
 sphere_templates={}
 def ball(n,loc,scale,m,group='body',sub=1):
  if sub not in sphere_templates:
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1)
   template=bpy.context.object;sphere_templates[sub]=([tuple(v.co) for v in template.data.vertices],[tuple(f.vertices) for f in template.data.polygons]);bpy.data.objects.remove(template,do_unlink=True)
  vertices,faces=sphere_templates[sub]
  o=mesh(n,[(v[0]*scale[0],v[1]*scale[1],v[2]*scale[2]) for v in vertices],faces,m,group);o.location=loc;return o
 def beam(n,start,end,r,m,group='body',N=10):
  v=Vector(end)-Vector(start);o=cyl(n,(Vector(start)+Vector(end))/2,r,v.length,m,N,group);o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return o
 # Ground contact plot, stone foundation, wooden support frame.
 box('lawn island',(.2,0,.08),(8.6,7.3,.16),grass,.08)
 box('foundation',(-1.85,0,.45),(3.8,6,.62),slate,.045)
 box('interior floor',(-1.85,0,.79),(3.64,5.84,.13),wood,group='interior')
 # Walls are actual separate cladding boards; offsets reveal seams.
 for j in range(14):
  z=.98+j*.224
  for y in [-3,3]:box('gable siding',(-1.85,y,z),(3.8,.14,.213),siding,.012)
  for x in [-3.75,.05]:box('eave siding',(x,0,z),(.14,6,.213),siding,.012)
 # Triangular ends, clad with clipped horizontal strips.
 for y in [-3,3]:
  mesh('solid gable infill',[(-3.75,y,3.98),(.05,y,3.98),(-1.85,y,5.58)],[(0,1,2)],siding)
  for j in range(8):
   bottom=4.0+j*.22;top=min(5.64,bottom+.211)
   lower=min(1.9,(5.65-bottom)/(1.6/2.08));upper=min(1.9,(5.65-top)/(1.6/2.08))
   profile=[(-1.85-lower,bottom),(-1.85+lower,bottom),(-1.85+upper,top),(-1.85-upper,top)]
   vertices=[(x,yy,z) for yy in [y-.07,y+.07] for x,z in profile]
   mesh('clipped gable clapboard',vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],siding,b=.009)
 for x in [-3.79,.10]:
  for y in [-3.05,3.05]:box('corner pilaster',(x,y,2.43),(.17,.18,3.24),cream)
 for x in [-3.81,.12]:box('base skirt',(x,0,.89),(.18,6.16,.20),cream)
 # Gable roof panels and individually stepped slate tiles.
 slope=1.6/2.08;angle=math.atan(slope)
 for side in [-1,1]:
  x=-1.85+side*1.05;z=4.82
  o=box('roof underlay',(x,0,z),(2.66,6.62,.13),dark,.01,'roof');o.rotation_euler.y=side*angle
  for row in range(7):
   distance=.16+row*.298;x=-1.85+side*distance;z=5.65-distance*slope+.09+row*.006
   for col in range(14):
    y=-3.1+col*.465+(row%2)*.08
    o=box('overlapping slate shingle',(x,y,z),(.395,.446,.055),slate,.012,'roof');o.rotation_euler.y=side*angle
 for y in [-3.34,3.34]:beam('cream gable fascia',(-4.02,y,4.0),(-1.85,y,5.65),.075,cream,'roof',4);beam('cream gable fascia',(-1.85,y,5.65),(.32,y,4.0),.075,cream,'roof',4)
 for x in [-4.01,.31]:box('eave trim',(x,0,3.98),(.14,6.65,.18),cream,.016,'roof')
 for j in range(16):box('ridge cap',(-1.85,-3.2+j*.424,5.70),(.24,.41,.115),dark,.023,'roof')
 # Windows: glowing inset panes, deep sill, proud casings, four lights.
 def window(x,y,z,w=1.12,h=1.32,axis='X',lit=True):
  def part(n,u,v,d,ww,hh,dd,m):
   loc=(x+(-d if axis=='-X' else d),y+u,z+v) if axis in ['X','-X'] else (x+u,y+(d if axis=='-Y' else -d),z+v)
   size=(dd,ww,hh) if axis in ['X','-X'] else (ww,dd,hh)
   return box(n,loc,size,m,.012,'window' if m==glow else 'body')
  part('window recess',0,0,.09,w+.2,h+.18,.06,dark)
  part('glass panes',0,0,.132,w,h,.026,glow if lit else dark)
  for u in [-w/2-.055,w/2+.055]:part('side casing',u,0,.18,.13,h+.25,.16,cream)
  for v in [-h/2-.06,h/2+.06]:part('header sill',0,v,.21,w+.38,.14,.23,cream)
  part('centre mullion',0,0,.18,.045,h,.072,wood)
  part('cross mullion',0,0,.18,w,.045,.072,wood)
 window(.1,-1.85,2.2);window(.1,1.93,2.52,1.12,1.5)
 window(-2.93,-3.05,1.75,.82,1.18,'Y');window(-1.34,-3.05,2.26,1.05,1.3,'Y');window(-1.85,-3.05,4.45,.76,.88,'Y',False)
 window(-3.84,.9,2.2,axis='-X',lit=False)
 window(-1.85,3.05,2.26,1.05,1.3,'-Y',False)
 # Back door and hardware remain hinged at left side; casing static.
 box('door slab',(.15,0,1.87),(.15,.86,2.02),wood,.022,'door')
 box('door glazing',(.237,0,2.18),(.028,.62,1.08),glow,.008,'door')
 for y in [-.33,0,.33]:box('door sash',(.27,y,2.18),(.046,.044,1.15),cream,.006,'door')
 box('door transom',(.27,0,2.18),(.046,.66,.045),cream,.005,'door')
 box('raised bottom panel',(.242,0,1.22),(.04,.65,.45),siding,.012,'door')
 ball('door brass knob',(.31,.30,1.74),(.055,.035,.035),yellow,'door',2)
 for y in [-.52,.52]:box('door trim',(.2,y,1.89),(.23,.15,2.2),cream)
 box('door lintel',(.22,0,2.99),(.25,1.18,.16),cream)
 # Gutter/downpipe and wall fittings are raised clear of siding.
 beam('rain pipe',(.24,-2.97,3.91),(.24,-2.97,.98),.052,slate)
 beam('rain shoe',(.24,-2.97,.98),(.43,-2.97,.84),.054,slate)
 for z in [1.1,2.5,3.7]:box('pipe straps',(.255,-2.97,z),(.13,.15,.044),cream)
 box('power socket',(-3.35,-3.15,1.1),(.18,.09,.25),slate)
 # Deck boards and raised joist rim.
 for j in range(24):box('deck plank',(1.88,-2.98+j*.257,.82),(3.62,.247,.13),wood,.016)
 for x in [.4,1.4,2.4,3.4]:box('joist',(x,0,.62),(.13,6.25,.20),wood)
 for y in [-3.18,3.18]:box('deck rim',(1.88,y,.67),(3.84,.18,.36),wood)
 box('front rim',(3.79,0,.67),(.18,6.45,.36),wood)
 # Rails around deck with purposeful opening at the front stair.
 def post(x,y,tall=False,h=None):
  h=h if h is not None else (2.50 if tall else 1.77)
  box('railing post',(x,y,(.18+h)/2),(.18,.18,h-.18),wood)
  box('post foot collar',(x,y,.63),(.245,.245,.19),wood)
  box('square post cap',(x,y,h+.04),(.29,.29,.10),wood,.03)
  if tall:box('light post collar',(x,y,1.7),(.24,.24,.10),wood)
 def railing(start,end):
  x,y=start;xx,yy=end;L=math.hypot(xx-x,yy-y)
  for z in [1.03,1.66]:
   o=box('rail',((x+xx)/2,(y+yy)/2,z),(L+.12,.12,.14),wood);o.rotation_euler.z=math.atan2(yy-y,xx-x)
  for j in range(1,int(L/.25)):
   t=j/int(L/.25);box('baluster',(x+(xx-x)*t,y+(yy-y)*t,1.34),(.068,.068,.56),wood,.009)
 for y in [-3.15,3.15]:
  for x in [.3,1.95,3.8]:post(x,y,tall=(y>0))
  railing((.3,y),(1.95,y));railing((1.95,y),(3.8,y))
 for y in [-1.1,.5,1.95]:post(3.8,y)
 for ya,yb in [(-3.15,-1.1),(-1.1,.5),(1.95,3.15)]:railing((3.8,ya),(3.8,yb))
 for j in range(4):
  x=3.95+j*.28;h=.74-j*.18
  box('stair tread',(x,1.22,h),( .39,1.48,.10),wood,.024)
  box('stair riser',(x+.10,1.22,h-.12),(.12,1.40,.18),wood)
 for y in [.5,1.95]:
  post(4.75,y,h=.82)
  beam('sloping stair handrail',(3.80,y,1.66),(4.8,y,.88),.06,wood,N=4)
 # Grill cart: curved barrel, shelves, hardware and wheels; hinged lid.
 box('grill cabinet',(1.15,-2.05,1.28),(.66,1.01,.61),dark,.035)
 for y in [-2.38,-1.73]:
  for x in [.88,1.45]:box('cart leg',(x,y,1.0),(.075,.075,.42),dark)
 for y in [-2.48,-1.60]:
  o=cyl('grill wheel',(1.43,y,.96),.105,.055,dark);o.rotation_euler.x=math.pi/2
 box('lower shelf',(1.13,-2.05,1.03),(.6,.9,.055),slate)
 box('grill control fascia',(1.53,-2.05,1.56),(.08,1.05,.18),slate)
 for y in [-2.38,-2.1,-1.82]:ball('chrome burner dial',(1.59,y,1.57),(.024,.047,.047),cream,sub=2)
 for y in [-2.7,-1.4]:box('grill side shelf',(1.14,y,1.61),(.65,.28,.075),dark)
 # Half cylinder with capped sides, hinge at back edge.
 v=[]
 for y in [-2.56,-1.54]:
  for i in range(17):
   t=i*math.pi/16;v.append((1.14+.39*math.cos(t),y,1.72+.39*math.sin(t)))
 f=[tuple(range(16,-1,-1)),tuple(range(17,34))]+[(i,i+1,i+18,i+17) for i in range(16)]+[(0,17,33,16)]
 mesh('barbecue lid',v,f,dark,'lid',.018)
 beam('lid handle',(1.58,-2.30,1.86),(1.58,-1.82,1.86),.035,wood,'lid')
 ball('thermometer',(1.45,-2.05,2.02),(.04,.065,.065),yellow,'lid',2)
 # Table with radial planks and central pedestal.
 tx,ty=2.15,1.38
 cyl('round table',(tx,ty,1.54),.78,.11,wood,48)
 for y in [-.36,-.12,.12,.36]:
  half=math.sqrt(.73**2-y*y);box('table plank seam',(tx,ty+y,1.602),(2*half,.009,.006),slate,.001)
 cyl('table pedestal',(tx,ty,1.19),.095,.6,wood)
 for t in range(4):
  ang=t*math.pi/2;beam('table foot',(tx,ty,1.05),(tx+.5*math.cos(ang),ty+.5*math.sin(ang),.88),.065,wood,N=4)
 # Four slatted chairs, transformed from a local frame.
 for k in range(4):
  ang=k*math.pi/2;cx=tx+1.02*math.cos(ang);cy=ty+1.02*math.sin(ang)
  def chairbox(n,l,s):
   u,v,z=l;x=cx+u*math.cos(ang)-v*math.sin(ang);y=cy+u*math.sin(ang)+v*math.cos(ang)
   o=box(n,(x,y,z),s,wood,.015);o.rotation_euler.z=ang;return o
  for u in [-.21,.21]:
   for v in [-.22,.22]:chairbox('chair leg',(u,v,1.05),(.065,.065,.43))
  for j in range(4):chairbox('seat slat',(-.18+j*.12,0,1.28),(.11,.56,.065))
  for v in [-.25,.25]:chairbox('chair back stile',(.25,v,1.58),(.07,.075,.66))
  for z in [1.48,1.65,1.83]:chairbox('chair back slat',(.25,0,z),(.055,.49,.13))
 # Umbrella pole, faceted canopy, scalloped edge, raised seams and finial.
 cyl('umbrella pole',(tx,ty,2.04),.038,2.43,wood)
 N=10;v=[(tx,ty,3.36)]+[(tx+1.25*math.cos(i*math.tau/N),ty+1.25*math.sin(i*math.tau/N),2.86) for i in range(N)]
 mesh('umbrella canopy',v,[(0,i+1,(i+1)%N+1) for i in range(N)],cream)
 for i in range(N):
  t=i*math.tau/N;tt=(i+1)*math.tau/N
  start=(tx+1.25*math.cos(t),ty+1.25*math.sin(t),2.86);end=(tx+1.25*math.cos(tt),ty+1.25*math.sin(tt),2.86)
  beam('canopy rib',(tx,ty,3.36),start,.012,wood)
  mesh('canopy valance',[start,end,(end[0],end[1],2.73),(start[0],start[1],2.73)],[(0,1,2,3)],cream)
 ball('umbrella finial',(tx,ty,3.41),(.075,.075,.075),wood,sub=2)
 # Ceramic cup, saucer, tabletop planter.
 cyl('saucer',(tx+.36,ty-.15,1.62),.115,.026,cream,24)
 cyl('coffee mug',(tx+.36,ty-.15,1.72),.065,.17,cream,24)
 cyl('coffee surface',(tx+.36,ty-.15,1.81),.052,.006,dark,24)
 beam('mug handle',(tx+.44,ty-.15,1.66),(tx+.46,ty-.15,1.77),.022,cream)
 # Flowers and leaves: clustered low-poly ellipsoids, actual petals and centres.
 def plant(x,y,z,scale=.6,flower=True):
  for j in range(5 if a.lod==2 else 12):
   t=rng.random()*math.tau;r=scale*math.sqrt(rng.random())*.65;zz=z+scale*(.18+rng.random()*.52)
   o=ball('leaf cluster',(x+r*math.cos(t),y+r*math.sin(t),zz),(.24*scale,.13*scale,.18*scale),green);o.rotation_euler=(rng.uniform(-1.2,1.2),rng.uniform(-1.2,1.2),t)
  if flower and a.lod<2:
   for j in range(7):
    t=rng.random()*math.tau;r=scale*rng.random()*.5;px=x+r*math.cos(t);py=y+r*math.sin(t);pz=z+scale*(.65+rng.random()*.35)
    color=[cream,red,yellow,blue][j%4]
    beam('flower stem',(px,py,z+.10),(px,py,pz),.009,grass,N=6)
    for k in range(5):
     t=k*math.tau/5;ball('petal',(px+.054*math.cos(t),py+.054*math.sin(t),pz),(.046,.032,.031),color)
    ball('flower centre',(px,py,pz+.022),(.028,.028,.025),yellow)
 def planter(x,y,z,s=.55):
  box('planter soil',(x,y,z+.22),(s*.92,s*.92,.10),dark)
  for j in range(3):
   for dx,dy,sx,sy in [(s/2,0,.045,s),(-s/2,0,.045,s),(0,s/2,s,.045),(0,-s/2,s,.045)]:box('planter horizontal slat',(x+dx,y+dy,z+.08+j*.12),(sx,sy,.106),wood,.009)
  for dx in [-s/2,s/2]:
   for dy in [-s/2,s/2]:box('planter corner',(x+dx,y+dy,z+.20),(.06,.06,.42),wood)
  plant(x,y,z+.33,s*1.5)
 planter(.51,1.05,.9);planter(.7,-2.65,.9);planter(3.24,2.64,.9)
 cyl('table flowerpot',(tx-.20,ty+.15,1.70),.11,.18,cream);plant(tx-.20,ty+.15,1.79,.25)
 # Continuous lush perimeter keeps stairs clear.
 for j in range(15):
  y=-3.3+j*.47
  if not .35<y<2.1:plant(4.02,y,.15,.65)
 for y in [-3.4,3.4]:
  for j in range(17):plant(-3.7+j*.46,y,.15,.6,flower=(j%2==0))
 for j in range(7):plant(-3.92,-2.7+j*.9,.15,.6)
 # Ivy drapes down rail posts.
 for x,y in [(3.8,3.15),(3.8,-3.15),(.4,-3.15)]:
  for j in range(16):
   z=.28+j*.095;ball('ivy leaves',(x+.12+math.sin(j*1.8)*.12,y+.06,z),(.105,.075,.14),green)
 # Festoon cable over wall and tall rail posts; each bulb has its own joint empty.
 bulbs=[]
 def festoon(start,end,count):
  pts=[]
  for j in range(25):
   t=j/24;pts.append(tuple(start[k]*(1-t)+end[k]*t for k in range(3)))
   pts[-1]=(pts[-1][0],pts[-1][1],pts[-1][2]-.32*math.sin(math.pi*t))
  for u,v in zip(pts,pts[1:]):beam('festoon cable',u,v,.014,dark,N=6)
  for j in range(1,count+1):
   t=j/(count+1);x,y,z=[start[k]*(1-t)+end[k]*t for k in range(3)];z-=.32*math.sin(math.pi*t)
   n='lamp_festoon_%02d'%len(bulbs);g=empty(n,(x,y,z));bulbs.append(n)
   beam('pendant cord',(x,y,z),(x,y,z-.12),.012,dark)
   cyl('bulb socket',(x,y,z-.13),.035,.055,wood)
   ball('warm globe',(x,y,z-.21),(.054,.054,.085),glow,n,2)
 festoon((.30,-3.10,3.17),(.30,3.10,3.43),10)
 festoon((.30,3.10,3.43),(1.95,3.15,2.54),3)
 festoon((1.95,3.15,2.54),(3.8,3.15,2.54),3)
 # Join static geometry by material; roof and hinge groups remain independent.
 parents={'roof':roof,'interior':interior,'door':door,'lid':lid,'window':root,'bulbs':root,'body':root}
 parents.update({n:bpy.data.objects[n] for n in bulbs})
 export_objects=[root,roof,interior,door,lid]
 for (g,m),objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=g+'_'+m
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
  world=o.matrix_world.copy();o.parent=parents[g];o.matrix_world=world
  normals=bmesh.new();normals.from_mesh(o.data);bmesh.ops.recalc_face_normals(normals,faces=list(normals.faces));normals.to_mesh(o.data);normals.free()
  bevel=o.modifiers.new('soft edges','BEVEL');bevel.width=.03;bevel.segments=1;bevel.limit_method='WEIGHT';bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
  if a.lod:
   simplify_lod(o, {1:.55,2:.25}[a.lod])
  clean=bmesh.new();clean.from_mesh(o.data);bmesh.ops.triangulate(clean,faces=list(clean.faces))
  tiny=[face for face in clean.faces if face.calc_area()<1e-8]
  if tiny:bmesh.ops.delete(clean,geom=tiny,context='FACES_ONLY')
  clean.to_mesh(o.data);clean.free()
  export_objects.append(o)
  for poly in o.data.polygons:poly.use_smooth=False
  # Weighted normals keep planar surfaces clean around bevels.
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Deterministic 32-ray hemisphere AO, baked into the game colour attribute.
 vertices=[];faces=[]
 meshes=[o for o in export_objects if o.type=='MESH']
 for o in meshes:
  offset=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices);faces.extend(tuple(offset+i for i in f.vertices) for f in o.data.polygons)
 tree=BVHTree.FromPolygons(vertices,faces)
 directions=[Vector((math.sqrt(1-((i+.5)/32)**2)*math.cos(i*2.399963),math.sqrt(1-((i+.5)/32)**2)*math.sin(i*2.399963),(i+.5)/32)) for i in range(32)]
 for o in meshes:
  ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
  for v,c in zip(o.data.vertices,ao.data):
   point=o.matrix_world@v.co;normal=(o.matrix_world.to_3x3()@v.normal).normalized();rotation=normal.to_track_quat('Z','Y');occlusion=0
   for direction in directions:
    hit,_,_,distance=tree.ray_cast(point+normal*.004,rotation@direction,1.2)
    if hit is not None:occlusion+=1-distance/1.2
   value=1-.6*occlusion/32;c.color=(value,value,value,1)
 # Light anchors reference emissive nodes and valid light colour tokens.
 for name,loc,nodes,kind in [('windows',(.45,0,2.3),['window_emi_windowGlow','door_emi_windowGlow'],'window'),('festoon',(2,2,2.5),[n+'_emi_windowGlow' for n in bulbs],'point')]:
  if a.lod==2:nodes=['body_emi_windowGlow']
  anchor=empty('light:'+name,loc);anchor['ss_light']={'type':kind,'color':'light_window_warm','intensity':2.5,'range':4,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','powerGroup':'block:residential','breakable':True,'emissiveNodes':nodes,'tiers':'all'};export_objects.append(anchor)
 export_objects+= [bpy.data.objects[n] for n in bulbs]
 col=empty('col:house',(-1.85,0,2.05));col['collider']={'type':'cuboid','size':[3.8,6,4.1]};export_objects.append(col)
 root['asset_id']='bld.house-c';root['tier']='Hero';root['ss_physics']={'body':'fixed','friction':.8,'restitution':0}
 triangles=sum(len(o.data.polygons) for o in export_objects if o.type=='MESH')
 for o in export_objects:
  if o.type=='MESH':o.data.calc_loop_triangles()
 triangles=sum(len(o.data.loop_triangles) for o in export_objects if o.type=='MESH')
 report={'id':'bld.house-c','tier':'Hero','triangles':triangles,'draw_calls':sum(len(o.data.materials) for o in export_objects if o.type=='MESH'),'materials':sorted(materials),'nodes_ok':all(n in bpy.data.objects for n in ['root','roof','interior','door_back']),'within_budget':triangles<=100000 and sum(o.type=='MESH' for o in export_objects)<=40,'rounds':1,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
 (P/('geometry.json' if not a.lod else 'geometry-lod%d.json'%a.lod)).write_text(json.dumps(report,indent=2))
 return report,export_objects

cache=P/'scene.blend'
if cache.exists() and (P/'scene.sha256').exists() and (P/'scene.sha256').read_text()==fingerprint:
 bpy.ops.wm.open_mainfile(filepath=str(cache))
 report=json.loads((P/'geometry.json').read_text());export_objects=list(bpy.context.scene.objects)
 if a.lod:
  for o in export_objects:
   if o.type=='MESH':simplify_lod(o, {1:.55,2:.25}[a.lod], planar_only=o.data.materials[0].name.startswith('emi_'))
  report['triangles']=sum(len(o.data.loop_triangles) for o in export_objects if o.type=='MESH')
  (P/('geometry-lod%d.json'%a.lod)).write_text(json.dumps(report,indent=2))
else:
 report,export_objects=build_scene()
 if not a.lod:
  bpy.ops.wm.save_as_mainfile(filepath=str(cache));(P/'scene.sha256').write_text(fingerprint)
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in export_objects:o.select_set(True)
 Path(a.glb).parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
# Preview studio uses only non-exported lighting, no second ground plane.
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
 if scene.world is None:scene.world=bpy.data.worlds.new('studio world')
 scene.world.color=(.16,.16,.16)
 def area(n,loc,power,color,size,target=(0,0,1)):
  data=bpy.data.lights.new(n,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;o=bpy.data.objects.new(n,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 area('soft golden key',(3,-5,10),1500,(1,.75,.49),7);area('cool fill',(-5,-1,7),1100,(.65,.73,1),8);area('warm rim',(1,6,8),1700,(1,.65,.35),6)
 for loc in [( .65,-1.85,2.3),(.65,1.9,2.5)]:
  data=bpy.data.lights.new('window spill','POINT');data.energy=22;data.color=(1,.49,.12);data.shadow_soft_size=.7;o=bpy.data.objects.new('window spill',data);bpy.context.collection.objects.link(o);o.location=loc
 data=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',data);bpy.context.collection.objects.link(cam)
 views={'ref':(12,-16,12),'game':(12,-12,15),'front':(16,0,8),'rear':(-15,12,10),'side':(0,-18,9)}
 points=[o.matrix_world@v.co for o in export_objects if o.type=='MESH' for v in o.data.vertices]
 def frame(view):
  offset=Vector(views[view]);rotation=(-offset).to_track_quat('-Z','Y');right=rotation@Vector((1,0,0));up=rotation@Vector((0,1,0))
  horizontal=[point.dot(right) for point in points];vertical=[point.dot(up) for point in points]
  centre=right*((min(horizontal)+max(horizontal))/2)+up*((min(vertical)+max(vertical))/2)
  cam.location=centre+offset;cam.rotation_euler=rotation.to_euler();data.ortho_scale=max(max(horizontal)-min(horizontal),(max(vertical)-min(vertical))*a.width/a.height)*1.10
 data.type='ORTHO';frame(a.view);scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(a.render).resolve());Path(a.render).parent.mkdir(parents=True,exist_ok=True)
 scene.render.film_transparent=False;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.058,.075,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
 bpy.ops.render.render(write_still=True)
 if a.view=='ref':
  # Review pairs share one built scene and one scheduled render slot.
  frame('game')
  scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
  name=Path(a.render).name.replace('-ref','-game').replace('hero.png','game.png')
  if name==Path(a.render).name:name='game.png'
  scene.render.filepath=str(Path(a.render).with_name(name).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
