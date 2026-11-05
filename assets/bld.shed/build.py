"""Sunset Grove garden shed. Deterministic metre-scale +X-front geometry.
Separate roof, interior, door hinge and lamp mount; static meshes join by material.
LOD geometry is rebuilt, retaining broad features instead of collapsing thin overlays.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
import bmesh

HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--glb'); p.add_argument('--render'); p.add_argument('--view',default='ref')
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
p.add_argument('--samples',type=int,default=24)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
COLORS={'brick':'a8483a','survivorRed':'d9363e','woodWarm':'b0703f','picketWhite':'f2e6dc','asphalt':'5b4f5c','uiDark':'25222c','sidewalk':'b9a4a0','schoolBusYellow':'f2b630','backpackTeal':'2f6e6a','grass':'6f8f3a','foliage':'7da23c','windowGlow':'ffc773'}

def build(lod=0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene; s.unit_settings.system='METRIC'
    rng=random.Random(241); mats={}
    for t,h in COLORS.items():
        m=bpy.data.materials.new(('emi_' if t=='windowGlow' else 'pal_')+t); m.use_nodes=True
        rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
        rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*rgb,1)
        b.inputs['Roughness'].default_value=.78
        if t in ('asphalt','uiDark','backpackTeal'): b.inputs['Metallic'].default_value=.18
        if t=='windowGlow':
            b.inputs['Emission Color'].default_value=(*rgb,1); b.inputs['Emission Strength'].default_value=.9
        m.diffuse_color=(*rgb,1); mats[t]=m
    def empty(n,c=(0,0,0),parent=None):
        o=bpy.data.objects.new(n,None); s.collection.objects.link(o); o.location=c; o.parent=parent; return o
    root=empty('root'); root['asset_id']='bld.shed'; root['forward']='+X'; root['tier']='Hero'
    body=empty('body',parent=root); roof=empty('roof',parent=root); inside=empty('interior',parent=root)
    door=empty('door_main',(1.58,-1.24,.25),root); door['pivot_description']='vertical hinge at right jamb'
    lamp=empty('lamp_entrance',(1.59,-.59,2.43),root); lamp['pivot_description']='wall mounting joint'
    front=empty('front',(1.65,0,1.5),root)
    col=empty('col:shed',(0,0,1.40),root); col['collider']='cuboid'; col['size']=[3.0,3.0,2.3]
    def mesh(n,vs,fs,t,parent=body,bev=0):
        d=bpy.data.meshes.new(n); d.from_pydata(vs,[],fs); d.update()
        o=bpy.data.objects.new(n,d); s.collection.objects.link(o); o.parent=parent; d.materials.append(mats[t])
        if bev and lod==0:
            b=o.modifiers.new('Rounded edges','BEVEL'); b.width=bev; b.segments=1
            o.modifiers.new('Face normals','WEIGHTED_NORMAL')
        return o
    def box(n,c,size,t,parent=body,bev=.02):
        x,y,z=[v/2 for v in size]
        o=mesh(n,[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],t,parent,min(bev,min(size)*.25)); o.location=c; return o
    def rod(n,p,q,r,t,parent=body,sides=None):
        sides=sides or (10 if lod==0 else 4)
        delta=Vector(q)-Vector(p); length=delta.length
        vs=[(r*math.cos(i*2*math.pi/sides),r*math.sin(i*2*math.pi/sides),z) for z in (-length/2,length/2) for i in range(sides)]
        fs=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
        o=mesh(n,vs,fs,t,parent); o.location=(Vector(p)+Vector(q))/2; o.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return o
    def beam(n,p,q,w,t,parent=body):
        delta=Vector(q)-Vector(p); o=box(n,(Vector(p)+Vector(q))/2,(w,w,delta.length),t,parent)
        o.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return o
    def profile(n,poly,x,thick,t,parent=body):
        area=sum(y1*z2-y2*z1 for (y1,z1),(y2,z2) in zip(poly,poly[1:]+poly[:1]))
        if area<0: poly=list(reversed(poly))
        count=len(poly); vs=[(depth,y,z) for depth in (x-thick/2,x+thick/2) for y,z in poly]
        fs=[tuple(reversed(range(count))),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        return mesh(n,vs,fs,t,parent,.008)
    def bolt(c,axis='X',parent=body):
        v=Vector((.018,0,0) if axis=='X' else (0,.018,0)); rod('Iron fastener',Vector(c)-v,Vector(c)+v,.021,'uiDark',parent,sides=6)
    def finish():
        for o in list(s.objects):
            if o.type=='MESH':
                bpy.context.view_layer.objects.active=o
                for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        groups={}
        for o in list(s.objects):
            if o.type=='MESH': groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
        for (parent,mat),objects in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects: o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
            o=bpy.context.object; o.name=parent.name+'_'+mat.name
            s.cursor.location=parent.matrix_world.translation; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        # Mirror the authored facade layout so tools read left and workbench right.
        # Rebase joined mesh vertices at their own parent joints, retaining +X forward.
        objects=[o for o in s.objects if o.type=='MESH']
        world_vertices={o:[o.matrix_world @ v.co for v in o.data.vertices] for o in objects}
        for o in s.objects:
            if o.type=='EMPTY': o.location.y=-o.location.y
        bpy.context.view_layer.update()
        for o in objects:
            pivot=o.parent.matrix_world.translation.copy()
            o.matrix_world=Matrix.Translation(pivot)
            for v,world in zip(o.data.vertices,world_vertices[o]):
                world.y=-world.y; v.co=world-pivot
            bm=bmesh.new(); bm.from_mesh(o.data)
            bmesh.ops.reverse_faces(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()

        print('OK geometry LOD',lod,'triangles',sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'draws',len(objects),flush=True)
        return objects

    if lod==2:
        # Distant silhouette variant: clean broad planes and readable amber panes.
        box('Apron',(0,-.15,.13),(4.7,4.5,.26),'sidewalk',bev=0)
        box('Floor',(0,0,.30),(3,3,.08),'woodWarm',inside,bev=0)
        box('Shell',(0,0,1.41),(3,3,2.22),'brick',bev=0)
        for x in (-1.5,1.5): profile('Gable',[(-1.5,2.52),(1.5,2.52),(0,3.43)],x,.04,'brick')
        angle=math.atan2(.98,1.73)
        for side in (-1,1):
            o=box('Roof panel',(0,side*.87,2.97),(3.52,1.99,.13),'asphalt',roof,bev=0); o.rotation_euler.x=-side*angle
        box('Door',( .115,.55,1.12),(.08,1.10,2.14),'woodWarm',door,bev=0)
        for y in (-1.28,-.04): box('Door trim',(1.64,y,1.39),(.12,.12,2.25),'picketWhite',bev=0)
        window=empty('window_side',parent=root)
        box('Window',(-.16,-1.56,1.77),(1.13,.05,.87),'windowGlow',window,bev=0)
        for z in (1.27,2.27): box('Window trim',(-.16,-1.62,z),(1.37,.10,.13),'woodWarm',bev=0)
        box('Window mullion',(-.16,-1.625,1.77),(.055,.04,.93),'uiDark',bev=0)
        box('Window transom',(-.16,-1.625,1.77),(1.18,.04,.055),'uiDark',bev=0)
        box('Lamp',(.31,0,-.20),(.20,.22,.28),'windowGlow',lamp,bev=0)
        box('Lamp hood',(.31,0,-.04),(.30,.32,.06),'uiDark',lamp,bev=0)
        rod('Barrel',(-1.28,-1.97,.28),(-1.28,-1.97,1.65),.36,'asphalt',sides=6)
        for n,loc,kind,nodes,parent in [('entrance',(.31,0,-.20),'point',['lamp_entrance_emi_windowGlow'],lamp),('window',(-.16,-1.7,1.77),'window',['window_side_emi_windowGlow'],root)]:
            anchor=empty('light:'+n,loc,parent)
            anchor['ss_light']=json.dumps({'type':kind,'color':'light_sodium','intensity':2,'range':3,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':nodes,'tiers':'all'})
        return finish()
    # Raised paved apron. Seams are actual gaps above the foundation.
    box('Foundation',(0,-.15,.09),(4.7,4.5,.18),'sidewalk',bev=.05)
    if lod==0:
        for i in range(6):
            for j in range(5):
                if 1<=i<=4 and 1<=j<=3: continue  # Hidden under the interior floor.
                box('Paving block',(-1.94+i*.78,-1.94+j*.88,.19),(.755,.852,.16),'sidewalk',bev=.035)
    else: box('Paved top',(0,-.15,.20),(4.68,4.48,.10),'sidewalk',bev=0)
    box('Interior timber floor',(0,0,.30),(2.97,2.97,.10),'woodWarm',inside)
    # Wall backing with a real door aperture, and window aperture on right side.
    box('Front left wall',(1.48,.68,1.39),(.13,1.66,2.25),'brick')
    box('Front right pier',(1.48,-1.39,1.39),(.13,.22,2.25),'brick')
    box('Door lintel wall',(1.48,-.65,2.40),(.13,1.20,.23),'brick')
    box('Rear wall',(-1.48,0,1.39),(.13,3,2.25),'brick')
    box('Left wall',(0,1.48,1.40),(3,.13,2.28),'brick')
    box('Right wall lower',(0,-1.48,.81),(3,.13,1.10),'brick')
    box('Right wall upper',(0,-1.48,2.36),(3,.13,.34),'brick')
    for x,w in [(-1.16,.65),(1.01,.96)]: box('Window wall pier',(x,-1.48,1.77),(w,.13,.87),'brick')
    for x in (-1.48,1.48): profile('Gable timber',[(-1.50,2.52),(1.50,2.52),(0,3.43)],x,.13,'brick')
    if lod==0:
        # Individual siding boards with narrow visible grooves and a triangular gable.
        for i in range(14):
            y=-1.39+i*.214; h=2.23
            if y>-.04 or y<-1.30: box('Front siding',(1.565,y,1.39),(.055,.202,h),'brick' if i%3 else 'survivorRed',bev=0)
            top=3.39-abs(y)*.60
            box('Gable siding',(1.567,y,(2.54+top)/2),(.052,.202,max(.06,top-2.54)),'brick',bev=0)
        for i in range(14):
            x=-1.39+i*.214
            if x<-.84 or x>.53: box('Side siding',(x,-1.567,1.39),(.202,.055,2.23),'brick' if i%3 else 'survivorRed',bev=0)
            else:
                box('Lower window siding',(x,-1.567,.81),(.202,.055,1.10),'brick',bev=0)
                box('Upper window siding',(x,-1.567,2.38),(.202,.055,.27),'brick',bev=0)
        for i in range(10):
            x=-1.35+i*.30; box('Back-side siding',(x,1.56,1.4),(.28,.04,2.22),'brick',bev=0)
    # Pale timber corner posts and lower skirting, rich warm highlights.
    for x in (-1.52,1.60):
        for y in (-1.52,1.52): box('Corner trim',(x,y,1.40),(.16,.16,2.31),'picketWhite',bev=.025)
    box('Front sill',(1.60,0,.35),(.16,2.82,.17),'woodWarm')
    box('Side sill',(0,-1.60,.35),(3.15,.16,.17),'woodWarm')
    # Gabled, overhanging pitched roof; whole group removable for cutaway.
    angle=math.atan2(.98,1.73)
    for side in (-1,1):
        count=8 if lod==0 else 1
        for i in range(count):
            x=-1.63+(i+.5)*3.46/count
            o=box('Roof plank',(x,side*.87,2.97),(3.46/count-.012,1.99,.12),'asphalt',roof,bev=.025)
            o.rotation_euler.x=-side*angle
            if lod==0:
                # Roof strips raised 8mm off the sloping boards.
                o=box('Roof standing seam',(x-3.46/count/2+.025,side*.87,3.035),(.037,2.01,.045),'uiDark',roof,bev=.01); o.rotation_euler.x=-side*angle
        box('Eave fascia',(0,side*1.78,2.49),(3.66,.12,.17),'woodWarm',roof)
    fascia=[(-1.83,2.50),(0,3.56),(1.83,2.50),(1.75,2.40),(0,3.40),(-1.75,2.40)]
    for x in (-1.78,1.78): profile('Continuous gable fascia',fascia,x,.14,'woodWarm',roof)
    for i in range(7 if lod==0 else 1):
        count=7 if lod==0 else 1
        box('Ridge cap',(-1.57+(i+.5)*3.14/count,0,3.52),(3.14/count-.006,.22,.10),'woodWarm',roof)
    # Door geometry authored in hinge-local space; handle opposite hinge.
    box('Door leaf',(0,.55,1.12),(.10,1.10,2.14),'woodWarm',door)
    if lod==0:
        for i in range(6): box('Door board',(.067,.10+i*.18,1.12),(.025,.168,2.08),'woodWarm',door,bev=0)
    for z in (.14,1.0,2.11): box('Door cross brace',(.098,.55,z),(.07,1.08,.12),'woodWarm',door)
    if lod<2:
        beam('Door diagonal brace',(.101,.08,.22),(.101,1.00,.92),.105,'woodWarm',door)
        beam('Door diagonal brace',(.101,.08,1.08),(.101,1.00,2.04),.105,'woodWarm',door)
        for z in (.22,1.03,2.03):
            box('Strap hinge',(.146,.15,z),(.035,.36,.07),'uiDark',door,bev=0)
            if lod==0: rod('Hinge pin',(.05,0,z-.07),(.05,0,z+.07),.035,'uiDark',door)
        box('Door handle plate',(.132,.96,1.13),(.03,.09,.18),'uiDark',door)
        rod('Door latch',(.17,.96,1.08),(.17,.96,1.18),.025,'asphalt',door)
    for y in (-1.27,-.04): box('Door jamb',(1.65,y,1.39),(.14,.14,2.25),'picketWhite')
    box('Door header',(1.65,-.65,2.50),(.17,1.42,.16),'woodWarm')
    # Four-pane warm window on right wall, with frame standing proud of siding.
    window=empty('window_side',parent=root)
    box('Amber window',( -.16,-1.584,1.77),(1.13,.035,.87),'windowGlow',window,bev=0)
    for x in (-.76,.44): box('Window jamb',(x,-1.64,1.77),(.10,.14,1.03),'woodWarm')
    for z in (1.27,2.27): box('Window lintel',(-.16,-1.67,z),(1.37,.18,.13),'woodWarm')
    box('Window mullion',(-.16,-1.668,1.77),(.055,.055,.94),'uiDark')
    box('Window transom',(-.16,-1.668,1.77),(1.16,.055,.055),'uiDark')
    if lod==0:
        # Warm geometric reflections are 8mm proud of the pane, beneath the bars.
        mesh('Amber glass reflection',[(-.66,-1.614,1.36),(-.47,-1.614,1.36),(-.66,-1.614,1.68)],[(0,1,2)],'woodWarm')
        mesh('Amber glass reflection',[(.04,-1.614,1.85),(.32,-1.614,2.16),(.32,-1.614,1.85)],[(0,1,2)],'woodWarm')
    # Wall lantern with pitched hood, glass body and mounting arm.
    rod('Lamp arm',(0,0,0),(.26,0,0),.035,'uiDark',lamp)
    box('Lantern glass',(.31,0,-.20),(.20,.22,.27),'windowGlow',lamp)
    box('Lantern foot',(.31,0,-.35),(.24,.26,.04),'uiDark',lamp)
    for y in (-.12,.12): rod('Lantern upright',(.41,y,-.34),(.41,y,-.07),.015,'uiDark',lamp,sides=6)
    profile('Lantern hood',[(-.18,-.065),(.18,-.065),(0,.10)],.31,.34,'asphalt',lamp)
    for n,loc,kind,nodes,parent in [('entrance',(.31,0,-.20),'point',['lamp_entrance_emi_windowGlow'],lamp),('window',(-.16,-1.7,1.77),'window',['window_side_emi_windowGlow'],root)]:
        anchor=empty('light:'+n,loc,parent)
        anchor['ss_light']=json.dumps({'type':kind,'color':'light_sodium','intensity':2,'range':3,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':nodes,'tiers':'all'})
    if lod<2:
        # Outdoor tool rack: two shovels, spade and rake, with distinctly shaped heads.
        box('Tool rail',(1.66,.75,2.01),(.10,1.36,.14),'asphalt')
        for i,y in enumerate((.20,.55,.90,1.25)):
            rod('Tool handle',(1.80,y,1.05),(1.80,y,2.14),.024,'woodWarm')
            if lod==0:
                for z in (.82,1.86): rod('Tool ferrule',(1.80,y,z-.045),(1.80,y,z+.045),.031,'asphalt')
            if i>0:
                poly=[(y-.15,.80),(y+.15,.80),(y+.13,.49),(y,.35),(y-.14,.50)] if i==2 else [(y-.15,.80),(y+.15,.80),(y+.13,.49),(y+.06,.39),(y-.05,.38),(y-.14,.50)]
                poly=[(yy,zz+.60) for yy,zz in poly]
                profile('Shovel blade',poly,1.81,.04,'asphalt')
                if lod==0:
                    for yy in (y-.09,y+.09): rod('D grip',(1.80,y,2.08),(1.80,yy,2.23),.023,'schoolBusYellow')
                    rod('Grip crossbar',(1.80,y-.09,2.23),(1.80,y+.09,2.23),.024,'woodWarm')
            else:
                rod('Rake head',(1.80,y-.19,2.13),(1.80,y+.19,2.13),.024,'asphalt')
                for k in range(7 if lod==0 else 4):
                    yy=y-.18+k*.36/(6 if lod==0 else 3)
                    rod('Rake tine',(1.80,yy,2.13),(1.85,yy,2.28),.012,'asphalt',sides=6)
    # Sturdy workbench under window: planked top, apron, four legs and shelf.
    if lod<2:
        for x in (-.71,.66):
            for y in (-2.04,-1.70): box('Bench leg',(x,y,.64),(.12,.12,.76),'woodWarm')
        box('Workbench top',(-.025,-1.90,1.08),(1.65,.60,.12),'woodWarm',bev=.03)
        box('Bench front apron',(-.025,-2.12,.94),(1.62,.09,.18),'woodWarm')
        box('Bench shelf',(-.025,-1.90,.43),(1.50,.47,.07),'woodWarm')
        box('Lower wooden crate',(-.22,-1.91,.64),(.47,.36,.36),'woodWarm')
        box('Toolbox',(.37,-1.90,1.32),(.58,.34,.37),'survivorRed')
        box('Toolbox lid',(.37,-1.90,1.52),(.61,.36,.08),'survivorRed')
        for x in (.18,.56): box('Brass latch',(x,-2.087,1.38),(.045,.025,.12),'schoolBusYellow',bev=0)
        if lod==0: box('Toolbox lid seam',(.37,-2.086,1.495),(.53,.012,.014),'uiDark',bev=0)
        rod('Toolbox handle',(.25,-1.90,1.60),(.49,-1.90,1.60),.026,'uiDark')
        # Watering can with spout and chunky handle.
        rod('Watering can',(-.45,-1.91,1.15),(-.45,-1.91,1.48),.15,'backpackTeal',sides=12)
        if lod==0: rod('Watering can lid',(-.45,-1.91,1.485),(-.45,-1.91,1.515),.115,'woodWarm',sides=10)
        rod('Can spout',(-.54,-1.93,1.28),(-.77,-1.93,1.56),.037,'backpackTeal')
        if lod==0:
            for p1,p2 in [((-.29,-1.9,1.42),(-.19,-1.9,1.48)),((-.19,-1.9,1.48),(-.13,-1.9,1.29)),((-.13,-1.9,1.29),(-.29,-1.9,1.20))]: rod('Can handle',p1,p2,.025,'woodWarm')
    # Rain barrel at back right, banded and fed by a bent downpipe.
    rod('Rain barrel',(-1.28,-1.97,.28),(-1.28,-1.97,1.65),.36,'asphalt',sides=16 if lod==0 else 8)
    if lod==0:
        rod('Barrel tap',(-1.28,-2.28,.51),(-1.28,-2.40,.51),.036,'woodWarm')
        rod('Tap lever',(-1.28,-2.36,.52),(-1.28,-2.36,.61),.020,'uiDark')
        for z in (.32,.74,1.22,1.64): rod('Barrel hoop',(-1.28,-1.97,z-.025),(-1.28,-1.97,z+.025),.378,'woodWarm',sides=16)
        rod('Barrel dark water',(-1.28,-1.97,1.668),(-1.28,-1.97,1.675),.31,'uiDark',sides=16)
        pipe=[(-1.34,-1.76,2.53),(-1.34,-1.76,2.17),(-1.34,-1.86,2.06),(-1.34,-1.86,1.85),(-1.28,-1.97,1.78),(-1.28,-1.97,1.66)]
        for u,v in zip(pipe,pipe[1:]): rod('Rain downpipe',u,v,.043,'uiDark')
    if lod==0:
        # Cinder blocks with genuine through-openings, modeled as frames.
        for z in (.40,.77):
            for y in (1.25,1.70):
                x=1.88
                for yy in (y-.20,y+.20): box('Cinder block rail',(x,yy,z),(.48,.085,.33),'sidewalk',bev=.018)
                for xx in (x-.20,x+.20): box('Cinder block web',(xx,y,z),(.085,.315,.33),'sidewalk',bev=0)
        # Hardware and sparse grain marks are separate raised geometry, never coplanar.
        for y in (-1.52,1.52):
            for z in (.55,1.2,1.9,2.38): bolt((1.696,y,z))
        for x in (-.73,.42):
            for z in (1.27,2.27): bolt((x,-1.77,z),'Y')
        for y in (.20,.55,.9,1.25): bolt((1.72,y,2.02))
        for i in range(12):
            y=rng.uniform(.05,1.40); z=rng.uniform(.4,2.45)
            box('Timber grain',(1.598,y,z),(.008,.009,rng.uniform(.08,.24)),'woodWarm',bev=0)
        # Low-poly leaf clusters; no individual twigs or dense wire geometry.
        def leaf(c,scale,direction,t):
            vs=[(0,0,-.5),(-.36,0,0),(0,-.18,0),(.36,0,0),(0,.18,0),(0,0,.5)]
            fs=[(0,2,1),(0,3,2),(0,4,3),(0,1,4),(5,1,2),(5,2,3),(5,3,4),(5,4,1)]
            o=mesh('Chunky leaf',vs,fs,t); o.location=c; o.scale=scale; o.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
        clusters=[(1.9,1.72,.30),(1.98,.15,.28),(-1.94,-1.90,.27),(-1.94,1.60,.27),(1.80,-2.15,.26),(.80,1.95,.26)]
        for x,y,z in clusters:
            for k in range(9):
                angle=k*2.4; dx,dy=math.cos(angle),math.sin(angle)
                leaf((x+dx*.15,y+dy*.15,z+.16),(.28,.32,.45),(dx,dy,.65),'foliage' if k%3 else 'grass')
            for k in range(4):
                angle=k*1.6
                leaf((x+.20*math.cos(angle),y+.20*math.sin(angle),z+.39),(.15,.20,.24),(math.cos(angle),math.sin(angle),.3),'schoolBusYellow')
        for x,y in [(2.13,-1.8),(.2,-2.24),(-.7,2.02),(2.19,.95),(-2.12,-.3)]:
            for k in range(3): leaf((x,y,.30),(.1,.12,.34),(math.cos(k*2.1),math.sin(k*2.1),1),'grass')
    return finish()

def stats(meshes):
    return {'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes':sorted(o.name for o in bpy.context.scene.objects)}

metrics={}
if a.glb:
    sys.path.insert(0,str(HERE.parents[1]/'tools'/'blender'))
    from sslib import ao
    for lod in (0,1,2):
        objects=build(lod); metrics['lod'+str(lod)]=stats(objects)
        assert metrics['lod'+str(lod)]['triangles']<=10000
        ao.bake_all(objects,samples=32)
        path=Path(a.glb); suffix='' if lod==0 else '.lod'+str(lod)
        bpy.ops.export_scene.gltf(filepath=str(path.with_name(path.stem+suffix+path.suffix)),export_format='GLB',export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    (HERE/'metrics.json').write_text(json.dumps(metrics,indent=2)); print('OK '+json.dumps(metrics))
if a.render:
    build(0); s=bpy.context.scene
    # Ground belongs to review only; never exported.
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015)); ground=bpy.context.object
    ground.data.materials.append(bpy.data.materials['pal_uiDark'])
    s.render.engine='CYCLES'; s.cycles.samples=a.samples; s.cycles.use_denoising=True; s.cycles.seed=241
    s.world=bpy.data.worlds.new('Studio'); s.world.color=(.20,.20,.20)
    def light(n,c,power,color,size):
        d=bpy.data.lights.new(n,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(n,d); s.collection.objects.link(o); o.location=c; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(4,4,7),850,(1,.88,.72),5)
    light('Cool fill',(1,-5,5),650,(.62,.65,1),5)
    light('Golden rim',(-4,1,6),1200,(1,.50,.22),4)
    d=bpy.data.lights.new('Lantern spill','POINT'); d.energy=22; d.color=(1,.43,.10); d.shadow_soft_size=.3
    o=bpy.data.objects.new('Lantern spill',d); s.collection.objects.link(o); o.location=(2.0,.59,2.21)
    c=bpy.data.cameras.new('Camera'); o=bpy.data.objects.new('Camera',c); s.collection.objects.link(o)
    o.location={'ref':(10,8,7),'game':(8,8,11),'front':(10,0,5),'side':(0,10,5),'rear':(-8,7,6)}.get(a.view,(10,8,7))
    o.rotation_euler=(Vector((0,-.15,1.65))-o.location).to_track_quat('-Z','Y').to_euler(); c.type='ORTHO'; c.ortho_scale=10.5 if a.view=='game' else 10.3; s.camera=o
    s.render.resolution_x=a.width; s.render.resolution_y=a.height; s.render.resolution_percentage=100
    s.view_settings.view_transform='AgX'; s.view_settings.look='AgX - Medium High Contrast'; s.view_settings.exposure=-.30
    s.render.filepath=a.render; bpy.ops.render.render(write_still=True); print('OK rendered '+a.render)
