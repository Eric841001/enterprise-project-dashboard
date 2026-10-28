import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { seoulToday } from './lib/staffing'
import { shiftMonth } from './lib/workspace'

export function PeriodNavigator({value,onChange,label='기준 월'}:{value:string;onChange:(value:string)=>void;label?:string}){
  const today=seoulToday().slice(0,7)
  return <div className="period-navigator" role="group" aria-label={`${label} 이동`}>
    <button type="button" className="icon" aria-label="이전 월" disabled={value==='2000-01'} onClick={()=>onChange(shiftMonth(value,-1))}><ChevronLeft/></button>
    <label><CalendarDays/><span className="sr-only">{label}</span><input aria-label={label} type="month" min="2000-01" max="2100-12" value={value} onChange={e=>{if(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value))onChange(e.target.value)}}/></label>
    <button type="button" className="icon" aria-label="다음 월" disabled={value==='2100-12'} onClick={()=>onChange(shiftMonth(value,1))}><ChevronRight/></button>
    <button type="button" className="period-today" disabled={value===today} onClick={()=>onChange(today)}>이번 달</button>
  </div>
}
