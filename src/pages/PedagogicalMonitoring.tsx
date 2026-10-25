import {Route,Routes} from 'react-router-dom';
import {PedagogyOverview} from '../components/pedagogy/PedagogyOverview';
import {PedagogyJourney} from '../components/pedagogy/PedagogyJourney';

export function PedagogicalMonitoring() {
 return <main className="app-bg min-h-screen"><div className="mx-auto max-w-6xl space-y-7 px-4 py-8 pb-16">
  <header className="border-b border-white/10 pb-6"><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-lavender">Aprendizagem · Equipe pedagógica</p><h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">Acompanhamento Pedagógico</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Acompanhe a jornada dos alunos, identifique o que precisa de atenção e avalie os projetos em um só lugar.</p></header>
  <Routes><Route index element={<PedagogyOverview/>}/><Route path="alunos/:studentId" element={<PedagogyJourney/>}/><Route path="*" element={<p className="text-white/65">Página de acompanhamento não encontrada.</p>}/></Routes>
 </div></main>;
}
