"""W5 twins cut directly from the three shipped, explicitly authored civic tiers.
No rebuilding/fitting of the base, no decimation: foundations and interface empties stay exact.
"""
import argparse
import hashlib
import json
import math
import random
import shutil
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from . import export, palette, sockets, ao
from .rescue_assets import Scene


def difference(obj, cutter):
    """Cut intersecting solid components only; overlapping roof trim must not
    confuse a Boolean into deleting remote tower / finial geometry."""
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    # Imported distance shells contain inward-facing triangles. Booleans need
    # consistent outward winding before the cut, otherwise remote walls vanish.
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.verts.ensure_lookup_table();seen=set();components=[]
    for v in bm.verts:
        if v in seen:continue
        stack=[v];seen.add(v);verts=[];faces=set()
        while stack:
            q=stack.pop();verts.append(q);faces.update(q.link_faces)
            for e in q.link_edges:
                other=e.other_vert(q)
                if other not in seen:seen.add(other);stack.append(other)
        components.append((verts,faces))
    corners=[cutter.matrix_world@Vector(c) for c in cutter.bound_box]
    lo=[min(v[i] for v in corners) for i in range(3)];hi=[max(v[i] for v in corners) for i in range(3)]
    outverts=[];outfaces=[]
    for verts,faces in components:
        world=[obj.matrix_world@v.co for v in verts]
        intersects=all(max(v[i] for v in world)>lo[i]+1e-5 and min(v[i] for v in world)<hi[i]-1e-5 for i in range(3))
        idx={v:i for i,v in enumerate(verts)};vs=[tuple(v.co) for v in verts];fs=[tuple(idx[v] for v in f.verts) for f in sorted(faces,key=lambda f:f.index)]
        if intersects:
            data=bpy.data.meshes.new('temporaryComponent');data.from_pydata(vs,[],fs)
            for m in obj.data.materials:data.materials.append(m)
            part=bpy.data.objects.new('temporaryComponent',data);bpy.context.collection.objects.link(part);part.matrix_world=obj.matrix_world.copy()
            bpy.context.view_layer.objects.active=part
            mod=part.modifiers.new('blast','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.use_self=True;mod.object=cutter
            bpy.ops.object.modifier_apply(modifier=mod.name)
            vs=[tuple(v.co) for v in part.data.vertices];fs=[tuple(p.vertices) for p in part.data.polygons]
            used=part.data;bpy.data.objects.remove(part,do_unlink=True);bpy.data.meshes.remove(used)
        offset=len(outverts);outverts.extend(vs);outfaces.extend(tuple(i+offset for i in f) for f in fs)
    bm.free()
    data=bpy.data.meshes.new(obj.name+'_cut');data.from_pydata(outverts,[],outfaces)
    for m in obj.data.materials:data.materials.append(m)
    old=obj.data;obj.data=data
    if old.users==0:bpy.data.meshes.remove(old)


def prism(s, plane, poly, lo, hi, name='temporaryBlast'):
    """Extrude a (possibly concave) 2D polygon into a cutter solid."""
    area=sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))
    if area<0: poly=list(reversed(poly))
    n=len(poly)
    def v(a,b,c):
        return (c,a,b) if plane=='yz' else (a,b,c) if plane=='xy' else (a,c,b)
    vs=[v(a,b,c) for c in (lo,hi) for a,b in poly]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=s.mesh(name,vs,faces,'uiDark')
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj


# W5 devastation: extra cutters (plane, polygon, lo, hi), tilted slabs / balconies
# (center, size, euler, material), leaning beams (a, b) and rubble piles
# (cx, cy, radius, height, count). Every material already exists in the body batch.
COLLAPSE={
 'apartment-block-a':dict(wall_top=12.2,
  rubble=['brick','picketWhite','backpackTeal'],limit=(-4.8,5.5,6.3),
  cuts=[('yz',[(-7,6.2),(-4.3,6.2),(-4.3,7.4),(-3.0,7.4),(-3.0,9.0),(-1.8,9.0),(-1.8,10.6),(-.9,10.6),(-.9,14),(-7,14)],-.8,6.2),
        ('xz',[(6.5,7.4),(-3.4,7.4),(-3.4,9.2),(-2.2,9.2),(-2.2,10.4),(-.9,10.4),(-.9,14),(6.5,14)],-7,-3.4)],
  boxes=[((2.4,-3.6,6.3),(6.2,5.2,.22),(0,0,0),'picketWhite'),((2.4,-3.6,6.43),(6.0,5.0,.03),(0,0,0),'uiDark'),
         ((-2.0,-4.7,9.0),(2.6,2.2,.2),(0,.38,.1),'picketWhite'),
         ((4.95,3.3,6.1),(1.0,2.6,.14),(0,.55,0),'picketWhite'),
         ((-3.0,-6.1,3.4),(2.2,.8,.14),(.5,0,0),'picketWhite')],
  beams=[((1.5,-5.6,6.4),(4.9,-6.6,1.0)),((3.9,-3.4,6.4),(5.2,-1.8,.9)),((-1.0,-6.0,9.0),(1.2,-6.8,1.0))],
  piles=[(3.2,-5.4,2.4,2.1,34),(0.2,-5.8,1.6,1.3,14),(5.0,-1.9,1.1,1.0,8)]),
 'apartment-block-b':dict(wall_top=15.0,
  rubble=['picketWhite','backpackTeal'],limit=(-4.8,5.2,6.3),
  cuts=[('yz',[(-7,9.4),(-4.9,9.4),(-4.9,10.7),(-3.6,10.7),(-3.6,12.2),(-2.2,12.2),(-2.2,13.8),(-1.0,13.8),(-1.0,19),(-7,19)],1.0,6.2),
        ('xz',[(6.2,12.4),(-1.2,12.4),(-1.2,13.6),(-2.6,13.6),(-2.6,15.2),(-3.8,15.2),(-3.8,19),(6.2,19)],-7,-4.0)],
  boxes=[((3.0,-3.8,9.5),(4.2,4.6,.22),(0,0,0),'picketWhite'),((3.0,-3.8,9.63),(4.0,4.4,.03),(0,0,0),'uiDark'),
         ((-1.8,-5.0,12.2),(2.6,2.0,.2),(.3,.2,0),'picketWhite'),
         ((4.95,3.4,6.5),(1.0,2.6,.14),(0,.55,0),'picketWhite'),
         ((5.0,-3.2,3.6),(1.1,2.2,.14),(0,.5,0),'picketWhite'),
         ((-2.4,-6.1,6.4),(2.2,.8,.14),(.5,0,0),'picketWhite')],
  beams=[((2.0,-5.2,9.5),(5.1,-6.4,1.0)),((4.0,-2.6,9.5),(5.2,-1.2,.9)),((-1.5,-6.0,12.2),(.8,-6.8,1.0))],
  piles=[(3.4,-5.4,2.3,2.4,30),(0.4,-5.9,1.6,1.4,14),(5.0,-1.8,1.0,1.0,7)]),
 'town-hall':dict(wall_top=7.8,
  rubble=['brick','picketWhite'],limit=(-5.0,6.9,8.0),
  cuts=[('yz',[(-8.6,3.95),(-6.4,3.95),(-6.4,5.2),(-5.2,5.2),(-5.2,6.4),(-4.1,6.4),(-4.1,7.7),(-3.0,7.7),(-3.0,16),(-8.6,16)],.6,5.6),
        ('xz',[(6.5,8.2),(-.8,8.2),(-.8,9.6),(-2.2,9.6),(-2.2,11.2),(-3.4,11.2),(-3.4,16),(6.5,16)],-8.6,-5.0),
        ('xz',[(-3.2,10.6),(-1.8,11.7),(-.9,10.5),(.3,12.0),(1.5,10.9),(3.2,11.5),(3.2,20),(-3.2,20)],-3.2,3.2)],
  boxes=[((3.1,-6.2,3.95),(5.0,4.6,.22),(0,0,0),'picketWhite'),((3.1,-6.2,4.08),(4.8,4.4,.03),(0,0,0),'uiDark'),
         ((.3,-6.4,7.4),(2.4,2.0,.2),(.3,.3,.1),'picketWhite'),
         ((5.4,5.2,3.9),(1.4,2.8,.14),(0,.5,0),'picketWhite'),((-2.5,-7.8,3.9),(2.4,.8,.14),(.45,0,0),'picketWhite')],
  beams=[((2.5,-7.2,4.0),(6.0,-8.0,1.0)),((4.6,-4.4,4.0),(6.1,-3.2,1.0)),((.2,-7.6,7.4),(2.5,-8.2,1.0))],
  piles=[(3.6,-7.0,2.6,2.3,34),(0.6,-7.4,1.6,1.4,12),(5.8,-3.4,1.2,1.2,8)]),
 'church':dict(wall_top=5.1,
  rubble=['picketWhite','khaki'],limit=(-9.0,9.0,5.28),
  cuts=[('xy',[(-6.2,-6),(-6.2,-2.4),(-4.6,-1.2),(-3.4,-2.1),(-2.0,.3),(-.6,-.9),(1.2,.9),(2.6,-.2),(3.9,-.9),(3.9,-6)],4.7,20),
        ('yz',[(-3.2,11.6),(-1.6,12.6),(-.7,11.4),(.4,12.9),(1.4,11.8),(3.2,12.4),(3.2,22),(-3.2,22)],4.7,9.4)],
  boxes=[((-1.8,-3.2,5.0),(2.8,2.2,.2),(.2,.3,.1),'picketWhite'),((2.6,-4.0,3.4),(2.4,1.6,.18),(.4,0,0),'picketWhite')],
  beams=[((0.6,-4.3,5.3),(3.2,-5.15,0.8)),((-3.0,-3.0,5.3),(-1.0,-5.1,.8)),((6.8,0.4,11.4),(8.3,3.2,.8))],
  piles=[(1.4,-4.3,2.4,1.9,30),(-2.6,-4.4,1.7,1.2,12),(7.4,-3.0,1.4,1.3,10),(7.1,2.4,1.2,1.1,8)]),
}



def damage(asset, directory, lod):
    source = directory / ('model' + (f'.lod{lod}' if lod else '') + '.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    root = bpy.data.objects['root']; body = bpy.data.objects['body']; roof = bpy.data.objects['roof']
    # Imported glTF material names are the shared palette names. Dead emissive
    # panes become unlit blue glass over black recesses; public names survive as empties.
    dark = palette.mat('uiDark')
    old_emissive = []
    for obj in list(root.children_recursive):
        if obj.type != 'MESH': continue
        if 'emi_windowGlow' in obj.name: old_emissive.append(obj.name)
        for i, mat in enumerate(obj.data.materials):
            if mat.name.startswith('emi_'): obj.data.materials[i] = palette.mat('uiDark')
    for obj in root.children_recursive:
        if 'ss_light' in obj:
            data = json.loads(obj['ss_light']) if isinstance(obj['ss_light'], str) else dict(obj['ss_light'])
            data['intensity'] = 0; data['emissiveNodes'] = ['body_pal_uiDark']
            obj['ss_light'] = json.dumps(data)
    root['decay'] = 'w5'; root['derivedFrom'] = str(source.relative_to(directory.parents[1]))
    root['sourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    s = Scene.__new__(Scene); s.asset=asset;s.lod=lod;s.root=root;s.body=body
    s.protected={'body','roof','interior','door_front'}
    # One large breach on the +X / -Y camera frontage. Its ragged stepped outline
    # cuts walls, projecting trim and roof together; the unchanged foundation remains.
    if 'apartment' in asset:
        x0,x1=1.9,6.0;y0,y1=-7.0,-2.7;z0=3.65;top=15.8 if asset.endswith('-b') else 12.9
        floors=[3.25,6.25,9.28]+([12.3,15.3] if asset.endswith('-b') else [12.3])
        wall=4.42;side=-6.05;material='picketWhite' if asset.endswith('-b') else 'brick'
    elif asset.endswith('town-hall'):
        x0,x1=1.85,5.25;y0,y1=-8.5,-3.65;z0=2.65;top=10.7
        floors=[3.85,7.7];wall=4.83;side=-7.77;material='brick'
    else:
        x0,x1=-.3,3.85;y0,y1=-5.6,-2.3;z0=2.35;top=8.9
        floors=[5.3];wall=7.84;side=-5.07;material='picketWhite'
    # Vertical boundary steps remain broad at LOD2, rather than relying on tiny scars.
    yz=[(y0,z0),(y1-.55,z0),(y1-.55,z0+1.1),(y1+.3,z0+1.1),
        (y1+.3,z0+2.0),(y1-.15,z0+2.0),(y1-.15,z0+3.0),
        (y1+.48,z0+3.0),(y1+.48,top),(y0,top)]
    n=len(yz);vs=[(x,y,z) for x in (x0,x1) for y,z in yz]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    cutter=s.mesh('temporaryBlast',vs,faces,'uiDark')
    for obj in list(root.children_recursive):
        if obj.type!='MESH' or obj==cutter or obj.parent.name=='door_front':continue
        difference(obj,cutter)
    bpy.data.objects.remove(cutter,do_unlink=True)
    cfg=COLLAPSE[asset.removeprefix('bld.')]
    for plane,poly,lo,hi in cfg['cuts']:
        c=prism(s,plane,poly,lo,hi)
        for obj in list(root.children_recursive):
            if obj.type!='MESH' or obj==c or obj.parent.name=='door_front':continue
            difference(obj,c)
        bpy.data.objects.remove(c,do_unlink=True)
    def inside(p3):
        for plane,poly,lo,hi in cfg['cuts']:
            a,b,c=(p3[1],p3[2],p3[0]) if plane=='yz' else (p3[0],p3[1],p3[2]) if plane=='xy' else (p3[0],p3[2],p3[1])
            if not lo<c<hi:continue
            ok=False;j=len(poly)-1
            for i in range(len(poly)):
                (xi,yi),(xj,yj)=poly[i],poly[j]
                if (yi>b)!=(yj>b) and a<(xj-xi)*(b-yi)/(yj-yi)+xi:ok=not ok
                j=i
            if ok:return True
        return False
    # Boolean remnants (open shells, thin spires) inside a cutter are removed outright.
    for obj in list(root.children_recursive):
        if obj.type!='MESH' or obj.parent.name=='door_front':continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        doomed=[f for f in bm.faces if inside(obj.matrix_world@f.calc_center_median())]
        if doomed:bmesh.ops.delete(bm,geom=doomed,context='FACES')
        bm.to_mesh(obj.data);bm.free()
    base_z=min(min(z for _,z in poly) for plane,poly,_,_ in cfg['cuts'] if plane=='yz')
    # Exposed floor ends, black recess and broken beams are inside the original lot.
    for z in floors:
        if z>top or z>=base_z-.1:continue
        o=s.box('exposedFloor',(x0+.7,(y0+y1)/2+.45,z),(1.4,2.9,.18),'picketWhite');
        if o.modifiers.get('bevel'):o.modifiers.remove(o.modifiers['bevel'])
        o=s.box('charredFloor',(x0+.7,(y0+y1)/2+.45,z+.10),(1.35,2.8,.025),'uiDark')
        if o.modifiers.get('bevel'):o.modifiers.remove(o.modifiers['bevel'])
    # Closed charred rafters spanning only the broken edge, owned by the cutaway roof.
    for i in range(0):
        y=y1-.7-i*.55
        a=Vector((x0-.25,y,top-1.2));b=Vector((x0+1.5,y,top-2.0))
        o=s.beam('snappedRoofBeam',a,b,.13,'asphalt' if 'apartment' in asset else 'denim' if asset.endswith('town-hall') else 'brick');o.parent=roof
        if o.modifiers.get('bevel'):o.modifiers.remove(o.modifiers['bevel'])
    rnd=random.Random(51)
    xmin,xmax,ymax=cfg['limit']
    def tilt(o,e):
        o.rotation_euler=e
        if o.modifiers.get('bevel') and lod:o.modifiers.remove(o.modifiers['bevel'])
        # Keep every added chunk inside the base asset's measured footprint.
        bpy.context.view_layer.update()
        cs=[o.matrix_world@Vector(c) for c in o.bound_box]
        lo=[min(c[i] for c in cs) for i in range(2)];hi=[max(c[i] for c in cs) for i in range(2)]
        o.location.z+=max(0,.28-min(c[2] for c in cs))
        o.location.x+=max(0,xmin-lo[0])-max(0,hi[0]-xmax);o.location.y+=max(0,-ymax-lo[1])-max(0,hi[1]-ymax)
    for center,size,euler,mat in cfg['boxes']:
        tilt(s.box('collapsedSlab',center,size,mat),euler)
    for a_,b_ in cfg['beams']:
        a_=(max(xmin+.2,min(xmax-.2,a_[0])),max(-ymax+.2,min(ymax-.2,a_[1])),a_[2]);b_=(max(xmin+.2,min(xmax-.2,b_[0])),max(-ymax+.2,min(ymax-.2,b_[1])),b_[2])
        o=s.beam('fallenBeam',a_,b_,.17,'uiDark')
    # Large rubble heaps heaped against the breach foot, inside the original lot.
    scale=[1,1.3,1.8][lod];share=[1.4,.6,.22][lod]
    for cx,cy,rad,hgt,count in cfg['piles']:
        for i in range(max(3,round(count*share))):
            r=rad*math.sqrt(rnd.random());ang=rnd.uniform(0,math.tau)
            x=cx+r*math.cos(ang);y=cy+r*math.sin(ang)
            top_h=max(.3,hgt*1.25*(1-r/rad)**.9)
            w=rnd.uniform(.9,1.9)*scale;h=rnd.uniform(.5,1.1)*scale
            z=.32+top_h*rnd.uniform(.35,1.0)
            o=s.box('fallenMasonry',(x,y,z),(w,w*rnd.uniform(.6,1.0),h),cfg['rubble'][i%len(cfg['rubble'])])
            tilt(o,(rnd.uniform(-.5,.5),rnd.uniform(-.5,.5),rnd.uniform(0,3.1)))
    # Local polygon stains have softer brown-to-charcoal halos via vertex colors,
    # all sharing the dark palette batch. No texture or additional draw is needed.
    soot_colors={}
    def scar(axis,fixed,c,z,w,h):
        pts=[(c-w,z),(c-w*.9,z+h*.5),(c-w*.35,z+h),(c+w*.25,z+h*.86),(c+w,z+h*.28),(c+w*.6,z)]
        vertices=[(fixed,a,b) if axis=='x' else (a,fixed,b) for a,b in pts]
        # The authored outline is clockwise in (horizontal, height). Reverse it
        # so +X and -Y street faces survive the runtime's backface culling.
        o=s.mesh('sootTongue',vertices,[tuple(range(len(vertices)-1,-1,-1))],'uiDark')
        # A broad masonry-colored halo fades from char to the base wall color.
        halo=[(c-w*1.35,z-.12),(c-w*1.28,z+h*.55),(c-w*.38,z+h*1.15),(c+w*.35,z+h),(c+w*1.35,z+h*.30),(c+w*.80,z-.12),(c,z+h*.35)]
        hv=[(fixed-.003,a,b) if axis=='x' else (a,fixed+.003,b) for a,b in halo]
        s.mesh('sootGradient',hv,[(6,(i+1)%6,i) for i in range(6)],material)
        for i,v in enumerate(hv):soot_colors[tuple(round(a,6) for a in v)]=(.12 if i==6 else .82 if i in (2,3) else .45)
        return o
    for axis,fixed,c,z,w,h in ([('x',wall+.065,2.0,3.0,1.1,3.8),('x',wall+.065,-1.2,6.7,.6,2.5),
                              ('y',side-.04,-2.7,2.9,1.0,2.3),('y',side-.04,.2,4.5,.8,3.0)]
                             if not asset.endswith('church') else [('y',side-.04,-1.0,2.8,1.0,2.5),('y',side-.04,3.6,3.3,.9,1.9),('x',wall+.04,3.4,1.7,.8,2.9)]):
        if not inside((fixed,c,z) if axis=='x' else (c,fixed,z)):scar(axis,fixed,c,z,w,h)
    # Jagged missing sections in glazing. Choose components of the actual imported
    # pane batch; this follows every authored tier's real window shapes.
    for obj in list(root.children_recursive):
        if obj.type!='MESH' or 'blueTrim' not in obj.name and 'emi_windowGlow' not in obj.name:continue
        # Tiny emissive inserts are already dead; full panes get a central broken bite.
        bm=bmesh.new();bm.from_mesh(obj.data);seen=set();bounds=[]
        for v in bm.verts:
            if v in seen:continue
            stack=[v];component=[];seen.add(v)
            while stack:
                q=stack.pop();component.append(obj.matrix_world@q.co)
                for e in q.link_edges:
                    other=e.other_vert(q)
                    if other not in seen:seen.add(other);stack.append(other)
            low=Vector(tuple(min(p[j] for p in component) for j in range(3)));high=Vector(tuple(max(p[j] for p in component) for j in range(3)))
            size=high-low
            if size.z>.7 and max(size.x,size.y)>.5 and min(size.x,size.y)<.20:bounds.append((low,high))
        bm.free()
        for low,high in bounds:
            center=(low+high)/2;size=high-low;axis='x' if size.x<size.y else 'y'
            # Far faces keep solid unlit pane volumes at LOD2; individual chips
            # are authored only on the camera frontage at this distance.
            if lod==2 and ((axis=='x' and center.x<0) or (axis=='y' and center.y>0)):
                continue
            # Dark recess immediately behind surviving blue glass shards, ahead
            # of the intact structural wall. One outward face avoids coplanar duplicates.
            fixed=(high.x-.012 if (low.x+high.x)>0 else low.x+.012) if axis=='x' else (high.y-.012 if (low.y+high.y)>0 else low.y+.012)
            corners=[(low.y,low.z),(high.y,low.z),(high.y,high.z),(low.y,high.z)] if axis=='x' else [(low.x,low.z),(high.x,low.z),(high.x,high.z),(low.x,high.z)]
            face=(0,1,2,3) if (axis=='x' and center.x>0) or (axis=='y' and center.y<0) else (3,2,1,0)
            s.mesh('brokenPaneRecess',[(fixed,a,b) if axis=='x' else (a,fixed,b) for a,b in corners],[face],'uiDark')
            facing=(axis=='x' and center.x>0) or (axis=='y' and center.y<0)
            if facing and not inside((center.x,center.y,center.z)):
                # Soot tongue licking up the wall above the opening.
                out=high.x+.02 if axis=='x' else low.y-.02
                w=(size.y if axis=='x' else size.x)*.5
                c=(center.y if axis=='x' else center.x)
                zt=high.z+.05;zh=min(zt+rnd.uniform(1.4,2.6),cfg['wall_top'])
                pts=[(c-w*.95,zt),(c+w*.95,zt),(c+w*.55,zt+(zh-zt)*.5),(c+rnd.uniform(-.15,.15),zh),(c-w*.5,zt+(zh-zt)*.55)]
                if zh-zt>.5 and not inside((out,c,zh) if axis=='x' else (c,out,zh)):
                  s.mesh('windowSoot',[(out,a_,b_) if axis=='x' else (a_,out,b_) for a_,b_ in pts],[tuple(range(len(pts)))],'uiDark')
                if rnd.random()<.72:
                    # Dead pane: blackened opening drawn over the glass.
                    o2=high.x+.008 if axis=='x' else low.y-.008
                    s.mesh('deadPane',[(o2,a_,b_) if axis=='x' else (a_,o2,b_) for a_,b_ in corners],[face],'uiDark')
                    continue
            # Six-sided star prism, through the glass only, retaining ragged shards.
            width=size.y if axis=='x' else size.x
            segments=[8,6,3][lod]
            pts=[(math.cos(i*math.tau/segments)*width*(.42 if i%2 else .30),math.sin(i*math.tau/segments)*size.z*(.36 if i%2 else .45)) for i in range(segments)]
            verts=[]
            for depth in (-.22,.22):
                verts += [(center.x+depth,center.y+a,center.z+b) if axis=='x' else (center.x+a,center.y+depth,center.z+b) for a,b in pts]
            cut=s.mesh('temporaryBrokenGlass',verts,[tuple(range(segments-1,-1,-1)),tuple(range(segments,2*segments))]+[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)],'uiDark')
            difference(obj,cut);bpy.data.objects.remove(cut,do_unlink=True)
    # Impact craters are polygon chips on the actual facade, omitting fine scatter far away.
    for i in range([32,18,5][lod]):
        y=rnd.uniform(.95,5.5 if 'apartment' in asset else 7.0 if asset.endswith('town-hall') else 4.5)
        z=rnd.uniform(1.0,10.8 if 'apartment' in asset else 6.9 if asset.endswith('town-hall') else 4.8)
        r=rnd.uniform(.065,.15) if lod<2 else .16
        pts=[(wall+.08,y+math.cos(k*math.tau/6)*r,z+math.sin(k*math.tau/6)*r) for k in range(6)]
        if inside((wall+.08,y,z)):continue
        s.mesh('bulletImpact',pts,[tuple(range(6))],'uiDark')
    # Restore outward normals after Boolean cuts, then batch per protected owner.
    for obj in root.children_recursive:
        if obj.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    export.merge_by_material(root,s.protected)
    for obj in root.children_recursive:
        if obj.type=='MESH':
            obj.name=obj.name.removesuffix('.001');obj.data.name=obj.name
    for name in old_emissive:
        if name not in bpy.data.objects:sockets.empty(name,parent=body)
    ao.bake_all(root.children_recursive,16)
    tint_rgb=(.74,.76,.80)
    for obj in root.children_recursive:
        if obj.type!='MESH':continue
        for loop,color in zip(obj.data.loops,obj.data.color_attributes['ao'].data):
            key=tuple(round(a,6) for a in obj.matrix_world@obj.data.vertices[loop.vertex_index].co)
            tint=soot_colors.get(key,1)
            r,g,b,a=color.color;tr,tg,tb=tint_rgb;color.color=((.58+.42*r)*tint*tr,(.58+.42*g)*tint*tg,(.58+.42*b)*tint*tb,a)
    return root


def main(asset,directory):
    parser=argparse.ArgumentParser();parser.add_argument('--glb',required=True);parser.add_argument('--quality',default='high');parser.add_argument('--decay',default='w5',choices=['w5']);parser.add_argument('--distance-tier',type=int,choices=[0,1,2])
    args=parser.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:]);directory=Path(directory);stats={}
    for lod in ([args.distance_tier] if args.distance_tier is not None else [0,1,2]):
        root=damage(asset,directory,lod)
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        for o in meshes:o.data.calc_loop_triangles()
        triangles=sum(len(o.data.loop_triangles) for o in meshes);draws=sum(len(o.data.materials) for o in meshes)
        if triangles>[30000,12000,4000][lod] or draws>8:raise ValueError(f'{asset}.w5 LOD{lod}: {triangles} triangles, {draws} draws')
        path=directory/('model.w5'+(f'.lod{lod}' if lod else '')+'.glb');export.glb(root,path)
        stats[f'lod{lod}']={'triangles':triangles,'drawCalls':draws,'sourceBytes':path.stat().st_size,'materials':sorted({m.name for o in meshes for m in o.data.materials})}
    (directory/'w5-geometry.json').write_text(json.dumps(stats,indent=2)+'\n')
    path=directory/('model.w5'+(f'.lod{args.distance_tier}' if args.distance_tier else '')+'.glb')
    output=Path(args.glb).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    if path.resolve()!=output:shutil.copyfile(path,output)
