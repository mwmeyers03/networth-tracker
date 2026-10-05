'use client';
import {useEffect,useRef,useState,useId} from 'react';
import {Slider} from '@/components/ui/slider';
import {compact,dollars} from '../planner/format';
import type {ProjectionRow,BandRow} from '../planner/model-types';
import {chartLayout,chartIndex} from './chart-layout.mjs';
export default function ProjectionChart({rows,year,onYear,real=true,bands,compare,baseYear,metric='portfolio',fireTarget,accessLineYear}:{rows:ProjectionRow[];year:number;onYear:(y:number)=>void;real?:boolean;bands?:BandRow[];compare?:ProjectionRow[];baseYear?:number;metric?:'portfolio'|'netWorth'|'accessible'|'brokerage'|'traditional'|'roth'|'cash'|'homeEquity'|'fiTarget'|'cashFlow';accessLineYear?:number;fireTarget?:{annual:number;rate:number;dollarMode?:string}}){
 const gradientId=useId().replaceAll(':','');
 const frame=useRef<HTMLDivElement|null>(null),[width,setWidth]=useState(320);
 useEffect(()=>{
  const element=frame.current;if(!element)return;
  const measure=()=>{const w=element.getBoundingClientRect().width;if(w>0)setWidth(Math.round(w));};
  measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[]);
 if(!rows.length)return <p className="muted">No projection years to display.</p>;
 const layout=chartLayout(width),{width:W,height:H,left:L,right:R,top:T,bottom:B}=layout;
 const value=(r:ProjectionRow)=>{const nominal=metric==='cashFlow'?(r.cashAfterFunding??(r.wages+r.otherIncome+r.socialSecurity-r.payrollTax-r.federalTax-r.spending-r.personalSpending-r.upfront+r.saleProceeds)):metric==='portfolio'?r.portfolio:(metric==='brokerage'||metric==='traditional'||metric==='roth'||metric==='cash')?r.accounts.reduce((v:number,a)=>v+a[metric],0):metric==='fiTarget'?(fireTarget?.annual??80000)/(fireTarget?.rate??.035)*(fireTarget?.dollarMode==='nominal'?1:r.inflationIndex):r[metric];return nominal/(real?r.inflationIndex:1);};
 const displayedBands=real?bands:undefined;
 const values=rows.map(value);
 const upper=displayedBands?displayedBands.map(r=>r.p90):[];
 const other=compare?compare.map(value):[];
 const min=Math.min(0,...values,...(displayedBands?displayedBands.map(r=>r.p10):[]),...other)*1.08;
 const max=Math.max(1,...values,...upper,...other)*1.08;
 const x=(i:number)=>L+i/Math.max(1,rows.length-1)*(W-L-R),y=(v:number)=>H-B-(v-min)/(max-min)*(H-T-B);
 const path=(v:number[])=>v.map((a,i)=>`${i?'L':'M'}${x(i)},${y(a)}`).join(' ');
 const index=Math.max(0,rows.findIndex(r=>r.year===year)),row=rows[index];
 const tickCount=layout.tickCount;
 const ticks=[...new Set(Array.from({length:tickCount+1},(_,i)=>Math.round(i/tickCount*(rows.length-1))))];
 function inspect(clientX:number,element:SVGSVGElement){onYear(rows[chartIndex(clientX,element.getBoundingClientRect(),rows.length,layout)].year);}
 return <div className="projection-chart" ref={frame}>
 <div className="chart-caption"><div><span className="eyebrow">Selected year · {year}</span><strong>{dollars(values[index])}</strong></div><span className="muted">Age {row?.age} · {real?`${baseYear??rows[0]?.year-1} dollars`:'Future dollars'} · End of year</span></div>
 <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected values. Tap the chart or use the year slider below to inspect values." onPointerMove={event=>{if(event.pointerType==='mouse')inspect(event.clientX,event.currentTarget);}} onClick={event=>inspect(event.clientX,event.currentTarget)}>
 <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2757e8" stopOpacity=".17"/><stop offset="100%" stopColor="#2757e8" stopOpacity=".015"/></linearGradient></defs>
 {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={L} y1={y(min+(max-min)*t)} x2={W-R} y2={y(min+(max-min)*t)} stroke="#e5eaf2" strokeDasharray="3 5"/><text x={L-12} y={y(min+(max-min)*t)+4} textAnchor="end" fill="#66758b" fontSize="13">{compact(min+(max-min)*t)}</text></g>)}
 {accessLineYear!==undefined&&accessLineYear>=rows[0].year&&accessLineYear<=rows[rows.length-1].year&&<g><line x1={x(accessLineYear-rows[0].year)} x2={x(accessLineYear-rows[0].year)} y1={T} y2={H-B} stroke="#13806b" strokeDasharray="7 4"/><text x={Math.min(W-135,x(accessLineYear-rows[0].year)+5)} y={T+12} fill="#13806b" fontSize="13">Retirement access</text></g>}
 {displayedBands&&<path d={`${path(displayedBands.map(r=>r.p90))} ${displayedBands.map((r,i)=>`L${x(displayedBands.length-1-i)},${y(displayedBands[displayedBands.length-1-i].p10)}`).join(' ')} Z`} fill="#bed0ff" opacity=".6"/>}
 <path d={`${path(values)} L${x(rows.length-1)},${H-B} L${L},${H-B} Z`} fill={`url(#${gradientId})`}/>
 <path d={path(values)} stroke="#2757e8" strokeWidth="3" fill="none"/>
 {displayedBands&&<path d={path(displayedBands.map(r=>r.p50))} stroke="#8b48cb" strokeWidth="2" strokeDasharray="6 4" fill="none"/>}
 {compare&&<path d={path(other)} stroke="#e08729" strokeWidth="2.5" strokeDasharray="6 4" fill="none"/>}
 <line x1={x(index)} x2={x(index)} y1={T} y2={H-B} stroke="#66758b" strokeDasharray="4 4"/>
 <circle cx={x(index)} cy={y(values[index])} r="5" fill="#2757e8" stroke="white" strokeWidth="2"/>
 {ticks.map(i=><text key={rows[i].year} x={x(i)} y={H-9} textAnchor="middle" fill="#66758b" fontSize="13">{rows[i].year}</text>)}
 </svg>
 <Slider className="year-slider" aria-label="Inspect projection year" value={[row.year]} onValueChange={v=>onYear(v[0])} min={rows[0].year} max={rows[rows.length-1].year} step={1}/>
 {bands&&!real&&<p className="small muted">Switch to base-year dollars to view the simulation range. Its purchasing-power percentiles cannot be converted using the baseline inflation path.</p>}
 <div className="chart-legend"><span><i className="legend-dot"/>Baseline projection</span>{displayedBands&&<><span><i className="legend-dot purple"/>Simulation median</span><span><i className="legend-dot pale"/>10th–90th percentile</span></>}{compare&&<span><i className="legend-dot amber"/>Comparison scenario</span>}<span>Hover, tap, or use the year slider</span></div>
 </div>;
}
