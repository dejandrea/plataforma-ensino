import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { supabase } from "../lib/supabaseClient";

const formatSessionRange = (startsAt: string, endsAt: string) => {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  const day = startDate.toLocaleDateString("pt-BR");
  const startTime = startDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = endDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${day} de ${startTime} ate ${endTime}`;
};

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Nao registrado";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatShortDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Nao registrado";

const getLessonHours = (lesson: { starts_at: string; ends_at: string }) =>
  (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 3_600_000;

const reportSelectClassName =
  "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-brand-pink/50";

const reportSelectStyle = {
  backgroundColor: "#241d33",
  color: "#ffffff",
};

export const TeacherReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("professor");
  const [activeTab, setActiveTab] = useState<
    "history" | "student_lessons" | "financial" | "attendance"
  >(() => {
    const tab = searchParams.get("tab");
    return tab === "student_lessons" || tab === "financial" || tab === "attendance"
      ? tab
      : "history";
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [accessCounts, setAccessCounts] = useState<Record<string, number>>({});
  const [selectedStudentId, setSelectedStudentId] = useState("all");
  const [selectedTeacherId, setSelectedTeacherId] = useState("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "all" | "completed" | "cancelled"
  >("all");

  useEffect(() => {
    void fetchReportData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const normalizedTab =
      tab === "student_lessons" || tab === "financial" || tab === "attendance"
        ? tab
        : "history";

    setActiveTab(normalizedTab);
  }, [searchParams]);

  const fetchReportData = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const currentRole = profile?.role || "professor";
    setUserRole(currentRole);

    const baseLessonsQuery = supabase
      .from("scheduled_lessons")
      .select("*")
      .in("status", ["completed", "cancelled"])
      .order("starts_at", { ascending: false });

    const [
      { data: lessonsData, error: lessonsError },
      { data: linkedStudents },
      { data: linkedTeachers },
    ] = await Promise.all([
      currentRole === "admin" ? baseLessonsQuery : baseLessonsQuery.eq("teacher_id", user.id),
      currentRole === "admin"
        ? supabase
            .from("profiles")
            .select("id, full_name, hourly_rate, avatar_url, avatar_mode, avatar_preset")
            .eq("role", "student")
            .order("full_name")
        : supabase
            .from("teacher_student_relations")
            .select(
              `
                student:profiles!student_id (
                  id,
                  full_name,
                  hourly_rate,
                  avatar_url,
                  avatar_mode,
                  avatar_preset
                )
              `,
            )
            .eq("teacher_id", user.id),
      currentRole === "admin"
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .in("role", ["professor", "admin"])
            .order("full_name")
        : supabase.from("profiles").select("id, full_name").eq("id", user.id),
    ]);

    if (lessonsError) {
      console.error("Erro ao buscar historico de aulas:", lessonsError.message);
      setSessions([]);
      setStudents([]);
      setTeacherNames({});
      setAccessCounts({});
      setLoading(false);
      return;
    }

    const lessonRows = lessonsData || [];
    setSessions(lessonRows);

    const studentRows = Array.isArray(linkedStudents)
      ? linkedStudents
          .map((item: any) => item.student || item)
          .filter(Boolean)
      : [];
    setStudents(studentRows);

    const nextTeacherNames = Array.isArray(linkedTeachers)
      ? Object.fromEntries(
          linkedTeachers
            .filter((teacher: any) => teacher?.id)
            .map((teacher: any) => [teacher.id, teacher.full_name || "Professora"]),
        )
      : {};
    setTeacherNames(nextTeacherNames);

    if (lessonRows.length > 0) {
      const lessonIds = lessonRows.map((lesson) => lesson.id);
      const { data: logs, error: logsError } = await supabase
        .from("lesson_access_logs")
        .select("scheduled_lesson_id")
        .in("scheduled_lesson_id", lessonIds);

      if (logsError) {
        console.error("Erro ao buscar acessos do historico:", logsError.message);
        setAccessCounts({});
      } else {
        const groupedCounts = (logs || []).reduce(
          (acc: Record<string, number>, log: { scheduled_lesson_id: string }) => {
            acc[log.scheduled_lesson_id] = (acc[log.scheduled_lesson_id] || 0) + 1;
            return acc;
          },
          {},
        );
        setAccessCounts(groupedCounts);
      }
    } else {
      setAccessCounts({});
    }

    setLoading(false);
  };

  const studentNameMap = useMemo(
    () =>
      Object.fromEntries(
        students.map((student) => [student.id, student.full_name || "Aluno"]),
      ),
    [students],
  );

  const teacherOptions = useMemo(
    () =>
      Object.entries(teacherNames)
        .map(([id, fullName]) => ({ id, fullName }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")),
    [teacherNames],
  );

  const studentOptions = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.full_name || "Aluno").localeCompare(b.full_name || "Aluno", "pt-BR"),
      ),
    [students],
  );

  const filteredSessions = useMemo(() => {
    const startBoundary = periodStart ? new Date(`${periodStart}T00:00:00`).getTime() : null;
    const endBoundary = periodEnd ? new Date(`${periodEnd}T23:59:59.999`).getTime() : null;

    return sessions.filter((session) => {
      if (selectedStudentId !== "all" && session.student_id !== selectedStudentId) {
        return false;
      }

      if (selectedTeacherId !== "all" && session.teacher_id !== selectedTeacherId) {
        return false;
      }

      const sessionStart = new Date(session.starts_at).getTime();

      if (startBoundary != null && sessionStart < startBoundary) {
        return false;
      }

      if (endBoundary != null && sessionStart > endBoundary) {
        return false;
      }

      return true;
    });
  }, [periodEnd, periodStart, selectedStudentId, selectedTeacherId, sessions]);

  const completedSessions = filteredSessions.filter((session) => session.status === "completed");
  const cancelledSessions = filteredSessions.filter((session) => session.status === "cancelled");

  const financialStudents = useMemo(() => {
    const relevantStudentIds = new Set(
      completedSessions
        .map((session) => session.student_id)
        .filter((studentId): studentId is string => Boolean(studentId)),
    );

    return students.filter((student) => relevantStudentIds.has(student.id));
  }, [completedSessions, students]);

  const studentSummaries = useMemo(() => {
    return financialStudents.map((student) => {
      const studentCompletedSessions = completedSessions.filter(
        (session) => session.student_id === student.id,
      );
      const totalHours = studentCompletedSessions.reduce(
        (sum, session) => sum + getLessonHours(session),
        0,
      );
      const hourlyRate =
        typeof student.hourly_rate === "number" ? student.hourly_rate : Number(student.hourly_rate);
      const normalizedHourlyRate = Number.isFinite(hourlyRate) ? hourlyRate : null;
      const totalAmount = normalizedHourlyRate != null ? totalHours * normalizedHourlyRate : 0;

      return {
        student,
        completedSessions: studentCompletedSessions,
        totalLessons: studentCompletedSessions.length,
        totalHours,
        hourlyRate: normalizedHourlyRate,
        totalAmount,
        lastCompletedSession: studentCompletedSessions[0] || null,
      };
    });
  }, [completedSessions, financialStudents]);

  const lessonStudentSummaries = useMemo(() => {
    return students
      .map((student) => {
        const lessons = completedSessions.filter((session) => session.student_id === student.id);

        return {
          student,
          lessons,
          totalCompleted: lessons.length,
          completedInPeriod: lessons.length,
          lastCompletedLesson: lessons[0] || null,
        };
      })
      .filter((item) => item.totalCompleted > 0)
      .sort((a, b) => b.totalCompleted - a.totalCompleted);
  }, [completedSessions, students]);

  const attendanceSummary = useMemo(
    () =>
      completedSessions.map((session) => ({
        session,
        studentName: session.student_id
          ? studentNameMap[session.student_id] || "Aluno"
          : "Aluno nao vinculado",
        studentEntered: Boolean(session.student_joined_at),
        teacherEntered: Boolean(session.teacher_joined_at),
        started: Boolean(session.started_at),
      })),
    [completedSessions, studentNameMap],
  );

  const currentStatCards = useMemo(() => {
    if (activeTab === "student_lessons") {
      const averagePerStudent =
        lessonStudentSummaries.length > 0
          ? (completedSessions.length / lessonStudentSummaries.length).toFixed(1)
          : "0.0";

      return [
        { label: "Alunos com aulas", value: lessonStudentSummaries.length },
        { label: "Aulas concluidas", value: completedSessions.length },
        { label: "Media por aluno", value: averagePerStudent },
      ];
    }

    if (activeTab === "financial") {
      const totalHours = studentSummaries.reduce((sum, item) => sum + item.totalHours, 0);
      const totalAmount = studentSummaries.reduce((sum, item) => sum + item.totalAmount, 0);

      return [
        { label: "Alunos faturados", value: studentSummaries.length },
        { label: "Horas concluidas", value: `${totalHours.toFixed(1)}h` },
        { label: "Total previsto", value: formatCurrency(totalAmount) },
      ];
    }

    if (activeTab === "attendance") {
      const startedCount = attendanceSummary.filter((item) => item.started).length;
      const fullPresenceCount = attendanceSummary.filter(
        (item) => item.studentEntered && item.teacherEntered,
      ).length;

      return [
        { label: "Aulas concluidas", value: attendanceSummary.length },
        { label: "Inicios registrados", value: startedCount },
        { label: "Entradas completas", value: fullPresenceCount },
      ];
    }

    const visibleHistoryCount =
      historyStatusFilter === "completed"
        ? completedSessions.length
        : historyStatusFilter === "cancelled"
          ? cancelledSessions.length
          : filteredSessions.length;

    return [
      { label: "Registros exibidos", value: visibleHistoryCount },
      { label: "Concluidas", value: completedSessions.length },
      { label: "Canceladas", value: cancelledSessions.length },
    ];
  }, [
    activeTab,
    attendanceSummary,
    cancelledSessions.length,
    completedSessions.length,
    filteredSessions.length,
    historyStatusFilter,
    lessonStudentSummaries,
    studentSummaries,
  ]);

  const resetFilters = () => {
    setSelectedStudentId("all");
    setSelectedTeacherId("all");
    setPeriodStart("");
    setPeriodEnd("");
    setHistoryStatusFilter("all");
  };

  const handleTabChange = (nextTab: "history" | "student_lessons" | "financial" | "attendance") => {
    setActiveTab(nextTab);
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set("tab", nextTab);
      return nextParams;
    });
  };

  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando relatorios...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Relatorios
            </h1>
          </div>

          <div className="relative mt-6">
            <div className="inline-flex rounded-[1.6rem] bg-brand-900/70 p-1.5 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => handleTabChange("history")}
                className={`rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                  activeTab === "history"
                    ? "bg-white text-brand-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Historico
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("student_lessons")}
                className={`rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                  activeTab === "student_lessons"
                    ? "bg-white text-brand-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Aulas
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("financial")}
                className={`rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                  activeTab === "financial"
                    ? "bg-white text-brand-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Financeiro
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("attendance")}
                className={`rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                  activeTab === "attendance"
                    ? "bg-white text-brand-900"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Presenca
              </button>
            </div>
          </div>

          <div className="relative mt-6 rounded-[1.8rem] bg-brand-900/35 p-4 ring-1 ring-white/10">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Filtros
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="grid min-w-[14rem] flex-1 gap-2 text-sm text-white/70">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                    Aluno
                  </span>
                  <select
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    className={reportSelectClassName}
                    style={reportSelectStyle}
                  >
                    <option value="all" style={reportSelectStyle}>
                      Todos os alunos
                    </option>
                    {studentOptions.map((student) => (
                      <option key={student.id} value={student.id} style={reportSelectStyle}>
                        {student.full_name || "Aluno"}
                      </option>
                    ))}
                  </select>
                </label>

                {userRole === "admin" && (
                  <label className="grid min-w-[14rem] flex-1 gap-2 text-sm text-white/70">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Professora
                    </span>
                    <select
                      value={selectedTeacherId}
                      onChange={(event) => setSelectedTeacherId(event.target.value)}
                      className={reportSelectClassName}
                      style={reportSelectStyle}
                    >
                      <option value="all" style={reportSelectStyle}>
                        Toda a equipe
                      </option>
                      {teacherOptions.map((teacher) => (
                        <option key={teacher.id} value={teacher.id} style={reportSelectStyle}>
                          {teacher.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="grid min-w-[12rem] flex-1 gap-2 text-sm text-white/70">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                    Inicio
                  </span>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(event) => setPeriodStart(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-brand-pink/50"
                  />
                </label>

                <label className="grid min-w-[12rem] flex-1 gap-2 text-sm text-white/70">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                    Fim
                  </span>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-brand-pink/50"
                  />
                </label>

                {activeTab === "history" && (
                  <label className="grid min-w-[16rem] flex-[1.2] gap-2 text-sm text-white/70">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Status do historico
                    </span>
                    <select
                      value={historyStatusFilter}
                      onChange={(event) =>
                        setHistoryStatusFilter(
                          event.target.value as "all" | "completed" | "cancelled",
                        )
                      }
                      className={reportSelectClassName}
                      style={reportSelectStyle}
                    >
                      <option value="all" style={reportSelectStyle}>
                        Concluidas e canceladas
                      </option>
                      <option value="completed" style={reportSelectStyle}>
                        Apenas concluidas
                      </option>
                      <option value="cancelled" style={reportSelectStyle}>
                        Apenas canceladas
                      </option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {currentStatCards.map((card) => (
            <ReportStat key={card.label} label={card.label} value={card.value} />
          ))}
        </section>

        {activeTab === "history" && (
          <div
            className={`mt-8 grid gap-8 ${
              historyStatusFilter === "all" ? "xl:grid-cols-2" : "xl:grid-cols-1"
            }`}
          >
            {historyStatusFilter !== "cancelled" && (
              <HistoryColumn
                eyebrow="Historico"
                title="Aulas concluidas"
                sessions={completedSessions}
                studentNameMap={studentNameMap}
                accessCounts={accessCounts}
                teacherNames={teacherNames}
                showTeacher={userRole === "admin"}
              />
            )}
            {historyStatusFilter !== "completed" && (
              <HistoryColumn
                eyebrow="Historico"
                title="Aulas canceladas"
                sessions={cancelledSessions}
                studentNameMap={studentNameMap}
                accessCounts={accessCounts}
                teacherNames={teacherNames}
                showTeacher={userRole === "admin"}
              />
            )}
          </div>
        )}

        {activeTab === "student_lessons" && (
          <section className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Aulas por aluno
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Acompanhamento das aulas realizadas
            </h2>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {lessonStudentSummaries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Nenhuma aula concluida foi encontrada com os filtros atuais.
                </div>
              ) : (
                lessonStudentSummaries.map((item) => (
                  <article
                    key={item.student.id}
                    className="rounded-[2.2rem] bg-brand-900/35 p-6 ring-1 ring-white/10"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-4">
                          <ProfileAvatar
                            fullName={item.student.full_name}
                            avatarMode={item.student.avatar_mode}
                            avatarUrl={item.student.avatar_url}
                            avatarPreset={item.student.avatar_preset}
                            size="lg"
                          />

                          <div className="min-w-0">
                            <h3
                              className="truncate text-[1.85rem] font-extrabold tracking-tight text-white"
                              title={item.student.full_name}
                            >
                              {item.student.full_name}
                            </h3>
                            <p className="mt-2 text-[1rem] text-white/60">
                              {item.totalCompleted} aula(s) concluida(s)
                            </p>
                            {userRole === "admin" && item.lastCompletedLesson?.teacher_id && (
                              <p className="mt-2 text-sm text-white/45">
                                Professora:{" "}
                                {teacherNames[item.lastCompletedLesson.teacher_id] || "Equipe"}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid max-w-[30rem] gap-3 sm:grid-cols-2">
                          <Link
                            to={`/historico/${item.student.id}`}
                            className="inline-flex min-h-[4rem] items-center justify-center rounded-[1.2rem] bg-white/5 px-3 py-2 text-left text-[0.9rem] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                          >
                            Historico completo
                          </Link>
                          <Link
                            to={`/agendamentos?studentId=${item.student.id}`}
                            className="inline-flex min-h-[4rem] items-center justify-center rounded-[1.2rem] bg-gradient-to-r from-brand-magenta to-brand-pink px-3 py-2 text-left text-[0.9rem] font-bold text-white shadow-soft transition hover:brightness-110"
                          >
                            Agenda do aluno
                          </Link>
                        </div>
                      </div>

                      <div className="grid min-w-[8rem] gap-3 lg:w-[8rem]">
                        <div className="grid gap-3">
                          <ReportTextStat
                            label="No periodo"
                            value={String(item.completedInPeriod)}
                            compact
                          />
                          <ReportTextStat
                            label="Ultima aula"
                            value={
                              item.lastCompletedLesson
                                ? formatShortDate(
                                    item.lastCompletedLesson.completed_at ||
                                      item.lastCompletedLesson.starts_at,
                                  )
                                : "-"
                            }
                            compact
                          />
                        </div>

                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "financial" && (
          <section className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Financeiro
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Fechamento por aluno
            </h2>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {studentSummaries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Nenhum aluno encontrado para consolidar o financeiro.
                </div>
              ) : (
                studentSummaries.map((item) => (
                  <article
                    key={item.student.id}
                    className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {item.student.full_name}
                        </h3>
                        <p className="mt-2 text-sm text-white/55">
                          {item.totalLessons} aula(s) concluida(s)
                        </p>
                        {userRole === "admin" && item.lastCompletedSession?.teacher_id && (
                          <p className="mt-2 text-xs text-white/45">
                            Professora:{" "}
                            {teacherNames[item.lastCompletedSession.teacher_id] || "Equipe"}
                          </p>
                        )}
                      </div>
                      <Link
                        to={`/historico/${item.student.id}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                      >
                        Ver aluno
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <ReportTextStat label="Aulas" value={String(item.totalLessons)} />
                      <ReportTextStat
                        label="Horas"
                        value={`${item.totalHours.toFixed(1)}h`}
                      />
                      <ReportTextStat
                        label="Hora/aula"
                        value={
                          item.hourlyRate != null
                            ? formatCurrency(item.hourlyRate)
                            : "Nao definido"
                        }
                      />
                      <ReportTextStat
                        label="Total"
                        value={
                          item.hourlyRate != null
                            ? formatCurrency(item.totalAmount)
                            : "A definir"
                        }
                      />
                    </div>

                    {item.lastCompletedSession && (
                      <p className="mt-4 text-sm text-white/50">
                        Ultima aula:{" "}
                        {formatSessionRange(
                          item.lastCompletedSession.starts_at,
                          item.lastCompletedSession.ends_at,
                        )}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "attendance" && (
          <section className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Presenca
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Confirmacao de entrada nas aulas concluidas
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {attendanceSummary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  Ainda nao ha aulas concluidas para acompanhar a presenca.
                </div>
              ) : (
                attendanceSummary.map((item) => (
                  <article
                    key={item.session.id}
                    className="rounded-[2rem] bg-white/5 p-4 ring-1 ring-white/10"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
                          {item.session.session_track === "course"
                            ? "Curso completo"
                            : "Mentoria"}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white">
                          {item.session.title}
                        </h3>
                        <p className="mt-2 text-xs text-white/60">
                          {formatSessionRange(
                            item.session.starts_at,
                            item.session.ends_at,
                          )}
                        </p>
                      </div>

                      <p className="text-sm text-white/55">Aluno: {item.studentName}</p>
                      {userRole === "admin" && item.session.teacher_id && (
                        <p className="text-xs text-white/45">
                          Professora: {teacherNames[item.session.teacher_id] || "Equipe"}
                        </p>
                      )}

                      <div className="grid gap-2 text-sm">
                        <PresenceRow
                          label="Inicio registrado"
                          ok={item.started}
                          value={formatDateTime(item.session.started_at)}
                        />
                        <PresenceRow
                          label="Aluno entrou"
                          ok={item.studentEntered}
                          value={formatDateTime(item.session.student_joined_at)}
                        />
                        <PresenceRow
                          label="Professora entrou"
                          ok={item.teacherEntered}
                          value={formatDateTime(item.session.teacher_joined_at)}
                        />
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const HistoryColumn = ({
  eyebrow,
  title,
  sessions,
  studentNameMap,
  accessCounts,
  teacherNames,
  showTeacher,
}: {
  eyebrow: string;
  title: string;
  sessions: any[];
  studentNameMap: Record<string, string>;
  accessCounts: Record<string, number>;
  teacherNames: Record<string, string>;
  showTeacher: boolean;
}) => (
  <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>

    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
          Nenhum registro nesta secao ainda.
        </div>
      ) : (
        sessions.map((session) => (
          <article
            key={session.id}
            className="rounded-[2rem] bg-white/5 p-4 ring-1 ring-white/10"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
                  {session.session_track === "course" ? "Curso completo" : "Mentoria"}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{session.title}</h3>
                <p className="mt-2 text-xs text-white/60">
                  {formatSessionRange(session.starts_at, session.ends_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-white/55">
                {session.student_id && (
                  <span>Aluno: {studentNameMap[session.student_id] || "Aluno"}</span>
                )}
                {showTeacher && session.teacher_id && (
                  <span>Professora: {teacherNames[session.teacher_id] || "Equipe"}</span>
                )}
                <span>Acessos: {accessCounts[session.id] || 0}</span>
                {session.recurrence_group_id && (
                  <span>Recorrencia #{session.recurrence_index}</span>
                )}
              </div>

              {session.student_id && (
                <div className="pt-1">
                  <Link
                    to={`/historico/${session.student_id}`}
                    className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                  >
                    Ver aluno
                  </Link>
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  </section>
);

const ReportStat = ({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) => (
  <div className="rounded-2xl bg-white/5 px-5 py-4 text-center ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
  </div>
);

const ReportTextStat = ({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) => (
  <div
    className={`rounded-2xl bg-brand-900/35 text-center ring-1 ring-white/10 ${
      compact ? "w-full min-h-[5.5rem] px-4 py-4" : "p-4"
    }`}
  >
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
    <p className={`mt-2 font-bold text-white ${compact ? "text-[1rem]" : "text-sm"}`}>
      {value}
    </p>
  </div>
);

const PresenceRow = ({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-900/35 px-4 py-3 ring-1 ring-white/10">
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          ok ? "bg-emerald-400" : "bg-white/20"
        }`}
      />
      <span className="text-white/70">{label}</span>
    </div>
    <span className={`text-xs font-semibold ${ok ? "text-white" : "text-white/40"}`}>
      {value}
    </span>
  </div>
);
