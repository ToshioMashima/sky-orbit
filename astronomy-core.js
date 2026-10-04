/* Shared, DOM-free astronomy calculations. All times are absolute UTC instants. */
(function (root) {
  'use strict';
  const A = root.Astronomy || (typeof require === 'function' && require('./vendor/astronomy.browser.min.js'));
  const DAY = 86400000, AU_KM = 149597870.7, DEG = Math.PI / 180;
  const MIN_TIME = Date.UTC(1900, 0, 1), MAX_TIME = Date.UTC(2100, 11, 31, 23, 59, 59);
  function parts(date, offset) {
    const shifted = new Date(date.getTime() + offset * 3600000);
    return { date: shifted.toISOString().slice(0, 10), time: shifted.toISOString().slice(11, 19), seconds: shifted.getUTCHours()*3600 + shifted.getUTCMinutes()*60 + shifted.getUTCSeconds() };
  }
  function fromCivil(date, time, offset) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
    const result = new Date(`${date}T${time.length===5 ? time+':00' : time}Z`);
    if (!Number.isFinite(+result) || result.toISOString().slice(0, 10) !== date) return null;
    return new Date(+result - offset * 3600000);
  }
  function startOfDay(date, offset) { return fromCivil(parts(date, offset).date, '00:00:00', offset); }
  function observer(lat, lon) { return new A.Observer(lat, lon, 0); }
  function horizontal(body, date, obs, refract) {
    const eq = A.Equator(body, date, obs, true, true);
    const h = A.Horizon(date, obs, eq.ra, eq.dec, refract ? 'normal' : '');
    return { altitude: h.altitude, azimuth: h.azimuth, distanceKm: eq.dist * AU_KM, ra: eq.ra, dec: eq.dec };
  }
  function current(date, lat, lon, refract) {
    const obs = observer(lat,lon), sun = horizontal('Sun',date,obs,refract), moon = horizontal('Moon',date,obs,refract);
    const illumination = A.Illumination('Moon',date);
    return {sun,moon,phase:A.MoonPhase(date),lit:illumination.phase_fraction,moonDistanceKm:A.GeoMoon(date).Length()*AU_KM};
  }
  function daily(date, offset, lat, lon, refract) {
    const start = startOfDay(date,offset), obs = observer(lat,lon), sun=[], moon=[];
    for(let minute=0;minute<=1440;minute+=5) {
      const t = new Date(+start+minute*60000);
      sun.push({...horizontal('Sun',t,obs,refract),minute});
      moon.push({...horizontal('Moon',t,obs,refract),minute});
    }
    function event(direction) {
      const value=A.SearchRiseSet('Sun',obs,direction,start,1);
      return value && +value.date < +start+DAY ? value.date : null;
    }
    return {start,sun,moon,rise:event(1),set:event(-1)};
  }
  function eqdVector(body,date) {
    return A.RotateVector(A.Rotation_EQJ_EQD(date),A.GeoVector(body,date,true));
  }
  function phaseName(angle) {
    if(angle<5 || angle>=355)return '新月';
    if(angle<85)return '蛾眉月'; if(angle<95)return '上弦月';
    if(angle<175)return '盈凸月'; if(angle<185)return '满月';
    if(angle<265)return '亏凸月'; if(angle<275)return '下弦月';return '残月';
  }
  const api={A,DAY,DEG,AU_KM,MIN_TIME,MAX_TIME,parts,fromCivil,startOfDay,observer,horizontal,current,daily,eqdVector,phaseName};
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.SkyMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
