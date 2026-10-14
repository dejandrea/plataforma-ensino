import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { EvaluationForm } from "../components/EvaluationForm";
import { EvaluationDetails } from "../components/EvaluationDetails";
import { fetchStudentModules } from "../lib/studentCourses";
import { evaluationTitle, formatEvaluationMonth, getEvaluationScope } from "../lib/evaluationPeriods";

export const AdminEvaluations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [studentEvaluations, setStudentEvaluations] = useState<any[]>([]);
  const [viewedEvaluation, setViewedEvaluation] = useState<any | null>(null);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [moduleState, setModuleState] = useState({ studentId: "", loading: false, error: "" });
  const [selectedStudent, setSelectedStudent] = useState(
    searchParams.get("studentId") || "",
  );
  const [selectedModule, setSelectedModule] = useState("");
  const [evaluationMode, setEvaluationMode] = useState<"mentoring" | "course">("mentoring");
  const studentScope = getEvaluationScope(students.find((student) => student.id === selectedStudent));
  const isMonthly = studentScope === "mentoring" || (studentScope === "both" && evaluationMode === "mentoring");

  useEffect(() => {
    const fetchData = async () => {
      const { data: studentData, error: studentError } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student");

      if (studentError) {
        console.error("Erro ao buscar alunos:", studentError.message);
      } else {
        setStudents(studentData || []);
      }

    };

    fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setModules([]);
    setSelectedModule("");
    setModuleState({ studentId: selectedStudent, loading: Boolean(selectedStudent), error: "" });
    if (selectedStudent) {
      const fetchOptions = async () => {
        if (!isMonthly) return fetchStudentModules(selectedStudent);
        const { data, error } = await supabase.rpc("pending_mentoring_evaluation_months", { p_student_id: selectedStudent });
        if (error) throw error;
        return (data || []).map((item: { reference_month: string }) => ({ id: item.reference_month, title: formatEvaluationMonth(item.reference_month) }));
      };
      fetchOptions().then((data) => {
        if (cancelled) return;
        setModules(data);
        setModuleState({ studentId: selectedStudent, loading: false, error: "" });
      }).catch(() => {
        if (!cancelled) setModuleState({ studentId: selectedStudent, loading: false, error: "Não foi possível carregar as opções de avaliação do aluno." });
      });
    }
    return () => { cancelled = true; };
  }, [selectedStudent, isMonthly]);

  useEffect(() => {
    let cancelled = false;
    async function fetchStudentEvaluations() {
      setViewedEvaluation(null);
      if (!selectedStudent) {
        setStudentEvaluations([]);
        return;
      }

      setLoadingEvaluations(true);
      setStudentEvaluations([]);

      const { data, error } = await supabase
        .from("module_evaluations")
        .select(
          `
            *,
            modules ( id, title )
          `,
        )
        .eq("student_id", selectedStudent)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Erro ao buscar boletins do aluno:", error.message);
        setStudentEvaluations([]);
      } else {
        setStudentEvaluations(data || []);
      }

      setLoadingEvaluations(false);
    }

    fetchStudentEvaluations();
    return () => { cancelled = true; };
  }, [selectedStudent]);

  const returnTo =
    typeof location.state?.from === "string"
      ? location.state.from
      : "/dashboard-professor";

  const evaluatedModuleIds = new Set(
    studentEvaluations.map((evaluation) => evaluation.module_id),
  );

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Painel de avaliacao
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Escolha o aluno e o período da mentoria ou o módulo do curso para avaliar.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          <aside className="rounded-3xl bg-surface p-6 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Boletins do aluno
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Resumo das avaliacoes
                </h2>
              </div>
              <div className="rounded-2xl bg-surface px-3 py-2 text-sm font-bold text-white ring-1 ring-white/10">
                {studentEvaluations.length}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {!selectedStudent ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Escolha um aluno para ver os boletins ja registrados.
                </div>
              ) : loadingEvaluations ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Carregando boletins...
                </div>
              ) : studentEvaluations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Este aluno ainda nao possui boletins cadastrados.
                </div>
              ) : (
                studentEvaluations.slice(0, 3).map((evaluation) => (
                  <button
                    type="button"
                    onClick={() => setViewedEvaluation((current: any) => current?.id === evaluation.id ? null : evaluation)}
                    aria-expanded={viewedEvaluation?.id === evaluation.id}
                    aria-controls="evaluation-details"
                    key={evaluation.id}
                    className={`flex h-full w-full flex-col rounded-2xl p-5 text-left ring-1 transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavender ${
                      viewedEvaluation?.id === evaluation.id
                        ? "bg-brand-lavender/15 ring-brand-lavender/30"
                        : "bg-surface ring-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {evaluationTitle(evaluation)}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          {new Date(evaluation.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 ring-1 ring-white/10">
                        Avaliado
                      </span>
                    </div>

                    <p className="mt-3 flex-1 break-words text-sm leading-6 text-white/65">
                      {evaluation.teacher_comment
                        ? evaluation.teacher_comment.length > 120
                          ? `${evaluation.teacher_comment.slice(0, 120)}...`
                          : evaluation.teacher_comment
                        : "Sem comentario registrado."}
                    </p>
                    <span className="mt-3 inline-block text-xs font-semibold text-brand-lavender">
                      {viewedEvaluation?.id === evaluation.id ? "Fechar avaliação" : "Ver avaliação completa"}
                    </span>
                  </button>
                ))
              )}
            </div>
            {viewedEvaluation && (
              <div id="evaluation-details" className="mt-6 border-t border-white/10 pt-6">
                <EvaluationDetails evaluation={viewedEvaluation} />
              </div>
            )}
          </aside>
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 rounded-3xl bg-surface p-6 ring-1 ring-white/10 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Selecionar aluno
                </label>
                <select
                  className="mt-2 block w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  onChange={(e) => { setSelectedModule(""); setSelectedStudent(e.target.value); }}
                  value={selectedStudent}
                >
                  <option value="">Escolha um aluno...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name || "Sem nome"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                {studentScope === "both" && selectedStudent && (
                  <div className="mb-4">
                    <label htmlFor="evaluation-mode" className="block text-sm font-medium text-white/70">Tipo de avaliação</label>
                    <select id="evaluation-mode" value={evaluationMode} onChange={(event) => { setSelectedModule(""); setEvaluationMode(event.target.value as "mentoring" | "course"); }} className="mt-2 w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10">
                      <option value="mentoring">Mentoria mensal</option>
                      <option value="course">Curso por módulo</option>
                    </select>
                  </div>
                )}
                <label className="block text-sm font-medium text-white/70">
                  {isMonthly ? "Mês de referência" : "Selecionar módulo"}
                </label>
                <select
                  className="mt-2 block w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  onChange={(e) => setSelectedModule(e.target.value)}
                  value={selectedModule}
                  disabled={!selectedStudent || loadingEvaluations || moduleState.loading || moduleState.studentId !== selectedStudent}
                >
                  <option value="">{isMonthly ? "Escolha um mês pendente..." : "Escolha o módulo..."}</option>
                  {(moduleState.studentId === selectedStudent ? modules : []).map((module) => (
                    <option key={module.id} value={module.id}>
                      {isMonthly ? module.title : `${module.course_title} - ${module.title}`}
                      {!isMonthly && evaluatedModuleIds.has(module.id) ? " - ja avaliado" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-white/60" role="status">
                  {moduleState.error || (moduleState.loading ? "Carregando avaliações disponíveis..." : isMonthly ? (selectedStudent && modules.length === 0 ? "Nenhum mês pendente. O mês atual será liberado no dia 1º do próximo mês." : "Todo dia 1º, o mês anterior é liberado. Meses sem feedback desde o ingresso continuam disponíveis.") : selectedStudent && modules.length === 0 ? "Este aluno ainda não concluiu nenhuma matéria. A avaliação será liberada após a conclusão." : "Somente módulos de matérias que o aluno já concluiu.")}
                </p>
              </div>
            </div>

            <div>
              {selectedStudent && selectedModule && moduleState.studentId === selectedStudent && modules.some((module) => module.id === selectedModule) ? (
                <EvaluationForm
                  key={`${selectedStudent}:${isMonthly}:${selectedModule}`}
                  studentId={selectedStudent}
                  moduleId={isMonthly ? undefined : selectedModule}
                  referenceMonth={isMonthly ? selectedModule : undefined}
                  onSaved={() => navigate(returnTo)}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-surface p-10 text-center text-white/45">
                  Selecione um aluno e {isMonthly ? "um mês pendente" : "um módulo"} para iniciar a avaliação.
                </div>
              )}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};
