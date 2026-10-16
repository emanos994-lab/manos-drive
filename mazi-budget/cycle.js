(()=>{
function cycleRange(key){
  const [y,m]=String(key).split('-').map(Number);
  const start=new Date(y,m-1,25,12);
  const end=new Date(y,m,24,12);
  const f=d=>d.toLocaleDateString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric'});
  return {start:f(start),end:f(end)};
}
function ensureCycleSetup(){
  state.cyclePrefs=state.cyclePrefs||{startDay:25,firstKey:'2026-10',initialized:false};
  if(!state.cyclePrefs.initialized){
    state.cyclePrefs.startDay=25;
    state.cyclePrefs.firstKey='2026-10';
    state.savingsTx=[];
    if(!state.months['2026-10'])state.months['2026-10']=baseMonth('2026-10');
    state.activeMonth='2026-10';
    const first=state.months['2026-10'];
    first.calculationDate='2026-10-25';
    const card=first.expenses?.find(x=>x.id==='e4');
    if(card)card.active=false;
    state.cyclePrefs.initialized=true;
    state.cyclePrefs.creditCardAlreadyCharged=true;
    localStorage.setItem(storeKey,JSON.stringify(state));
  }
}
ensureCycleSetup();

const previousRender=render;
render=function(){
  previousRender();
  if(view!=='real')return;
  const app=document.getElementById('app'),m=curMonth(),range=cycleRange(m.key);
  const workspace=app?.querySelector('.workspace');
  if(!workspace)return;
  const firstCycle=m.key==='2026-10'&&state.cyclePrefs?.creditCardAlreadyCharged;
  const box=document.createElement('div');
  box.className='cycle-banner';
  box.innerHTML='<div><small>Κύκλος μισθού</small><strong>'+range.start+' → '+range.end+'</strong><span>Τα έξοδα αυτού του κύκλου θεωρούνται ότι πληρώνονται από τα έσοδα που αρχίζουν να μπαίνουν από τις 25.</span></div>'+
    (firstCycle?'<div class="cycle-special"><strong>Αφετηρία: 0€ στην άκρη</strong><span>Η πιστωτική είναι εκτός αυτού του πρώτου κύκλου, γιατί έχει ήδη χρεωθεί πριν από την πληρωμή της 25/10.</span></div>':'');
  workspace.insertAdjacentElement('afterend',box);
};
render();
})();