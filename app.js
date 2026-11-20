// Tampilan dashboard. Perhitungan ada di sim.js (fungsi simulate).
// Slider jitter di layar dalam persen, simulate memakai pecahan.
// Waktu PP dan kWh per PP diturunkan dari jarak sekali jalan (station ke tujuan, PP = 2 x jarak).
const route=p=>{const km=2*p.jarakKm;return{ppKm:km,ppMin:km/p.speedKmh*60,kwhPP:km*p.kwhKm}};
const simulateUI=p=>simulate(Object.assign({},p,route(p),{jitter:p.jitter/100}));
const D={nTruk:37,nSt:4,slots:3,slotMode:'all',chargeMin:80,swapMin:5,jarakKm:21,speedKmh:50,kwhKm:1.3636,capKwh:320,socMin:10,jitter:15,startMode:'bertahap',strategy:'standar',earlySoc:30,opsH:24,propCharge:0,seed:7};
const P=Object.assign({},D);
const $=id=>document.getElementById(id);
const PRESETS=[
 ['4 station',{nTruk:37,nSt:4}],['5 station',{nTruk:37,nSt:5}],['1 station saja',{nTruk:37,nSt:1}],
 ['1 station, 9 truk',{nTruk:9,nSt:1}],['Serentak 3 truk',{nTruk:9,nSt:1,startMode:'serentak',jitter:0}],['Slot kosong wajib',{nTruk:37,nSt:5,slotMode:'one'}],['Fleksibel',{nTruk:37,nSt:5,strategy:'fleksibel'}]
];
let R=null,gSt=0,tNow=480;
const f1=x=>x.toFixed(1),f0=x=>Math.round(x).toString();
const hhmm=m=>{m=Math.max(0,Math.min(1439,Math.floor(m)));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
function verdict(k){
 if(k.avgWait<=5&&k.maxWait<=30)return['ok','Layak',`Antrean terkendali: rata-rata tunggu ${f1(k.avgWait)} menit, maksimum ${f0(k.maxWait)} menit.`];
 if(k.avgWait<=15)return['warn','Batas',`Antrean mulai terasa: rata-rata ${f1(k.avgWait)} menit, maksimum ${f0(k.maxWait)} menit. Tambah station atau ratakan jadwal.`];
 return['bad','Kurang',`Antrean tinggi: rata-rata ${f1(k.avgWait)} menit, maksimum ${f0(k.maxWait)} menit. Kapasitas tidak cukup untuk armada ini.`];
}
const COL={ok:'var(--ok)',warn:'var(--warn)',bad:'var(--bad)'};
function line(el,series,H,maxY,colors,xl){
 const W=640,pl=34,pr=8,pt=8,pb=22,iw=W-pl-pr,ih=H-pt-pb,n=series[0].length;
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
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
 w.forEach((v,i)=>{const h=ih*v/mw,x=pl+i*bw+2,hot=v>=thr&&v>3;s+=`<rect x="${x}" y="${pt+ih-h}" width="${bw-4}" height="${Math.max(0,h)}" rx="2" fill="${hot?'var(--bad)':'var(--acc2)'}"><title>${String(i).padStart(2,'0')}:00 tiba, tunggu rata-rata ${f1(v)} mnt (${R.waitByHourN[i]} swap)</title></rect>`;if(i%3===0)s+=`<text x="${x+bw/2-2}" y="${H-6}" text-anchor="middle">${String(i).padStart(2,'0')}</text>`});
 $('chW').innerHTML=s+'</svg>';
 drawGantt();
}
function drawGantt(){
 const T=R.T,S=R.S,nb=R.nb,k=Math.min(gSt,S-1),W=900,pl=64,pr=8,rh=22,H=(nb+1)*rh+34,iw=W-pl-pr;
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
 for(let h=0;h<=24;h+=2){const x=pl+iw*h/24;s+=`<line x1="${x}" x2="${x}" y1="4" y2="${H-22}" stroke="var(--line)"/><text x="${x}" y="${H-8}" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`}
 for(let x=0;x<=nb;x++){
  const y=6+x*rh;const isBay=x===nb;
  s+=`<text x="${pl-8}" y="${y+14}" text-anchor="end">${isBay?'Bay swap':'Slot '+(x+1)}</text>`;
  let t0=0,cur=-1;
  const val=t=>isBay?(R.bayBusy[t*S+k]?2:-1):(R.slotState[(t*S+k)*nb+x]===1?1:0);
  for(let t=0;t<=T;t++){
   const v=t<T?val(t):-9;
   if(v!==cur){
    if(cur===1||cur===0||cur===2){const col=cur===1?'var(--chg)':cur===2?'var(--jlk)':'var(--rdy)';
     if(!(isBay&&cur!==2))s+=`<rect x="${pl+iw*t0/T}" y="${y}" width="${Math.max(0.6,iw*(t-t0)/T)}" height="${rh-6}" fill="${col}" opacity="${cur===0?0.5:1}"/>`}
    t0=t;cur=v}
  }
 }
 const xx=pl+iw*tNow/T;s+=`<line x1="${xx}" x2="${xx}" y1="2" y2="${H-22}" stroke="var(--ink)" stroke-dasharray="3 3"/>`;
 $('chG').innerHTML=s+'</svg>';
}
function drawKpi(){
 const k=R.kpi,v=verdict(k);
 $('verdict').innerHTML=`<span class="dot" style="background:${COL[v[0]]}"></span><div><b>${v[1]}: ${R.N} truk, ${R.S} station × ${R.nb} slot</b><div class="sub">${v[2]}</div></div>`;
 const K=[['Swap per hari',f0(k.swaps),`kapasitas teori ${f0(k.capacity)}`],['Tunggu rata-rata',f1(k.avgWait)+' mnt',`P90 ${f0(k.p90)} · maks ${f0(k.maxWait)} mnt`],
  ['Utilisasi charger',f0(k.utilCharger*100)+'%',`bay swap ${f0(k.utilBay*100)}%`],['Efisiensi armada',f0(k.eff*100)+'%',`${f0(k.ppTotal)} PP dari ${f0(k.idealPP)} ideal`],
  ['Antrean puncak',f0(k.peakQ)+' truk',`rata-rata ${f1(k.avgQ)}`],['Daya puncak',f0(k.peakKW)+' kW',`energi ${f1(k.energyMWh)} MWh/hari`]];
 $('kpis').innerHTML=K.map(a=>`<div class="kpi"><div class="l">${a[0]}</div><div class="n">${a[1]}</div><div class="s">${a[2]}</div></div>`).join('');
}
function estWaitAt(k,t){ // perkiraan dari snapshot
 const S=R.S,q=R.qLen[t*S+k],r=R.rdy[t*S+k];
 if(r>q)return q*R.P.swapMin;
 return Math.round((q-r+1)*R.P.chargeMin/R.nb+R.P.swapMin);
}
function drawSnap(){
 const t=Math.min(R.T-1,tNow),N=R.N,S=R.S;
 $('clock').textContent=hhmm(t);
 const nm=['Standby','Jalan','Antri','Swap'];
 $('trucks').innerHTML=Array.from({length:N},(_,i)=>{const st=R.tState[t*N+i],soc=R.tSoc[t*N+i];return `<div class="tk s${st}${soc<R.P.socMin+R.socPerPP*0.5?' low':''}" title="Truk ${i+1}: ${nm[st]}${st>=2?' di station '+(R.tSt[t*N+i]+1):''}"><span>T${i+1}</span><b>${f0(soc)}%</b></div>`}).join('');
 let h='<table><tr><th>Station</th><th>Antri</th><th>Baterai siap</th><th>Charging</th><th>Est. tunggu</th></tr>';
 const ew=[];
 for(let k=0;k<S;k++){const e=estWaitAt(k,t);ew.push(e);h+=`<tr><td>Station ${k+1}</td><td>${R.qLen[t*S+k]}</td><td>${R.rdy[t*S+k]}</td><td>${R.chg[t*S+k]}</td><td>${e} mnt</td></tr>`}
 $('stTable').innerHTML=h+'</table>';
 // saran
 const best=ew.indexOf(Math.min(...ew));
 const w=R.waitByHour,hrs=w.map((v,i)=>[v,i]).filter(a=>R.waitByHourN[a[1]]>0).sort((a,b)=>a[0]-b[0]);
 const low=hrs.slice(0,3).map(a=>String(a[1]).padStart(2,'0')+':00'),hi=hrs.slice(-3).reverse().map(a=>String(a[1]).padStart(2,'0')+':00');
 const L=[];
 L.push(`Jika truk tiba pukul ${hhmm(t)}, station terbaik: <b>Station ${best+1}</b> (perkiraan tunggu ${ew[best]} mnt).`);
 const free=[];for(let k=0;k<S;k++)if(R.rdy[t*S+k]>0&&R.qLen[t*S+k]===0)free.push(k+1);
 L.push(free.length?`Baterai siap tanpa antrean di station ${free.join(', ')}: aman masuk sekarang.`:'Tidak ada station dengan baterai siap tanpa antrean pada jam ini.');
 if(hrs.length){L.push(`Jam tiba paling lancar: ${low.join(', ')}.`);L.push(`Jam tiba paling padat: ${hi.join(', ')}.`)}
 $('hint').innerHTML=L.map(x=>`<li>${x}</li>`).join('');
}
function drawSweep(){
 let h='<table><tr><th>Station</th><th>Swap/hari</th><th>Tunggu rata-rata</th><th>Tunggu maks</th><th>Utilisasi charger</th><th>Efisiensi armada</th><th>Status</th></tr>';
 for(let s=1;s<=8;s++){
  const r=s===P.nSt?R:simulateUI(Object.assign({},P,{nSt:s})),k=r.kpi,v=verdict(k);
  h+=`<tr class="${s===P.nSt?'cur':''}"><td>${s} station</td><td>${f0(k.swaps)}</td><td>${f1(k.avgWait)} mnt</td><td>${f0(k.maxWait)} mnt</td><td>${f0(k.utilCharger*100)}%</td><td>${f0(k.eff*100)}%</td><td><span class="pill" style="background:${COL[v[0]]}">${v[1]}</span></td></tr>`;
 }
 $('sweep').innerHTML=h+'</table>';
}
function drawStSel(){
 $('stsel').innerHTML=Array.from({length:R.S},(_,k)=>`<button class="${k===gSt?'on':''}" data-k="${k}">Station ${k+1}</button>`).join('');
 $('stsel').querySelectorAll('button').forEach(b=>b.onclick=()=>{gSt=+b.dataset.k;drawStSel();drawGantt()});
}
function run(){
 R=simulateUI(P);if(gSt>=R.S)gSt=0;
 $('vTruk').textContent=P.nTruk;$('vSt').textContent=P.nSt;$('vSlots').textContent=P.slots;$('vSoc').textContent=P.socMin+'%';$('vJit').textContent=P.jitter+'%';
 const ru=route(P),socPP=ru.kwhPP/P.capKwh*100,usable=100-P.socMin;
 $('ruteInfo').innerHTML=`Sekali PP ${f1(ru.ppKm)} km · ${f1(ru.ppMin)} mnt · ${f1(ru.kwhPP)} kWh (${f1(socPP)}% SOC). Swap tiap ${R.ppPerSwap} PP.`+
  (socPP>usable?`<br><b style="color:var(--bad)">Baterai tidak cukup untuk 1 PP di atas SOC minimum. Perbesar baterai atau perpendek jarak.</b>`:'');
 drawKpi();drawStSel();drawCharts();drawSnap();drawSweep();
}
function bind(){
 const num=['nTruk','nSt','slots','socMin','swapMin','chargeMin','jarakKm','speedKmh','kwhKm','capKwh','earlySoc','seed'];
 num.forEach(id=>{$(id).value=P[id];$(id).oninput=e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0){P[id]=v;run()}}});
 $('jitter').value=P.jitter;$('jitter').oninput=e=>{P.jitter=+e.target.value;run()};
 ['slotMode','startMode','strategy'].forEach(id=>{$(id).value=P[id];$(id).onchange=e=>{P[id]=e.target.value;run()}});
 $('propCharge').value=P.propCharge;$('propCharge').onchange=e=>{P.propCharge=e.target.value==='1';run()};
 $('scrub').oninput=e=>{tNow=+e.target.value;drawCharts();drawSnap()};
 $('presets').innerHTML=PRESETS.map((p,i)=>`<button data-i="${i}">${p[0]}</button>`).join('');
 $('presets').querySelectorAll('button').forEach(b=>b.onclick=()=>{Object.assign(P,D,PRESETS[+b.dataset.i][1]);sync();run()});
}
function sync(){['nTruk','nSt','slots','socMin','swapMin','chargeMin','jarakKm','speedKmh','kwhKm','capKwh','earlySoc','seed','jitter','slotMode','startMode','strategy'].forEach(id=>$(id).value=P[id]);$('propCharge').value=P.propCharge?'1':'0'}
P.jitter=D.jitter;
bind();run();
