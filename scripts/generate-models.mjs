import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// GREEN CITY procedural GLB generator. Kept dependency-free so the exact same
// models are rebuilt by Vercel on every deploy instead of relying on uploads.
const OUT = join(process.cwd(), 'public', 'models');
await mkdir(OUT, { recursive: true });

const PALETTE = {
  skin: [0.76, 0.52, 0.36, 1], skinLight: [0.91, 0.68, 0.49, 1],
  green: [0.035, 0.42, 0.30, 1], lime: [0.45, 0.82, 0.22, 1], darkGreen: [0.06, 0.22, 0.16, 1],
  pants: [0.12, 0.23, 0.31, 1], boots: [0.055, 0.075, 0.075, 1], yellow: [1.0, 0.68, 0.10, 1],
  wood: [0.29, 0.17, 0.095, 1], leaf1: [0.12, 0.38, 0.16, 1], leaf2: [0.20, 0.52, 0.22, 1], leaf3: [0.34, 0.64, 0.27, 1],
  wall: [0.83, 0.78, 0.66, 1], wall2: [0.67, 0.73, 0.64, 1], roof: [0.22, 0.30, 0.27, 1],
  glass: [0.075, 0.20, 0.26, 1], glassBlue: [0.12, 0.32, 0.38, 1], metal: [0.62, 0.68, 0.65, 1],
  black: [0.035, 0.045, 0.045, 1], tire: [0.025, 0.032, 0.035, 1], red: [0.78, 0.12, 0.095, 1],
  white: [0.95, 0.93, 0.82, 1], solar: [0.035, 0.15, 0.28, 1], aqua: [0.12, 0.78, 0.63, 1],
  orange: [0.88, 0.34, 0.08, 1], concrete: [0.42, 0.46, 0.42, 1],
};

class Model {
  constructor(name) { this.name = name; this.parts = []; }
  add(name, material, positions, indices, normals = null) {
    this.parts.push({ name, material, positions, indices, normals: normals ?? smoothNormals(positions, indices) });
  }
  box(name, mat, center, size, rotation = [0, 0, 0]) {
    const [cx, cy, cz] = center, [sx, sy, sz] = size;
    const faces = [
      [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],
      [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
      [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],
      [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
      [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]],
      [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]],
    ];
    const p=[], n=[], idx=[];
    for (const face of faces) {
      const normal = rotate(face[4], rotation);
      for (let k=0;k<4;k++) {
        const v = rotate([face[k][0]*sx/2, face[k][1]*sy/2, face[k][2]*sz/2], rotation);
        p.push(cx+v[0], cy+v[1], cz+v[2]); n.push(...normal);
      }
      const b=p.length/3-4; idx.push(b,b+1,b+2,b,b+2,b+3);
    }
    this.add(name, mat, p, idx, n);
  }
  sphere(name, mat, center, scale, segments=28, rings=18) {
    const p=[],n=[],idx=[];
    for(let r=0;r<=rings;r++){
      const v=r/rings, phi=Math.PI*v;
      for(let s=0;s<=segments;s++){
        const u=s/segments, theta=2*Math.PI*u;
        const nx=-Math.cos(theta)*Math.sin(phi), ny=Math.cos(phi), nz=Math.sin(theta)*Math.sin(phi);
        p.push(center[0]+nx*scale[0],center[1]+ny*scale[1],center[2]+nz*scale[2]);
        const nn=norm([nx/scale[0],ny/scale[1],nz/scale[2]]); n.push(...nn);
      }
    }
    for(let r=0;r<rings;r++) for(let s=0;s<segments;s++){
      const a=r*(segments+1)+s,b=a+segments+1; idx.push(a,b,a+1,a+1,b,b+1);
    }
    this.add(name,mat,p,idx,n);
  }
  cylinder(name, mat, center, radius, height, segments=20, axis='y', radiusTop=radius) {
    const p=[],n=[],idx=[];
    const map=(x,y,z)=>axis==='x'?[center[0]+y,center[1]+x,center[2]+z]:axis==='z'?[center[0]+x,center[1]+z,center[2]+y]:[center[0]+x,center[1]+y,center[2]+z];
    for(let j=0;j<=1;j++){
      const y=(j-.5)*height, rr=j===0?radius:radiusTop;
      for(let s=0;s<=segments;s++){
        const a=2*Math.PI*s/segments, x=Math.cos(a), z=Math.sin(a);
        const pos=map(x*rr,y,z*rr); p.push(...pos);
        const nn=axis==='x'?[0,x,z]:axis==='z'?[x,z,0]:[x,0,z]; n.push(...nn);
      }
    }
    for(let s=0;s<segments;s++){const a=s,b=s+segments+1;idx.push(a,a+1,b+1,a,b+1,b);}
    this.add(name,mat,p,idx,n);
    // end caps, separate and flat shaded
    for(const top of [false,true]){
      const yy=center[axis==='x'?0:axis==='z'?2:1]+(top?1:-1)*height/2;
      const p2=[],n2=[],i2=[]; const normal=axis==='y'?[0,top?1:-1,0]:axis==='x'?[top?1:-1,0,0]:[0,0,top?1:-1];
      p2.push(...(axis==='x'?[yy,center[1],center[2]]:axis==='z'?[center[0],center[1],yy]:[center[0],yy,center[2]]));n2.push(...normal);
      for(let s=0;s<=segments;s++){const a=2*Math.PI*s/segments;const pos=map(Math.cos(a)*radius,top?height/2:-height/2,Math.sin(a)*radius);p2.push(...pos);n2.push(...normal);}
      for(let s=0;s<segments;s++) top?i2.push(0,s+1,s+2):i2.push(0,s+2,s+1);
      this.add(`${name}-${top?'cap-top':'cap-bottom'}`,mat,p2,i2,n2);
    }
  }
  torus(name, mat, center, major, minor, axis='y', segments=24, sides=8) {
    const p=[],n=[],idx=[];
    for(let i=0;i<=segments;i++){
      const u=2*Math.PI*i/segments;
      for(let j=0;j<=sides;j++){
        const v=2*Math.PI*j/sides, c=Math.cos(u), s=Math.sin(u), cv=Math.cos(v), sv=Math.sin(v);
        let x,y,z,nx,ny,nz;
        if(axis==='x'){y=(major+minor*cv)*c;z=(major+minor*cv)*s;x=minor*sv;ny=cv*c;nz=cv*s;nx=sv;}
        else {x=(major+minor*cv)*c;z=(major+minor*cv)*s;y=minor*sv;nx=cv*c;nz=cv*s;ny=sv;}
        p.push(center[0]+x,center[1]+y,center[2]+z);n.push(nx,ny,nz);
      }
    }
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;idx.push(a,b,a+1,a+1,b,b+1);}
    this.add(name,mat,p,idx,n);
  }
  loft(name, mat, sections, segments=20) {
    const p=[],idx=[];
    for(const sec of sections){const [z,w,cy,h]=sec;for(let s=0;s<segments;s++){const a=2*Math.PI*s/segments;p.push(Math.sin(a)*w,cy+Math.cos(a)*h,z);}}
    for(let r=0;r<sections.length-1;r++)for(let s=0;s<segments;s++){const a=r*segments+s,b=r*segments+(s+1)%segments,c=(r+1)*segments+s,d=(r+1)*segments+(s+1)%segments;idx.push(a,c,b,b,c,d);}
    this.add(name,mat,p,idx);
  }
  finish() { return makeGlb(this.name,this.parts); }
}
function norm(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l);}
function rotate(v,[rx,ry,rz]){
  let [x,y,z]=v;
  let c=Math.cos(rx),s=Math.sin(rx);[y,z]=[y*c-z*s,y*s+z*c];
  c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];
  c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];return [x,y,z];
}
function smoothNormals(p,idx){
  const out=new Float32Array(p.length);
  for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const ab=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],ac=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
    const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    for(const j of [a,b,c]){out[j]+=n[0];out[j+1]+=n[1];out[j+2]+=n[2];}
  }
  for(let i=0;i<out.length;i+=3){const n=norm([out[i],out[i+1],out[i+2]]);out[i]=n[0];out[i+1]=n[1];out[i+2]=n[2];}
  return Array.from(out);
}
function makeGlb(name,parts){
  const materialNames=[...new Set(parts.map(p=>p.material))], materialIndex=new Map(materialNames.map((m,i)=>[m,i]));
  const materials=materialNames.map(m=>({name:m,pbrMetallicRoughness:{baseColorFactor:PALETTE[m]??PALETTE.green,metallicFactor:/metal|solar|rim/.test(m)?0.65:0.05,roughnessFactor:/glass/.test(m)?0.22:/rubber|tire|trim/.test(m)?0.86:0.55},doubleSided:true}));
  const binary=[],bufferViews=[],accessors=[],meshes=[],nodes=[];let offset=0;
  const append=(typed,target,componentType,type,count,min,max)=>{
    while(offset%4){binary.push(Buffer.from([0]));offset++;}
    const bytes=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength),byteOffset=offset;binary.push(bytes);offset+=bytes.length;
    const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset,byteLength:bytes.length,target});
    const accessor=accessors.length;const a={bufferView:view,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessor;
  };
  for(const part of parts){
    const pos=new Float32Array(part.positions),nor=new Float32Array(part.normals),ind=new Uint32Array(part.indices);
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i+k]);max[k]=Math.max(max[k],pos[i+k]);}
    const pa=append(pos,34962,5126,'VEC3',pos.length/3,min,max),na=append(nor,34962,5126,'VEC3',nor.length/3),ia=append(ind,34963,5125,'SCALAR',ind.length);
    const mi=materialIndex.get(part.material);meshes.push({name:part.name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material:mi,mode:4}]});nodes.push({name:part.name,mesh:meshes.length-1});
  }
  const bin=Buffer.concat(binary),gltf={asset:{version:'2.0',generator:'GREEN CITY procedural asset pipeline'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,buffers:[{byteLength:bin.length}],bufferViews,accessors};
  let json=Buffer.from(JSON.stringify(gltf));while(json.length%4)json=Buffer.concat([json,Buffer.from(' ')]);
  const binPadded=bin.length%4?Buffer.concat([bin,Buffer.alloc(4-bin.length%4)]):bin;
  const total=12+8+json.length+8+binPadded.length,header=Buffer.alloc(12);header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4e4f534a,4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(binPadded.length,0);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jh,json,bh,binPadded]);
}

function character(){
 const m=new Model('GREEN CITY Environmental Agent');
 m.sphere('body-torso','green',[0,1.13,0],[0.43,0.58,0.30],32,22);
 m.sphere('safety-vest','lime',[0,1.17,0.19],[0.42,0.52,0.16],28,18);
 m.cylinder('neck','skin',[0,1.68,0],0.15,0.20,16);
 m.sphere('head','skin',[0,1.98,0.02],[0.38,0.43,0.34],32,22);
 m.sphere('hair-back','wood',[0,2.05,-0.12],[0.39,0.39,0.30],20,12);
 m.sphere('helmet','yellow',[0,2.34,0],[0.43,0.18,0.40],24,12);
 m.cylinder('helmet-brim','yellow',[0,2.28,0],0.45,0.06,24);
 for(const s of [-1,1]){
  m.sphere('eye-white','white',[s*0.14,2.03,0.315],[0.075,0.095,0.035],16,10);
  m.sphere('eye-pupil','black',[s*0.14,2.03,0.348],[0.034,0.050,0.020],12,8);
  m.sphere('cheek','orange',[s*0.23,1.91,0.29],[0.09,0.06,0.035],14,8);
  m.sphere(s < 0 ? 'UpperArm_L' : 'UpperArm_R','green',[s*0.53,1.32,0],[0.16,0.43,0.16],24,16);
  m.sphere('hand','skin',[s*0.57,0.87,0.04],[0.13,0.13,0.13],14,8);
  m.sphere(s < 0 ? 'Trouser_L_Thigh' : 'Trouser_R_Thigh','pants',[s*0.19,0.58,0],[0.17,0.48,0.19],24,16);
  m.sphere('boot','boots',[s*0.21,0.16,0.10],[0.19,0.14,0.28],16,10);
  m.box('vest-reflector','white',[s*0.28,1.25,0.30],[0.045,0.56,0.035]);
 }
 m.sphere('backpack','darkGreen',[0,1.15,-0.29],[0.34,0.43,0.18],18,12);
 m.box('backpack-pocket','green',[0,1.04,-0.45],[0.34,0.22,0.08]);
 m.box('radio','black',[-0.39,1.42,-0.02],[0.13,0.24,0.13]);
 m.cylinder('radio-antenna','metal',[-0.39,1.60,-0.02],0.018,0.16,8);
 m.sphere('nose','skin',[0,1.97,0.36],[0.06,0.08,0.05],12,8);
 m.box('identity-badge','white',[0.22,1.35,0.35],[0.16,0.18,0.035]);
 return m.finish();
}
function tree(){
 const m=new Model('GREEN CITY Urban Tree');
 m.cylinder('trunk','wood',[0,1.45,0],0.27,2.9,18,'y',0.15);
 for(const s of [-1,1]){m.cylinder('branch','wood',[s*0.36,2.45,0],0.12,1.5,12,'y',0.07);}
 const clusters=[[-0.8,3.7,0,1.55,'leaf1'],[0.75,3.8,0.05,1.5,'leaf2'],[0,4.55,0,1.65,'leaf3'],[0,3.55,0.77,1.4,'leaf2'],[0,3.55,-0.75,1.35,'leaf1'],[-0.55,4.6,0.52,1.15,'leaf3'],[0.55,4.5,-0.48,1.2,'leaf2'],[0,5.12,0.05,1.2,'leaf3']];
 for(const [x,y,z,d,mat] of clusters)m.sphere('foliage-cluster',mat,[x,y,z],[d*0.56,d*0.52,d*0.53],28,18);
 return m.finish();
}
function building(){
 const m=new Model('GREEN CITY Sustainable Building');
 m.box('main-building','wall',[0,4.5,0],[11.8,9,9]);
 m.box('facade-side-wing','wall2',[-4.0,4.1,4.62],[3.5,8.2,0.28]);
 for(let floor=0;floor<3;floor++){
  const y=1.7+floor*2.65;
  for(let row=0;row<4;row++)for(const x of [-4.25,-1.45,1.45,4.25]){
   m.box('blue-window-frame','roof',[x,y,4.59],[1.62,1.45,0.16]);
   m.box('reflective-window','glassBlue',[x,y,4.69],[1.39,1.20,0.045]);
   m.box('window-mullion','metal',[x,y,4.73],[0.05,1.18,0.025]);
  }
  m.box('floor-slab','metal',[0,0.52+floor*2.65,4.70],[11.9,0.12,0.20]);
 }
 m.box('roof-parapet','roof',[0,9.12,0],[12.0,0.28,9.2]);
 for(let i=0;i<4;i++){
  m.box('solar-panel','solar',[-3.8+i*2.5,9.33,-1.5],[2.0,0.08,3.1]);
  for(let x=0;x<4;x++)m.box('solar-grid-line','aqua',[-4.72+i*2.5+x*0.58,9.38,-1.5],[0.025,0.015,3.0]);
 }
 m.box('main-entry-door','wood',[0,1.15,4.66],[1.4,2.3,0.18]);
 m.box('entry-glass','glass',[0,1.3,4.77],[0.92,1.8,0.035]);
 m.box('entry-canopy','roof',[0,2.65,5.1],[3.2,0.22,1.15]);
 m.box('green-sign','darkGreen',[0,3.2,4.72],[4.3,0.65,0.16]);
 m.box('side-entrance','white',[-5.92,1.0,0],[0.05,2.0,2.0]);
 return m.finish();
}
function wheel(m,x,y,z,scale=1){
 m.cylinder('rubber-tire','tire',[x,y,z],0.47*scale,0.28*scale,28,'x');
 m.torus('tire-sidewall','black',[x+(x>0?0.15:-0.15)*scale,y,z],0.34*scale,0.045*scale,'x',24,8);
 m.cylinder('alloy-rim','metal',[x+(x>0?0.16:-0.16)*scale,y,z],0.31*scale,0.06*scale,24,'x');
 m.cylinder('wheel-hub','aqua',[x+(x>0?0.20:-0.20)*scale,y,z],0.12*scale,0.07*scale,20,'x');
 for(let i=0;i<8;i++){const a=2*Math.PI*i/8; m.box('wheel-spoke','white',[x+(x>0?0.21:-0.21)*scale,y+Math.sin(a)*0.20*scale,z+Math.cos(a)*0.20*scale],[0.05*scale,0.07*scale,0.22*scale],[a,0,0]);}
}
function car(){
 const m=new Model('GREEN CITY Compact Electric Vehicle');
 // Main continuous rounded body, with lower chassis and sculpted front/rear zones.
 m.loft('car-body-shell','green',[[ -2.08,0.86,0.68,0.40],[-1.85,1.17,0.72,0.49],[-1.1,1.27,0.76,0.51],[0,1.30,0.77,0.50],[1.1,1.22,0.75,0.48],[1.75,1.04,0.72,0.43],[2.08,0.72,0.67,0.34]],28);
 m.box('front-lower-bumper','black',[0,0.38,2.0],[2.30,0.19,0.20]);
 m.box('rear-lower-bumper','black',[0,0.39,-1.98],[2.28,0.18,0.20]);
 m.box('front-grille','black',[0,0.70,2.03],[0.88,0.24,0.06]);
 for(let i=0;i<5;i++)m.box('grille-slat','metal',[0,0.62+i*0.04,2.07],[0.73,0.018,0.018]);
 // Cabin shell / roof and large glazing.
 m.loft('integrated-cabin','green',[[-0.92,0.87,1.40,0.20],[-0.55,0.91,1.52,0.38],[0.20,0.88,1.56,0.42],[0.92,0.72,1.42,0.26]],20);
 m.box('roof-top','darkGreen',[0,1.94,-0.02],[1.48,0.16,1.66]);
 m.box('front-windshield','glassBlue',[0,1.55,0.93],[1.52,0.64,0.05],[0.30,0,0]);
 m.box('rear-windshield','glass',[0,1.53,-0.93],[1.45,0.58,0.05],[-0.28,0,0]);
 for(const s of [-1,1]){
  m.box('side-window-front','glassBlue',[s*0.91,1.60,0.42],[0.045,0.53,0.78],[0,0,s*0.02]);
  m.box('side-window-rear','glass',[s*0.91,1.57,-0.49],[0.045,0.49,0.66]);
  m.box('front-window-pillar','black',[s*0.91,1.59,0.86],[0.10,0.68,0.11],[0.30,0,0]);
  m.box('rear-window-pillar','black',[s*0.90,1.56,-0.84],[0.10,0.62,0.10],[-0.28,0,0]);
  m.box('center-pillar','black',[s*0.93,1.58,-0.02],[0.085,0.60,0.09]);
  m.box('side-sill','black',[s*1.12,0.36,0],[0.12,0.16,2.20]);
  m.box('door-handle','metal',[s*1.22,0.96,0.10],[0.045,0.07,0.30]);
  m.box('mirror-stalk','black',[s*1.10,1.36,0.78],[0.26,0.08,0.12]);
  m.sphere('side-mirror','green',[s*1.25,1.42,0.80],[0.20,0.13,0.22],16,10);
  m.box('mirror-glass','glassBlue',[s*1.40,1.42,0.80],[0.025,0.12,0.16]);
  for(const z of [-1.30,1.30])m.torus('wheel-arch-trim','darkGreen',[s*1.14,0.52,z],0.51,0.07,'x',28,8);
  wheel(m,s*1.20,0.51,-1.30,1); wheel(m,s*1.20,0.51,1.30,1);
  m.box('side-eco-accent','aqua',[s*1.27,0.77,-0.18],[0.035,0.045,0.62]);
 }
 m.box('roof-solar-panel','solar',[0,2.03,-0.08],[1.06,0.035,1.10]);
 for(let x=-2;x<=2;x++)m.box('roof-solar-grid','metal',[x*0.19,2.055,-0.08],[0.018,0.008,1.05]);
 for(let z=-2;z<=2;z++)m.box('roof-solar-crossbar','metal',[0,2.056,-0.08+z*0.19],[1.04,0.008,0.018]);
 for(const s of [-1,1]){
  m.sphere('front-headlamp','white',[s*0.82,0.91,1.98],[0.23,0.14,0.09],16,10);
  m.box('front-led-strip','aqua',[s*0.80,0.72,2.04],[0.32,0.045,0.025]);
  m.sphere('rear-lamp','red',[s*0.91,0.88,-1.97],[0.17,0.14,0.08],16,10);
  m.box('rear-reflector','white',[s*0.89,0.61,-2.03],[0.28,0.035,0.02]);
 }
 m.box('front-license-plate','white',[0,0.54,2.115],[0.62,0.15,0.025]);
 m.box('rear-license-plate','white',[0,0.54,-2.10],[0.62,0.15,0.025]);
 m.sphere('front-ev-emblem','aqua',[0,0.84,2.10],[0.10,0.075,0.025],12,8);
 return m.finish();
}
function truck(){
 const m=new Model('GREEN CITY Selective Collection Truck');
 m.box('truck-chassis','black',[0,0.74,-0.15],[2.35,0.34,6.35]);
 m.box('truck-cab-main','yellow',[0,1.68,2.28],[2.58,2.55,1.95]);
 m.box('truck-cab-front-glass','glassBlue',[0,2.20,3.28],[2.06,0.90,0.05],[0.16,0,0]);
 for(const s of [-1,1]){
  m.box('truck-side-window','glass',[s*1.31,2.15,2.35],[0.04,0.85,1.18]);
  m.box('truck-door-handle','black',[s*1.33,1.30,2.15],[0.05,0.09,0.28]);
  m.box('truck-mirror-arm','black',[s*1.43,2.18,3.04],[0.28,0.08,0.12]);
  m.box('truck-side-mirror','metal',[s*1.58,2.20,3.08],[0.12,0.32,0.32]);
  for(const z of [-2.45,-0.35,2.15])wheel(m,s*1.30,0.62,z,0.98);
  m.box('truck-side-safety-stripe','lime',[s*1.33,1.12,-0.55],[0.04,0.18,2.70]);
 }
 m.box('cargo-box-lower','darkGreen',[0,2.13,-1.22],[2.72,2.55,3.85]);
 m.box('cargo-box-panel','green',[0,2.24,-1.18],[2.78,2.36,3.66]);
 for(let z=-2.82;z<=0.44;z+=0.42)m.box('cargo-side-rib','darkGreen',[1.41,2.20,z],[0.08,2.32,0.10]);
 for(const s of [-1,1]){
  m.box('cargo-reflector','orange',[s*1.44,1.02,-1.15],[0.035,0.14,3.50]);
  m.box('cargo-upper-rail','metal',[s*1.43,3.44,-1.20],[0.10,0.10,3.85]);
 }
 m.box('rear-loading-panel','roof',[0,2.18,-3.18],[2.55,2.36,0.11]);
 for(let x=-1;x<=1;x++)m.box('rear-door-lock','metal',[x*0.82,2.20,-3.26],[0.07,1.85,0.07]);
 m.box('front-bumper','metal',[0,0.60,3.33],[2.74,0.25,0.22]);
 m.box('front-grille','black',[0,1.16,3.29],[0.78,0.28,0.08]);
 for(const s of [-1,1]){
  m.sphere('truck-headlight','white',[s*1.02,0.99,3.32],[0.22,0.16,0.09],14,8);
  m.sphere('truck-tail-lamp','red',[s*1.15,0.74,-3.24],[0.12,0.30,0.10],14,8);
 }
 m.box('truck-roof-beacon','orange',[0,3.05,2.30],[0.45,0.16,0.30]);
 m.box('truck-green-city-logo','lime',[0,2.22,-3.28],[1.20,0.56,0.05]);
 m.box('truck-number-plate','white',[0,0.49,3.45],[0.55,0.12,0.03]);
 return m.finish();
}

const assets=[['personagem.glb.gz',character()],['arvore.glb.gz',tree()],['edificio.glb.gz',building()],['carro_eletrico.glb.gz',car()],['caminhao_coleta.glb.gz',truck()]];
for(const [filename,glb] of assets){
  if(glb.subarray(0,4).toString()!=='glTF') throw new Error(`GLB inválido: ${filename}`);
  const compressed=gzipSync(glb,{level:9});
  await writeFile(join(OUT,filename),compressed);
  console.log(`${filename}: ${glb.length} bytes GLB, ${compressed.length} bytes gzip`);
}
console.log(`Generated ${assets.length} verified GLB assets in ${OUT}`);
