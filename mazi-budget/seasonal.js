(()=>{
function salaryTotalFor(s){
 const m=s?.months?.[s.activeMonth];
 if(!m)return 1986;
 return Number(m.incomes?.find(x=>x.id==='i1')?.amount||0)+Number(m.incomes?.find(x=>x.id==='i6')?.amount||0);
}
function defaultsFor(s){
 const total=salaryTotalFor(s);
 return [
  {id:'christmas',name:'Δώρο Χριστουγέννων',month:'12',amount:total,enabled:true,custom:false},
  {id:'easter',name:'Δώρο Πάσχα',month:'04',amount:total/2,enabled:true,custom:false},
  {id:'vacation',name:'Επίδομα αδείας',month:'07',amount:total/2,enabled:true,custom:false}
 ];
}
function ensureSeasonalOn(s){
 if(!Array.isArray(s.seasonal)||!s.seasonal.length)s.seasonal=defaultsFor(s);
 return s;
}
if(window.maziNormalizeState){
 const baseNormalize=window.maziNormalizeState;
 window.maziNormalizeState=raw=>ensureSeasonalOn(baseNormalize(raw));
}
ensureSeasonalOn(state);
localStorage.setItem(storeKey,JSON.stringify(state));

function futureMonthKeys(startKey,n){
 const [y,m]=String(startKey).split('-').map(Number),out=[];
 for(let i=1;i<=n;i++){const d=new Date(y,m-1+i,1);out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))}
 return out;
}
function events(startKey,n){
 const out=[];
 for(const key of futureMonthKeys(startKey,n)){
  const mm=key.slice(5,7);
  for(const x of state.seasonal||[])if(x.enabled!==false&&String(x.month).padStart(2,'0')===mm&&Number(x.amount||0)>0)out.push({key,name:x.name,amount:Number(x.amount||0)});
 }
 return out;
}
function monthName(mm){return new Date('2026-'+String(mm).padStart(2,'0')+'-01T12:00:00').toLocaleDateString('el-GR',{month:'long'})}
function monthSelectHtml(value){
 let out='';
 for(let i=1;i<=12;i++){const v=String(i).padStart(2,'0');out+='<option value="'+v+'" '+(v===String(value).padStart(2,'0')?'selected':'')+'>'+esc(monthName(v))+'</option>'}
 return out;
}
function seasonalEditor(){
 return '<section class="section"><div class="section-head"><div><h2>Προγραμματισμένα έξτρα έσοδα</h2><p>Μετράνε αυτόματα μόνο στους μήνες που πέφτουν μέσα στο πλάνο.</p></div><div class="actions"><button class="btn green small" id="seasonalFromSalaries">Από μισθούς</button><button class="btn soft small" id="addSeasonal">+ Άλλο</button></div></div><div class="seasonal-list">'+
 (state.seasonal||[]).map(x=>'<div class="seasonal-row"><input type="checkbox" data-seasonal-enabled="'+x.id+'" '+(x.enabled===false?'':'checked')+'><label>'+esc(x.name)+'</label><select data-seasonal-month="'+x.id+'">'+monthSelectHtml(x.month)+'</select><input type="number" min="0" step="0.01" value="'+Number(x.amount||0)+'" data-seasonal-amount="'+x.id+'">'+(x.custom?'<button class="remove" data-seasonal-remove="'+x.id+'">×</button>':'<span></span>')+'</div>').join('')+
 '</div><div class="notice" style="margin-top:10px">Οι αρχικές τιμές είναι εκτίμηση από τους δύο βασικούς μισθούς. Άλλαξε ποσό ή μήνα ώστε να ταιριάζει σε αυτό που πραγματικά θα πάρετε.</div></section>';
}
function eventHtml(list){
 return list.length?'<div class="seasonal-events">'+list.map(x=>'<div class="seasonal-event"><span>'+esc(monthLabel(x.key))+' · '+esc(x.name)+'</span><strong class="positive">+'+euro(x.amount)+'</strong></div>').join('')+'</div>':'<div class="mini" style="margin-top:10px">Δεν υπάρχει ενεργό έξτρα έσοδο μέσα σε αυτό το διάστημα.</div>';
}
function projectionRowsSeasonal(start,monthly,startKey,n){
 let out='',bal=start;
 for(const key of futureMonthKeys(startKey,n)){
  const extra=(state.seasonal||[]).filter(x=>x.enabled!==false&&String(x.month).padStart(2,'0')===key.slice(5,7)).reduce((s,x)=>s+Number(x.amount||0),0);
  bal+=monthly+extra;
  out+='<div class="projection-row"><span>'+esc(monthLabel(key))+(extra>0?' · +'+euro(extra)+' έξτρα':'')+'</span><strong>'+euro(bal)+'</strong></div>';
 }
 return out;
}

const originalBind=bind;
bind=function(){
 originalBind();
 document.querySelectorAll('[data-seasonal-enabled]').forEach(el=>el.onchange=()=>{const x=state.seasonal.find(v=>v.id===el.dataset.seasonalEnabled);if(x){x.enabled=el.checked;save();render()}});
 document.querySelectorAll('[data-seasonal-month]').forEach(el=>el.onchange=()=>{const x=state.seasonal.find(v=>v.id===el.dataset.seasonalMonth);if(x){x.month=el.value;save();render()}});
 document.querySelectorAll('[data-seasonal-amount]').forEach(el=>el.onchange=()=>{const x=state.seasonal.find(v=>v.id===el.dataset.seasonalAmount);if(x){x.amount=Math.max(0,Number(el.value||0));save();render()}});
 document.querySelectorAll('[data-seasonal-remove]').forEach(el=>el.onclick=()=>{state.seasonal=state.seasonal.filter(v=>v.id!==el.dataset.seasonalRemove);save();render()});
 const add=document.getElementById('addSeasonal');
 if(add)add.onclick=()=>showModal('Άλλο προγραμματισμένο έσοδο','<div class="form-grid"><div class="field"><label>Περιγραφή</label><input name="name" required></div><div class="field"><label>Ποσό</label><input name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Μήνας</label><select name="month">'+monthSelectHtml('01')+'</select></div></div>',fd=>{state.seasonal.push({id:uid(),name:String(fd.get('name')||'Άλλο').trim(),month:String(fd.get('month')||'01'),amount:Number(fd.get('amount')||0),enabled:true,custom:true})},'Προσθήκη');
 const from=document.getElementById('seasonalFromSalaries');
 if(from)from.onclick=()=>{const fresh=defaultsFor(state);for(const d of fresh){const x=state.seasonal.find(v=>v.id===d.id);if(x)x.amount=d.amount;else state.seasonal.push(d)}save();render()};
};

testView=function(){
 const t=activeTest(),p=ensureLongPlan(),start=balanceThroughMonth(state.activeMonth),planN=Math.max(1,Number(p.months||1)),surplus=Number(p.income||0)-Number(p.expenses||0),ev=events(state.activeMonth,planN),extras=ev.reduce((s,x)=>s+x.amount,0),end=start+surplus*planN+extras;
 let scenario='';
 if(!t)scenario='<section class="section"><div class="empty"><h2>Δεν υπάρχει τεστ ακόμα</h2><p>Δημιούργησε ένα αντίγραφο του ενεργού μήνα και άλλαζε ό,τι θέλεις χωρίς πραγματική επίδραση.</p><button class="btn warn" id="newTest">+ Νέο τεστ</button></div></section>';
 else{
  const inc=testIncome(t),exp=testExpense(t),before=inc-exp,after=before-Number(t.plannedSavings||0),chips=state.tests.slice().reverse().map(x=>'<button class="test-chip '+(x.id===t.id?'active':'')+'" data-open-test="'+x.id+'">'+esc(x.title)+'</button>').join('');
  scenario='<section class="workspace"><div class="test-list">'+chips+'</div><div class="workspace-row"><div><div class="mini">Σενάριο</div><h2 class="month-title">'+esc(t.title)+'</h2><div class="mini">Βάση: '+esc(monthLabel(t.sourceMonth||state.activeMonth))+'</div></div><div class="workspace-group"><button class="btn warn" id="newTest">+ Νέο τεστ</button><button class="btn danger" id="removeTest">Αφαίρεση τεστ</button><div class="field"><label>Ημερομηνία</label><input id="testDate" type="date" value="'+esc(t.date||'')+'"></div></div></div></section>'+
  '<section class="summary"><div class="kpi test"><small>Έσοδα τεστ</small><strong>'+euro(inc)+'</strong></div><div class="kpi test"><small>Έξοδα τεστ</small><strong>'+euro(exp)+'</strong></div><div class="kpi test"><small>Πριν την υποθετική άκρη</small><strong>'+euro(before)+'</strong></div><div class="kpi test"><small>Τελικό υπόλοιπο</small><strong class="'+(after<0?'negative':'')+'">'+euro(after)+'</strong></div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Έσοδα Τεστ</h2><p>Μόνο υποθετικά.</p></div><button class="btn warn" data-add="t-income">+ Άλλο</button></div><div class="list">'+t.incomes.map(x=>incomeRow(x,'income',true,true)).join('')+t.extraIncomes.map(x=>incomeRow(x,'extraIncome',true,false)).join('')+'</div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Πάγια & έξοδα Τεστ</h2><p>Κλείσε πάγια ή άλλαξε ποσά χωρίς να πειράξεις τον πραγματικό μήνα.</p></div><button class="btn warn" data-add="t-expense">+ Άλλο</button></div><div class="list">'+t.expenses.map(x=>recurringRow(x,true)).join('')+t.extraExpenses.map(x=>extraExpenseRow(x,true)).join('')+'</div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Υποθετική αποταμίευση</h2><p>Δεν αλλάζει την πραγματική «Άκρη».</p></div></div><div class="save-card"><small>Αν έβαζες στην άκρη</small><div class="save-form"><input id="plannedSavings" type="number" min="0" step="0.01" value="'+Number(t.plannedSavings||0)+'"><span class="btn warn" style="pointer-events:none">ΤΕΣΤ</span></div><div class="total-line"><span>Θα σου έμεναν</span><strong>'+euro(after)+'</strong></div></div></section>';
 }
 return '<div class="notice test-note">ΤΕΣΤ: τίποτα εδώ δεν αλλάζει πραγματικές κινήσεις ή αποταμίευση.</div>'+scenario+seasonalEditor()+
 '<section class="section"><div class="section-head"><div><h2>Μακροπρόθεσμο πλάνο</h2><p>Προσθέτει τα προγραμματισμένα έξτρα έσοδα στους σωστούς μήνες.</p></div><button class="btn warn small" id="planFromMonth">Πάρε ποσά από ενεργό μήνα</button></div><div class="plan-grid"><div class="field"><label>Μήνες</label><input id="planMonths" type="number" min="1" max="60" value="'+Number(p.months||10)+'"></div><div class="field"><label>Μηνιαία έσοδα</label><input id="planIncome" type="number" min="0" step="0.01" value="'+Number(p.income||0)+'"></div><div class="field"><label>Λογικά μηνιαία έξοδα</label><input id="planExpenses" type="number" min="0" step="0.01" value="'+Number(p.expenses||0)+'"></div><div class="field"><label>Αφετηρία στην άκρη</label><input value="'+euro(start)+'" disabled></div></div><div class="plan-result"><div class="mini">Κανονικό περίσσευμα ανά μήνα</div><strong class="'+(surplus>=0?'positive':'negative')+'">'+euro(surplus)+'</strong><div class="mini" style="margin-top:6px">Έξτρα έσοδα στο διάστημα: <strong class="positive">'+euro(extras)+'</strong></div>'+eventHtml(ev)+'<div class="total-line"><span>Εκτίμηση μετά από '+planN+' μήνες</span><strong>'+euro(end)+'</strong></div><div class="projection">'+projectionRowsSeasonal(start,surplus,state.activeMonth,Math.min(24,planN))+'</div></div></section>';
};

adviceView=function(){
 const a=ensureAdvice(),start=balanceThroughMonth(state.activeMonth),months=Math.max(1,Number(a.months||1)),income=Number(a.income||0),expenses=Number(a.expenses||0),target=Number(a.target||0),ev=events(state.activeMonth,months),extras=ev.reduce((s,x)=>s+x.amount,0),need=Math.max(0,target-start),regularNeed=Math.max(0,need-extras),req=regularNeed/months,maxExp=income-req,currentSurplus=income-expenses,projected=start+currentSurplus*months+extras,cut=Math.max(0,expenses-maxExp);
 let msg='';
 if(target<=start)msg='Ο στόχος έχει ήδη καλυφθεί με το ποσό που υπάρχει στην άκρη.';
 else if(maxExp<0)msg='Ο στόχος παραμένει πολύ απαιτητικός ακόμη και μετά τα έξτρα έσοδα. Χρειάζεται περισσότερος χρόνος ή επιπλέον εισόδημα.';
 else if(cut<=0)msg='Με τα σημερινά λογικά έξοδα και τα προγραμματισμένα έξτρα έσοδα, ο στόχος βγαίνει χωρίς επιπλέον περικοπή.';
 else msg='Με τα έξτρα έσοδα ήδη υπολογισμένα, χρειάζεται περίπου '+euro(cut)+' λιγότερα έξοδα τον μήνα ή ισόποση αύξηση εσόδων.';
 return '<div class="notice advice-note">Η Συμβουλευτική είναι αριθμητικό πλάνο. Τα Δώρα/επιδόματα εδώ είναι εκτιμήσεις που εσύ ενεργοποιείς και διορθώνεις.</div>'+
 '<section class="section"><div class="section-head"><div><h2>Στόχος αποταμίευσης</h2><p>Διάλεξε πόσα θέλεις να έχεις συνολικά στην άκρη και σε πόσους μήνες.</p></div><button class="btn purple small" id="adviceFromMonth">Πάρε ποσά από ενεργό μήνα</button></div><div class="plan-grid"><div class="field"><label>Στόχος συνολικά στην άκρη</label><input id="goalTarget" type="number" min="0" step="0.01" value="'+target+'"></div><div class="field"><label>Σε πόσους μήνες</label><input id="goalMonths" type="number" min="1" max="120" value="'+months+'"></div><div class="field"><label>Μέσο μηνιαίο εισόδημα</label><input id="goalIncome" type="number" min="0" step="0.01" value="'+income+'"></div><div class="field"><label>Λογικά μηνιαία έξοδα τώρα</label><input id="goalExpenses" type="number" min="0" step="0.01" value="'+expenses+'"></div></div></section>'+
 seasonalEditor()+
 '<section class="summary"><div class="kpi advice"><small>Έχεις ήδη</small><strong>'+euro(start)+'</strong></div><div class="kpi advice"><small>Έξτρα έσοδα στο διάστημα</small><strong class="positive">'+euro(extras)+'</strong></div><div class="kpi advice"><small>Κανονική αποταμίευση / μήνα</small><strong>'+euro(req)+'</strong></div><div class="kpi advice"><small>Μέγιστα έξοδα / μήνα</small><strong class="'+(maxExp<0?'negative':'')+'">'+euro(maxExp)+'</strong></div></section>'+
 '<section class="section"><div class="advice-box"><h3>Πρακτική εικόνα</h3><div class="advice-big">'+euro(projected)+'</div><div class="mini">Με τα σημερινά ποσά και τα ενεργά έξτρα έσοδα, περίπου τόσα θα είχες μετά από '+months+' μήνες.</div>'+eventHtml(ev)+'<div class="advice-lines"><div class="advice-line"><span>Συνολικό κενό από τον στόχο σήμερα</span><strong>'+euro(need)+'</strong></div><div class="advice-line"><span>Τωρινό μηνιαίο περίσσευμα</span><strong>'+euro(currentSurplus)+'</strong></div><div class="advice-line"><span>Ανώτατο όριο εξόδων για τον στόχο</span><strong>'+euro(maxExp)+'</strong></div><div class="advice-line"><span>Προτεινόμενη μείωση εξόδων</span><strong class="'+(cut>0?'negative':'positive')+'">'+euro(cut)+'</strong></div></div><div class="notice advice-note" style="margin:12px 0 0">'+esc(msg)+'</div></div></section>';
};

render();
})();