(()=>{
const LEAVE_COEFF=1.041666;
function giftDefaults(){
  const year=new Date().getFullYear();
  return {
    person:'Μάνος',
    profiles:{
      'Μάνος':{payType:'salary',pay:0,year,startChristmas:year+'-05-01',endChristmas:year+'-12-31',excludeChristmas:0,startEaster:year+'-01-01',endEaster:year+'-04-30',excludeEaster:0,leaveDays:20},
      'Πένυ':{payType:'salary',pay:0,year,startChristmas:year+'-05-01',endChristmas:year+'-12-31',excludeChristmas:0,startEaster:year+'-01-01',endEaster:year+'-04-30',excludeEaster:0,leaveDays:20}
    }
  };
}
function ensureGiftCalc(){
  if(!state.giftCalc)state.giftCalc=giftDefaults();
  if(!state.giftCalc.profiles)state.giftCalc.profiles=giftDefaults().profiles;
  for(const name of ['Μάνος','Πένυ'])if(!state.giftCalc.profiles[name])state.giftCalc.profiles[name]=giftDefaults().profiles[name];
  if(!state.giftCalc.person)state.giftCalc.person='Μάνος';
  return state.giftCalc;
}
function profile(){const g=ensureGiftCalc();return g.profiles[g.person]}
function dateValue(s){const d=new Date(s+'T12:00:00');return Number.isNaN(d.getTime())?null:d}
function daysInclusive(a,b){
  const x=dateValue(a),y=dateValue(b);if(!x||!y||y<x)return 0;
  return Math.floor((y-x)/86400000)+1;
}
function clippedDays(start,end,pStart,pEnd,exclude){
  const s=dateValue(start),e=dateValue(end),ps=dateValue(pStart),pe=dateValue(pEnd);
  if(!s||!e||!ps||!pe||e<s)return 0;
  const from=new Date(Math.max(s.getTime(),ps.getTime())),to=new Date(Math.min(e.getTime(),pe.getTime()));
  if(to<from)return 0;
  return Math.max(0,Math.floor((to-from)/86400000)+1-Math.max(0,Number(exclude||0)));
}
function giftResults(){
  const p=profile(),year=Math.max(2000,Number(p.year||new Date().getFullYear())),pay=Math.max(0,Number(p.pay||0)),isSalary=p.payType!=='daily';
  const christmasDays=clippedDays(p.startChristmas,p.endChristmas,year+'-05-01',year+'-12-31',p.excludeChristmas);
  const easterDays=clippedDays(p.startEaster,p.endEaster,year+'-01-01',year+'-04-30',p.excludeEaster);
  let christmasBase=0,easterBase=0,vacation=0;
  if(isSalary){
    christmasBase=Math.min(pay,pay*(2/25)*(christmasDays/19));
    easterBase=Math.min(pay/2,(pay/2)*(easterDays/120));
    vacation=Math.min(pay/2,(pay/25)*Math.max(0,Number(p.leaveDays||0)));
  }else{
    christmasBase=Math.min(pay*25,pay*2*(christmasDays/19));
    easterBase=Math.min(pay*15,pay*(easterDays/8));
    vacation=Math.min(pay*13,pay*Math.max(0,Number(p.leaveDays||0)));
  }
  return {
    christmasDays,easterDays,
    christmas:christmasBase*LEAVE_COEFF,
    easter:easterBase*LEAVE_COEFF,
    vacation
  };
}
function giftResultCard(icon,title,amount,sub){
  return '<div class="gift-result-card"><span class="gift-icon">'+icon+'</span><div><small>'+esc(title)+'</small><strong>'+euro(amount)+'</strong><p>'+esc(sub)+'</p></div></div>';
}
function giftView(){
  const g=ensureGiftCalc(),p=profile(),r=giftResults(),year=Number(p.year||new Date().getFullYear());
  return '<div class="notice gift-note"><strong>Υπολογιστής Δώρων</strong><br>Για μισθωτούς ιδιωτικού τομέα με μισθό ή ημερομίσθιο. Τα ποσά παρακάτω είναι <strong>μικτά</strong>, πριν από εισφορές και φόρο.</div>'+
  '<section class="section"><div class="section-head"><div><h2>Στοιχεία εργαζομένου</h2><p>Κρατάω ξεχωριστά στοιχεία για Μάνο και Πένυ.</p></div></div>'+
  '<div class="gift-main-grid"><div class="field"><label>Ποιος</label><select id="giftPerson"><option '+(g.person==='Μάνος'?'selected':'')+'>Μάνος</option><option '+(g.person==='Πένυ'?'selected':'')+'>Πένυ</option></select></div>'+
  '<div class="field"><label>Τρόπος αμοιβής</label><select id="giftPayType"><option value="salary" '+(p.payType==='salary'?'selected':'')+'>Μηνιαίος μισθός</option><option value="daily" '+(p.payType==='daily'?'selected':'')+'>Ημερομίσθιο</option></select></div>'+
  '<div class="field"><label>'+(p.payType==='daily'?'Μικτό ημερομίσθιο':'Μικτός μηνιαίος μισθός')+'</label><input id="giftPay" type="number" min="0" step="0.01" value="'+Number(p.pay||0)+'"></div>'+
  '<div class="field"><label>Έτος</label><input id="giftYear" type="number" min="2020" max="2100" value="'+year+'"></div></div>'+
  '<div class="notice" style="margin-top:10px">Χρησιμοποίησε <strong>μικτές τακτικές αποδοχές</strong>. Δεν τραβάω αυτόματα τον μισθό από το budget γιατί εκεί μπορεί να έχεις γράψει καθαρό ποσό.</div></section>'+
  '<section class="gift-results">'+
    giftResultCard('🎄','Δώρο Χριστουγέννων',r.christmas,r.christmasDays+' ημέρες που προσμετρώνται')+
    giftResultCard('🐣','Δώρο Πάσχα',r.easter,r.easterDays+' ημέρες που προσμετρώνται')+
    giftResultCard('☀️','Επίδομα αδείας',r.vacation,Number(p.leaveDays||0)+' ημέρες άδειας')+
  '</section>'+
  '<section class="section"><div class="section-head"><div><h2>Δώρο Χριστουγέννων</h2><p>Περίοδος υπολογισμού: 1 Μαΐου έως 31 Δεκεμβρίου.</p></div></div><div class="gift-period-grid">'+
  '<div class="field"><label>Έναρξη εργασιακής σχέσης</label><input id="giftChristmasStart" type="date" value="'+esc(p.startChristmas)+'"></div>'+
  '<div class="field"><label>Λήξη / έως</label><input id="giftChristmasEnd" type="date" value="'+esc(p.endChristmas)+'"></div>'+
  '<div class="field"><label>Ημέρες που δεν προσμετρώνται</label><input id="giftChristmasExclude" type="number" min="0" step="1" value="'+Number(p.excludeChristmas||0)+'"></div></div>'+
  '<div class="gift-formula">Υπολογίζονται <strong>'+r.christmasDays+'</strong> ημέρες μέσα στην περίοδο.</div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Δώρο Πάσχα</h2><p>Περίοδος υπολογισμού: 1 Ιανουαρίου έως 30 Απριλίου.</p></div></div><div class="gift-period-grid">'+
  '<div class="field"><label>Έναρξη εργασιακής σχέσης</label><input id="giftEasterStart" type="date" value="'+esc(p.startEaster)+'"></div>'+
  '<div class="field"><label>Λήξη / έως</label><input id="giftEasterEnd" type="date" value="'+esc(p.endEaster)+'"></div>'+
  '<div class="field"><label>Ημέρες που δεν προσμετρώνται</label><input id="giftEasterExclude" type="number" min="0" step="1" value="'+Number(p.excludeEaster||0)+'"></div></div>'+
  '<div class="gift-formula">Υπολογίζονται <strong>'+r.easterDays+'</strong> ημέρες μέσα στην περίοδο.</div></section>'+
  '<section class="section"><div class="section-head"><div><h2>Επίδομα αδείας</h2><p>Βάλε τις ημέρες κανονικής άδειας που δικαιούσαι ή θα λάβεις.</p></div></div><div class="gift-period-grid one"><div class="field"><label>Ημέρες άδειας</label><input id="giftLeaveDays" type="number" min="0" step="1" value="'+Number(p.leaveDays||0)+'"></div></div>'+
  '<div class="gift-formula">Το επίδομα δεν μπορεί να ξεπεράσει '+(p.payType==='daily'?'τα 13 ημερομίσθια':'τον μισό μηνιαίο μισθό')+'.</div></section>'+
  '<section class="section"><div class="notice"><strong>Σημαντικό:</strong> εκ περιτροπής εργασία, ωρομίσθιο, μεταβαλλόμενες αποδοχές, επιδοτούμενη ασθένεια και ειδικές άδειες μπορεί να αλλάξουν τον ακριβή υπολογισμό. Ο υπολογιστής είναι για την τυπική περίπτωση και δεν υπολογίζει το καθαρό ποσό μετά κρατήσεις.</div></section>';
}
function setProfileField(k,v){const p=profile();p[k]=v;save();render()}
function resetGiftDatesForYear(){
  const p=profile(),y=Number(p.year||new Date().getFullYear());
  p.startChristmas=y+'-05-01';p.endChristmas=y+'-12-31';p.startEaster=y+'-01-01';p.endEaster=y+'-04-30';
}
const baseBind=bind;
bind=function(){
  baseBind();
  const gifts=document.getElementById('tabGifts');if(gifts)gifts.onclick=()=>{view='gifts';render()};
  const person=document.getElementById('giftPerson');if(person)person.onchange=e=>{ensureGiftCalc().person=e.target.value;save();render()};
  const payType=document.getElementById('giftPayType');if(payType)payType.onchange=e=>setProfileField('payType',e.target.value);
  const pay=document.getElementById('giftPay');if(pay)pay.onchange=e=>setProfileField('pay',Math.max(0,Number(e.target.value||0)));
  const year=document.getElementById('giftYear');if(year)year.onchange=e=>{profile().year=Math.max(2020,Number(e.target.value||new Date().getFullYear()));resetGiftDatesForYear();save();render()};
  const fields=[
    ['giftChristmasStart','startChristmas',String],['giftChristmasEnd','endChristmas',String],['giftChristmasExclude','excludeChristmas',Number],
    ['giftEasterStart','startEaster',String],['giftEasterEnd','endEaster',String],['giftEasterExclude','excludeEaster',Number],['giftLeaveDays','leaveDays',Number]
  ];
  for(const [id,k,cast] of fields){const el=document.getElementById(id);if(el)el.onchange=e=>setProfileField(k,cast(e.target.value||0))}
};
render=function(){
  for(const id of ['Real','Test','Advice','Gifts']){const el=document.getElementById('tab'+id);if(el)el.classList.toggle('active',view===id.toLowerCase())}
  document.getElementById('app').innerHTML=view==='real'?realView():view==='test'?testView():view==='advice'?adviceView():giftView();
  bind();
};
render();
})();