import {useCallback,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';

import {LessonChangesContext as Changes} from '../../lib/lessonChanges';
import {registerLessonPopGuard} from '../../lib/lessonChanges';
import type {LessonChange as Change} from '../../lib/lessonChanges';
const discardMessage='Há alterações locais não salvas ou uma operação em andamento nesta aula. Sair e descartar as alterações locais?';

export function LessonChangesProvider({children}:{children:ReactNode}){
 const [forms,setForms]=useState<Record<string,Change>>({});
 const report=useCallback((key:string,value:Change|null)=>setForms(previous=>{
  if(value&&previous[key]?.dirty===value.dirty&&previous[key]?.busy===value.busy)return previous;
  const next={...previous};if(value)next[key]=value;else delete next[key];return next;
 }),[]);
 const pending=Object.values(forms).some(value=>value.dirty||value.busy);
 const pendingRef=useRef(pending);
 useLayoutEffect(()=>{pendingRef.current=pending;},[pending]);
 const location=useLocation();
 const position=useRef<number>(window.history.state?.idx??0);
 useEffect(()=>{position.current=window.history.state?.idx??position.current;},[location]);
 useEffect(()=>{
  const beforeUnload=(event:BeforeUnloadEvent)=>{if(pendingRef.current){event.preventDefault();event.returnValue='';}};
  const click=(event:MouseEvent)=>{
   const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
   if(!pendingRef.current||!anchor||anchor.target==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
   if(anchor.href===window.location.href)return;
   if(!window.confirm(discardMessage)){event.preventDefault();event.stopPropagation();}else pendingRef.current=false;
  };
  let restoring=false;
  const pop=(event:PopStateEvent)=>{
   if(restoring){restoring=false;event.stopImmediatePropagation();return;}
   const next=event.state?.idx;
   if(!pendingRef.current||typeof next!=='number'||next===position.current)return;
   if(window.confirm(discardMessage)){pendingRef.current=false;return;}
   event.stopImmediatePropagation();restoring=true;window.history.go(position.current-next);
  };
  window.addEventListener('beforeunload',beforeUnload);
  document.addEventListener('click',click,true);
  const unregisterPop=registerLessonPopGuard(pop);
  return()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',click,true);unregisterPop();};
 },[]);
 return <Changes.Provider value={{report,pending}}>{children}</Changes.Provider>;
}

export function LessonChangeNotice(){
 const pending=useContext(Changes)?.pending;
 return pending?<span role="status" className="rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-100">Alterações locais / operação em andamento</span>:null;
}
