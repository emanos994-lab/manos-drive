(()=>{
function ensureCleanPrefs(){
  state.uiPrefs=state.uiPrefs||{};
  if(!Array.isArray(state.uiPrefs.openPanels))state.uiPrefs.openPanels=['fixed'];
  return state.uiPrefs;
}
function fixedSpent(m,id){return (m.expenseMoves||[]).filter(x=>x.expenseId===id).reduce((s,x)=>s+Number(x.amount||0),0)}
function remainingBills(m){
  const fixed=(m.expenses||[]).filter(x=>x.active!==false).reduce((s,e)=>s+Math.max(0,Number(e.amount||0)-fixedSpent(m,e.id)),0);
  const oneoff=window.maziOneOffOutstanding?window.maziOneOffOutstanding(m):(m.extraExpenses||[]).filter(x=>x.status!=='paid').reduce((s,x)=>s+Number(x.amount||0),0);
  return fixed+oneoff;
}
function recordedSpent(m){
  const fixed=(m.expenseMoves||[]).reduce((s,x)=>s+Number(x.amount||0),0);
  const oneoff=window.maziPaidExtra?window.maziPaidExtra(m):(m.extraExpenses||[]).filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount||0),0);
  return fixed+oneoff;
}
function quickDashboard(m){
  const forecast=monthIncome(m)-monthExpense(m),remain=remainingBills(m),spent=recordedSpent(m),savings=balanceThroughMonth(m.key);
  return '<section class="clean-dashboard">'+
   '<div class="clean-hero"><small>Αν δεν αλλάξει κάτι άλλο</small><span>Πιθανή αποταμίευση αυτού του κύκλου</span><strong class="'+(forecast<0?'negative':'positive')+'">'+euro(forecast)+'</strong></div>'+
   '<div class="clean-stats"><div><small>Μένουν να καλυφθούν</small><strong>'+euro(remain)+'</strong></div><div><small>Έχουν καταγραφεί ως πληρωμένα</small><strong>'+euro(spent)+'</strong></div><div><small>Συνολικά στην άκρη</small><strong>'+euro(savings)+'</strong></div></div>'+
   '<div class="clean-actions"><button class="btn primary" id="cleanAddExpense">+ Έξοδο</button><button class="btn soft" id="cleanAddIncome">+ Έσοδο</button><button class="btn green" id="cleanSavings">Στην άκρη</button><button class="btn warn" id="cleanForecast">Αν αγοράσουμε κάτι…</button></div>'+
  '</section>';
}
function panelMeta(key,m){
  if(key==='fixed')return euro((m.expenses||[]).filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0));
  if(key==='oneoff')return euro((m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0));
  if(key==='income')return euro(monthIncome(m));
  if(key==='savings')return euro(balanceThroughMonth(m.key));
  if(key==='reminders')return 'ημερομηνίες';
  if(key==='review')return 'τέλος κύκλου';
  return '';
}
function makePanel(section,key,title,m){
  if(!section||section.closest('.clean-panel'))return null;
  const prefs=ensureCleanPrefs(),details=document.createElement('details');
  details.className='clean-panel clean-'+key;
  details.dataset.cleanPanel=key;
  details.open=prefs.openPanels.includes(key);
  const summary=document.createElement('summary');
  summary.innerHTML='<span>'+title+'</span><small>'+panelMeta(key,m)+'</small>';
  section.parentNode.insertBefore(details,section);
  details.appendChild(summary);details.appendChild(section);
  details.addEventListener('toggle',()=>{
    const p=ensureCleanPrefs();
    if(details.open&&!p.openPanels.includes(key))p.openPanels.push(key);
    if(!details.open)p.openPanels=p.openPanels.filter(x=>x!==key);
    localStorage.setItem(storeKey,JSON.stringify(state));
  });
  return details;
}
function findSection(title){
  return [...document.querySelectorAll('#app section')].find(s=>s.querySelector('h2')?.textContent.trim()===title);
}
function openPanel(key){
  const d=document.querySelector('[data-clean-panel="'+key+'"]');if(!d)return;
  d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});
}
function applyCleanUi(){
  if(view!=='real')return;
  const app=document.getElementById('app'),m=curMonth();if(!app)return;
  const oldDash=app.querySelector('.clean-dashboard');if(oldDash)oldDash.remove();
  app.querySelector('.summary')?.remove();
  app.querySelector('.flow-forecast')?.remove();
  const cycle=app.querySelector('.cycle-banner')||app.querySelector('.workspace');
  if(cycle)cycle.insertAdjacentHTML('afterend',quickDashboard(m)); else app.insertAdjacentHTML('afterbegin',quickDashboard(m));

  makePanel(findSection('Πάγια'),'fixed','Υποχρεώσεις & πάγια',m);
  makePanel(findSection('Έξοδα μόνο αυτού του μήνα'),'oneoff','Έκτακτα / Klarna / αγορές',m);
  makePanel(findSection('Υπενθυμίσεις πληρωμών'),'reminders','Υπενθυμίσεις',m);
  makePanel(findSection('Έσοδα'),'income','Έσοδα',m);
  makePanel(findSection('Αποταμίευση'),'savings','Αποταμίευση',m);
  makePanel(findSection('Απολογισμός κύκλου'),'review','Απολογισμός κύκλου',m);

  const order=['fixed','oneoff','reminders','income','savings','review'];
  const panels=order.map(k=>app.querySelector('[data-clean-panel="'+k+'"]')).filter(Boolean);
  const dash=app.querySelector('.clean-dashboard');
  let anchor=dash;
  for(const p of panels){anchor.insertAdjacentElement('afterend',p);anchor=p}

  const exp=document.getElementById('cleanAddExpense');if(exp)exp.onclick=()=>document.querySelector('[data-add="r-expense"]')?.click();
  const inc=document.getElementById('cleanAddIncome');if(inc)inc.onclick=()=>{openPanel('income');setTimeout(()=>document.querySelector('[data-add="r-income"]')?.click(),180)};
  const sav=document.getElementById('cleanSavings');if(sav)sav.onclick=()=>openPanel('savings');
  const forecast=document.getElementById('cleanForecast');if(forecast)forecast.onclick=()=>{view='test';render()};
}
const previousRender=render;
render=function(){previousRender();applyCleanUi()};
render();
})();