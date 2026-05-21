import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { supabase } from "../lib/supabaseClient";

const initialForm = {
  mode: "available",
  sessionTrack: "mentoring",
  title: "",
  description: "",
  studentId: "",
  startsAt: "",
  durationMinutes: "60",
  meetLink: "",
  isRecurring: false,
  recurrenceCount: "1",
};

const initialCalendarSettings = {
  providerAccountEmail: "",
  calendarId: "",
  bookingPageUrl: "",
  timezone: "America/Bahia",
  syncMode: "booking_link",
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

const fieldInputClass =
  "w-full rounded-2xl bg-brand-900/60 p-3 text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-brand-lavender";

export const TeacherScheduling = () => {
  const [searchParams] = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [accessCounts, setAccessCounts] = useState<Record<string, number>>({});
  const [calendarSettings, setCalendarSettings] = useState(initialCalendarSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCalendarSettings, setSavingCalendarSettings] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [processingGoogleCallback, setProcessingGoogleCallback] = useState(false);
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);
  const [form, setForm] = useState({
    ...initialForm,
    studentId: searchParams.get("studentId") || "",
  });

  useEffect(() => {
    fetchSchedulingData();
  }, []);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!currentUserId || !code || !state || processingGoogleCallback) {
      return;
    }

    void completeGoogleConnection(code, state);
  }, [currentUserId, processingGoogleCallback, searchParams]);

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
      setCalendarSettings({
        providerAccountEmail: teacherSettings.provider_account_email || "",
        calendarId: teacherSettings.calendar_id || "",
        bookingPageUrl: teacherSettings.booking_page_url || "",
        timezone: teacherSettings.timezone || "America/Bahia",
        syncMode: teacherSettings.sync_mode || "booking_link",
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

  const upcomingSessions = sessions.filter(
    (session) =>
      session.status !== "cancelled" &&
      new Date(session.starts_at).getTime() >= Date.now(),
  );

  const pastSessions = sessions.filter(
    (session) =>
      session.status === "cancelled" ||
      new Date(session.starts_at).getTime() < Date.now(),
  );

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

  const syncGoogleCalendar = async () => {
    setSyncingGoogle(true);

    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: {},
    });

    if (error) {
      alert(error.message);
    } else {
      alert(
        `Sincronizacao concluida. ${data?.importedEvents || 0} evento(s) importado(s).`,
      );
      await fetchSchedulingData();
    }

    setSyncingGoogle(false);
  };

  const handleSaveCalendarSettings = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUserId) return;

    setSavingCalendarSettings(true);

    const { error } = await supabase.from("teacher_calendar_settings").upsert({
      teacher_id: currentUserId,
      provider: "google_calendar",
      provider_account_email: calendarSettings.providerAccountEmail.trim() || null,
      calendar_id: calendarSettings.calendarId.trim() || null,
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
      alert("Configuracao da agenda salva com sucesso.");
      fetchSchedulingData();
    }

    setSavingCalendarSettings(false);
  };

  const handleSaveSessions = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUserId) return;

    if (!form.startsAt) {
      alert("Escolha a data e hora da aula.");
      return;
    }

    if (form.mode === "scheduled" && !form.studentId) {
      alert("Selecione o aluno para confirmar a aula.");
      return;
    }

    setSaving(true);

    const recurrenceCount = form.isRecurring
      ? Math.max(parseInt(form.recurrenceCount, 10) || 1, 1)
      : 1;
    const recurrenceGroupId =
      recurrenceCount > 1 ? crypto.randomUUID() : null;
    const startDate = new Date(form.startsAt);
    const durationMinutes = Math.max(parseInt(form.durationMinutes, 10) || 60, 15);

    const records = Array.from({ length: recurrenceCount }).map((_, index) => {
      const lessonStart = new Date(startDate);
      lessonStart.setDate(startDate.getDate() + index * 7);

      const lessonEnd = new Date(lessonStart);
      lessonEnd.setMinutes(lessonEnd.getMinutes() + durationMinutes);

      return {
        teacher_id: currentUserId,
        created_by: currentUserId,
        student_id: form.mode === "scheduled" ? form.studentId : null,
        title:
          form.title.trim() ||
          (form.mode === "available"
            ? "Horario disponivel para aula"
            : "Aula confirmada"),
        description: form.description.trim() || null,
        session_track: form.sessionTrack,
        status: form.mode === "available" ? "available" : "scheduled",
        starts_at: lessonStart.toISOString(),
        ends_at: lessonEnd.toISOString(),
        meet_link: form.meetLink.trim() || null,
        calendar_provider:
          calendarSettings.isActive && calendarSettings.calendarId
            ? "google_calendar"
            : null,
        calendar_calendar_id:
          calendarSettings.isActive && calendarSettings.calendarId
            ? calendarSettings.calendarId.trim()
            : null,
        calendar_event_id: null,
        recurrence_group_id: recurrenceGroupId,
        recurrence_index: index + 1,
        booked_at:
          form.mode === "scheduled" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from("scheduled_lessons").insert(records);

    if (error) {
      alert(error.message);
    } else {
      alert(
        form.mode === "available"
          ? "Horarios publicados com sucesso."
          : "Aulas agendadas com sucesso.",
      );
      setForm(initialForm);
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
      <div className="mx-auto max-w-6xl px-4 py-8">
        <BackLink to="/dashboard-professor" label="Voltar para meus alunos" />

        <header className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                Agenda de aulas
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Mentorias, aulas e Google Agenda
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                Configure sua booking page do Google, conecte sua conta e traga
                eventos da agenda para dentro da plataforma.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SmallStat label="Alunos vinculados" value={students.length} />
              <SmallStat label="Proximas aulas" value={upcomingSessions.length} />
              <SmallStat
                label="Total de acessos"
                value={Object.values(accessCounts).reduce((sum, count) => sum + count, 0)}
              />
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-8">
            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Integracao
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Configurar Google Agenda
              </h2>

              <form onSubmit={handleSaveCalendarSettings} className="mt-6 space-y-4">
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

                  <Field label="Calendar ID / agenda base">
                    <input
                      className={fieldInputClass}
                      value={calendarSettings.calendarId}
                      onChange={(event) =>
                        setCalendarSettings({
                          ...calendarSettings,
                          calendarId: event.target.value,
                        })
                      }
                      placeholder="primary ou email do calendario"
                    />
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

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={connectGoogleCalendar}
                        disabled={connectingGoogle || processingGoogleCallback}
                        className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {connectingGoogle ? "Conectando..." : "Conectar Google"}
                      </button>

                      <button
                        type="button"
                        onClick={syncGoogleCalendar}
                        disabled={
                          syncingGoogle ||
                          processingGoogleCallback ||
                          calendarSettings.connectionStatus !== "connected"
                        }
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {syncingGoogle ? "Sincronizando..." : "Sincronizar agora"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-brand-lavender/10 p-4 text-sm leading-6 text-brand-ice ring-1 ring-brand-lavender/20">
                  No modo de booking page, o aluno agenda pelo link publico do
                  Google. No modo de sincronizacao, a plataforma passa a importar
                  eventos da agenda conectada para dentro do painel.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={savingCalendarSettings}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCalendarSettings
                      ? "Salvando..."
                      : "Salvar configuracao"}
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
            </section>

            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Novo agendamento
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Publicar horario ou confirmar aula
              </h2>

              <form onSubmit={handleSaveSessions} className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Modo">
                    <select
                      className={fieldInputClass}
                      value={form.mode}
                      onChange={(event) =>
                        setForm({ ...form, mode: event.target.value })
                      }
                    >
                      <option value="available" className="bg-gray-900">
                        Publicar horario livre
                      </option>
                      <option value="scheduled" className="bg-gray-900">
                        Agendar direto para um aluno
                      </option>
                    </select>
                  </Field>

                  <Field label="Tipo de jornada">
                    <select
                      className={fieldInputClass}
                      value={form.sessionTrack}
                      onChange={(event) =>
                        setForm({ ...form, sessionTrack: event.target.value })
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

                <Field label="Titulo da aula">
                  <input
                    className={fieldInputClass}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="Ex: Mentoria de logica, plantao de duvidas..."
                  />
                </Field>

                <Field label="Aluno">
                  <select
                    className={fieldInputClass}
                    value={form.studentId}
                    onChange={(event) =>
                      setForm({ ...form, studentId: event.target.value })
                    }
                    disabled={form.mode === "available"}
                  >
                    <option value="">Escolha um aluno...</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id} className="bg-gray-900">
                        {student.full_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Inicio">
                    <input
                      type="datetime-local"
                      className={fieldInputClass}
                      value={form.startsAt}
                      onChange={(event) =>
                        setForm({ ...form, startsAt: event.target.value })
                      }
                      required
                    />
                  </Field>

                  <Field label="Duracao (min)">
                    <input
                      type="number"
                      className={fieldInputClass}
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm({ ...form, durationMinutes: event.target.value })
                      }
                      min={15}
                      step={15}
                    />
                  </Field>
                </div>

                <Field label="Link da aula / Meet">
                  <input
                    className={fieldInputClass}
                    value={form.meetLink}
                    onChange={(event) =>
                      setForm({ ...form, meetLink: event.target.value })
                    }
                    placeholder="Cole aqui o link do Meet ou deixe em branco por enquanto"
                  />
                </Field>

                <Field label="Descricao">
                  <textarea
                    className={`${fieldInputClass} min-h-28`}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Observacoes da aula, objetivo do encontro, materiais..."
                  />
                </Field>

                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <label className="flex items-center gap-3 text-sm font-semibold text-white">
                    <input
                      type="checkbox"
                      checked={form.isRecurring}
                      onChange={(event) =>
                        setForm({ ...form, isRecurring: event.target.checked })
                      }
                    />
                    Repetir semanalmente
                  </label>

                  {form.isRecurring && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Quantidade de encontros">
                        <input
                          type="number"
                          className={fieldInputClass}
                          min={2}
                          value={form.recurrenceCount}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              recurrenceCount: event.target.value,
                            })
                          }
                        />
                      </Field>

                      <div className="rounded-2xl bg-brand-900/40 p-4 text-sm leading-6 text-white/60 ring-1 ring-white/10">
                        Os encontros recorrentes serao criados no mesmo horario,
                        repetindo a cada 7 dias.
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar agenda"}
                </button>
              </form>
            </section>
          </div>

          <div className="space-y-8">
            <SessionList
              eyebrow="Agenda ativa"
              title="Proximos horarios e aulas"
              sessions={upcomingSessions}
              studentNameMap={studentNameMap}
              accessCounts={accessCounts}
              onUpdateStatus={updateSessionStatus}
            />

            <SessionList
              eyebrow="Historico"
              title="Aulas passadas e canceladas"
              sessions={pastSessions}
              studentNameMap={studentNameMap}
              accessCounts={accessCounts}
              onUpdateStatus={updateSessionStatus}
              past
            />
          </div>
        </div>
      </div>
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

const SmallStat = ({
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

const SessionList = ({
  eyebrow,
  title,
  sessions,
  studentNameMap,
  accessCounts,
  onUpdateStatus,
  past = false,
}: {
  eyebrow: string;
  title: string;
  sessions: any[];
  studentNameMap: Record<string, string>;
  accessCounts: Record<string, number>;
  onUpdateStatus: (sessionId: string, status: "completed" | "cancelled") => void;
  past?: boolean;
}) => (
  <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>

    <div className="mt-6 space-y-4">
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
          Nenhum registro nesta secao ainda.
        </div>
      ) : (
        sessions.map((session) => (
          <article
            key={session.id}
            className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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
                  <h3 className="text-lg font-bold text-white">{session.title}</h3>
                  <p className="mt-2 text-sm text-white/60">
                    {formatDateTime(session.starts_at)} ate {formatDateTime(session.ends_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-white/55">
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
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ice hover:text-white"
                  >
                    Abrir link da aula
                  </a>
                ) : (
                  <p className="text-sm text-white/40">
                    Link da aula ainda nao informado.
                  </p>
                )}
              </div>

              {!past && (
                <div className="flex gap-2">
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
