(()=>{
function nextCycleKey(key,offset){
  const p=String(key).split('-').map(Number);
  const d=new Date(p[0],p[1]-1+offset,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function addMonths(dateStr,offset){
  if(!dateStr)return '';
  const p=String(dateStr).split('-').map(Number);
  const d=new Date(p[0],p[1]-1+offset,1);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  const day=Math.min(p[2]||1,last);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function ensureFutureMonth(key,source){
  if(!state.months[key])state.months[key]=baseMonth(key,source);
  if(typeof ensureFlowMonth==='function')ensureFlowMonth(state.months[key]);
  return state.months[key];
}
function paymentsFor(x){return Array.isArray(x.payments)?x.payments:[]}
function paidFor(x){
  const p=paymentsFor(x).reduce((s,v)=>s+Number(v.amount||0),0);
  if(!p&&x.status==='paid')return Number(x.amount||0);
  return Math.min(Number(x.amount||0),p);
}
function dueFor(x){return Math.max(0,Number(x.amount||0)-paidFor(x))}
function refreshStatus(x){
  const r=dueFor(x),a=Number(x.amount||0);
  x.status=r<=0.005?'paid':r<a-0.005?'partial':'pending';
}
function cycleOutstanding(m){return (m.extraExpenses||[]).reduce((s,x)=>s+dueFor(x),0)}
function cyclePaid(m){return (m.extraExpenses||[]).reduce((s,x)=>s+paidFor(x),0)}
window.maziOneOffOutstanding=cycleOutstanding;
window.maziPaidExtra=cyclePaid;
if(typeof unpaidOneOff==='function')unpaidOneOff=function(m){return cycleOutstanding(m)};

function splitMoney(total,count){
  const cents=Math.round(Number(total||0)*100),base=Math.floor(cents/count),rest=cents-base*count;
  return Array.from({length:count},(_,i)=>(base+(i<rest?1:0))/100);
}
function makePayment(x,amount,date,note){
  x.payments=paymentsFor(x);
  const p={id:uid(),amount:Number(amount||0),date:date||isoToday(),note:String(note||'').trim()};
  x.payments.push(p);
  refreshStatus(x);
  if(!x.createdAt)x.createdAt=date||isoToday();
  x.updatedAt=date||isoToday();
  x.auditSeen=true;
  return p;
}
function installmentModal(){
  const m=curMonth();
  const defaultDue=isoToday();
  showModal('Νέα αγορά / οφειλή',
    '<div class="form-grid">'+
    '<div class="field"><label>Τι αγοράσαμε / χρωστάμε</label><input name="name" required placeholder="π.χ. Παπούτσια"></div>'+
    '<div class="field"><label>Συνολικό ποσό αγοράς</label><input name="amount" type="number" min="0.01" step="0.01" required></div>'+
    '<div class="field"><label>Ημερομηνία αγοράς</label><input name="date" type="date" value="'+isoToday()+'"></div>'+
    '<div class="field"><label>Τρόπος</label><select name="method" id="purchaseMethod"><option selected>Άλλο</option><option>Χρεωστική / Τράπεζα</option><option>Μετρητά</option><option>Πιστωτική</option><option>Klarna</option></select></div>'+
    '<div class="field"><label>Δόσεις</label><select name="installments" id="purchaseInstallments">'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(i===0?'selected':'')+'>'+(i+1)+(i===0?' δόση':' δόσεις')+'</option>').join('')+'</select></div>'+
    '<div class="field"><label>1η πληρωμή / λήξη</label><input name="dueDate" type="date" value="'+defaultDue+'"></div>'+
    '<div class="field"><label>Η πρώτη δόση</label><select name="status"><option value="pending">Δεν έχει πληρωθεί</option><option value="paid">Πληρώθηκε ήδη</option></select></div>'+
    '<div class="field"><label>Αν πληρώθηκε, από πού</label><select name="sourceId">'+(window.maziFundingOptions?window.maziFundingOptions(m):'<option value="other">Άλλα / εκτός εφαρμογής</option>')+'</select></div>'+
    '</div>'+
    '<div class="notice installment-note" style="margin-top:10px"><strong>Δόσεις:</strong> αν επιλέξεις 3, η εφαρμογή θα βάλει αυτόματα 1/3 στον τρέχοντα κύκλο και τις άλλες δύο στους επόμενους.</div>',
    fd=>{
      const name=String(fd.get('name')||'Αγορά').trim()||'Αγορά';
      const total=Math.max(0,Number(fd.get('amount')||0)); if(!total)return false;
      const count=Math.max(1,Math.min(12,Number(fd.get('installments')||1)));
      const method=String(fd.get('method')||'Άλλο');
      const purchaseDate=String(fd.get('date')||isoToday());
      const firstDue=String(fd.get('dueDate')||purchaseDate);
      const firstStatus=String(fd.get('status')||'pending');
      const parts=splitMoney(total,count),group=uid();
      let source=m;
      for(let i=0;i<count;i++){
        const key=nextCycleKey(m.key,i),target=ensureFutureMonth(key,source);
        source=target;
        const x={
          id:uid(),name,amount:parts[i],date:purchaseDate,dueDate:addMonths(firstDue,i),method,
          status:'pending',payments:[],installmentGroupId:group,installmentIndex:i+1,installmentCount:count,
          purchaseTotal:total,createdAt:isoToday(),updatedAt:isoToday(),auditSeen:true
        };
        if(i===0&&firstStatus==='paid'){
          const sourceId=String(fd.get('sourceId')||'');
          if(sourceId&&window.maziCanAllocate&&!window.maziCanAllocate(target,sourceId,parts[i])){alert('Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
          const payment=makePayment(x,parts[i],purchaseDate,'Πληρώθηκε κατά την καταχώρηση');
          if(sourceId&&window.maziAllocateFunding)window.maziAllocateFunding(target,{sourceId,amount:parts[i],date:purchaseDate,targetType:'extraPayment',targetId:payment.id,label:name});
        }
        target.extraExpenses.push(x);
      }
    },'Καταχώριση αγοράς');
  const method=document.getElementById('purchaseMethod'),inst=document.getElementById('purchaseInstallments');
  if(method&&inst)method.onchange=()=>{if(method.value==='Klarna'&&inst.value==='1')inst.value='3'};
}
function paymentModal(id){
  const m=curMonth(),x=(m.extraExpenses||[]).find(v=>v.id===id);if(!x)return;
  const paid=paidFor(x),due=dueFor(x);
  const hist=paymentsFor(x).slice().reverse();
  const legacyPaid=due<=0.005&&hist.length===0&&x.status==='paid';
  const rows=hist.length?'<div class="payment-history">'+hist.map(p=>{const a=window.maziFundingByTarget?window.maziFundingByTarget(m,'extraPayment',p.id):null,src=a&&window.maziFundingLabel?' · από '+esc(window.maziFundingLabel(m,a.sourceId)):'';return '<div class="payment-history-row"><span>'+fmtDate(p.date)+' · '+euro(p.amount)+src+(p.note?' · '+esc(p.note):'')+'</span><div class="payment-history-actions"><button type="button" class="btn soft small" data-set-payment-source="'+p.id+'">'+(a?'Πηγή':'+ Πηγή')+'</button><button type="button" class="remove" data-remove-partial="'+p.id+'">×</button></div></div>'}).join('')+'</div>':'<div class="mini">Δεν έχει καταχωρηθεί αποπληρωμή ακόμη.</div>';
  const form=due>0.005?'<div class="form-grid partial-grid"><div class="field"><label>Ποσό αποπληρωμής</label><input name="amount" type="number" min="0.01" max="'+due+'" step="0.01" required></div><div class="field"><label>Ημερομηνία</label><input name="date" type="date" value="'+isoToday()+'"></div><div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+(window.maziFundingOptions?window.maziFundingOptions(m):'<option value="other">Άλλα / εκτός εφαρμογής</option>')+'</select></div><div class="field"><label>Σημείωση</label><input name="note" placeholder="π.χ. αποπληρωμή κάρτας"></div></div>':legacyPaid?'<div class="form-grid partial-grid"><div class="field"><label>Ημερομηνία παλιάς πληρωμής</label><input name="date" type="date" value="'+esc(x.updatedAt||x.date||isoToday())+'"></div><div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+(window.maziFundingOptions?window.maziFundingOptions(m):'<option value="other">Άλλα / εκτός εφαρμογής</option>')+'</select></div></div><div class="notice" style="margin-top:10px">Αυτή η εξόφληση είχε ήδη καταχωρηθεί. Τώρα απλώς συνδέεις από ποιο έσοδο πληρώθηκε.</div>':'';
  showModal('Πληρωμές · '+x.name,
    '<div class="payment-balance"><div><small>Αρχικό ποσό</small><strong>'+euro(x.amount)+'</strong></div><div><small>Έχει αποπληρωθεί</small><strong class="positive">'+euro(paid)+'</strong></div><div><small>Υπόλοιπο</small><strong class="'+(due>0?'negative':'positive')+'">'+euro(due)+'</strong></div></div>'+form+rows,
    fd=>{
      if(legacyPaid){
        const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
        const a=Number(x.amount||0),date=String(fd.get('date')||x.updatedAt||x.date||isoToday());
        if(window.maziCanAllocate&&!window.maziCanAllocate(m,sourceId,a)){alert('Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
        const payment=makePayment(x,a,date,'Παλιά εξόφληση');
        if(window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId,amount:a,date,targetType:'extraPayment',targetId:payment.id,label:x.name});
        return;
      }
      if(due<=0.005)return;
      const a=Math.max(0,Math.min(due,Number(fd.get('amount')||0)));if(!a)return false;
      const sourceId=String(fd.get('sourceId')||'');
      if(sourceId&&window.maziCanAllocate&&!window.maziCanAllocate(m,sourceId,a)){alert('Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false}
      const date=String(fd.get('date')||isoToday());
      const payment=makePayment(x,a,date,String(fd.get('note')||''));
      if(sourceId&&window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId,amount:a,date,targetType:'extraPayment',targetId:payment.id,label:x.name});
    },due>0.005?'Καταχώριση πληρωμής':legacyPaid?'Αποθήκευση πηγής':'Κλείσιμο');
  document.querySelectorAll('[data-set-payment-source]').forEach(b=>b.onclick=()=>{
    const p=paymentsFor(x).find(v=>v.id===b.dataset.setPaymentSource);if(!p)return;
    const current=window.maziFundingByTarget?window.maziFundingByTarget(m,'extraPayment',p.id):null;
    const opts=window.maziFundingOptions?window.maziFundingOptions(m,current?.sourceId||'',p.amount):'<option value="other">Άλλα / εκτός εφαρμογής</option>';
    const outer=document.getElementById('modal');if(outer)outer.close();
    setTimeout(()=>showModal('Πηγή πληρωμής · '+x.name,'<div class="field"><label>Πληρώθηκε από</label><select name="sourceId" required>'+opts+'</select></div><div class="notice" style="margin-top:10px">Ποσό: <strong>'+euro(p.amount)+'</strong> · '+fmtDate(p.date)+'</div>',fd=>{
      const sourceId=String(fd.get('sourceId')||'');if(!sourceId)return false;
      if(current&&window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'extraPayment',p.id);
      if(window.maziCanAllocate&&!window.maziCanAllocate(m,sourceId,p.amount)){
        if(current&&window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId:current.sourceId,amount:current.amount,date:current.date,targetType:'extraPayment',targetId:p.id,label:current.label});
        alert('Δεν φτάνει το διαθέσιμο υπόλοιπο αυτής της πηγής.');return false;
      }
      if(window.maziAllocateFunding)window.maziAllocateFunding(m,{sourceId,amount:p.amount,date:p.date,targetType:'extraPayment',targetId:p.id,label:x.name});
    },'Αποθήκευση πηγής'),60);
  });
  document.querySelectorAll('[data-remove-partial]').forEach(b=>b.onclick=()=>{
    if(window.maziRemoveFundingByTarget)window.maziRemoveFundingByTarget(m,'extraPayment',b.dataset.removePartial);
    x.payments=paymentsFor(x).filter(p=>p.id!==b.dataset.removePartial);
    refreshStatus(x);x.updatedAt=isoToday();save();document.getElementById('modal')?.close();render();
  });
}
window.maziPaymentModal=paymentModal;
window.maziDueFor=dueFor;
window.maziPaidFor=paidFor;
function paymentSourceSummary(m,x){
  const names=[];
  for(const p of paymentsFor(x)){
    const a=window.maziFundingByTarget?window.maziFundingByTarget(m,'extraPayment',p.id):null;
    if(a&&window.maziFundingLabel){
      const n=window.maziFundingLabel(m,a.sourceId);
      if(n&&!names.includes(n))names.push(n);
    }
  }
  if(!names.length)return '';
  return names.length===1?'Πληρώθηκε από '+names[0]:'Πληρώθηκε από '+names.length+' πηγές';
}
function rowIcon(x){const m=String(x.method||'');if(m==='Klarna')return '🛍️';if(m.includes('Πιστω'))return '💳';if(m.includes('Χρεωσ'))return '🏦';if(m.includes('Μετρητ'))return '💶';return '🧾'}
function rowHtml(x){
  const m=curMonth(),paid=paidFor(x),due=dueFor(x),partial=paid>0&&due>0.005;
  const method=x.method||'Άλλο',sourceText=paymentSourceSummary(m,x);
  const inst=Number(x.installmentCount||0)>1?'<span class="installment-badge">'+Number(x.installmentIndex||1)+'/'+Number(x.installmentCount)+'</span>':'';
  const state=due<=0.005?'Εξοφλήθηκε':partial?'Μερική πληρωμή':'Οφειλή';
  const badge=due<=0.005?'done':partial?'part':'owe';
  const dates=(x.createdAt?('Καταχωρήθηκε '+fmtDate(x.createdAt)+(x.updatedAt&&x.updatedAt!==x.createdAt?' · Τελ. αλλαγή '+fmtDate(x.updatedAt):'')):'');
  return '<div class="oneoff-row '+(due<=0.005?'paid':'pending')+' partial-oneoff">'+
    '<div class="oneoff-main"><div class="oneoff-title"><strong>'+rowIcon(x)+' '+esc(x.name)+'</strong>'+inst+'<span class="oneoff-badge '+badge+'">'+state+'</span></div>'+
    '<div class="oneoff-meta">'+esc(method)+(x.dueDate?' · λήξη '+fmtDate(x.dueDate):'')+(dates?' · '+dates:'')+'</div>'+
    '<div class="partial-progress"><span>Πληρώθηκαν <strong>'+euro(paid)+'</strong></span><span>Υπόλοιπο <strong class="'+(due>0?'negative':'positive')+'">'+euro(due)+'</strong></span></div>'+(sourceText?'<div class="payment-source-line">💰 '+esc(sourceText)+'</div>':'')+'</div>'+
    '<input type="number" min="0" step="0.01" value="'+Number(x.amount||0)+'" data-money="r-extraExpense" data-id="'+x.id+'">'+
    '<button class="btn small '+(due>0?'soft':'ghost')+'" data-partial-pay="'+x.id+'">'+(due>0?'+ Πληρωμή':'Πληρωμές')+'</button>'+
    '<button class="remove" data-remove="r-extraExpense" data-id="'+x.id+'">×</button></div>';
}

const oldExtraRow=extraExpenseRow;
extraExpenseRow=function(x,test){return test?oldExtraRow(x,test):rowHtml(x)};

const oldAddExtra=addExtra;
addExtra=function(code){
  const test=code[0]==='t',kind=code.slice(2);
  if(!test&&kind==='expense')return installmentModal();
  return oldAddExtra(code);
};

const oldChangeMoney=changeMoney;
changeMoney=function(inp){
  if(inp.dataset.money==='r-extraExpense'){
    const x=(curMonth().extraExpenses||[]).find(v=>v.id===inp.dataset.id);
    if(x){
      x.amount=Math.max(0,Number(inp.value||0));
      if(!x.createdAt)x.createdAt=isoToday();
      x.updatedAt=isoToday();x.auditSeen=true;refreshStatus(x);save();render();return;
    }
  }
  oldChangeMoney(inp);
};

function creditSummary(m){
  const list=(m.extraExpenses||[]).filter(x=>String(x.method||'').toLowerCase().includes('πιστω'));
  if(!list.length)return '';
  const charged=list.reduce((s,x)=>s+Number(x.amount||0),0),paid=list.reduce((s,x)=>s+paidFor(x),0),due=list.reduce((s,x)=>s+dueFor(x),0);
  return '<div class="credit-balance-card"><div><small>💳 Πιστωτική · τρέχουσες αγορές</small><strong>'+euro(due)+'</strong><span>υπόλοιπο για εξόφληση</span></div><div class="credit-mini"><span>Χρεώσεις '+euro(charged)+'</span><span>Αποπληρώθηκαν '+euro(paid)+'</span></div><small class="credit-note">Δεν περιλαμβάνει τις ξεχωριστές πάγιες δόσεις της πιστωτικής.</small></div>';
}
function bindInstallments(){
  document.querySelectorAll('[data-partial-pay]').forEach(b=>b.onclick=()=>paymentModal(b.dataset.partialPay));
}
const oldRender=render;
render=function(){
  oldRender();
  if(view!=='real')return;
  bindInstallments();
  const m=curMonth(),section=document.querySelector('.oneoff-section');
  if(section){
    const old=section.querySelector('.credit-balance-card');if(old)old.remove();
    const html=creditSummary(m);
    if(html){
      const list=section.querySelector('.oneoff-list');
      if(list)list.insertAdjacentHTML('beforebegin',html);
    }
    const summary=section.querySelector('.oneoff-summary');
    if(summary){
      const spans=summary.querySelectorAll('span');
      if(spans[1])spans[1].innerHTML='Υπόλοιπο για πληρωμή: <strong class="negative">'+euro(cycleOutstanding(m))+'</strong>';
    }
  }
};
render();
})();