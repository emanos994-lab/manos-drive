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
  x.received=false;x.receivedAt='';x.receivedAmount=null;x.updatedAt=isoToday();save();render();
}
function finishRecurring(id){
  const m=curMonth(),x=(m.expenses||[]).find(v=>v.id===id);if(!x)return;
  x.paid=true;x.paidAt=isoToday();x.updatedAt=isoToday();
  if(!budgetIds.has(x.id)){
    m.expenseMoves=Array.isArray(m.expenseMoves)?m.expenseMoves:[];
    const spent=m.expenseMoves.filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0);
    const remain=Math.max(0,Number(x.amount||0)-spent);
    if(remain>0.005){
      const move={id:uid(),expenseId:x.id,amount:remain,date:isoToday(),reason:'Εξόφληση'};
      m.expenseMoves.push(move);x.completionMoveId=move.id;
    }
  }
  save();render();
}
function undoRecurring(id){
  const m=curMonth(),x=(m.expenses||[]).find(v=>v.id===id);if(!x)return;
  if(x.completionMoveId&&Array.isArray(m.expenseMoves))m.expenseMoves=m.expenseMoves.filter(v=>v.id!==x.completionMoveId);
  x.completionMoveId='';x.paid=false;x.paidAt='';x.updatedAt=isoToday();save();render();
}
function receivedIncomeTotal(m){return [...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received===true).reduce((s,x)=>s+Number(x.amount||0),0)}
function pendingIncomeTotal(m){return [...(m.incomes||[]),...(m.extraIncomes||[])].filter(x=>x.received!==true).reduce((s,x)=>s+Number(x.amount||0),0)}
function statusStrip(m){
  const got=receivedIncomeTotal(m),waiting=pendingIncomeTotal(m);
  const done=(m.expenses||[]).filter(x=>x.active!==false&&x.paid===true).reduce((s,x)=>s+Number(x.amount||0),0);
  const pending=(m.expenses||[]).filter(x=>x.active!==false&&x.paid!==true).reduce((s,x)=>s+Math.max(0,Number(x.amount||0)-((m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((a,v)=>a+Number(v.amount||0),0))),0);
  return '<section class="cycle-live-status"><div><small>💰 Έσοδα που ήρθαν</small><strong>'+euro(got)+'</strong><span>Αναμένονται '+euro(waiting)+'</span></div><div><small>✅ Υποχρεώσεις που έκλεισαν</small><strong>'+euro(done)+'</strong><span>Εκκρεμούν περίπου '+euro(pending)+'</span></div></section>';
}
const oldIncomeRow=incomeRow;
incomeRow=function(x,kind,test,fixed){
  if(test)return oldIncomeRow(x,kind,test,fixed);
  if(x.received===true)return '';
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
function completedHtml(m){
  const incomes=[...(m.incomes||[]).map(x=>({...x,_kind:'income'})),...(m.extraIncomes||[]).map(x=>({...x,_kind:'extraIncome'}))].filter(x=>x.received===true);
  const expenses=(m.expenses||[]).filter(x=>x.active!==false&&x.paid===true);
  const extras=(m.extraExpenses||[]).filter(paidExtra);
  if(!incomes.length&&!expenses.length&&!extras.length)return '';
  const rows=[];
  for(const x of incomes)rows.push('<div class="completed-row"><div><strong>'+moneyEmoji(x,'income')+' '+esc(x.name)+'</strong><small>Μπήκε '+fmtDate(x.receivedAt||x.updatedAt||isoToday())+'</small></div><strong class="positive">'+euro(x.receivedAmount==null?x.amount:x.receivedAmount)+'</strong><button class="btn ghost small" data-income-undo="'+x._kind+'" data-id="'+x.id+'">Επαναφορά</button></div>');
  for(const x of expenses)rows.push('<div class="completed-row"><div><strong>'+moneyEmoji(x,'expense')+' '+esc(x.name)+'</strong><small>'+(budgetIds.has(x.id)?'Έκλεισε ':'Πληρώθηκε ')+fmtDate(x.paidAt||x.updatedAt||isoToday())+'</small></div><strong>'+euro(x.amount)+'</strong><button class="btn ghost small" data-expense-undo="'+x.id+'">Επαναφορά</button></div>');
  for(const x of extras)rows.push('<div class="completed-row"><div><strong>🧾 '+esc(x.name)+'</strong><small>Εξοφλήθηκε'+(x.updatedAt?' · '+fmtDate(x.updatedAt):'')+'</small></div><strong>'+euro(x.amount)+'</strong>'+(window.maziPaymentModal?'<button class="btn ghost small" data-extra-payments="'+x.id+'">Πληρωμές</button>':'<span></span>')+'</div>');
  return '<details class="completed-panel"><summary><span>✓ Ολοκληρωμένα αυτού του κύκλου</span><small>'+rows.length+' εγγραφές</small></summary><div class="completed-list">'+rows.join('')+'</div></details>';
}
function bindLifecycle(){
  document.querySelectorAll('[data-income-done]').forEach(b=>b.onclick=()=>receiveIncome(b.dataset.incomeDone,b.dataset.id));
  document.querySelectorAll('[data-income-undo]').forEach(b=>b.onclick=()=>undoIncome(b.dataset.incomeUndo,b.dataset.id));
  document.querySelectorAll('[data-expense-done]').forEach(b=>b.onclick=()=>finishRecurring(b.dataset.expenseDone));
  document.querySelectorAll('[data-expense-undo]').forEach(b=>b.onclick=()=>undoRecurring(b.dataset.expenseUndo));
  document.querySelectorAll('[data-extra-payments]').forEach(b=>b.onclick=()=>window.maziPaymentModal?.(b.dataset.extraPayments));
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