(()=>{
function ensureFunding(m){
  if(!m)return m;
  m.fundingAllocations=Array.isArray(m.fundingAllocations)?m.fundingAllocations:[];
  return m;
}
function allIncomeSources(m){
  ensureFunding(m);
  const regular=(m.incomes||[]).map(x=>({...x,_kind:'income'}));
  const extra=(m.extraIncomes||[]).map(x=>({...x,_kind:'extraIncome'}));
  return [...regular,...extra].filter(x=>x.received===true);
}
function sourceReceived(x){return Number(x.receivedAmount==null?x.amount:x.receivedAmount)||0}
function sourceUsed(m,id){ensureFunding(m);return m.fundingAllocations.filter(a=>a.sourceId===id).reduce((s,a)=>s+Number(a.amount||0),0)}
function sourceRemaining(m,id){
  const x=allIncomeSources(m).find(v=>v.id===id);if(!x)return 0;
  return sourceReceived(x)-sourceUsed(m,id);
}
function sourceLabel(m,id){
  if(!id)return 'Δεν ορίστηκε';
  if(id==='other')return 'Άλλα / εκτός εφαρμογής';
  const x=allIncomeSources(m).find(v=>v.id===id)||[...(m.incomes||[]),...(m.extraIncomes||[])].find(v=>v.id===id);
  return x?x.name:'Άγνωστη πηγή';
}
function fundingOptions(m,selected='',amount=0){
  const rows=allIncomeSources(m);
  let out='<option value="">Επίλεξε από πού πληρώθηκε</option>';
  for(const x of rows){
    const left=sourceRemaining(m,x.id)+(x.id===selected?Number(amount||0):0);
    out+='<option value="'+esc(x.id)+'" '+(x.id===selected?'selected':'')+'>'+esc(x.name)+' · διαθέσιμα '+euro(left)+'</option>';
  }
  out+='<option value="other" '+(selected==='other'?'selected':'')+'>Άλλα / εκτός εφαρμογής</option>';
  return out;
}
function canAllocate(m,sourceId,amount,excludeId=''){
  if(!sourceId||sourceId==='other')return true;
  const reserved=excludeId?(m.fundingAllocations||[]).find(a=>a.id===excludeId):null;
  const available=sourceRemaining(m,sourceId)+(reserved&&reserved.sourceId===sourceId?Number(reserved.amount||0):0);
  return Number(amount||0)<=available+0.005;
}
function allocate(m,{sourceId,amount,date,targetType,targetId,label,id}){
  ensureFunding(m);
  const a=Math.max(0,Number(amount||0));if(!a||!sourceId)return null;
  if(!canAllocate(m,sourceId,a,id||''))return false;
  let row=id?m.fundingAllocations.find(x=>x.id===id):null;
  if(!row){row={id:id||uid()};m.fundingAllocations.push(row)}
  Object.assign(row,{sourceId,amount:a,date:date||isoToday(),targetType:targetType||'expense',targetId:targetId||'',label:String(label||'Πληρωμή')});
  return row;
}
function removeByTarget(m,type,id){
  ensureFunding(m);
  m.fundingAllocations=m.fundingAllocations.filter(a=>!(a.targetType===type&&a.targetId===id));
}
function allocationByTarget(m,type,id){
  ensureFunding(m);
  return m.fundingAllocations.find(a=>a.targetType===type&&a.targetId===id)||null;
}
function fundingCards(m){
  const rows=allIncomeSources(m);if(!rows.length)return '';
  return '<section class="funding-wallets"><div class="funding-wallets-head"><div><small>Κατανομή πληρωμών</small><strong>Υπόλοιπα ανά έσοδο</strong></div><span>οι πληρωμές και τα κοινά καθημερινά κατανέμονται πάνω στα έσοδα που έχουν ήδη μπει</span></div><div class="funding-wallet-grid">'+rows.map(x=>{
    const got=sourceReceived(x),used=sourceUsed(m,x.id),left=got-used;
    return '<div class="funding-wallet"><div><strong>'+esc(x.name)+'</strong><small>Μπήκαν '+euro(got)+'</small></div><div class="funding-wallet-numbers"><span>Χρησιμοποιήθηκαν '+euro(used)+'</span><strong class="'+(left<0?'negative':'')+'">'+euro(left)+' διαθέσιμα</strong></div></div>';
  }).join('')+'</div></section>';
}
window.maziEnsureFunding=ensureFunding;
window.maziFundingSources=allIncomeSources;
window.maziFundingOptions=fundingOptions;
window.maziFundingLabel=sourceLabel;
window.maziSourceRemaining=sourceRemaining;
window.maziCanAllocate=canAllocate;
window.maziAllocateFunding=allocate;
window.maziRemoveFundingByTarget=removeByTarget;
window.maziFundingByTarget=allocationByTarget;
window.maziFundingCards=fundingCards;
for(const m of Object.values(state.months||{}))ensureFunding(m);
localStorage.setItem(storeKey,JSON.stringify(state));
})();