export type NumberDraftResult = {kind:'revert'} | {kind:'valid';value:number} | {kind:'invalid';message:string};

// Empty/intermediate input is not a financial assumption. Only an explicit,
// validated amount may cross the component's commit boundary.
export function parseNumberDraft(text:string,{min,max,integer=false}:{min:number;max:number;integer?:boolean}):NumberDraftResult {
 const clean=text.trim();
 if(!clean)return {kind:'revert'};
 if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean))return {kind:'invalid',message:'Enter a number.'};
 const value=Number(clean);
 if(!Number.isFinite(value)||value<min||value>max||integer&&!Number.isInteger(value))return {kind:'invalid',message:`Enter ${integer?'a whole number':'a number'} from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`};
 return {kind:'valid',value};
}
