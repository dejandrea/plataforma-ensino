import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Aguardando registro";

const getRoomReleaseTime = (startsAt: string) =>
  new Date(new Date(startsAt).getTime() - 5 * 60 * 1000);

const canAccessRoom = (lesson: { meet_link?: string | null; starts_at: string }) =>
  Boolean(lesson.meet_link) && Date.now() >= getRoomReleaseTime(lesson.starts_at).getTime();

export const LessonRoom = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningMeet, setJoiningMeet] = useState(false);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
    full_name: string | null;
  } | null>(null);
  const [lesson, setLesson] = useState<any | null>(null);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!lessonId) {
      setErrorMessage("Aula nao encontrada.");
      setLoading(false);
      return;
    }

    void fetchRoomData();
  }, [lessonId]);

  const fetchRoomData = async (silent = false) => {
    if (!lessonId) return;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    const [{ data: accessProfile, error: accessProfileError }, { data: lessonData, error }] =
      await Promise.all([
        supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single(),
        supabase.from("scheduled_lessons").select("*").eq("id", lessonId).single(),
      ]);

    if (accessProfileError || !accessProfile) {
      setErrorMessage("Nao foi possivel identificar seu acesso para esta sala.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setCurrentUser(accessProfile);

    if (error || !lessonData) {
      setErrorMessage(
        error?.message || "Nao foi possivel carregar os dados desta aula.",
      );
      setLesson(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLesson(lessonData);

    const idsToResolve = Array.from(
      new Set(
        [
          accessProfile.id,
          lessonData.teacher_id,
          lessonData.student_id,
          lessonData.completed_by,
        ].filter(Boolean),
      ),
    );

    if (idsToResolve.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", idsToResolve);

      setProfileNames(
        Object.fromEntries(
          (profiles || []).map((profile) => [profile.id, profile.full_name || "Usuario"]),
        ),
      );
    } else {
      setProfileNames({});
    }

    setLoading(false);
    setRefreshing(false);
  };

  const backTarget = currentUser?.role === "student" ? "/minhas-aulas" : "/agendamentos";
  const backLabel =
    currentUser?.role === "student"
      ? "Voltar para minhas aulas"
      : "Voltar para agendamentos";
  const canOpenMeet = lesson ? canAccessRoom(lesson) : false;
  const roomReleaseTime = lesson ? getRoomReleaseTime(lesson.starts_at) : null;
  const isTeacherView = currentUser?.role === "admin" || currentUser?.role === "professor";

  const participantLabel = useMemo(() => {
    if (!lesson) return "";

    if (currentUser?.role === "student") {
      return profileNames[lesson.teacher_id] || "Professora";
    }

    return lesson.student_id
      ? profileNames[lesson.student_id] || "Aluno"
      : "Aluno ainda nao vinculado";
  }, [currentUser?.role, lesson, profileNames]);

  const handleJoinMeet = async () => {
    if (!lesson || !lesson.meet_link || !canOpenMeet) return;

    setJoiningMeet(true);

    const { data, error } = await supabase.rpc("start_scheduled_lesson_session", {
      p_lesson_id: lesson.id,
    });

    if (error) {
      alert(error.message);
      setJoiningMeet(false);
      return;
    }

    setLesson(data || lesson);

    if (currentUser?.role === "student") {
      const { error: accessError } = await supabase.rpc("log_scheduled_lesson_access", {
        p_lesson_id: lesson.id,
      });

      if (accessError) {
        console.error("Falha ao registrar acesso do aluno na sala:", accessError.message);
      }
    }

    window.open(lesson.meet_link, "_blank", "noopener,noreferrer");
    await fetchRoomData(true);
    setJoiningMeet(false);
  };

  const handleCompleteLesson = async () => {
    if (!lesson || !currentUser || !isTeacherView) return;

    setCompletingLesson(true);

    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("scheduled_lessons")
      .update({
        status: "completed",
        completed_at: completedAt,
        completed_by: currentUser.id,
        updated_at: completedAt,
      })
      .eq("id", lesson.id);

    if (error) {
      alert(error.message);
      setCompletingLesson(false);
      return;
    }

    await fetchRoomData(true);
    setCompletingLesson(false);
    alert("Aula concluida com sucesso.");
  };

  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Preparando a sala da aula...
          </div>
        </div>
      </div>
    );
  }

  if (!lesson || errorMessage) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/35">
              Sala interna
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white">
              Nao foi possivel abrir esta aula
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              {errorMessage || "A aula solicitada nao esta disponivel para este usuario."}
            </p>
            <Link
              to={backTarget}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-brand-pink/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-lavender">
                Sala interna
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                {lesson.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Esta pagina centraliza o inicio da aula, registra quem entrou na sala
                e guarda o encerramento oficial quando a professora concluir o encontro.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void fetchRoomData(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? "Atualizando..." : "Atualizar sala"}
              </button>
              <Link
                to={backTarget}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                {backLabel}
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="space-y-6">
            <div className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
                  {lesson.session_track === "course" ? "Curso completo" : "Mentoria"}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
                  {lesson.status === "completed"
                    ? "Concluida"
                    : lesson.status === "cancelled"
                      ? "Cancelada"
                      : "Agendada"}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoBlock label="Horario da aula" value={formatDateTime(lesson.starts_at)} />
                <InfoBlock label="Fim previsto" value={formatDateTime(lesson.ends_at)} />
                <InfoBlock
                  label={currentUser?.role === "student" ? "Sua professora" : "Aluno"}
                  value={participantLabel}
                />
                <InfoBlock
                  label="Sala liberada"
                  value={roomReleaseTime ? formatDateTime(roomReleaseTime.toISOString()) : "-"}
                />
              </div>
            </div>

            <div className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                Linha do tempo da aula
              </p>

              <div className="mt-5 space-y-4">
                <TimelineRow
                  label="Inicio registrado"
                  value={formatDateTime(lesson.started_at)}
                  highlight={Boolean(lesson.started_at)}
                />
                <TimelineRow
                  label="Entrada do aluno"
                  value={formatDateTime(lesson.student_joined_at)}
                  highlight={Boolean(lesson.student_joined_at)}
                />
                <TimelineRow
                  label="Entrada da professora"
                  value={formatDateTime(lesson.teacher_joined_at)}
                  highlight={Boolean(lesson.teacher_joined_at)}
                />
                <TimelineRow
                  label="Conclusao oficial"
                  value={formatDateTime(lesson.completed_at)}
                  detail={
                    lesson.completed_by
                      ? `Por ${profileNames[lesson.completed_by] || "professora"}`
                      : undefined
                  }
                  highlight={Boolean(lesson.completed_at)}
                />
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-pink/80">
                Passo da sessao
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white">
                Entrar no Meet
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Ao clicar abaixo, a plataforma registra o inicio da aula para este
                participante e abre o link do Meet em outra aba.
              </p>

              <button
                type="button"
                onClick={handleJoinMeet}
                disabled={!canOpenMeet || joiningMeet || lesson.status !== "scheduled"}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {joiningMeet
                  ? "Abrindo Meet..."
                  : !lesson.meet_link
                    ? "Link em breve"
                    : lesson.status === "completed"
                      ? "Aula ja concluida"
                      : canOpenMeet
                        ? "Registrar inicio e abrir Meet"
                        : "Sala em breve"}
              </button>

              {!lesson.meet_link ? (
                <p className="mt-3 text-center text-xs text-white/45">
                  O Meet ainda nao foi vinculado a este encontro.
                </p>
              ) : !canOpenMeet ? (
                <p className="mt-3 text-center text-xs text-white/45">
                  Sala liberada as: {formatDateTime(roomReleaseTime?.toISOString())}
                </p>
              ) : (
                <p className="mt-3 text-center text-xs text-white/45">
                  A sala sera aberta em outra aba para voce manter esta pagina como base
                  de controle.
                </p>
              )}
            </div>

            {isTeacherView && (
              <div className="rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                  Fechamento da aula
                </p>
                <h2 className="mt-3 text-2xl font-bold text-white">
                  Concluir encontro
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  Quando a sessao terminar, volte para esta sala interna e conclua a
                  aula. Esse passo fecha o registro oficial usado no resumo mensal do
                  aluno.
                </p>

                <button
                  type="button"
                  onClick={handleCompleteLesson}
                  disabled={completingLesson || lesson.status !== "scheduled"}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {completingLesson
                    ? "Concluindo..."
                    : lesson.status === "completed"
                      ? "Aula concluida"
                      : "Concluir aula"}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

const InfoBlock = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl bg-brand-900/40 p-4 ring-1 ring-white/10">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-sm font-semibold text-white">{value}</p>
  </div>
);

const TimelineRow = ({
  label,
  value,
  detail,
  highlight = false,
}: {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) => (
  <div className="rounded-2xl bg-brand-900/35 p-4 ring-1 ring-white/10">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
          {label}
        </p>
        {detail && <p className="mt-2 text-xs text-white/45">{detail}</p>}
      </div>
      <p className={`text-sm font-semibold ${highlight ? "text-white" : "text-white/45"}`}>
        {value}
      </p>
    </div>
  </div>
);
