import { Link } from "react-router-dom";

export const StudentCard = ({
  student,
  onUnlink,
}: {
  student: any;
  onUnlink: (id: string) => void;
}) => {
  const evaluationsCount = student.module_evaluations?.length || 0;

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur transition hover:bg-white/7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-pink/15 blur-3xl opacity-0 transition group-hover:opacity-100" />

      <button
        onClick={() => onUnlink(student.id)}
        className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold text-white/45 transition hover:bg-white/10 hover:text-rose-300"
        title="Desvincular aluno"
        type="button"
      >
        <span className="opacity-0 transition group-hover:opacity-100">Remover</span>
        <span className="text-base leading-none">X</span>
      </button>

      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-pink text-white shadow-soft ring-1 ring-white/10">
          <span className="text-xl font-extrabold">
            {student.full_name?.charAt(0)?.toUpperCase() || "A"}
          </span>
        </div>

        <div className="min-w-0 pr-10">
          <h3 className="truncate text-base font-bold text-white" title={student.full_name}>
            {student.full_name}
          </h3>

          <p className="mt-1 flex items-center gap-2 text-xs text-white/60">
            <span className="h-2 w-2 rounded-full bg-emerald-400/90 ring-2 ring-emerald-400/20" />
            Aluno individual
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-lavender/90">
            Jornada
          </span>
          <span className="mt-0.5 text-sm font-semibold text-white/90">
            Modulos concluidos
          </span>
        </div>

        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-r from-brand-magenta to-brand-pink text-sm font-extrabold text-white shadow-soft ring-1 ring-white/10">
          {evaluationsCount}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to={`/admin/avaliar?studentId=${student.id}`}
          state={{ from: "/dashboard-professor" }}
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft ring-1 ring-white/10 transition hover:brightness-110 active:brightness-95"
        >
          Avaliar
        </Link>

        <Link
          to={`/agendamentos?studentId=${student.id}`}
          className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white/85 ring-1 ring-white/15 transition hover:bg-white/10 active:bg-white/15"
        >
          Aulas
        </Link>

        <Link
          to={`/historico/${student.id}`}
          className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white/85 ring-1 ring-white/15 transition hover:bg-white/10 active:bg-white/15 sm:col-span-2"
        >
          Historico completo
        </Link>
      </div>
    </div>
  );
};
