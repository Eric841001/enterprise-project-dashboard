import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {ProjectFormDialog} from './ManagementDialogs'
import type {Project} from './types'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),refresh:vi.fn(),from:vi.fn(),details:{} as Record<string,unknown>,resources:[{id:'r',name:'검증 인력',role:'Consultant',skill:'M365',capacity:100}]}))
vi.mock('./lib/supabase',()=>({supabase:{from:mocks.from,rpc:mocks.rpc}}))
vi.mock('./portfolio-context',()=>({usePortfolio:()=>({resources:mocks.resources,refresh:mocks.refresh})}))
const version='2026-10-28T01:02:03.123456+00:00'
const rows=[{id:'a',project_id:'p',resource_id:'r',role:'Consultant',allocation_percentage:100,start_date:'2026-10-01',end_date:'2026-12-31',verification_state:'unverified',record_kind:'allocation',parent_assignment_id:null,evidence_basis:null,removed_at:null},{id:'b',project_id:'p',resource_id:'r',role:'Consultant',allocation_percentage:0,start_date:'2026-10-15',end_date:'2026-10-16',verification_state:'unverified',record_kind:'allocation',parent_assignment_id:null,evidence_basis:null,removed_at:null}]
const project:Project={id:'p',version,customer:'검증 고객',name:'검증 프로젝트',category:'M365 Consulting',workMode:'non_resident',status:'In Progress',probability:100,progress:0,manager:'검증 인력',resources:['검증 인력'],startDate:'2026-10-01',endDate:'2026-12-31',updatedAt:'2026-10-28',scope:'검증',phase:'실행',risk:'Low'}
beforeEach(()=>{mocks.details={};mocks.rpc.mockReset().mockResolvedValue({data:'p',error:null});mocks.refresh.mockReset();mocks.from.mockImplementation((table:string)=>{const data=table==='customers'?[{id:'c',name:'검증 고객'}]:rows;const chain={select:()=>chain,eq:()=>chain,is:()=>chain,order:()=>Promise.resolve({data,error:null}),single:()=>Promise.resolve({data:{updated_at:version,...mocks.details},error:null})};return chain})})
afterEach(cleanup)
async function open(){render(<ProjectFormDialog open project={project} onClose={vi.fn()}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'변경 저장'})).toBeEnabled())}
describe('atomic project editing',()=>{
  it('sends all original assignment IDs and the full timestamp in one RPC without replacing rows',async()=>{
    await open();expect(screen.getByLabelText('배정 2 시작일')).toHaveValue('2026-10-15')
    fireEvent.click(screen.getByRole('button',{name:'변경 저장'}))
    await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledOnce())
    expect(mocks.rpc.mock.calls[0][0]).toBe('save_project_operations')
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_project_id:'p',p_expected_version:version,p_expected_assignments:rows,p_assignments:rows})
  })
  it('preserves the form and avoids refresh on a stale write',async()=>{
    mocks.rpc.mockResolvedValue({error:{message:'STALE_ASSIGNMENTS'}});await open()
    fireEvent.change(screen.getByLabelText('프로젝트명'),{target:{value:'입력 유지'}})
    fireEvent.click(screen.getByRole('button',{name:'변경 저장'}))
    await screen.findByText(/다른 사용자가 프로젝트 또는 배정을 변경/)
    expect(screen.getByLabelText('프로젝트명')).toHaveValue('입력 유지');expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('starts new periods without fabricated dates or 50 percent and blocks an evidence-free rate edit',async()=>{
    await open();fireEvent.click(screen.getByRole('button',{name:'기간별 배정 추가'}))
    expect(screen.getByLabelText('배정 3 투입률')).toHaveValue(0);expect(screen.getByLabelText('배정 3 시작일')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('배정 1 투입률'),{target:{value:'75'}})
    fireEvent.click(screen.getByRole('button',{name:'변경 저장'}));expect(mocks.rpc).not.toHaveBeenCalled()
    expect(screen.getByText(/변경한 배정의 Gmail·Teams 근거/)).toBeInTheDocument()
  })
  it('preserves an inactive PM and stored zero progress instead of saving derived display values',async()=>{
    mocks.details={project_manager_id:'inactive-pm',progress:0,phase:null,scope_summary:null,project_type:'non_resident'}
    await open();fireEvent.click(screen.getByRole('button',{name:'변경 저장'}))
    await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledOnce())
    expect(mocks.rpc.mock.calls[0][1].p_project).toMatchObject({project_manager_id:'inactive-pm',progress:0,phase:null,scope_summary:null})
  })
  it('keeps the dialog and inputs locked while a save is in flight',async()=>{
    mocks.rpc.mockImplementation(()=>new Promise(()=>{}));await open()
    fireEvent.click(screen.getByRole('button',{name:'변경 저장'}))
    await waitFor(()=>expect(screen.getByRole('button',{name:'저장 중…'})).toBeDisabled())
    fireEvent.keyDown(window,{key:'Escape'})
    expect(screen.getByRole('dialog',{name:'프로젝트 편집'})).toBeInTheDocument()
    expect(screen.getByLabelText('프로젝트명')).toBeDisabled();expect(screen.getByRole('button',{name:'닫기'})).toBeDisabled()
  })
})
