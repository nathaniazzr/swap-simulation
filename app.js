// Tampilan dashboard. Perhitungan ada di sim.js (fungsi simulate).
// Jitter (variasi waktu tempuh) tetap di D dalam persen, simulate memakai pecahan.
// Waktu PP dan kWh per PP diturunkan dari jarak sekali jalan (station ke tujuan, PP = 2 x jarak).
// Berangkat kosong dari gudang ke tempat hauling (empty speed), pulang bermuatan ke gudang (loaded speed). Average speed = jarak PP / waktu PP.
const route=p=>{const km=2*p.jarakKm,ppMin=(p.jarakKm/p.loadedKmh+p.jarakKm/p.emptyKmh)*60;return{ppKm:km,ppMin,avgKmh:km/(ppMin/60),kwhPP:km*p.kwhKm}};
// PA (physical availability) berlaku per truk: semua truk jalan, tapi tiap truk hanya tersedia PA% dari waktu.
// Sisanya jadi maintenance yang digilir antar truk (lihat sim.js).
const simulateUI=p=>simulate(Object.assign({},p,route(p),{pa:p.pa/100,jitter:p.jitter/100}));
const D={nTruk:37,pa:90,breaks:[],nSt:4,slots:3,slotMode:'all',chargeMin:80,swapMin:5,jarakKm:9.5,loadedKmh:19,emptyKmh:29,kwhKm:3.0142,capKwh:320,socMin:10,jitter:15,startMode:'bertahap',strategy:'standar',earlySoc:30,opsH:24,propCharge:0,seed:7};
const P=Object.assign({},D,{breaks:[]});
const $=id=>document.getElementById(id);
let R=null,tNow=480;
const f1=x=>x.toFixed(1),f0=x=>Math.round(x).toString();
const hhmm=m=>{m=Math.max(0,Math.min(1439,Math.floor(m)));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
function verdict(k){
 if(k.avgWait<=5)return['ok','Feasible',`Queue under control: average wait ${f1(k.avgWait)} min.`];
 if(k.avgWait<=15)return['warn','Marginal',`Queue is building up: average wait ${f1(k.avgWait)} min.`];
 return['bad','Insufficient',`Long queue: average wait ${f1(k.avgWait)} min. Capacity is not enough for this fleet.`];
}
const COL={ok:'var(--ok)',warn:'var(--warn)',bad:'var(--bad)'};
// Arsir jam istirahat (R.work[t]===0) pada grafik.
function bands(x0,iw,y0,h,T){let s='',t=0;while(t<T){if(!R.work[t]){let e=t;while(e<T&&!R.work[e])e++;s+=`<rect x="${(x0+iw*t/T).toFixed(1)}" y="${y0}" width="${(iw*(e-t)/T).toFixed(1)}" height="${h}" fill="var(--idle)" opacity=".4"/>`;t=e}else t++}return s}
function line(el,series,H,maxY,colors,xl){
 const W=640,pl=34,pr=8,pt=8,pb=22,iw=W-pl-pr,ih=H-pt-pb,n=series[0].length;
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img">`+bands(pl,iw,pt,ih,n);
 for(let i=0;i<=4;i++){const y=pt+ih*(1-i/4);s+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl-5}" y="${y+4}" text-anchor="end">${f0(maxY*i/4)}</text>`}
 for(let h=0;h<=24;h+=4){const x=pl+iw*h/24;s+=`<text x="${x}" y="${H-6}" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`}
 series.forEach((arr,j)=>{let d='';const step=Math.max(1,Math.floor(n/360));for(let i=0;i<n;i+=step){const x=pl+iw*i/(n-1),y=pt+ih*(1-Math.min(1,arr[i]/maxY));d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}
  s+=`<path d="${d}" fill="none" stroke="${colors[j]}" stroke-width="1.8"/>`});
 const x=pl+iw*tNow/(n-1);s+=`<line x1="${x}" x2="${x}" y1="${pt}" y2="${pt+ih}" stroke="var(--ink)" stroke-dasharray="3 3" opacity=".6"/>`;
 el.innerHTML=s+'</svg>';
}
function drawCharts(){
 const T=R.T,S=R.S,N=R.N,q=new Array(T),rd=new Array(T);
 let mq=1,mr=1;
 for(let t=0;t<T;t++){let a=0,b=0;for(let k=0;k<S;k++){a+=R.qLen[t*S+k];b+=R.rdy[t*S+k]}q[t]=a;rd[t]=b;if(a>mq)mq=a;if(b>mr)mr=b}
 const m=Math.max(4,Math.ceil(Math.max(mq,mr)/4)*4);
 line($('chQ'),[q,rd],190,m,['var(--bad)','var(--rdy)']);
 // waktu tunggu per jam
 const w=R.waitByHour,mw=Math.max(5,Math.ceil(Math.max(...w)/5)*5),W=640,H=190,pl=34,pt=8,pb=22,iw=W-pl-8,ih=H-pt-pb,bw=iw/w.length;
 const thr=Math.max(...w)*0.75;
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
 for(let i=0;i<=4;i++){const y=pt+ih*(1-i/4);s+=`<line x1="${pl}" x2="${W-8}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl-5}" y="${y+4}" text-anchor="end">${f0(mw*i/4)}</text>`}
 w.forEach((v,i)=>{const h=ih*v/mw,x=pl+i*bw+2,hot=v>=thr&&v>3;s+=`<rect x="${x}" y="${pt+ih-h}" width="${bw-4}" height="${Math.max(0,h)}" rx="2" fill="${hot?'var(--bad)':'var(--acc2)'}"><title>${String(i).padStart(2,'0')}:00 arrival, average wait ${f1(v)} min (${R.waitByHourN[i]} swaps)</title></rect>`;if(i%3===0)s+=`<text x="${x+bw/2-2}" y="${H-6}" text-anchor="middle">${String(i).padStart(2,'0')}</text>`});
 $('chW').innerHTML=s+'</svg>';
}
function drawKpi(){
 const k=R.kpi,v=verdict(k);
 $('verdict').innerHTML=`<span class="dot" style="background:${COL[v[0]]}"></span><div><b>${v[1]}: ${P.nTruk} trucks, ${R.S} stations × ${R.nb} slots</b><div class="sub">${v[2]}</div></div>`;
 const K=[['Swaps per day',f0(k.swaps),`theoretical capacity ${f0(k.capacity)}`],['Average wait',f1(k.avgWait)+' min',''],
  ['Charger utilization',f0(k.utilCharger*100)+'%',`swap bay ${f0(k.utilBay*100)}%`],['Fleet efficiency',f0(k.eff*100)+'%',`${f0(k.ppTotal)} of ${f0(k.idealPP)} ideal round trips`],
  ['Peak queue',f0(k.peakQ)+' trucks',`average ${f1(k.avgQ)}`],['Peak power',f0(k.peakKW)+' kW',`energy ${f1(k.energyMWh)} MWh/day`]];
 $('kpis').innerHTML=K.map(a=>`<div class="kpi"><div class="l">${a[0]}</div><div class="n">${a[1]}</div><div class="s">${a[2]}</div></div>`).join('');
}
function estWaitAt(k,t){ // perkiraan dari snapshot
 const S=R.S,q=R.qLen[t*S+k],r=R.rdy[t*S+k];
 if(r>q)return q*R.P.swapMin;
 return Math.round((q-r+1)*R.P.chargeMin/R.nb+R.P.swapMin);
}
function drawSnap(){
 const t=Math.min(R.T-1,tNow),N=R.N,S=R.S;
 $('clock').textContent=hhmm(t)+(R.work[t]?'':' · break');
 const nm=['Standby','Hauling','Queued','Swapping','Break','Maintenance'];
 $('trucks').innerHTML=Array.from({length:N},(_,i)=>{const st=R.tState[t*N+i],soc=R.tSoc[t*N+i];return `<div class="tk s${st}${soc<R.P.socMin+R.socPerPP*0.5?' low':''}" title="Truck ${i+1}: ${nm[st]}${st===2||st===3?' at station '+(R.tSt[t*N+i]+1):''}"><span>T${i+1}</span><b>${f0(soc)}%</b></div>`}).join('');
 let h='<table><tr><th>Station</th><th>Queued</th><th>Ready batteries</th><th>Charging</th><th>Est. wait</th></tr>';
 for(let k=0;k<S;k++){const e=estWaitAt(k,t);h+=`<tr><td>Station ${k+1}</td><td>${R.qLen[t*S+k]}</td><td>${R.rdy[t*S+k]}</td><td>${R.chg[t*S+k]}</td><td>${e} min</td></tr>`}
 $('stTable').innerHTML=h+'</table>';
}
function drawSweep(){
 let h='<table><tr><th>Stations</th><th>Swaps/day</th><th>Average wait</th><th>Charger utilization</th><th>Fleet efficiency</th><th>Status</th></tr>';
 for(let s=1;s<=8;s++){
  const r=s===P.nSt?R:simulateUI(Object.assign({},P,{nSt:s})),k=r.kpi,v=verdict(k);
  h+=`<tr class="${s===P.nSt?'cur':''}"><td>${s} station${s>1?'s':''}</td><td>${f0(k.swaps)}</td><td>${f1(k.avgWait)} min</td><td>${f0(k.utilCharger*100)}%</td><td>${f0(k.eff*100)}%</td><td><span class="pill" style="background:${COL[v[0]]}">${v[1]}</span></td></tr>`;
 }
 $('sweep').innerHTML=h+'</table>';
}
function run(){
 R=simulateUI(P);
 $('vSt').textContent=P.nSt;$('vSlots').textContent=P.slots;
 drawUAInfo();
 const ru=route(P);$('speedInfo').textContent=`Average speed ${f1(ru.avgKmh)} km/h · round trip ${f1(ru.ppMin)} min`;
 drawKpi();drawCharts();drawSnap();drawSweep();
}
function bind(){
 const num=['nTruk','pa','nSt','slots','swapMin','chargeMin','jarakKm','loadedKmh','emptyKmh','kwhKm','capKwh'];
 num.forEach(id=>{$(id).value=P[id];$(id).oninput=e=>{let v=parseFloat(e.target.value);if(id==='nTruk')v=Math.min(200,Math.round(v));if(!isNaN(v)&&v>0){P[id]=v;run()}}});
 $('scrub').oninput=e=>{tNow=+e.target.value;drawCharts();drawSnap()};
}
// ---- Usage of availability: jam istirahat ----
// P.breaks = [{hours, start}]; hours boleh desimal (2.52), start = jam mulai bulat 0-23 (geser per jam).
const f2=x=>(+x).toFixed(2).replace(/\.?0+$/,'');
const hm=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
function brkPieces(b){const a=b.start,e=b.start+Math.min(24,b.hours||0);if(!(b.hours>0))return[];return e<=24?[[a,e-a]]:[[a,24-a],[0,e-24]]}
function brkTime(b){return b.hours>0?`${hm(b.start*60)} – ${hm(b.start*60+Math.min(24,b.hours)*60)}`:'enter hours first'}
function drawBrkBlock(i){
 const b=P.breaks[i],tl=$('uaList').querySelector(`.tl[data-i="${i}"]`);if(!tl)return;
 tl.innerHTML=brkPieces(b).map(([a,w])=>`<div class="tlblk" style="left:${a/24*100}%;width:${w/24*100}%"></div>`).join('');
 $('uaList').querySelector(`.tm[data-i="${i}"]`).textContent=brkTime(b);
}
function drawBreaks(){
 const ax='<div class="tlax">'+Array.from({length:25},(_,h)=>`<span>${String(h).padStart(2,'0')}</span>`).join('')+'</div>';
 $('uaList').innerHTML=P.breaks.map((b,i)=>`<div class="brk"><div class="brkhead"><b>Break ${i+1}</b>
  <label>Input hours<input type="number" min="0" max="24" step="0.01" data-i="${i}" value="${b.hours>0?b.hours:''}" placeholder="0"> h</label>
  <span class="tm" data-i="${i}"></span><button type="button" class="del" data-i="${i}">Delete</button></div>
  <div class="tl" data-i="${i}"></div>${ax}</div>`).join('')||'<div class="note" style="margin:0 0 8px">No breaks yet.</div>';
 P.breaks.forEach((_,i)=>drawBrkBlock(i));
 $('uaList').querySelectorAll('input').forEach(el=>el.oninput=()=>{const i=+el.dataset.i,v=parseFloat(el.value);P.breaks[i].hours=isNaN(v)||v<0?0:Math.min(24,v);drawBrkBlock(i);run()});
 $('uaList').querySelectorAll('.del').forEach(el=>el.onclick=()=>{P.breaks.splice(+el.dataset.i,1);drawBreaks();run()});
 $('uaList').querySelectorAll('.tl').forEach(tl=>{
  const i=+tl.dataset.i;let grab=0;
  const hourAt=e=>{const r=tl.getBoundingClientRect();return (e.clientX-r.left)/r.width*24};
  const move=e=>{const b=P.breaks[i],s=Math.max(0,Math.min(23,Math.round(hourAt(e)-grab)));if(s!==b.start){b.start=s;drawBrkBlock(i);run()}};
  tl.onpointerdown=e=>{const b=P.breaks[i];if(!(b.hours>0))return;const h=hourAt(e),inBlk=e.target.classList.contains('tlblk');
   grab=inBlk?((h-b.start+24)%24):Math.min(b.hours,24)/2;
   tl.setPointerCapture(e.pointerId);tl.classList.add('drag');move(e)};
  tl.onpointermove=e=>{if(tl.classList.contains('drag'))move(e)};
  tl.onpointerup=tl.onpointercancel=()=>tl.classList.remove('drag');
 });
}
function drawUAInfo(){
 const k=R.kpi,stop=(R.T-k.workMin)/60,n=P.breaks.filter(b=>b.hours>0).length,sum=P.breaks.reduce((a,b)=>a+(b.hours>0?Math.min(24,b.hours):0),0);
 const txt=n?`${n} break${n>1?'s':''} · stopped ${f2(stop)} h/day · UA ${f1(k.ua*100)}% · effective working time ${f2(k.workMin/60)} h/truck`:'No breaks yet · UA 100%';
 $('uaInfo').textContent=txt;
 $('uaSum').innerHTML=txt+(sum-stop>0.01?'<br><b style="color:var(--bad)">Some breaks overlap; overlapping hours are counted once.</b>':'');
}
function bindUA(){
 const open=v=>{$('uaPanel').hidden=!v};
 $('uaOpen').onclick=()=>{if(!P.breaks.length){P.breaks.push({hours:0,start:12});drawBreaks()}open(true)};
 $('uaClose').onclick=()=>open(false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')open(false)});
 $('uaAdd').onclick=()=>{P.breaks.push({hours:0,start:12});drawBreaks();const ins=$('uaList').querySelectorAll('input');ins[ins.length-1].focus()};
 drawBreaks();
}
bind();bindUA();run();
