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
const DEMO_EMAIL='demo@organizador.app'; // si tu usuario demo tiene otro email, cambialo acá y en reset_demo()
let isDemo=false;
let _readyResolve; const ready=new Promise(r=>_readyResolve=r);

// baja el estado de la nube y lo vuelca a mem + localStorage
async function pullCloud(fresh){
  try{
    if(fresh) clearLocalCache(); // cuenta distinta/demo: descarto cualquier cache ajena ANTES de traer la nube
    const {data,error}=await sb.from('estado').select('data').eq('user_id',sbUser.id).maybeSingle();
    if(error){console.warn('pullCloud',error);return;}
    const obj=(data&&data.data)?data.data:{};
    if(Object.keys(obj).length){
      for(const k in obj){ mem[k]=obj[k]; try{localStorage.setItem('org:'+k,JSON.stringify(obj[k]));}catch(e){} }
    }else if(!fresh){
      await pushCloud(); // mismo usuario y nube vacía: primera sincronización, subo lo local
    }
    // fresh + nube vacía => cuenta nueva/demo sin datos: queda vacío. NUNCA se sube cache de otra cuenta.
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


async function afterAuth(){
  hideLogin();
  isDemo=((sbUser.email||'').toLowerCase()===DEMO_EMAIL);
  if(isDemo){ try{ await sb.rpc('reset_demo'); }catch(e){ console.warn('reset_demo',e); } } // demo: siempre arranca de la semilla
  // "fresh" = cambió de cuenta en este navegador (o es la demo): hay que descartar la cache local ajena
  const fresh = isDemo || (localStorage.getItem('org_uid')!==sbUser.id);
  await pullCloud(fresh);
  try{ localStorage.setItem('org_uid',sbUser.id); }catch(e){}
  _readyResolve();
  bootApp();
  if(isDemo) showDemoBanner();
}
// borra la cache local (claves org:) y el mem en memoria
function clearLocalCache(){
  try{ for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.indexOf('org:')===0)localStorage.removeItem(k);} }catch(e){}
  for(const k in mem) delete mem[k];
}
// barra fija para la cuenta demo, con botón para resetear sin salir
function showDemoBanner(){
  if(document.getElementById('demoBar')) return;
  document.body.classList.add('has-demobar');
  const bar=document.createElement('div'); bar.id='demoBar';
  bar.innerHTML='<span class="demoTxt">Cuenta demo · se resetea al volver a entrar</span>'+
    '<button id="demoReset" class="demoBtn">Resetear demo</button>';
  document.body.appendChild(bar);
  document.getElementById('demoReset').addEventListener('click',async()=>{
    const b=document.getElementById('demoReset'); b.disabled=true; b.textContent='Reseteando…';
    try{ await sb.rpc('reset_demo'); }catch(e){}
    clearLocalCache(); location.reload();
  });
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

/* ---------- pantalla de login/registro (email + contraseña) ---------- */
// dominios permitidos para registrarse (filtro liviano anti-randoms; ampliable)
const ALLOWED_DOMAINS=['gmail.com','googlemail.com','hotmail.com','hotmail.com.ar','outlook.com','outlook.com.ar','live.com','live.com.ar','yahoo.com','yahoo.com.ar','icloud.com','me.com','proton.me','protonmail.com'];
function emailDomainOk(email){ const d=(email.split('@')[1]||'').toLowerCase(); return ALLOWED_DOMAINS.indexOf(d)!==-1; }

function showLogin(){
  if(loginShown||booted) return; loginShown=true;
  let mode='login'; // 'login' | 'signup'
  const o=document.createElement('div'); o.id='loginOverlay';
  o.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);padding:20px;';
  const inpCss='width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:15px;margin-bottom:10px;font-family:inherit;';
  const cardCss='background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:28px 24px;max-width:340px;width:100%;color:var(--text);font-family:var(--body,inherit);box-shadow:0 20px 60px rgba(0,0,0,.4);display:flex;flex-direction:column;';
  o.innerHTML='<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:stretch;width:100%;max-width:720px;">'+
    // ----- tarjeta 1: login / registro -----
    '<div style="'+cardCss+'text-align:center;">'+
      '<h2 id="loginTitle" style="margin:0 0 6px;font-size:19px;font-family:var(--disp,inherit);">Tu organizador</h2>'+
      '<p id="loginSub" style="margin:0 0 18px;font-size:13px;color:var(--muted);line-height:1.5;">Entrá con tu email y contraseña para sincronizar entre tus dispositivos.</p>'+
      '<input id="loginEmail" type="email" inputmode="email" autocomplete="email" placeholder="tu@email.com" style="'+inpCss+'">'+
      '<input id="loginPass" type="password" autocomplete="current-password" placeholder="Contraseña" style="'+inpCss+'">'+
      '<input id="loginPass2" type="password" autocomplete="new-password" placeholder="Repetir contraseña" style="'+inpCss+'display:none;">'+
      '<button id="loginBtn" style="width:100%;padding:11px;border-radius:10px;border:0;background:var(--amber);color:var(--bg);font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">Entrar</button>'+
      '<div id="loginMsg" style="margin-top:12px;font-size:12.5px;color:var(--muted);min-height:16px;line-height:1.4;"></div>'+
      '<div style="margin-top:14px;font-size:12.5px;color:var(--muted);">'+
        '<span id="loginToggleTxt">¿No tenés cuenta?</span> '+
        '<a id="loginToggle" href="#" style="color:var(--amber);text-decoration:none;font-weight:600;">Crear cuenta</a>'+
      '</div>'+
    '</div>'+
    // ----- tarjeta 2: demo -----
    '<div style="'+cardCss+'">'+
      '<h2 style="margin:0 0 6px;font-size:19px;font-family:var(--disp,inherit);">Probar sin registrarte</h2>'+
      '<p style="margin:0 0 14px;font-size:13px;color:var(--muted);line-height:1.5;">Entrá a la cuenta demo y mirá la app llena de ejemplos: agenda, gym, videos, pendientes y links.</p>'+
      '<div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-family:var(--mono,monospace);font-size:13px;line-height:1.75;margin-bottom:14px;">'+
        '<div style="color:var(--muted)">email <span style="color:var(--text)">'+DEMO_EMAIL+'</span></div>'+
        '<div style="color:var(--muted)">clave <span style="color:var(--text)">123456789</span></div>'+
      '</div>'+
      '<p style="margin:0 0 16px;font-size:12.5px;color:var(--muted);line-height:1.55;">Podés tocar y editar todo. <b style="color:var(--text)">Se resetea sola</b> cada vez que alguien entra, así siempre arranca fresca.</p>'+
      '<button id="demoEnter" style="margin-top:auto;width:100%;padding:11px;border-radius:10px;border:1px solid var(--accent-line);background:transparent;color:var(--amber);font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">Entrar a la demo →</button>'+
    '</div>'+
  '</div>';
  document.body.appendChild(o);
  const email=o.querySelector('#loginEmail'), pass=o.querySelector('#loginPass'), pass2=o.querySelector('#loginPass2'),
        btn=o.querySelector('#loginBtn'), msg=o.querySelector('#loginMsg'),
        title=o.querySelector('#loginTitle'), sub=o.querySelector('#loginSub'),
        toggle=o.querySelector('#loginToggle'), toggleTxt=o.querySelector('#loginToggleTxt');

  function setMode(m){
    mode=m;
    if(m==='signup'){
      title.textContent='Crear cuenta';
      sub.textContent='Registrate con tu email y una contraseña. No hace falta confirmar por mail.';
      pass2.style.display=''; pass.setAttribute('autocomplete','new-password');
      btn.textContent='Crear cuenta';
      toggleTxt.textContent='¿Ya tenés cuenta?'; toggle.textContent='Entrar';
    }else{
      title.textContent='Tu organizador';
      sub.textContent='Entrá con tu email y contraseña para sincronizar entre tus dispositivos.';
      pass2.style.display='none'; pass.setAttribute('autocomplete','current-password');
      btn.textContent='Entrar';
      toggleTxt.textContent='¿No tenés cuenta?'; toggle.textContent='Crear cuenta';
    }
    msg.textContent='';
  }
  function err(t){ msg.style.color='var(--c-tag,#e06c75)'; msg.textContent=t; }
  function info(t){ msg.style.color='var(--muted)'; msg.textContent=t; }

  async function submit(){
    const em=(email.value||'').trim().toLowerCase(), pw=pass.value||'';
    if(!/.+@.+\..+/.test(em)){ err('Poné un email válido.'); return; }
    if(pw.length<6){ err('La contraseña tiene que tener al menos 6 caracteres.'); return; }
    btn.disabled=true;
    try{
      if(mode==='signup'){
        if(!emailDomainOk(em)){ err('Usá un email de Gmail, Hotmail, Yahoo, Outlook o iCloud.'); btn.disabled=false; return; }
        if(pw!==(pass2.value||'')){ err('Las contraseñas no coinciden.'); btn.disabled=false; return; }
        info('Creando cuenta…');
        const {error}=await sb.auth.signUp({email:em,password:pw});
        if(error){
          const m=/already registered|already exists/i.test(error.message)?'Ese email ya tiene cuenta. Entrá con tu contraseña.':'Error: '+error.message;
          err(m); btn.disabled=false; return;
        }
        // con confirmación desactivada, signUp deja sesión y dispara onAuthStateChange → afterAuth
      }else{
        info('Entrando…');
        const {error}=await sb.auth.signInWithPassword({email:em,password:pw});
        if(error){
          const m=/invalid login credentials/i.test(error.message)?'Email o contraseña incorrectos.':'Error: '+error.message;
          err(m); btn.disabled=false; return;
        }
      }
    }catch(e){ err('Error de conexión.'); btn.disabled=false; }
  }

  btn.addEventListener('click',submit);
  const demoBtn=o.querySelector('#demoEnter');
  if(demoBtn) demoBtn.addEventListener('click',()=>{ if(mode!=='login')setMode('login'); email.value=DEMO_EMAIL; pass.value='123456789'; submit(); });
  toggle.addEventListener('click',e=>{e.preventDefault(); setMode(mode==='login'?'signup':'login'); email.focus();});
  [email,pass,pass2].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter')submit();}));
  email.focus();
}
function hideLogin(){ loginShown=false; const o=document.getElementById('loginOverlay'); if(o) o.remove(); }
async function logout(){ try{ await sb.auth.signOut(); }catch(e){} location.reload(); }

/* ---------- temas ---------- */
const THEMES=[
  {id:'code',label:'Editor de código',sw:['#0a0f0c','#39d353','#61afef']},
  {id:'dracula',label:'Dracula',sw:['#282a36','#bd93f9','#50fa7b']},
  {id:'nord',label:'Nord',sw:['#2e3440','#88c0d0','#a3be8c']},
  {id:'gruvbox',label:'Gruvbox',sw:['#282828','#fabd2f','#b8bb26']},
  {id:'rose-pine',label:'Rosé Pine',sw:['#191724','#ebbcba','#9ccfd8']},
  {id:'solarized-light',label:'Solarized Light',sw:['#fdf6e3','#268bd2','#859900']},
  {id:'github-light',label:'GitHub Light',sw:['#ffffff','#0969da','#1a7f37']},
];
let curTheme='code';
function applyTheme(id,save){
  curTheme=id||'code';
  document.documentElement.setAttribute('data-theme',curTheme);
  if(save!==false) store.set('theme',curTheme);
  const menu=document.getElementById('themeMenu');
  if(menu) menu.querySelectorAll('.themeItem').forEach(b=>b.classList.toggle('on',b.dataset.t===curTheme));
}
function buildThemeMenu(){
  let menu=document.getElementById('themeMenu');
  if(menu) return menu;
  menu=document.createElement('div'); menu.id='themeMenu'; menu.hidden=true;
  menu.innerHTML='<div class="tmHead">Tema</div>'+THEMES.map(t=>
    '<button class="themeItem" data-t="'+t.id+'"><span class="tmSwatch">'+t.sw.map(c=>'<i style="background:'+c+'"></i>').join('')+'</span><span class="tmName">'+t.label+'</span><span class="tmCheck">✓</span></button>'
  ).join('');
  document.body.appendChild(menu);
  menu.querySelectorAll('.themeItem').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.t);closeThemeMenu();}));
  return menu;
}
function openThemeMenu(){
  const menu=buildThemeMenu();
  applyTheme(curTheme,false); // resalta el activo
  menu.hidden=false;
  const btn=document.getElementById('themeBtn'), r=btn.getBoundingClientRect(), w=menu.offsetWidth;
  menu.style.top=(r.bottom+8)+'px';
  menu.style.left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8))+'px';
  setTimeout(()=>document.addEventListener('click',outsideThemeClick),0);
}
function closeThemeMenu(){ const m=document.getElementById('themeMenu'); if(m)m.hidden=true; document.removeEventListener('click',outsideThemeClick); }
function outsideThemeClick(e){ const m=document.getElementById('themeMenu'), b=document.getElementById('themeBtn'); if(m&&!m.contains(e.target)&&e.target!==b) closeThemeMenu(); }
document.getElementById('themeBtn').addEventListener('click',e=>{ e.stopPropagation(); const m=document.getElementById('themeMenu'); if(m&&!m.hidden) closeThemeMenu(); else openThemeMenu(); });
document.getElementById('logoutBtn').addEventListener('click',()=>{ if(confirm('¿Cerrar sesión?')) logout(); });
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
// pasa minutos (en el espacio de mins(), puede venir corrido +24h) de nuevo a "HH:MM"
function minsToHM(x){x=((x%1440)+1440)%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');}
// días desde hoy hasta una fecha "YYYY-MM-DD" (negativo si ya pasó)
function diasHasta(dateStr){ if(!dateStr) return 9999; const [y,mo,da]=dateStr.split('-').map(Number); const d=new Date(y,mo-1,da); const t=new Date(now.getFullYear(),now.getMonth(),now.getDate()); return Math.round((d-t)/86400000); }
function fmtHoras(h){h=+h;const map={0.5:'½ h',1.5:'1½ h',2.5:'2½ h'};return map[h]||(h+' h');}
// fecha (dkey) que le toca a cada día de la semana dentro de los próximos 7 días
const dowToDk={};(function(){for(let off=0;off<7;off++){const dt=new Date(now.getFullYear(),now.getMonth(),now.getDate()+off);dowToDk[(dow+off)%7]=dkey(dt);}})();

/* ---------- horario por defecto (se guarda una vez, después es editable) ---------- */
let notes={}; // notas por día — se cargan por usuario desde la BD (vacío por defecto)
const KLABEL={cursada:'Facultad',cursar:'Cursada',estudio:'Estudio',gym:'Gym',laburo:'Laburo',boot:'boot.dev',typing:'Mecanografía',rutina:'Rutina',libre:'Libre',dormir:'Descanso'};
const RAW={0:[],1:[],2:[],3:[],4:[],5:[],6:[]}; // horario vacío por defecto: cada usuario arma el suyo
function buildDefault(){const o={};for(const d in RAW){o[d]=RAW[d].map(b=>({id:genId(),time:b[0],label:b[1],kind:b[2]}));}return o;}

/* rutina de gym precargada (editable después) */
const GYM_RAW=[]; // rutina vacía por defecto
function buildGym(){return {days:GYM_RAW.map(d=>({id:genId(),name:d[0],exs:d[1].map(e=>({id:genId(),name:e[0],sets:e[1]}))}))};}

/* ---------- estado ---------- */
let schedule={}, todayChecks={}, est=[], pend=[], gym={days:[]}, links=[], materias=[], weekEst={};
function sortDay(d){schedule[d].sort((a,b)=>mins(a.time)-mins(b.time));}
function matById(id){return materias.find(m=>m.id===id)||null;}
// próximo evento (futuro) de una materia, el más cercano; null si no tiene
function nextEvento(mat){ if(!mat||!mat.eventos)return null; const fut=mat.eventos.filter(e=>e.date&&diasHasta(e.date)>=0).sort((a,b)=>diasHasta(a.date)-diasHasta(b.date)); return fut[0]||null; }
// migración: cada bloque necesita `end`; los viejos `cursada` pasan a `estudio` (req 3)
function migrateSchedule(){
  let changed=false;
  for(const d in schedule){ (schedule[d]||[]).forEach(b=>{
    if(b.kind==='cursada'){b.kind='estudio';changed=true;}
    if(!b.end){b.end=minsToHM(mins(b.time)+60);changed=true;}
  }); }
  if(changed) store.set('schedule',schedule);
}
function checkSVG(){return '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';}
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ---------- Hoy ---------- */
function currentIdx(list){const n=(hr<5?hr+24:hr)*60+now.getMinutes();let idx=-1;list.forEach((b,i)=>{if(mins(b.time)<=n)idx=i;});return idx;}
async function renderHoy(){
  todayChecks=(await store.get('checks:'+TODAY))||{};
  document.getElementById('todayname').textContent=DIAS[dow];
  document.getElementById('todaytag').textContent=notes[dow]||'';
  // lista unificada: bloques fijos del horario + ítems de estudio de hoy (req 1)
  const items=[]
    .concat((schedule[dow]||[]).map(b=>({t:'block',ref:b,sortT:mins(b.time)})))
    .concat((est||[]).map(p=>({t:'est',ref:p,sortT:p.start?mins(p.start):999999})))
    .sort((a,b)=>a.sortT-b.sortT);
  const nowM=(hr<5?hr+24:hr)*60+now.getMinutes();
  let nowIdx=-1; items.forEach((it,i)=>{ if(it.sortT<=nowM) nowIdx=i; });
  const rail=document.getElementById('rail');rail.innerHTML='';
  items.forEach((it,i)=>{
    if(it.t==='block'){
      const b=it.ref, done=!!todayChecks[b.id];
      const el=document.createElement('div');
      el.className='block'+(done?' done':'')+(i===nowIdx?' now':'');
      el.innerHTML='<div class="time">'+b.time+(b.end?'<span class="tend">'+b.end+'</span>':'')+'</div><div class="body">'+checkSVG()+
        '<div class="ttl"><div class="label">'+esc(b.label)+'<span class="nowtag">ahora</span></div><div class="kind k-'+b.kind+'">'+(KLABEL[b.kind]||'')+'</div></div>'+
        '<button class="del" title="Borrar" aria-label="Borrar">×</button></div>';
      el.querySelector('.check').addEventListener('click',()=>{todayChecks[b.id]=!todayChecks[b.id];store.set('checks:'+TODAY,todayChecks);el.classList.toggle('done',todayChecks[b.id]);updateRing();});
      el.querySelector('.del').addEventListener('click',()=>{schedule[dow]=schedule[dow].filter(x=>x.id!==b.id);store.set('schedule',schedule);renderHoy();renderSemana();});
      rail.appendChild(el);
    }else{
      const p=it.ref, mat=matById(p.matId);
      const el=document.createElement('div');
      el.className='block estblock'+(p.done?' done':'')+(i===nowIdx?' now':'');
      const tcol=p.start?p.start+(p.end?'<span class="tend">'+p.end+'</span>':''):'—';
      el.innerHTML='<div class="time">'+tcol+'</div><div class="body">'+checkSVG()+
        '<div class="ttl"><div class="label">'+esc(p.text)+'<span class="nowtag">ahora</span></div><div class="kind k-estudio">Estudio'+(mat&&mat.name?' · '+esc(mat.name):'')+'</div></div>'+
        '<button class="del" title="Borrar" aria-label="Borrar">×</button></div>';
      el.querySelector('.check').addEventListener('click',()=>{
        p.done=!p.done;
        if(p.pid){const pp=pend.find(x=>x.id===p.pid);if(pp){pp.done=p.done;store.set('pendientes',pend);renderPend();}}
        store.set('estudio:'+TODAY,est);renderEst();renderHoy();updateRing();
      });
      el.querySelector('.del').addEventListener('click',()=>{est=est.filter(x=>x.id!==p.id);store.set('estudio:'+TODAY,est);renderEst();renderHoy();updateRing();});
      rail.appendChild(el);
    }
  });
  updateRing();
}
function updateRing(){
  const list=schedule[dow]||[], estToday=est||[];
  const total=list.length+estToday.length;
  const done=list.filter(b=>todayChecks[b.id]).length + estToday.filter(p=>p.done).length;
  document.getElementById('ringnum').textContent=done+'/'+total;
  const c=131.9;document.querySelector('.ring .prog').style.strokeDashoffset=total?c-(done/total)*c:c;
}
// add form
const addform=document.getElementById('addform');
document.getElementById('addhint').textContent='Elegí en qué días queda fija (por defecto, hoy).';
// selector de días
const ndays=document.getElementById('ndays');
function resetDays(){ ndays.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.d===dow)); }
ndays.querySelectorAll('button').forEach(b=>{
  b.addEventListener('click',()=>b.classList.toggle('on'));
});
resetDays();
function selectedDays(){
  const ds=[...ndays.querySelectorAll('button.on')].map(b=>+b.dataset.d);
  return ds.length?ds:[dow];
}
document.getElementById('addtoggle').addEventListener('click',()=>{addform.hidden=!addform.hidden;if(!addform.hidden){resetDays();document.getElementById('nlabel').focus();}});
document.getElementById('ncancel').addEventListener('click',()=>{addform.hidden=true;});
document.getElementById('nsave').addEventListener('click',()=>{
  const t=document.getElementById('ntime').value, e=document.getElementById('nend').value, l=document.getElementById('nlabel').value.trim(), k=document.getElementById('nkind').value;
  if(!t||!l)return;
  const end=e||minsToHM(mins(t)+60);
  selectedDays().forEach(d=>{(schedule[d]||(schedule[d]=[])).push({id:genId(),time:t,end:end,label:l,kind:k});sortDay(d);});
  store.set('schedule',schedule);
  document.getElementById('nlabel').value='';addform.hidden=true;renderHoy();renderSemana();
});
document.getElementById('nlabel').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('nsave').click();});

/* ---------- Semana ---------- */
function renderSemana(){
  const g=document.getElementById('weekgrid');g.innerHTML='';
  [1,2,3,4,5,6,0].forEach(d=>{
    const card=document.createElement('div');card.className='daycard'+(d===dow?' today':'');
    const rows=(schedule[d]||[]).filter(b=>b.kind!=='rutina'&&b.kind!=='dormir')
      .map(b=>'<div class="wrow"><span class="t">'+b.time+'</span><span class="l">'+esc(b.label)+'</span></div>').join('');
    // resumen del estudio auto-asignado / manual de esa fecha (req 2)
    const estItems=(weekEst[dowToDk[d]]||[]);
    const estRows=estItems.map(p=>'<div class="wrow wstudy'+(p.done?' done':'')+'"><span class="t">'+(p.start||'·')+'</span><span class="l">'+esc(p.text)+'</span></div>').join('');
    card.innerHTML='<h3>'+DIAS[d]+(d===dow?'<span class="badge">hoy</span>':'')+'</h3><div class="sub">'+(notes[d]||'')+'</div>'+
      (rows||'<div class="wrow"><span class="l" style="color:var(--muted-dim)">—</span></div>')+
      (estRows?'<div class="wsep">Estudio</div>'+estRows:'');
    card.addEventListener('click',()=>openDay(d));
    g.appendChild(card);
  });
}
// carga los ítems de estudio de los próximos 7 días para el resumen de Semana
async function loadWeekEst(){
  weekEst={};
  for(let off=0;off<7;off++){ const dk=dowToDk[(dow+off)%7]; weekEst[dk]=(await store.get('estudio:'+dk))||[]; }
  weekEst[TODAY]=est; // hoy comparte referencia con el estado en vivo
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
    el.className='block'+(done?' done':'')+(i===nowIdx?' now':'');
    el.innerHTML='<div class="time">'+b.time+(b.end?'<span class="tend">'+b.end+'</span>':'')+'</div><div class="body">'+(isToday?checkSVG():'')+
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
  const t=document.getElementById('dtime').value,e=document.getElementById('dend').value,l=document.getElementById('dlabel').value.trim(),k=document.getElementById('dkind').value;
  if(!t||!l)return;
  schedule[selectedDay].push({id:genId(),time:t,end:e||minsToHM(mins(t)+60),label:l,kind:k});sortDay(selectedDay);store.set('schedule',schedule);
  document.getElementById('dlabel').value='';daddform.hidden=true;renderDayDetail();renderHoy();
});
document.getElementById('dlabel').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('dsave').click();});

/* ---------- Estudio (por día, elige de pendientes) ---------- */
async function loadEst(){est=(await store.get('estudio:'+TODAY))||[];weekEst[TODAY]=est;renderEst();}
function renderEst(){
  const ul=document.getElementById('estlist');ul.innerHTML='';
  if(!est.length){ul.innerHTML='<div class="empty">Sin nada elegido para hoy. Tocá “Armar mi estudio”, sumá de tus pendientes o agregá algo puntual.</div>';}
  else est.forEach(p=>{
    const li=document.createElement('li');if(p.done)li.classList.add('done');
    const mat=matById(p.matId);
    let meta='';
    if(p.start&&p.end)meta+='<span class="eslot">'+p.start+'–'+p.end+'</span>';
    if(mat&&mat.name)meta+='<span class="mbadge">'+esc(mat.name)+'</span>';
    li.innerHTML=checkSVG()+'<span class="ptext">'+esc(p.text)+meta+'</span><button class="del" aria-label="Borrar">×</button>';
    li.querySelector('.check').addEventListener('click',()=>{
      p.done=!p.done;
      if(p.pid){const pp=pend.find(x=>x.id===p.pid);if(pp){pp.done=p.done;store.set('pendientes',pend);renderPend();}}
      store.set('estudio:'+TODAY,est);renderEst();renderHoy();updateRing();
    });
    li.querySelector('.del').addEventListener('click',()=>{est=est.filter(x=>x.id!==p.id);store.set('estudio:'+TODAY,est);renderEst();renderHoy();updateRing();});
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
    row.querySelector('.poolbtn').addEventListener('click',()=>{est.unshift({id:genId(),text:p.text,done:false,pid:p.id,matId:p.matId||null});store.set('estudio:'+TODAY,est);renderEst();renderHoy();updateRing();});
    w.appendChild(row);
  });
}
function addEst(){const i=document.getElementById('estinput');const t=i.value.trim();if(!t)return;est.unshift({id:genId(),text:t,done:false,pid:null});i.value='';store.set('estudio:'+TODAY,est);renderEst();renderHoy();updateRing();}
document.getElementById('estadd').addEventListener('click',addEst);
document.getElementById('estinput').addEventListener('keydown',e=>{if(e.key==='Enter')addEst();});

/* ---------- motor: armar el estudio de la semana (req 2/6/7) ---------- */
// prioridad de una tarea de facu = días hasta el próximo evento de su materia (menos = más urgente)
function taskPriority(p){ const ev=nextEvento(matById(p.matId)); return ev?diasHasta(ev.date):9999; }
// bloques de estudio de un día -> intervalos {s,e} en minutos, ordenados
function estudioSlots(d){ return (schedule[d]||[]).filter(b=>b.kind==='estudio').map(b=>({s:mins(b.time),e:mins(b.end||b.time)})).filter(x=>x.e>x.s).sort((a,b)=>a.s-b.s); }
// resta intervalos ocupados de una lista de intervalos libres
function subtractOccupied(free,occ){
  let res=free.map(x=>({s:x.s,e:x.e}));
  occ.forEach(o=>{ const out=[]; res.forEach(iv=>{
    if(o.e<=iv.s||o.s>=iv.e){out.push(iv);return;}
    if(o.s>iv.s)out.push({s:iv.s,e:Math.min(o.s,iv.e)});
    if(o.e<iv.e)out.push({s:Math.max(o.e,iv.s),e:iv.e});
  }); res=out.filter(x=>x.e>x.s); });
  return res;
}
async function armarEstudio(){
  const btn=document.getElementById('armarEstudio'); if(btn)btn.disabled=true;
  // 1) capacidad libre de cada uno de los próximos 7 días (respetando manuales/hechos ya ubicados)
  const days=[];
  for(let off=0;off<7;off++){
    const dk=dowToDk[(dow+off)%7], dw=(dow+off)%7;
    const existing=(await store.get('estudio:'+dk))||[];
    const preserved=existing.filter(x=>!(x.auto&&!x.done)); // se mantienen los manuales y los ya hechos
    const occ=preserved.filter(x=>x.start&&x.end).map(x=>({s:mins(x.start),e:mins(x.end)}));
    const free=subtractOccupied(estudioSlots(dw),occ);
    days.push({dk,dw,free,slotMin:estudioSlots(dw).reduce((s,iv)=>s+(iv.e-iv.s),0),remaining:free.reduce((s,iv)=>s+(iv.e-iv.s),0),preserved});
  }
  // sin bloques de tipo Estudio en el horario -> no hay dónde ubicar; avisar y no tocar nada
  const capTotal=days.reduce((s,d)=>s+d.slotMin,0);
  if(capTotal===0){
    const msg0=document.getElementById('planmsg');
    if(msg0){msg0.textContent='No encontré bloques de tipo Estudio en tu horario. En “Hoy → + Agregar actividad fija” cargá tus espacios de estudio con categoría Estudio (con hora de inicio y fin) y volvé a tocar este botón.';msg0.hidden=false;}
    if(btn)btn.disabled=false; return;
  }
  // 2) tareas de facu pendientes, ordenadas por urgencia (materia con evento más próximo primero)
  const tasks=pend.filter(p=>p.cat==='facu'&&!p.done)
    .map((p,i)=>({p,i,prio:taskPriority(p)}))
    .sort((a,b)=>a.prio-b.prio||a.i-b.i).map(x=>x.p);
  // 3) empaquetar cada tarea en los días (parte en trozos si no entra entera)
  let overflow=0; const genByDate={};
  tasks.forEach(p=>{
    let need=Math.max(15,Math.round((p.horas||1)*60)), first=true;
    for(const day of days){
      if(need<=0)break; if(day.remaining<=0)continue;
      for(const iv of day.free){
        if(need<=0)break; const avail=iv.e-iv.s; if(avail<=0)continue;
        const take=Math.min(avail,need);
        (genByDate[day.dk]||(genByDate[day.dk]=[])).push({id:genId(),text:p.text+(first?'':' (cont.)'),matId:p.matId||null,start:minsToHM(iv.s),end:minsToHM(iv.s+take),horas:take/60,done:false,auto:true,pid:p.id});
        iv.s+=take; need-=take; day.remaining-=take; first=false;
      }
    }
    if(need>0)overflow++;
  });
  // 4) escribir: preservados + nuevos auto, ordenados por hora
  for(const day of days){
    const arr=day.preserved.concat(genByDate[day.dk]||[]);
    arr.sort((a,b)=>((a.start?mins(a.start):1e9)-(b.start?mins(b.start):1e9)));
    await store.set('estudio:'+day.dk,arr);
    if(day.dk===TODAY) est=arr;
  }
  await loadWeekEst();
  renderEst();await renderHoy();renderSemana();updateRing();
  if(btn)btn.disabled=false;
  const msg=document.getElementById('planmsg');
  if(msg){
    const capH=Math.round(capTotal/6)/10; // horas de estudio disponibles en la semana
    if(!tasks.length) msg.textContent='No hay pendientes de facultad para repartir. Cargalos en la pestaña Pendientes (con su materia y horas).';
    else if(overflow) msg.textContent='Repartí lo que entró en tus '+capH+' h de estudio de la semana. '+overflow+' tarea(s) no entraron — sumá bloques de tipo Estudio en tu horario o bajá las horas.';
    else msg.textContent='Listo — repartí tus '+tasks.length+' pendiente(s) de facultad dentro de tus bloques de Estudio ('+capH+' h esta semana), priorizando lo que vence antes.';
    msg.hidden=false;
  }
}
document.getElementById('armarEstudio').addEventListener('click',armarEstudio);
// revierte la auto-asignación: borra los ítems auto de los próximos 7 días (deja los manuales intactos)
async function revertirEstudio(){
  const btn=document.getElementById('revertirEstudio'); if(btn)btn.disabled=true;
  let borradas=0;
  for(let off=0;off<7;off++){
    const dk=dowToDk[(dow+off)%7];
    const arr=(await store.get('estudio:'+dk))||[];
    const kept=arr.filter(x=>!x.auto);
    if(kept.length!==arr.length){ borradas+=arr.length-kept.length; await store.set('estudio:'+dk,kept); if(dk===TODAY) est=kept; }
  }
  await loadWeekEst();
  renderEst();await renderHoy();renderSemana();updateRing();
  if(btn)btn.disabled=false;
  const msg=document.getElementById('planmsg');
  if(msg){ msg.textContent=borradas?('Revertí la asignación: borré '+borradas+' tarea(s) auto-asignada(s) de la semana. Tus ítems cargados a mano quedaron intactos.'):'No había tareas auto-asignadas para revertir.'; msg.hidden=false; }
}
document.getElementById('revertirEstudio').addEventListener('click',revertirEstudio);

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

/* ---------- Materias (listado + calendario, req 10) ---------- */
const TIPOS=[['parcial','Parcial'],['entrega','Entrega'],['clase','Clase'],['final','Final']];
let matT;function saveMaterias(){clearTimeout(matT);matT=setTimeout(()=>store.set('materias',materias),350);}
function renderMaterias(){
  const w=document.getElementById('matwrap');if(!w)return;w.innerHTML='';
  refreshPendMatOptions();
  if(!materias.length){w.innerHTML='<div class="empty">Todavía no cargaste materias. Tocá “+ Materia” y sumá sus fechas de parciales y entregas.</div>';return;}
  materias.forEach(mat=>{
    if(!mat.eventos)mat.eventos=[];
    const card=document.createElement('div');card.className='matcard';
    const top=document.createElement('div');top.className='dtop';
    const nm=document.createElement('input');nm.type='text';nm.className='matname';nm.value=mat.name||'';nm.placeholder='Nombre de la materia';
    nm.addEventListener('input',()=>{mat.name=nm.value;saveMaterias();refreshPendMatOptions();});
    const dd=document.createElement('button');dd.className='del';dd.title='Borrar materia';dd.textContent='×';
    dd.addEventListener('click',()=>{materias=materias.filter(x=>x.id!==mat.id);store.set('materias',materias);renderMaterias();});
    top.appendChild(nm);top.appendChild(dd);card.appendChild(top);
    const nx=nextEvento(mat);
    const info=document.createElement('div');info.className='matnext';
    info.textContent=nx?('Próximo: '+(TIPOS.find(t=>t[0]===nx.tipo)||[,nx.tipo])[1]+' · '+nx.date+' (en '+diasHasta(nx.date)+' días)'):'Sin fechas próximas.';
    card.appendChild(info);
    mat.eventos.forEach(ev=>{
      const row=document.createElement('div');row.className='evrow';
      const sel=document.createElement('select');sel.className='evtipo';
      sel.innerHTML=TIPOS.map(([v,l])=>'<option value="'+v+'"'+(ev.tipo===v?' selected':'')+'>'+l+'</option>').join('');
      sel.addEventListener('change',()=>{ev.tipo=sel.value;saveMaterias();renderMaterias();});
      const dt=document.createElement('input');dt.type='date';dt.className='evdate';dt.value=ev.date||'';
      dt.addEventListener('input',()=>{ev.date=dt.value;saveMaterias();});
      dt.addEventListener('change',()=>{renderMaterias();});
      const ed=document.createElement('button');ed.className='del';ed.title='Borrar fecha';ed.textContent='×';
      ed.addEventListener('click',()=>{mat.eventos=mat.eventos.filter(x=>x.id!==ev.id);store.set('materias',materias);renderMaterias();});
      row.appendChild(sel);row.appendChild(dt);row.appendChild(ed);card.appendChild(row);
    });
    const ae=document.createElement('button');ae.className='addex';ae.textContent='+ Fecha';
    ae.addEventListener('click',()=>{mat.eventos.push({id:genId(),tipo:'parcial',date:''});store.set('materias',materias);renderMaterias();});
    card.appendChild(ae);w.appendChild(card);
  });
}
document.getElementById('addmateria').addEventListener('click',()=>{materias.push({id:genId(),name:'',eventos:[]});store.set('materias',materias);renderMaterias();});

/* ---------- Pendientes (facultad / otras) ---------- */
let pendCat='facu';
function updatePendCatUI(){ const f=document.getElementById('pendfacu'); if(f)f.hidden=(pendCat!=='facu'); }
document.querySelectorAll('#pendcat button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#pendcat button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');pendCat=b.dataset.c;updatePendCatUI();
}));
// llena el <select> de materia del alta de pendientes con las materias cargadas
function refreshPendMatOptions(){
  const sel=document.getElementById('pendmat');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Sin materia —</option>'+materias.filter(m=>(m.name||'').trim()).map(m=>'<option value="'+m.id+'">'+esc(m.name)+'</option>').join('');
  if(cur)sel.value=cur;
}
async function loadPend(){pend=(await store.get('pendientes'))||[];pend.forEach(p=>{ if(!p.cat)p.cat='facu'; if(p.cat==='facu'){ if(!('matId'in p))p.matId=null; if(!('horas'in p))p.horas=1; } });updatePendCatUI();renderPend();}
function pendItem(p){
  const li=document.createElement('li');if(p.done)li.classList.add('done');
  let meta='';
  if(p.cat==='facu'){
    const mat=matById(p.matId);
    if(mat&&mat.name)meta+='<span class="mbadge">'+esc(mat.name)+'</span>';
    if(p.horas)meta+='<span class="hbadge">'+fmtHoras(p.horas)+'</span>';
  }
  li.innerHTML=checkSVG()+'<span class="ptext">'+esc(p.text)+meta+'</span><button class="del" aria-label="Borrar">×</button>';
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
function addPend(){const i=document.getElementById('pendinput');const t=i.value.trim();if(!t)return;
  const item={id:genId(),text:t,done:false,cat:pendCat};
  if(pendCat==='facu'){ item.matId=document.getElementById('pendmat').value||null; item.horas=parseFloat(document.getElementById('pendhoras').value)||1; }
  pend.unshift(item);i.value='';store.set('pendientes',pend);renderPend();}
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

/* ---------- Links (accesos rápidos, por usuario) ---------- */
const LINKPAL=['var(--c-keyword)','var(--c-func)','var(--c-string)','var(--c-number)','var(--c-class)','var(--c-tag)','var(--c-cyan)','var(--c-indigo)'];
function normUrl(u){u=(u||'').trim();if(!u)return '';if(!/^https?:\/\//i.test(u))u='https://'+u;return u;}
async function loadLinks(){links=(await store.get('links'))||[];renderLinks();}
function renderLinks(){
  const w=document.getElementById('linklist');w.innerHTML='';
  if(!links.length){w.innerHTML='<div class="empty">Sin links todavía. Agregá tus accesos rápidos arriba (Teams, Notion, GitHub, WebCampus, UADE Virtual…).</div>';return;}
  links.forEach((l,idx)=>{
    const col=LINKPAL[idx%LINKPAL.length];
    const row=document.createElement('div');row.className='linkrow';
    row.innerHTML=
      '<span class="linkdot" style="background:'+col+'"></span>'+
      '<input class="linkname" value="'+esc(l.label||'')+'" placeholder="Nombre" style="color:'+col+'">'+
      '<input class="linkurl" value="'+esc(l.url||'')+'" placeholder="https://…">'+
      '<button class="chip lopen">Abrir ↗</button>'+
      '<button class="del" title="Borrar" aria-label="Borrar">×</button>';
    const nameI=row.querySelector('.linkname'), urlI=row.querySelector('.linkurl');
    nameI.addEventListener('input',()=>{l.label=nameI.value;store.set('links',links);});
    urlI.addEventListener('input',()=>{l.url=urlI.value.trim();store.set('links',links);});
    urlI.addEventListener('blur',()=>{urlI.value=normUrl(urlI.value);l.url=urlI.value;store.set('links',links);});
    row.querySelector('.lopen').addEventListener('click',()=>{const u=normUrl(l.url);if(u)window.open(u,'_blank','noopener');});
    row.querySelector('.del').addEventListener('click',()=>{links=links.filter(x=>x.id!==l.id);store.set('links',links);renderLinks();});
    w.appendChild(row);
  });
}
function addLink(){
  const n=document.getElementById('linkname'), u=document.getElementById('linkurl');
  const label=(n.value||'').trim(), url=normUrl(u.value);
  if(!label&&!url)return;
  links.unshift({id:genId(),label:label||url,url});
  n.value='';u.value='';store.set('links',links);renderLinks();n.focus();
}
document.getElementById('linkadd').addEventListener('click',addLink);
document.getElementById('linkname').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('linkurl').focus();});
document.getElementById('linkurl').addEventListener('keydown',e=>{if(e.key==='Enter')addLink();});

/* ---------- tabs ---------- */
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected','false'));
    btn.setAttribute('aria-selected','true');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
    document.getElementById('panel-'+btn.dataset.tab).classList.add('on');
    if(btn.dataset.tab==='semana'){document.getElementById('daydetail').hidden=true;document.getElementById('weekgrid').hidden=false;renderSemana();loadWeekEst().then(renderSemana);}
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
  applyTheme((await store.get('theme'))||'code',false); // aplica el tema del usuario (ya sincronizado)
  schedule=await store.get('schedule');
  if(!schedule){schedule=buildDefault();await store.set('schedule',schedule);}
  migrateSchedule(); // agrega `end` a los bloques viejos y pasa `cursada`→`estudio`
  gym=await store.get('gym'); if(!gym||!gym.days||!gym.days.length){gym=buildGym();await store.set('gym',gym);}
  notes=(await store.get('notes'))||{};
  materias=(await store.get('materias'))||[];
  await loadPend();await loadEst();await loadWeekEst();
  await renderHoy();renderSemana();renderGym();renderMaterias();await loadVideos();await loadLinks();
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
