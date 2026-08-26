/* ---------- almacenamiento (localStorage como cache + Supabase para sync entre dispositivos) ---------- */
const mem={};
const store={
  async get(k){
    try{ const r=localStorage.getItem('org:'+k); if(r!==null) return JSON.parse(r); }catch(e){}
    return (k in mem)?mem[k]:null;
  },
  async set(k,v){ mem[k]=v; try{ localStorage.setItem('org:'+k,JSON.stringify(v)); }catch(e){} flashSaved(); schedulePush(); }
};

/* ---------- Supabase (sync entre dispositivos) ---------- */
const SUPABASE_URL='https://butkdtyyekaqjwxlsrfu.supabase.co';
const SUPABASE_KEY='sb_publishable_J8jK_Vwy7qcFANilxbzFhg_yB1jQwax';
let sb=null, sbUser=null, booted=false, loginShown=false;
let _readyResolve; const ready=new Promise(r=>_readyResolve=r);

// baja el estado de la nube y lo vuelca a mem + localStorage
async function pullCloud(){
  try{
    const {data,error}=await sb.from('estado').select('data').eq('user_id',sbUser.id).maybeSingle();
    if(error){console.warn('pullCloud',error);return;}
    if(data && data.data && Object.keys(data.data).length){
      const obj=data.data;
      for(const k in obj){ mem[k]=obj[k]; try{localStorage.setItem('org:'+k,JSON.stringify(obj[k]));}catch(e){} }
    }else{
      await pushCloud(); // primera vez: subo lo que ya tengo local
    }
  }catch(e){console.warn('pullCloud',e);}
}

// sube TODO el estado (una fila por usuario) a la nube
async function pushCloud(){
  if(!sb||!sbUser) return;
  const obj={};
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && key.indexOf('org:')===0){ try{obj[key.slice(4)]=JSON.parse(localStorage.getItem(key));}catch(e){} }
    }
    const {error}=await sb.from('estado').upsert({user_id:sbUser.id,data:obj,updated_at:new Date().toISOString()});
    if(error) console.warn('pushCloud',error);
  }catch(e){console.warn('pushCloud',e);}
}

let _pushT;
function schedulePush(){ if(!sb||!sbUser) return; clearTimeout(_pushT); _pushT=setTimeout(pushCloud,800); }

// aísla la cache local por usuario: si cambió el usuario en este navegador, borra la cache del anterior
function scopeStorage(uid){
  try{
    const prev=localStorage.getItem('org_uid');
    if(prev===null){ localStorage.setItem('org_uid',uid); return; } // 1ra vez con esta versión: la cache es de este usuario, se conserva
    if(prev!==uid){
      // cambió el usuario en este navegador: limpiar la cache del anterior
      for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.indexOf('org:')===0)localStorage.removeItem(k);}
      for(const k in mem) delete mem[k];
      localStorage.setItem('org_uid',uid);
    }
  }catch(e){}
}

async function afterAuth(){
  hideLogin();
  scopeStorage(sbUser.id);
  await pullCloud();
  _readyResolve();
  bootApp();
}

async function initSupabase(){
  try{
    const mod=await import('https://esm.sh/@supabase/supabase-js@2');
    sb=mod.createClient(SUPABASE_URL,SUPABASE_KEY);
    sb.auth.onAuthStateChange(async (event,session)=>{
      if(session){ sbUser=session.user; await afterAuth(); }
      else if(event==='INITIAL_SESSION'){ showLogin(); }
    });
  }catch(e){
    console.warn('Supabase no disponible, modo local:',e);
    _readyResolve(); bootApp(); // sin red: arranca solo con localStorage
  }
  // red de seguridad: si en 6s no arrancó ni pidió login, arranco local
  setTimeout(()=>{ if(!booted && !loginShown){ _readyResolve(); bootApp(); } },6000);
}

/* ---------- pantalla de login (magic link por email) ---------- */
function showLogin(){
  if(loginShown||booted) return; loginShown=true;
  const o=document.createElement('div'); o.id='loginOverlay';
  o.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);padding:20px;';
  o.innerHTML='<div style="background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;color:#eee;font-family:inherit;">'+
    '<h2 style="margin:0 0 6px;font-size:19px;">Tu organizador</h2>'+
    '<p style="margin:0 0 18px;font-size:13px;color:#9a9a9a;line-height:1.5;">Ingresá con tu email para sincronizar entre tus dispositivos. Te llega un link, sin contraseña.</p>'+
    '<input id="loginEmail" type="email" inputmode="email" autocomplete="email" placeholder="tu@email.com" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid #333;background:#0e0e0e;color:#eee;font-size:15px;margin-bottom:10px;">'+
    '<button id="loginBtn" style="width:100%;padding:11px;border-radius:10px;border:0;background:#e6e6e6;color:#111;font-size:15px;font-weight:600;cursor:pointer;">Enviarme el link</button>'+
    '<div id="loginMsg" style="margin-top:12px;font-size:12.5px;color:#9a9a9a;min-height:16px;line-height:1.4;"></div>'+
    '</div>';
  document.body.appendChild(o);
  const email=o.querySelector('#loginEmail'), btn=o.querySelector('#loginBtn'), msg=o.querySelector('#loginMsg');
  async function send(){
    const v=(email.value||'').trim();
    if(!/.+@.+\..+/.test(v)){ msg.textContent='Poné un email válido.'; return; }
    btn.disabled=true; msg.style.color='#9a9a9a'; msg.textContent='Enviando…';
    try{
      const {error}=await sb.auth.signInWithOtp({email:v,options:{emailRedirectTo:location.origin+location.pathname}});
      if(error){ msg.style.color='#e88'; msg.textContent='Error: '+error.message; btn.disabled=false; }
      else{ msg.style.color='#8ec99a'; msg.textContent='Listo. Revisá tu mail y abrí el link desde este dispositivo.'; }
    }catch(e){ msg.style.color='#e88'; msg.textContent='Error de conexión.'; btn.disabled=false; }
  }
  btn.addEventListener('click',send);
  email.addEventListener('keydown',e=>{if(e.key==='Enter')send();});
  email.focus();
}
function hideLogin(){ loginShown=false; const o=document.getElementById('loginOverlay'); if(o) o.remove(); }
async function logout(){ try{ await sb.auth.signOut(); }catch(e){} location.reload(); }
let saveTimer;
function flashSaved(){const n=document.getElementById('savenote');n.classList.add('show');clearTimeout(saveTimer);saveTimer=setTimeout(()=>n.classList.remove('show'),1200);}
let _idc=0; function genId(){return 'x'+Date.now().toString(36)+(_idc++).toString(36)+Math.random().toString(36).slice(2,5);}

/* ---------- fecha ---------- */
const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const now=new Date();
const dow=now.getDay();
function dkey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const TODAY=dkey(now);
const hr=now.getHours();
const _hello=document.getElementById('hello');
const _greet=(hr<6?'Buenas noches':hr<13?'Buen día':hr<20?'Buenas tardes':'Buenas noches');
_hello.firstChild.nodeValue=_greet+' ';
document.getElementById('datebar').textContent=DIAS[dow]+' '+now.getDate()+' '+MESES[now.getMonth()];

/* ---------- nombre de usuario (editable, se guarda en el navegador) ---------- */
const _uname=document.getElementById('uname');
(async()=>{await ready;const n=await store.get('username');if(n)_uname.textContent=n;})();
function _saveName(){const v=(_uname.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);store.set('username',v);}
let _uT;_uname.addEventListener('input',()=>{clearTimeout(_uT);_uT=setTimeout(_saveName,300);});
_uname.addEventListener('blur',()=>{const v=(_uname.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);_uname.textContent=v;_saveName();});
_uname.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();_uname.blur();}});
_uname.addEventListener('paste',e=>{e.preventDefault();const t=(e.clipboardData||window.clipboardData).getData('text').replace(/\s+/g,' ').trim();document.execCommand('insertText',false,t);});
document.getElementById('estudiodate').textContent=DIAS[dow]+' '+now.getDate()+' '+MESES[now.getMonth()];

// minutos con medianoche al final del día (00:00 y 00:30 cuentan como fin, no inicio)
function mins(t){const [h,m]=t.split(':').map(Number);return (h<5?h+24:h)*60+m;}

/* ---------- horario por defecto (se guarda una vez, después es editable) ---------- */
let notes={}; // notas por día — se cargan por usuario desde la BD (vacío por defecto)
const KLABEL={cursada:'Facultad',gym:'Gym',estudio:'Estudio',laburo:'Laburo',boot:'boot.dev',typing:'Mecanografía',rutina:'Rutina',libre:'Libre',dormir:'Descanso'};
const RAW={0:[],1:[],2:[],3:[],4:[],5:[],6:[]}; // horario vacío por defecto: cada usuario arma el suyo
function buildDefault(){const o={};for(const d in RAW){o[d]=RAW[d].map(b=>({id:genId(),time:b[0],label:b[1],kind:b[2]}));}return o;}

/* rutina de gym precargada (editable después) */
const GYM_RAW=[]; // rutina vacía por defecto
function buildGym(){return {days:GYM_RAW.map(d=>({id:genId(),name:d[0],exs:d[1].map(e=>({id:genId(),name:e[0],sets:e[1]}))}))};}

/* ---------- estado ---------- */
let schedule={}, todayChecks={}, est=[], pend=[], gym={days:[]};
function sortDay(d){schedule[d].sort((a,b)=>mins(a.time)-mins(b.time));}
function checkSVG(){return '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';}
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ---------- Hoy ---------- */
function currentIdx(list){const n=(hr<5?hr+24:hr)*60+now.getMinutes();let idx=-1;list.forEach((b,i)=>{if(mins(b.time)<=n)idx=i;});return idx;}
async function renderHoy(){
  todayChecks=(await store.get('checks:'+TODAY))||{};
  const list=schedule[dow]||[];
  document.getElementById('todayname').textContent=DIAS[dow];
  document.getElementById('todaytag').textContent=notes[dow]||'';
  const nowIdx=currentIdx(list);
  const rail=document.getElementById('rail');rail.innerHTML='';
  list.forEach((b,i)=>{
    const done=!!todayChecks[b.id];
    const el=document.createElement('div');
    el.className='block'+(done?' done':'')+(i===nowIdx?' now':'')+(b.kind==='cursada'?' fixed':'');
    el.innerHTML='<div class="time">'+b.time+'</div><div class="body">'+checkSVG()+
      '<div class="ttl"><div class="label">'+esc(b.label)+'<span class="nowtag">ahora</span></div><div class="kind k-'+b.kind+'">'+(KLABEL[b.kind]||'')+'</div></div>'+
      '<button class="del" title="Borrar" aria-label="Borrar">×</button></div>';
    el.querySelector('.check').addEventListener('click',()=>{todayChecks[b.id]=!todayChecks[b.id];store.set('checks:'+TODAY,todayChecks);el.classList.toggle('done',todayChecks[b.id]);updateRing();});
    el.querySelector('.del').addEventListener('click',()=>{schedule[dow]=schedule[dow].filter(x=>x.id!==b.id);store.set('schedule',schedule);renderHoy();renderSemana();});
    rail.appendChild(el);
  });
  updateRing();
}
function updateRing(){
  const list=schedule[dow]||[];const total=list.length;
  const done=list.filter(b=>todayChecks[b.id]).length;
  document.getElementById('ringnum').textContent=done+'/'+total;
  const c=131.9;document.querySelector('.ring .prog').style.strokeDashoffset=total?c-(done/total)*c:c;
}
// add form
const addform=document.getElementById('addform');
document.getElementById('addtoggle').addEventListener('click',()=>{addform.hidden=!addform.hidden;if(!addform.hidden)document.getElementById('nlabel').focus();});
document.getElementById('addhint').textContent='Queda fija todos los '+DIAS[dow].toLowerCase()+'.';
document.getElementById('ncancel').addEventListener('click',()=>{addform.hidden=true;});
document.getElementById('nsave').addEventListener('click',()=>{
  const t=document.getElementById('ntime').value, l=document.getElementById('nlabel').value.trim(), k=document.getElementById('nkind').value;
  if(!t||!l)return;
  schedule[dow].push({id:genId(),time:t,label:l,kind:k});sortDay(dow);store.set('schedule',schedule);
  document.getElementById('nlabel').value='';addform.hidden=true;renderHoy();renderSemana();
});
document.getElementById('nlabel').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('nsave').click();});

/* ---------- Semana ---------- */
function renderSemana(){
  const g=document.getElementById('weekgrid');g.innerHTML='';
  [1,2,3,4,5,6,0].forEach(d=>{
    const card=document.createElement('div');card.className='daycard'+(d===dow?' today':'');
    const rows=(schedule[d]||[]).filter(b=>b.kind!=='rutina'&&b.kind!=='dormir')
      .map(b=>'<div class="wrow '+(b.kind==='cursada'?'cursada':'')+'"><span class="t">'+b.time+'</span><span class="l">'+esc(b.label)+'</span></div>').join('');
    card.innerHTML='<h3>'+DIAS[d]+(d===dow?'<span class="badge">hoy</span>':'')+'</h3><div class="sub">'+(notes[d]||'')+'</div>'+(rows||'<div class="wrow"><span class="l" style="color:var(--muted-dim)">—</span></div>');
    card.addEventListener('click',()=>openDay(d));
    g.appendChild(card);
  });
}
let selectedDay=dow;
function openDay(d){
  selectedDay=d;
  document.getElementById('weekgrid').hidden=true;
  document.getElementById('daydetail').hidden=false;
  document.getElementById('daddform').hidden=true;
  renderDayDetail();
  window.scrollTo({top:0,behavior:'smooth'});
}
function closeDay(){
  document.getElementById('daydetail').hidden=true;
  document.getElementById('weekgrid').hidden=false;
  renderSemana();
}
function renderDayDetail(){
  const d=selectedDay, list=schedule[d]||[], isToday=(d===dow);
  document.getElementById('dname').innerHTML=DIAS[d]+(isToday?' <span class="badge">hoy</span>':'');
  document.getElementById('dnote').textContent=notes[d]||'';
  document.getElementById('daddhint').textContent='Queda fija todos los '+DIAS[d].toLowerCase()+'.';
  const nowIdx=isToday?currentIdx(list):-1;
  const rail=document.getElementById('drail');rail.innerHTML='';
  list.forEach((b,i)=>{
    const done=isToday&&!!todayChecks[b.id];
    const el=document.createElement('div');
    el.className='block'+(done?' done':'')+(i===nowIdx?' now':'')+(b.kind==='cursada'?' fixed':'');
    el.innerHTML='<div class="time">'+b.time+'</div><div class="body">'+(isToday?checkSVG():'')+
      '<div class="ttl"><div class="label">'+esc(b.label)+(i===nowIdx?'<span class="nowtag">ahora</span>':'')+'</div><div class="kind k-'+b.kind+'">'+(KLABEL[b.kind]||'')+'</div></div>'+
      '<button class="del" aria-label="Borrar">×</button></div>';
    if(isToday){el.querySelector('.check').addEventListener('click',()=>{todayChecks[b.id]=!todayChecks[b.id];store.set('checks:'+TODAY,todayChecks);el.classList.toggle('done',todayChecks[b.id]);updateRing();});}
    el.querySelector('.del').addEventListener('click',()=>{schedule[d]=schedule[d].filter(x=>x.id!==b.id);store.set('schedule',schedule);renderDayDetail();renderHoy();});
    rail.appendChild(el);
  });
}
document.getElementById('dback').addEventListener('click',closeDay);
const daddform=document.getElementById('daddform');
document.getElementById('daddtoggle').addEventListener('click',()=>{daddform.hidden=!daddform.hidden;if(!daddform.hidden)document.getElementById('dlabel').focus();});
document.getElementById('dcancel').addEventListener('click',()=>{daddform.hidden=true;});
document.getElementById('dsave').addEventListener('click',()=>{
  const t=document.getElementById('dtime').value,l=document.getElementById('dlabel').value.trim(),k=document.getElementById('dkind').value;
  if(!t||!l)return;
  schedule[selectedDay].push({id:genId(),time:t,label:l,kind:k});sortDay(selectedDay);store.set('schedule',schedule);
  document.getElementById('dlabel').value='';daddform.hidden=true;renderDayDetail();renderHoy();
});
document.getElementById('dlabel').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('dsave').click();});

/* ---------- Estudio (por día, elige de pendientes) ---------- */
async function loadEst(){est=(await store.get('estudio:'+TODAY))||[];renderEst();}
function renderEst(){
  const ul=document.getElementById('estlist');ul.innerHTML='';
  if(!est.length){ul.innerHTML='<div class="empty">Sin nada elegido para hoy. Sumá de tus pendientes o agregá algo puntual.</div>';}
  else est.forEach(p=>{
    const li=document.createElement('li');if(p.done)li.classList.add('done');
    li.innerHTML=checkSVG()+'<span class="ptext">'+esc(p.text)+'</span><button class="del" aria-label="Borrar">×</button>';
    li.querySelector('.check').addEventListener('click',()=>{
      p.done=!p.done;
      if(p.pid){const pp=pend.find(x=>x.id===p.pid);if(pp){pp.done=p.done;store.set('pendientes',pend);renderPend();}}
      store.set('estudio:'+TODAY,est);renderEst();
    });
    li.querySelector('.del').addEventListener('click',()=>{est=est.filter(x=>x.id!==p.id);store.set('estudio:'+TODAY,est);renderEst();});
    ul.appendChild(li);
  });
  renderPool();
}
function renderPool(){
  const w=document.getElementById('estpool');if(!w)return;w.innerHTML='';
  const chosen=new Set(est.filter(e=>e.pid).map(e=>e.pid));
  const pool=pend.filter(p=>p.cat==='facu'&&!p.done&&!chosen.has(p.id));
  if(!pool.length){w.innerHTML='<div class="poolempty">No hay pendientes de facultad sin elegir. Cargá algunos en la pestaña Pendientes.</div>';return;}
  pool.forEach(p=>{
    const row=document.createElement('div');row.className='poolrow';
    row.innerHTML='<span>'+esc(p.text)+'</span><button class="poolbtn">+ Hoy</button>';
    row.querySelector('.poolbtn').addEventListener('click',()=>{est.unshift({id:genId(),text:p.text,done:false,pid:p.id});store.set('estudio:'+TODAY,est);renderEst();});
    w.appendChild(row);
  });
}
function addEst(){const i=document.getElementById('estinput');const t=i.value.trim();if(!t)return;est.unshift({id:genId(),text:t,done:false,pid:null});i.value='';store.set('estudio:'+TODAY,est);renderEst();}
document.getElementById('estadd').addEventListener('click',addEst);
document.getElementById('estinput').addEventListener('keydown',e=>{if(e.key==='Enter')addEst();});

/* ---------- Gym (rutina editable) ---------- */
let gymT;function saveGym(){clearTimeout(gymT);gymT=setTimeout(()=>store.set('gym',gym),350);}
function renderGym(){
  const w=document.getElementById('gymwrap');w.innerHTML='';
  if(!gym.days.length){w.innerHTML='<div class="empty">Todavía no cargaste tu rutina. Tocá “+ Día” para empezar, o pedile a Claude que te la precargue.</div>';return;}
  gym.days.forEach(day=>{
    const card=document.createElement('div');card.className='gymday';
    const top=document.createElement('div');top.className='dtop';
    const nm=document.createElement('input');nm.type='text';nm.value=day.name;nm.placeholder='Día 1 · Nombre';
    nm.addEventListener('input',()=>{day.name=nm.value;saveGym();});
    const dd=document.createElement('button');dd.className='del';dd.title='Borrar día';dd.textContent='×';
    dd.addEventListener('click',()=>{gym.days=gym.days.filter(x=>x.id!==day.id);store.set('gym',gym);renderGym();});
    top.appendChild(nm);top.appendChild(dd);card.appendChild(top);
    day.exs.forEach(ex=>{
      const row=document.createElement('div');row.className='exrow';
      const en=document.createElement('input');en.type='text';en.className='ex-name';en.value=ex.name;en.placeholder='Ejercicio';
      en.addEventListener('input',()=>{ex.name=en.value;saveGym();});
      const es=document.createElement('input');es.type='text';es.className='ex-sets';es.value=ex.sets;es.placeholder='4×10';
      es.addEventListener('input',()=>{ex.sets=es.value;saveGym();});
      const ed=document.createElement('button');ed.className='del';ed.title='Borrar';ed.textContent='×';
      ed.addEventListener('click',()=>{day.exs=day.exs.filter(x=>x.id!==ex.id);store.set('gym',gym);renderGym();});
      row.appendChild(en);row.appendChild(es);row.appendChild(ed);card.appendChild(row);
    });
    const ae=document.createElement('button');ae.className='addex';ae.textContent='+ Ejercicio';
    ae.addEventListener('click',()=>{day.exs.push({id:genId(),name:'',sets:''});store.set('gym',gym);renderGym();});
    card.appendChild(ae);w.appendChild(card);
  });
}
document.getElementById('addday').addEventListener('click',()=>{gym.days.push({id:genId(),name:'Día '+(gym.days.length+1),exs:[]});store.set('gym',gym);renderGym();});

/* ---------- Pendientes (facultad / otras) ---------- */
let pendCat='facu';
document.querySelectorAll('#pendcat button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#pendcat button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');pendCat=b.dataset.c;
}));
async function loadPend(){pend=(await store.get('pendientes'))||[];pend.forEach(p=>{if(!p.cat)p.cat='facu';});renderPend();}
function pendItem(p){
  const li=document.createElement('li');if(p.done)li.classList.add('done');
  li.innerHTML=checkSVG()+'<span class="ptext">'+esc(p.text)+'</span><button class="del" aria-label="Borrar">×</button>';
  li.querySelector('.check').addEventListener('click',()=>{p.done=!p.done;store.set('pendientes',pend);renderPend();renderEst();});
  li.querySelector('.del').addEventListener('click',()=>{pend=pend.filter(x=>x.id!==p.id);store.set('pendientes',pend);renderPend();renderEst();});
  return li;
}
function renderPend(){
  const w=document.getElementById('pendlist');w.innerHTML='';
  if(!pend.length){w.innerHTML='<div class="empty">Todavía no cargaste nada. Empezá por lo que más te pesa.</div>';renderPool();return;}
  [['facu','Facultad'],['otro','Otras cosas']].forEach(([c,title])=>{
    const items=pend.filter(p=>p.cat===c);if(!items.length)return;
    const grp=document.createElement('div');grp.className='pend-group';
    grp.innerHTML='<h4>'+title+'</h4>';
    const ul=document.createElement('ul');ul.className='list';
    items.forEach(p=>ul.appendChild(pendItem(p)));
    grp.appendChild(ul);w.appendChild(grp);
  });
  renderPool();
}
function addPend(){const i=document.getElementById('pendinput');const t=i.value.trim();if(!t)return;pend.unshift({id:genId(),text:t,done:false,cat:pendCat});i.value='';store.set('pendientes',pend);renderPend();}
document.getElementById('pendadd').addEventListener('click',addPend);
document.getElementById('pendinput').addEventListener('keydown',e=>{if(e.key==='Enter')addPend();});

/* ---------- Videos (mirar después) ---------- */
let videos=[];
function ytId(u){const m=u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);if(m)return m[1];const b=u.trim().match(/^[A-Za-z0-9_-]{11}$/);return b?b[0]:null;}
function thumbNext(img){try{let i=+img.dataset.i+1;const urls=JSON.parse(img.dataset.urls);if(i<urls.length){img.dataset.i=i;img.src=urls[i];}else{img.style.display='none';}}catch(e){img.style.display='none';}}
async function fetchTitle(url){
  // 1) noembed: manda cabeceras CORS y NO es de Google (anda incluso si la red bloquea a Google)
  try{const r=await fetch('https://noembed.com/embed?url='+encodeURIComponent(url));if(r.ok){const j=await r.json();if(j&&j.title)return j.title;}}catch(e){}
  // 2) respaldo: oembed oficial de YouTube a través de un proxy CORS que lo busca del lado del servidor
  try{
    const o='https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(url);
    const r=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent(o));
    if(r.ok){const j=await r.json();if(j&&j.contents){try{const d=JSON.parse(j.contents);if(d&&d.title)return d.title;}catch(e){}}}
  }catch(e){}
  return '';
}
async function loadVideos(){videos=(await store.get('videos'))||[];renderVideos();}
function renderVideos(){
  const w=document.getElementById('vidlist');w.innerHTML='';
  if(!videos.length){w.innerHTML='<div class="empty">Sin videos guardados. Pegá un link de YouTube arriba.</div>';return;}
  videos.forEach(v=>{
    const isPend=!!(v.pid&&pend.some(p=>p.id===v.pid));if(v.pid&&!isPend)v.pid=null;
    const turls=['https://i.ytimg.com/vi/'+v.vid+'/hqdefault.jpg','https://img.youtube.com/vi/'+v.vid+'/hqdefault.jpg','https://i.ytimg.com/vi/'+v.vid+'/mqdefault.jpg'];
    const card=document.createElement('div');card.className='vidcard'+(v.watched?' watched':'');
    card.innerHTML=
      '<a class="vidthumb" href="'+v.url+'" target="_blank" rel="noopener"><img src="'+turls[0]+'" data-urls=\''+JSON.stringify(turls)+'\' data-i="0" alt="" onerror="thumbNext(this)"><span class="vidplay">▶</span></a>'+
      '<div class="vidbody">'+
        '<input class="vidtitle" value="'+esc(v.title||'')+'" placeholder="Título del video">'+
        '<div class="vidactions">'+
          '<button class="chip vwatch'+(v.watched?' on':'')+'">'+(v.watched?'Visto':'Marcar visto')+'</button>'+
          '<button class="chip vpend'+(isPend?' on':' acc')+'">'+(isPend?'En pendientes':'+ Pendiente')+'</button>'+
          '<button class="chip vdel">Borrar</button>'+
        '</div>'+
      '</div>';
    card.querySelector('.vidtitle').addEventListener('change',e=>{v.title=e.target.value;store.set('videos',videos);});
    card.querySelector('.vwatch').addEventListener('click',()=>{v.watched=!v.watched;store.set('videos',videos);renderVideos();});
    card.querySelector('.vpend').addEventListener('click',()=>{
      if(v.pid){pend=pend.filter(p=>p.id!==v.pid);v.pid=null;}
      else{const p={id:genId(),text:'Ver: '+(v.title||v.url),done:false,cat:'otro'};pend.unshift(p);v.pid=p.id;}
      store.set('pendientes',pend);store.set('videos',videos);renderVideos();renderPend();
    });
    card.querySelector('.vdel').addEventListener('click',()=>{
      if(v.pid){pend=pend.filter(p=>p.id!==v.pid);store.set('pendientes',pend);renderPend();}
      videos=videos.filter(x=>x.id!==v.id);store.set('videos',videos);renderVideos();
    });
    w.appendChild(card);
  });
}
function addVideo(){
  const i=document.getElementById('vidinput');const u=i.value.trim();if(!u)return;
  const id=ytId(u);
  if(!id){const ph=i.placeholder;i.value='';i.placeholder='Ese link no parece de YouTube…';setTimeout(()=>{i.placeholder=ph;},2200);return;}
  const url='https://www.youtube.com/watch?v='+id;
  const item={id:genId(),url,vid:id,title:'',watched:false,pid:null};
  videos.unshift(item);i.value='';store.set('videos',videos);renderVideos();
  fetchTitle(url).then(t=>{if(t){item.title=t;store.set('videos',videos);renderVideos();}});
}
document.getElementById('vidadd').addEventListener('click',addVideo);
document.getElementById('vidinput').addEventListener('keydown',e=>{if(e.key==='Enter')addVideo();});

/* ---------- tabs ---------- */
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected','false'));
    btn.setAttribute('aria-selected','true');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
    document.getElementById('panel-'+btn.dataset.tab).classList.add('on');
    if(btn.dataset.tab==='semana'){document.getElementById('daydetail').hidden=true;document.getElementById('weekgrid').hidden=false;renderSemana();}
  });
});

/* ---------- notas de día editables (por usuario) ---------- */
function wireNote(el,dayFn){
  if(!el||el._wired) return; el._wired=true;
  el.setAttribute('contenteditable','true'); el.spellcheck=false; el.dataset.ph='+ nota del día';
  let t;
  el.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{notes[dayFn()]=el.textContent.replace(/\s+/g,' ').trim();store.set('notes',notes);},400);});
  el.addEventListener('blur',()=>{const v=el.textContent.replace(/\s+/g,' ').trim();el.textContent=v;notes[dayFn()]=v;store.set('notes',notes);});
  el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}});
}

/* ---------- init ---------- */
async function bootApp(){
  if(booted) return; booted=true;
  schedule=await store.get('schedule');
  if(!schedule){schedule=buildDefault();await store.set('schedule',schedule);}
  gym=await store.get('gym'); if(!gym||!gym.days||!gym.days.length){gym=buildGym();await store.set('gym',gym);}
  notes=(await store.get('notes'))||{};
  await renderHoy();renderSemana();await loadEst();renderGym();await loadPend();await loadVideos();
  wireNote(document.getElementById('todaytag'),()=>dow);
  wireNote(document.getElementById('dnote'),()=>selectedDay);
  // link discreto para cerrar sesión (útil en dispositivos compartidos)
  if(sb&&sbUser){
    const f=document.querySelector('footer');
    if(f && !document.getElementById('logoutLink')){
      const a=document.createElement('a'); a.id='logoutLink'; a.textContent=' · salir';
      a.href='#'; a.style.cssText='color:inherit;opacity:.55;text-decoration:none;cursor:pointer;';
      a.addEventListener('click',e=>{e.preventDefault();logout();});
      f.appendChild(a);
    }
  }
}
initSupabase();
