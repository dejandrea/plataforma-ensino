import {Link} from 'react-router-dom';
import {TabContent} from '../components/management/TabContent';

export default function ContentCurriculum(){
 return <main className="app-bg min-h-screen text-white"><div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
  <nav aria-label="Navegação estrutural" className="mb-5 text-sm text-white/60"><Link to="/gestao" className="hover:text-white underline">Gestão</Link> <span aria-hidden="true">/</span> <span aria-current="page">Currículo</span></nav>
  <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-brand-lavender">Produção de aulas</p><h1 className="mt-2 text-3xl font-black">Currículo</h1><p className="mt-2 max-w-2xl text-sm text-white/65">Organize cursos, módulos e submódulos. Abra uma aula para trabalhar no conteúdo, nas apresentações e na publicação.</p></div></header>
  <TabContent/>
 </div></main>;
}
