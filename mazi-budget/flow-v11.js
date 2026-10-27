(()=>{
function ensureFlowMonth(m){
  m.expenseMoves=Array.isArray(m.expenseMoves)?m.expenseMoves:[];
  m.extraExpenses=Array.isArray(m.extraExpenses)?m.extraExpenses:[];
  for(const x of m.extraExpenses){
    if(!x.status)x.status='pending';
    if(!x.date)x.date='';
    if(!x.dueDate)x.dueDate='';
    if(!x.method)x.method='Άλλο';
  }
  for(const e of m.expenses||[])if(e.dueDate==null)e.dueDate='';
  return m;
}
for(const m of Object.values(state.months||{}))ensureFlowMonth(m);

const flexibleBudgetIds=new Set(['e8','e9','e10','e13','e14','e15','e16','e17','e18']);

function spentFor(m,id){return (m.expenseMoves||[]).filter(x=>x.expenseId===id).reduce((s,x)=>s+Number(x.amount||0),0)}
function plannedBase(m){return (m.expenses||[]).filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0)}
function actualBase(m){return (m.expenseMoves||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function effectiveRecurring(m,e){const planned=Number(e.amount||0),spent=spentFor(m,e.id);if(flexibleBudgetIds.has(e.id)&&e.paid===true)return spent;return Math.max(planned,spent)}
function adjustedBase(m){return (m.expenses||[]).filter(x=>x.active!==false).reduce((s,e)=>s+effectiveRecurring(m,e),0)}
function oneOffTotal(m){return (m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function unpaidOneOff(m){return (m.extraExpenses||[]).filter(x=>x.status!=='paid').reduce((s,x)=>s+Number(x.amount||0),0)}
function expectedSave(m){return window.maziFinance?window.maziFinance.forecastSavings(m):(monthIncome(m)-monthExpense(m)+(window.maziFundingAdjustmentNet?window.maziFundingAdjustmentNet(m):0))}
function remainingObligations(m){
  if(window.maziFinance)return window.maziFinance.remainingObligations(m);
  const recurring=(m.expenses||[]).filter(x=>x.active!==false&&x.paid!==true).reduce((s,e)=>s+Math.max(0,Number(e.amount||0)-spentFor(m,e.id)),0);
  return recurring+unpaidOneOff(m);
}
function expenseById(m,id){return (m.expenses||[]).find(x=>x.id===id)}
window.maziEffectiveRecurring=effectiveRecurring;
window.maziExpectedSave=expectedSave;
window.maziFlexibleBudgetIds=flexibleBudgetIds;

const baseMonthExpense=monthExpense;
monthExpense=function(m){
  ensureFlowMonth(m);
  return adjustedBase(m)+oneOffTotal(m);
};

const baseRecurringRow=recurringRow;
recurringRow=function(x,test){
  if(test)return baseRecurringRow(x,test);
  const m=ensureFlowMonth(curMonth()),spent=spentFor(m,x.id),planned=Number(x.amount||0),remaining=Math.max(0,planned-spent),over=Math.max(0,spent-planned);
  const detail=spent>0?('Έγιναν '+euro(spent)+' · '+(over>0?'Υπέρβαση '+euro(over):'Μένουν '+euro(remaining))):('Προβλέπονται '+euro(planned));
  const due=x.dueDate?(' · λήξη '+fmtDate(x.dueDate)):'';
  return '<div class="money-row recurring flow-recurring '+(x.active===false?'off':'')+'"><input type="checkbox" '+(x.active===false?'':'checked')+' data-toggle="r-expense" data-id="'+x.id+'"><div class="flow-expense-label"><label>'+esc(x.name)+'</label><small class="'+(over>0?'negative':'')+'">'+detail+due+'</small></div><input type="number" min="0" step="0.01" value="'+planned+'" data-money="r-expense" data-id="'+x.id+'"><div class="flow-row-actions"><button class="btn small soft flow-move-btn" data-expense-move="'+x.id+'">Κίνηση</button><button class="btn small ghost flow-manage-btn" data-expense-manage="'+x.id+'">Υπόλοιπο / κινήσεις</button></div></div>';
};

function flowSavingsTx(moveId){
  return (state.savingsTx||[]).find(x=>x.flowMoveId===moveId||x.personalMoveId===moveId)||null;
}
function flowMoveSourceId(m,move){
  if(flowSavingsTx(move.id))return 'savings';
  const a=window.maziFundingByTarget?window.maziFundingByTarget(m,'move',move.id):null;
  return a?.sourceId||move.sourceId||'';
}
function flowSourceOptions(m,move=null){
  const selected=move?flowMoveSourceId(m,move):'';
  let out='<option value="">Επίλεξε από πού πληρώθηκε</option>';
  const rows=window.maziFundingSources?window.maziFundingSources(m):[];
  for(const x of rows){
    const a=move&&window.maziFundingByTarget?window.maziFundingByTarget(m,'move',move.id):null;
    const own=a?.sourceId===x.id?Number(a.amount||0):0;
    const left=(window.maziSourceRemaining?window.maziSourceRemaining(m,x.id):0)+own;
    out+='<option value="'+esc(x.id)+'" '+(selected===x.id?'selected':'')+'>'+esc(x.name)+' · διαθέσιμα '+euro(left)+'</option>';
  }
  const oldSave=move?Math.abs(Number(flowSavingsTx(move.id)?.amount||0)):0;
  out+='<option value="savings" '+(selected==='savings'?'selected':'')+'>🏦 Από την άκρη · διαθέσιμα '+euro(balanceThroughMonth(m.key)+oldSave)+'</option>';
  out+='<option value="other" '+(selected==='other'?'selected':'')+'>💵 Άλλα / εκτός εφαρμογής</option>';
  return out;
}
function clearFlowMoveSource(m,move){
  if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'move',move.id);
  state.savingsTx=(state.savingsTx||[]).filter(x=>x.flowMoveId!==move.id&&x.personalMoveId!==move.id);
}
function canUseFlowSource(m,move,sourceId,amount){
  const a=Math.max(0,Number(amount||0));
  if(sourceId==='other')return true;
  if(sourceId==='savings'){
    const candidate=(state.savingsTx||[]).filter(x=>x.flowMoveId!==move?.id&&x.personalMoveId!==move?.id);
    candidate.push({id:'preview',date:move?.date||isoToday(),monthKey:m.key,label:'Από την άκρη · πάγιο',reason:move?.reason||'',amount:-a,flowMoveId:move?.id||'preview'});
    return typeof savingsValid==='function'?savingsValid(candidate):a<=balanceThroughMonth(m.key)+Math.abs(Number(flowSavingsTx(move?.id)?.amount||0))+0.005;
  }
  if(!sourceId)return false;
  const current=move&&window.maziFundingByTarget?window.maziFundingByTarget(m,'move',move.id):null;
  const own=current?.sourceId===sourceId?Number(current.amount||0):0;
  const left=(window.maziSourceRemaining?window.maziSourceRemaining(m,sourceId):0)+own;
  return a<=left+0.005;
}
function applyFlowMoveSource(m,move,e,sourceId){
  clearFlowMoveSource(m,move);
  move.sourceId=sourceId;
  if(sourceId==='savings'){
    state.savingsTx.push({id:uid(),date:move.date||isoToday(),monthKey:m.key,label:'Από την άκρη · '+(e?.name||'Πάγιο'),reason:move.reason||'',amount:-Number(move.amount||0),flowMoveId:move.id});
  }else if(sourceId!=='other'&&window.maziAllocateFunding){
    window.maziAllocateFunding(m,{sourceId,amount:Number(move.amount||0),date:move.date,targetType:'move',targetId:move.id,label:e?.name||'Έξοδο'});
  }else if(sourceId==='other'&&window.maziAllocateFunding){
    window.maziAllocateFunding(m,{sourceId:'other',amount:Number(move.amount||0),date:move.date,targetType:'move',targetId:move.id,label:e?.name||'Έξοδο'});
  }
}
function flowMoveSourceLabel(m,move){
  const id=flowMoveSourceId(m,move);
  if(id==='savings')return 'Από την άκρη';
  if(id&&window.maziFundingLabel)return window.maziFundingLabel(m,id);
  return '';
}
function editFlowMoveModal(moveId){
  const m=ensureFlowMonth(curMonth()),move=(m.expenseMoves||[]).find(v=>v.id===moveId);if(!move)return;
  const e=expenseById(m,move.expenseId);if(!e)return;
  const currentSource=flowMoveSourceId(m,move);
  showModal('Επεξεργασία κίνησης · '+e.name,
    '<div class="form-grid">'+
      '<div class="field"><label>Ποσό</label><input name="amount" type="number" min="0.01" step="0.01" value="'+Number(move.amount||0)+'" required></div>'+
      '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+esc(move.date||isoToday())+'"></div>'+
      '<div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+flowSourceOptions(m,move)+'</select></div>'+
      '<div class="field"><label>Σημείωση</label><input name="reason" value="'+esc(move.reason||'')+'"></div>'+
    '</div>'+
    '<div class="notice" style="margin-top:10px">Αλλάζοντας το ποσό, αλλάζει αυτόματα και το υπόλοιπο του budget. Αν η κίνηση ήταν από μισθό ή αποταμίευση, διορθώνεται και η αντίστοιχη πηγή.</div>',
    fd=>{
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!amount)return false;
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      const probe={...move,amount,date:String(fd.get('date')||isoToday()),reason:String(fd.get('reason')||'').trim()};
      if(!canUseFlowSource(m,move,sourceId,amount)){alert(sourceId==='savings'?'Δεν υπάρχουν αρκετά χρήματα στην άκρη.':'Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
      move.amount=amount;move.date=probe.date;move.reason=probe.reason;
      applyFlowMoveSource(m,move,e,sourceId);
      const spent=spentFor(m,e.id);
      if(e.paid===true&&window.maziFlexibleBudgetIds?.has?.(e.id)&&spent<Number(e.amount||0)-0.005){e.paid=false;e.paidAt='';e.updatedAt=isoToday()}
    },'Αποθήκευση');
}
function deleteFlowMove(moveId){
  const m=ensureFlowMonth(curMonth()),move=(m.expenseMoves||[]).find(v=>v.id===moveId);if(!move)return;
  const e=expenseById(m,move.expenseId);
  if(!confirm('Να διαγραφεί η κίνηση '+euro(move.amount)+' από «'+(e?.name||'Πάγιο')+'»;'))return;
  clearFlowMoveSource(m,move);
  m.expenseMoves=m.expenseMoves.filter(x=>x.id!==moveId);
  if(e&&e.paid===true&&window.maziFlexibleBudgetIds?.has?.(e.id)){e.paid=false;e.paidAt='';e.completionMoveId='';e.updatedAt=isoToday()}
  save();render();
}
function manageExpenseMoves(id){
  const m=ensureFlowMonth(curMonth()),e=expenseById(m,id);if(!e)return;
  const list=(m.expenseMoves||[]).filter(x=>x.expenseId===id).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const spent=spentFor(m,id),planned=Number(e.amount||0),remaining=Math.max(0,planned-spent);
  const rows=list.length?list.map(x=>{const src=flowMoveSourceLabel(m,x);return '<div class="move-manager-row"><div><strong>'+fmtDate(x.date)+' · '+euro(x.amount)+'</strong><small>'+(x.reason?esc(x.reason)+' · ':'')+(src?'από '+esc(src):'χωρίς πηγή')+'</small></div><div class="move-manager-actions"><button type="button" class="btn soft small" data-manager-edit="'+x.id+'">Επεξεργασία</button><button type="button" class="btn danger small" data-manager-delete="'+x.id+'">Διαγραφή</button></div></div>'}).join(''):'<div class="salary-audit-empty">Δεν υπάρχει καταχωρημένη κίνηση.</div>';
  showModal('Υπόλοιπο & κινήσεις · '+e.name,
    '<div class="budget-close-summary"><div><small>Αρχικό budget</small><strong>'+euro(planned)+'</strong></div><div><small>Έχουν δοθεί</small><strong>'+euro(spent)+'</strong></div><div><small>Υπόλοιπο τώρα</small><strong class="positive">'+euro(remaining)+'</strong></div></div>'+
    '<div class="notice" style="margin-top:9px">Για να διορθώσεις το υπόλοιπο, επεξεργάσου ή διέγραψε την αντίστοιχη κίνηση. Έτσι διορθώνεται μαζί και η πηγή χρημάτων.</div>'+
    '<div class="move-manager-list">'+rows+'</div>',
    ()=>{},'Κλείσιμο');
  setTimeout(()=>{
    document.querySelectorAll('[data-manager-edit]').forEach(b=>b.onclick=()=>{document.getElementById('modal')?.close();setTimeout(()=>editFlowMoveModal(b.dataset.managerEdit),60)});
    document.querySelectorAll('[data-manager-delete]').forEach(b=>b.onclick=()=>{document.getElementById('modal')?.close();setTimeout(()=>deleteFlowMove(b.dataset.managerDelete),60)});
  },0);
}
window.maziManageExpenseMoves=manageExpenseMoves;
function movementModal(id){
  const m=ensureFlowMonth(curMonth()),e=expenseById(m,id);if(!e)return;
  const spent=spentFor(m,id),remaining=Math.max(0,Number(e.amount||0)-spent);
  const sourceOptions=flowSourceOptions(m);
  showModal('Κίνηση · '+e.name,
    '<div class="form-grid"><div class="field"><label>Ποσό που δόθηκε τώρα</label><input name="amount" type="number" min="0" step="0.01" required></div>'+
    '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+isoToday()+'" required></div>'+
    '<div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+sourceOptions+'</select></div>'+
    '<div class="field"><label>Γιατί / σημείωση</label><input name="reason" placeholder="π.χ. πήραμε καφέδες νωρίτερα"></div>'+
    '<div class="field"><label>Λήξη υποχρέωσης</label><input name="dueDate" type="date" value="'+esc(e.dueDate||'')+'"></div></div>'+
    '<div class="notice" style="margin-top:10px">Προϋπολογισμός: <strong>'+euro(e.amount)+'</strong> · έχουν ήδη γίνει: <strong>'+euro(spent)+'</strong> · μένουν: <strong>'+euro(remaining)+'</strong>.<br>Αν επιλέξεις μισθό ή άλλο έσοδο, θα αφαιρεθεί από το διαθέσιμο υπόλοιπο εκείνης της πηγής.</div>',
    fd=>{
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!amount)return false;
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      const probe={id:'preview',expenseId:id,amount,date:String(fd.get('date')||isoToday()),reason:String(fd.get('reason')||'').trim()};
      if(!canUseFlowSource(m,probe,sourceId,amount)){alert(sourceId==='savings'?'Δεν υπάρχουν αρκετά χρήματα στην άκρη.':'Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
      e.dueDate=String(fd.get('dueDate')||'');
      const move={id:uid(),expenseId:id,amount,date:String(fd.get('date')||isoToday()),reason:String(fd.get('reason')||'').trim()};
      m.expenseMoves.push(move);
      applyFlowMoveSource(m,move,e,sourceId);
    },'Καταχώριση');
}

const baseAddExtra=addExtra;
addExtra=function(code){
  const test=code[0]==='t',kind=code.slice(2);
  if(test||kind==='income')return baseAddExtra(code);
  const m=ensureFlowMonth(curMonth()),due=m.calculationDate||m.key+'-25';
  showModal('Έξοδο μόνο για '+monthLabel(m.key),
    '<div class="form-grid"><div class="field"><label>Τι έγινε / τι αγοράσαμε</label><input name="name" required placeholder="π.χ. Klarna παπούτσια"></div>'+
    '<div class="field"><label>Ποσό</label><input name="amount" type="number" min="0" step="0.01" required></div>'+
    '<div class="field"><label>Ημερομηνία που έγινε</label><input name="date" type="date" value="'+isoToday()+'"></div>'+
    '<div class="field"><label>Πότε πρέπει να πληρωθεί</label><input name="dueDate" type="date" value="'+esc(due)+'"></div>'+
    '<div class="field"><label>Τρόπος</label><select name="method"><option>Klarna</option><option>Χρεωστική / Τράπεζα</option><option>Μετρητά</option><option>Πιστωτική</option><option>Άλλο</option></select></div>'+
    '<div class="field"><label>Κατάσταση</label><select name="status"><option value="pending">Το χρωστάμε / θα πληρωθεί</option><option value="paid">Πληρώθηκε ήδη</option></select></div></div>'+
    '<div class="notice" style="margin-top:10px">Μετράει μόνο σε αυτόν τον κύκλο και μειώνει αμέσως την προβλεπόμενη αποταμίευση. Αν είναι αγορά με πιστωτική και την έχεις ήδη προσθέσει στο ποσό της πιστωτικής, μην τη βάλεις δεύτερη φορά.</div>',
    fd=>{
      m.extraExpenses.push({id:uid(),name:String(fd.get('name')||'Άλλο').trim(),amount:Number(fd.get('amount')||0),date:String(fd.get('date')||isoToday()),dueDate:String(fd.get('dueDate')||due),method:String(fd.get('method')||'Άλλο'),status:String(fd.get('status')||'pending')});
    },'Προσθήκη');
};

function flowForecastHtml(m){
  const save=expectedSave(m),base=adjustedBase(m),extras=oneOffTotal(m),remaining=remainingObligations(m);
  return '<section class="flow-forecast"><div class="flow-forecast-main"><small>Με τα σημερινά δεδομένα, από αυτόν τον μισθό μπορεί να μείνουν για αποταμίευση</small><strong class="'+(save<0?'negative':'positive')+'">'+euro(save)+'</strong><span>Τρέχον κόστος πάγιων/μπάτζετ '+euro(base)+' · έκτακτα '+euro(extras)+' · υποχρεώσεις που απομένουν '+euro(remaining)+'</span></div>'+
  '<div class="whatif"><div class="whatif-title">Αν αγοράσουμε κάτι τώρα…</div><div class="whatif-grid"><input id="whatIfName" placeholder="Τι είναι;"><input id="whatIfAmount" type="number" min="0" step="0.01" placeholder="Ποσό"><select id="whatIfStatus"><option value="paid">Πληρώνεται τώρα</option><option value="pending">Θα το πληρώσουμε αργότερα</option></select><button class="btn soft" id="whatIfCommit">Καταχώριση</button></div><div id="whatIfResult" class="whatif-result">Βάλε ποσό για να δεις πόσα θα μείνουν για αποταμίευση χωρίς να καταχωριστεί τίποτα.</div></div></section>';
}
function movementSourceModal(moveId){
  const m=ensureFlowMonth(curMonth()),move=(m.expenseMoves||[]).find(v=>v.id===moveId);if(!move)return;
  const e=expenseById(m,move.expenseId),opts=flowSourceOptions(m,move);
  showModal('Πηγή πληρωμής · '+(e?.name||'Έξοδο'),
    '<div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+opts+'</select></div>'+
    '<div class="notice" style="margin-top:10px">Ποσό: <strong>'+euro(move.amount)+'</strong> · '+fmtDate(move.date)+'</div>',
    fd=>{
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      if(!canUseFlowSource(m,move,sourceId,move.amount)){alert(sourceId==='savings'?'Δεν υπάρχουν αρκετά χρήματα στην άκρη.':'Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
      applyFlowMoveSource(m,move,e,sourceId);
    },'Αποθήκευση πηγής');
}
function reviewHtml(m){
  const base=plannedBase(m),actual=actualBase(m),extras=oneOffTotal(m),unpaid=unpaidOneOff(m),save=expectedSave(m);
  const overruns=(m.expenses||[]).filter(e=>e.active!==false&&spentFor(m,e.id)>Number(e.amount||0));
  const moves=(m.expenseMoves||[]).slice().reverse();
  const oneoffs=(m.extraExpenses||[]).slice().reverse();
  return '<section class="section flow-review"><div class="section-head"><div><h2>Απολογισμός κύκλου</h2><p>Για να βλέπετε στο τέλος τι πήγε σύμφωνα με το πλάνο και τι προέκυψε στην πορεία.</p></div></div>'+
  '<div class="review-kpis"><div><small>Προγραμματισμένα πάγια/μπάτζετ</small><strong>'+euro(base)+'</strong></div><div><small>Καταγεγραμμένες κινήσεις μέσα στα πάγια</small><strong>'+euro(actual)+'</strong></div><div><small>Έκτακτα εκτός πλάνου</small><strong>'+euro(extras)+'</strong></div><div><small>Απλήρωτα έκτακτα</small><strong>'+euro(unpaid)+'</strong></div><div class="review-save"><small>Πιθανή αποταμίευση κύκλου</small><strong class="'+(save<0?'negative':'positive')+'">'+euro(save)+'</strong></div></div>'+
  (overruns.length?'<div class="review-block"><h3>Υπερβάσεις</h3>'+overruns.map(e=>'<div class="review-line"><span>'+esc(e.name)+'</span><strong class="negative">+'+euro(spentFor(m,e.id)-Number(e.amount||0))+'</strong></div>').join('')+'</div>':'')+
  (oneoffs.length?'<div class="review-block"><h3>Έκτακτα έξοδα</h3>'+oneoffs.map(x=>{const due=window.maziDueFor?window.maziDueFor(x):(x.status==='paid'?0:Number(x.amount||0));const paid=Math.max(0,Number(x.amount||0)-due);let source='';if(Array.isArray(x.payments)&&window.maziFundingByTarget&&window.maziFundingLabel){const names=[...new Set(x.payments.map(p=>window.maziFundingByTarget(m,'extraPayment',p.id)).filter(Boolean).map(a=>window.maziFundingLabel(m,a.sourceId)).filter(Boolean))];source=names.length===1?' · από '+names[0]:names.length>1?' · από '+names.length+' πηγές':''}return '<div class="review-line review-extra-line"><span>'+esc(fmtDate(x.date||isoToday()))+' · '+esc(x.name)+' · '+esc(x.method||'Άλλο')+esc(source)+(paid>0&&due>0.005?' · πληρώθηκαν '+euro(paid):'')+'</span><div class="history-actions"><strong>'+euro(x.amount)+'</strong><button class="btn soft small" data-review-extra-edit="'+x.id+'">'+(due<=0.005?'Επεξεργασία / πηγή':'Πληρωμές / πηγή')+'</button></div></div>'}).join('')+'</div>':'')+
  (moves.length?'<div class="review-block"><h3>Πότε χρησιμοποιήθηκαν τα πάγια/μπάτζετ</h3>'+moves.map(x=>{const e=expenseById(m,x.expenseId),srcName=flowMoveSourceLabel(m,x),src=srcName?(' · από '+srcName):'',a=srcName;return '<div class="review-line"><span>'+esc(fmtDate(x.date))+' · '+esc(e?.name||'Έξοδο')+(x.reason?' · '+esc(x.reason):'')+esc(src)+'</span><div class="history-actions"><strong>'+euro(x.amount)+'</strong><button class="btn soft small" data-move-source="'+x.id+'">'+(a?'Πηγή':'Ορισμός πηγής')+'</button><button class="remove" style="width:28px;height:28px" data-remove-move="'+x.id+'">×</button></div></div>'}).join('')+'</div>':'')+
  '</section>';
}
function bindFlowPanels(){
  const m=ensureFlowMonth(curMonth());
  document.querySelectorAll('[data-expense-move]').forEach(b=>b.onclick=()=>movementModal(b.dataset.expenseMove));
  document.querySelectorAll('[data-expense-manage]').forEach(b=>b.onclick=()=>manageExpenseMoves(b.dataset.expenseManage));
  document.querySelectorAll('[data-move-source]').forEach(b=>b.onclick=()=>movementSourceModal(b.dataset.moveSource));
  document.querySelectorAll('[data-review-extra-edit]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.reviewExtraEdit,x=(m.extraExpenses||[]).find(v=>v.id===id);if(!x)return;
    const due=window.maziDueFor?window.maziDueFor(x):(x.status==='paid'?0:Number(x.amount||0));
    if(due<=0.005&&(window.maziEditCompletedExtra||window.maziPaymentModal))return (window.maziEditCompletedExtra||window.maziPaymentModal)(id);
    window.maziPaymentModal?.(id);
  });
  document.querySelectorAll('[data-remove-move]').forEach(b=>b.onclick=()=>deleteFlowMove(b.dataset.removeMove));
  const amt=document.getElementById('whatIfAmount'),res=document.getElementById('whatIfResult');
  const update=()=>{if(!amt||!res)return;const a=Math.max(0,Number(amt.value||0));if(!a){res.textContent='Βάλε ποσό για να δεις πόσα θα μείνουν για αποταμίευση χωρίς να καταχωριστεί τίποτα.';return}const after=expectedSave(m)-a;res.innerHTML='Αν γίνει αυτή η αγορά, η πιθανή αποταμίευση πέφτει από <strong>'+euro(expectedSave(m))+'</strong> σε <strong class="'+(after<0?'negative':'positive')+'">'+euro(after)+'</strong>.'};
  if(amt){amt.oninput=update;update()}
  const commit=document.getElementById('whatIfCommit');
  if(commit)commit.onclick=()=>{
    const a=Math.max(0,Number(document.getElementById('whatIfAmount')?.value||0));if(!a){alert('Βάλε πρώτα ποσό.');return}
    const name=String(document.getElementById('whatIfName')?.value||'Έκτακτη αγορά').trim()||'Έκτακτη αγορά';
    const status=String(document.getElementById('whatIfStatus')?.value||'paid');
    m.extraExpenses.push({id:uid(),name,amount:a,date:isoToday(),dueDate:m.calculationDate||m.key+'-25',method:'Άλλο',status});
    save();render();
  };
}
const baseBind=bind;
bind=function(){baseBind();document.querySelectorAll('[data-expense-move]').forEach(b=>b.onclick=()=>movementModal(b.dataset.expenseMove))};

const baseRender=render;
render=function(){
  baseRender();
  if(view!=='real')return;
  const app=document.getElementById('app'),m=ensureFlowMonth(curMonth());
  const cycle=app?.querySelector('.cycle-banner');
  if(cycle)cycle.insertAdjacentHTML('afterend',flowForecastHtml(m));
  else app?.insertAdjacentHTML('afterbegin',flowForecastHtml(m));
  app?.insertAdjacentHTML('beforeend',reviewHtml(m));
  bindFlowPanels();
};
save();
render();
})();