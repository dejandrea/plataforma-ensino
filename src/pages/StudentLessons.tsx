import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BackLink } from "../components/BackLink";
import { supabase } from "../lib/supabaseClient";

const formatSessionDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const getTrackLabel = (track: string) =>
  track === "course" ? "Curso completo" : "Mentoria";

export const StudentLessons = () => {
  const [studentName, setStudentName] = useState("Aluno");
  const [linkedTeacherIds, setLinkedTeacherIds] = useState<string[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [teacherCalendarSettings, setTeacherCalendarSettings] = useState<any[]>([]);
  const [scheduledLessons, setScheduledLessons] = useState<any[]>([]);
  const [availableLessons, setAvailableLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLessonId, setBookingLessonId] = useState<string | null>(null);
  const [openingLessonId, setOpeningLessonId] = useState<string | null>(null);

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

  const handleBookLesson = async (lessonId: string) => {
    setBookingLessonId(lessonId);

    const { error } = await supabase.rpc("book_scheduled_lesson", {
      p_lesson_id: lessonId,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Aula agendada com sucesso.");
      fetchStudentLessons();
    }

    setBookingLessonId(null);
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
        <BackLink to="/dashboard" label="Voltar para a jornada" />

        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                Espaco de aulas
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                {studentName}, aqui ficam suas mentorias e encontros.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                Agende pela booking page da professora ou reserve um horario da
                plataforma. Quando a aula estiver confirmada, o acesso fica
                centralizado por aqui.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryCard label="Proximas aulas" value={upcomingLessons.length} />
              <SummaryCard label="Horarios livres" value={availableLessons.length} />
              <SummaryCard
                label="Agenda Google"
                value={teacherBookingPages.length}
              />
              <SummaryCard label="Historico" value={historyLessons.length} />
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-8">
            <SectionCard
              eyebrow="Agenda confirmada"
              title="Minhas proximas aulas"
              emptyText="Ainda nao ha aulas confirmadas para voce."
              items={upcomingLessons}
              renderItem={(lesson) => (
                <LessonRow
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
              renderItem={(lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  teacherName={teacherNames[lesson.teacher_id]}
                  action={
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
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

          <aside className="space-y-8">
            <SectionCard
              eyebrow="Google Agenda"
              title="Agendar pela agenda da professora"
              emptyText={
                linkedTeacherIds.length === 0
                  ? "Voce ainda nao foi vinculado a uma professora."
                  : "Nenhuma booking page do Google foi configurada ainda."
              }
              items={teacherBookingPages}
              renderItem={(setting) => (
                <div
                  key={setting.teacher_id}
                  className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10"
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-pink/80">
                    Google Agenda
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">
                    {teacherNames[setting.teacher_id] || "Professora"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    Reserve seus horarios direto na agenda oficial da professora.
                    Depois que a aula estiver registrada ou sincronizada, o
                    acesso aparece aqui na plataforma.
                  </p>

                  <div className="mt-4 flex flex-col gap-3">
                    <a
                      href={setting.booking_page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
                    >
                      Abrir agenda do Google
                    </a>
                    {setting.provider_account_email && (
                      <p className="text-xs text-white/40">
                        Conta conectada: {setting.provider_account_email}
                      </p>
                    )}
                  </div>
                </div>
              )}
            />

            <SectionCard
              eyebrow="Reserva interna"
              title="Horarios disponiveis na plataforma"
              emptyText={
                linkedTeacherIds.length === 0
                  ? "Voce ainda nao foi vinculado a uma professora para receber horarios."
                  : "No momento nao ha horarios livres publicados para agendamento."
              }
              items={availableLessons}
              renderItem={(lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  teacherName={teacherNames[lesson.teacher_id]}
                  compact
                  action={
                    <button
                      type="button"
                      onClick={() => handleBookLesson(lesson.id)}
                      disabled={bookingLessonId === lesson.id}
                      className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {bookingLessonId === lesson.id ? "Reservando..." : "Agendar"}
                    </button>
                  }
                />
              )}
            />

            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Sobre o acesso
              </p>
              <p className="mt-4 text-sm leading-7 text-white/65">
                Quando a aula tiver um link do Meet cadastrado, o acesso
                acontece por aqui. Isso ajuda a plataforma a registrar quantas
                vezes voce entrou em cada encontro.
              </p>
            </div>
          </aside>
        </section>
      </div>
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
  emptyText,
  items,
  renderItem,
}: {
  eyebrow: string;
  title: string;
  emptyText: string;
  items: any[];
  renderItem: (item: any) => ReactNode;
}) => (
  <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>

    <div className="mt-6 space-y-4">
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

const LessonRow = ({
  lesson,
  teacherName,
  action,
  compact = false,
}: {
  lesson: any;
  teacherName?: string;
  action: ReactNode;
  compact?: boolean;
}) => (
  <div
    className={`rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10 ${
      compact ? "" : "md:flex md:items-center md:justify-between md:gap-4"
    }`}
  >
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

    <div className={`mt-4 ${compact ? "" : "md:mt-0"}`}>{action}</div>
  </div>
);
