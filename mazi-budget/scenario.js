(()=>{
function ensureSimpleScenario(){
  if(!state.simpleScenario)state.simpleScenario={items:[],extraIncome:0};
  if(!Array.isArray(state.simpleScenario.items))state.simpleScenario.items=[];
  if(state.simpleScenario.extraIncome==null)state.simpleScenario.extraIncome=0;
  return state.simpleScenario;
}
function scenarioExpense(){return ensureSimpleScenario().items.reduce((s,x)=>s+Number(x.amount||0),0)}
function scenarioIncome(){return Math.max(0,Number(ensureSimpleScenario().extraIncome||0))}
function currentForecast(){
  const m=curMonth();
  return monthIncome(m)-monthExpense(m);
}
function futureKeys(startKey,n){
  const [y,m]=String(startKey).split('-').map(Number),out=[];
  for(let i=1;i<=n;i++){const d=new Date(y,m-1+i,1);out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))}
  return out;
}
function seasonalForKey(key){
  const mm=key.slice(5,7);
  return (state.seasonal||[]).filter(x=>x.enabled!==false&&String(x.month).padStart(2,'0')===mm).reduce((s,x)=>s+Number(x.amount||0),0);
}
function planRows(start,monthly,n){
  let bal=start,out='';
  for(const key of futureKeys(state.activeMonth,n)){
    const extra=seasonalForKey(key);
    bal+=monthly+extra;
    out+='<div class="projection-row"><span>'+esc(monthLabel(key))+(extra>0?' · έξτρα +'+euro(extra):'')+'</span><strong>'+euro(bal)+'</strong></div>';
  }
  return out;
}
function scenarioRows(){
  const s=ensureSimpleScenario();
  if(!s.items.length)return '<div class="scenario-empty">Δεν έχεις βάλει δοκιμαστικό έξοδο ακόμα.</div>';
  return s.items.map(x=>'<div class="scenario-item"><div><strong>'+esc(x.name||'Δοκιμαστικό έξοδο')+'</strong><small>Μόνο για τον υπολογισμό</small></div><strong class="negative">-'+euro(x.amount)+'</strong><button class="remove" data-scenario-remove="'+x.id+'">×</button></div>').join('');
}
testView=function(){
  const m=curMonth(),s=ensureSimpleScenario(),before=currentForecast(),trialExpense=scenarioExpense(),trialIncome=scenarioIncome(),after=before-trialExpense+trialIncome;
  const p=ensureLongPlan();if(p.buffer==null)p.buffer=100;
  const n=Math.max(1,Number(p.months||10)),income=Number(p.income||0),expenses=Number(p.expenses||0),buffer=Math.max(0,Number(p.buffer||0));
  const monthly=income-expenses-buffer,start=balanceThroughMonth(state.activeMonth),keys=futureKeys(state.activeMonth,n);
  const extras=keys.reduce((sum,k)=>sum+seasonalForKey(k),0),end=start+monthly*n+extras;
  return '<div class="notice test-note"><strong>Πρόβλεψη, όχι πραγματική καταχώριση.</strong> Εδώ δοκιμάζεις “αν κάνουμε αυτό, πόσα θα μας μείνουν;” χωρίς να αλλάζει ο πραγματικός κύκλος.</div>'+
  '<section class="section scenario-main"><div class="section-head"><div><h2>Αν κάνουμε μια αγορά τώρα…</h2><p>Η βάση είναι ο πραγματικός κύκλος '+esc(monthLabel(m.key))+'.</p></div><button class="btn ghost small" id="scenarioClear">Καθαρισμός</button></div>'+
  '<div class="scenario-compare"><div><small>Με τα σημερινά δεδομένα</small><strong class="'+(before<0?'negative':'positive')+'">'+euro(before)+'</strong><span>πιθανή αποταμίευση</span></div><div class="scenario-arrow">→</div><div class="after"><small>Με το δοκιμαστικό σενάριο</small><strong class="'+(after<0?'negative':'positive')+'">'+euro(after)+'</strong><span>'+(after<before?'λιγότερα κατά '+euro(before-after):after>before?'περισσότερα κατά '+euro(after-before):'χωρίς αλλαγή')+'</span></div></div>'+
  '<div class="scenario-add"><div class="field"><label>Τι σκέφτεστε να πάρετε / πληρώσετε</label><input id="scenarioName" placeholder="π.χ. αγορά ρούχων"></div><div class="field"><label>Πόσο</label><input id="scenarioAmount" type="number" min="0" step="0.01" placeholder="0,00"></div><button class="btn warn" id="scenarioAdd">+ Δοκιμή εξόδου</button></div>'+
  '<div class="scenario-income"><div class="field"><label>Αν περιμένουμε και κάποιο έξτρα έσοδο μόνο για τη δοκιμή</label><input id="scenarioExtraIncome" type="number" min="0" step="0.01" value="'+trialIncome+'"></div></div>'+
  '<div class="scenario-list">'+scenarioRows()+'</div>'+
  '<div class="notice" style="margin-top:10px">Τίποτα από εδώ δεν περνάει στα πραγματικά έξοδα. Αν τελικά γίνει η αγορά, την καταχωρίζεις από τον πραγματικό κύκλο.</div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Πλάνο πολλών μηνών</h2><p>Για να δεις περίπου πού μπορεί να φτάσει η αποταμίευση αν οι επόμενοι μήνες κινηθούν λογικά έτσι.</p></div><button class="btn soft small" id="planFromMonth">Πάρε ποσά από τον τρέχοντα κύκλο</button></div>'+
  '<div class="plan-grid"><div class="field"><label>Για πόσους μήνες</label><input id="planMonths" type="number" min="1" max="60" value="'+n+'"></div><div class="field"><label>Κανονικά έσοδα / μήνα</label><input id="planIncome" type="number" min="0" step="0.01" value="'+income+'"></div><div class="field"><label>Κανονικά έξοδα / μήνα</label><input id="planExpenses" type="number" min="0" step="0.01" value="'+expenses+'"></div><div class="field"><label>Μαξιλάρι έκτακτης ανάγκης / μήνα</label><input id="planBuffer" type="number" min="0" step="0.01" value="'+buffer+'"></div></div>'+
  '<div class="scenario-plan-summary"><div><small>Αποταμίευση ενός “κανονικού” μήνα</small><strong class="'+(monthly<0?'negative':'positive')+'">'+euro(monthly)+'</strong></div><div><small>Δώρα / επιδόματα μέσα στο διάστημα</small><strong class="positive">+'+euro(extras)+'</strong></div><div><small>Ήδη στην άκρη</small><strong>'+euro(start)+'</strong></div><div class="final"><small>Εκτίμηση μετά από '+n+' μήνες</small><strong>'+euro(end)+'</strong></div></div>'+
  '<div class="projection">'+planRows(start,monthly,Math.min(24,n))+'</div></section>';
};

const previousBind=bind;
bind=function(){
  previousBind();
  const s=ensureSimpleScenario();
  const add=document.getElementById('scenarioAdd');
  if(add)add.onclick=()=>{
    const amount=Math.max(0,Number(document.getElementById('scenarioAmount')?.value||0));
    if(!amount){alert('Βάλε πρώτα ποσό.');return}
    const name=String(document.getElementById('scenarioName')?.value||'Δοκιμαστικό έξοδο').trim()||'Δοκιμαστικό έξοδο';
    s.items.push({id:uid(),name,amount});save();render();
  };
  document.querySelectorAll('[data-scenario-remove]').forEach(b=>b.onclick=()=>{s.items=s.items.filter(x=>x.id!==b.dataset.scenarioRemove);save();render()});
  const clear=document.getElementById('scenarioClear');if(clear)clear.onclick=()=>{s.items=[];s.extraIncome=0;save();render()};
  const inc=document.getElementById('scenarioExtraIncome');if(inc)inc.onchange=e=>{s.extraIncome=Math.max(0,Number(e.target.value||0));save();render()};
};
render();
})();