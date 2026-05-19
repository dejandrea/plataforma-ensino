import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export const TabContent = () => {
  // --- ESTADOS DE DADOS ---
  const [courses, setCourses] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  
  // --- ESTADOS DE SELEÇÃO ---
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // --- ESTADOS DE CONTROLE DE UI ---
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isEditingModule, setIsEditingModule] = useState(false);
  const [isEditingLesson, setIsEditingLesson] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  // --- ESTADOS DE FORMULÁRIO ---
  const [newCourseData, setNewCourseData] = useState({ title: "", description: "", total_hours: "" });
  const [moduleFormData, setModuleFormData] = useState({ title: "", description: "", order_index: "", duration_minutes: "" });
  const [lessonFormData, setLessonFormData] = useState({
    id: "", title: "", description: "", order_index: "", duration_minutes: "",
    meet_link: "", video_url: "", pdf_url: "", slides_url: "",
  });

  // --- FETCHERS ---
  useEffect(() => { fetchCourses(); }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchModules(selectedCourseId);
      setLessons([]);
      setSelectedModuleId(null);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedModuleId) fetchLessons(selectedModuleId);
  }, [selectedModuleId]);

  const fetchCourses = async () => {
    const { data } = await supabase.from("courses").select("*").order("title");
    if (data) setCourses(data);
  };

  const fetchModules = async (courseId: string) => {
    const { data } = await supabase.from("modules").select("*").eq("course_id", courseId).order("order_index", { ascending: true });
    if (data) setModules(data);
  };

  const fetchLessons = async (moduleId: string) => {
    const { data } = await supabase.from("lessons").select("*").eq("module_id", moduleId).order("order_index", { ascending: true });
    if (data) setLessons(data);
  };

  // --- HANDLERS ---
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("courses").insert([{
      title: newCourseData.title,
      description: newCourseData.description,
      total_hours: parseInt(newCourseData.total_hours) || 0,
    }]).select();

    if (error) alert(error.message);
    else {
      setIsCreatingCourse(false);
      setNewCourseData({ title: "", description: "", total_hours: "" });
      fetchCourses();
      if (data) setSelectedCourseId(data[0].id);
    }
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    const payload = {
      title: moduleFormData.title,
      description: moduleFormData.description,
      order_index: parseFloat(moduleFormData.order_index) || modules.length + 1,
      duration_minutes: parseInt(moduleFormData.duration_minutes) || 0,
      course_id: selectedCourseId,
    };

    const { error } = isEditing
      ? await supabase.from("modules").update(payload).eq("id", isEditing)
      : await supabase.from("modules").insert([payload]);

    if (error) alert(error.message);
    else {
      setIsEditing(null);
      setIsEditingModule(false);
      setModuleFormData({ title: "", description: "", order_index: "", duration_minutes: "" });
      fetchModules(selectedCourseId);
    }
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModuleId) return;

    const payload = {
      module_id: selectedModuleId,
      title: lessonFormData.title,
      description: lessonFormData.description,
      order_index: parseFloat(lessonFormData.order_index) || lessons.length + 1,
      duration_minutes: parseInt(lessonFormData.duration_minutes) || 0,
      meet_link: lessonFormData.meet_link,
      video_url: lessonFormData.video_url,
      pdf_url: lessonFormData.pdf_url,
      slides_url: lessonFormData.slides_url,
    };

    const { error } = lessonFormData.id
      ? await supabase.from("lessons").update(payload).eq("id", lessonFormData.id)
      : await supabase.from("lessons").insert([payload]);

    if (error) alert(error.message);
    else {
      setIsEditingLesson(false);
      setLessonFormData({ id: "", title: "", description: "", order_index: "", duration_minutes: "", meet_link: "", video_url: "", pdf_url: "", slides_url: "" });
      fetchLessons(selectedModuleId);
    }
  };

  const toggleModuleStatus = async (id: string, currentStatus: boolean) => {
    if (!window.confirm("Alterar status do módulo?")) return;
    await supabase.from("modules").update({ is_active: !currentStatus }).eq("id", id);
    fetchModules(selectedCourseId!);
  };

  return (
    <div className="mt-8 space-y-8 animate-in fade-in duration-500">
      {/* 1. CURSO */}
      <div className="relative flex flex-wrap gap-4 items-center bg-white/5 p-6 rounded-3xl ring-1 ring-white/10 backdrop-blur-sm">
        <div className="flex-1 min-w-[250px]">
          <label className="ml-1 text-[10px] font-black uppercase text-white/40">Curso Atual</label>
          <select
            className="w-full mt-1 bg-gray-900 text-white p-3 rounded-2xl ring-1 ring-white/20 outline-none focus:ring-2 focus:ring-brand-lavender transition-all"
            value={selectedCourseId || ""}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="">Escolha um curso...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.total_hours}h)</option>
            ))}
          </select>
        </div>
        <button onClick={() => setIsCreatingCourse(!isCreatingCourse)} className="mt-5 bg-gradient-to-r from-brand-purple to-brand-lavender text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg">
          {isCreatingCourse ? "Cancelar" : "+ Novo Curso"}
        </button>

        {isCreatingCourse && (
          <div className="absolute top-full left-0 mt-4 w-full md:w-96 z-50 bg-gray-900 p-6 rounded-3xl ring-1 ring-brand-lavender/30 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-white font-bold mb-4 italic">✨ Novo Curso</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <input className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none" placeholder="Título" value={newCourseData.title} onChange={(e) => setNewCourseData({ ...newCourseData, title: e.target.value })} required />
              <input type="number" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none" placeholder="Carga Horária (horas)" value={newCourseData.total_hours} onChange={(e) => setNewCourseData({ ...newCourseData, total_hours: e.target.value })} />
              <button type="submit" className="w-full bg-brand-lavender text-gray-900 font-black py-3 rounded-xl">SALVAR</button>
            </form>
          </div>
        )}
      </div>

      {selectedCourseId ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 2. MÓDULOS */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black uppercase text-white/50">Módulos</h2>
              <button onClick={() => { setIsEditingModule(!isEditingModule); setIsEditing(null); }} className="text-[10px] font-bold text-brand-lavender border border-brand-lavender/30 px-2 py-1 rounded-lg">
                {isEditingModule ? "Fechar" : "+ Adicionar"}
              </button>
            </div>

            {isEditingModule && (
              <form onSubmit={handleSaveModule} className="bg-white/5 p-5 rounded-3xl border border-brand-lavender/30 space-y-3 animate-in slide-in-from-top-2">
                <input className="w-full bg-gray-900 text-white p-3 rounded-xl border border-white/10 text-sm outline-none" placeholder="Título do Módulo" value={moduleFormData.title} onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })} required />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="0.1" className="bg-gray-900 text-white p-3 rounded-xl border border-white/10 text-sm" placeholder="Ordem" value={moduleFormData.order_index} onChange={(e) => setModuleFormData({ ...moduleFormData, order_index: e.target.value })} />
                  <input type="number" className="bg-gray-900 text-white p-3 rounded-xl border border-white/10 text-sm" placeholder="Minutos" value={moduleFormData.duration_minutes} onChange={(e) => setModuleFormData({ ...moduleFormData, duration_minutes: e.target.value })} />
                </div>
                <button className="w-full bg-brand-purple text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest">{isEditing ? "Atualizar" : "Salvar"}</button>
              </form>
            )}

            <div className="space-y-3">
              {modules.filter(m => m.course_id === selectedCourseId).map((m) => (
                <div key={m.id} onClick={() => setSelectedModuleId(m.id)} className={`p-5 rounded-3xl cursor-pointer transition-all border ${selectedModuleId === m.id ? "bg-brand-purple/20 border-brand-lavender shadow-lg" : "bg-white/5 border-white/5 hover:bg-white/10"} ${!m.is_active && "opacity-50 grayscale"}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-brand-lavender uppercase italic">Posição {m.order_index}</span>
                      <h3 className="font-bold text-white mt-1">{m.title}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setIsEditing(m.id); setIsEditingModule(true); setModuleFormData({ title: m.title, description: m.description || "", order_index: m.order_index.toString(), duration_minutes: m.duration_minutes?.toString() || "" }); }} className="text-[10px] text-white/40 hover:text-white">✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleModuleStatus(m.id, m.is_active); }} className="text-[10px] text-white/40 hover:text-white">🔘</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. AULAS */}
          <div className="lg:col-span-8">
            {selectedModuleId ? (
              <div className="space-y-6">
                <header className="flex justify-between items-center bg-white/5 p-6 rounded-3xl ring-1 ring-white/10">
                  <h2 className="text-xl font-black text-white italic">Aulas</h2>
                  <button onClick={() => { setIsEditingLesson(true); setLessonFormData({...lessonFormData, id: ""}); }} className="bg-brand-magenta text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase shadow-lg shadow-brand-magenta/20">+ Nova Aula</button>
                </header>

                {isEditingLesson && (
                  <form onSubmit={handleSaveLesson} className="bg-white/5 p-6 rounded-3xl border border-brand-lavender/30 space-y-4 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input className="bg-gray-900 text-white p-3 rounded-xl border border-white/10" placeholder="Título da Aula" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} required />
                      <input type="number" step="0.1" className="bg-gray-900 text-white p-3 rounded-xl border border-white/10" placeholder="Ordem" value={lessonFormData.order_index} onChange={e => setLessonFormData({...lessonFormData, order_index: e.target.value})} />
                      <input type="number" className="bg-gray-900 text-white p-3 rounded-xl border border-white/10" placeholder="Minutos" value={lessonFormData.duration_minutes} onChange={e => setLessonFormData({...lessonFormData, duration_minutes: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input className="bg-gray-900 text-blue-300 p-3 rounded-xl border border-white/10 text-xs" placeholder="🔗 Link Meet" value={lessonFormData.meet_link} onChange={e => setLessonFormData({...lessonFormData, meet_link: e.target.value})} />
                      <input className="bg-gray-900 text-red-300 p-3 rounded-xl border border-white/10 text-xs" placeholder="🔗 Link Vídeo" value={lessonFormData.video_url} onChange={e => setLessonFormData({...lessonFormData, video_url: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-brand-lavender text-black font-black py-3 rounded-xl">SALVAR AULA</button>
                      <button type="button" onClick={() => setIsEditingLesson(false)} className="bg-white/10 px-6 rounded-xl text-white">X</button>
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {lessons.map((lesson) => (
                    <div key={lesson.id} className="bg-white/5 p-6 rounded-[2rem] ring-1 ring-white/10">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="bg-brand-purple/20 h-10 w-10 rounded-xl flex items-center justify-center text-brand-lavender font-black">{lesson.order_index}</div>
                          <div>
                            <h4 className="font-bold text-white text-lg">
                              {lesson.title} <span className="text-[10px] text-white/40 font-normal italic">⏱️ {lesson.duration_minutes} min</span>
                            </h4>
                            <p className="text-xs text-white/40 mt-1 line-clamp-2">{lesson.description}</p>
                          </div>
                        </div>
                        <button onClick={() => { setIsEditingLesson(true); setLessonFormData({...lesson, id: lesson.id}); }} className="p-2 bg-white/5 rounded-xl hover:bg-white/10">✏️</button>
                      </div>
                      <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                        {lesson.meet_link && <span className="text-[9px] font-black bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg">MEET</span>}
                        {lesson.video_url && <span className="text-[9px] font-black bg-red-500/20 text-red-400 px-2 py-1 rounded-lg">VÍDEO</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl opacity-40 italic text-white">
                <span className="text-2xl mb-2">👈</span> Selecione um módulo
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center bg-white/5 rounded-3xl border border-white/10">
          <span className="text-4xl mb-4 block">🎓</span>
          <h3 className="text-xl font-bold text-white italic">Selecione um curso para começar</h3>
        </div>
      )}
    </div>
  );
};
