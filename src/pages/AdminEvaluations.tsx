import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { EvaluationForm } from "../components/EvaluationForm";

export const AdminEvaluations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [studentEvaluations, setStudentEvaluations] = useState<any[]>([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(
    searchParams.get("studentId") || "",
  );
  const [selectedModule, setSelectedModule] = useState("");

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

      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .select("*")
        .order("order_index");

      if (moduleError) {
        console.error("Erro ao buscar modulos:", moduleError.message);
      } else {
        setModules(moduleData || []);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    async function fetchStudentEvaluations() {
      if (!selectedStudent) {
        setStudentEvaluations([]);
        return;
      }

      setLoadingEvaluations(true);

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

      if (error) {
        console.error("Erro ao buscar boletins do aluno:", error.message);
        setStudentEvaluations([]);
      } else {
        setStudentEvaluations(data || []);
      }

      setLoadingEvaluations(false);
    }

    fetchStudentEvaluations();
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
        <div className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Painel de avaliacao
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Escolha o aluno e o modulo antes de registrar a avaliacao.
          </p>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-white/70">
                  Selecionar aluno
                </label>
                <select
                  className="mt-2 block w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  onChange={(e) => setSelectedStudent(e.target.value)}
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
                <label className="block text-sm font-medium text-white/70">
                  Selecionar modulo
                </label>
                <select
                  className="mt-2 block w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  onChange={(e) => setSelectedModule(e.target.value)}
                  value={selectedModule}
                >
                  <option value="">Escolha o modulo...</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                      {evaluatedModuleIds.has(module.id) ? " - ja avaliado" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              {selectedStudent && selectedModule ? (
                <EvaluationForm
                  studentId={selectedStudent}
                  moduleId={selectedModule}
                  onSaved={() => navigate(returnTo)}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/45">
                  Selecione um aluno e um modulo para iniciar a avaliacao.
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Boletins do aluno
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Resumo das avaliacoes
                </h2>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/10">
                {studentEvaluations.length}
              </div>
            </div>

            <div className="mt-6 space-y-4">
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
                studentEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className={`rounded-2xl p-4 ring-1 ${
                      evaluation.module_id === selectedModule
                        ? "bg-brand-lavender/15 ring-brand-lavender/30"
                        : "bg-white/5 ring-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {evaluation.modules?.title || "Modulo"}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          {new Date(evaluation.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 ring-1 ring-white/10">
                        Avaliado
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {evaluation.teacher_comment
                        ? evaluation.teacher_comment.length > 120
                          ? `${evaluation.teacher_comment.slice(0, 120)}...`
                          : evaluation.teacher_comment
                        : "Sem comentario registrado."}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
