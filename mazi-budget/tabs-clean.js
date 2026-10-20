(()=>{
function uiPrefs(){
  state.uiPrefs=state.uiPrefs||{};
  if(!state.uiPrefs.toolView)state.uiPrefs.toolView='gifts';
  return state.uiPrefs;
}
function sectionByTitle(title){
  return [...document.querySelectorAll('#app .section')].find(s=>s.querySelector('h2')?.textContent.trim()===title);
}
function makeFold(section,label,sub,open=false,cls=''){
  if(!section)return null;
  const d=document.createElement('details');
  d.className='tidy-fold '+cls;
  d.open=open;
  const s=document.createElement('summary');
  s.innerHTML='<div><strong>'+label+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</div><span>›</span>';
  section.parentNode.insertBefore(d,section);
  d.appendChild(s); d.appendChild(section);
  return d;
}
function cleanForecast(){
  const app=document.getElementById('app'); if(!app)return;
  const note=app.querySelector('.test-note');
  if(note){note.innerHTML='<strong>Δοκιμή χωρίς ρίσκο.</strong> Ό,τι γράψεις εδώ δεν αλλάζει τον πραγματικό κύκλο.';note.classList.add('tidy-note')}
  const plan=[...app.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent.trim()==='Πλάνο πολλών μηνών');
  if(plan&&!plan.closest('.tidy-fold')){
    makeFold(plan,'Πλάνο πολλών μηνών','Δες πού μπορεί να φτάσει η άκρη σε 3, 6, 12 μήνες',false,'forecast-fold');
  }
  const main=app.querySelector('.scenario-main');
  if(main){
    const h=main.querySelector('h2'); if(h)h.textContent='Αν ξοδέψουμε κάτι τώρα';
    const p=main.querySelector('.section-head p'); if(p)p.textContent='Βλέπεις αμέσως πόσο αλλάζει η πιθανή αποταμίευση.';
  }
}
function cleanGoal(){
  const app=document.getElementById('app');if(!app)return;
  const note=app.querySelector('.advice-note');
  if(note){note.innerHTML='<strong>Βάλε τον στόχο.</strong> Η εφαρμογή θα σου πει πόσο χρειάζεται να κρατάτε κάθε μήνα.';note.classList.add('tidy-note')}
  const target=sectionByTitle('Ο στόχος σου');
  if(target){
    target.classList.add('goal-input-card');
    const btn=target.querySelector('#adviceFromMonth');if(btn)btn.textContent='Χρήση τρέχοντος κύκλου';
  }
  const flow=app.querySelector('.goal-flow')?.closest('.section');
  if(flow&&!flow.closest('.tidy-fold'))makeFold(flow,'Πώς βγαίνει ο υπολογισμός','Ανάλυση βήμα-βήμα',false,'goal-calc-fold');
  const seasonal=sectionByTitle('Σίγουρα / αναμενόμενα έξτρα έσοδα');
  if(seasonal&&!seasonal.closest('.tidy-fold'))makeFold(seasonal,'Δώρα & αναμενόμενα έξτρα έσοδα','Χριστούγεννα, Πάσχα, άδεια και άλλα',false,'goal-extra-fold');
  const verdict=app.querySelector('.verdict')?.closest('.section');
  if(verdict)verdict.classList.add('goal-result-card');
}
function toolSwitcher(){
  const app=document.getElementById('app');if(!app||app.querySelector('.tool-switcher'))return;
  const giftNote=app.querySelector('.gift-note');
  const salary=app.querySelector('.salary-calc-section');
  if(!giftNote&&!salary)return;
  const switcher=document.createElement('div');
  switcher.className='tool-switcher';
  switcher.innerHTML='<button type="button" data-tool-view="gifts">Δώρα & άδεια</button><button type="button" data-tool-view="salary">Μικτά ↔ Καθαρά</button>';
  app.insertBefore(switcher,app.firstChild);

  const giftPane=document.createElement('div');giftPane.className='tool-pane tool-pane-gifts';
  const salaryPane=document.createElement('div');salaryPane.className='tool-pane tool-pane-salary';

  const employee=sectionByTitle('Στοιχεία εργαζομένου');
  const results=app.querySelector('.gift-results');
  if(giftNote)giftPane.appendChild(giftNote);
  if(employee)giftPane.appendChild(employee);
  if(results)giftPane.appendChild(results);

  const advancedTitles=['Δώρο Χριστουγέννων','Δώρο Πάσχα','Επίδομα αδείας'];
  const advanced=document.createElement('div');
  advanced.className='gift-advanced-wrap';
  for(const t of advancedTitles){const s=sectionByTitle(t);if(s)advanced.appendChild(s)}
  const leftoverNotice=[...app.querySelectorAll('.section')].find(s=>s.querySelector('.notice')&&!s.classList.contains('salary-calc-section')&&!s.querySelector('h2'));
  if(leftoverNotice)advanced.appendChild(leftoverNotice);
  if(advanced.children.length){
    const d=document.createElement('details');d.className='tidy-fold tool-detail-fold';
    d.innerHTML='<summary><div><strong>Λεπτομέρειες υπολογισμού</strong><small>Ημερομηνίες εργασίας και ειδικές ημέρες</small></div><span>›</span></summary>';
    d.appendChild(advanced);giftPane.appendChild(d);
  }
  if(salary)salaryPane.appendChild(salary);
  app.appendChild(giftPane);app.appendChild(salaryPane);

  const prefs=uiPrefs();
  const show=v=>{
    prefs.toolView=v;localStorage.setItem(storeKey,JSON.stringify(state));
    giftPane.hidden=v!=='gifts';salaryPane.hidden=v!=='salary';
    switcher.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.toolView===v));
  };
  switcher.querySelectorAll('button').forEach(b=>b.onclick=()=>show(b.dataset.toolView));
  show(prefs.toolView);
}
function cleanTools(){
  toolSwitcher();
  const note=document.querySelector('.gift-note');
  if(note){note.innerHTML='<strong>Υπολογισμός δώρων & επιδόματος άδειας.</strong> Τα ποσά είναι μικτά και κρατάμε ξεχωριστά Μάνο και Πένυ.';note.classList.add('tidy-note')}
}
const previousRender=render;
render=function(){
  previousRender();
  if(view==='test')cleanForecast();
  if(view==='advice')cleanGoal();
  if(view==='gifts')cleanTools();
};
render();
})();