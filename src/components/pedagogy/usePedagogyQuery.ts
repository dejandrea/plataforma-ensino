import {useCallback,useEffect,useState} from 'react';
import {teacherLearningRpc} from '../../lib/teacherLearning';

/** Changed filters immediately hide old student data; late responses are ignored. */
export function usePedagogyQuery<T>(name:string,args:Record<string,unknown>) {
 const [version,setVersion]=useState(0);
 const [state,setState]=useState<{key:string;data:T|null;error:string}>({key:'',data:null,error:''});
 const key=JSON.stringify([name,args,version]);
 useEffect(()=>{
  let current=true;
  const [rpc,parameters]=JSON.parse(key) as [string,Record<string,unknown>,number];
  teacherLearningRpc<T>(rpc,parameters).then(data=>{if(current)setState({key,data,error:''});}).catch(error=>{
   if(current)setState({key,data:null,error:error instanceof Error?error.message:'Não foi possível carregar os dados.'});
  });
  return ()=>{current=false;};
 },[key]);
 const retry=useCallback(()=>setVersion(v=>v+1),[]);
 const current=state.key===key;
 return {data:current?state.data:null,error:current?state.error:'',loading:!current,retry};
}
