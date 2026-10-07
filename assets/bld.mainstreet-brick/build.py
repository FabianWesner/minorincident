"""Sunset Grove main street: deterministic, texture-free, +X front, metres, Z up."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import export_lods, rebuild_from_baked

HERE = Path(__file__).resolve().parent
if '--lod-only' in sys.argv:
    rebuild_from_baked(HERE/'model.glb')
    sys.exit(0)

parser = argparse.ArgumentParser()
for flag in ('render', 'glb'): parser.add_argument('--' + flag)
parser.add_argument('--view', default='ref', choices=['ref','game','front','side','rear'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng = random.Random(714)
COLORS = {'brick':'ad4939','woodWarm':'bd8651','sidewalk':'b9a4a0','picketWhite':'f2e6dc',
          'asphalt':'5b4f5c','uiDark':'25222c','backpackTeal':'2f6e6a','grass':'6f8f3a',
          'foliage':'7da23c','survivorRed':'d9363e','schoolBusYellow':'f2b630','windowGlow':'cfa16c'}
M = {}
def material(token, h, emissive=False):
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    color=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m=bpy.data.materials.new(('emi_' if emissive else 'pal_')+token); m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=color
    bs.inputs['Roughness'].default_value=.76
    if emissive:
        bs.inputs['Emission Color'].default_value=color; bs.inputs['Emission Strength'].default_value=1.35
    M[token if not emissive else 'glow_'+token]=m
for token,h in COLORS.items(): material(token,h)
material('windowGlow','ffc773',True)
material('foliage','4dff9a',True)

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
root=empty('root'); root['asset_id']='bld.mainstreet-brick'; root['forward']='+X'
body=empty('body',parent=root); roof=empty('roof',parent=root); interior=empty('interior',parent=root)
parts=[]; cache={}
def attach(o,name,mat,parent):
    o.name=name
    if not o.data.materials: o.data.materials.append(M[mat])
    o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted()
    parts.append(o); return o

def box(name,loc,size,mat='sidewalk',parent=body,bevel=.025,rot=None):
    bevel=min(bevel,min(size)*.3); key=(tuple(round(v,5) for v in size),mat,round(bevel,5))
    if key not in cache:
        sx,sy,sz=[v/2 for v in size]
        me=bpy.data.meshes.new(name); me.from_pydata([(x,y,z) for x in [-sx,sx] for y in [-sy,sy] for z in [-sz,sz]],[],[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]); me.update()
        o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
        if bevel:
            bpy.context.view_layer.objects.active=o
            b=o.modifiers.new('soft bevel','BEVEL'); b.width=bevel; b.segments=2 if bevel>=.035 else 1
            bpy.ops.object.modifier_apply(modifier=b.name)
            n=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=n.name)
        me=o.data; me.materials.append(M[mat]); cache[key]=me
    else:
        o=bpy.data.objects.new(name,cache[key]); bpy.context.collection.objects.link(o)
    o.location=loc
    if rot:o.rotation_euler=rot
    return attach(o,name,mat,parent)

def mesh(name,verts,faces,mat,parent=body,bevel=0):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    if bevel:
        bpy.context.view_layer.objects.active=o; mod=o.modifiers.new('soft edge','BEVEL'); mod.width=bevel; mod.segments=2; bpy.ops.object.modifier_apply(modifier=mod.name)
    return attach(o,name,mat,parent)

def beam(name,p1,p2,width,mat='asphalt',parent=body):
    d=Vector(p2)-Vector(p1); o=box(name,(Vector(p1)+Vector(p2))/2,(width,width,d.length),mat,parent,bevel=.012)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o

def sphere(name,loc,size,mat,parent=body):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc)
    o=bpy.context.object; o.scale=size; return attach(o,name,mat,parent)

def cylinder(name,loc,radius,depth,mat,parent=body):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=depth,location=loc)
    return attach(bpy.context.object,name,mat,parent)

def text(name,string,x,y,z,size,mat,parent=body):
    curve=bpy.data.curves.new(name,'FONT'); curve.body=string; curve.align_x='CENTER'; curve.align_y='CENTER'
    curve.size=size; curve.extrude=.006; curve.bevel_depth=.001; curve.bevel_resolution=0; curve.resolution_u=4
    curve.offset=.006
    o=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(o)
    o.location=(x,y,z); o.rotation_euler=(math.pi/2,0,math.pi/2)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH')
    return attach(bpy.context.object,name,mat,parent)

def light(name,loc,mat,parent=body,kind='window'):
    anchor=empty('light:'+name,loc,parent); anchor.rotation_euler=(0,-math.pi/2,0)
    anchor['ss_light']=json.dumps({'type':kind,'color':'light_neon_green' if mat=='glow_foliage' else 'light_window_warm',
        'intensity':2,'range':4,'pool':True,'beam':'none','flare':kind=='neon','reflect':True,'shadow':'none',
        'heroPriority':0,'flicker':'none','animation':None,'powerGroup':'sunset-grove-mainstreet','breakable':True,
        'emissiveNodes':[parent.name+'_'+M[mat].name],'tiers':'all'})

# Minimal jointed sidewalk slab. Front is +X; bakery occupies the wider -Y bay.
box('foundation',(0,0,.17),(5.8,8.2,.34),'sidewalk',bevel=.06)
for x in [-3.0,-2.25,-1.5,-.75,0,.75,1.5,2.25,3.0]:
    for y in [-4.35,4.35]:box('sidewalk_paver',(x,y,.20),(.726,.75,.40),'sidewalk',bevel=.045)
for y in [-3.7+i*.74 for i in range(11)]:box('front_paver',(3.28,y,.2),(1.03,.716,.40),'sidewalk',bevel=.045)
# Wall backing and individual staggered masonry. The windows sit forward of this shell.
for x in [-2.65,2.65]:
    box('bakery_wall',(x,-1.6,3.65),(.20,4.8,6.54),'brick')
    box('pharmacy_wall',(x,2.4,3.65),(.20,3.2,6.54),'windowGlow')
box('left_wall',(0,-3.90,3.65),(5.1,.20,6.54),'brick')
box('right_wall',(0,3.90,3.65),(5.1,.20,6.54),'windowGlow')
# Side/rear mortar is dark; front mortar warmer and slightly recessed.
for x in [-2.755,2.755]:box('mortar_front',(x,0,3.65),(.06,8,6.54),'woodWarm' if x>0 else 'brick',bevel=0)
box('mortar_side',(0,-4.015,3.65),(5.5,.06,6.54),'woodWarm',bevel=0)
for row in range(32):
    z=.49+row*.216
    for start,end,mat in [(-4,.8,'brick'),(.8,4,'windowGlow')]:
        step=.425; offset=step/2*(row%2)
        left=start-offset
        while left<end:
            lo=max(left,start); hi=min(left+step,end)
            if hi-lo>.04:box('face_brick',(2.801,(lo+hi)/2,z),(.095,hi-lo-.014,.196),mat,bevel=.012)
            left+=step
    for i in range(14):
        lo=max(-2.75,-2.75+i*.425-.2125*(row%2)); hi=min(2.75,-2.75+(i+1)*.425-.2125*(row%2))
        if hi-lo>.04:box('side_brick',((lo+hi)/2,-4.061,z),(hi-lo-.014,.095,.196),'brick',bevel=.012)
# Conservatively inferred rear and right elevation with a quieter masonry rhythm.
for row in range(17):
    z=.57+row*.408
    box('rear_course',(-2.798,0,z),(.055,7.94,.017),'woodWarm',bevel=.003)
    box('right_course',(0,4.029,z),(5.43,.05,.017),'sidewalk',bevel=.003)
# Brick piers with occasional cream quoins, and broad limestone belt courses.
for x,y in [(2.86,-3.96),(2.86,.8),(2.86,3.96),(-2.72,-3.96)]:
    box('pier_core',(x,y,3.85),(.30,.34,7.08),'brick')
    for row in range(31):
        box('pier_course',(x+.035,y, .53+row*.22),(.34,.39,.204),'sidewalk' if row%6==1 else 'brick',bevel=.018)
    box('pier_foot',(x,y,.66),(.48,.49,.54),'sidewalk',bevel=.045)
    box('pier_cap',(x,y,7.45),(.53,.54,.25),'brick',bevel=.04)
for z in [3.48,6.98,7.24]:
    box('front_stone_belt',(2.85,0,z),(.23,8.14,.27),'sidewalk')
    box('left_stone_belt',(0,-4.09,z),(5.64,.22,.27),'sidewalk')
    box('rear_stone_belt',(-2.8,0,z),(.18,8.12,.27),'sidewalk')
    box('right_stone_belt',(0,4.07,z),(5.64,.18,.27),'sidewalk')
# Roof is a removable assembly, including capstones, chimneys and HVAC.
box('roof_deck',(0,0,7.04),(5.45,7.9,.20),'asphalt',roof)
for x in [-2.57,2.57]:box('parapet',(x,0,7.32),(.28,7.8,.46),'sidewalk',roof)
for y in [-3.85,3.85]:box('parapet',(0,y,7.32),(5.4,.28,.46),'sidewalk',roof)
for x in [-2.58,2.58]:
    for i in range(16):box('coping_stone',(x,-3.69+i*.492,7.57),(.39,.474,.15),'sidewalk',roof,.03)
for y in [-3.86,3.86]:
    for i in range(11):box('coping_stone',(-2.43+i*.486,y,7.57),(.466,.4,.15),'sidewalk',roof,.03)
for row in range(8):
    for col in range(6):
        box('roof_membrane_seam',(-2.26+col*.87,-3.44+row*.91,7.154),(.84,.87,.016),'asphalt',roof,.004)
for x,y,h in [(-1.8,-3.4,.94),(-1.9,.6,1.19),(-1.9,1.45,1.10)]:
    box('chimney',(x,y,7.12+h/2),(.49,.52,h),'brick',roof)
    for j in range(int(h/.19)):
        for face in [-1,1]:box('chimney_course',(x+face*.256,y,7.21+j*.19),(.035,.53,.02),'woodWarm',roof,.004)
    box('chimney_crown',(x,y,7.15+h),(.65,.67,.16),'brick',roof,.03)
    box('flue_cap',(x,y,7.27+h),(.44,.43,.16),'brick',roof,.025)
    box('flue_dark',(x,y,7.356+h),(.31,.30,.016),'uiDark',roof,.003)
for x,y,size in [(-.75,-1.9,(1.38,1.54,.94)),(.45,.5,(1.25,1.12,.63))]:
    w,d,h=size; z=7.23+h/2
    for yy in [y-d*.34,y+d*.34]:box('hvac_foot',(x,yy,7.22),(w+.14,.13,.15),'asphalt',roof)
    box('hvac_housing',(x,y,z),size,'sidewalk',roof,.055)
    box('hvac_access_panel',(x+w/2+.025,y,z),(.035,d*.48,h*.7),'asphalt',roof,.015)
    box('hvac_access_face',(x+w/2+.05,y,z),(.035,d*.43,h*.65),'sidewalk',roof,.015)
    box('vent_black',(x+w/2+.032,y-d*.34,z),(.035,d*.22,h*.70),'uiDark',roof,.015)
    for j in range(9):box('vent_louvre',(x+w/2+.06,y-d*.34,z-h*.29+j*h*.073),(.035,d*.23,.028),'asphalt',roof,.005)
    for yy in [y-d*.23,y+d*.23]:
        cylinder('fan_ring',(x,yy,z+h/2+.015),w*.25,.035,'asphalt',roof)
        cylinder('fan_dark',(x,yy,z+h/2+.037),w*.213,.018,'uiDark',roof)
        for i in range(-4,5):
            length=2*math.sqrt(max(0,(w*.207)**2-(i*w*.044)**2))
            box('fan_grille',(x+i*w*.044,yy,z+h/2+.055),(.018,length,.018),'asphalt',roof,.003)
    for dz in [-h*.34,h*.34]:
        for yy in [y-d*.43,y+d*.43]:sphere('hvac_bolt',(x+w/2+.03,yy,z+dz),(.022,.026,.026),'asphalt',roof)
# Front and side windows: layered stone lintels, deep teal sash and warm interiors.
def window(name,u,z,w,h,side=False,warm=True):
    def b(n,du,dz,out,sz,mat):
        loc=(u+du,-4.11-out,z+dz) if side else (2.84+out,u+du,z+dz)
        size=(sz[0],sz[2],sz[1]) if side else (sz[2],sz[0],sz[1])
        return box(n,loc,size,mat,bevel=.012)
    b('window_recess',0,0,.015,(w+.18,h+.2,.055),'asphalt')
    b('window_interior',0,0,.065,(w,h,.04),'glow_windowGlow' if warm else 'woodWarm')
    for du in [-w/2,w/2]:b('window_jamb',du,0,.13,(.08,h+.11,.10),'backpackTeal')
    for dz in [-h/2,0,h/2]:b('window_mullion',0,dz,.16,(w+.05,.065,.09),'backpackTeal')
    b('sill',0,-h/2-.14,.16,(w+.43,.19,.31),'sidewalk')
    for i in [-1,0,1]:b('lintel_keystone',i*(w+.3)/3,h/2+.16,.15,((w+.3)/3-.012,.29,.24),'asphalt' if not warm else 'sidewalk')
    if warm:light(name,(u,-4.24,z) if side else (3.0,u,z),'glow_windowGlow')
    # Small pots and leaves readable behind the window framing.
    for du in [-w*.27,w*.25]:
        pos=(u+du,-4.24,z-h*.36) if side else (2.97,u+du,z-h*.36)
        x,y,zz=pos; cylinder('window_pot',(x,y,zz),.09,.14,'woodWarm')
        for j in range(3):sphere('window_plant',(x+.03*(j-1),y+.025*(j-1),zz+.14),(.035,.065,.12),'foliage')
for u in [-2.95,-1.15]:window('bakery_upper_'+str(u),u,5.35,1.02,1.94)
for u in [1.68,3.02]:window('pharmacy_upper_'+str(u),u,5.35,.82,1.94,warm=False)
for u in [-1.55,.1]:
    for z in [1.95,5.35]:window('side_'+str(u)+'_'+str(z),u,z,.89,1.75,True,warm=u<0)
# Rear service windows, fully framed for other game-camera azimuths.
for y in [-2.1,2.1]:
    for z in [2.05,5.2]:
        box('rear_window_dark',(-2.84,y,z),(.07,1.1,1.5),'asphalt')
        for yy in [y-.59,y+.59]:box('rear_jamb',(-2.90,yy,z),(.12,.11,1.72),'sidewalk')
        for zz in [z-.8,z+.8]:box('rear_sill',(-2.92,y,zz),(.16,1.34,.14),'sidewalk')
        box('rear_mullion',(-2.91,y,z),(.11,1.2,.06),'backpackTeal')
# Bakery display, shelves and chunky baked goods; no transparency sorting needed.
box('bakery_display_recess',(2.91,-2.44,1.75),(.13,2.21,2.32),'asphalt')
box('bakery_display_warm',(3.0,-2.44,1.75),(.035,2.06,2.20),'glow_windowGlow')
for y in [-3.5,-2.8,-2.10,-1.4]:box('display_sash',(3.17,y,1.75),(.13,.065,2.26),'backpackTeal')
for z in [.61,2.9]:box('display_rail',(3.16,-2.44,z),(.16,2.22,.10),'backpackTeal')
box('bakery_sill',(3.21,-2.44,.53),(.42,2.40,.16),'sidewalk')
for z in [.95,1.52,2.12]:
    box('display_shelf',(3.085,-2.46,z),(.16,1.93,.06),'woodWarm')
    for j in range(6):
        y=-3.24+j*.31
        box('bread_tray',(3.12,y,z+.055),(.12,.26,.045),'woodWarm')
        if j%3==0:
            cylinder('cupcake_case',(3.145,y,z+.12),.083,.10,'brick')
            sphere('cupcake_icing',(3.15,y,z+.20),(.11,.11,.085),'picketWhite')
        elif j%3==1:
            sphere('bread_roll',(3.15,y,z+.13),(.10,.135,.09),'schoolBusYellow')
            for d in [-.045,.045]:box('bread_score',(3.25,y+d,z+.15),(.012,.018,.055),'picketWhite',bevel=.004)
        else:
            box('loaf',(3.15,y,z+.14),(.15,.23,.14),'woodWarm',bevel=.05)
            box('loaf_top',(3.235,y,z+.18),(.018,.19,.052),'schoolBusYellow',bevel=.012)
light('bakery_display',(3.16,-2.44,1.85),'glow_windowGlow')
# Pharmacy shelf window and bottle silhouettes.
box('pharmacy_display',(2.99,1.64,1.63),(.11,1.09,2.05),'woodWarm')
for z in [.72,1.29,1.87,2.47]:box('pharmacy_shelf',(3.06,1.64,z),(.14,1.15,.06),'backpackTeal')
for y in [1.08,2.2]:box('pharmacy_jamb',(3.13,y,1.64),(.16,.09,2.12),'backpackTeal')
for z in [.73,1.33,1.9]:
    for j in range(4):
        y=1.22+j*.265
        box('medicine_bottle',(3.08,y,z+.15),(.085,.13,.21),'picketWhite',bevel=.025)
        box('bottle_cap',(3.09,y,z+.275),(.095,.105,.04),'backpackTeal',bevel=.008)
        box('bottle_label',(3.132,y,z+.15),(.015,.10,.065),'survivorRed' if j%2 else 'grass',bevel=.003)
box('pharmacy_sill',(3.22,1.65,.54),(.36,1.4,.17),'sidewalk')
# Each shop door is a separate hinged assembly; geometry retains global rest positions.
for name,y,mat in [('bakery',-.56,'backpackTeal'),('pharmacy',2.97,'asphalt')]:
    door=empty('door_'+name,(3.08,y-.48,.44),root); door['joint']='hinge_z'; door['open_angle']=95
    box('door_leaf',(3.085,y,1.61),(.12,.94,2.33),mat,door)
    box('door_glass',(3.152,y,2.08),(.022,.73,1.10),'woodWarm' if name=='pharmacy' else 'glow_windowGlow',door)
    for yy in [y-.37,y+.37]:box('door_stile',(3.18,yy,2.08),(.06,.055,1.12),mat,door)
    for zz in [1.52,2.08,2.65]:box('door_glass_rail',(3.18,y,zz),(.06,.79,.055),mat,door)
    for yy in [y-.19,y+.19]:box('door_raised_panel',(3.163,yy,1.02),(.055,.29,.57),mat,door)
    sphere('brass_knob',(3.23,y+.29,1.47),(.062,.052,.052),'woodWarm',door)
    for zz in [.7,2.36]:box('door_hinge',(3.205,y-.45,zz),(.065,.05,.14),'woodWarm',door,.01)
    for yy in [y-.55,y+.55]:box('door_jamb',(3.075,yy,1.65),(.20,.13,2.47),mat)
    box('door_header',(3.08,y,2.89),(.22,1.23,.16),mat)
    box('threshold',(3.23,y,.445),(.48,1.08,.09),'sidewalk')
    if name=='bakery':light('door_bakery',(3.18,y,2.1),'glow_windowGlow',door)
# Bakery sign: dimensional lettering and a stylized scored loaf emblem.
box('bakery_sign_border',(3.01,-1.84,3.77),(.22,3.0,1.07),'brick',bevel=.06)
box('bakery_sign_cream',(3.14,-1.84,3.77),(.08,2.83,.92),'picketWhite',bevel=.03)
text('BAKERY','BAKERY',3.19,-1.84,3.61,.47,'brick')
sphere('bread_logo',(3.208,-1.84,3.99),(.022,.27,.12),'brick')
for j in [-1,0,1]:
    o=box('logo_score',(3.236,-1.84+j*.115,4.035),(.017,.035,.13),'picketWhite',bevel=.006)
    o.rotation_euler.x=-.28
for y in [-3.13,-.55]:
    for z in [3.41,4.13]:sphere('sign_fastener',(3.197,y,z),(.018,.022,.022),'woodWarm')
# Small pharmacy header with raised red crosses.
box('pharmacy_header',(3.02,2.42,3.32),(.19,2.77,.37),'sidewalk')
box('pharmacy_header_face',(3.13,2.42,3.32),(.04,2.63,.29),'picketWhite')
for y in [1.25,3.57]:
    box('header_cross',(3.17,y,3.32),(.018,.19,.064),'survivorRed',bevel=.004)
    box('header_cross',(3.174,y,3.32),(.018,.064,.19),'survivorRed',bevel=.004)
box('header_rule',(3.17,2.42,3.32),(.018,1.82,.022),'grass',bevel=.003)
# Continuous segmented awning fabric, true geometry stripes and scalloped lower valance.
def awning(name,center,width,stripes,z,main):
    step=width/stripes
    for i in range(stripes):
        lo=center-width/2+i*step+.007; hi=lo+step-.014; mat='picketWhite' if i%2 else main
        verts=[(x,y,zz) for y in [lo,hi] for x,zz in [(2.94,z),(4.00,z-.65),(4.00,z-.73),(2.94,z-.08)]]
        mesh(name+'_cloth',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat,bevel=.012)
        # Vertical apron with semicircular scallop and real thickness.
        outline=[(lo,z-.65),(hi,z-.65),(hi,z-.85)]
        for j in range(1,9):
            t=math.pi*j/8; outline.append(((lo+hi)/2+step*.47*math.cos(t),z-.85-step*.26*math.sin(t)))
        n=len(outline)
        vs=[(x,y,zz) for x in [3.965,4.025] for y,zz in outline]
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
        mesh(name+'_scallop',vs,faces,mat,bevel=.008)
    for y in [center-width/2+.05,center+width/2-.05]:
        beam('awning_support',(2.94,y,z-.65),(3.98,y,z-.68),.045,'asphalt')
        beam('awning_brace',(2.96,y,z-.92),(3.72,y,z-.55),.04,'asphalt')
awning('bakery',-1.88,3.96,9,3.13,'survivorRed')
awning('pharmacy',2.4,2.87,7,3.10,'backpackTeal')
# Pharmacy blade sign, soft framed casing and readable vertical typography.
for z in [4.20,5.73]:
    beam('sign_wall_bracket',(2.94,3.90,z),(3.61,4.48,z),.12,'asphalt')
box('drug_sign_casing',(3.67,4.29,4.62),(.28,.88,2.47),'sidewalk',bevel=.07)
box('drug_sign_frame',(3.83,4.29,4.62),(.13,.83,2.40),'backpackTeal',bevel=.07)
box('drug_sign_dark',(3.91,4.29,4.62),(.042,.66,2.23),'grass',bevel=.045)
for j,ch in enumerate('DRUGS'):text('drug_letter_'+ch,ch,3.941,4.29,5.43-j*.405,.38,'glow_foliage')
box('cross_casing',(3.67,4.29,6.43),(.38,1.29,1.29),'sidewalk',bevel=.11)
box('cross_frame',(3.88,4.29,6.43),(.10,1.18,1.18),'backpackTeal',bevel=.07)
box('cross_dark',(3.941,4.29,6.43),(.027,1.03,1.03),'grass',bevel=.06)
# Outline as one cross polygon avoids overlapping glowing bars.
outline=[(-.16,-.43),(.16,-.43),(.16,-.16),(.43,-.16),(.43,.16),(.16,.16),(.16,.43),(-.16,.43),(-.16,.16),(-.43,.16),(-.43,-.16),(-.16,-.16)]
vs=[(x,4.29+u,6.43+v) for x in [3.962,3.987] for u,v in outline]; n=len(outline)
mesh('pharmacy_cross',vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'glow_foliage')
light('pharmacy_sign',(4.0,4.29,6.2),'glow_foliage',kind='neon')
# Side service boxes, conduits and wooden planter; purposeful wear kept restrained.
for x,z,size in [(-2.32,1.65,(.40,.16,.70)),(-2.32,.78,(.30,.16,.80)),(-2.36,2.20,(.22,.12,.22))]:
    box('electrical_box',(x,-4.21,z),size,'sidewalk',bevel=.035)
    box('box_access',(x,-4.302,z),(size[0]*.8,.028,size[2]*.78),'asphalt',bevel=.016)
    box('box_access_face',(x,-4.325,z),(size[0]*.73,.022,size[2]*.73),'sidewalk',bevel=.015)
for x in [-2.57,-2.07]:beam('service_conduit',(x,-4.21,.41),(x,-4.21,2.28),.045,'asphalt')
for x in [.94,2.26]:box('planter_post',(x,-4.48,.67),(.13,.13,.56),'woodWarm')
for z in [.48,.65,.82]:
    for y in [-4.73,-4.23]:box('planter_board',(1.60,y,z),(1.35,.075,.13),'woodWarm')
    for x in [.93,2.27]:box('planter_end',(x,-4.48,z),(.075,.54,.13),'woodWarm')
box('planter_soil',(1.60,-4.48,.79),(1.24,.40,.07),'uiDark')

def shrub(x,y,z,r=.27,flowers=False):
    for i in range(10):
        ang=i*2.4; rr=r*(.3+.7*rng.random())
        o=sphere('leaf_cluster',(x+math.cos(ang)*rr,y+math.sin(ang)*rr,z+.08+rng.random()*.21),(.08,.055,.21),'foliage' if i%3 else 'grass')
        o.rotation_euler=(rng.uniform(-.6,.6),rng.uniform(-.6,.6),ang)
    if flowers:
        for j in range(4):sphere('planter_bloom',(x+rng.uniform(-.16,.16),y+rng.uniform(-.16,.16),z+.33),(.055,.055,.035),'picketWhite')
for x in [1.12,1.44,1.76,2.08]:shrub(x,-4.48,.81,.20,True)
for x,y in [(3.22,-3.93),(3.23,.85),(3.32,3.97),(-2.5,-4.3),(1.0,-4.25),(3.53,-.02),(3.58,-3.04),(3.54,2.30)]:shrub(x,y,.42,.20)
# Interior is an independent shallow shell with partition and counters for cutaway use.
box('interior_floor',(0,0,.40),(5.24,7.78,.09),'woodWarm',interior)
box('interior_partition',(0,.81,1.86),(5.23,.12,2.80),'sidewalk',interior)
for y in [-1.6,2.4]:box('shop_counter',(1.3,y,.94),(.65,1.8,.95),'woodWarm',interior)
# Collision stays an empty and never contributes rendering geometry.
collider=empty('col:building',(0,0,3.88),root)
collider['collider']='cuboid'; collider['size']=[5.5,8,7]; collider['shape']='cuboid'
# Join static parts by material within removable/hinged assemblies.
for parent in sorted({o.parent for o in parts},key=lambda o:o.name):
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+mat.name
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
for o in meshes:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.triangulate(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
if args.glb:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=714
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=attr; o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.bake(type='AO')
tri=sum(len(o.data.polygons) for o in meshes)
report={'id':'bld.mainstreet-brick','tier':'Hero','triangles':tri,'draw_calls':len(meshes),
        'materials':sorted({m.name for o in meshes for m in o.data.materials}),
        'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_bakery','door_pharmacy','col:building']),
        'within_budget':tri<=100000 and len(meshes)<=40,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,
        'gaps':['Rear and right elevations inferred from the single reference; interior is a shallow cutaway shell.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    def export(path):
        bpy.ops.export_scene.gltf(filepath=str(path.resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    export(Path(args.glb))
    export_lods(Path(args.glb), meshes)

print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if args.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True; scene.cycles.seed=714
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.21,.30,1); world.node_tree.nodes['Background'].inputs[1].default_value=.4
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object; floor.location.z=-.035
    m=bpy.data.materials.new('studio'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.022,.035,1); floor.data.materials.append(m)
    for loc,power,size,col in [((9,-9,13),2400,7,(1,.88,.75)),((-6,-3,10),2100,6,(.68,.76,1)),((0,8,12),2500,5,(1,.70,.44))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=col; o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
    target=Vector((.40,.10,4.10)); views={'ref':(18,-13,13),'game':(15,-15,23),'front':(20,0,8),'side':(0,-20,8),'rear':(-15,14,13)}
    bpy.ops.object.camera_add(location=views[args.view]); cam=bpy.context.object; scene.camera=cam
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=22.0 if args.view=='game' else 21.4
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU'; scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.filepath=str(Path(args.render).resolve()); bpy.ops.render.render(write_still=True)
    if args.view=='ref':
        cam.location=views['game']; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=22.0
        scene.render.resolution_x=960; scene.render.resolution_y=540; scene.cycles.samples=24
        path=Path(args.render).with_name('game.png' if Path(args.render).stem=='hero' else Path(args.render).stem+'-game.png')
        scene.render.filepath=str(path.resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK')
