export interface SpendingInput { target: number; essentialFloor: number; portfolio: number; withdrawalRate: number; strategy: 'fixed'|'percent'|'guardrails'; previousDiscretionary?: number; inflation: number; flexibleFloorFraction: number }
export function spendingBudget(p: SpendingInput): {total:number;essential:number;discretionary:number;cut:number} {
  const essential=Math.max(0,p.essentialFloor),planned=Math.max(0,p.target-essential);
  let flexible=planned;
  if(p.strategy==='percent')flexible=Math.max(planned*p.flexibleFloorFraction,p.portfolio*p.withdrawalRate-essential);
  if(p.strategy==='guardrails'){
    flexible=p.previousDiscretionary===undefined?planned:p.previousDiscretionary*(1+p.inflation);
    const rate=p.portfolio>0?(essential+flexible)/p.portfolio:Infinity;
    if(rate>p.withdrawalRate*1.2)flexible*=.9;else if(rate<p.withdrawalRate*.8)flexible*=1.1;
    flexible=Math.max(planned*p.flexibleFloorFraction,flexible);
  }
  return {total:essential+flexible,essential,discretionary:flexible,cut:Math.max(0,p.target-essential-flexible)};
}
