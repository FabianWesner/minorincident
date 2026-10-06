"""Sunset Grove gazebo: deterministic, texture-free, +X entrance, metres, Z up."""
import argparse, json, math, random, struct, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
OUT=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(24024); mats={}; objects=[]
def material(token,hex,emission=0):
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token); m.diffuse_color=(*hex,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*hex,1); bs.inputs['Roughness'].default_value=.72
    if emission: bs.inputs['Emission Color'].default_value=(*hex,1); bs.inputs['Emission Strength'].default_value=emission
    mats[token]=m
material('picketWhite',(.89,.80,.70)); material('asphalt',(.038,.024,.064)); material('uiDark',(.026,.030,.044))
material('sidewalk',(.53,.37,.34)); material('woodWarm',(.43,.18,.055)); material('grass',(.19,.28,.035))
material('foliage',(.31,.43,.055)); material('schoolBusYellow',(.95,.53,.055)); material('survivorRed',(.8,.055,.19))
material('windowGlow',(1,.55,.16),5)
def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; o.location=loc; return o
root=empty('root'); root['asset_id']='bld.gazebo'; root['category']='building'
roof=empty('roof',root); interior=empty('interior',root)
empty('front',root,(3,0,1))['front']=True

def finish(o,name,mat,parent=None,bevel=0):
    o.name=name; o.parent=parent or root; o.data.materials.append(mats[mat]); bpy.context.view_layer.objects.active=o
    if tuple(o.scale)!=(1.0,1.0,1.0):
        o.data.transform(Matrix.Diagonal((*o.scale,1))); o.scale=(1,1,1)
    if bevel:
        bm=bmesh.new(); bm.from_mesh(o.data)
        edges=[e for e in bm.edges if abs(e.verts[0].co.z-e.verts[1].co.z)>.001] if len(bm.verts)==8 and len(bm.faces)==6 else list(bm.edges)
        bmesh.ops.bevel(bm,geom=edges,offset=bevel,segments=1,affect='EDGES',clamp_overlap=True)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    objects.append(o); return o

def box(name,loc,size,mat='picketWhite',bevel=.025,parent=None,angle=0):
    vs=[(x*size[0]/2,y*size[1]/2,z*size[2]/2) for z in [-1,1] for y in [-1,1] for x in [-1,1]]
    o=mesh(name,vs,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],mat,parent,bevel)
    o.location=loc; o.rotation_euler[2]=angle; return o
def rod(name,start,end,r,mat='uiDark',n=8,parent=None):
    start=Vector(start); end=Vector(end); d=(end-start).normalized(); u=d.cross(Vector((0,0,1)))
    if u.length<.01: u=Vector((1,0,0))
    u.normalize(); v=d.cross(u)
    vs=[p+r*(u*math.cos(j*math.tau/n)+v*math.sin(j*math.tau/n)) for p in [start,end] for j in range(n)]
    return mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],mat,parent)
def sphere(name,loc,scale,mat,parent=None,n=10):
    vs=[(0,0,scale[2]),(0,0,-scale[2])]
    for row in range(1,3):
        t=row*math.pi/3
        vs.extend([(math.sin(t)*math.cos(j*math.tau/n)*scale[0],math.sin(t)*math.sin(j*math.tau/n)*scale[1],math.cos(t)*scale[2]) for j in range(n)])
    fs=[]
    for j in range(n):
        q=(j+1)%n; fs.extend([(0,2+j,2+q),(1,2+n+q,2+n+j)])
        for row in range(1):
            k=2+row*n; fs.append((k+j,k+n+j,k+n+q,k+q))
    o=mesh(name,vs,fs,mat,parent); o.location=loc; return o
def mesh(name,verts,faces,mat,parent=None,bevel=0):
    m=bpy.data.meshes.new(name); m.from_pydata(verts,[],faces); m.update(); o=bpy.data.objects.new(name,m); bpy.context.collection.objects.link(o)
    return finish(o,name,mat,parent,bevel)
def polar(r,t,z): return Vector((r*math.cos(t),r*math.sin(t),z))
def octagon(name,r,z,h,mat,parent=None,bevel=.025):
    verts=[polar(r,math.pi/8+j*math.tau/8,zz) for zz in [z,z+h] for j in range(8)]
    return mesh(name,verts,[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)],mat,parent,bevel)
def beam(name,start,end,width=.12,mat='picketWhite',parent=None,bevel=.018):
    d=Vector(end)-Vector(start); o=box(name,(Vector(start)+Vector(end))/2,(width,width,d.length),mat,bevel,parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
# Individual pavers, curb blocks and raised octagonal deck.
octagon('park soil',5.1,0,.18,'grass')
for j in range(32):
    t=j*math.tau/32; box('curb stone',polar(5.05,t,.22),(.96,.37,.38),'sidewalk',.055,angle=t+math.pi/2)
for ix in range(-6,7):
    for iy in range(-6,7):
        x=ix*.72; y=iy*.72+(ix%2)*.14
        if x*x+y*y<23 and (x>1.9 or x*x+y*y<9):
            o=box('separate paving slab',(x,y,.235),(.70,.69,.13),'sidewalk',0); o.rotation_euler[2]=rng.uniform(-.06,.06)
octagon('deck foundation',3.07,.22,.37,'sidewalk',interior)
octagon('deck edge molding',3.13,.54,.12,'picketWhite',interior)
# Octagonal radiating floor paving, each wedge physically separated.
for j in range(8):
    t0=math.pi/8+j*math.tau/8; t1=t0+math.tau/8
    for row in range(4):
        r0=.06+row*.73; r1=r0+.70
        vs=[polar(r,t,.668) for r,t in [(r0,t0+.008),(r1,t0+.008),(r1,t1-.008),(r0,t1-.008)]]
        mesh('floor flagstone',vs+[(v.x,v.y,.61) for v in vs],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'sidewalk',interior,0)
for i in range(3): box('entrance step',(3.13+i*.37,0,.56-i*.14),(.68,2.32,.20),'sidewalk',.045,interior)
col=empty('col:deck',root,(0,0,.43)); col['collider']='cylinder'; col['radius']=2.82; col['height']=.42
# Eight columns with feet, collars, capitals and brass fasteners.
verts=[polar(2.91,math.pi/8+j*math.tau/8,0) for j in range(8)]
for j,v in enumerate(verts):
    x,y=v.x,v.y
    col=empty('col:post_%02d'%j,root,(x,y,2.13)); col['collider']='cuboid'; col['size']=[.20,.20,2.95]
    box('white timber column',(x,y,2.13),(.20,.20,2.95))
    for z,w,h in [(.72,.34,.24),(1.0,.25,.10),(2.92,.245,.095),(3.42,.31,.19)]: box('post molding',(x,y,z),(w,w,h),bevel=0)
    for z in [1.02,2.90,3.35]: sphere('brass bolt',(x+.111,y,z),(.018,.025,.025),'schoolBusYellow',n=3)
    nxt=verts[(j+1)%8]; d=nxt-v; t=math.atan2(d.y,d.x)
    for z,w,h in [(3.51,.24,.24),(3.68,.32,.12)]: box('octagonal header',(v+nxt)/2+Vector((0,0,z)),(d.length+.13,w,h),bevel=.023,parent=roof,angle=t)
    for u in [.0,1.0]:
        start=v if u==0 else nxt; sign=1 if u==0 else -1
        beam('diagonal knee brace',start+Vector((0,0,2.88)),start+d.normalized()*sign*.58+Vector((0,0,3.45)),.145,parent=roof,bevel=0)
    if j==7: continue # front opening between +/-22.5 degrees
    for z,w,h in [(1.64,.16,.14),(.84,.12,.11)]: box('railing', (v+nxt)/2+Vector((0,0,z)),(d.length-.1,w,h),bevel=0,angle=t)
    for k in range(1,9):
        pos=v+d*k/9; box('railing spindle',(pos.x,pos.y,1.22),(.072,.072,.71),bevel=0)
# Roof base and individually staggered trapezoid shingle tiles.
def shingled(name,r0,r1,z0,z1,rows,parent):
    for j in range(8):
        t0=math.pi/8+j*math.tau/8; t1=t0+math.tau/8
        mesh(name+' underlay',[polar(r0,t0,z0),polar(r0,t1,z0),polar(r1,t1,z1),polar(r1,t0,z1)],[(0,1,2,3)],'asphalt',parent)
        for row in range(rows):
            u=row/rows; v=(row+.94)/rows
            ra=r0+(r1-r0)*u; rb=r0+(r1-r0)*v; lift=.028+(rows-row)*.006; za=z0+(z1-z0)*u+lift; zb=z0+(z1-z0)*v+lift
            count=max(1,round(ra*.765/.39)); shift=.5 if row%2 else 0
            cuts=sorted(set([0,1]+[max(0,min(1,(k+shift)/count)) for k in range(count+1)]))
            for c0,c1 in zip(cuts,cuts[1:]):
                if c1-c0<.02: continue
                # Linear edge interpolation makes a truly planar octagonal roof facet.
                lo0=polar(ra,t0,za); lo1=polar(ra,t1,za); hi0=polar(rb,t0,zb); hi1=polar(rb,t1,zb)
                q=[lo0.lerp(lo1,c0+.009),lo0.lerp(lo1,c1-.009),hi0.lerp(hi1,c1-.009),hi0.lerp(hi1,c0+.009)]
                mesh('thick shingle',q+[v-Vector((0,0,.052)) for v in q],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'asphalt',parent,0)
        # Continuous hip trim preserves the silhouette without tiny repeated caps.
        beam('hip ridge cap',polar(r0,t0,z0+.095),polar(r1,t0,z1+.07),.085,'woodWarm',parent,bevel=0)
shingled('main roof',3.43,.64,3.73,5.10,6,roof)
# Lantern cupola with diamond lattice and a recessed dark ventilation baffle.
rod('cupola inner baffle',(0,0,5.26),(0,0,5.76),.49,'uiDark',8,roof)
octagon('cupola plinth',.73,5.05,.15,'picketWhite',roof)
for j in range(8):
    t=math.pi/8+j*math.tau/8; t2=t+math.tau/8; s=polar(.65,t,5.2); e=polar(.65,t2,5.2)
    box('cupola post',(s.x,s.y,5.50),(.075,.075,.65),parent=roof,bevel=0)
    d=e-s
    for z in [5.23,5.79]: beam('cupola rail',(s.x,s.y,z),(e.x,e.y,z),.075,parent=roof,bevel=0)
    for u,v in [(0,.5),(.5,1)]:
        beam('diamond lattice',s+d*u+Vector((0,0,.12)),s+d*v+Vector((0,0,.52)),.029,parent=roof,bevel=0)
        beam('diamond lattice',s+d*u+Vector((0,0,.52)),s+d*v+Vector((0,0,.12)),.029,parent=roof,bevel=0)
octagon('cupola cornice',.76,5.79,.12,'picketWhite',roof)
shingled('cupola roof',.83,.06,5.92,6.46,4,roof)
for z,r,h in [(6.47,.11,.07),(6.56,.07,.12),(6.83,.025,.24)]: rod('gold finial',(0,0,z),(0,0,z+h),r,'schoolBusYellow',12,roof)
sphere('finial ball',(0,0,6.72),(.10,.10,.13),'schoolBusYellow',roof)
# Interior slatted park benches, oriented along rear sides.
for j in [2,3]:
    v=verts[j]; nxt=verts[(j+1)%8]; center=(v+nxt)/2*.79; d=(nxt-v).normalized(); n=Vector((-d.y,d.x,0)); t=math.atan2(d.y,d.x)
    def bp(u,w,z): return center+d*u+n*w+Vector((0,0,z))
    for u in [-.65,.65]:
        for w in [-.19,.21]: beam('cast bench leg',bp(u,w,.68),bp(u,w,1.18),.07,'uiDark',interior)
        beam('back support',bp(u,-.23,1.12),bp(u,-.32,1.89),.065,'uiDark',interior)
        beam('bench arm',bp(u,-.22,1.48),bp(u,.27,1.48),.06,'uiDark',interior)
    for w in [-.20,0,.20]: box('seat slat',bp(0,w,1.21),(1.75,.18,.085),'woodWarm',.025,interior,t)
    for z in [1.52,1.72,1.91]: box('back slat',bp(0,-.30,z),(1.75,.08,.16),'woodWarm',.024,interior,t)
# String lights: physically sagged cable and sockets; one controllable lamp mesh per span.
for j in range(8):
    s=verts[j]*.98; e=verts[(j+1)%8]*.98; lp=empty('lamp_string_%02d'%j,roof,(s.x,s.y,3.4))
    for k in range(6):
        def at(u):
            pos=s.lerp(e,u); return Vector((pos.x,pos.y,3.44-.33*math.sin(math.pi*u)))
        rod('festoon cable',at(k/6),at((k+1)/6),.013,'uiDark',3,roof)
    for k in range(1,6):
        pos=at(k/6); rod('bulb socket',pos,pos-Vector((0,0,.075)),.033,'uiDark',3,roof)
        o=sphere('string bulb',pos-Vector((0,0,.12)),(.049,.049,.073),'windowGlow',roof,n=6); o['lamp_span']=j
# Standalone lanterns, fluted bases, open metal cages and luminous panes.
for j,y in enumerate([-3.55,3.55]):
    x=2.35; lamp=empty('lamp_park_%d'%j,root,(x,y,3.02))
    box('lamp footing',(x,y,.35),(.43,.43,.35),'uiDark',.045)
    for z,r,h in [(.51,.22,.12),(.68,.14,.23),(.86,.105,.10),(2.66,.11,.12),(2.8,.075,.13)]: rod('lamp turned molding',(x,y,z),(x,y,z+h),r,'uiDark',12)
    rod('lamp shaft',(x,y,.79),(x,y,2.8),.060,'uiDark',12)
    rod('lantern lower rim',(x,y,2.95),(x,y,3.03),.27,'schoolBusYellow',4)
    o=box('lantern glowing panes',(x,y,3.28),(.33,.33,.51),'windowGlow',.02); o['park_lamp']=j
    for dx in [-.20,.20]:
        for dy in [-.20,.20]: beam('lantern cage',(x+dx*.8,y+dy*.8,3.02),(x+dx,y+dy,3.58),.035,'uiDark')
    # Four-sided tapered lantern roof.
    vs=[(x+dx,y+dy,3.58) for dx,dy in [(-.30,-.30),(.30,-.30),(.30,.30),(-.30,.30)]]+[(x,y,3.88)]
    mesh('lantern cap',vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'asphalt',bevel=.018)
    sphere('lantern finial',(x,y,3.9),(.07,.07,.08),'schoolBusYellow')
# Slatted rubbish bin.
x,y=3.62,-2.16
rod('bin dark barrel',(x,y,.26),(x,y,1.06),.34,'uiDark',24)
for j in range(12):
    t=j*math.tau/12; box('bin slat',(x+.33*math.cos(t),y+.33*math.sin(t),.67),(.07,.06,.75),'asphalt',0,angle=t)
for z in [.3,1.03,1.12]:
    bpy.ops.mesh.primitive_torus_add(major_radius=.335,minor_radius=.035,major_segments=24,minor_segments=6,location=(x,y,z)); finish(bpy.context.object,'bin lip','sidewalk')
rod('bin recessed opening',(x,y,1.025),(x,y,1.037),.296,'uiDark',24)
# Park sign: actual arch silhouette and raised, extruded letters, front normal +X.
sx,sy=3.8,1.80
for yy in [sy-1.10,sy+1.10]:
    box('sign pedestal',(sx,yy,.30),(.30,.30,.25),'sidewalk',.025)
    box('sign post',(sx,yy,.97),(.12,.14,1.45),'uiDark',.022)
def plaque(name,x,thick,w,bottom,top,mat,bevel=.022):
    outline=[(-w/2,bottom),(w/2,bottom),(w/2,top-.10)]
    outline += [(w/2-i*w/20,top+.26*math.sin(i*math.pi/20)) for i in range(21)]
    vs=[(xx,sy+u,z) for xx in [x-thick/2,x+thick/2] for u,z in outline]; n=len(outline)
    mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],mat,bevel=bevel)
plaque('gold sign surround',sx,.13,2.56,.74,2.00,'schoolBusYellow')
plaque('navy inset face',sx+.079,.035,2.40,.83,1.91,'asphalt')
def text(body,z,size):
    c=bpy.data.curves.new('raised lettering','FONT'); c.body=body; c.align_x='CENTER'; c.align_y='CENTER'; c.size=size; c.extrude=.006; c.bevel_depth=0; c.resolution_u=2
    o=bpy.data.objects.new(body,c); bpy.context.collection.objects.link(o); o.location=(sx+.108,sy,z)
    o.rotation_euler=Matrix(((0,1,0),(0,0,1),(1,0,0))).transposed().to_euler()
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH'); finish(bpy.context.object,body,'picketWhite')
text('SUNSET GROVE',1.58,.265); text('PARK',1.18,.35)
for offset in [-.075,0,.075]:
    mesh('raised gold leaf emblem',[(sx+.117,sy+offset,1.86),(sx+.125,sy+offset-.038,1.99),(sx+.125,sy+offset,2.06),(sx+.125,sy+offset+.038,1.99)],[(0,1,2),(0,2,3)],'schoolBusYellow')
for yy in [sy-1.13,sy+1.13]:
    for z in [.9,1.85]: sphere('sign screw',(sx+.115,yy,z),(.015,.025,.025),'schoolBusYellow',n=3)
# Pointed faceted leaves, flowers, rear tall shrubs. Geometry stays legible at game scale.
def leaf(loc,d,length,mat='foliage',width=.18):
    base=Vector(loc); axis=Vector(d).normalized()*length; side=axis.cross(Vector((0,0,1)))
    if side.length<.01: side=Vector((1,0,0))
    side=side.normalized()*length*width; mid=base+axis*.48; ridge=mid+Vector((0,0,length*.07))
    mesh('folded leaf',[base,mid+side,base+axis,mid-side,ridge],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],mat)
for j in range(28):
    t=j*math.tau/28; r=4.1+rng.uniform(-.2,.2); x=r*math.cos(t); y=r*math.sin(t)
    if x>3.3 and abs(y)<1.0: continue
    tall=x<-1.4; height=rng.uniform(1.7,2.9) if tall else rng.uniform(.45,.85)
    rod('shrub stem',(x,y,.19),(x,y,.19+height),.025,'woodWarm',6)
    for level in range(3 if tall else 2):
        z=.35+height*(.24+level*.24)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z))
        o=bpy.context.object; o.scale=(.55 if tall else .46,.55 if tall else .46,height*.35 if tall else .34)
        finish(o,'faceted shrub volume','grass' if level==0 else 'foliage')
    for k in range(8 if tall else 4):
        z=.28+rng.random()*height; ang=rng.random()*math.tau; rad=.12+rng.random()*.36
        loc=(x+rad*math.cos(ang),y+rad*math.sin(ang),z)
        leaf(loc,(math.cos(ang),math.sin(ang),.5),rng.uniform(.22,.48),'foliage' if k%3 else 'grass',.28)
    if not tall:
        for k in range(4):
            xx=x+rng.uniform(-.35,.35); yy=y+rng.uniform(-.35,.35); zz=.70+height*.50+rng.random()*.13
            # Two crossed stalk planes connect the broad blooms to the shrub mass.
            for axis in [(1,0),(0,1)]:
                dx,dy=axis[0]*.007,axis[1]*.007; low=.52+height*.30
                mesh('flower stalk',[(xx-dx,yy-dy,low),(xx+dx,yy+dy,low),(xx+dx,yy+dy,zz),(xx-dx,yy-dy,zz)],[(0,1,2),(0,2,3)],'grass')
            petals=[(xx,yy,zz+.022)]
            for q in range(10):
                ang=q*math.tau/10; rr=.095 if q%2==0 else .035
                petals.append((xx+rr*math.cos(ang),yy+rr*math.sin(ang),zz))
            mesh('five petal blossom',petals,[(0,q+1,(q+1)%10+1) for q in range(10)],'survivorRed')
            mesh('flower center',[(xx,yy,zz+.027),(xx-.019,yy-.019,zz+.027),(xx+.019,yy-.019,zz+.027),(xx+.019,yy+.019,zz+.027),(xx-.019,yy+.019,zz+.027)],[(0,1,2),(0,2,3),(0,3,4),(0,4,1)],'schoolBusYellow')
for j in range(35):
    t=j*math.tau/35
    for k in range(2): leaf(polar(5.03,t,.12),(math.cos(t+k),math.sin(t+k),.8),rng.uniform(.2,.45),'grass')
# Consolidate static meshes by material and visibility group. Light meshes keep distinct pivots.
def consolidate(anchors=True):
    groups={}
    for o in objects:
        if 'lamp_span' in o: key=('string',o['lamp_span'],o.data.materials[0].name)
        elif 'park_lamp' in o: key=('park',o['park_lamp'],o.data.materials[0].name)
        else: key=(o.parent.name,o.data.materials[0].name)
        groups.setdefault(key,[]).append(o)
    for key,obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); o=obs[0]
        if key[0] in ['string','park']:
            idx=key[1]; name=('lamp_string_%02d'%idx if key[0]=='string' else 'lamp_park_%d'%idx)
            parent=bpy.data.objects[name]; o.name=name+'_bulbs'; o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted()
            anchor=empty('light:'+name,parent) if anchors else None
            if anchors: anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':2.0,'range':4,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name],'tiers':'all'})
        else: o.name=key[0]+'_'+key[-1]
consolidate()
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o.type=='MESH':
        # Bake merged transforms into vertices; bulbs use their attachment pivot.
        o.data.transform(o.parent.matrix_world.inverted()@o.matrix_world)
        o.matrix_parent_inverse=Matrix.Identity(4); o.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
# Export only the asset hierarchy; LODs share its material and node contract.
meshes=[o for o in bpy.data.objects if o.type=='MESH']
def stats():
    tris=0
    for o in meshes: o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
    return {'triangles':tris,'draw_calls':sum(len(o.data.materials) for o in meshes if len(o.data.polygons)),'materials':sorted({m.name for o in meshes for m in o.data.materials})}
def glb_stats(path):
    data=Path(path).read_bytes(); length=struct.unpack_from('<I',data,12)[0]; g=json.loads(data[20:20+length])
    primitives=[p for node in g['nodes'] if 'mesh' in node for p in g['meshes'][node['mesh']]['primitives']]
    return {'triangles':sum(g['accessors'][p['indices']]['count']//3 for p in primitives),'draw_calls':len(primitives),'materials':sorted(m['name'] for m in g.get('materials',[]))}

# Dissolve redundant planar edges while retaining intact hero silhouettes.
initial=stats()['triangles']
if initial>19800:
    white_mesh=bpy.data.objects.get('root_pal_picketWhite')
    bpy.context.view_layer.objects.active=white_mesh
    dec=white_mesh.modifiers.new('letter contour economy','DECIMATE'); dec.decimate_type='DISSOLVE'; dec.angle_limit=.06
    bpy.ops.object.modifier_apply(modifier=dec.name)
if stats()['triangles']>20000:
    raise RuntimeError('Hero exceeds 20,000 triangles: '+str(stats()))
if a.glb:
    dest=Path(a.glb); dest.parent.mkdir(parents=True,exist_ok=True)
    def export(path): bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    sys.path.insert(0,str(OUT.parents[1]/'tools'/'blender'))
    from sslib.ao import bake_all
    bake_all(meshes,samples=32)
    export(dest); high=glb_stats(dest); lodstats={}
    snapshots=[(o.name,o.parent,o.matrix_world.copy(),o.data.copy()) for o in meshes]
    def proxy(level):
        global objects, meshes
        objects=[]
        # Ground and deck retain their octagonal silhouettes as closed solids.
        octagon('proxy park island',5.1,0,.22,'sidewalk',bevel=0)
        octagon('proxy deck',3.08,.22,.44,'sidewalk',interior,bevel=0)
        for j,v in enumerate(verts):
            nxt=verts[(j+1)%8]; d=nxt-v; t=math.atan2(d.y,d.x)
            if level==1:
                box('proxy column',(v.x,v.y,2.13),(.22,.22,2.95),bevel=0)
                box('proxy column foot',(v.x,v.y,.75),(.34,.34,.18),bevel=0)
                box('proxy header',(v+nxt)/2+Vector((0,0,3.55)),(d.length+.12,.25,.22),bevel=0,parent=roof,angle=t)
            else: rod('proxy column',(v.x,v.y,.66),(v.x,v.y,3.6),.13,'picketWhite',3)
            if level==1:
                beam('proxy brace',v+Vector((0,0,2.93)),v+d.normalized()*.5+Vector((0,0,3.45)),.14,parent=roof,bevel=0)
            if j!=7 and level==1:
                for z in [1.64,.84]: box('proxy railing',(v+nxt)/2+Vector((0,0,z)),(d.length-.10,.15,.12),bevel=0,angle=t)
                for k in range(1,4):
                    q=v+d*k/4; box('proxy spindle',(q.x,q.y,1.23),(.085,.085,.72),bevel=0)
        def roof_solid(name,r0,r1,z0,z1):
            vs=[polar(r,t,z) for r,z in [(r0,z0),(r1,z1)] for t in [math.pi/8+j*math.tau/8 for j in range(8)]]
            mesh(name,vs,[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)],'asphalt',roof)
        roof_solid('proxy main roof',3.43,.64,3.73,5.10)
        roof_solid('proxy cupola cap',.83,.06,5.92,6.46)
        octagon('proxy cupola body',.64,5.13,.71,'picketWhite',roof,bevel=0)
        rod('proxy finial',(0,0,6.46),(0,0,7.07),.06,'schoolBusYellow',4,roof)
        if level==1:
            for j in range(8):
                t=math.pi/8+j*math.tau/8
                beam('proxy roof hip',polar(3.43,t,3.82),polar(.64,t,5.17),.07,'woodWarm',roof,bevel=0)
                # Dark vent panels stand proud of the white cupola body.
                mid=t+math.pi/8; q=polar(.601,mid,5.49)
                o=box('proxy cupola window',q,(.36,.028,.43),'uiDark',0,roof,angle=mid+math.pi/2)
            for i in range(3): box('proxy stair',(3.13+i*.37,0,.56-i*.14),(.68,2.32,.20),'sidewalk',0,interior)
            # Two unmistakable bench silhouettes, no microscopic hardware.
            for j in [2,3]:
                v=verts[j]; nxt=verts[(j+1)%8]; c=(v+nxt)/2*.79; d=(nxt-v).normalized(); n=Vector((-d.y,d.x,0)); t=math.atan2(d.y,d.x)
                for u in [-.65,.65]:
                    for w in [-.18,.20]:
                        q=c+d*u+n*w; box('proxy bench leg',(q.x,q.y,.95),(.075,.075,.55),'uiDark',0,interior)
                for w in [-.20,0,.20]: box('proxy seat',c+n*w+Vector((0,0,1.21)),(1.75,.18,.08),'woodWarm',0,interior,t)
                for z in [1.55,1.86]: box('proxy bench back',c-n*.3+Vector((0,0,z)),(1.75,.08,.20),'woodWarm',0,interior,t)
        # Keep all lamp mesh names used by the high-tier anchor contract.
        for j in range(8):
            start=verts[j]*.98; end=verts[(j+1)%8]*.98
            if level==1:
                mid=start.lerp(end,.5)+Vector((0,0,3.11))
                rod('proxy festoon',start+Vector((0,0,3.44)),mid,.015,'uiDark',3,roof)
                rod('proxy festoon',mid,end+Vector((0,0,3.44)),.015,'uiDark',3,roof)
            for u in ([.33,.66] if level==1 else [.5]):
                q=start.lerp(end,u)+Vector((0,0,3.28-.30*math.sin(math.pi*u)))
                if level==1: o=sphere('proxy string bulb',q,(.065,.065,.085),'windowGlow',roof,n=4)
                else:
                    o=mesh('proxy string bulb',[(q.x,q.y,q.z+.09),(q.x-.065,q.y-.04,q.z-.05),(q.x+.065,q.y-.04,q.z-.05),(q.x,q.y+.07,q.z-.05)],[(0,1,2),(0,2,3),(0,3,1),(1,3,2)],'windowGlow',roof)
                o['lamp_span']=j
        for j,y in enumerate([-3.55,3.55]):
            x=2.35
            rod('proxy lamp post',(x,y,.22),(x,y,3.02),.075,'uiDark',4)
            o=box('proxy lantern light',(x,y,3.28),(.35,.35,.52),'windowGlow',0); o['park_lamp']=j
            mesh('proxy lantern cap',[(x-.28,y-.28,3.57),(x+.28,y-.28,3.57),(x+.28,y+.28,3.57),(x-.28,y+.28,3.57),(x,y,3.9)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'asphalt')
            if level==1: box('proxy lamp foot',(x,y,.4),(.38,.38,.3),'uiDark',0)
        # Sign uses the same arched silhouette; tiny glyphs become two pale inset bars.
        if level==1:
            plaque('proxy sign gold',sx,.13,2.56,.74,2.0,'schoolBusYellow',bevel=0)
            plaque('proxy sign face',sx+.079,.035,2.40,.83,1.91,'asphalt',bevel=0)
        else:
            for x,w,bottom,top,mat in [(sx,2.56,.74,2.0,'schoolBusYellow'),(sx+.08,2.40,.83,1.91,'asphalt')]:
                outline=[(-w/2,bottom),(w/2,bottom),(w/2,top-.10),(.35,top+.13),(0,top+.26),(-.35,top+.13),(-w/2,top-.10)]; n=len(outline)
                vs=[(xx,sy+u,z) for xx in [x-.02,x+.02] for u,z in outline]
                mesh('proxy arched sign',vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],mat)
        for yy in [sy-1.1,sy+1.1]: box('proxy sign post',(sx,yy,.97),(.12,.14,1.45),'uiDark',0)
        if level==1:
            for z,w in [(1.58,1.88),(1.18,.88)]: box('proxy sign text',(sx+.111,sy,z),(.014,w,.09),'picketWhite',0)
            rod('proxy bin',(3.62,-2.16,.22),(3.62,-2.16,1.12),.34,'asphalt',8)
        count=14 if level==1 else 6
        for j in range(count):
            t=.55+j*(math.tau-1.1)/max(1,count-1); x=4.1*math.cos(t); y=4.1*math.sin(t); tall=x<-1.4
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,1.12 if tall else .62))
            o=bpy.context.object; o.scale=(.58,.58,1.10 if tall else .48); finish(o,'proxy shrub','foliage')
        consolidate(anchors=False)
        bpy.context.view_layer.update()
        for o in bpy.data.objects:
            if o.type=='MESH':
                o.data.transform(o.parent.matrix_world.inverted()@o.matrix_world)
                o.matrix_parent_inverse=Matrix.Identity(4); o.matrix_basis=Matrix.Identity(4)
        bpy.context.view_layer.update(); meshes=[o for o in bpy.data.objects if o.type=='MESH']
    for suffix,level in [('lod1',1),('lod2',2)]:
        for o in meshes: bpy.data.objects.remove(o,do_unlink=True)
        proxy(level); bake_all(meshes,samples=32)
        path=dest.with_name(dest.stem+'.'+suffix+'.glb'); export(path); lodstats[suffix]=glb_stats(path)
    for o in meshes: bpy.data.objects.remove(o,do_unlink=True)
    meshes=[]
    for name,parent,world,data in snapshots:
        o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.parent=parent; o.matrix_world=world; meshes.append(o)
    (OUT/'metrics.json').write_text(json.dumps({'lod0':high,**lodstats},indent=2))
# Blender studio preview (never exported).
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True; scene.world.color=(.16,.16,.16)
    scene.view_settings.view_transform='AgX'
    ground=box('studio ground',(0,0,-.10),(200,200,.18),'uiDark',0)
    def area(name,loc,power,color,size):
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    area('golden key',(2,-6,11),2200,(1,.70,.43),7); area('cool fill',(-6,-2,7),1500,(.48,.58,1),8); area('warm rim',(-3,6,9),2400,(1,.49,.19),6)
    for y in [-3.55,3.55]:
        data=bpy.data.lights.new('lantern bounce','POINT'); data.energy=35; data.color=(1,.43,.12); data.shadow_soft_size=.35
        o=bpy.data.objects.new('lantern bounce',data); bpy.context.collection.objects.link(o); o.location=(2.35,y,3.25)
    data=bpy.data.cameras.new('camera'); cam=bpy.data.objects.new('camera',data); bpy.context.collection.objects.link(cam); scene.camera=cam
    target=Vector((0,0,3.0)); views={'ref':(16,-10,11),'game':(13,-13,17),'front':(19,0,9),'side':(0,-19,9),'rear':(-16,11,10)}
    cam.location=views.get(a.view,views['ref']); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); data.type='ORTHO'; data.ortho_scale=17.8
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve()); Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=views['game']; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); data.ortho_scale=17.8
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).resolve().with_name('game.png' if Path(a.render).name=='hero.png' else Path(a.render).stem.replace('-ref','')+'-game.png'))
        bpy.ops.render.render(write_still=True)
print('OK gazebo built')
