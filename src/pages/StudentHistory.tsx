import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { downloadLessonReportPdf } from "../lib/lessonReportPdf";

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Nao registrado";

const formatMonthLabel = (value: string) =>
  new Date(`${value}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const getLessonHours = (lesson: { starts_at: string; ends_at: string }) =>
  (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 3_600_000;

export const StudentHistory = () => {
  const { studentId } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [completedLessons, setCompletedLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [studentId]);

  async function fetchData() {
    setLoading(true);

    const [
      { data: profile },
      { data: evaluationData, error },
      { data: completedLessonData, error: completedLessonsError },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", studentId).single(),
      supabase
        .from("module_evaluations")
        .select(
          `
            *,
            modules ( title )
          `,
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("scheduled_lessons")
        .select(
          "id, title, session_track, starts_at, ends_at, started_at, student_joined_at, teacher_joined_at, completed_at, completed_by, status",
        )
        .eq("student_id", studentId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false }),
    ]);

    if (error) {
      console.error("Erro ao buscar historico:", error);
    }
    if (completedLessonsError) {
      console.error("Erro ao buscar aulas concluidas:", completedLessonsError);
    }

    setStudent(profile);
    setEvaluations(evaluationData || []);
    setCompletedLessons(completedLessonData || []);
    setLoading(false);
  }

  const monthlyCompletedReports = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        label: string;
        lessons: any[];
        totalHours: number;
      }
    >();

    for (const lesson of completedLessons) {
      const referenceDate = lesson.completed_at || lesson.starts_at;
      const date = new Date(referenceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, {
          key: monthKey,
          label: formatMonthLabel(monthKey),
          lessons: [],
          totalHours: 0,
        });
      }

      const group = grouped.get(monthKey);
      group?.lessons.push(lesson);
      if (group) {
        group.totalHours += getLessonHours(lesson);
      }
    }

    return Array.from(grouped.values());
  }, [completedLessons]);

  const buildMonthlySummaryText = (report: {
    label: string;
    lessons: any[];
    totalHours: number;
  }) => {
    const hourlyRate =
      typeof student?.hourly_rate === "number" ? student.hourly_rate : null;
    const totalAmount = hourlyRate != null ? report.totalHours * hourlyRate : 0;
    const header = [
      `Relatorio de aulas realizadas - ${student?.full_name || "Aluno"}`,
      `Periodo: ${report.label}`,
      `Total de aulas concluidas: ${report.lessons.length}`,
      `Carga horaria total: ${report.totalHours.toFixed(1)}h`,
      `Valor hora/aula: ${
        hourlyRate != null ? formatCurrency(hourlyRate) : "Nao definido"
      }`,
      `Total: ${formatCurrency(totalAmount)}`,
      "",
    ];

    const lessonLines = report.lessons.flatMap((lesson, index) => [
      `${index + 1}. ${formatDateTime(lesson.starts_at)} - ${lesson.title}`,
      "",
    ]);

    return [...header, ...lessonLines].join("\n").trim();
  };

  const copyMonthlySummary = async (report: {
    label: string;
    lessons: any[];
    totalHours: number;
  }) => {
    try {
      await navigator.clipboard.writeText(buildMonthlySummaryText(report));
      alert("Resumo mensal copiado para envio aos responsaveis.");
    } catch (error) {
      console.error("Falha ao copiar resumo mensal:", error);
      alert("Nao foi possivel copiar o resumo mensal.");
    }
  };

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
        <header className="mb-8 flex items-center gap-6 rounded-3xl bg-white/5 p-8 shadow-soft ring-1 ring-white/10">
          <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink text-4xl font-bold text-white shadow-soft ring-1 ring-white/10">
            {student?.full_name?.charAt(0) || "A"}
          </div>
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{student?.full_name}</h1>
              <p className="font-medium text-white/55">Historico de aprendizagem</p>
              <div className="mt-2 inline-block rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-lavender ring-1 ring-white/10">
                {evaluations.length} modulos concluidos
              </div>
            </div>

            <Link
              to="/relatorios?tab=student_lessons"
              className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
            >
              Voltar para relatorios &gt; aulas
            </Link>
          </div>
        </header>

        <div className="space-y-6">
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Aulas realizadas
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Resumo mensal para os responsaveis
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              Cada aula concluida pela professora entra aqui com o horario previsto,
              inicio registrado na sala interna e o fechamento oficial da sessao.
            </p>

            <div className="mt-6 space-y-4">
              {monthlyCompletedReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Ainda nao ha aulas concluidas registradas para este aluno.
                </div>
              ) : (
                monthlyCompletedReports.map((report) => (
                  <div
                    key={report.key}
                    className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-lavender">
                          {report.label}
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-white">
                          {report.lessons.length} aula(s) concluidas
                        </h3>
                        <p className="mt-2 text-sm text-white/55">
                          Use o botao ao lado para copiar um resumo pronto e enviar aos
                          responsaveis no fechamento do mes.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => void copyMonthlySummary(report)}
                          className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                        >
                          Copiar resumo do mes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadLessonReportPdf({
                              studentName: student?.full_name || "aluno",
                              periodLabel: report.label,
                              hourlyRate:
                                typeof student?.hourly_rate === "number"
                                  ? student.hourly_rate
                                  : null,
                              totalLessons: report.lessons.length,
                              totalHours: report.totalHours,
                              totalAmount:
                                typeof student?.hourly_rate === "number"
                                  ? report.totalHours * student.hourly_rate
                                  : 0,
                              lessons: report.lessons,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
                        >
                          Baixar PDF
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <ReportStat
                        label="Aulas no periodo"
                        value={String(report.lessons.length)}
                      />
                      <ReportStat
                        label="Carga horaria"
                        value={`${report.totalHours.toFixed(1)}h`}
                      />
                      <ReportStat
                        label="Hora/aula"
                        value={
                          typeof student?.hourly_rate === "number"
                            ? formatCurrency(student.hourly_rate)
                            : "Nao definido"
                        }
                      />
                      <ReportStat
                        label="Total"
                        value={
                          typeof student?.hourly_rate === "number"
                            ? formatCurrency(report.totalHours * student.hourly_rate)
                            : "A definir"
                        }
                      />
                    </div>

                    <div className="mt-5 space-y-3">
                      {report.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="rounded-2xl bg-brand-900/35 p-4 ring-1 ring-white/10"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
                              {lesson.session_track === "course"
                                ? "Curso completo"
                                : "Mentoria"}
                            </span>
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
                              Concluida
                            </span>
                          </div>

                          <h4 className="mt-3 text-lg font-bold text-white">
                            {formatDateTime(lesson.starts_at)}
                          </h4>
                          <p className="mt-2 text-sm text-white/65">{lesson.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

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

const ReportStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl bg-brand-900/35 p-4 text-center ring-1 ring-white/10">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-sm font-bold text-white">{value}</p>
  </div>
);
