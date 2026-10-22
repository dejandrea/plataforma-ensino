// Test entry only: real lesson UI, fake local API injected by the test server.
// No production Auth token or Supabase project is used.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LessonView } from '../../src/pages/LessonView';
import LessonContentImporter from '../../src/components/learning/LessonContentImporter';
import TeacherLearningPanel from '../../src/components/learning/TeacherLearningPanel';
import '../../src/index.css';

const lessonId = new URLSearchParams(window.location.search).get('lesson') ?? '00000000-0000-4000-8000-000000000015';
const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById('root')!).render(params.get('mode') === 'teacher' ? <div className="app-bg mx-auto max-w-5xl p-5"><TeacherLearningPanel scheduledLessonId={lessonId} meetingStatus={params.get('status') ?? 'scheduled'} /></div> : params.get('mode') === 'import' ? <div className="app-bg mx-auto max-w-5xl p-5"><LessonContentImporter lessonId={lessonId} lessonTitle={params.get('title') ?? ''} onClose={() => {}} /></div> : <MemoryRouter initialEntries={[`/lesson/${lessonId}`]}>
  <Routes><Route path="/lesson/:id" element={<LessonView />} /><Route path="/dashboard" element={<p>Jornada</p>} /></Routes>
</MemoryRouter>);
