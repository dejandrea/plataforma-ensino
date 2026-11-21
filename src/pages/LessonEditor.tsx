import {Component,lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import type {ErrorInfo,ReactNode} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {loadLessonWorkspace,curriculumReturnUrl} from '../lib/lessonWorkspace';
import type {LessonWorkspace} from '../lib/lessonWorkspace';
import {LessonChangesProvider,LessonChangeNotice} from '../components/management/LessonChanges';
import {CurriculumLessonPublication} from '../components/management/CurriculumLessonPublication';
import {loadEditorialLesson} from '../lib/editorialLessons';
import type {EditorialState} from '../lib/editorialLessons';
import {safeHttpsUrl} from '../lib/learningProgress';

const Editorial=lazy(()=>import('../components/learning/EditorialLessonEditor'));
const Legacy=lazy(()=>import('../components/learning/LessonContentImporter'));
const Package=lazy(()=>import('../components/learning/UnifiedLessonImporter'));
const Presentations=lazy(()=>import('../components/management/WebPresentationManager'));
const Preview=lazy(()=>import('../components/learning/AdminLessonPreview'));
const tabs=[['overview','Visão geral'],['activities','Atividades'],['presentations','Apresentações'],['import','Importar'],['publication','Publicação']] as const;
type Tab=typeof tabs[number][0];
type Tool='editorial'|'preview'|'presentations'|'legacy'|'package';
const validTab=(value:string|null):Tab=>tabs.some(([key])=>key===value)?value as Tab:'overview';
const statusLabels:Record<string,string>={published:'Publicada para alunos',draft:'Rascunho',planned:'Em preparação'};

class ToolBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error,info:ErrorInfo){console.error('Falha ao abrir ferramenta de conteúdo',error,info.componentStack);}
 render(){return this.state.failed?<div role="alert" className="rounded-2xl border border-red-300/30 p-5 text-red-100">Não foi possível abrir esta ferramenta. A aula e as outras abas continuam disponíveis. Recarregue a página para tentar novamente.</div>:this.props.children;}
}
const Loading=()=> <p role="status" className="p-6 text-white/65">Carregando ferramenta…</p>;

export default function LessonEditor(){
 const {lessonId=''}=useParams();
 return <LessonChangesProvider key={lessonId}><Workspace lessonId={lessonId}/></LessonChangesProvider>;
}
function Workspace({lessonId}:{lessonId:string}){
 const [params,setParams]=useSearchParams();
 const tab=validTab(params.get('aba'));
 const [workspace,setWorkspace]=useState<LessonWorkspace|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 const [tools,setTools]=useState<Partial<Record<Tool,boolean>>>(()=>tab==='activities'?{preview:true}:tab==='presentations'?{presentations:true}:tab==='publication'?{editorial:true}:{});
 const [activityMode,setActivityMode]=useState<'preview'|'edit'>('preview');
 const [importer,setImporter]=useState<'legacy'|'package'|null>(null);
 const [publisher,setPublisher]=useState<'editorial'|'package'>('editorial');
 const [editorial,setEditorial]=useState<{draft:boolean;hasHistory:boolean}|null>(null);
 const [editorialError,setEditorialError]=useState(false);
 const [notice,setNotice]=useState('');
 const tabRefs=useRef<(HTMLButtonElement|null)[]>([]);
 const remember=useCallback((tool:Tool)=>setTools(old=>old[tool]?old:{...old,[tool]:true}),[]);
 useEffect(()=>{
  let alive=true;
  loadLessonWorkspace(lessonId).then(value=>{if(alive)setWorkspace(value);}).catch(cause=>{if(alive)setError(cause.message);}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[lessonId,reload]);
 const updateEditorial=useCallback((state:EditorialState)=>{setEditorial({draft:state.draft?.status==='draft',hasHistory:state.hasHistory});setEditorialError(false);},[]);
 useEffect(()=>{let alive=true;loadEditorialLesson(lessonId).then(state=>{if(alive)updateEditorial(state);}).catch(()=>{if(alive)setEditorialError(true);});return()=>{alive=false;};},[lessonId,updateEditorial]);
 function selectTab(next:Tab){if(next==='activities')remember(activityMode==='edit'?'editorial':'preview');if(next==='presentations')remember('presentations');if(next==='import'&&importer)remember(importer);if(next==='publication')remember(publisher);setParams(previous=>{const nextParams=new URLSearchParams(previous);nextParams.set('aba',next);return nextParams;},{replace:true});}
 if(loading)return <main className="app-bg min-h-screen p-8 text-white"><p role="status">Carregando aula…</p></main>;
 if(error||!workspace)return <main className="app-bg min-h-screen p-8 text-white"><div role="alert" className="mx-auto max-w-3xl space-y-4 rounded-3xl bg-surface p-6"><h1 className="text-xl font-bold">Não foi possível abrir a aula</h1><p>{error}</p><button className="btn-primary" onClick={()=>{setLoading(true);setError('');setReload(n=>n+1);}}>Tentar novamente</button> <Link className="btn-secondary inline-block" to="/gestao/conteudo">Voltar ao currículo</Link></div></main>;
 const {lesson,course,module,submodule}=workspace,back=curriculumReturnUrl(workspace);
 const editorialVisible=(tab==='activities'&&activityMode==='edit')||(tab==='publication'&&publisher==='editorial');
 const packageVisible=(tab==='import'&&importer==='package')||(tab==='publication'&&publisher==='package');
 return <main className="app-bg min-h-screen text-white">
  <div className="sticky top-0 z-20 border-b border-white/10 bg-background/95 backdrop-blur">
   <header className="mx-auto max-w-6xl space-y-3 px-4 py-4 md:px-6">
    <nav aria-label="Navegação estrutural" className="flex flex-wrap gap-2 text-xs text-white/60"><Link to="/gestao" className="underline">Gestão</Link><span>/</span><Link to={back} className="underline">Currículo</Link><span>/</span><span aria-current="page" className="text-white">Aula</span></nav>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-brand-lavender">{course?.title??'Curso'} · {module?.title??'Módulo'} · {submodule?.title??'Submódulo'}</p><h1 className="mt-1 break-words text-xl font-black md:text-3xl">{lesson.title}</h1></div><Link to={back} className="btn-secondary shrink-0">Voltar ao currículo</Link></div>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-brand-purple/30 px-3 py-1 text-brand-ice">{statusLabels[lesson.publication_status]??lesson.publication_status}</span><span className="text-white/60">{lesson.duration_minutes??'—'} min · {lesson.curriculum_number!=null?`Nº curricular ${lesson.curriculum_number}`:`Posição ${lesson.order_index}`}</span><span className="text-white/60">{editorial?(editorial.draft?'Rascunho editorial salvo':'Sem rascunho editorial pendente'):editorialError?'Estado editorial indisponível; abra Atividades para tentar novamente.':'Estado editorial sob consulta'}</span><LessonChangeNotice/></div>
   </header>
   <div role="tablist" aria-label="Tarefas da aula" className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 md:px-6">
    {tabs.map(([key,label],index)=><button key={key} id={`tab-${key}`} ref={node=>{tabRefs.current[index]=node;}} type="button" role="tab" aria-selected={tab===key} aria-controls="lesson-editor-panel" tabIndex={tab===key?0:-1} onClick={()=>selectTab(key)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();selectTab(tabs[next][0]);tabRefs.current[next]?.focus();}} className={`rounded-t-xl border-b-2 px-3 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-ice ${tab===key?'border-brand-pink bg-brand-purple/20 text-white':'border-transparent text-white/55 hover:bg-white/5 hover:text-white'}`}>{label}</button>)}
   </div>
  </div>
  <div id="lesson-editor-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="mx-auto max-w-6xl min-w-0 space-y-5 px-4 py-6 focus:outline-none md:px-6">
   {notice&&<p role="status" className="rounded-xl bg-brand-purple/20 p-3 text-brand-ice">{notice}</p>}
   {tabs.map(([key,label])=><section key={key} id={`panel-${key}`} aria-label={label} hidden={tab!==key} className="min-w-0 focus:outline-none">
    {key==='overview'&&<div className="grid gap-5 md:grid-cols-[1.4fr_1fr]"><article className="rounded-3xl bg-surface p-5 ring-1 ring-white/10"><h2 className="text-xl font-bold">Sobre esta aula</h2><p className="mt-3 whitespace-pre-wrap text-white/70">{lesson.description||'Nenhuma descrição cadastrada.'}</p><dl className="mt-5 space-y-2 text-sm"><dt className="text-white/50">Identificador da aula</dt><dd className="break-all font-mono text-xs">{lesson.id}</dd></dl><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" onClick={()=>selectTab('activities')}>Gerenciar atividades</button><Link className="btn-secondary inline-block" to={back}>Editar cadastro no currículo</Link></div></article><article className="rounded-3xl bg-surface p-5 ring-1 ring-white/10"><h2 className="text-xl font-bold">Recursos cadastrados</h2><ul className="mt-4 space-y-4">{([['Vídeo',lesson.video_url],['PDF',lesson.pdf_url],['Slides externos',lesson.slides_url],['Encontro online',lesson.meet_link]] as const).map(([name,url])=><li key={name} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{name}</span>{safeHttpsUrl(url)?<a className="text-brand-ice underline" href={safeHttpsUrl(url)!} target="_blank" rel="noopener noreferrer">Abrir recurso ↗</a>:<span className="text-white/40">Não cadastrado</span>}</li>)}</ul><p className="mt-5 text-xs text-white/50">Materiais das atividades e apresentações ficam nas abas correspondentes.</p></article></div>}
    {key==='activities'&&<><h2 className="text-xl font-bold">Atividades da aula</h2><p className="mt-2 text-sm text-white/60">Confira os materiais como aluno ou trabalhe no documento editorial. A prévia não registra estudo, progresso ou XP.</p><div className="my-4 flex flex-wrap gap-2"><button className={activityMode==='preview'?'btn-primary':'btn-secondary'} aria-pressed={activityMode==='preview'} onClick={()=>{remember('preview');setActivityMode('preview');}}>Visualizar atividades</button><button className={activityMode==='edit'?'btn-primary':'btn-secondary'} aria-pressed={activityMode==='edit'} onClick={()=>{remember('editorial');setActivityMode('edit');}}>Editar documento editorial</button></div></>}
    {key==='presentations'&&<><h2 className="text-xl font-bold">Apresentações</h2><p className="mt-2 text-sm text-white/60">Gerencie versões, revise a apresentação e mantenha o vínculo com a atividade correta.</p></>}
    {key==='import'&&<><h2 className="text-xl font-bold">Importar conteúdo</h2><p className="mt-2 text-sm text-white/60">Escolha um fluxo. Seus arquivos e a prévia ficam preservados ao alternar as abas desta aula.</p><div className="my-5 grid gap-3 md:grid-cols-2">{([['legacy','Atividades em JSON','Importador existente para adicionar atividades v1/v2. A comparação segura da Aula 02 permanece disponível.'],['package','Importar aula por ZIP','Abra o importador para enviar o ZIP final produzido pelo Work, com atividades e apresentações.']] as const).map(([value,title,description])=><button key={value} type="button" aria-pressed={importer===value} onClick={()=>{remember(value);setImporter(value);}} className={`rounded-2xl border p-4 text-left transition ${importer===value?'border-brand-lavender bg-brand-purple/20':'border-white/10 bg-surface hover:border-white/30'}`}><span className="block font-bold">{title}</span><span className="mt-2 block text-sm text-white/60">{description}</span></button>)}</div></>}
    {key==='publication'&&<><h2 className="text-xl font-bold">Revisar e publicar</h2><p className="mt-2 text-sm text-white/60">Publicar conteúdo e liberar a aula no currículo são ações distintas. As regras de histórico e concorrência continuam sendo verificadas pelo servidor.</p><div className="my-4 flex flex-wrap gap-2"><button aria-pressed={publisher==='editorial'} className={publisher==='editorial'?'btn-primary':'btn-secondary'} onClick={()=>{remember('editorial');setPublisher('editorial');}}>Rascunho editorial</button><button aria-pressed={publisher==='package'} className={publisher==='package'?'btn-primary':'btn-secondary'} onClick={()=>{remember('package');setPublisher('package');}}>Pacote completo</button></div>{editorial?.hasHistory&&<p className="text-sm text-amber-100">Aula com histórico: o servidor mantém as proteções de edição e publicação.</p>}</>}
    <span className="sr-only">{label}</span>
   </section>)}
   {/* Each tool mounts on first use, then keeps its own state. E1a/E2a are never duplicated. */}
   {tools.preview&&<div hidden={tab!=='activities'||activityMode!=='preview'}><ToolBoundary><Suspense fallback={<Loading/>}><Preview lessonId={lesson.id}/></Suspense></ToolBoundary></div>}
   {tools.editorial&&<div hidden={!editorialVisible}><ToolBoundary><Suspense fallback={<Loading/>}><Editorial lessonId={lesson.id} onClose={()=>selectTab('overview')} workspaceView={tab==='publication'?'publication':'edit'} onStateChange={updateEditorial}/></Suspense></ToolBoundary></div>}
   {tools.presentations&&<div hidden={tab!=='presentations'}><ToolBoundary><Suspense fallback={<Loading/>}><Presentations lessonId={lesson.id} onClose={()=>selectTab('overview')}/></Suspense></ToolBoundary></div>}
   {tools.legacy&&<div hidden={tab!=='import'||importer!=='legacy'}><ToolBoundary><Suspense fallback={<Loading/>}><Legacy lessonId={lesson.id} lessonTitle={lesson.title} onClose={()=>selectTab('overview')}/></Suspense></ToolBoundary></div>}
   {tools.package&&<div hidden={!packageVisible}><ToolBoundary><Suspense fallback={<Loading/>}><Package lessonId={lesson.id} onClose={()=>selectTab('overview')} workspaceView={tab==='publication'?'publication':'import'}/></Suspense></ToolBoundary></div>}
   <section hidden={tab!=='publication'} aria-label="Disponibilidade no currículo" className="rounded-3xl bg-surface p-5 ring-1 ring-white/10"><h3 className="font-bold">Disponibilidade para alunos</h3>{lesson.publication_status==='planned'?<CurriculumLessonPublication lessonId={lesson.id} onPublished={()=>{setWorkspace({...workspace,lesson:{...lesson,publication_status:'published'}});setNotice('Aula liberada no currículo.');}}/>:<p className="mt-2 text-sm text-white/65">{statusLabels[lesson.publication_status]??lesson.publication_status}. A publicação editorial preserva esse status.</p>}</section>
  </div>
 </main>;
}
