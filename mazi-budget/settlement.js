(()=>{
function ensureSettlement(m){
  if(!m)return m;
  if(!m.settlement)m.settlement={closed:false,closedAt:'',amount:0,txId:''};
  return m;
}
for(const m of Object.values(state.months||{}))ensureSettlement(m);

function incomeRows(m){return [...(m.incomes||[]),...(m.extraIncomes||[])]}
function receivedIncome(m){return incomeRows(m).filter(x=>x.received===true).reduce((s,x)=>s+Number(x.receivedAmount==null?x.amount:x.receivedAmount),0)}
function pendingIncome(m){return incomeRows(m).filter(x=>x.received!==true&&Number(x.amount||0)>0.005)}
function pendingIncomeTotal(m){return pendingIncome(m).reduce((s,x)=>s+Number(x.amount||0),0)}
function activeExpenses(m){return (m.expenses||[]).filter(x=>x.active!==false)}
function plannedRecurring(m){return activeExpenses(m).reduce((s,x)=>s+(window.maziEffectiveRecurring?window.maziEffectiveRecurring(m,x):Number(x.amount||0)),0)}
function commonSpent(m){return window.maziCommonSpent?window.maziCommonSpent(m):(m.commonSpends||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function extraPlanned(m){return (m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0)}
function personalBudget(m){
  return activeExpenses(m).filter(x=>x.id==='e17'||x.id==='e18').reduce((s,x)=>s+(window.maziEffectiveRecurring?window.maziEffectiveRecurring(m,x):Number(x.amount||0)),0);
}
function nonPersonalRecurring(m){return Math.max(0,plannedRecurring(m)-personalBudget(m))}
function settlementTx(m){
  const id=m.settlement?.txId;
  return id?(state.savingsTx||[]).find(x=>x.id===id):null;
}
function remainingForSavings(m){
  return monthRemain(m);
}
function openFlexibleBudgets(m){
  const ids=window.maziFlexibleBudgetIds||new Set(['e8','e9','e10','e13','e14','e15','e16','e17','e18']);
  return activeExpenses(m).filter(x=>ids.has(x.id)&&x.paid!==true);
}
function flexibleReleasedPreview(m){
  return openFlexibleBudgets(m).reduce((s,x)=>{
    const spent=(m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((a,v)=>a+Number(v.amount||0),0);
    return s+Math.max(0,Number(x.amount||0)-spent);
  },0);
}
function settlementHtml(m){
  ensureSettlement(m);
  const received=receivedIncome(m),pending=pendingIncome(m),waiting=pendingIncomeTotal(m);
  const recurring=nonPersonalRecurring(m),personal=personalBudget(m),extras=extraPlanned(m),common=commonSpent(m);
  const openBudgets=openFlexibleBudgets(m),releasePreview=flexibleReleasedPreview(m),rem=remainingForSavings(m)+releasePreview,closed=m.settlement.closed===true,tx=settlementTx(m);
  const pendingNames=pending.slice(0,3).map(x=>x.name).join(', ')+(pending.length>3?' κ.ά.':'');
  let action='';
  if(closed&&tx){
    action='<div class="settlement-done"><div><small>Ο κύκλος μοιράστηκε '+fmtDate(m.settlement.closedAt||tx.date)+'</small><strong>'+euro(Math.abs(Number(tx.amount||0)))+' πήγαν στην άκρη</strong></div><button class="btn ghost" id="undoSettlement">Ακύρωση μοιράσματος</button></div>';
  }else if(waiting>0.005){
    action='<div class="settlement-wait"><strong>⏳ Περιμένουμε ακόμη '+euro(waiting)+'</strong><span>'+esc(pendingNames)+'</span><small>Μόλις μπουν τα υπόλοιπα έσοδα, θα εμφανιστεί το τελικό ποσό για την άκρη.</small></div>';
  }else if(rem>0.005){
    action='<div class="settlement-ready"><div><small>Μετά από όλα τα παραπάνω</small><strong>'+euro(rem)+'</strong><span>μένουν για αποταμίευση'+(releasePreview>0.005?' · περιλαμβάνει '+euro(releasePreview)+' αχρησιμοποίητα από ανοιχτά budgets':'')+'</span></div><button class="btn green" id="closeSettlement">Μεταφορά όλου στην άκρη</button></div>';
  }else if(rem<-0.005){
    action='<div class="settlement-deficit"><strong>Λείπουν '+euro(Math.abs(rem))+'</strong><span>Δεν υπάρχει υπόλοιπο για αποταμίευση σε αυτόν τον κύκλο.</span></div>';
  }else{
    action='<div class="settlement-zero"><strong>Ο κύκλος είναι ισοσκελισμένος</strong><span>Δεν μένει ποσό για μεταφορά στην άκρη.</span></div>';
  }
  return '<section class="settlement-card">'+
    '<div class="settlement-head"><div><small>Τελικό μοίρασμα</small><strong>Ό,τι περισσεύει → στην άκρη</strong><span>Οι προσωρινές πηγές πληρωμής δεν αλλάζουν το τελικό μοίρασμα.</span></div></div>'+
    '<div class="settlement-grid">'+
      '<div><span>Έσοδα που έχουν μπει</span><strong>'+euro(received)+'</strong></div>'+
      '<div><span>Πάγια & budgets</span><strong>'+euro(recurring)+'</strong></div>'+
      '<div><span>Προσωπικά Μάνου + Πένυς</span><strong>'+euro(personal)+'</strong></div>'+
      '<div><span>Έκτακτα / δόσεις</span><strong>'+euro(extras)+'</strong></div>'+
      '<div><span>Κοινά τρέχοντα</span><strong>'+euro(common)+'</strong></div>'+
      '<div><span>Θεωρητικά έξοδα κύκλου</span><strong>'+euro(monthExpense(m))+'</strong></div>'+
    '</div>'+action+
  '</section>';
}
function closeSettlement(){
  const m=ensureSettlement(curMonth()),waiting=pendingIncomeTotal(m);
  if(waiting>0.005){alert('Υπάρχουν ακόμη έσοδα που δεν έχουν σημειωθεί ότι μπήκαν.');return}
  const preview=remainingForSavings(m)+flexibleReleasedPreview(m);
  if(preview<=0.005){alert('Δεν υπάρχει θετικό υπόλοιπο για μεταφορά στην άκρη.');return}
  for(const x of openFlexibleBudgets(m)){x.paid=true;x.paidAt=isoToday();x.updatedAt=isoToday()}
  const amount=remainingForSavings(m);
  const tx={id:uid(),date:isoToday(),monthKey:m.key,label:'Τελικό μοίρασμα κύκλου',reason:'Ό,τι περίσσεψε μετά από πάγια, προσωπικά, έκτακτα και κοινά έξοδα',amount,settlementMonth:m.key};
  state.savingsTx.push(tx);
  m.settlement={closed:true,closedAt:isoToday(),amount,txId:tx.id};
  save();render();
}
function undoSettlement(){
  const m=ensureSettlement(curMonth()),id=m.settlement.txId;
  if(id)state.savingsTx=(state.savingsTx||[]).filter(x=>x.id!==id);
  m.settlement={closed:false,closedAt:'',amount:0,txId:''};
  save();render();
}
function bindSettlement(){
  const close=document.getElementById('closeSettlement');if(close)close.onclick=closeSettlement;
  const undo=document.getElementById('undoSettlement');if(undo)undo.onclick=undoSettlement;
}
const previousRender=render;
render=function(){
  previousRender();
  if(view!=='real')return;
  const app=document.getElementById('app'),m=ensureSettlement(curMonth());if(!app)return;
  app.querySelector('.settlement-card')?.remove();
  const personal=app.querySelector('.personal-budgets');
  const common=app.querySelector('.common-spend-panel');
  const anchor=personal||common||app.querySelector('[data-clean-panel="oneoff"]')||app.querySelector('.clean-dashboard');
  if(anchor)anchor.insertAdjacentHTML('afterend',settlementHtml(m));
  else app.insertAdjacentHTML('beforeend',settlementHtml(m));
  bindSettlement();
};
render();
})();