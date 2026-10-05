'use client';
import {useId,useState} from 'react';
import {Input} from '@/components/ui/input';
import {parseNumberDraft} from './number-draft';

type Props={label:string;value:number;min:number;max:number;integer?:boolean;disabled?:boolean;help?:string;onCommit:(value:number)=>void;onValidityChange?:(valid:boolean)=>void};
export default function CommitNumberInput(props:Props){return <NumberDraft key={`${!!props.disabled}:${props.value}`} {...props}/>;}
function NumberDraft({label,value,min,max,integer=false,disabled,help,onCommit,onValidityChange}:Props){
 const id=useId(),[text,setText]=useState(String(value)),[error,setError]=useState('');
 function revert(){setText(String(value));setError('');onValidityChange?.(true);}
 function commit(){
  const parsed=parseNumberDraft(text,{min,max,integer});
  if(parsed.kind==='revert'){revert();return;}
  if(parsed.kind==='invalid'){setError(`${parsed.message} Your plan still uses ${value.toLocaleString('en-US')}.`);onValidityChange?.(false);return;}
  setError('');onValidityChange?.(true);setText(String(parsed.value));
  if(parsed.value!==value)onCommit(parsed.value);
 }
 return <div className="field">
  <label htmlFor={id}>{label}</label>
  <Input id={id} type="text" inputMode={integer?'numeric':'decimal'} disabled={disabled} value={text}
   aria-invalid={!!error} aria-describedby={error?`${id}-error`:help?`${id}-help`:undefined}
   onChange={event=>{setText(event.target.value);setError('');onValidityChange?.(true);}} onBlur={commit}
   onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}if(event.key==='Escape'){event.preventDefault();revert();}}}/>
  {help&&<small id={`${id}-help`} className="muted field-help">{help}</small>}
  {error&&<small id={`${id}-error`} className="negative field-help" role="alert">{error}</small>}
 </div>;
}
