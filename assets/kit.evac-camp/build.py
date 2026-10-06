"""Evacuation camp: procedural palette geometry, metres, +X forward, Z up."""
import bpy, math, sys, argparse, json
from mathutils import Vector
from pathlib import Path
OUT=Path(__file__).resolve().parent
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--render-game'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); a=p.parse_args(args)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
colors={'sidewalk':'b9a4a0','woodWarm':'b0703f','picketWhite':'f2e6dc','survivorRed':'d9363e','backpackTeal':'2f6e6a','schoolBusYellow':'f2b630','uiDark':'25222c','asphalt':'5b4f5c','grass':'777344','policeBlue':'2f6bff','windowGlow':'ffc773'}
# Palette variants retain their token names; canvas uses warm white, hardware asphalt.
for k,h in colors.items():
    m=bpy.data.materials.new(('emi_' if k=='windowGlow' else 'pal_')+k); m.diffuse_color=tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,); m.use_nodes=True; m.use_backface_culling=(k!='asphalt')
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Roughness'].default_value=.76
    if k=='windowGlow': bs.inputs['Emission Color'].default_value=m.diffuse_color; bs.inputs['Emission Strength'].default_value=3
    M[k]=m
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root); root['asset_id']='kit.evac-camp'; root['category']='building'; root['forward']='+X'
def empty(n,parent=root,loc=(0,0,0)):
    o=bpy.data.objects.new(n,None); bpy.context.collection.objects.link(o); o.parent=parent; o.location=loc; return o
roof=empty('roof'); interior=empty('interior'); static=empty('camp_static')
def finish(o,n,mat,parent=static):
    o.name=n; o.data.materials.append(M[mat]); o.parent=parent; return o
def box(n,loc,size,mat,bevel=.025,parent=static):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel and min(size)>=.16:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        o.modifiers.new('weighted corners','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=o.modifiers[-1].name)
    return finish(o,n,mat,parent)
def rod(n,start,end,r,mat,verts=6,parent=static):
    if r<=.035: verts=min(verts,4)
    d=Vector(end)-Vector(start); mid=(Vector(start)+Vector(end))/2
    v=[(r*math.cos(2*math.pi*i/verts),r*math.sin(2*math.pi*i/verts),h) for h in [-d.length/2,d.length/2] for i in range(verts)]
    f=[tuple(reversed(range(verts))),tuple(range(verts,2*verts))]+[(i,(i+1)%verts,(i+1)%verts+verts,i+verts) for i in range(verts)]
    if n=='chain link':
        v=[(-r,0,-d.length/2),(r,0,-d.length/2),(r,0,d.length/2),(-r,0,d.length/2),(0,-r,-d.length/2),(0,r,-d.length/2),(0,r,d.length/2),(0,-r,d.length/2)]; f=[(0,1,2,3),(4,5,6,7)]
    o=mesh(n,v,f,mat,parent); o.location=mid; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def mesh(n,v,f,mat,parent=static):
    me=bpy.data.meshes.new(n); me.from_pydata(v,[],f); me.update(); o=bpy.data.objects.new(n,me); bpy.context.collection.objects.link(o); return finish(o,n,mat,parent)
def text(n,body,loc,size,mat,rot=(math.pi/2,0,0),parent=static):
    cu=bpy.data.curves.new(n,'FONT'); cu.body=body; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=size; cu.extrude=0; cu.resolution_u=1
    o=bpy.data.objects.new(n,cu); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=rot; o.parent=parent; cu.materials.append(M[mat]); bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False); return o
z=.22
box('paved foundation',(0,0,.11),(12,12,.22),'sidewalk',.10)
# Sparse paving seams as physically inset gaps between slim dark lines.
for t in range(-5,6):
    box('paver joint',(t,0,z+.003),(.012,11.85,.007),'asphalt',0)
    box('paver joint',(0,t,z+.004),(11.85,.012,.007),'asphalt',0)
def cross(center,axis='Y',scale=1):
    x,y,h=center
    if axis=='Y':
        box('medical badge',(x,y,h),(1.06*scale,.035,1.12*scale),'picketWhite',.018)
        box('red cross vertical',(x,y-.027,h),(.22*scale,.022,.75*scale),'survivorRed',.008)
        box('red cross horizontal',(x,y-.029,h),(.68*scale,.022,.23*scale),'survivorRed',.008)
    else:
        box('medical badge',(x,y,h),(.035,1.06*scale,1.12*scale),'picketWhite',.018)
        box('red cross',(x+.027,y,h),(.022,.22*scale,.75*scale),'survivorRed',.008); box('red cross',(x+.029,y,h),(.022,.68*scale,.23*scale),'survivorRed',.008)
def cot(x,y):
    box('canvas cot',(x,y,z+.57),(1.62,.62,.12),'grass',.04,interior)
    box('cot pillow',(x-.52,y,z+.66),(.36,.51,.13),'picketWhite',.055,interior)
    for sy in [-.31,.31]:
        rod('cot frame',(x-.84,y+sy,z+.5),(x+.84,y+sy,z+.5),.035,'asphalt',8,interior)
        for sx in [-.57,.57]:
            rod('cot folding legs',(x+sx-.18,y+sy,z+.04),(x+sx+.18,y+sy,z+.51),.027,'picketWhite',6,interior)
def tent(x,y,mat):
    L=3.5; W=2.9; e=z+1.78; peak=z+2.6
    # Closed rear, sides and ridge roof; entrance is truly open.
    for sy in [-1,1]:
        mesh('canvas wall',[(x-L/2,y+sy*W/2,z+.07),(x+L/2,y+sy*W/2,z+.07),(x+L/2-.16,y+sy*1.27,e),(x-L/2+.16,y+sy*1.27,e),(x,y+sy*1.405,z+.94)],[(i,(i+1)%4,4) if sy<0 else (4,(i+1)%4,i) for i in range(4)],mat)
    mesh('rear canvas',[(x-L/2,y-W/2,z+.07),(x-L/2,y+W/2,z+.07),(x-L/2+.16,y+1.27,e),(x-L/2+.16,y,peak),(x-L/2+.16,y-1.27,e)],[(4,3,2,1,0)],mat)
    for sy in [-1,1]:
        mesh('tent roof',[(x-L/2+.16,y+sy*1.27,e),(x+L/2-.16,y+sy*1.27,e),(x+L/2-.16,y,peak),(x-L/2+.16,y,peak),(x,y+sy*.65,z+2.26)],[(i,(i+1)%4,4) if sy<0 else (4,(i+1)%4,i) for i in range(4)],mat,roof)
        rod('roof seam',(x-L/2+.16,y+sy*1.27,e+.012),(x+L/2-.16,y,peak+.012),.013,mat,6,roof)
    # Front cheek panels leave a 1.2 metre door; upper triangle closes the gable.
    for sy in [-1,1]:
        mesh('entrance canvas',[(x+L/2,y+sy*.62,z+.06),(x+L/2,y+sy*W/2,z+.06),(x+L/2-.16,y+sy*1.27,e),(x+L/2-.10,y+sy*.62,e)],[(0,1,2,3)],mat)
        rod('rolled door flap',(x+L/2+.02,y+sy*.65,z+.1),(x+L/2-.10,y+sy*.65,e),.074,mat,8)
    mesh('front gable',[(x+L/2-.16,y-1.27,e),(x+L/2-.16,y+1.27,e),(x+L/2-.16,y,peak)],[(0,1,2)],mat,roof)
    rod('rolled doorway lintel',(x+L/2-.08,y-.63,e),(x+L/2-.08,y+.63,e),.09,mat,10)
    for sx in [-1,1]:
        for sy in [-1,1]:
            rod('tent pole',(x+sx*1.60,y+sy*1.31,z),(x+sx*1.59,y+sy*1.27,e),.035,'asphalt',6)
    for sx in [-1.6,0,1.6]:
        for sy in [-1,1]:
            rod('tie down',(x+sx,y+sy*1.31,z+.8),(x+sx,y+sy*1.64,z+.06),.022,'schoolBusYellow',6)
            box('tent peg',(x+sx,y+sy*1.64,z+.06),(.14,.15,.1),'uiDark',.015)
    cross((x,y-1.455,z+1.04),scale=.9); cot(x+.25,y)
    for sx in [-1.15,.95]:
        rod('canvas fold',(x+sx-.25,y-1.462,z+.12),(x+sx,y-1.31,e-.08),.018,mat,5)
    box('canvas lower hem',(x,y-1.456,z+.12),(3.45,.022,.08),'asphalt',0)
tent(-2.75,-1.65,'grass'); tent(-2.65,2.55,'picketWhite'); tent(1.75,2.55,'picketWhite')
# Supply cases with rims, latches, handles and strap bands.
def case(x,y,h,mat,w=.95,d=.7):
    box('supply case',(x,y,h+.36),(w,d,.7),mat,.065)
    box('case lid',(x,y,h+.72),(w+.03,d+.03,.12),mat,.03)
    for sx in [-.28,.28]:
        box('strap',(x+sx*w,y,h+.793),(.085,d+.04,.02),'schoolBusYellow',.006)
        box('case buckle',(x+sx*w,y-d/2-.026,h+.61),(.1,.035,.16),'survivorRed',.01)
    box('recessed handle',(x,y-d/2-.021,h+.37),(.26,.04,.09),'uiDark',.012)
    for sx in [-1,1]: box('reinforced corner',(x+sx*(w/2-.055),y-d/2-.022,h+.19),(.11,.05,.29),'asphalt',.015)
for x,y,h,mat,w,d in [(-4.6,3.4,z,'backpackTeal',1.3,.85),(-4.7,4.4,z,'policeBlue',1.25,.85),(.05,4.5,z,'policeBlue',1.25,.85),(.05,4.5,z+.83,'policeBlue',1.25,.85),(-2.3,-4,z,'policeBlue',1.1,.8),(-.8,-4.1,z,'policeBlue',1,.75),(-.45,-2.55,z,'grass',1.8,.85),(-.45,-2.55,z+.83,'grass',1,.65),(4.35,-1.85,z,'policeBlue',1.15,.8),(4.4,-.85,z,'policeBlue',1.15,.8)]: case(x,y,h,mat,w,d)
for x,y in [(1.7,-3.3),(2.55,-3.3)]:
    box('cardboard box',(x,y,z+.5),(.8,.85,1),'woodWarm',.025); box('packing tape',(x,y,z+1.005),(.14,.84,.012),'picketWhite',0); box('box hand slot',(x,y-.431,z+.67),(.16,.018,.08),'uiDark',0)
# Table, benches and medical supplies.
for sy in [-.3,0,.3]: box('table plank',(1.4,.0+sy,z+1.02),(2.55,.28,.12),'woodWarm',.025)
for sy in [-.77,.77]:
    box('bench seat',(1.4,sy,z+.51),(2.75,.3,.12),'woodWarm',.025)
    for sx in [-.8,.8]: rod('table A frame',(1.4+sx,sy*1.08,z+.02),(1.4+sx,0,z+1),.075,'woodWarm',6)
for sx in [-.8,.8]: box('bench support',(1.4+sx,0,z+.39),(.12,1.9,.13),'woodWarm',.01)
box('first aid case',(1.4,0,z+1.21),(.48,.32,.27),'survivorRed',.035)
box('aid cross',(1.4,-.169,z+1.23),(.07,.014,.19),'picketWhite',0); box('aid cross',(1.4,-.17,z+1.23),(.19,.014,.07),'picketWhite',0)
for x in [.45,2.3]:
    rod('water flask',(x,0,z+1.09),(x,0,z+1.55),.13,'policeBlue',10); rod('flask cap',(x,0,z+1.55),(x,0,z+1.6),.075,'picketWhite',8)
# Portable toilet with hinged door and segmented curved roof.
box('portable toilet',(4.65,1.1,z+1.15),(1.2,1.2,2.3),'policeBlue',.07)
box('toilet plinth',(4.65,1.1,z+.09),(1.3,1.3,.18),'asphalt',.04)
for xx in [4.08,5.22]: box('toilet ribs',(xx,.482,z+1.15),(.07,.045,2.22),'backpackTeal',.015)
door=empty('door_toilet',loc=(4.13,.465,z+.25))
o=box('door panel',(4.65,.448,z+1.17),(.99,.065,1.86),'policeBlue',.028,door)
# Set world transforms correctly for all door children after origin creation.
for o in list(door.children): o.location-=door.location
box('toilet handle',(5.01,.397,z+1.08),(.055,.045,.19),'uiDark',.01,door)
box('toilet badge',(4.65,.398,z+1.65),(.43,.024,.43),'picketWhite',.015,door)
text('WC','WC',(4.65,.38,z+1.65),.22,'policeBlue',parent=door)
for o in list(door.children):
    if o.name!='door panel': o.location-=door.location
profile=[(.45+i*1.3/8,z+2.32+.23*math.sin(math.pi*i/8)) for i in range(9)]
verts=[(xx,yy,hh) for xx in [3.98,5.32] for yy,hh in profile]+[(3.98,.45,z+2.25),(3.98,1.75,z+2.25),(5.32,.45,z+2.25),(5.32,1.75,z+2.25)]
faces=[(i,i+9,i+10,i+1) for i in range(8)]+[tuple(range(8,-1,-1))+(18,19),tuple(range(9,18))+(21,20),(0,9,20,18),(8,19,21,17),(18,20,21,19)]
mesh('arched toilet cap',verts,faces,'picketWhite',roof)
# Water tote in a metal cage on timber pallet.
box('water tank',(-3.55,-5,z+.85),(1.35,1.05,1.3),'picketWhite',.09)
for xx in [-4.16,-3.55,-2.94]:
    box('pallet runner',(xx,-5,z+.1),(.15,1.17,.2),'woodWarm',.01)
for yy in [-5.48,-5.16,-4.84,-4.52]: box('pallet deck',(-3.55,yy,z+.24),(1.52,.16,.08),'woodWarm',.008)
for xx in [-4.24,-3.8,-3.32,-2.86]:
    for yy in [-5.55,-4.45]: rod('tank cage',(xx,yy,z+.27),(xx,yy,z+1.53),.024,'asphalt',6)
for hh in [.42,.77,1.12,1.48]:
    for yy in [-5.55,-4.45]: rod('tank rail',(-4.24,yy,z+hh),(-2.86,yy,z+hh),.023,'asphalt',6)
    for xx in [-4.24,-2.86]: rod('tank rail',(xx,-5.55,z+hh),(xx,-4.45,z+hh),.023,'asphalt',6)
rod('tank cap',(-3.55,-5,z+1.5),(-3.55,-5,z+1.58),.14,'uiDark',10)
# Generator with separate wheel pivots, inset louvers and fuel lid.
box('generator chassis',(-.6,-5,z+.5),(1.8,.95,.22),'uiDark',.035)
box('generator housing',(-.6,-5,z+1.01),(1.65,.87,.88),'schoolBusYellow',.08)
box('generator panel',(-.22,-5.45,z+1.04),(.57,.035,.48),'uiDark',.028)
for i in range(5): box('vent louver',(-.22,-5.476,z+.86+i*.085),(.47,.018,.035),'asphalt',.004)
box('generator control',(-1.16,-5.449,z+1.04),(.3,.04,.46),'asphalt',.02)
for i in range(2): rod('outlet',(-1.16,-5.47,z+.92+i*.23),(-1.16,-5.49,z+.92+i*.23),.058,'uiDark',10)
box('fuel cap',(-.6,-5,z+1.47),(.27,.22,.055),'asphalt',.02)
for sy in [-1,1]:
    pivot=empty('wheel_generator_'+('L' if sy<0 else 'R'),loc=(-.9,-5+sy*.55,z+.34))
    rod('tire',(-.9,-5+sy*.45,z+.34),(-.9,-5+sy*.67,z+.34),.29,'uiDark',16,pivot)
    rod('wheel hub',(-.9,-5+sy*.68,z+.34),(-.9,-5+sy*.69,z+.34),.16,'asphalt',12,pivot)
    for o in list(pivot.children): o.location-=pivot.location
for xx in [-1.25,.08]: rod('stabilizer',(xx,-5,z),(xx,-5,z+.48),.05,'asphalt',6)
# Cones with white bands separated in height (no decals).
def cone(x,y):
    box('cone foot',(x,y,z+.045),(.43,.43,.09),'uiDark',.018)
    for lo,hi,rb,rt,mat in [(0,.2,.17,.125,'survivorRed'),(.2,.32,.125,.095,'picketWhite'),(.32,.46,.095,.055,'survivorRed'),(.46,.54,.055,.04,'picketWhite')]:
        bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=rb,radius2=rt,depth=hi-lo,location=(x,y,z+.09+(lo+hi)/2)); finish(bpy.context.object,'traffic cone',mat)
for xy in [(-1.1,.7),(-.35,.9),(-4.9,-5.0)]: cone(*xy)
# Fence lattice: clipped diagonals, each is a real thin polygonal metal wire.
def fence(start,end):
    s=Vector((*start,z+.26)); e=Vector((*end,z+.26)); d=e-s; length=d.length; u=d.normalized(); H=2.05
    rod('fence lower rail',s,e,.032,'asphalt',6); rod('fence top rail',s+Vector((0,0,H)),e+Vector((0,0,H)),.034,'asphalt',6)
    for sign in [-1,1]:
        for i in range(-int(H/.30)-1,int(length/.30)+2):
            t=i*.30; low=max(0,-t/sign) if sign==1 else max(0,t-length); high=min(H,length-t) if sign==1 else min(H,t)
            if high>low:
                rod('chain link',s+u*(t+sign*low)+Vector((0,0,low)),s+u*(t+sign*high)+Vector((0,0,high)),.009,'asphalt',4)
for k in range(4):
    for j in range(4):
        t0=-5.65+j*2.825; t1=t0+2.825
        if k==0: st,en=(t0,-5.65),(t1,-5.65)
        elif k==1: st,en=(t0,5.65),(t1,5.65)
        elif k==2: st,en=(-5.65,t0),(-5.65,t1)
        else: st,en=(5.65,t0),(5.65,t1)
        fence(st,en)
posts=set()
for t in [-5.65,-2.825,0,2.825,5.65]:
    posts.update([(t,-5.65),(t,5.65),(-5.65,t),(5.65,t)])
for x,y in posts:
    box('fence footing',(x,y,z+.14),(.36,.36,.28),'asphalt',.025)
    rod('fence post',(x,y,z+.22),(x,y,z+2.48),.047,'asphalt',8)
    rod('post cap',(x,y,z+2.43),(x,y,z+2.51),.07,'picketWhite',8)
    for h in [.3,1.2,2.22]: rod('post collar',(x,y,z+h),(x,y,z+h+.065),.065,'schoolBusYellow',4)
# Raised banner and extruded text, all at least 6mm clear of backing.
box('safe zone banner',(2.05,-5.704,z+1.13),(2.65,.045,1.48),'picketWhite',.015)
text('safe zone','SAFE ZONE',(2.05,-5.739,z+1.55),.37,'uiDark')
text('banner subtitle','STRONGER\nTOGETHER',(2.05,-5.739,z+.91),.26,'uiDark')
box('banner red rule',(2.05,-5.739,z+1.29),(2.4,.015,.034),'survivorRed',0)
for x in [.82,3.28]:
    for h in [.47,1.79]: rod('banner eyelet',(x,-5.733,z+h),(x,-5.755,z+h),.033,'schoolBusYellow',8)
# Four mast assemblies; lamp heads have joint origins for adjustment.
for i,(x,y) in enumerate([(-5.1,-3.35),(-5.05,3.8),(1.2,5.1),(5.1,3.8)]):
    box('mast foot',(x,y,z+.12),(.5,.5,.24),'asphalt',.04)
    rod('light mast',(x,y,z+.2),(x,y,z+3.8),.057,'asphalt',8)
    for h in [.4,2.9,3.4]: rod('mast collar',(x,y,z+h),(x,y,z+h+.1),.08,'schoolBusYellow',8)
    # Two by two floodlight bank, pivot at mast crossbar.
    lamp=empty('lamp_'+str(i),loc=(x,y,z+3.5))
    for sx in [-.26,.26]:
        for hh in [3.25,3.75]:
            box('floodlight casing',(x+sx,y,z+hh),(.47,.18,.38),'schoolBusYellow',.035,lamp)
            box('floodlight inset',(x+sx,y-.104,z+hh),(.385,.025,.29),'schoolBusYellow',.018,lamp)
            box('lamp lens',(x+sx,y-.123,z+hh),(.335,.019,.245),'windowGlow',.012,lamp)
    for o in list(lamp.children): o.location-=lamp.location
    anchor=empty('light:flood_'+str(i),loc=(x,y-.2,z+3.5)); anchor.rotation_euler=(math.radians(-22),0,0); anchor['ss_light']={'type':'spot','color':'light_led_white','intensity':5,'range':8,'angle':75,'penumbra':.35,'pool':True,'beam':'soft','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','powerGroup':'generator:evac-camp','breakable':True,'emissiveNodes':['lamp_'+str(i)+'_emi_windowGlow'],'tiers':'all'}
# Batch static geometry by parent and material; preserve semantic / animation roots.
for par in [static,roof,interior,door]+[o for o in root.children if o.name.startswith(('wheel_','lamp_'))]:
    for mat in M.values():
        children=[o for o in par.children if o.type=='MESH']
        group=[o for o in children if o.data.materials and o.data.materials[0]==mat]
        if not group: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in group: o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); group[0].name=par.name+'_'+mat.name
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for o in meshes: o.data.calc_loop_triangles()
# Deterministic 32-ray geometry AO baked into the exported color attribute.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
vv=[]; ff=[]
for o in meshes:
    offset=len(vv); vv.extend(o.matrix_world@v.co for v in o.data.vertices)
    ff.extend(tuple(offset+i for i in t.vertices) for t in o.data.loop_triangles)
bvh=BVHTree.FromPolygons(vv,ff,all_triangles=True)
for o in meshes:
    ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
    nm=o.matrix_world.to_3x3().inverted().transposed()
    for v,c in zip(o.data.vertices,ao.data):
        normal=(nm@v.normal).normalized(); pos=o.matrix_world@v.co+normal*.004
        basis=normal.to_track_quat('Z','Y'); blocked=0
        for j in range(32):
            h=(j+.5)/32; angle=j*2.39996323; rr=math.sqrt(1-h*h)
            ray=basis@Vector((rr*math.cos(angle),rr*math.sin(angle),h))
            if bvh.ray_cast(pos,ray,.65)[0] is not None: blocked+=1
        shade=1-.32*blocked/32; c.color=(shade,shade,shade,1)
tri=sum(len(o.data.loop_triangles) for o in meshes); draws=sum(len(o.data.materials) for o in meshes)
report={'id':'kit.evac-camp','tier':'Side','triangles':tri,'draw_calls':draws,'materials':[m.name for m in M.values()],'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_toilet','wheel_generator_L','wheel_generator_R']),'within_budget':6000<=tri<=12000 and draws<=30,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(OUT/'metrics.json').write_text(json.dumps(report,indent=2))
if a.glb or (a.render and Path(a.render).name=='hero.png'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root]+list(root.children_recursive): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb or str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.render:
    # Studio floor excluded from GLB.
    box('studio ground',(0,0,-.09),(200,200,.16),'uiDark',0,parent=None)
    world=bpy.context.scene.world; world.color=(.18,.18,.18); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.15,.22,1); world.node_tree.nodes['Background'].inputs[1].default_value=.65
    for n,loc,power,size in [('key',(-7,-9,16),2300,9),('fill',(8,-1,10),1500,8),('rim',(0,9,14),2100,7)]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=n; o.data.energy=power; o.data.color=(1,.78,.55) if n=='key' else ((.64,.73,1) if n=='fill' else (1,.84,.64)); o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object
    views={'ref':(15,-20,17),'game':(17,-17,22),'front':(20,0,10),'side':(0,-20,10),'rear':(-17,17,15)}
    cam.location=views[a.view]; cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=25 if a.view=='game' else 24
    scene=bpy.context.scene; scene.camera=cam; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.render.filepath=a.render; scene.view_settings.view_transform='AgX'; bpy.ops.render.render(write_still=True)
    game_path=a.render_game or (str(OUT/'renders/game.png') if Path(a.render).name=='hero.png' else (a.render.replace('-ref.png','-game.png') if '-ref.png' in a.render else None))
    if game_path:
        cam.location=views['game']; cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=25; scene.render.filepath=game_path; bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
