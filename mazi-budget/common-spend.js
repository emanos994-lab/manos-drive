(()=>{
const COMMON_CATS={
  food:['🍔','Φαγητό / delivery'],
  gift:['🎁','Δώρα'],
  sweet:['🍰','Γλυκά / καφέδες'],
  fun:['🎬','Βόλτα / διασκέδαση'],
  home:['🏠','Σπίτι'],
  shopping:['🛍️','Αγορές'],
  transport:['🚕','Μετακινήσεις'],
  other:['📦','Άλλο']
};
function ensureCommon(m){
  if(!m)return m;
  m.commonSpends=Array.isArray(m.commonSpends)?m.commonSpends:[];
  for(const x of m.commonSpends){
    if(!x.category)x.category='other';
    if(!x.date)x.date=isoToday();
  }
  return m;
}
for(const m of Object.values(state.months||{}))ensureCommon(m);

function commonTotal(m){ensureCommon(m);return m.commonSpends.reduce((s,x)=>s+Number(x.amount||0),0)}
function receivedTotal(m){
  return [...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received===true).reduce((s,x)=>s+Number(x.receivedAmount==null?x.amount:x.receivedAmount),0);
}
function recurringPaid(m){return (m.expenseMoves||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function extraPaid(m){
  return (m.extraExpenses||[]).reduce((s,x)=>{
    const ps=Array.isArray(x.payments)?x.payments.reduce((a,p)=>a+Number(p.amount||0),0):0;
    if(ps>0)return s+Math.min(Number(x.amount||0),ps);
    return s+(x.status==='paid'?Number(x.amount||0):0);
  },0);
}
function actualPaid(m){return recurringPaid(m)+extraPaid(m)+commonTotal(m)}
function availableNow(m){
  const savings=monthSavingsNet(m.key);
  return receivedTotal(m)-actualPaid(m)-savings;
}
window.maziCommonSpent=commonTotal;
window.maziReceivedTotal=receivedTotal;
window.maziActualPaid=actualPaid;
window.maziAvailableNow=availableNow;

const previousMonthExpense=monthExpense;
monthExpense=function(m){ensureCommon(m);return previousMonthExpense(m)+commonTotal(m)};

function categoryOptions(selected='other'){
  return Object.entries(COMMON_CATS).map(([v,[icon,label]])=>'<option value="'+v+'" '+(v===selected?'selected':'')+'>'+icon+' '+label+'</option>').join('');
}
function catInfo(x){return COMMON_CATS[x.category]||COMMON_CATS.other}
function addCommonModal(editId=''){
  const m=ensureCommon(curMonth()),existing=editId?m.commonSpends.find(x=>x.id===editId):null;
  showModal(existing?'Επεξεργασία κοινού εξόδου':'Κοινό τρέχον έξοδο',
    '<div class="form-grid">'+
    '<div class="field"><label>Τι πήρατε / κάνατε</label><input name="name" required value="'+esc(existing?.name||'')+'" placeholder="π.χ. Σουβλάκια"></div>'+
    '<div class="field"><label>Ποσό</label><input name="amount" type="number" min="0.01" step="0.01" required value="'+(existing?Number(existing.amount||0):'')+'"></div>'+
    '<div class="field"><label>Κατηγορία</label><select name="category">'+categoryOptions(existing?.category||'food')+'</select></div>'+
    '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+esc(existing?.date||isoToday())+'"></div>'+
    '<div class="field" style="grid-column:1/-1"><label>Σημείωση</label><input name="note" value="'+esc(existing?.note||'')+'" placeholder="π.χ. κοινό έξοδο, όχι προσωπικό"></div>'+
    '</div>'+
    '<div class="notice" style="margin-top:10px">Αφαιρείται αμέσως από τα <strong>Διαθέσιμα τώρα</strong>. Δεν γίνεται πάγιο και δεν χρεώνεται προσωπικά σε Μάνο ή Πένυ.</div>',
    fd=>{
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!amount)return false;
      const row=existing||{id:uid(),createdAt:isoToday()};
      Object.assign(row,{name:String(fd.get('name')||'Κοινό έξοδο').trim()||'Κοινό έξοδο',amount,category:String(fd.get('category')||'other'),date:String(fd.get('date')||isoToday()),note:String(fd.get('note')||'').trim(),updatedAt:isoToday()});
      if(!existing)m.commonSpends.push(row);
    },existing?'Αποθήκευση':'Καταχώριση');
}
function removeCommon(id){
  const m=ensureCommon(curMonth()),x=m.commonSpends.find(v=>v.id===id);if(!x)return;
  if(!confirm('Να διαγραφεί το κοινό έξοδο «'+x.name+'»;'))return;
  m.commonSpends=m.commonSpends.filter(v=>v.id!==id);save();render();
}
function availableCard(m){
  const received=receivedTotal(m),paidRecurring=recurringPaid(m),paidExtra=extraPaid(m),common=commonTotal(m),saved=monthSavingsNet(m.key),avail=availableNow(m);
  const waiting=[...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received!==true).reduce((s,x)=>s+Number(x.amount||0),0);
  return '<section class="live-money-card">'+
    '<div class="live-money-main"><small>Πραγματικά διαθέσιμα τώρα</small><strong class="'+(avail<0?'negative':'positive')+'">'+euro(avail)+'</strong><span>Μόνο με χρήματα που έχουν ήδη μπει.</span></div>'+
    '<div class="live-money-breakdown">'+
      '<div><span>Έσοδα που μπήκαν</span><strong>'+euro(received)+'</strong></div>'+
      '<div><span>Πληρωμές υποχρεώσεων</span><strong>-'+euro(paidRecurring+paidExtra)+'</strong></div>'+
      '<div><span>Κοινά τρέχοντα</span><strong>-'+euro(common)+'</strong></div>'+
      '<div><span>Στην άκρη αυτόν τον κύκλο</span><strong>'+(saved>=0?'-':'+')+euro(Math.abs(saved))+'</strong></div>'+
    '</div>'+
    '<div class="live-money-foot"><span>Αναμένονται ακόμη '+euro(waiting)+' σε έσοδα.</span><button class="btn primary small" id="addCommonSpend">+ Κοινό έξοδο</button></div>'+
  '</section>';
}
function commonSection(m){
  const rows=(m.commonSpends||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return '<details class="common-spend-panel" '+(rows.length?'':'open')+'><summary><div><strong>🛍️ Κοινά τρέχοντα έξοδα</strong><small>Σουβλάκια, δώρα, γλυκά, βόλτες και άλλα μη προγραμματισμένα κοινά έξοδα.</small></div><span>'+euro(commonTotal(m))+'</span></summary>'+
    '<div class="common-spend-body">'+
      (rows.length?'<div class="common-spend-list">'+rows.map(x=>{const [icon,label]=catInfo(x);return '<div class="common-spend-row"><div><strong>'+icon+' '+esc(x.name)+'</strong><small>'+esc(label)+' · '+fmtDate(x.date)+(x.note?' · '+esc(x.note):'')+'</small></div><strong>'+euro(x.amount)+'</strong><div class="common-spend-actions"><button class="btn ghost small" data-common-edit="'+x.id+'">Επεξεργασία</button><button class="remove" data-common-remove="'+x.id+'">×</button></div></div>'}).join('')+'</div>':'<div class="lifecycle-empty">Δεν έχει καταχωρηθεί κοινό τρέχον έξοδο ακόμη.</div>')+
      '<button class="btn soft common-add-bottom" id="addCommonSpendBottom">+ Νέο κοινό έξοδο</button>'+
    '</div></details>';
}
function bindCommon(){
  for(const id of ['addCommonSpend','addCommonSpendBottom']){const b=document.getElementById(id);if(b)b.onclick=()=>addCommonModal()}
  document.querySelectorAll('[data-common-edit]').forEach(b=>b.onclick=()=>addCommonModal(b.dataset.commonEdit));
  document.querySelectorAll('[data-common-remove]').forEach(b=>b.onclick=()=>removeCommon(b.dataset.commonRemove));
}
const previousRender=render;
render=function(){
  previousRender();
  if(view!=='real')return;
  const app=document.getElementById('app'),m=ensureCommon(curMonth());if(!app)return;
  app.querySelector('.live-money-card')?.remove();
  app.querySelector('.common-spend-panel')?.remove();
  const dash=app.querySelector('.clean-dashboard');
  if(dash)dash.insertAdjacentHTML('afterend',availableCard(m));
  const oneoff=app.querySelector('[data-clean-panel="oneoff"]')||app.querySelector('.oneoff-section');
  if(oneoff)oneoff.insertAdjacentHTML('afterend',commonSection(m));
  else app.insertAdjacentHTML('beforeend',commonSection(m));
  bindCommon();
};
localStorage.setItem(storeKey,JSON.stringify(state));
render();
})();