export type BridgeFailure = 'PORTFOLIO_DEPLETED' | 'ACCESS_GATED' | 'MIXED_SHORTFALL' | 'HOME_EQUITY_ONLY';
export interface BridgeYear { year:number; investableAssets:number; netWorth:number; accessible:number; spendingGap:number; conversion:number; ordinaryTax:number; healthcareCost:number; subsidy:number }
export interface ConversionChange {year:number;amount:number;relaxMagiCap:boolean}
export interface BridgeCandidate { conversions:ConversionChange[]; sepp?: {startYear:number;annualDistribution:number;verified:boolean} }
export interface BridgeEvaluation { years:BridgeYear[] }
export interface BridgeSolverInput {
  firstRetirementYear:number;lastConversionYear:number;maxIterations?:number;maxExtraConversionPerYear:number;
  /** Caller must replay IDENTICAL returns and inflation for every evaluation. */
  evaluate:(candidate:BridgeCandidate)=>BridgeEvaluation;
  /** Only a legally verified, independently evaluated schedule may be supplied. */
  verifiedSepp?:BridgeCandidate['sepp'];
}
export interface BridgeSolution {
  status:'BASELINE_FUNDED'|'CONVERSION_FALLBACK_FUNDED'|'VERIFIED_SEPP_FUNDED'|'UNRESOLVED';
  baseline:BridgeEvaluation;proposed:BridgeEvaluation;candidate:BridgeCandidate;
  firstFailure:BridgeFailure|null;firstFailureYear:number|null;
  extraTax:number;extraHealthcareCost:number;subsidyLost:number;explanation:string;
}
export interface BridgeSolver { solve(input:BridgeSolverInput):BridgeSolution }
export function classifyBridgeFailure(row:BridgeYear):BridgeFailure|null {
  if(row.spendingGap<=1)return null;
  // Home equity is not assumed spendable. Financial insolvency can coexist with a house.
  if(row.netWorth<=1)return 'PORTFOLIO_DEPLETED';
  if(row.investableAssets<=1)return 'HOME_EQUITY_ONLY';
  if(Math.max(0,row.investableAssets-row.accessible)>=row.spendingGap)return 'ACCESS_GATED';
  return 'MIXED_SHORTFALL';
}
const firstGap=(e:BridgeEvaluation)=>e.years.find(y=>y.spendingGap>1);
export class TwoPassBridgeSolver implements BridgeSolver {
  solve(input:BridgeSolverInput):BridgeSolution {
    if(!Number.isFinite(input.maxExtraConversionPerYear)||input.maxExtraConversionPerYear<0)throw new Error('Invalid extra conversion bound.');
    const baseline=input.evaluate({conversions:[]});let proposed=baseline;
    const candidate:BridgeCandidate={conversions:[]};const initial=firstGap(baseline);
    let status:BridgeSolution['status']=initial?'UNRESOLVED':'BASELINE_FUNDED';
    // First pass is the configured subsidy-conscious baseline. Second pass works
    // BACKWARD from a gap; converting in the failing year cannot season immediately.
    for(let i=0;initial&&i<(input.maxIterations??24);i++){
      const gap=firstGap(proposed);if(!gap){status='CONVERSION_FALLBACK_FUNDED';break;}
      if(classifyBridgeFailure(gap)!=='ACCESS_GATED')break;
      let selected:{year:number;base:number;existing?:ConversionChange}|undefined;
      // If the latest usable lot has reached its limit, earlier seasoned lots can
      // also cover the gap. Never move a conversion forward past the seasoning date.
      for(let year=Math.min(gap.year-5,input.lastConversionYear);year>=input.firstRetirementYear;year--){
        const baselineYear=baseline.years.find(y=>y.year===year);if(!baselineYear)continue;
        const existing=candidate.conversions.find(c=>c.year===year);
        if((existing?existing.amount-baselineYear.conversion:0)<input.maxExtraConversionPerYear-.01){selected={year,base:baselineYear.conversion,existing};break;}
      }
      if(!selected)break;
      const {year,base,existing}=selected;
      const extra=Math.min(input.maxExtraConversionPerYear,(existing?existing.amount-base:0)+gap.spendingGap*1.25);
      const amount=base+extra;
      if(existing)existing.amount=amount;else candidate.conversions.push({year,amount,relaxMagiCap:true});
      proposed=input.evaluate(candidate);
    }
    if(initial&&!firstGap(proposed))status='CONVERSION_FALLBACK_FUNDED';
    if(firstGap(proposed)&&input.verifiedSepp?.verified){candidate.sepp=input.verifiedSepp;proposed=input.evaluate(candidate);if(!firstGap(proposed))status='VERIFIED_SEPP_FUNDED';}
    const sum=(e:BridgeEvaluation,key:'ordinaryTax'|'healthcareCost'|'subsidy')=>e.years.reduce((v,y)=>v+y[key],0);
    const failed=firstGap(proposed);
    return {status,baseline,proposed,candidate,firstFailure:failed?classifyBridgeFailure(failed):null,firstFailureYear:failed?.year??null,
      extraTax:sum(proposed,'ordinaryTax')-sum(baseline,'ordinaryTax'),extraHealthcareCost:sum(proposed,'healthcareCost')-sum(baseline,'healthcareCost'),subsidyLost:sum(baseline,'subsidy')-sum(proposed,'subsidy'),
      explanation:status==='BASELINE_FUNDED'?'Configured strategy funds this path.':status==='CONVERSION_FALLBACK_FUNDED'?'Earlier conversions with relaxed MAGI caps fund this path. Re-test all market paths; this is not a success probability.':status==='VERIFIED_SEPP_FUNDED'?'The supplied verified SEPP schedule funds this path.':`Unresolved ${failed?classifyBridgeFailure(failed):'funding gap'} in ${failed?.year??'the horizon'}. A conversion needs five tax years to season; immediate access requires another verified source.`};
  }
}
