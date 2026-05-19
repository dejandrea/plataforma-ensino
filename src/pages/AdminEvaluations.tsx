import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { EvaluationForm } from "../components/EvaluationForm";
import { BackLink } from "../components/BackLink";

export const AdminEvaluations = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
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

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <BackLink to="/dashboard-professor" label="Voltar para meus alunos" />

        <div className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Painel de avaliacao
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Escolha o aluno e o modulo antes de registrar a avaliacao.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 md:grid-cols-2">
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
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8">
          {selectedStudent && selectedModule ? (
            <EvaluationForm
              studentId={selectedStudent}
              moduleId={selectedModule}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/45">
              Selecione um aluno e um modulo para iniciar a avaliacao.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
