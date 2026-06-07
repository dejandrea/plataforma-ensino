import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const formatSessionDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

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

const formatDayLabel = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

const formatMonthLabel = (value: Date) =>
  value.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

const toDayKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const addMonths = (value: Date, amount: number) =>
  new Date(value.getFullYear(), value.getMonth() + amount, 1);

const buildCalendarDays = (monthDate: Date) => {
  const firstDayOfMonth = startOfMonth(monthDate);
  const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() - startWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });
};

const dateFromDayKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

const getRoomReleaseTime = (startsAt: string) =>
  new Date(new Date(startsAt).getTime() - 5 * 60 * 1000);

const canAccessRoom = (lesson: { meet_link?: string | null; starts_at: string }) =>
  Boolean(lesson.meet_link) && Date.now() >= getRoomReleaseTime(lesson.starts_at).getTime();

const getStudentCancellationDeadline = (startsAt: string) =>
  new Date(new Date(startsAt).getTime() - 2 * 60 * 60 * 1000);

const canStudentCancelLesson = (lesson: { starts_at: string }) =>
  Date.now() <= getStudentCancellationDeadline(lesson.starts_at).getTime();

const toDateTimeLocalValue = (value: string) => {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
};

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

type CancellationScope = "single" | "this_and_following";

export const StudentLessons = () => {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("Aluno");
  const [linkedTeacherIds, setLinkedTeacherIds] = useState<string[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherCalendarSettings, setTeacherCalendarSettings] = useState<any[]>([]);
  const [scheduledLessons, setScheduledLessons] = useState<any[]>([]);
  const [availableLessons, setAvailableLessons] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<"booking" | "lessons">("lessons");
  const [loading, setLoading] = useState(true);
  const [bookingLessonId, setBookingLessonId] = useState<string | null>(null);
  const [openingLessonId, setOpeningLessonId] = useState<string | null>(null);
  const [cancellingLessonId, setCancellingLessonId] = useState<string | null>(null);
  const [reschedulingLessonId, setReschedulingLessonId] = useState<string | null>(null);
  const [selectedAvailableLesson, setSelectedAvailableLesson] = useState<any | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null);
  const [rescheduleStartsAt, setRescheduleStartsAt] = useState("");
  const [meetLinkRecoveryAttempted, setMeetLinkRecoveryAttempted] = useState(false);
  const [availabilityCalendarMonth, setAvailabilityCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedAvailableDate, setSelectedAvailableDate] = useState("");

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

  useEffect(() => {
    if (linkedTeacherIds.length === 0) {
      setSelectedTeacherId("");
      return;
    }

    if (!selectedTeacherId || !linkedTeacherIds.includes(selectedTeacherId)) {
      setSelectedTeacherId(linkedTeacherIds[0]);
    }
  }, [linkedTeacherIds, selectedTeacherId]);

  const now = Date.now();

  const teacherTabs = useMemo(
    () =>
      linkedTeacherIds.map((teacherId) => ({
        id: teacherId,
        name: teacherNames[teacherId] || "Professora",
      })),
    [linkedTeacherIds, teacherNames],
  );

  const activeTeacherId = selectedTeacherId || linkedTeacherIds[0] || "";
  const activeTeacherName = activeTeacherId
    ? teacherNames[activeTeacherId] || "Professora"
    : "Professora";

  const upcomingLessons = useMemo(
    () =>
      scheduledLessons.filter(
        (lesson) =>
          lesson.status === "scheduled" && new Date(lesson.starts_at).getTime() >= now,
      ),
    [now, scheduledLessons],
  );

  const filteredUpcomingLessons = useMemo(
    () =>
      activeTeacherId
        ? upcomingLessons.filter((lesson) => lesson.teacher_id === activeTeacherId)
        : upcomingLessons,
    [activeTeacherId, upcomingLessons],
  );

  const historyLessons = useMemo(
    () =>
      scheduledLessons.filter(
        (lesson) =>
          lesson.status !== "scheduled" || new Date(lesson.starts_at).getTime() < now,
      ),
    [now, scheduledLessons],
  );

  const filteredHistoryLessons = useMemo(
    () =>
      activeTeacherId
        ? historyLessons.filter((lesson) => lesson.teacher_id === activeTeacherId)
        : historyLessons,
    [activeTeacherId, historyLessons],
  );

  const completedHistoryLessons = useMemo(
    () => filteredHistoryLessons.filter((lesson) => lesson.status === "completed"),
    [filteredHistoryLessons],
  );

  const cancelledHistoryLessons = useMemo(
    () => filteredHistoryLessons.filter((lesson) => lesson.status === "cancelled"),
    [filteredHistoryLessons],
  );

  const teacherBookingPages = useMemo(
    () =>
      teacherCalendarSettings.filter(
        (setting) => typeof setting.booking_page_url === "string" && setting.booking_page_url,
      ),
    [teacherCalendarSettings],
  );

  const filteredTeacherBookingPages = useMemo(
    () =>
      activeTeacherId
        ? teacherBookingPages.filter((setting) => setting.teacher_id === activeTeacherId)
        : teacherBookingPages,
    [activeTeacherId, teacherBookingPages],
  );

  const filteredAvailableLessons = useMemo(
    () =>
      activeTeacherId
        ? availableLessons.filter((lesson) => lesson.teacher_id === activeTeacherId)
        : availableLessons,
    [activeTeacherId, availableLessons],
  );

  const availableLessonsByDay = useMemo(() => {
    const grouped = new Map<string, any[]>();

    for (const lesson of filteredAvailableLessons) {
      const dayKey = toDayKey(lesson.starts_at);
      const current = grouped.get(dayKey) || [];
      current.push(lesson);
      grouped.set(dayKey, current);
    }

    return grouped;
  }, [filteredAvailableLessons]);

  const availabilityCalendarDays = useMemo(
    () => buildCalendarDays(availabilityCalendarMonth),
    [availabilityCalendarMonth],
  );

  const selectedAvailableDayLessons = useMemo(() => {
    if (!selectedAvailableDate) return [];
    return availableLessonsByDay.get(selectedAvailableDate) || [];
  }, [availableLessonsByDay, selectedAvailableDate]);

  useEffect(() => {
    if (filteredAvailableLessons.length === 0) {
      setSelectedAvailableDate("");
      return;
    }

    const hasSelectedDate = selectedAvailableDate
      ? availableLessonsByDay.has(selectedAvailableDate)
      : false;

    if (!hasSelectedDate) {
      const firstAvailableDate = toDayKey(filteredAvailableLessons[0].starts_at);
      setSelectedAvailableDate(firstAvailableDate);
      setAvailabilityCalendarMonth(startOfMonth(new Date(filteredAvailableLessons[0].starts_at)));
    }
  }, [availableLessonsByDay, filteredAvailableLessons, selectedAvailableDate]);

  useEffect(() => {
    if (loading || meetLinkRecoveryAttempted) {
      return;
    }

    const activeTeacherIds = new Set(
      teacherCalendarSettings
        .filter((setting) => setting.is_active)
        .map((setting) => setting.teacher_id),
    );

    const teachersNeedingMeetLinkRecovery = Array.from(
      new Set(
        upcomingLessons
          .filter(
            (lesson) =>
              lesson.status === "scheduled" &&
              !lesson.meet_link &&
              lesson.calendar_provider === "google_calendar" &&
              lesson.calendar_event_id &&
              activeTeacherIds.has(lesson.teacher_id),
          )
          .map((lesson) => lesson.teacher_id),
      ),
    );

    if (teachersNeedingMeetLinkRecovery.length === 0) {
      return;
    }

    setMeetLinkRecoveryAttempted(true);

    void (async () => {
      try {
        await Promise.all(
          teachersNeedingMeetLinkRecovery.map((teacherId) =>
            runAutomaticTeacherSync(teacherId),
          ),
        );
        await fetchStudentLessons();
      } catch (error) {
        console.error("Falha ao tentar recuperar links do Meet automaticamente:", error);
      }
    })();
  }, [
    loading,
    meetLinkRecoveryAttempted,
    teacherCalendarSettings,
    upcomingLessons,
  ]);

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
    if (!canAccessRoom(lesson)) return;

    setOpeningLessonId(lesson.id);
    navigate(`/sala/aula/${lesson.id}`);
  };

  const handleCancelLesson = async (
    lessonId: string,
    scope: CancellationScope = "single",
  ) => {
    setCancellingLessonId(lessonId);
    const lesson = scheduledLessons.find((item) => item.id === lessonId) || null;

    const { error } = await supabase.functions.invoke("cancel-platform-lesson", {
      body: {
        lessonId,
        scope,
      },
    });

    if (error) {
      alert(await getFunctionErrorMessage(error));
    } else {
      if (lesson?.teacher_id) {
        try {
          await runAutomaticTeacherSync(lesson.teacher_id);
        } catch (syncError) {
          console.error("Falha ao sincronizar apos cancelar a aula:", syncError);
          alert(
            syncError instanceof Error
              ? `Aula cancelada, mas a sincronizacao automatica falhou: ${syncError.message}`
              : "Aula cancelada, mas a sincronizacao automatica falhou.",
          );
        }
      }

      await fetchStudentLessons();
    }

    setCancellingLessonId(null);
  };

  const openRescheduleModal = (lesson: any) => {
    setRescheduleTarget(lesson);
    setRescheduleStartsAt(toDateTimeLocalValue(lesson.starts_at));
  };

  const handleRescheduleLesson = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!rescheduleTarget) return;

    if (!rescheduleStartsAt) {
      alert("Escolha a nova data e hora da aula.");
      return;
    }

    const lesson = rescheduleTarget;
    setReschedulingLessonId(lesson.id);

    const { error } = await supabase.functions.invoke("reschedule-platform-lesson", {
      body: {
        lessonId: lesson.id,
        startsAt: new Date(rescheduleStartsAt).toISOString(),
        scope: "single",
      },
    });

    if (error) {
      alert(await getFunctionErrorMessage(error));
    } else {
      setRescheduleTarget(null);
      if (lesson?.teacher_id) {
        try {
          await runAutomaticTeacherSync(lesson.teacher_id);
        } catch (syncError) {
          console.error("Falha ao sincronizar apos reagendar a aula:", syncError);
          alert(
            syncError instanceof Error
              ? `Aula reagendada, mas a sincronizacao automatica falhou: ${syncError.message}`
              : "Aula reagendada, mas a sincronizacao automatica falhou.",
          );
        }
      }

      await fetchStudentLessons();
    }

    setReschedulingLessonId(null);
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
                <SummaryCard label="Proximas aulas" value={filteredUpcomingLessons.length} />
                <SummaryCard label="Horarios livres" value={filteredAvailableLessons.length} />
                <SummaryCard
                  label="Agenda Google"
                  value={filteredTeacherBookingPages.length}
                />
                <SummaryCard label="Historico" value={filteredHistoryLessons.length} />
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

              {teacherTabs.length > 0 && (
                <div className="mt-5">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                    Visualizando por professora
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {teacherTabs.map((teacher) => (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => setSelectedTeacherId(teacher.id)}
                        className={`inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                          activeTeacherId === teacher.id
                            ? "bg-white text-brand-900"
                            : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {teacher.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

                {filteredTeacherBookingPages.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {filteredTeacherBookingPages.map((setting) => (
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
                      : `Nenhuma booking page do Google foi configurada ainda para ${activeTeacherName}.`}
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
              description={`Use a agenda da ${activeTeacherName} no topo para reservar direto no Google ou escolha um horario publicado dentro da plataforma.`}
              customContent={
                filteredAvailableLessons.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                    {linkedTeacherIds.length === 0
                      ? "Voce ainda nao foi vinculado a uma professora para receber horarios."
                      : `No momento nao ha horarios livres publicados para ${activeTeacherName}.`}
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    <div className="rounded-[2rem] bg-brand-900/35 p-5 ring-1 ring-white/10">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                            Calendario
                          </p>
                          <h3 className="mt-2 text-xl font-bold text-white">
                            {formatMonthLabel(availabilityCalendarMonth)}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAvailabilityCalendarMonth((current) => addMonths(current, -1))
                            }
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white ring-1 ring-white/10 transition hover:bg-white/10"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAvailabilityCalendarMonth((current) => addMonths(current, 1))
                            }
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white ring-1 ring-white/10 transition hover:bg-white/10"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((weekday) => (
                          <span key={weekday}>{weekday}</span>
                        ))}
                      </div>

                      <div className="mt-3 grid grid-cols-7 gap-2">
                        {availabilityCalendarDays.map((day) => {
                          const dayKey = toDayKey(day.toISOString());
                          const dayLessons = availableLessonsByDay.get(dayKey) || [];
                          const isCurrentMonth =
                            day.getMonth() === availabilityCalendarMonth.getMonth();
                          const isSelected = selectedAvailableDate === dayKey;
                          const isToday = toDayKey(new Date().toISOString()) === dayKey;

                          return (
                            <button
                              key={dayKey}
                              type="button"
                              onClick={() => dayLessons.length > 0 && setSelectedAvailableDate(dayKey)}
                              disabled={dayLessons.length === 0}
                              className={`min-h-[5.5rem] rounded-[1.5rem] p-3 text-left ring-1 transition ${
                                isSelected
                                  ? "bg-white text-brand-900 ring-white"
                                  : dayLessons.length > 0
                                    ? "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                                    : "bg-transparent text-white/25 ring-white/5"
                              } ${!isCurrentMonth ? "opacity-35" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-sm font-bold ${
                                    isToday && !isSelected ? "text-brand-pink" : ""
                                  }`}
                                >
                                  {day.getDate()}
                                </span>
                                {dayLessons.length > 0 && (
                                  <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]">
                                    {dayLessons.length}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <SectionCard
                      eyebrow="Dia selecionado"
                      title={
                        selectedAvailableDate
                          ? `Horarios de ${formatDayLabel(
                              dateFromDayKey(selectedAvailableDate).toISOString(),
                            )}`
                          : "Horarios do dia"
                      }
                      emptyText={`Nao ha horarios livres em ${activeTeacherName} para o dia selecionado.`}
                      items={selectedAvailableDayLessons}
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
                )
              }
            />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <SectionCard
              eyebrow="Agenda confirmada"
              title="Minhas proximas aulas"
              emptyText={`Ainda nao ha aulas confirmadas com ${activeTeacherName}.`}
              items={filteredUpcomingLessons}
              gridClassName="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              renderItem={(lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  teacherName={teacherNames[lesson.teacher_id]}
                  compact
                  hideDescription
                  action={
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 overflow-x-auto pt-1">
                        <StudentActionIconButton
                          title={
                            openingLessonId === lesson.id
                              ? "Abrindo sala..."
                              : !lesson.meet_link
                                ? "Link em breve"
                                : canAccessRoom(lesson)
                                  ? "Entrar na sala"
                                  : "Sala em breve"
                          }
                          onClick={() => handleOpenLesson(lesson)}
                          disabled={!canAccessRoom(lesson) || openingLessonId === lesson.id}
                          tone={canAccessRoom(lesson) ? "accent" : "default"}
                          icon={<MeetIcon />}
                        />
                        <StudentActionIconButton
                          title={
                            reschedulingLessonId === lesson.id
                              ? "Reagendando..."
                              : "Reagendar aula"
                          }
                          onClick={() => openRescheduleModal(lesson)}
                          disabled={reschedulingLessonId === lesson.id}
                          tone="warning"
                          icon={<RescheduleIcon />}
                        />
                        <StudentActionIconButton
                          title={
                            cancellingLessonId === lesson.id
                              ? "Cancelando..."
                              : "Cancelar aula"
                          }
                          onClick={() => handleCancelLesson(lesson.id, "single")}
                          disabled={
                            cancellingLessonId === lesson.id || !canStudentCancelLesson(lesson)
                          }
                          tone="danger"
                          icon={<CancelIcon />}
                        />
                      </div>
                      {lesson.meet_link && !canAccessRoom(lesson) && (
                        <p className="text-xs text-white/50">
                          Sala liberada as:{" "}
                          {formatSessionDate(getRoomReleaseTime(lesson.starts_at).toISOString())}
                        </p>
                      )}
                      {!canStudentCancelLesson(lesson) && (
                        <p className="text-xs text-white/50">
                          Cancelamento disponivel ate:{" "}
                          {formatSessionDate(
                            getStudentCancellationDeadline(lesson.starts_at).toISOString(),
                          )}
                        </p>
                      )}
                    </div>
                  }
                />
              )}
            />

            <SectionCard
              eyebrow="Historico"
              title="Aulas ja registradas"
              description={`Acompanhe separadamente as aulas concluidas e canceladas com ${activeTeacherName}.`}
              customContent={
                <div className="mt-6 grid gap-8 xl:grid-cols-2">
                  <HistoryLessonColumn
                    title="Aulas concluidas"
                    emptyText={`Nenhuma aula concluida com ${activeTeacherName} ainda.`}
                    lessons={completedHistoryLessons}
                    teacherNames={teacherNames}
                  />
                  <HistoryLessonColumn
                    title="Aulas canceladas"
                    emptyText={`Nenhuma aula cancelada com ${activeTeacherName} ainda.`}
                    lessons={cancelledHistoryLessons}
                    teacherNames={teacherNames}
                  />
                </div>
              }
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
                  {formatSessionRange(
                    selectedAvailableLesson.starts_at,
                    selectedAvailableLesson.ends_at,
                  )}
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

      {rescheduleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={() => setRescheduleTarget(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[2rem] bg-[#140f25] p-6 shadow-soft ring-1 ring-white/10 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Reagendar aula
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Escolha a nova data e hora
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  O reagendamento do aluno altera apenas a aula selecionada. A
                  recorrencia restante nao sera modificada.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleRescheduleLesson} className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Aula selecionada
                </p>
                <p className="mt-2 text-lg font-bold text-white">{rescheduleTarget.title}</p>
                <p className="mt-2 text-sm text-white/60">
                  {formatSessionRange(
                    rescheduleTarget.starts_at,
                    rescheduleTarget.ends_at,
                  )}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/45">
                  Nova data e hora
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender"
                  value={rescheduleStartsAt}
                  onChange={(event) => setRescheduleStartsAt(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reschedulingLessonId === rescheduleTarget.id}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reschedulingLessonId === rescheduleTarget.id
                    ? "Reagendando..."
                    : "Salvar novo horario"}
                </button>
              </div>
            </form>
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
  customContent,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  emptyText?: string;
  items?: any[];
  renderItem?: (item: any) => ReactNode;
  gridClassName?: string;
  customContent?: ReactNode;
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

    {customContent ?? (
      <div className={gridClassName}>
        {(items || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
            {emptyText}
          </div>
        ) : (
          (items || []).map((item) => renderItem?.(item))
        )}
      </div>
    )}
  </section>
);

const HistoryLessonColumn = ({
  title,
  emptyText,
  lessons,
  teacherNames,
}: {
  title: string;
  emptyText: string;
  lessons: any[];
  teacherNames: Record<string, string>;
}) => (
  <div className="rounded-[2rem] bg-brand-900/35 p-5 ring-1 ring-white/10">
    <h3 className="text-2xl font-bold text-white">{title}</h3>

    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
          {emptyText}
        </div>
      ) : (
        lessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            teacherName={teacherNames[lesson.teacher_id]}
            compact
            hideDescription
            hideStatusBadge
            action={null}
          />
        ))
      )}
    </div>
  </div>
);

const LessonCard = ({
  lesson,
  teacherName,
  action,
  compact = false,
  hideDescription = false,
  hideStatusBadge = false,
}: {
  lesson: any;
  teacherName?: string;
  action: ReactNode;
  compact?: boolean;
  hideDescription?: boolean;
  hideStatusBadge?: boolean;
}) => (
  <div
    className={`rounded-[2rem] bg-white/5 ring-1 ring-white/10 ${
      compact ? "p-4" : "p-5"
    }`}
  >
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
          {getTrackLabel(lesson.session_track)}
        </span>
        {!hideStatusBadge && (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
            {lesson.status === "available"
              ? "Disponivel"
              : lesson.status === "completed"
                ? "Concluida"
                : lesson.status === "cancelled"
                  ? "Cancelada"
                  : "Agendada"}
          </span>
        )}
      </div>

      <h3 className={`${compact ? "mt-2 text-base" : "mt-3 text-lg"} font-bold text-white`}>
        {lesson.title}
      </h3>
      <p className={`mt-2 ${compact ? "text-xs" : "text-sm"} text-white/60`}>
        {formatSessionRange(lesson.starts_at, lesson.ends_at)}
      </p>
      <p className={`mt-2 ${compact ? "text-xs" : "text-sm"} text-white/55`}>
        {teacherName ? `Com ${teacherName}` : "Professora vinculada"}
      </p>
      {!hideDescription && lesson.description && (
        <p className="mt-3 text-sm leading-6 text-white/60">{lesson.description}</p>
      )}
    </div>

    <div className="mt-4">{action}</div>
  </div>
);

const StudentActionIconButton = ({
  title,
  icon,
  onClick,
  disabled = false,
  tone = "default",
}: {
  title: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "accent" | "danger" | "warning";
}) => {
  const toneClass =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-200 ring-rose-400/20 hover:bg-rose-500/20"
      : tone === "warning"
        ? "bg-amber-500/12 text-amber-100 ring-amber-300/25 hover:bg-amber-500/22"
        : tone === "accent"
          ? "bg-brand-magenta/20 text-white ring-brand-magenta/30 hover:brightness-110"
          : "bg-white/5 text-white ring-white/15 hover:bg-white/10";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-2xl ring-1 transition ${toneClass} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {icon}
    </button>
  );
};

const MeetIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
    <rect x="3" y="6" width="12" height="12" rx="2" />
    <path d="M15 10l6-3v10l-6-3z" />
  </svg>
);

const RescheduleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
);

const CancelIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </svg>
);
