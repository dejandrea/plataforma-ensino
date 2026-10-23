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
if(['catalog','navigation'].includes(params.get('mode') ?? '')) supabase.auth.getUser=async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}},error:null}) as Awaited<ReturnType<typeof supabase.auth.getUser>>;
if(params.get('mode')==='catalog') {
 const from=supabase.storage.from.bind(supabase.storage);
 supabase.storage.from=(bucket)=>{const client=from(bucket);client.getPublicUrl=(path)=>({data:{publicUrl:`https://example.org/icons/${path}`}});return client;};
}
createRoot(document.getElementById('root')!).render(params.get('mode') === 'navigation' ? <MemoryRouter initialEntries={[params.get('role') === 'student' ? '/dashboard' : '/dashboard-professor']}>{params.get('role') === 'student' ? <Navbar/> : <StaffNavbar/>}<main className="app-bg p-6"><h1 className="text-white">Conteudo da aula</h1></main></MemoryRouter> : params.get('mode') === 'finance' ? <div className="app-bg mx-auto max-w-5xl p-5"><StudentBillingPanel studentId={lessonId}/><StudentDiscountPanel studentId={lessonId} scope="monthly" initialMonth="2026-10" grossByMonth={{'2026-10':300}}/></div> : params.get('mode') === 'catalog' ? <div className="app-bg mx-auto max-w-5xl p-5"><TabGamification/></div> : params.get('mode') === 'projects' ? <div className="app-bg mx-auto max-w-5xl p-5">{params.get('student')?<ProjectReviewPanel studentId={params.get('student')!}/>:<ProjectReviewPanel scheduledLessonId={lessonId}/>}</div> : params.get('mode') === 'teacher' ? <div className="app-bg mx-auto max-w-5xl p-5"><TeacherLearningPanel scheduledLessonId={lessonId} meetingStatus={params.get('status') ?? 'scheduled'} /></div> : params.get('mode') === 'preview' ? <div className="app-bg mx-auto max-w-5xl p-5"><AdminLessonPreview lessonId={lessonId} /></div> : params.get('mode') === 'import' ? <div className="app-bg mx-auto max-w-5xl p-5"><LessonContentImporter lessonId={lessonId} lessonTitle={params.get('title') ?? ''} onClose={() => {}} /></div> : <MemoryRouter initialEntries={[`/lesson/${lessonId}`]}>
  <Routes><Route path="/lesson/:id" element={<LessonView />} /><Route path="/dashboard" element={<p>Jornada</p>} /></Routes>
</MemoryRouter>);
