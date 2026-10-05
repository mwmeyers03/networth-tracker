/** Verified2026 published limits. Future indexation is an explicit estimate. */
export const RULES_2026 = {year:2026,employeeDeferral:24500,catchUp:8000,enhancedCatchUp:11250,total415:72000,ira:7500,iraCatchUp:1100,hsaIndividual:4400,hsaFamily:8750,hsaCatchUp:1000,socialSecurityWageBase:184500,
 sources:['https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions','https://www.irs.gov/publications/p15b']} as const;
export function limitsForYear(year:number,age:number,index:number){
 if(!Number.isInteger(year)||!Number.isFinite(index)||index<=0)throw new Error('Invalid tax rule year/index.');
 return {year,estimated:year!==2026,employeeDeferral:(RULES_2026.employeeDeferral+(age>=60&&age<=63?RULES_2026.enhancedCatchUp:age>=50?RULES_2026.catchUp:0))*index,baseEmployeeDeferral:RULES_2026.employeeDeferral*index,total415:RULES_2026.total415*index,ira:(RULES_2026.ira+(age>=50?RULES_2026.iraCatchUp:0))*index,hsaIndividual:(RULES_2026.hsaIndividual+(age>=55?RULES_2026.hsaCatchUp:0))*index,hsaFamily:(RULES_2026.hsaFamily+(age>=55?RULES_2026.hsaCatchUp:0))*index};
}
