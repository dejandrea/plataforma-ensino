import {createRoot} from 'react-dom/client';
import EditorialLessonEditor from '../../src/components/learning/EditorialLessonEditor';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-5xl p-3"><EditorialLessonEditor lessonId="00000000-0000-4000-8000-000000009920" onClose={()=>{}}/></main>);
