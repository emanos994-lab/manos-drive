(()=>{
function today(){return isoToday()}
function stampRecord(x,amount){
  if(!x)return;
  const d=today();
  if(!x.createdAt)x.createdAt=x.actualEnteredAt||d;
  x.updatedAt=d;
  x.auditSeen=true;
  if(!Array.isArray(x.auditHistory))x.auditHistory=[];
  const a=Number(amount==null?x.amount:amount)||0;
  const last=x.auditHistory[x.auditHistory.length-1];
  if(!last||last.date!==d||Math.abs(Number(last.amount||0)-a)>0.005){
    x.auditHistory.push({id:uid(),date:d,amount:a});
  }
}
function recordText(x){
  const first=x.createdAt||x.actualEnteredAt||'';
  const last=x.updatedAt||'';
  if(!first&&!last)return '';
  if(first&&last&&first!==last)return 'Καταχωρήθηκε '+fmtDate(first)+' · Τελ. αλλαγή '+fmtDate(last);
  return 'Καταχωρήθηκε '+fmtDate(first||last);
}
function initializeRecordDates(){
  for(const [key,m] of Object.entries(state.months||{})){
    const all=[...(m.incomes||[]),...(m.expenses||[]),...(m.extraIncomes||[]),...(m.extraExpenses||[])];
    for(const x of all)x.auditSeen=true;
    const dei=(m.expenses||[]).find(x=>x.id==='e19'||x.name==='ΔΕΗ');
    if(dei){
      dei.variable=true;
      if(dei.actualKnown==null)dei.actualKnown=Number(dei.amount||0)>0;
      if(!Array.isArray(dei.actualHistory))dei.actualHistory=[];
      if(dei.actualEnteredAt==null)dei.actualEnteredAt='';
      if(dei.actualKnown&&key===state.activeMonth&&!dei.actualEnteredAt)dei.actualEnteredAt=today();
      if(dei.actualEnteredAt&&!dei.createdAt)dei.createdAt=dei.actualEnteredAt;
      if(dei.actualEnteredAt&&!dei.updatedAt)dei.updatedAt=dei.actualEnteredAt;
    }
  }
}
function stampNewExtras(){
  let changed=false;
  for(const m of Object.values(state.months||{})){
    for(const x of [...(m.extraIncomes||[]),...(m.extraExpenses||[])]){
      if(x.auditSeen)continue;
      stampRecord(x,x.amount);
      changed=true;
    }
  }
  if(changed)localStorage.setItem(storeKey,JSON.stringify(state));
}
initializeRecordDates();

const baseChangeMoney=changeMoney;
changeMoney=function(inp){
  const code=inp.dataset.money||'',p=target(code);
  if(!p)return baseChangeMoney(inp);
  const x=arr(p.o,p.kind).find(v=>v.id===inp.dataset.id);
  const isReal=code.charAt(0)!=='t';
  const next=Math.max(0,Number(inp.value||0));
  if(isReal&&x)stampRecord(x,next);
  if(isReal&&p.kind==='expense'&&x&&x.variable===true){
    const changed=!x.actualKnown||Math.abs(Number(x.amount||0)-next)>0.005;
    x.amount=next;
    x.actualKnown=true;
    if(changed){
      x.actualEnteredAt=today();
      if(!x.createdAt)x.createdAt=x.actualEnteredAt;
      x.updatedAt=today();
      if(!Array.isArray(x.actualHistory))x.actualHistory=[];
      x.actualHistory.push({id:uid(),date:today(),amount:next});
    }
    save();render();return;
  }
  baseChangeMoney(inp);
};

const baseToggleRecurring=toggleRecurring;
toggleRecurring=function(inp){
  const code=inp.dataset.toggle||'',p=target(code);
  if(p&&code.charAt(0)!=='t'){
    const x=arr(p.o,p.kind).find(v=>v.id===inp.dataset.id);
    if(x)stampRecord(x,x.amount);
  }
  baseToggleRecurring(inp);
};

const baseTogglePaid=toggleOneOffPaid;
toggleOneOffPaid=function(id){
  const x=curMonth().extraExpenses.find(v=>v.id===id);
  if(x)stampRecord(x,x.amount);
  baseTogglePaid(id);
};

const baseIncomeRow=incomeRow;
incomeRow=function(x,kind,test,fixed){
  if(test)return baseIncomeRow(x,kind,test,fixed);
  const meta=recordText(x);
  const del=fixed?'':'<button class="remove" data-remove="r-'+kind+'" data-id="'+x.id+'">×</button>';
  return '<div class="money-row '+(fixed?'recurring':'')+' record-money-row" style="'+(fixed?'grid-template-columns:minmax(0,1fr) 120px':'')+'"><div class="record-label"><label>'+esc(x.name)+'</label>'+(meta?'<small class="record-date">'+esc(meta)+'</small>':'')+'</div><input type="number" min="0" step="0.01" value="'+Number(x.amount||0)+'" data-money="r-'+kind+'" data-id="'+x.id+'">'+del+'</div>';
};

const baseRecurringRow=recurringRow;
recurringRow=function(x,test){
  if(test)return baseRecurringRow(x,test);
  const meta=recordText(x);
  if(x.variable!==true){
    let html=baseRecurringRow(x,test);
    if(meta&&html.includes('flow-expense-label'))html=html.replace('</div><input type="number"','<small class="record-date">'+esc(meta)+'</small></div><input type="number"');
    return html;
  }
  const m=curMonth();
  const spent=(m.expenseMoves||[]).filter(v=>v.expenseId===x.id).reduce((s,v)=>s+Number(v.amount||0),0);
  const planned=Number(x.amount||0),remaining=Math.max(0,planned-spent),over=Math.max(0,spent-planned);
  const status=x.actualKnown===true?'Ποσό επιβεβαιωμένο':'Προσωρινή εκτίμηση';
  const detail=spent>0?('Έγιναν '+euro(spent)+' · '+(over>0?'Υπέρβαση '+euro(over):'Μένουν '+euro(remaining))):status;
  const due=x.dueDate?(' · λήξη '+fmtDate(x.dueDate)):'';
  return '<div class="money-row recurring flow-recurring variable-bill '+(x.active===false?'off':'')+'">'+
    '<input type="checkbox" '+(x.active===false?'':'checked')+' data-toggle="r-expense" data-id="'+x.id+'">'+
    '<div class="flow-expense-label"><div class="variable-title"><label>'+esc(x.name)+'</label><span class="variable-badge">Μεταβλητό</span></div><small class="'+(over>0?'negative':'')+'">'+detail+due+'</small>'+(meta?'<small class="record-date">'+esc(meta)+'</small>':'')+'</div>'+
    '<input type="number" min="0" step="0.01" value="'+planned+'" data-money="r-expense" data-id="'+x.id+'" aria-label="Ποσό '+esc(x.name)+' αυτού του κύκλου">'+
    '<button class="btn small soft flow-move-btn" data-expense-move="'+x.id+'">Κίνηση</button></div>';
};

const baseExtraRow=extraExpenseRow;
extraExpenseRow=function(x,test){
  let html=baseExtraRow(x,test);
  if(test)return html;
  const meta=recordText(x);
  if(meta)html=html.replace('</div><input type="number"','<small class="record-date">'+esc(meta)+'</small></div><input type="number"');
  return html;
};

const priorRender=render;
render=function(){
  stampNewExtras();
  priorRender();
  if(view!=='real')return;
  const m=curMonth(),dei=(m.expenses||[]).find(x=>x.id==='e19'||x.name==='ΔΕΗ');
  if(!dei||dei.variable!==true)return;
  const panel=document.querySelector('[data-clean-panel="fixed"] .section')||[...document.querySelectorAll('#app section')].find(s=>s.querySelector('h2')?.textContent.includes('Πάγια'));
  if(panel&&!panel.querySelector('.variable-help')){
    const n=document.createElement('div');
    n.className='notice variable-help';
    n.innerHTML='<strong>Μεταβλητό ποσό:</strong> Η ΔΕΗ κρατά το τελευταίο ποσό μόνο ως εκτίμηση. Όταν έρθει ο λογαριασμός, αλλάζεις το ποσό και κρατάμε και την ημερομηνία καταχώρησης. Κάθε επόμενη αλλαγή κρατά νέα ημερομηνία ενημέρωσης.';
    panel.insertBefore(n,panel.querySelector('.list')||panel.firstChild);
  }
};
save();
render();
})();