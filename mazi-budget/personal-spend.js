(()=>{
const PEOPLE={
  e17:{name:'Μάνος',icon:'👤'},
  e18:{name:'Πένυ',icon:'👤'}
};
function ensurePersonal(m){
  m.expenseMoves=Array.isArray(m.expenseMoves)?m.expenseMoves:[];
  m.fundingAllocations=Array.isArray(m.fundingAllocations)?m.fundingAllocations:[];
  return m;
}
function expense(m,id){return (m.expenses||[]).find(x=>x.id===id)}
function moves(m,id){return (m.expenseMoves||[]).filter(x=>x.expenseId===id)}
function spent(m,id){return moves(m,id).reduce((s,x)=>s+Number(x.amount||0),0)}
function remaining(m,id){const e=expense(m,id);return Math.max(0,Number(e?.amount||0)-spent(m,id))}
function savingsTxFor(moveId){return (state.savingsTx||[]).find(x=>x.personalMoveId===moveId)||null}
function allocationFor(m,moveId){return (m.fundingAllocations||[]).find(a=>a.targetType==='move'&&a.targetId===moveId)||null}
function moveSourceId(m,move){
  if(savingsTxFor(move.id))return 'savings';
  const a=allocationFor(m,move.id);return a?.sourceId||move.sourceId||'';
}
function sourceName(m,move){
  const id=moveSourceId(m,move);
  if(id==='savings')return 'Από την άκρη';
  if(id==='other')return 'Άλλα / εκτός εφαρμογής';
  if(id&&window.maziFundingLabel)return window.maziFundingLabel(m,id);
  return 'Δεν έχει οριστεί πηγή';
}
function oldSourceAmount(m,move,sourceId){
  if(sourceId==='savings')return Math.abs(Number(savingsTxFor(move.id)?.amount||0));
  const a=allocationFor(m,move.id);
  return a?.sourceId===sourceId?Number(a.amount||0):0;
}
function sourceOptions(m,move=null){
  const selected=move?moveSourceId(m,move):'';
  let out='<option value="">Επίλεξε από πού δόθηκαν τα χρήματα</option>';
  const sources=window.maziFundingSources?window.maziFundingSources(m):[];
  for(const s of sources){
    const own=move?oldSourceAmount(m,move,s.id):0;
    const left=(window.maziSourceRemaining?window.maziSourceRemaining(m,s.id):0)+own;
    out+='<option value="'+esc(s.id)+'" '+(selected===s.id?'selected':'')+'>'+esc(s.name)+' · διαθέσιμα '+euro(left)+'</option>';
  }
  const savings=balanceThroughMonth(m.key)+(move?oldSourceAmount(m,move,'savings'):0);
  out+='<option value="savings" '+(selected==='savings'?'selected':'')+'>🏦 Από την άκρη · διαθέσιμα '+euro(savings)+'</option>';
  out+='<option value="other" '+(selected==='other'?'selected':'')+'>💵 Άλλα / εκτός εφαρμογής</option>';
  return out;
}
function canUse(m,move,sourceId,amount){
  const a=Number(amount||0);
  if(sourceId==='other')return true;
  if(sourceId==='savings'){
    const candidate=(state.savingsTx||[]).filter(x=>x.personalMoveId!==move?.id);
    candidate.push({id:'preview',date:move?.date||isoToday(),monthKey:m.key,label:'Από την άκρη · προσωπικά',reason:move?.reason||'',amount:-a,personalMoveId:move?.id||'preview'});
    return typeof savingsValid==='function'?savingsValid(candidate):a<=balanceThroughMonth(m.key)+(move?oldSourceAmount(m,move,'savings'):0)+0.005;
  }
  if(!sourceId)return false;
  const left=(window.maziSourceRemaining?window.maziSourceRemaining(m,sourceId):0)+(move?oldSourceAmount(m,move,sourceId):0);
  return a<=left+0.005;
}
function clearSource(m,move){
  if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'move',move.id);
  state.savingsTx=(state.savingsTx||[]).filter(x=>x.personalMoveId!==move.id);
}
function applySource(m,move,sourceId){
  clearSource(m,move);
  move.sourceId=sourceId;
  if(sourceId==='savings'){
    state.savingsTx.push({
      id:uid(),date:move.date||isoToday(),monthKey:m.key,
      label:'Από την άκρη · προσωπικά '+(PEOPLE[move.expenseId]?.name||''),
      reason:move.reason||'Προσωπική δαπάνη',amount:-Number(move.amount||0),
      personalMoveId:move.id
    });
  }else if(sourceId!=='other'&&window.maziAllocateFunding){
    window.maziAllocateFunding(m,{
      sourceId,amount:Number(move.amount||0),date:move.date||isoToday(),
      targetType:'move',targetId:move.id,label:'Προσωπικά '+(PEOPLE[move.expenseId]?.name||'')
    });
  }
}
function personalModal(expenseId,moveId=''){
  const m=ensurePersonal(curMonth()),e=expense(m,expenseId);if(!e)return;
  const old=moveId?moves(m,expenseId).find(x=>x.id===moveId):null;
  const rem=remaining(m,expenseId)+(old?Number(old.amount||0):0);
  showModal(old?'Επεξεργασία προσωπικής δαπάνης':'Προσωπική δαπάνη · '+PEOPLE[expenseId].name,
    '<div class="form-grid">'+
    '<div class="field"><label>Ποσό</label><input name="amount" type="number" min="0.01" step="0.01" required value="'+(old?Number(old.amount||0):'')+'"></div>'+
    '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+esc(old?.date||isoToday())+'" required></div>'+
    '<div class="field" style="grid-column:1/-1"><label>Πληρώθηκε από</label><select name="sourceId" required>'+sourceOptions(m,old)+'</select></div>'+
    '<div class="field" style="grid-column:1/-1"><label>Τι ήταν</label><input name="reason" value="'+esc(old?.reason||'')+'" placeholder="π.χ. στοίχημα, ρούχα, έξοδος"></div>'+
    '</div>'+
    '<div class="notice" style="margin-top:10px">Προσωπικό budget '+PEOPLE[expenseId].name+': <strong>'+euro(e.amount)+'</strong> · διαθέσιμο πριν από αυτή την κίνηση: <strong>'+euro(rem)+'</strong>.<br>Η δαπάνη μειώνει το προσωπικό budget, ενώ η πηγή δείχνει από πού βγήκαν πραγματικά τα χρήματα.</div>',
    fd=>{
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!amount)return false;
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      const probe=old?{...old}:{id:'preview',expenseId};
      probe.amount=amount;probe.date=String(fd.get('date')||isoToday());probe.reason=String(fd.get('reason')||'').trim();
      if(!canUse(m,old||probe,sourceId,amount)){
        alert(sourceId==='savings'?'Δεν υπάρχουν αρκετά χρήματα στην άκρη.':'Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');
        return false;
      }
      const row=old||{id:uid(),expenseId,personalSpend:true};
      if(old)clearSource(m,row);
      Object.assign(row,{amount,date:probe.date,reason:probe.reason,personalSpend:true});
      if(!old)m.expenseMoves.push(row);
      applySource(m,row,sourceId);
    },old?'Αποθήκευση':'Καταχώριση');
}
function removePersonal(moveId){
  const m=ensurePersonal(curMonth()),move=(m.expenseMoves||[]).find(x=>x.id===moveId);if(!move)return;
  if(!confirm('Να διαγραφεί αυτή η προσωπική δαπάνη;'))return;
  clearSource(m,move);
  m.expenseMoves=m.expenseMoves.filter(x=>x.id!==moveId);save();render();
}
function personCard(m,id){
  const e=expense(m,id);if(!e)return '';
  const list=moves(m,id),used=spent(m,id),left=Math.max(0,Number(e.amount||0)-used),over=Math.max(0,used-Number(e.amount||0));
  return '<div class="personal-card">'+
    '<div class="personal-head"><div><small>Προσωπικό budget</small><strong>'+PEOPLE[id].icon+' '+PEOPLE[id].name+'</strong></div><button class="btn soft small" data-personal-add="'+id+'">+ Δαπάνη</button></div>'+
    '<div class="personal-kpis"><div><span>Budget</span><strong>'+euro(e.amount)+'</strong></div><div><span>Χρησιμοποιήθηκαν</span><strong>'+euro(used)+'</strong></div><div><span>'+(over>0?'Υπέρβαση':'Μένουν')+'</span><strong class="'+(over>0?'negative':'positive')+'">'+euro(over>0?over:left)+'</strong></div></div>'+
    (list.length?'<div class="personal-history">'+list.slice().reverse().map(x=>'<div class="personal-row"><div><strong>'+esc(x.reason||'Προσωπική δαπάνη')+'</strong><small>'+fmtDate(x.date)+' · '+esc(sourceName(m,x))+'</small></div><strong>'+euro(x.amount)+'</strong><div><button class="btn ghost small" data-personal-edit="'+x.id+'" data-expense-id="'+id+'">Επεξεργασία</button><button class="remove" data-personal-remove="'+x.id+'">×</button></div></div>').join('')+'</div>':'<div class="personal-empty">Δεν έχει καταχωρηθεί προσωπική δαπάνη ακόμα.</div>')+
  '</div>';
}
function personalSection(m){
  return '<section class="personal-budgets"><div class="personal-section-head"><div><small>Προσωπικά χρήματα</small><strong>Budget Μάνου & Πένυς</strong><span>Το budget λέει πόσα δικαιούται ο καθένας. Η πηγή λέει από πού βγήκαν τα λεφτά.</span></div></div><div class="personal-grid">'+personCard(m,'e17')+personCard(m,'e18')+'</div></section>';
}
function bindPersonal(){
  document.querySelectorAll('[data-personal-add]').forEach(b=>b.onclick=()=>personalModal(b.dataset.personalAdd));
  document.querySelectorAll('[data-personal-edit]').forEach(b=>b.onclick=()=>personalModal(b.dataset.expenseId,b.dataset.personalEdit));
  document.querySelectorAll('[data-personal-remove]').forEach(b=>b.onclick=()=>removePersonal(b.dataset.personalRemove));
}
const previousRender=render;
render=function(){
  previousRender();
  if(view!=='real')return;
  const app=document.getElementById('app'),m=ensurePersonal(curMonth());if(!app)return;
  app.querySelector('.personal-budgets')?.remove();
  const common=app.querySelector('.common-spend-panel');
  const oneoff=app.querySelector('[data-clean-panel="oneoff"]');
  const anchor=common||oneoff||app.querySelector('.clean-dashboard');
  if(anchor)anchor.insertAdjacentHTML('afterend',personalSection(m));
  else app.insertAdjacentHTML('beforeend',personalSection(m));
  bindPersonal();
};
render();
})();