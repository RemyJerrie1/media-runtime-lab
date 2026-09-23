import bpy
import math
import os
import random
import bisect
from mathutils import Vector

OUT = os.path.abspath(os.environ.get('HAMSTER_OUTPUT', '.runtime/hamster-build'))
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, roughness=.65):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    return m

gold=(.43,.17,.043); ivory=(.92,.83,.66); rose=(.72,.34,.29)
coat=mat('Honey and cream coat',gold)
attr=coat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Coat'
coat.node_tree.links.new(attr.outputs['Color'],coat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
pink=mat('Warm pink skin',rose,.52)
eye_mat=mat('Deep brown eyes',(.007,.004,.0025),.25)
eye_mat.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=.18
eye_mat.node_tree.nodes['Principled BSDF'].inputs['Coat Roughness'].default_value=.22
nose_mat=mat('Nose',(.63,.24,.21),.43)
mouth_mat=mat('Mouth',(.12,.048,.025))
whisker_mat=mat('Whisker',(.62,.51,.38),.8)

def smooth(obj):
    for poly in obj.data.polygons: poly.use_smooth=True
    return obj

def ellipsoid(name, loc, scale, material=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=28,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if material:o.data.materials.append(material)
    return smooth(o)

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def finish_modifier(obj, mod):
    activate(obj);bpy.ops.object.modifier_apply(modifier=mod.name)

# Continuous sculpted cross sections: wide cheek pouches, narrower forehead,
# a short muzzle, and a forehead that rolls naturally into the back of the skull.
profile=[(.82,.04,.05,-.17),(.96,.40,.35,-.18),(1.12,.64,.48,-.20),
         (1.30,.715,.54,-.20),(1.48,.685,.51,-.19),(1.66,.605,.45,-.14),
         (1.80,.50,.38,-.04),(1.91,.27,.23,.02),(1.96,.025,.025,.025)]
def section(z):
    for j in range(len(profile)-1):
        a,b=profile[j:j+2]
        if a[0]<=z<=b[0]:
            t=(z-a[0])/(b[0]-a[0])
            before=profile[max(0,j-1)];after=profile[min(len(profile)-1,j+2)]
            dz=b[0]-a[0]
            return tuple((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*(b[k]-before[k])/(b[0]-before[0])*dz+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*(after[k]-a[k])/(after[0]-a[0])*dz for k in (1,2,3))
    return profile[-1][1:]

verts=[];faces=[];n=96;rings=80
for i in range(rings):
    z=.82+(1.96-.82)*i/(rings-1);rx,ry,cy=section(z)
    for j in range(n):
        a=2*math.pi*j/n;x=rx*math.cos(a);y=cy+ry*math.sin(a)
        # Replace the upright back wall / crown ledge with a continuous cranial arc.
        # Only the rear hemisphere changes; the facial surface stays identical.
        rear=max(0,math.sin(a))
        rear_curve=.035+.54*math.sqrt(max(0,1-((z-1.23)/.73)**2))
        y+=(rear_curve-(cy+ry))*rear**2
        front=max(0,-math.sin(a))**8
        # A very short nasal bridge. The cheeks remain wider than the snout.
        y-=.045*math.exp(-(x/.18)**2-((z-1.32)/.13)**2)*front
        # Paired whisker pads blend into the cheek surface, without separate balls.
        y-=.095*math.exp(-((abs(x)-.145)/.14)**2-((z-1.29)/.12)**2)*front
        # Broad, shallow brow volume blends the socket into the forehead.
        y-=.028*math.exp(-((abs(x)-.365)/.145)**2-((z-1.69)/.080)**2)*front
        verts.append((x,y,z))
for i in range(rings-1):
    for j in range(n):
        k=i*n+j;l=i*n+(j+1)%n;faces.append((k,l,l+n,k+n))
faces.append(tuple(reversed(range(n))));faces.append(tuple((rings-1)*n+j for j in range(n)))
mesh=bpy.data.meshes.new('Cheek and forehead sculpt');mesh.from_pydata(verts,[],faces);mesh.update()
head=bpy.data.objects.new('Head sculpt',mesh);bpy.context.collection.objects.link(head)
body=ellipsoid('Body', (0,.10,.68),(.72,.55,.67))
# A soft, broad seated underside, rather than a ball balanced on two furry cuffs.
for v in body.data.vertices:
    z=body.location.z+v.co.z
    lower=math.exp(-((z-.16)/.20)**2)
    v.co.x*=1+.26*lower
    v.co.y*=1+.28*lower
    v.co.z-=.023*math.exp(-((z-.15)/.10)**2)
    v.co.z=max(v.co.z,.018-body.location.z)
# A shallow dorsal bridge fills the head/torso junction without changing the face.
shoulder=ellipsoid('Shoulder blend',(0,.34,1.035),(.51,.265,.365))
parts=[head,body,shoulder]
# The seated underside is one continuous body surface; no separate ankle cuffs.
for side in (-1,1):
    arm=ellipsoid('Folded arm', (side*.225,-.385,.88),(.135,.195,.19))
    arm.rotation_euler.y=side*.55;parts.append(arm)
activate(head)
for o in parts:o.select_set(True)
bpy.ops.object.join();head.name='Hamster continuous skin'
rem=head.modifiers.new('Continuous sculpt surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.019;rem.use_smooth_shade=True
finish_modifier(head,rem)
sm=head.modifiers.new('Relax sculpt transitions','SMOOTH');sm.factor=1;sm.iterations=7;finish_modifier(head,sm)
# Relax only the dorsal blend; keep cheeks, crown and facial landmarks untouched.
dorsal=head.vertex_groups.new(name='Dorsal transition')
for v in head.data.vertices:
    x,y,z=v.co
    weight=max(0,min(1,(y-.12)/.25))*math.exp(-((z-1.13)/.30)**4)
    if weight>.001:dorsal.add([v.index],weight,'REPLACE')
relax=head.modifiers.new('Round shoulder transition','SMOOTH')
relax.vertex_group=dorsal.name;relax.factor=1.2;relax.iterations=35
finish_modifier(head,relax)
# Blend folded hind legs into the lower belly instead of leaving a cuff edge.
lower=head.vertex_groups.new(name='Lower belly transition')
for v in head.data.vertices:
    z=v.co.z
    t=max(0,min(1,(z-.08)/.16))*max(0,min(1,(.66-z)/.22))
    if t>.001:lower.add([v.index],t,'REPLACE')
blend=head.modifiers.new('Soften folded hind legs','SMOOTH')
blend.vertex_group=lower.name;blend.factor=1.1;blend.iterations=45
finish_modifier(head,blend)



# Recessed eyes: the dark eyeballs sit in carved sockets, not on top of the face.
for side in (-1,1):
    cutter=ellipsoid('Socket tool',(side*.365,-.598,1.565),(.117,.104,.138))
    cutter.rotation_euler.z=side*.23
    mod=head.modifiers.new('Eye socket','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    finish_modifier(head,mod);bpy.data.objects.remove(cutter,do_unlink=True)
    eye=ellipsoid('Eye L' if side<0 else 'Eye R',(side*.365,-.563,1.565),(.094,.079,.109),eye_mat)
    eye.rotation_euler.z=side*.23

def smoothstep(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def skin_color(x,y,z):
    # Cream rises over the whisker pads and tapers toward the outer cheeks.
    # Gentle fixed variation breaks the ruler-straight color band without flicker.
    cheek_line=1.34+.072*math.exp(-((abs(x)-.24)/.19)**2)-.085*smoothstep(.40,.68,abs(x))
    edge=.010*math.sin(x*43+y*19)+.006*math.sin(x*83-y*31)
    cheek=1-smoothstep(cheek_line-.075,cheek_line+.065,z+edge)
    bridge=math.exp(-(x/.115)**2)*(1-smoothstep(1.40,1.65,z))
    front=1-smoothstep(-.36,-.06,y)
    amount=max(cheek,bridge)*front
    amount=max(amount,(1-smoothstep(.18,.40,z))*(1-smoothstep(-.10,.15,y)))
    return tuple(gold[k]*(1-amount)+ivory[k]*amount for k in range(3))

def vertex_coat(obj, color_fn):
    obj.data.materials.clear();obj.data.materials.append(coat)
    colors=obj.data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
    for v in obj.data.vertices:
        p=obj.matrix_world@v.co;colors.data[v.index].color=(*color_fn(*p),1)
vertex_coat(head,skin_color);smooth(head)

# Cupped ears with a thin rim, rather than flat pink disks on top of spheres.
for side in (-1,1):
    ev=[];ef=[];res=48;radial=12
    center=Vector((side*.49,.03,1.895))
    for layer in (0,1):
        for ring in range(radial+1):
            r=max(.001,ring/radial)
            for j in range(res):
                a=2*math.pi*j/res
                x=.165*r*math.cos(a);z=.184*r*math.sin(a)
                # The inner bowl recedes, and the upper ear leans outward.
                # Thin shell, a gently rolled upper rim and an asymmetric natural fold.
                fold=.024*math.sin(a+.5*side)*r*r
                roll=-.028*math.exp(-((r-.88)/.13)**2)
                y=.060*(1-r*r)+fold+roll+(.017 if layer else 0)
                ev.append(tuple(center+Vector((x+side*z*.18,y,z))))
    stride=(radial+1)*res
    for layer in (0,1):
        for ring in range(radial):
            for j in range(res):
                a=layer*stride+ring*res+j;b=layer*stride+ring*res+(j+1)%res
                face=(a,b,b+res,a+res)
                ef.append(face if layer==0 else tuple(reversed(face)))
    for j in range(res):
        a=radial*res+j;b=radial*res+(j+1)%res;ef.append((a,a+stride,b+stride,b))
    em=bpy.data.meshes.new('Ear cup');em.from_pydata(ev,[],ef);em.update()
    ear=bpy.data.objects.new('Ear L' if side<0 else 'Ear R',em);bpy.context.collection.objects.link(ear)
    def ear_color(x,y,z):
        ez=(z-center.z)/.184
        ex=(x-center.x-side*(z-center.z)*.18)/.165
        r2=min(1,ex*ex+ez*ez)
        a=math.atan2(ez,ex)
        front_y=center.y+.060*(1-r2)+.024*math.sin(a+.5*side)*r2-.028*math.exp(-((math.sqrt(r2)-.88)/.13)**2)
        if y<front_y+.008:
            radius=math.sqrt(r2)
            # Soft skin-to-fur transition instead of a hard golden outline.
            rim=smoothstep(.78,.99,radius)
            bowl=.83+.15*radius+.025*math.sin(a+.5*side)*(1-radius)
            skin=tuple(c*bowl for c in rose)
            return tuple(skin[k]*(1-rim)+gold[k]*rim for k in range(3))
        return gold
    vertex_coat(ear,ear_color);smooth(ear)

def tube(name, points, radius, material):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=radius;c.bevel_resolution=2
    spl=c.splines.new('BEZIER');spl.bezier_points.add(len(points)-1)
    for b,p in zip(spl.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
    activate(obj);bpy.ops.object.convert(target='MESH');return obj

# Short upper lid arcs soften the socket edge without a full circular eye rim.
lid_mat=mat('Warm upper eyelid',(.16,.075,.028),.8)
for side in (-1,1):
    points=[]
    for j in range(9):
        a=.18+(math.pi-.36)*j/8
        points.append((side*.365+.093*math.cos(a),-.577-.010*math.sin(a),1.565+.104*math.sin(a)))
    tube('Upper eyelid',points,.0035,lid_mat)

for side in (-1,1):
    palm=ellipsoid('Hand',(side*.091,-.578,.895),(.068,.046,.053),pink)
    for f in range(4):
        x=side*(.039+.023*f)
        tube('Tiny finger',[(x,-.608,.920),(x-side*.011,-.625,.895),(x-side*.014,-.615,.877)],.0095,pink)
    ellipsoid('Hind foot',(side*.38,-.15,.047),(.091,.11,.027),pink)
    for toe in range(4):
        x=side*.38+(toe-1.5)*.040
        ellipsoid('Toe',(x,-.285,.038),(.019,.065,.020),pink)
    for w in range(4):
        spread=[-.083,-.024,.038,.105][w]
        tube('Whisker',[(side*(.20+w*.012),-.777,1.29-w*.011),(side*(.43+w*.008),-.815,1.28+spread*.50),(side*(.77+w*.023),-.73,1.28+spread)],.0013,whisker_mat)
    tube('Mouth',[(0,-.82,1.278),(side*.018,-.81,1.26),(side*.035,-.80,1.255)],.004,mouth_mat)

# A small triangular, rounded nose.
nose=ellipsoid('Nose',(0,-.817,1.315),(.063,.034,.041),nose_mat)
for v in nose.data.vertices:
    v.co.x*=.55+.45*smoothstep(-.035,.025,v.co.z)
tail=ellipsoid('Short tail',(0,.58,.15),(.07,.09,.06),pink)

# Exportable groom: tapered short strands sampled from the actual sculpt surface.
# Normals and colors follow the skin, with eye sockets deliberately kept clear.
head.data.calc_loop_triangles()
triangles=list(head.data.loop_triangles)
weights=[];total=0
for tri in triangles:
    total+=tri.area;weights.append(total)
rng=random.Random(731)
sv=[];sf=[];sn=[];sc=[]
for strand in range(52000):
    tri=triangles[bisect.bisect_left(weights,rng.random()*total)]
    a,b,c=[head.data.vertices[v] for v in tri.vertices]
    u=math.sqrt(rng.random());v=rng.random()
    weights3=(1-u,u*(1-v),u*v)
    point=a.co*weights3[0]+b.co*weights3[1]+c.co*weights3[2]
    normal=(a.normal*weights3[0]+b.normal*weights3[1]+c.normal*weights3[2]).normalized()
    if point.z<.10: continue
    if point.y<-.45 and min(((point.x-side*.365)/.15)**2+((point.z-1.565)/.165)**2 for side in (-1,1))<1.2: continue
    if point.y<-.72 and abs(point.x)<.10 and 1.23<point.z<1.39: continue
    # Cheek whisker pads fan outward; crown hair sweeps back, chest hair down.
    if point.z>1.70:
        flow=Vector((point.x*.2,1,-.20))
    elif point.y<-.40 and point.z>1.15:
        flow=Vector((point.x*2.7,.15,-.42))
    else:
        flow=Vector((point.x*.45,.20,-1))
    # Coherent small tufts vary grooming locally instead of random frame noise.
    tuft=math.sin(point.x*34+point.z*11)*math.sin(point.z*27-point.y*17)
    flow.x+=.20*tuft
    flow.y+=.12*math.sin(point.x*23+point.z*31)
    flow=(flow-normal*flow.dot(normal)).normalized()
    across=normal.cross(flow).normalized()
    length=.037+rng.random()*.039
    cheek_zone=point.y<-.25 and 1.1<point.z<1.45
    if cheek_zone:length*=1.35+.16*tuft
    elif point.y<-.20 and point.z<1.1:length*=.82
    else:length*=.94
    halfwidth=.0013+rng.random()*.0008
    col=skin_color(*point)
    tint=.83+rng.random()*.28
    first=len(sv)
    for step in range(4):
        t=step/3
        center=point+normal*(.002+length*(.62*t-.17*t*t))+flow*(length*.80*t*t)
        center+=across*(length*.11*tuft*t*t)
        for side in (-1,1):
            sv.append(tuple(center+across*(side*halfwidth*(1-.98*t))))
            sn.append(tuple(normal));sc.append(tuple(min(1,ch*tint) for ch in col)+(1,))
        if step<3:
            k=first+step*2;sf.extend([(k,k+2,k+1),(k+1,k+2,k+3)])
fm=bpy.data.meshes.new('Short groom mesh');fm.from_pydata(sv,[],sf);fm.update()
fo=bpy.data.objects.new('Golden and cream short groom',fm);bpy.context.collection.objects.link(fo)
groom_mat=coat.copy();groom_mat.name='Short fur single-sided';groom_mat.use_backface_culling=True
fo.data.materials.append(groom_mat)
fc=fm.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
for i,color in enumerate(sc):fc.data[i].color=color
smooth(fo);fm.normals_split_custom_set_from_vertices(sn)

# Round 01: pose-only deformation, preserving facial design and coat colors.
# Translate the complete head down; compress the torso smoothly, with grounded feet.
def seated_z(z):
    t=max(0.0,min(1.0,(z-.08)/1.0))
    return z-.23*t*t*(3-2*t)
def seated_derivative(z):
    t=max(0.0,min(1.0,(z-.08)/1.0))
    return 1-.23*6*t*(1-t) if .08<z<1.08 else 1
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    # Bake local transforms before the common deformation so all parts stay aligned.
    activate(obj);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    custom=[]
    for corner in obj.data.corner_normals:
        custom.append(corner.vector.copy())
    derivatives=[]
    waist_factors=[]
    waist_slopes=[]
    for vertex in obj.data.vertices:
        z=vertex.co.z;derivatives.append(seated_derivative(z))
        vertex.co.z=seated_z(z)
        # A restrained waist beneath the chest, fading out before the rounded rump.
        waist=.065*math.exp(-((z-.76)/.22)**2)
        waist_factors.append(1-waist)
        waist_slopes.append(vertex.co.x*waist*2*(z-.76)/(.22**2))
        vertex.co.x*=1-waist
        if obj.name.startswith(('Hind foot','Toe')):vertex.co.y+=.16
    obj.data.update()
    if obj.name=='Golden and cream short groom':
        # Preserve smooth strand lighting under the nonuniform pose change.
        obj.data.normals_split_custom_set([
            tuple(Vector((n.x/waist_factors[loop.vertex_index],n.y,(n.z-waist_slopes[loop.vertex_index]*n.x/waist_factors[loop.vertex_index])/derivatives[loop.vertex_index])).normalized())
            for loop,n in zip(obj.data.loops,custom)])

# Asset hierarchy and neutral pivot, matching glTF's metre-scale coordinates.
asset_objects=list(bpy.context.scene.objects)
bpy.ops.object.empty_add(type='PLAIN_AXES');root=bpy.context.object;root.name='Hamster_Prototype'
for o in asset_objects:o.parent=root
root['status']='Shape prototype; not the approved final groom or a rigged production asset'
root['reference']='User-approved concept exec-2d19ae9b-ed6b-48d4-8bba-b7f9ef871965.png'
activate(root)
for obj in asset_objects:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'hamster-prototype.glb'),export_format='GLB',use_selection=True,export_apply=True)

# Studio setup is saved for editing, separate from the exported model.
floor_mat=mat('Studio floor',(.70,.67,.62))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(floor_mat)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.78,.78,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
def area(name,loc,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Softbox',(-3,-4,5),400,4);area('Fill',(3,-2,3),160,3);area('Rim',(1,3,4),300,3)
bpy.ops.object.camera_add(location=(3,-6,2.7));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.15
sc=bpy.context.scene;sc.camera=camera;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
sc.render.resolution_x=900;sc.render.resolution_y=900;sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'hamster-prototype.blend'))
print('PROTOTYPE_SAVED',len(head.data.vertices),'skin vertices',flush=True)
