import {TeacherReports} from '../../src/pages/TeacherReports';
import {CurriculumLessonPublication} from '../../src/components/management/CurriculumLessonPublication';
import {LessonCard} from '../../src/components/LessonCard';
import {useEffect,useState} from 'react';
import {PedagogicalMonitoring} from '../../src/pages/PedagogicalMonitoring';
import {CompletedLessonTitleEditor} from '../../src/components/CompletedLessonTitleEditor';
import {Navbar} from '../../src/components/Navbar';
import {StaffNavbar} from '../../src/components/StaffNavbar';
import AdminLessonPreview from '../../src/components/learning/AdminLessonPreview';
// Test entry only: real lesson UI, fake local API injected by the test server.
// No production Auth token or Supabase project is used.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LessonView } from '../../src/pages/LessonView';
import LessonContentImporter from '../../src/components/learning/LessonContentImporter';
import TeacherLearningPanel from '../../src/components/learning/TeacherLearningPanel';
import ProjectReviewPanel from '../../src/components/learning/ProjectReviewPanel';
import '../../src/index.css';
import {TabGamification} from '../../src/components/management/TabGamification';
import {supabase} from '../../src/lib/supabaseClient';
import {StudentBillingPanel} from '../../src/components/StudentBillingPanel';
import {StudentDiscountPanel} from '../../src/components/StudentDiscountPanel';

const lessonId = new URLSearchParams(window.location.search).get('lesson') ?? '00000000-0000-4000-8000-000000000015';
const params = new URLSearchParams(window.location.search);
function CurriculumCards() {
 const [lessons,setLessons]=useState<{id:string;title:string;publication_status:string;curriculum_number:number}[]>([]);
 useEffect(()=>{void supabase.rpc('pedagogy_student_journey',{p_student_id:'00000000-0000-4000-8000-000000000002',p_course_id:'6fada12b-4073-40ce-9bfb-e5ecfc2c453d'}).then(({data})=>setLessons(data?.lessons??[]));},[]);
 return <div className="app-bg mx-auto max-w-5xl space-y-4 p-5"><h1 className="text-2xl text-white">HTML Básico</h1>{lessons.filter(l=>l.curriculum_number!=null).sort((a,b)=>a.curriculum_number-b.curriculum_number).map(l=><LessonCard key={l.id} id={l.id} title={l.title} type="pdf" isCompleted={false} isPlanned={l.publication_status==='planned'} curriculumNumber={l.curriculum_number}/>)}</div>;
}
const pedagogyParams=new URLSearchParams(params);pedagogyParams.delete('mode');pedagogyParams.delete('jornada');
if(params.get('mode')==='curriculum-publication') {
 createRoot(document.getElementById('root')!).render(<div className="app-bg min-h-screen p-5"><CurriculumLessonPublication lessonId={lessonId} onPublished={()=>{document.getElementById('published-result')!.textContent='Aula liberada';}}/><p id="published-result" role="status" className="text-white"/></div>);
} else if(params.get('mode')==='curriculum-cards') {
 createRoot(document.getElementById('root')!).render(<MemoryRouter><CurriculumCards/></MemoryRouter>);
} else if(params.get('mode')==='pedagogy') {
 createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[`/acompanhamento-pedagogico${params.get('jornada')?`/alunos/${params.get('jornada')}`:''}?${pedagogyParams}`]}><Routes><Route path="/acompanhamento-pedagogico/*" element={<PedagogicalMonitoring/>}/></Routes></MemoryRouter>);
} else {
if(['catalog','navigation','reports'].includes(params.get('mode') ?? '')) supabase.auth.getUser=async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}},error:null}) as Awaited<ReturnType<typeof supabase.auth.getUser>>;
if(params.get('mode')==='catalog') {
 const from=supabase.storage.from.bind(supabase.storage);
 supabase.storage.from=(bucket)=>{const client=from(bucket);client.getPublicUrl=(path)=>({data:{publicUrl:`https://example.org/icons/${path}`}});return client;};
}
createRoot(document.getElementById('root')!).render(params.get('mode') === 'reports' ? <MemoryRouter initialEntries={['/relatorios?tab=attendance']}><TeacherReports/></MemoryRouter> : params.get('mode') === 'lesson-title' ? <div className="app-bg p-5"><CompletedLessonTitleEditor lessonId={lessonId} title={params.get('title') ?? 'Aula concluida'}/></div> : params.get('mode') === 'navigation' ? <MemoryRouter initialEntries={[params.get('role') === 'student' ? '/dashboard' : '/dashboard-professor']}>{params.get('role') === 'student' ? <Navbar/> : <StaffNavbar/>}<main className="app-bg p-6"><h1 className="text-white">Conteudo da aula</h1></main></MemoryRouter> : params.get('mode') === 'finance' ? <div className="app-bg mx-auto max-w-5xl p-5"><StudentBillingPanel studentId={lessonId}/><StudentDiscountPanel studentId={lessonId} scope="monthly" initialMonth="2026-10" grossByMonth={{'2026-10':300}}/></div> : params.get('mode') === 'catalog' ? <div className="app-bg mx-auto max-w-5xl p-5"><TabGamification/></div> : params.get('mode') === 'projects' ? <div className="app-bg mx-auto max-w-5xl p-5">{params.get('student')?<ProjectReviewPanel studentId={params.get('student')!}/>:<ProjectReviewPanel scheduledLessonId={lessonId}/>}</div> : params.get('mode') === 'teacher' ? <div className="app-bg mx-auto max-w-5xl p-5"><TeacherLearningPanel scheduledLessonId={lessonId} meetingStatus={params.get('status') ?? 'scheduled'} /></div> : params.get('mode') === 'preview' ? <div className="app-bg mx-auto max-w-5xl p-5"><AdminLessonPreview lessonId={lessonId} /></div> : params.get('mode') === 'import' ? <div className="app-bg mx-auto max-w-5xl p-5"><LessonContentImporter lessonId={lessonId} lessonTitle={params.get('title') ?? ''} onClose={() => {}} /></div> : <MemoryRouter initialEntries={[`/lesson/${lessonId}`]}>
  <Routes><Route path="/lesson/:id" element={<LessonView />} /><Route path="/dashboard" element={<p>Jornada</p>} /></Routes>
</MemoryRouter>);
}
