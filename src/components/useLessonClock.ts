import {useEffect,useState} from 'react';
export function useLessonClock() {
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[]);
 return now;
}
