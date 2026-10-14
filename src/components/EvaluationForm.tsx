import { useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { fetchStudentModules } from "../lib/studentCourses";
import { formatEvaluationMonth } from "../lib/evaluationPeriods";
import { averageOutOfTen, characterCount, evaluationCriteria as criteria, hasCompleteScores, isValidFeedback } from "../lib/evaluationDraft";

interface EvaluationFormProps {
  studentId: string;
  moduleId?: string;
  referenceMonth?: string;
  onSaved?: () => void;
}

export const EvaluationForm = ({ studentId, moduleId, referenceMonth, onSaved }: EvaluationFormProps) => {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [teacherComment, setTeacherComment] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [existingEvaluation, setExistingEvaluation] = useState<any | null>(null);
  const actionInFlight = useRef(false);
  const generationId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingExisting(true);
    setLoadError("");
    setMessage("");
    setFeedback(null);
    setScores({});
    setTeacherComment("");
    setExistingEvaluation(null);
    async function load() {
      let query = supabase.from("module_evaluations").select("*").eq("student_id", studentId);
      query = referenceMonth ? query.eq("reference_month", referenceMonth) : query.eq("module_id", moduleId!);
      const { data, error } = await query.maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError("Não foi possível verificar se esta avaliação já foi salva. Atualize a página para tentar novamente.");
      } else if (data) {
        setExistingEvaluation(data);
        setScores(Object.fromEntries(criteria.map(({ id }) => [id, data[`score_${id}`] || 0])));
        setTeacherComment(data.teacher_comment || "");
        setFeedback(data.ai_feedback_json || null);
      }
      setLoadingExisting(false);
    }
    void load();
    return () => { cancelled = true; generationId.current++; };
  }, [studentId, moduleId, referenceMonth]);

  const isReadOnly = Boolean(existingEvaluation);
  const busy = generating || saving;
  const average = averageOutOfTen(scores);

  const validateTarget = async () => {
    if (referenceMonth) {
      const { data, error } = await supabase.rpc("pending_mentoring_evaluation_months", { p_student_id: studentId });
      if (error) throw error;
      if (!data?.some((item: { reference_month: string }) => item.reference_month === referenceMonth)) {
        throw new Error("Este mês não está disponível ou já foi avaliado. Atualize a página.");
      }
    } else {
      const modules = await fetchStudentModules(studentId);
      if (!modules.some((module) => module.id === moduleId)) throw new Error("Esta matéria ainda não foi concluída.");
    }
  };

  const showError = async (error: unknown) => {
    let text = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      text = body?.error || text;
    }
    setMessage(text);
  };

  const generateFeedback = async () => {
    if (isReadOnly || loadError || loadingExisting || actionInFlight.current || feedback) return;
    actionInFlight.current = true;
    const requestId = ++generationId.current;
    setGenerating(true);
    setMessage("");
    try {
      if (!hasCompleteScores(scores)) throw new Error("Preencha uma nota de 1 a 5 para todos os critérios.");
      await validateTarget();
      const { data, error } = await supabase.functions.invoke("generate-feedback", {
        body: { scores, teacherComment },
      });
      if (requestId !== generationId.current) return;
      if (error) throw error;
      if (!isValidFeedback(data, true)) throw new Error("A IA não retornou todos os textos nos tamanhos esperados. Envie as notas novamente.");
      setFeedback(data);
      setMessage("Feedbacks gerados. Revise os textos abaixo de cada área e a avaliação geral antes de salvar.");
    } catch (error) {
      if (requestId === generationId.current) await showError(error);
    } finally {
      actionInFlight.current = false;
      if (requestId === generationId.current) setGenerating(false);
    }
  };

  const saveEvaluation = async () => {
    if (isReadOnly || loadError || loadingExisting || actionInFlight.current || !feedback) return;
    actionInFlight.current = true;
    setSaving(true);
    setMessage("");
    try {
      if (!hasCompleteScores(scores) || !isValidFeedback(feedback)) {
        throw new Error("Revise os textos: cada área deve ter até 100 caracteres e a avaliação geral de 250 a 400.");
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Entre novamente para salvar a avaliação.");
      await validateTarget();
      const reviewedFeedback = Object.fromEntries(Object.entries(feedback).map(([key, value]) => [key, value.trim()]));
      const { data, error } = await supabase.from("module_evaluations").insert({
        student_id: studentId,
        teacher_id: user.id,
        module_id: referenceMonth ? null : moduleId,
        reference_month: referenceMonth || null,
        teacher_comment: reviewedFeedback.general,
        ai_feedback_json: reviewedFeedback,
        ...Object.fromEntries(criteria.map(({ id }) => [`score_${id}`, scores[id]])),
      }).select("*").single();
      if (error) throw error;
      setExistingEvaluation(data);
      setFeedback(reviewedFeedback);
      setMessage("Avaliação salva. Os textos estão disponíveis somente para consulta.");
      onSaved?.();
    } catch (error) {
      await showError(error);
    } finally {
      actionInFlight.current = false;
      setSaving(false);
    }
  };

  const changeScore = (id: string, value: number) => {
    if (isReadOnly || busy || scores[id] === value) return;
    setScores((previous) => ({ ...previous, [id]: value }));
    if (feedback) {
      setFeedback(null);
      setMessage("As notas mudaram. Envie-as novamente para gerar os feedbacks atualizados.");
    }
  };
  const updateFeedback = (key: string, value: string) => setFeedback((previous) => previous ? { ...previous, [key]: value } : null);
  const inputClass = "mt-3 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-brand-lavender focus:ring-2 focus:ring-brand-lavender/30 disabled:bg-slate-100";
  const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

  if (loadingExisting) return <div className="rounded-3xl bg-white p-10 text-center text-slate-500">Carregando avaliação...</div>;
  if (loadError) return <div role="alert" className="rounded-3xl bg-amber-50 p-6 text-amber-900">{loadError}</div>;

  return (
    <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200">
      <header className="bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">Registro pedagógico</p>
        <h2 className="mt-2 text-3xl font-extrabold">{referenceMonth ? `Avaliação mensal — ${formatEvaluationMonth(referenceMonth)}` : "Avaliação do módulo"}</h2>
        <p className="mt-2 text-sm text-white/80">{isReadOnly ? "Avaliação salva. Disponível somente para consulta." : "Preencha as notas, envie para a IA e revise os feedbacks antes de salvar."}</p>
        {average !== null && <p className="mt-4 font-bold">Média geral: {average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/10 <span className="text-sm font-normal text-white/75">(5 estrelas = 10)</span></p>}
      </header>
      <div className="space-y-8 p-6 md:p-8">
        {message && <p role="status" className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">{message}</p>}
        <div className="grid gap-5 md:grid-cols-2">
          {criteria.map(({ id, label }) => (
            <section key={id} className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-800">{label}</h3>
                <span className="text-xs font-bold text-slate-500">{scores[id] ? `${scores[id]}/5` : "Sem nota"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => changeScore(id, star)} disabled={isReadOnly || busy}
                    aria-label={`${label}: nota ${star}`} aria-pressed={scores[id] === star}
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition disabled:cursor-default ${scores[id] >= star ? "border-amber-300 bg-amber-100 text-amber-500" : "border-slate-200 bg-white text-slate-300 hover:text-amber-400"}`}>★</button>
                ))}
              </div>
              {typeof feedback?.[id] === "string" && (
                <div className="mt-5">
                  <label htmlFor={`feedback-${id}`} className="text-xs font-bold text-slate-600">Feedback da área</label>
                  <textarea id={`feedback-${id}`} className={inputClass} rows={3} value={feedback[id]} onChange={(event) => updateFeedback(id, event.target.value)} disabled={isReadOnly || busy} aria-describedby={`count-${id}`} />
                  <p id={`count-${id}`} className={`mt-1 text-xs ${characterCount(feedback[id]) > 100 ? "text-rose-600" : "text-slate-500"}`}>{characterCount(feedback[id])}/100 caracteres</p>
                </div>
              )}
            </section>
          ))}
        </div>
        <section className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <label htmlFor="evaluation-comment" className="text-sm font-bold text-slate-800">{typeof feedback?.general === "string" ? "Avaliação geral" : "Comentário da professora"}</label>
          <p className="mt-2 text-sm text-slate-500">{typeof feedback?.general === "string" ? "Revise o texto gerado. Depois de salvar, a avaliação não poderá ser editada." : "Descreva o desempenho e os próximos passos. A IA usará seu comentário para gerar a avaliação geral."}</p>
          <textarea id="evaluation-comment" className={inputClass} rows={5} value={feedback?.general ?? teacherComment}
            onChange={(event) => feedback ? updateFeedback("general", event.target.value) : setTeacherComment(event.target.value)} disabled={isReadOnly || busy} />
          {feedback?.general !== undefined && <p className={`mt-1 text-xs ${characterCount(feedback.general) < 250 || characterCount(feedback.general) > 400 ? "text-rose-600" : "text-slate-500"}`}>{characterCount(feedback.general)}/400 caracteres — mínimo de 250</p>}
        </section>
        {!isReadOnly && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void generateFeedback()} disabled={busy || !hasCompleteScores(scores) || feedback !== null}
              className={`${buttonClass} bg-brand-purple/10 text-brand-purple ring-1 ring-brand-purple/25`}>{generating ? "Gerando feedbacks..." : "Enviar notas"}</button>
            <button type="button" onClick={() => void saveEvaluation()} disabled={busy || !isValidFeedback(feedback)}
              className={`${buttonClass} bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-soft`}>{saving ? "Salvando..." : "Salvar avaliação"}</button>
          </div>
        )}
      </div>
    </div>
  );
};
