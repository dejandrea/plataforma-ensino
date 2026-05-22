import { type ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const formatSessionDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const getTrackLabel = (track: string) =>
  track === "course" ? "Curso completo" : "Mentoria";

const getFunctionErrorMessage = async (
  error: { message?: string; context?: { json?: () => Promise<any> } } | null,
) => {
  if (!error) return "Ocorreu um erro inesperado.";

  const context = error.context;
  if (context?.json) {
    try {
      const payload = await context.json();
      if (typeof payload?.error === "string" && payload.error) {
        return payload.error;
      }
    } catch {
      // Ignore JSON parsing errors and fall back to the generic message.
    }
  }

  return error.message || "Ocorreu um erro inesperado.";
};

export const StudentLessons = () => {
  const [studentName, setStudentName] = useState("Aluno");
  const [linkedTeacherIds, setLinkedTeacherIds] = useState<string[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [teacherCalendarSettings, setTeacherCalendarSettings] = useState<any[]>([]);
  const [scheduledLessons, setScheduledLessons] = useState<any[]>([]);
  const [availableLessons, setAvailableLessons] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<"booking" | "lessons">("lessons");
  const [loading, setLoading] = useState(true);
  const [bookingLessonId, setBookingLessonId] = useState<string | null>(null);
  const [openingLessonId, setOpeningLessonId] = useState<string | null>(null);
  const [selectedAvailableLesson, setSelectedAvailableLesson] = useState<any | null>(null);

  useEffect(() => {
    fetchStudentLessons();
  }, []);

  async function fetchStudentLessons() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profile }, { data: relations, error: relationsError }] =
      await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase
          .from("teacher_student_relations")
          .select("teacher_id")
          .eq("student_id", user.id),
      ]);

    if (profile?.full_name) {
      setStudentName(profile.full_name.split(" ")[0]);
    }

    if (relationsError) {
      console.error("Erro ao buscar relacoes do aluno:", relationsError.message);
      setLinkedTeacherIds([]);
      setScheduledLessons([]);
      setAvailableLessons([]);
      setTeacherCalendarSettings([]);
      setLoading(false);
      return;
    }

    const teacherIds = (relations || []).map((relation) => relation.teacher_id);
    setLinkedTeacherIds(teacherIds);

    const [
      { data: teachers },
      { data: scheduled, error: scheduledError },
      { data: teacherSettings, error: teacherSettingsError },
    ] = await Promise.all([
      teacherIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("scheduled_lessons")
        .select("*")
        .eq("student_id", user.id)
        .order("starts_at", { ascending: true }),
      teacherIds.length
        ? supabase
            .from("teacher_calendar_settings")
            .select("*")
            .eq("is_active", true)
            .in("teacher_id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const teacherMap = Object.fromEntries(
      (teachers || []).map((teacher) => [teacher.id, teacher.full_name || "Professora"]),
    );
    setTeacherNames(teacherMap);

    if (scheduledError) {
      console.error("Erro ao buscar aulas do aluno:", scheduledError.message);
      setScheduledLessons([]);
    } else {
      setScheduledLessons(scheduled || []);
    }

    if (teacherSettingsError) {
      console.error(
        "Erro ao buscar configuracoes de agenda:",
        teacherSettingsError.message,
      );
      setTeacherCalendarSettings([]);
    } else {
      setTeacherCalendarSettings(teacherSettings || []);
    }

    if (teacherIds.length > 0) {
      const { data: available, error: availableError } = await supabase
        .from("scheduled_lessons")
        .select("*")
        .eq("status", "available")
        .in("teacher_id", teacherIds)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });

      if (availableError) {
        console.error("Erro ao buscar horarios disponiveis:", availableError.message);
        setAvailableLessons([]);
      } else {
        setAvailableLessons(available || []);
      }
    } else {
      setAvailableLessons([]);
    }

    setLoading(false);
  }

  const now = Date.now();

  const upcomingLessons = useMemo(
    () =>
      scheduledLessons.filter(
        (lesson) =>
          lesson.status === "scheduled" && new Date(lesson.starts_at).getTime() >= now,
      ),
    [now, scheduledLessons],
  );

  const historyLessons = useMemo(
    () =>
      scheduledLessons.filter(
        (lesson) =>
          lesson.status !== "scheduled" || new Date(lesson.starts_at).getTime() < now,
      ),
    [now, scheduledLessons],
  );

  const teacherBookingPages = useMemo(
    () =>
      teacherCalendarSettings.filter(
        (setting) => typeof setting.booking_page_url === "string" && setting.booking_page_url,
      ),
    [teacherCalendarSettings],
  );

  const runAutomaticTeacherSync = async (teacherId: string) => {
    const agendaResult = await supabase.functions.invoke("google-calendar-sync", {
      body: { teacherId },
    });
    const availabilityResult = await supabase.functions.invoke(
      "google-calendar-sync-availability",
      {
        body: { teacherId },
      },
    );
    const syncErrors = [agendaResult.error, availabilityResult.error].filter(Boolean);

    if (syncErrors.length > 0) {
      const messages = await Promise.all(
        syncErrors.map((error) => getFunctionErrorMessage(error)),
      );
      throw new Error(messages.join(" | "));
    }
  };

  const handleBookLesson = async (lessonId: string) => {
    setBookingLessonId(lessonId);

    const { error } = await supabase.functions.invoke("book-platform-lesson", {
      body: {
        lessonId,
      },
    });

    if (error) {
      alert(await getFunctionErrorMessage(error));
    } else {
      if (selectedAvailableLesson?.teacher_id) {
        try {
          await runAutomaticTeacherSync(selectedAvailableLesson.teacher_id);
        } catch (syncError) {
          console.error("Falha ao sincronizar agenda apos o agendamento:", syncError);
        }
      }

      alert("Aula agendada com sucesso. Se a agenda Google da professora estiver conectada, o link do Meet ja vai aparecer aqui.");
      setSelectedAvailableLesson(null);
      fetchStudentLessons();
    }

    setBookingLessonId(null);
  };

  const openBookingModal = (lesson: any) => {
    setSelectedAvailableLesson(lesson);
  };

  const handleOpenLesson = async (lesson: any) => {
    if (!lesson.meet_link) return;

    setOpeningLessonId(lesson.id);

    const { error } = await supabase.rpc("log_scheduled_lesson_access", {
      p_lesson_id: lesson.id,
    });

    if (error) {
      alert(error.message);
      setOpeningLessonId(null);
      return;
    }

    window.open(lesson.meet_link, "_blank", "noopener,noreferrer");
    setOpeningLessonId(null);
  };

  if (loading) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Organizando suas aulas...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-5 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-6">
          <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                  Espaco de aulas
                </p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-[2.5rem]">
                  {studentName}, aqui ficam suas mentorias e encontros.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                  Agende pela booking page da professora ou reserve um horario da
                  plataforma. Quando a aula estiver confirmada, o acesso fica
                  centralizado por aqui.
                </p>
              </div>

              <div className="mt-5 grid max-w-lg gap-3 sm:grid-cols-4">
                <SummaryCard label="Proximas aulas" value={upcomingLessons.length} />
                <SummaryCard label="Horarios livres" value={availableLessons.length} />
                <SummaryCard
                  label="Agenda Google"
                  value={teacherBookingPages.length}
                />
                <SummaryCard label="Historico" value={historyLessons.length} />
              </div>

              <div className="mt-5">
                <div className="inline-flex w-full max-w-[32rem] rounded-[1.6rem] bg-brand-900/70 p-1.5 ring-1 ring-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveView("booking")}
                    className={`flex-1 rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                      activeView === "booking"
                        ? "bg-white text-brand-900"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Agendar aulas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("lessons")}
                    className={`flex-1 rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                      activeView === "lessons"
                        ? "bg-white text-brand-900"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Minhas aulas
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[21rem]">
              <div className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-pink/80">
                  Agenda da professora
                </p>
                <h2 className="mt-2 text-lg font-bold text-white">
                  Agendamento oficial
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Use a agenda conectada da sua professora para reservar horarios
                  direto no Google quando essa opcao estiver disponivel.
                </p>

                {teacherBookingPages.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {teacherBookingPages.map((setting) => (
                      <div
                        key={setting.teacher_id}
                        className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                      >
                        <p className="text-sm font-bold text-white">
                          {teacherNames[setting.teacher_id] || "Professora"}
                        </p>
                        {setting.provider_account_email && (
                          <p className="mt-1 text-xs text-white/40">
                            Conta conectada: {setting.provider_account_email}
                          </p>
                        )}
                        <a
                          href={setting.booking_page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
                        >
                          Abrir agenda do Google
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm leading-6 text-white/55 ring-1 ring-white/10">
                    {linkedTeacherIds.length === 0
                      ? "Voce ainda nao foi vinculado a uma professora."
                      : "Nenhuma booking page do Google foi configurada ainda."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {activeView === "booking" ? (
          <div className="mt-8 space-y-8">
            <SectionCard
              eyebrow="Reserva interna"
              title="Horarios disponiveis na plataforma"
              description="Use a agenda da professora no topo para reservar direto no Google ou escolha um horario publicado dentro da plataforma."
              emptyText={
                linkedTeacherIds.length === 0
                  ? "Voce ainda nao foi vinculado a uma professora para receber horarios."
                  : "No momento nao ha horarios livres publicados para agendamento."
              }
              items={availableLessons}
              gridClassName="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              renderItem={(lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  teacherName={teacherNames[lesson.teacher_id]}
                  action={
                    <button
                      type="button"
                      onClick={() => openBookingModal(lesson)}
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
                    >
                      Agendar
                    </button>
                  }
                />
              )}
            />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <SectionCard
              eyebrow="Agenda confirmada"
              title="Minhas proximas aulas"
              emptyText="Ainda nao ha aulas confirmadas para voce."
              items={upcomingLessons}
              gridClassName="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              renderItem={(lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  teacherName={teacherNames[lesson.teacher_id]}
                  action={
                    <button
                      type="button"
                      onClick={() => handleOpenLesson(lesson)}
                      disabled={!lesson.meet_link || openingLessonId === lesson.id}
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {openingLessonId === lesson.id
                        ? "Abrindo..."
                        : lesson.meet_link
                          ? "Acessar aula"
                          : "Link em breve"}
                    </button>
                  }
                />
              )}
            />

            <SectionCard
              eyebrow="Historico"
              title="Aulas ja registradas"
              emptyText="Seu historico de aulas vai aparecer aqui conforme voce usar a agenda."
              items={historyLessons}
              gridClassName="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              renderItem={(lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  teacherName={teacherNames[lesson.teacher_id]}
                  action={
                    <span className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white/60 ring-1 ring-white/15">
                      {lesson.status === "completed"
                        ? "Concluida"
                        : lesson.status === "cancelled"
                          ? "Cancelada"
                          : "Registrada"}
                    </span>
                  }
                />
              )}
            />
          </div>
        )}
      </div>

      {selectedAvailableLesson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={() => setSelectedAvailableLesson(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[2rem] bg-[#140f25] p-6 shadow-soft ring-1 ring-white/10 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Confirmar aula
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Agendar horario disponivel
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  Assim que voce confirmar, a reserva sera enviada e o Meet ficara vinculado quando a agenda da professora estiver conectada.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAvailableLesson(null)}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Horario selecionado
                </p>
                <p className="mt-2 text-lg font-bold text-white">
                  {selectedAvailableLesson.title}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  {formatSessionDate(selectedAvailableLesson.starts_at)} ate{" "}
                  {formatSessionDate(selectedAvailableLesson.ends_at)}
                </p>
                <p className="mt-2 text-sm text-white/55">
                  Com {teacherNames[selectedAvailableLesson.teacher_id] || "Professora"}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setSelectedAvailableLesson(null)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleBookLesson(selectedAvailableLesson.id)}
                  disabled={bookingLessonId === selectedAvailableLesson.id}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bookingLessonId === selectedAvailableLesson.id
                    ? "Agendando..."
                    : "Confirmar agendamento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="rounded-2xl bg-white/5 px-4 py-4 text-center ring-1 ring-white/10">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
  </div>
);

const SectionCard = ({
  eyebrow,
  title,
  description,
  emptyText,
  items,
  renderItem,
  gridClassName = "mt-6 space-y-4",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  emptyText: string;
  items: any[];
  renderItem: (item: any) => ReactNode;
  gridClassName?: string;
}) => (
  <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
    {description && (
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
        {description}
      </p>
    )}

    <div className={gridClassName}>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
          {emptyText}
        </div>
      ) : (
        items.map((item) => renderItem(item))
      )}
    </div>
  </section>
);

const LessonCard = ({
  lesson,
  teacherName,
  action,
}: {
  lesson: any;
  teacherName?: string;
  action: ReactNode;
}) => (
  <div className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
          {getTrackLabel(lesson.session_track)}
        </span>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
          {lesson.status === "available"
            ? "Disponivel"
            : lesson.status === "completed"
              ? "Concluida"
              : lesson.status === "cancelled"
                ? "Cancelada"
                : "Agendada"}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-bold text-white">{lesson.title}</h3>
      <p className="mt-2 text-sm text-white/60">
        {formatSessionDate(lesson.starts_at)} ate {formatSessionDate(lesson.ends_at)}
      </p>
      <p className="mt-2 text-sm text-white/55">
        {teacherName ? `Com ${teacherName}` : "Professora vinculada"}
      </p>
      {lesson.description && (
        <p className="mt-3 text-sm leading-6 text-white/60">{lesson.description}</p>
      )}
    </div>

    <div className="mt-4">{action}</div>
  </div>
);
