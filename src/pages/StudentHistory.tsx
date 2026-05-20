import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { BackLink } from "../components/BackLink";

export const StudentHistory = () => {
  const { studentId } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [studentId]);

  async function fetchData() {
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", studentId)
      .single();

    const { data: evaluationData, error } = await supabase
      .from("module_evaluations")
      .select(
        `
          *,
          modules ( title )
        `,
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar historico:", error);
    }

    setStudent(profile);
    setEvaluations(evaluationData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando jornada do aluno...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-4xl p-6">
        <BackLink to="/dashboard-professor" label="Voltar para meus alunos" />

        <header className="mb-8 flex items-center gap-6 rounded-3xl bg-white/5 p-8 shadow-soft ring-1 ring-white/10">
          <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink text-4xl font-bold text-white shadow-soft ring-1 ring-white/10">
            {student?.full_name?.charAt(0) || "A"}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{student?.full_name}</h1>
            <p className="font-medium text-white/55">Historico de aprendizagem</p>
            <div className="mt-2 inline-block rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-lavender ring-1 ring-white/10">
              {evaluations.length} modulos concluidos
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {evaluations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center">
              <p className="text-white/45">
                Nenhuma avaliacao encontrada para este aluno.
              </p>
              <Link
                to="/admin/avaliar"
                state={{ from: `/historico/${studentId}` }}
                className="mt-4 inline-block font-bold text-brand-lavender"
              >
                Avaliar agora &gt;
              </Link>
            </div>
          ) : (
            evaluations.map((item) => (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
              >
                <div className="absolute bottom-0 left-0 top-0 w-2 bg-gradient-to-b from-brand-purple to-brand-pink" />

                <div className="mb-4 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {item.modules?.title}
                    </h3>
                    <p className="text-sm text-white/40">
                      Realizado em{" "}
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { label: "Logica", val: item.score_logic },
                    { label: "Criatividade", val: item.score_creativity },
                    { label: "Autonomia", val: item.score_autonomy },
                    { label: "Comunicacao", val: item.score_communication },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl bg-white/5 p-3 text-center ring-1 ring-white/10"
                    >
                      <p className="mb-1 text-[10px] font-bold uppercase text-white/35">
                        {stat.label}
                      </p>
                      <p className="text-sm text-brand-ice">
                        {"*".repeat(Number(stat.val || 0))}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-brand-lavender/10 p-4 ring-1 ring-brand-lavender/20">
                  <p className="text-sm leading-relaxed text-brand-ice">
                    <span className="font-bold">Comentario da professora:</span>
                    <br />
                    "{item.teacher_comment}"
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
