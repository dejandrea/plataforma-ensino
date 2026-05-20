import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const criteria = [
  { id: "technical", label: "Proficiencia Tecnica" },
  { id: "logic", label: "Raciocinio Logico" },
  { id: "creativity", label: "Criatividade" },
  { id: "autonomy", label: "Autonomia" },
  { id: "communication", label: "Comunicacao" },
  { id: "organization", label: "Organizacao e Entrega" },
  { id: "engagement", label: "Engajamento e Atitude" },
  { id: "patience", label: "Paciencia" },
];

interface EvaluationFormProps {
  studentId: string;
  moduleId: string;
  onSaved?: () => void;
}

const expectedFeedbackKeys = [
  "technical",
  "logic",
  "creativity",
  "autonomy",
  "communication",
  "organization",
  "engagement",
  "patience",
];

const isValidAiFeedback = (value: unknown): value is Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return expectedFeedbackKeys.every((key) => {
    const item = (value as Record<string, unknown>)[key];
    return typeof item === "string" && item.trim().length > 0;
  });
};

const mapEvaluationToScores = (evaluation: any) => ({
  technical: evaluation?.score_technical || 0,
  logic: evaluation?.score_logic || 0,
  creativity: evaluation?.score_creativity || 0,
  autonomy: evaluation?.score_autonomy || 0,
  communication: evaluation?.score_communication || 0,
  organization: evaluation?.score_organization || 0,
  engagement: evaluation?.score_engagement || 0,
  patience: evaluation?.score_patience || 0,
});

export const EvaluationForm = ({
  studentId,
  moduleId,
  onSaved,
}: EvaluationFormProps) => {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingEvaluation, setExistingEvaluation] = useState<any | null>(null);

  useEffect(() => {
    async function fetchExistingEvaluation() {
      setLoadingExisting(true);

      const { data, error } = await supabase
        .from("module_evaluations")
        .select("*")
        .eq("student_id", studentId)
        .eq("module_id", moduleId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar avaliacao existente:", error.message);
        setExistingEvaluation(null);
        setScores({});
        setComment("");
      } else if (data) {
        setExistingEvaluation(data);
        setScores(mapEvaluationToScores(data));
        setComment(data.teacher_comment || "");
      } else {
        setExistingEvaluation(null);
        setScores({});
        setComment("");
      }

      setLoadingExisting(false);
    }

    fetchExistingEvaluation();
  }, [studentId, moduleId]);

  const handleSubmit = async () => {
    if (existingEvaluation) return;

    setLoading(true);

    try {
      let aiFeedbackJson: Record<string, string> | null = null;
      let usedTeacherFallback = false;

      const { data: aiResponse, error: aiError } =
        await supabase.functions.invoke("generate-feedback", {
          body: { scores, teacherComment: comment },
        });

      if (!aiError && isValidAiFeedback(aiResponse)) {
        aiFeedbackJson = aiResponse;
      } else {
        usedTeacherFallback = true;
      }

      const { error } = await supabase.from("module_evaluations").insert({
        student_id: studentId,
        module_id: moduleId,
        teacher_comment: comment,
        ai_feedback_json: aiFeedbackJson,
        score_technical: scores.technical || 0,
        score_logic: scores.logic || 0,
        score_creativity: scores.creativity || 0,
        score_autonomy: scores.autonomy || 0,
        score_communication: scores.communication || 0,
        score_organization: scores.organization || 0,
        score_engagement: scores.engagement || 0,
        score_patience: scores.patience || 0,
      });

      if (error) {
        throw error;
      }

      alert(
        usedTeacherFallback
          ? "Avaliacao salva. Como a IA nao respondeu, o comentario da professora sera usado no boletim."
          : "Avaliacao completa gerada com IA.",
      );
      onSaved?.();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="rounded-[2rem] bg-white p-10 text-center text-slate-500 shadow-2xl ring-1 ring-slate-200">
        Carregando avaliacao...
      </div>
    );
  }

  const isReadOnly = Boolean(existingEvaluation);

  return (
    <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200">
      <div className="bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
          Registro pedagogico
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
          Avaliacao do modulo
        </h2>
        <p className="mt-2 text-sm text-white/80">
          {isReadOnly
            ? "Esta avaliacao ja foi registrada e esta disponivel apenas para consulta."
            : "Defina uma nota por criterio e deixe um comentario final para o aluno."}
        </p>
      </div>

      <div className="space-y-8 p-6 md:p-8">
        {isReadOnly && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Este aluno ja possui avaliacao cadastrada para este modulo. A edicao
            ainda nao esta disponivel.
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {criteria.map((criterion) => {
            const selectedScore = scores[criterion.id] || 0;

            return (
              <div
                key={criterion.id}
                className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-slate-800">
                    {criterion.label}
                  </label>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-slate-200">
                    {selectedScore > 0 ? `${selectedScore}/5` : "Sem nota"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = selectedScore >= star;

                    return (
                      <button
                        key={star}
                        onClick={() =>
                          !isReadOnly &&
                          setScores({ ...scores, [criterion.id]: star })
                        }
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition ${
                          active
                            ? "border-amber-300 bg-amber-100 text-amber-500 shadow-sm"
                            : "border-slate-200 bg-white text-slate-300 hover:border-amber-200 hover:text-amber-400"
                        } ${isReadOnly ? "cursor-default" : ""}`}
                        type="button"
                        aria-label={`${criterion.label}: nota ${star}`}
                        disabled={isReadOnly}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <label className="text-sm font-bold text-slate-800">
            Comentario da professora
          </label>
          <p className="mt-2 text-sm text-slate-500">
            Esse texto sera usado no boletim mesmo quando a IA nao estiver
            disponivel.
          </p>

          <textarea
            className="mt-4 min-h-36 w-full rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-lavender focus:ring-2 focus:ring-brand-lavender/30 disabled:cursor-default disabled:bg-slate-100"
            placeholder="Descreva o desempenho do aluno, pontos fortes e proximos passos..."
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || isReadOnly}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          {isReadOnly
            ? "Avaliacao ja registrada"
            : loading
              ? "Processando..."
              : "Salvar avaliacao"}
        </button>
      </div>
    </div>
  );
};
