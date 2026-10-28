(()=>{
const OLD_KEYS=[
  'mazi-sync-secret-v1','mazi-sync-actor-v1','mazi-sync-device-v1',
  'mazi-sync-version-v1','mazi-sync-bound-v1','mazi-sync-dirty-v1','mazi-sync-conflict-backup'
];
const HOUSEHOLD_COLLECTION='households';
const HOUSEHOLD_DOC='manos-peny';
const firebaseConfig={
  apiKey:"AIzaSyD9enPkbW9ZGXH1BfV-bpiWJiwIwBjyD_4",
  authDomain:"mazi-budget.firebaseapp.com",
  projectId:"mazi-budget",
  storageBucket:"mazi-budget.firebasestorage.app",
  messagingSenderId:"444663868304",
  appId:"1:444663868304:web:e2cdb6a1a1181b02aae115"
};

let auth=null,db=null,user=null,docRef=null,unsubscribe=null,ready=false;
let writeTimer=null,lastCloudJson='',syncBusy=false;

function removeLegacySync(){for(const k of OLD_KEYS)localStorage.removeItem(k)}
function cleanState(v){return JSON.parse(JSON.stringify(v))}
function stateJson(v){try{return JSON.stringify(cleanState(v))}catch{return ''}}

function setStatus(text,mode=''){
  const b=document.getElementById('syncStatusButton'),t=document.getElementById('syncStatusText');
  if(b){b.dataset.state=mode;b.disabled=false;b.title=text}
  if(t)t.textContent=text;
}
function injectCss(){
  if(document.getElementById('maziSyncCss'))return;
  const s=document.createElement('style');s.id='maziSyncCss';s.textContent=
  '.mazi-login-gate{position:fixed;z-index:9999;inset:0;background:rgba(242,246,250,.96);backdrop-filter:blur(12px);display:grid;place-items:center;padding:18px}.mazi-login-card{width:min(410px,100%);background:#fff;border:1px solid #dfe6ed;border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(28,45,66,.16)}.mazi-login-card h2{margin:0 0 5px;font-size:24px}.mazi-login-card p{margin:0 0 17px;color:#748295;font-size:12px;line-height:1.5}.mazi-login-card label{display:block;font-size:10px;font-weight:800;color:#6d7c8d;margin:10px 0 4px}.mazi-login-card input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #dce3ea;border-radius:11px;font:inherit}.mazi-login-card button{width:100%;margin-top:14px}.mazi-login-error{min-height:18px;color:#b43a4b;font-size:10px;margin-top:8px}.mazi-sync-account{display:grid;gap:9px}.mazi-sync-account .notice{margin:0}.mazi-sync-account strong{word-break:break-word}.sync-status-btn[data-state="ok"] .sync-dot{background:#44b985}.sync-status-btn[data-state="busy"] .sync-dot{background:#e2a93b}.sync-status-btn[data-state="error"] .sync-dot{background:#d75b68}';
  document.head.appendChild(s);
}
function gate(){
  let g=document.getElementById('maziLoginGate');
  if(g)return g;
  g=document.createElement('div');g.id='maziLoginGate';g.className='mazi-login-gate';
  g.innerHTML='<form class="mazi-login-card" id="maziLoginForm"><h2>Σύνδεση στο Μαζί</h2><p>Μπες με το email και τον κωδικό που δημιουργήθηκαν στο Firebase. Εσύ και η Πένυ θα βλέπετε το ίδιο κοινό budget.</p><label>Email</label><input name="email" type="email" autocomplete="username" required><label>Κωδικός</label><input name="password" type="password" autocomplete="current-password" required><div class="mazi-login-error" id="maziLoginError"></div><button class="btn primary" type="submit">Σύνδεση</button></form>';
  document.body.appendChild(g);
  g.querySelector('form').onsubmit=async e=>{
    e.preventDefault();
    const err=document.getElementById('maziLoginError');err.textContent='';
    const fd=new FormData(e.currentTarget);
    try{
      setStatus('Σύνδεση…','busy');
      await auth.signInWithEmailAndPassword(String(fd.get('email')||'').trim(),String(fd.get('password')||''));
    }catch(ex){
      err.textContent='Δεν έγινε σύνδεση. Έλεγξε email και κωδικό.';
      setStatus('Εκτός σύνδεσης','error');
    }
  };
  return g;
}
function showGate(){gate().style.display='grid'}
function hideGate(){const g=document.getElementById('maziLoginGate');if(g)g.style.display='none'}

function accountModal(){
  if(!user)return showGate();
  showModal('Κοινός συγχρονισμός',
    '<div class="mazi-sync-account"><div class="notice"><strong>Συνδεδεμένος λογαριασμός</strong><br>'+esc(user.email||'')+'</div><div class="notice">Κατάσταση: <strong>'+(ready?'Συγχρονισμένο':'Σύνδεση…')+'</strong><br>Οι αλλαγές αποθηκεύονται στο κοινό budget Μάνου & Πένυς.</div><button type="button" class="btn ghost" id="maziLogoutBtn">Αποσύνδεση</button></div>',
    ()=>{},'Κλείσιμο');
  setTimeout(()=>{const b=document.getElementById('maziLogoutBtn');if(b)b.onclick=()=>{document.getElementById('modal')?.close();auth.signOut()}},0);
}

async function uploadNow(){
  if(!ready||!user||!docRef||syncBusy)return;
  const payload=cleanState(state),json=stateJson(payload);
  if(!json||json===lastCloudJson)return;
  syncBusy=true;setStatus('Αποθήκευση…','busy');
  try{
    await docRef.set({
      state:payload,
      updatedBy:user.uid,
      updatedEmail:user.email||'',
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    lastCloudJson=json;
    setStatus('Συγχρονισμένο','ok');
  }catch(e){
    setStatus('Σφάλμα sync','error');
  }finally{syncBusy=false}
}
function scheduleUpload(){
  if(!ready||!user)return;
  clearTimeout(writeTimer);
  writeTimer=setTimeout(uploadNow,450);
}

function applyCloud(cloudState){
  const normalized=normalizeState(cleanState(cloudState));
  const incoming=stateJson(normalized),local=stateJson(state);
  lastCloudJson=incoming;
  if(!incoming||incoming===local)return;
  state=normalized;
  localStorage.setItem(storeKey,JSON.stringify(state));
  render();
}

async function startHouseholdSync(u){
  ready=false;user=u;docRef=db.collection(HOUSEHOLD_COLLECTION).doc(HOUSEHOLD_DOC);
  if(unsubscribe){unsubscribe();unsubscribe=null}
  setStatus('Σύνδεση cloud…','busy');
  try{
    const first=await docRef.get();
    if(!first.exists){
      const payload=cleanState(state);
      await docRef.set({
        state:payload,
        createdBy:u.uid,
        createdEmail:u.email||'',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy:u.uid,
        updatedEmail:u.email||'',
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      lastCloudJson=stateJson(payload);
    }else{
      const data=first.data()||{};
      if(data.state)applyCloud(data.state);
    }
    unsubscribe=docRef.onSnapshot(snap=>{
      if(!snap.exists)return;
      const data=snap.data()||{};
      if(data.state)applyCloud(data.state);
      setStatus('Συγχρονισμένο','ok');
    },()=>setStatus('Σφάλμα sync','error'));
    ready=true;hideGate();setStatus('Συγχρονισμένο','ok');
  }catch(e){
    ready=false;setStatus('Σφάλμα sync','error');showGate();
  }
}

function initFirebase(){
  injectCss();removeLegacySync();
  const b=document.getElementById('syncStatusButton');if(b)b.onclick=accountModal;
  if(!window.firebase){setStatus('Firebase error','error');return}
  if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
  auth=firebase.auth();db=firebase.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
  auth.onAuthStateChanged(u=>{
    user=u||null;
    if(!u){
      ready=false;if(unsubscribe){unsubscribe();unsubscribe=null}
      setStatus('Σύνδεση','');showGate();return;
    }
    startHouseholdSync(u);
  });
  window.maziSyncChanged=scheduleUpload;
}
window.maziSyncChanged=()=>{};
window.initMaziSync=initFirebase;
})();