(()=>{
const STANDARD_IDS=['manos-christmas','penny-christmas','manos-easter','penny-easter','manos-vacation','penny-vacation'];

function salaryFor(person){
  const m=state?.months?.[state.activeMonth];
  const id=person==='Μάνος'?'i1':'i6';
  return Number(m?.incomes?.find(x=>x.id===id)?.amount||0);
}
function standardDefaults(){
  const manos=salaryFor('Μάνος')||1136, penny=salaryFor('Πένυ')||850;
  return [
    {id:'manos-christmas',person:'Μάνος',type:'christmas',name:'Δώρο Χριστουγέννων',month:'12',amount:manos,enabled:true,custom:false},
    {id:'penny-christmas',person:'Πένυ',type:'christmas',name:'Δώρο Χριστουγέννων',month:'12',amount:penny,enabled:true,custom:false},
    {id:'manos-easter',person:'Μάνος',type:'easter',name:'Δώρο Πάσχα',month:'04',amount:manos/2,enabled:true,custom:false},
    {id:'penny-easter',person:'Πένυ',type:'easter',name:'Δώρο Πάσχα',month:'04',amount:penny/2,enabled:true,custom:false},
    {id:'manos-vacation',person:'Μάνος',type:'vacation',name:'Επίδομα αδείας',month:'07',amount:manos/2,enabled:true,custom:false},
    {id:'penny-vacation',person:'Πένυ',type:'vacation',name:'Επίδομα αδείας',month:'07',amount:penny/2,enabled:true,custom:false}
  ];
}
function migrateSeasonals(){
  const old=Array.isArray(state.seasonal)?state.seasonal:[];
  const custom=old.filter(x=>x.custom===true || !['christmas','easter','vacation',...STANDARD_IDS].includes(x.id));
  const defaults=standardDefaults();
  const existingSplit=old.filter(x=>STANDARD_IDS.includes(x.id));
  state.seasonal=[
    ...defaults.map(d=>{
      const x=existingSplit.find(v=>v.id===d.id);
      return x?{...d,...x,person:d.person,type:d.type,name:d.name,custom:false}:d;
    }),
    ...custom
  ];
}
function ensureSeasonals(){migrateSeasonals();return state.seasonal}
ensureSeasonals();

if(window.maziNormalizeState){
  const baseNormalize=window.maziNormalizeState;
  window.maziNormalizeState=raw=>{
    const s=baseNormalize(raw);
    const previous=state;
    state=s;
    migrateSeasonals();
    const out=state;
    state=previous;
    return out;
  };
}
localStorage.setItem(storeKey,JSON.stringify(state));

function futureMonthKeys(startKey,n){
  const [y,m]=String(startKey).split('-').map(Number),out=[];
  for(let i=1;i<=n;i++){const d=new Date(y,m-1+i,1);out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))}
  return out;
}
function monthName(mm){return new Date('2026-'+String(mm).padStart(2,'0')+'-01T12:00:00').toLocaleDateString('el-GR',{month:'long'})}
function events(startKey,n){
  ensureSeasonals();
  const out=[];
  for(const key of futureMonthKeys(startKey,n)){
    const mm=key.slice(5,7);
    for(const x of state.seasonal){
      if(x.enabled!==false && String(x.month).padStart(2,'0')===mm && Number(x.amount||0)>0){
        out.push({key,name:(x.person?x.person+' · ':'')+x.name,amount:Number(x.amount||0)});
      }
    }
  }
  return out;
}
function totalEvents(list){return list.reduce((s,x)=>s+x.amount,0)}
function monthSelectHtml(value){
  let s='';
  for(let i=1;i<=12;i++){
    const v=String(i).padStart(2,'0');
    s+='<option value="'+v+'" '+(v===String(value).padStart(2,'0')?'selected':'')+'>'+esc(monthName(v))+'</option>';
  }
  return s;
}
function standardByType(type){return ensureSeasonals().filter(x=>x.type===type&&!x.custom)}
function customSeasonals(){return ensureSeasonals().filter(x=>x.custom)}
function bonusPersonRow(x){
  return '<div class="bonus-person-row">'+
    '<label class="bonus-check"><input type="checkbox" data-seasonal-enabled="'+x.id+'" '+(x.enabled===false?'':'checked')+'><span>'+esc(x.person)+'</span></label>'+
    '<input type="number" min="0" step="0.01" value="'+Number(x.amount||0)+'" data-seasonal-amount="'+x.id+'" aria-label="Ποσό '+esc(x.person)+'">'+
    '<span class="bonus-euro">€</span>'+
  '</div>';
}
function bonusCard(type,title,icon){
  const rows=standardByType(type);
  const month=rows[0]?.month||'01';
  return '<div class="bonus-card"><div class="bonus-card-head"><div><strong>'+icon+' '+esc(title)+'</strong><small>Μήνας πληρωμής</small></div><select data-seasonal-group-month="'+type+'">'+monthSelectHtml(month)+'</select></div>'+
    rows.map(bonusPersonRow).join('')+
  '</div>';
}
function customRows(){
  const rows=customSeasonals();
  if(!rows.length)return '';
  return '<div class="custom-bonus-list">'+rows.map(x=>'<div class="custom-bonus-row"><input type="checkbox" data-seasonal-enabled="'+x.id+'" '+(x.enabled===false?'':'checked')+'><input value="'+esc(x.name)+'" data-seasonal-name="'+x.id+'"><select data-seasonal-month="'+x.id+'">'+monthSelectHtml(x.month)+'</select><input type="number" min="0" step="0.01" value="'+Number(x.amount||0)+'" data-seasonal-amount="'+x.id+'"><button class="remove" data-seasonal-remove="'+x.id+'">×</button></div>').join('')+'</div>';
}
function seasonalEditor(){
  return '<section class="section"><div class="section-head"><div><h2>Σίγουρα / αναμενόμενα έξτρα έσοδα</h2><p>Εδώ φαίνονται χωριστά τα δικά σου και της Πένυς. Μετράνε μόνο στις προβλέψεις.</p></div><div class="actions"><button class="btn green small" id="seasonalFromSalaries">Ενημέρωση από μισθούς</button><button class="btn soft small" id="addSeasonal">+ Άλλο</button></div></div>'+
  '<div class="bonus-grid">'+bonusCard('christmas','Δώρο Χριστουγέννων','🎄')+bonusCard('easter','Δώρο Πάσχα','🐣')+bonusCard('vacation','Επίδομα αδείας','☀️')+'</div>'+
  customRows()+
  '<div class="notice" style="margin-top:10px"><strong>Απλή εκτίμηση:</strong> αρχικά βάζω 1 βασικό μισθό για Χριστούγεννα και μισό για Πάσχα/άδεια, ξεχωριστά για Μάνο και Πένυ. Τα πραγματικά ποσά μπορεί να διαφέρουν, οπότε τα διορθώνεις εδώ.</div></section>';
}
function eventHtml(list){
  return list.length?'<div class="seasonal-events">'+list.map(x=>'<div class="seasonal-event"><span>'+esc(monthLabel(x.key))+' · '+esc(x.name)+'</span><strong class="positive">+'+euro(x.amount)+'</strong></div>').join('')+'</div>':'<div class="mini" style="margin-top:10px">Δεν πέφτει κάποιο έξτρα έσοδο μέσα σε αυτό το διάστημα.</div>';
}
function projectionRows(start,monthly,startKey,n){
  let out='',bal=start;
  for(const key of futureMonthKeys(startKey,n)){
    const ev=events(key.slice(0,7),0); // never used; keep parser calm
    const mm=key.slice(5,7);
    const extra=ensureSeasonals().filter(x=>x.enabled!==false&&String(x.month).padStart(2,'0')===mm).reduce((s,x)=>s+Number(x.amount||0),0);
    bal+=monthly+extra;
    out+='<div class="projection-row"><span>'+esc(monthLabel(key))+(extra>0?' · έξτρα +'+euro(extra):'')+'</span><strong>'+euro(bal)+'</strong></div>';
  }
  return out;
}
function planSummaryCard(start,monthly,extras,end,n){
  return '<div class="simple-plan-summary">'+
    '<div><small>Έχεις ήδη</small><strong>'+euro(start)+'</strong></div>'+
    '<div><small>Κανονικά θα βάζεις / μήνα</small><strong>'+euro(monthly)+'</strong></div>'+
    '<div><small>Έξτρα έσοδα στο διάστημα</small><strong class="positive">+'+euro(extras)+'</strong></div>'+
    '<div class="final"><small>Εκτίμηση σε '+n+' μήνες</small><strong>'+euro(end)+'</strong></div>'+
  '</div>';
}

const originalBind=bind;
bind=function(){
  originalBind();
  document.querySelectorAll('[data-seasonal-enabled]').forEach(el=>el.onchange=()=>{
    const x=state.seasonal.find(v=>v.id===el.dataset.seasonalEnabled);if(x){x.enabled=el.checked;save();render()}
  });
  document.querySelectorAll('[data-seasonal-amount]').forEach(el=>el.onchange=()=>{
    const x=state.seasonal.find(v=>v.id===el.dataset.seasonalAmount);if(x){x.amount=Math.max(0,Number(el.value||0));save();render()}
  });
  document.querySelectorAll('[data-seasonal-group-month]').forEach(el=>el.onchange=()=>{
    for(const x of state.seasonal.filter(v=>v.type===el.dataset.seasonalGroupMonth&&!v.custom))x.month=el.value;
    save();render();
  });
  document.querySelectorAll('[data-seasonal-month]').forEach(el=>el.onchange=()=>{
    const x=state.seasonal.find(v=>v.id===el.dataset.seasonalMonth);if(x){x.month=el.value;save();render()}
  });
  document.querySelectorAll('[data-seasonal-name]').forEach(el=>el.onchange=()=>{
    const x=state.seasonal.find(v=>v.id===el.dataset.seasonalName);if(x){x.name=String(el.value||'Άλλο');save();render()}
  });
  document.querySelectorAll('[data-seasonal-remove]').forEach(el=>el.onclick=()=>{state.seasonal=state.seasonal.filter(v=>v.id!==el.dataset.seasonalRemove);save();render()});
  const add=document.getElementById('addSeasonal');
  if(add)add.onclick=()=>showModal('Άλλο προγραμματισμένο έσοδο','<div class="form-grid"><div class="field"><label>Περιγραφή</label><input name="name" required></div><div class="field"><label>Ποσό</label><input name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Μήνας</label><select name="month">'+monthSelectHtml('01')+'</select></div></div>',fd=>{state.seasonal.push({id:uid(),name:String(fd.get('name')||'Άλλο').trim(),month:String(fd.get('month')||'01'),amount:Number(fd.get('amount')||0),enabled:true,custom:true})},'Προσθήκη');
  const from=document.getElementById('seasonalFromSalaries');
  if(from)from.onclick=()=>{
    const fresh=standardDefaults();
    for(const d of fresh){const x=state.seasonal.find(v=>v.id===d.id);if(x)x.amount=d.amount;else state.seasonal.push(d)}
    save();render();
  };
};

testView=function(){
  const t=activeTest(),p=ensureLongPlan(),start=balanceThroughMonth(state.activeMonth),n=Math.max(1,Number(p.months||1));if(p.buffer==null)p.buffer=100;const buffer=Math.max(0,Number(p.buffer||0)),baseExpenses=Number(p.expenses||0),totalExpenses=baseExpenses+buffer,monthly=Number(p.income||0)-totalExpenses,ev=events(state.activeMonth,n),extras=totalEvents(ev),end=start+monthly*n+extras;
  let scenario='';
  if(!t)scenario='<section class="section"><div class="empty"><h2>Δεν υπάρχει τεστ ακόμα</h2><p>Φτιάξε ένα πρόχειρο σενάριο χωρίς να αλλάξει τίποτα πραγματικό.</p><button class="btn warn" id="newTest">+ Νέο τεστ</button></div></section>';
  else{
    const inc=testIncome(t),exp=testExpense(t),before=inc-exp,after=before-Number(t.plannedSavings||0),chips=state.tests.slice().reverse().map(x=>'<button class="test-chip '+(x.id===t.id?'active':'')+'" data-open-test="'+x.id+'">'+esc(x.title)+'</button>').join('');
    scenario='<section class="workspace"><div class="test-list">'+chips+'</div><div class="workspace-row"><div><div class="mini">Πρόχειρο σενάριο</div><h2 class="month-title">'+esc(t.title)+'</h2></div><div class="workspace-group"><button class="btn warn" id="newTest">+ Νέο τεστ</button><button class="btn danger" id="removeTest">Αφαίρεση</button></div></div></section>'+
    '<section class="summary"><div class="kpi test"><small>Έσοδα</small><strong>'+euro(inc)+'</strong></div><div class="kpi test"><small>Έξοδα</small><strong>'+euro(exp)+'</strong></div><div class="kpi test"><small>Περίσσευμα</small><strong>'+euro(before)+'</strong></div><div class="kpi test"><small>Με υποθετική άκρη</small><strong>'+euro(after)+'</strong></div></section>'+
    '<section class="section"><div class="section-head"><div><h2>Έσοδα τεστ</h2></div><button class="btn warn" data-add="t-income">+ Άλλο</button></div><div class="list">'+t.incomes.map(x=>incomeRow(x,'income',true,true)).join('')+t.extraIncomes.map(x=>incomeRow(x,'extraIncome',true,false)).join('')+'</div></section>'+
    '<section class="section"><div class="section-head"><div><h2>Έξοδα τεστ</h2></div><button class="btn warn" data-add="t-expense">+ Άλλο</button></div><div class="list">'+t.expenses.map(x=>recurringRow(x,true)).join('')+t.extraExpenses.map(x=>extraExpenseRow(x,true)).join('')+'</div></section>'+
    '<section class="section"><div class="save-card"><small>Αν έβαζες στην άκρη</small><div class="save-form"><input id="plannedSavings" type="number" min="0" step="0.01" value="'+Number(t.plannedSavings||0)+'"><span class="btn warn" style="pointer-events:none">ΤΕΣΤ</span></div></div></section>';
  }
  return '<div class="notice test-note">Το Τεστ δεν επηρεάζει τους πραγματικούς μήνες.</div>'+scenario+
  '<section class="section"><div class="section-head"><div><h2>Μακροπρόθεσμο πλάνο</h2><p>Βάλε έναν συνηθισμένο μήνα και κράτα ξεχωριστό μαξιλάρι για έκτακτες ανάγκες.</p></div><button class="btn warn small" id="planFromMonth">Πάρε ποσά από ενεργό μήνα</button></div><div class="plan-grid"><div class="field"><label>Για πόσους μήνες</label><input id="planMonths" type="number" min="1" max="60" value="'+n+'"></div><div class="field"><label>Κανονικά έσοδα / μήνα</label><input id="planIncome" type="number" min="0" step="0.01" value="'+Number(p.income||0)+'"></div><div class="field"><label>Κανονικά έξοδα / μήνα</label><input id="planExpenses" type="number" min="0" step="0.01" value="'+baseExpenses+'"></div><div class="field"><label>Μαξιλάρι έκτακτης ανάγκης / μήνα</label><input id="planBuffer" type="number" min="0" step="0.01" value="'+buffer+'"></div><div class="field"><label>Σύνολο εξόδων που προβλέπω</label><input value="'+euro(totalExpenses)+'" disabled></div><div class="field"><label>Ήδη στην άκρη</label><input value="'+euro(start)+'" disabled></div></div>'+
  planSummaryCard(start,monthly,extras,end,n)+
  '<div class="projection">'+projectionRows(start,monthly,state.activeMonth,Math.min(24,n))+'</div></section>'+
  seasonalEditor();
};

adviceView=function(){
  const a=ensureAdvice(),start=balanceThroughMonth(state.activeMonth),n=Math.max(1,Number(a.months||1)),income=Number(a.income||0),expenses=Number(a.expenses||0),buffer=Math.max(0,Number(a.buffer==null?100:a.buffer)),target=Number(a.target||0),ev=events(state.activeMonth,n),extras=totalEvents(ev);
  const need=Math.max(0,target-start),afterExtras=Math.max(0,need-extras),requiredPerMonth=afterExtras/n,currentSave=income-expenses-buffer,maxTotalExpenses=income-requiredPerMonth,maxBaseExpenses=maxTotalExpenses-buffer,cut=Math.max(0,expenses-maxBaseExpenses),projected=start+currentSave*n+extras;
  const success=projected>=target-0.005;
  let verdict=success?'Με αυτά τα ποσά ο στόχος βγαίνει.':'Με αυτά τα ποσά ο στόχος δεν βγαίνει ακόμη.';
  let action='';
  if(success)action='Έχεις περιθώριο περίπου '+euro(Math.max(0,currentSave-requiredPerMonth))+' τον μήνα πάνω από το ελάχιστο που χρειάζεται.';
  else action='Χρειάζεται περίπου '+euro(cut)+' επιπλέον αποταμίευση τον μήνα, είτε από λιγότερα έξοδα είτε από περισσότερα έσοδα.';
  return '<div class="notice advice-note">Εδώ η λογική είναι απλή: στόχος → όσα έχεις ήδη → δώρα/επιδόματα → τι πρέπει να βάζεις κάθε κανονικό μήνα.</div>'+
  '<section class="section"><div class="section-head"><div><h2>Ο στόχος σου</h2></div><button class="btn purple small" id="adviceFromMonth">Πάρε έσοδα/έξοδα από ενεργό μήνα</button></div><div class="plan-grid"><div class="field"><label>Θέλω να έχω στην άκρη</label><input id="goalTarget" type="number" min="0" step="0.01" value="'+target+'"></div><div class="field"><label>Σε πόσους μήνες</label><input id="goalMonths" type="number" min="1" max="120" value="'+n+'"></div><div class="field"><label>Κανονικά έσοδα / μήνα</label><input id="goalIncome" type="number" min="0" step="0.01" value="'+income+'"></div><div class="field"><label>Κανονικά έξοδα / μήνα</label><input id="goalExpenses" type="number" min="0" step="0.01" value="'+expenses+'"></div><div class="field"><label>Μαξιλάρι έκτακτης ανάγκης / μήνα</label><input id="goalBuffer" type="number" min="0" step="0.01" value="'+buffer+'"></div></div></section>'+
  '<section class="section"><div class="goal-flow"><div class="goal-step"><span>1</span><div><small>Έχεις ήδη στην άκρη</small><strong>'+euro(start)+'</strong></div></div><div class="goal-step"><span>2</span><div><small>Δώρα / επιδόματα μέσα στους '+n+' μήνες</small><strong class="positive">+'+euro(extras)+'</strong></div></div><div class="goal-step"><span>3</span><div><small>Μένει να μαζευτεί από τους κανονικούς μήνες</small><strong>'+euro(afterExtras)+'</strong></div></div><div class="goal-step"><span>4</span><div><small>Άρα χρειάζεται κάθε μήνα</small><strong>'+euro(requiredPerMonth)+'</strong></div></div></div></section>'+
  '<section class="section"><div class="verdict '+(success?'ok':'need')+'"><small>Με τα σημερινά έσοδα, έξοδα και το μαξιλάρι έκτακτης ανάγκης</small><h2>'+esc(verdict)+'</h2><div class="verdict-number">'+euro(projected)+'</div><p>Εκτίμηση για το τέλος των '+n+' μηνών.</p><div class="notice" style="margin-top:10px">'+esc(action)+'</div></div><div class="advice-lines" style="margin-top:12px"><div class="advice-line"><span>Κανονικά έξοδα τώρα</span><strong>'+euro(expenses)+'</strong></div><div class="advice-line"><span>Μαξιλάρι έκτακτης ανάγκης</span><strong>'+euro(buffer)+'</strong></div><div class="advice-line"><span>Τώρα μπορείς να βάζεις / μήνα</span><strong>'+euro(currentSave)+'</strong></div><div class="advice-line"><span>Χρειάζεται να βάζεις / μήνα</span><strong>'+euro(requiredPerMonth)+'</strong></div><div class="advice-line"><span>Κανονικά έξοδα έως, κρατώντας το μαξιλάρι</span><strong>'+euro(maxBaseExpenses)+'</strong></div></div>'+eventHtml(ev)+'</section>'+
  seasonalEditor();
};

render();
})();