import {consumePretax,constrainPretaxSources} from '../accounts/pretax.js';
import {calculateSepp,seppDistribution} from '../bridge/sepp.js';
import {hsaContributions,resolveHsaElection,megaBackdoorRoom,backdoorTaxableFraction} from '../cashflow/advantaged.js';
import {percentageDeferrals} from '../cashflow/percentage.js';
import {drawAccounts,emptyDraw,cashDrawTotal,type DrawFlow} from '../withdrawals/draw.js';
import {federal,payroll,contributionLimits,rothAllowed,taxableSocialSecurity} from '../taxes/federal.js';
import {spendingBudget} from '../cashflow/spending.js';
import {clone,validate,housingSchedule,accessBreakdown,salaryAt,employerContribution,healthcareAt,povertyLevel,coverageMonths,effectiveStrategy,annualSavingsFlow,retirementEnvelope,envelopeCosts,isRetirementExpense} from './legacy.mjs';
import type {Account,Plan,ProjectionPerson,MarketReturn,ProjectionResult,ProjectionRow,Expense,TaxSummary,HouseholdTax} from './contracts.js';
const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
const total=(a:{traditional:number;roth:number;brokerage:number;cash:number;hsa?:number|ProjectionPerson['hsa'];hsaBalance?:number;sepp?:number|ProjectionPerson['sepp']})=>a.traditional+a.roth+a.brokerage+a.cash+(typeof a.hsa==='number'?a.hsa:a.hsaBalance??0)+(typeof a.sepp==='number'?a.sepp:0);
const RMD=[24.6,23.7,22.9,22,21.1,20.2,19.4,18.5,17.7,16.8,16,15.2,14.4,13.7,12.9,12.2,11.5,10.8,10.1,9.5,8.9,8.4,7.8,7.3,6.8,6.4,6,5.6,5.2,4.9,4.6,4.3,4.1,3.9,3.7,3.5];
export function accessible(a:Account,p:ProjectionPerson,year:number){return accessBreakdown(a,p,year).accessible;}
export function project(plan:Plan,returns:MarketReturn[]|null=null,{skipValidation=false}:{skipValidation?:boolean}={}):ProjectionResult{
 if(!skipValidation){const e=validate(plan);if(e.length)throw Error(e.join('\n'));}
 let accounts:Account[]=plan.people.map(p=>{const vested=Math.min(1,Math.max(0,plan.startYear-p.employmentStart)*.2);const {pretaxSources,...profile}=p;return {...profile,...(p.pretaxEarlyAccess==='ira'?{legacyIraBalance:Math.max(0,p.traditional-p.unvested-(pretaxSources??[]).reduce((v,s)=>v+s.openingBalance,0))}:{}),...(pretaxSources?{pretaxSources:pretaxSources.map(s=>({...s,balance:s.openingBalance}))}:{}),hsa:p.hsaBalance??0,sepp:0,gradedPool:vested<1?p.unvested/(1-vested):0,lots:clone(p.rothConversionLots??[]).sort((a,b)=>a.year-b.year)};}); const housing=housingSchedule(plan,returns);let inflationIndex=(1+plan.inflation)**(plan.startYear-plan.baseYear-1),firstFailure:number|null=null,previousDraw:number|null=null;
 const firstRetire=Math.min(...plan.people.map(p=>p.retireYear)); const rows:ProjectionRow[]=[],inflationByYear:Record<number,number>={};
 for(let year=plan.startYear;year<=plan.endYear;year++){
  const t=year-plan.startYear,o=plan.overrides[year]||{},h=housing[t];
  const retiredPhase=year>=firstRetire;
  const nominal=(v:number)=>plan.returnUnit==='real'?(1+v)*(1+plan.inflation)-1:v;
  const r=returns?.[t]||{stock:nominal(retiredPhase?(plan.retirementStockReturn??plan.stockReturn):plan.stockReturn),bond:nominal(retiredPhase?(plan.retirementBondReturn??plan.bondReturn):plan.bondReturn),inflation:plan.inflation,cash:nominal(retiredPhase?(plan.retirementCashReturn??plan.cashReturn):plan.cashReturn)};
  inflationIndex*=1+r.inflation;inflationByYear[year]=r.inflation;
  const stockWeight=plan.allocationMode!=='fixed'&&year>=firstRetire?(plan.retirementStockWeight??plan.stockWeight):plan.stockWeight;
  const taxIndex=(1+plan.taxInflation)**(year-2026),joint=year>=plan.jointYear;
  const opening=sum(accounts.map(total)),openingInflationIndex=inflationIndex/(1+r.inflation);let adjustments=0,forfeiture=0,growth=0;
  const openingAccounts=clone(accounts);const priorSepp=accounts.map(a=>a.sepp);const beginningTraditional=accounts.map(a=>a.traditional);
  const salaries=plan.people.map(p=>salaryAt({...p,forecastStart:plan.startYear},year,o[`${p.id}Salary`],{inflation:plan.inflation,inflationByYear}));
  const bonuses=plan.people.map(p=>o[`${p.id}Bonus`]??0);
  const wages=salaries.map((salary,i)=>salary+bonuses[i]);
  wages[0]+=h.relocation;
  const socialSecurity=plan.people.map(p=>year>=(p.socialSecurityStartYear??Infinity)?(p.socialSecurityAnnual??0)*inflationIndex:0);
  const ordinaryExtra=plan.people.map(p=>o[`${p.id}Income`]??0);
  const strategies=plan.people.map(p=>effectiveStrategy(p,inflationIndex,o[`${p.id}Savings`]));
  const savingsCaps=strategies.map(s=>s?.mode==='fixed_amount'&&s.overflow==='lifestyle_spend'?s.annualTarget:Infinity);
  let employee=plan.people.map((p,i)=>Math.min(strategies[i]?.mode==='fixed_amount'?strategies[i].annualTarget:savingsCaps[i],wages[i],contributionLimits(year-p.birthYear,taxIndex).k,o[`${p.id}401k`]??(wages[i]>0?(strategies[i]?.mode==='max_out_and_sweep_surplus'?contributionLimits(year-p.birthYear,taxIndex).k:p.employee401kMode==='percent'?wages[i]*(p.employee401kPercent??0):p.employee401k*taxIndex):0)));
  const hsaElections=plan.people.map(p=>resolveHsaElection(p.hsa,year));
  const timedHsa=hsaElections.some(e=>e?.timingMode==='verified_year');
  const directHsa=hsaElections.map(e=>e?.timingMode==='verified_year'&&e.payroll===false);
  const hsaCaps=plan.people.map((_,i)=>Math.max(0,Math.min(directHsa[i]?Infinity:wages[i]-employee[i],strategies[i]?.mode==='fixed_amount'?strategies[i].annualTarget-employee[i]:Infinity)));
  let hsa=hsaContributions(hsaElections,plan.people.map(p=>year-p.birthYear),wages,taxIndex,joint,hsaCaps);
  let earnedFederalByPerson:number[]|null=null;
  if(strategies.some(s=>s?.mode==='percentage_of_net')){
   const allocation=percentageDeferrals({wages,otherIncome:ordinaryExtra,requestedEmployee:employee,hsaElections,ages:plan.people.map(p=>year-p.birthYear),index:taxIndex,joint,strategies,hsaEmployeeCaps:hsaCaps});
   employee=allocation.employee;hsa=allocation.hsa;earnedFederalByPerson=allocation.federalByPerson;
  }
  const directHsaRequested=hsa.employee.map((v,i)=>directHsa[i]?v:0);
  let hsaFundingShortfall=0;
  const employers=[0,0],dividends=[0,0],interest=[0,0],bondInterest=[0,0],brokerageDrag=[0,0];
  accounts.forEach((a,i)=>{
   const p=plan.people[i];
   const vestedFraction=Math.min(1,Math.max(0,year-p.employmentStart)*.2);
   a.unvested=a.gradedPool*(1-vestedFraction);
   if(year===p.retireYear){const lost=a.unvested;a.traditional-=lost;forfeiture+=lost;a.unvested=0;a.gradedPool=0;}
   if(vestedFraction>=1){a.unvested=0;a.gradedPool=0;}
   const ss=p.sepp?.enabled?p.sepp.input:null;
   if(ss){const schedule=calculateSepp(ss);const stop=p.sepp?.stopYear??(Number(schedule.commitmentEndDate.slice(0,4))+1);
    if(year===schedule.startYear){const allocation=Math.min(Math.max(0,a.traditional-a.unvested),ss.openingBalance);if(Math.abs(allocation-ss.openingBalance)>.01)throw Error('SEPP segregated opening balance exceeds available vested pretax assets.');const source=a.pretaxSources?.find(s=>s.id===ss.accountId);
     const available=source?(source.verified?source.balance:0):Math.max(0,a.traditional-a.unvested-(a.pretaxSources??[]).reduce((v,s)=>v+s.balance,0));
     if(allocation>available+.01)throw Error('SEPP allocation exceeds the identified source or untracked vested remainder.');
     if(source)source.balance-=allocation;else if(a.legacyIraBalance!==undefined)a.legacyIraBalance=Math.max(0,a.legacyIraBalance-allocation);a.traditional-=allocation;a.sepp+=allocation;}
    if(year>=stop&&a.sepp>0){a.traditional+=a.sepp;a.sepp=0;}
   }
   const before=total(a),ret=Math.max(-1,stockWeight*r.stock+(1-stockWeight)*r.bond-plan.fees);
   for(const source of a.pretaxSources??[])source.balance*=1+ret;if(a.legacyIraBalance!==undefined)a.legacyIraBalance*=1+ret;
   a.hsa*=1+ret;a.sepp*=1+ret;a.traditional*=1+ret;a.gradedPool*=1+ret;a.unvested*=1+ret;a.roth*=1+ret;
   dividends[i]=Math.max(0,a.brokerage*plan.dividendYield*stockWeight);
   // Configured returns are TOTAL returns. Reinvested distributions increase basis,
   // but are already part of the ending market value and must not be added twice.
   bondInterest[i]=a.brokerage*(1-stockWeight)*(plan.bondYield??Math.max(0,plan.bondReturn));
   // Drag is quoted in REAL percentage points even when the forecast is nominal.
   // Distributions are already included in total return; plan fees remain separate.
   const drag=(retiredPhase?(p.retirementBrokerageReturnDrag??p.brokerageReturnDrag):p.brokerageReturnDrag)??0;
   const brokerageRet=Math.max(-1,stockWeight*r.stock+(1-stockWeight)*r.bond-plan.fees-drag*(1+r.inflation));
   brokerageDrag[i]=a.brokerage*(ret-brokerageRet);
   a.brokerage=Math.max(0,a.brokerage*(1+brokerageRet));a.brokerageBasis+=dividends[i]+bondInterest[i];
   interest[i]=a.cash*(p.cashNominalReturn??plan.cashNominalReturn??r.cash??plan.cashReturn);a.cash+=interest[i];
   growth+=total(a)-before;
   const employer=wages[i]>0&&year<p.retireYear?employerContribution(wages[i],employee[i],p,taxIndex):{amount:0,graded:0};employers[i]=employer.amount;
   a.traditional+=employee[i]+employers[i];a.hsa+=(directHsa[i]?0:hsa.employee[i])+hsa.employer[i];
   if(vestedFraction<1&&year<p.retireYear){a.gradedPool+=employer.graded;a.unvested=a.gradedPool*(1-vestedFraction);}
   for(const key of ['traditional','roth','brokerage','cash'] as const){
    const value=o[`${p.id}_${key}`];
    if(value!==undefined){adjustments+=value-a[key];a[key]=value;if(key==='traditional'){a.unvested=Math.min(a.unvested,value);a.gradedPool=vestedFraction<1?a.unvested/(1-vestedFraction):0;constrainPretaxSources(a);}}
   }
  });
  const deductions=sum(employee);
  const baseOrdinary=wages.map((w,i)=>w-employee[i]-hsa.employee[i]+ordinaryExtra[i]+interest[i]+bondInterest[i]);
  const seppPayments=plan.people.map(()=>0);
  accounts.forEach((a,i)=>{const config=plan.people[i].sepp;if(!config?.enabled)return;const ss=calculateSepp(config.input),stop=config.stopYear??(Number(ss.commitmentEndDate.slice(0,4))+1);if(year<ss.startYear||year>=stop)return;const distribution=seppDistribution(config.input,year,a.sepp,priorSepp[i]);a.sepp-=distribution.distributedNominal;a.cash+=distribution.distributedNominal;baseOrdinary[i]+=distribution.ordinaryIncome;seppPayments[i]=distribution.distributedNominal;});
  const rmd=[0,0];
  accounts.forEach((a,i)=>{const age=year-plan.people[i].birthYear;if(age>=75&&year>=plan.people[i].retireYear){rmd[i]=Math.min(a.traditional,beginningTraditional[i]/RMD[Math.min(age-75,RMD.length-1)]);rmd[i]=consumePretax(a,plan.people[i],year,rmd[i]).amount;a.cash+=rmd[i];baseOrdinary[i]+=rmd[i];}});
  const payrollWages=wages.map((w,i)=>Math.max(0,w-hsa.payrollExcluded[i]));
  const payrollTax=joint?payroll(payrollWages,true,taxIndex):sum(payrollWages.map(w=>payroll([w],false,taxIndex)));
  const payrollByPerson=payrollWages.map(w=>joint?Math.min(w,184500*taxIndex)*.062+w*.0145+(sum(wages)>0?Math.max(0,sum(payrollWages)-250000)*.009*w/sum(payrollWages):0):payroll([w],false,taxIndex));
  // Joint compensation can fund a spouse's IRA during a career break.
  const compensation=wages.map((w,i)=>Math.max(0,w-employee[i]-hsa.payrollExcluded[i]));
  const iraCompensation=joint?sum(compensation):0;
  const rothRequested=plan.people.map((p,i)=>{
   const active=year>=p.workStart&&year<p.retireYear;
   const spousal=joint&&p.spousalIRA!==false&&(active||p.spousalIRA===true);
   const request=o[`${p.id}Roth`]??((wages[i]>0||spousal)?(strategies[i]?.mode==='max_out_and_sweep_surplus'?contributionLimits(year-p.birthYear,taxIndex).ira:p.rothContribution*taxIndex):0);
   return Math.min(joint?iraCompensation:compensation[i],contributionLimits(year-p.birthYear,taxIndex).ira,request);
  });
  const brokerRequested=plan.people.map((p,i)=>o[`${p.id}Brokerage`]??(wages[i]>0?p.brokerageContribution*inflationIndex:0));
  const expenseRows=plan.expenses.filter(e=>year>=e.start&&year<=e.end&&!(plan.healthcare?.enabled&&plan.healthcare.replacedExpenseIds?.includes(e.id)));
  const expenseAmount=(e:Expense)=>(o[`expense_${e.id}`]??e.annual)*(e.inflate?inflationIndex:1);
  const living=sum(expenseRows.map(expenseAmount)),essentialLiving=sum(expenseRows.filter(e=>e.essential===true).map(expenseAmount)),flexibleLiving=living-essentialLiving;
  let spending=o.spending??(living+h.cost+h.moving);
  let envelope=retirementEnvelope(plan,year,inflationIndex,o);
  let envelopeReduction=0;
  if(envelope&&plan.strategy!=='fixed'){
   const adjusted=spendingBudget({target:envelope.target,essentialFloor:h.cost+envelope.minimumLiving,portfolio:sum(accounts.map(total)),withdrawalRate:plan.withdrawalRate,strategy:plan.strategy,previousDiscretionary:previousDraw??undefined,inflation:r.inflation,flexibleFloorFraction:plan.spendingFloor});
   envelopeReduction=adjusted.cut;previousDraw=adjusted.discretionary;
   envelope={...envelope,target:adjusted.total,plannedTarget:envelope.target};
  }
  const outsideBudget=sum(expenseRows.filter(e=>!isRetirementExpense(e)).map(expenseAmount))+h.moving;
  const fixedHousing=h.cost+h.moving+essentialLiving;
  if(year>=firstRetire&&o.spending===undefined&&!envelope){
   // Housing payments and moving obligations are never reduced by a spending rule.
   let flexible=flexibleLiving;
   if(plan.strategy==='percent')flexible=Math.max(flexibleLiving*plan.spendingFloor,sum(accounts.map(total))*plan.withdrawalRate-fixedHousing);
   if(plan.strategy==='guardrails'){
    let draw=previousDraw===null?flexibleLiving:previousDraw*(1+r.inflation);
    const portfolio=sum(accounts.map(total));const rate=portfolio>0?(draw+fixedHousing)/portfolio:Infinity;
    if(rate>plan.withdrawalRate*1.2)draw*=.9;else if(rate<plan.withdrawalRate*.8)draw*=1.1;
    flexible=Math.max(flexibleLiving*plan.spendingFloor,draw);
   }
   spending=fixedHousing+flexible;previousDraw=flexible;
  }
  let availableWages=sum(wages)+sum(ordinaryExtra)+sum(socialSecurity)-deductions-sum(hsa.employee)-payrollTax;
  const currentFpl=plan.healthcare?.enabled?povertyLevel(year,joint?2:1,plan.healthcare.fplGrowth):plan.acaFpl*(1+plan.taxInflation)**(year-plan.baseYear);
  const acaLimit=currentFpl*plan.acaTarget;
  const plannedConversion=o.conversion??(year>=plan.conversionStart&&year<=plan.conversionEnd?plan.conversionAnnual*inflationIndex:0);
  // Trial cash-flow solve is replayed from the same state, so tax iteration never double-spends assets.
  function trial(conversionRequest:number,backdoorFunding=rothRequested){
   const ac=clone(accounts),ord=baseOrdinary.map((v,i)=>v+(plan.people[i].rothMode==='backdoor'?backdoorFunding[i]*backdoorTaxableFraction(plan.people[i].backdoor?.pretaxIraBalance??0,plan.people[i].backdoor?.aftertaxIraBasis??0,backdoorFunding[i]):0)),gains=[...dividends];let conversion=0;const converted=[0,0];const draws=plan.people.map(emptyDraw);
   let left=conversionRequest;
   ac.forEach((a,i)=>{const take=consumePretax(a,plan.people[i],year,left,{conversion:true}).amount;a.roth+=take;if(take)a.lots.push({year,amount:take,taxableAmount:take,documented:false});ord[i]+=take;left-=take;conversion+=take;converted[i]+=take;});
   const taxNow=():HouseholdTax=>{
    const embedded=plan.people.map((p,i)=>p.brokerageTaxTreatment==='embedded'?{ordinary:bondInterest[i],gains:dividends[i]}:{ordinary:0,gains:0});
    const one=(ordinary:number,gain:number,benefit:number,investment:number,isJoint:boolean,embeddedOrdinary=0,embeddedGains=0):TaxSummary=>{
     const taxableBenefits=taxableSocialSecurity(benefit,ordinary+gain,isJoint);
     const full=federal(ordinary+taxableBenefits,gain,isJoint,taxIndex,investment);
     // Preserve full reported income for ACA/Roth/IRMAA. Embedded drag replaces
     // only incremental ongoing-distribution federal tax, never sales/conversions.
     const ordinaryWithout=ordinary-embeddedOrdinary,gainWithout=gain-embeddedGains;
     const tax=embeddedOrdinary||embeddedGains?federal(ordinaryWithout+taxableSocialSecurity(benefit,ordinaryWithout+gainWithout,isJoint),gainWithout,isJoint,taxIndex,investment-embeddedOrdinary-embeddedGains):full;
     return {...tax,agi:full.magi,magi:ordinary+gain+benefit,taxableBenefits,embeddedDistributionTax:Math.max(0,full.total-tax.total)};
    };
    const all=ord.map((v,i)=>one(v,gains[i],socialSecurity[i],gains[i]+interest[i]+bondInterest[i],false,embedded[i].ordinary,embedded[i].gains));
    const combined=joint?one(sum(ord),sum(gains),sum(socialSecurity),sum(gains)+sum(interest)+sum(bondInterest),true,sum(embedded.map(x=>x.ordinary)),sum(embedded.map(x=>x.gains))):combineTaxSummaries(all);
    const income=ord.map((v,i)=>Math.max(0,v+gains[i]+socialSecurity[i])),weight=sum(income);
    return {...combined,incomeTax:combined.total,penalty:sum(draws.map(d=>d.penalty)),total:combined.total+sum(draws.map(d=>d.penalty)),agiByPerson:all.map(x=>x.agi),magiByPerson:all.map(x=>x.magi),federalByPerson:joint?income.map((v,i)=>weight?combined.total*v/weight+draws[i].penalty:combined.total/plan.people.length+draws[i].penalty):all.map((x,i)=>x.total+draws[i].penalty)};
   };
   let tax=taxNow(),health=healthcareAt(plan,year,tax,rows),withdrawals=0,rothWithdrawals=0,taxableSales=0,traditionalDraw=0;
   const costs=()=>envelope?envelopeCosts(envelope,{housing:h.cost,outside:outsideBudget,upfront:h.upfront,tax:tax.total,payroll:payrollTax,health:health.cost}):{spending,budget:null};
   // A capped person's earnings beyond the savings election are outside the
   // shared core budget. Joint federal tax is the existing income-weighted share.
   const contributionFlows=()=>{
    const incomes=wages.map((w,i)=>Math.max(0,w+ordinaryExtra[i]-employee[i]-hsa.employee[i]-payrollByPerson[i]-tax.federalByPerson[i]));
    const weight=sum(incomes);const core=costs().spending+health.cost;
    return plan.people.map((p,i)=>strategies[i]&&!strategies[i].legacy&&wages[i]>0?annualSavingsFlow({wages:wages[i],otherIncome:ordinaryExtra[i],employee:employee[i],employer:employers[i],limits:contributionLimits(year-p.birthYear,taxIndex),roth:rothRequested[i],rothEligible:rothRequested[i]*(p.rothMode==='backdoor'?1:rothAllowed(joint?tax.agi-conversion:tax.agiByPerson[i]-converted[i],joint,taxIndex)),payrollTax:payrollByPerson[i],federalTax:strategies[i]?.mode==='percentage_of_net'?(earnedFederalByPerson?.[i]??tax.federalByPerson[i]):tax.federalByPerson[i],expenses:weight?core*incomes[i]/weight:0,reserve:0,strategy:strategies[i],index:taxIndex,employeeHsa:hsa.employee[i],megaRequested:p.megaBackdoor?.enabled?p.megaBackdoor.annual*inflationIndex:0}):null);
   };
   const personalSpending=()=>plan.people.map((p,i)=>{
    const flow=contributionFlows()[i];if(flow)return flow.lifestyleOverflow;
    return !Number.isFinite(savingsCaps[i])?0:Math.max(0,wages[i]-payrollByPerson[i]-tax.federalByPerson[i]-savingsCaps[i]);
   });
   const grossCash=()=>availableWages+h.saleProceeds-h.upfront-costs().spending-sum(personalSpending());
   const netCash=()=>grossCash()+withdrawals-tax.total-health.cost;
   let remaining=Math.max(0,-netCash());
   let medicalRemaining=plan.people.map(p=>(p.hsaQualifiedExpensesAnnual??0)*inflationIndex);
   function draw(amount:number,skipCash=false){
    const before=draws.map(d=>({...d}));
    const policy:import('../withdrawals/draw.js').DrawPolicy={order:plan.withdrawalPolicy?.order??'taxable_first',allowPenalties:plan.withdrawalPolicy?.allowPenalties!==false,earlyPreference:plan.withdrawalPolicy?.earlyPreference??'conversion_first',skipCash,qualifiedMedicalRemaining:medicalRemaining};
    const result=drawAccounts(ac,plan.people,year,amount,policy,draws);
    draws.forEach((d,i)=>{ord[i]+=d.ordinaryIncome-before[i].ordinaryIncome;gains[i]+=d.gains-before[i].gains;taxableSales+=d.taxable-before[i].taxable;traditionalDraw+=d.traditional-before[i].traditional;rothWithdrawals+=d.rothBasis+d.conversionPrincipal+d.qualifiedRoth+d.rothEarnings-before[i].rothBasis-before[i].conversionPrincipal-before[i].qualifiedRoth-before[i].rothEarnings;});
    withdrawals+=result.funded;return result.unfunded;
   }
   const fundingStart=plan.healthcare?.enabled?{accounts:clone(ac),ord:[...ord],gains:[...gains]}:null;
   let gap=0;
   for(let iter=0;iter<60;iter++){
    remaining=Math.max(0,-netCash());
    if(remaining<=.00001)break;
    const unfunded=draw(remaining);tax=taxNow();health=healthcareAt(plan,year,tax,rows);
    if(unfunded>.0001)break;
   }
   if(fundingStart&&withdrawals>0){
    // ACA eligibility has discontinuities. Replay from the unchanged funding
    // state and split the search at each tax family's 100%/400% FPL crossing.
    // Within each interval net funding is monotone; select the first feasible
    // withdrawal, rather than retaining an unnecessary sale after a subsidy jump.
    const high=withdrawals;
    const evaluate=(amount:number)=>{
     fundingStart.accounts.forEach((a,i)=>{ac[i]=clone(a);ord[i]=fundingStart.ord[i];gains[i]=fundingStart.gains[i];for(const k of Object.keys(draws[i]) as (keyof DrawFlow)[])draws[i][k]=0;});
     withdrawals=0;rothWithdrawals=0;taxableSales=0;traditionalDraw=0;medicalRemaining=plan.people.map(p=>(p.hsaQualifiedExpensesAnnual??0)*inflationIndex);draw(amount);tax=taxNow();health=healthcareAt(plan,year,tax,rows);
     return netCash();
    };
    const healthConfig=plan.healthcare;if(!healthConfig)throw Error('Healthcare funding requires coverage configuration.');
    const points=[0,high],families=joint?[{i:null,size:2}]:plan.people.map((_,i)=>({i,size:1}));
    for(const family of families){
     const eligible=plan.people.some((p,i)=>(family.i===null||family.i===i)&&healthConfig.people[i].eligibility==='eligible'&&(coverageMonths(p,healthConfig.people[i],year).marketplace??0)>0);
     if(!eligible)continue;
     const magi=()=>family.i===null?tax.magi:tax.magiByPerson[family.i];
     evaluate(0);const lower=magi();evaluate(high);const upper=magi();
     for(const multiple of [1,4]){
      const threshold=povertyLevel(year,family.size,healthConfig.fplGrowth)*multiple;
      if(lower>=threshold||upper<threshold)continue;
      let lo=0,hi=high;for(let k=0;k<42;k++){const mid=(lo+hi)/2;evaluate(mid);if(magi()>=threshold)hi=mid;else lo=mid;}
      points.push(Math.max(0,hi-.0001),hi,Math.min(high,hi+.0001));
     }
    }
    const sorted=[...new Set(points)].sort((a,b)=>a-b);let best:number|null=null;
    for(let i=0;i<sorted.length;i++){
     const lo=sorted[i];if(evaluate(lo)>=-.00001){best=lo;break;}
     const hi=sorted[i+1];if(hi===undefined||evaluate(hi)<0)continue;
     let a=lo,b=hi;for(let k=0;k<40;k++){const mid=(a+b)/2;if(evaluate(mid)>=0)b=mid;else a=mid;}
     best=b;break;
    }
    evaluate(best??high);
   }
   gap=Math.max(0,-netCash());
   let actualCosts=costs();
   let surplus=Math.max(0,grossCash()-tax.total-health.cost),contributionShortfall=0;
   const rothAdded=plan.people.map(()=>0),brokerAdded=plan.people.map(()=>0),megaAdded=plan.people.map(()=>0);
   // Hold any withdrawal residual until tax/health and reserve funding settle.
   // A reserve withdrawal can unlock an ACA credit and release spending cash;
   // crediting once before that step either discards or double-counts the change.
   let remainingCompensation=joint?iraCompensation:Infinity;
   const reserveBudget=envelope&&plan.cashReserveWorking!==undefined?Math.max(envelope.target,actualCosts.spending+health.cost-h.moving):Math.max(0,actualCosts.spending+health.cost-h.moving);
   const cashReserveTarget=!retiredPhase&&plan.cashReserveWorking!==undefined?plan.cashReserveWorking*inflationIndex:plan.cashReserveMode==='months'?reserveBudget*(plan.reserveMonths??3)/12:plan.cashReserve*inflationIndex;
   let reserveShortfall=0;
   if(plan.enforceCashBuffer&&retiredPhase){
    // Draw enough investments to replenish cash, including tax/coverage gross-up.
    // The draw is an internal transfer; living distributions remain in netCash().
    for(let k=0;k<60;k++){
     const balance=sum(ac.map(a=>a.cash))+Math.max(0,netCash()-surplus);
     const needed=Math.max(0,cashReserveTarget-balance);if(needed<=.00001)break;
     const before=withdrawals;const unfunded=draw(needed,true);const funded=withdrawals-before;
     ac[0].cash+=funded;
     // Offset the draw's contribution to spendable cash; it is reserved, not income.
     withdrawals-=funded;
     tax=taxNow();health=healthcareAt(plan,year,tax,rows);
     const taxNeed=Math.max(0,-netCash());if(taxNeed>.00001){draw(taxNeed);tax=taxNow();health=healthcareAt(plan,year,tax,rows);}
     if(unfunded>.0001)break;
    }
    gap=Math.max(0,-netCash());
    surplus=Math.max(0,grossCash()-tax.total-health.cost);
   }
   ac[0].cash+=Math.max(0,netCash()-surplus);
   if(plan.enforceCashBuffer&&retiredPhase)reserveShortfall=Math.max(0,cashReserveTarget-sum(ac.map(a=>a.cash)));
   actualCosts=costs();
   let cashSwept=0;const cashSweptByPerson=[0,0];
   if(plan.cashReserveMode==='months'&&plan.surplus==='invest'){
    // Refill the spending reserve before optional contributions; sweep excess cash.
    const refill=Math.min(surplus,Math.max(0,cashReserveTarget-sum(ac.map(a=>a.cash))));
    ac[0].cash+=refill;surplus-=refill;
    let excess=Math.max(0,sum(ac.map(a=>a.cash))-cashReserveTarget);
    ac.forEach((a,i)=>{const sweep=Math.min(excess,a.cash);a.cash-=sweep;a.brokerage+=sweep;a.brokerageBasis+=sweep;excess-=sweep;cashSwept+=sweep;cashSweptByPerson[i]+=sweep;});
   }
   // Contributions are funded by earned cash flow, never manufactured through negative cash.
   for(let i=0;i<ac.length;i++){
    const finalAllowed=plan.people[i].rothMode==='backdoor'?1:rothAllowed(joint?tax.agi-conversion:tax.agiByPerson[i]-converted[i],joint,taxIndex);
    const desired=Math.min(plan.people[i].rothMode==='backdoor'?Infinity:(contributionFlows()[i]?.rothIra??Infinity),Math.max(0,savingsCaps[i]-employee[i]-hsa.employee[i]),remainingCompensation,rothRequested[i],contributionLimits(year-plan.people[i].birthYear,taxIndex).ira*finalAllowed);
    const take=Math.min(surplus,desired);ac[i].roth+=take;if(plan.people[i].rothMode==='backdoor'){ac[i].lots.push({year,amount:take,taxableAmount:take*backdoorTaxableFraction(plan.people[i].backdoor?.pretaxIraBalance??0,plan.people[i].backdoor?.aftertaxIraBasis??0,take),documented:false});}else ac[i].rothBasis+=take;surplus-=take;rothAdded[i]=take;remainingCompensation-=take;contributionShortfall+=desired-take;
   }
   for(let i=0;i<ac.length;i++){
    const p=plan.people[i];if(!p.megaBackdoor?.enabled||wages[i]<=0)continue;
    const room=megaBackdoorRoom(wages[i],employee[i],employers[i],taxIndex);
    const take=Math.min(surplus,contributionFlows()[i]?.megaBackdoorRoth??Infinity,room,p.megaBackdoor.annual*inflationIndex,Math.max(0,savingsCaps[i]-employee[i]-hsa.employee[i]-rothAdded[i]-megaAdded[i]));
    ac[i].roth+=take;ac[i].lots.push({year,amount:take,taxableAmount:0,documented:false});megaAdded[i]=take;surplus-=take;
   }
   for(let i=0;i<ac.length;i++){const take=Math.min(surplus,contributionFlows()[i]?.taxableBrokerage??Infinity,brokerRequested[i],Math.max(0,savingsCaps[i]-employee[i]-hsa.employee[i]-rothAdded[i]-megaAdded[i]));ac[i].brokerage+=take;ac[i].brokerageBasis+=take;surplus-=take;brokerAdded[i]=take;contributionShortfall+=Math.min(brokerRequested[i],Math.max(0,savingsCaps[i]-employee[i]-hsa.employee[i]-rothAdded[i]-megaAdded[i]))-take;}
   const additionalByPerson=plan.people.map(()=>0);
   // Complete each explicit annual savings election, with any remaining shared
   // cash allocated afterward. Employer contributions and old-cash sweeps are transfers, not elections.
   for(let i=0;i<ac.length;i++)if(Number.isFinite(savingsCaps[i])&&wages[i]>0){
    const take=Math.min(surplus,Math.max(0,savingsCaps[i]-employee[i]-hsa.employee[i]-rothAdded[i]-megaAdded[i]-brokerAdded[i]));
    ac[i].brokerage+=take;ac[i].brokerageBasis+=take;surplus-=take;additionalByPerson[i]+=take;
   }
   // Percentage budgets belong to each owner; do not redistribute their remaining
   // elected savings through the uncapped household sweep weights.
   for(let i=0;i<ac.length;i++)if(strategies[i]?.mode==='percentage_of_net'){
    const take=Math.min(surplus,Math.max(0,(contributionFlows()[i]?.taxableBrokerage??0)-brokerAdded[i]));
    ac[i].brokerage+=take;ac[i].brokerageBasis+=take;surplus-=take;additionalByPerson[i]+=take;
   }
   const cashNeed=Math.max(0,cashReserveTarget-sum(ac.map(a=>a.cash)));
   const toCash=plan.surplus==='cash'?surplus:Math.min(surplus,cashNeed);ac[0].cash+=toCash;surplus-=toCash;
   const uncapped=savingsCaps.map((cap,i)=>({cap,i,weight:Math.max(0,wages[i]-employee[i]-payrollByPerson[i]-tax.federalByPerson[i])})).filter(x=>!Number.isFinite(x.cap)&&strategies[x.i]?.mode!=='percentage_of_net');
   const weight=sum(uncapped.map(x=>x.weight));
   if(uncapped.length){const modern=strategies.some(s=>s&&!s.legacy);for(const x of uncapped){const take=surplus*(modern?(weight?x.weight/weight:1/uncapped.length):(x.i===uncapped[0].i?1:0));ac[x.i].brokerage+=take;ac[x.i].brokerageBasis+=take;additionalByPerson[x.i]+=take;}}
   else{ac[0].cash+=surplus;surplus=0;}
   return {ac,tax,health,draws,converted,megaAdded,cashAfterFunding:netCash(),reserveShortfall,personalSpending:personalSpending(),additionalByPerson,spending:actualCosts.spending,budget:actualCosts.budget,gap,conversion,withdrawals,rothWithdrawals,taxableSales,traditionalDraw,rothAdded,brokerAdded,contributionShortfall,investedSurplus:sum(additionalByPerson)+cashSwept,additionalSurplus:sum(additionalByPerson),cashSweptByPerson,cashReserveTarget,cashSwept};
  }
  function settle(){
  let result=trial(plannedConversion);
  // Cap is a target, not a subsidy promise: salary, gains and RMDs can exceed it even with zero conversion.
  if(plan.capConversions&&!plan.relaxedConversionYears?.includes(year)&&year>=plan.acaStart&&year<=plan.acaEnd&&result.tax.magi>acaLimit&&result.conversion>0){
   let low=0,high=plannedConversion;result=trial(0);
   if(result.tax.magi<=acaLimit){for(let i=0;i<20;i++){const mid=(low+high)/2,candidate=trial(mid);if(candidate.tax.magi<=acaLimit){low=mid;result=candidate;}else high=mid;}}
  }
  if(plan.people.some(p=>p.rothMode==='backdoor')){
   for(let k=0;k<25;k++){
    const funded=result.rothAdded;const next=trial(result.conversion,funded);
    if(next.rothAdded.every((v,i)=>Math.abs(v-funded[i])<.00001)){result=next;break;}result=next;
   }
  }
  return result;
  }
  let result=settle();
  // Direct, verified-year contributions are optional savings funded from real
  // household cash/assets. Hold them outside the withdrawal pool until paid:
  // otherwise a new HSA deposit could manufacture its own funding source.
  for(let attempt=0;attempt<61&&result.gap>.00001;attempt++){
   const remaining=sum(hsa.employee.map((v,i)=>directHsa[i]?v:0));
   if(remaining<=.00001)break;
   const reduction=attempt===60?remaining:Math.min(remaining,result.gap);
   for(let i=0;i<hsa.employee.length;i++)if(directHsa[i]){
    const take=Math.min(hsa.employee[i],reduction*hsa.employee[i]/remaining);
    hsa.employee[i]-=take;hsa.direct[i]-=take;hsa.deductible[i]-=take;hsa.employeeCapped[i]+=take;
    baseOrdinary[i]+=take;availableWages+=take;
   }
   result=settle();
  }
  hsaFundingShortfall=sum(directHsaRequested)-sum(hsa.employee.map((v,i)=>directHsa[i]?v:0));
  accounts=result.ac;
  accounts.forEach((a,i)=>{if(directHsa[i])a.hsa+=hsa.employee[i];});
  const totalSpending=result.spending+result.health.cost;
  const hsaReview=timedHsa?{employeeRequested:hsa.employee.map((v,i)=>v+hsa.employeeCapped[i]),employeeFunded:hsa.employee,eligibleMonths:hsa.eligibleMonths,contributionLimits:hsa.limit,employeeCapped:hsa.employeeCapped,employerCapped:hsa.employerCapped,direct:hsa.direct,deductible:hsa.deductible,payrollExcluded:hsa.payrollExcluded,fundingShortfall:hsaFundingShortfall,flags:hsa.reviewFlags}:undefined;
  const peopleFlow=plan.people.map((p,i)=>({id:p.id,name:p.name,salary:salaries[i],bonus:bonuses[i],wages:wages[i],otherIncome:ordinaryExtra[i],employee401k:employee[i],employeeHsa:hsa.employee[i],employerHsa:hsa.employer[i],megaBackdoor:result.megaAdded[i],seppDistribution:seppPayments[i],employer:employers[i],payrollTax:payrollByPerson[i],federalTax:result.tax.federalByPerson[i],earnedIncomeAfterTax:wages[i]+ordinaryExtra[i]+socialSecurity[i]-employee[i]-hsa.employee[i]-payrollByPerson[i]-result.tax.federalByPerson[i],takeHome:wages[i]+ordinaryExtra[i]+socialSecurity[i]-employee[i]-hsa.employee[i]-payrollByPerson[i]-result.tax.federalByPerson[i],rothAdded:result.rothAdded[i],brokerAdded:result.brokerAdded[i],personalSpending:result.personalSpending[i],savingsCap:Number.isFinite(savingsCaps[i])?savingsCaps[i]:null,additionalSavings:result.additionalByPerson[i],employeeSavings:employee[i]+hsa.employee[i]+result.megaAdded[i]+result.rothAdded[i]+result.brokerAdded[i]+result.additionalByPerson[i],taxableDeposits:result.brokerAdded[i]+result.cashSweptByPerson[i]+result.additionalByPerson[i],withdrawals:cashDrawTotal(result.draws[i]),...result.draws[i],conversion:result.converted[i],rmd:rmd[i]}));
  const portfolio=sum(accounts.map(total)),unvested=sum(accounts.map(a=>a.unvested)),vested=portfolio-unvested;
  if(result.gap>1&&firstFailure===null)firstFailure=year;
  const reconciliation=portfolio-(opening+growth+sum(wages)+sum(ordinaryExtra)+sum(socialSecurity)+sum(employers)+sum(hsa.employer)-payrollTax-result.tax.total-totalSpending-sum(result.personalSpending)-h.upfront+h.saleProceeds+adjustments-forfeiture+result.gap);
  rows.push({...(hsaReview?{hsaReview}:{}),year,joint,cashAfterFunding:result.cashAfterFunding,personalSpending:sum(result.personalSpending),personalSpendingByPerson:result.personalSpending,brokerageReturnDragCost:sum(brokerageDrag),embeddedDistributionTax:result.tax.embeddedDistributionTax,agiByPerson:result.tax.agiByPerson,magiByPerson:result.tax.magiByPerson,peopleFlow,spendingFunded:Math.max(0,totalSpending+h.upfront-result.gap),unfundedAfterWithdrawals:result.gap,healthcare:result.health,openingAccounts,accessByPerson:accounts.map((a,i)=>accessBreakdown(a,plan.people[i],year)),openingPortfolio:opening,openingInflationIndex,openingRealPortfolio:opening/openingInflationIndex,stockWeight,cashReserveTarget:result.cashReserveTarget,cashSwept:result.cashSwept,socialSecurity:sum(socialSecurity),socialSecurityByPerson:socialSecurity,taxableSocialSecurity:result.tax.taxableBenefits,federalAgi:result.tax.agi,qualifiedDividends:sum(dividends),bondInterest:sum(bondInterest),cashInterest:sum(interest),age:year-plan.people[0].birthYear,inflationIndex,portfolio,vested,realPortfolio:portfolio/inflationIndex,netWorth:portfolio+h.equity,homeEquity:h.equity,accessible:sum(accounts.map((a,i)=>accessible(a,plan.people[i],year))),unvested,salary:sum(salaries),bonus:sum(bonuses),wages:sum(wages),otherIncome:sum(ordinaryExtra),wagesByPerson:wages,employee401k:deductions,employeeHsa:sum(hsa.employee),employerHsa:sum(hsa.employer),seppDistribution:sum(seppPayments),megaBackdoor:sum(result.megaAdded),employer:sum(employers),payrollTax,federalTax:result.tax.total,ordinaryIncomeTax:result.tax.incomeTax,earlyWithdrawalPenalty:result.tax.penalty,penaltyFallbackUsed:result.tax.penalty>1,ordinaryTax:result.tax.ordinaryTax,capitalTax:result.tax.capitalTax,niit:result.tax.niit,magi:result.tax.magi,acaLimit,acaUpper:currentFpl*plan.acaUpper,spending:totalSpending,totalOutgo:totalSpending+sum(result.personalSpending)+result.tax.total+payrollTax+h.upfront,budget:result.budget,plannedSpending:envelope?totalSpending:living+h.cost+h.moving+result.health.cost,essentialSpending:envelope?envelope.minimumLiving+h.cost+outsideBudget+result.health.cost:essentialLiving+h.cost+h.moving+result.health.cost,reserveShortfall:result.reserveShortfall,spendingReduction:envelope?envelopeReduction:Math.max(0,living+h.cost+h.moving-spending),housing:h.cost,upfront:h.upfront,saleProceeds:h.saleProceeds,mortgage:h.debt,conversion:result.conversion,rothWithdrawals:result.rothWithdrawals,taxableSales:result.taxableSales,traditionalDraw:result.traditionalDraw,rmd:sum(rmd),shortfall:result.gap,contributionShortfall:result.contributionShortfall,rothAdded:sum(result.rothAdded),brokerAdded:sum(result.brokerAdded),investedSurplus:result.investedSurplus,growth,adjustments,forfeiture,reconciliation,accounts:clone(accounts),retired:year>=firstRetire});
 }
 return {rows,firstFailure,success:firstFailure===null,openingPortfolio:sum(plan.people.map(total)),retirement:rows.find(r=>r.year===firstRetire)||null,terminal:rows.at(-1)};
}

/** Preserve explicit fields at the tax-module boundary instead of erasing the ledger shape. */
function combineTaxSummaries(all:TaxSummary[]):TaxSummary {
 return {total:sum(all.map(x=>x.total)),ordinaryTax:sum(all.map(x=>x.ordinaryTax)),capitalTax:sum(all.map(x=>x.capitalTax)),niit:sum(all.map(x=>x.niit)),magi:sum(all.map(x=>x.magi)),agi:sum(all.map(x=>x.agi)),taxableBenefits:sum(all.map(x=>x.taxableBenefits)),embeddedDistributionTax:sum(all.map(x=>x.embeddedDistributionTax))};
}
