import {fullYearAccess} from '../packages/engine/runtime/accounts/access.js';
import {availablePretax} from '../packages/engine/runtime/accounts/pretax.js';
// Annual model: a date-based access rule starts in the first FULL calendar year
// after age 59½. Missing birth dates retain the legacy approximation, visibly.
export const accessYear=fullYearAccess;
export function accessBreakdown(account,person,year){
 const unrestricted=year>=accessYear(person),qualified=(unrestricted||person.penaltyExceptions?.rothDisabilityVerified===true)&&year-person.rothOpenYear>=5;
 const basis=Math.min(account.roth,account.rothBasis);
 let left=Math.max(0,account.roth-basis),seasoned=0,locked=0,unseasonedPenaltyFree=0,blocked=false;
 const grouped=new Map();for(const lot of account.lots??[]){const prior=grouped.get(lot.year)??{year:lot.year,amount:0,taxableAmount:0};prior.amount+=lot.amount;prior.taxableAmount+=lot.taxableAmount??lot.amount;grouped.set(lot.year,prior);}
 for(const lot of [...grouped.values()].sort((a,b)=>a.year-b.year)){
  const value=Math.min(left,lot.amount);left-=value;
  const mature=year>=lot.year+5||unrestricted,exempt=person.penaltyExceptions?.rothDisabilityVerified===true;
  if(!blocked&&(mature||exempt||lot.taxableAmount<=1e-10)){if(mature)seasoned+=value;else unseasonedPenaltyFree+=value;}
  else{locked+=value;blocked=true;}
 }
 const earningsAccessible=(unrestricted||person.penaltyExceptions?.rothDisabilityVerified===true)&&!blocked;
 const eligibleRoth=qualified?account.roth:basis+seasoned+unseasonedPenaltyFree+(earningsAccessible?left:0);
 const traditional=availablePretax(account,person,year,false),nonmedicalHsa=year-person.birthYear>=65?(account.hsa??0):0;
 return {...(nonmedicalHsa>0?{nonmedicalHsa}:{}),...(unseasonedPenaltyFree>0?{unseasonedPenaltyFree}:{}),cash:account.cash,taxable:account.brokerage,basis,seasoned,lockedConversions:locked,rothEarnings:left,eligibleRoth,traditional,accessible:account.cash+account.brokerage+eligibleRoth+traditional+nonmedicalHsa,accessYear:accessYear(person),qualifiedYear:person.penaltyExceptions?.rothDisabilityVerified===true?person.rothOpenYear+5:Math.max(accessYear(person),person.rothOpenYear+5),approximate:!person.birthDate};
}
