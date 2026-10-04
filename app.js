(function(){
  'use strict';
  const $=id=>document.getElementById(id), M=window.SkyMath;
  if(!M||!window.THREE){$('errorBox').hidden=false;$('errorBox').textContent='依赖文件未加载。请解压完整文件夹，保留 vendor 文件夹与 index.html 的相对位置，再重新打开。';return;}
  const cities={beijing:[39.9,116.4,'北京'],shanghai:[31.23,121.47,'上海'],singapore:[1.35,103.82,'新加坡'],london:[51.51,-.13,'伦敦'],sydney:[-33.87,151.21,'悉尼'],quito:[0,-78.47,'赤道'],tromso:[69.65,18.96,'特罗姆瑟'],north:[90,0,'北极'],south:[-90,0,'南极']};
  const state={date:new Date(),offset:8,lat:39.9,lon:116.4,view:'ground',scale:'earth',city:'beijing',equator:true,ecliptic:true,trails:true,transparent:false,refraction:true,playing:false,speed:600};
  const url=new URLSearchParams(location.search);
  if(url.has('lat')&&Number.isFinite(+url.get('lat')))state.lat=Math.max(-90,Math.min(90,+url.get('lat')));
  if(url.has('lon')&&Number.isFinite(+url.get('lon')))state.lon=Math.max(-180,Math.min(180,+url.get('lon')));
  if(url.has('lat')||url.has('lon'))state.city='custom';
  if(url.has('date')){const date=new Date(url.get('date'));if(+date>=M.MIN_TIME&&+date<=M.MAX_TIME)state.date=date;}
  if(url.has('view')&&['ground','space'].includes(url.get('view')))state.view=url.get('view');
  let day=null,dayKey='',current=null,scene=null,toastTimer=null;
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
  function tzLabel(){const sign=state.offset>=0?'+':'−',n=Math.abs(state.offset);return `UTC${sign}${String(Math.floor(n)).padStart(2,'0')}:${String(Math.round(n%1*60)).padStart(2,'0')}`;}
  function syncDate(){const p=M.parts(state.date,state.offset);$('date').value=p.date;$('time').value=p.time;$('daySlider').value=p.seconds;$('clockLabel').textContent=p.time;$('daySpan').textContent=tzLabel();$('sceneDate').textContent=`${p.date.replaceAll('-',' / ')}  ·  ${p.time}  ${tzLabel()}`;}
  function syncLocation(){for(const name of ['latitude','longitude']){const v=state[name==='latitude'?'lat':'lon'];$(name).value=v;$(name+'Number').value=v.toFixed(2);$(name+'Suffix').textContent=name==='latitude'?'° (北＋/南−)':'° (东＋/西−)';} $('city').value=state.city;}
  function phaseIcon(){const canvas=$('moonPhase'),ctx=canvas.getContext('2d'),r=30,cx=40,cy=40;ctx.clearRect(0,0,80,80);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#273342';ctx.fill();const k=Math.cos(current.phase*M.DEG),wax=current.phase<180;ctx.fillStyle='#d5dfec';ctx.beginPath();for(let y=-r;y<=r;y+=.4){const edge=Math.sqrt(Math.max(0,r*r-y*y)),terminator=edge*k;const left=wax?terminator:-edge,right=wax?edge:-terminator;ctx.rect(cx+left,cy+y,Math.max(0,right-left),.65);}ctx.fill();ctx.strokeStyle='#d5dfec33';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}
  function updateUI(){
    syncDate();$('spaceOptions').hidden=state.view!=='space';$('refractionRow').hidden=state.view!=='ground';
    for(const mode of ['ground','space']){$(mode+'View').classList.toggle('active',state.view===mode);$(mode+'View').setAttribute('aria-pressed',String(state.view===mode));}
    const name=cities[state.city]?.[2]||`${Math.abs(state.lat).toFixed(2)}°${state.lat<0?'S':'N'} · ${Math.abs(state.lon).toFixed(2)}°${state.lon<0?'W':'E'}`;
    $('sceneMode').textContent=state.view==='ground'?'地面观测站':'太空观测站';$('sceneLocation').textContent=state.view==='ground'?`${name}的天空`:state.scale==='earth'?'地球，与它的日月':'日地月 · 公转之旅';
    $('sceneBadge').textContent=state.view==='ground'?'地平坐标系':'日期真赤道坐标系';
    $('interactionHint').textContent=state.view==='ground'?'拖动环顾天空 · 滚轮缩放 · 方向键转动':'拖动旋转 · 滚轮缩放 · 方向键转动';
    $('scaleNote').textContent=state.view==='ground'?'日月图标适度放大，位置取天体中心；星点为示意背景。':'示意比例：天体大小与距离分别缩放，不能用于判断日月食；方向按星历计算。';
    $('trailLabel').textContent=state.view==='ground'?'当天日月轨迹':'公转轨迹';
    for(const body of ['sun','moon']){const b=current[body];$(body+'Alt').textContent=`${b.altitude.toFixed(2)}°`;$(body+'Az').textContent=`${b.azimuth.toFixed(2)}°`;$(body+'Status').textContent=b.altitude>=0?'● 地平线上':'◌ 地平线下';$(body+'Status').classList.toggle('below',b.altitude<0);}
    const time=t=>t?M.parts(t,state.offset).time.slice(0,5):'无';$('sunEvents').textContent=`${time(day.rise)} / ${time(day.set)}`;$('sunEvents').title='所选时区当天的标准日出 / 日落；“无”表示当天没有该事件（可能为极昼/极夜）。';
    $('phaseName').textContent=`${M.phaseName(current.phase)} · 照亮`;$('moonLight').textContent=`${(current.lit*100).toFixed(1)}%`;
    $('moonDistance').textContent=`地月中心距离 ${Math.round(current.moonDistanceKm).toLocaleString('zh-CN')} km`;
    $('coordinateNote').textContent=`${state.view==='space'?'下方读数仍为所选地面观测点。 ':''}方位角：北 0° · 东 90° · 南 180° · 西 270°　|　高度角：地平线 0° · 天顶 90°`;
    phaseIcon();updateNotice();
  }
  function updateNotice(){let message='';if(state.view==='ground'&&scene?.focus&&current[scene.focus].altitude<0&&!state.transparent)message=`${scene.focus==='sun'?'太阳':'月亮'}此刻在地平线以下。开启「地球透明」即可看到。`;else if(state.view==='ground'&&state.transparent)message='透明地球已开启 · 地平线下的轨迹以虚线表示';$('sceneNotice').hidden=!message;$('sceneNotice').textContent=message;}
  function update(force=false){
    current=M.current(state.date,state.lat,state.lon,state.refraction);
    const key=[M.parts(state.date,state.offset).date,state.offset,state.lat,state.lon,state.refraction].join('|');const rebuild=force||key!==dayKey;
    if(rebuild){day=M.daily(state.date,state.offset,state.lat,state.lon,state.refraction);dayKey=key;}
    updateUI();scene?.update(state,current,day,rebuild);
  }
  try{scene=new SkyScene($('canvasHost'),$('labels'),camera=>{$('cameraReadout').textContent=state.view==='ground'?`视线方位 ${camera.az.toFixed(0)}° · 仰角 ${camera.alt.toFixed(0)}°`:'空间自由视角';if(current)updateNotice();});}catch(error){console.error(error);$('errorBox').hidden=false;$('errorBox').textContent='无法启动 3D 图形。请使用最新版 Safari 或 Chrome，并开启硬件加速。下方天文读数仍可使用。';}
  function setDate(date){if(!date||!Number.isFinite(+date)){toast('请输入完整且有效的日期和时间。');syncDate();return;}const civil=M.parts(date,state.offset).date;if(civil<'1900-01-01'||civil>'2100-12-31'){toast('请选择 1900–2100 年之间的日期。');syncDate();return;}state.date=date;update();}
  function pause(){state.playing=false;$('play').textContent='▶';$('play').setAttribute('aria-label','播放时间');$('play').setAttribute('aria-pressed','false');}
  for(const mode of ['ground','space'])$(mode+'View').addEventListener('click',()=>{state.view=mode;update(true);});
  $('spaceScale').addEventListener('change',()=>{state.scale=$('spaceScale').value;update(true);});
  $('city').addEventListener('change',()=>{state.city=$('city').value;if(cities[state.city]){[state.lat,state.lon]=cities[state.city];syncLocation();update();}});
  for(const [name,key,min,max] of [['latitude','lat',-90,90],['longitude','lon',-180,180]]){
    const handler=e=>{const value=e.target.valueAsNumber;if(!Number.isFinite(value)){syncLocation();return;}state[key]=Math.max(min,Math.min(max,value));state.city='custom';syncLocation();update();};
    $(name).addEventListener('input',handler);$(name+'Number').addEventListener('change',handler);
  }
  $('date').addEventListener('change',()=>{pause();setDate(M.fromCivil($('date').value,$('time').value,state.offset));});
  $('time').addEventListener('change',()=>{pause();setDate(M.fromCivil($('date').value,$('time').value,state.offset));});
  $('timezone').addEventListener('change',()=>{state.offset=+$('timezone').value;update();});
  $('now').addEventListener('click',()=>{pause();setDate(new Date());});
  $('daySlider').addEventListener('input',()=>{pause();setDate(new Date(+M.startOfDay(state.date,state.offset)+$('daySlider').valueAsNumber*1000));});
  $('previousDay').addEventListener('click',()=>setDate(new Date(+state.date-M.DAY)));$('nextDay').addEventListener('click',()=>setDate(new Date(+state.date+M.DAY)));
  for(const layer of ['equator','ecliptic','trails','transparent','refraction'])$(layer).addEventListener('change',()=>{state[layer]=$(layer).checked;update(layer==='refraction');});
  for(const body of ['Sun','Moon'])$('focus'+body).addEventListener('click',()=>{scene?.setFocus(body.toLowerCase());updateNotice();});
  $('resetView').addEventListener('click',()=>{scene?.reset();updateNotice();});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{toast('此浏览器不支持网页全屏，可使用 Mac 的窗口全屏按钮。');}});
  $('play').addEventListener('click',()=>{if(state.playing)pause();else{state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停时间');$('play').setAttribute('aria-pressed','true');}});
  $('speed').addEventListener('change',()=>state.speed=+$('speed').value);
  $('locate').addEventListener('click',()=>{if(!navigator.geolocation){toast('浏览器不支持定位，请手动选择城市或坐标。');return;}$('locate').disabled=true;navigator.geolocation.getCurrentPosition(p=>{state.lat=+p.coords.latitude.toFixed(2);state.lon=+p.coords.longitude.toFixed(2);state.city='custom';syncLocation();update();$('locate').disabled=false;toast('位置已更新；显示时区保持不变。');},()=>{$('locate').disabled=false;toast('无法读取位置，请手动设置。在线使用定位需要 HTTPS 和位置权限。');},{timeout:10000,maximumAge:300000});});
  for(const id of ['helpButton','accuracyButton'])$(id).addEventListener('click',()=>$('helpDialog').showModal());
  $('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('helpDialog').addEventListener('click',e=>{if(e.target===$('helpDialog')){const r=$('helpDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('helpDialog').close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  let last=performance.now(),accum=0;
  function tick(now){const elapsed=Math.min(now-last,250);last=now;if(state.playing){accum+=elapsed;if(accum>=120){const next=new Date(+state.date+accum*state.speed);accum=0;const civil=M.parts(next,state.offset).date;if(civil>'2100-12-31'){pause();toast('已到达支持日期范围的末尾。');}else{state.date=next;update();}}}else accum=0;requestAnimationFrame(tick);}
  syncLocation();update(true);
  if(scene&&state.view==='ground'){const visible=current.sun.altitude>=0?current.sun:current.moon.altitude>=0?current.moon:current.sun;scene.az=visible.azimuth;scene.alt=Math.max(12,Math.min(50,visible.altitude));scene.draw();}
  requestAnimationFrame(tick);
  // Read-only snapshots are useful for reproducible validation and troubleshooting.
  window.skySimulator={snapshot:()=>({state:{...state,date:state.date.toISOString()},current:structuredClone(current),day:{rise:day.rise?.toISOString()||null,set:day.set?.toISOString()||null,samples:day.sun.length},camera:scene?{az:scene.az,alt:scene.alt}:null})};
})();
