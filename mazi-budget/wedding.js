(()=>{
function ensureWedding(){
  state.weddingPlan=state.weddingPlan||{};
  const w=state.weddingPlan;
  if(w.target==null)w.target=10000;
  if(!w.targetMonth)w.targetMonth='2027-10';
  if(w.floor==null)w.floor=500;
  if(w.useSeasonal==null)w.useSeasonal=true;
  state.safety=state.safety||{};
  return w;
}
function keyNext(key){
  const [y,m]=String(key).split('-').map(Number),d=new Date(y,m,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function keysThrough(start,target){
  const out=[];let k=start,guard=0;
  while(k<=target&&guard++<60){out.push(k);k=keyNext(k)}
  return out;
}
function seasonalForWedding(key){
  if(!ensureWedding().useSeasonal)return 0;
  const mm=key.slice(5,7);
  return (state.seasonal||[]).filter(x=>x.enabled!==false&&String(x.month).padStart(2,'0')===mm).reduce((s,x)=>s+Number(x.amount||0),0);
}
const flexIds=new Set(['e8','e9','e10','e13','e14','e15','e16','e17','e18','e19','e20','e21']);
function recurringExpense(m){return (m.expenses||[]).filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0)}
function flexibleExpense(m,includeExtras=true){
  const recurring=(m.expenses||[]).filter(x=>x.active!==false&&(flexIds.has(x.id)||x.variable===true)).reduce((s,x)=>s+(window.maziEffectiveRecurring?window.maziEffectiveRecurring(m,x):Number(x.amount||0)),0);
  const extras=includeExtras?(m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0):0;
  const common=includeExtras?(m.commonSpends||[]).reduce((s,x)=>s+Number(x.amount||0),0):0;
  return recurring+extras+common;
}
function historicalVolatility(){
  const keys=Object.keys(state.months||{}).filter(k=>k<liveKey()).sort().slice(-6);
  if(keys.length<3)return .20;
  const vals=keys.map(k=>monthExpense(state.months[k])).filter(v=>v>0);
  if(vals.length<3)return .20;
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  const variance=vals.reduce((s,v)=>s+Math.pow(v-avg,2),0)/vals.length;
  return Math.max(.10,Math.min(.35,Math.sqrt(variance)/Math.max(1,avg)));
}
function liveKey(){
  const keys=Object.keys(state.months||{}).filter(k=>k<=monthNow()).sort();
  return keys[keys.length-1]||state.activeMonth;
}
function monthModel(key,base,vol,currentKey){
  const existing=state.months?.[key];
  const active=key===currentKey;
  const m=existing||base;
  const income=existing?monthIncome(m):sum(base.incomes||[]);
  const recurring=recurringExpense(m);
  const extras=existing?(m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0):0;
  const common=existing?(m.commonSpends||[]).reduce((s,x)=>s+Number(x.amount||0),0):0;
  const expense=existing?monthExpense(m):recurring;
  const flex=flexibleExpense(m,!!existing);
  const stable=Math.max(0,expense-flex);
  const seasonal=seasonalForWedding(key);
  let baseSave=income+seasonal-expense;
  let careful=income+seasonal-(stable+flex*(1+vol));
  let strong=income+seasonal-(stable+flex*Math.max(0,1-vol));
  if(active){
    const already=monthSavingsNet(key);
    baseSave-=already;careful-=already;strong-=already;
  }
  return {key,income,expense,seasonal,extras,common,baseSave,careful,strong,existing:!!existing};
}
function weddingProjection(){
  const w=ensureWedding(),currentKey=liveKey(),base=state.months[currentKey]||curMonth(),start=balanceThroughMonth(currentKey),vol=historicalVolatility();
  const keys=keysThrough(currentKey,w.targetMonth);
  let b=start,c=start,s=start;
  const rows=keys.map(k=>{
    const r=monthModel(k,base,vol,currentKey);
    b+=r.baseSave;c+=r.careful;s+=r.strong;
    return {...r,baseBalance:b,carefulBalance:c,strongBalance:s};
  });
  return {w,start,vol,rows,baseEnd:b,carefulEnd:c,strongEnd:s};
}
function weddingStatus(p){
  const t=Number(p.w.target||0);
  if(p.start>=t)return {tone:'good',title:'Ο στόχος έχει ήδη καλυφθεί',text:'Το ποσό που υπάρχει ήδη στην άκρη φτάνει τον στόχο.'};
  if(p.carefulEnd>=t)return {tone:'good',title:'Πολύ καλή πορεία',text:'Ακόμα και σε πιο ακριβούς μήνες, η πρόβλεψη παραμένει πάνω από τον στόχο.'};
  if(p.baseEnd>=t)return {tone:'ok',title:'Είστε εντός πορείας',text:'Με τα σημερινά πραγματικά δεδομένα ο στόχος βγαίνει, αλλά υπάρχει φυσιολογική μεταβλητότητα από μήνα σε μήνα.'};
  return {tone:'warn',title:'Θέλει λίγο πιο δυνατό ρυθμό',text:'Με τη σημερινή εικόνα η βασική πρόβλεψη μένει κάτω από τον στόχο. Δεν είναι συναγερμός, απλώς ένδειξη για το πόσο χρειάζεται να μένει κατά μέσο όρο.'};
}
function weddingRows(p){
  if(!p.rows.length)return '<div class="wedding-empty">Η ημερομηνία στόχου είναι πριν από τον ενεργό κύκλο.</div>';
  return '<div class="wedding-months">'+p.rows.map(r=>{
    const inst=r.extras>0?' · δεσμευμένα/έκτακτα '+euro(r.extras):'';
    const common=r.common>0?' · κοινά '+euro(r.common):'';
    const gift=r.seasonal>0?' · δώρα/επιδόματα +'+euro(r.seasonal):'';
    return '<div class="wedding-month"><div><strong>'+esc(monthLabel(r.key))+'</strong><small>Έσοδα '+euro(r.income)+' · έξοδα '+euro(r.expense)+inst+common+gift+'</small></div><div><small>Πιθανό στην άκρη</small><strong class="'+(r.baseSave<0?'negative':'positive')+'">'+(r.baseSave>=0?'+':'')+euro(r.baseSave)+'</strong><span>σύνολο '+euro(r.baseBalance)+'</span></div></div>';
  }).join('')+'</div>';
}
function weddingView(){
  const p=weddingProjection(),w=p.w,status=weddingStatus(p),target=Number(w.target||0);
  const remain=Math.max(0,target-p.start),months=Math.max(1,p.rows.length),need=remain/months;
  const pct=target>0?Math.max(0,Math.min(100,p.start/target*100)):0;
  const gifts=p.rows.reduce((s,r)=>s+r.seasonal,0);
  return '<div class="wedding-head"><div><small>Κοινός στόχος</small><h2>💍 Γάμος · '+esc(monthLabel(w.targetMonth))+'</h2><p>Η πρόβλεψη ενημερώνεται από τα πραγματικά έσοδα, έξοδα, δόσεις, αποταμίευση και τα δώρα/επιδόματα της εφαρμογής.</p></div><div class="wedding-target-pill">'+euro(target)+'</div></div>'+
  '<section class="wedding-progress-card"><div class="wedding-progress-top"><div><small>Έχετε ήδη στην άκρη</small><strong>'+euro(p.start)+'</strong></div><div><small>Μένουν για τον στόχο</small><strong>'+euro(remain)+'</strong></div><div><small>Μέσος ρυθμός που χρειάζεται</small><strong>'+euro(need)+'/μήνα</strong></div></div><div class="wedding-progress"><i style="width:'+pct+'%"></i></div><span>'+Math.round(pct)+'% του στόχου</span></section>'+
  '<section class="wedding-verdict '+status.tone+'"><div><small>Πρόβλεψη</small><h3>'+status.title+'</h3><p>'+status.text+'</p></div><strong>'+euro(p.baseEnd)+'</strong></section>'+
  '<section class="wedding-scenarios"><div><small>Πιο ακριβοί μήνες</small><strong>'+euro(p.carefulEnd)+'</strong><span>με μεγαλύτερη μεταβλητή δαπάνη</span></div><div class="main"><small>Βασική πρόβλεψη</small><strong>'+euro(p.baseEnd)+'</strong><span>με τα σημερινά δεδομένα</span></div><div><small>Πιο ήσυχοι μήνες</small><strong>'+euro(p.strongEnd)+'</strong><span>με χαμηλότερη μεταβλητή δαπάνη</span></div></section>'+
  '<section class="section wedding-settings"><div class="section-head"><div><h2>Ρυθμίσεις στόχου</h2><p>Αλλάζεις μόνο ό,τι θέλετε να θεωρείται στόχος. Τα υπόλοιπα έρχονται από την κεντρική εφαρμογή.</p></div></div><div class="wedding-settings-grid"><div class="field"><label>Στόχος γάμου</label><input id="weddingTarget" type="number" min="0" step="100" value="'+target+'"></div><div class="field"><label>Μήνας στόχου</label><input id="weddingMonth" type="month" value="'+esc(w.targetMonth)+'"></div><div class="field"><label>Όριο ασφαλείας άκρης</label><input id="weddingFloor" type="number" min="0" step="50" value="'+Number(w.floor||0)+'"></div><label class="wedding-check"><input id="weddingSeasonal" type="checkbox" '+(w.useSeasonal?'checked':'')+'><span>Υπολόγισε δώρα / επιδόματα</span></label></div><div class="wedding-notify-row"><button class="btn soft small" id="weddingNotify">Ειδοποιήσεις ορίου</button><span>Η ένδειξη «Οριακό» εμφανίζεται πάντα μέσα στην εφαρμογή. Ειδοποίηση συσκευής στέλνεται μόνο αν έχουν επιτραπεί notifications.</span></div><div class="wedding-note">Στην πρόβλεψη έχουν υπολογιστεί γνωστά δώρα/επιδόματα <strong>'+euro(gifts)+'</strong>. Τυχαία δώρα ή απρόβλεπτα έσοδα δεν τα μαντεύουμε, γιατί αυτό θα ήταν περισσότερο ωροσκόπιο παρά budget.</div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Πρόβλεψη ανά μήνα</h2><p>Οι μήνες προσαρμόζονται αυτόματα όταν αλλάζουν τα πραγματικά στοιχεία ή προστίθενται δόσεις.</p></div></div>'+weddingRows(p)+'</section>'+
  '<section class="wedding-method"><strong>Πώς διαβάζεται:</strong> η βασική γραμμή χρησιμοποιεί τα πραγματικά ποσά της εφαρμογής. Το εύρος “πιο ακριβοί / πιο ήσυχοι μήνες” επηρεάζει μόνο τις μεταβλητές δαπάνες. Με αρκετό ιστορικό, το εύρος προσαρμόζεται στη δική σας πραγματική μεταβλητότητα. Μέχρι τότε χρησιμοποιείται ένα ήπιο ±20%.</section>';
}
adviceView=weddingView;

function currentSavings(){return balanceThroughMonth(liveKey())}
function savingsMaxEver(){
  const tx=(state.savingsTx||[]).slice().sort((a,b)=>String(a.monthKey||'').localeCompare(String(b.monthKey||''))||String(a.date||'').localeCompare(String(b.date||'')));
  let bal=0,max=0;for(const x of tx){bal+=Number(x.amount||0);max=Math.max(max,bal)}return max;
}
function pulseData(){
  const w=ensureWedding(),k=liveKey(),m=state.months[k]||curMonth(),floor=Number(w.floor||500),bal=currentSavings(),max=savingsMaxEver();
  const forecast=monthIncome(m)-monthExpense(m);
  const oneoffs=(m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0),income=monthIncome(m);
  const prior=Math.max(0,balanceBeforeMonth(k)),net=monthSavingsNet(k);
  if(max>=floor&&bal<floor)return {tone:'danger',label:'Οριακό',title:'Η άκρη έπεσε κάτω από '+euro(floor),text:'Είχατε περάσει το όριο ασφαλείας και τώρα είστε στα '+euro(bal)+'. Δεν μπλοκάρει τίποτα, απλώς το επισημαίνει.'};
  if(forecast<0)return {tone:'danger',label:'Προσοχή',title:'Ο κύκλος βγαίνει αρνητικός',text:'Με όσα έχουν καταχωρηθεί τώρα λείπουν περίπου '+euro(Math.abs(forecast))+'.'};
  if(net<0&&Math.abs(net)>Math.max(50,prior*.10))return {tone:'watch',label:'Έλεγχος',title:'Έγινε αισθητή ανάληψη από την άκρη',text:'Αφαιρέθηκαν καθαρά '+euro(Math.abs(net))+' αυτόν τον κύκλο. Απλώς τσέκαρε ότι ήταν συνειδητή επιλογή.'};
  if(income>0&&oneoffs>200&&oneoffs/income>.25)return {tone:'watch',label:'Πιο βαρύς μήνας',title:'Τα έκτακτα έχουν ανέβει',text:'Τα έκτακτα είναι '+euro(oneoffs)+', πάνω από το 25% των εσόδων του κύκλου.'};
  return {tone:'good',label:'ΟΚ',title:'Η εικόνα είναι ήρεμη',text:'Δεν υπάρχει κάτι που να χρειάζεται ιδιαίτερη προσοχή αυτή τη στιγμή.'};
}
function pulseHtml(){
  const p=pulseData();
  return '<section class="money-pulse '+p.tone+'"><div class="pulse-dot"></div><div><small>Οικονομικός παλμός · '+p.label+'</small><strong>'+p.title+'</strong><span>'+p.text+'</span></div></section>';
}
function persistSafety(){
  const w=ensureWedding(),floor=Number(w.floor||500),bal=currentSavings(),max=savingsMaxEver(),s=state.safety||(state.safety={});
  const below=max>=floor&&bal<floor;
  if(!below&&s.floorAlerted){s.floorAlerted=false;localStorage.setItem(storeKey,JSON.stringify(state))}
  if(below&&!s.floorAlerted){
    s.floorAlerted=true;localStorage.setItem(storeKey,JSON.stringify(state));
    if('Notification' in window&&Notification.permission==='granted'){
      const body='Η αποταμίευση είναι '+euro(bal)+' και έπεσε κάτω από το όριο των '+euro(floor)+'.';
      navigator.serviceWorker?.ready.then(reg=>reg.showNotification('Μαζί · Οριακό αποταμίευσης',{body,tag:'mazi-savings-floor'})).catch(()=>{});
    }
  }
}
const oldBind=bind;
bind=function(){
  oldBind();
  const set=(id,key,cast=v=>v)=>{const el=document.getElementById(id);if(el)el.onchange=e=>{const w=ensureWedding();w[key]=cast(e.target.type==='checkbox'?e.target.checked:e.target.value);save();render()}};
  set('weddingTarget','target',v=>Math.max(0,Number(v||0)));
  set('weddingMonth','targetMonth',v=>String(v||'2027-10'));
  set('weddingFloor','floor',v=>Math.max(0,Number(v||0)));
  set('weddingSeasonal','useSeasonal',v=>Boolean(v));
  const n=document.getElementById('weddingNotify');
  if(n)n.onclick=async()=>{const ok=window.enableMaziNotifications?await window.enableMaziNotifications():false;alert(ok?'Οι ειδοποιήσεις είναι ενεργές. Αν η άκρη πέσει κάτω από το όριο αφού πρώτα το έχει περάσει, θα εμφανιστεί ειδοποίηση όταν η εφαρμογή μπορεί να τη στείλει.':'Δεν δόθηκε άδεια ειδοποιήσεων από τη συσκευή ή τον browser.');};
};
const oldRender=render;
render=function(){
  oldRender();
  persistSafety();
  if(view==='real'){
    const dash=document.querySelector('.clean-dashboard');
    if(dash&&!document.querySelector('.money-pulse'))dash.insertAdjacentHTML('afterend',pulseHtml());
  }
};
ensureWedding();
localStorage.setItem(storeKey,JSON.stringify(state));
render();
})();