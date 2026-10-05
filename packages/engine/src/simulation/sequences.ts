import {seeded} from './random.js';
export interface MarketYear {stock:number;bond:number;cash?:number;inflation:number;year?:number}
export interface ReturnModel {
 startYear:number;endYear:number;retirementYear:number;unit:'real'|'nominal';stockMean:'geometric'|'arithmetic';stock:number;retirementStock:number;stockVol:number;bond:number;retirementBond:number;bondVol:number;correlation:number;cash:number;retirementCash:number;cashNominalOverride?:number;inflation:number;
}
export interface SequenceOptions {mode:'montecarlo'|'historical'|'bootstrap';seed:number;cohort?:number;blockLength?:number;inflationMode:'fixed'|'historical'|'stochastic';inflationVol?:number;inflationCorrelation?:number}
/** Historical rows contain NOMINAL total returns and matched inflation. No wrapping. */
export function marketSequence(model:ReturnModel,options:SequenceOptions,history:MarketYear[]=[],randomSource?:()=>number):MarketYear[]{
 if(Math.abs(model.correlation)>1||Math.abs(options.inflationCorrelation??-.1)>1||model.stockVol<0||model.bondVol<0||(options.inflationVol??.015)<0)throw new Error('Invalid market volatility/correlation.');
 const n=model.endYear-model.startYear+1;if(n<1)throw new Error('Invalid sequence horizon.');
 const rng=randomSource??seeded(options.seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());
 const blockLength=options.blockLength??5;let block=0;const rows:MarketYear[]=[];
 if(options.mode!=='montecarlo'&&history.length<blockLength)throw new Error('Insufficient historical data.');
 for(let i=0;i<n;i++){
  if(options.mode!=='montecarlo'){
   if(options.mode==='bootstrap'&&i%blockLength===0)block=Math.floor(rng()*(history.length-blockLength+1));
   const observed=history[options.mode==='historical'?(options.cohort??0)+i:block+i%blockLength];
   if(!observed)throw new Error('Historical sequence exceeds data.');
   rows.push({...observed,inflation:options.inflationMode==='historical'?observed.inflation:model.inflation});continue;
  }
  const z=normal(),b=model.correlation*z+Math.sqrt(1-model.correlation**2)*normal();
  const retired=model.startYear+i>=model.retirementYear;
  const logReturn=(mean:number,vol:number,shock:number)=>Math.exp(Math.log(1+mean)-.5*vol**2+vol*shock)-1;
  const infCorr=options.inflationCorrelation??-.1;
  const inflation=options.inflationMode==='stochastic'?logReturn(model.inflation,options.inflationVol??.015,infCorr*z+Math.sqrt(1-infCorr**2)*normal()):model.inflation;
  const nominal=(v:number)=>model.unit==='real'?(1+v)*(1+inflation)-1:v;
  const mean=retired?model.retirementStock:model.stock;
  const stock=model.stockMean==='geometric'?Math.exp(Math.log(1+mean)+model.stockVol*z)-1:logReturn(mean,model.stockVol,z);
  rows.push({stock:nominal(stock),bond:nominal(logReturn(retired?model.retirementBond:model.bond,model.bondVol,b)),cash:model.cashNominalOverride??nominal(retired?model.retirementCash:model.cash),inflation});
 }
 return rows;
}
