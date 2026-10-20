(()=>{
function ensureVariableBills(){
  for(const m of Object.values(state.months||{})){
    const dei=(m.expenses||[]).find(x=>x.id==='e19'||x.name==='ΔΕΗ');
    if(dei){
      dei.variable=true;
      if(dei.actualKnown==null)dei.actualKnown=Number(dei.amount||0)>0;
      if(!Array.isArray(dei.actualHistory))dei.actualHistory=[];
      if(dei.actualEnteredAt==null)dei.actualEnteredAt='';
    }
  }
}
ensureVariableBills();

const oldChangeMoney=changeMoney;
changeMoney=function(inp){
  const p=target(inp.dataset.money);
  if(p&&p.kind==='expense'){
    const x=arr(p.o,p.kind).find(v=>v.id===inp.dataset.id);
    if(x&&x.variable===true){
      const next=Math.max(0,Number(inp.value||0));
      const changed=!x.actualKnown || Math.abs(Number(x.amount||0)-next)>0.005;
      x.amount=next;
      x.actualKnown=true;
      if(changed){
        x.actualEnteredAt=isoToday();
        if(!Array.isArray(x.actualHistory))x.actualHistory=[];
        x.actualHistory.push({id:uid(),date:isoToday(),amount:next});
      }
      save();render();return;
    }
  }
  oldChangeMoney(inp);
};

const oldRecurringRow=recurringRow;
recurringRow=function(x,test){
  if(test||x.variable!==true)return oldRecurringRow(x,test);
  const m=curMonth();
  const spent=(m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0);
  const planned=Number(x.amount||0),remaining=Math.max(0,planned-spent),over=Math.max(0,spent-planned);
  const entered=x.actualEnteredAt?(' · καταχωρήθηκε '+fmtDate(x.actualEnteredAt)):'';
  const status=x.actualKnown===true?('Ποσό επιβεβαιωμένο'+entered):'Προσωρινή εκτίμηση';
  const detail=spent>0?('Έγιναν '+euro(spent)+' · '+(over>0?'Υπέρβαση '+euro(over):'Μένουν '+euro(remaining))+entered):status;
  const due=x.dueDate?(' · λήξη '+fmtDate(x.dueDate)):'';
  return '<div class="money-row recurring flow-recurring variable-bill '+(x.active===false?'off':'')+'">'+
    '<input type="checkbox" '+(x.active===false?'':'checked')+' data-toggle="r-expense" data-id="'+x.id+'">'+
    '<div class="flow-expense-label"><div class="variable-title"><label>'+esc(x.name)+'</label><span class="variable-badge">Μεταβλητό</span></div><small class="'+(over>0?'negative':'')+'">'+detail+due+'</small></div>'+
    '<input type="number" min="0" step="0.01" value="'+planned+'" data-money="r-expense" data-id="'+x.id+'" aria-label="Ποσό '+esc(x.name)+' αυτού του κύκλου">'+
    '<button class="btn small soft flow-move-btn" data-expense-move="'+x.id+'">Κίνηση</button></div>';
};

const priorRender=render;
render=function(){
  priorRender();
  if(view!=='real')return;
  const m=curMonth(),dei=(m.expenses||[]).find(x=>x.id==='e19'||x.name==='ΔΕΗ');
  if(!dei||dei.variable!==true)return;
  const panel=document.querySelector('[data-clean-panel="fixed"] .section')||[...document.querySelectorAll('#app .section')].find(s=>s.querySelector('h2')?.textContent.includes('Πάγια'));
  if(panel&&!panel.querySelector('.variable-help')){
    const n=document.createElement('div');
    n.className='notice variable-help';
    n.innerHTML='<strong>Μεταβλητό ποσό:</strong> Η ΔΕΗ κρατά το τελευταίο ποσό μόνο ως εκτίμηση για την πρόβλεψη. Όταν έρθει ο νέος λογαριασμός, αλλάζεις το ποσό και τότε θεωρείται επιβεβαιωμένο για αυτόν τον κύκλο. Στον επόμενο κύκλο ξαναγίνεται εκτίμηση, όχι μόνιμο πάγιο.';
    panel.insertBefore(n,panel.querySelector('.list')||panel.firstChild);
  }
};
save();
render();
})();