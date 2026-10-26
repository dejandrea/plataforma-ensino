import { useNavigate } from "react-router-dom";

interface LessonProps {
  id: string;
  title: string;
  type: "video" | "pdf" | "meet";
  isCompleted: boolean;
  isPlanned?: boolean;
  curriculumNumber?: number | null;
}

const lessonTypeLabel: Record<LessonProps["type"], string> = {
  video: "Video aula",
  pdf: "Material guiado",
  meet: "Encontro ao vivo",
};

const lessonTypeIcon: Record<LessonProps["type"], string> = {
  video: "VD",
  pdf: "PDF",
  meet: "AO",
};

export const LessonCard = ({
  id,
  title,
  type,
  isCompleted,
  isPlanned = false,
  curriculumNumber,
}: LessonProps) => {
  const navigate = useNavigate();

  return (
    <button
      disabled={isPlanned}
      onClick={() => navigate(`/lesson/${id}`)}
      type="button"
      className={`group flex w-full items-center gap-4 rounded-3xl p-5 text-left ring-1 transition disabled:cursor-default disabled:opacity-60 ${
        isCompleted
          ? "bg-emerald-500/10 ring-emerald-400/20"
          : "bg-surface ring-white/10 hover:bg-white/7"
      }`}
    >
      <div
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xs font-black uppercase shadow-soft ${
          isCompleted
            ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20"
            : "bg-gradient-to-br from-brand-purple to-brand-pink text-white ring-1 ring-white/10"
        }`}
      >
        {lessonTypeIcon[type]}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45 ring-1 ring-white/10">
            {isPlanned ? "Em preparação" : lessonTypeLabel[type]}
          </span>
          {curriculumNumber != null && <span className="text-xs text-brand-lavender">{curriculumNumber === 0 ? "Introdução" : `Aula ${String(curriculumNumber).padStart(2, '0')}`}</span>}
        </div>

        <p className="mt-2 text-sm text-white/60">
          {isPlanned ? "Os materiais desta aula serão liberados em breve." : isCompleted
            ? "Concluida. Voce pode revisar quando quiser."
            : "Pronta para continuar sua jornada."}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.18em] ${
            isCompleted ? "text-emerald-300" : "text-brand-lavender"
          }`}
        >
          {isPlanned ? "Em breve" : isCompleted ? "Feita" : "Abrir"}
        </p>
        <p className="mt-1 text-lg text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white/70">
          &gt;
        </p>
      </div>
    </button>
  );
};
