import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {MemoryRouter,useLocation} from 'react-router-dom'
import {OperationsInbox} from './OperationsInbox'
import {WorkspaceSearch} from './WorkspaceSearch'
import {StaffingWorkspace} from './StaffingWorkspace'
import type {Project} from './types'

afterEach(cleanup)
const p:Project={id:'p1',customer:'검증 고객',name:'구축 프로젝트',category:'M365',status:'In Progress',probability:100,startDate:'2026-10-01',endDate:'2026-12-31',progress:20,manager:'담당 A',resources:['담당 A'],scope:'검증',phase:'실행',risk:'High',updatedAt:'2026-10-01'}
function Location(){return <output aria-label="현재 주소">{useLocation().pathname}{useLocation().search}</output>}
describe('action center and search',()=>{
  it('groups reasons and lets the user find, filter and reset actionable projects',()=>{
    const projects=[{...p,followUpStatus:'Pending' as const,nextActionDueDate:'2026-01-01'}, {...p,id:'p2',customer:'다른 고객',risk:'Low' as const,resources:[],updatedAt:'2099-01-01'}]
    render(<MemoryRouter><OperationsInbox projects={projects}/></MemoryRouter>)
    const region=screen.getByRole('region',{name:'운영 조치함'})
    expect(within(region).getAllByRole('link')).toHaveLength(2)
    fireEvent.click(within(region).getByRole('button',{name:/후속조치 기한 초과/}))
    expect(within(region).getAllByRole('link')).toHaveLength(1)
    fireEvent.change(screen.getByRole('textbox',{name:'운영 조치함 검색'}),{target:{value:'없는 고객'}})
    expect(screen.getByText('조건에 맞는 항목이 없습니다.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'조건 초기화'}))
    expect(within(region).getAllByRole('link')).toHaveLength(2)
  })
  it('reveals additional items without duplicating the existing rows',()=>{
    render(<MemoryRouter><OperationsInbox projects={Array.from({length:12},(_,i)=>({...p,id:`p${i}`}))}/></MemoryRouter>)
    expect(screen.getAllByRole('link')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button',{name:'10건 더 보기'}))
    expect(screen.getAllByRole('link')).toHaveLength(12)
  })
  it('supports Ctrl K, arrow navigation and Enter to the selected project',()=>{
    render(<MemoryRouter><WorkspaceSearch projects={[p,{...p,id:'p2',name:'검증 두번째'}]}/><Location/></MemoryRouter>)
    fireEvent.keyDown(window,{ctrlKey:true,key:'k'})
    const input=screen.getByRole('combobox',{name:'전체 검색'});expect(input).toHaveFocus()
    fireEvent.change(input,{target:{value:' 검증 '}})
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.keyDown(input,{key:'ArrowDown'})
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected','true')
    fireEvent.keyDown(input,{key:'Enter'})
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('/projects/p2')
    expect(input).toHaveValue('')
  })
  it('closes results on Escape and pointer events outside, then clears the query accessibly',()=>{
    render(<MemoryRouter><WorkspaceSearch projects={[p]}/><button>바깥</button></MemoryRouter>)
    const input=screen.getByRole('combobox',{name:'전체 검색'})
    fireEvent.change(input,{target:{value:'검증'}});fireEvent.keyDown(input,{key:'Escape'})
    expect(input).toHaveAttribute('aria-expanded','false');expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.focus(input);expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('button',{name:'바깥'}));expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'검색어 지우기'}));expect(input).toHaveValue('');expect(input).toHaveFocus()
  })
  it('restores shared staffing view state and preserves the selected month and search when a KPI is clicked',()=>{
    render(<MemoryRouter initialEntries={['/resources?month=2026-12&view=people&q=담당']}><StaffingWorkspace resources={[{id:'a',name:'담당 A',role:'Consultant',skill:'M365',capacity:100}]} projects={[p]} year={2026} month={12}><p>인력 카드 검증</p></StaffingWorkspace><Location/></MemoryRouter>)
    expect(screen.getByText('인력 카드 검증')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'과할당 인력 보기'}))
    expect(screen.getByRole('tab',{name:'월별 투입률'})).toHaveAttribute('aria-selected','true')
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('month=2026-12')
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('q=')
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('filter=over')
  })
})

vi.mock('./lib/supabase',()=>({isSupabaseConfigured:false,supabase:null}))
