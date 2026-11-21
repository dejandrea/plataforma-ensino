import {createRoot} from 'react-dom/client';
import LessonContentImporter from '../../src/components/learning/LessonContentImporter';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<main className="min-h-screen bg-background p-4"><LessonContentImporter lessonId="b17a2000-0000-4000-8000-000000001002" lessonTitle="Grandes Nomes da Tecnologia" onClose={()=>{}}/></main>);
