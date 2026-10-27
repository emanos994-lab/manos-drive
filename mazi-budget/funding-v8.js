(()=>{
function ensureFunding(m){
  if(!m)return m;
  m.fundingAllocations=Array.isArray(m.fundingAllocations)?m.fundingAllocations:[];
  m.salaryTransfers=Array.isArray(m.salaryTransfers)?m.salaryTransfers:[];
  m.salaryAdjustments=Array.isArray(m.salaryAdjustments)?m.salaryAdjustments:[];
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
function adjustmentNet(m,id=''){
  ensureFunding(m);
  return m.salaryAdjustments.filter(a=>!id||a.sourceId===id).reduce((s,a)=>s+Number(a.amount||0),0);
}
function removeAdjustment(id){
  const m=ensureFunding(curMonth()),a=m.salaryAdjustments.find(x=>x.id===id);if(!a)return;
  if(!confirm('Να διαγραφεί αυτή η διόρθωση υπολοίπου;'))return;
  m.salaryAdjustments=m.salaryAdjustments.filter(x=>x.id!==id);
  save();render();
}
function sourceRemaining(m,id){
  const x=knownIncomeSources(m).find(v=>v.id===id);if(!x)return 0;
  return sourceBaseReceived(x)+transferIn(m,id)-transferOut(m,id)+adjustmentNet(m,id)-sourceUsed(m,id);
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
function allocationTypeLabel(a){
  const map={move:'Πάγιο / budget',extraPayment:'Έκτακτο / Klarna',commonSpend:'Κοινό έξοδο'};
  return map[a.targetType]||'Πληρωμή';
}
function allocationSourceOptions(m,a){
  const rows=knownIncomeSources(m);
  let out='';
  for(const x of rows){
    const own=a.sourceId===x.id?Number(a.amount||0):0;
    const left=sourceRemaining(m,x.id)+own;
    out+='<option value="'+esc(x.id)+'" '+(a.sourceId===x.id?'selected':'')+'>'+esc(x.name)+' · διαθέσιμα '+euro(left)+'</option>';
  }
  out+='<option value="other" '+(a.sourceId==='other'?'selected':'')+'>Άλλα / εκτός εφαρμογής</option>';
  return out;
}
function editAllocationSource(allocationId){
  const m=ensureFunding(curMonth()),a=m.fundingAllocations.find(x=>x.id===allocationId);if(!a)return;
  const current=a.sourceId;
  showModal('Αλλαγή πηγής · '+a.label,
    '<div class="field"><label>Η πληρωμή των '+euro(a.amount)+' έγινε από</label><select name="sourceId" required>'+allocationSourceOptions(m,a)+'</select></div>'+
    '<div class="notice" style="margin-top:10px">'+fmtDate(a.date)+' · '+esc(allocationTypeLabel(a))+'<br>Αλλάζοντας πηγή, το ποσό επιστρέφει στον παλιό μισθό και αφαιρείται από τον νέο.</div>',
    fd=>{
      const next=String(fd.get('sourceId')||'');if(!next)return false;
      if(next===current)return;
      const old=a.sourceId;
      a.sourceId=next;
      if(next!=='other'&&sourceRemaining(m,next)<-0.005){
        a.sourceId=old;
        alert('Δεν υπάρχουν αρκετά διαθέσιμα στη νέα πηγή για αυτή τη μεταφορά.');
        return false;
      }
    },'Αποθήκευση');
}
function sourceAuditModal(sourceId){
  const m=ensureFunding(curMonth()),src=knownIncomeSources(m).find(x=>x.id===sourceId);if(!src)return;
  const got=sourceBaseReceived(src),incoming=transferIn(m,sourceId),outgoing=transferOut(m,sourceId),adjusted=adjustmentNet(m,sourceId);
  const allocs=m.fundingAllocations.filter(a=>a.sourceId===sourceId).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const used=allocs.reduce((s,a)=>s+Number(a.amount||0),0),left=sourceRemaining(m,sourceId);
  const transfers=m.salaryTransfers.filter(t=>t.fromSourceId===sourceId||t.toSourceId===sourceId).slice().reverse();
  const adjustments=m.salaryAdjustments.filter(a=>a.sourceId===sourceId).slice().reverse();
  const allocationRows=allocs.length?allocs.map(a=>'<div class="salary-audit-row"><div><strong>'+esc(a.label||'Πληρωμή')+'</strong><small>'+fmtDate(a.date)+' · '+esc(allocationTypeLabel(a))+'</small></div><strong>-'+euro(a.amount)+'</strong><button type="button" class="btn soft small" data-audit-allocation="'+a.id+'">Αλλαγή πηγής</button></div>').join(''):'<div class="salary-audit-empty">Δεν υπάρχουν χρεώσεις σε αυτό το έσοδο.</div>';
  const transferRows=transfers.length?'<div class="salary-audit-subtitle">Μεταφορές</div>'+transfers.map(t=>{const incomingRow=t.toSourceId===sourceId;return '<div class="salary-audit-row transfer"><div><strong>'+(incomingRow?'Από ':'Προς ')+esc(sourceLabel(m,incomingRow?t.fromSourceId:t.toSourceId))+'</strong><small>'+fmtDate(t.date)+(t.note?' · '+esc(t.note):'')+'</small></div><strong class="'+(incomingRow?'positive':'')+'">'+(incomingRow?'+':'-')+euro(t.amount)+'</strong><span></span></div>'}).join(''):'';
  const adjustmentRows=adjustments.length?'<div class="salary-audit-subtitle">Διορθώσεις υπολοίπου</div>'+adjustments.map(a=>'<div class="salary-audit-row adjustment"><div><strong>Διόρθωση υπολοίπου</strong><small>'+fmtDate(a.date)+(a.reason?' · '+esc(a.reason):'')+'</small></div><strong class="'+(Number(a.amount||0)>=0?'positive':'negative')+'">'+(Number(a.amount||0)>=0?'+':'-')+euro(Math.abs(Number(a.amount||0)))+'</strong><button type="button" class="remove" data-salary-adjust-remove="'+a.id+'">×</button></div>').join(''):'';
  showModal('Ανάλυση · '+src.name,
    '<div class="salary-audit-kpis"><div><small>Μπήκαν</small><strong>'+euro(got)+'</strong></div><div><small>Χρησιμοποιήθηκαν</small><strong>'+euro(used)+'</strong></div><div><small>Μεταφορές</small><strong>'+(incoming-outgoing>=0?'+':'')+euro(incoming-outgoing)+'</strong></div><div><small>Διορθώσεις</small><strong class="'+(adjusted<0?'negative':'')+'">'+(adjusted>=0?'+':'')+euro(adjusted)+'</strong></div><div><small>Η εφαρμογή δείχνει</small><strong class="'+(left<0?'negative':'positive')+'">'+euro(left)+'</strong></div></div>'+
    '<div class="salary-audit-note">Εδώ βλέπεις ακριβώς τι έχει αφαιρεθεί από αυτόν τον μισθό. Αν κάτι χρεώθηκε λάθος, πάτα <strong>Αλλαγή πηγής</strong>.</div>'+
    '<div class="salary-compare"><input id="salaryActualBalance" type="number" step="0.01" placeholder="Πραγματικό υπόλοιπο στην τράπεζα"><button type="button" class="btn soft" id="salaryCompareBtn">Σύγκριση</button><button type="button" class="btn primary" id="salaryCorrectBtn">Διόρθωση υπολοίπου</button><div id="salaryCompareResult"></div></div>'+
    '<div class="salary-audit-subtitle">Χρεώσεις</div>'+allocationRows+transferRows+adjustmentRows,
    ()=>{},'Κλείσιμο');
  setTimeout(()=>{
    document.querySelectorAll('[data-audit-allocation]').forEach(b=>b.onclick=()=>{
      document.getElementById('modal')?.close();
      setTimeout(()=>editAllocationSource(b.dataset.auditAllocation),60);
    });
    const compare=document.getElementById('salaryCompareBtn');
    const readActual=()=>Number(document.getElementById('salaryActualBalance')?.value);
    const showDiff=()=>{
      const actual=readActual(),out=document.getElementById('salaryCompareResult');if(!out||!Number.isFinite(actual))return null;
      const diff=actual-sourceRemaining(m,sourceId);
      if(Math.abs(diff)<0.005)out.innerHTML='<strong class="positive">Ταιριάζει ακριβώς.</strong>';
      else if(diff>0)out.innerHTML='Η εφαρμογή δείχνει <strong class="negative">'+euro(Math.abs(diff))+' λιγότερα</strong> από όσα έχεις πραγματικά.';
      else out.innerHTML='Η εφαρμογή δείχνει <strong class="negative">'+euro(Math.abs(diff))+' περισσότερα</strong> από όσα έχεις πραγματικά.';
      return diff;
    };
    if(compare)compare.onclick=showDiff;
    const correct=document.getElementById('salaryCorrectBtn');
    if(correct)correct.onclick=()=>{
      const actual=readActual();if(!Number.isFinite(actual)){alert('Γράψε πρώτα το πραγματικό υπόλοιπο.');return}
      const before=sourceRemaining(m,sourceId),diff=actual-before;
      if(Math.abs(diff)<0.005){alert('Το υπόλοιπο ήδη ταιριάζει.');return}
      m.salaryAdjustments.push({id:uid(),sourceId,amount:diff,date:isoToday(),reason:'Χειροκίνητη συμφωνία υπολοίπου',before,actual});
      save();document.getElementById('modal')?.close();render();
    };
    document.querySelectorAll('[data-salary-adjust-remove]').forEach(b=>b.onclick=()=>{document.getElementById('modal')?.close();setTimeout(()=>removeAdjustment(b.dataset.salaryAdjustRemove),60)});
  },0);
}
function fundingCards(m){
  ensureFunding(m);
  const rows=knownIncomeSources(m).filter(x=>x.received===true||Math.abs(transferIn(m,x.id)-transferOut(m,x.id))>0.005);
  if(!rows.length)return '';
  const history=m.salaryTransfers.slice().reverse();
  return '<section class="funding-wallets">'+
    '<div class="funding-wallets-head"><div><small>Κατανομή πληρωμών</small><strong>Υπόλοιπα ανά έσοδο</strong></div><div class="funding-head-actions"><span>οι πληρωμές μειώνουν το έσοδο που δήλωσες ως πραγματική πηγή</span><button class="btn soft small" id="fundingTransferBtn">↔ Μεταφορά</button></div></div>'+
    '<div class="funding-wallet-grid">'+rows.map(x=>{
      const got=sourceBaseReceived(x),used=sourceUsed(m,x.id),incoming=transferIn(m,x.id),outgoing=transferOut(m,x.id),adj=adjustmentNet(m,x.id),left=sourceRemaining(m,x.id);
      const transferText=(incoming||outgoing||adj)?'<small class="funding-transfer-mini">'+(incoming?('Μεταφέρθηκαν μέσα +'+euro(incoming)):'')+(incoming&&(outgoing||adj)?' · ':'')+(outgoing?('έξω -'+euro(outgoing)):'')+(outgoing&&adj?' · ':'')+(adj?('διόρθωση '+(adj>0?'+':'')+euro(adj)):'')+'</small>':'';
      return '<div class="funding-wallet"><div><strong>'+esc(x.name)+'</strong><small>'+(x.received===true?'Μπήκαν '+euro(got):'Δεν έχει μπει ακόμη')+'</small>'+transferText+'</div><div class="funding-wallet-numbers"><span>Χρησιμοποιήθηκαν '+euro(used)+'</span><strong class="'+(left<0?'negative':'')+'">'+euro(left)+' διαθέσιμα</strong><button class="btn ghost small funding-audit-btn" data-funding-audit="'+x.id+'">Ανάλυση</button></div></div>';
    }).join('')+'</div>'+
    '<div class="funding-transfer-toolbar"><button class="btn soft" id="fundingTransferBtnBottom">↔ Μεταφορά μεταξύ μισθών / εσόδων</button><small>Μετακινεί μόνο το διαθέσιμο υπόλοιπο. Δεν είναι έξοδο ούτε νέο έσοδο.</small></div>'+
    (history.length?'<div class="funding-transfer-history"><div class="funding-transfer-title">Ιστορικό μεταφορών</div>'+history.map(t=>'<div class="funding-transfer-row"><div><strong>'+esc(sourceLabel(m,t.fromSourceId))+' → '+esc(sourceLabel(m,t.toSourceId))+'</strong><small>'+fmtDate(t.date)+(t.note?' · '+esc(t.note):'')+'</small></div><strong>'+euro(t.amount)+'</strong><button class="remove" data-funding-transfer-remove="'+t.id+'">×</button></div>').join('')+'</div>':'')+
  '</section>';
}
function bindFundingTransfers(){
  const btn=document.getElementById('fundingTransferBtn');if(btn)btn.onclick=transferModal;
  const btnBottom=document.getElementById('fundingTransferBtnBottom');if(btnBottom)btnBottom.onclick=transferModal;
  document.querySelectorAll('[data-funding-transfer-remove]').forEach(b=>b.onclick=()=>removeTransfer(b.dataset.fundingTransferRemove));
  document.querySelectorAll('[data-funding-audit]').forEach(b=>b.onclick=()=>sourceAuditModal(b.dataset.fundingAudit));
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
window.maziSourceAudit=sourceAuditModal;
window.maziFundingAdjustmentNet=adjustmentNet;
window.maziBindFundingTransfers=bindFundingTransfers;
for(const m of Object.values(state.months||{}))ensureFunding(m);
localStorage.setItem(storeKey,JSON.stringify(state));
})();