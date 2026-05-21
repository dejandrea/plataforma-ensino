import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const emptyModuleForm = {
  title: "",
  description: "",
  order_index: "",
  duration_minutes: "",
};

const emptyLessonForm = {
  id: "",
  title: "",
  description: "",
  order_index: "",
  duration_minutes: "",
  meet_link: "",
  video_url: "",
  pdf_url: "",
  slides_url: "",
};

export const TabContent = () => {
  const courseModalRef = useRef<HTMLDivElement | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [submodules, setSubmodules] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedSubmoduleId, setSelectedSubmoduleId] = useState<string | null>(null);

  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isEditingModule, setIsEditingModule] = useState(false);
  const [isEditingSubmodule, setIsEditingSubmodule] = useState(false);
  const [isEditingLesson, setIsEditingLesson] = useState(false);

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingSubmoduleId, setEditingSubmoduleId] = useState<string | null>(null);

  const [newCourseData, setNewCourseData] = useState({
    title: "",
    description: "",
    total_hours: "",
  });
  const [moduleFormData, setModuleFormData] = useState(emptyModuleForm);
  const [submoduleFormData, setSubmoduleFormData] = useState(emptyModuleForm);
  const [lessonFormData, setLessonFormData] = useState(emptyLessonForm);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!isCreatingCourse) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        courseModalRef.current &&
        !courseModalRef.current.contains(event.target as Node)
      ) {
        setIsCreatingCourse(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isCreatingCourse]);

  useEffect(() => {
    if (!selectedCourseId) {
      setModules([]);
      setSubmodules([]);
      setLessons([]);
      setSelectedModuleId(null);
      setSelectedSubmoduleId(null);
      return;
    }

    fetchModules(selectedCourseId);
    setSubmodules([]);
    setLessons([]);
    setSelectedModuleId(null);
    setSelectedSubmoduleId(null);
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setSubmodules([]);
      setLessons([]);
      setSelectedSubmoduleId(null);
      return;
    }

    fetchSubmodules(selectedModuleId);
    setLessons([]);
    setSelectedSubmoduleId(null);
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedSubmoduleId) {
      setLessons([]);
      return;
    }

    fetchLessons(selectedSubmoduleId);
  }, [selectedSubmoduleId]);

  const fetchCourses = async () => {
    const { data } = await supabase.from("courses").select("*").order("title");
    if (data) setCourses(data);
  };

  const fetchModules = async (courseId: string) => {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (data) setModules(data);
  };

  const fetchSubmodules = async (moduleId: string) => {
    const { data } = await supabase
      .from("submodules")
      .select("*")
      .eq("module_id", moduleId)
      .order("order_index", { ascending: true });

    if (data) setSubmodules(data);
  };

  const fetchLessons = async (submoduleId: string) => {
    const { data } = await supabase
      .from("lessons")
      .select("*")
      .eq("submodule_id", submoduleId)
      .order("order_index", { ascending: true });

    if (data) setLessons(data);
  };

  const resetModuleForm = () => {
    setEditingModuleId(null);
    setModuleFormData(emptyModuleForm);
    setIsEditingModule(false);
  };

  const resetSubmoduleForm = () => {
    setEditingSubmoduleId(null);
    setSubmoduleFormData(emptyModuleForm);
    setIsEditingSubmodule(false);
  };

  const resetLessonForm = () => {
    setLessonFormData(emptyLessonForm);
    setIsEditingLesson(false);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from("courses")
      .insert([
        {
          title: newCourseData.title,
          description: newCourseData.description,
          total_hours: parseInt(newCourseData.total_hours, 10) || 0,
        },
      ])
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setIsCreatingCourse(false);
    setNewCourseData({ title: "", description: "", total_hours: "" });
    fetchCourses();

    if (data?.[0]) {
      setSelectedCourseId(data[0].id);
    }
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourseId) return;

    const payload = {
      title: moduleFormData.title,
      description: moduleFormData.description,
      order_index: parseFloat(moduleFormData.order_index) || modules.length + 1,
      duration_minutes: parseInt(moduleFormData.duration_minutes, 10) || 0,
      course_id: selectedCourseId,
    };

    const { error } = editingModuleId
      ? await supabase.from("modules").update(payload).eq("id", editingModuleId)
      : await supabase.from("modules").insert([payload]);

    if (error) {
      alert(error.message);
      return;
    }

    resetModuleForm();
    fetchModules(selectedCourseId);
  };

  const handleSaveSubmodule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModuleId) return;

    const payload = {
      title: submoduleFormData.title,
      description: submoduleFormData.description,
      order_index: parseFloat(submoduleFormData.order_index) || submodules.length + 1,
      duration_minutes: parseInt(submoduleFormData.duration_minutes, 10) || 0,
      module_id: selectedModuleId,
    };

    const { error } = editingSubmoduleId
      ? await supabase.from("submodules").update(payload).eq("id", editingSubmoduleId)
      : await supabase.from("submodules").insert([payload]);

    if (error) {
      alert(error.message);
      return;
    }

    resetSubmoduleForm();
    fetchSubmodules(selectedModuleId);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModuleId || !selectedSubmoduleId) return;

    const payload = {
      module_id: selectedModuleId,
      submodule_id: selectedSubmoduleId,
      title: lessonFormData.title,
      description: lessonFormData.description,
      order_index: parseInt(lessonFormData.order_index, 10) || lessons.length + 1,
      duration_minutes: parseInt(lessonFormData.duration_minutes, 10) || 0,
      meet_link: lessonFormData.meet_link,
      video_url: lessonFormData.video_url,
      pdf_url: lessonFormData.pdf_url,
      slides_url: lessonFormData.slides_url,
    };

    const { error } = lessonFormData.id
      ? await supabase.from("lessons").update(payload).eq("id", lessonFormData.id)
      : await supabase.from("lessons").insert([payload]);

    if (error) {
      alert(error.message);
      return;
    }

    resetLessonForm();
    fetchLessons(selectedSubmoduleId);
  };

  const toggleModuleStatus = async (id: string, currentStatus: boolean) => {
    if (!window.confirm("Alterar status do modulo?")) return;

    await supabase.from("modules").update({ is_active: !currentStatus }).eq("id", id);

    if (selectedCourseId) {
      fetchModules(selectedCourseId);
    }
  };

  const toggleSubmoduleStatus = async (id: string, currentStatus: boolean) => {
    if (!window.confirm("Alterar status do submodulo?")) return;

    await supabase
      .from("submodules")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (selectedModuleId) {
      fetchSubmodules(selectedModuleId);
    }
  };

  return (
    <div className="mt-8 space-y-8 animate-in fade-in duration-500">
      <div className="relative flex flex-wrap items-center gap-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-sm">
        <div className="min-w-[250px] flex-1">
          <label className="ml-1 text-[10px] font-black uppercase text-white/40">
            Curso atual
          </label>
          <select
            className="mt-1 w-full rounded-2xl bg-gray-900 p-3 text-white ring-1 ring-white/20 outline-none transition-all focus:ring-2 focus:ring-brand-lavender"
            value={selectedCourseId || ""}
            onChange={(e) => setSelectedCourseId(e.target.value || null)}
          >
            <option value="">Escolha um curso...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} ({course.total_hours}h)
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setIsCreatingCourse((value) => !value)}
          className="mt-5 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-lavender px-6 py-3 text-sm font-bold text-white shadow-lg"
          type="button"
        >
          {isCreatingCourse ? "Cancelar" : "+ Novo curso"}
        </button>

        {isCreatingCourse && (
          <div
            ref={courseModalRef}
            className="absolute left-0 top-full z-50 mt-4 w-full rounded-3xl bg-gray-900 p-6 shadow-2xl ring-1 ring-brand-lavender/30 animate-in zoom-in-95 md:w-96"
          >
            <h3 className="mb-4 font-bold italic text-white">Novo curso</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                placeholder="Titulo"
                value={newCourseData.title}
                onChange={(e) =>
                  setNewCourseData({ ...newCourseData, title: e.target.value })
                }
                required
              />
              <textarea
                className="min-h-24 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                placeholder="Descricao"
                value={newCourseData.description}
                onChange={(e) =>
                  setNewCourseData({
                    ...newCourseData,
                    description: e.target.value,
                  })
                }
              />
              <input
                type="number"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                placeholder="Carga horaria (horas)"
                value={newCourseData.total_hours}
                onChange={(e) =>
                  setNewCourseData({
                    ...newCourseData,
                    total_hours: e.target.value,
                  })
                }
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-brand-lavender py-3 font-black text-gray-900"
              >
                SALVAR
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingCourse(false)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Cancelar
              </button>
            </form>
          </div>
        )}
      </div>

      {selectedCourseId ? (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-3">
            <SectionHeader
              title="Modulos"
              buttonLabel={isEditingModule ? "Fechar" : "+ Adicionar"}
              onClick={() => {
                setIsEditingModule((value) => !value);
                setEditingModuleId(null);
                setModuleFormData(emptyModuleForm);
              }}
            />

            {isEditingModule && (
              <ItemForm
                title={editingModuleId ? "Editar modulo" : "Novo modulo"}
                data={moduleFormData}
                onChange={setModuleFormData}
                onSubmit={handleSaveModule}
                submitLabel={editingModuleId ? "Atualizar modulo" : "Salvar modulo"}
              />
            )}

            <div className="space-y-3">
              {modules.map((module) => (
                <div
                  key={module.id}
                  onClick={() => setSelectedModuleId(module.id)}
                  className={`cursor-pointer rounded-3xl border p-5 transition-all ${
                    selectedModuleId === module.id
                      ? "border-brand-lavender bg-brand-purple/20 shadow-lg"
                      : "border-white/5 bg-white/5 hover:bg-white/10"
                  } ${!module.is_active ? "opacity-50 grayscale" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase italic text-brand-lavender">
                        Posicao {module.order_index}
                      </span>
                      <h3 className="mt-1 font-bold text-white">{module.title}</h3>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingModuleId(module.id);
                          setIsEditingModule(true);
                          setModuleFormData({
                            title: module.title || "",
                            description: module.description || "",
                            order_index: module.order_index?.toString() || "",
                            duration_minutes:
                              module.duration_minutes?.toString() || "",
                          });
                        }}
                        className="text-[10px] text-white/40 hover:text-white"
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleModuleStatus(module.id, module.is_active);
                        }}
                        className="text-[10px] text-white/40 hover:text-white"
                        type="button"
                      >
                        Status
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 xl:col-span-3">
            <SectionHeader
              title="Submodulos"
              buttonLabel={isEditingSubmodule ? "Fechar" : "+ Adicionar"}
              onClick={() => {
                setIsEditingSubmodule((value) => !value);
                setEditingSubmoduleId(null);
                setSubmoduleFormData(emptyModuleForm);
              }}
              disabled={!selectedModuleId}
            />

            {isEditingSubmodule && selectedModuleId && (
              <ItemForm
                title={editingSubmoduleId ? "Editar submodulo" : "Novo submodulo"}
                data={submoduleFormData}
                onChange={setSubmoduleFormData}
                onSubmit={handleSaveSubmodule}
                submitLabel={
                  editingSubmoduleId ? "Atualizar submodulo" : "Salvar submodulo"
                }
              />
            )}

            {selectedModuleId ? (
              <div className="space-y-3">
                {submodules.map((submodule) => (
                  <div
                    key={submodule.id}
                    onClick={() => setSelectedSubmoduleId(submodule.id)}
                    className={`cursor-pointer rounded-3xl border p-5 transition-all ${
                      selectedSubmoduleId === submodule.id
                        ? "border-brand-pink bg-brand-pink/15 shadow-lg"
                        : "border-white/5 bg-white/5 hover:bg-white/10"
                    } ${!submodule.is_active ? "opacity-50 grayscale" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase italic text-brand-pink">
                          Ordem {submodule.order_index}
                        </span>
                        <h3 className="mt-1 font-bold text-white">
                          {submodule.title}
                        </h3>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSubmoduleId(submodule.id);
                            setIsEditingSubmodule(true);
                            setSubmoduleFormData({
                              title: submodule.title || "",
                              description: submodule.description || "",
                              order_index: submodule.order_index?.toString() || "",
                              duration_minutes:
                                submodule.duration_minutes?.toString() || "",
                            });
                          }}
                          className="text-[10px] text-white/40 hover:text-white"
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubmoduleStatus(submodule.id, submodule.is_active);
                          }}
                          className="text-[10px] text-white/40 hover:text-white"
                          type="button"
                        >
                          Status
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {submodules.length === 0 && (
                  <EmptyState text="Este modulo ainda nao tem submodulos." />
                )}
              </div>
            ) : (
              <EmptyState text="Selecione um modulo para organizar os submodulos." />
            )}
          </div>

          <div className="xl:col-span-6">
            {selectedSubmoduleId ? (
              <div className="space-y-6">
                <header className="flex items-center justify-between rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                      Etapa final
                    </p>
                    <h2 className="mt-2 text-xl font-black italic text-white">
                      Aulas do submodulo
                    </h2>
                  </div>

                  <button
                    onClick={() => {
                      setIsEditingLesson(true);
                      setLessonFormData(emptyLessonForm);
                    }}
                    className="rounded-2xl bg-brand-magenta px-5 py-2.5 text-xs font-black uppercase text-white shadow-lg shadow-brand-magenta/20"
                    type="button"
                  >
                    + Nova aula
                  </button>
                </header>

                {isEditingLesson && (
                  <form
                    onSubmit={handleSaveLesson}
                    className="space-y-4 rounded-3xl border border-brand-lavender/30 bg-white/5 p-6 animate-in slide-in-from-top-4"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <input
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-white"
                        placeholder="Titulo da aula"
                        value={lessonFormData.title}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            title: e.target.value,
                          })
                        }
                        required
                      />
                      <input
                        type="number"
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-white"
                        placeholder="Ordem"
                        value={lessonFormData.order_index}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            order_index: e.target.value,
                          })
                        }
                      />
                      <input
                        type="number"
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-white"
                        placeholder="Minutos"
                        value={lessonFormData.duration_minutes}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            duration_minutes: e.target.value,
                          })
                        }
                      />
                    </div>

                    <textarea
                      className="min-h-28 w-full rounded-xl border border-white/10 bg-gray-900 p-3 text-white"
                      placeholder="Descricao da aula"
                      value={lessonFormData.description}
                      onChange={(e) =>
                        setLessonFormData({
                          ...lessonFormData,
                          description: e.target.value,
                        })
                      }
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <input
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-blue-300 text-xs"
                        placeholder="Link Meet"
                        value={lessonFormData.meet_link}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            meet_link: e.target.value,
                          })
                        }
                      />
                      <input
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-red-300 text-xs"
                        placeholder="Link video"
                        value={lessonFormData.video_url}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            video_url: e.target.value,
                          })
                        }
                      />
                      <input
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-xs text-white"
                        placeholder="Link PDF"
                        value={lessonFormData.pdf_url}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            pdf_url: e.target.value,
                          })
                        }
                      />
                      <input
                        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-xs text-white"
                        placeholder="Link slides"
                        value={lessonFormData.slides_url}
                        onChange={(e) =>
                          setLessonFormData({
                            ...lessonFormData,
                            slides_url: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-xl bg-brand-lavender py-3 font-black text-black"
                      >
                        SALVAR AULA
                      </button>
                      <button
                        type="button"
                        onClick={resetLessonForm}
                        className="rounded-xl bg-white/10 px-6 text-white"
                      >
                        X
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/20 font-black text-brand-lavender">
                            {lesson.order_index}
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-white">
                              {lesson.title}{" "}
                              <span className="text-[10px] font-normal italic text-white/40">
                                {lesson.duration_minutes
                                  ? `${lesson.duration_minutes} min`
                                  : "Duracao livre"}
                              </span>
                            </h4>
                            <p className="mt-1 line-clamp-2 text-xs text-white/40">
                              {lesson.description}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setIsEditingLesson(true);
                            setLessonFormData({
                              id: lesson.id,
                              title: lesson.title || "",
                              description: lesson.description || "",
                              order_index: lesson.order_index?.toString() || "",
                              duration_minutes:
                                lesson.duration_minutes?.toString() || "",
                              meet_link: lesson.meet_link || "",
                              video_url: lesson.video_url || "",
                              pdf_url: lesson.pdf_url || "",
                              slides_url: lesson.slides_url || "",
                            });
                          }}
                          className="rounded-xl bg-white/5 p-2 hover:bg-white/10"
                          type="button"
                        >
                          Editar
                        </button>
                      </div>

                      <div className="mt-4 flex gap-2 border-t border-white/5 pt-4">
                        {lesson.meet_link && (
                          <span className="rounded-lg bg-blue-500/20 px-2 py-1 text-[9px] font-black text-blue-400">
                            MEET
                          </span>
                        )}
                        {lesson.video_url && (
                          <span className="rounded-lg bg-red-500/20 px-2 py-1 text-[9px] font-black text-red-400">
                            VIDEO
                          </span>
                        )}
                        {lesson.pdf_url && (
                          <span className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[9px] font-black text-emerald-300">
                            PDF
                          </span>
                        )}
                        {lesson.slides_url && (
                          <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-[9px] font-black text-amber-300">
                            SLIDES
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {lessons.length === 0 && (
                    <EmptyState text="Este submodulo ainda nao tem aulas." />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState text="Selecione um submodulo para gerenciar as aulas." tall />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 py-20 text-center">
          <span className="mb-4 block text-4xl">Curso</span>
          <h3 className="text-xl font-bold italic text-white">
            Selecione um curso para comecar
          </h3>
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({
  title,
  buttonLabel,
  onClick,
  disabled = false,
}: {
  title: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center justify-between px-2">
    <h2 className="text-xs font-black uppercase text-white/50">{title}</h2>
    <button
      onClick={onClick}
      className="rounded-lg border border-brand-lavender/30 px-2 py-1 text-[10px] font-bold text-brand-lavender disabled:cursor-not-allowed disabled:opacity-40"
      type="button"
      disabled={disabled}
    >
      {buttonLabel}
    </button>
  </div>
);

const ItemForm = ({
  title,
  data,
  onChange,
  onSubmit,
  submitLabel,
}: {
  title: string;
  data: typeof emptyModuleForm;
  onChange: (value: typeof emptyModuleForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
}) => (
  <form
    onSubmit={onSubmit}
    className="space-y-3 rounded-3xl border border-brand-lavender/30 bg-white/5 p-5 animate-in slide-in-from-top-2"
  >
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {title}
    </p>
    <input
      className="w-full rounded-xl border border-white/10 bg-gray-900 p-3 text-sm text-white outline-none"
      placeholder="Titulo"
      value={data.title}
      onChange={(e) => onChange({ ...data, title: e.target.value })}
      required
    />
    <textarea
      className="min-h-24 w-full rounded-xl border border-white/10 bg-gray-900 p-3 text-sm text-white outline-none"
      placeholder="Descricao"
      value={data.description}
      onChange={(e) => onChange({ ...data, description: e.target.value })}
    />
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        step="0.1"
        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-sm text-white"
        placeholder="Ordem"
        value={data.order_index}
        onChange={(e) => onChange({ ...data, order_index: e.target.value })}
      />
      <input
        type="number"
        className="rounded-xl border border-white/10 bg-gray-900 p-3 text-sm text-white"
        placeholder="Minutos"
        value={data.duration_minutes}
        onChange={(e) => onChange({ ...data, duration_minutes: e.target.value })}
      />
    </div>
    <button className="w-full rounded-xl bg-brand-purple py-3 text-xs font-black uppercase tracking-widest text-white">
      {submitLabel}
    </button>
  </form>
);

const EmptyState = ({
  text,
  tall = false,
}: {
  text: string;
  tall?: boolean;
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/5 bg-white/5 px-6 text-center italic text-white/45 ${
      tall ? "h-64" : "py-10"
    }`}
  >
    {text}
  </div>
);
