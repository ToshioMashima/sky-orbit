/* Rendering only: physical calculations live in astronomy-core.js. */
(function(root){
  'use strict';
  const T=root.THREE, M=root.SkyMath, A=M.A, D=M.DEG;
  const colors={sun:0xf6c56f,moon:0xd1deed,equator:0x82ddc6,ecliptic:0xb194ef,grid:0x466679};
  const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const eq=v=>V(v.x,v.z,-v.y);
  const hor=(az,alt,r=100)=>V(r*Math.cos(alt*D)*Math.sin(az*D),r*Math.sin(alt*D),-r*Math.cos(alt*D)*Math.cos(az*D));
  const dispose=o=>{o.traverse(c=>{c.geometry?.dispose();if(c.material){(Array.isArray(c.material)?c.material:[c.material]).forEach(m=>m.dispose());}});};
  class SkyScene {
    constructor(host,labels,onMove){
      this.host=host;this.labelHost=labels;this.onMove=onMove;this.labels=[];this.mode='ground';this.scale='earth';
      this.az=180;this.alt=24;this.fov=90;this.theta=0.7;this.phi=1.04;this.distance=46;this.target=V();this.focus=null;
      this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x080f19);
      this.renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(this.renderer.domElement);
      this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(90,1,.01,2000);
      this.main=new T.Group();this.scene.add(this.main);this.static=new T.Group();this.main.add(this.static);this.dynamic=new T.Group();this.main.add(this.dynamic);this.paths=new T.Group();this.main.add(this.paths);
      this.starField=this.makeStars();this.scene.add(this.starField);
      this.earthTexture=this.makeEarthTexture();this.glowTexture=this.makeGlowTexture();
      this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();this.bind();
    }
    makeStars(){
      let seed=413;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const pts=[];
      for(let i=0;i<1150;i++){const y=2*rnd()-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-y*y);pts.push(380*r*Math.cos(a),380*y,380*r*Math.sin(a));}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));return new T.Points(g,new T.PointsMaterial({color:0xadc6df,size:.6,transparent:true,opacity:.5,sizeAttenuation:true}));
    }
    makeEarthTexture(){
      const c=document.createElement('canvas');c.width=2048;c.height=1024;const x=c.getContext('2d');x.fillStyle='#13344b';x.fillRect(0,0,c.width,c.height);
      x.fillStyle='#437a7a';x.strokeStyle='#559090';x.lineWidth=.6;
      const polygon=rings=>{x.beginPath();for(const ring of rings){ring.forEach(([lon,lat],i)=>{const px=(lon+180)/360*c.width,py=(90-lat)/180*c.height;i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();}x.fill('evenodd');x.stroke();};
      for(const f of root.LAND?.features||[]){const g=f.geometry;if(g.type==='Polygon')polygon(g.coordinates);else if(g.type==='MultiPolygon')g.coordinates.forEach(polygon);}
      x.strokeStyle='#8ac5c21b';x.lineWidth=1;for(let lon=0;lon<=360;lon+=30){x.beginPath();x.moveTo(lon/360*c.width,0);x.lineTo(lon/360*c.width,c.height);x.stroke();}for(let lat=-60;lat<=60;lat+=30){x.beginPath();x.moveTo(0,(90-lat)/180*c.height);x.lineTo(c.width,(90-lat)/180*c.height);x.stroke();}
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
    }
    makeGlowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,223,154,1)');g.addColorStop(.16,'rgba(255,213,125,.8)');g.addColorStop(.36,'rgba(250,177,70,.18)');g.addColorStop(1,'rgba(240,151,50,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
    bind(){
      const el=this.renderer.domElement;let drag=null;
      el.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};el.setPointerCapture(e.pointerId);this.focus=null;this.host.focus();});
      el.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};if(this.mode==='ground'){this.az-=dx*.22;this.alt=Math.max(-89,Math.min(89,this.alt+dy*.22));}else{this.theta-=dx*.007;this.phi=Math.max(.08,Math.min(Math.PI-.08,this.phi-dy*.007));}this.draw();});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>drag=null);
      el.addEventListener('wheel',e=>{e.preventDefault();if(this.mode==='ground')this.fov=Math.max(30,Math.min(115,this.fov+e.deltaY*.04));else this.distance=Math.max(5,Math.min(90,this.distance*Math.exp(e.deltaY*.001)));this.draw();},{passive:false});
      this.host.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();this.focus=null;if(this.mode==='ground'){if(e.key==='ArrowLeft')this.az-=5;if(e.key==='ArrowRight')this.az+=5;if(e.key==='ArrowUp')this.alt=Math.min(89,this.alt+5);if(e.key==='ArrowDown')this.alt=Math.max(-89,this.alt-5);}else{if(e.key==='ArrowLeft')this.theta-=.1;if(e.key==='ArrowRight')this.theta+=.1;if(e.key==='ArrowUp')this.phi=Math.max(.08,this.phi-.1);if(e.key==='ArrowDown')this.phi=Math.min(Math.PI-.08,this.phi+.1);}this.draw();});
      el.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('errorBox').hidden=false;document.getElementById('errorBox').textContent='图形显示暂时中断，请刷新页面恢复。';});
    }
    resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.draw();}
    clear(group){while(group.children.length){const child=group.children[0];group.remove(child);dispose(child);}}
    clearLabels(type){this.labels=this.labels.filter(l=>{if(l.type===type){l.el.remove();return false;}return true;});}
    label(text,pos,color='#c5d6e0',cls='',type='dynamic',below=false){const el=document.createElement('span');el.className=`sky-label ${cls}`;el.textContent=text;el.style.color=color;this.labelHost.appendChild(el);this.labels.push({el,pos:pos.clone(),type,below});}
    line(points,color,opacity=.6,dashed=false,group=this.static){const geom=new T.BufferGeometry().setFromPoints(points),mat=dashed?new T.LineDashedMaterial({color,transparent:true,opacity,dashSize:this.mode==='ground'?1.2:.2,gapSize:this.mode==='ground'?.9:.13}):new T.LineBasicMaterial({color,transparent:true,opacity});const l=new T.Line(geom,mat);if(dashed)l.computeLineDistances();group.add(l);return l;}
    segmented(points,color,group=this.paths){let segment=[],below=null;const flush=()=>{if(segment.length>1)this.line(segment,color,below?.35:.9,below,group);};for(const p of points){const b=p.y<0;if(below!==null&&b!==below){const last=segment[segment.length-1];const t=-last.y/(p.y-last.y);const cross=last.clone().lerp(p,t);segment.push(cross);flush();segment=[cross];}segment.push(p);below=b;}flush();}
    circle(radius,y,color,opacity=.25){const p=[];for(let i=0;i<=180;i++){const a=i*Math.PI/90;p.push(V(radius*Math.cos(a),y,radius*Math.sin(a)));}this.line(p,color,opacity);}
    sphere(radius,material,pos,group=this.dynamic){const s=new T.Mesh(new T.SphereGeometry(radius,48,32),material);s.position.copy(pos);group.add(s);return s;}
    reset(){this.focus=null;this.fov=90;this.az=180;this.alt=24;this.theta=.7;this.phi=1.04;this.distance=this.scale==='solar'?32:46;this.target.set(0,0,0);this.draw();}
    setFocus(body){this.focus=body;this.draw();}
    update(state,data,day,rebuildPaths){
      const switched=this.mode!==state.view||this.scale!==state.scale;this.mode=state.view;this.scale=state.scale;this.state=state;this.data=data;
      if(switched)this.reset();this.clear(this.static);this.clear(this.dynamic);this.clearLabels('static');this.clearLabels('dynamic');
      this.starField.material.opacity=state.view==='ground'?Math.max(.08,.45-data.sun.altitude*.013):.55;
      if(state.view==='ground')this.ground(state,data,day,rebuildPaths||switched);else this.space(state,data,rebuildPaths||switched);
      this.draw();
    }
    ground(s,data,day,rebuild){
      const sunAlt=data.sun.altitude;this.renderer.setClearColor(new T.Color(0x090f1d).lerp(new T.Color(0x18334a),Math.max(0,Math.min(1,(sunAlt+12)/45))));
      for(let alt=-60;alt<=60;alt+=30){if(alt<0&&!s.transparent)continue;const r=100*Math.cos(alt*D),y=100*Math.sin(alt*D);this.circle(r,y,colors.grid,alt===0?.6:.16);}
      for(let az=0;az<360;az+=30){const p=[];for(let alt=s.transparent?-90:0;alt<=90;alt+=3)p.push(hor(az,alt));this.line(p,colors.grid,.13);}
      for(const [az,name]of [[0,'北 N'],[90,'东 E'],[180,'南 S'],[270,'西 W']])this.label(name,hor(az,1), '#95b0bb','cardinal','static');
      const ground=new T.Mesh(new T.CircleGeometry(300,128),new T.MeshBasicMaterial({color:0x0e2428,side:T.DoubleSide,transparent:s.transparent,opacity:s.transparent?.08:1,depthWrite:!s.transparent}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;this.static.add(ground);
      const obs=M.observer(s.lat,s.lon),rh=A.Rotation_EQD_HOR(s.date,obs),re=A.Rotation_ECT_EQD(s.date);
      for(const [kind,color]of [['equator',colors.equator],['ecliptic',colors.ecliptic]]){
        if(!s[kind])continue;const pts=[];
        for(let a=0;a<=360;a+=2){let v=new A.Vector(Math.cos(a*D),Math.sin(a*D),0,A.MakeTime(s.date));if(kind==='ecliptic')v=A.RotateVector(re,v);v=A.RotateVector(rh,v);pts.push(V(-v.y,v.z,-v.x).multiplyScalar(99));}
        this.segmented(pts,color,this.static);
        const visible=pts.filter(v=>v.y>15).sort((a,b)=>b.y-a.y)[0];if(visible)this.label(kind==='equator'?'天赤道':'黄道',visible,kind==='equator'?'#82ddc6':'#b194ef','','static');
      }
      if(rebuild){this.clear(this.paths);this.clearLabels('path');for(const body of ['sun','moon']){const points=day[body].map(p=>hor(p.azimuth,p.altitude,97));this.segmented(points,colors[body]);for(const p of day[body])if(p.minute>0&&p.minute<1440&&p.minute%180===0)this.label(`${String(p.minute/60).padStart(2,'0')}h`,hor(p.azimuth,p.altitude,97),body==='sun'?'#dfb769':'#93a9c2','hour','path',p.altitude<0);}}
      this.paths.visible=s.trails;
      for(const body of ['sun','moon']){
        const p=hor(data[body].azimuth,data[body].altitude,95);this[body+'Pos']=p;
        if(data[body].altitude<0&&!s.transparent)continue;
        if(body==='sun'){this.sphere(1.3,new T.MeshBasicMaterial({color:0xffdda0}),p);const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTexture,color:0xffd594,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));glow.position.copy(p);glow.scale.set(9,9,1);this.dynamic.add(glow);}else{
          const light=new T.DirectionalLight(0xffffff,2.6);light.position.copy(hor(data.sun.azimuth,data.sun.altitude,1500));light.target.position.copy(p);this.dynamic.add(light,light.target);this.dynamic.add(new T.AmbientLight(0x52617b,.35));
          this.sphere(1.3,new T.MeshStandardMaterial({color:0xd3d9dd,roughness:1}),p);
        }
        this.label(`${body==='sun'?'太阳':'月亮'} · ${data[body].altitude.toFixed(1)}°`,p.clone().add(V(0,2.7,0)),body==='sun'?'#f6cf87':'#c9d7e8','body-label');
      }
    }
    plane(radius,rotation,color,origin){const g=new T.Group(),mesh=new T.Mesh(new T.CircleGeometry(radius,128),new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.035,depthWrite:false}));
      // Build in astronomical xy, then transform to Three's y-up coordinates.
      const verts=mesh.geometry.attributes.position;
      for(let i=0;i<verts.count;i++){let v=new A.Vector(verts.getX(i),verts.getY(i),0,A.MakeTime(this.state.date));if(rotation)v=A.RotateVector(rotation,v);const p=eq(v);verts.setXYZ(i,p.x,p.y,p.z);}verts.needsUpdate=true;g.add(mesh);
      const pts=[];for(let a=0;a<=360;a+=2){let v=new A.Vector(radius*Math.cos(a*D),radius*Math.sin(a*D),0,A.MakeTime(this.state.date));if(rotation)v=A.RotateVector(rotation,v);pts.push(eq(v));}this.line(pts,color,.45,false,g);g.position.copy(origin);this.static.add(g);return pts;
    }
    space(s,data,rebuild){
      this.renderer.setClearColor(0x070d17);this.dynamic.add(new T.AmbientLight(0x819ec0,.7));
      const solar=s.scale==='solar',rot=A.Rotation_EQJ_EQD(s.date),ecliptic=A.Rotation_ECT_EQD(s.date),date=A.MakeTime(s.date);
      const sunDir=eq(M.eqdVector('Sun',s.date)).normalize();const moonVec=eq(A.RotateVector(rot,A.GeoMoon(s.date)));
      const earthPos=solar?eq(A.RotateVector(rot,A.HelioVector('Earth',s.date))).multiplyScalar(11):V();
      const sunPos=solar?V():sunDir.clone().multiplyScalar(18);const moonPos=moonVec.clone().multiplyScalar(solar?500:2600).add(earthPos);
      const er=solar?.34:1.65,mr=solar?.10:.45,sr=solar?1.1:.95;this.sunPos=sunPos;this.moonPos=moonPos;
      const sun=this.sphere(sr,new T.MeshBasicMaterial({color:0xffce7b}),sunPos);const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTexture,color:0xffc979,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));glow.position.copy(sun.position);glow.scale.setScalar(sr*7);this.dynamic.add(glow);
      // A directional light preserves parallel sunlight despite compressed distances.
      const sunlight=new T.DirectionalLight(0xffedcf,3.1);sunlight.position.copy(earthPos.clone().add(sunDir.clone().multiplyScalar(100)));sunlight.target.position.copy(earthPos);this.dynamic.add(sunlight,sunlight.target);
      const earth=this.sphere(er,new T.MeshStandardMaterial({map:this.earthTexture,roughness:.92,transparent:s.transparent,opacity:s.transparent?.25:1,depthWrite:!s.transparent}),earthPos);
      // Three sphere UVs put longitude 0 on +x; rotate by Greenwich apparent sidereal time.
      earth.rotation.y=A.SiderealTime(s.date)*15*D;
      const atmo=this.sphere(er*1.035,new T.MeshBasicMaterial({color:0x53aec5,transparent:true,opacity:s.transparent?.035:.075,side:T.BackSide,depthWrite:false}),earthPos);atmo.renderOrder=2;
      this.sphere(mr,new T.MeshStandardMaterial({color:0xc6cbd0,roughness:1}),moonPos);
      this.line([earthPos.clone().add(V(0,-er*1.7,0)),earthPos.clone().add(V(0,er*2.3,0))],colors.equator,.6,true);
      if(!solar)this.label('北极 / 自转轴',earthPos.clone().add(V(0,er*2.5,0)),'#85c6b6','','static');
      const obs=eq(A.ObserverVector(s.date,M.observer(s.lat,s.lon),true)).normalize().multiplyScalar(er*1.035).add(earthPos);
      this.sphere(solar?.025:.043,new T.MeshBasicMaterial({color:0x95ffe0}),obs);
      if(!solar)this.label('观测点',obs.clone().add(V(0,.22,0)),'#95ffe0','','dynamic');
      this.label('太阳',sunPos.clone().add(V(0,sr*1.55,0)),'#f6c56f','body-label');this.label('地球',earthPos.clone().add(V(0,-er*1.5,0)),'#82ddc6','body-label');this.label('月亮',moonPos.clone().add(V(0,mr*1.9,0)),'#d1deed','body-label');
      const pr=solar?13:11;
      if(s.equator){const pts=this.plane(solar?2.7:11,null,colors.equator,earthPos);this.label('赤道面',pts[25].clone().add(earthPos),'#82ddc6','','static');}
      if(s.ecliptic){const pts=this.plane(pr,ecliptic,colors.ecliptic,solar?V():earthPos);this.label('黄道面',pts[95].clone().add(solar?V():earthPos),'#b194ef','','static');}
      // Monthly/yearly trajectories retain one fixed current EQD frame for every sample.
      // Cache in EQJ and rotate to the current frame; Earth translation updates each frame.
      const key=`${s.date.getUTCFullYear()}-${s.date.getUTCMonth()}-${s.date.getUTCDate()}`;
      if(this.orbitKey!==key){this.orbitKey=key;this.moonOrbit=[];this.earthOrbit=[];for(let i=0;i<=160;i++){const t=new Date(+s.date+(i/160-.5)*27.321661*M.DAY);this.moonOrbit.push(A.GeoMoon(t));}for(let i=0;i<=240;i++){const t=new Date(+s.date+(i/240-.5)*365.256*M.DAY);this.earthOrbit.push(A.HelioVector('Earth',t));}}
      this.clear(this.paths);this.clearLabels('path');
      this.line(this.moonOrbit.map(v=>eq(A.RotateVector(rot,v)).multiplyScalar(solar?500:2600).add(earthPos)),colors.moon,.35,false,this.paths);
      if(solar)this.line(this.earthOrbit.map(v=>eq(A.RotateVector(rot,v)).multiplyScalar(11)),colors.sun,.5,false,this.paths);
      this.paths.visible=s.trails;
    }
    draw(){
      if(!this.renderer)return;
      if(this.mode==='ground'){
        if(this.focus && this.data){this.az=this.data[this.focus].azimuth;this.alt=this.data[this.focus].altitude;}
        this.camera.position.set(0,0,0);this.camera.fov=this.fov;this.camera.lookAt(hor(this.az,this.alt));
      }else{
        if(this.focus && this[this.focus+'Pos'])this.target.copy(this[this.focus+'Pos']);else this.target.set(0,0,0);
        const distance=this.distance/Math.min(1,this.camera.aspect);
        this.camera.fov=48;this.camera.position.set(distance*Math.sin(this.phi)*Math.sin(this.theta),distance*Math.cos(this.phi),distance*Math.sin(this.phi)*Math.cos(this.theta)).add(this.target);this.camera.lookAt(this.target);
      }
      this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.renderer.render(this.scene,this.camera);
      const w=this.host.clientWidth,h=this.host.clientHeight;
      for(const l of this.labels){const p=l.pos.clone().project(this.camera);let show=p.z>-1&&p.z<1&&Math.abs(p.x)<.96&&Math.abs(p.y)<.94;
        if(l.type==='path'&&!this.state?.trails)show=false;
        if(this.mode==='ground'&&l.below&&!this.state?.transparent)show=false;
        if(this.mode==='space'&&l.el.textContent==='观测点'&&!this.state?.transparent){const ep=this.scale==='solar'?eq(A.RotateVector(A.Rotation_EQJ_EQD(this.state.date),A.HelioVector('Earth',this.state.date))).multiplyScalar(11):V();if(l.pos.clone().sub(ep).dot(this.camera.position.clone().sub(ep))<0)show=false;}
        l.el.hidden=!show;if(show){const offset=l.el.classList.contains('body-label')?(l.el.textContent==='地球'?16:-19):0;l.el.style.left=`${(p.x+1)*w/2}px`;l.el.style.top=`${(1-p.y)*h/2+offset}px`;}
      }
      this.onMove?.({az:(this.az%360+360)%360,alt:this.alt,fov:this.fov,focus:this.focus});
    }
  }
  root.SkyScene=SkyScene;
})(globalThis);
