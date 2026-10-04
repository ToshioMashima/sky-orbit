const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../astronomy-core.js');
const A=M.A;
function near(actual,expected,tol,label){assert.ok(Math.abs(actual-expected)<=tol,`${label}: ${actual}, expected ${expected} ± ${tol}`);}

test('civil time correctly crosses UTC date boundaries, with fractional offsets',()=>{
  for(const offset of [-12,-5,0,5.5,5.75,8,14]){
    const d=M.fromCivil('2024-02-29','00:15:30',offset);
    assert.equal(M.parts(d,offset).date,'2024-02-29');assert.equal(M.parts(d,offset).time,'00:15:30');
  }
  assert.equal(M.fromCivil('2024-06-21','00:00:00',8).toISOString(),'2024-06-20T16:00:00.000Z');
  assert.equal(M.fromCivil('2023-02-29','12:00',8),null);
  assert.equal(M.fromCivil('2024-01-01','25:00',8),null);
});

test('Sun matches independently published NREL SPA reference case',()=>{
  // Reda & Andreas, NREL/TP-560-34302, Appendix A.5, 2003-10-17 12:30:30 MST.
  // https://docs.nlr.gov/docs/fy08osti/34302.pdf
  // SPA reference uses elevation 1830.14 m / pressure 820 mb / temperature 11 C;
  // this app uses sea level and standard refraction. Allow 0.02 degrees for that difference.
  const c=M.current(new Date('2003-10-17T19:30:30Z'),39.742476,-105.1786,true);
  near(c.sun.azimuth,194.34024,.02,'azimuth');near(c.sun.altitude,90-50.11162,.02,'altitude');
});

test('summer / winter solstice declination and opposite hemispheres',()=>{
  const summer=new Date('2024-06-20T20:51:00Z'),winter=new Date('2024-12-21T09:21:00Z');
  near(M.current(summer,0,0,false).sun.dec,23.44,.03,'summer declination');
  near(M.current(winter,0,0,false).sun.dec,-23.44,.03,'winter declination');
  assert.ok(M.current(summer,90,0,false).sun.altitude>23);
  assert.ok(M.current(summer,-90,0,false).sun.altitude<-23);
});

test('polar day and polar night have no invented sunrise/sunset',()=>{
  for(const month of ['06','12'])for(const lat of [90,-90]){
    const d=M.daily(new Date(`2024-${month}-21T00:00:00Z`),0,lat,0,true);
    assert.equal(d.rise,null);assert.equal(d.set,null);assert.equal(d.sun.length,289);
    assert.ok(d.sun.every(p=>Number.isFinite(p.altitude)&&Number.isFinite(p.azimuth)));
  }
});

test('daily tracks include both boundaries and use the same topocentric positions',()=>{
  const date=new Date('2024-06-21T04:00:00Z'),c=M.current(date,39.9,116.4,true),d=M.daily(date,8,39.9,116.4,true);
  assert.equal(d.sun[0].minute,0);assert.equal(d.sun.at(-1).minute,1440);
  near(d.sun[144].altitude,c.sun.altitude,1e-9,'noon Sun track');near(d.moon[144].azimuth,c.moon.azimuth,1e-9,'noon Moon track');
  assert.equal(M.parts(d.rise,8).date,'2024-06-21');assert.equal(M.parts(d.set,8).date,'2024-06-21');
});

test('monthly lunar parallax is included in ground coordinates',()=>{
  const date=new Date('2024-06-21T04:00:00Z'),obs=M.observer(39.9,116.4);
  const geo=A.EquatorFromVector(M.eqdVector('Moon',date));
  const h=A.Horizon(date,obs,geo.ra,geo.dec,'');const topo=M.horizontal('Moon',date,obs,false);
  assert.ok(Math.abs(h.altitude-topo.altitude)>.1);
});

test('ground and space coordinate transforms agree after observer parallax',()=>{
  for(const [lat,lon]of [[39.9,116.4],[-33.87,151.21],[0,-78.47],[90,0],[-90,0]]){
    const date=new Date('2026-10-04T12:00:00Z'),obs=M.observer(lat,lon),r=A.Rotation_EQD_HOR(date,obs);
    for(const body of ['Sun','Moon']){
      const e=A.Equator(body,date,obs,true,true),v=A.RotateVector(r,e.vec),h=A.HorizonFromVector(v,'');
      const direct=M.horizontal(body,date,obs,false);
      near(h.lat,direct.altitude,1e-8,`${body} horizon altitude`);near(h.lon,direct.azimuth,1e-8,`${body} horizon azimuth`);
    }
  }
});

test('refraction raises near-horizon apparent positions and changes no azimuth',()=>{
  const date=new Date('2024-06-20T21:00:00Z'),obs=M.observer(39.9,116.4);
  const a=M.horizontal('Sun',date,obs,true),b=M.horizontal('Sun',date,obs,false);
  assert.ok(a.altitude>b.altitude);near(a.azimuth,b.azimuth,1e-8,'refraction azimuth');
});

test('moon phase remains physically bounded and eclipse new moon is dark',()=>{
  const c=M.current(new Date('2024-04-08T18:42:00Z'),32.78,-96.8,false);
  assert.ok(c.lit>=0&&c.lit<.001);assert.ok(c.moonDistanceKm>350000&&c.moonDistanceKm<410000);
  near(c.sun.altitude,c.moon.altitude,.12,'Dallas eclipse altitude');near(c.sun.azimuth,c.moon.azimuth,.12,'Dallas eclipse azimuth');
});
