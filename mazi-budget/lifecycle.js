(()=>{
const budgetIds=new Set(['e8','e9','e10','e13','e14','e15','e16','e17','e18']);
function paidExtra(x){
  if(window.maziDueFor)return window.maziDueFor(x)<=0.005;
  return x.status==='paid';
}
function moneyEmoji(x,kind){
  const ids={i1:'💼',i2:'💻',i3:'🍽️',i4:'🏠',i5:'💵',i6:'💼',e1:'🏦',e2:'🚗',e3:'🛋️',e4:'💳',e5:'📱',e6:'💅',e7:'🛡️',e8:'🥬',e9:'🥩',e10:'⛽',e11:'🩺',e12:'🩺',e13:'☕',e14:'🚬',e15:'🚬',e16:'🛒',e17:'👤',e18:'👤',e19:'⚡',e20:'💧',e21:'🏢'};
  return ids[x?.id]||(kind==='income'?'💰':'🧾');
}
function ensureLifecycle(){
  for(const m of Object.values(state.months||{})){
    for(const x of m.incomes||[]){if(x.received==null)x.received=false}
    for(const x of m.extraIncomes||[]){if(x.received==null)x.received=false}
    for(const x of m.expenses||[]){if(x.paid==null)x.paid=false}
  }
}
ensureLifecycle();

function receiveIncome(kind,id){
  const m=curMonth(),list=kind==='extraIncome'?m.extraIncomes:m.incomes,x=list.find(v=>v.id===id);if(!x)return;
  x.received=true;x.receivedAt=isoToday();x.receivedAmount=Number(x.amount||0);x.updatedAt=isoToday();save();render();
}
function undoIncome(kind,id){
  const m=curMonth(),list=kind==='extraIncome'?m.extraIncomes:m.incomes,x=list.find(v=>v.id===id);if(!x)return;
  const used=(m.fundingAllocations||[]).filter(a=>a.sourceId===id).reduce((s,a)=>s+Number(a.amount||0),0);
  if(used>0.005){alert('Δεν μπορεί να γίνει επαναφορά όσο υπάρχουν πληρωμές '+euro(used)+' συνδεδεμένες με αυτό το έσοδο. Άλλαξε πρώτα την πηγή αυτών των πληρωμών.');return}
  x.received=false;x.receivedAt='';x.receivedAmount=null;x.updatedAt=isoToday();save();render();
}
function finishRecurring(id){
  const m=curMonth(),x=(m.expenses||[]).find(v=>v.id===id);if(!x)return;
  if(budgetIds.has(x.id)){
    m.expenseMoves=Array.isArray(m.expenseMoves)?m.expenseMoves:[];
    const spent=m.expenseMoves.filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0);
    const planned=Number(x.amount||0),freed=Math.max(0,planned-spent),over=Math.max(0,spent-planned);
    showModal('Κλείσιμο budget · '+x.name,
      '<div class="budget-close-summary"><div><small>Budget</small><strong>'+euro(planned)+'</strong></div><div><small>Χρησιμοποιήθηκαν</small><strong>'+euro(spent)+'</strong></div><div><small>'+(over>0?'Υπέρβαση':'Ελευθερώνονται')+'</small><strong class="'+(over>0?'negative':'positive')+'">'+euro(over>0?over:freed)+'</strong></div></div>'+
      '<div class="notice" style="margin-top:10px">'+(freed>0.005?'Το υπόλοιπο <strong>'+euro(freed)+'</strong> δεν θα μετράει πλέον σαν έξοδο και θα αυξήσει αυτόματα την πιθανή αποταμίευση του κύκλου.':'Το budget θα κλείσει με το ποσό που έχει ήδη χρησιμοποιηθεί.')+'</div>',
      ()=>{x.paid=true;x.paidAt=isoToday();x.updatedAt=isoToday();},'Κλείσιμο budget');
    return;
  }
  m.expenseMoves=Array.isArray(m.expenseMoves)?m.expenseMoves:[];
  const spent=m.expenseMoves.filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0);
  const remain=Math.max(0,Number(x.amount||0)-spent);
  if(remain<=0.005){x.paid=true;x.paidAt=isoToday();x.updatedAt=isoToday();save();render();return}
  const opts=window.maziFundingOptions?window.maziFundingOptions(m):'<option value="other">Άλλα / εκτός εφαρμογής</option>';
  showModal('Πληρωμή · '+x.name,
    '<div class="form-grid"><div class="field"><label>Ποσό που κλείνει τώρα</label><input name="amount" type="number" value="'+remain+'" readonly></div>'+
    '<div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+isoToday()+'" required></div>'+
    '<div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+opts+'</select></div>'+
    '<div class="field"><label>Σημείωση</label><input name="reason" placeholder="π.χ. από μισθό Πένυς"></div></div>'+
    '<div class="notice" style="margin-top:10px">Υπόλοιπο υποχρέωσης: <strong>'+euro(remain)+'</strong>. Η πηγή που θα επιλέξεις θα μειωθεί αντίστοιχα.</div>',
    fd=>{
      const amount=Math.max(0,Math.min(remain,Number(fd.get('amount')||0)));if(!amount)return false;
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      if(window.maziCanAllocate&&!window.maziCanAllocate(m,sourceId,amount)){alert('Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
      const date=String(fd.get('date')||isoToday()),move={id:uid(),expenseId:x.id,amount,date,reason:String(fd.get('reason')||'Εξόφληση').trim()||'Εξόφληση'};
      m.expenseMoves.push(move);
      if(window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId,amount,date,targetType:'move',targetId:move.id,label:x.name});
      const total=m.expenseMoves.filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0);
      if(total>=Number(x.amount||0)-0.005){x.paid=true;x.paidAt=date;x.completionMoveId=move.id}
      x.updatedAt=date;
    },'Πληρωμή & κλείσιμο');
}
function undoRecurring(id){
  const m=curMonth(),x=(m.expenses||[]).find(v=>v.id===id);if(!x)return;
  if(x.completionMoveId&&Array.isArray(m.expenseMoves)){if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'move',x.completionMoveId);m.expenseMoves=m.expenseMoves.filter(v=>v.id!==x.completionMoveId);}
  x.completionMoveId='';x.paid=false;x.paidAt='';x.updatedAt=isoToday();save();render();
}
function receivedIncomeTotal(m){return [...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received===true).reduce((s,x)=>s+Number(x.amount||0),0)}
function pendingIncomeTotal(m){return [...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received!==true).reduce((s,x)=>s+Number(x.amount||0),0)}
function statusStrip(m){
  const got=receivedIncomeTotal(m),waiting=pendingIncomeTotal(m);
  const done=(m.expenses||[]).filter(x=>x.active!==false&&x.paid===true).reduce((s,x)=>{if(budgetIds.has(x.id))return s+(m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((a,v)=>a+Number(v.amount||0),0);return s+Number(x.amount||0)},0);
  const pending=(m.expenses||[]).filter(x=>x.active!==false&&x.paid!==true).reduce((s,x)=>s+Math.max(0,Number(x.amount||0)-((m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((a,v)=>a+Number(v.amount||0),0))),0);
  return '<section class="cycle-live-status"><div><small>💰 Έσοδα που ήρθαν</small><strong>'+euro(got)+'</strong><span>Αναμένονται '+euro(waiting)+'</span></div><div><small>✅ Υποχρεώσεις που έκλεισαν</small><strong>'+euro(done)+'</strong><span>Εκκρεμούν περίπου '+euro(pending)+'</span></div></section>';
}
const oldIncomeRow=incomeRow;
incomeRow=function(x,kind,test,fixed){
  if(test)return oldIncomeRow(x,kind,test,fixed);
  if(x.received===true){
    const m=curMonth();
    const total=Number(x.receivedAmount==null?x.amount:x.receivedAmount);
    const left=window.maziSourceRemaining?window.maziSourceRemaining(m,x.id):total;
    const used=Math.max(0,total-left);
    return '<div class="received-income-row"><div><div class="received-income-title"><strong>'+moneyEmoji(x,'income')+' '+esc(x.name)+'</strong><span>✓ Μπήκε</span></div><small>'+fmtDate(x.receivedAt||x.updatedAt||isoToday())+' · αρχικό '+euro(total)+(used>0?' · χρησιμοποιήθηκαν '+euro(used):'')+'</small></div><div class="received-income-balance"><small>Διαθέσιμα</small><strong class="'+(left<0?'negative':'positive')+'">'+euro(left)+'</strong></div><button class="btn ghost small" data-income-undo="'+kind+'" data-id="'+x.id+'">Επαναφορά</button></div>';
  }
  let h=oldIncomeRow(x,kind,test,fixed);
  if(!h)return h;
  h=h.replace('class="money-row ','class="money-row lifecycle-income ');
  const b='<button class="btn small lifecycle-done income-done" data-income-done="'+kind+'" data-id="'+x.id+'">✓ Μπήκε</button>';
  return h.endsWith('</div>')?h.slice(0,-6)+b+'</div>':h+b;
};
const oldRecurringRow=recurringRow;
recurringRow=function(x,test){
  if(test)return oldRecurringRow(x,test);
  if(x.paid===true)return '';
  let h=oldRecurringRow(x,test);
  if(!h)return h;
  h=h.replace('class="money-row ','class="money-row lifecycle-expense ');
  const label=budgetIds.has(x.id)?'✓ Κλείσιμο':'✓ Πληρώθηκε';
  const b='<button class="btn small lifecycle-done expense-done" data-expense-done="'+x.id+'">'+label+'</button>';
  return h.endsWith('</div>')?h.slice(0,-6)+b+'</div>':h+b;
};
const oldExtraRow=extraExpenseRow;
extraExpenseRow=function(x,test){
  if(test)return oldExtraRow(x,test);
  if(paidExtra(x))return '';
  return oldExtraRow(x,test);
};
function assignRecurringSource(id){
  const m=curMonth(),x=(m.expenses||[]).find(v=>v.id===id);if(!x)return;
  m.expenseMoves=Array.isArray(m.expenseMoves)?m.expenseMoves:[];
  let move=x.completionMoveId?m.expenseMoves.find(v=>v.id===x.completionMoveId):null;
  if(!move){
    const candidates=m.expenseMoves.filter(v=>v.expenseId===x.id);
    move=candidates[candidates.length-1]||null;
  }
  if(!move){
    move={id:uid(),expenseId:x.id,amount:Number(x.amount||0),date:x.paidAt||x.updatedAt||isoToday(),reason:'Εξόφληση · παλιά καταχώρηση'};
    m.expenseMoves.push(move);
  }
  x.completionMoveId=move.id;
  const current=window.maziFundingByTarget?window.maziFundingByTarget(m,'move',move.id):null;
  const opts=window.maziFundingOptions?window.maziFundingOptions(m,current?.sourceId||'',move.amount):'<option value="other">Άλλα / εκτός εφαρμογής</option>';
  showModal('Πηγή πληρωμής · '+x.name,
    '<div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+opts+'</select></div>'+
    '<div class="notice" style="margin-top:10px">Ποσό πληρωμής: <strong>'+euro(move.amount)+'</strong></div>',
    fd=>{
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      if(current&&window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'move',move.id);
      if(window.maziCanAllocate&&!window.maziCanAllocate(m,sourceId,move.amount)){if(current&&window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId:current.sourceId,amount:current.amount,date:current.date,targetType:'move',targetId:move.id,label:current.label});alert('Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
      if(window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId,amount:move.amount,date:move.date,targetType:'move',targetId:move.id,label:x.name});
    },'Αποθήκευση πηγής');
}
function completedExtrasInline(m){
  const extras=(m.extraExpenses||[]).filter(paidExtra);
  if(!extras.length)return '';
  const rows=extras.map(x=>{
    const allocs=(x.payments||[]).map(p=>window.maziFundingByTarget?window.maziFundingByTarget(m,'extraPayment',p.id):null).filter(Boolean);
    const names=[...new Set(allocs.map(a=>window.maziFundingLabel?window.maziFundingLabel(m,a.sourceId):'').filter(Boolean))];
    const source=names.length===1?'Πληρώθηκε από '+names[0]:names.length>1?'Πληρώθηκε από '+names.length+' πηγές':'Δεν έχει οριστεί πηγή πληρωμής';
    const has=allocs.length>0;
    return '<div class="completed-extra-inline"><div><strong>🧾 '+esc(x.name)+'</strong><small>'+esc(source)+(x.updatedAt?' · '+fmtDate(x.updatedAt):'')+'</small></div><strong>'+euro(x.amount)+'</strong><button class="btn '+(has?'ghost':'soft')+' small" data-extra-edit="'+x.id+'">'+(has?'Επεξεργασία / πηγή':'Ορισμός πηγής')+'</button></div>';
  }).join('');
  return '<div class="completed-extra-box"><div class="completed-extra-head"><div><small>Ήδη εξοφλημένα</small><strong>Ολοκληρωμένα έκτακτα</strong></div><span>Μπορείς να ορίσεις ή να αλλάξεις από πού πληρώθηκαν.</span></div>'+rows+'</div>';
}
function completedHtml(m){
  const incomes=[...(m.incomes||[]).map(x=>({...x,_kind:'income'})),...(m.extraIncomes||[]).map(x=>({...x,_kind:'extraIncome'}))].filter(x=>x.received===true);
  const expenses=(m.expenses||[]).filter(x=>x.active!==false&&x.paid===true);
  const extras=(m.extraExpenses||[]).filter(paidExtra);
  if(!incomes.length&&!expenses.length&&!extras.length)return '';
  const rows=[];
  for(const x of incomes){const left=window.maziSourceRemaining?window.maziSourceRemaining(m,x.id):Number(x.receivedAmount==null?x.amount:x.receivedAmount);rows.push('<div class="completed-row"><div><strong>'+moneyEmoji(x,'income')+' '+esc(x.name)+'</strong><small>Μπήκε '+fmtDate(x.receivedAt||x.updatedAt||isoToday())+' · διαθέσιμα '+euro(left)+'</small></div><strong class="positive">'+euro(x.receivedAmount==null?x.amount:x.receivedAmount)+'</strong><button class="btn ghost small" data-income-undo="'+x._kind+'" data-id="'+x.id+'">Επαναφορά</button></div>')}
  for(const x of expenses){const a=x.completionMoveId&&window.maziFundingByTarget?window.maziFundingByTarget(m,'move',x.completionMoveId):null,src=a&&window.maziFundingLabel?' · από '+esc(window.maziFundingLabel(m,a.sourceId)):'',isBudget=budgetIds.has(x.id),used=isBudget?(m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0):Number(x.amount||0),freed=isBudget?Math.max(0,Number(x.amount||0)-used):0,meta=isBudget?('Έκλεισε '+fmtDate(x.paidAt||x.updatedAt||isoToday())+' · χρησιμοποιήθηκαν '+euro(used)+' από '+euro(x.amount)+(freed>0.005?' · ελευθερώθηκαν '+euro(freed):'')):('Πληρώθηκε '+fmtDate(x.paidAt||x.updatedAt||isoToday())+src);rows.push('<div class="completed-row"><div><strong>'+moneyEmoji(x,'expense')+' '+esc(x.name)+'</strong><small>'+meta+'</small></div><strong>'+euro(used)+'</strong><div class="completed-actions">'+(isBudget&&window.maziManageExpenseMoves?'<button class="btn soft small" data-expense-manage-completed="'+x.id+'">Υπόλοιπο / κινήσεις</button>':(!isBudget?'<button class="btn soft small" data-expense-source="'+x.id+'">'+(a?'Αλλαγή πηγής':'Ορισμός πηγής')+'</button>':''))+'<button class="btn ghost small" data-expense-undo="'+x.id+'">Επαναφορά</button></div></div>')}
  for(const x of extras){const allocs=(x.payments||[]).map(p=>window.maziFundingByTarget?window.maziFundingByTarget(m,'extraPayment',p.id):null).filter(Boolean),srcs=[...new Set(allocs.map(a=>window.maziFundingLabel?window.maziFundingLabel(m,a.sourceId):''))].filter(Boolean),src=srcs.length===1?' · από '+esc(srcs[0]):srcs.length>1?' · από '+srcs.length+' πηγές':'',hasSource=allocs.length>0;rows.push('<div class="completed-row"><div><strong>🧾 '+esc(x.name)+'</strong><small>Εξοφλήθηκε'+(x.updatedAt?' · '+fmtDate(x.updatedAt):'')+src+'</small></div><strong>'+euro(x.amount)+'</strong>'+(window.maziPaymentModal?'<button class="btn '+(hasSource?'ghost':'soft')+' small" data-extra-edit="'+x.id+'">'+(hasSource?'Επεξεργασία / πηγή':'Ορισμός πηγής')+'</button>':'<span></span>')+'</div>')}
  return '<details class="completed-panel"><summary><span>✓ Ολοκληρωμένα αυτού του κύκλου</span><small>'+rows.length+' εγγραφές</small></summary><div class="completed-list">'+rows.join('')+'</div></details>';
}
function bindLifecycle(){
  document.querySelectorAll('[data-income-done]').forEach(b=>b.onclick=()=>receiveIncome(b.dataset.incomeDone,b.dataset.id));
  document.querySelectorAll('[data-income-undo]').forEach(b=>b.onclick=()=>undoIncome(b.dataset.incomeUndo,b.dataset.id));
  document.querySelectorAll('[data-expense-done]').forEach(b=>b.onclick=()=>finishRecurring(b.dataset.expenseDone));
  document.querySelectorAll('[data-expense-undo]').forEach(b=>b.onclick=()=>undoRecurring(b.dataset.expenseUndo));
  document.querySelectorAll('[data-expense-source]').forEach(b=>b.onclick=()=>assignRecurringSource(b.dataset.expenseSource));
  document.querySelectorAll('[data-expense-manage-completed]').forEach(b=>b.onclick=()=>window.maziManageExpenseMoves?.(b.dataset.expenseManageCompleted));
  document.querySelectorAll('[data-extra-edit]').forEach(b=>b.onclick=()=>{const id=b.dataset.extraEdit;(window.maziEditCompletedExtra||window.maziPaymentModal)?.(id)});
}
const oldBind=bind;
bind=function(){oldBind();bindLifecycle()};
const oldRender=render;
render=function(){
  ensureLifecycle();oldRender();
  if(view!=='real')return;
  const app=document.getElementById('app'),m=curMonth();if(!app)return;
  const dash=app.querySelector('.clean-dashboard');
  if(dash&&!app.querySelector('.cycle-live-status'))dash.insertAdjacentHTML('afterend',statusStrip(m));
  const live=app.querySelector('.cycle-live-status'),wallets=window.maziFundingCards?window.maziFundingCards(m):'';
  const walletAnchor=app.querySelector('.live-money-card')||live;
  if(walletAnchor&&wallets&&!app.querySelector('.funding-wallets'))walletAnchor.insertAdjacentHTML('afterend',wallets);
  const fw=app.querySelector('.funding-wallets');
  if(fw&&window.maziTransferModal&&!fw.querySelector('#fundingTransferBtn')&&!fw.querySelector('#fundingTransferBtnBottom')){
    fw.insertAdjacentHTML('beforeend','<div class="funding-transfer-toolbar"><button class="btn soft" id="fundingTransferBtnBottom">↔ Μεταφορά μεταξύ μισθών / εσόδων</button></div>');
  }
  window.maziBindFundingTransfers?.();
  const fallbackTransfer=document.getElementById('fundingTransferBtnBottom');
  if(fallbackTransfer&&window.maziTransferModal)fallbackTransfer.onclick=window.maziTransferModal;
  const oneoff=app.querySelector('.oneoff-section');
  if(oneoff&&!oneoff.querySelector('.completed-extra-box')){
    const inline=completedExtrasInline(m);
    if(inline){
      const list=oneoff.querySelector('.oneoff-list');
      if(list)list.insertAdjacentHTML('afterend',inline);else oneoff.insertAdjacentHTML('beforeend',inline);
    }
  }
  const review=app.querySelector('[data-clean-panel="review"]')||app.lastElementChild;
  const html=completedHtml(m);
  if(html){
    const holder=document.createElement('div');holder.innerHTML=html;
    const node=holder.firstElementChild;
    if(review)review.insertAdjacentElement('afterend',node);else app.appendChild(node);
  }
  for(const list of app.querySelectorAll('.list,.oneoff-list')){
    if(!list.children.length)list.innerHTML='<div class="lifecycle-empty">Δεν υπάρχει κάτι σε εκκρεμότητα εδώ.</div>';
  }
  bindLifecycle();
};
save();render();
})();