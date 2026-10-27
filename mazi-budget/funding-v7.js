(()=>{
function ensureFunding(m){
  if(!m)return m;
  m.fundingAllocations=Array.isArray(m.fundingAllocations)?m.fundingAllocations:[];
  m.salaryTransfers=Array.isArray(m.salaryTransfers)?m.salaryTransfers:[];
  return m;
}
function knownIncomeSources(m){
  ensureFunding(m);
  const regular=(m.incomes||[]).map(x=>({...x,_kind:'income'}));
  const extra=(m.extraIncomes||[]).map(x=>({...x,_kind:'extraIncome'}));
  return [...regular,...extra];
}
function sourceBaseReceived(x){
  if(!x||x.received!==true)return 0;
  return Number(x.receivedAmount==null?x.amount:x.receivedAmount)||0;
}
function sourceUsed(m,id){
  ensureFunding(m);
  return m.fundingAllocations.filter(a=>a.sourceId===id).reduce((s,a)=>s+Number(a.amount||0),0);
}
function transferIn(m,id){
  ensureFunding(m);
  return m.salaryTransfers.filter(t=>t.toSourceId===id).reduce((s,t)=>s+Number(t.amount||0),0);
}
function transferOut(m,id){
  ensureFunding(m);
  return m.salaryTransfers.filter(t=>t.fromSourceId===id).reduce((s,t)=>s+Number(t.amount||0),0);
}
function sourceRemaining(m,id){
  const x=knownIncomeSources(m).find(v=>v.id===id);if(!x)return 0;
  return sourceBaseReceived(x)+transferIn(m,id)-transferOut(m,id)-sourceUsed(m,id);
}
function allIncomeSources(m){
  return knownIncomeSources(m).filter(x=>x.received===true||sourceRemaining(m,x.id)>0.005);
}
function sourceLabel(m,id){
  if(!id)return 'Δεν ορίστηκε';
  if(id==='other')return 'Άλλα / εκτός εφαρμογής';
  const x=knownIncomeSources(m).find(v=>v.id===id);
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
function transferOptions(m,type){
  const rows=type==='from'?allIncomeSources(m):knownIncomeSources(m);
  let out='<option value="">'+(type==='from'?'Από ποιο υπόλοιπο':'Προς ποιο υπόλοιπο')+'</option>';
  for(const x of rows){
    const left=sourceRemaining(m,x.id);
    const suffix=type==='from'?' · διαθέσιμα '+euro(left):(x.received===true?' · μπήκε':' · δεν έχει μπει ακόμα');
    out+='<option value="'+esc(x.id)+'">'+esc(x.name)+suffix+'</option>';
  }
  return out;
}
function transferModal(){
  const m=ensureFunding(curMonth()),from=allIncomeSources(m),to=knownIncomeSources(m);
  if(!from.length){alert('Δεν υπάρχει διαθέσιμο έσοδο για μεταφορά.');return}
  if(to.length<2){alert('Χρειάζονται τουλάχιστον δύο έσοδα για μεταφορά.');return}
  showModal('Μεταφορά μεταξύ εσόδων',
    '<div class="form-grid">'+
      '<div class="field"><label>Από</label><select name="fromSourceId" required>'+transferOptions(m,'from')+'</select></div>'+
      '<div class="field"><label>Προς</label><select name="toSourceId" required>'+transferOptions(m,'to')+'</select></div>'+
      '<div class="field"><label>Ποσό</label><input name="amount" type="number" min="0.01" step="0.01" required></div>'+
      '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+isoToday()+'"></div>'+
      '<div class="field" style="grid-column:1/-1"><label>Σημείωση</label><input name="note" placeholder="π.χ. μεταφορά για προσωπικά Μάνου"></div>'+
    '</div>'+
    '<div class="notice" style="margin-top:10px">Η μεταφορά <strong>δεν είναι έξοδο ούτε νέο έσοδο</strong>. Μετακινεί μόνο το διαθέσιμο υπόλοιπο από τη μία πηγή στην άλλη.</div>',
    fd=>{
      const fromSourceId=String(fd.get('fromSourceId')||''),toSourceId=String(fd.get('toSourceId')||'');
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!fromSourceId||!toSourceId||!amount)return false;
      if(fromSourceId===toSourceId){alert('Διάλεξε διαφορετική πηγή προέλευσης και προορισμού.');return false}
      if(amount>sourceRemaining(m,fromSourceId)+0.005){alert('Δεν υπάρχουν αρκετά διαθέσιμα σε αυτό το έσοδο.');return false}
      m.salaryTransfers.push({
        id:uid(),fromSourceId,toSourceId,amount,
        date:String(fd.get('date')||isoToday()),
        note:String(fd.get('note')||'').trim()
      });
    },'Μεταφορά');
}
function removeTransfer(id){
  const m=ensureFunding(curMonth()),t=m.salaryTransfers.find(x=>x.id===id);if(!t)return;
  const destAfter=sourceRemaining(m,t.toSourceId)-Number(t.amount||0);
  if(destAfter<-0.005){
    alert('Δεν γίνεται να διαγραφεί αυτή η μεταφορά, γιατί έχουν ήδη χρησιμοποιηθεί χρήματα από το ποσό που μεταφέρθηκε.');
    return;
  }
  if(!confirm('Να διαγραφεί αυτή η μεταφορά;'))return;
  m.salaryTransfers=m.salaryTransfers.filter(x=>x.id!==id);save();render();
}
function fundingCards(m){
  ensureFunding(m);
  const rows=knownIncomeSources(m).filter(x=>x.received===true||Math.abs(transferIn(m,x.id)-transferOut(m,x.id))>0.005);
  if(!rows.length)return '';
  const history=m.salaryTransfers.slice().reverse();
  return '<section class="funding-wallets">'+
    '<div class="funding-wallets-head"><div><small>Κατανομή πληρωμών</small><strong>Υπόλοιπα ανά έσοδο</strong></div><div class="funding-head-actions"><span>οι πληρωμές μειώνουν το έσοδο που δήλωσες ως πραγματική πηγή</span><button class="btn soft small" id="fundingTransferBtn">↔ Μεταφορά</button></div></div>'+
    '<div class="funding-wallet-grid">'+rows.map(x=>{
      const got=sourceBaseReceived(x),used=sourceUsed(m,x.id),incoming=transferIn(m,x.id),outgoing=transferOut(m,x.id),left=sourceRemaining(m,x.id);
      const transferText=(incoming||outgoing)?'<small class="funding-transfer-mini">'+(incoming?('Μεταφέρθηκαν μέσα +'+euro(incoming)):'')+(incoming&&outgoing?' · ':'')+(outgoing?('έξω -'+euro(outgoing)):'')+'</small>':'';
      return '<div class="funding-wallet"><div><strong>'+esc(x.name)+'</strong><small>'+(x.received===true?'Μπήκαν '+euro(got):'Δεν έχει μπει ακόμη')+'</small>'+transferText+'</div><div class="funding-wallet-numbers"><span>Χρησιμοποιήθηκαν '+euro(used)+'</span><strong class="'+(left<0?'negative':'')+'">'+euro(left)+' διαθέσιμα</strong></div></div>';
    }).join('')+'</div>'+
    '<div class="funding-transfer-toolbar"><button class="btn soft" id="fundingTransferBtnBottom">↔ Μεταφορά μεταξύ μισθών / εσόδων</button><small>Μετακινεί μόνο το διαθέσιμο υπόλοιπο. Δεν είναι έξοδο ούτε νέο έσοδο.</small></div>'+
    (history.length?'<div class="funding-transfer-history"><div class="funding-transfer-title">Ιστορικό μεταφορών</div>'+history.map(t=>'<div class="funding-transfer-row"><div><strong>'+esc(sourceLabel(m,t.fromSourceId))+' → '+esc(sourceLabel(m,t.toSourceId))+'</strong><small>'+fmtDate(t.date)+(t.note?' · '+esc(t.note):'')+'</small></div><strong>'+euro(t.amount)+'</strong><button class="remove" data-funding-transfer-remove="'+t.id+'">×</button></div>').join('')+'</div>':'')+
  '</section>';
}
function bindFundingTransfers(){
  const btn=document.getElementById('fundingTransferBtn');if(btn)btn.onclick=transferModal;
  const btnBottom=document.getElementById('fundingTransferBtnBottom');if(btnBottom)btnBottom.onclick=transferModal;
  document.querySelectorAll('[data-funding-transfer-remove]').forEach(b=>b.onclick=()=>removeTransfer(b.dataset.fundingTransferRemove));
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
window.maziTransferModal=transferModal;
window.maziBindFundingTransfers=bindFundingTransfers;
for(const m of Object.values(state.months||{}))ensureFunding(m);
localStorage.setItem(storeKey,JSON.stringify(state));
})();