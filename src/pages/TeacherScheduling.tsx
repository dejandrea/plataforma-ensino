import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const initialReservationForm = {
  sessionTrack: "mentoring",
  studentId: "",
  isRecurring: false,
  recurrenceCount: "4",
};

const initialCalendarSettings = {
  providerAccountEmail: "",
  calendarId: "",
  calendarName: "",
  eventCalendarIds: [] as string[],
  eventCalendarNames: [] as string[],
  availabilityCalendarIds: [] as string[],
  availabilityCalendarNames: [] as string[],
  bookingPageUrl: "",
  timezone: "America/Bahia",
  syncMode: "booking_link",
  availabilityWeekdays: [1, 2, 3, 4, 5],
  availabilityStartTime: "08:00",
  availabilityEndTime: "18:00",
  availabilitySlotMinutes: "60",
  availabilityHorizonDays: "21",
  autoCreateMeet: true,
  isActive: true,
  connectionStatus: "disconnected",
  lastSyncedAt: "",
  lastSyncError: "",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

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

const fieldInputClass =
  "w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender";

type SyncOptions = {
  silent?: boolean;
};

export const TeacherScheduling = () => {
  const [searchParams] = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [googleCalendars, setGoogleCalendars] = useState<any[]>([]);
  const [accessCounts, setAccessCounts] = useState<Record<string, number>>({});
  const [calendarSettings, setCalendarSettings] = useState(initialCalendarSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCalendarSettings, setSavingCalendarSettings] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncingAvailability, setSyncingAvailability] = useState(false);
  const [processingGoogleCallback, setProcessingGoogleCallback] = useState(false);
  const [handledGoogleCallback, setHandledGoogleCallback] = useState("");
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
  const [showEventSettingsModal, setShowEventSettingsModal] = useState(false);
  const [showAvailabilitySettingsModal, setShowAvailabilitySettingsModal] = useState(false);
  const [selectedSlotForReservation, setSelectedSlotForReservation] = useState<any | null>(null);
  const [activeView, setActiveView] = useState<"events" | "availability">("events");
  const [reservationForm, setReservationForm] = useState({
    ...initialReservationForm,
    studentId: searchParams.get("studentId") || "",
  });

  useEffect(() => {
    fetchSchedulingData();
  }, []);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const callbackSignature = code && state ? `${code}:${state}` : "";

    if (
      !currentUserId ||
      !code ||
      !state ||
      processingGoogleCallback ||
      handledGoogleCallback === callbackSignature
    ) {
      return;
    }

    setHandledGoogleCallback(callbackSignature);
    void completeGoogleConnection(code, state);
  }, [currentUserId, handledGoogleCallback, processingGoogleCallback, searchParams]);

  useEffect(() => {
    if (
      !currentUserId ||
      autoSyncAttempted ||
      calendarSettings.syncMode !== "calendar_sync" ||
      calendarSettings.connectionStatus !== "connected"
    ) {
      return;
    }

    setAutoSyncAttempted(true);
    void syncGoogleCalendar();
  }, [
    autoSyncAttempted,
    calendarSettings.connectionStatus,
    calendarSettings.syncMode,
    currentUserId,
  ]);

  useEffect(() => {
    if (
      (!showEventSettingsModal && !showAvailabilitySettingsModal) ||
      calendarSettings.connectionStatus !== "connected"
    ) {
      return;
    }

    void fetchGoogleCalendars();
  }, [
    calendarSettings.connectionStatus,
    showAvailabilitySettingsModal,
    showEventSettingsModal,
  ]);

  async function fetchSchedulingData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const [
      { data: linkedStudents },
      { data: scheduledLessons, error: lessonsError },
      { data: teacherSettings, error: settingsError },
    ] = await Promise.all([
      supabase
        .from("teacher_student_relations")
        .select(
          `
            student_id,
            student:profiles!student_id (
              id,
              full_name
            )
          `,
        )
        .eq("teacher_id", user.id),
      supabase
        .from("scheduled_lessons")
        .select("*")
        .eq("teacher_id", user.id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("teacher_calendar_settings")
        .select("*")
        .eq("teacher_id", user.id)
        .maybeSingle(),
    ]);

    const studentRows = (linkedStudents || [])
      .map((item: any) => item.student)
      .filter(Boolean);
    setStudents(studentRows);

    if (settingsError) {
      console.error("Erro ao buscar configuracao da agenda:", settingsError.message);
      setCalendarSettings(initialCalendarSettings);
    } else if (teacherSettings) {
      const eventCalendarIds =
        teacherSettings.event_calendar_ids?.length
          ? teacherSettings.event_calendar_ids
          : teacherSettings.sync_calendar_ids?.length
            ? teacherSettings.sync_calendar_ids
            : teacherSettings.calendar_id
              ? [teacherSettings.calendar_id]
              : [];
      const eventCalendarNames =
        teacherSettings.event_calendar_names?.length
          ? teacherSettings.event_calendar_names
          : teacherSettings.sync_calendar_names?.length
            ? teacherSettings.sync_calendar_names
            : teacherSettings.calendar_name
              ? [teacherSettings.calendar_name]
              : [];
      const availabilityCalendarIds =
        teacherSettings.availability_calendar_ids?.length
          ? teacherSettings.availability_calendar_ids
          : teacherSettings.sync_calendar_ids?.length
            ? teacherSettings.sync_calendar_ids
            : eventCalendarIds;
      const availabilityCalendarNames =
        teacherSettings.availability_calendar_names?.length
          ? teacherSettings.availability_calendar_names
          : teacherSettings.sync_calendar_names?.length
            ? teacherSettings.sync_calendar_names
            : eventCalendarNames;

      setCalendarSettings({
        providerAccountEmail: teacherSettings.provider_account_email || "",
        calendarId: teacherSettings.calendar_id || "",
        calendarName: teacherSettings.calendar_name || "",
        eventCalendarIds,
        eventCalendarNames,
        availabilityCalendarIds,
        availabilityCalendarNames,
        bookingPageUrl: teacherSettings.booking_page_url || "",
        timezone: teacherSettings.timezone || "America/Bahia",
        syncMode: teacherSettings.sync_mode || "booking_link",
        availabilityWeekdays:
          teacherSettings.availability_weekdays?.length
            ? teacherSettings.availability_weekdays
            : [1, 2, 3, 4, 5],
        availabilityStartTime: teacherSettings.availability_start_time || "08:00",
        availabilityEndTime: teacherSettings.availability_end_time || "18:00",
        availabilitySlotMinutes: String(
          teacherSettings.availability_slot_minutes || 60,
        ),
        availabilityHorizonDays: String(
          teacherSettings.availability_horizon_days || 21,
        ),
        autoCreateMeet: teacherSettings.auto_create_meet ?? true,
        isActive: teacherSettings.is_active ?? true,
        connectionStatus: teacherSettings.connection_status || "disconnected",
        lastSyncedAt: teacherSettings.last_synced_at || "",
        lastSyncError: teacherSettings.last_sync_error || "",
      });
    } else {
      setCalendarSettings(initialCalendarSettings);
    }

    if (lessonsError) {
      console.error("Erro ao buscar agenda da professora:", lessonsError.message);
      setSessions([]);
      setAccessCounts({});
      setLoading(false);
      return;
    }

    const lessonRows = scheduledLessons || [];
    setSessions(lessonRows);

    if (lessonRows.length > 0) {
      const lessonIds = lessonRows.map((lesson) => lesson.id);
      const { data: logs, error: logsError } = await supabase
        .from("lesson_access_logs")
        .select("scheduled_lesson_id")
        .in("scheduled_lesson_id", lessonIds);

      if (logsError) {
        console.error("Erro ao buscar acessos:", logsError.message);
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
  }

  const studentNameMap = useMemo(
    () =>
      Object.fromEntries(
        students.map((student) => [student.id, student.full_name || "Aluno"]),
      ),
    [students],
  );

  const upcomingEvents = sessions.filter(
    (session) =>
      session.status === "scheduled" &&
      new Date(session.starts_at).getTime() >= Date.now(),
  );

  const pastEvents = sessions.filter(
    (session) =>
      session.status !== "available" &&
      (session.status === "cancelled" ||
        session.status === "completed" ||
        new Date(session.starts_at).getTime() < Date.now()),
  );

  const availableSessions = sessions.filter(
    (session) =>
      session.status === "available" &&
      new Date(session.starts_at).getTime() >= Date.now(),
  );

  const fetchGoogleCalendars = async () => {
    const { data, error } = await supabase.functions.invoke(
      "google-calendar-list-calendars",
      {
        body: {},
      },
    );

    if (error) {
      alert(error.message);
      return;
    }

    setGoogleCalendars(data?.calendars || []);
  };

  const connectGoogleCalendar = async () => {
    setConnectingGoogle(true);

    const redirectTo = `${window.location.origin}/agendamentos`;
    const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
      body: {
        redirectTo,
      },
    });

    if (error || !data?.authUrl) {
      alert(error?.message || "Nao foi possivel iniciar a conexao com o Google.");
      setConnectingGoogle(false);
      return;
    }

    window.location.href = data.authUrl;
  };

  const completeGoogleConnection = async (code: string, state: string) => {
    setProcessingGoogleCallback(true);

    const redirectTo = `${window.location.origin}/agendamentos`;
    const { error } = await supabase.functions.invoke("google-calendar-exchange", {
      body: {
        code,
        state,
        redirectTo,
      },
    });

    window.history.replaceState({}, document.title, "/agendamentos");

    if (error) {
      alert(error.message);
      setProcessingGoogleCallback(false);
      return;
    }

    alert("Google Calendar conectado com sucesso.");
    await fetchSchedulingData();

    if (calendarSettings.syncMode === "calendar_sync") {
      await syncGoogleCalendar();
    }

    setProcessingGoogleCallback(false);
  };

  const syncGoogleCalendar = async ({ silent = false }: SyncOptions = {}) => {
    if (calendarSettings.eventCalendarIds.length === 0) {
      if (!silent) {
        alert("Escolha primeiro qual agenda do Google sera sincronizada.");
      }
      setShowEventSettingsModal(true);
      return;
    }

    setSyncingGoogle(true);

    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: {},
    });

    if (error) {
      if (!silent) {
        alert(error.message);
      } else {
        throw new Error(await getFunctionErrorMessage(error));
      }
    } else {
      if (!silent) {
        alert(
          `Sincronizacao concluida. ${data?.importedEvents || 0} evento(s) importado(s).`,
        );
      }
      await fetchSchedulingData();
    }

    setSyncingGoogle(false);
  };

  const syncGoogleAvailability = async ({ silent = false }: SyncOptions = {}) => {
    if (calendarSettings.availabilityCalendarIds.length === 0) {
      if (!silent) {
        alert("Escolha primeiro pelo menos uma agenda para sincronizar a disponibilidade.");
      }
      setShowAvailabilitySettingsModal(true);
      return;
    }

    setSyncingAvailability(true);

    const { data, error } = await supabase.functions.invoke(
      "google-calendar-sync-availability",
      {
        body: {},
      },
    );

    if (error) {
      if (!silent) {
        alert(error.message);
      } else {
        throw new Error(await getFunctionErrorMessage(error));
      }
    } else {
      if (!silent) {
        alert(
          `Disponibilidade sincronizada. ${data?.availableSlots || 0} horario(s) livre(s) publicado(s).`,
        );
      }
      await fetchSchedulingData();
    }

    setSyncingAvailability(false);
  };

  const runAutomaticSchedulingSync = async () => {
    const agendaResult = await supabase.functions.invoke("google-calendar-sync", {
      body: {},
    });
    const availabilityResult = await supabase.functions.invoke(
      "google-calendar-sync-availability",
      {
        body: {},
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

  const handleSaveEventSettings = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUserId) return;

    setSavingCalendarSettings(true);

    const { error } = await supabase.from("teacher_calendar_settings").upsert({
      teacher_id: currentUserId,
      provider: "google_calendar",
      provider_account_email: calendarSettings.providerAccountEmail.trim() || null,
      calendar_id:
        calendarSettings.eventCalendarIds[0] || calendarSettings.calendarId.trim() || null,
      calendar_name:
        calendarSettings.eventCalendarNames[0] || calendarSettings.calendarName.trim() || null,
      sync_calendar_ids: calendarSettings.eventCalendarIds,
      sync_calendar_names: calendarSettings.eventCalendarNames,
      event_calendar_ids: calendarSettings.eventCalendarIds,
      event_calendar_names: calendarSettings.eventCalendarNames,
      booking_page_url: calendarSettings.bookingPageUrl.trim() || null,
      timezone: calendarSettings.timezone.trim() || null,
      sync_mode: calendarSettings.syncMode,
      auto_create_meet: calendarSettings.autoCreateMeet,
      is_active: calendarSettings.isActive,
      connection_status: calendarSettings.connectionStatus,
      last_synced_at: calendarSettings.lastSyncedAt || null,
      last_sync_error: calendarSettings.lastSyncError || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
    } else {
      try {
        await syncGoogleCalendar({ silent: true });
        alert("Configuracao da agenda principal salva e sincronizada com sucesso.");
      } catch (syncError) {
        alert(
          syncError instanceof Error
            ? `Configuracao salva, mas a sincronizacao da agenda falhou: ${syncError.message}`
            : "Configuracao salva, mas a sincronizacao da agenda falhou.",
        );
      }

      setShowEventSettingsModal(false);
      await fetchSchedulingData();
    }

    setSavingCalendarSettings(false);
  };

  const handleSaveAvailabilitySettings = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUserId) return;

    setSavingCalendarSettings(true);

    const { error } = await supabase.from("teacher_calendar_settings").upsert({
      teacher_id: currentUserId,
      provider: "google_calendar",
      availability_calendar_ids: calendarSettings.availabilityCalendarIds,
      availability_calendar_names: calendarSettings.availabilityCalendarNames,
      timezone: calendarSettings.timezone.trim() || null,
      availability_weekdays: calendarSettings.availabilityWeekdays,
      availability_start_time: calendarSettings.availabilityStartTime,
      availability_end_time: calendarSettings.availabilityEndTime,
      availability_slot_minutes: Number(calendarSettings.availabilitySlotMinutes) || 60,
      availability_horizon_days: Number(calendarSettings.availabilityHorizonDays) || 21,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
    } else {
      try {
        await syncGoogleAvailability({ silent: true });
        alert("Configuracao de disponibilidade salva e sincronizada com sucesso.");
      } catch (syncError) {
        alert(
          syncError instanceof Error
            ? `Configuracao salva, mas a sincronizacao da disponibilidade falhou: ${syncError.message}`
            : "Configuracao salva, mas a sincronizacao da disponibilidade falhou.",
        );
      }

      setShowAvailabilitySettingsModal(false);
      await fetchSchedulingData();
    }

    setSavingCalendarSettings(false);
  };

  const handleToggleEventCalendar = (calendarId: string, checked: boolean) => {
    const nextIds = checked
      ? [...calendarSettings.eventCalendarIds, calendarId]
      : calendarSettings.eventCalendarIds.filter((id) => id !== calendarId);

    const nextNames = googleCalendars
      .filter((item) => nextIds.includes(item.id))
      .map((item) => item.summary);

    setCalendarSettings({
      ...calendarSettings,
      eventCalendarIds: nextIds,
      eventCalendarNames: nextNames,
      calendarId: nextIds[0] || "",
      calendarName: nextNames[0] || "",
    });
  };

  const handleToggleAvailabilityCalendar = (calendarId: string, checked: boolean) => {
    const nextIds = checked
      ? [...calendarSettings.availabilityCalendarIds, calendarId]
      : calendarSettings.availabilityCalendarIds.filter((id) => id !== calendarId);

    const nextNames = googleCalendars
      .filter((item) => nextIds.includes(item.id))
      .map((item) => item.summary);

    setCalendarSettings({
      ...calendarSettings,
      availabilityCalendarIds: nextIds,
      availabilityCalendarNames: nextNames,
    });
  };

  const openReservationModal = (session: any) => {
    setSelectedSlotForReservation(session);
    setReservationForm({
      ...initialReservationForm,
      studentId: searchParams.get("studentId") || "",
    });
  };

  const handleConfirmReservation = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedSlotForReservation) return;

    if (!reservationForm.studentId) {
      alert("Selecione o aluno para confirmar a aula.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.functions.invoke("confirm-platform-lesson", {
      body: {
        lessonId: selectedSlotForReservation.id,
        studentId: reservationForm.studentId,
        sessionTrack: reservationForm.sessionTrack,
        isRecurring: reservationForm.isRecurring,
        recurrenceCount: reservationForm.recurrenceCount,
      },
    });

    if (error) {
      alert(await getFunctionErrorMessage(error));
    } else {
      try {
        await runAutomaticSchedulingSync();
      } catch (syncError) {
        console.error("Falha ao sincronizar agenda apos o agendamento:", syncError);
      }

      alert("Aula agendada com sucesso. O Meet ja foi gerado e vinculado ao horario.");
      setSelectedSlotForReservation(null);
      setReservationForm(initialReservationForm);
      fetchSchedulingData();
    }

    setSaving(false);
  };

  const updateSessionStatus = async (
    sessionId: string,
    status: "completed" | "cancelled",
  ) => {
    const updates =
      status === "completed"
        ? {
            status,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            status,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

    const { error } = await supabase
      .from("scheduled_lessons")
      .update(updates)
      .eq("id", sessionId);

    if (error) {
      alert(error.message);
    } else {
      fetchSchedulingData();
    }
  };

  if (loading) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Organizando agenda...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="rounded-3xl bg-white/5 p-5 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                Agenda de aulas
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                Mentorias, aulas e Google Agenda
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-white/60">
                Conecte sua agenda, sincronize eventos e gerencie os horarios da plataforma.
              </p>

              <div className="mt-3 grid max-w-lg gap-2 sm:grid-cols-3">
                <SmallStat label="Alunos vinculados" value={students.length} />
                <SmallStat label="Proximas aulas" value={upcomingEvents.length} />
                <SmallStat
                  label="Total de acessos"
                  value={Object.values(accessCounts).reduce((sum, count) => sum + count, 0)}
                />
              </div>

              <div className="mt-3">
                <div className="inline-flex min-w-[32rem] rounded-2xl bg-brand-900/70 p-1.5 ring-1 ring-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveView("events")}
                    className={`flex-1 rounded-2xl px-5 py-2.5 text-sm font-bold transition ${
                      activeView === "events"
                        ? "bg-white text-brand-900"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Agenda ativa
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("availability")}
                    className={`flex-1 rounded-2xl px-5 py-2.5 text-sm font-bold transition ${
                      activeView === "availability"
                        ? "bg-white text-brand-900"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Horarios disponiveis
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 lg:w-[18.5rem]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Status da conexao
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {calendarSettings.connectionStatus === "connected"
                    ? "Google Calendar conectado"
                    : calendarSettings.connectionStatus === "pending"
                      ? "Aguardando autorizacao do Google"
                      : calendarSettings.connectionStatus === "error"
                        ? "Conexao com erro"
                        : "Ainda nao conectado"}
                </p>
                {calendarSettings.lastSyncedAt && (
                  <p className="mt-1 text-xs text-white/45">
                    Ultima sincronizacao: {formatDateTime(calendarSettings.lastSyncedAt)}
                  </p>
                )}
                {calendarSettings.lastSyncError && (
                  <p className="mt-1 text-xs text-rose-200">
                    {calendarSettings.lastSyncError}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {calendarSettings.calendarName && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-brand-ice ring-1 ring-white/10">
                      {calendarSettings.calendarName}
                    </span>
                  )}
                  {calendarSettings.eventCalendarNames.length > 1 && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 ring-1 ring-white/10">
                      + {calendarSettings.eventCalendarNames.length - 1} agenda(s) de eventos
                    </span>
                  )}
                  {calendarSettings.availabilityCalendarNames.length > 0 && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 ring-1 ring-white/10">
                      {calendarSettings.availabilityCalendarNames.length} agenda(s) bloqueando disponibilidade
                    </span>
                  )}
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 ring-1 ring-white/10">
                    {calendarSettings.availabilityStartTime} - {calendarSettings.availabilityEndTime} | {calendarSettings.availabilitySlotMinutes} min
                  </span>
                </div>
              </div>

              <div className="grid gap-2 lg:w-44">
                <button
                  type="button"
                  onClick={() => setShowEventSettingsModal(true)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-2.5 py-4 text-xs font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Configurar Agenda
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void syncGoogleCalendar();
                  }}
                  disabled={
                    syncingGoogle ||
                    processingGoogleCallback ||
                    calendarSettings.connectionStatus !== "connected"
                  }
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-2.5 py-4 text-xs font-bold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingGoogle ? "Sincronizando..." : "Sincronizar Agenda"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAvailabilitySettingsModal(true)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-2.5 py-4 text-xs font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Configurar Disponibilidade
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void syncGoogleAvailability();
                  }}
                  disabled={
                    syncingAvailability ||
                    processingGoogleCallback ||
                    calendarSettings.connectionStatus !== "connected"
                  }
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-2.5 py-4 text-xs font-bold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingAvailability
                    ? "Atualizando..."
                    : "Sincronizar Disponibilidade"}
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="hidden">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            </div>
          </div>

          <div className="hidden mt-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
              Status da conexao
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {calendarSettings.connectionStatus === "connected"
                ? "Google Calendar conectado"
                : calendarSettings.connectionStatus === "pending"
                  ? "Aguardando autorizacao do Google"
                  : calendarSettings.connectionStatus === "error"
                    ? "Conexao com erro"
                    : "Ainda nao conectado"}
            </p>
            {calendarSettings.lastSyncedAt && (
              <p className="mt-1 text-xs text-white/45">
                Ultima sincronizacao: {formatDateTime(calendarSettings.lastSyncedAt)}
              </p>
            )}
            {calendarSettings.lastSyncError && (
              <p className="mt-1 text-xs text-rose-200">
                {calendarSettings.lastSyncError}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {calendarSettings.calendarName && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-brand-ice ring-1 ring-white/10">
                  {calendarSettings.calendarName}
                </span>
              )}
              {calendarSettings.eventCalendarNames.length > 1 && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 ring-1 ring-white/10">
                  + {calendarSettings.eventCalendarNames.length - 1} agenda(s) de eventos
                </span>
              )}
              {calendarSettings.availabilityCalendarNames.length > 0 && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60 ring-1 ring-white/10">
                  {calendarSettings.availabilityCalendarNames.length} agenda(s) bloqueando disponibilidade
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-white/45">
              Janela de atendimento:{" "}
              {calendarSettings.availabilityStartTime} - {calendarSettings.availabilityEndTime}
              {" · "}
              {calendarSettings.availabilitySlotMinutes} min
            </p>
          </div>
        </section>

        {activeView === "events" ? (
          <div className="mt-8 grid gap-8">
            <SessionList
              eyebrow="Agenda ativa"
              title="Eventos e aulas confirmadas"
              sessions={upcomingEvents}
              studentNameMap={studentNameMap}
              accessCounts={accessCounts}
              onUpdateStatus={updateSessionStatus}
              compactGrid
            />

            <SessionList
              eyebrow="Historico"
              title="Eventos passados e cancelados"
              sessions={pastEvents}
              studentNameMap={studentNameMap}
              accessCounts={accessCounts}
              onUpdateStatus={updateSessionStatus}
              past
            />
          </div>
        ) : (
          <div className="mt-8">
            <AvailableSlotList
              title="Horarios publicados para agendamento"
              description="Cada horario disponivel pode ser reservado pela propria professora. Ao clicar em agendar, voce so escolhe o aluno e o tipo de jornada. O sistema gera o Meet e vincula tudo automaticamente ao agendamento."
              sessions={availableSessions}
              studentNameMap={studentNameMap}
              onReserve={openReservationModal}
            />
          </div>
        )}
      </div>

      {selectedSlotForReservation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={() => setSelectedSlotForReservation(null)}
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
                  Agendar horario ja publicado
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  O horario, o Meet e o convite serao fechados assim que voce salvar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSlotForReservation(null)}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleConfirmReservation} className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Horario selecionado
                </p>
                <p className="mt-2 text-lg font-bold text-white">
                  {selectedSlotForReservation.title}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  {formatDateTime(selectedSlotForReservation.starts_at)} ate{" "}
                  {formatDateTime(selectedSlotForReservation.ends_at)}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Aluno">
                  <select
                    className={fieldInputClass}
                    value={reservationForm.studentId}
                    onChange={(event) =>
                      setReservationForm({
                        ...reservationForm,
                        studentId: event.target.value,
                      })
                    }
                  >
                    <option value="">Escolha um aluno...</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id} className="bg-gray-900">
                        {student.full_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de jornada">
                  <select
                    className={fieldInputClass}
                    value={reservationForm.sessionTrack}
                    onChange={(event) =>
                      setReservationForm({
                        ...reservationForm,
                        sessionTrack: event.target.value,
                      })
                    }
                  >
                    <option value="mentoring" className="bg-gray-900">
                      Mentoria
                    </option>
                    <option value="course" className="bg-gray-900">
                      Curso completo
                    </option>
                  </select>
                </Field>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <label className="flex items-center gap-3 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={reservationForm.isRecurring}
                    onChange={(event) =>
                      setReservationForm({
                        ...reservationForm,
                        isRecurring: event.target.checked,
                      })
                    }
                  />
                  Transformar em agendamento recorrente semanal
                </label>

                {reservationForm.isRecurring && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Quantidade de encontros">
                      <input
                        type="number"
                        min={2}
                        className={fieldInputClass}
                        value={reservationForm.recurrenceCount}
                        onChange={(event) =>
                          setReservationForm({
                            ...reservationForm,
                            recurrenceCount: event.target.value,
                          })
                        }
                      />
                    </Field>

                    <div className="rounded-2xl bg-brand-900/40 p-4 text-sm leading-6 text-white/60 ring-1 ring-white/10">
                      A plataforma vai repetir esse horario a cada 7 dias, gerar os
                      convites no Google e bloquear a agenda recorrente.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setSelectedSlotForReservation(null)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Agendando..." : "Reservar e gerar Meet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEventSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={() => setShowEventSettingsModal(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-[#140f25] p-6 shadow-soft ring-1 ring-white/10 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Agenda principal
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Eventos que entram na plataforma
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                  Escolha aqui as agendas que realmente devem aparecer na area de eventos.
                  A primeira agenda selecionada vira a principal para criar convites e gerar o Meet.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowEventSettingsModal(false)}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveEventSettings} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Modo atual">
                  <select
                    className={fieldInputClass}
                    value={calendarSettings.syncMode}
                    onChange={(event) =>
                      setCalendarSettings({
                        ...calendarSettings,
                        syncMode: event.target.value,
                      })
                    }
                  >
                    <option value="booking_link" className="bg-gray-900">
                      Usar link publico da agenda
                    </option>
                    <option value="calendar_sync" className="bg-gray-900">
                      Sincronizar eventos da conta Google
                    </option>
                  </select>
                </Field>

                <Field label="Agenda ativa">
                  <label className="flex h-[50px] items-center gap-3 rounded-2xl bg-brand-900/60 px-4 text-sm font-semibold text-white ring-1 ring-white/10">
                    <input
                      type="checkbox"
                      checked={calendarSettings.isActive}
                      onChange={(event) =>
                        setCalendarSettings({
                          ...calendarSettings,
                          isActive: event.target.checked,
                        })
                      }
                    />
                    Usar esta agenda do Google na plataforma
                  </label>
                </Field>
              </div>

              <Field label="Link da booking page">
                <input
                  className={fieldInputClass}
                  value={calendarSettings.bookingPageUrl}
                  onChange={(event) =>
                    setCalendarSettings({
                      ...calendarSettings,
                      bookingPageUrl: event.target.value,
                    })
                  }
                  placeholder="https://calendar.app.google/..."
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="E-mail da conta Google">
                  <input
                    type="email"
                    className={fieldInputClass}
                    value={calendarSettings.providerAccountEmail}
                    onChange={(event) =>
                      setCalendarSettings({
                        ...calendarSettings,
                        providerAccountEmail: event.target.value,
                      })
                    }
                    placeholder="professora@email.com"
                  />
                </Field>

                <Field label="Agendas que trazem eventos">
                  <div className="rounded-2xl bg-brand-900/60 p-4 ring-1 ring-white/10">
                    {calendarSettings.connectionStatus !== "connected" ? (
                      <p className="text-sm text-white/55">
                        Conecte o Google primeiro para escolher quais agendas trarao eventos.
                      </p>
                    ) : googleCalendars.length === 0 ? (
                      <p className="text-sm text-white/55">
                        Clique em "Atualizar agendas" para carregar suas agendas do Google.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {googleCalendars.map((calendar) => {
                          const checked = calendarSettings.eventCalendarIds.includes(
                            calendar.id,
                          );

                          return (
                            <label
                              key={calendar.id}
                              className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  handleToggleEventCalendar(calendar.id, event.target.checked)
                                }
                              />

                              <span>
                                <span className="block font-semibold text-white">
                                  {calendar.summary}
                                  {calendar.primary ? " - principal" : ""}
                                </span>
                                <span className="mt-1 block text-xs text-white/45">
                                  {checked
                                    ? calendarSettings.eventCalendarIds[0] === calendar.id
                                      ? "Agenda principal de criacao, Meet e sincronizacao."
                                      : "Agenda adicional incluida na agenda ativa da plataforma."
                                    : "Nao aparece na agenda ativa da plataforma."}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Timezone">
                  <input
                    className={fieldInputClass}
                    value={calendarSettings.timezone}
                    onChange={(event) =>
                      setCalendarSettings({
                        ...calendarSettings,
                        timezone: event.target.value,
                      })
                    }
                    placeholder="America/Bahia"
                  />
                </Field>

                <Field label="Meet automatico">
                  <label className="flex h-[50px] items-center gap-3 rounded-2xl bg-brand-900/60 px-4 text-sm font-semibold text-white ring-1 ring-white/10">
                    <input
                      type="checkbox"
                      checked={calendarSettings.autoCreateMeet}
                      onChange={(event) =>
                        setCalendarSettings({
                          ...calendarSettings,
                          autoCreateMeet: event.target.checked,
                        })
                      }
                    />
                    Esperar ou reutilizar o link do Meet
                  </label>
                </Field>
              </div>

              <div className="rounded-2xl bg-brand-lavender/10 p-4 text-sm leading-6 text-brand-ice ring-1 ring-brand-lavender/20">
                As agendas que bloqueiam disponibilidade agora ficam em uma configuracao separada.
                Assim, voce pode importar so a agenda de aulas para a plataforma e ainda respeitar
                compromissos pessoais na geracao dos horarios livres.
              </div>

              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                      Status da conexao
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {calendarSettings.connectionStatus === "connected"
                        ? "Google Calendar conectado"
                        : calendarSettings.connectionStatus === "pending"
                          ? "Aguardando autorizacao do Google"
                          : calendarSettings.connectionStatus === "error"
                            ? "Conexao com erro"
                            : "Ainda nao conectado"}
                    </p>
                    {calendarSettings.lastSyncedAt && (
                      <p className="mt-2 text-xs text-white/45">
                        Ultima sincronizacao: {formatDateTime(calendarSettings.lastSyncedAt)}
                      </p>
                    )}
                    {calendarSettings.lastSyncError && (
                      <p className="mt-2 text-xs text-rose-200">
                        {calendarSettings.lastSyncError}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={connectGoogleCalendar}
                    disabled={connectingGoogle || processingGoogleCallback}
                    className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {connectingGoogle ? "Conectando..." : "Conectar Google"}
                  </button>

                  {calendarSettings.connectionStatus === "connected" && (
                    <button
                      type="button"
                      onClick={fetchGoogleCalendars}
                      className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                    >
                      Atualizar agendas
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-brand-lavender/10 p-4 text-sm leading-6 text-brand-ice ring-1 ring-brand-lavender/20">
                No modo de booking page, o aluno agenda pelo link publico do
                Google. No modo de sincronizacao, voce escolhe quais agendas da
                sua conta enviam eventos para a plataforma. Os bloqueios de
                disponibilidade ficam na configuracao separada logo ao lado.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowEventSettingsModal(false)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCalendarSettings}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCalendarSettings ? "Salvando..." : "Salvar agenda principal"}
                </button>

                {calendarSettings.bookingPageUrl && (
                  <a
                    href={calendarSettings.bookingPageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                  >
                    Abrir booking page
                  </a>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showAvailabilitySettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={() => setShowAvailabilitySettingsModal(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-[#140f25] p-6 shadow-soft ring-1 ring-white/10 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                  Disponibilidade
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Agendas que bloqueiam horarios livres
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                  Selecione aqui as agendas que devem entrar no calculo de conflitos.
                  Elas nao aparecem na agenda ativa da plataforma, mas impedem
                  que voce fique disponivel quando tiver compromissos pessoais ou paralelos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAvailabilitySettingsModal(false)}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveAvailabilitySettings} className="mt-6 space-y-4">
              <Field label="Agendas que bloqueiam a disponibilidade">
                <div className="rounded-2xl bg-brand-900/60 p-4 ring-1 ring-white/10">
                  {calendarSettings.connectionStatus !== "connected" ? (
                    <p className="text-sm text-white/55">
                      Conecte o Google primeiro para escolher quais agendas bloqueiam sua disponibilidade.
                    </p>
                  ) : googleCalendars.length === 0 ? (
                    <p className="text-sm text-white/55">
                      Clique em "Atualizar agendas" para carregar suas agendas do Google.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {googleCalendars.map((calendar) => {
                        const checked = calendarSettings.availabilityCalendarIds.includes(
                          calendar.id,
                        );

                        return (
                          <label
                            key={calendar.id}
                            className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                handleToggleAvailabilityCalendar(
                                  calendar.id,
                                  event.target.checked,
                                )
                              }
                            />

                            <span>
                              <span className="block font-semibold text-white">
                                {calendar.summary}
                                {calendar.primary ? " - principal" : ""}
                              </span>
                              <span className="mt-1 block text-xs text-white/45">
                                {checked
                                  ? "Esta agenda bloqueia horarios livres quando houver conflito."
                                  : "Nao interfere na geracao de disponibilidade."}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Timezone">
                  <input
                    className={fieldInputClass}
                    value={calendarSettings.timezone}
                    onChange={(event) =>
                      setCalendarSettings({
                        ...calendarSettings,
                        timezone: event.target.value,
                      })
                    }
                    placeholder="America/Bahia"
                  />
                </Field>

                <Field label="Dias futuros para gerar">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className={fieldInputClass}
                    value={calendarSettings.availabilityHorizonDays}
                    onChange={(event) =>
                      setCalendarSettings({
                        ...calendarSettings,
                        availabilityHorizonDays: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>

              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                  Janela de atendimento
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Inicio do atendimento">
                    <input
                      type="time"
                      className={fieldInputClass}
                      value={calendarSettings.availabilityStartTime}
                      onChange={(event) =>
                        setCalendarSettings({
                          ...calendarSettings,
                          availabilityStartTime: event.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Fim do atendimento">
                    <input
                      type="time"
                      className={fieldInputClass}
                      value={calendarSettings.availabilityEndTime}
                      onChange={(event) =>
                        setCalendarSettings({
                          ...calendarSettings,
                          availabilityEndTime: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Duracao de cada slot (min)">
                    <input
                      type="number"
                      min={15}
                      step={15}
                      className={fieldInputClass}
                      value={calendarSettings.availabilitySlotMinutes}
                      onChange={(event) =>
                        setCalendarSettings({
                          ...calendarSettings,
                          availabilitySlotMinutes: event.target.value,
                        })
                      }
                    />
                  </Field>

                  <div className="rounded-2xl bg-brand-900/40 p-4 text-sm leading-6 text-white/60 ring-1 ring-white/10">
                    A plataforma so publicara horarios dentro desta janela e fora
                    dos conflitos detectados nas agendas marcadas acima.
                  </div>
                </div>

                <div className="mt-4">
                  <p className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Dias da semana
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {[
                      { label: "Seg", value: 1 },
                      { label: "Ter", value: 2 },
                      { label: "Qua", value: 3 },
                      { label: "Qui", value: 4 },
                      { label: "Sex", value: 5 },
                      { label: "Sab", value: 6 },
                      { label: "Dom", value: 7 },
                    ].map((weekday) => (
                      <label
                        key={weekday.value}
                        className="flex items-center gap-3 rounded-2xl bg-brand-900/60 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={calendarSettings.availabilityWeekdays.includes(
                            weekday.value,
                          )}
                          onChange={(event) => {
                            const nextWeekdays = event.target.checked
                              ? [...calendarSettings.availabilityWeekdays, weekday.value].sort()
                              : calendarSettings.availabilityWeekdays.filter(
                                  (value) => value !== weekday.value,
                                );

                            setCalendarSettings({
                              ...calendarSettings,
                              availabilityWeekdays: nextWeekdays,
                            });
                          }}
                        />
                        {weekday.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowAvailabilitySettingsModal(false)}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCalendarSettings}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCalendarSettings ? "Salvando..." : "Salvar disponibilidade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <label className="block">
    <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </span>
    <div className="mt-2">{children}</div>
  </label>
);

const AvailableSlotList = ({
  title,
  description,
  sessions,
  studentNameMap,
  onReserve,
}: {
  title: string;
  description?: string;
  sessions: any[];
  studentNameMap: Record<string, string>;
  onReserve: (session: any) => void;
}) => (
  <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      Pagina de agendamento
    </p>
    <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
    {description && (
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
        {description}
      </p>
    )}

    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
          Nenhum horario livre publicado no momento.
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
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 ring-1 ring-white/10">
                  Disponivel
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{session.title}</h3>
                <p className="mt-2 text-xs text-white/60">
                  {formatDateTime(session.starts_at)} ate {formatDateTime(session.ends_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-white/55">
                <span>
                  {session.student_id
                    ? `Aluno vinculado: ${studentNameMap[session.student_id] || "Aluno"}`
                    : "Aguardando reserva de aluno"}
                </span>
                {session.recurrence_group_id && (
                  <span>Recorrencia #{session.recurrence_index}</span>
                )}
              </div>

              <p className="text-xs text-white/40">
                Este horario aparece na parte de agendamento da plataforma e
                pode ser reservado por alunos vinculados.
              </p>

              <button
                type="button"
                onClick={() => onReserve(session)}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
              >
                Agendar
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  </section>
);

const SmallStat = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="rounded-2xl bg-white/5 px-2 py-2 text-center ring-1 ring-white/10">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
    <p className="mt-1 text-lg font-extrabold text-white">{value}</p>
  </div>
);

const SessionList = ({
  eyebrow,
  title,
  sessions,
  studentNameMap,
  accessCounts,
  onUpdateStatus,
  past = false,
  compactGrid = false,
}: {
  eyebrow: string;
  title: string;
  sessions: any[];
  studentNameMap: Record<string, string>;
  accessCounts: Record<string, number>;
  onUpdateStatus: (sessionId: string, status: "completed" | "cancelled") => void;
  past?: boolean;
  compactGrid?: boolean;
}) => (
  <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>

    <div
      className={`mt-6 ${
        compactGrid ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-4"
      }`}
    >
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
          Nenhum registro nesta secao ainda.
        </div>
      ) : (
        sessions.map((session) => (
          <article
            key={session.id}
            className={`rounded-[2rem] bg-white/5 ring-1 ring-white/10 ${
              compactGrid ? "p-4" : "p-5"
            }`}
          >
            <div
              className={`flex flex-col ${
                compactGrid ? "gap-4" : "gap-5 lg:flex-row lg:items-start lg:justify-between"
              }`}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
                    {session.session_track === "course" ? "Curso completo" : "Mentoria"}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
                    {session.status === "available"
                      ? "Disponivel"
                      : session.status === "completed"
                        ? "Concluida"
                        : session.status === "cancelled"
                          ? "Cancelada"
                          : "Agendada"}
                  </span>
                </div>

                <div>
                  <h3 className={`${compactGrid ? "text-base" : "text-lg"} font-bold text-white`}>
                    {session.title}
                  </h3>
                  <p className={`mt-2 ${compactGrid ? "text-xs" : "text-sm"} text-white/60`}>
                    {formatDateTime(session.starts_at)} ate {formatDateTime(session.ends_at)}
                  </p>
                </div>

                <div
                  className={`flex flex-wrap gap-3 ${
                    compactGrid ? "text-xs" : "text-sm"
                  } text-white/55`}
                >
                  <span>
                    {session.student_id
                      ? `Aluno: ${studentNameMap[session.student_id] || "Aluno"}`
                      : "Horario livre para reserva"}
                  </span>
                  <span>Acessos: {accessCounts[session.id] || 0}</span>
                  {session.recurrence_group_id && (
                    <span>Recorrencia #{session.recurrence_index}</span>
                  )}
                </div>

                {session.meet_link ? (
                  <a
                    href={session.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 ${
                      compactGrid ? "text-xs" : "text-sm"
                    } font-semibold text-brand-ice hover:text-white`}
                  >
                    Abrir link da aula
                  </a>
                ) : (
                  <p className={`${compactGrid ? "text-xs" : "text-sm"} text-white/40`}>
                    Link da aula ainda nao informado.
                  </p>
                )}
              </div>

              {!past && (
                <div className={`flex ${compactGrid ? "flex-col" : ""} gap-2`}>
                  {session.status !== "completed" && session.status !== "cancelled" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(session.id, "completed")}
                        className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                      >
                        Concluir
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(session.id, "cancelled")}
                        className="inline-flex items-center justify-center rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200 ring-1 ring-rose-400/20 transition hover:bg-rose-500/20"
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {session.student_id && (
                    <Link
                      to={`/historico/${session.student_id}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                    >
                      Ver aluno
                    </Link>
                  )}
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  </section>
);
