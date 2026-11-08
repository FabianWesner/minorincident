"""Authored L10 farm silhouettes. Metres, Z up, +X vehicle nose.

Building apertures and pitched panel roofs follow bld.house-a's native recipe;
the old farm plot sizes and open north/south escape doors remain authoritative.
All detail is geometry and shared palette material, with no image dependencies.
"""
import math
import random
import bpy
from mathutils import Vector
from .palette import mat


def mesh(root, name, vertices, faces, token):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    data.materials.append(mat(token))
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    return obj


def box(root, name, at, size, token, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = root
    obj.data.materials.append(mat(token))
    return obj


def rod(root, name, a, b, radius, token, sides=6):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius,
                                      depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    obj.parent = root
    obj.data.materials.append(mat(token))
    return obj


def fold_palette(obj):
    """Bake rigid palette faces to one material; district batching retains their RGB."""
    data=obj.data
    white=mat('picketWhite')
    base=white.diffuse_color[:3]
    layer=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for polygon in data.polygons:
        rgb=data.materials[polygon.material_index].diffuse_color[:3]
        for loop in polygon.loop_indices:
            layer.data[loop].color=(*[rgb[i]/base[i] for i in range(3)],1)
        polygon.material_index=0
    data.color_attributes.active_color=layer
    data.materials.clear()
    data.materials.append(white)


def corn(root, lod):
    """Volumetric stalks, curled ribbons, dry soil and stubble in one coloured mesh."""
    rng = random.Random(1029)
    vertices, faces, colors, smooth_faces = [], [], [], []
    white = mat('picketWhite').diffuse_color[:3]
    swatches = {token: tuple(mat(token).diffuse_color[i]/white[i] for i in range(3))
                for token in ['canvasTan','khakiLight','brass','woodWarm','khakiSeam','leatherShadow','leather','trouserSeam']}
    def part(points, polygons, tokens, smooth=False):
        n=len(vertices)
        vertices.extend(points)
        faces.extend(tuple(n+i for i in face) for face in polygons)
        smooth_faces.extend([smooth]*len(polygons))
        colors.extend(swatches[token] for token in ([tokens]*len(points) if isinstance(tokens,str) else tokens))
    def prism(a,b,r0,r1,token,caps=False):
        a,b=Vector(a),Vector(b)
        axis=(b-a).normalized()
        side=axis.cross(Vector((1,0,0)) if abs(axis.x)<.8 else Vector((0,1,0))).normalized()
        other=axis.cross(side)
        points=[tuple(center+(side*math.cos(k*math.tau/3)+other*math.sin(k*math.tau/3))*r)
                for center,r in [(a,r0),(b,r1)] for k in range(3)]
        polygons=[(k,(k+1)%3,(k+1)%3+3,k+3) for k in range(3)]
        if caps:
            polygons += [(0,2,1),(3,4,5)]
        part(points,polygons,['leatherShadow']*3+[token]*3)
    # Sculpted soil beds/furrows stay below the wind weight. One mesh, no extra draw.
    part([(-5,-5,.024),(5,-5,.024),(5,5,.024),(-5,5,.024)],[(0,1,2,3)],'leather')
    soil_rows=9 if lod==1 else 12
    for row in range(soil_rows):
        x=-4.5+row*9/(soil_rows-1)
        part([(x-.19,-5,.027),(x,-5,.095),(x,5,.095),(x-.19,5,.027),
              (x+.19,-5,.027),(x+.19,5,.027)],[(0,1,2,3),(1,4,5,2)],
             ['leather','trouserSeam','trouserSeam','leather','leather','leather'])
    stalks=leaves=broken=ears=0
    if lod == 2:
        # Far field: tapered clump silhouettes, coloured by row, with earth furrows.
        # 48 clumps x 3 triangles + 50 soil triangles = 194 triangles.
        for row in range(8):
            for col in range(6):
                x,y=-4.6+row*9.2/7,-4.6+col*9.2/5
                h=rng.uniform(2.1,2.65)
                angle=(row%2)*math.pi/2+.3
                dx,dy=math.cos(angle),math.sin(angle)
                profile=[(-.025,0),(.025,0),(.65,h*.53),(.02,h),(-.65,h*.72)]
                token=rng.choice(['canvasTan','khakiLight','brass','woodWarm'])
                part([(x+dx*a,y+dy*a,z+.1) for a,z in profile],[(0,1,2),(0,2,3),(0,3,4)],
                     ['leatherShadow','leatherShadow',token,token,token])
                stalks+=1
    else:
        rows,columns=(12,14) if lod==0 else (9,9)
        for row in range(rows):
            for col in range(columns):
                edge=row in (0,rows-1) or col in (0,columns-1)
                if rng.random() < (.20 if edge else .025 if lod==0 else .1):
                    continue
                x=-4.5+row*9/(rows-1)+rng.uniform(-.07,.07)
                y=-4.6+col*9.2/(columns-1)+rng.uniform(-.1,.1)
                snapped=rng.random()<.14
                h=rng.uniform(.65,1.65) if snapped else rng.uniform(2.25,2.6)
                lean=rng.uniform(-.36,.36)
                radius=(.018 if edge else .027)*rng.uniform(.85,1.15)
                token=rng.choice(['canvasTan','khakiLight','brass','khakiSeam','woodWarm'])
                tip=Vector((x+lean,y+rng.uniform(-.18,.18),h))
                if lod==0 and rng.random()<.18:
                    bend=Vector((x+lean*.25,y,h*.58))
                    prism((x,y,.07),bend,radius,radius*.65,token,True)
                    prism(bend,tip,radius*.65,.009,token,True)
                else:
                    prism((x,y,.07),tip,radius,.008,token,lod==0)
                stalks+=1
                broken+=int(snapped)
                for k in range(4 if lod==0 else 3):
                    angle=k*2.4+rng.uniform(-.45,.45)+row*.31
                    direction=Vector((math.cos(angle),math.sin(angle),0))
                    across=Vector((-direction.y,direction.x,0))
                    z=h*(.26+k*(.16 if lod==0 else .25))
                    base=Vector((x+lean*z/h,y,z))
                    length=rng.uniform(.58,.88)*(.72 if edge else 1)
                    width=rng.uniform(.038,.075)*(.7 if edge else 1)
                    centers=([base,base+direction*length*.28+Vector((0,0,.17)),
                              base+direction*length*.62+across*.04+Vector((0,0,.11)),
                              base+direction*length+across*.09+Vector((0,0,-rng.uniform(.25,.48)))] if lod==0 else
                             [base,base+direction*length*.48+Vector((0,0,.18)),
                              base+direction*length+across*.07+Vector((0,0,-rng.uniform(.25,.48)))])
                    widths=[.006,width*.8,width,.003] if lod==0 else [.006,width,.003]
                    for center in centers:
                        center.z=max(.1,center.z)
                    points=[]
                    for j,(center,w) in enumerate(zip(centers,widths)):
                        twist=(across+Vector((0,0,.18*math.sin(j*math.pi/2+angle)))).normalized()
                        points.extend([tuple(center-twist*w),tuple(center+twist*w)])
                    polygons=[(j*2,j*2+1,(j+1)*2+1,(j+1)*2) for j in range(len(centers)-1)]
                    leaf_token=rng.choice(['canvasTan','khakiLight','brass','woodWarm','khakiSeam'])
                    tip_token='woodWarm' if rng.random()<.3 else leaf_token
                    part(points,polygons,['khakiSeam']*2+[leaf_token]*(len(points)-4)+[tip_token]*2,True)
                    leaves+=1
                if not snapped:
                    # Forked tassels have narrow branches; ears are closed tetrahedral husks.
                    for side in ([-1,1] if lod==0 else [1] if rng.random()<.5 else []):
                        a=tip+Vector((0,0,-.03));b=tip+Vector((side*.14,.045,.22))
                        part([tuple(a+Vector((-.009,0,0))),tuple(a+Vector((.009,0,0))),tuple(b)],[(0,1,2)],token)
                    if rng.random() < (.5 if lod==0 else .08):
                        c=Vector((x+.07,y,h*.64))
                        part([tuple(c+Vector((-.065,0,0))),tuple(c+Vector((.065,0,0))),
                              tuple(c+Vector((0,.08,.1))),tuple(c+Vector((.07,0,.34)))],
                             [(0,1,2),(0,3,1),(1,3,2),(2,3,0)],'brass')
                        ears+=1
        for k in range(12 if lod==0 else 3):
            x,y=rng.uniform(-4.8,4.8),rng.uniform(-4.8,4.8)
            prism((x,y,.03),(x+.04,y,.16+rng.random()*.18),.018,.008,'woodWarm')
    obj=mesh(root,'dry-corn-volume-and-furrows',vertices,faces,'picketWhite')
    for face,smooth in zip(obj.data.polygons,smooth_faces):
        face.use_smooth=smooth
    layer=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,rgb in enumerate(colors):
        layer.data[i].color=(*rgb,1)
    obj.data.color_attributes.active_color=layer
    root['cornStalks']=stalks
    root['cornCurledLeaves']=leaves
    root['cornBrokenStalks']=broken
    root['cornEars']=ears
    root['cornFurrows']=soil_rows
    root['cornPaletteSwatches']=len(set(colors))


def vehicle(root, lod, combine, burned):
    rust, tire, paint, detail = 'leatherShadow', 'asphalt', 'khakiSeam', 'brick'
    paint = tire if burned else paint
    sides = [12, 8, 6][lod]
    for sign in [-1,1]:
        box(root,'mud-wheel-rut',(0,sign*.8,.025),(5.8 if combine else 3.7,.23,.025),'leather')
    if combine:
        box(root,'inclined-header-feeder',(2.0,0,.88),(1.5,.75,.38),rust,(0,.42,0))
    # The combine's large drive tyres are at the header; the tractor's are at the rear.
    wheels = [(-1.12,.77),(1.15,.43)] if not combine else [(-1.95,.48),(.95,.82)]
    for x, radius in wheels:
        for sign in [-1,1]:
            y = sign*(.79 if not combine else .88)
            rod(root,'tyre',(x,y-.20,radius),(x,y+.20,radius),radius,tire,sides)
            if lod < 2:
                rod(root,'recessed-rusted-hub',(x,y+sign*.205,radius),
                    (x,y+sign*.235,radius),radius*.44,detail,sides)
            if lod == 0:
                for k in range(10):
                    a = k*math.tau/10
                    box(root,'chevron-tread',(x+math.sin(a)*radius,y,radius+math.cos(a)*radius),
                        (.15,.43,.085),tire,(0,a,sign*.18))
    if lod == 2:
        box(root,'chassis',(0,0,.75),(3.5 if not combine else 5.25,.7,.25),rust)
        if combine:
            box(root,'thresher-body',(-1.25,0,1.6),(3.2,1.25,1.4),paint)
            if not burned:
                box(root,'cab',(.9,0,2.1),(1.0,1.15,1.1),tire)
            else:
                box(root,'cab-floor',(.9,0,1.53),(1.0,1.15,.12),tire)
                for x in [.4,1.4]:
                    for y in [-.52,.52]:
                        rod(root,'charred-cab-post',(x,y,1.53),(x,y,2.6),.05,rust,3)
            box(root,'cab-roof',(.9,0,2.7),(1.25,1.3,.1),paint)
            box(root,'hopper-rim',(-1.4,0,2.36),(2.4,1.45,.15),paint)
            box(root,'hopper-mouth',(-1.4,0,2.45),(2.05,1.1,.025),tire)
            box(root,'header',(3.05,0,.4),(.65,3.5,.45),rust)
            rod(root,'header-reel',(3.12,-1.6,.86),(3.12,1.6,.86),.1,rust,4)
            rod(root,'auger',(-1.8,.6,2.1),(-2.9,1.6,2.65),.085,rust,4)
            rod(root,'exhaust',(-.75,-.5,2.0),(-.75,-.5,2.7),.065,rust,4)
        else:
            box(root,'hood',(.7,0,1.3),(1.55,.84,.75),paint)
            for x in [-1.5,-.15]:
                for y in [-.46,.46]:
                    rod(root,'cab-frame',(x,y,1.3),(x,y,2.7),.045,rust,3)
            box(root,'cab-roof',(-.82,0,2.72),(1.5,1.12,.09),paint)
            rod(root,'exhaust',(.36,.3,1.6),(.36,.3,2.65),.06,rust,4)
        return
    box(root,'chassis',(0,0,.68),(3.7 if not combine else 5.55,.7,.26),rust)
    if not combine:
        # Tapered engine housing, radiator grille, rear mudguards and a visibly open cab.
        mesh(root,'tapered-hood',[(-.15,-.48,.95),(-.15,.48,.95),(1.5,.4,.95),(1.5,-.4,.95),
                                (-.15,-.43,1.7),(-.15,.43,1.7),(1.5,.34,1.48),(1.5,-.34,1.48)],
             [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],paint)
        box(root,'radiator',(1.51,0,1.2),(.045,.62,.48),tire)
        box(root,'front-bumper',(1.82,0,.55),(.16,1.35,.18),rust)
        box(root,'rear-hitch',(-1.93,0,.42),(.25,.38,.14),rust)
        for y in [-.73,.73]:
            box(root,'rear-fender',(-1.1,y,1.59),(1.5,.45,.12),paint)
            box(root,'cab-step',(-.35,y, .8),(.5,.45,.08),rust)
        for x in [-1.5,-.15]:
            for y in [-.46,.46]:
                rod(root,'cab-post',(x,y,1.3),(x,y,2.72),.045,rust,4)
        box(root,'cab-roof',(-.82,0,2.75),(1.5,1.12,.10),paint,(.13 if burned else 0,.06 if burned else 0,0))
        box(root,'seat',(-.96,0,1.35),(.45,.5,.14),tire)
        box(root,'seat-back',(-1.16,0,1.58),(.12,.49,.43),tire,(0,-.14,0))
        rod(root,'exhaust',(.36,.3,1.6),(.36,.3,2.65),.065,rust,sides)
        if lod == 0:
            for y in [-.27,.27]:
                box(root,'headlight',(1.56,y,1.42),(.07,.16,.12),detail)
            for k in range(7):
                box(root,'grille-slat',(1.542,-.25+k*.083,1.2),(.018,.025,.42),rust)
            rod(root,'steering-column',(-.37,0,1.0),(-.47,0,1.65),.035,rust)
            rod(root,'steering-wheel',(-.47,-.18,1.65),(-.47,.18,1.65),.025,rust)
    else:
        box(root,'engine-housing',(-1.3,0,1.45),(3.25,1.3,1.35),paint)
        # Sloping grain hopper rim, high cab and a projecting harvesting reel.
        box(root,'grain-hopper',(-1.45,0,2.35),(2.4,1.55,.35),paint)
        box(root,'hopper-mouth',(-1.45,0,2.54),(1.95,1.16,.035),tire)
        if not burned:
            box(root,'cab-dark-glass',(.88,0,2.0),(1.15,1.15,1.1),tire)
        else:
            box(root,'burned-cab-floor',(.88,0,1.48),(1.15,1.15,.12),tire)
        box(root,'cab-roof',(.88,0,2.61),(1.45,1.42,.12),paint)
        for x in [.29,1.47]:
            for y in [-.59,.59]:
                rod(root,'cab-post',(x,y,1.48),(x,y,2.58),.045,rust,4)
        box(root,'header-trough',(2.97,0,.37),(.72,3.5,.38),rust)
        rod(root,'reel-axle',(3.12,-1.6,.86),(3.12,1.6,.86),.075,rust,sides)
        for a in range(3 if lod == 1 else 4):
            angle=a*math.tau/(3 if lod == 1 else 4)
            x,z=3.12+math.sin(angle)*.30,.86+math.cos(angle)*.30
            rod(root,'reel-bar',(x,-1.6,z),(x,1.6,z),.025,detail,4)
            for y in [-1.58,1.58]:
                rod(root,'reel-spoke',(3.12,y,.86),(x,y,z),.025,rust,4)
        rod(root,'unloading-auger',(-1.8,.6,2.0),(-2.9,1.6,2.65),.09,rust,6)
        rod(root,'exhaust',(-.75,-.5,2.0),(-.75,-.5,2.7),.065,rust,6)
        if lod == 0:
            for k in range(16):
                y=-1.58+k*.21
                mesh(root,'cutter-tooth',[(3.34,y-.06,.28),(3.34,y+.06,.28),(3.56,y,.18)],[(0,1,2)],detail)
            for k in range(5):
                box(root,'access-ladder',(.05,-.85,.42+k*.23),(.5,.09,.05),rust)
    if lod == 0:
        rng=random.Random(823)
        # Raised flaking paint/rust patches and seams, with no coplanar decals.
        for k in range(9):
            x=rng.uniform(-1.2,1.2)
            box(root,'rust-flake',(x,-(.491 if not combine else .661),rng.uniform(1.0,1.5)),
                (rng.uniform(.10,.26),.025,rng.uniform(.06,.16)),rust)


def building(root, lod, house, burned):
    # The original ten-metre barn plot now includes its grain silo and hay stack.
    w,d = (8,7) if house else (7,8)
    eave,ridge = (2.55,3.72) if house else (3.35,5.18)
    wall = 'asphalt' if burned else 'khakiSeam' if house else 'brick'
    char,wood,roof = 'asphalt','woodWarm','leatherShadow'
    opening = 1.8 if house else 2.8
    # Solid side walls; both gable ends have a real escape opening at ground level.
    for x in [-w/2,w/2]:
        box(root,'side-wall',(x,0,eave/2),(.18,d,eave),wall)
    for y in [-d/2,d/2]:
        for side in [-1,1]:
            width=(w-opening)/2
            box(root,'door-pier',(side*(opening/2+width/2),y,eave/2),(width,.18,eave),wall)
        box(root,'door-header',(0,y,(eave+2.2)/2),(opening,.2,eave-2.2),wall)
        mesh(root,'gable',[(-w/2,y,eave),(0,y,ridge),(w/2,y,eave)],[(0,1,2)],wall)
        if lod < 2:
            # Open, charred double doors hang at each jamb, never close the authored escape gap.
            for side in [-1,1]:
                box(root,'hanging-door',(side*(opening/2+.35),y-.18,1.0),(.64,.14,2.0),wood,(0,.04*side,side*.08))
            if not house:
                rod(root,'barn-lintel',(-opening/2-.2,y-.16,2.3),(opening/2+.2,y-.16,2.3),.065,char,4)
    # Pitched roof panel recipe derived from bld.house-a, with a sagged centre bay.
    def roof_z(x,y):
        return ridge-(ridge-eave)*abs(x)/(w/2)-(.24 if burned else .14)*max(0,1-abs(y)/(d/2))
    bays=6 if lod == 0 else 4 if lod == 1 else 3
    for k in range(bays):
        ya=-d/2-.08+k*(d+.16)/bays
        yb=-d/2-.08+(k+1)*(d+.16)/bays
        for side in [-1,1]:
            missing = (not house or burned) and side==1 and abs((k+.5)/bays-.5)<.18
            if not missing:
                xa,xb=0,side*(w/2+.10)
                mesh(root,'sagging-roof-panel',[(xa,ya,roof_z(xa,ya)),(xb,ya,roof_z(xb,ya)),
                                             (xb,yb,roof_z(xb,yb)),(xa,yb,roof_z(xa,yb))],[(0,1,2,3)],roof)
            if lod < 2:
                rod(root,'exposed-rafter',(0,ya,roof_z(0,ya)-.07),(side*w/2,ya,eave-.08),.07,char,4)
                if missing:
                    # Splintered roof boards project into the hole at different lengths.
                    for j in range(3 if lod==0 else 1):
                        x=side*(.45+j*.62)
                        mesh(root,'torn-roof-edge',[(x,ya,roof_z(x,ya)),(x+.24,ya,roof_z(x+.24,ya)),
                                                 (x+.12,ya+.20+j*.09,roof_z(x+.12,ya)-.14)],[(0,1,2)],roof)
    # End caps extend beyond the gable plane instead of overlapping its coloured face.
    rod(root,'ridge-pole',(0,-d/2-.12,ridge),(0,d/2+.12,ridge),.08,char,4)
    if lod < 2:
        for x in [-w/2,w/2]:
            for y in [-d/2,d/2]:
                box(root,'corner-upright',(x,y,eave/2+.045),(.22,.22,eave-.03),char)
        # Window recesses and broken frames are proud of the wall, including the far side.
        for side in [-1,1]:
            for y in [-d*.27,d*.27]:
                x=side*(w/2+.11)
                box(root,'window-recess',(x,y,1.65),(.025,1.0,.83),char)
                for dy in [-.54,.54]:
                    box(root,'window-jamb',(x+side*.025,y+dy,1.65),(.06,.08,.95),wood)
                box(root,'window-sill',(x+side*.035,y,1.2),(.12,1.18,.10),wood)
                box(root,'diagonal-board',(x+side*.04,y,1.64),(.08,1.05,.13),roof,(.24,0,0))
        if house:
            box(root,'brick-chimney',(-2,d*.22,2.2),(.65,.65,3.8),'brick' if burned else wood)
    if lod == 0:
        # Siding seams, torn roof edges, fallen charred planks and a collapsed porch.
        for side in [-1,1]:
            for k in range(9 if not house else 7):
                y=-d/2+.3+k*(d-.6)/(8 if not house else 6)
                box(root,'siding-batten',(side*(w/2+.115),y,eave/2),(.035,.065,eave-.15),wood)
            for k in range(8):
                y=-d/2+.35+k*(d-.7)/7
                height=.45+(k%2)*.25
                box(root,'scorched-siding',(side*(w/2+.135),y,height/2+.035+(k%3)*.06),
                    (.025,.22,height),char)
        for k in range(8):
            y=-d/2+.2+k*(d-.4)/7
            rod(root,'roof-standing-seam',(-w/2,y,eave+.03),(0,y,ridge+.03),.018,char,4)
        if house:
            for x in [-1.5,1.5]:
                rod(root,'broken-porch-post',(x,-d/2-.12,0),(x,-d/2-.12,1.65),.075,wood,4)
        rng=random.Random(341)
        for k in range(7):
            box(root,'fallen-charred-timber',(rng.uniform(-w*.4,w*.4),rng.uniform(-d*.4,d*.4),.14),
                (.13,rng.uniform(1.0,2.6),.12),char,(0,.03,rng.uniform(-1.4,1.4)))
    for side in [-1,1]:
        box(root,'mud-cart-rut',(side*.48,0,.025),(.24,d,.025),'leather')
    if not house:
        # Corrugated grain bin, rusted ladder and split straw bales share this asset's
        # original plot, rigid owner and single folded material: no new placements.
        metal='asphalt' if burned else 'silver'
        segments=[16,12,8][lod]
        rod(root,'grain-silo',(4.3,2.55,.12),(4.3,2.55,4.35),.78,metal,segments)
        bpy.ops.mesh.primitive_cone_add(vertices=segments,radius1=.84,radius2=.07,depth=.75,location=(4.3,2.55,4.72))
        obj=bpy.context.object
        obj.name='silo-cap'
        obj.parent=root
        obj.data.materials.append(mat('leatherShadow'))
        for k in range([10,5,2][lod]):
            z=.3+k*3.9/([10,5,2][lod]-1)
            bpy.ops.mesh.primitive_torus_add(major_radius=.805,minor_radius=.018,major_segments=segments,minor_segments=3,location=(4.3,2.55,z))
            obj=bpy.context.object
            obj.name='corrugated-silo-hoop'
            obj.parent=root
            obj.data.materials.append(mat('leatherShadow'))
        if lod<2:
            for y in [2.28,2.82]:
                rod(root,'silo-ladder-rail',(5.12,y,.2),(5.12,y,4.35),.023,char,4)
            for k in range(12 if lod==0 else 6):
                z=.3+k*3.9/(11 if lod==0 else 5)
                rod(root,'silo-ladder-rung',(5.13,2.28,z),(5.13,2.82,z),.02,char,4)
        for y in [-2.2,-.75]:
            rod(root,'round-hay-bale',(4.32,y-.55,.58),(4.32,y+.55,.58),.55,'brass',[12,8,6][lod])
            if lod<2:
                for offset in [-.35,.35]:
                    bpy.ops.mesh.primitive_torus_add(major_radius=.55,minor_radius=.024,major_segments=[12,8][lod],minor_segments=3,location=(4.32,y+offset,.58),rotation=(math.pi/2,0,0))
                    obj=bpy.context.object
                    obj.name='hay-bale-binding'
                    obj.parent=root
                    obj.data.materials.append(mat('leatherShadow'))
        for y in [1.0,2.3,3.6]:
            box(root,'broken-paddock-post',(-4.7,y,.65),(.13,.14,1.3),wood,(0,.06,0))
        for z in [.5,1.05]:
            box(root,'paddock-rail',(-4.7,2.3,z),(.09,2.6,.10),roof,(.05,0,0))
        root['farmSilo']=True
        root['farmHayBales']=2
