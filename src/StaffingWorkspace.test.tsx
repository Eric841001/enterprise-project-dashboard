import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { StaffingWorkspace } from './StaffingWorkspace'
import type { Project, Resource } from './types'

afterEach(cleanup)
const resources: Resource[]=[{id:'a',name:'검증 인력',role:'Engineer',skill:'M365',capacity:100}]
const project: Project={id:'p',customer:'테스트 고객',name:'이전',category:'M365',status:'In Progress',probability:100,startDate:'2026-10-01',endDate:'2026-12-31',progress:30,manager:'검증 인력',resources:['검증 인력'],risk:'Low',scope:'이전',phase:'본 이전',updatedAt:'2026-10-01',resourceAssignments:{'검증 인력':[{allocation:100,startDate:'2026-10-01',endDate:'2026-12-31'}]}}
function setup(projects=[project]) { render(<MemoryRouter><StaffingWorkspace resources={resources} projects={projects} year={2026} month={11}><p>기존 인력 카드</p></StaffingWorkspace></MemoryRouter>) }
describe('staffing workflow',()=>{
  it('opens the chosen month breakdown and restores focus with Escape',()=>{
    setup()
    const button=screen.getByRole('button',{name:'검증 인력 2026년 12월 투입 상세'})
    button.focus(); fireEvent.click(button)
    const dialog=screen.getByRole('dialog',{name:'검증 인력 · 배정 상세'})
    expect(within(dialog).getByText('2026.12')).toBeInTheDocument()
    expect(within(dialog).getByRole('link',{name:'테스트 고객 · 이전'})).toHaveAttribute('href','/projects/p')
    expect(within(dialog).getByText('2026-10-01 - 2026-12-31')).toBeInTheDocument()
    fireEvent.keyDown(window,{key:'Escape'})
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })
  it('shows an empty filter state and resets it',()=>{
    setup()
    fireEvent.change(screen.getByRole('combobox',{name:'배정 상태 필터'}),{target:{value:'free'}})
    expect(screen.getByText('조건에 맞는 인력이 없습니다.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'필터 초기화'}))
    expect(screen.getByRole('button',{name:'검증 인력 2026년 11월 투입 상세'})).toBeInTheDocument()
  })
  it('previews over-allocation without a save action',()=>{
    setup()
    fireEvent.click(screen.getByRole('button',{name:'배정 검토'}))
    const dialog=screen.getByRole('dialog',{name:'추가 배정 검토'})
    expect(within(dialog).getByRole('status')).toHaveTextContent('1개월 용량 초과')
    fireEvent.change(within(dialog).getByRole('slider',{name:'추가 투입률'}),{target:{value:'0'}})
    expect(within(dialog).getByRole('status')).toHaveTextContent('등록 용량 이내')
    expect(within(dialog).queryByRole('button',{name:'저장'})).not.toBeInTheDocument()
    expect(project.resourceAssignments!['검증 인력'][0].allocation).toBe(100)
  })
  it('preserves the original people view',()=>{
    setup()
    fireEvent.click(screen.getByRole('tab',{name:'인력별 보기'}))
    expect(screen.getByText('기존 인력 카드')).toBeInTheDocument()
  })
  it('supports keyboard tab navigation',()=>{
    setup()
    fireEvent.keyDown(screen.getByRole('tab',{name:'월별 투입률'}),{key:'ArrowRight'})
    expect(screen.getByRole('tab',{name:'인력별 보기'})).toHaveAttribute('aria-selected','true')
    expect(screen.getByText('기존 인력 카드')).toBeInTheDocument()
  })
  it('keeps completed projects out of the unassigned queue',()=>{
    setup([{...project,resources:[],status:'Completed'}])
    fireEvent.click(screen.getByRole('tab',{name:'운영 점검'}))
    expect(screen.getByText('해당하는 프로젝트가 없습니다.')).toBeInTheDocument()
  })
})
