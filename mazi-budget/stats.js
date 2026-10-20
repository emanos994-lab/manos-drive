(()=>{
function statMonthData(key){
  const m=state.months?.[key]; if(!m)return null;
  const income=monthIncome(m);
  const expense=monthExpense(m);
  const saved=monthSavingsNet(key);
  const oneoffs=(m.extraExpenses||[]).reduce((s,x)=>s+Number(x.amount||0),0);
  const dei=(m.expenses||[]).find(x=>x.id==='e19'||x.name==='ΔΕΗ');
  const expected=income-expense;
  return {
    key,m,income,expense,saved,oneoffs,expected,
    deiAmount:Number(dei?.amount||0),
    deiKnown:dei?.actualKnown===true,
    deiEntered:dei?.actualEnteredAt||'',
    deiCreated:dei?.createdAt||dei?.actualEnteredAt||'',
    deiUpdated:dei?.updatedAt||dei?.actualEnteredAt||''
  };
}
function statKeys(){return Object.keys(state.months||{}).filter(k=>k<=state.activeMonth).sort()}
function deltaText(v){
  const n=Number(v||0);
  if(Math.abs(n)<0.005)return 'ίδιο';
  return (n>0?'+':'')+euro(n);
}
function statSummary(){
  const rows=statKeys().map(statMonthData).filter(Boolean);
  const done=rows.filter(r=>r.key!==state.activeMonth||monthSavingsNet(r.key)!==0);
  const avgSaved=done.length?done.reduce((s,r)=>s+r.saved,0)/done.length:0;
  const avgExpense=rows.length?rows.reduce((s,r)=>s+r.expense,0)/rows.length:0;
  const best=done.length?done.slice().sort((a,b)=>b.saved-a.saved)[0]:null;
  return {rows,done,avgSaved,avgExpense,best};
}
function comparisonHtml(rows){
  if(rows.length<2)return '<div class="stats-empty">Χρειάζονται τουλάχιστον 2 κύκλοι για σύγκριση.</div>';
  const a=rows[rows.length-2],b=rows[rows.length-1];
  const cards=[
    ['Σύνολο εξόδων',b.expense-a.expense,'Από '+euro(a.expense)+' σε '+euro(b.expense)],
    ['Έκτακτα',b.oneoffs-a.oneoffs,'Από '+euro(a.oneoffs)+' σε '+euro(b.oneoffs)],
    ['ΔΕΗ',b.deiAmount-a.deiAmount,'Από '+euro(a.deiAmount)+' σε '+euro(b.deiAmount)],
    ['Μπήκαν στην άκρη',b.saved-a.saved,'Από '+euro(a.saved)+' σε '+euro(b.saved)]
  ];
  return '<div class="stats-compare">'+cards.map(([name,d,sub])=>'<div class="stats-change"><small>'+name+'</small><strong class="'+(d>0?(name==='Μπήκαν στην άκρη'?'positive':'negative'):(d<0?(name==='Μπήκαν στην άκρη'?'negative':'positive'):''))+'">'+deltaText(d)+'</strong><span>'+sub+'</span></div>').join('')+'</div>';
}
function monthlyHistory(rows){
  if(!rows.length)return '<div class="stats-empty">Δεν υπάρχουν ακόμα κύκλοι.</div>';
  const max=Math.max(1,...rows.map(r=>Math.max(r.expense,Math.abs(r.saved))));
  return '<div class="stats-history">'+rows.slice().reverse().map(r=>{
    const expW=Math.min(100,(r.expense/max)*100),saveW=Math.min(100,(Math.max(0,r.saved)/max)*100);
    return '<div class="stats-month-card"><div class="stats-month-head"><div><strong>'+esc(monthLabel(r.key))+'</strong><small>'+euro(r.income)+' έσοδα · '+euro(r.expense)+' έξοδα</small></div><div class="stats-month-save"><small>Στην άκρη</small><strong class="'+(r.saved<0?'negative':'positive')+'">'+euro(r.saved)+'</strong></div></div>'+
    '<div class="stats-bars"><div><span>Έξοδα</span><i><b style="width:'+expW+'%"></b></i></div><div><span>Αποταμίευση</span><i><b class="save" style="width:'+saveW+'%"></b></i></div></div>'+
    '<div class="stats-month-foot"><span>Έκτακτα '+euro(r.oneoffs)+'</span><span>ΔΕΗ '+euro(r.deiAmount)+(r.deiKnown?'':' · εκτίμηση')+'</span><span>Θεωρητικό υπόλοιπο '+euro(r.expected)+'</span></div></div>';
  }).join('')+'</div>';
}
function deiHistory(rows){
  const list=rows.slice().reverse().filter(r=>r.m?.expenses?.some(x=>x.id==='e19'||x.name==='ΔΕΗ'));
  if(!list.length)return '<div class="stats-empty">Δεν υπάρχει ιστορικό ΔΕΗ ακόμα.</div>';
  return '<div class="dei-history">'+list.map(r=>{const dates=r.deiCreated?('Καταχωρήθηκε '+fmtDate(r.deiCreated)+(r.deiUpdated&&r.deiUpdated!==r.deiCreated?' · Τελ. αλλαγή '+fmtDate(r.deiUpdated):'')):(r.deiKnown?'Ποσό επιβεβαιωμένο':'Προσωρινή εκτίμηση');return '<div class="dei-history-row"><div><strong>'+esc(monthLabel(r.key))+'</strong><small>'+dates+'</small></div><strong>'+euro(r.deiAmount)+'</strong></div>'}).join('')+'</div>';
}
function statsView(){
  const s=statSummary(),rows=s.rows,best=s.best;
  const latest=rows.length?rows[rows.length-1]:null;
  return '<div class="page-intro"><div><small>Ιστορικό</small><h2>Στατιστικά κύκλων</h2><p>Για να βλέπετε τι άλλαξε από μήνα σε μήνα και πού πήγαν τα χρήματα.</p></div></div>'+
  '<section class="stats-top">'+
    '<div><small>Συνολικά στην άκρη</small><strong>'+euro(balanceThroughMonth(rows.length?rows[rows.length-1].key:state.activeMonth))+'</strong></div>'+
    '<div><small>Μέση αποταμίευση / κύκλο</small><strong>'+euro(s.avgSaved)+'</strong></div>'+
    '<div><small>Μέσα έξοδα / κύκλο</small><strong>'+euro(s.avgExpense)+'</strong></div>'+
    '<div><small>Καλύτερος κύκλος</small><strong>'+(best?euro(best.saved):'—')+'</strong><span>'+(best?esc(monthLabel(best.key)):'Δεν υπάρχει ακόμα')+'</span></div>'+
  '</section>'+
  '<section class="section stats-section"><div class="section-head"><div><h2>Σε σχέση με τον προηγούμενο κύκλο</h2><p>'+(latest?'Τρέχων: '+esc(monthLabel(latest.key)):'')+'</p></div></div>'+comparisonHtml(rows)+'</section>'+
  '<section class="section stats-section"><div class="section-head"><div><h2>Ιστορικό ανά κύκλο</h2><p>Έσοδα, έξοδα, έκτακτα και όσα μπήκαν πραγματικά στην άκρη.</p></div></div>'+monthlyHistory(rows)+'</section>'+
  '<section class="section stats-section"><div class="section-head"><div><h2>Ιστορικό ΔΕΗ</h2><p>Κρατάει το ποσό κάθε κύκλου και πότε το καταχώρησες.</p></div></div>'+deiHistory(rows)+'</section>';
}
const oldBind=bind;
bind=function(){
  oldBind();
  const b=document.getElementById('tabStats');
  if(b)b.onclick=()=>{view='stats';render()};
};
const oldRender=render;
render=function(){
  if(view==='stats'){
    for(const id of ['Real','Test','Advice','Stats','Gifts']){const el=document.getElementById('tab'+id);if(el)el.classList.toggle('active',id==='Stats')}
    const app=document.getElementById('app');if(app)app.innerHTML=statsView();
    bind();
    return;
  }
  oldRender();
  const b=document.getElementById('tabStats');if(b)b.classList.remove('active');
};
render();
})();