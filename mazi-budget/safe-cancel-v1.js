(()=>{
const CLEANUP_KEY='mazi-cleanup-printer-133-v1';

function textMatch(v){
  return /(εκτυπωτ|printer)/i.test(String(v||''));
}
function cleanupMistakenPrinter133(){
  if(localStorage.getItem(CLEANUP_KEY)==='done')return false;
  const hits=[];
  for(const m of Object.values(state.months||{})){
    for(const mv of (m.expenseMoves||[])){
      const e=(m.expenses||[]).find(x=>x.id===mv.expenseId);
      if(Math.abs(Number(mv.amount||0)-133)<0.005 && (textMatch(mv.reason)||textMatch(e?.name))){
        hits.push({type:'move',m,mv,e,date:String(mv.date||'')});
      }
    }
    for(const x of (m.extraExpenses||[])){
      if(Math.abs(Number(x.amount||0)-133)<0.005 && textMatch(x.name)){
        hits.push({type:'extra',m,x,date:String(x.updatedAt||x.createdAt||x.date||'')});
      }
    }
    for(const x of (m.commonSpends||[])){
      if(Math.abs(Number(x.amount||0)-133)<0.005 && textMatch(x.name)){
        hits.push({type:'common',m,x,date:String(x.date||'')});
      }
    }
  }
  if(!hits.length)return false;
  hits.sort((a,b)=>b.date.localeCompare(a.date));
  const h=hits[0];
  if(h.type==='move'){
    if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(h.m,'move',h.mv.id);
    state.savingsTx=(state.savingsTx||[]).filter(t=>t.flowMoveId!==h.mv.id&&t.personalMoveId!==h.mv.id);
    h.m.expenseMoves=(h.m.expenseMoves||[]).filter(v=>v.id!==h.mv.id);
    if(h.e&&h.e.paid===true&&window.maziFlexibleBudgetIds?.has?.(h.e.id)){
      h.e.paid=false;h.e.paidAt='';h.e.completionMoveId='';h.e.updatedAt=isoToday();
    }
  }else if(h.type==='extra'){
    for(const p of (h.x.payments||[])){
      if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(h.m,'extraPayment',p.id);
    }
    h.m.extraExpenses=(h.m.extraExpenses||[]).filter(v=>v.id!==h.x.id);
  }else{
    if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(h.m,'commonSpend',h.x.id);
    state.savingsTx=(state.savingsTx||[]).filter(t=>t.commonSpendId!==h.x.id);
    h.m.commonSpends=(h.m.commonSpends||[]).filter(v=>v.id!==h.x.id);
  }
  localStorage.setItem(CLEANUP_KEY,'done');
  save();
  return true;
}

function cancelExtraById(id){
  const m=curMonth(),x=(m.extraExpenses||[]).find(v=>v.id===id);if(!x)return;
  const button={dataset:{remove:'r-extraExpense',id}};
  return removeExtraSafely(button);
}
function removeExtraSafely(button){
  const code=String(button?.dataset?.remove||'');
  if(code!=='r-extraExpense')return window.__maziBaseRemoveExtra?.(button);
  const m=curMonth(),x=(m.extraExpenses||[]).find(v=>v.id===button.dataset.id);if(!x)return;
  const group=x.installmentGroupId;
  const all=[];
  if(group){
    for(const mm of Object.values(state.months||{})){
      for(const xx of (mm.extraExpenses||[]))if(xx.installmentGroupId===group)all.push({m:mm,x:xx});
    }
  }else all.push({m,x});
  const total=all.reduce((s,r)=>s+Number(r.x.amount||0),0);
  const msg=group&&all.length>1
    ? 'Να ακυρωθεί ολόκληρη η αγορά «'+x.name+'» και όλες οι '+all.length+' δόσεις ('+euro(total)+');'
    : 'Να ακυρωθεί το έξοδο «'+x.name+'» ('+euro(x.amount)+');';
  if(!confirm(msg+'\n\nΘα επιστραφούν αυτόματα τα ποσά στις πηγές πληρωμής και θα διορθωθούν τα υπόλοιπα.'))return;
  for(const r of all){
    for(const p of (r.x.payments||[])){
      if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(r.m,'extraPayment',p.id);
    }
    r.m.extraExpenses=(r.m.extraExpenses||[]).filter(v=>v.id!==r.x.id);
  }
  save();render();
}

window.__maziBaseRemoveExtra=window.removeExtra||removeExtra;
window.removeExtra=removeExtraSafely;
window.maziCancelExtra=cancelExtraById;

const baseRender=window.render;
window.render=function(){
  baseRender();
  if(cleanupMistakenPrinter133()){
    baseRender();
  }
  document.querySelectorAll('[data-remove="r-extraExpense"]').forEach(b=>{
    b.textContent='Ακύρωση';
    b.classList.add('btn','danger','small');
    b.classList.remove('remove');
    b.title='Ακύρωση εξόδου και διόρθωση όλων των ποσών';
    b.onclick=()=>removeExtraSafely(b);
  });
  document.querySelectorAll('[data-extra-edit]').forEach(edit=>{
    const id=edit.dataset.extraEdit;
    const row=edit.closest('.completed-extra-inline,.completed-row');
    if(!row||row.querySelector('[data-extra-cancel="'+id+'"]'))return;
    const b=document.createElement('button');
    b.type='button';b.className='btn danger small';b.dataset.extraCancel=id;b.textContent='Ακύρωση';
    b.title='Ακύρωση εξόδου και πλήρης διόρθωση ποσών';
    b.onclick=()=>cancelExtraById(id);
    edit.insertAdjacentElement('afterend',b);
  });
};
})();