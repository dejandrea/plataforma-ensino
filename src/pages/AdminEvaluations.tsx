import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { EvaluationForm } from "../components/EvaluationForm";

export const AdminEvaluations = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedModule, setSelectedModule] = useState("");

  useEffect(() => {
    // Busca alunos e módulos para preencher os campos de seleção
    const fetchData = async () => {
      console.log("Iniciando busca de alunos...");

      const { data: st, error: errSt } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student"); // Verifique se no banco está 'student' minúsculo mesmo

      if (errSt) {
        console.error("Erro ao buscar alunos:", errSt.message);
      } else {
        console.log("Alunos encontrados:", st);
        if (st) setStudents(st);
      }

      const { data: md, error: errMd } = await supabase
        .from("modules")
        .select("*")
        .order("order_index");

      if (errMd) {
        console.error("Erro ao buscar módulos:", errMd.message);
      } else if (md) {
        setModules(md);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Painel da Professora 👩‍🏫
        </h1>

        <div className="bg-white p-6 rounded-xl shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Selecionar Aluno
            </label>
            <select
              className="mt-1 block w-full p-2 border rounded-md"
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">Escolha um aluno...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || "Sem Nome"}{" "}
                  {/* Se o full_name estiver nulo, aparece 'Sem Nome' */}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Selecionar Módulo
            </label>
            <select
              className="mt-1 block w-full p-2 border rounded-md"
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              <option value="">Escolha o módulo...</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Só mostra o formulário se aluno e módulo forem selecionados */}
        {selectedStudent && selectedModule ? (
          <EvaluationForm
            studentId={selectedStudent}
            moduleId={selectedModule}
          />
        ) : (
          <div className="text-center p-10 border-2 border-dashed rounded-xl text-gray-400">
            Selecione um aluno e um módulo para iniciar a avaliação.
          </div>
        )}
      </div>
    </div>
  );
};
