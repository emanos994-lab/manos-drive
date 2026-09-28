
(()=>{
const ENDPOINT='https://script.google.com/macros/s/AKfycbw6mVPR3XbfUn4YTVrBmLdezHi8IEBmmOBDfQjPXqZ4GePqsfaz9VWQZSMDQfZVfTPmCA/exec';
const CHANNEL='mazi-sync-v1';
const K={secret:'mazi-sync-secret-v1',actor:'mazi-sync-actor-v1',device:'mazi-sync-device-v1',version:'mazi-sync-version-v1',bound:'mazi-sync-bound-v1',dirty:'mazi-sync-dirty-v1'};
let frame=null,ready=false,busy=false,seq=0,waiters=new Map(),pullTimer=null,pushTimer=null;

const get=k=>localStorage.getItem(k)||'';
const set=(k,v)=>localStorage.setItem(k,String(v));
const secret=()=>get(K.secret);
const actor=()=>get(K.actor)||'Μάνος';
const bound=()=>get(K.bound)==='1';
const dirty=()=>get(K.dirty)==='1';
const version=()=>Number(get(K.version)||0);
const setStatus=(st,txt)=>{const b=document.getElementById('syncStatusButton'),t=document.getElementById('syncStatusText');if(b)b.dataset.state=st||'';if(t)t.textContent=txt||'Sync';};
const refresh=()=>{if(!secret())return setStatus('','Σύνδεση');if(!navigator.onLine)return setStatus('offline','Offline');if(dirty())return setStatus('pending','Αναμονή');if(ready&&bound())return setStatus('synced','✓ Sync');setStatus('working','Σύνδεση…');};
const device=()=>{let id=get(K.device);if(!id){id=crypto.randomUUID?crypto.randomUUID():'d'+Date.now()+Math.random().toString(36).slice(2);set(K.device,id)}return id};
const meaningful=()=>Boolean(state.setupComplete||Number(state.savings||0)||(state.wallets||[]).some(w=>Number(w.balance||0))||(state.incomes||[]).some(i=>i.status==='received')||(state.expenses||[]).some(e=>spentAmount(e)>0)||(state.personal?.manos?.transactions||[]).length||(state.personal?.penny?.transactions||[]).length);

const b64=u=>{let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s)};
const unb64=s=>{const x=atob(s),u=new Uint8Array(x.length);for(let i=0;i<x.length;i++)u[i]=x.charCodeAt(i);return u};
async function hex(s){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function key(sec,salt,it){const b=await crypto.subtle.importKey('raw',new TextEncoder().encode(sec),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:it,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function enc(obj){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),it=120000,k=await key(secret(),salt,it),pt=new TextEncoder().encode(JSON.stringify(obj)),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,pt));return JSON.stringify({v:1,iter:it,salt:b64(salt),iv:b64(iv),ct:b64(ct)})}
async function dec(payload){const e=JSON.parse(payload),salt=unb64(e.salt),iv=unb64(e.iv),ct=unb64(e.ct),k=await key(secret(),salt,Number(e.iter||120000)),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv},k,ct);return JSON.parse(new TextDecoder().decode(pt))}

window.addEventListener('message',ev=>{if(!frame||ev.source!==frame.contentWindow)return;const m=ev.data||{};if(m.channel!==CHANNEL)return;if(m.type==='ready'){ready=true;refresh();return}if(m.type==='response'&&waiters.has(m.id)){const w=waiters.get(m.id);waiters.delete(m.id);clearTimeout(w.t);w.r(m.result)}});
function bridge(){if(!frame){frame=document.createElement('iframe');frame.id='syncBridgeFrame';frame.src=ENDPOINT;frame.setAttribute('aria-hidden','true');document.body.appendChild(frame)}}
function call(req){bridge();return new Promise((r,j)=>{const id='q'+Date.now()+(++seq),send=()=>{if(ready){const t=setTimeout(()=>{waiters.delete(id);j(new Error('Timeout sync'))},25000);waiters.set(id,{r,j,t});frame.contentWindow.postMessage({channel:CHANNEL,type:'request',id,request:req},'*')}else setTimeout(send,120)};send()})}
const auth=()=>hex('mazi-auth-v1:'+secret());

function applyRemote(remote,v){state=deepMerge(structuredClone(defaults),remote||{});localStorage.setItem(storeKey,JSON.stringify(state));set(K.version,v);set(K.bound,1);set(K.dirty,0);render();setStatus('synced','✓ Sync')}
async function pull(initial=false){
 if(!secret()||!navigator.onLine||busy||dirty())return;
 busy=true;setStatus('working','Sync…');
 try{
  const res=await call({action:'pull',auth:await auth()});
  if(!res?.ok)throw new Error(res?.error||'pull');
  if(!res.payload||Number(res.version||0)===0){
    set(K.version,0);setStatus('working','Cloud κενό');
    if(initial)firstUploadPrompt();
    return;
  }
  const v=Number(res.version||0);
  if(bound()&&v<=version()){setStatus('synced','✓ Sync');return}
  const remote=await dec(res.payload);
  if(!bound()&&meaningful()){
    showModal('Υπάρχουν ήδη κοινά δεδομένα','<div class="notice">Το Google cloud έχει ήδη δεδομένα. Για ασφάλεια θα φορτώσουμε την κοινή έκδοση σε αυτή τη συσκευή.</div>',()=>{setTimeout(()=>applyRemote(remote,v),80)},'Χρήση cloud');
  }else applyRemote(remote,v);
 }catch(e){
  console.error(e);
  setStatus('error',String(e?.message||'').includes('Unauthorized')?'Κωδικός':'⚠ Sync');
 }finally{
  busy=false;
 }
}
async function push(force=false){
 if(!secret()||(!bound()&&!force)||busy)return;
 if(!navigator.onLine){set(K.dirty,1);refresh();return}
 busy=true;setStatus('working','Sync…');
 const snap=structuredClone(state);
 try{
  const res=await call({action:'push',auth:await auth(),payload:await enc(snap),updatedBy:actor(),deviceId:device(),clientVersion:version()});
  if(!res?.ok){
    if(res?.conflict){
      localStorage.setItem('mazi-sync-conflict-backup',JSON.stringify(snap));
      set(K.version,res.serverVersion||0);
      set(K.bound,0);
      set(K.dirty,0);
      alert('Υπήρξε ταυτόχρονη αλλαγή από άλλη συσκευή. Κράτησα αντίγραφο ασφαλείας και θα φορτώσω την κοινή έκδοση.');
      setTimeout(()=>pull(false),150);
      return;
    }
    throw new Error(res?.error||'push');
  }
  set(K.version,res.version);
  set(K.bound,1);
  set(K.dirty,0);
  setStatus('synced','✓ Sync');
 }catch(e){
  console.error(e);
  set(K.dirty,1);
  setStatus(navigator.onLine?'error':'offline',navigator.onLine?'⚠ Sync':'Offline');
 }finally{
  busy=false;
 }
}
function firstUploadPrompt(){
 if(window.__maziFirstPrompt)return;
 window.__maziFirstPrompt=true;
 const warn=!meaningful()?'<div class="warning notice" style="margin-top:12px">Αυτή η συσκευή φαίνεται άδεια. Αν τα σωστά ποσά είναι στο iPhone, κάνε την πρώτη σύνδεση από εκεί.</div>':'';
 showModal('Πρώτος συγχρονισμός','<div class="notice"><strong>Το κοινό cloud είναι άδειο.</strong><br><br>Η πρώτη συσκευή πρέπει να είναι αυτή που έχει τη σωστή σημερινή εικόνα.</div>'+warn,()=>{setTimeout(()=>push(true),100)},'Ανέβασμα αυτής της συσκευής');
}
function settings(){
 const has=!!secret(),a=actor();
 showModal('Κοινός συγχρονισμός','<div class="notice">Τα οικονομικά ανεβαίνουν κρυπτογραφημένα. Ο κοινός κωδικός μένει μόνο σε αυτή τη συσκευή.</div><div class="form-grid" style="margin-top:14px"><div class="field"><label>Χρήστης</label><select name="actor"><option value="Μάνος" '+(a==='Μάνος'?'selected':'')+'>Μάνος</option><option value="Πένυ" '+(a==='Πένυ'?'selected':'')+'>Πένυ</option></select></div><div class="field"><label>Κοινός κωδικός sync</label><input name="secret" type="password" '+(has?'':'required')+' placeholder="'+(has?'Άφησέ το κενό για να μείνει ίδιο':'Βάλε το MAZI_SYNC_SECRET')+'"></div></div>',fd=>{
   const n=String(fd.get('secret')||'').trim();
   set(K.actor,fd.get('actor')||'Μάνος');
   if(n&&n!==secret()){
     set(K.secret,n);
     set(K.bound,0);
     set(K.dirty,0);
     set(K.version,0);
   }
   setTimeout(()=>pull(true),100);
 },has?'Αποθήκευση & συγχρονισμός':'Σύνδεση');
}
window.maziSyncChanged=()=>{
 if(!secret()||!bound())return;
 set(K.dirty,1);
 refresh();
 clearTimeout(pushTimer);
 pushTimer=setTimeout(()=>push(false),900);
};
window.initMaziSync=()=>{
 bridge();
 refresh();
 const b=document.getElementById('syncStatusButton');
 if(b)b.onclick=settings;
 window.addEventListener('online',()=>dirty()&&bound()?push(false):pull(false));
 window.addEventListener('offline',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&secret()){dirty()&&bound()?push(false):pull(false)}});
 clearInterval(pullTimer);
 pullTimer=setInterval(()=>{if(secret()&&!document.hidden){dirty()&&bound()?push(false):pull(false)}},15000);
 if(secret())pull(true);
};
})();
