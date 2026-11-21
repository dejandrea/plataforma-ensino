import {createContext,useContext,useEffect} from 'react';
let popGuard:((event:PopStateEvent)=>void)|null=null;
const guardPop=(event:PopStateEvent)=>popGuard?.(event);
// Register before BrowserRouter: its synchronous route update can unmount the
// editor and remove a listener installed only after the editor has mounted.
if(typeof window!=='undefined')window.addEventListener('popstate',guardPop,true);
if(import.meta.hot)import.meta.hot.dispose(()=>window.removeEventListener('popstate',guardPop,true));
export function registerLessonPopGuard(guard:(event:PopStateEvent)=>void){
 popGuard=guard;
 return()=>{if(popGuard===guard)popGuard=null;};
}
export type LessonChange={dirty:boolean;busy:boolean};
export const LessonChangesContext=createContext<{report:(key:string,value:LessonChange|null)=>void;pending:boolean}|null>(null);
// Optional: standalone tools continue to work without the dedicated workspace.
export function useLessonChanges(key:string,dirty:boolean,busy=false){
 const report=useContext(LessonChangesContext)?.report;
 useEffect(()=>{report?.(key,{dirty,busy});},[report,key,dirty,busy]);
 useEffect(()=>()=>{report?.(key,null);},[report,key]);
}
