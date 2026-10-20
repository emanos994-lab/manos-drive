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

function spentFor(m,id){return (m.expenseMoves||[]).filter(x=>x.expenseId===id).reduce((s,x)=>s+Number(x.amount||0),0)}
function plannedBase(m){return (m.expenses||[]).filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0)}
function actualBase(m){return (m.expenseMoves||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function adjustedBase(m){return (m.expenses||[]).filter(x=>x.active!==false).reduce((s,e)=>s+Math.max(Number(e.amount||0),spentFor(m,e.id)),0)}
function oneOffTotal(m){return (m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function unpaidOneOff(m){return (m.extraExpenses||[]).filter(x=>x.status!=='paid').reduce((s,x)=>s+Number(x.amount||0),0)}
function expectedSave(m){return monthIncome(m)-monthExpense(m)}
function remainingObligations(m){
  const recurring=(m.expenses||[]).filter(x=>x.active!==false).reduce((s,e)=>s+Math.max(0,Number(e.amount||0)-spentFor(m,e.id)),0);
  return recurring+unpaidOneOff(m);
}
function expenseById(m,id){return (m.expenses||[]).find(x=>x.id===id)}

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
  return '<div class="money-row recurring flow-recurring '+(x.active===false?'off':'')+'"><input type="checkbox" '+(x.active===false?'':'checked')+' data-toggle="r-expense" data-id="'+x.id+'"><div class="flow-expense-label"><label>'+esc(x.name)+'</label><small class="'+(over>0?'negative':'')+'">'+detail+due+'</small></div><input type="number" min="0" step="0.01" value="'+planned+'" data-money="r-expense" data-id="'+x.id+'"><button class="btn small soft flow-move-btn" data-expense-move="'+x.id+'">Κίνηση</button></div>';
};

function movementModal(id){
  const m=ensureFlowMonth(curMonth()),e=expenseById(m,id);if(!e)return;
  const spent=spentFor(m,id),remaining=Math.max(0,Number(e.amount||0)-spent);
  showModal('Κίνηση · '+e.name,
    '<div class="form-grid"><div class="field"><label>Ποσό που δόθηκε τώρα</label><input name="amount" type="number" min="0" step="0.01" required></div>'+
    '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+isoToday()+'" required></div>'+
    '<div class="field"><label>Γιατί / σημείωση</label><input name="reason" placeholder="π.χ. πήραμε καφέδες νωρίτερα"></div>'+
    '<div class="field"><label>Λήξη υποχρέωσης</label><input name="dueDate" type="date" value="'+esc(e.dueDate||'')+'"></div></div>'+
    '<div class="notice" style="margin-top:10px">Προϋπολογισμός: <strong>'+euro(e.amount)+'</strong> · έχουν ήδη γίνει: <strong>'+euro(spent)+'</strong> · μένουν: <strong>'+euro(remaining)+'</strong>.<br>Η κίνηση <strong>δεν προστίθεται δεύτερη φορά</strong> στα έξοδα. Απλώς δείχνει πόσο από το πάγιο/μπάτζετ έχει ήδη χρησιμοποιηθεί.</div>',
    fd=>{
      const amount=Math.max(0,Number(fd.get('amount')||0));if(!amount)return false;
      e.dueDate=String(fd.get('dueDate')||'');
      m.expenseMoves.push({id:uid(),expenseId:id,amount,date:String(fd.get('date')||isoToday()),reason:String(fd.get('reason')||'').trim()});
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
  const save=expectedSave(m),base=plannedBase(m),extras=oneOffTotal(m),remaining=remainingObligations(m);
  return '<section class="flow-forecast"><div class="flow-forecast-main"><small>Με τα σημερινά δεδομένα, από αυτόν τον μισθό μπορεί να μείνουν για αποταμίευση</small><strong class="'+(save<0?'negative':'positive')+'">'+euro(save)+'</strong><span>Πάγια/μπάτζετ '+euro(base)+' · έκτακτα '+euro(extras)+' · υποχρεώσεις που απομένουν '+euro(remaining)+'</span></div>'+
  '<div class="whatif"><div class="whatif-title">Αν αγοράσουμε κάτι τώρα…</div><div class="whatif-grid"><input id="whatIfName" placeholder="Τι είναι;"><input id="whatIfAmount" type="number" min="0" step="0.01" placeholder="Ποσό"><select id="whatIfStatus"><option value="paid">Πληρώνεται τώρα</option><option value="pending">Θα το πληρώσουμε αργότερα</option></select><button class="btn soft" id="whatIfCommit">Καταχώριση</button></div><div id="whatIfResult" class="whatif-result">Βάλε ποσό για να δεις πόσα θα μείνουν για αποταμίευση χωρίς να καταχωριστεί τίποτα.</div></div></section>';
}
function reviewHtml(m){
  const base=plannedBase(m),actual=actualBase(m),extras=oneOffTotal(m),unpaid=unpaidOneOff(m),save=expectedSave(m);
  const overruns=(m.expenses||[]).filter(e=>e.active!==false&&spentFor(m,e.id)>Number(e.amount||0));
  const moves=(m.expenseMoves||[]).slice().reverse();
  const oneoffs=(m.extraExpenses||[]).slice().reverse();
  return '<section class="section flow-review"><div class="section-head"><div><h2>Απολογισμός κύκλου</h2><p>Για να βλέπετε στο τέλος τι πήγε σύμφωνα με το πλάνο και τι προέκυψε στην πορεία.</p></div></div>'+
  '<div class="review-kpis"><div><small>Προγραμματισμένα πάγια/μπάτζετ</small><strong>'+euro(base)+'</strong></div><div><small>Καταγεγραμμένες κινήσεις μέσα στα πάγια</small><strong>'+euro(actual)+'</strong></div><div><small>Έκτακτα εκτός πλάνου</small><strong>'+euro(extras)+'</strong></div><div><small>Απλήρωτα έκτακτα</small><strong>'+euro(unpaid)+'</strong></div><div class="review-save"><small>Πιθανή αποταμίευση κύκλου</small><strong class="'+(save<0?'negative':'positive')+'">'+euro(save)+'</strong></div></div>'+
  (overruns.length?'<div class="review-block"><h3>Υπερβάσεις</h3>'+overruns.map(e=>'<div class="review-line"><span>'+esc(e.name)+'</span><strong class="negative">+'+euro(spentFor(m,e.id)-Number(e.amount||0))+'</strong></div>').join('')+'</div>':'')+
  (oneoffs.length?'<div class="review-block"><h3>Έκτακτα έξοδα</h3>'+oneoffs.map(x=>'<div class="review-line"><span>'+esc(fmtDate(x.date||isoToday()))+' · '+esc(x.name)+' · '+esc(x.method||'Άλλο')+'</span><strong>'+euro(x.amount)+'</strong></div>').join('')+'</div>':'')+
  (moves.length?'<div class="review-block"><h3>Πότε χρησιμοποιήθηκαν τα πάγια/μπάτζετ</h3>'+moves.map(x=>{const e=expenseById(m,x.expenseId);return '<div class="review-line"><span>'+esc(fmtDate(x.date))+' · '+esc(e?.name||'Έξοδο')+(x.reason?' · '+esc(x.reason):'')+'</span><div class="history-actions"><strong>'+euro(x.amount)+'</strong><button class="remove" style="width:28px;height:28px" data-remove-move="'+x.id+'">×</button></div></div>'}).join('')+'</div>':'')+
  '</section>';
}
function bindFlowPanels(){
  const m=ensureFlowMonth(curMonth());
  document.querySelectorAll('[data-expense-move]').forEach(b=>b.onclick=()=>movementModal(b.dataset.expenseMove));
  document.querySelectorAll('[data-remove-move]').forEach(b=>b.onclick=()=>{m.expenseMoves=m.expenseMoves.filter(x=>x.id!==b.dataset.removeMove);save();render()});
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