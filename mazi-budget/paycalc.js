(()=>{
const PAYCALC_VERSION='2026';
function ensurePayCalc(){
  if(!state.payCalc)state.payCalc={mode:'gross',amount:1200,age:'31plus',children:0};
  if(!state.payCalc.mode)state.payCalc.mode='gross';
  if(!state.payCalc.age)state.payCalc.age='31plus';
  state.payCalc.children=Math.max(0,Number(state.payCalc.children||0));
  return state.payCalc;
}
function employeeRate(){return 0.1337}
function insurableAnnual(gross){
  const cap=7761.94;
  return Math.min(gross,cap)*12 + Math.min(gross,cap) + Math.min(gross/2,cap)*2;
}
function employeeContribAnnual(gross){return insurableAnnual(gross)*employeeRate()}
function secondRate(children,age){
  if(age==='u25')return 0;
  if(children>=4)return 0;
  if(age==='26to30')return 0.09;
  return children===1?0.18:children===2?0.16:children===3?0.09:0.20;
}
function firstRate(children,age){
  if(age==='u25')return 0;
  if(children>=4)return 0;
  if(age==='26to30')return 0.09;
  return 0.09;
}
function thirdRate(children){
  if(children<=0)return 0.26;
  if(children===1)return 0.24;
  if(children===2)return 0.22;
  if(children===3)return 0.20;
  if(children===4)return 0.18;
  return Math.max(0,0.18-0.02*(children-4));
}
function grossTax(taxable,children,age){
  let x=Math.max(0,taxable),tax=0;
  const take=(limit,rate)=>{const a=Math.min(x,limit);tax+=a*rate;x-=a};
  take(10000,firstRate(children,age));
  if(x>0)take(10000,secondRate(children,age));
  if(x>0)take(10000,thirdRate(children));
  if(x>0)take(10000,0.34);
  if(x>0)take(20000,0.39);
  if(x>0)tax+=x*0.44;
  return tax;
}
function taxCredit(taxable,children){
  const credits=[777,900,1120,1340,1580,1780];
  const idx=Math.min(5,Math.max(0,Math.floor(children)));
  let credit=credits[idx];
  if(taxable>12000){
    const reduction=(taxable-12000)*0.02;
    credit=Math.max(0,credit-reduction);
  }
  return credit;
}
function calcFromGross(gross,children,age){
  gross=Math.max(0,Number(gross||0));
  const annualGross=gross*14;
  const annualContrib=employeeContribAnnual(gross);
  const taxable=Math.max(0,annualGross-annualContrib);
  const taxBefore=grossTax(taxable,children,age);
  const annualTax=Math.max(0,taxBefore-taxCredit(taxable,children));
  const monthlyContrib=Math.min(gross,7761.94)*employeeRate();
  const monthlyTax=annualTax/14;
  const net=Math.max(0,gross-monthlyContrib-monthlyTax);
  const annualNet=Math.max(0,annualGross-annualContrib-annualTax);
  return {gross,net,monthlyContrib,monthlyTax,annualGross,annualContrib,annualTax,annualNet,taxable};
}
function grossForNet(target,children,age){
  target=Math.max(0,Number(target||0));
  let lo=0,hi=Math.max(1000,target*2.4+500);
  while(calcFromGross(hi,children,age).net<target&&hi<30000)hi*=1.5;
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(calcFromGross(mid,children,age).net<target)lo=mid;else hi=mid}
  return calcFromGross((lo+hi)/2,children,age);
}
function payResult(){
  const p=ensurePayCalc(),amount=Math.max(0,Number(p.amount||0));
  return p.mode==='net'?grossForNet(amount,p.children,p.age):calcFromGross(amount,p.children,p.age);
}
function payCalcView(){
  const p=ensurePayCalc(),r=payResult(),inputLabel=p.mode==='gross'?'Μικτά τον μήνα':'Καθαρά που θέλω να παίρνω';
  return '<section class="section salary-calc-section">'+
    '<div class="section-head"><div><h2>Μικτά ↔ Καθαρά</h2><p>Γρήγορη εκτίμηση για τυπικό μισθωτό ιδιωτικού τομέα στην Ελλάδα, φορολογικό έτος '+PAYCALC_VERSION+'.</p></div></div>'+
    '<div class="salary-calc-grid">'+
      '<div class="field"><label>Υπολογισμός</label><select id="payMode"><option value="gross" '+(p.mode==='gross'?'selected':'')+'>Μικτά → Καθαρά</option><option value="net" '+(p.mode==='net'?'selected':'')+'>Καθαρά → Μικτά</option></select></div>'+
      '<div class="field"><label>'+inputLabel+'</label><input id="payAmount" type="number" min="0" step="0.01" value="'+Number(p.amount||0)+'"></div>'+
      '<div class="field"><label>Ηλικία</label><select id="payAge"><option value="u25" '+(p.age==='u25'?'selected':'')+'>Έως 25</option><option value="26to30" '+(p.age==='26to30'?'selected':'')+'>26–30</option><option value="31plus" '+(p.age==='31plus'?'selected':'')+'>31+</option></select></div>'+
      '<div class="field"><label>Εξαρτώμενα παιδιά</label><select id="payChildren">'+[0,1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(Number(p.children)===n?'selected':'')+'>'+(n===6?'6+':n)+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="salary-result-main"><div><small>Μικτά / μήνα</small><strong>'+euro(r.gross)+'</strong></div><div class="arrow">→</div><div class="net"><small>Εκτιμώμενα καθαρά / μήνα</small><strong>'+euro(r.net)+'</strong></div></div>'+
    '<div class="salary-breakdown">'+
      '<div><small>Εισφορές εργαζομένου / μήνα</small><strong>-'+euro(r.monthlyContrib)+'</strong></div>'+
      '<div><small>Μέσος φόρος / πληρωμή</small><strong>-'+euro(r.monthlyTax)+'</strong></div>'+
      '<div><small>Ετήσια μικτά (14 πληρωμές)</small><strong>'+euro(r.annualGross)+'</strong></div>'+
      '<div><small>Εκτιμώμενα ετήσια καθαρά</small><strong>'+euro(r.annualNet)+'</strong></div>'+
    '</div>'+
    '<div class="notice salary-note"><strong>Πώς το υπολογίζω:</strong> 14 πληρωμές/έτος, τυπικές εισφορές εργαζομένου 13,37%, κλίμακα φόρου 2026 και τη σχετική μείωση φόρου. Είναι εκτίμηση, όχι εκκαθάριση μισθοδοσίας. Επικουρική/ειδικές κατηγορίες, βαρέα, παροχές, μεταβλητές αποδοχές και άλλες ιδιαιτερότητες μπορούν να αλλάξουν το τελικό καθαρό.</div>'+
  '</section>';
}
function bindPayCalc(){
  const mode=document.getElementById('payMode');if(mode)mode.onchange=e=>{ensurePayCalc().mode=e.target.value;save();render()};
  const amount=document.getElementById('payAmount');if(amount)amount.onchange=e=>{ensurePayCalc().amount=Math.max(0,Number(e.target.value||0));save();render()};
  const age=document.getElementById('payAge');if(age)age.onchange=e=>{ensurePayCalc().age=e.target.value;save();render()};
  const children=document.getElementById('payChildren');if(children)children.onchange=e=>{ensurePayCalc().children=Math.max(0,Number(e.target.value||0));save();render()};
}
const baseRender=render;
render=function(){
  baseRender();
  if(view==='gifts'){
    const app=document.getElementById('app');
    if(app&&!document.querySelector('.salary-calc-section')){
      app.insertAdjacentHTML('beforeend',payCalcView());
      bindPayCalc();
    }
  }
};
render();
})();