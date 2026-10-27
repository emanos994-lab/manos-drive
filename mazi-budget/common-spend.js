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
  m.fundingAllocations=Array.isArray(m.fundingAllocations)?m.fundingAllocations:[];
  for(const x of m.commonSpends){
    if(!x.category)x.category='other';
    if(!x.date)x.date=isoToday();
    if(!x.sourceId){
      const tx=(state.savingsTx||[]).find(t=>t.commonSpendId===x.id);
      if(tx)x.sourceId='savings';
      else{
        const allocs=m.fundingAllocations.filter(a=>a.targetType==='commonSpend'&&a.targetId===x.id);
        const ids=[...new Set(allocs.map(a=>a.sourceId).filter(Boolean))];
        if(ids.length===1)x.sourceId=ids[0];
        else if(ids.length>1)x.sourceId='mixed';
      }
    }
  }
  return m;
}
for(const m of Object.values(state.months||{}))ensureCommon(m);

function commonTotal(m){ensureCommon(m);return m.commonSpends.reduce((s,x)=>s+Number(x.amount||0),0)}
function externalCommonTotal(m){ensureCommon(m);return m.commonSpends.filter(x=>x.sourceId==='other').reduce((s,x)=>s+Number(x.amount||0),0)}
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
  const corrections=window.maziFundingAdjustmentNet?window.maziFundingAdjustmentNet(m):0;
  return receivedTotal(m)-actualPaid(m)+externalCommonTotal(m)-savings+corrections;
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
function commonAllocations(m,id){return (m.fundingAllocations||[]).filter(a=>a.targetType==='commonSpend'&&a.targetId===id)}
function commonSavingsTx(id){return (state.savingsTx||[]).find(t=>t.commonSpendId===id)||null}
function existingSource(m,x){
  if(x?.sourceId)return x.sourceId;
  if(commonSavingsTx(x?.id))return 'savings';
  const ids=[...new Set(commonAllocations(m,x?.id).map(a=>a.sourceId).filter(Boolean))];
  if(ids.length===1)return ids[0];
  if(ids.length>1)return 'mixed';
  return '';
}
function commonSourceLabel(m,x){
  const id=existingSource(m,x);
  if(id==='savings')return 'Από την άκρη';
  if(id==='other')return 'Άλλα / εκτός εφαρμογής';
  if(id==='mixed')return 'Από περισσότερες πηγές';
  if(id&&window.maziFundingLabel)return window.maziFundingLabel(m,id);
  return 'Δεν έχει οριστεί πηγή';
}
function oldSavingsAmount(x){
  const tx=commonSavingsTx(x?.id);
  return tx?Math.abs(Number(tx.amount||0)):0;
}
function sourceOptions(m,x){
  const selected=existingSource(m,x),amount=Number(x?.amount||0);
  let out='<option value="">Επίλεξε από πού ξοδέψατε</option>';
  const sources=window.maziFundingSources?window.maziFundingSources(m):[];
  for(const s of sources){
    const own=commonAllocations(m,x?.id).filter(a=>a.sourceId===s.id).reduce((a,v)=>a+Number(v.amount||0),0);
    const left=(window.maziSourceRemaining?window.maziSourceRemaining(m,s.id):0)+own;
    out+='<option value="'+esc(s.id)+'" '+(selected===s.id?'selected':'')+'>'+esc(s.name)+' · διαθέσιμα '+euro(left)+'</option>';
  }
  const savingsAvailable=balanceThroughMonth(m.key)+oldSavingsAmount(x);
  out+='<option value="savings" '+(selected==='savings'?'selected':'')+'>🏦 Από την άκρη · διαθέσιμα '+euro(savingsAvailable)+'</option>';
  out+='<option value="other" '+(selected==='other'?'selected':'')+'>💵 Άλλα / εκτός εφαρμογής</option>';
  if(selected==='mixed')out+='<option value="mixed" selected disabled>Παλιά κατανομή σε περισσότερες πηγές · διάλεξε νέα</option>';
  return out;
}
function canUseCommonSource(m,x,sourceId,amount){
  const a=Math.max(0,Number(amount||0));
  if(sourceId==='other')return true;
  if(sourceId==='savings'){
    const old=oldSavingsAmount(x);
    const candidate=(state.savingsTx||[]).filter(t=>t.commonSpendId!==x?.id);
    candidate.push({id:'preview',date:x?.date||isoToday(),monthKey:m.key,label:'Από την άκρη · κοινό έξοδο',reason:x?.name||'',amount:-a,commonSpendId:x?.id||'preview'});
    return typeof savingsValid==='function'?savingsValid(candidate):a<=balanceThroughMonth(m.key)+old+0.005;
  }
  if(!sourceId||sourceId==='mixed')return false;
  const own=commonAllocations(m,x?.id).filter(v=>v.sourceId===sourceId).reduce((s,v)=>s+Number(v.amount||0),0);
  const available=(window.maziSourceRemaining?window.maziSourceRemaining(m,sourceId):0)+own;
  return a<=available+0.005;
}
function clearCommonSource(m,x){
  if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'commonSpend',x.id);
  state.savingsTx=(state.savingsTx||[]).filter(t=>t.commonSpendId!==x.id);
}
function applyCommonSource(m,x,sourceId){
  clearCommonSource(m,x);
  x.sourceId=sourceId;
  if(sourceId==='savings'){
    state.savingsTx.push({
      id:uid(),date:x.date||isoToday(),monthKey:m.key,
      label:'Από την άκρη · κοινό έξοδο',reason:x.name||'Κοινό έξοδο',
      amount:-Number(x.amount||0),commonSpendId:x.id
    });
  }else if(sourceId!=='other'&&window.maziAllocateFunding){
    window.maziAllocateFunding(m,{
      sourceId,amount:Number(x.amount||0),date:x.date||isoToday(),
      targetType:'commonSpend',targetId:x.id,label:x.name||'Κοινό έξοδο'
    });
  }
}
function commonFundingText(m,x){return 'Από '+commonSourceLabel(m,x)}

function addCommonModal(editId=''){
  const m=ensureCommon(curMonth()),existing=editId?m.commonSpends.find(x=>x.id===editId):null;
  const preview=existing||{id:'',amount:0,date:isoToday(),sourceId:''};
  showModal(existing?'Επεξεργασία κοινού εξόδου':'Κοινό τρέχον έξοδο',
    '<div class="form-grid">'+
    '<div class="field"><label>Τι πήρατε / κάνατε</label><input name="name" required value="'+esc(existing?.name||'')+'" placeholder="π.χ. Σουβλάκια"></div>'+
    '<div class="field"><label>Ποσό</label><input name="amount" type="number" min="0.01" step="0.01" required value="'+(existing?Number(existing.amount||0):'')+'"></div>'+
    '<div class="field"><label>Κατηγορία</label><select name="category">'+categoryOptions(existing?.category||'food')+'</select></div>'+
    '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+esc(existing?.date||isoToday())+'"></div>'+
    '<div class="field" style="grid-column:1/-1"><label>Πληρώθηκε από</label><select name="sourceId" required>'+sourceOptions(m,preview)+'</select></div>'+
    '<div class="field" style="grid-column:1/-1"><label>Σημείωση</label><input name="note" value="'+esc(existing?.note||'')+'" placeholder="π.χ. κοινό έξοδο, όχι προσωπικό"></div>'+
    '</div>'+
    '<div class="notice" style="margin-top:10px"><strong>Διάλεξε την πραγματική πηγή.</strong> Αν είναι μισθός, μειώνεται το διαθέσιμο του συγκεκριμένου μισθού. Αν είναι «Από την άκρη», μειώνεται η αποταμίευση. Δεν αποφασίζει η εφαρμογή μόνη της.</div>',
    fd=>{
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!amount)return false;
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId||sourceId==='mixed'){alert('Διάλεξε από πού πληρώθηκε το έξοδο.');return false}
      const probe=existing?{...existing}:{id:'preview'};
      probe.date=String(fd.get('date')||isoToday());probe.name=String(fd.get('name')||'Κοινό έξοδο');
      if(!canUseCommonSource(m,probe,sourceId,amount)){
        alert(sourceId==='savings'?'Δεν υπάρχουν αρκετά χρήματα στην άκρη για αυτό το έξοδο.':'Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');
        return false;
      }
      const row=existing||{id:uid(),createdAt:isoToday()};
      Object.assign(row,{
        name:String(fd.get('name')||'Κοινό έξοδο').trim()||'Κοινό έξοδο',
        amount,category:String(fd.get('category')||'other'),
        date:String(fd.get('date')||isoToday()),note:String(fd.get('note')||'').trim(),
        updatedAt:isoToday()
      });
      if(!existing)m.commonSpends.push(row);
      applyCommonSource(m,row,sourceId);
    },existing?'Αποθήκευση':'Καταχώριση');
}
function removeCommon(id){
  const m=ensureCommon(curMonth()),x=m.commonSpends.find(v=>v.id===id);if(!x)return;
  if(!confirm('Να διαγραφεί το κοινό έξοδο «'+x.name+'»;'))return;
  clearCommonSource(m,x);
  m.commonSpends=m.commonSpends.filter(v=>v.id!==id);save();render();
}
function availableCard(m){
  const received=receivedTotal(m),paidRecurring=recurringPaid(m),paidExtra=extraPaid(m),common=commonTotal(m),saved=monthSavingsNet(m.key),corrections=window.maziFundingAdjustmentNet?window.maziFundingAdjustmentNet(m):0,avail=availableNow(m);
  const waiting=[...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received!==true).reduce((s,x)=>s+Number(x.amount||0),0);
  return '<section class="live-money-card">'+
    '<div class="live-money-main"><small>Πραγματικά διαθέσιμα τώρα</small><strong class="'+(avail<0?'negative':'positive')+'">'+euro(avail)+'</strong><span>Μόνο με χρήματα που έχουν ήδη μπει.</span></div>'+
    '<div class="live-money-breakdown">'+
      '<div><span>Έσοδα που μπήκαν</span><strong>'+euro(received)+'</strong></div>'+
      '<div><span>Πληρωμές υποχρεώσεων</span><strong>-'+euro(paidRecurring+paidExtra)+'</strong></div>'+
      '<div><span>Κοινά τρέχοντα</span><strong>-'+euro(common)+'</strong></div>'+
      '<div><span>Καθαρή κίνηση άκρης</span><strong>'+(saved>=0?'-':'+')+euro(Math.abs(saved))+'</strong></div>'+
      (Math.abs(corrections)>0.005?'<div><span>Διορθώσεις υπολοίπων</span><strong class="'+(corrections<0?'negative':'positive')+'">'+(corrections>0?'+':'')+euro(corrections)+'</strong></div>':'')+
    '</div>'+
    '<div class="live-money-foot"><span>Αναμένονται ακόμη '+euro(waiting)+' σε έσοδα.</span><button class="btn primary small" id="addCommonSpend">+ Κοινό έξοδο</button></div>'+
  '</section>';
}
function commonSection(m){
  const rows=(m.commonSpends||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return '<details class="common-spend-panel" '+(rows.length?'':'open')+'><summary><div><strong>🛍️ Κοινά τρέχοντα έξοδα</strong><small>Σουβλάκια, δώρα, γλυκά, βόλτες και άλλα μη προγραμματισμένα κοινά έξοδα.</small></div><span>'+euro(commonTotal(m))+'</span></summary>'+
    '<div class="common-spend-body">'+
      (rows.length?'<div class="common-spend-list">'+rows.map(x=>{const [icon,label]=catInfo(x),fund=commonFundingText(m,x);return '<div class="common-spend-row"><div><strong>'+icon+' '+esc(x.name)+'</strong><small>'+esc(label)+' · '+fmtDate(x.date)+(x.note?' · '+esc(x.note):'')+'</small><small class="common-funding">💰 '+esc(fund)+'</small></div><strong>'+euro(x.amount)+'</strong><div class="common-spend-actions"><button class="btn ghost small" data-common-edit="'+x.id+'">Επεξεργασία / πηγή</button><button class="remove" data-common-remove="'+x.id+'">×</button></div></div>'}).join('')+'</div>':'<div class="lifecycle-empty">Δεν έχει καταχωρηθεί κοινό τρέχον έξοδο ακόμη.</div>')+
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