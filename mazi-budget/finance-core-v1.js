(()=>{
function mnum(v){return Number(v||0)}
function flexIds(){return window.maziFlexibleBudgetIds||new Set(['e8','e9','e10','e13','e14','e15','e16','e17','e18'])}
function spentFor(m,id){return (m.expenseMoves||[]).filter(x=>x.expenseId===id).reduce((s,x)=>s+mnum(x.amount),0)}
function correctionNet(m){return window.maziFundingAdjustmentNet?window.maziFundingAdjustmentNet(m):0}
function savingsDeposits(m){return (state.savingsTx||[]).filter(x=>x.monthKey===m.key&&mnum(x.amount)>0).reduce((s,x)=>s+mnum(x.amount),0)}
function savingsWithdrawals(m){return (state.savingsTx||[]).filter(x=>x.monthKey===m.key&&mnum(x.amount)<0).reduce((s,x)=>s+Math.abs(mnum(x.amount)),0)}
function walletTotal(m){return window.maziTotalSourceRemaining?window.maziTotalSourceRemaining(m):0}
function expectedIncome(m){return monthIncome(m)}
function expectedExpense(m){return monthExpense(m)}
function forecastSavings(m){return expectedIncome(m)-expectedExpense(m)+correctionNet(m)}
function remainingRecurring(m){
  return (m.expenses||[]).filter(x=>x.active!==false&&x.paid!==true).reduce((s,e)=>s+Math.max(0,mnum(e.amount)-spentFor(m,e.id)),0);
}
function remainingExtras(m){
  if(window.maziOneOffOutstanding)return window.maziOneOffOutstanding(m);
  return (m.extraExpenses||[]).reduce((s,x)=>{
    if(window.maziDueFor)return s+Math.max(0,window.maziDueFor(x));
    return s+(x.status==='paid'?0:mnum(x.amount));
  },0);
}
function remainingObligations(m){return remainingRecurring(m)+remainingExtras(m)}
function realAvailable(m){return walletTotal(m)-savingsDeposits(m)}
function openFlexible(m){const ids=flexIds();return (m.expenses||[]).filter(x=>x.active!==false&&ids.has(x.id)&&x.paid!==true)}
function unusedFlexible(m){return openFlexible(m).reduce((s,e)=>s+Math.max(0,mnum(e.amount)-spentFor(m,e.id)),0)}
function finalSavingsPreview(m){return forecastSavings(m)+unusedFlexible(m)}
function snapshot(m){
  return {
    expectedIncome:expectedIncome(m),
    expectedExpense:expectedExpense(m),
    correctionNet:correctionNet(m),
    forecastSavings:forecastSavings(m),
    realAvailable:realAvailable(m),
    remainingObligations:remainingObligations(m),
    unusedFlexible:unusedFlexible(m),
    finalSavingsPreview:finalSavingsPreview(m),
    savingsDeposits:savingsDeposits(m),
    savingsWithdrawals:savingsWithdrawals(m),
    walletTotal:walletTotal(m)
  };
}
window.maziFinance={
  spentFor,correctionNet,savingsDeposits,savingsWithdrawals,walletTotal,
  expectedIncome,expectedExpense,forecastSavings,remainingRecurring,remainingExtras,
  remainingObligations,realAvailable,openFlexible,unusedFlexible,finalSavingsPreview,snapshot
};
window.maziExpectedSave=forecastSavings;
window.maziAvailableNow=realAvailable;
try{render()}catch(e){}
})();