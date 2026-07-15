import { describe,expect,it } from 'vitest'
import { projects } from '../data'
import { activeInMonth, allocationFor, projectWarnings, toCsv, validateProject } from './portfolio'

describe('project validation',()=>{
  it('validates required fields, ranges, and dates',()=>{expect(validateProject({customer:'',name:'',probability:101,progress:-1,startDate:'2026-10-01',endDate:'2026-09-01'})).toHaveLength(5)})
  it('accepts a valid project',()=>{expect(validateProject({customer:'고객',name:'프로젝트',probability:50,progress:0,startDate:null,endDate:null})).toEqual([])})
})
describe('portfolio calculations',()=>{
  it('preserves discontinuous work periods',()=>{const p=projects.find(x=>x.id==='sample-mirae-migration')!;expect(activeInMonth(p,5)).toBe(false);expect(activeInMonth(p,8)).toBe(true)})
  it('does not carry a one-year schedule into another year',()=>{const p=projects.find(x=>x.id==='sample-mirae-migration')!;expect(activeInMonth(p,8,2027)).toBe(false)})
  it('detects monthly over-allocation',()=>{expect(allocationFor('Engineer B',8,projects)).toBeGreaterThan(100)})
  it('creates Excel-compatible UTF-8 CSV',()=>{const csv=toCsv(projects.slice(0,1));const unicodeCsv=toCsv([{...projects[0],customer:'샘플 고객'}]);expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('Sample Hanseong Manufacturing');expect(unicodeCsv).toContain('샘플 고객')})
  it('returns consistency warnings',()=>{expect(projectWarnings({...projects[0],status:'Confirmed',probability:50})).toContain('확정 상태지만 확률이 100% 미만입니다.')})
})
