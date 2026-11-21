import {createRoot} from 'react-dom/client';
import UnifiedLessonImporter from '../../src/components/learning/UnifiedLessonImporter';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-5xl p-3"><UnifiedLessonImporter lessonId="00000000-0000-4000-8000-000000009925" onClose={()=>{}}/></main>);
