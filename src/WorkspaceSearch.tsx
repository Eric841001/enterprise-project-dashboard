import {useEffect,useId,useRef,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {Search,X} from 'lucide-react'
import type {Project} from './types'

export function WorkspaceSearch({projects}:{projects:Project[]}){
  const [query,setQuery]=useState(''),[index,setIndex]=useState(0),[open,setOpen]=useState(false)
  const input=useRef<HTMLInputElement>(null),root=useRef<HTMLDivElement>(null),id=useId(),navigate=useNavigate(),location=useLocation()
  const term=query.trim().toLowerCase()
  const matches=term?projects.filter(p=>`${p.customer} ${p.name} ${p.manager} ${p.resources.join(' ')}`.toLowerCase().includes(term)).slice(0,8):[]
  const selected=Math.min(index,Math.max(0,matches.length-1))
  useEffect(()=>{setOpen(false);setQuery('');setIndex(0)},[location.pathname])
  useEffect(()=>{
    const shortcut=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(document.querySelector('[role="dialog"],.sidebar.open'))return;input.current?.focus();setOpen(true)}}
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)}
    window.addEventListener('keydown',shortcut);document.addEventListener('pointerdown',outside)
    return()=>{window.removeEventListener('keydown',shortcut);document.removeEventListener('pointerdown',outside)}
  },[])
  function choose(project:Project){setOpen(false);setQuery('');navigate(`/projects/${project.id}`)}
  return <div className="global-search workspace-search" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}>
    <Search/><input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open&&Boolean(term)} aria-controls={open&&term?`${id}-results`:undefined} aria-activedescendant={open&&matches.length?`${id}-${selected}`:undefined} aria-label="전체 검색" placeholder="프로젝트·고객사·담당자 검색" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setIndex(0);setOpen(true)}} onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();setOpen(false);return}
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setIndex(v=>matches.length?(v+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length:0)}
      if(e.key==='Enter'&&open&&matches[selected]){e.preventDefault();choose(matches[selected])}
    }}/>
    {query?<button type="button" className="search-clear" aria-label="검색어 지우기" onClick={()=>{setQuery('');setIndex(0);input.current?.focus()}}><X/></button>:<kbd>⌘ / Ctrl K</kbd>}
    {open&&term&&<div className="search-results workspace-results" id={`${id}-results`} role="listbox" aria-label="프로젝트 검색 결과">
      {matches.map((p,i)=><div key={p.id} id={`${id}-${i}`} role="option" aria-selected={selected===i} onPointerMove={()=>setIndex(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p)}><span className="search-customer">{p.customer}</span><strong>{p.name}</strong><small>{p.manager} · {p.category}</small></div>)}
      {!matches.length&&<div className="search-empty" role="status">일치하는 프로젝트가 없습니다.</div>}
      <div className="search-hint" aria-hidden="true">↑↓ 이동 · Enter 열기 · Esc 닫기</div>
    </div>}
  </div>
}
