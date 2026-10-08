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
            if mat.name.startswith('emi_'): obj.data.materials[i] = palette.mat('blueTrim')
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
    # Exposed floor ends, black recess and broken beams are inside the original lot.
    for z in floors:
        if z>top:continue
        o=s.box('exposedFloor',(x0+.7,(y0+y1)/2+.45,z),(1.4,2.9,.18),'picketWhite');
        if o.modifiers.get('bevel'):o.modifiers.remove(o.modifiers['bevel'])
        o=s.box('charredFloor',(x0+.7,(y0+y1)/2+.45,z+.10),(1.35,2.8,.025),'uiDark')
        if o.modifiers.get('bevel'):o.modifiers.remove(o.modifiers['bevel'])
    # Closed charred rafters spanning only the broken edge, owned by the cutaway roof.
    for i in range([5,3,1][lod]):
        y=y1-.7-i*.55
        a=Vector((x0-.25,y,top-1.2));b=Vector((x0+1.5,y,top-2.0))
        o=s.beam('snappedRoofBeam',a,b,.13,'asphalt' if 'apartment' in asset else 'denim' if asset.endswith('town-hall') else 'brick');o.parent=roof
        if o.modifiers.get('bevel'):o.modifiers.remove(o.modifiers['bevel'])
    rnd=random.Random(51)
    for i in range([26,14,4][lod]):
        # Chunky rubble on the original foundation, clear of the central entrance / vestry.
        x=rnd.uniform(x0+.1,min(x1-.7,4.6));y=rnd.uniform(max(y0+.6,side+.35),y1-.2)
        if asset.endswith('church'):x=rnd.uniform(.1,3.6)
        w=rnd.uniform(.30,.65);h=rnd.uniform(.20,.5)
        o=s.box('fallenMasonry',(x,y,.42+h/2),(w,w*.8,h),material if i%3 else 'picketWhite',angle=rnd.uniform(-.7,.7))
        if o.modifiers.get('bevel'):o.modifiers['bevel'].width=.04
    # Local polygon stains have softer brown-to-charcoal halos via vertex colors,
    # all sharing the dark palette batch. No texture or additional draw is needed.
    soot_colors={}
    def scar(axis,fixed,c,z,w,h):
        pts=[(c-w,z),(c-w*.9,z+h*.5),(c-w*.35,z+h),(c+w*.25,z+h*.86),(c+w,z+h*.28),(c+w*.6,z)]
        vertices=[(fixed,a,b) if axis=='x' else (a,fixed,b) for a,b in pts]
        o=s.mesh('sootTongue',vertices,[tuple(range(len(vertices)))],'uiDark')
        # A broad masonry-colored halo fades from char to the base wall color.
        halo=[(c-w*1.35,z-.12),(c-w*1.28,z+h*.55),(c-w*.38,z+h*1.15),(c+w*.35,z+h),(c+w*1.35,z+h*.30),(c+w*.80,z-.12),(c,z+h*.35)]
        hv=[(fixed-.003,a,b) if axis=='x' else (a,fixed+.003,b) for a,b in halo]
        s.mesh('sootGradient',hv,[(6,i,(i+1)%6) for i in range(6)],material)
        for i,v in enumerate(hv):soot_colors[tuple(round(a,6) for a in v)]=(.12 if i==6 else .82 if i in (2,3) else .45)
        return o
    for axis,fixed,c,z,w,h in ([('x',wall+.065,2.0,3.0,1.1,3.8),('x',wall+.065,-1.2,6.7,.6,2.5),
                              ('y',side-.04,-2.7,2.9,1.0,2.3),('y',side-.04,.2,4.5,.8,3.0)]
                             if not asset.endswith('church') else [('y',side-.04,-1.0,2.8,1.0,2.5),('y',side-.04,3.6,3.3,.9,1.9),('x',wall+.04,3.4,1.7,.8,2.9)]):
        scar(axis,fixed,c,z,w,h)
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
    for obj in root.children_recursive:
        if obj.type!='MESH':continue
        for loop,color in zip(obj.data.loops,obj.data.color_attributes['ao'].data):
            key=tuple(round(a,6) for a in obj.matrix_world@obj.data.vertices[loop.vertex_index].co)
            tint=soot_colors.get(key,1)
            r,g,b,a=color.color;color.color=((.58+.42*r)*tint,(.58+.42*g)*tint,(.58+.42*b)*tint,a)
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
