(()=>{
function ensureReminderFields(){
 for(const m of Object.values(state.months||{})){
  for(const e of m.expenses||[]){
   if(e.payDay==null)e.payDay='';
   if(e.remind==null)e.remind=true;
  }
 }
 state.reminderPrefs=state.reminderPrefs||{leadDays:3,notifications:false};
}
ensureReminderFields();

function payDateForCycle(key,day){
 const d=Number(day||0); if(!d)return null;
 const [y,m]=key.split('-').map(Number);
 const yy=d>=25?y:(m===12?y+1:y), mm=d>=25?m:(m===12?1:m+1);
 const last=new Date(yy,mm,0).getDate();
 return new Date(yy,mm-1,Math.min(d,last),12);
}
function daysFromToday(date){
 const t=new Date(); const a=new Date(t.getFullYear(),t.getMonth(),t.getDate(),12);
 return Math.ceil((date-a)/86400000);
}
function dueItems(m){
 const lead=Math.max(0,Number(state.reminderPrefs?.leadDays||0));
 return (m.expenses||[]).filter(e=>e.active!==false&&e.remind!==false&&Number(e.payDay)>0).map(e=>{
  const date=payDateForCycle(m.key,e.payDay); return {e,date,diff:daysFromToday(date)};
 }).filter(x=>x.diff>=0&&x.diff<=lead).sort((a,b)=>a.diff-b.diff);
}
function reminderPanel(m){
 const items=dueItems(m);
 const all=(m.expenses||[]).filter(e=>Number(e.payDay)>0);
 return '<section class="section reminder-section"><div class="section-head"><div><h2>Υπενθυμίσεις πληρωμών</h2><p>Βάλε τη συνηθισμένη ημέρα πληρωμής για κάθε πάγιο.</p></div><button class="btn soft" id="editReminders">Ρυθμίσεις</button></div>'+
 (items.length?'<div class="reminder-list">'+items.map(x=>'<div class="reminder-item '+(x.diff===0?'today':'soon')+'"><div><strong>'+esc(x.e.name)+'</strong><small>'+ (x.diff===0?'Σήμερα':'Σε '+x.diff+' μέρ'+(x.diff===1?'α':'ες')) +' · '+fmtDate(x.date.toISOString().slice(0,10))+'</small></div><strong>'+euro(x.e.amount)+'</strong></div>').join('')+'</div>':'<div class="empty-oneoff">Δεν υπάρχει πληρωμή μέσα στις επόμενες '+Number(state.reminderPrefs.leadDays||0)+' ημέρες.</div>')+
 (all.length?'<div class="mini" style="margin-top:8px">Έχουν οριστεί ημέρες πληρωμής για '+all.length+' πάγια.</div>':'')+'</section>';
}
function settingsModal(){
 const m=curMonth();
 const rows=(m.expenses||[]).map(e=>'<div class="reminder-row"><input type="checkbox" name="remind_'+e.id+'" '+(e.remind===false?'':'checked')+'><label>'+esc(e.name)+'</label><input name="day_'+e.id+'" type="number" min="1" max="31" placeholder="Ημέρα" value="'+esc(e.payDay||'')+'"></div>').join('');
 showModal('Υπενθυμίσεις πληρωμών','<div class="field"><label>Πόσες μέρες πριν να εμφανίζεται υπενθύμιση</label><input name="leadDays" type="number" min="0" max="14" value="'+Number(state.reminderPrefs.leadDays||3)+'"></div><div class="reminder-settings-list">'+rows+'</div><div class="notice" style="margin-top:10px">Η ημέρα 25–31 ανήκει στην αρχή του κύκλου. Ημέρα 1–24 υπολογίζεται στον επόμενο ημερολογιακό μήνα του ίδιου κύκλου.</div>',fd=>{
  state.reminderPrefs.leadDays=Math.max(0,Math.min(14,Number(fd.get('leadDays')||0)));
  for(const e of m.expenses||[]){e.remind=fd.get('remind_'+e.id)==='on';const v=Number(fd.get('day_'+e.id)||0);e.payDay=v>=1&&v<=31?v:'';}
  for(const [k,mm] of Object.entries(state.months||{})){if(k===m.key)continue;for(const e of mm.expenses||[]){const src=m.expenses.find(x=>x.id===e.id);if(src){e.payDay=src.payDay;e.remind=src.remind}}}
 },'Αποθήκευση');
}
async function maybeNotify(){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 const m=curMonth(),items=dueItems(m); if(!items.length)return;
 const key='mazi-remind-'+new Date().toISOString().slice(0,10);
 if(localStorage.getItem(key))return;
 const body=items.slice(0,3).map(x=>x.e.name+(x.diff===0?' σήμερα':' σε '+x.diff+' μέρες')).join(' · ');
 try{const reg=await navigator.serviceWorker?.ready;if(reg)await reg.showNotification('Μαζί · Υπενθύμιση πληρωμών',{body,tag:key});else new Notification('Μαζί · Υπενθύμιση πληρωμών',{body});localStorage.setItem(key,'1')}catch{}
}
const baseRender=render;
render=function(){
 baseRender();
 if(view!=='real')return;
 const app=document.getElementById('app');
 const target=app?.querySelector('.flow-forecast')||app?.querySelector('.summary');
 if(target)target.insertAdjacentHTML('afterend',reminderPanel(curMonth()));
 const b=document.getElementById('editReminders'); if(b)b.onclick=settingsModal;
 maybeNotify();
};
window.enableMaziNotifications=async()=>{if(!('Notification' in window))return false;const p=await Notification.requestPermission();state.reminderPrefs.notifications=p==='granted';save();return p==='granted'};
render();
})();